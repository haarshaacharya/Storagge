import { useEffect, useRef, useState, useCallback } from 'react';
import {
  ThumbsUp, MessageCircle, Bookmark, Share2, Plus, Lock, Music2,
  X, Play, Upload, Film, Image as ImageIcon, Trash2, AlertTriangle, Send,
  MoreVertical, Copy, Check as CheckIcon,
} from 'lucide-react';
import { supabase, type Reel, type ReelComment, type Profile, timeAgo, compactNum } from '../lib/supabase';
import { useAuth } from '../lib/auth';

const PAGE = 6;

export default function ReelsView({ onOpenAuth, onOpenProfile }: { onOpenAuth: () => void; onOpenProfile: (p: Profile) => void }) {
  const { user, profile, refreshProfile } = useAuth();
  const [reels, setReels] = useState<Reel[]>([]);
  const [authors, setAuthors] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [showComments, setShowComments] = useState<string | null>(null);
  const [openReel, setOpenReel] = useState<Reel | null>(null);
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [shareReel, setShareReel] = useState<Reel | null>(null);

  const loadReels = useCallback(async (before?: string) => {
    let q = supabase.from('reels').select('*').order('created_at', { ascending: false }).limit(PAGE);
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

  useEffect(() => {
    (async () => {
      setLoading(true);
      const rs = await loadReels();
      setReels(rs);
      if (rs.length < PAGE) setHasMore(false);
      setCursor(rs.length ? rs[rs.length - 1].created_at : null);
      await Promise.all([loadAuthors(rs), loadEngagement(rs)]);
      setLoading(false);
    })();
  }, [loadReels, loadAuthors, loadEngagement]);

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
      try { await supabase.rpc('decrement_joins', { uid: authorId }); } catch { /* ignore */ }
    } else {
      await supabase.from('follows').insert({ follower_id: user.id, following_id: authorId });
      try { await supabase.rpc('increment_joins', { uid: authorId }); } catch { /* ignore */ }
    }
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
    onLike: () => toggleLike(reel),
    onSave: () => toggleSave(reel),
    onShare: () => setShareReel(reel),
    onFollow: () => toggleFollow(reel.author_id),
    onComment: () => user ? setShowComments(reel.id) : onOpenAuth(),
    onOpenAuth,
    onOpenProfile,
    onOpenReel: () => setOpenReel(reel),
    onDelete: () => deleteReel(reel),
  });

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const canUpload = user && profile?.professional_mode;

  return (
    <div className="relative">
      {user && (
        canUpload ? (
          <button onClick={() => setShowUpload(true)}
            className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-red-600 hover:bg-red-500 text-white shadow-2xl shadow-red-900/50 flex items-center justify-center transition hover:scale-105"
            title="Post a reel or photo">
            <Plus className="w-6 h-6" />
          </button>
        ) : (
          <button onClick={() => setShowUpload(true)}
            className="fixed bottom-6 right-6 z-40 px-4 h-12 rounded-full bg-zinc-900 border border-red-700/50 text-red-400 text-sm font-medium shadow-xl flex items-center gap-2"
            title="Enable professional mode to post">
            <Lock className="w-4 h-4" /> Turn on Professional Mode
          </button>
        )
      )}

      {reels.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4">
            <Play className="w-7 h-7 text-zinc-600" />
          </div>
          <p className="text-zinc-400 font-medium">No posts yet</p>
          <p className="text-zinc-600 text-sm mt-1">
            {user ? 'Turn on professional mode and post the first reel or photo.' : 'Posts will appear here once creators post.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 pb-20">
          {reels.map((reel) => <ReelCard key={reel.id} {...cardProps(reel)} />)}
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

// ── Three-dots menu ───────────────────────────────────────────────
function DotsMenu({ canDelete, onDelete }: { canDelete: boolean; onDelete: () => void }) {
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
        <div className="absolute right-0 top-9 min-w-[140px] rounded-xl bg-zinc-900 border border-zinc-800 shadow-2xl overflow-hidden z-[200]">
          {canDelete ? (
            <button
              onClick={(e) => { e.stopPropagation(); setOpen(false); onDelete(); }}
              className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-red-400 hover:bg-zinc-800 transition"
            >
              <Trash2 className="w-4 h-4" /> Delete post
            </button>
          ) : (
            <div className="px-4 py-2.5 text-xs text-zinc-500">No actions</div>
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
          <p className="text-xs text-zinc-600 text-center">Copy the link and share it with anyone</p>
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
  onFollow, onDelete, onOpenProfile, onOpenAuth,
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
  size?: 'sm' | 'md';
}) {
  const canDelete = isOwn || isAdmin;
  const avatarSize = size === 'md' ? 'w-10 h-10' : 'w-9 h-9';

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
          <p className="text-white/60 text-[11px]">{timeAgo(reel.created_at)} ago</p>
        </div>
      </button>

      {/* Join button — show for non-owners */}
      {!isOwn && (
        <button
          onClick={canEngage ? onFollow : onOpenAuth}
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition shadow-lg ${
            following
              ? 'bg-white/15 text-white border border-white/40 hover:bg-white/25'
              : 'bg-red-600 text-white hover:bg-red-500'
          }`}
        >
          {following ? 'Joining' : 'Join'}
        </button>
      )}

      {/* Three-dots menu — always visible (shows Delete only if canDelete) */}
      <DotsMenu canDelete={canDelete} onDelete={onDelete} />
    </div>
  );
}

// ── Reel card (feed) ──────────────────────────────────────────────
function ReelCard({
  reel, author, isOwn, isAdmin, liked, saved, following, canEngage,
  onLike, onSave, onShare, onFollow, onComment, onOpenAuth, onOpenProfile, onOpenReel, onDelete,
}: ReelCardProps) {
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const isImage = reel.media_type === 'image';

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    v.paused ? (v.play(), setPlaying(true)) : (v.pause(), setPlaying(false));
  }

  return (
    <div className="relative w-full max-w-[420px] aspect-[9/16] rounded-2xl overflow-hidden bg-black border border-zinc-800 shadow-xl">
      {isImage ? (
        <img src={reel.image_url || reel.video_url} alt={reel.caption}
          onClick={onOpenReel}
          className="absolute inset-0 w-full h-full object-cover cursor-pointer" />
      ) : (
        <video ref={videoRef} src={reel.video_url} poster={reel.thumbnail_url || undefined}
          loop muted={muted} playsInline preload="metadata" onClick={togglePlay}
          onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
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

      {/* Top bar */}
      <div className="absolute top-3 left-3 right-3 z-[50]">
        <ReelTopBar reel={reel} author={author} isOwn={isOwn} isAdmin={isAdmin}
          following={following} canEngage={canEngage}
          onFollow={onFollow} onDelete={onDelete}
          onOpenProfile={onOpenProfile} onOpenAuth={onOpenAuth} />
      </div>

      {!isImage && (
        <button onClick={() => setMuted((m) => !m)}
          className="absolute top-16 right-3 w-9 h-9 rounded-full bg-black/50 backdrop-blur flex items-center justify-center text-white text-[10px] font-bold z-10">
          {muted ? 'Mute' : 'Sound'}
        </button>
      )}

      {/* Caption area — click to open full view */}
      <button onClick={onOpenReel} className="absolute left-0 right-16 bottom-0 p-4 text-left z-10">
        <p className="text-white text-sm line-clamp-2">{reel.caption}</p>
        {reel.hashtags && reel.hashtags.length > 0 && (
          <p className="text-red-300 text-xs mt-1 line-clamp-1">{reel.hashtags.map((h) => `#${h}`).join(' ')}</p>
        )}
        <div className="flex items-center gap-1 text-white/60 text-[11px] mt-1.5">
          <Music2 className="w-3 h-3" /> Original audio
        </div>
      </button>

      {/* Right action rail */}
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
  onLike, onSave, onShare, onFollow, onComment, onOpenAuth, onOpenProfile, onClose, onDelete,
}: ReelCardProps & { onClose: () => void }) {
  const [muted, setMuted] = useState(false);
  const [playing, setPlaying] = useState(false);
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

        {/* Top bar */}
        <div className="absolute top-16 left-3 right-3 z-[50]">
          <ReelTopBar reel={reel} author={author} isOwn={isOwn} isAdmin={isAdmin}
            following={following} canEngage={canEngage} size="md"
            onFollow={onFollow} onDelete={onDelete}
            onOpenProfile={onOpenProfile} onOpenAuth={onOpenAuth} />
        </div>

        {/* Caption */}
        <div className="absolute left-0 right-16 bottom-4 p-4 z-10">
          <p className="text-white text-sm">{reel.caption}</p>
          {reel.description && <p className="text-white/70 text-xs mt-1 line-clamp-3">{reel.description}</p>}
          {reel.hashtags && reel.hashtags.length > 0 && (
            <p className="text-red-300 text-xs mt-1.5">{reel.hashtags.map((h) => `#${h}`).join(' ')}</p>
          )}
        </div>

        {/* Action rail */}
        <div className="absolute right-3 bottom-20 flex flex-col items-center gap-5 z-10">
          <ActionBtn active={liked} onClick={onLike} icon={<ThumbsUp className={`w-7 h-7 ${liked ? 'fill-red-500' : ''}`} />} count={reel.likes_count} />
          <ActionBtn onClick={onComment} icon={<MessageCircle className="w-7 h-7" />} count={reel.comments_count} />
          <ActionBtn onClick={onShare} icon={<Share2 className="w-7 h-7" />} count={reel.shares_count} />
          <ActionBtn active={saved} onClick={onSave} icon={<Bookmark className={`w-7 h-7 ${saved ? 'fill-white' : ''}`} />} count={reel.saves_count} />
        </div>
      </div>
    </div>
  );
}

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
      try { await supabase.rpc('decrement_joins', { uid: reel.author_id }); } catch { /* ignore */ }
    } else {
      await supabase.from('follows').insert({ follower_id: user.id, following_id: reel.author_id });
      try { await supabase.rpc('increment_joins', { uid: reel.author_id }); } catch { /* ignore */ }
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

        {/* Top bar */}
        <div className="absolute top-16 left-3 right-3 z-[50]">
          <ReelTopBar reel={curReel} author={author ?? undefined} isOwn={user?.id === reel.author_id}
            isAdmin={!!profile?.is_admin} following={following} canEngage={!!user}
            size="md" onFollow={onFollow} onDelete={onDelete}
            onOpenProfile={() => {}} onOpenAuth={() => {}} />
        </div>

        {/* Caption */}
        <div className="absolute left-0 right-16 bottom-4 p-4 z-10">
          <p className="text-white text-sm">{curReel.caption}</p>
          {curReel.description && <p className="text-white/70 text-xs mt-1 line-clamp-3">{curReel.description}</p>}
          {curReel.hashtags && curReel.hashtags.length > 0 && (
            <p className="text-red-300 text-xs mt-1.5">{curReel.hashtags.map((h) => `#${h}`).join(' ')}</p>
          )}
        </div>

        {/* Action rail */}
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
  onLike: () => void;
  onSave: () => void;
  onShare: () => void;
  onFollow: () => void;
  onComment: () => void;
  onOpenAuth: () => void;
  onOpenProfile: (p: Profile) => void;
  onOpenReel: () => void;
  onDelete: () => void;
};

function ActionBtn({ icon, count, active, onClick }: { icon: React.ReactNode; count?: number; active?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1">
      <span className={`transition ${active ? 'text-red-500' : 'text-white'} hover:scale-110 active:scale-95`}>{icon}</span>
      {count !== undefined && <span className="text-white text-xs font-semibold">{compactNum(count)}</span>}
    </button>
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
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [enabling, setEnabling] = useState(false);
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
    setShowCopyright(true);
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
                {busy ? <><div className="w-4 h-4 border-2 border-white/40 border-t-transparent rounded-full animate-spin" /> Uploading…</> : <><Upload className="w-4 h-4" /> Post {mediaType === 'image' ? 'Photo' : 'Reel'}</>}
              </button>
            </form>
          )}
        </div>
      </div>

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
              <p className="text-zinc-500 text-xs mt-3">By continuing you confirm your audio is original or non-copyrighted.</p>
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
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
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
