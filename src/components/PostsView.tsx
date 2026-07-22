import { useEffect, useRef, useState, useCallback } from 'react';
import {
  ThumbsUp, MessageCircle, Bookmark, Share2, Plus, Lock, Music2,
  X, Play, Film, Image as ImageIcon, Trash2, AlertTriangle, Send,
  MoreVertical, Copy, Check as CheckIcon, Search, UserPlus, Globe, Users, Repeat2,
  PenLine, Heart, Music,
} from 'lucide-react';
import { supabase, type Reel, type ReelComment, type Profile, type Thought, timeAgo, compactNum } from '../lib/supabase';
import { useAuth } from '../lib/auth';

const PAGE = 6;

type Visibility = 'public' | 'private' | 'selected';

export default function PostsView({
  onOpenAuth,
  onOpenProfile,
  onMessage,
}: {
  onOpenAuth: () => void;
  onOpenProfile: (p: Profile) => void;
  onMessage: (uid: string) => void;
}) {
  const { user, profile, refreshProfile } = useAuth();
  const [reels, setReels] = useState<Reel[]>([]);
  const [thoughts, setThoughts] = useState<Thought[]>([]);
  const [thoughtAuthors, setThoughtAuthors] = useState<Record<string, Profile>>({});
  const [thoughtLiked, setThoughtLiked] = useState<Set<string>>(new Set());
  const [authors, setAuthors] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [showThoughtModal, setShowThoughtModal] = useState(false);
  const [showComments, setShowComments] = useState<string | null>(null);
  const [openReel, setOpenReel] = useState<Reel | null>(null);
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [shareReel, setShareReel] = useState<Reel | null>(null);
  const [autoplay, setAutoplay] = useState(() => localStorage.getItem('reels-autoplay') !== 'false');

  function toggleAutoplay() {
    setAutoplay((v) => {
      const next = !v;
      localStorage.setItem('reels-autoplay', String(next));
      return next;
    });
  }

  const loadReels = useCallback(async (before?: string) => {
    let q = supabase.from('reels').select('*').eq('visibility', 'public').order('created_at', { ascending: false }).limit(PAGE);
    if (before) q = q.lt('created_at', before);
    const { data, error } = await q;
    if (error) { console.warn(error.message); return []; }
    return (data as Reel[]) ?? [];
  }, []);

  const loadAuthors = useCallback(async (rs: Reel[]) => {
    const ids = [...new Set(rs.map((r) => r.author_id))];
    if (ids.length === 0) return;
    const { data } = await supabase.from('profiles').select('*').in('id', ids);
    if (data) {
      setAuthors((prev) => {
        const n = { ...prev };
        for (const p of data as Profile[]) n[p.id] = p;
        return n;
      });
    }
  }, []);

  const loadEngagement = useCallback(async (rs: Reel[]) => {
    if (!user) return;
    const ids = rs.map((r) => r.id);
    if (ids.length === 0) return;
    const [l, s, f] = await Promise.all([
      supabase.from('reel_likes').select('reel_id').eq('user_id', user.id).in('reel_id', ids),
      supabase.from('reel_saves').select('reel_id').eq('user_id', user.id).in('reel_id', ids),
      supabase.from('follows').select('following_id').eq('follower_id', user.id),
    ]);
    setLiked((prev) => new Set([...prev, ...((l.data as { reel_id: string }[]) ?? []).map((x) => x.reel_id)]));
    setSaved((prev) => new Set([...prev, ...((s.data as { reel_id: string }[]) ?? []).map((x) => x.reel_id)]));
    setFollowing((prev) => new Set([...prev, ...((f.data as { following_id: string }[]) ?? []).map((x) => x.following_id)]));
  }, [user]);

  const loadThoughts = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('thoughts').select('*').order('created_at', { ascending: false }).limit(30);
    const ts = (data as Thought[]) ?? [];
    setThoughts(ts);
    const ids = [...new Set(ts.map((t) => t.author_id))];
    if (ids.length) {
      const { data: ps } = await supabase.from('profiles').select('*').in('id', ids);
      const m: Record<string, Profile> = {};
      for (const p of (ps as Profile[]) ?? []) m[p.id] = p;
      setThoughtAuthors(m);
    }
    const { data: lData } = await supabase.from('thought_likes').select('thought_id').eq('user_id', user.id);
    setThoughtLiked(new Set(((lData as { thought_id: string }[]) ?? []).map((x) => x.thought_id)));
  }, [user]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const rs = await loadReels();
      setReels(rs);
      if (rs.length < PAGE) setHasMore(false);
      setCursor(rs.length ? rs[rs.length - 1].created_at : null);
      await Promise.all([loadAuthors(rs), loadEngagement(rs), loadThoughts()]);
      setLoading(false);
    })();
  }, [loadReels, loadAuthors, loadEngagement, loadThoughts]);

  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!sentinel.current) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && reels.length > 0) {
          (async () => {
            setLoadingMore(true);
            const rs = await loadReels(cursor ?? undefined);
            if (rs.length === 0) { setHasMore(false); }
            else {
              setReels((prev) => [...prev, ...rs]);
              setCursor(rs[rs.length - 1].created_at);
              await Promise.all([loadAuthors(rs), loadEngagement(rs)]);
            }
            setLoadingMore(false);
          })();
        }
      },
      { rootMargin: '400px' }
    );
    obs.observe(sentinel.current);
    return () => obs.disconnect();
  }, [cursor, hasMore, loadingMore, reels.length, loadReels, loadAuthors, loadEngagement]);

  async function toggleLike(reel: Reel) {
    if (!user) { onOpenAuth(); return; }
    const isLiked = liked.has(reel.id);
    setLiked((prev) => { const n = new Set(prev); isLiked ? n.delete(reel.id) : n.add(reel.id); return n; });
    setReels((prev) => prev.map((r) => r.id === reel.id ? { ...r, likes_count: Math.max(0, r.likes_count + (isLiked ? -1 : 1)) } : r));
    if (isLiked) await supabase.from('reel_likes').delete().eq('reel_id', reel.id).eq('user_id', user.id);
    else await supabase.from('reel_likes').insert({ reel_id: reel.id, user_id: user.id });
  }

  async function toggleSave(reel: Reel) {
    if (!user) { onOpenAuth(); return; }
    const isSaved = saved.has(reel.id);
    setSaved((prev) => { const n = new Set(prev); isSaved ? n.delete(reel.id) : n.add(reel.id); return n; });
    setReels((prev) => prev.map((r) => r.id === reel.id ? { ...r, saves_count: Math.max(0, r.saves_count + (isSaved ? -1 : 1)) } : r));
    if (isSaved) await supabase.from('reel_saves').delete().eq('reel_id', reel.id).eq('user_id', user.id);
    else await supabase.from('reel_saves').insert({ reel_id: reel.id, user_id: user.id });
  }

  async function toggleFollow(authorId: string) {
    if (!user) { onOpenAuth(); return; }
    if (user.id === authorId) return;
    const isFollowing = following.has(authorId);
    setFollowing((prev) => { const n = new Set(prev); isFollowing ? n.delete(authorId) : n.add(authorId); return n; });
    setAuthors((prev) => {
      const a = prev[authorId];
      if (!a) return prev;
      return { ...prev, [authorId]: { ...a, joins_count: Math.max(0, (a.joins_count ?? 0) + (isFollowing ? -1 : 1)) } };
    });
    if (isFollowing) {
      await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', authorId);
    } else {
      await supabase.from('follows').insert({ follower_id: user.id, following_id: authorId });
    }
  }

  async function toggleThoughtLike(thought: Thought) {
    if (!user) { onOpenAuth(); return; }
    const isLiked = thoughtLiked.has(thought.id);
    setThoughtLiked((prev) => { const n = new Set(prev); isLiked ? n.delete(thought.id) : n.add(thought.id); return n; });
    setThoughts((prev) => prev.map((t) => t.id === thought.id ? { ...t, likes_count: Math.max(0, t.likes_count + (isLiked ? -1 : 1)) } : t));
    if (isLiked) await supabase.from('thought_likes').delete().eq('thought_id', thought.id).eq('user_id', user.id);
    else await supabase.from('thought_likes').insert({ thought_id: thought.id, user_id: user.id });
  }

  async function deleteThought(id: string) {
    if (!user) return;
    if (!confirm('Delete this thought?')) return;
    await supabase.from('thoughts').delete().eq('id', id);
    setThoughts((prev) => prev.filter((t) => t.id !== id));
  }

  async function deleteReel(reel: Reel) {
    if (!user) return;
    const canDelete = user.id === reel.author_id || profile?.is_admin;
    if (!canDelete) return;
    if (!confirm('Delete this post? This cannot be undone.')) return;
    try {
      const mediaUrl = reel.media_type === 'image' ? (reel.image_url || reel.video_url) : reel.video_url;
      const u = new URL(mediaUrl);
      const parts = u.pathname.split('/reels/');
      if (parts[1]) await supabase.storage.from('reels').remove([parts[1]]);
    } catch { /* ignore */ }
    await supabase.from('reels').delete().eq('id', reel.id);
    setReels((prev) => prev.filter((r) => r.id !== reel.id));
    setOpenReel(null);
  }

  const cardProps = (reel: Reel) => ({
    reel,
    author: authors[reel.author_id],
    isOwn: user?.id === reel.author_id,
    isAdmin: !!profile?.is_admin,
    liked: liked.has(reel.id),
    saved: saved.has(reel.id),
    following: following.has(reel.author_id),
    canEngage: !!user,
    autoplay,
    onLike: () => toggleLike(reel),
    onSave: () => toggleSave(reel),
    onShare: () => setShareReel(reel),
    onFollow: () => toggleFollow(reel.author_id),
    onComment: () => user ? setShowComments(reel.id) : onOpenAuth(),
    onOpenAuth,
    onOpenProfile,
    onMessage,
    onOpenReel: () => setOpenReel(reel),
    onDelete: () => deleteReel(reel),
    onToggleAutoplay: toggleAutoplay,
  });

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const canUpload = user && profile?.professional_mode;

  // Merge thoughts + reels sorted by created_at desc for feed
  type FeedItem = { kind: 'reel'; data: Reel } | { kind: 'thought'; data: Thought };
  const feedItems: FeedItem[] = [
    ...reels.map((r): FeedItem => ({ kind: 'reel', data: r })),
    ...thoughts.map((t): FeedItem => ({ kind: 'thought', data: t })),
  ].sort((a, b) => new Date(b.data.created_at).getTime() - new Date(a.data.created_at).getTime());

  return (
    <div className="relative">
      {/* FABs */}
      {user && (
        <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3">
          {/* Thought button — always available when logged in */}
          <button onClick={() => setShowThoughtModal(true)}
            className="flex items-center gap-2 rounded-full bg-zinc-800 border border-zinc-700 hover:border-red-600 text-zinc-300 hover:text-white shadow-xl px-4 h-11 text-sm font-medium transition"
            title="Post a thought">
            <PenLine className="w-4 h-4" /> Thought
          </button>

          {canUpload ? (
            <button onClick={() => setShowUpload(true)}
              className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-500 text-white shadow-2xl shadow-red-900/50 flex items-center justify-center transition hover:scale-105"
              title="Post a reel or photo">
              <Plus className="w-6 h-6" />
            </button>
          ) : (
            <button onClick={() => setShowUpload(true)}
              className="px-4 h-12 rounded-full bg-zinc-900 border border-red-700/50 text-red-400 text-sm font-medium shadow-xl flex items-center gap-2"
              title="Enable professional mode to post">
              <Lock className="w-4 h-4" /> Pro Mode
            </button>
          )}
        </div>
      )}

      {feedItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4">
            <Play className="w-7 h-7 text-zinc-600" />
          </div>
          <p className="text-zinc-400 font-medium">No posts yet</p>
          <p className="text-zinc-600 text-sm mt-1">
            {user ? 'Turn on professional mode or post a thought.' : 'Posts will appear here once creators post.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 pb-20">
          {feedItems.map((item) =>
            item.kind === 'thought' ? (
              <ThoughtCard
                key={`thought-${item.data.id}`}
                thought={item.data}
                author={thoughtAuthors[item.data.author_id]}
                liked={thoughtLiked.has(item.data.id)}
                isOwn={user?.id === item.data.author_id}
                onLike={() => toggleThoughtLike(item.data)}
                onDelete={() => deleteThought(item.data.id)}
                onOpenProfile={onOpenProfile}
              />
            ) : (
              <ReelCard key={`reel-${item.data.id}`} {...cardProps(item.data)} />
            )
          )}
          <div ref={sentinel} className="h-1" />
          {loadingMore && <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />}
          {!hasMore && reels.length > 0 && <p className="text-zinc-600 text-sm py-4">You're all caught up</p>}
        </div>
      )}

      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          needsProfessional={user ? !profile?.professional_mode : false}
          onEnableProfessional={async () => {
            await supabase.from('profiles').update({ professional_mode: true }).eq('id', user!.id);
            await refreshProfile();
          }}
          onPosted={async () => {
            setShowUpload(false);
            const rs = await loadReels();
            setReels(rs);
            setCursor(rs.length ? rs[rs.length - 1].created_at : null);
            setHasMore(rs.length >= PAGE);
            await Promise.all([loadAuthors(rs), loadEngagement(rs)]);
          }}
        />
      )}

      {showThoughtModal && (
        <ThoughtModal
          onClose={() => setShowThoughtModal(false)}
          onPosted={() => { setShowThoughtModal(false); loadThoughts(); }}
        />
      )}

      {showComments && <CommentsDrawer reelId={showComments} onClose={() => setShowComments(null)} />}

      {openReel && (
        <FullReelView
          {...cardProps(openReel)}
          onClose={() => setOpenReel(null)}
        />
      )}

      {shareReel && <SharePopup reel={shareReel} onClose={() => setShareReel(null)} />}
    </div>
  );
}

