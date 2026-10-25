import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowDown, ArrowUpRight, Check, ChevronDown, Download, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { BuiltWith, InstagramGlyph, Logo } from "../components/Brand";
import { AdBanner, InstagramPost, Media, PrintFrame, StoryPhone, XPost } from "../components/Frames";
import { LinkInput } from "../components/LinkInput";
import { Nav } from "../components/Nav";
import { Reveal } from "../components/ui";
import { api } from "../lib/api";
import type { Moment } from "../lib/schemas";
import { cx, daysLabel, shortDate } from "../lib/util";

const S = (f: string) => `/showcase/${f}`;
const PHILZ = { name: "Philz Coffee", color: "#4B2D24" };

const FALLBACK_MOMENTS: Moment[] = [
  { name: "Halloween", date: "2026-10-31", kind: "holiday", fits: "all", note: "Spooky specials, costumes, playful seasonal treats.", days_until: 7 },
  { name: "Día de los Muertos", date: "2026-11-01", kind: "holiday", fits: "all", note: "Marigolds, remembrance, vibrant color.", days_until: 8 },
  { name: "Thanksgiving", date: "2026-11-26", kind: "holiday", fits: "all", note: "Gratitude, gatherings, pre-orders and pies.", days_until: 33 },
  { name: "Small Business Saturday", date: "2026-11-28", kind: "retail", fits: "all", note: "Shop local — the local business's day to shine.", days_until: 35 },
];

function useMoments() {
  const [moments, setMoments] = useState<Moment[]>(FALLBACK_MOMENTS);
  useEffect(() => { api.moments().then((r) => r.moments.length && setMoments(r.moments)).catch(() => undefined); }, []);
  return moments;
}

export default function Landing() {
  const moments = useMoments();
  return (
    <div className="overflow-x-clip">
      <Nav />
      <Hero moments={moments} />
      <BrandStrip />
      <StartingPoint />
      <Timely moments={moments} />
      <EveryFormat />
      <FinalSay />
      <Storefronts />
      <UnderTheHood />
      <FinalCTA />
    </div>
  );
}

function Doodle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 40" className={className} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
      <path d="M8 30 L18 6" /><path d="M24 34 L42 14" /><path d="M32 38 L54 30" />
    </svg>
  );
}

