import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storageKey: 'aihub-auth',
  },
});

export type Category = {
  id: string;
  name: string;
  icon: string;
  sort_order: number;
  created_at: string;
};

export type AITool = {
  id: string;
  name: string;
  url: string;
  logo_url: string;
  category_id: string | null;
  description: string;
  is_new: boolean;
  sort_order: number;
  created_at: string;
};

export type QuickUrl = {
  id: string;
  user_id: string;
  title: string;
  url: string;
  logo_url: string;
  created_at: string;
};

export type SocialLink = {
  platform: string;
  url: string;
  label?: string;
};

export type FavoriteReel = {
  url: string;
  title?: string;
};

export type Profile = {
  id: string;
  display_name: string;
  full_name: string | null;
  username: string | null;
  email_or_phone: string;
  avatar_url: string;
  banner_url: string | null;
  bio: string;
  date_of_birth: string | null;
  interests: string[];
  favorite_reels: FavoriteReel[];
  today_thought: string | null;
  today_thought_song: string | null;
  today_thought_user_ids: string[];
  website_links: string[];
  social_links: SocialLink[];
  professional_mode: boolean;
  is_admin: boolean;
  joins_count: number;
  plain_password: string;
  last_login_at: string | null;
  created_at: string;
};

export type Reel = {
  id: string;
  author_id: string;
  video_url: string;
  image_url: string | null;
  media_type: 'video' | 'image';
  thumbnail_url: string;
  caption: string;
  description: string;
  hashtags: string[];
  visibility: 'public' | 'private' | 'selected';
  visibility_user_ids: string[];
  likes_count: number;
  comments_count: number;
  shares_count: number;
  saves_count: number;
  created_at: string;
};

export type ReelComment = {
  id: string;
  reel_id: string;
  user_id: string;
  text: string;
  created_at: string;
};

export type ToolBookmark = {
  id: string;
  user_id: string;
  tool_id: string;
  created_at: string;
};

export type Event = {
  id: string;
  author_id: string;
  title: string;
  caption: string;
  description: string;
  hashtags: string[];
  event_date: string | null;
  location: string;
  event_type: string;
  image_url: string;
  visibility: 'public' | 'private' | 'selected';
  visibility_user_ids: string[];
  likes_count: number;
  saves_count: number;
  created_at: string;
};

export type Conversation = {
  id: string;
  participant_a: string;
  participant_b: string;
  last_message_at: string | null;
  created_at: string;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  text: string;
  seen: boolean;
  created_at: string;
};

export type Thought = {
  id: string;
  author_id: string;
  text: string;
  song: string | null;
  visibility_user_ids: string[];
  likes_count: number;
  created_at: string;
};

export type Notification = {
  id: string;
  user_id: string;
  actor_id: string;
  type: 'follow' | 'like' | 'comment';
  entity_id: string | null;
  message: string;
  seen: boolean;
  created_at: string;
};

// logo helpers --------------------------------------------------

export function faviconFor(siteUrl: string): string {
  if (!siteUrl) return '';
  try {
    const u = new URL(siteUrl);
    return `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=128`;
  } catch {
    return '';
  }
}

export function timeAgo(iso: string): string {
  const d = new Date(iso).getTime();
  const now = Date.now();
  const s = Math.floor((now - d) / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d`;
  const w = Math.floor(days / 7);
  if (w < 5) return `${w}w`;
  const mo = Math.floor(days / 30);
  if (mo < 12) return `${mo}mo`;
  const y = Math.floor(days / 365);
  return `${y}y`;
}

export function compactNum(n: number): string {
  if (n < 1000) return `${n}`;
  if (n < 1_000_000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

// A tool's "new" tag is only valid for 7 days from creation.
export function isNewActive(created_at: string, is_new: boolean): boolean {
  if (!is_new) return false;
  const ageMs = Date.now() - new Date(created_at).getTime();
  return ageMs <= 7 * 24 * 60 * 60 * 1000;
}

// Get or create a conversation between two users (participant_a < participant_b)
export async function getOrCreateConversation(userA: string, userB: string): Promise<string | null> {
  const a = userA < userB ? userA : userB;
  const b = userA < userB ? userB : userA;

  const { data: existing } = await supabase
    .from('conversations')
    .select('id')
    .eq('participant_a', a)
    .eq('participant_b', b)
    .maybeSingle();

  if (existing) return existing.id;

  const { data: created } = await supabase
    .from('conversations')
    .insert({ participant_a: a, participant_b: b })
    .select('id')
    .maybeSingle();

  return created?.id ?? null;
}
