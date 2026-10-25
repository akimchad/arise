import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, Check, ImageIcon, Lock, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError, mediaUrl } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { Brand, FormatKey, Idea, Usage } from "../lib/schemas";
import { brandPhotos, cx, readableOn } from "../lib/util";
import { AuthForm } from "./AuthForm";
import { Spinner } from "./ui";

export const FORMAT_OPTIONS: { key: FormatKey; label: string; sub: string; w: number; h: number; video?: boolean }[] = [
  { key: "post", label: "Instagram post", sub: "3:4 feed", w: 15, h: 20 },
  { key: "story", label: "Story", sub: "9:16 full screen", w: 11, h: 20 },
  { key: "video", label: "Reel", sub: "5s video from the story", w: 11, h: 20, video: true },
  { key: "banner", label: "Ad banner", sub: "16:9 for Meta & X", w: 22, h: 13 },
  { key: "flyer", label: "Flyer / menu", sub: "2:3 print-ready", w: 14, h: 20 },
  { key: "wallpaper", label: "Wallpaper", sub: "9:16 for fans", w: 11, h: 20 },
];

const TONES = [
  { key: "auto", label: "Auto", cls: "font-display font-extrabold tracking-[-0.03em]" },
  { key: "bold", label: "Bold", cls: "font-display font-black uppercase tracking-[-0.04em]" },
  { key: "elegant", label: "Elegant", cls: "font-serif" },
  { key: "playful", label: "Playful", cls: "font-display font-extrabold tracking-[-0.02em]" },
  { key: "minimal", label: "Minimal", cls: "font-sans font-medium tracking-tight" },
  { key: "cozy", label: "Cozy", cls: "font-serif italic" },
];

