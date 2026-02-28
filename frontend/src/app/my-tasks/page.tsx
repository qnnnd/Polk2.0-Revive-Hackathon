"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { formatEther } from "viem";
import {
  BOUNTY_BOARD_ADDRESS,
  BOUNTY_BOARD_ABI,
  parseMetaURI,
} from "@/config/contract";
import StatusBadge from "@/components/StatusBadge";

export default function MyTasksPage() {
  const { address, isConnected } = useAccount();

  const { data: totalRaw } = useReadContract({
    address: BOUNTY_BOARD_ADDRESS,
    abi: BOUNTY_BOARD_ABI,
    functionName: "totalTasks",
    query: { refetchInterval: 5000 },
  });

  const total = Number(totalRaw ?? 0);

  const { data: rawTasks } = useReadContracts({
    contracts: Array.from({ length: total }, (_, i) => ({
      address: BOUNTY_BOARD_ADDRESS,
      abi: BOUNTY_BOARD_ABI,
      functionName: "getTask",
      args: [BigInt(i)],
    })) as any[],
    query: { enabled: total > 0, refetchInterval: 5000 },
  });

  const { created, claimed } = useMemo(() => {
    if (!rawTasks || !address)
      return { created: [] as any[], claimed: [] as any[] };

    const all = rawTasks
      .map((r, i) => {
        if (r.status !== "success" || !r.result) return null;
        const t = r.result as any;
        return {
          id: i,
          creator: t.creator,
          worker: t.worker,
          reward: t.reward,
          status: Number(t.status),
          meta: parseMetaURI(t.metaURI),
        };
      })
      .filter(Boolean) as any[];

    const addr = address.toLowerCase();
    return {
      created: all.filter((t) => t.creator.toLowerCase() === addr),
      claimed: all.filter((t) => t.worker.toLowerCase() === addr),
    };
  }, [rawTasks, address]);

  if (!isConnected) {
    return (
      <div className="rounded-2xl border border-line bg-card/70 p-8 text-center backdrop-blur">
        <p className="text-muted">请先连接钱包查看你的任务</p>
      </div>
    );
  }

  const TaskList = ({ items, empty }: { items: any[]; empty: string }) =>
    items.length === 0 ? (
      <p className="text-xs text-muted">{empty}</p>
    ) : (
      <div className="space-y-2">
        {items.map((t) => (
          <Link
            key={t.id}
            href={`/task/${t.id}`}
            className="flex items-center justify-between rounded-xl border border-line bg-black/10 p-3 transition hover:border-accent/30"
          >
            <div>
              <span className="font-mono text-xs text-muted">#{t.id}</span>{" "}
              <span className="text-sm">{t.meta.title}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs">
                {formatEther(t.reward)} ETH
              </span>
              <StatusBadge status={t.status} />
            </div>
          </Link>
        ))}
      </div>
    );

  return (
    <div className="rounded-2xl border border-line bg-card/70 p-5 backdrop-blur">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-sm font-semibold">我的任务</h2>
          <p className="text-xs text-muted">按链上地址过滤你的任务</p>
        </div>
        <Link
          href="/"
          className="rounded-xl border border-line bg-card/60 px-3 py-2 text-sm text-white"
        >
          返回列表
        </Link>
      </div>

      <div className="my-4 h-px bg-line" />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-line bg-black/10 p-4">
          <h3 className="mb-3 text-sm font-semibold">我发布的</h3>
          <TaskList items={created} empty="暂无发布的任务" />
        </div>
        <div className="rounded-2xl border border-line bg-black/10 p-4">
          <h3 className="mb-3 text-sm font-semibold">我认领的</h3>
          <TaskList items={claimed} empty="暂无认领的任务" />
        </div>
      </div>
    </div>
  );
}
