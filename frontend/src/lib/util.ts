import { useEffect, useRef } from "react";

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function daysLabel(days: number): string {
  if (days <= 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}

export function daysUntil(iso: string): number | null {
  if (!iso) return null;
  const target = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function aspectClass(aspect: string): string {
  return ({
    "1:1": "aspect-square",
    "3:4": "aspect-[3/4]",
    "4:5": "aspect-[4/5]",
    "2:3": "aspect-[2/3]",
    "9:16": "aspect-[9/16]",
    "16:9": "aspect-video",
  } as Record<string, string>)[aspect] ?? "aspect-square";
}

/** Run `fn` every `ms` while `active` is true (stable across renders). */
export function useInterval(fn: () => void, ms: number, active: boolean) {
  const saved = useRef(fn);
  saved.current = fn;
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => saved.current(), ms);
    return () => window.clearInterval(id);
  }, [ms, active]);
}

export function readableOn(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return "#121110";
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? "#121110" : "#FFFFFF";
}

/** Photos we can use as visual backdrops for a brand: uploads first, then non-logo site images. */
export function brandPhotos(brand: {
  uploads: { url: string }[];
  source: { og_image?: string | null; photos?: string[] | null; images?: { url: string; role?: string }[] | null };
}, toUrl: (u: string) => string): string[] {
  const urls = [
    ...brand.uploads.map((u) => toUrl(u.url)),
    // curated server-side (real photos only); older brands fall back to the raw image list
    ...(brand.source.photos ?? (brand.source.images ?? [])
      .filter((i) => i.role !== "logo" && !/\.svg($|\?)|logo|icon|favicon|sprite|badge/i.test(i.url))
      .map((i) => i.url)),
  ];
  return Array.from(new Set(urls)).slice(0, 10);
}
