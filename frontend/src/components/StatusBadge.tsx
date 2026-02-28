import { STATUS_LABELS } from "@/config/contract";

const COLORS: Record<string, string> = {
  Created: "border-accent/25 bg-accent/7 text-accent",
  Claimed: "border-accent-purple/35 bg-accent-purple/8 text-accent-purple",
  Submitted: "border-amber-400/40 bg-amber-400/7 text-amber-300",
  Accepted: "border-emerald-400/35 bg-emerald-400/8 text-emerald-400",
  Cancelled: "border-red-400/40 bg-red-400/8 text-red-400",
  Expired: "border-red-400/40 bg-red-400/8 text-red-400",
};

export default function StatusBadge({ status }: { status: number }) {
  const label = STATUS_LABELS[status] ?? "Unknown";
  const color = COLORS[label] ?? "border-line text-muted";
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-xs ${color}`}>
      {label}
    </span>
  );
}
