import { AnimatePresence, motion, type HTMLMotionProps } from "framer-motion";
import { X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { cx } from "../lib/util";

export function Reveal({ children, delay = 0, y = 24, className, ...rest }: HTMLMotionProps<"div"> & { delay?: number; y?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export function Modal({ open, onClose, children, className, wide = false }: {
  open: boolean; onClose: () => void; children: ReactNode; className?: string; wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-ink/40 backdrop-blur-[3px]" onClick={onClose} />
          <motion.div
            role="dialog" aria-modal
            initial={{ y: 40, opacity: 0, scale: 0.98 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 30, opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className={cx("relative max-h-[92vh] w-full overflow-y-auto rounded-t-[28px] bg-paper shadow-lift sm:rounded-[28px]",
              wide ? "sm:max-w-5xl" : "sm:max-w-md", className)}
          >
            <button onClick={onClose} className="absolute right-4 top-4 z-10 rounded-full bg-paper/85 p-2 text-ink/60 shadow-card backdrop-blur hover:bg-paper hover:text-ink" aria-label="Close">
              <X size={18} />
            </button>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

type Toast = { id: number; text: string; tone: "ok" | "error" };
const ToastCtx = createContext<(text: string, tone?: Toast["tone"]) => void>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, tone: Toast["tone"] = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, tone }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3600);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex flex-col items-center gap-2 px-4">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div key={t.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
              className={cx("pointer-events-auto rounded-full px-5 py-3 text-sm font-medium shadow-lift",
                t.tone === "error" ? "bg-[#2a0f08] text-orange-soft" : "bg-ink text-white")}>
              {t.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

export function Spinner({ className }: { className?: string }) {
  return <span className={cx("inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent", className)} />;
}

export function Swatches({ colors, size = 22 }: { colors: { hex: string; name?: string }[]; size?: number }) {
  return (
    <div className="flex -space-x-1.5">
      {colors.map((c) => (
        <span key={c.hex + c.name} title={`${c.name ?? ""} ${c.hex}`} className="rounded-full ring-2 ring-paper"
          style={{ background: c.hex, width: size, height: size }} />
      ))}
    </div>
  );
}
