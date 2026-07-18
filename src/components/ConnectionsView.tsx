import { useEffect, useState, useRef, useCallback } from 'react';
import { Search, Users, UserPlus, X } from 'lucide-react';
import { supabase, type Profile, compactNum } from '../lib/supabase';
import { useAuth } from '../lib/auth';

const PAGE = 20;

export default function ConnectionsView({
  onOpenAuth,
  onOpenProfile,
}: {
  onOpenAuth: () => void;
  onOpenProfile: (p: Profile) => void;
}) {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const fetchProfiles = useCallback(async (offset: number) => {
    let q = supabase.from('profiles').select('*').eq('is_admin', false).order('joins_count', { ascending: false });
    if (user) q = q.neq('id', user.id);
    const { data } = await q.range(offset, offset + PAGE - 1);
    return (data as Profile[]) ?? [];
  }, [user]);

  const loadFollowState = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('follows').select('following_id').eq('follower_id', user.id);
    setFollowing(new Set(((data as { following_id: string }[]) ?? []).map((f) => f.following_id)));
  }, [user]);

  useEffect(() => {
    setProfiles([]);
    setHasMore(true);
    setLoading(true);
    (async () => {
      const data = await fetchProfiles(0);
      setProfiles(data);
      setHasMore(data.length === PAGE);
      await loadFollowState();
      setLoading(false);
    })();
  }, [user, fetchProfiles, loadFollowState]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
        setLoadingMore(true);
        fetchProfiles(profiles.length).then((more) => {
          if (more.length > 0) {
            setProfiles((prev) => [...prev, ...more]);
            setHasMore(more.length === PAGE);
          } else setHasMore(false);
          setLoadingMore(false);
        });
      }
    }, { threshold: 0.1 });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [profiles.length, hasMore, loadingMore, loading, fetchProfiles]);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!search.trim()) { setSearchResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      setSearchLoading(true);
      const q = search.trim().toLowerCase();
      const { data } = await supabase.from('profiles').select('*')
        .eq('is_admin', false)
        .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`).limit(20);
      setSearchResults((data as Profile[]) ?? []);
      setSearchLoading(false);
    }, 350);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [search]);

  async function toggleFollow(targetId: string) {
    if (!user) { onOpenAuth(); return; }
    const isFollowing = following.has(targetId);
    setFollowing((prev) => {
      const n = new Set(prev);
      isFollowing ? n.delete(targetId) : n.add(targetId);
      return n;
    });
    if (isFollowing) await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', targetId);
    else await supabase.from('follows').insert({ follower_id: user.id, following_id: targetId });
  }

  const displayList = search.trim() ? searchResults : profiles;

  return (
    <div className="w-full">
      {/* Search bar */}
      <div className="mb-6 max-w-2xl mx-auto relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or @username…"
          className="w-full bg-zinc-900 border border-zinc-800 rounded-full pl-11 pr-10 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-red-600 outline-none"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-20 rounded-2xl bg-zinc-900/60 animate-pulse" />
          ))}
        </div>
      ) : displayList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4">
            <Users className="w-7 h-7 text-zinc-600" />
          </div>
          <p className="text-zinc-400 font-medium">No users found</p>
        </div>
      ) : (
        <>
          {searchLoading && search.trim() && (
            <div className="mb-3 flex items-center gap-2 text-zinc-500 text-sm">
              <div className="w-4 h-4 border-2 border-zinc-600 border-t-transparent rounded-full animate-spin" />
              Searching…
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-20">
            {displayList.map((p) => (
              <ConnectionCard
                key={p.id}
                profile={p}
                isFollowing={following.has(p.id)}
                isSelf={user?.id === p.id}
                onOpenProfile={() => onOpenProfile(p)}
                onFollow={() => toggleFollow(p.id)}
                onOpenAuth={onOpenAuth}
                isLoggedIn={!!user}
              />
            ))}
          </div>
          <div ref={sentinelRef} className="h-4" />
          {loadingMore && (
            <div className="flex justify-center py-4">
              <div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ConnectionCard({
  profile, isFollowing, isSelf, onOpenProfile, onFollow, onOpenAuth, isLoggedIn,
}: {
  profile: Profile;
  isFollowing: boolean;
  isSelf: boolean;
  onOpenProfile: () => void;
  onFollow: () => void;
  onOpenAuth: () => void;
  isLoggedIn: boolean;
}) {
  const interests = Array.isArray(profile.interests) ? profile.interests.slice(0, 3) : [];

  return (
    <div className="flex items-center gap-3 bg-zinc-900/80 border border-zinc-800 hover:border-zinc-700 rounded-2xl p-4 transition group">
      <button onClick={onOpenProfile} className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 border-2 border-zinc-700 group-hover:border-red-700 transition">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-white font-bold">
              {(profile.display_name || 'U').charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-white text-sm font-semibold truncate">{profile.display_name || 'Unknown'}</p>
          {profile.username && <p className="text-zinc-500 text-xs">@{profile.username}</p>}
          {interests.length > 0 && (
            <div className="flex gap-1 mt-1 flex-wrap">
              {interests.map((i) => (
                <span key={i} className="text-[10px] text-zinc-500 bg-zinc-800 rounded-full px-1.5 py-0.5">{i}</span>
              ))}
            </div>
          )}
          <p className="text-zinc-600 text-[10px] mt-0.5">{compactNum(profile.joins_count)} joins</p>
        </div>
      </button>

      {!isSelf && (
        <button
          onClick={isLoggedIn ? onFollow : onOpenAuth}
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition flex items-center gap-1 ${
            isFollowing
              ? 'bg-zinc-800 text-zinc-300 border border-zinc-700 hover:border-red-700 hover:text-red-400'
              : 'bg-red-600 text-white hover:bg-red-500'
          }`}
        >
          {isFollowing ? 'Joined' : <><UserPlus className="w-3 h-3" /> Join</>}
        </button>
      )}
    </div>
  );
}