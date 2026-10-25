import { Link } from "react-router-dom";
import { cx } from "../lib/util";

export function Logo({ className, light = false, mono = false }: { className?: string; light?: boolean; mono?: boolean }) {
  const bar = mono ? "bg-ink" : "bg-orange";
  return (
    <Link to="/" className={cx("group inline-flex items-center gap-2", className)} aria-label="Arise home">
      <span className="flex h-7 items-end gap-[3px]" aria-hidden>
        <span className={cx("h-[11px] w-[6px] rounded-[2px] transition-all duration-300 group-hover:h-[16px]", bar)} />
        <span className={cx("h-[18px] w-[6px] rounded-[2px] transition-all duration-300 group-hover:h-[22px]", bar)} />
        <span className={cx("h-[26px] w-[6px] rounded-[2px]", bar)} />
      </span>
      <span className={cx("font-display text-[28px] font-extrabold leading-none tracking-[-0.05em]", light ? "text-white" : "text-ink")}>
        arise
      </span>
    </Link>
  );
}

export function BuiltWith({ className, light = false }: { className?: string; light?: boolean }) {
  const tone = light ? "text-white/60" : "text-muted";
  const strong = light ? "text-white" : "text-ink";
  return (
    <p className={cx("text-xs", tone, className)}>
      Built with <span className={cx("font-semibold", strong)}>Claude Code</span> · Concepts & visuals by{" "}
      <span className={cx("font-semibold", strong)}>Higgsfield</span> · Runs on{" "}
      <span className={cx("font-semibold", strong)}>Emergent</span>
    </p>
  );
}

export function InstagramGlyph({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={className} aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
    </svg>
  );
}
