import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, CalendarDays, MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Media } from "../components/Frames";
import { LinkInput } from "../components/LinkInput";
import { Nav } from "../components/Nav";
import { Stepper } from "../components/Stepper";
import { Reveal } from "../components/ui";
import { api, mediaUrl } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { Brand, Moment } from "../lib/schemas";
import { brandPhotos, cx, daysLabel, readableOn } from "../lib/util";

const PREVIEWS = [
  { src: "/showcase/philz-halloween.jpg", label: "Instagram post", brand: "Philz Coffee", aspect: "aspect-square" },
  { src: "/showcase/philz-video.mp4", poster: "/showcase/philz-video-poster.jpg", label: "Reel", brand: "Philz Coffee", aspect: "aspect-[9/16]", video: true },
  { src: "/showcase/boulders-banner.jpg", label: "Ad banner", brand: "Dogpatch Boulders", aspect: "aspect-video" },
  { src: "/showcase/tartine-post.jpg", label: "Instagram post", brand: "Tartine Bakery", aspect: "aspect-[3/4]" },
  { src: "/showcase/philz-menu.jpg", label: "Menu board", brand: "Philz Coffee", aspect: "aspect-[3/4]" },
];

export default function Studio() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [moments, setMoments] = useState<Moment[]>([]);
  const [example, setExample] = useState(params.get("url") ?? "");
  const [slide, setSlide] = useState(0);

  useEffect(() => { if (user) api.brands().then((r) => setBrands(r.brands)).catch(() => undefined); }, [user]);
  useEffect(() => { api.moments().then((r) => setMoments(r.moments.slice(0, 4))).catch(() => undefined); }, []);
  useEffect(() => {
    const t = window.setInterval(() => setSlide((s) => (s + 1) % PREVIEWS.length), 3200);
    return () => window.clearInterval(t);
  }, []);
  const preview = PREVIEWS[slide];

  return (
    <div className="min-h-screen">
      <Nav variant="app" />
      <div className="mx-auto max-w-[1320px] px-5 pt-5 sm:px-8"><Stepper current={0} /></div>
      <main className="mx-auto max-w-[1320px] px-5 pb-24 sm:px-8">
        <section className="grid items-center gap-12 py-10 lg:min-h-[calc(100vh-150px)] lg:grid-cols-[1.15fr_1fr] lg:py-6">
          <div>
            <Reveal>
              <p className="eyebrow">New campaign</p>
              <h1 className="display mt-5 text-[clamp(46px,6.2vw,88px)]">What are we<br />promoting today?</h1>
              <p className="mt-5 max-w-[540px] text-[18px] leading-relaxed text-ink/70">
                Drop your website, Google Maps listing or Instagram — or just a few photos. We'll learn your brand and pitch ideas made for this week.
              </p>
            </Reveal>
            <Reveal delay={0.08} className="mt-9 max-w-[620px]">
              <div className="rounded-[28px] border border-line bg-paper p-3 shadow-card sm:p-4">
                <LinkInput key={example} initialUrl={example} showNotes autoFocus />
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-[13px] text-muted">
                <span>Try:</span>
                {["philzcoffee.com", "tartinebakery.com", "boudinbakery.com"].map((u) => (
                  <button key={u} onClick={() => setExample(u)} className="chip transition hover:border-ink/30 hover:text-ink">{u}</button>
                ))}
                <span className="ml-1 hidden items-center gap-1 sm:flex"><MapPin size={13} /> Maps share links work too</span>
              </div>
            </Reveal>
            {moments.length > 0 && (
              <Reveal delay={0.16} className="mt-10 max-w-[620px]">
                <p className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wider text-muted"><CalendarDays size={14} /> This week's moments</p>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {moments.map((m) => (
                    <div key={m.name + m.date} className="rounded-2xl border border-line bg-paper/70 px-3.5 py-3">
                      <p className={cx("text-[11px] font-bold uppercase tracking-wide", m.days_until <= 10 ? "text-orange-deep" : "text-muted")}>{daysLabel(m.days_until)}</p>
                      <p className="mt-0.5 truncate text-[14px] font-semibold">{m.name}</p>
                    </div>
                  ))}
                </div>
              </Reveal>
            )}
          </div>

          <Reveal delay={0.1} className="relative hidden lg:block">
            <div className="relative mx-auto aspect-[4/5] max-w-[500px] overflow-hidden rounded-[36px] bg-night p-8 shadow-lift">
              <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-orange/30 blur-3xl" />
              <div className="absolute -bottom-24 -right-16 h-72 w-72 rounded-full bg-sage/25 blur-3xl" />
              <div className="relative flex h-full flex-col">
                <div className="flex items-center justify-between text-white">
                  <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-white/60">What you'll get</p>
                  <div className="flex gap-1">
                    {PREVIEWS.map((_, i) => <span key={i} className={cx("h-1 rounded-full transition-all duration-500", i === slide ? "w-6 bg-orange" : "w-2 bg-white/25")} />)}
                  </div>
                </div>
                <div className="relative flex flex-1 items-center justify-center py-6">
                  <AnimatePresence mode="wait">
                    <motion.div key={slide} initial={{ opacity: 0, y: 20, rotate: -2, scale: 0.96 }} animate={{ opacity: 1, y: 0, rotate: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -16, scale: 0.97 }} transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                      className={cx("overflow-hidden rounded-2xl shadow-[0_30px_60px_-20px_rgba(0,0,0,.7)]", preview.aspect,
                        preview.aspect === "aspect-video" ? "w-full" : preview.aspect === "aspect-[9/16]" ? "h-full max-h-[440px]" : "h-full max-h-[400px]")}>
                      <Media src={preview.src} kind={preview.video ? "video" : "image"} poster={preview.poster} />
                    </motion.div>
                  </AnimatePresence>
                </div>
                <div className="flex items-end justify-between text-white">
                  <div>
                    <p className="font-display text-[22px] font-bold tracking-tight">{preview.label}</p>
                    <p className="text-[13px] text-white/55">Concept for {preview.brand}</p>
                  </div>
                  <p className="text-right text-[11px] leading-tight text-white/45">Rendered with<br /><span className="font-semibold text-white/75">Higgsfield</span></p>
                </div>
              </div>
            </div>
          </Reveal>
        </section>

        {brands.length > 0 && (
          <section className="mt-6">
            <div className="flex items-end justify-between">
              <h2 className="font-display text-[28px] font-bold tracking-[-0.03em]">Pick up where you left off</h2>
              <Link to="/library" className="text-sm font-semibold link-underline">Library</Link>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {brands.map((b) => <BrandCard key={b.id} brand={b} />)}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function BrandCard({ brand }: { brand: Brand }) {
  const p = brand.profile;
  const photo = brandPhotos(brand, mediaUrl)[0];
  const swatch = p?.palette[0]?.hex ?? "#121110";
  return (
    <Link to={`/studio/brand/${brand.id}`} className="card group flex overflow-hidden transition hover:-translate-y-1 hover:shadow-lift">
      <div className="relative w-28 shrink-0 overflow-hidden" style={{ background: swatch }}>
        <span className="absolute inset-0 grid place-items-center font-display text-3xl font-black" style={{ color: readableOn(swatch) }}>{(p?.name ?? "?")[0]}</span>
        {photo && <img src={photo} alt="" className="relative h-full w-full object-cover transition duration-700 group-hover:scale-105" onError={(e) => ((e.target as HTMLElement).style.display = "none")} />}
      </div>
      <div className="min-w-0 flex-1 p-4">
        <p className="truncate font-display text-[19px] font-bold tracking-tight">{p?.name ?? brand.input.url ?? "Untitled"}</p>
        <p className="truncate text-[13px] text-muted">{p?.business_type ?? (brand.status === "working" ? "Analyzing…" : "")}{p?.location ? ` · ${p.location}` : ""}</p>
        {p && (
          <div className="mt-3 flex h-2 overflow-hidden rounded-full">
            {p.palette.map((s) => <span key={s.hex} className="flex-1" style={{ background: s.hex }} />)}
          </div>
        )}
        <p className="mt-3 flex items-center gap-1 text-[12.5px] font-semibold text-ink/70 group-hover:text-orange">
          {brand.ideas.length} ideas ready <ArrowUpRight size={13} />
        </p>
      </div>
    </Link>
  );
}