function Hero({ moments }: { moments: Moment[] }) {
  const [example, setExample] = useState("");
  const next = moments[0];
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const yLeft = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const yRight = useTransform(scrollYProgress, [0, 1], [0, -80]);

  return (
    <section ref={ref} className="relative mx-auto max-w-[1440px] px-5 pb-16 pt-10 sm:px-8 lg:min-h-[calc(100vh-68px)] lg:pb-24 lg:pt-16">
      {/* left: hero product */}
      <motion.div style={{ y: yLeft }} className="pointer-events-none absolute -left-10 top-24 hidden w-[300px] xl:block 2xl:-left-4 2xl:w-[360px]">
        <motion.div initial={{ opacity: 0, x: -40, rotate: -8 }} animate={{ opacity: 1, x: 0, rotate: -5 }} transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}>
          <div className="animate-float-slow">
            <img src={S("philz-hero.jpg")} alt="Philz Mint Mojito iced coffee concept" className="w-full mix-blend-multiply [mask-image:radial-gradient(ellipse_58%_62%_at_50%_48%,black_42%,transparent_82%)]" />
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }}
          className="absolute -right-6 bottom-10 rotate-[-6deg] rounded-xl bg-sage px-4 py-3 shadow-card">
          <p className="flex items-start gap-2 font-display text-[17px] font-semibold leading-tight">
            <span className="text-2xl leading-none text-orange">✳</span>
            <span>New concept:<br />Treats. No tricks.</span>
          </p>
        </motion.div>
        <Doodle className="absolute right-6 top-0 w-14 text-ink" />
      </motion.div>

      {/* right: creatives */}
      <motion.div style={{ y: yRight }} className="pointer-events-none absolute right-6 top-16 hidden w-[330px] xl:block 2xl:right-10 2xl:w-[360px]">
        <motion.div initial={{ opacity: 0, y: 40, rotate: 10 }} animate={{ opacity: 1, y: 0, rotate: 5 }} transition={{ duration: 1, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="ml-auto w-[220px] xl:w-[240px]">
          <StoryPhone name={PHILZ.name} color={PHILZ.color}>
            <Media src={S("philz-video.mp4")} kind="video" poster={S("philz-video-poster.jpg")} />
          </StoryPhone>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 40, rotate: -10 }} animate={{ opacity: 1, y: 0, rotate: -4 }} transition={{ duration: 1, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="-mt-28 w-[250px] xl:w-[270px]">
          <div className="overflow-hidden rounded-[18px] border-[6px] border-white shadow-lift">
            <img src={S("philz-halloween.jpg")} alt="Philz Halloween post concept" className="aspect-square w-full object-cover" />
          </div>
        </motion.div>
        {next && (
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1.1, type: "spring" }}
            className="absolute -bottom-4 right-6 grid h-[112px] w-[112px] place-items-center rounded-full bg-orange text-white shadow-glow">
            <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full animate-spinslow">
              <defs><path id="circ" d="M50,50 m-37,0 a37,37 0 1,1 74,0 a37,37 0 1,1 -74,0" /></defs>
              <text className="fill-white text-[10.5px] font-bold uppercase tracking-[0.2em]"><textPath href="#circ">{`${next.name} · ${daysLabel(next.days_until)} · `}</textPath></text>
            </svg>
            <span className="text-2xl">{next.name === "Halloween" ? "🎃" : "✳"}</span>
          </motion.div>
        )}
      </motion.div>

      <div className="relative z-10 mx-auto flex max-w-[780px] flex-col items-center text-center">
        {next && (
          <motion.a href="#timing" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="mb-7 inline-flex items-center gap-2 rounded-full border border-line bg-paper py-1.5 pl-1.5 pr-4 text-[13px] font-medium shadow-card transition hover:border-ink/30">
            <span className="rounded-full bg-orange px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white">{daysLabel(next.days_until)}</span>
            {next.name} is coming. Is your post ready?
          </motion.a>
        )}
        <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          className="display text-[clamp(52px,9.2vw,124px)]">
          Your business.<br />Everywhere.
        </motion.h1>
        <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.8 }}
          className="mt-6 max-w-[560px] text-[19px] leading-relaxed text-ink/75 sm:text-[21px]">
          Paste your website or Google Maps link. Arise finds your next big idea and makes the posts, stories and videos — in minutes.
        </motion.p>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28, duration: 0.8 }} className="mt-9 w-full max-w-[620px]">
          <LinkInput key={example} initialUrl={example} />
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-[13px] text-muted">
            <span>Try:</span>
            {["philzcoffee.com", "tartinebakery.com", "boudinbakery.com"].map((u) => (
              <button key={u} onClick={() => setExample(u)} className="chip transition hover:border-ink/30 hover:text-ink">{u}</button>
            ))}
          </div>
        </motion.div>
        <svg viewBox="0 0 120 70" className="mt-8 hidden w-24 text-ink/70 xl:ml-[420px] xl:block" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="M6 8 C 30 60, 70 62, 108 46" /><path d="M96 38 L 109 46 L 97 56" />
        </svg>
      </div>

      {/* mobile creatives */}
      <div className="no-scrollbar -mx-5 mt-12 flex snap-x justify-start gap-4 overflow-x-auto px-5 md:justify-center xl:hidden">
        <div className="w-[180px] shrink-0 snap-center"><StoryPhone name={PHILZ.name} color={PHILZ.color}><Media src={S("philz-video.mp4")} kind="video" poster={S("philz-video-poster.jpg")} /></StoryPhone></div>
        <img src={S("philz-halloween.jpg")} alt="" className="w-[260px] shrink-0 snap-center self-center rounded-2xl shadow-lift" />
        <img src={S("philz-post.jpg")} alt="" className="w-[220px] shrink-0 snap-center self-center rounded-2xl shadow-lift" />
      </div>
    </section>
  );
}

const STRIP = ["Philz Coffee", "Tartine Bakery", "Boudin Bakery", "Blue Bottle Coffee", "Bi-Rite Creamery", "Neighbor Bakehouse", "Dogpatch Boulders", "City Lights"];

