import { Check } from "lucide-react";
import { Link } from "react-router-dom";
import { cx } from "../lib/util";

const STEPS = ["Your brand", "Ideas", "Create", "Share"] as const;

/** Persistent progress through the studio flow. `current` is 0-based; earlier steps link back when hrefs exist. */
export function Stepper({ current, hrefs = {} }: { current: number; hrefs?: Partial<Record<number, string>> }) {
  return (
    <ol className="flex items-center gap-1.5 overflow-x-auto text-[12.5px] no-scrollbar">
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        const inner = (
          <span className={cx("flex items-center gap-2 whitespace-nowrap rounded-full py-1 pl-1 pr-3 transition",
            active ? "bg-ink text-white" : done ? "text-ink hover:bg-ink/5" : "text-ink/40")}>
            <span className={cx("grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold",
              active ? "bg-orange text-white" : done ? "bg-forest text-white" : "border border-ink/20")}>
              {done ? <Check size={11} strokeWidth={3} /> : i + 1}
            </span>
            <span className="font-semibold">{label}</span>
          </span>
        );
        return (
          <li key={label} className="flex items-center gap-1.5">
            {done && hrefs[i] ? <Link to={hrefs[i]!}>{inner}</Link> : inner}
            {i < STEPS.length - 1 && <span className={cx("h-px w-5 sm:w-8", i < current ? "bg-forest/50" : "bg-ink/15")} />}
          </li>
        );
      })}
    </ol>
  );
}
