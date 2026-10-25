import { z } from "zod";

export const User = z.object({ id: z.string(), email: z.string(), name: z.string() });
export type User = z.infer<typeof User>;

export const AuthResponse = z.object({ token: z.string(), user: User });

export const Swatch = z.object({ name: z.string(), hex: z.string() });

export const Profile = z.object({
  name: z.string(),
  category: z.string(),
  business_type: z.string(),
  tagline: z.string(),
  description: z.string(),
  location: z.string(),
  neighborhood: z.string(),
  audience: z.string(),
  audience_tags: z.array(z.string()),
  voice: z.array(z.string()),
  palette: z.array(Swatch),
  visual_style: z.string(),
  signature_items: z.array(z.string()),
  differentiators: z.array(z.string()),
  content_pillars: z.array(z.string()),
});
export type Profile = z.infer<typeof Profile>;

export const FormatKey = z.enum(["post", "story", "banner", "flyer", "wallpaper", "video"]);
export type FormatKey = z.infer<typeof FormatKey>;

export const Idea = z.object({
  id: z.string(),
  title: z.string(),
  moment: z.string(),
  moment_type: z.string(),
  moment_date: z.string(),
  hook: z.string(),
  why_now: z.string(),
  headline: z.string(),
  subline: z.string(),
  scene: z.string(),
  typography: z.string(),
  mood: z.string(),
  video_motion: z.string(),
  caption: z.string(),
  hashtags: z.array(z.string()),
  cta: z.string(),
  formats: z.array(FormatKey),
});
export type Idea = z.infer<typeof Idea>;

export const Moment = z.object({
  name: z.string(),
  date: z.string(),
  kind: z.string(),
  fits: z.string(),
  note: z.string(),
  days_until: z.number(),
});
export type Moment = z.infer<typeof Moment>;

const SourceImage = z.object({ url: z.string(), alt: z.string().optional().default(""), role: z.string().optional().default("photo") });

export const Brand = z.object({
  id: z.string(),
  status: z.enum(["working", "ready", "failed"]),
  stage: z.string().nullish(),
  error: z.string().nullish(),
  engine: z.string().nullish(),
  input: z.object({ url: z.string(), notes: z.string(), upload_ids: z.array(z.string()) }),
  source: z.object({
    kind: z.string().nullish(),
    url: z.string().nullish(),
    final_url: z.string().nullish(),
    title: z.string().nullish(),
    og_image: z.string().nullish(),
    icon: z.string().nullish(),
    images: z.array(SourceImage).nullish(),
    photos: z.array(z.string()).nullish(),
    colors: z.array(z.string()).nullish(),
    maps: z.record(z.any()).nullish(),
    warning: z.string().nullish(),
  }),
  uploads: z.array(z.object({ id: z.string(), url: z.string() })),
  profile: Profile.nullish(),
  ideas: z.array(Idea),
  trend_notes: z.array(z.string()),
  ideas_brief: z.string(),
  calendar: z.array(Moment),
  created_at: z.string().nullish(),
});
export type Brand = z.infer<typeof Brand>;

export const Item = z.object({
  id: z.string(),
  format: FormatKey,
  label: z.string(),
  kind: z.enum(["image", "video"]),
  aspect: z.string(),
  status: z.enum(["pending", "queued", "running", "waiting", "done", "failed", "blocked"]),
  url: z.string().nullish(),
  error: z.string().nullish(),
  source_item: z.string().nullish(),
  download: z.string().nullish(),
  share: z.string().nullish(),
});
export type Item = z.infer<typeof Item>;

export const Generation = z.object({
  id: z.string(),
  brand_id: z.string(),
  brand_name: z.string().nullish(),
  idea: z.object({
    id: z.string(), title: z.string(), moment: z.string(), hook: z.string(),
    headline: z.string(), subline: z.string().nullish(), cta: z.string().nullish(),
  }),
  overrides: z.record(z.any()),
  caption: z.string().nullish(),
  hashtags: z.array(z.string()),
  items: z.array(Item),
  complete: z.boolean(),
  mode: z.string().nullish(),
  created_at: z.string(),
});
export type Generation = z.infer<typeof Generation>;

export const Usage = z.object({
  images: z.object({ used: z.number(), limit: z.number() }),
  videos: z.object({ used: z.number(), limit: z.number() }),
  resets_at: z.string(),
  mode: z.string(),
});
export type Usage = z.infer<typeof Usage>;

export const AppConfig = z.object({
  generation_mode: z.string(),
  claude: z.boolean(),
  limits: z.object({ images: z.number(), videos: z.number() }),
});
export type AppConfig = z.infer<typeof AppConfig>;

export const ShareData = z.object({
  brand: z.object({ name: z.string().nullish(), palette: z.array(Swatch) }),
  idea: Generation.shape.idea,
  caption: z.string().nullish(),
  hashtags: z.array(z.string()),
  item: z.object({ id: z.string(), format: z.string(), label: z.string(), kind: z.string(), aspect: z.string(), url: z.string() }),
  siblings: z.array(z.object({ id: z.string(), label: z.string(), kind: z.string(), aspect: z.string(), url: z.string() })),
});
export type ShareData = z.infer<typeof ShareData>;