export function CreatePanel({ brand, idea, onClose }: { brand: Brand; idea: Idea; onClose: () => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const profile = brand.profile!;
  const [formats, setFormats] = useState<FormatKey[]>(() => {
    const base = idea.formats.filter((f) => FORMAT_OPTIONS.some((o) => o.key === f)).slice(0, 3);
    return base.length ? base : ["post", "story"];
  });
  const [tone, setTone] = useState("auto");
  const [headline, setHeadline] = useState(idea.headline);
  const [subline, setSubline] = useState(idea.subline);
  const [accent, setAccent] = useState<string | null>(null);
  const [caption, setCaption] = useState(idea.caption);
  const [refs, setRefs] = useState<string[]>(() => brand.uploads.slice(0, 4).map((u) => `up:${u.id}`));
  const [usage, setUsage] = useState<Usage | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [backdropFailed, setBackdropFailed] = useState(false);

  useEffect(() => { if (user) api.usage().then(setUsage).catch(() => undefined); }, [user]);

  const photos = useMemo(() => [
    ...brand.uploads.map((u) => ({ key: `up:${u.id}`, src: mediaUrl(u.url), label: "Your photo" })),
    ...brandPhotos({ ...brand, uploads: [] }, mediaUrl).slice(0, 8).map((url) => ({ key: `url:${url}`, src: url, label: "From your site" })),
  ], [brand]);

  const effective = formats.includes("video") && !formats.includes("story") ? [...formats, "story" as FormatKey] : formats;
  const needImages = effective.filter((f) => f !== "video").length;
  const needVideos = effective.includes("video") ? 1 : 0;
  const leftImages = usage ? usage.images.limit - usage.images.used : null;
  const leftVideos = usage ? usage.videos.limit - usage.videos.used : null;
  const overLimit = leftImages !== null && leftVideos !== null && (needImages > leftImages || needVideos > leftVideos);

  function toggleFormat(k: FormatKey) {
    setFormats((f) => f.includes(k) ? f.filter((x) => x !== k) : [...f, k]);
  }
  function toggleRef(k: string) {
    setRefs((r) => r.includes(k) ? r.filter((x) => x !== k) : r.length >= 4 ? r : [...r, k]);
  }

  async function generate() {
    if (!formats.length) { setError("Pick at least one format."); return; }
    setBusy(true);
    setError("");
    try {
      const res = await api.generate({
        brand_id: brand.id, idea_id: idea.id, formats,
        overrides: {
          headline: headline !== idea.headline ? headline : undefined,
          subline: subline !== idea.subline ? subline : undefined,
          tone, accent: accent ?? undefined, caption: caption !== idea.caption ? caption : undefined,
        },
        reference_urls: refs.filter((r) => r.startsWith("url:")).map((r) => r.slice(4)),
        upload_ids: refs.filter((r) => r.startsWith("up:")).map((r) => r.slice(3)),
      });
      navigate(`/studio/g/${res.generation.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't start the generation.");
      setBusy(false);
    }
  }

  const palette = profile.palette.length ? profile.palette : [{ name: "Ink", hex: "#121110" }];
  const backdrop = backdropFailed ? undefined : (photos.find((ph) => refs.includes(ph.key)) ?? photos[0])?.src;
  const bg = accent ?? palette[0].hex;
  const toneCls = TONES.find((t) => t.key === tone)?.cls ?? TONES[0].cls;

  return (
    <div className="grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      {/* Live direction preview: the business's own photo behind the headline */}
      <div className="relative flex min-h-[340px] flex-col justify-between gap-6 overflow-hidden rounded-t-[28px] p-7 sm:p-9 lg:sticky lg:top-0 lg:h-[min(92vh,820px)] lg:self-start lg:rounded-l-[28px] lg:rounded-tr-none"
        style={{ background: `linear-gradient(150deg, ${bg} 0%, ${palette[1]?.hex ?? bg} 130%)`, color: backdrop ? "#fff" : readableOn(bg) }}>
        {backdrop ? (
          <>
            <AnimatePresence>
              <motion.img key={backdrop} src={backdrop} alt="" initial={{ opacity: 0, scale: 1.06 }} animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }} transition={{ duration: 0.6 }} onError={() => setBackdropFailed(true)}
                className="absolute inset-0 h-full w-full object-cover" />
            </AnimatePresence>
            <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/20 to-black/70" />
            {accent && <div className="absolute inset-0 mix-blend-multiply" style={{ background: accent, opacity: 0.25 }} />}
          </>
        ) : <div className="grain" />}
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] opacity-75">{idea.moment}</p>
            <p className="mt-2 font-display text-[20px] font-bold leading-tight tracking-tight opacity-95">{idea.title}</p>
          </div>
          <span className="shrink-0 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest backdrop-blur">Preview</span>
        </div>
        <motion.div key={tone + headline} initial={{ opacity: 0.4, y: 8 }} animate={{ opacity: 1, y: 0 }} className="relative">
          <p className={cx("text-[clamp(38px,5vw,62px)] leading-[0.95] drop-shadow-sm", toneCls)}>{headline || "Headline by Higgsfield ✳"}</p>
          {subline && <p className="mt-4 text-[13px] font-semibold uppercase tracking-[0.2em] opacity-85">{subline}</p>}
        </motion.div>
        <div className="relative flex items-end justify-between gap-4">
          <p className="max-w-[280px] text-[12px] leading-snug opacity-80">{idea.scene}</p>
          <p className="shrink-0 font-display text-[15px] font-bold">{profile.name}</p>
        </div>
      </div>

      <div className="p-6 sm:p-8">
        <p className="eyebrow">Make it yours</p>
        <h3 className="mt-2 font-display text-[30px] font-bold leading-tight tracking-[-0.03em]">{idea.title}</h3>

        <p className="mt-6 text-sm font-semibold">Formats</p>
        <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {FORMAT_OPTIONS.map((o) => {
            const on = formats.includes(o.key);
            return (
              <button key={o.key} type="button" onClick={() => toggleFormat(o.key)}
                className={cx("relative flex items-center gap-3 rounded-2xl border p-3 text-left transition",
                  on ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink/30")}>
                <span className={cx("grid h-9 w-9 shrink-0 place-items-center rounded-lg", on ? "bg-white/10" : "bg-ink/5")}>
                  <span className={cx("rounded-[3px] border-2", on ? "border-white" : "border-ink/60")} style={{ width: o.w, height: o.h }}>
                    {o.video && <span className={cx("block h-full w-full text-center text-[8px] leading-[16px]", on ? "text-white" : "text-ink/60")}>▶</span>}
                  </span>
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold leading-tight">{o.label}</span>
                  <span className={cx("block truncate text-[11px]", on ? "text-white/60" : "text-muted")}>{o.sub}</span>
                </span>
                {on && <Check size={14} className="absolute right-2 top-2" />}
              </button>
            );
          })}
        </div>

        <p className="mt-6 text-sm font-semibold">Tone</p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {TONES.map((t) => (
            <button key={t.key} type="button" onClick={() => setTone(t.key)}
              className={cx("rounded-full border px-3.5 py-1.5 text-[13px] transition", tone === t.key ? "border-orange bg-orange text-white" : "border-line bg-white hover:border-ink/30")}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <label className="block"><span className="text-sm font-semibold">Headline</span>
            <input className="input mt-1.5" value={headline} maxLength={80} placeholder="Leave empty — Higgsfield writes one" onChange={(e) => setHeadline(e.target.value)} /></label>
          <label className="block"><span className="text-sm font-semibold">Small print</span>
            <input className="input mt-1.5" value={subline} maxLength={100} placeholder="Optional" onChange={(e) => setSubline(e.target.value)} /></label>
        </div>

        <p className="mt-6 text-sm font-semibold">Accent color</p>
        <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
          <button type="button" onClick={() => setAccent(null)} className={cx("h-9 rounded-full border px-3 text-[12px]", accent === null ? "border-ink" : "border-line")}>Brand</button>
          {palette.map((s) => (
            <button key={s.hex + s.name} type="button" onClick={() => setAccent(s.hex)} title={`${s.name} ${s.hex}`}
              className={cx("h-9 w-9 rounded-full transition", accent === s.hex ? "ring-2 ring-orange ring-offset-2" : "ring-1 ring-ink/10 hover:scale-110")}
              style={{ background: s.hex }} />
          ))}
        </div>

        {photos.length > 0 && (
          <>
            <p className="mt-6 flex items-center gap-2 text-sm font-semibold"><ImageIcon size={15} /> Use your real photos <span className="font-normal text-muted">(optional, up to 4)</span></p>
            <div className="no-scrollbar mt-2.5 flex gap-2 overflow-x-auto pb-1">
              {photos.map((p) => (
                <button key={p.key} type="button" onClick={() => toggleRef(p.key)} title={p.label}
                  className={cx("relative h-16 w-16 shrink-0 overflow-hidden rounded-xl transition", refs.includes(p.key) ? "ring-2 ring-orange ring-offset-2" : "opacity-80 ring-1 ring-line hover:opacity-100")}>
                  <img src={p.src} alt="" className="h-full w-full object-cover" onError={(e) => ((e.target as HTMLElement).parentElement!.style.display = "none")} />
                  {refs.includes(p.key) && <span className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-orange text-white"><Check size={12} /></span>}
                </button>
              ))}
            </div>
          </>
        )}

        <label className="mt-6 block"><span className="text-sm font-semibold">Caption</span>
          <textarea className="input mt-1.5 resize-none text-[14px]" rows={3} value={caption} maxLength={600} onChange={(e) => setCaption(e.target.value)} /></label>

        <div className="mt-7 border-t border-line pt-6">
          {user ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 text-[13px] text-muted">
                <span>Uses <b className="text-ink">{needImages} image{needImages === 1 ? "" : "s"}</b>{needVideos ? <> + <b className="text-ink">1 video</b></> : null}</span>
                {usage && <span>{leftImages} images · {leftVideos} videos left today</span>}
              </div>
              {error && <p className="mt-3 text-sm font-medium text-orange-deep">{error}</p>}
              {overLimit && !error && <p className="mt-3 text-sm font-medium text-orange-deep">That's more than you have left today — pick fewer formats.</p>}
              <div className="mt-4 flex gap-3">
                <button onClick={onClose} className="btn-outline px-5">Cancel</button>
                <button onClick={generate} disabled={busy || !formats.length || overLimit} className="btn-primary flex-1 py-3.5 text-[16px]">
                  {busy ? <><Spinner /> Briefing the studio…</> : <><Sparkles size={17} /> Generate {effective.length} creative{effective.length === 1 ? "" : "s"} <ArrowUpRight size={17} /></>}
                </button>
              </div>
            </>
          ) : (
            <div>
              <p className="mb-4 flex items-center gap-2 text-sm font-semibold"><Lock size={15} /> Create a free account to generate — your brand and ideas are saved.</p>
              <AuthForm compact />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
