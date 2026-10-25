import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft, ArrowUpRight, CalendarPlus, Check, Copy, Download, Expand, Link2, MapPin, Megaphone, Music2, RefreshCw, Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { InstagramGlyph } from "../components/Brand";
import { AdBanner, InstagramPost, Media, PrintFrame, StoryPhone } from "../components/Frames";
import { Nav } from "../components/Nav";
import { Stepper } from "../components/Stepper";
import { Modal, Spinner, useToast } from "../components/ui";
import { api, ApiError, API_BASE, mediaUrl } from "../lib/api";
import type { Brand, Generation, Item, Usage } from "../lib/schemas";
import { aspectClass, cx, useInterval } from "../lib/util";

const DEVELOPING = ["Setting the scene", "Styling the props", "Dialing in the light", "Setting the type", "Final polish"];
const ANIMATING = ["Reading the story frame", "Planning the motion", "Rendering frames", "Encoding your reel"];
const WIDTH: Record<string, string> = {
  post: "w-[290px]", story: "w-[240px]", video: "w-[240px]", banner: "w-[min(480px,86vw)]", flyer: "w-[270px]", wallpaper: "w-[240px]",
};

function shareUrl(item: Item) {
  return `${API_BASE || window.location.origin}${item.share ?? ""}`;
}

