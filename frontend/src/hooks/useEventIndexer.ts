"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { usePublicClient } from "wagmi";
import { parseAbiItem } from "viem";
import { BOUNTY_BOARD_ADDRESS, parseMetaURI } from "@/config/contract";

export interface IndexedTask {
  id: number;
  creator: string;
  worker: string;
  reward: bigint;
  deadline: number;
  status: number;
  metaURI: string;
  deliverableURI: string;
  deliverableHash: string;
  createdAt: number;
  submitAt: number;
  meta: { title: string; description: string; tags: string[] };
}

const CACHE_KEY = "bountyboard_event_cache";
const BLOCK_KEY = "bountyboard_last_block";

function loadCache(): Map<number, IndexedTask> {
  if (typeof window === "undefined") return new Map();
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return new Map();
    const arr: [number, any][] = JSON.parse(raw);
    return new Map(arr.map(([k, v]) => [k, { ...v, reward: BigInt(v.reward) }]));
  } catch {
    return new Map();
  }
}

function saveCache(tasks: Map<number, IndexedTask>, lastBlock: number) {
  if (typeof window === "undefined") return;
  const arr = Array.from(tasks.entries()).map(([k, v]) => [k, { ...v, reward: v.reward.toString() }]);
  localStorage.setItem(CACHE_KEY, JSON.stringify(arr));
  localStorage.setItem(BLOCK_KEY, String(lastBlock));
}

function getLastBlock(): number {
  if (typeof window === "undefined") return 0;
  return Number(localStorage.getItem(BLOCK_KEY) || "0");
}

export function useEventIndexer() {
  const client = usePublicClient();
  const [tasks, setTasks] = useState<Map<number, IndexedTask>>(loadCache);
  const [loading, setLoading] = useState(true);
  const [lastSyncBlock, setLastSyncBlock] = useState(getLastBlock());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const syncEvents = useCallback(async () => {
    if (!client) return;

    try {
      const currentBlock = await client.getBlockNumber();
      const fromBlock = BigInt(lastSyncBlock > 0 ? lastSyncBlock + 1 : 0);

      if (fromBlock > currentBlock) {
        setLoading(false);
        return;
      }

      // Fetch TaskCreated events
      const createdLogs = await client.getLogs({
        address: BOUNTY_BOARD_ADDRESS,
        event: parseAbiItem("event TaskCreated(uint256 indexed taskId, address indexed creator, uint256 reward, uint64 deadline, string metaURI)"),
        fromBlock,
        toBlock: currentBlock,
      });

      const claimedLogs = await client.getLogs({
        address: BOUNTY_BOARD_ADDRESS,
        event: parseAbiItem("event TaskClaimed(uint256 indexed taskId, address indexed worker)"),
        fromBlock,
        toBlock: currentBlock,
      });

      const submittedLogs = await client.getLogs({
        address: BOUNTY_BOARD_ADDRESS,
        event: parseAbiItem("event TaskSubmitted(uint256 indexed taskId, address indexed worker, string deliverableURI, bytes32 deliverableHash)"),
        fromBlock,
        toBlock: currentBlock,
      });

      const acceptedLogs = await client.getLogs({
        address: BOUNTY_BOARD_ADDRESS,
        event: parseAbiItem("event TaskAccepted(uint256 indexed taskId)"),
        fromBlock,
        toBlock: currentBlock,
      });

      const cancelledLogs = await client.getLogs({
        address: BOUNTY_BOARD_ADDRESS,
        event: parseAbiItem("event TaskCancelled(uint256 indexed taskId)"),
        fromBlock,
        toBlock: currentBlock,
      });

      const expiredLogs = await client.getLogs({
        address: BOUNTY_BOARD_ADDRESS,
        event: parseAbiItem("event TaskExpired(uint256 indexed taskId)"),
        fromBlock,
        toBlock: currentBlock,
      });

      const rejectedLogs = await client.getLogs({
        address: BOUNTY_BOARD_ADDRESS,
        event: parseAbiItem("event WorkRejected(uint256 indexed taskId, uint8 rejectCount)"),
        fromBlock,
        toBlock: currentBlock,
      });

      setTasks((prev) => {
        const map = new Map(prev);

        for (const log of createdLogs) {
          const args = log.args as any;
          const id = Number(args.taskId);
          const meta = parseMetaURI(args.metaURI);
          map.set(id, {
            id,
            creator: args.creator,
            worker: "0x0000000000000000000000000000000000000000",
            reward: args.reward,
            deadline: Number(args.deadline),
            status: 0,
            metaURI: args.metaURI,
            deliverableURI: "",
            deliverableHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
            createdAt: 0,
            submitAt: 0,
            meta,
          });
        }

        for (const log of claimedLogs) {
          const args = log.args as any;
          const id = Number(args.taskId);
          const existing = map.get(id);
          if (existing) {
            existing.worker = args.worker;
            existing.status = 1;
          }
        }

        for (const log of submittedLogs) {
          const args = log.args as any;
          const id = Number(args.taskId);
          const existing = map.get(id);
          if (existing) {
            existing.status = 2;
            existing.deliverableURI = args.deliverableURI;
            existing.deliverableHash = args.deliverableHash;
          }
        }

        for (const log of acceptedLogs) {
          const args = log.args as any;
          const id = Number(args.taskId);
          const existing = map.get(id);
          if (existing) existing.status = 3;
        }

        for (const log of cancelledLogs) {
          const args = log.args as any;
          const id = Number(args.taskId);
          const existing = map.get(id);
          if (existing) existing.status = 4;
        }

        for (const log of expiredLogs) {
          const args = log.args as any;
          const id = Number(args.taskId);
          const existing = map.get(id);
          if (existing) existing.status = 5;
        }

        for (const log of rejectedLogs) {
          const args = log.args as any;
          const id = Number(args.taskId);
          const existing = map.get(id);
          if (existing) {
            existing.status = 1;
            existing.deliverableURI = "";
            existing.deliverableHash = "0x0000000000000000000000000000000000000000000000000000000000000000";
          }
        }

        saveCache(map, Number(currentBlock));
        return map;
      });

      setLastSyncBlock(Number(currentBlock));
      setLoading(false);
    } catch (err) {
      console.error("Event sync error:", err);
      setLoading(false);
    }
  }, [client, lastSyncBlock]);

  useEffect(() => {
    syncEvents();
    intervalRef.current = setInterval(syncEvents, 4000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [syncEvents]);

  const clearCache = useCallback(() => {
    if (typeof window === "undefined") return;
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(BLOCK_KEY);
    setTasks(new Map());
    setLastSyncBlock(0);
  }, []);

  const taskList = Array.from(tasks.values());

  return { tasks: taskList, loading, lastSyncBlock, clearCache, refresh: syncEvents };
}
