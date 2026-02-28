"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { getChainLabel, TARGET_CHAIN_ID } from "@/config/chains";

const NAV = [
  { href: "/", label: "任务广场" },
  { href: "/create", label: "发布任务" },
  { href: "/my-tasks", label: "我的任务" },
];

function shortAddr(a: string) {
  return a.slice(0, 6) + "…" + a.slice(-4);
}

export default function Header() {
  const pathname = usePathname();
  const { address, isConnected } = useAccount();
  const { switchChain } = useSwitchChain();
  const { connect, connectors } = useConnect({
    mutation: {
      onSuccess: () => {
        // Switch to target chain immediately after connect
        switchChain({ chainId: TARGET_CHAIN_ID });
      },
    },
  });
  const { disconnect } = useDisconnect();

  const handleConnect = () => {
    if (isConnected) {
      disconnect();
    } else {
      const connector = connectors[0];
      if (connector) connect({ connector });
    }
  };

  return (
    <header className="sticky top-4 z-20 mx-auto flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-card/80 px-5 py-4 backdrop-blur-lg">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-accent to-accent-purple shadow-lg shadow-accent/20" />
        <div>
          <h1 className="text-sm font-semibold tracking-wide text-white">
            Revive Bounty Board
          </h1>
          <p className="text-xs text-muted">任务发布 · 认领 · 验收 · 发奖</p>
        </div>
      </div>

      <nav className="flex gap-2 flex-wrap">
        {NAV.map((n) => {
          const active =
            n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`rounded-xl border px-3 py-2 text-sm transition ${
                active
                  ? "border-accent/35 bg-accent/10 text-white"
                  : "border-transparent text-muted hover:text-white"
              }`}
            >
              {n.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center gap-3">
        <span className="rounded-xl border border-line bg-black/15 px-3 py-2 text-xs text-muted">
          Network: <span className="font-mono">{getChainLabel(TARGET_CHAIN_ID)}</span>
        </span>
        <button
          onClick={handleConnect}
          className="rounded-xl border border-accent/35 bg-accent/10 px-3 py-2 text-sm text-white transition hover:border-accent/55 hover:bg-accent/20"
        >
          {isConnected && address ? shortAddr(address) : "连接钱包"}
        </button>
      </div>
    </header>
  );
}
