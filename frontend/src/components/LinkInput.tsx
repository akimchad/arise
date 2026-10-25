import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, ImagePlus, Link2, Plus, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError, mediaUrl } from "../lib/api";
import { cx } from "../lib/util";
import { Spinner } from "./ui";

const PLACEHOLDERS = ["Paste your website link", "…or a Google Maps link", "…or your Instagram profile"];

type Upload = { id: string; url: string; name: string };

export function LinkInput({ tone = "light", initialUrl = "", showNotes = false, autoFocus = false, cta = "Find my next idea" }: {
  tone?: "light" | "orange"; initialUrl?: string; showNotes?: boolean; autoFocus?: boolean; cta?: string;
}) {
  const [url, setUrl] = useState(initialUrl);
  const [notes, setNotes] = useState("");
  const [notesOpen, setNotesOpen] = useState(false);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ph, setPh] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const id = window.setInterval(() => setPh((p) => (p + 1) % PLACEHOLDERS.length), 2600);
    return () => window.clearInterval(id);
  }, []);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setError("");
    setUploading(true);
    try {
      const picked = Array.from(files).slice(0, 6 - uploads.length);
      const done = await Promise.all(picked.map(async (f) => ({ ...(await api.upload(f)), name: f.name })));
      setUploads((u) => [...u, ...done]);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!url.trim() && !uploads.length && !notes.trim()) {
      setError("Paste a link or add a few photos to get started.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const brand = await api.analyze(url.trim(), notes.trim(), uploads.map((u) => u.id));
      navigate(`/studio/brand/${brand.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong.");
      setBusy(false);
    }
  }

  const orange = tone === "orange";
  return (
    <form onSubmit={submit} className="w-full">
      <div className={cx("flex flex-col gap-2 rounded-[22px] p-2 transition sm:flex-row sm:items-center",
        orange ? "bg-cream shadow-lift" : "border border-line bg-white shadow-card focus-within:border-ink/30 focus-within:shadow-lift")}>
        <label className="flex min-w-0 flex-1 items-center gap-3 pl-3">
          <Link2 size={20} className="shrink-0 text-ink/50" />
          <span className="relative min-w-0 flex-1">
            <input value={url} onChange={(e) => setUrl(e.target.value)} autoFocus={autoFocus} inputMode="url"
              aria-label="Your website, Google Maps or Instagram link"
              className="w-full bg-transparent py-3 text-[16px] outline-none placeholder:text-transparent" placeholder="link" />
            {!url && (
              <AnimatePresence mode="wait">
                <motion.span key={ph} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                  className="pointer-events-none absolute inset-y-0 left-0 flex items-center text-[16px] text-ink/40">
                  {PLACEHOLDERS[ph]}
                </motion.span>
              </AnimatePresence>
            )}
          </span>
        </label>
        <button type="submit" disabled={busy || uploading}
          className={cx("btn shrink-0 px-6 py-3.5 text-[15px]", orange ? "bg-ink text-white hover:bg-black" : "bg-orange text-white shadow-glow hover:bg-orange-deep")}>
          {busy ? <><Spinner /> Reading your brand…</> : <>{cta} <ArrowUpRight size={18} /></>}
        </button>
      </div>

      {showNotes ? (
        <div className="mt-3 space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            {uploads.map((u) => (
              <span key={u.id} className="group relative h-14 w-14 overflow-hidden rounded-xl ring-1 ring-line">
                <img src={mediaUrl(u.url)} alt={u.name} className="h-full w-full object-cover" />
                <button type="button" onClick={() => setUploads((x) => x.filter((y) => y.id !== u.id))}
                  className="absolute inset-0 grid place-items-center bg-ink/50 text-white opacity-0 transition group-hover:opacity-100" aria-label="Remove photo">
                  <X size={16} />
                </button>
              </span>
            ))}
            <button type="button" onClick={() => fileRef.current?.click()}
              className="inline-flex h-14 items-center gap-2 rounded-xl border border-dashed border-ink/25 px-4 text-[13.5px] font-medium text-ink/70 transition hover:border-ink/50 hover:bg-white hover:text-ink">
              {uploading ? <Spinner className="h-3.5 w-3.5" /> : <ImagePlus size={17} />}
              {uploads.length ? "Add more" : "Add product or storefront photos"}
            </button>
            {!notesOpen && (
              <button type="button" onClick={() => setNotesOpen(true)}
                className="inline-flex h-14 items-center gap-2 rounded-xl border border-dashed border-ink/25 px-4 text-[13.5px] font-medium text-ink/70 transition hover:border-ink/50 hover:bg-white hover:text-ink">
                <Plus size={16} /> Add context
              </button>
            )}
          </div>
          <AnimatePresence>
            {notesOpen && (
              <motion.textarea initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={1500} autoFocus
                placeholder="Anything we should know? e.g. “We just launched a hojicha latte” or “Promote our Saturday brunch”"
                className="input resize-none" />
            )}
          </AnimatePresence>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          {uploads.map((u) => (
            <span key={u.id} className="group relative h-12 w-12 overflow-hidden rounded-xl ring-1 ring-line">
              <img src={mediaUrl(u.url)} alt={u.name} className="h-full w-full object-cover" />
              <button type="button" onClick={() => setUploads((x) => x.filter((y) => y.id !== u.id))}
                className="absolute inset-0 grid place-items-center bg-ink/50 text-white opacity-0 transition group-hover:opacity-100" aria-label="Remove photo">
                <X size={16} />
              </button>
            </span>
          ))}
          <button type="button" onClick={() => fileRef.current?.click()}
            className={cx("inline-flex items-center gap-1.5 text-[14px] underline-offset-[5px] hover:underline", orange ? "text-ink" : "text-ink/70")}>
            {uploading ? <Spinner className="h-3.5 w-3.5" /> : <ImagePlus size={15} />}
            {uploads.length ? "Add more photos" : "or upload product photos"}
          </button>
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => onFiles(e.target.files)} />
      <AnimatePresence>
        {error && (
          <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className={cx("mt-3 text-center text-sm font-medium", orange ? "text-ink" : "text-orange-deep")}>{error}</motion.p>
        )}
      </AnimatePresence>
    </form>
  );
}
