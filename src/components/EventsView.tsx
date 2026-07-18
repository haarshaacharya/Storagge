import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Plus, X, Upload, Calendar, MapPin, ThumbsUp, Bookmark, Globe, Lock, Users,
  Hash, Trash2, Send, CalendarDays, ChevronDown, ChevronUp, Image as ImageIcon,
} from 'lucide-react';
import { supabase, type Event, type Profile, timeAgo, compactNum } from '../lib/supabase';
import { useAuth } from '../lib/auth';

type Visibility = 'public' | 'private' | 'selected';

const EVENT_TYPE_COLORS: Record<string, string> = {
  hackathon: 'bg-blue-900/40 text-blue-300 border-blue-800',
  research: 'bg-purple-900/40 text-purple-300 border-purple-800',
  concert: 'bg-pink-900/40 text-pink-300 border-pink-800',
  conference: 'bg-amber-900/40 text-amber-300 border-amber-800',
  workshop: 'bg-green-900/40 text-green-300 border-green-800',
  meetup: 'bg-cyan-900/40 text-cyan-300 border-cyan-800',
  webinar: 'bg-orange-900/40 text-orange-300 border-orange-800',
};
function getTypeColor(type: string) {
  return EVENT_TYPE_COLORS[type.toLowerCase()] ?? 'bg-zinc-900/40 text-zinc-300 border-zinc-800';
}

const PAGE_SIZE = 10;

