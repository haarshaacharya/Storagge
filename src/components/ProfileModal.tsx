import { useEffect, useRef, useState } from 'react';
import { Link2, Settings, Play, Globe, Plus, Trash2, Check, ArrowLeft, Camera, Sparkles, Shield, X, Loader2 } from 'lucide-react';
import { supabase, type Reel, type Profile, compactNum } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { StandaloneReelView } from './ReelsView';

export default function ProfileModal({
  onClose, profileId, onOpenAdmin,
}: {
  onClose: () => void;
  profileId?: string | null;
  onOpenAdmin?: () => void;
}) {
  const { user, profile: ownProfile, refreshProfile } = useAuth();
  const [target, setTarget] = useState<Profile | null>(null);
  const [reels, setReels] = useState<Reel[]>([]);
  const [joining, setJoining] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [linkInput, setLinkInput] = useState('');
  const [links, setLinks] = useState<string[]>([]);
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
        supabase.from('reels').select('*').eq('author_id', viewingId).order('created_at', { ascending: false }),
        supabase.from('follows').select('follower_id').eq('following_id', viewingId),
      ]);
      const p = pData as Profile | null;
      setTarget(p);
      setReels((rData as Reel[]) ?? []);
      setJoining((fData as { follower_id: string }[])?.length ?? 0);
      if (isOwn && p) {
        setDisplayName(p.display_name || '');
        setBio(p.bio || '');
        setAvatarUrl(p.avatar_url || '');
        setLinks(p.website_links || []);
        setProfMode(p.professional_mode);
      }
      if (user && !isOwn) {
        const { data: fl } = await supabase.from('follows').select('id').eq('follower_id', user.id).eq('following_id', viewingId).maybeSingle();
        setIsFollowing(!!fl);
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
    localStorage.setItem('banner_' + user.id, pub.publicUrl);
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
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: displayName, bio, avatar_url: avatarUrl, website_links: links, professional_mode: profMode })
      .eq('id', user.id);
    setSaving(false);
    if (error) { alert(error.message); return; }
    await refreshProfile();
    setTarget((t) => t ? { ...t, display_name: displayName, bio, avatar_url: avatarUrl, website_links: links, professional_mode: profMode } : t);
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
    if (next) {
      await supabase.from('follows').insert({ follower_id: user.id, following_id: target.id });
    } else {
      await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', target.id);
    }
  }

  if (!user) return null;
  const p = isOwn ? (ownProfile || target) : target;
  if (!p) return null;

  const gradient = 'linear-gradient(135deg, #b91c1c 0%, #dc2626 40%, #7f1d1d 100%)';
  const nameForDisplay = isOwn ? displayName : p.display_name;
  const currentBanner = isOwn ? (bannerUrl || localStorage.getItem('banner_' + user.id) || '') : '';
  const currentAvatar = isOwn ? avatarUrl : p.avatar_url;

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
          <button onClick={() => setEditing((s) => !s)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition ${editing ? 'bg-red-600 text-white' : 'bg-zinc-800 hover:bg-zinc-700 text-white'}`}>
            <Settings className="w-4 h-4" /> {editing ? 'Editing' : 'Settings'}
          </button>
        ) : (
          <button onClick={toggleFollow}
            className={`rounded-full px-4 py-1.5 text-sm font-bold transition ${isFollowing ? 'bg-white/15 text-white border border-white/30' : 'bg-red-600 text-white hover:bg-red-500'}`}>
            {isFollowing ? 'Joined' : 'Join'}
          </button>
        )}
      </div>

      {/* Banner */}
      <div className="relative h-40 sm:h-52" style={currentBanner ? { backgroundImage: `url(${currentBanner})`, backgroundSize: 'cover', backgroundPosition: 'center' } : { background: gradient }}>
        {editing && isOwn && (
          <button
            onClick={() => bannerRef.current?.click()}
            disabled={uploadingBanner}
            className="absolute inset-0 flex items-center justify-center bg-black/40 cursor-pointer transition hover:bg-black/50"
          >
            {uploadingBanner ? (
              <span className="flex items-center gap-2 text-white bg-black/50 rounded-full px-4 py-2 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Uploading…
              </span>
            ) : (
              <span className="flex items-center gap-2 text-white bg-black/50 rounded-full px-4 py-2 text-sm">
                <Camera className="w-4 h-4" /> Change banner
              </span>
            )}
          </button>
        )}
      </div>

      {/* Profile header */}
      <div className="max-w-2xl mx-auto px-4 -mt-12 sm:-mt-16 relative">
        {/* Avatar */}
        <div className="relative w-24 h-24 sm:w-32 sm:h-32 rounded-full ring-4 ring-zinc-950 overflow-hidden bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-white text-4xl font-bold shrink-0">
          {currentAvatar ? <img src={currentAvatar} alt="" className="w-full h-full object-cover" /> : (nameForDisplay || 'U').charAt(0).toUpperCase()}
          {editing && isOwn && (
            <button
              onClick={() => avatarRef.current?.click()}
              disabled={uploadingAvatar}
              className="absolute inset-0 bg-black/50 flex items-center justify-center transition hover:bg-black/60"
            >
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
              <label className="block text-xs text-zinc-400 mb-1">Bio</label>
              <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:border-red-600 outline-none resize-none" />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Website links</label>
              <div className="flex gap-2 mb-2">
                <input value={linkInput} onChange={(e) => setLinkInput(e.target.value)} placeholder="https://your-site.com"
                  className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:border-red-600 outline-none" />
                <button type="button" onClick={() => { if (linkInput.trim()) { setLinks((prev) => [...prev, linkInput.trim()]); setLinkInput(''); } }}
                  className="rounded-lg bg-red-600 hover:bg-red-500 text-white px-3 transition"><Plus className="w-4 h-4" /></button>
              </div>
              <div className="space-y-1.5">
                {links.map((l, i) => (
                  <div key={i} className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5">
                    <Globe className="w-3.5 h-3.5 text-zinc-500" />
                    <span className="text-sm text-zinc-300 truncate flex-1">{l}</span>
                    <button onClick={() => setLinks((prev) => prev.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-300"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>
            </div>

            {/* Professional mode — click opens confirmation popup */}
            <div className="flex items-center justify-between rounded-xl bg-zinc-900 border border-zinc-800 p-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${profMode ? 'bg-red-600 text-white' : 'bg-zinc-800 text-zinc-500'}`}>
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-white font-medium text-sm">Professional Mode</p>
                  <p className="text-zinc-500 text-xs">{profMode ? 'On — you can post reels' : 'Off — turn on to post reels'}</p>
                </div>
              </div>
              <button onClick={() => setShowProfConfirm(true)} disabled={togglingProf}
                className={`relative w-12 h-6 rounded-full transition ${profMode ? 'bg-red-600' : 'bg-zinc-700'}`}>
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${profMode ? 'left-6' : 'left-0.5'}`} />
              </button>
            </div>

            {/* Admin Panel button — only for admin */}
            {p.is_admin && onOpenAdmin && (
              <button
                onClick={onOpenAdmin}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-red-950/40 border border-red-800 hover:bg-red-950/60 text-red-300 font-medium px-4 py-3 text-sm transition"
              >
                <Shield className="w-5 h-5" /> Open Admin Panel
              </button>
            )}

            <div className="flex items-center gap-3">
              <button onClick={saveProfile} disabled={saving}
                className="rounded-full bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-medium px-5 py-2 text-sm transition">
                {saving ? 'Saving…' : 'Save changes'}
              </button>
              {savedMsg && <span className="text-emerald-400 text-sm flex items-center gap-1"><Check className="w-4 h-4" /> Saved</span>}
            </div>
          </div>
        ) : (
          <div className="mt-4">
            <h2 className="text-xl font-bold text-white">{nameForDisplay || 'Anonymous'}</h2>
            {p.is_admin && <span className="inline-block mt-1 text-[10px] font-bold uppercase tracking-wider bg-red-600 text-white px-2 py-0.5 rounded-full">Admin</span>}
            {p.bio && <p className="text-zinc-300 text-sm mt-3 whitespace-pre-wrap">{p.bio}</p>}

            <div className="flex gap-8 mt-4 border-y border-zinc-800 py-3">
              <Stat label="Reels" value={reels.length} />
              <Stat label="Joins" value={p.joins_count} />
              <Stat label="Joining" value={joining} />
            </div>

            {p.website_links && p.website_links.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {p.website_links.map((l, i) => (
                  <a key={i} href={l} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full bg-zinc-900 hover:bg-zinc-800 text-white text-xs px-3 py-1.5 transition border border-zinc-800">
                    <Link2 className="w-3 h-3" /> {hostname(l)}
                  </a>
                ))}
              </div>
            )}

            {p.professional_mode && <span className="inline-flex items-center gap-1 mt-4 text-xs text-emerald-400"><Check className="w-3.5 h-3.5" /> Professional Mode ON</span>}

            <div className="mt-6">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-1.5"><Play className="w-4 h-4 text-red-500" /> Reels</h3>
              {loading ? <p className="text-zinc-500 text-sm">Loading…</p> : reels.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-3"><Play className="w-6 h-6 text-zinc-600" /></div>
                  <p className="text-zinc-500 text-sm">No reels posted yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-1.5 sm:gap-2 pb-12">
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

      {/* Professional mode confirmation popup */}
      {/* Full reel view opened from grid — same as feed */}
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
                <>
                  <p className="text-white font-semibold">Turn off Professional Mode?</p>
                  <p className="text-zinc-400 text-sm mt-2">You won't be able to post reels anymore. Your existing reels will stay visible.</p>
                </>
              ) : (
                <>
                  <p className="text-white font-semibold">Turn on Professional Mode?</p>
                  <p className="text-zinc-400 text-sm mt-2">You'll be able to post reels with captions, descriptions, and hashtags — just like Instagram and YouTube creators. Other users can join you.</p>
                </>
              )}
              <div className="flex gap-2 mt-5">
                <button onClick={() => setShowProfConfirm(false)} className="flex-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white py-2.5 text-sm font-medium transition">
                  Cancel
                </button>
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

function Stat({ label, value }: { label: string; value: number }) {
  return <div><p className="text-white font-bold text-lg">{compactNum(value)}</p><p className="text-zinc-500 text-xs">{label}</p></div>;
}

function hostname(u: string) {
  try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; }
}