function BrandStrip() {
  return (
    <section className="border-y border-line/80 bg-paper/60 py-5">
      <div className="relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_10%,black_90%,transparent)]">
        <div className="flex w-max animate-marquee items-center gap-10 pr-10">
          {[...STRIP, ...STRIP].map((n, i) => (
            <span key={i} className="flex items-center gap-10 whitespace-nowrap font-display text-[22px] font-bold tracking-[-0.03em] text-ink/70">
              {n}<span className="text-orange">✳</span>
            </span>
          ))}
        </div>
      </div>
      <p className="mt-3 text-center text-[11px] text-muted">Concepts Arise created for Bay Area favorites. Unofficial examples — not affiliated with or endorsed by these businesses.</p>
    </section>
  );
}

function ContextCard({ img, title, sub, body, className, delay }: { img: string; title: string; sub: string; body: string; className?: string; delay: number }) {
  return (
    <Reveal delay={delay} className={cx("absolute z-10 flex w-[280px] gap-3 rounded-2xl bg-paper p-3 shadow-lift xl:w-[310px]", className)}>
      <img src={img} alt="" className="h-[84px] w-[84px] shrink-0 rounded-xl object-cover xl:h-[96px] xl:w-[96px]" />
      <div className="min-w-0">
        <p className="font-display text-[19px] font-bold tracking-[-0.02em]">{title}</p>
        <p className="mt-0.5 text-[13px] font-medium text-ink/80">{sub}</p>
        <p className="mt-1.5 text-[12.5px] leading-snug text-muted">{body}</p>
      </div>
    </Reveal>
  );
}

function StartingPoint() {
  const [step, setStep] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let timer = 0;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !timer) timer = window.setInterval(() => setStep((s) => (s + 1) % 3), 1600);
    }, { threshold: 0.4 });
    io.observe(el);
    return () => { io.disconnect(); window.clearInterval(timer); };
  }, []);
  const steps = ["Website", "Brand context", "Creative direction"];

  return (
    <section id="how" className="mx-auto max-w-[1440px] scroll-mt-20 px-5 py-24 sm:px-8 lg:py-32">
      <div className="grid items-center gap-14 lg:grid-cols-[1.35fr_1fr]">
        <div ref={ref} className="relative overflow-hidden rounded-[32px] bg-sage px-5 pb-10 pt-8 sm:px-8 lg:h-[740px]">
          <p className="eyebrow text-ink/60">Example business</p>
          {/* browser mock */}
          <Reveal className="relative mx-auto mt-6 w-full max-w-[520px] lg:absolute lg:left-1/2 lg:top-[236px] lg:mt-0 lg:w-[64%] lg:-translate-x-1/2">
            <div className="overflow-hidden rounded-2xl bg-paper shadow-lift">
              <div className="flex items-center gap-1.5 border-b border-line px-3 py-2">
                <span className="h-2.5 w-2.5 rounded-full bg-ink/15" /><span className="h-2.5 w-2.5 rounded-full bg-ink/15" /><span className="h-2.5 w-2.5 rounded-full bg-ink/15" />
                <span className="ml-3 truncate rounded-md bg-ink/5 px-3 py-0.5 text-[11px] text-muted">philzcoffee.com</span>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-ink/70">
                <span className="font-display text-[15px] normal-case tracking-tight text-[#4B2D24]">Philz Coffee</span>
                <span className="hidden gap-4 sm:flex"><span>Shop</span><span>Locations</span><span>Rewards</span></span>
                <span className="rounded-full border border-ink/30 px-2.5 py-1">Order</span>
              </div>
              <div className="relative aspect-[16/9]">
                <img src={S("philz-interior.jpg")} alt="" className="absolute inset-0 h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-br from-black/60 via-black/10 to-transparent" />
                <div className="absolute left-6 top-6 text-white">
                  <p className="font-display text-[28px] font-bold leading-[1] tracking-[-0.03em] sm:text-[34px]">One cup<br />at a time.</p>
                  <span className="mt-3 inline-block rounded-full border border-white/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider">Find your blend</span>
                </div>
              </div>
            </div>
          </Reveal>
          <ContextCard delay={0.1} img={S("philz-hero.jpg")} title="Your brand" sub="Philz Coffee · Coffee shop"
            body="Custom-blended coffee made one cup at a time, a cult-favorite Mint Mojito and a laid-back, come-as-you-are vibe."
            className="hidden lg:flex lg:left-5 lg:top-[58px]" />
          <ContextCard delay={0.25} img={S("birite-story.jpg")} title="Your neighborhood" sub="San Francisco, CA"
            body="A creative, caffeine-fueled city that lines up for good coffee, Dolores Park afternoons and local favorites."
            className="hidden lg:flex lg:right-5 lg:top-[58px]" />
          <ContextCard delay={0.4} img={S("philz-post.jpg")} title="Your audience" sub="Regulars who order by heart."
            body="Students, creatives and commuters who value a personal pour, a friendly barista and a sweet, minty treat."
            className="hidden lg:flex lg:bottom-[92px] lg:left-8" />
          {/* mobile cards */}
          <div className="mt-6 grid gap-3 lg:hidden">
            {[
              ["Your brand", "Philz Coffee · Coffee shop"],
              ["Your neighborhood", "San Francisco, CA"],
              ["Your audience", "Regulars who order by heart"],
            ].map(([t, s]) => (
              <div key={t} className="rounded-2xl bg-paper px-4 py-3 shadow-card"><p className="font-display font-bold">{t}</p><p className="text-sm text-muted">{s}</p></div>
            ))}
          </div>
          <div className="absolute inset-x-0 bottom-7 hidden items-center justify-center gap-5 lg:flex">
            {steps.map((s, i) => (
              <div key={s} className="flex items-center gap-5">
                <div className="flex flex-col items-center gap-2">
                  <span className={cx("h-5 w-5 rounded-full border-2 border-forest transition-all duration-500", i <= step ? "bg-forest" : "bg-transparent")} />
                  <span className={cx("text-[13px] transition", i === step ? "font-semibold text-ink" : "text-ink/60")}>{s}</span>
                </div>
                {i < steps.length - 1 && <ArrowUpRight size={16} className="mb-6 rotate-45 text-ink/50" />}
              </div>
            ))}
          </div>
        </div>
        <Reveal>
          <p className="eyebrow">01 / The starting point</p>
          <h2 className="display mt-6 text-[clamp(52px,6.6vw,104px)]">A link is all it takes.</h2>
          <p className="mt-7 max-w-[460px] text-[21px] leading-relaxed text-ink/75">
            Arise gets to know your business, your audience, and what makes you different — from your website, your Maps listing or a few photos.
          </p>
          <a href="#timing" className="mt-9 inline-flex items-center gap-2 border-b-2 border-ink pb-1 font-display text-[22px] font-semibold tracking-tight transition hover:gap-3 hover:border-orange">
            See how it works <ArrowUpRight size={22} />
          </a>
        </Reveal>
      </div>
    </section>
  );
}

