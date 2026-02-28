// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract BountyBoard is ReentrancyGuard {
    enum TaskStatus {
        Created,
        Claimed,
        Submitted,
        Accepted,
        Cancelled,
        Expired
    }

    struct Task {
        address creator;
        address worker;
        uint256 reward;
        uint64  createdAt;
        uint64  deadline;
        uint64  submitAt;
        TaskStatus status;
        string  metaURI;
        bytes32 deliverableHash;
        string  deliverableURI;
    }

    uint256 public totalTasks;
    uint256 public gracePeriod;
    uint256 public constant MAX_URI_LENGTH = 2048;
    uint8   public constant MAX_RESUBMIT = 1;

    mapping(uint256 => Task) private _tasks;
    mapping(uint256 => uint8) public rejectCount;

    event TaskCreated(
        uint256 indexed taskId,
        address indexed creator,
        uint256 reward,
        uint64  deadline,
        string  metaURI
    );
    event TaskClaimed(uint256 indexed taskId, address indexed worker);
    event TaskSubmitted(
        uint256 indexed taskId,
        address indexed worker,
        string  deliverableURI,
        bytes32 deliverableHash
    );
    event TaskAccepted(uint256 indexed taskId);
    event RewardPaid(uint256 indexed taskId, address indexed worker, uint256 amount);
    event TaskCancelled(uint256 indexed taskId);
    event TaskExpired(uint256 indexed taskId);
    event WorkRejected(uint256 indexed taskId, uint8 rejectCount);

    modifier validTask(uint256 taskId) {
        require(taskId < totalTasks, "Task not found");
        _;
    }

    constructor(uint256 _gracePeriod) {
        gracePeriod = _gracePeriod;
    }

    function createTask(
        uint64 deadline,
        string calldata metaURI
    ) external payable returns (uint256 taskId) {
        require(msg.value > 0, "Reward must be > 0");
        require(deadline > block.timestamp, "Deadline must be in the future");
        uint256 len = bytes(metaURI).length;
        require(len > 0 && len <= MAX_URI_LENGTH, "metaURI empty or too long");

        taskId = totalTasks++;
        Task storage t = _tasks[taskId];
        t.creator   = msg.sender;
        t.reward    = msg.value;
        t.createdAt = uint64(block.timestamp);
        t.deadline  = deadline;
        t.status    = TaskStatus.Created;
        t.metaURI   = metaURI;

        emit TaskCreated(taskId, msg.sender, msg.value, deadline, metaURI);
    }

    function claimTask(uint256 taskId) external validTask(taskId) {
        Task storage t = _tasks[taskId];
        require(t.status == TaskStatus.Created, "Task is not in Created status");
        require(block.timestamp <= t.deadline, "Task deadline has passed");
        require(msg.sender != t.creator, "Creator cannot claim own task");

        t.worker = msg.sender;
        t.status = TaskStatus.Claimed;

        emit TaskClaimed(taskId, msg.sender);
    }

    function submitWork(
        uint256 taskId,
        string calldata deliverableURI,
        bytes32 deliverableHash
    ) external validTask(taskId) {
        Task storage t = _tasks[taskId];
        require(t.status == TaskStatus.Claimed, "Task is not in Claimed status");
        require(msg.sender == t.worker, "Only assigned worker can submit");
        require(block.timestamp <= t.deadline, "Task deadline has passed");
        uint256 len = bytes(deliverableURI).length;
        require(len > 0 && len <= MAX_URI_LENGTH, "deliverableURI empty or too long");
        require(deliverableHash != bytes32(0), "deliverableHash must not be zero");

        t.deliverableURI  = deliverableURI;
        t.deliverableHash = deliverableHash;
        t.status   = TaskStatus.Submitted;
        t.submitAt = uint64(block.timestamp);

        emit TaskSubmitted(taskId, msg.sender, deliverableURI, deliverableHash);
    }

    function acceptWork(uint256 taskId) external nonReentrant validTask(taskId) {
        Task storage t = _tasks[taskId];
        require(t.status == TaskStatus.Submitted, "Task is not in Submitted status");
        require(msg.sender == t.creator, "Only task creator can accept");

        t.status = TaskStatus.Accepted;
        uint256 amount = t.reward;
        address worker = t.worker;

        emit TaskAccepted(taskId);
        emit RewardPaid(taskId, worker, amount);

        (bool ok, ) = payable(worker).call{value: amount}("");
        require(ok, "ETH transfer to worker failed");
    }

    function rejectWork(uint256 taskId) external validTask(taskId) {
        Task storage t = _tasks[taskId];
        require(t.status == TaskStatus.Submitted, "Task is not in Submitted status");
        require(msg.sender == t.creator, "Only task creator can reject");

        rejectCount[taskId]++;

        if (rejectCount[taskId] > MAX_RESUBMIT) {
            t.status = TaskStatus.Cancelled;
            uint256 amount = t.reward;
            address creator = t.creator;
            emit TaskCancelled(taskId);
            (bool ok, ) = payable(creator).call{value: amount}("");
            require(ok, "ETH refund to creator failed");
        } else {
            t.status          = TaskStatus.Claimed;
            t.deliverableURI  = "";
            t.deliverableHash = bytes32(0);
            t.submitAt        = 0;
            emit WorkRejected(taskId, rejectCount[taskId]);
        }
    }

    function cancelTask(uint256 taskId) external nonReentrant validTask(taskId) {
        Task storage t = _tasks[taskId];
        require(t.status == TaskStatus.Created, "Only Created tasks can be cancelled");
        require(msg.sender == t.creator, "Only task creator can cancel");

        t.status = TaskStatus.Cancelled;
        uint256 amount = t.reward;
        address creator = t.creator;

        emit TaskCancelled(taskId);

        (bool ok, ) = payable(creator).call{value: amount}("");
        require(ok, "ETH refund to creator failed");
    }

    function expireTask(uint256 taskId) external nonReentrant validTask(taskId) {
        Task storage t = _tasks[taskId];
        require(
            t.status == TaskStatus.Created ||
            t.status == TaskStatus.Claimed ||
            t.status == TaskStatus.Submitted,
            "Task is already in terminal status"
        );
        require(block.timestamp > t.deadline + gracePeriod, "Grace period has not passed");

        t.status = TaskStatus.Expired;
        uint256 amount = t.reward;
        address creator = t.creator;

        emit TaskExpired(taskId);

        (bool ok, ) = payable(creator).call{value: amount}("");
        require(ok, "ETH refund to creator failed");
    }

    function getTask(uint256 taskId) external view returns (Task memory) {
        return _tasks[taskId];
    }
}
