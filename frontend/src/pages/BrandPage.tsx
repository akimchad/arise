import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle, ArrowUpRight, CalendarDays, Check, ExternalLink, Film, Image as ImageIcon, MapPin, Pencil, RefreshCw,
  Sparkles, Wand2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { CreatePanel } from "../components/CreatePanel";
import { Media } from "../components/Frames";
import { Nav } from "../components/Nav";
import { Stepper } from "../components/Stepper";
import { Modal, Spinner, useToast } from "../components/ui";
import { api, ApiError, mediaUrl } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { Brand, Generation, Idea } from "../lib/schemas";
import { brandPhotos, cx, daysLabel, daysUntil, readableOn, shortDate, useInterval } from "../lib/util";

const STAGES = [
  { key: "reading", label: "Reading your link" },
  { key: "understanding", label: "Learning your brand" },
  { key: "researching", label: "Checking the calendar & season" },
  { key: "ideating", label: "Drafting campaign ideas" },
];
const STAGE_INDEX: Record<string, number> = { reading: 0, lookup: 1, understanding: 1, researching: 2, ideating: 3, ready: 4 };
const FORMAT_LABEL: Record<string, string> = { post: "Post", story: "Story", video: "Reel", banner: "Ad", flyer: "Flyer", wallpaper: "Wallpaper" };

function host(url?: string | null) {
  if (!url) return "";
  try { return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, ""); } catch { return url; }
}

export default function BrandPage() {
  const { id = "" } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const [brand, setBrand] = useState<Brand | null>(null);
  const [error, setError] = useState("");
  const [active, setActive] = useState<Idea | null>(null);
  const [gens, setGens] = useState<Generation[]>([]);
  // Paced reveal of the analysis steps; null = not decided yet (first load decides)
  const [shown, setShown] = useState(0);
  const [theatre, setTheatre] = useState<boolean | null>(null);

  const load = useCallback(() => {
    api.brand(id).then(setBrand).catch((e) => setError(e instanceof ApiError ? e.message : "Couldn't load this brand."));
  }, [id]);
  useEffect(load, [load]);
  useInterval(load, 1200, brand?.status === "working");

  // Fresh analyses walk through the steps at a readable pace; reopening a ready brand skips straight to ideas.
  useEffect(() => {
    if (brand && theatre === null) setTheatre(!brand.profile);
  }, [brand, theatre]);
  const serverStage = brand ? (brand.status === "ready" ? 4 : STAGE_INDEX[brand.stage ?? "reading"] ?? 0) : 0;
  useEffect(() => {
    if (!theatre) return;
    if (shown >= 4 && serverStage >= 4) {
      const t = window.setTimeout(() => setTheatre(false), 650);
      return () => window.clearTimeout(t);
    }
    if (shown < serverStage) {
      const t = window.setTimeout(() => setShown((s) => s + 1), 850);
      return () => window.clearTimeout(t);
    }
  }, [theatre, shown, serverStage]);

  useEffect(() => {
    if (user && brand?.status === "ready") api.generations(id).then((r) => setGens(r.generations)).catch(() => undefined);
  }, [user, id, brand?.status]);

  if (error) return <Shell><Empty title="Hmm." body={error} /></Shell>;
  if (!brand || theatre === null) return <Shell><div className="grid place-items-center py-40"><Spinner className="h-6 w-6" /></div></Shell>;
  if (brand.status === "failed") {
    return (
      <Shell>
        <Empty title="We hit a snag." body={brand.error ?? "We couldn't read that link."}
          hint="Try your homepage, a Google Maps share link, or upload a few photos instead." />
      </Shell>
    );
  }

  const analyzing = theatre || !brand.profile;
  return (
    <Shell step={analyzing ? 0 : 1}>
      <AnimatePresence mode="wait">
        {analyzing ? (
          <motion.div key="analyzing" exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.35 }}>
            <Analyzing brand={brand} shown={Math.min(shown, serverStage)} />
          </motion.div>
        ) : (
          <motion.div key="workspace" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <BrandWorkspace brand={brand} gens={gens} setBrand={setBrand} onCreate={setActive} toast={toast} />
          </motion.div>
        )}
      </AnimatePresence>
      <Modal open={!!active} onClose={() => setActive(null)} wide>
        {active && brand.profile && <CreatePanel brand={brand} idea={active} onClose={() => setActive(null)} />}
      </Modal>
    </Shell>
  );
}

