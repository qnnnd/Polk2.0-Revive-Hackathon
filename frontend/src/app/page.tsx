"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { formatEther } from "viem";
import { STATUS_LABELS } from "@/config/contract";
import { useEventIndexer } from "@/hooks/useEventIndexer";
import StatusBadge from "@/components/StatusBadge";

export default function TasksPage() {
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("new");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const { tasks, loading, lastSyncBlock, clearCache } = useEventIndexer();

  const filtered = useMemo(() => {
    let list = [...tasks];
    if (keyword) {
      const q = keyword.toLowerCase();
      list = list.filter(
        (t) =>
          t.meta.title.toLowerCase().includes(q) ||
          t.meta.tags.some((tag: string) => tag.toLowerCase().includes(q))
      );
    }
    if (statusFilter !== "all") {
      list = list.filter((t) => STATUS_LABELS[t.status] === statusFilter);
    }
    if (sortBy === "reward") list.sort((a, b) => Number(b.reward - a.reward));
    else if (sortBy === "deadline") list.sort((a, b) => a.deadline - b.deadline);
    else list.sort((a, b) => b.id - a.id);
    return list;
  }, [tasks, keyword, statusFilter, sortBy]);

  const maxPage = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize);

  const kpi = useMemo(() => {
    const active = tasks.filter((t) => t.status <= 2).length;
    const paid = tasks.filter((t) => t.status === 3).length;
    return { total: tasks.length, active, paid };
  }, [tasks]);

  const shortAddr = (a: string) =>
    a === "0x0000000000000000000000000000000000000000"
      ? "—"
      : a.slice(0, 6) + "…" + a.slice(-4);

  const fmtDeadline = (ts: number) =>
    new Date(ts * 1000).toLocaleString("zh-CN", { hour12: false });

  return (
    <div className="space-y-4">
      {/* Card: Task List */}
      <div className="rounded-2xl border border-line bg-card/70 p-5 backdrop-blur">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">任务广场</h2>
            <p className="text-xs text-muted">
              {loading ? "正在从链上事件同步..." : `事件驱动索引 · 已同步至区块 #${lastSyncBlock}`}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={clearCache}
              className="rounded-xl border border-line bg-card/60 px-3 py-2 text-xs text-muted hover:text-white"
            >
              清除缓存
            </button>
            <Link
              href="/create"
              className="rounded-xl border border-accent/35 bg-accent/10 px-3 py-2 text-sm text-white transition hover:bg-accent/20"
            >
              发布新任务
            </Link>
          </div>
        </div>

        <div className="my-4 h-px bg-line" />

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="min-w-[220px] flex-1">
            <label className="mb-1 block text-xs text-muted">关键词</label>
            <input
              placeholder="搜索标题/标签"
              value={keyword}
              onChange={(e) => { setKeyword(e.target.value); setPage(1); }}
            />
          </div>
          <div className="w-[180px]">
            <label className="mb-1 block text-xs text-muted">状态</label>
            <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
              <option value="all">全部</option>
              {STATUS_LABELS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="w-[180px]">
            <label className="mb-1 block text-xs text-muted">排序</label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="new">最新</option>
              <option value="reward">奖励最高</option>
              <option value="deadline">截止最近</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-separate border-spacing-y-2">
            <thead>
              <tr className="text-left text-xs font-semibold text-muted">
                <th className="px-3">ID</th>
                <th className="px-3">标题</th>
                <th className="px-3">奖励</th>
                <th className="px-3">截止</th>
                <th className="px-3">状态</th>
                <th className="px-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-muted">
                    ⏳ 正在从链上事件同步任务...
                  </td>
                </tr>
              ) : pageItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-muted">
                    {tasks.length === 0 ? "暂无任务 — 去发布第一个任务吧！" : "无匹配任务"}
                  </td>
                </tr>
              ) : (
                pageItems.map((t) => (
                  <tr key={t.id}>
                    <td className="rounded-l-xl border-y border-l border-line bg-black/10 px-3 py-3 font-mono text-sm">#{t.id}</td>
                    <td className="border-y border-line bg-black/10 px-3 py-3">
                      <Link href={`/task/${t.id}`} className="text-accent hover:underline">{t.meta.title}</Link>
                      <div className="mt-0.5 flex gap-1">
                        {t.meta.tags.slice(0, 3).map((tag: string) => (
                          <span key={tag} className="rounded-full border border-line px-2 py-0.5 text-[10px] text-muted">{tag}</span>
                        ))}
                      </div>
                      <div className="mt-0.5 text-[11px] text-muted">
                        发布者: <span className="font-mono">{shortAddr(t.creator)}</span>
                      </div>
                    </td>
                    <td className="border-y border-line bg-black/10 px-3 py-3 font-mono text-sm">{formatEther(t.reward)} ETH</td>
                    <td className="border-y border-line bg-black/10 px-3 py-3 text-xs text-muted">{fmtDeadline(t.deadline)}</td>
                    <td className="border-y border-line bg-black/10 px-3 py-3"><StatusBadge status={t.status} /></td>
                    <td className="rounded-r-xl border-y border-r border-line bg-black/10 px-3 py-3">
                      <Link href={`/task/${t.id}`}
                        className="rounded-lg border border-accent/35 bg-accent/10 px-2 py-1 text-xs text-white transition hover:bg-accent/20">
                        查看
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="mt-2 flex items-center justify-between text-xs text-muted">
          <span>共 {filtered.length} 个任务</span>
          <div className="flex items-center gap-2">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
              className="rounded-lg border border-line bg-card/60 px-2 py-1 disabled:opacity-40">上一页</button>
            <span className="rounded-lg border border-line bg-black/15 px-2 py-1">{page} / {maxPage}</span>
            <button disabled={page >= maxPage} onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-line bg-card/60 px-2 py-1 disabled:opacity-40">下一页</button>
          </div>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "总任务", value: kpi.total },
          { label: "进行中", value: kpi.active },
          { label: "已发奖", value: kpi.paid },
        ].map((k) => (
          <div key={k.label} className="rounded-2xl border border-line bg-black/12 p-4">
            <div className="text-xs text-muted">{k.label}</div>
            <div className="mt-1 text-2xl font-semibold">{k.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
