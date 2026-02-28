import { expect } from "chai";
import { ethers } from "hardhat";
import {
  loadFixture,
  time,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("BountyBoard", function () {
  const GRACE_PERIOD = 7 * 24 * 60 * 60; // 7 days
  const ONE_ETHER = ethers.parseEther("1.0");
  const META_URI = '{"title":"Test Task","description":"A test task","tags":["test"]}';
  const DELIVERABLE_URI = "https://example.com/deliverable";
  const DELIVERABLE_HASH = ethers.keccak256(ethers.toUtf8Bytes("deliverable"));

  async function deployFixture() {
    const [owner, creator, worker, other] = await ethers.getSigners();
    const BountyBoard = await ethers.getContractFactory("BountyBoard");
    const board = await BountyBoard.deploy(GRACE_PERIOD);
    return { board, owner, creator, worker, other };
  }

  async function taskCreatedFixture() {
    const { board, owner, creator, worker, other } = await loadFixture(deployFixture);
    const latest = await time.latest();
    const deadline = latest + 48 * 3600;
    await board.connect(creator).createTask(deadline, META_URI, { value: ONE_ETHER });
    return { board, owner, creator, worker, other, deadline };
  }

  async function taskClaimedFixture() {
    const { board, owner, creator, worker, other, deadline } =
      await loadFixture(taskCreatedFixture);
    await board.connect(worker).claimTask(0);
    return { board, owner, creator, worker, other, deadline };
  }

  async function taskSubmittedFixture() {
    const { board, owner, creator, worker, other, deadline } =
      await loadFixture(taskClaimedFixture);
    await board.connect(worker).submitWork(0, DELIVERABLE_URI, DELIVERABLE_HASH);
    return { board, owner, creator, worker, other, deadline };
  }

  // ── Deployment ──────────────────────────────────────────
  describe("Deployment", function () {
    it("should set the grace period", async function () {
      const { board } = await loadFixture(deployFixture);
      expect(await board.gracePeriod()).to.equal(GRACE_PERIOD);
    });

    it("should start with 0 total tasks", async function () {
      const { board } = await loadFixture(deployFixture);
      expect(await board.totalTasks()).to.equal(0);
    });
  });

  // ── createTask ──────────────────────────────────────────
  describe("createTask", function () {
    it("should create a task and lock reward", async function () {
      const { board, creator } = await loadFixture(deployFixture);
      const latest = await time.latest();
      const deadline = latest + 48 * 3600;

      await expect(
        board.connect(creator).createTask(deadline, META_URI, { value: ONE_ETHER })
      ).to.changeEtherBalance(creator, -ONE_ETHER);

      expect(await board.totalTasks()).to.equal(1);

      const task = await board.getTask(0);
      expect(task.creator).to.equal(creator.address);
      expect(task.reward).to.equal(ONE_ETHER);
      expect(task.status).to.equal(0); // Created
      expect(task.metaURI).to.equal(META_URI);
      expect(task.worker).to.equal(ethers.ZeroAddress);
    });

    it("should emit TaskCreated event", async function () {
      const { board, creator } = await loadFixture(deployFixture);
      const latest = await time.latest();
      const deadline = latest + 48 * 3600;

      await expect(
        board.connect(creator).createTask(deadline, META_URI, { value: ONE_ETHER })
      )
        .to.emit(board, "TaskCreated")
        .withArgs(0, creator.address, ONE_ETHER, deadline, META_URI);
    });

    it("should increment totalTasks", async function () {
      const { board, creator } = await loadFixture(deployFixture);
      const latest = await time.latest();
      const deadline = latest + 48 * 3600;

      await board.connect(creator).createTask(deadline, META_URI, { value: ONE_ETHER });
      await board.connect(creator).createTask(deadline, META_URI, { value: ONE_ETHER });
      expect(await board.totalTasks()).to.equal(2);
    });

    it("should revert with zero reward", async function () {
      const { board, creator } = await loadFixture(deployFixture);
      const latest = await time.latest();
      const deadline = latest + 48 * 3600;

      await expect(
        board.connect(creator).createTask(deadline, META_URI, { value: 0 })
      ).to.be.revertedWith("Reward required");
    });

    it("should revert with past deadline", async function () {
      const { board, creator } = await loadFixture(deployFixture);
      const latest = await time.latest();

      await expect(
        board.connect(creator).createTask(latest - 100, META_URI, { value: ONE_ETHER })
      ).to.be.revertedWith("Deadline in past");
    });

    it("should revert with empty metaURI", async function () {
      const { board, creator } = await loadFixture(deployFixture);
      const latest = await time.latest();
      const deadline = latest + 48 * 3600;

      await expect(
        board.connect(creator).createTask(deadline, "", { value: ONE_ETHER })
      ).to.be.revertedWith("Invalid metaURI");
    });
  });

  // ── claimTask ───────────────────────────────────────────
  describe("claimTask", function () {
    it("should allow claiming a Created task", async function () {
      const { board, worker } = await loadFixture(taskCreatedFixture);

      await board.connect(worker).claimTask(0);
      const task = await board.getTask(0);
      expect(task.status).to.equal(1); // Claimed
      expect(task.worker).to.equal(worker.address);
    });

    it("should emit TaskClaimed event", async function () {
      const { board, worker } = await loadFixture(taskCreatedFixture);

      await expect(board.connect(worker).claimTask(0))
        .to.emit(board, "TaskClaimed")
        .withArgs(0, worker.address);
    });

    it("should revert if already claimed", async function () {
      const { board, other } = await loadFixture(taskClaimedFixture);

      await expect(board.connect(other).claimTask(0)).to.be.revertedWith(
        "Not claimable"
      );
    });

    it("should revert if deadline passed", async function () {
      const { board, worker, deadline } = await loadFixture(taskCreatedFixture);
      await time.increaseTo(deadline + 1);

      await expect(board.connect(worker).claimTask(0)).to.be.revertedWith(
        "Deadline passed"
      );
    });

    it("should revert if creator tries to claim own task", async function () {
      const { board, creator } = await loadFixture(taskCreatedFixture);

      await expect(board.connect(creator).claimTask(0)).to.be.revertedWith(
        "Creator cannot claim"
      );
    });
  });

  // ── submitWork ──────────────────────────────────────────
  describe("submitWork", function () {
    it("should allow worker to submit", async function () {
      const { board, worker } = await loadFixture(taskClaimedFixture);

      await board.connect(worker).submitWork(0, DELIVERABLE_URI, DELIVERABLE_HASH);
      const task = await board.getTask(0);
      expect(task.status).to.equal(2); // Submitted
      expect(task.deliverableURI).to.equal(DELIVERABLE_URI);
      expect(task.deliverableHash).to.equal(DELIVERABLE_HASH);
    });

    it("should emit TaskSubmitted event", async function () {
      const { board, worker } = await loadFixture(taskClaimedFixture);

      await expect(
        board.connect(worker).submitWork(0, DELIVERABLE_URI, DELIVERABLE_HASH)
      )
        .to.emit(board, "TaskSubmitted")
        .withArgs(0, worker.address, DELIVERABLE_URI, DELIVERABLE_HASH);
    });

    it("should revert if not Claimed", async function () {
      const { board, worker } = await loadFixture(taskCreatedFixture);

      await expect(
        board.connect(worker).submitWork(0, DELIVERABLE_URI, DELIVERABLE_HASH)
      ).to.be.revertedWith("Not submittable");
    });

    it("should revert if not the worker", async function () {
      const { board, other } = await loadFixture(taskClaimedFixture);

      await expect(
        board.connect(other).submitWork(0, DELIVERABLE_URI, DELIVERABLE_HASH)
      ).to.be.revertedWith("Only worker");
    });

    it("should revert if deadline passed", async function () {
      const { board, worker, deadline } = await loadFixture(taskClaimedFixture);
      await time.increaseTo(deadline + 1);

      await expect(
        board.connect(worker).submitWork(0, DELIVERABLE_URI, DELIVERABLE_HASH)
      ).to.be.revertedWith("Deadline passed");
    });

    it("should revert with empty deliverable URI", async function () {
      const { board, worker } = await loadFixture(taskClaimedFixture);

      await expect(
        board.connect(worker).submitWork(0, "", DELIVERABLE_HASH)
      ).to.be.revertedWith("Invalid URI");
    });
  });

  // ── acceptWork ──────────────────────────────────────────
  describe("acceptWork", function () {
    it("should accept work and pay the worker", async function () {
      const { board, creator, worker } = await loadFixture(taskSubmittedFixture);

      await expect(
        board.connect(creator).acceptWork(0)
      ).to.changeEtherBalance(worker, ONE_ETHER);

      const task = await board.getTask(0);
      expect(task.status).to.equal(3); // Accepted
    });

    it("should emit TaskAccepted and RewardPaid events", async function () {
      const { board, creator, worker } = await loadFixture(taskSubmittedFixture);

      const tx = board.connect(creator).acceptWork(0);
      await expect(tx).to.emit(board, "TaskAccepted").withArgs(0);
      await expect(tx)
        .to.emit(board, "RewardPaid")
        .withArgs(0, worker.address, ONE_ETHER);
    });

    it("should revert if not Submitted", async function () {
      const { board, creator } = await loadFixture(taskClaimedFixture);

      await expect(board.connect(creator).acceptWork(0)).to.be.revertedWith(
        "Not acceptable"
      );
    });

    it("should revert if not the creator", async function () {
      const { board, worker } = await loadFixture(taskSubmittedFixture);

      await expect(board.connect(worker).acceptWork(0)).to.be.revertedWith(
        "Only creator"
      );
    });

    it("should revert if already accepted (double-pay)", async function () {
      const { board, creator } = await loadFixture(taskSubmittedFixture);
      await board.connect(creator).acceptWork(0);

      await expect(board.connect(creator).acceptWork(0)).to.be.revertedWith(
        "Not acceptable"
      );
    });
  });

  // ── rejectWork ──────────────────────────────────────────
  describe("rejectWork", function () {
    it("should set status back to Claimed and clear deliverables", async function () {
      const { board, creator } = await loadFixture(taskSubmittedFixture);

      await board.connect(creator).rejectWork(0);
      const task = await board.getTask(0);
      expect(task.status).to.equal(1); // Claimed
      expect(task.deliverableURI).to.equal("");
      expect(task.deliverableHash).to.equal(ethers.ZeroHash);
      expect(task.submitAt).to.equal(0);
    });

    it("should emit WorkRejected event", async function () {
      const { board, creator } = await loadFixture(taskSubmittedFixture);

      await expect(board.connect(creator).rejectWork(0))
        .to.emit(board, "WorkRejected")
        .withArgs(0);
    });

    it("should allow worker to resubmit after rejection", async function () {
      const { board, creator, worker } = await loadFixture(taskSubmittedFixture);

      await board.connect(creator).rejectWork(0);
      await board
        .connect(worker)
        .submitWork(0, "https://example.com/v2", DELIVERABLE_HASH);

      const task = await board.getTask(0);
      expect(task.status).to.equal(2); // Submitted
      expect(task.deliverableURI).to.equal("https://example.com/v2");
    });

    it("should revert if not Submitted", async function () {
      const { board, creator } = await loadFixture(taskClaimedFixture);

      await expect(board.connect(creator).rejectWork(0)).to.be.revertedWith(
        "Not rejectable"
      );
    });

    it("should revert if not the creator", async function () {
      const { board, worker } = await loadFixture(taskSubmittedFixture);

      await expect(board.connect(worker).rejectWork(0)).to.be.revertedWith(
        "Only creator"
      );
    });
  });

  // ── cancelTask ──────────────────────────────────────────
  describe("cancelTask", function () {
    it("should cancel and refund the creator", async function () {
      const { board, creator } = await loadFixture(taskCreatedFixture);

      await expect(
        board.connect(creator).cancelTask(0)
      ).to.changeEtherBalance(creator, ONE_ETHER);

      const task = await board.getTask(0);
      expect(task.status).to.equal(4); // Cancelled
    });

    it("should emit TaskCancelled event", async function () {
      const { board, creator } = await loadFixture(taskCreatedFixture);

      await expect(board.connect(creator).cancelTask(0))
        .to.emit(board, "TaskCancelled")
        .withArgs(0);
    });

    it("should revert if task is Claimed", async function () {
      const { board, creator } = await loadFixture(taskClaimedFixture);

      await expect(board.connect(creator).cancelTask(0)).to.be.revertedWith(
        "Only Created"
      );
    });

    it("should revert if not the creator", async function () {
      const { board, other } = await loadFixture(taskCreatedFixture);

      await expect(board.connect(other).cancelTask(0)).to.be.revertedWith(
        "Only creator"
      );
    });
  });

  // ── expireTask ──────────────────────────────────────────
  describe("expireTask", function () {
    it("should expire a Created task after grace period", async function () {
      const { board, creator, deadline } = await loadFixture(taskCreatedFixture);
      await time.increaseTo(deadline + GRACE_PERIOD + 1);

      await expect(board.expireTask(0)).to.changeEtherBalance(
        creator,
        ONE_ETHER
      );

      const task = await board.getTask(0);
      expect(task.status).to.equal(5); // Expired
    });

    it("should expire a Claimed task after grace period", async function () {
      const { board, creator, deadline } = await loadFixture(taskClaimedFixture);
      await time.increaseTo(deadline + GRACE_PERIOD + 1);

      await expect(board.expireTask(0)).to.changeEtherBalance(
        creator,
        ONE_ETHER
      );
    });

    it("should expire a Submitted task after grace period", async function () {
      const { board, creator, deadline } = await loadFixture(taskSubmittedFixture);
      await time.increaseTo(deadline + GRACE_PERIOD + 1);

      await expect(board.expireTask(0)).to.changeEtherBalance(
        creator,
        ONE_ETHER
      );
    });

    it("should emit TaskExpired event", async function () {
      const { board, deadline } = await loadFixture(taskCreatedFixture);
      await time.increaseTo(deadline + GRACE_PERIOD + 1);

      await expect(board.expireTask(0))
        .to.emit(board, "TaskExpired")
        .withArgs(0);
    });

    it("should revert if grace period not passed", async function () {
      const { board, deadline } = await loadFixture(taskCreatedFixture);
      await time.increaseTo(deadline + 1);

      await expect(board.expireTask(0)).to.be.revertedWith(
        "Grace period active"
      );
    });

    it("should revert for terminal status (Accepted)", async function () {
      const { board, creator } = await loadFixture(taskSubmittedFixture);
      await board.connect(creator).acceptWork(0);

      await expect(board.expireTask(0)).to.be.revertedWith("Cannot expire");
    });

    it("should revert for terminal status (Cancelled)", async function () {
      const { board, creator } = await loadFixture(taskCreatedFixture);
      await board.connect(creator).cancelTask(0);

      await expect(board.expireTask(0)).to.be.revertedWith("Cannot expire");
    });
  });

  // ── getTask ─────────────────────────────────────────────
  describe("getTask", function () {
    it("should return task data", async function () {
      const { board, creator } = await loadFixture(taskCreatedFixture);
      const task = await board.getTask(0);
      expect(task.creator).to.equal(creator.address);
      expect(task.reward).to.equal(ONE_ETHER);
    });

    it("should return zero-initialized for non-existent task", async function () {
      const { board } = await loadFixture(deployFixture);
      const task = await board.getTask(999);
      expect(task.creator).to.equal(ethers.ZeroAddress);
      expect(task.reward).to.equal(0);
    });
  });
});
