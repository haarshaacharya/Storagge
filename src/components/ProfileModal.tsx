import { useEffect, useRef, useState } from 'react';
import {
  Settings, Play, Plus, Trash2, Check, ArrowLeft, Camera, Sparkles, Shield, X, LogOut,
  Loader2, Instagram, Twitter, Youtube, Github, Linkedin, Globe, Link2, MessageCircle,
  UserPlus, MoreVertical, Ban, Hash, Music, ExternalLink, Heart,
} from 'lucide-react';
import { supabase, type Reel, type Profile, type SocialLink, type FavoriteReel, compactNum } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { StandaloneReelView } from './PostsView';

const SOCIAL_PLATFORMS = [
  { id: 'instagram', label: 'Instagram', icon: Instagram, placeholder: 'https://instagram.com/yourhandle' },
  { id: 'twitter', label: 'Twitter / X', icon: Twitter, placeholder: 'https://x.com/yourhandle' },
  { id: 'youtube', label: 'YouTube', icon: Youtube, placeholder: 'https://youtube.com/@channel' },
  { id: 'github', label: 'GitHub', icon: Github, placeholder: 'https://github.com/yourhandle' },
  { id: 'linkedin', label: 'LinkedIn', icon: Linkedin, placeholder: 'https://linkedin.com/in/yourname' },
  { id: 'website', label: 'Website', icon: Globe, placeholder: 'https://your-site.com' },
  { id: 'other', label: 'Other', icon: Link2, placeholder: 'https://…' },
];

function getPlatformIcon(platform: string): React.ElementType {
  return SOCIAL_PLATFORMS.find((p) => p.id === platform)?.icon ?? Link2;
}

// Three-dots menu for viewing other profiles
function ProfileDotsMenu({
  targetId,
  targetName,
  isBlocked,
  onBlock,
  onUnblock,
}: {
  targetId: string;
  targetName: string;
  isBlocked: boolean;
  onBlock: () => void;
  onUnblock: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function h(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-9 h-9 rounded-full bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 hover:text-white flex items-center justify-center transition"
        title="More options"
      >
        <MoreVertical className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-11 min-w-[180px] rounded-xl bg-zinc-900 border border-zinc-800 shadow-2xl overflow-hidden z-50">
          <button
            onClick={() => { setOpen(false); isBlocked ? onUnblock() : onBlock(); }}
            className={`flex items-center gap-2 w-full px-4 py-3 text-sm transition ${isBlocked ? 'text-emerald-400 hover:bg-zinc-800' : 'text-red-400 hover:bg-zinc-800'}`}
          >
            <Ban className="w-4 h-4" />
            {isBlocked ? `Unblock ${targetName}` : `Block ${targetName}`}
          </button>
        </div>
      )}
    </div>
  );
}

// Inline blocked users list (used inside settings edit form)
function InlineBlockedList() {
  const { user } = useAuth();
  const [blocked, setBlocked] = useState<{ id: string; blocked_id: string; profile?: Profile }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from('blocked_users').select('id, blocked_id').eq('blocker_id', user.id);
      const rows = (data as { id: string; blocked_id: string }[]) ?? [];
      if (rows.length > 0) {
        const ids = rows.map((r) => r.blocked_id);
        const { data: profiles } = await supabase.from('profiles').select('*').in('id', ids);
        const pm: Record<string, Profile> = {};
        for (const p of (profiles as Profile[]) ?? []) pm[p.id] = p;
        setBlocked(rows.map((r) => ({ ...r, profile: pm[r.blocked_id] })));
      } else {
        setBlocked([]);
      }
      setLoading(false);
    })();
  }, [user]);

  async function unblock(rowId: string) {
    await supabase.from('blocked_users').delete().eq('id', rowId);
    setBlocked((prev) => prev.filter((b) => b.id !== rowId));
  }

  if (loading) return <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-red-500" /></div>;
  if (blocked.length === 0) return <p className="text-zinc-600 text-xs text-center py-4">No blocked users</p>;

  return (
    <div className="divide-y divide-zinc-800">
      {blocked.map((b) => (
        <div key={b.id} className="flex items-center gap-3 px-4 py-3">
          <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-white text-sm font-bold">
            {b.profile?.avatar_url
              ? <img src={b.profile.avatar_url} alt="" className="w-full h-full object-cover" />
              : (b.profile?.display_name || '?').charAt(0).toUpperCase()
            }
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">{b.profile?.display_name || 'User'}</p>
            {b.profile?.username && <p className="text-zinc-500 text-xs">@{b.profile.username}</p>}
          </div>
          <button onClick={() => unblock(b.id)}
            className="text-xs text-emerald-400 hover:text-emerald-300 border border-emerald-800 rounded-full px-3 py-1 transition">
            Unblock
          </button>
        </div>
      ))}
    </div>
  );
}

