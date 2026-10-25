import { ArrowUpRight, Film, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Media } from "../components/Frames";
import { Nav } from "../components/Nav";
import { Reveal, Spinner } from "../components/ui";
import { api, mediaUrl } from "../lib/api";
import type { Generation } from "../lib/schemas";
import { aspectClass, cx } from "../lib/util";

export default function Library() {
  const [gens, setGens] = useState<Generation[] | null>(null);
  const [brand, setBrand] = useState<string>("all");
  useEffect(() => { api.generations().then((r) => setGens(r.generations)).catch(() => setGens([])); }, []);

  const brands = useMemo(() => Array.from(new Set((gens ?? []).map((g) => g.brand_name ?? "Untitled"))), [gens]);
  const shown = (gens ?? []).filter((g) => brand === "all" || (g.brand_name ?? "Untitled") === brand);
  const creatives = (gens ?? []).reduce((n, g) => n + g.items.filter((i) => i.url).length, 0);

  return (
    <div className="min-h-screen">
      <Nav variant="app" />
      <main className="mx-auto max-w-[1320px] px-5 pb-24 pt-12 sm:px-8">
        <Reveal className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="eyebrow">Library</p>
            <h1 className="display mt-4 text-[clamp(44px,6vw,84px)]">Everything you've made.</h1>
            {gens && gens.length > 0 && (
              <p className="mt-3 text-[15px] text-muted">{creatives} creatives · {gens.length} campaigns · {brands.length} brand{brands.length === 1 ? "" : "s"}</p>
            )}
          </div>
          <Link to="/studio" className="btn-primary"><Plus size={17} /> New campaign</Link>
        </Reveal>

        {gens && brands.length > 1 && (
          <div className="no-scrollbar mt-8 flex gap-2 overflow-x-auto">
            {["all", ...brands].map((b) => (
              <button key={b} onClick={() => setBrand(b)}
                className={cx("shrink-0 rounded-full border px-4 py-2 text-[13.5px] font-medium transition",
                  brand === b ? "border-ink bg-ink text-white" : "border-line bg-paper hover:border-ink/30")}>
                {b === "all" ? "All brands" : b}
              </button>
            ))}
          </div>
        )}

        {gens === null ? (
          <div className="grid place-items-center py-32"><Spinner className="h-6 w-6" /></div>
        ) : gens.length === 0 ? (
          <div className="card mt-12 flex flex-col items-center px-6 py-20 text-center">
            <div className="flex -space-x-6">
              {["philz-post.jpg", "tartine-post.jpg", "bluebottle-story.jpg"].map((f, i) => (
                <img key={f} src={`/showcase/${f}`} alt="" className="h-28 w-20 rounded-xl border-4 border-paper object-cover shadow-card" style={{ transform: `rotate(${(i - 1) * 7}deg)` }} />
              ))}
            </div>
            <p className="mt-8 font-display text-3xl font-bold tracking-tight">Nothing here yet.</p>
            <p className="mt-2 text-muted">Paste a link and we'll have your first post ready in minutes.</p>
            <Link to="/studio" className="btn-primary mt-6">Find my next idea <ArrowUpRight size={17} /></Link>
          </div>
        ) : (
          <div className="mt-8 columns-1 gap-5 sm:columns-2 lg:columns-3 xl:columns-4 [&>*]:mb-5">
            {shown.map((g, i) => {
              const media = g.items.filter((it) => it.url);
              const cover = media.find((it) => it.kind === "image") ?? media[0];
              const hasVideo = media.some((it) => it.kind === "video");
              return (
                <Reveal key={g.id} delay={(i % 4) * 0.05} className="break-inside-avoid">
                  <Link to={`/studio/g/${g.id}`} className="card group block overflow-hidden transition hover:-translate-y-1 hover:shadow-lift">
                    <div className={cx("relative overflow-hidden", aspectClass(cover?.aspect ?? "4:5"))}>
                      {cover?.url ? <Media src={mediaUrl(cover.url)} kind={cover.kind} className="transition duration-700 group-hover:scale-[1.03]" /> : <div className="shimmer h-full w-full" />}
                      <div className="absolute left-3 top-3 flex gap-1.5">
                        <span className="rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">{media.length} creative{media.length === 1 ? "" : "s"}</span>
                        {hasVideo && <span className="flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur"><Film size={11} /> Reel</span>}
                      </div>
                      {media.length > 1 && (
                        <div className="absolute bottom-3 right-3 flex -space-x-3">
                          {media.filter((m) => m !== cover).slice(0, 3).map((m) => (
                            <span key={m.id} className="h-11 w-9 overflow-hidden rounded-md border-2 border-white shadow-card">
                              <Media src={mediaUrl(m.url)} kind={m.kind} />
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <p className="text-[12px] font-semibold uppercase tracking-wider text-muted">{g.brand_name} · {g.idea.moment.split("·")[0].trim()}</p>
                      <p className="mt-1 font-display text-[19px] font-bold leading-tight tracking-tight">{g.idea.title}</p>
                      <p className="mt-2 text-[12px] text-muted">{new Date(g.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</p>
                    </div>
                  </Link>
                </Reveal>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