const IDEAS = [
  { brand: "Philz Coffee", img: "philz-halloween.jpg", moment: "Halloween", title: "Treats. No tricks.", hook: "A playful Halloween nudge for the Mint Mojito crowd — cozy, festive, unmistakably Philz.", why: "Halloween is a week out and cozy fall drinks are in peak season." },
  { brand: "Boudin Bakery", img: "boudin-halloween.jpg", moment: "Cozy season", title: "Bread bowl season.", hook: "A pumpkin-shaped sourdough next to a steaming chowder bowl. Comfort, since 1849.", why: "First cold evenings + daylight saving ending = comfort-food cravings." },
  { brand: "Tartine Bakery", img: "tartine-post.jpg", moment: "Small Business Saturday", title: "Worth the line.", hook: "Celebrate the regulars who queue for morning buns — and invite new ones.", why: "Shop-local weekend is the bakery's moment to shine." },
];

function Timely({ moments }: { moments: Moment[] }) {
  const momentFor = (name: string) => moments.find((m) => m.name === name);
  return (
    <section id="timing" className="scroll-mt-20 bg-paper/70 py-24 lg:py-32">
      <div className="mx-auto max-w-[1320px] px-5 sm:px-8">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-end">
          <Reveal>
            <p className="eyebrow">02 / Perfect timing</p>
            <h2 className="display mt-6 text-[clamp(46px,6vw,92px)]">Ideas that know what week it is.</h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="max-w-[520px] text-[20px] leading-relaxed text-ink/75 lg:ml-auto">
              Arise reads the calendar and the season, matches them to what you sell — then pitches campaigns only your business could post.
            </p>
          </Reveal>
        </div>

        <div className="mt-16 grid gap-6 lg:grid-cols-[340px_1fr]">
          <Reveal className="card p-6">
            <div className="flex items-center justify-between">
              <p className="font-display text-xl font-bold tracking-tight">Coming up</p>
              <span className="chip"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-orange" /> Live calendar</span>
            </div>
            <ul className="mt-5 divide-y divide-line">
              {moments.slice(0, 6).map((m) => (
                <li key={m.name + m.date} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{m.name}</p>
                    <p className="truncate text-[13px] text-muted">{m.note}</p>
                  </div>
                  <span className={cx("shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide",
                    m.days_until <= 10 ? "bg-orange text-white" : "bg-ink/5 text-ink/70")}>
                    {m.days_until <= 14 ? daysLabel(m.days_until) : shortDate(m.date)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-4 flex items-center gap-2 text-[13px] text-muted"><Sparkles size={14} className="text-orange" /> Plus a seasonal playbook of formats that perform</p>
          </Reveal>
          <div className="grid gap-5 md:grid-cols-3">
            {IDEAS.map((idea, i) => {
              const m = momentFor(idea.moment);
              return (
                <Reveal key={idea.title} delay={0.1 * i} className="group card overflow-hidden transition duration-300 hover:-translate-y-1.5 hover:shadow-lift">
                  <div className="relative aspect-[4/5] overflow-hidden">
                    <img src={S(idea.img)} alt={`${idea.brand} concept`} className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]" />
                    <span className="absolute left-3 top-3 rounded-full bg-paper/95 px-3 py-1 text-[11px] font-bold uppercase tracking-wide shadow-card">
                      {idea.moment}{m ? ` · ${daysLabel(m.days_until)}` : ""}
                    </span>
                  </div>
                  <div className="p-5">
                    <p className="text-[12px] font-semibold uppercase tracking-wider text-muted">{idea.brand}</p>
                    <p className="mt-1 font-display text-[24px] font-bold leading-tight tracking-[-0.03em]">{idea.title}</p>
                    <p className="mt-2 text-[14px] leading-snug text-ink/70">{idea.hook}</p>
                    <p className="mt-4 border-t border-line pt-3 text-[12.5px] text-muted"><span className="font-semibold text-ink">Why now:</span> {idea.why}</p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function EveryFormat() {
  const caption = "The Mint Mojito: fresh mint, sweet cream, made just for you. 🌿";
  const frames = [
    { label: "Instagram post", el: <InstagramPost name={PHILZ.name} color={PHILZ.color} caption={caption}><Media src={S("philz-post.jpg")} /></InstagramPost>, w: "w-[290px]" },
    { label: "Story · Reel", el: <StoryPhone name={PHILZ.name} color={PHILZ.color}><Media src={S("philz-video.mp4")} kind="video" poster={S("philz-video-poster.jpg")} /></StoryPhone>, w: "w-[230px]" },
    { label: "X post", el: <XPost name={PHILZ.name} color={PHILZ.color} text="Treats. No tricks. 🎃 Swing by for a Mint Mojito this Halloween." aspect="1:1"><Media src={S("philz-halloween.jpg")} /></XPost>, w: "w-[330px]" },
    { label: "Menu board", el: <PrintFrame aspect="3:4"><Media src={S("philz-menu.jpg")} /></PrintFrame>, w: "w-[250px]" },
    { label: "Meta ad", el: <AdBanner name={PHILZ.name} cta="Order now"><Media src={S("philz-interior.jpg")} /></AdBanner>, w: "w-[380px]" },
  ];
  return (
    <section id="formats" className="relative scroll-mt-16 bg-night py-24 text-white lg:py-32">
      <div className="mx-auto max-w-[1440px] px-5 sm:px-8">
        <div className="flex items-center gap-4">
          <p className="eyebrow shrink-0 text-sage">Example outputs</p>
          <span className="h-px flex-1 bg-white/15" />
        </div>
        <div className="mt-10 grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-end">
          <Reveal>
            <h2 className="display text-[clamp(52px,7.4vw,118px)]">One idea.<br /><span className="text-orange">Every format.</span></h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="max-w-[420px] text-[20px] leading-relaxed text-white/75 lg:ml-auto">
              Make it a post, a story, a video, a menu board — or a whole new direction. Same brand, every channel.
            </p>
          </Reveal>
        </div>
      </div>
      <div className="no-scrollbar mt-16 overflow-x-auto pb-6">
        <div className="mx-auto flex w-max items-end gap-6 px-5 sm:px-8 xl:px-[max(2rem,calc((100vw-1440px)/2+2rem))]">
          {frames.map((f, i) => (
            <Reveal key={f.label} delay={0.08 * i} className={cx("shrink-0", f.w)}>
              <div className="transition duration-500 hover:-translate-y-2">{f.el}</div>
              <p className="mt-4 text-[15px] text-white/80">{f.label}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalSay() {
  const [tone, setTone] = useState("Playful");
  const [color, setColor] = useState(2);
  const [fmt, setFmt] = useState(0);
  const colors = ["#4B2D24", "#9FC089", "#FF5A1F"];
  const outputs = [
    { label: "Post · 3:4", sub: "Perfect for Instagram and LinkedIn.", img: "philz-post.jpg" },
    { label: "Story · 9:16", sub: "Tall and immersive for Stories.", img: "philz-story.jpg" },
    { label: "Video · Reel", sub: "Made for ads and social video.", img: "philz-video-poster.jpg", video: true },
  ];
  return (
    <section className="mx-auto max-w-[1440px] px-5 py-24 sm:px-8 lg:py-32">
      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-end">
        <Reveal><p className="eyebrow">03 / You're in control</p><h2 className="display mt-6 text-[clamp(52px,7.4vw,118px)]">Your taste.<br />The final say.</h2></Reveal>
        <Reveal delay={0.1}><p className="max-w-[440px] text-[22px] leading-snug text-ink/80 lg:ml-auto">Pick a direction. Make it yours.<br />Download something worth sharing.</p></Reveal>
      </div>
      <div className="mt-16 grid gap-10 lg:grid-cols-3 lg:gap-0 lg:divide-x lg:divide-line">
        <Reveal className="lg:pr-10">
          <p className="display text-[64px] text-[#9fa98f]">01</p>
          <p className="font-display text-[34px] font-semibold tracking-[-0.03em]">Choose a concept</p>
          <div className="relative mt-6 overflow-hidden rounded-2xl shadow-card">
            <img src={S("philz-halloween.jpg")} alt="" className="aspect-[4/5] w-full object-cover" />
            <span className="absolute right-3 top-3 grid h-11 w-11 place-items-center rounded-lg bg-orange text-white shadow-glow"><Check size={24} strokeWidth={3} /></span>
          </div>
        </Reveal>
        <Reveal delay={0.1} className="lg:px-10">
          <p className="display text-[64px] text-[#9fa98f]">02</p>
          <p className="font-display text-[34px] font-semibold tracking-[-0.03em]">Make it yours</p>
          <div className="card mt-6 grid grid-cols-[1fr_1.15fr] gap-4 p-4">
            <div className="space-y-4 text-[13px]">
              <label className="block">
                <span className="font-semibold">Tone</span>
                <span className="relative mt-1.5 block">
                  <select value={tone} onChange={(e) => setTone(e.target.value)} className="input appearance-none py-2.5 pr-8 text-[14px]">
                    {["Playful", "Bold", "Elegant", "Cozy", "Minimal"].map((t) => <option key={t}>{t}</option>)}
                  </select>
                  <ChevronDown size={16} className="pointer-events-none absolute right-3 top-3 text-ink/60" />
                </span>
              </label>
              <label className="block">
                <span className="font-semibold">Headline</span>
                <textarea defaultValue="One cup at a time." rows={2} className="input mt-1.5 resize-none py-2.5 text-[14px]" />
              </label>
              <div>
                <span className="font-semibold">Colors</span>
                <div className="mt-2 flex gap-2">
                  {colors.map((c, i) => (
                    <button key={c} onClick={() => setColor(i)} aria-label={`Color ${c}`}
                      className={cx("h-9 w-9 rounded-full transition", i === color ? "ring-2 ring-orange ring-offset-2" : "hover:scale-110")} style={{ background: c }} />
                  ))}
                </div>
              </div>
            </div>
            <div className="overflow-hidden rounded-xl"><img src={S("philz-post.jpg")} alt="" className="h-full w-full object-cover" /></div>
          </div>
        </Reveal>
        <Reveal delay={0.2} className="lg:pl-10">
          <p className="display text-[64px] text-[#9fa98f]">03</p>
          <p className="font-display text-[34px] font-semibold tracking-[-0.03em]">Ready to share</p>
          <div className="card mt-6 p-5">
            <p className="font-display text-xl font-semibold tracking-tight">Download creative</p>
            <div className="mt-3 divide-y divide-line">
              {outputs.map((o, i) => (
                <button key={o.label} onClick={() => setFmt(i)} className="flex w-full items-center gap-4 py-3 text-left">
                  <span className={cx("grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition", i === fmt ? "border-orange" : "border-ink/25")}>
                    {i === fmt && <span className="h-3 w-3 rounded-full bg-orange" />}
                  </span>
                  <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg">
                    <img src={S(o.img)} alt="" className="h-full w-full object-cover" />
                    {o.video && <span className="absolute inset-0 grid place-items-center bg-black/25 text-white">▶</span>}
                  </span>
                  <span><span className="block font-semibold">{o.label}</span><span className="text-[13px] text-muted">{o.sub}</span></span>
                </button>
              ))}
            </div>
            <a href="/studio" className="btn-primary mt-3 w-full py-3.5 text-[16px]">Download <Download size={17} /></a>
            <div className="mt-4 flex items-center justify-center gap-4 text-[12px] text-muted">
              <span>Share to</span>
              <InstagramGlyph size={17} className="text-ink" />
              <span className="font-bold text-ink">𝕏</span>
              <span className="font-bold text-ink">TikTok</span>
              <span className="font-bold text-ink">Meta Ads</span>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

const GALLERY = [
  { brand: "Tartine Bakery", type: "Bakery · Mission", img: "tartine-post.jpg", fmt: "Instagram post" },
  { brand: "Boudin Bakery", type: "Sourdough · Fisherman's Wharf", img: "boudin-halloween.jpg", video: "boudin-video.mp4", fmt: "Reel" },
  { brand: "Blue Bottle Coffee", type: "Coffee · Oakland", img: "bluebottle-story.jpg", fmt: "Story" },
  { brand: "Dogpatch Boulders", type: "Climbing gym · Dogpatch", img: "boulders-banner.jpg", fmt: "Ad banner" },
  { brand: "Neighbor Bakehouse", type: "Bakery · Dogpatch", img: "neighbor-post.jpg", fmt: "Instagram post" },
  { brand: "Bi-Rite Creamery", type: "Ice cream · Mission", img: "birite-story.jpg", fmt: "Story" },
  { brand: "City Lights", type: "Bookstore · North Beach", img: "citylights-post.jpg", fmt: "Instagram post" },
  { brand: "Philz Coffee", type: "Coffee · Mission", img: "philz-menu.jpg", fmt: "Menu board" },
];

function Storefronts() {
  return (
    <section id="examples" className="scroll-mt-16 bg-forest py-24 text-white lg:py-32">
      <div className="mx-auto max-w-[1440px] px-5 sm:px-8">
        <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-end">
          <Reveal>
            <p className="eyebrow text-sage">Bakeries, bookshops, climbing gyms…</p>
            <h2 className="display mt-6 text-[clamp(50px,7vw,110px)]">Made for every<br />storefront.</h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="max-w-[440px] text-[20px] leading-relaxed text-white/75 lg:ml-auto">
              From Dogpatch to North Beach — if it has a door and regulars, Arise can make it shine online.
            </p>
          </Reveal>
        </div>
        <div className="mt-16 columns-1 gap-5 sm:columns-2 lg:columns-4 [&>*]:mb-5">
          {GALLERY.map((g, i) => (
            <Reveal key={g.brand + g.fmt} delay={(i % 4) * 0.08} className="group relative break-inside-avoid overflow-hidden rounded-[22px] bg-black/20">
              {g.video
                ? <video src={S(g.video)} poster={S(g.img)} autoPlay muted loop playsInline className="w-full" />
                : <img src={S(g.img)} alt={`${g.brand} concept`} loading="lazy" className="w-full transition duration-700 group-hover:scale-[1.03]" />}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-2 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-4 pt-14 opacity-0 transition duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                <p className="font-display text-[19px] font-bold">{g.brand}</p>
                <p className="text-[13px] text-white/75">{g.type} · {g.fmt}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <p className="mt-6 text-center text-[12px] text-white/50">Unofficial concept examples generated with Arise. Not affiliated with or endorsed by these businesses.</p>
      </div>
    </section>
  );
}

function UnderTheHood() {
  const cards = [
    { k: "Reads your brand", who: "Arise", body: "Reads your site, Maps listing and photos — name, signature items, neighborhood and a palette pulled from your own photos — then matches you with this week's moments.", n: "~5s", nl: "link to ideas" },
    { k: "Renders & animates", who: "Higgsfield", body: "GPT Image 2.5 Sunburst renders each brief into a finished, typography-perfect creative, and Wan 3.0 animates your story into a reel.", n: "6", nl: "formats per idea" },
    { k: "Runs the business", who: "Emergent", body: "Accounts, database, fair-use limits and hosting run on Emergent — so a shop owner just signs up and goes.", n: "0", nl: "design skills needed" },
  ];
  return (
    <section className="mx-auto max-w-[1320px] px-5 py-24 sm:px-8 lg:py-28">
      <Reveal className="text-center">
        <p className="eyebrow">Under the hood</p>
        <h2 className="display mx-auto mt-5 max-w-[900px] text-[clamp(40px,5vw,72px)]">A creative team in a link.</h2>
      </Reveal>
      <div className="mt-14 grid gap-5 md:grid-cols-3">
        {cards.map((c, i) => (
          <Reveal key={c.who} delay={0.08 * i} className="card flex flex-col p-7">
            <p className="text-[13px] font-semibold uppercase tracking-wider text-orange">{c.who}</p>
            <p className="mt-2 font-display text-[28px] font-bold leading-tight tracking-[-0.03em]">{c.k}</p>
            <p className="mt-3 flex-1 text-[15px] leading-relaxed text-ink/70">{c.body}</p>
            <div className="mt-7 flex items-baseline gap-2 border-t border-line pt-5">
              <span className="display text-[44px]">{c.n}</span><span className="text-sm text-muted">{c.nl}</span>
            </div>
          </Reveal>
        ))}
      </div>
      <Reveal className="mt-10 flex justify-center"><BuiltWith /></Reveal>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="relative overflow-hidden bg-orange">
      <div className="mx-auto grid max-w-[1440px] gap-10 px-5 pb-10 pt-20 sm:px-8 lg:grid-cols-[1.2fr_1fr] lg:pt-28">
        <div className="relative z-10">
          <Reveal><h2 className="display text-[clamp(52px,7.2vw,112px)] text-ink">Your next big idea starts here.</h2></Reveal>
          <Reveal delay={0.1}><p className="mt-6 text-[22px] text-ink/85 sm:text-[26px]">Bring your business. We'll bring the possibilities.</p></Reveal>
          <Reveal delay={0.2} className="mt-10 max-w-[640px]"><LinkInput tone="orange" cta="Create with Arise" /></Reveal>
        </div>
        <div className="relative hidden lg:block">
          <motion.img initial={{ rotate: 8, y: 60, opacity: 0 }} whileInView={{ rotate: 5, y: 0, opacity: 1 }} viewport={{ once: true }} transition={{ duration: 1 }}
            src={S("philz-hero.jpg")} alt="" className="absolute -right-10 top-0 w-[440px] rounded-[28px] shadow-lift" />
          <motion.img initial={{ rotate: -10, y: 80, opacity: 0 }} whileInView={{ rotate: -6, y: 0, opacity: 1 }} viewport={{ once: true }} transition={{ duration: 1, delay: 0.15 }}
            src={S("tartine-post.jpg")} alt="" className="absolute left-0 top-40 w-[240px] rounded-[20px] border-[6px] border-cream shadow-lift" />
        </div>
      </div>
      <footer className="relative z-10 mx-auto max-w-[1440px] px-5 pb-10 sm:px-8 lg:mt-24">
        <div className="flex flex-col gap-6 border-t border-ink/80 pt-8 md:flex-row md:items-center md:justify-between">
          <Logo mono />
          <p className="text-[15px] text-ink">Made for businesses with something to share.</p>
          <div className="flex items-center gap-6 text-[15px] text-ink">
            <a href="#how" className="hover:underline">How it works</a>
            <a href="/studio" className="hover:underline">Studio</a>
            <a href="mailto:hello@arise.app" className="hover:underline">Contact</a>
          </div>
        </div>
        <div className="mt-6 flex flex-col items-start justify-between gap-2 md:flex-row md:items-center">
          <BuiltWith className="!text-ink/70 [&_span]:!text-ink" />
          <a href="#top" className="inline-flex items-center gap-1 text-[13px] text-ink/70 hover:text-ink" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
            Back to top <ArrowDown size={14} className="rotate-180" />
          </a>
        </div>
      </footer>
    </section>
  );
}