export default function EventsView({
  onOpenAuth,
  onOpenProfile,
}: {
  onOpenAuth: () => void;
  onOpenProfile: (p: Profile) => void;
}) {
  const { user, profile } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [authors, setAuthors] = useState<Record<string, Profile>>({});
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const fetchEvents = useCallback(async (offset: number) => {
    const { data } = await supabase
      .from('events')
      .select('*')
      .eq('visibility', 'public')
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
    return (data as Event[]) ?? [];
  }, []);

  const loadAuthors = useCallback(async (evs: Event[]) => {
    const newIds = evs.map((e) => e.author_id).filter((id) => !authors[id]);
    const uniqueIds = [...new Set(newIds)];
    if (!uniqueIds.length) return;
    const { data } = await supabase.from('profiles').select('*').in('id', uniqueIds);
    const m: Record<string, Profile> = {};
    for (const p of (data as Profile[]) ?? []) m[p.id] = p;
    setAuthors((prev) => ({ ...prev, ...m }));
  }, [authors]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const evs = await fetchEvents(0);
      setEvents(evs);
      setHasMore(evs.length === PAGE_SIZE);
      await loadAuthors(evs);
      if (user) {
        const [l, s] = await Promise.all([
          supabase.from('event_likes').select('event_id').eq('user_id', user.id),
          supabase.from('event_saves').select('event_id').eq('user_id', user.id),
        ]);
        setLiked(new Set(((l.data as { event_id: string }[]) ?? []).map((x) => x.event_id)));
        setSaved(new Set(((s.data as { event_id: string }[]) ?? []).map((x) => x.event_id)));
      }
      setLoading(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Infinite scroll
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          setLoadingMore(true);
          fetchEvents(events.length).then(async (more) => {
            if (more.length > 0) {
              setEvents((prev) => [...prev, ...more]);
              setHasMore(more.length === PAGE_SIZE);
              await loadAuthors(more);
            } else {
              setHasMore(false);
            }
            setLoadingMore(false);
          });
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [events.length, hasMore, loadingMore, loading, fetchEvents, loadAuthors]);

  async function toggleLike(ev: Event) {
    if (!user) { onOpenAuth(); return; }
    const isLiked = liked.has(ev.id);
    setLiked((prev) => { const n = new Set(prev); isLiked ? n.delete(ev.id) : n.add(ev.id); return n; });
    setEvents((prev) => prev.map((e) => e.id === ev.id ? { ...e, likes_count: Math.max(0, e.likes_count + (isLiked ? -1 : 1)) } : e));
    if (isLiked) await supabase.from('event_likes').delete().eq('event_id', ev.id).eq('user_id', user.id);
    else await supabase.from('event_likes').insert({ event_id: ev.id, user_id: user.id });
  }

  async function toggleSave(ev: Event) {
    if (!user) { onOpenAuth(); return; }
    const isSaved = saved.has(ev.id);
    setSaved((prev) => { const n = new Set(prev); isSaved ? n.delete(ev.id) : n.add(ev.id); return n; });
    setEvents((prev) => prev.map((e) => e.id === ev.id ? { ...e, saves_count: Math.max(0, e.saves_count + (isSaved ? -1 : 1)) } : e));
    if (isSaved) await supabase.from('event_saves').delete().eq('event_id', ev.id).eq('user_id', user.id);
    else await supabase.from('event_saves').insert({ event_id: ev.id, user_id: user.id });
  }

  async function deleteEvent(ev: Event) {
    if (!user || user.id !== ev.author_id) return;
    if (!confirm('Delete this event?')) return;
    await supabase.from('events').delete().eq('id', ev.id);
    setEvents((prev) => prev.filter((e) => e.id !== ev.id));
  }

  async function handleCreated() {
    setShowCreate(false);
    const evs = await fetchEvents(0);
    setEvents(evs);
    setHasMore(evs.length === PAGE_SIZE);
    await loadAuthors(evs);
  }

  return (
    <div className="relative max-w-2xl mx-auto">
      {/* LinkedIn-style post trigger box */}
      {user && !showCreate && (
        <div
          className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 mb-5 cursor-pointer hover:border-zinc-400 shadow-sm transition"
          onClick={() => setShowCreate(true)}
        >
          <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-zinc-200 shrink-0">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-white font-bold text-sm">
                {(profile?.display_name || user?.email || 'U').charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex-1 bg-zinc-100 border border-zinc-300 rounded-full px-4 py-2.5 text-sm text-zinc-400 hover:border-zinc-400 transition select-none">
            Share an event, hackathon, or announcement…
          </div>
          <div className="shrink-0 flex items-center gap-1.5 text-zinc-400 text-xs">
            <ImageIcon className="w-4 h-4" />
          </div>
        </div>
      )}

      {/* Inline create form (expands in place) */}
      {user && showCreate && (
        <div className="mb-5">
          <InlineCreateEvent
            onClose={() => setShowCreate(false)}
            onCreated={handleCreated}
          />
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-zinc-900/60 animate-pulse h-80" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4">
            <CalendarDays className="w-7 h-7 text-zinc-600" />
          </div>
          <p className="text-zinc-400 font-medium">No events yet</p>
          <p className="text-zinc-600 text-sm mt-1">
            {user ? 'Be the first to create an event!' : 'Events will appear here once users post them.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4 pb-24">
          {events.map((ev) => (
            <EventFeedCard
              key={ev.id}
              event={ev}
              author={authors[ev.author_id]}
              liked={liked.has(ev.id)}
              saved={saved.has(ev.id)}
              isOwn={user?.id === ev.author_id}
              onLike={() => toggleLike(ev)}
              onSave={() => toggleSave(ev)}
              onDelete={() => deleteEvent(ev)}
              onOpenProfile={onOpenProfile}
              onOpenAuth={onOpenAuth}
            />
          ))}
          <div ref={sentinelRef} className="h-4" />
          {loadingMore && (
            <div className="flex justify-center py-4">
              <div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EventFeedCard({
  event, author, liked, saved, isOwn,
  onLike, onSave, onDelete, onOpenProfile, onOpenAuth,
}: {
  event: Event;
  author?: Profile;
  liked: boolean;
  saved: boolean;
  isOwn: boolean;
  onLike: () => void;
  onSave: () => void;
  onDelete: () => void;
  onOpenProfile: (p: Profile) => void;
  onOpenAuth: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const typeColor = getTypeColor(event.event_type);
  const showDescription = event.description && event.description.trim().length > 0;
  const longCaption = event.caption.length > 180;

  return (
    <article className="rounded-2xl bg-zinc-900/80 border border-zinc-800 overflow-hidden">
      {/* Author bar */}
      <div className="flex items-center justify-between px-4 py-3">
        <button
          onClick={() => author ? onOpenProfile(author) : onOpenAuth()}
          className="flex items-center gap-2.5 min-w-0"
        >
          <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 border-2 border-zinc-700">
            {author?.avatar_url ? (
              <img src={author.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-white text-sm font-bold">
                {(author?.display_name || 'U').charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="text-left min-w-0">
            <p className="text-white text-sm font-semibold truncate">{author?.display_name || 'User'}</p>
            {author?.username && <p className="text-zinc-500 text-xs">@{author.username}</p>}
          </div>
        </button>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${typeColor}`}>
            {event.event_type}
          </span>
          {isOwn && (
            <button onClick={onDelete} className="text-zinc-600 hover:text-red-400 transition">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Image */}
      {event.image_url && (
        <img src={event.image_url} alt={event.title} className="w-full max-h-80 object-cover" />
      )}

      {/* Content */}
      <div className="px-4 pt-3 pb-4 space-y-3">
        <h2 className="text-white font-bold text-lg leading-snug">{event.title}</h2>

        {/* Caption with expand */}
        {event.caption && (
          <div>
            <p className={`text-zinc-300 text-sm leading-relaxed ${!expanded && longCaption ? 'line-clamp-3' : ''}`}>
              {event.caption}
            </p>
            {longCaption && (
              <button
                onClick={() => setExpanded((v) => !v)}
                className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 mt-1 transition"
              >
                {expanded ? <><ChevronUp className="w-3.5 h-3.5" /> Show less</> : <><ChevronDown className="w-3.5 h-3.5" /> Read more</>}
              </button>
            )}
          </div>
        )}

        {/* Description */}
        {showDescription && expanded && (
          <p className="text-zinc-400 text-sm whitespace-pre-wrap">{event.description}</p>
        )}

        {/* Meta */}
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {event.event_date && (
            <div className="flex items-center gap-1.5 text-xs text-zinc-500">
              <Calendar className="w-3.5 h-3.5 text-red-500 shrink-0" />
              {new Date(event.event_date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
          )}
          {event.location && (
            <div className="flex items-center gap-1.5 text-xs text-zinc-500">
              <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0" />
              <span className="truncate max-w-[180px]">{event.location}</span>
            </div>
          )}
        </div>

        {/* Hashtags */}
        {event.hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {event.hashtags.map((h) => (
              <span key={h} className="flex items-center gap-0.5 text-xs text-red-400 bg-red-950/30 border border-red-900/40 rounded-full px-2 py-0.5">
                <Hash className="w-3 h-3" />{h}
              </span>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
          <p className="text-xs text-zinc-600">{timeAgo(event.created_at)} ago</p>
          <div className="flex items-center gap-3">
            <button
              onClick={onLike}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition border ${
                liked
                  ? 'bg-red-950/50 border-red-800 text-red-400'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-red-700 hover:text-red-400'
              }`}
            >
              <ThumbsUp className={`w-4 h-4 ${liked ? 'fill-red-500' : ''}`} />
              {compactNum(event.likes_count)}
            </button>
            <button
              onClick={onSave}
              className={`w-9 h-9 rounded-full border flex items-center justify-center transition ${
                saved ? 'bg-zinc-700 border-zinc-600 text-white' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white'
              }`}
            >
              <Bookmark className={`w-4 h-4 ${saved ? 'fill-white' : ''}`} />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function InlineCreateEvent({ onClose, onCreated }: { onClose: () => void; onCreated: () => Promise<void> }) {
  const { user, profile } = useAuth();
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [description, setDescription] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [location, setLocation] = useState('');
  const [eventType, setEventType] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function pickImage(f: File | null) {
    if (!f) return;
    if (!f.type.startsWith('image/')) { setErr('Please select an image file'); return; }
    setImageFile(f);
    setImagePreview(URL.createObjectURL(f));
    setErr(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setErr('Title is required'); return; }
    setShowPrivacy(true);
  }

  async function create() {
    if (!user) return;
    setShowPrivacy(false);
    setBusy(true);
    let image_url = '';
    if (imageFile) {
      const ext = imageFile.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `events/${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, imageFile, { contentType: imageFile.type });
      if (!upErr) {
        const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
        image_url = pub.publicUrl;
      }
    }
    const tags = hashtags.split(/[\s,#]+/).map((t) => t.trim()).filter(Boolean).slice(0, 20);
    const { error } = await supabase.from('events').insert({
      author_id: user.id,
      title: title.trim(),
      caption: caption.trim(),
      description: description.trim(),
      hashtags: tags,
      event_date: eventDate ? new Date(eventDate).toISOString() : null,
      location: location.trim(),
      event_type: eventType,
      image_url,
      visibility,
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    await onCreated();
  }

  const visIcon = { public: <Globe className="w-3.5 h-3.5" />, private: <Lock className="w-3.5 h-3.5" />, selected: <Users className="w-3.5 h-3.5" /> };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-md">
      {/* Author row */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-zinc-700 shrink-0">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-white font-bold text-sm">
                {(profile?.display_name || user?.email || 'U').charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div>
            <p className="text-white text-sm font-semibold">{profile?.display_name || 'You'}</p>
            <button
              type="button"
              onClick={() => setShowPrivacy(true)}
              className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200 transition mt-0.5"
            >
              {visIcon[visibility]}
              <span className="capitalize">{visibility}</span>
              <ChevronDown className="w-3 h-3" />
            </button>
          </div>
        </div>
        <button onClick={onClose} className="text-zinc-500 hover:text-white transition">
          <X className="w-5 h-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Image area */}
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => pickImage(e.target.files?.[0] ?? null)} />
        {imagePreview ? (
          <div className="relative">
            <img src={imagePreview} alt="preview" className="w-full max-h-72 object-cover" />
            <button type="button"
              onClick={() => { setImageFile(null); if (imagePreview) URL.revokeObjectURL(imagePreview); setImagePreview(null); }}
              className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center transition">
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => fileRef.current?.click()}
            className="mx-4 mb-1 flex items-center gap-2 text-xs text-zinc-400 hover:text-blue-400 transition py-1">
            <ImageIcon className="w-4 h-4 text-blue-400" /> Add photo
          </button>
        )}

        {/* Fields */}
        <div className="px-4 space-y-3 pb-4">
          {err && <div className="text-xs text-red-300 bg-red-950/50 border border-red-800 rounded-lg px-3 py-2">{err}</div>}

          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Event title *" required
            className="w-full bg-transparent text-white text-lg font-semibold placeholder-zinc-500 outline-none border-b border-zinc-800 py-1.5" />

          <textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={3}
            placeholder="What's this event about? Share the details…"
            className="w-full bg-transparent text-zinc-300 text-sm placeholder-zinc-500 outline-none resize-none" />

          {/* Meta row */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2">
              <Calendar className="w-3.5 h-3.5 text-red-500 shrink-0" />
              <input type="datetime-local" value={eventDate} onChange={(e) => setEventDate(e.target.value)}
                className="flex-1 bg-transparent text-xs text-zinc-300 outline-none min-w-0 [color-scheme:dark]" />
            </div>
            <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2">
              <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0" />
              <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location"
                className="flex-1 bg-transparent text-xs text-zinc-300 placeholder-zinc-500 outline-none min-w-0" />
            </div>
          </div>

          <div className="flex gap-2">
            <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 flex-1">
              <CalendarDays className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
              <input value={eventType} onChange={(e) => setEventType(e.target.value)} placeholder="Event type (e.g. Hackathon)"
                className="flex-1 bg-transparent text-xs text-zinc-300 placeholder-zinc-500 outline-none" />
            </div>
            <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 flex-1">
              <Hash className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
              <input value={hashtags} onChange={(e) => setHashtags(e.target.value)} placeholder="Tags: ai, coding…"
                className="flex-1 bg-transparent text-xs text-zinc-300 placeholder-zinc-500 outline-none" />
            </div>
          </div>

          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
            placeholder="Add more details (optional)…"
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-300 placeholder-zinc-500 outline-none resize-none focus:border-red-500 transition" />

          {/* Action row */}
          <div className="flex items-center justify-between pt-1 border-t border-zinc-800">
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => fileRef.current?.click()}
                title="Add image"
                className="text-zinc-400 hover:text-blue-400 transition">
                <ImageIcon className="w-5 h-5" />
              </button>
            </div>
            <button type="submit" disabled={busy || !title.trim()}
              className="flex items-center gap-2 rounded-full bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-semibold px-5 py-2 text-sm transition">
              {busy ? <div className="w-4 h-4 border-2 border-white/40 border-t-transparent rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
              Post
            </button>
          </div>
        </div>
      </form>

      {/* Privacy popup */}
      {showPrivacy && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowPrivacy(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800">
              <h3 className="font-semibold text-white">Who can see this?</h3>
              <button onClick={() => setShowPrivacy(false)} className="text-zinc-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-3 gap-2">
                {[
                  { v: 'public' as Visibility, label: 'Public', icon: <Globe className="w-4 h-4" />, desc: 'Anyone can see' },
                  { v: 'private' as Visibility, label: 'Private', icon: <Lock className="w-4 h-4" />, desc: 'Only you' },
                  { v: 'selected' as Visibility, label: 'Followers', icon: <Users className="w-4 h-4" />, desc: 'Followers only' },
                ].map(({ v, label, icon, desc }) => (
                  <button key={v} type="button" onClick={() => { setVisibility(v); setShowPrivacy(false); }}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3 text-xs font-medium transition ${visibility === v ? 'border-red-500 bg-red-950/40 text-red-300' : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700'}`}>
                    {icon}<span>{label}</span><span className="text-[10px] text-center opacity-70">{desc}</span>
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowPrivacy(false)} className="flex-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white py-2.5 text-sm font-medium transition">Back</button>
                <button onClick={create} disabled={busy} className="flex-1 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white py-2.5 text-sm font-bold transition flex items-center justify-center gap-1.5">
                  {busy ? <div className="w-4 h-4 border-2 border-white/40 border-t-transparent rounded-full animate-spin" /> : <><Send className="w-4 h-4" /> Post</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CreateEventModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => Promise<void> }) {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [description, setDescription] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [location, setLocation] = useState('');
  const [eventType, setEventType] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function pickImage(f: File | null) {
    if (!f) return;
    if (!f.type.startsWith('image/')) { setErr('Please select an image file'); return; }
    setImageFile(f);
    setImagePreview(URL.createObjectURL(f));
    setErr(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setErr('Title is required'); return; }
    setShowPrivacy(true);
  }

  async function create() {
    if (!user) return;
    setShowPrivacy(false);
    setBusy(true);
    let image_url = '';
    if (imageFile) {
      const ext = imageFile.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `events/${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, imageFile, { contentType: imageFile.type });
      if (!upErr) {
        const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
        image_url = pub.publicUrl;
      }
    }
    const tags = hashtags.split(/[\s,#]+/).map((t) => t.trim()).filter(Boolean).slice(0, 20);
    const { error } = await supabase.from('events').insert({
      author_id: user.id,
      title: title.trim(),
      caption: caption.trim(),
      description: description.trim(),
      hashtags: tags,
      event_date: eventDate ? new Date(eventDate).toISOString() : null,
      location: location.trim(),
      event_type: eventType,
      image_url,
      visibility,
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    await onCreated();
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 shrink-0">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2"><CalendarDays className="w-5 h-5 text-red-500" /> Create Event</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-6">
          {err && <div className="mb-4 text-sm text-red-300 bg-red-950/50 border border-red-800 rounded-lg px-3 py-2">{err}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              {imagePreview ? (
                <div className="relative rounded-xl overflow-hidden bg-black border border-zinc-800">
                  <img src={imagePreview} alt="preview" className="w-full h-40 object-cover" />
                  <button type="button" onClick={() => { setImageFile(null); if (imagePreview) URL.revokeObjectURL(imagePreview); setImagePreview(null); }}
                    className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80 transition">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label className="block w-full rounded-xl border-2 border-dashed border-zinc-700 hover:border-red-600 bg-zinc-950 transition py-8 cursor-pointer flex flex-col items-center gap-2">
                  <Upload className="w-6 h-6 text-zinc-500" />
                  <span className="text-sm text-zinc-500">Add event image (optional)</span>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => pickImage(e.target.files?.[0] ?? null)} />
                </label>
              )}
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1">Event Type</label>
              <input value={eventType} onChange={(e) => setEventType(e.target.value)} placeholder="e.g. Hackathon, Concert, Workshop…"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-red-600 outline-none" />
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1">Title *</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Event title…" required
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-red-600 outline-none" />
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1">Caption</label>
              <input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Short description…"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-red-600 outline-none" />
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1">Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="More details about the event…"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-red-600 outline-none resize-none" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Date & Time</label>
                <input type="datetime-local" value={eventDate} onChange={(e) => setEventDate(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:border-red-600 outline-none" />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Location</label>
                <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City or URL…"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-red-600 outline-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1">Hashtags</label>
              <input value={hashtags} onChange={(e) => setHashtags(e.target.value)} placeholder="hackathon, ai, coding"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-red-600 outline-none" />
            </div>

            <button type="submit" disabled={busy}
              className="w-full rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-medium py-2.5 transition flex items-center justify-center gap-2">
              Next: Choose Audience
            </button>
          </form>
        </div>
      </div>

      {showPrivacy && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4" onClick={() => setShowPrivacy(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800">
              <h3 className="font-semibold text-white">Who can see this?</h3>
              <button onClick={() => setShowPrivacy(false)} className="text-zinc-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-3 gap-2">
                {[
                  { v: 'public' as Visibility, label: 'Public', icon: <Globe className="w-4 h-4" />, desc: 'Anyone can see' },
                  { v: 'private' as Visibility, label: 'Private', icon: <Lock className="w-4 h-4" />, desc: 'Only you' },
                  { v: 'selected' as Visibility, label: 'Followers', icon: <Users className="w-4 h-4" />, desc: 'Followers only' },
                ].map(({ v, label, icon, desc }) => (
                  <button key={v} type="button" onClick={() => setVisibility(v)}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3 text-xs font-medium transition ${visibility === v ? 'border-red-600 bg-red-950/40 text-red-300' : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700'}`}>
                    {icon}
                    <span>{label}</span>
                    <span className="text-[10px] text-center opacity-70">{desc}</span>
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowPrivacy(false)} className="flex-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white py-2.5 text-sm font-medium transition">Back</button>
                <button onClick={create} disabled={busy} className="flex-1 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white py-2.5 text-sm font-bold transition flex items-center justify-center gap-1.5">
                  {busy ? <><div className="w-4 h-4 border-2 border-white/40 border-t-transparent rounded-full animate-spin" /> Creating…</> : <><Send className="w-4 h-4" /> Create Event</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}