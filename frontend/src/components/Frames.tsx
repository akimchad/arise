import { Bookmark, Heart, MessageCircle, MoreHorizontal, Repeat2, Send, BarChart2, Share } from "lucide-react";
import { useState, type ReactNode } from "react";
import { aspectClass, cx } from "../lib/util";

export function Media({ src, kind = "image", alt = "", className, cover = true, poster }: {
  src: string; kind?: "image" | "video" | string; alt?: string; className?: string; cover?: boolean; poster?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const fit = cover ? "object-cover" : "object-contain";
  return (
    <div className={cx("relative h-full w-full overflow-hidden", !loaded && "shimmer", className)}>
      {kind === "video" ? (
        <video src={src} poster={poster} autoPlay muted loop playsInline onLoadedData={() => setLoaded(true)}
          className={cx("h-full w-full transition-opacity duration-700", fit, loaded ? "opacity-100" : "opacity-0")} />
      ) : (
        <img src={src} alt={alt} loading="lazy" onLoad={() => setLoaded(true)}
          className={cx("h-full w-full transition-all duration-700", fit, loaded ? "opacity-100 blur-0" : "opacity-0 blur-md")} />
      )}
    </div>
  );
}

function Avatar({ name, color = "#121110", size = 32 }: { name: string; color?: string; size?: number }) {
  return (
    <span className="grid shrink-0 place-items-center rounded-full p-[2px]" style={{ width: size, height: size, background: "conic-gradient(#FF5A1F, #FDB022, #E1306C, #FF5A1F)" }}>
      <span className="grid h-full w-full place-items-center rounded-full border-2 border-white text-[11px] font-bold text-white" style={{ background: color }}>
        {name.slice(0, 1).toUpperCase()}
      </span>
    </span>
  );
}

const handle = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "");

export function InstagramPost({ name, color, caption, aspect = "3:4", children, className }: {
  name: string; color?: string; caption?: string; aspect?: string; children: ReactNode; className?: string;
}) {
  return (
    <div className={cx("overflow-hidden rounded-[22px] border border-line bg-white text-ink shadow-card", className)}>
      <div className="flex items-center gap-2.5 px-3.5 py-2.5">
        <Avatar name={name} color={color} size={30} />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-[13px] font-semibold">{handle(name)}</p>
          <p className="text-[11px] text-ink/50">Sponsored</p>
        </div>
        <MoreHorizontal size={18} className="text-ink/60" />
      </div>
      <div className={cx("relative bg-cream", aspectClass(aspect))}>{children}</div>
      <div className="flex items-center gap-3.5 px-3.5 pt-3 text-ink">
        <Heart size={21} /><MessageCircle size={21} /><Send size={20} />
        <Bookmark size={20} className="ml-auto" />
      </div>
      {caption && (
        <p className="line-clamp-2 px-3.5 pb-3.5 pt-2 text-[13px] leading-snug">
          <span className="font-semibold">{handle(name)}</span> {caption}
        </p>
      )}
    </div>
  );
}

export function StoryPhone({ name, color, children, className }: { name: string; color?: string; children: ReactNode; className?: string }) {
  return (
    <div className={cx("relative rounded-[34px] bg-ink p-[7px] shadow-lift", className)}>
      <div className="relative aspect-[9/16] overflow-hidden rounded-[28px] bg-night">
        {children}
        <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/45 to-transparent px-3 pb-8 pt-3">
          <div className="flex gap-1">
            <span className="h-[2.5px] flex-1 rounded-full bg-white" />
            <span className="h-[2.5px] flex-1 rounded-full bg-white/40" />
            <span className="h-[2.5px] flex-1 rounded-full bg-white/40" />
          </div>
          <div className="mt-2.5 flex items-center gap-2 text-white">
            <Avatar name={name} color={color} size={24} />
            <span className="text-[12px] font-semibold drop-shadow">{handle(name)}</span>
            <span className="text-[11px] text-white/70">2h</span>
          </div>
        </div>
        <div className="pointer-events-none absolute inset-x-3 bottom-3 flex items-center gap-2">
          <span className="flex-1 rounded-full border border-white/60 px-3 py-2 text-[11px] text-white/80 backdrop-blur-sm">Send message</span>
          <Heart size={20} className="text-white" /><Send size={19} className="text-white" />
        </div>
      </div>
    </div>
  );
}

export function XPost({ name, color, text, aspect = "16:9", children, className }: {
  name: string; color?: string; text?: string; aspect?: string; children: ReactNode; className?: string;
}) {
  return (
    <div className={cx("rounded-[22px] border border-line bg-white p-4 text-ink shadow-card", className)}>
      <div className="flex gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-bold text-white" style={{ background: color ?? "#121110" }}>
          {name.slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] leading-tight"><span className="font-bold">{name}</span> <span className="text-ink/50">@{handle(name)} · 1h</span></p>
          {text && <p className="mt-1 text-[14px] leading-snug">{text}</p>}
          <div className={cx("relative mt-3 overflow-hidden rounded-2xl border border-line", aspectClass(aspect))}>{children}</div>
          <div className="mt-3 flex justify-between pr-6 text-ink/50">
            <MessageCircle size={17} /><Repeat2 size={17} /><Heart size={17} /><BarChart2 size={17} /><Share size={17} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdBanner({ name, children, cta = "Learn more", className }: { name: string; children: ReactNode; cta?: string; className?: string }) {
  return (
    <div className={cx("overflow-hidden rounded-[22px] border border-line bg-white text-ink shadow-card", className)}>
      <div className="flex items-center justify-between px-4 py-2.5 text-[12px]">
        <span className="font-semibold">{name}</span>
        <span className="rounded bg-ink/5 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink/60">Ad</span>
      </div>
      <div className="relative aspect-video">{children}</div>
      <div className="flex items-center justify-between gap-3 bg-[#F4F2EE] px-4 py-3">
        <p className="truncate text-[12px] text-ink/60">{name.toLowerCase().replace(/\s+/g, "")}.com</p>
        <span className="shrink-0 rounded-md bg-ink/10 px-3 py-1.5 text-[12px] font-semibold">{cta}</span>
      </div>
    </div>
  );
}

export function PrintFrame({ children, aspect = "2:3", className }: { children: ReactNode; aspect?: string; className?: string }) {
  return (
    <div className={cx("rounded-[6px] bg-white p-2.5 shadow-lift", className)}>
      <div className={cx("relative overflow-hidden rounded-[2px]", aspectClass(aspect))}>{children}</div>
    </div>
  );
}