// Blocked users settings panel (kept for potential direct use)
function BlockedUsersPanel({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const [blocked, setBlocked] = useState<{ id: string; blocked_id: string; profile?: Profile }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from('blocked_users').select('id, blocked_id').eq('blocker_id', user.id);
      const rows = (data as { id: string; blocked_id: string }[]) ?? [];
      if (rows.length > 0) {
        const ids = rows.map((r) => r.blocked_id);
        const { data: profiles } = await supabase.from('profiles').select('*').in('id', ids);
        const pm: Record<string, Profile> = {};
        for (const p of (profiles as Profile[]) ?? []) pm[p.id] = p;
        setBlocked(rows.map((r) => ({ ...r, profile: pm[r.blocked_id] })));
      }
      setLoading(false);
    })();
  }, [user]);

  async function unblock(rowId: string, blockedId: string) {
    await supabase.from('blocked_users').delete().eq('id', rowId);
    setBlocked((prev) => prev.filter((b) => b.id !== rowId));
    // suppress lint: blockedId used for future UI feedback if needed
    void blockedId;
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 shrink-0">
          <h3 className="font-semibold text-white flex items-center gap-2"><Ban className="w-4 h-4 text-red-500" /> Blocked Users</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-red-500" /></div>
          ) : blocked.length === 0 ? (
            <p className="text-zinc-500 text-sm text-center py-10">No blocked users</p>
          ) : (
            blocked.map((b) => (
              <div key={b.id} className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800/50 last:border-0">
                <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-white text-sm font-bold">
                  {b.profile?.avatar_url
                    ? <img src={b.profile.avatar_url} alt="" className="w-full h-full object-cover" />
                    : (b.profile?.display_name || '?').charAt(0).toUpperCase()
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{b.profile?.display_name || 'User'}</p>
                  {b.profile?.username && <p className="text-zinc-500 text-xs">@{b.profile.username}</p>}
                </div>
                <button onClick={() => unblock(b.id, b.blocked_id)}
                  className="text-xs text-emerald-400 hover:text-emerald-300 border border-emerald-800 rounded-full px-3 py-1 transition">
                  Unblock
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default function ProfileModal({
  onClose, profileId, onOpenAdmin, onMessage,
}: {
  onClose: () => void;
  profileId?: string | null;
  onOpenAdmin?: () => void;
  onMessage?: (uid: string) => void;
}) {
  const { user, profile: ownProfile, refreshProfile, signOut } = useAuth();
  const [target, setTarget] = useState<Profile | null>(null);
  const [reels, setReels] = useState<Reel[]>([]);
  const [joining, setJoining] = useState(0);
  const [showFollowList, setShowFollowList] = useState<'joins' | 'joining' | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockRowId, setBlockRowId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [showBlockedSection, setShowBlockedSection] = useState(false);

  // Edit fields
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([]);
  const [newPlatform, setNewPlatform] = useState('instagram');
  const [newUrl, setNewUrl] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [interestInput, setInterestInput] = useState('');
  const [favoriteReels, setFavoriteReels] = useState<FavoriteReel[]>([]);
  const [favReelUrl, setFavReelUrl] = useState('');
  const [favReelTitle, setFavReelTitle] = useState('');
  const [todayThought, setTodayThought] = useState('');
  const [todayThoughtSong, setTodayThoughtSong] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);
  const [profMode, setProfMode] = useState(false);
  const [showProfConfirm, setShowProfConfirm] = useState(false);
  const [togglingProf, setTogglingProf] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [fullReel, setFullReel] = useState<Reel | null>(null);

  const bannerRef = useRef<HTMLInputElement>(null);
  const avatarRef = useRef<HTMLInputElement>(null);

  const viewingId = profileId || user?.id || '';
  const isOwn = !profileId || profileId === user?.id;

  useEffect(() => {
    if (!viewingId) return;
    (async () => {
      const [{ data: pData }, { data: rData }, { data: fData }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', viewingId).maybeSingle(),
        supabase.from('reels').select('*').eq('author_id', viewingId).eq('visibility', 'public').order('created_at', { ascending: false }),
        supabase.from('follows').select('follower_id').eq('following_id', viewingId),
      ]);
      const p = pData as Profile | null;
      setTarget(p);
      setReels((rData as Reel[]) ?? []);
      setJoining((fData as { follower_id: string }[])?.length ?? 0);
      if (isOwn && p) {
        setDisplayName(p.display_name || '');
        setUsername(p.username || '');
        setBio(p.bio || '');
        setAvatarUrl(p.avatar_url || '');
        setBannerUrl(p.banner_url || '');
        setSocialLinks(Array.isArray(p.social_links) ? (p.social_links as SocialLink[]) : []);
        setInterests(Array.isArray(p.interests) ? p.interests : []);
        setFavoriteReels(Array.isArray(p.favorite_reels) ? (p.favorite_reels as FavoriteReel[]) : []);
        setTodayThought(p.today_thought || '');
        setTodayThoughtSong(p.today_thought_song || '');
        setProfMode(p.professional_mode);
      }
      if (user && !isOwn) {
        const [fl, bl] = await Promise.all([
          supabase.from('follows').select('id').eq('follower_id', user.id).eq('following_id', viewingId).maybeSingle(),
          supabase.from('blocked_users').select('id').eq('blocker_id', user.id).eq('blocked_id', viewingId).maybeSingle(),
        ]);
        setIsFollowing(!!fl.data);
        setIsBlocked(!!bl.data);
        setBlockRowId((bl.data as { id: string } | null)?.id ?? null);
      }
      setLoading(false);
    })();
  }, [viewingId, isOwn, user]);

  async function uploadBanner(file: File) {
    if (!user) return;
    setUploadingBanner(true);
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `${user.id}/banner_${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type });
    if (error) { alert(error.message); setUploadingBanner(false); return; }
    const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
    setBannerUrl(pub.publicUrl);
    setUploadingBanner(false);
  }

  async function uploadAvatar(file: File) {
    if (!user) return;
    setUploadingAvatar(true);
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `${user.id}/avatar_${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type });
    if (error) { alert(error.message); setUploadingAvatar(false); return; }
    const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
    setAvatarUrl(pub.publicUrl);
    setUploadingAvatar(false);
  }

  async function saveProfile() {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from('profiles').update({
      display_name: displayName,
      username: username.trim() || null,
      bio,
      avatar_url: avatarUrl,
      banner_url: bannerUrl,
      social_links: socialLinks,
      interests,
      favorite_reels: favoriteReels,
      today_thought: todayThought.trim() || null,
      today_thought_song: todayThoughtSong.trim() || null,
      professional_mode: profMode,
    }).eq('id', user.id);
    setSaving(false);
    if (error) { alert(error.message); return; }
    await refreshProfile();
    setTarget((t) => t ? {
      ...t, display_name: displayName, username: username.trim() || null,
      bio, avatar_url: avatarUrl, banner_url: bannerUrl, social_links: socialLinks,
      interests, favorite_reels: favoriteReels,
      today_thought: todayThought.trim() || null, today_thought_song: todayThoughtSong.trim() || null,
      professional_mode: profMode,
    } : t);
    setEditing(false);
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 1500);
  }

  async function confirmProfMode() {
    if (!user) return;
    setTogglingProf(true);
    const next = !profMode;
    setProfMode(next);
    setShowProfConfirm(false);
    await supabase.from('profiles').update({ professional_mode: next }).eq('id', user.id);
    await refreshProfile();
    setTogglingProf(false);
  }

  async function toggleFollow() {
    if (!user || !target) return;
    const next = !isFollowing;
    setIsFollowing(next);
    setJoining((j) => Math.max(0, j + (next ? 1 : -1)));
    if (next) await supabase.from('follows').insert({ follower_id: user.id, following_id: target.id });
    else await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', target.id);
  }

  async function blockUser() {
    if (!user || !target) return;
    const { data } = await supabase.from('blocked_users').insert({ blocker_id: user.id, blocked_id: target.id }).select('id').maybeSingle();
    setIsBlocked(true);
    setBlockRowId((data as { id: string } | null)?.id ?? null);
  }

  async function unblockUser() {
    if (!user || !target) return;
    await supabase.from('blocked_users').delete().eq('blocker_id', user.id).eq('blocked_id', target.id);
    setIsBlocked(false);
    setBlockRowId(null);
  }

  function addSocialLink() {
    const url = newUrl.trim();
    if (!url) return;
    setSocialLinks((prev) => [...prev, { platform: newPlatform, url, label: SOCIAL_PLATFORMS.find(p => p.id === newPlatform)?.label }]);
    setNewUrl('');
  }

  function addInterest() {
    const v = interestInput.trim();
    if (!v || interests.includes(v)) return;
    setInterests((prev) => [...prev, v]);
    setInterestInput('');
  }

  function addFavReel() {
    const url = favReelUrl.trim();
    if (!url) return;
    setFavoriteReels((prev) => [...prev, { url, title: favReelTitle.trim() || undefined }]);
    setFavReelUrl('');
    setFavReelTitle('');
  }

  if (!user) return null;
  const p = isOwn ? (ownProfile || target) : target;
  if (!p) return null;

  const gradient = 'linear-gradient(135deg, #b91c1c 0%, #dc2626 40%, #7f1d1d 100%)';
  const nameForDisplay = isOwn ? displayName : p.display_name;
  const usernameForDisplay = isOwn ? username : p.username;
  const currentBanner = isOwn ? bannerUrl : (p?.banner_url || '');
  const currentAvatar = isOwn ? avatarUrl : p.avatar_url;
  const displaySocialLinks = isOwn ? socialLinks : (Array.isArray(p.social_links) ? (p.social_links as SocialLink[]) : []);
  const displayInterests = isOwn ? interests : (Array.isArray(p.interests) ? p.interests : []);
  const displayFavReels = isOwn ? favoriteReels : (Array.isArray(p.favorite_reels) ? (p.favorite_reels as FavoriteReel[]) : []);
  const displayThought = isOwn ? todayThought : p.today_thought;
  const displayThoughtSong = isOwn ? todayThoughtSong : p.today_thought_song;

  return (
    <div className="fixed inset-0 z-[100] bg-zinc-950 overflow-y-auto scrollbar-thin">
      <input ref={bannerRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadBanner(f); e.target.value = ''; }} />
      <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); e.target.value = ''; }} />

      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-zinc-950/90 backdrop-blur-xl border-b border-zinc-800 h-14 flex items-center px-4 gap-3">
        <button onClick={onClose} className="flex items-center gap-1.5 text-zinc-300 hover:text-white transition">
          <ArrowLeft className="w-5 h-5" /> <span className="text-sm font-medium">Back</span>
        </button>
        <span className="font-semibold text-white flex-1 text-center truncate">{nameForDisplay || 'Profile'}</span>
        {isOwn ? (
          <div className="flex items-center gap-2">
            <button onClick={() => setEditing((s) => !s)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition ${editing ? 'bg-red-600 text-white' : 'bg-zinc-800 hover:bg-zinc-700 text-white'}`}>
              <Settings className="w-4 h-4" /> {editing ? 'Editing' : 'Settings'}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {onMessage && isFollowing && (
              <button onClick={() => onMessage(target!.id)}
                className="w-9 h-9 rounded-full bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 hover:text-white flex items-center justify-center transition">
                <MessageCircle className="w-4 h-4" />
              </button>
            )}
            <button onClick={toggleFollow}
              className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-bold transition ${isFollowing ? 'bg-white/15 text-white border border-white/30' : 'bg-red-600 text-white hover:bg-red-500'}`}>
              {isFollowing ? 'Joined' : <><UserPlus className="w-4 h-4" /> Join</>}
            </button>
            {user && (
              <ProfileDotsMenu
                targetId={target?.id ?? ''}
                targetName={target?.display_name || 'User'}
                isBlocked={isBlocked}
                onBlock={blockUser}
                onUnblock={unblockUser}
              />
            )}
          </div>
        )}
      </div>

      {/* Banner */}
      <div className="relative h-40 sm:h-52" style={currentBanner ? { backgroundImage: `url(${currentBanner})`, backgroundSize: 'cover', backgroundPosition: 'center' } : { background: gradient }}>
        {editing && isOwn && (
          <button onClick={() => bannerRef.current?.click()} disabled={uploadingBanner}
            className="absolute inset-0 flex items-center justify-center bg-black/40 cursor-pointer transition hover:bg-black/50">
            {uploadingBanner
              ? <span className="flex items-center gap-2 text-white bg-black/50 rounded-full px-4 py-2 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</span>
              : <span className="flex items-center gap-2 text-white bg-black/50 rounded-full px-4 py-2 text-sm"><Camera className="w-4 h-4" /> Change banner</span>
            }
          </button>
        )}
      </div>

      {/* Profile header */}
      <div className="max-w-2xl mx-auto px-4 -mt-12 sm:-mt-16 relative">
        <div className="relative w-24 h-24 sm:w-32 sm:h-32 rounded-full ring-4 ring-zinc-950 overflow-hidden bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-white text-4xl font-bold shrink-0">
          {currentAvatar ? <img src={currentAvatar} alt="" className="w-full h-full object-cover" /> : (nameForDisplay || 'U').charAt(0).toUpperCase()}
          {editing && isOwn && (
            <button onClick={() => avatarRef.current?.click()} disabled={uploadingAvatar}
              className="absolute inset-0 bg-black/50 flex items-center justify-center transition hover:bg-black/60">
              {uploadingAvatar ? <Loader2 className="w-6 h-6 animate-spin text-white" /> : <Camera className="w-6 h-6 text-white" />}
            </button>
          )}
        </div>

        {editing && isOwn ? (
          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Display name</label>
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:border-red-600 outline-none" />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Username</label>
              <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden focus-within:border-red-600">
                <span className="pl-3 text-zinc-500 text-sm">@</span>
                <input value={username} onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase())}
                  placeholder="your_username"
                  className="flex-1 bg-transparent px-2 py-2 text-sm text-white outline-none" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Bio</label>
              <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:border-red-600 outline-none resize-none" />
            </div>

            {/* Interests */}
            <div>
              <label className="block text-xs text-zinc-400 mb-2">Interests</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {interests.map((interest, i) => (
                  <span key={i} className="flex items-center gap-1 text-xs bg-zinc-800 border border-zinc-700 text-white rounded-full px-2.5 py-1">
                    {interest}
                    <button onClick={() => setInterests((prev) => prev.filter((_, idx) => idx !== i))} className="text-zinc-500 hover:text-red-400 ml-0.5">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input value={interestInput} onChange={(e) => setInterestInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addInterest(); } }}
                  placeholder="e.g. AI, Music, Coding…"
                  className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-red-600 outline-none" />
                <button type="button" onClick={addInterest} className="rounded-lg bg-red-600 hover:bg-red-500 text-white px-3 transition"><Plus className="w-4 h-4" /></button>
              </div>
            </div>

            {/* Favorite Reels */}
            <div>
              <label className="block text-xs text-zinc-400 mb-2">Favorite Reels / Videos (by link)</label>
              <div className="space-y-1.5 mb-2">
                {favoriteReels.map((fr, i) => (
                  <div key={i} className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2">
                    <Heart className="w-3.5 h-3.5 text-red-400 shrink-0" />
                    <span className="text-xs text-zinc-300 truncate flex-1">{fr.title || fr.url}</span>
                    <button onClick={() => setFavoriteReels((prev) => prev.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-300 shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>
              <div className="space-y-1.5">
                <input value={favReelTitle} onChange={(e) => setFavReelTitle(e.target.value)} placeholder="Title (optional)"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-red-600 outline-none" />
                <div className="flex gap-2">
                  <input value={favReelUrl} onChange={(e) => setFavReelUrl(e.target.value)} placeholder="https://…"
                    className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-red-600 outline-none" />
                  <button type="button" onClick={addFavReel} className="rounded-lg bg-red-600 hover:bg-red-500 text-white px-3 transition"><Plus className="w-4 h-4" /></button>
                </div>
              </div>
            </div>

            {/* Today's Thought */}
            <div>
              <label className="block text-xs text-zinc-400 mb-2">Today's Thought</label>
              <textarea value={todayThought} onChange={(e) => setTodayThought(e.target.value)} rows={2} placeholder="Share a thought for today…"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-red-600 outline-none resize-none" />
              <input value={todayThoughtSong} onChange={(e) => setTodayThoughtSong(e.target.value)} placeholder="Song / vibe (optional)"
                className="w-full mt-1.5 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-red-600 outline-none" />
            </div>

            {/* Social links */}
            <div>
              <label className="block text-xs text-zinc-400 mb-2">Social Links</label>
              <div className="space-y-2 mb-3">
                {socialLinks.map((sl, i) => {
                  const Icon = getPlatformIcon(sl.platform);
                  return (
                    <div key={i} className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2">
                      <Icon className="w-4 h-4 text-zinc-400 shrink-0" />
                      <span className="text-sm text-zinc-300 truncate flex-1">{sl.url}</span>
                      <button onClick={() => setSocialLinks((prev) => prev.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-300 shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <select value={newPlatform} onChange={(e) => setNewPlatform(e.target.value)}
                  className="bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-2 text-sm text-white focus:border-red-600 outline-none">
                  {SOCIAL_PLATFORMS.map((pl) => <option key={pl.id} value={pl.id}>{pl.label}</option>)}
                </select>
                <input value={newUrl} onChange={(e) => setNewUrl(e.target.value)}
                  placeholder={SOCIAL_PLATFORMS.find(pl => pl.id === newPlatform)?.placeholder}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSocialLink(); } }}
                  className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-red-600 outline-none" />
                <button type="button" onClick={addSocialLink} className="rounded-lg bg-red-600 hover:bg-red-500 text-white px-3 transition"><Plus className="w-4 h-4" /></button>
              </div>
            </div>

            {/* Professional mode */}
            <div className="flex items-center justify-between rounded-xl bg-zinc-900 border border-zinc-800 p-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${profMode ? 'bg-red-600 text-white' : 'bg-zinc-800 text-zinc-500'}`}>
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-white font-medium text-sm">Professional Mode</p>
                  <p className="text-zinc-500 text-xs">{profMode ? 'On — you can post reels' : 'Off — turn on to post'}</p>
                </div>
              </div>
              <button onClick={() => setShowProfConfirm(true)} disabled={togglingProf}
                className={`relative w-12 h-6 rounded-full transition ${profMode ? 'bg-red-600' : 'bg-zinc-700'}`}>
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${profMode ? 'left-6' : 'left-0.5'}`} />
              </button>
            </div>

            {p.is_admin && onOpenAdmin && (
              <button onClick={onOpenAdmin}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-red-950/40 border border-red-800 hover:bg-red-950/60 text-red-300 font-medium px-4 py-3 text-sm transition">
                <Shield className="w-5 h-5" /> Open Admin Panel
              </button>
            )}

            {/* Blocked Users inline section */}
            <div className="rounded-xl border border-zinc-800 overflow-hidden">
              <button
                type="button"
                onClick={() => setShowBlockedSection((s) => !s)}
                className="w-full flex items-center justify-between px-4 py-3 bg-zinc-900 hover:bg-zinc-800 transition"
              >
                <span className="flex items-center gap-2 text-sm font-medium text-zinc-300">
                  <Ban className="w-4 h-4 text-zinc-500" /> Blocked Users
                </span>
                <span className={`text-zinc-500 transition-transform ${showBlockedSection ? 'rotate-180' : ''}`}>▾</span>
              </button>
              {showBlockedSection && <InlineBlockedList />}
            </div>

            <div className="flex items-center gap-3">
              <button onClick={saveProfile} disabled={saving}
                className="rounded-full bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-medium px-5 py-2 text-sm transition">
                {saving ? 'Saving…' : 'Save changes'}
              </button>
              {savedMsg && <span className="text-emerald-400 text-sm flex items-center gap-1"><Check className="w-4 h-4" /> Saved</span>}
            </div>

            <button
              onClick={async () => { await signOut(); onClose(); }}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-zinc-700 hover:border-red-700 bg-zinc-900 hover:bg-red-950/20 text-zinc-400 hover:text-red-400 font-medium px-4 py-3 text-sm transition mb-12"
            >
              <LogOut className="w-4 h-4" /> Sign out
            </button>
          </div>
        ) : (
          <div className="mt-4 pb-12">
            <h2 className="text-xl font-bold text-white">{nameForDisplay || 'Anonymous'}</h2>
            {usernameForDisplay && <p className="text-zinc-500 text-sm mt-0.5">@{usernameForDisplay}</p>}
            {p.is_admin && <span className="inline-block mt-1 text-[10px] font-bold uppercase tracking-wider bg-red-600 text-white px-2 py-0.5 rounded-full">Admin</span>}
            {p.bio && <p className="text-zinc-300 text-sm mt-3 whitespace-pre-wrap">{p.bio}</p>}

            {/* Today's thought */}
            {displayThought && (
              <div className="mt-4 rounded-xl bg-zinc-900/80 border border-zinc-800 px-4 py-3">
                <p className="text-white text-sm italic">"{displayThought}"</p>
                {displayThoughtSong && (
                  <p className="text-zinc-500 text-xs mt-1.5 flex items-center gap-1"><Music className="w-3 h-3" /> {displayThoughtSong}</p>
                )}
              </div>
            )}

            <div className="flex gap-8 mt-4 border-y border-zinc-800 py-3">
              <Stat label="Posts" value={reels.length} />
              <Stat label="Joins" value={p.joins_count} onClick={() => setShowFollowList('joins')} />
              <Stat label="Joining" value={joining} onClick={() => setShowFollowList('joining')} />
            </div>

            {showFollowList && (
              <FollowListPopup
                profileId={p.id}
                mode={showFollowList}
                onClose={() => setShowFollowList(null)}
                onOpenProfile={(other) => { setShowFollowList(null); onOpenProfile?.(other); }}
              />
            )}

            {/* Interests */}
            {displayInterests.length > 0 && (
              <div className="mt-4">
                <p className="text-xs text-zinc-500 mb-2 flex items-center gap-1"><Hash className="w-3 h-3" /> Interests</p>
                <div className="flex flex-wrap gap-1.5">
                  {displayInterests.map((interest, i) => (
                    <span key={i} className="text-xs bg-zinc-900 border border-zinc-800 text-zinc-300 rounded-full px-2.5 py-1">{interest}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Favorite reels */}
            {displayFavReels.length > 0 && (
              <div className="mt-4">
                <p className="text-xs text-zinc-500 mb-2 flex items-center gap-1"><Heart className="w-3 h-3" /> Favorite Reels</p>
                <div className="space-y-1.5">
                  {displayFavReels.map((fr, i) => (
                    <a key={i} href={fr.url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 text-xs text-red-400 hover:text-red-300 transition bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2">
                      <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{fr.title || fr.url}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Social links */}
            {displaySocialLinks.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {displaySocialLinks.map((sl, i) => {
                  const Icon = getPlatformIcon(sl.platform);
                  return (
                    <a key={i} href={sl.url} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-full bg-zinc-900 hover:bg-zinc-800 text-white text-xs px-3 py-1.5 transition border border-zinc-800">
                      <Icon className="w-3.5 h-3.5" />
                      {sl.label || sl.platform}
                    </a>
                  );
                })}
              </div>
            )}

            {p.professional_mode && <span className="inline-flex items-center gap-1 mt-4 text-xs text-emerald-400"><Check className="w-3.5 h-3.5" /> Professional Mode ON</span>}

            <div className="mt-6">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-1.5"><Play className="w-4 h-4 text-red-500" /> Posts</h3>
              {loading ? <p className="text-zinc-500 text-sm">Loading…</p> : reels.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-3"><Play className="w-6 h-6 text-zinc-600" /></div>
                  <p className="text-zinc-500 text-sm">No posts yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                  {reels.map((r) => (
                    <button key={r.id} onClick={() => setFullReel(r)} className="relative aspect-[9/16] rounded-lg overflow-hidden bg-black group">
                      {r.media_type === 'image' ? (
                        <img src={r.image_url || r.video_url} alt={r.caption} className="w-full h-full object-cover" />
                      ) : (
                        <video src={r.video_url} poster={r.thumbnail_url || undefined} preload="metadata" className="w-full h-full object-cover" />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition" />
                      <div className="absolute bottom-1 left-1.5 text-white text-[10px] flex items-center gap-1"><Play className="w-3 h-3 fill-white" /> {compactNum(r.likes_count)}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {fullReel && <StandaloneReelView reel={fullReel} onClose={() => setFullReel(null)} />}

      {showProfConfirm && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setShowProfConfirm(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800">
              <h3 className="font-semibold text-white flex items-center gap-2"><Sparkles className="w-4 h-4 text-red-500" /> Professional Mode</h3>
              <button onClick={() => setShowProfConfirm(false)} className="text-zinc-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 text-center">
              <div className="w-14 h-14 rounded-2xl bg-red-950/40 border border-red-800 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-7 h-7 text-red-500" />
              </div>
              {profMode ? (
                <><p className="text-white font-semibold">Turn off Professional Mode?</p><p className="text-zinc-400 text-sm mt-2">You won't be able to post reels anymore.</p></>
              ) : (
                <><p className="text-white font-semibold">Turn on Professional Mode?</p><p className="text-zinc-400 text-sm mt-2">You'll be able to post reels and photos.</p></>
              )}
              <div className="flex gap-2 mt-5">
                <button onClick={() => setShowProfConfirm(false)} className="flex-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white py-2.5 text-sm font-medium transition">Cancel</button>
                <button onClick={confirmProfMode} disabled={togglingProf}
                  className="flex-1 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white py-2.5 text-sm font-bold transition">
                  {togglingProf ? 'Please wait…' : profMode ? 'Turn off' : 'Turn on'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, onClick }: { label: string; value: number; onClick?: () => void }) {
  if (onClick) {
    return (
      <button onClick={onClick} className="text-left group hover:opacity-80 transition">
        <p className="text-white font-bold text-lg group-hover:text-red-400 transition">{compactNum(value)}</p>
        <p className="text-zinc-500 text-xs group-hover:text-zinc-400 transition">{label}</p>
      </button>
    );
  }
  return <div><p className="text-white font-bold text-lg">{compactNum(value)}</p><p className="text-zinc-500 text-xs">{label}</p></div>;
}

function FollowListPopup({
  profileId, mode, onClose, onOpenProfile,
}: {
  profileId: string;
  mode: 'joins' | 'joining';
  onClose: () => void;
  onOpenProfile: (p: Profile) => void;
}) {
  const [list, setList] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      if (mode === 'joins') {
        // People who follow profileId
        const { data } = await supabase.from('follows').select('follower_id').eq('following_id', profileId);
        const ids = ((data as { follower_id: string }[]) ?? []).map((r) => r.follower_id);
        if (ids.length) {
          const { data: ps } = await supabase.from('profiles').select('*').in('id', ids);
          setList((ps as Profile[]) ?? []);
        }
      } else {
        // People profileId follows
        const { data } = await supabase.from('follows').select('following_id').eq('follower_id', profileId);
        const ids = ((data as { following_id: string }[]) ?? []).map((r) => r.following_id);
        if (ids.length) {
          const { data: ps } = await supabase.from('profiles').select('*').in('id', ids);
          setList((ps as Profile[]) ?? []);
        }
      }
      setLoading(false);
    })();
  }, [profileId, mode]);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h3 className="font-bold text-white text-base">{mode === 'joins' ? 'Joins (Followers)' : 'Joining (Following)'}</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition"><X className="w-5 h-5" /></button>
        </div>
        <div className="overflow-y-auto max-h-[60vh]">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-red-500" />
            </div>
          ) : list.length === 0 ? (
            <p className="text-center text-zinc-500 text-sm py-10">
              {mode === 'joins' ? 'No followers yet' : 'Not following anyone yet'}
            </p>
          ) : (
            <div className="divide-y divide-zinc-800">
              {list.map((p) => (
                <button key={p.id} onClick={() => onOpenProfile(p)}
                  className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-zinc-800/60 transition">
                  <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 border-2 border-zinc-700">
                    {p.avatar_url ? (
                      <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-white font-bold">
                        {(p.display_name || 'U').charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="text-left min-w-0">
                    <p className="text-white text-sm font-semibold truncate">{p.display_name || 'User'}</p>
                    {p.username && <p className="text-zinc-500 text-xs">@{p.username}</p>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
