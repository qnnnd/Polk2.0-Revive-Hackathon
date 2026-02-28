"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther } from "viem";
import { BOUNTY_BOARD_ADDRESS, BOUNTY_BOARD_ABI } from "@/config/contract";
import { TARGET_CHAIN_ID } from "@/config/chains";
import { useToast } from "@/components/Toast";
import { useEnsureChain } from "@/hooks/useEnsureChain";
import Link from "next/link";

export default function CreateTaskPage() {
  const router = useRouter();
  const { isConnected } = useAccount();
  const { show } = useToast();
  const { ensureChain } = useEnsureChain();

  const [title, setTitle] = useState("");
  const [tags, setTags] = useState("");
  const [description, setDescription] = useState("");
  const [reward, setReward] = useState("");
  const [deadlineHours, setDeadlineHours] = useState("");

  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const fillExample = () => {
    setTitle("撰写产品介绍文档（含验收标准）");
    setTags("docs,writing");
    setDescription(
      "交付物：一份 Markdown 文档，包含功能说明、API 列表、边界与风险。验收：结构清晰、可直接交给开发使用。"
    );
    setReward("0.5");
    setDeadlineHours("24");
  };

  const handleCreate = async () => {
    if (!isConnected) {
      show("请先连接钱包");
      return;
    }
    if (!title || !reward || !deadlineHours) {
      show("请填写标题、奖励、截止时间");
      return;
    }

    try {
      await ensureChain();
    } catch (e) {
      show("请切换至目标网络");
      return;
    }

    const meta = JSON.stringify({
      title,
      description,
      tags: tags
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    });

    const deadlineSec = BigInt(
      Math.floor(Date.now() / 1000) + Number(deadlineHours) * 3600
    );

    writeContract(
      {
        address: BOUNTY_BOARD_ADDRESS,
        abi: BOUNTY_BOARD_ABI,
        functionName: "createTask",
        args: [deadlineSec, meta],
        value: parseEther(reward),
        chainId: TARGET_CHAIN_ID,
      },
      {
        onSuccess: () => show("交易已提交，等待确认..."),
        onError: (err) => show("交易失败: " + err.message.slice(0, 80)),
      }
    );
  };

  if (isSuccess) {
    show("任务创建成功！");
    router.push("/");
  }

  return (
    <div className="rounded-2xl border border-line bg-card/70 p-5 backdrop-blur">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-sm font-semibold">发布任务</h2>
          <p className="text-xs text-muted">
            创建任务并锁仓原生币奖励，元数据以 JSON 格式上链。
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

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-xs text-muted">标题</label>
          <input
            placeholder="例如：制作产品落地页"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">
            标签（逗号分隔）
          </label>
          <input
            placeholder="frontend, react"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
          />
        </div>
      </div>

      <div className="mt-3">
        <label className="mb-1 block text-xs text-muted">描述</label>
        <textarea
          placeholder="清晰描述交付物、验收标准、资源链接..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-xs text-muted">
            奖励（ETH / Native）
          </label>
          <input
            type="number"
            min="0"
            step="0.001"
            placeholder="例如：1.0"
            value={reward}
            onChange={(e) => setReward(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">
            截止时间（小时后）
          </label>
          <input
            type="number"
            min="1"
            step="1"
            placeholder="例如：48"
            value={deadlineHours}
            onChange={(e) => setDeadlineHours(e.target.value)}
          />
        </div>
      </div>

      <div className="mt-5 flex justify-end gap-3">
        <button
          onClick={fillExample}
          className="rounded-xl border border-line bg-card/60 px-4 py-2 text-sm text-white"
        >
          填充示例
        </button>
        <button
          onClick={handleCreate}
          disabled={isPending || isConfirming}
          className="rounded-xl border border-accent/35 bg-accent/10 px-4 py-2 text-sm text-white transition hover:bg-accent/20 disabled:opacity-50"
        >
          {isPending
            ? "签名中..."
            : isConfirming
              ? "确认中..."
              : "创建任务（上链）"}
        </button>
      </div>
    </div>
  );
}
