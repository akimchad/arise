import { ArrowUpRight } from "lucide-react";
import { useState, type FormEvent } from "react";
import { ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { cx } from "../lib/util";
import { Spinner } from "./ui";

export function AuthForm({ initialMode = "signup", onDone, compact = false }: {
  initialMode?: "signup" | "login"; onDone?: () => void; compact?: boolean;
}) {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (mode === "signup") await signup(email, password, name);
      else await login(email, password);
      onDone?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="w-full">
      <div className="mb-6 inline-flex rounded-full bg-ink/5 p-1 text-sm font-semibold">
        {(["signup", "login"] as const).map((m) => (
          <button key={m} type="button" onClick={() => { setMode(m); setError(""); }}
            className={cx("rounded-full px-4 py-1.5 transition", mode === m ? "bg-white shadow-card" : "text-ink/60")}>
            {m === "signup" ? "Create account" : "Log in"}
          </button>
        ))}
      </div>
      <div className={cx("space-y-3", compact && "space-y-2.5")}>
        {mode === "signup" && (
          <input className="input" placeholder="Your name or business" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        )}
        <input className="input" type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        <input className="input" type="password" required minLength={mode === "signup" ? 8 : 1} placeholder={mode === "signup" ? "Password (8+ characters)" : "Password"}
          value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "signup" ? "new-password" : "current-password"} />
      </div>
      {error && <p className="mt-3 text-sm font-medium text-orange-deep">{error}</p>}
      <button type="submit" disabled={busy} className="btn-primary mt-5 w-full py-3.5 text-[15px]">
        {busy ? <Spinner /> : <>{mode === "signup" ? "Create free account" : "Log in"} <ArrowUpRight size={17} /></>}
      </button>
      {mode === "signup" && (
        <p className="mt-3 text-center text-xs text-muted">Free while we're in beta — a few generations every day.</p>
      )}
    </form>
  );
}
