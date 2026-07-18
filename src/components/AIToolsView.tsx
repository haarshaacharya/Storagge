import { useEffect, useMemo, useState } from 'react';
import { Bookmark, BookmarkCheck, Sparkles, Search } from 'lucide-react';
import { supabase, type AITool, type Category, type ToolBookmark, isNewActive } from '../lib/supabase';
import { useAuth } from '../lib/auth';

type RatingMap = Record<string, { avg: number; count: number }>;
type MyRatingMap = Record<string, number>;

export default function AIToolsView({ search }: { search: string }) {
  const { user } = useAuth();
  const [tools, setTools] = useState<AITool[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [ratings, setRatings] = useState<RatingMap>({});
  const [myRatings, setMyRatings] = useState<MyRatingMap>({});
  const [activeCat, setActiveCat] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: t }, { data: c }, { data: r }] = await Promise.all([
        supabase.from('ai_tools').select('*').order('sort_order').order('created_at', { ascending: false }),
        supabase.from('categories').select('*').order('sort_order'),
        supabase.from('tool_ratings').select('tool_id, rating'),
      ]);
      setTools((t as AITool[]) ?? []);
      setCats((c as Category[]) ?? []);
      // aggregate global ratings (all users including anon)
      const rm: RatingMap = {};
      for (const row of (r as { tool_id: string; rating: number }[]) ?? []) {
        if (!rm[row.tool_id]) rm[row.tool_id] = { avg: 0, count: 0 };
        rm[row.tool_id].avg += row.rating;
        rm[row.tool_id].count += 1;
      }
      for (const k of Object.keys(rm)) rm[k].avg = rm[k].avg / rm[k].count;
      setRatings(rm);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!user) { setBookmarks(new Set()); setMyRatings({}); return; }
    Promise.all([
      supabase.from('ai_tool_bookmarks').select('tool_id').eq('user_id', user.id),
      supabase.from('tool_ratings').select('tool_id, rating').eq('user_id', user.id),
    ]).then(([b, r]) => {
      setBookmarks(new Set((b.data as ToolBookmark[] | null)?.map((x) => x.tool_id) ?? []));
      const mr: MyRatingMap = {};
      for (const row of (r.data as { tool_id: string; rating: number }[]) ?? []) mr[row.tool_id] = row.rating;
      setMyRatings(mr);
    });
  }, [user]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tools.filter((t) => {
      if (activeCat !== 'all' && t.category_id !== activeCat) return false;
      if (!q) return true;
      return t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q);
    });
  }, [tools, search, activeCat]);

  async function toggleBookmark(tool: AITool) {
    if (!user) { alert('Please sign up or log in to bookmark tools.'); return; }
    const isBookmarked = bookmarks.has(tool.id);
    if (isBookmarked) {
      await supabase.from('ai_tool_bookmarks').delete().eq('user_id', user.id).eq('tool_id', tool.id);
      setBookmarks((prev) => { const n = new Set(prev); n.delete(tool.id); return n; });
    } else {
      await supabase.from('ai_tool_bookmarks').insert({ user_id: user.id, tool_id: tool.id });
      setBookmarks((prev) => new Set(prev).add(tool.id));
    }
  }

  async function openTool(tool: AITool) {
    supabase.from('tool_usage').insert({ tool_id: tool.id, tool_name: tool.name, user_id: user?.id ?? null }).then(() => {});
    window.open(tool.url, '_blank', 'noopener,noreferrer');
  }

  async function rateTool(tool: AITool, stars: number) {
    const prevMyR = myRatings[tool.id];
    setMyRatings((m) => ({ ...m, [tool.id]: stars }));

    if (user) {
      const { error } = await supabase
        .from('tool_ratings')
        .upsert({ tool_id: tool.id, user_id: user.id, rating: stars }, { onConflict: 'tool_id,user_id' });
      if (error) { setMyRatings((m) => ({ ...m, [tool.id]: prevMyR })); return; }
    } else {
      // anonymous — insert without user_id
      const { error } = await supabase
        .from('tool_ratings')
        .insert({ tool_id: tool.id, rating: stars });
      if (error) { setMyRatings((m) => ({ ...m, [tool.id]: prevMyR })); return; }
    }

    // Recompute aggregate locally
    setRatings((prev) => {
      const existing = prev[tool.id];
      let avg: number, count: number;
      if (existing) {
        const hadPrevRating = prevMyR != null;
        const oldTotal = existing.avg * existing.count;
        const removedOld = hadPrevRating ? prevMyR : 0;
        const newTotal = oldTotal - removedOld + stars;
        count = hadPrevRating ? existing.count : existing.count + 1;
        avg = newTotal / count;
      } else {
        avg = stars; count = 1;
      }
      return { ...prev, [tool.id]: { avg, count } };
    });
  }

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-40 rounded-2xl bg-zinc-900/60 animate-pulse" />)}
      </div>
    );
  }

  return (
    <div>
      <div className="flex gap-2 overflow-x-auto pb-3 mb-4 scrollbar-thin">
        <CatChip active={activeCat === 'all'} onClick={() => setActiveCat('all')} label="All" />
        {cats.map((c) => <CatChip key={c.id} active={activeCat === c.id} onClick={() => setActiveCat(c.id)} label={c.name} />)}
      </div>

      {filtered.length === 0 ? <EmptyState /> : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((tool) => {
            const isNew = isNewActive(tool.created_at, tool.is_new);
            const bm = bookmarks.has(tool.id);
            const r = ratings[tool.id];
            const myR = myRatings[tool.id];
            return (
              <div key={tool.id}
                className="group relative rounded-2xl bg-zinc-900/70 border border-zinc-800 hover:border-red-700/70 p-4 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-red-950/30 cursor-pointer"
                onClick={() => openTool(tool)}>
                {isNew && (
                  <span className="absolute -top-2 -left-2 z-10 text-[10px] font-bold tracking-wider uppercase bg-red-600 text-white px-2 py-0.5 rounded-full shadow-lg">New</span>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); toggleBookmark(tool); }}
                  className="absolute top-3 right-3 text-zinc-500 hover:text-red-400 transition opacity-0 group-hover:opacity-100 z-10"
                  title={bm ? 'Remove bookmark' : 'Bookmark'}
                >
                  {bm ? <BookmarkCheck className="w-4 h-4 text-red-500" /> : <Bookmark className="w-4 h-4" />}
                </button>

                <div className="w-12 h-12 rounded-xl bg-white/95 flex items-center justify-center overflow-hidden mb-3 ring-1 ring-zinc-700">
                  <Logo url={tool.logo_url} site={tool.url} name={tool.name} />
                </div>
                <h3 className="font-semibold text-white text-sm truncate pr-5">{tool.name}</h3>
                <p className="text-xs text-zinc-500 line-clamp-2 mt-1 min-h-[2rem]">{tool.description}</p>

                {/* Global star rating with half-star support */}
                <div className="flex items-center gap-1.5 mt-2" onClick={(e) => e.stopPropagation()}>
                  <HalfStarRow avg={r?.avg ?? 0} myRating={myR ?? 0} onRate={(s) => rateTool(tool, s)} />
                  {r && r.count > 0 && (
                    <span className="text-[10px] text-zinc-500">
                      {r.avg.toFixed(1)} ({r.count})
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Half-star display + click-to-rate
function HalfStarRow({ avg, myRating, onRate }: { avg: number; myRating: number; onRate: (s: number) => void }) {
  const [hover, setHover] = useState(0);
  // When hovering show hover value; when rated show myRating; otherwise show avg
  const effective = hover > 0 ? hover : (myRating > 0 ? myRating : avg);

  return (
    <div className="flex items-center gap-0.5" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((star) => {
        const fullFill = effective >= star;
        const halfFill = !fullFill && effective >= star - 0.5 && effective > 0;
        // Color: my rated stars = bright red; global avg = dim red
        const isMyRated = myRating > 0 && (hover > 0 ? hover >= star : myRating >= star);
        return (
          <button
            key={star}
            type="button"
            title={`Rate ${star} star${star > 1 ? 's' : ''}`}
            onMouseEnter={() => setHover(star)}
            onClick={(e) => { e.stopPropagation(); onRate(star); }}
            className="relative hover:scale-125 transition-transform"
            style={{ width: 15, height: 15 }}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" className="text-zinc-700" fill="currentColor">
              <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
            </svg>
            {(fullFill || halfFill) && (
              <svg
                viewBox="0 0 24 24"
                width="14"
                height="14"
                className="absolute inset-0"
                fill={isMyRated ? '#ef4444' : '#ef444480'}
                style={halfFill ? { clipPath: 'inset(0 50% 0 0)' } : {}}
              >
                <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
              </svg>
            )}
          </button>
        );
      })}
    </div>
  );
}

function CatChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick}
      className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition ${active ? 'bg-red-600 text-white' : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-white hover:border-zinc-700'}`}>
      {label}
    </button>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4"><Search className="w-7 h-7 text-zinc-600" /></div>
      <p className="text-zinc-400 font-medium">No tools found</p>
      <p className="text-zinc-600 text-sm mt-1 flex items-center gap-1"><Sparkles className="w-3.5 h-3.5" /> Try a different search or category.</p>
    </div>
  );
}

export function Logo({ url, site, name }: { url: string; site: string; name: string }) {
  return <SmartLogo url={url} site={site} name={name} size="full" />;
}

function SmartLogo({ url, site, name, size }: { url: string; site: string; name: string; size: 'full' | 'icon' }) {
  const sources = buildSources(url, site);
  const [idx, setIdx] = useState(0);

  const cls = size === 'full' ? 'w-full h-full object-contain' : 'w-7 h-7 object-contain';

  if (idx < sources.length) {
    return (
      <img
        key={sources[idx]}
        src={sources[idx]}
        alt={name}
        className={cls}
        onError={() => setIdx((i) => i + 1)}
      />
    );
  }
  return (
    <span className="text-xl font-bold text-zinc-700 select-none">
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

function buildSources(logoUrl: string, siteUrl: string): string[] {
  const out: string[] = [];
  if (logoUrl && logoUrl.trim()) out.push(logoUrl.trim());
  try {
    const { hostname } = new URL(siteUrl);
    out.push(`https://www.google.com/s2/favicons?domain=${hostname}&sz=128`);
    out.push(`https://icons.duckduckgo.com/ip3/${hostname}.ico`);
    out.push(`https://${hostname}/favicon.ico`);
  } catch { /* skip */ }
  return out;
}
