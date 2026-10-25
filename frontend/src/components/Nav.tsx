import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, LayoutGrid, LogOut, Menu, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { cx } from "../lib/util";
import { Logo } from "./Brand";

export function Nav({ variant = "marketing" }: { variant?: "marketing" | "app" }) {
  const { user, logout } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const loc = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => setOpen(false), [loc.pathname]);

  const marketingLinks = [
    { href: "/#how", label: "How it works" },
    { href: "/#examples", label: "Examples" },
    { href: "/#formats", label: "Formats" },
  ];

  return (
    <header className={cx("sticky top-0 z-40 transition-all duration-300",
      scrolled ? "border-b border-line/70 bg-cream/85 backdrop-blur-xl" : "border-b border-transparent")}>
      <div className="mx-auto flex h-[68px] max-w-[1320px] items-center justify-between gap-4 px-5 sm:px-8">
        <Logo />
        <nav className="hidden items-center gap-1 md:flex">
          {variant === "marketing"
            ? marketingLinks.map((l) => (
              <a key={l.href} href={l.href} className="rounded-full px-4 py-2 text-[15px] text-ink/80 transition hover:bg-ink/5 hover:text-ink">{l.label}</a>
            ))
            : (
              <>
                <NavLink to="/studio" end className={({ isActive }) => cx("rounded-full px-4 py-2 text-[15px] transition hover:bg-ink/5", isActive ? "font-semibold text-ink" : "text-ink/70")}>New idea</NavLink>
                <NavLink to="/library" className={({ isActive }) => cx("rounded-full px-4 py-2 text-[15px] transition hover:bg-ink/5", isActive ? "font-semibold text-ink" : "text-ink/70")}>Library</NavLink>
              </>
            )}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          {user ? (
            <>
              {variant === "marketing" && <Link to="/studio" className="btn-ghost text-[15px]">Studio</Link>}
              <div className="group relative">
                <button className="grid h-10 w-10 place-items-center rounded-full bg-ink text-sm font-bold text-white" aria-label="Account">
                  {(user.name || user.email).slice(0, 1).toUpperCase()}
                </button>
                <div className="invisible absolute right-0 top-12 w-56 rounded-2xl border border-line bg-paper p-2 opacity-0 shadow-lift transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                  <p className="truncate px-3 py-2 text-xs text-muted">{user.email}</p>
                  <Link to="/library" className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-ink/5"><LayoutGrid size={15} /> Library</Link>
                  <button onClick={() => { logout(); navigate("/"); }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-ink/5"><LogOut size={15} /> Log out</button>
                </div>
              </div>
              {variant === "app" && <Link to="/studio" className="btn-primary px-4 py-2.5 text-sm"><Plus size={16} /> New</Link>}
            </>
          ) : (
            <>
              <Link to="/login" className="btn-ghost text-[15px]">Log in</Link>
              <Link to="/studio" className="btn-primary px-5 py-2.5 text-[15px]">Try Arise <ArrowUpRight size={17} /></Link>
            </>
          )}
        </div>
        <button className="rounded-full p-2 md:hidden" onClick={() => setOpen((o) => !o)} aria-label="Menu">
          {open ? <X /> : <Menu />}
        </button>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-line bg-cream md:hidden">
            <div className="flex flex-col gap-1 px-5 py-4">
              {marketingLinks.map((l) => <a key={l.href} href={l.href} className="rounded-xl px-3 py-2.5">{l.label}</a>)}
              <Link to="/studio" className="rounded-xl px-3 py-2.5">Studio</Link>
              {user ? <Link to="/library" className="rounded-xl px-3 py-2.5">Library</Link> : <Link to="/login" className="rounded-xl px-3 py-2.5">Log in</Link>}
              <Link to="/studio" className="btn-primary mt-2">Try Arise <ArrowUpRight size={17} /></Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
