export const BOUNTY_BOARD_ADDRESS = (process.env
  .NEXT_PUBLIC_CONTRACT_ADDRESS || "0x0") as `0x${string}`;

export const BOUNTY_BOARD_ABI = [
  {
    type: "constructor",
    inputs: [{ name: "_gracePeriod", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "totalTasks",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "gracePeriod",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "MAX_URI_LENGTH",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getTask",
    inputs: [{ name: "taskId", type: "uint256" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "creator", type: "address" },
          { name: "worker", type: "address" },
          { name: "reward", type: "uint256" },
          { name: "createdAt", type: "uint64" },
          { name: "deadline", type: "uint64" },
          { name: "submitAt", type: "uint64" },
          { name: "status", type: "uint8" },
          { name: "metaURI", type: "string" },
          { name: "deliverableHash", type: "bytes32" },
          { name: "deliverableURI", type: "string" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "createTask",
    inputs: [
      { name: "deadline", type: "uint64" },
      { name: "metaURI", type: "string" },
    ],
    outputs: [{ name: "taskId", type: "uint256" }],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "claimTask",
    inputs: [{ name: "taskId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "submitWork",
    inputs: [
      { name: "taskId", type: "uint256" },
      { name: "deliverableURI", type: "string" },
      { name: "deliverableHash", type: "bytes32" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "acceptWork",
    inputs: [{ name: "taskId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "rejectWork",
    inputs: [{ name: "taskId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "cancelTask",
    inputs: [{ name: "taskId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "expireTask",
    inputs: [{ name: "taskId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "event",
    name: "TaskCreated",
    inputs: [
      { name: "taskId", type: "uint256", indexed: true },
      { name: "creator", type: "address", indexed: true },
      { name: "reward", type: "uint256", indexed: false },
      { name: "deadline", type: "uint64", indexed: false },
      { name: "metaURI", type: "string", indexed: false },
    ],
  },
  {
    type: "event",
    name: "TaskClaimed",
    inputs: [
      { name: "taskId", type: "uint256", indexed: true },
      { name: "worker", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "TaskSubmitted",
    inputs: [
      { name: "taskId", type: "uint256", indexed: true },
      { name: "worker", type: "address", indexed: true },
      { name: "deliverableURI", type: "string", indexed: false },
      { name: "deliverableHash", type: "bytes32", indexed: false },
    ],
  },
  {
    type: "event",
    name: "TaskAccepted",
    inputs: [{ name: "taskId", type: "uint256", indexed: true }],
  },
  {
    type: "event",
    name: "RewardPaid",
    inputs: [
      { name: "taskId", type: "uint256", indexed: true },
      { name: "worker", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "TaskCancelled",
    inputs: [{ name: "taskId", type: "uint256", indexed: true }],
  },
  {
    type: "event",
    name: "TaskExpired",
    inputs: [{ name: "taskId", type: "uint256", indexed: true }],
  },
  {
    type: "event",
    name: "WorkRejected",
    inputs: [
      { name: "taskId", type: "uint256", indexed: true },
      { name: "rejectCount", type: "uint8", indexed: false },
    ],
  },
  {
    type: "function",
    name: "rejectCount",
    inputs: [{ name: "taskId", type: "uint256" }],
    outputs: [{ type: "uint8" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "MAX_RESUBMIT",
    inputs: [],
    outputs: [{ type: "uint8" }],
    stateMutability: "view",
  },
] as const;

export const STATUS_LABELS = [
  "Created",
  "Claimed",
  "Submitted",
  "Accepted",
  "Cancelled",
  "Expired",
] as const;

export type TaskStatus = (typeof STATUS_LABELS)[number];

export interface TaskMeta {
  title: string;
  description: string;
  tags: string[];
}

export interface TaskData {
  id: number;
  creator: string;
  worker: string;
  reward: bigint;
  createdAt: number;
  deadline: number;
  submitAt: number;
  status: number;
  metaURI: string;
  deliverableHash: string;
  deliverableURI: string;
  meta?: TaskMeta;
}

export function parseMetaURI(uri: string): TaskMeta {
  try {
    return JSON.parse(uri);
  } catch {
    return { title: uri || "Untitled", description: "", tags: [] };
  }
}