// ── Thought Card ──────────────────────────────────────────────────
function ThoughtCard({
  thought, author, liked, isOwn, onLike, onDelete, onOpenProfile,
}: {
  thought: Thought;
  author?: Profile;
  liked: boolean;
  isOwn: boolean;
  onLike: () => void;
  onDelete: () => void;
  onOpenProfile: (p: Profile) => void;
}) {
  return (
    <div className="w-full max-w-[420px] rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden shadow-lg">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <button onClick={() => author && onOpenProfile(author)} className="shrink-0">
          <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-zinc-700">
            {author?.avatar_url ? (
              <img src={author.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-white text-sm font-bold">
                {(author?.display_name || 'U').charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-semibold truncate">{author?.display_name || 'User'}</p>
          <p className="text-zinc-500 text-xs">{timeAgo(thought.created_at)} ago</p>
        </div>
        {isOwn && (
          <button onClick={onDelete} className="text-zinc-600 hover:text-red-400 transition">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Thought text */}
      <div className="px-4 pb-3">
        <p className="text-white text-sm leading-relaxed italic">"{thought.text}"</p>
        {thought.song && (
          <p className="mt-2 text-zinc-500 text-xs flex items-center gap-1.5">
            <Music className="w-3 h-3 text-red-400" /> {thought.song}
          </p>
        )}
      </div>

      {thought.image_url && (
        <div className="px-4 pb-3">
          <img src={thought.image_url} alt="" className="w-full rounded-xl object-cover max-h-80 border border-zinc-800" />
        </div>
      )}

      {/* Like */}
      <div className="flex items-center gap-2 px-4 pb-4 border-t border-zinc-800 pt-3">
        <button onClick={onLike} className={`flex items-center gap-1.5 text-sm transition ${liked ? 'text-red-500' : 'text-zinc-500 hover:text-red-400'}`}>
          <Heart className={`w-4 h-4 ${liked ? 'fill-red-500' : ''}`} />
          <span>{compactNum(thought.likes_count)}</span>
        </button>
        <span className="text-zinc-700 text-xs ml-auto flex items-center gap-1">
          <Users className="w-3 h-3" /> Private
        </span>
      </div>
    </div>
  );
}

// ── Thought Post Modal ────────────────────────────────────────────
function ThoughtModal({ onClose, onPosted }: { onClose: () => void; onPosted: () => void }) {
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [song, setSong] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function pickImage(f: File | null) {
    if (!f) return;
    if (!f.type.startsWith('image/')) { setErr('Please select an image file'); return; }
    setImageFile(f);
    setImagePreview(URL.createObjectURL(f));
    setErr(null);
  }

  function removeImage() {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || !user) { setErr('Write something first'); return; }
    if (selectedIds.size === 0) { setErr('Select at least one person to share with'); return; }
    setBusy(true);

    let image_url: string | null = null;
    if (imageFile) {
      setUploadingImage(true);
      const ext = imageFile.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `${user.id}/thought_${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, imageFile, { contentType: imageFile.type });
      setUploadingImage(false);
      if (upErr) { setErr(upErr.message); setBusy(false); return; }
      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
      image_url = pub.publicUrl;
    }

    const { error } = await supabase.from('thoughts').insert({
      author_id: user.id,
      text: text.trim(),
      song: song.trim() || null,
      image_url,
      visibility_user_ids: Array.from(selectedIds),
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    onPosted();
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <PenLine className="w-5 h-5 text-red-500" /> Post a Thought
          </h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto scrollbar-thin">
          {err && <div className="text-sm text-red-300 bg-red-950/50 border border-red-800 rounded-lg px-3 py-2">{err}</div>}
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Your thought</label>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4}
              placeholder="What's on your mind…"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 focus:border-red-600 outline-none resize-none" />
          </div>
          <div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) pickImage(f); e.target.value = ''; }} />
            {imagePreview ? (
              <div className="relative rounded-xl overflow-hidden border border-zinc-800">
                <img src={imagePreview} alt="preview" className="w-full max-h-48 object-cover" />
                <button type="button" onClick={removeImage}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()}
                className="flex items-center gap-2 w-full rounded-lg border border-dashed border-zinc-700 hover:border-red-600 bg-zinc-950 py-2.5 px-3 text-sm text-zinc-300 hover:text-white transition">
                <ImageIcon className="w-4 h-4 text-red-500" /> Add a photo (optional)
              </button>
            )}
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Song / vibe (optional)</label>
            <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded-lg px-3 focus-within:border-red-600 transition">
              <Music className="w-4 h-4 text-zinc-500 shrink-0" />
              <input value={song} onChange={(e) => setSong(e.target.value)} placeholder="e.g. Blinding Lights – The Weeknd"
                className="flex-1 bg-transparent py-2 text-sm text-white placeholder-zinc-500 outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Who can see this?</label>
            <p className="text-xs text-zinc-600 mb-2">Select specific followers — only they will see your thought</p>
            <FollowerPicker selectedIds={selectedIds} onChange={setSelectedIds} />
          </div>
          <button type="submit" disabled={busy || uploadingImage || !text.trim()}
            className="w-full rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-medium py-3 transition flex items-center justify-center gap-2">
            {(busy || uploadingImage) ? <><div className="w-4 h-4 border-2 border-white/40 border-t-transparent rounded-full animate-spin" /> Posting…</> : <><Send className="w-4 h-4" /> Post Thought</>}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Three-dots menu ───────────────────────────────────────────────
function DotsMenu({
  canDelete, onDelete, autoplay, onToggleAutoplay,
}: {
  canDelete: boolean;
  onDelete: () => void;
  autoplay: boolean;
  onToggleAutoplay: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0 z-[200]">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        className="w-8 h-8 rounded-full bg-black/50 backdrop-blur flex items-center justify-center text-white hover:bg-black/70 transition"
      >
        <MoreVertical className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-9 min-w-[160px] rounded-xl bg-zinc-900 border border-zinc-800 shadow-2xl overflow-hidden z-[200]">
          <button
            onClick={(e) => { e.stopPropagation(); onToggleAutoplay(); setOpen(false); }}
            className="flex items-center justify-between gap-2 w-full px-4 py-2.5 text-sm text-white hover:bg-zinc-800 transition"
          >
            <span className="flex items-center gap-2"><Repeat2 className="w-4 h-4 text-zinc-400" /> Autoplay</span>
            <span className={`w-8 h-4 rounded-full transition relative ${autoplay ? 'bg-red-600' : 'bg-zinc-700'}`}>
              <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${autoplay ? 'left-4' : 'left-0.5'}`} />
            </span>
          </button>
          {canDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); setOpen(false); onDelete(); }}
              className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-red-400 hover:bg-zinc-800 transition border-t border-zinc-800"
            >
              <Trash2 className="w-4 h-4" /> Delete post
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Share popup ───────────────────────────────────────────────────
function SharePopup({ reel, onClose }: { reel: Reel; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const url = reel.media_type === 'image' ? (reel.image_url || reel.video_url) : reel.video_url;

  async function copy() {
    try { await navigator.clipboard.writeText(url); } catch { /* fallback */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    await supabase.from('reels').update({ shares_count: reel.shares_count + 1 }).eq('id', reel.id);
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <Share2 className="w-4 h-4 text-red-500" /> Share
          </h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {reel.caption && <p className="text-sm text-zinc-300 line-clamp-2">{reel.caption}</p>}
          <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5">
            <span className="flex-1 text-xs text-zinc-400 truncate select-all">{url}</span>
            <button
              onClick={copy}
              className={`shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                copied ? 'bg-green-700 text-white' : 'bg-red-600 hover:bg-red-500 text-white'
              }`}
            >
              {copied ? <><CheckIcon className="w-3.5 h-3.5" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy link</>}
            </button>
          </div>
          <button onClick={onClose}
            className="w-full rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white py-2.5 text-sm font-medium transition flex items-center justify-center gap-2">
            <X className="w-4 h-4" /> Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Common top-bar (author + join + three-dots) ───────────────────
function ReelTopBar({
  reel, author, isOwn, isAdmin, following, canEngage,
  onFollow, onDelete, onOpenProfile, onOpenAuth, onMessage,
  autoplay = true, onToggleAutoplay,
  size = 'sm',
}: {
  reel: Reel;
  author?: Profile;
  isOwn: boolean;
  isAdmin: boolean;
  following: boolean;
  canEngage: boolean;
  onFollow: () => void;
  onDelete: () => void;
  onOpenProfile: (p: Profile) => void;
  onOpenAuth: () => void;
  onMessage: (uid: string) => void;
  autoplay?: boolean;
  onToggleAutoplay?: () => void;
  size?: 'sm' | 'md';
}) {
  const canDelete = isOwn || isAdmin;
  const avatarSize = size === 'md' ? 'w-10 h-10' : 'w-9 h-9';
  const { user } = useAuth();

  return (
    <div className="flex items-center gap-2 w-full">
      <button
        onClick={canEngage ? () => author && onOpenProfile(author) : onOpenAuth}
        className="flex items-center gap-2 min-w-0 flex-1"
      >
        <div className={`${avatarSize} rounded-full overflow-hidden border-2 border-white/80 shrink-0`}>
          {author?.avatar_url ? (
            <img src={author.avatar_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-white text-sm font-bold">
              {(author?.display_name || 'U').charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div className="text-left min-w-0">
          <p className="text-white font-semibold text-sm truncate drop-shadow">{author?.display_name || 'Creator'}</p>
          {author?.username && <p className="text-white/50 text-[10px]">@{author.username}</p>}
          <p className="text-white/60 text-[10px]">{timeAgo(reel.created_at)} ago</p>
        </div>
      </button>

      {/* Join button — show for non-owners */}
      {!isOwn && canEngage && (
        <button
          onClick={onFollow}
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition shadow-lg flex items-center gap-1 ${
            following
              ? 'bg-white/15 text-white border border-white/40 hover:bg-white/25'
              : 'bg-red-600 text-white hover:bg-red-500'
          }`}
        >
          {following ? (
            'Joined'
          ) : (
            <><UserPlus className="w-3 h-3" /> Join</>
          )}
        </button>
      )}

      {!isOwn && !canEngage && (
        <button onClick={onOpenAuth} className="shrink-0 rounded-full px-3 py-1.5 text-xs font-bold bg-red-600 text-white hover:bg-red-500 transition shadow-lg flex items-center gap-1">
          <UserPlus className="w-3 h-3" /> Join
        </button>
      )}

      {/* Message button for followed users */}
      {!isOwn && canEngage && following && user && author && (
        <button
          onClick={() => onMessage(author.id)}
          className="shrink-0 w-8 h-8 rounded-full bg-black/50 backdrop-blur flex items-center justify-center text-white hover:bg-black/70 transition"
          title="Message"
        >
          <MessageCircle className="w-4 h-4" />
        </button>
      )}

      <DotsMenu canDelete={canDelete} onDelete={onDelete} autoplay={autoplay} onToggleAutoplay={onToggleAutoplay ?? (() => {})} />
    </div>
  );
}

// ── Reel card (feed) ──────────────────────────────────────────────
function ReelCard({
  reel, author, isOwn, isAdmin, liked, saved, following, canEngage,
  autoplay, onLike, onSave, onShare, onFollow, onComment, onOpenAuth, onOpenProfile, onOpenReel, onDelete, onMessage, onToggleAutoplay,
}: ReelCardProps) {
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isImage = reel.media_type === 'image';

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    v.paused ? (v.play(), setPlaying(true)) : (v.pause(), setPlaying(false));
  }

  function handleEnded() {
    if (autoplay) {
      // scroll to next sibling card
      const container = containerRef.current?.parentElement;
      const cards = container ? Array.from(container.querySelectorAll('[data-reel-card]')) : [];
      const idx = cards.indexOf(containerRef.current as Element);
      const next = cards[idx + 1] as HTMLElement | undefined;
      if (next) next.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  return (
    <div ref={containerRef} data-reel-card className="relative w-full max-w-[420px] aspect-[9/16] rounded-2xl overflow-hidden bg-black border border-zinc-800 shadow-xl">
      {isImage ? (
        <img src={reel.image_url || reel.video_url} alt={reel.caption}
          onClick={onOpenReel}
          className="absolute inset-0 w-full h-full object-cover cursor-pointer" />
      ) : (
        <video ref={videoRef} src={reel.video_url} poster={reel.thumbnail_url || undefined}
          loop={!autoplay} muted={muted} playsInline preload="metadata" onClick={togglePlay}
          onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
          onEnded={handleEnded}
          className="absolute inset-0 w-full h-full object-cover" />
      )}

      {!isImage && !playing && (
        <button onClick={togglePlay} className="absolute inset-0 flex items-center justify-center">
          <span className="w-14 h-14 rounded-full bg-black/50 backdrop-blur flex items-center justify-center">
            <Play className="w-7 h-7 text-white fill-white" />
          </span>
        </button>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/40 pointer-events-none" />

      <div className="absolute top-3 left-3 right-3 z-[50]">
        <ReelTopBar reel={reel} author={author} isOwn={isOwn} isAdmin={isAdmin}
          following={following} canEngage={canEngage}
          onFollow={onFollow} onDelete={onDelete}
          onOpenProfile={onOpenProfile} onOpenAuth={onOpenAuth} onMessage={onMessage}
          autoplay={autoplay} onToggleAutoplay={onToggleAutoplay} />
      </div>

      {!isImage && (
        <button onClick={() => setMuted((m) => !m)}
          className="absolute top-16 right-3 w-9 h-9 rounded-full bg-black/50 backdrop-blur flex items-center justify-center text-white text-[10px] font-bold z-10">
          {muted ? 'Mute' : 'Sound'}
        </button>
      )}

      <button onClick={onOpenReel} className="absolute left-0 right-16 bottom-0 p-4 text-left z-10">
        <p className="text-white text-sm line-clamp-2">{reel.caption}</p>
        {reel.hashtags && reel.hashtags.length > 0 && (
          <p className="text-red-300 text-xs mt-1 line-clamp-1">{reel.hashtags.map((h) => `#${h}`).join(' ')}</p>
        )}
        <div className="flex items-center gap-1 text-white/60 text-[11px] mt-1.5">
          <Music2 className="w-3 h-3" /> Original audio
        </div>
      </button>

      <div className="absolute right-3 bottom-20 flex flex-col items-center gap-5 z-10">
        <ActionBtn active={liked} onClick={onLike} icon={<ThumbsUp className={`w-7 h-7 ${liked ? 'fill-red-500' : ''}`} />} count={reel.likes_count} />
        <ActionBtn onClick={onComment} icon={<MessageCircle className="w-7 h-7" />} count={reel.comments_count} />
        <ActionBtn onClick={onShare} icon={<Share2 className="w-7 h-7" />} count={reel.shares_count} />
        <ActionBtn active={saved} onClick={onSave} icon={<Bookmark className={`w-7 h-7 ${saved ? 'fill-white' : ''}`} />} count={reel.saves_count} />
      </div>
    </div>
  );
}

// ── Full-screen view ──────────────────────────────────────────────
function FullReelView({
  reel, author, isOwn, isAdmin, liked, saved, following, canEngage,
  autoplay, onLike, onSave, onShare, onFollow, onComment, onOpenAuth, onOpenProfile, onClose, onDelete, onMessage, onToggleAutoplay,
}: ReelCardProps & { onClose: () => void }) {
  const [muted, setMuted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const isImage = reel.media_type === 'image';

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    v.paused ? (v.play(), setPlaying(true)) : (v.pause(), setPlaying(false));
  }

  return (
    <div className="fixed inset-0 z-[110] bg-black flex items-center justify-center" onClick={onClose}>
      <button onClick={onClose}
        className="absolute top-4 left-4 z-20 w-10 h-10 rounded-full bg-black/50 backdrop-blur flex items-center justify-center text-white hover:bg-black/70 transition">
        <X className="w-5 h-5" />
      </button>

      <div className="relative w-full max-w-[420px] h-full max-h-screen flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
        {isImage ? (
          <img src={reel.image_url || reel.video_url} alt={reel.caption} className="max-h-full max-w-full object-contain" />
        ) : (
          <video ref={videoRef} src={reel.video_url} poster={reel.thumbnail_url || undefined}
            loop autoPlay muted={muted} playsInline onClick={togglePlay}
            onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
            className="max-h-full max-w-full object-contain" />
        )}

        {!isImage && !playing && (
          <button onClick={togglePlay} className="absolute inset-0 flex items-center justify-center">
            <span className="w-16 h-16 rounded-full bg-black/50 backdrop-blur flex items-center justify-center">
              <Play className="w-8 h-8 text-white fill-white" />
            </span>
          </button>
        )}

        {!isImage && (
          <button onClick={() => setMuted((m) => !m)}
            className="absolute top-20 right-4 w-9 h-9 rounded-full bg-black/50 backdrop-blur flex items-center justify-center text-white text-[10px] font-bold z-10">
            {muted ? 'Mute' : 'Sound'}
          </button>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none" />

        <div className="absolute top-16 left-3 right-3 z-[50]">
          <ReelTopBar reel={reel} author={author} isOwn={isOwn} isAdmin={isAdmin}
            following={following} canEngage={canEngage} size="md"
            onFollow={onFollow} onDelete={onDelete}
            onOpenProfile={onOpenProfile} onOpenAuth={onOpenAuth} onMessage={onMessage}
            autoplay={autoplay} onToggleAutoplay={onToggleAutoplay} />
        </div>

        <div className="absolute left-0 right-16 bottom-4 p-4 z-10">
          <p className="text-white text-sm">{reel.caption}</p>
          {reel.description && <p className="text-white/70 text-xs mt-1 line-clamp-3">{reel.description}</p>}
          {reel.hashtags && reel.hashtags.length > 0 && (
            <p className="text-red-300 text-xs mt-1.5">{reel.hashtags.map((h) => `#${h}`).join(' ')}</p>
          )}
        </div>

        <div className="absolute right-3 bottom-20 flex flex-col items-center gap-5 z-10">
          <ActionBtn active={liked} onClick={onLike} icon={<ThumbsUp className={`w-7 h-7 ${liked ? 'fill-red-500' : ''}`} />} count={reel.likes_count} />
          <ActionBtn onClick={() => setShowComments(true)} icon={<MessageCircle className="w-7 h-7" />} count={reel.comments_count} />
          <ActionBtn onClick={onShare} icon={<Share2 className="w-7 h-7" />} count={reel.shares_count} />
          <ActionBtn active={saved} onClick={onSave} icon={<Bookmark className={`w-7 h-7 ${saved ? 'fill-white' : ''}`} />} count={reel.saves_count} />
        </div>
      </div>
      {showComments && <CommentsDrawer reelId={reel.id} onClose={() => setShowComments(false)} />}
    </div>
  );
}

// autoplay prop isn't used in FullReelView because it opens a single reel;
// the feed ReelCard uses it to decide whether to loop or advance

export function StandaloneReelView({ reel, onClose }: { reel: Reel; onClose: () => void }) {
  const { user, profile } = useAuth();
  const [author, setAuthor] = useState<Profile | null>(null);
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [following, setFollowing] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [shareReel, setShareReel] = useState(false);
  const [curReel, setCurReel] = useState(reel);
  const [muted, setMuted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const isImage = curReel.media_type === 'image';

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('profiles').select('*').eq('id', reel.author_id).maybeSingle();
      if (data) setAuthor(data as Profile);
      if (user) {
        const [l, s, f] = await Promise.all([
          supabase.from('reel_likes').select('reel_id').eq('reel_id', reel.id).eq('user_id', user.id).maybeSingle(),
          supabase.from('reel_saves').select('reel_id').eq('reel_id', reel.id).eq('user_id', user.id).maybeSingle(),
          supabase.from('follows').select('following_id').eq('follower_id', user.id).eq('following_id', reel.author_id).maybeSingle(),
        ]);
        setLiked(!!l.data);
        setSaved(!!s.data);
        setFollowing(!!f.data);
      }
    })();
  }, [reel, user]);

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    v.paused ? (v.play(), setPlaying(true)) : (v.pause(), setPlaying(false));
  }

  async function onLike() {
    if (!user) return;
    setLiked((p) => !p);
    setCurReel((r) => ({ ...r, likes_count: Math.max(0, r.likes_count + (liked ? -1 : 1)) }));
    if (liked) await supabase.from('reel_likes').delete().eq('reel_id', reel.id).eq('user_id', user.id);
    else await supabase.from('reel_likes').insert({ reel_id: reel.id, user_id: user.id });
  }

  async function onSave() {
    if (!user) return;
    setSaved((p) => !p);
    setCurReel((r) => ({ ...r, saves_count: Math.max(0, r.saves_count + (saved ? -1 : 1)) }));
    if (saved) await supabase.from('reel_saves').delete().eq('reel_id', reel.id).eq('user_id', user.id);
    else await supabase.from('reel_saves').insert({ reel_id: reel.id, user_id: user.id });
  }

  async function onFollow() {
    if (!user) return;
    const wasFollowing = following;
    setFollowing((p) => !p);
    setAuthor((a) => a ? { ...a, joins_count: Math.max(0, (a.joins_count ?? 0) + (wasFollowing ? -1 : 1)) } : a);
    if (wasFollowing) {
      await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', reel.author_id);
    } else {
      await supabase.from('follows').insert({ follower_id: user.id, following_id: reel.author_id });
    }
  }

  async function onDelete() {
    if (!user) return;
    const canDelete = user.id === reel.author_id || profile?.is_admin;
    if (!canDelete) return;
    if (!confirm('Delete this post? This cannot be undone.')) return;
    try {
      const mediaUrl = reel.media_type === 'image' ? (reel.image_url || reel.video_url) : reel.video_url;
      const u = new URL(mediaUrl);
      const parts = u.pathname.split('/reels/');
      if (parts[1]) await supabase.storage.from('reels').remove([parts[1]]);
    } catch { /* ignore */ }
    await supabase.from('reels').delete().eq('id', reel.id);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[115] bg-black flex items-center justify-center" onClick={onClose}>
      <button onClick={onClose}
        className="absolute top-4 left-4 z-20 w-10 h-10 rounded-full bg-black/50 backdrop-blur flex items-center justify-center text-white hover:bg-black/70 transition">
        <X className="w-5 h-5" />
      </button>

      <div className="relative w-full max-w-[420px] h-full max-h-screen flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
        {isImage ? (
          <img src={curReel.image_url || curReel.video_url} alt={curReel.caption} className="max-h-full max-w-full object-contain" />
        ) : (
          <video ref={videoRef} src={curReel.video_url} poster={curReel.thumbnail_url || undefined}
            loop autoPlay muted={muted} playsInline onClick={togglePlay}
            onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
            className="max-h-full max-w-full object-contain" />
        )}

        {!isImage && !playing && (
          <button onClick={togglePlay} className="absolute inset-0 flex items-center justify-center">
            <span className="w-16 h-16 rounded-full bg-black/50 backdrop-blur flex items-center justify-center">
              <Play className="w-8 h-8 text-white fill-white" />
            </span>
          </button>
        )}

        {!isImage && (
          <button onClick={() => setMuted((m) => !m)}
            className="absolute top-20 right-4 w-9 h-9 rounded-full bg-black/50 backdrop-blur flex items-center justify-center text-white text-[10px] font-bold z-10">
            {muted ? 'Mute' : 'Sound'}
          </button>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none" />

        <div className="absolute top-16 left-3 right-3 z-[50]">
          <ReelTopBar reel={curReel} author={author ?? undefined} isOwn={user?.id === reel.author_id}
            isAdmin={!!profile?.is_admin} following={following} canEngage={!!user}
            size="md" onFollow={onFollow} onDelete={onDelete}
            onOpenProfile={() => {}} onOpenAuth={() => {}} onMessage={() => {}} />
        </div>

        <div className="absolute left-0 right-16 bottom-4 p-4 z-10">
          <p className="text-white text-sm">{curReel.caption}</p>
          {curReel.description && <p className="text-white/70 text-xs mt-1 line-clamp-3">{curReel.description}</p>}
          {curReel.hashtags && curReel.hashtags.length > 0 && (
            <p className="text-red-300 text-xs mt-1.5">{curReel.hashtags.map((h) => `#${h}`).join(' ')}</p>
          )}
        </div>

        <div className="absolute right-3 bottom-20 flex flex-col items-center gap-5 z-10">
          <ActionBtn active={liked} onClick={onLike} icon={<ThumbsUp className={`w-7 h-7 ${liked ? 'fill-red-500' : ''}`} />} count={curReel.likes_count} />
          <ActionBtn onClick={() => setShowComments(true)} icon={<MessageCircle className="w-7 h-7" />} count={curReel.comments_count} />
          <ActionBtn onClick={() => setShareReel(true)} icon={<Share2 className="w-7 h-7" />} count={curReel.shares_count} />
          <ActionBtn active={saved} onClick={onSave} icon={<Bookmark className={`w-7 h-7 ${saved ? 'fill-white' : ''}`} />} count={curReel.saves_count} />
        </div>
      </div>

      {showComments && <CommentsDrawer reelId={reel.id} onClose={() => setShowComments(false)} />}
      {shareReel && <SharePopup reel={curReel} onClose={() => setShareReel(false)} />}
    </div>
  );
}

type ReelCardProps = {
  reel: Reel;
  author?: Profile;
  isOwn: boolean;
  isAdmin: boolean;
  liked: boolean;
  saved: boolean;
  following: boolean;
  canEngage: boolean;
  autoplay: boolean;
  onLike: () => void;
  onSave: () => void;
  onShare: () => void;
  onFollow: () => void;
  onComment: () => void;
  onOpenAuth: () => void;
  onOpenProfile: (p: Profile) => void;
  onOpenReel: () => void;
  onDelete: () => void;
  onMessage: (uid: string) => void;
  onToggleAutoplay: () => void;
};

function ActionBtn({ icon, count, active, onClick }: { icon: React.ReactNode; count?: number; active?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1">
      <span className={`transition ${active ? 'text-red-500' : 'text-white'} hover:scale-110 active:scale-95`}>{icon}</span>
      {count !== undefined && <span className="text-white text-xs font-semibold">{compactNum(count)}</span>}
    </button>
  );
}

// ── Privacy Selector ──────────────────────────────────────────────
function PrivacySelector({ value, onChange }: { value: Visibility; onChange: (v: Visibility) => void }) {
  const opts: { v: Visibility; label: string; icon: React.ReactNode; desc: string }[] = [
    { v: 'public', label: 'Public', icon: <Globe className="w-4 h-4" />, desc: 'Anyone can see this post' },
    { v: 'private', label: 'Private', icon: <Lock className="w-4 h-4" />, desc: 'Only you can see this post' },
    { v: 'selected', label: 'Select people', icon: <Users className="w-4 h-4" />, desc: 'Hand-pick who can see' },
  ];
  return (
    <div className="space-y-2">
      <p className="text-xs text-zinc-400">Who can see this?</p>
      <div className="grid grid-cols-3 gap-2">
        {opts.map(({ v, label, icon, desc }) => (
          <button key={v} type="button" onClick={() => onChange(v)}
            className={`flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3 text-xs font-medium transition ${
              value === v
                ? 'border-red-600 bg-red-950/40 text-red-300'
                : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700'
            }`}>
            {icon}
            <span>{label}</span>
            <span className="text-[10px] text-center opacity-70 leading-tight">{desc}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Follower Picker ───────────────────────────────────────────────
function FollowerPicker({
  selectedIds, onChange,
}: {
  selectedIds: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  const { user } = useAuth();
  const [followers, setFollowers] = useState<Profile[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      // Load people the current user follows
      const { data: fData } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id);
      const ids = ((fData as { following_id: string }[]) ?? []).map((f) => f.following_id);
      if (ids.length === 0) { setLoading(false); return; }
      const { data } = await supabase.from('profiles').select('*').in('id', ids);
      setFollowers((data as Profile[]) ?? []);
      setLoading(false);
    })();
  }, [user]);

  const filtered = followers.filter((p) => {
    const q = search.toLowerCase();
    return (p.display_name || '').toLowerCase().includes(q) || (p.username || '').toLowerCase().includes(q);
  });

  function toggleOne(id: string) {
    const n = new Set(selectedIds);
    n.has(id) ? n.delete(id) : n.add(id);
    onChange(n);
  }

  const filteredIds = filtered.map((p) => p.id);
  const allSelected = filteredIds.length > 0 && filteredIds.every((id) => selectedIds.has(id));

  function toggleSelectAll() {
    const n = new Set(selectedIds);
    if (allSelected) filteredIds.forEach((id) => n.delete(id));
    else filteredIds.forEach((id) => n.add(id));
    onChange(n);
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search people you follow…"
          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-red-600 outline-none"
        />
      </div>
      {!loading && filtered.length > 0 && (
        <button type="button" onClick={toggleSelectAll}
          className="flex items-center gap-2 text-xs text-zinc-300 hover:text-white transition px-1">
          <span className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${allSelected ? 'border-red-500 bg-red-600' : 'border-zinc-600'}`}>
            {allSelected && <CheckIcon className="w-2.5 h-2.5 text-white" />}
          </span>
          Select all {filtered.length ? `(${filtered.length})` : ''}
        </button>
      )}
      <div className="max-h-48 overflow-y-auto space-y-1">
        {loading ? (
          <p className="text-zinc-600 text-xs text-center py-4">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-zinc-600 text-xs text-center py-4">
            {followers.length === 0 ? "You're not following anyone yet" : 'No matches'}
          </p>
        ) : (
          filtered.map((p) => {
            const checked = selectedIds.has(p.id);
            return (
              <button key={p.id} type="button" onClick={() => toggleOne(p.id)}
                className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg transition ${checked ? 'bg-red-950/40 border border-red-800' : 'bg-zinc-950 border border-transparent hover:border-zinc-800'}`}>
                <div className="w-8 h-8 rounded-full overflow-hidden shrink-0">
                  {p.avatar_url ? (
                    <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-white text-xs font-bold">
                      {(p.display_name || 'U').charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-white text-xs font-medium truncate">{p.display_name}</p>
                  {p.username && <p className="text-zinc-500 text-[10px]">@{p.username}</p>}
                </div>
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition ${checked ? 'border-red-500 bg-red-600' : 'border-zinc-600'}`}>
                  {checked && <CheckIcon className="w-3 h-3 text-white" />}
                </div>
              </button>
            );
          })
        )}
      </div>
      {selectedIds.size > 0 && (
        <p className="text-xs text-red-400 text-center">{selectedIds.size} person{selectedIds.size !== 1 ? 's' : ''} selected</p>
      )}
    </div>
  );
}

// ── Upload modal ──────────────────────────────────────────────────
function UploadModal({ onClose, needsProfessional, onEnableProfessional, onPosted }: {
  onClose: () => void;
  needsProfessional: boolean;
  onEnableProfessional: () => Promise<void>;
  onPosted: () => Promise<void>;
}) {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [mediaType, setMediaType] = useState<'video' | 'image'>('video');
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [description, setDescription] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [enabling, setEnabling] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showFollowerPicker, setShowFollowerPicker] = useState(false);
  const [showCopyright, setShowCopyright] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function pickFile(f: File | null) {
    if (!f) return;
    if (f.type.startsWith('video/')) { setMediaType('video'); }
    else if (f.type.startsWith('image/')) { setMediaType('image'); }
    else { setErr('Please select a video or image file'); return; }
    setErr(null);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  function handlePostClick(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !user) { setErr('Select a file to upload'); return; }
    setShowPrivacy(true);
  }

  function handlePrivacyNext() {
    setShowPrivacy(false);
    if (visibility === 'selected') {
      setShowFollowerPicker(true);
    } else {
      setShowCopyright(true);
    }
  }

  async function confirmedPost() {
    if (!file || !user) return;
    setShowCopyright(false);
    setBusy(true);
    const ext = file.name.split('.').pop()?.toLowerCase() || (mediaType === 'image' ? 'jpg' : 'mp4');
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('reels').upload(path, file, { contentType: file.type });
    if (upErr) { setErr(upErr.message); setBusy(false); return; }
    const { data: pub } = supabase.storage.from('reels').getPublicUrl(path);
    const mediaUrl = pub.publicUrl;
    const tags = hashtags.split(/[\s,#]+/).map((t) => t.trim()).filter(Boolean).slice(0, 20);
    const payload: Record<string, unknown> = {
      author_id: user.id, caption: caption.trim(), description: description.trim(),
      hashtags: tags, media_type: mediaType,
      video_url: mediaUrl,
      visibility,
      visibility_user_ids: visibility === 'selected' ? Array.from(selectedUserIds) : [],
      ...(mediaType === 'image' ? { image_url: mediaUrl } : {}),
    };
    const { error } = await supabase.from('reels').insert(payload);
    setBusy(false);
    if (error) { setErr(error.message); return; }
    if (preview) URL.revokeObjectURL(preview);
    await onPosted();
  }

  function reset() {
    setFile(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setCaption(''); setDescription(''); setHashtags(''); setErr(null);
  }

  const visibilityIcons: Record<Visibility, React.ReactNode> = {
    public: <Globe className="w-3.5 h-3.5" />,
    private: <Lock className="w-3.5 h-3.5" />,
    selected: <Users className="w-3.5 h-3.5" />,
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <h2 className="text-lg font-semibold text-white">Post a {mediaType === 'image' && file ? 'Photo' : 'Reel'}</h2>
          <button onClick={() => { reset(); onClose(); }} className="text-zinc-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6">
          {err && <div className="mb-4 text-sm text-red-300 bg-red-950/50 border border-red-800 rounded-lg px-3 py-2">{err}</div>}
          {needsProfessional ? (
            <div className="text-center py-6">
              <div className="w-14 h-14 rounded-2xl bg-red-950/40 border border-red-800 flex items-center justify-center mx-auto mb-4">
                <Lock className="w-7 h-7 text-red-500" />
              </div>
              <p className="text-white font-semibold">Professional Mode required</p>
              <p className="text-zinc-400 text-sm mt-1 max-w-xs mx-auto">Turn on Professional Mode to start posting reels and photos.</p>
              <button onClick={async () => { setEnabling(true); await onEnableProfessional(); setEnabling(false); }}
                disabled={enabling}
                className="mt-5 rounded-full bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-medium px-5 py-2.5 transition">
                {enabling ? 'Enabling…' : 'Turn on Professional Mode'}
              </button>
            </div>
          ) : (
            <form onSubmit={handlePostClick} className="space-y-4">
              <input ref={fileRef} type="file" accept="video/*,image/*" onChange={(e) => pickFile(e.target.files?.[0] ?? null)} className="hidden" />
              {!file ? (
                <button type="button" onClick={() => fileRef.current?.click()}
                  className="w-full rounded-xl border-2 border-dashed border-zinc-700 hover:border-red-600 bg-zinc-950 transition py-10 flex flex-col items-center gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-red-950/50 border border-red-800 flex items-center justify-center"><Film className="w-5 h-5 text-red-500" /></div>
                    <div className="w-10 h-10 rounded-full bg-red-950/50 border border-red-800 flex items-center justify-center"><ImageIcon className="w-5 h-5 text-red-500" /></div>
                  </div>
                  <p className="text-white font-medium text-sm">Select video or photo from your device</p>
                  <p className="text-zinc-500 text-xs">MP4, WebM, MOV, JPG, PNG</p>
                </button>
              ) : (
                <div className="rounded-xl overflow-hidden bg-black border border-zinc-800">
                  {mediaType === 'image' ? (
                    <img src={preview || undefined} alt="preview" className="w-full max-h-48 object-contain" />
                  ) : (
                    <video src={preview || undefined} controls className="w-full max-h-48 object-contain" />
                  )}
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-xs text-zinc-400 truncate flex items-center gap-1.5">
                      {mediaType === 'image' ? <ImageIcon className="w-3.5 h-3.5" /> : <Film className="w-3.5 h-3.5" />} {file.name}
                    </span>
                    <button type="button" onClick={() => { setFile(null); if (preview) URL.revokeObjectURL(preview); setPreview(null); }}
                      className="text-xs text-red-400 hover:text-red-300">Change</button>
                  </div>
                </div>
              )}
              <label className="block">
                <span className="block text-xs text-zinc-400 mb-1">Caption</span>
                <input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Short caption…"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-red-600 outline-none" />
              </label>
              <label className="block">
                <span className="block text-xs text-zinc-400 mb-1">Description</span>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Tell viewers more…"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-red-600 outline-none resize-none" />
              </label>
              <label className="block">
                <span className="block text-xs text-zinc-400 mb-1">Hashtags</span>
                <input value={hashtags} onChange={(e) => setHashtags(e.target.value)} placeholder="ai, coding, music"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-red-600 outline-none" />
              </label>
              <button type="submit" disabled={busy || !file}
                className="w-full rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-medium py-2.5 transition flex items-center justify-center gap-2">
                {busy ? (
                  <><div className="w-4 h-4 border-2 border-white/40 border-t-transparent rounded-full animate-spin" /> Uploading…</>
                ) : (
                  <><span className="flex items-center gap-1.5">{visibilityIcons[visibility]}</span> Next: Choose Audience</>
                )}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Privacy popup */}
      {showPrivacy && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4" onClick={() => setShowPrivacy(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800">
              <h3 className="font-semibold text-white">Who can see this?</h3>
              <button onClick={() => setShowPrivacy(false)} className="text-zinc-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <PrivacySelector value={visibility} onChange={setVisibility} />
              <div className="flex gap-2">
                <button onClick={() => setShowPrivacy(false)} className="flex-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white py-2.5 text-sm font-medium transition">Back</button>
                <button onClick={handlePrivacyNext} className="flex-1 rounded-lg bg-red-600 hover:bg-red-500 text-white py-2.5 text-sm font-bold transition">
                  {visibility === 'selected' ? 'Pick people' : 'Continue'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Follower picker popup (for "selected" visibility) */}
      {showFollowerPicker && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4" onClick={() => setShowFollowerPicker(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-red-500" /> Choose who can see
              </h3>
              <button onClick={() => setShowFollowerPicker(false)} className="text-zinc-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-xs text-zinc-500">Select people from who you follow. Only they will see this post.</p>
              <FollowerPicker
                selectedIds={selectedUserIds}
                onChange={setSelectedUserIds}
              />
              <div className="flex gap-2">
                <button onClick={() => { setShowFollowerPicker(false); setShowPrivacy(true); }} className="flex-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white py-2.5 text-sm font-medium transition">Back</button>
                <button
                  onClick={() => { setShowFollowerPicker(false); setShowCopyright(true); }}
                  disabled={selectedUserIds.size === 0}
                  className="flex-1 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white py-2.5 text-sm font-bold transition"
                >
                  Continue ({selectedUserIds.size})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Copyright popup */}
      {showCopyright && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4" onClick={() => setShowCopyright(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 px-5 py-4 border-b border-zinc-800">
              <div className="w-10 h-10 rounded-xl bg-amber-950/50 border border-amber-800 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              </div>
              <h3 className="font-semibold text-white">Before you post</h3>
            </div>
            <div className="p-5">
              <p className="text-white font-semibold text-sm">Do not use copyrighted songs</p>
              <p className="text-zinc-400 text-sm mt-2">Only use original audio or royalty-free / non-copyrighted music. You are responsible for the content you post.</p>
              <div className="mt-3 flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2">
                {visibilityIcons[visibility]}
                <span className="text-zinc-300 text-xs capitalize">{visibility === 'selected' ? 'Followers only' : visibility}</span>
              </div>
              <div className="flex gap-2 mt-5">
                <button onClick={() => setShowCopyright(false)} className="flex-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white py-2.5 text-sm font-medium transition">Cancel</button>
                <button onClick={confirmedPost} disabled={busy}
                  className="flex-1 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white py-2.5 text-sm font-bold transition flex items-center justify-center gap-1.5">
                  {busy ? <><div className="w-4 h-4 border-2 border-white/40 border-t-transparent rounded-full animate-spin" /> Uploading…</> : <><Send className="w-4 h-4" /> I agree, post</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Comments drawer ───────────────────────────────────────────────
function CommentsDrawer({ reelId, onClose }: { reelId: string; onClose: () => void }) {
  const { user, profile } = useAuth();
  const [comments, setComments] = useState<ReelComment[]>([]);
  const [authors, setAuthors] = useState<Record<string, Profile>>({});
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('reel_comments').select('*').eq('reel_id', reelId).order('created_at', { ascending: false });
      const cs = (data as ReelComment[]) ?? [];
      setComments(cs);
      const ids = [...new Set(cs.map((c) => c.user_id))];
      if (ids.length) {
        const { data: ps } = await supabase.from('profiles').select('*').in('id', ids);
        if (ps) {
          const m: Record<string, Profile> = {};
          for (const p of ps as Profile[]) m[p.id] = p;
          setAuthors(m);
        }
      }
      setLoading(false);
    })();
  }, [reelId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || !user) return;
    const { data, error } = await supabase.from('reel_comments')
      .insert({ reel_id: reelId, user_id: user.id, text: text.trim() })
      .select('*').maybeSingle();
    if (error || !data) return;
    setComments((prev) => [data as ReelComment, ...prev]);
    setText('');
  }

  async function del(id: string) {
    await supabase.from('reel_comments').delete().eq('id', id).eq('user_id', user!.id);
    setComments((prev) => prev.filter((c) => c.id !== id));
  }

  return (
    <div className="fixed inset-0 z-[130] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full sm:max-w-md max-h-[80vh] rounded-t-2xl sm:rounded-2xl bg-zinc-900 border border-zinc-800 flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800">
          <h3 className="font-semibold text-white">Comments</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
          {loading ? (
            <p className="text-zinc-500 text-sm text-center py-8">Loading…</p>
          ) : comments.length === 0 ? (
            <p className="text-zinc-500 text-sm text-center py-8">No comments yet. Be the first!</p>
          ) : (
            comments.map((c) => {
              const a = authors[c.user_id];
              const own = user?.id === c.user_id;
              return (
                <div key={c.id} className="flex gap-2.5 group">
                  <div className="w-8 h-8 rounded-full overflow-hidden shrink-0">
                    {a?.avatar_url ? (
                      <img src={a.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-white text-xs font-bold">
                        {(a?.display_name || 'U').charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="bg-zinc-800/70 rounded-2xl px-3 py-2">
                      <p className="text-xs font-semibold text-white">{a?.display_name || 'User'}</p>
                      <p className="text-sm text-zinc-200 break-words">{c.text}</p>
                    </div>
                    <div className="flex items-center gap-3 mt-1 px-2">
                      <span className="text-[11px] text-zinc-500">{timeAgo(c.created_at)} ago</span>
                      {own && (
                        <button onClick={() => del(c.id)} className="text-[11px] text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition">Delete</button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
        {user ? (
          <form onSubmit={submit} className="p-3 border-t border-zinc-800 flex gap-2 items-center">
            <div className="w-8 h-8 rounded-full overflow-hidden shrink-0">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-white text-xs font-bold">
                  {(profile?.display_name || 'U').charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a comment…"
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-full px-4 py-2 text-sm text-white placeholder-zinc-500 focus:border-red-600 outline-none" />
            <button type="submit" disabled={!text.trim()} className="text-red-500 font-semibold text-sm disabled:opacity-40">Post</button>
          </form>
        ) : (
          <div className="p-3 border-t border-zinc-800 text-center text-sm text-zinc-500">Sign in to comment.</div>
        )}
      </div>
    </div>
  );
}