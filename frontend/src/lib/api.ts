import { z } from "zod";
import {
  AppConfig, AuthResponse, Brand, Generation, Moment, ShareData, Usage, User,
  type FormatKey,
} from "./schemas";

const env = import.meta.env as Record<string, string | undefined>;
export const API_BASE = (env.VITE_BACKEND_URL || env.REACT_APP_BACKEND_URL || "").replace(/\/$/, "");

const TOKEN_KEY = "arise.token";
const ANON_KEY = "arise.anon";

function store(): Storage | null {
  try { return window.localStorage; } catch { return null; }
}
export const tokenStore = {
  get: () => store()?.getItem(TOKEN_KEY) ?? null,
  set: (t: string) => store()?.setItem(TOKEN_KEY, t),
  clear: () => store()?.removeItem(TOKEN_KEY),
};
export function anonId(): string {
  const s = store();
  let id = s?.getItem(ANON_KEY);
  if (!id) {
    id = crypto.randomUUID().replace(/-/g, "");
    s?.setItem(ANON_KEY, id);
  }
  return id;
}

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

/** Absolute URL for backend-relative paths (media, downloads); CDN URLs pass through. */
export function mediaUrl(path?: string | null): string {
  if (!path) return "";
  if (/^https?:\/\//.test(path)) return path;
  if (path.startsWith("/showcase/")) return path;
  return `${API_BASE}${path}`;
}

async function request<S extends z.ZodTypeAny>(path: string, schema: S, init: RequestInit = {}): Promise<z.output<S>> {
  const headers = new Headers(init.headers);
  headers.set("X-Anon-Id", anonId());
  const token = tokenStore.get();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api${path}`, { ...init, headers });
  } catch {
    throw new ApiError("Can't reach Arise right now. Check your connection.", 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = typeof data?.detail === "string" ? data.detail
      : Array.isArray(data?.detail) ? data.detail.map((d: { msg?: string }) => d.msg).join(", ")
      : `Request failed (${res.status})`;
    throw new ApiError(detail, res.status);
  }
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    console.error("API contract mismatch", path, parsed.error.issues);
    throw new ApiError("Unexpected response from the server.", 500);
  }
  return parsed.data;
}

const post = (body: unknown): RequestInit => ({ method: "POST", body: JSON.stringify(body) });

export type GenerateInput = {
  brand_id: string;
  idea_id: string;
  formats: FormatKey[];
  overrides: { headline?: string; subline?: string; tone?: string; accent?: string; caption?: string };
  reference_urls: string[];
  upload_ids: string[];
};

export const api = {
  config: () => request("/config", AppConfig),
  moments: () => request("/moments", z.object({ moments: z.array(Moment) })),
  signup: (email: string, password: string, name: string) => request("/auth/signup", AuthResponse, post({ email, password, name })),
  login: (email: string, password: string) => request("/auth/login", AuthResponse, post({ email, password })),
  me: () => request("/auth/me", z.object({ user: User })),
  claim: () => request("/brands/claim", z.object({ claimed: z.number() }), post({ anon_id: anonId() })),
  analyze: (url: string, notes: string, upload_ids: string[]) => request("/brands/analyze", Brand, post({ url, notes, upload_ids })),
  brand: (id: string) => request(`/brands/${id}`, Brand),
  brands: () => request("/brands", z.object({ brands: z.array(Brand) })),
  regenerateIdeas: (id: string, brief: string) => request(`/brands/${id}/ideas`, Brand, post({ brief })),
  patchBrand: (id: string, patch: { name?: string; business_type?: string; signature_items?: string[] }) =>
    request(`/brands/${id}`, Brand, { method: "PATCH", body: JSON.stringify(patch) }),
  generate: (input: GenerateInput) => request("/generations", z.object({ generation: Generation, usage: Usage }), post(input)),
  generation: (id: string) => request(`/generations/${id}`, z.object({ generation: Generation, usage: Usage })),
  generations: (brandId?: string) =>
    request(`/generations${brandId ? `?brand_id=${brandId}` : ""}`, z.object({ generations: z.array(Generation) })),
  usage: () => request("/usage", Usage),
  share: (itemId: string) => request(`/share/${itemId}`, ShareData),
  upload: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request("/uploads", z.object({ id: z.string(), url: z.string() }), { method: "POST", body: form });
  },
};