export default function GenerationPage() {
  const { id = "" } = useParams();
  const toast = useToast();
  const [gen, setGen] = useState<Generation | null>(null);
  const [brand, setBrand] = useState<Brand | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [error, setError] = useState("");
  const [caption, setCaption] = useState("");
  const [comingSoon, setComingSoon] = useState<string | null>(null);
  const [zoom, setZoom] = useState<Item | null>(null);
  const wasComplete = useRef<boolean | null>(null);

  const load = useCallback(() => {
    api.generation(id).then((r) => {
      setGen((prev) => {
        if (!prev) setCaption(r.generation.caption ?? "");
        return r.generation;
      });
      setUsage(r.usage);
    }).catch((e) => setError(e instanceof ApiError ? e.message : "Couldn't load this generation."));
  }, [id]);
  useEffect(load, [load]);
  useInterval(load, 2500, !!gen && !gen.complete);
  useEffect(() => { if (gen?.brand_id && !brand) api.brand(gen.brand_id).then(setBrand).catch(() => undefined); }, [gen?.brand_id, brand]);
  useEffect(() => {
    if (!gen) return;
    if (wasComplete.current === false && gen.complete && gen.items.some((i) => i.status === "done")) toast("Your creatives are ready ✨");
    wasComplete.current = gen.complete;
  }, [gen, toast]);

  if (error) return <Page><div className="py-32 text-center"><p className="display text-5xl">Hmm.</p><p className="mt-4 text-muted">{error}</p></div></Page>;
  if (!gen) return <Page><div className="grid place-items-center py-40"><Spinner className="h-6 w-6" /></div></Page>;

  const ready = gen.items.filter((i) => i.status === "done");
  const finished = gen.items.filter((i) => ["done", "failed", "blocked"].includes(i.status)).length;
  const name = gen.brand_name ?? "Your brand";
  const palette = brand?.profile?.palette ?? [];
  const glowA = palette[0]?.hex ?? "#FF5A1F";
  const glowB = palette[1]?.hex ?? "#C9D3BC";
  const fullCaption = `${caption}${gen.hashtags.length ? "\n\n" + gen.hashtags.map((h) => `#${h}`).join(" ") : ""}`;
  const hero = ready.find((i) => i.kind === "image");
  const hasVideo = gen.items.some((i) => i.kind === "video");

  async function copy(text: string, msg = "Copied") {
    try { await navigator.clipboard.writeText(text); toast(msg); } catch { toast("Couldn't copy — select and copy manually.", "error"); }
  }

  async function shareInstagram() {
    const item = hero ?? ready[0];
    if (!item?.url) return;
    try {
      const blob = await fetch(mediaUrl(item.download ?? item.url)).then((r) => r.blob());
      const file = new File([blob], `${name}-${item.format}.${item.kind === "video" ? "mp4" : "png"}`, { type: blob.type });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.clipboard.writeText(fullCaption).catch(() => undefined);
        await navigator.share({ files: [file], text: fullCaption });
        return;
      }
    } catch { /* fall back below */ }
    await copy(fullCaption, "Caption copied — downloading your post for Instagram");
    window.location.href = mediaUrl(item.download);
  }

  function shareX() {
    const item = hero ?? ready[0];
    const url = item ? shareUrl(item) : "";
    window.open(`https://x.com/intent/post?text=${encodeURIComponent(caption.slice(0, 230))}&url=${encodeURIComponent(url)}`, "_blank", "noopener");
  }

  function addToCalendar() {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    const ymd = date.toISOString().slice(0, 10).replace(/-/g, "");
    const ics = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Arise//EN", "BEGIN:VEVENT",
      `UID:${gen!.id}@arise`, `DTSTART:${ymd}T170000Z`, `DTEND:${ymd}T173000Z`,
      `SUMMARY:Post: ${gen!.idea.title} (${name})`,
      `DESCRIPTION:${fullCaption.replace(/\n/g, "\\n")}\\n\\nOpen in Arise: ${window.location.href}`,
      "END:VEVENT", "END:VCALENDAR",
    ].join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
    a.download = `arise-${gen!.idea.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.ics`;
    a.click();
    toast("Reminder added — post at peak time tomorrow");
  }

  return (
    <Page step={gen.complete ? 3 : 2} brandHref={`/studio/brand/${gen.brand_id}`}>
      <div className="pb-24 pt-6">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div className="min-w-0">
            <Link to={`/studio/brand/${gen.brand_id}`} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft size={15} /> {name}</Link>
            <p className="eyebrow mt-4">{gen.idea.moment}</p>
            <h1 className="display mt-3 text-[clamp(40px,5.4vw,76px)]">{gen.idea.title}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {usage && <span className="chip">{Math.max(usage.images.limit - usage.images.used, 0)} images · {Math.max(usage.videos.limit - usage.videos.used, 0)} videos left today</span>}
            {gen.complete && hero && (
              <a href={mediaUrl(hero.download)} className="btn-dark px-4 py-2.5 text-[14px]"><Download size={15} /> Download</a>
            )}
          </div>
        </div>

        <div className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
            <span className="flex items-center gap-2 font-semibold">
              {gen.complete ? <><span className="grid h-5 w-5 place-items-center rounded-full bg-forest text-white"><Check size={12} strokeWidth={3} /></span>{ready.length} of {gen.items.length} ready</>
                : <><span className="h-2 w-2 animate-pulse rounded-full bg-orange" />Rendering {Math.min(finished + 1, gen.items.length)} of {gen.items.length}</>}
            </span>
            <span className="text-muted">{gen.complete ? "Tap any creative to see it full size" : hasVideo ? "Images in about a minute · reels take a couple more" : "Usually under a minute"}</span>
          </div>
          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-ink/10">
            <motion.div className="h-full rounded-full bg-gradient-to-r from-orange to-[#FFB37A]"
              initial={{ width: "4%" }} animate={{ width: `${Math.max(6, (finished / gen.items.length) * 100)}%` }} transition={{ duration: 0.8 }} />
          </div>
        </div>

        {gen.mode === "demo" && (
          <p className="mt-5 rounded-2xl border border-orange/30 bg-orange-soft/60 px-4 py-3 text-[13px] text-ink/80">
            <b>Demo mode:</b> this server has no Higgsfield key, so it's showing sample media from our gallery. Add <code>HF_CREDENTIALS</code> to go live.
          </p>
        )}

        <section className="relative mt-7 overflow-hidden rounded-[32px] bg-night px-4 py-10 sm:px-10 sm:py-14">
          <div className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full blur-3xl" style={{ background: glowA, opacity: 0.28 }} />
          <div className="pointer-events-none absolute -bottom-32 -right-20 h-[28rem] w-[28rem] rounded-full blur-3xl" style={{ background: glowB, opacity: 0.18 }} />
          <div className="relative flex flex-wrap items-start justify-center gap-x-8 gap-y-12">
            {gen.items.map((item, i) => (
              <motion.div key={item.id} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1, duration: 0.6 }}
                className={cx("shrink-0", WIDTH[item.format] ?? "w-[280px]")}>
                <button type="button" disabled={item.status !== "done"} onClick={() => setZoom(item)}
                  className="group relative block w-full text-left transition duration-500 enabled:hover:-translate-y-1.5 disabled:cursor-default">
                  <FramedItem item={item} name={name} caption={caption} color={palette[0]?.hex} />
                  {item.status === "done" && (
                    <span className="absolute right-3 top-14 grid h-8 w-8 place-items-center rounded-full bg-black/55 text-white opacity-0 backdrop-blur transition group-hover:opacity-100">
                      <Expand size={15} />
                    </span>
                  )}
                </button>
                <div className="mt-4 flex items-center justify-between gap-2 text-white">
                  <div>
                    <p className="text-[14px] font-semibold">{item.label}</p>
                    <p className="text-[12px] text-white/50">{item.aspect}{item.kind === "video" ? " · 5s reel" : ""}</p>
                  </div>
                  {item.status === "done" && (
                    <div className="flex gap-1.5">
                      <button onClick={() => copy(shareUrl(item), "Share link copied")} className="grid h-9 w-9 place-items-center rounded-full bg-white/10 transition hover:bg-white/20" title="Copy share link"><Link2 size={15} /></button>
                      <a href={mediaUrl(item.download)} className="grid h-9 w-9 place-items-center rounded-full bg-white text-ink transition hover:bg-orange hover:text-white" title="Download"><Download size={15} /></a>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        <div className="mt-6 grid gap-5 lg:grid-cols-3">
          <div className="card p-6">
            <div className="flex items-center justify-between">
              <p className="font-display text-lg font-bold tracking-tight">Caption</p>
              <button onClick={() => copy(fullCaption, "Caption copied")} className="inline-flex items-center gap-1.5 text-[13px] font-semibold hover:text-orange"><Copy size={14} /> Copy</button>
            </div>
            <textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={4} className="input mt-3 resize-none text-[14px]" />
            <div className="mt-3 flex flex-wrap gap-1.5">
              {gen.hashtags.map((h) => <span key={h} className="rounded-full bg-ink/5 px-2.5 py-1 text-[12px] text-ink/70">#{h}</span>)}
            </div>
          </div>

          <div className="card p-6">
            <p className="font-display text-lg font-bold tracking-tight">Publish</p>
            <p className="mt-1 text-[13px] text-muted">{ready.length ? "Send it where your customers are." : "Unlocks as soon as your first creative is ready."}</p>
            <div className={cx("mt-4 grid grid-cols-2 gap-2", !ready.length && "pointer-events-none opacity-40")}>
              <Channel icon={<InstagramGlyph size={18} />} label="Instagram" onClick={shareInstagram} />
              <Channel icon={<span className="text-[17px] font-bold leading-none">𝕏</span>} label="X" onClick={shareX} />
              <Channel icon={<Music2 size={18} />} label="TikTok" soon onClick={() => setComingSoon("TikTok")} />
              <Channel icon={<Megaphone size={18} />} label="Meta" soon onClick={() => setComingSoon("Meta Ads")} />
              <Channel icon={<MapPin size={18} />} label="Google" soon onClick={() => setComingSoon("Google Business Profile")} />
              <Channel icon={<CalendarPlus size={18} />} label="Schedule" onClick={addToCalendar} />
            </div>
          </div>

          <div className="card flex flex-col p-6">
            <p className="font-display text-lg font-bold tracking-tight">Keep going</p>
            <p className="mt-1 text-[13px] text-muted">Same brand, fresh direction.</p>
            <div className="mt-4 grid gap-2">
              <NextLink to={`/studio/brand/${gen.brand_id}`} icon={<RefreshCw size={16} className="text-orange" />}>Try another idea</NextLink>
              <NextLink to="/library" icon={<ArrowUpRight size={16} className="text-ink/40" />}>See everything you've made</NextLink>
              <NextLink to="/studio" icon={<Sparkles size={16} className="text-ink/40" />}>Start a new brand</NextLink>
            </div>
          </div>
        </div>
      </div>

      <Modal open={!!zoom} onClose={() => setZoom(null)} wide className="!bg-night">
        {zoom?.url && (
          <div className="grid lg:grid-cols-[1fr_300px]">
            <div className="flex items-center justify-center bg-black p-4 sm:p-8">
              <div className={cx("max-h-[78vh] max-w-full overflow-hidden rounded-xl", aspectClass(zoom.aspect),
                zoom.aspect === "16:9" ? "w-full" : "h-[70vh]")}>
                <Media src={mediaUrl(zoom.url)} kind={zoom.kind} cover={false} />
              </div>
            </div>
            <div className="flex flex-col gap-3 p-6 text-white">
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/50">{name}</p>
              <p className="font-display text-[26px] font-bold leading-tight tracking-tight">{zoom.label}</p>
              <p className="text-[13px] text-white/60">{zoom.aspect}{zoom.kind === "video" ? " · 5s reel" : ""}</p>
              <a href={mediaUrl(zoom.download)} className="btn-primary mt-4"><Download size={16} /> Download</a>
              <button onClick={() => copy(shareUrl(zoom), "Share link copied")} className="btn border border-white/20 px-4 py-2.5 text-white hover:bg-white/10"><Link2 size={15} /> Copy share link</button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!comingSoon} onClose={() => setComingSoon(null)}>
        <div className="p-8">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-orange-soft text-orange"><Sparkles /></span>
          <h3 className="mt-5 font-display text-[28px] font-bold leading-tight tracking-[-0.03em]">Direct publishing to {comingSoon} is almost here.</h3>
          <p className="mt-3 text-[15px] text-ink/70">
            Soon you'll connect your account once and Arise will post, schedule and A/B test for you. For now, download your creative and copy the caption — it's ready to go.
          </p>
          <div className="mt-6 flex gap-2">
            <button onClick={() => { copy(fullCaption, "Caption copied"); setComingSoon(null); }} className="btn-outline flex-1"><Copy size={15} /> Copy caption</button>
            <a href={hero ? mediaUrl(hero.download) : undefined} className="btn-primary flex-1"><Download size={15} /> Download</a>
          </div>
        </div>
      </Modal>
    </Page>
  );
}

function Page({ children, step, brandHref }: { children: ReactNode; step?: number; brandHref?: string }) {
  return (
    <div className="min-h-screen">
      <Nav variant="app" />
      {step !== undefined && (
        <div className="mx-auto max-w-[1320px] px-5 pt-5 sm:px-8"><Stepper current={step} hrefs={brandHref ? { 0: brandHref, 1: brandHref } : {}} /></div>
      )}
      <main className="mx-auto max-w-[1320px] px-5 sm:px-8">{children}</main>
    </div>
  );
}

function NextLink({ to, icon, children }: { to: string; icon: ReactNode; children: ReactNode }) {
  return (
    <Link to={to} className="flex items-center justify-between rounded-2xl border border-line bg-white px-4 py-3 text-[14px] font-semibold transition hover:border-ink/30">
      {children}{icon}
    </Link>
  );
}

function Channel({ icon, label, onClick, soon }: { icon: ReactNode; label: string; onClick: () => void; soon?: boolean }) {
  return (
    <button onClick={onClick} className="group flex items-center gap-2.5 rounded-2xl border border-line bg-white px-3 py-2.5 text-left transition hover:border-ink/30">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-ink/5">{icon}</span>
      <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold">{label}</span>
      {soon && <span className="rounded-full bg-ink/5 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-ink/45">Soon</span>}
    </button>
  );
}

function Developing({ item }: { item: Item }) {
  const lines = item.kind === "video" ? ANIMATING : DEVELOPING;
  const [n, setN] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setN((x) => Math.min(x + 1, lines.length - 1)), item.kind === "video" ? 12000 : 5000);
    return () => window.clearInterval(t);
  }, [lines.length, item.kind]);
  if (item.status === "failed" || item.status === "blocked") {
    return (
      <div className="grid h-full w-full place-items-center bg-[#1b1a19] p-6 text-center text-white">
        <div><p className="font-display text-lg font-bold">Didn't make it</p><p className="mt-1 text-[12px] text-white/60">{item.error ?? "Something went wrong."}</p></div>
      </div>
    );
  }
  const label = item.status === "waiting" ? "Waiting for the story frame" : item.status === "queued" ? "In the queue" : lines[n];
  return (
    <div className="shimmer-dark relative grid h-full w-full place-items-center overflow-hidden text-white">
      <div className="text-center">
        <div className="mx-auto flex h-8 items-end justify-center gap-1">
          {[0, 1, 2].map((b) => (
            <motion.span key={b} className="w-1.5 rounded-sm bg-orange" animate={{ height: [10, 26, 10] }} transition={{ duration: 1.1, repeat: Infinity, delay: b * 0.15 }} />
          ))}
        </div>
        <AnimatePresence mode="wait">
          <motion.p key={label} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            className="mt-3 px-4 text-[13px] font-semibold">{label}…</motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}

function FramedItem({ item, name, caption, color }: { item: Item; name: string; caption: string; color?: string }) {
  const done = item.status === "done" && item.url;
  const media = done ? <Media src={mediaUrl(item.url)} kind={item.kind} /> : <Developing item={item} />;
  switch (item.format) {
    case "post":
      return <InstagramPost name={name} color={color} caption={caption} aspect={item.aspect}>{media}</InstagramPost>;
    case "story":
    case "video":
      return <StoryPhone name={name} color={color}>{media}</StoryPhone>;
    case "wallpaper":
      return (
        <div className="relative rounded-[34px] bg-ink p-[7px] shadow-lift ring-1 ring-white/10">
          <div className="relative aspect-[9/16] overflow-hidden rounded-[28px]">
            {media}
            {done && (
              <div className="pointer-events-none absolute inset-x-0 top-10 text-center text-white drop-shadow">
                <p className="text-[13px] font-medium">{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p>
                <p className="font-display text-[64px] font-semibold leading-none tracking-tight">9:41</p>
              </div>
            )}
          </div>
        </div>
      );
    case "banner":
      return <AdBanner name={name} cta="Learn more">{media}</AdBanner>;
    case "flyer":
      return <PrintFrame aspect={item.aspect}>{media}</PrintFrame>;
    default:
      return <div className={cx("overflow-hidden rounded-2xl", aspectClass(item.aspect))}>{media}</div>;
  }
}