function Shell({ children, step }: { children: ReactNode; step?: number }) {
  return (
    <div className="min-h-screen">
      <Nav variant="app" />
      {step !== undefined && (
        <div className="mx-auto max-w-[1320px] px-5 pt-5 sm:px-8"><Stepper current={step} /></div>
      )}
      <main className="mx-auto max-w-[1320px] px-5 sm:px-8">{children}</main>
    </div>
  );
}

function Empty({ title, body, hint }: { title: string; body: string; hint?: string }) {
  return (
    <div className="mx-auto max-w-[560px] py-28 text-center">
      <p className="display text-[56px]">{title}</p>
      <p className="mt-4 text-[17px] text-ink/70">{body}</p>
      {hint && <p className="mt-2 text-sm text-muted">{hint}</p>}
      <Link to="/studio" className="btn-primary mt-8">Try again <ArrowUpRight size={17} /></Link>
    </div>
  );
}

/* ------------------------------------------------------------------ analysis */

function Analyzing({ brand, shown }: { brand: Brand; shown: number }) {
  const photos = useMemo(() => brandPhotos(brand, mediaUrl).slice(0, 5), [brand]);
  const site = host(brand.source.final_url ?? brand.input.url);
  const p = brand.profile;
  return (
    <div className="grid min-h-[calc(100vh-130px)] items-center gap-12 py-10 lg:grid-cols-[1fr_1.05fr]">
      <div className="relative mx-auto aspect-[4/5] w-full max-w-[470px]">
        <div className="absolute inset-0 overflow-hidden rounded-[36px] bg-sage">
          <div className="grain" />
          {photos.length ? photos.map((src, i) => (
            <motion.img key={src} src={src} alt="" initial={{ opacity: 0, y: 30, rotate: i % 2 ? 6 : -6 }}
              animate={{ opacity: 1, y: 0, rotate: i % 2 ? 3 : -3 }} transition={{ delay: 0.2 + i * 0.25, duration: 0.7 }}
              onError={(e) => ((e.target as HTMLElement).style.display = "none")}
              className="absolute w-[56%] rounded-2xl border-[5px] border-paper object-cover shadow-lift"
              style={{ left: `${6 + (i % 3) * 17}%`, top: `${6 + i * 13}%`, aspectRatio: "4/5" }} />
          )) : (
            <div className="absolute inset-x-8 top-[28%] rounded-2xl bg-paper p-5 shadow-lift">
              <div className="flex gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-ink/15" /><span className="h-2.5 w-2.5 rounded-full bg-ink/15" /><span className="h-2.5 w-2.5 rounded-full bg-ink/15" /></div>
              <p className="mt-4 truncate font-display text-2xl font-bold">{site || "Your photos"}</p>
              <div className="shimmer mt-4 h-28 rounded-xl" />
              <div className="shimmer mt-3 h-3 w-2/3 rounded-full" />
            </div>
          )}
          <motion.div className="absolute inset-x-0 h-28 bg-gradient-to-b from-transparent via-white/45 to-transparent"
            animate={{ top: ["-25%", "115%"] }} transition={{ duration: 2.2, repeat: Infinity, ease: "linear" }} />
        </div>
        <AnimatePresence>
          {p && shown >= 2 && (
            <motion.div initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }}
              className="absolute -bottom-6 -right-2 w-[260px] rounded-2xl bg-paper p-4 shadow-lift sm:-right-10">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted">Found</p>
              <p className="mt-1 font-display text-[22px] font-extrabold leading-tight tracking-[-0.03em]">{p.name}</p>
              <p className="text-[12.5px] text-muted">{p.business_type}{p.location ? ` · ${p.location}` : ""}</p>
              <div className="mt-3 flex gap-1.5">
                {p.palette.map((s, i) => (
                  <motion.span key={s.hex} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.15 + i * 0.08 }}
                    className="h-7 flex-1 rounded-md ring-1 ring-ink/10" style={{ background: s.hex }} title={`${s.name} ${s.hex}`} />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div>
        <p className="eyebrow">Getting to know you</p>
        <h1 className="display mt-4 text-[clamp(42px,5.4vw,76px)]">
          {site ? <>Reading<br /><span className="text-orange">{site}</span></> : "Studying your photos"}
        </h1>
        <ul className="mt-10 space-y-3.5">
          {STAGES.map((s, i) => {
            const done = i < shown;
            const current = i === shown;
            return (
              <motion.li key={s.key} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
                className={cx("flex items-center gap-4 text-[19px] transition", done || current ? "text-ink" : "text-ink/30")}>
                <span className={cx("grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 transition-all duration-500",
                  done ? "border-forest bg-forest text-white" : current ? "border-orange" : "border-ink/15")}>
                  {done ? <Check size={16} strokeWidth={3} /> : current ? <Spinner className="h-3.5 w-3.5 text-orange" /> : null}
                </span>
                <span className={cx("shrink-0", current && "font-semibold")}>{s.label}{current && "…"}</span>
                {done && i === 1 && p && <span className="truncate text-[14px] text-muted">{p.signature_items.slice(0, 2).join(" · ")}</span>}
                {done && i === 2 && brand.calendar[0] && <span className="truncate text-[14px] text-muted">{brand.calendar[0].name} {daysLabel(brand.calendar[0].days_until)}</span>}
              </motion.li>
            );
          })}
        </ul>
        {brand.source.warning && (
          <p className="mt-8 flex max-w-[480px] gap-2.5 rounded-2xl bg-orange-soft/60 px-4 py-3 text-[13.5px] text-ink/80">
            <AlertTriangle size={17} className="mt-0.5 shrink-0 text-orange" />{brand.source.warning}
          </p>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ workspace */

function BrandWorkspace({ brand, gens, setBrand, onCreate, toast }: {
  brand: Brand; gens: Generation[]; setBrand: (b: Brand) => void; onCreate: (i: Idea) => void;
  toast: (t: string, tone?: "ok" | "error") => void;
}) {
  const p = brand.profile!;
  const [brief, setBrief] = useState("");
  const photos = useMemo(() => brandPhotos(brand, mediaUrl), [brand]);
  const working = brand.status === "working";
  const [featured, ...rest] = brand.ideas;

  async function refresh(text: string) {
    try {
      setBrand(await api.regenerateIdeas(brand.id, text));
      setBrief("");
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Couldn't refresh ideas.", "error");
    }
  }

  return (
    <div className="pb-24 pt-6">
      <header className="flex flex-wrap items-end justify-between gap-6 border-b border-line pb-7">
        <div className="flex items-center gap-5">
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-[22px] shadow-card" style={{ background: p.palette[0]?.hex ?? "#121110" }}>
            <span className="absolute inset-0 grid place-items-center font-display text-3xl font-black" style={{ color: readableOn(p.palette[0]?.hex ?? "#121110") }}>{p.name[0]}</span>
            {photos[0] && <img src={photos[0]} alt="" className="relative h-full w-full object-cover" onError={(e) => ((e.target as HTMLElement).style.display = "none")} />}
          </div>
          <div>
            <p className="eyebrow">Ideas for this week</p>
            <h1 className="display mt-2 text-[clamp(38px,4.6vw,64px)]">{p.name}</h1>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] text-muted">
              <span>{p.business_type}</span>
              {p.location && <span className="flex items-center gap-1"><MapPin size={13} />{p.location}</span>}
              <span className="flex items-center gap-1"><Sparkles size={13} className="text-orange" />{brand.engine === "claude" ? "Researched by Claude" : "Calendar + seasonal playbook"}</span>
            </p>
          </div>
        </div>
        <button onClick={() => refresh("")} disabled={working} className="btn-outline">
          {working ? <><Spinner /> Thinking…</> : <><RefreshCw size={15} /> Fresh ideas</>}
        </button>
      </header>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-10">
        <div className="min-w-0">
          {brand.source.warning && (
            <p className="mb-6 flex gap-3 rounded-2xl border border-orange/30 bg-orange-soft/50 px-4 py-3 text-[14px] text-ink/80">
              <AlertTriangle size={18} className="mt-0.5 shrink-0 text-orange" />
              <span>{brand.source.warning} You can also fix the details in your brand kit.</span>
            </p>
          )}

          <MomentsStrip brand={brand} />

          <form onSubmit={(e) => { e.preventDefault(); if (brief.trim()) refresh(brief.trim()); }}
            className="mt-5 flex items-center gap-3 rounded-2xl border border-dashed border-ink/20 bg-paper/70 py-2 pl-4 pr-2 transition focus-within:border-ink/40 focus-within:bg-white">
            <Wand2 size={18} className="shrink-0 text-orange" />
            <input value={brief} onChange={(e) => setBrief(e.target.value)} maxLength={1200}
              className="min-w-0 flex-1 bg-transparent py-2 text-[15px] outline-none placeholder:text-ink/40"
              placeholder="Have something specific in mind? “Launch our pumpkin bread”, “Fill Tuesday afternoons”…" />
            <button disabled={working || !brief.trim()} className="btn-dark shrink-0 px-4 py-2.5 text-[14px]">Get ideas</button>
          </form>

          {brand.ideas_brief && !working && (
            <p className="mt-6 text-[14px] text-muted">Ideas for: <span className="font-semibold text-ink">“{brand.ideas_brief}”</span> ·{" "}
              <button onClick={() => refresh("")} className="font-semibold text-ink link-underline">back to this week's picks</button></p>
          )}

          <div className="mt-7 space-y-6">
            {working ? (
              <>
                <div className="shimmer h-[340px] rounded-[28px]" />
                <div className="grid gap-6 md:grid-cols-2">{[0, 1].map((i) => <div key={i} className="shimmer h-[380px] rounded-[28px]" />)}</div>
              </>
            ) : (
              <>
                {featured && <FeaturedIdea idea={featured} brand={brand} photo={photos[0]} onCreate={() => onCreate(featured)} />}
                <div className="grid gap-6 md:grid-cols-2">
                  {rest.map((idea, i) => (
                    <IdeaCard key={idea.id} idea={idea} brand={brand} index={i + 1}
                      photo={photos.length ? photos[(i + 1) % photos.length] : undefined} onCreate={() => onCreate(idea)} />
                  ))}
                </div>
              </>
            )}
          </div>

          {gens.length > 0 && (
            <section className="mt-16">
              <div className="flex items-end justify-between">
                <h2 className="font-display text-[26px] font-bold tracking-[-0.03em]">Made for {p.name}</h2>
                <Link to="/library" className="text-sm font-semibold link-underline">Library</Link>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
                {gens.map((g) => {
                  const cover = g.items.find((i) => i.url && i.kind === "image") ?? g.items.find((i) => i.url);
                  return (
                    <Link key={g.id} to={`/studio/g/${g.id}`} className="group overflow-hidden rounded-2xl bg-paper shadow-card transition hover:-translate-y-1 hover:shadow-lift">
                      <div className="aspect-[4/5] overflow-hidden">{cover?.url ? <Media src={mediaUrl(cover.url)} kind={cover.kind} className="transition duration-700 group-hover:scale-[1.03]" /> : <div className="shimmer h-full" />}</div>
                      <div className="px-3.5 py-3">
                        <p className="truncate text-[13.5px] font-semibold">{g.idea.title}</p>
                        <p className="text-[12px] text-muted">{g.items.filter((i) => i.url).length} creatives</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        <BrandKit brand={brand} photos={photos} onSaved={async (b) => {
          setBrand(b);
          await refresh("");
          toast("Brand kit saved — refreshing ideas");
        }} />
      </div>
    </div>
  );
}

function MomentsStrip({ brand }: { brand: Brand }) {
  const moments = brand.calendar.slice(0, 5);
  if (!moments.length) return null;
  return (
    <div className="no-scrollbar -mx-1 flex items-center gap-2 overflow-x-auto px-1">
      <span className="flex shrink-0 items-center gap-1.5 pr-1 text-[12px] font-semibold uppercase tracking-wider text-muted"><CalendarDays size={14} /> Coming up</span>
      {moments.map((m) => (
        <span key={m.name + m.date} className="flex shrink-0 items-center gap-2 rounded-full border border-line bg-paper py-1 pl-3 pr-1 text-[13px]">
          {m.name}
          <span className={cx("rounded-full px-2 py-0.5 text-[11px] font-bold", m.days_until <= 10 ? "bg-orange text-white" : "bg-ink/5 text-ink/60")}>
            {m.days_until <= 14 ? daysLabel(m.days_until) : shortDate(m.date)}
          </span>
        </span>
      ))}
    </div>
  );
}

function Visual({ idea, brand, photo, index, big = false }: { idea: Idea; brand: Brand; photo?: string; index: number; big?: boolean }) {
  const p = brand.profile!;
  const [failed, setFailed] = useState(false);
  const swatch = p.palette[index % Math.max(p.palette.length, 1)]?.hex ?? "#121110";
  const days = daysUntil(idea.moment_date);
  const usePhoto = !!photo && !failed;
  return (
    <div className="relative h-full w-full overflow-hidden" style={{ background: swatch }}>
      {usePhoto ? (
        <>
          <img src={photo} alt="" onError={() => setFailed(true)} className="absolute inset-0 h-full w-full object-cover transition duration-[1.2s] group-hover:scale-[1.04]" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/10" />
        </>
      ) : <div className="grain" />}
      <span className="absolute left-4 top-4 rounded-full bg-paper/95 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-ink shadow-card">
        {idea.moment}{days !== null && days >= 0 && days <= 60 ? ` · ${daysLabel(days)}` : ""}
      </span>
      <div className="absolute inset-x-5 bottom-5" style={{ color: usePhoto ? "#fff" : readableOn(swatch) }}>
        <p className={cx("font-display font-extrabold leading-[0.95] tracking-[-0.04em] drop-shadow-sm", big ? "text-[clamp(36px,4vw,56px)]" : "text-[30px]")}>
          {idea.headline || idea.title}
        </p>
        {idea.subline && <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.18em] opacity-80">{idea.subline}</p>}
      </div>
    </div>
  );
}

function FormatChips({ formats }: { formats: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {formats.map((f) => (
        <span key={f} className="inline-flex items-center gap-1 rounded-full bg-ink/5 px-2.5 py-1 text-[11.5px] font-medium text-ink/70">
          {f === "video" ? <Film size={12} /> : <ImageIcon size={12} />}{FORMAT_LABEL[f] ?? f}
        </span>
      ))}
    </div>
  );
}

function FeaturedIdea({ idea, brand, photo, onCreate }: { idea: Idea; brand: Brand; photo?: string; onCreate: () => void }) {
  return (
    <motion.article initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      className="card group grid overflow-hidden md:grid-cols-[1.1fr_1fr]">
      <button onClick={onCreate} className="relative min-h-[300px] text-left" aria-label={`Create ${idea.title}`}>
        <Visual idea={idea} brand={brand} photo={photo} index={0} big />
      </button>
      <div className="flex flex-col p-7">
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-orange-soft px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-orange-deep">
          <Sparkles size={12} /> Top pick this week
        </span>
        <h3 className="mt-4 font-display text-[30px] font-bold leading-[1.05] tracking-[-0.035em]">{idea.title}</h3>
        <p className="mt-3 text-[15.5px] leading-relaxed text-ink/75">{idea.hook}</p>
        <p className="mt-4 rounded-xl bg-cream px-4 py-3 text-[13.5px] leading-snug text-ink/75"><span className="font-semibold text-ink">Why now · </span>{idea.why_now}</p>
        <div className="mt-5"><FormatChips formats={idea.formats} /></div>
        <div className="mt-auto flex items-center justify-between gap-3 pt-7">
          <p className="truncate text-[12px] text-ink/45">{idea.hashtags.slice(0, 3).map((h) => `#${h}`).join(" ")}</p>
          <button onClick={onCreate} className="btn-primary shrink-0 px-6 py-3 text-[15px]">Create this <ArrowUpRight size={17} /></button>
        </div>
      </div>
    </motion.article>
  );
}

function IdeaCard({ idea, brand, index, photo, onCreate }: { idea: Idea; brand: Brand; index: number; photo?: string; onCreate: () => void }) {
  return (
    <motion.article initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.06 }}
      className="card group flex flex-col overflow-hidden transition duration-300 hover:-translate-y-1 hover:shadow-lift">
      <button onClick={onCreate} className="relative h-[210px] text-left" aria-label={`Create ${idea.title}`}>
        <Visual idea={idea} brand={brand} photo={photo} index={index} />
      </button>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-display text-[21px] font-bold leading-tight tracking-[-0.03em]">{idea.title}</h3>
        <p className="mt-2 text-[14.5px] leading-snug text-ink/75">{idea.hook}</p>
        <p className="mt-3 text-[13px] leading-snug text-muted"><span className="font-semibold text-ink">Why now · </span>{idea.why_now}</p>
        <div className="mt-auto flex items-center justify-between gap-3 pt-5">
          <FormatChips formats={idea.formats} />
          <button onClick={onCreate} className="btn-primary shrink-0 px-4 py-2.5 text-[14px]">Create <ArrowUpRight size={15} /></button>
        </div>
      </div>
    </motion.article>
  );
}

/* ------------------------------------------------------------------ brand kit */

function BrandKit({ brand, photos, onSaved }: { brand: Brand; photos: string[]; onSaved: (b: Brand) => void }) {
  const p = brand.profile!;
  const site = brand.source.final_url ?? brand.input.url;
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(p.name);
  const [type, setType] = useState(p.business_type);
  const [items, setItems] = useState(p.signature_items.join(", "));
  const [saving, setSaving] = useState(false);

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const b = await api.patchBrand(brand.id, {
        name: name.trim() || p.name, business_type: type.trim() || p.business_type,
        signature_items: items.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 8),
      });
      setEditing(false);
      onSaved(b);
    } finally {
      setSaving(false);
    }
  }

  return (
    <aside className="lg:sticky lg:top-[88px] lg:self-start">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-5">
          <p className="kit-label">Brand kit</p>
          {!editing && <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[12px] font-semibold text-ink/60 hover:bg-ink/5 hover:text-ink"><Pencil size={12} /> Edit</button>}
        </div>

        {editing ? (
          <form onSubmit={save} className="space-y-2.5 p-5">
            <label className="block text-[12px] font-semibold">Business name<input className="input mt-1 py-2 text-[14px]" value={name} onChange={(e) => setName(e.target.value)} /></label>
            <label className="block text-[12px] font-semibold">What you are<input className="input mt-1 py-2 text-[14px]" value={type} placeholder="e.g. Bookstore" onChange={(e) => setType(e.target.value)} /></label>
            <label className="block text-[12px] font-semibold">Signature items <span className="font-normal text-muted">(comma separated)</span>
              <input className="input mt-1 py-2 text-[14px]" value={items} placeholder="e.g. Mint Mojito, Cold brew" onChange={(e) => setItems(e.target.value)} /></label>
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setEditing(false)} className="btn-outline flex-1 py-2 text-[13px]">Cancel</button>
              <button disabled={saving} className="btn-dark flex-1 py-2 text-[13px]">{saving ? <Spinner /> : "Save & refresh"}</button>
            </div>
          </form>
        ) : (
          <div className="space-y-5 p-5 pt-3">
            <div className="flex h-24 overflow-hidden rounded-2xl ring-1 ring-ink/5">
              {p.palette.map((s, i) => (
                <div key={s.hex + s.name} className="flex flex-col justify-end p-2" style={{ background: s.hex, flex: i === 0 ? 1.6 : 1, color: readableOn(s.hex) }}>
                  <span className="text-[10px] font-semibold leading-tight opacity-90">{s.name}</span>
                  <span className="font-mono text-[9.5px] uppercase opacity-70">{s.hex}</span>
                </div>
              ))}
            </div>
            {p.tagline && <p className="font-serif text-[21px] italic leading-snug">“{p.tagline}”</p>}
            <Field label="Signature">
              <div className="flex flex-wrap gap-1.5">{p.signature_items.slice(0, 6).map((s) => <span key={s} className="rounded-full bg-ink px-2.5 py-1 text-[12px] font-medium text-white">{s}</span>)}</div>
            </Field>
            <Field label="Voice">
              <div className="flex flex-wrap gap-1.5">{p.voice.map((v) => <span key={v} className="chip">{v}</span>)}</div>
            </Field>
            <Field label="Audience"><p className="text-[13.5px] leading-relaxed text-ink/75">{p.audience}</p></Field>
            {photos.length > 1 && (
              <Field label="Photos we found">
                <div className="grid grid-cols-4 gap-1.5">
                  {photos.slice(0, 8).map((src) => (
                    <img key={src} src={src} alt="" className="aspect-square w-full rounded-lg object-cover ring-1 ring-ink/5"
                      onError={(e) => ((e.target as HTMLElement).style.display = "none")} />
                  ))}
                </div>
              </Field>
            )}
            {site && (
              <a href={site.startsWith("http") ? site : `https://${site}`} target="_blank" rel="noreferrer"
                className="flex items-center gap-1.5 border-t border-line pt-4 text-[13px] font-semibold text-ink/70 hover:text-ink">
                {host(site)} <ExternalLink size={13} />
              </a>
            )}
          </div>
        )}
      </motion.div>
    </aside>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div><p className="kit-label mb-2">{label}</p>{children}</div>;
}
