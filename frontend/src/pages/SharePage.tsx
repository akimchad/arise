import { ArrowUpRight, Download } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Logo } from "../components/Brand";
import { Media } from "../components/Frames";
import { Spinner } from "../components/ui";
import { api, mediaUrl } from "../lib/api";
import type { ShareData } from "../lib/schemas";
import { aspectClass, cx } from "../lib/util";

export default function SharePage() {
  const { itemId = "" } = useParams();
  const [data, setData] = useState<ShareData | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => { api.share(itemId).then(setData).catch(() => setMissing(true)); }, [itemId]);
  const glow = data?.brand.palette[0]?.hex ?? "#FF5A1F";
  const glow2 = data?.brand.palette[1]?.hex ?? "#C9D3BC";

  return (
    <div className="min-h-screen bg-cream">
      <header className="mx-auto flex max-w-[1200px] items-center justify-between px-5 py-5 sm:px-8">
        <Logo />
        <Link to="/" className="btn-primary px-4 py-2.5 text-sm">Make yours <ArrowUpRight size={16} /></Link>
      </header>
      <main className="mx-auto max-w-[1200px] px-5 pb-20 sm:px-8">
        {missing ? (
          <p className="py-32 text-center text-muted">This creative isn't available anymore.</p>
        ) : !data ? (
          <div className="grid place-items-center py-40"><Spinner className="h-6 w-6" /></div>
        ) : (
          <div className="grid items-center gap-10 py-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="relative overflow-hidden rounded-[32px] bg-night px-6 py-10 sm:px-12 sm:py-14">
              <div className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full blur-3xl" style={{ background: glow, opacity: 0.3 }} />
              <div className="pointer-events-none absolute -bottom-28 -right-20 h-96 w-96 rounded-full blur-3xl" style={{ background: glow2, opacity: 0.2 }} />
              <div className={cx("relative mx-auto overflow-hidden rounded-2xl shadow-[0_40px_80px_-30px_rgba(0,0,0,.8)]", aspectClass(data.item.aspect),
                data.item.aspect === "9:16" ? "max-w-[320px]" : data.item.aspect === "16:9" ? "max-w-full" : "max-w-[460px]")}>
                <Media src={mediaUrl(data.item.url)} kind={data.item.kind} />
              </div>
            </div>
            <div>
              <p className="eyebrow">{data.brand.name} · {data.idea.moment}</p>
              <h1 className="display mt-4 text-[clamp(42px,5vw,72px)]">{data.idea.title}</h1>
              {data.caption && <p className="mt-5 text-[18px] leading-relaxed text-ink/75">{data.caption}</p>}
              <p className="mt-3 text-[14px] text-ink/50">{data.hashtags.map((h) => `#${h}`).join(" ")}</p>
              {data.brand.palette.length > 0 && (
                <div className="mt-6 flex h-2.5 max-w-[260px] overflow-hidden rounded-full">
                  {data.brand.palette.map((s) => <span key={s.hex} className="flex-1" style={{ background: s.hex }} />)}
                </div>
              )}
              {data.siblings.length > 1 && (
                <div className="mt-8">
                  <p className="kit-label">Also in this campaign</p>
                  <div className="mt-3 flex gap-3">
                    {data.siblings.filter((s) => s.id !== data.item.id).slice(0, 4).map((s) => (
                      <Link key={s.id} to={`/share/${s.id}`} className="h-24 w-20 overflow-hidden rounded-xl ring-1 ring-line transition hover:-translate-y-1">
                        <Media src={mediaUrl(s.url)} kind={s.kind} />
                      </Link>
                    ))}
                  </div>
                </div>
              )}
              <a href={`${mediaUrl(data.item.url)}?download=1`} className="btn-outline mt-8"><Download size={15} /> Download</a>
              <div className="mt-10 rounded-3xl bg-ink p-6 text-white">
                <p className="font-display text-2xl font-bold tracking-tight">Made with Arise in minutes.</p>
                <p className="mt-2 text-white/70">Paste your website or Google Maps link and get posts, stories and reels made for this week.</p>
                <Link to="/" className="btn-primary mt-5">Find my next idea <ArrowUpRight size={17} /></Link>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
