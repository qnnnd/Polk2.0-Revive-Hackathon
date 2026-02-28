"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import {
  useReadContract,
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { formatEther } from "viem";
import {
  BOUNTY_BOARD_ADDRESS,
  BOUNTY_BOARD_ABI,
  STATUS_LABELS,
  parseMetaURI,
} from "@/config/contract";
import { TARGET_CHAIN_ID } from "@/config/chains";
import StatusBadge from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { useEnsureChain } from "@/hooks/useEnsureChain";
import { useState } from "react";

function shortAddr(a: string) {
  if (!a || a === "0x0000000000000000000000000000000000000000") return "—";
  return a.slice(0, 6) + "…" + a.slice(-4);
}

export default function TaskDetailPage() {
  const params = useParams();
  const taskId = Number(params.id);
  const { address, isConnected } = useAccount();
  const { show } = useToast();
  const { ensureChain } = useEnsureChain();

  const [deliverableURI, setDeliverableURI] = useState("");

  const { data: taskRaw, refetch } = useReadContract({
    address: BOUNTY_BOARD_ADDRESS,
    abi: BOUNTY_BOARD_ABI,
    functionName: "getTask",
    args: [BigInt(taskId)],
    query: { refetchInterval: 5000 },
  });

  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({
    hash: txHash,
    query: {
      enabled: !!txHash,
    },
  });

  const task = taskRaw as any;
  if (!task || task.creator === "0x0000000000000000000000000000000000000000") {
    return (
      <div className="rounded-2xl border border-line bg-card/70 p-5 text-center text-muted backdrop-blur">
        <p>任务 #{taskId} 不存在</p>
        <Link href="/" className="mt-3 inline-block text-accent">
          返回列表
        </Link>
      </div>
    );
  }

  const meta = parseMetaURI(task.metaURI);
  const status = Number(task.status);
  const isCreator = address?.toLowerCase() === task.creator.toLowerCase();
  const isWorker = address?.toLowerCase() === task.worker.toLowerCase();
  const deadline = new Date(Number(task.deadline) * 1000).toLocaleString(
    "zh-CN",
    { hour12: false }
  );

  const exec = async (fn: string, args: any[], value?: bigint) => {
    if (!isConnected) {
      show("请先连接钱包");
      return;
    }
    try {
      await ensureChain();
    } catch {
      show("请切换至目标网络");
      return;
    }
    writeContract(
      {
        address: BOUNTY_BOARD_ADDRESS,
        abi: BOUNTY_BOARD_ABI,
        functionName: fn,
        args,
        chainId: TARGET_CHAIN_ID,
        ...(value ? { value } : {}),
      } as any,
      {
        onSuccess: () => {
          show("交易已提交...");
          setTimeout(() => refetch(), 2000);
        },
        onError: (err: any) => show("失败: " + err.message.slice(0, 80)),
      }
    );
  };

  return (
    <div className="rounded-2xl border border-line bg-card/70 p-5 backdrop-blur">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">任务详情</h2>
          <p className="text-xs text-muted">
            根据角色与状态显示操作按钮。
          </p>
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
        {/* Left: Info */}
        <div className="rounded-2xl border border-line bg-black/10 p-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs text-muted">Task ID</div>
              <div className="font-mono text-xl">#{taskId}</div>
            </div>
            <StatusBadge status={status} />
          </div>
          <div className="mt-3 text-base font-semibold">{meta.title}</div>
          {meta.description && (
            <p className="mt-2 text-xs text-muted leading-relaxed">
              {meta.description}
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-1">
            {meta.tags.map((t) => (
              <span
                key={t}
                className="rounded-full border border-line px-2 py-0.5 text-[10px] text-muted"
              >
                {t}
              </span>
            ))}
          </div>

          <div className="my-3 h-px bg-line" />

          <div className="space-y-1 text-xs">
            <div>
              <span className="text-muted">奖励：</span>
              <span className="font-mono">
                {formatEther(task.reward)} ETH
              </span>
            </div>
            <div>
              <span className="text-muted">截止：</span>
              {deadline}
            </div>
            <div>
              <span className="text-muted">发布者：</span>
              <span className="font-mono">{task.creator}</span>
            </div>
            <div>
              <span className="text-muted">认领者：</span>
              <span className="font-mono">{shortAddr(task.worker)}</span>
            </div>
          </div>

          <div className="my-3 h-px bg-line" />

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            {status === 0 && !isCreator && (
              <button
                onClick={() => exec("claimTask", [BigInt(taskId)])}
                disabled={isPending || isConfirming}
                className="rounded-xl border border-accent/35 bg-accent/10 px-3 py-2 text-sm text-white disabled:opacity-50"
              >
                {isPending ? "签名中..." : "认领任务"}
              </button>
            )}
            {status === 0 && isCreator && (
              <button
                onClick={() => exec("cancelTask", [BigInt(taskId)])}
                disabled={isPending || isConfirming}
                className="rounded-xl border border-red-400/45 bg-red-400/8 px-3 py-2 text-sm text-white disabled:opacity-50"
              >
                取消任务
              </button>
            )}
            {status === 1 && isWorker && (
              <div className="w-full space-y-2">
                <input
                  placeholder="交付物链接 (URL)"
                  value={deliverableURI}
                  onChange={(e) => setDeliverableURI(e.target.value)}
                />
                <button
                  onClick={() => {
                    if (!deliverableURI) {
                      show("请输入交付物链接");
                      return;
                    }
                    const hash =
                      "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`;
                    exec("submitWork", [
                      BigInt(taskId),
                      deliverableURI,
                      hash,
                    ]);
                  }}
                  disabled={isPending || isConfirming}
                  className="rounded-xl border border-accent/35 bg-accent/10 px-3 py-2 text-sm text-white disabled:opacity-50"
                >
                  提交交付物
                </button>
              </div>
            )}
            {status === 2 && isCreator && (
              <>
                <button
                  onClick={() => exec("acceptWork", [BigInt(taskId)])}
                  disabled={isPending || isConfirming}
                  className="rounded-xl border border-emerald-400/45 bg-emerald-400/10 px-3 py-2 text-sm text-white disabled:opacity-50"
                >
                  验收并发奖
                </button>
                <button
                  onClick={() => exec("rejectWork", [BigInt(taskId)])}
                  disabled={isPending || isConfirming}
                  className="rounded-xl border border-line bg-card/60 px-3 py-2 text-sm text-white disabled:opacity-50"
                >
                  拒绝（重新提交）
                </button>
              </>
            )}
            {status >= 3 && (
              <span className="text-xs text-muted">
                任务已结束 ({STATUS_LABELS[status]})
              </span>
            )}
          </div>
        </div>

        {/* Right: Metadata / Deliverable */}
        <div className="rounded-2xl border border-line bg-black/10 p-4">
          <h3 className="text-sm font-semibold">元数据 / 交付物</h3>
          <div className="mt-3 space-y-2 text-xs">
            <div>
              <span className="text-muted">MetaURI：</span>
              <span className="font-mono break-all text-[11px]">
                {task.metaURI.length > 200
                  ? task.metaURI.slice(0, 200) + "..."
                  : task.metaURI}
              </span>
            </div>
            <div className="h-px bg-line" />
            <div>
              <span className="text-muted">DeliverableURI：</span>
              {task.deliverableURI ? (
                <a
                  href={task.deliverableURI}
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent hover:underline"
                >
                  {task.deliverableURI}
                </a>
              ) : (
                <span>—</span>
              )}
            </div>
            <div>
              <span className="text-muted">DeliverableHash：</span>
              <span className="font-mono break-all text-[11px]">
                {task.deliverableHash ===
                "0x0000000000000000000000000000000000000000000000000000000000000000"
                  ? "—"
                  : task.deliverableHash}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
