import { useEffect, useState } from 'react';
import { X, Bookmark, Play, ExternalLink, Trash2 } from 'lucide-react';
import { supabase, type AITool, type Reel, type ToolBookmark, compactNum } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { Logo } from './AIToolsView';

export default function SavedDrawer({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const [tools, setTools] = useState<AITool[]>([]);
  const [reels, setReels] = useState<Reel[]>([]);
  const [tab, setTab] = useState<'tools' | 'reels'>('tools');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [b, s] = await Promise.all([
        supabase.from('ai_tool_bookmarks').select('tool_id').eq('user_id', user.id),
        supabase.from('reel_saves').select('reel_id').eq('user_id', user.id),
      ]);
      const toolIds = ((b.data as ToolBookmark[]) ?? []).map((x) => x.tool_id);
      const reelIds = ((s.data as { reel_id: string }[]) ?? []).map((x) => x.reel_id);
      const [tData, rData] = await Promise.all([
        toolIds.length ? supabase.from('ai_tools').select('*').in('id', toolIds) : Promise.resolve({ data: [] }),
        reelIds.length ? supabase.from('reels').select('*').in('id', reelIds) : Promise.resolve({ data: [] }),
      ]);
      setTools((tData.data as AITool[]) ?? []);
      setReels((rData.data as Reel[]) ?? []);
      setLoading(false);
    })();
  }, [user]);

  async function unbookmarkTool(id: string) {
    await supabase.from('ai_tool_bookmarks').delete().eq('tool_id', id).eq('user_id', user!.id);
    setTools((p) => p.filter((t) => t.id !== id));
  }

  async function unsaveReel(id: string) {
    await supabase.from('reel_saves').delete().eq('reel_id', id).eq('user_id', user!.id);
    setReels((p) => p.filter((r) => r.id !== id));
  }

  if (!user) return null;

  return (
    <div className="fixed inset-0 z-[100] flex justify-end bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md h-full bg-zinc-900 border-l border-zinc-800 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h2 className="font-semibold text-white flex items-center gap-2">
            <Bookmark className="w-5 h-5 text-red-500" /> Saved
          </h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex gap-1 px-5 py-3 border-b border-zinc-800">
          <button
            onClick={() => setTab('tools')}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${tab === 'tools' ? 'bg-red-600 text-white' : 'text-zinc-400 hover:text-white'}`}
          >
            Tools ({tools.length})
          </button>
          <button
            onClick={() => setTab('reels')}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${tab === 'reels' ? 'bg-red-600 text-white' : 'text-zinc-400 hover:text-white'}`}
          >
            Reels ({reels.length})
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
          {loading ? (
            <p className="text-zinc-500 text-sm text-center py-8">Loading…</p>
          ) : tab === 'tools' ? (
            tools.length === 0 ? (
              <p className="text-zinc-600 text-sm text-center py-12">No bookmarked tools yet.</p>
            ) : (
              <div className="space-y-2">
                {tools.map((t) => (
                  <div key={t.id} className="group flex items-center gap-3 rounded-xl bg-zinc-800/60 hover:bg-zinc-800 p-3 transition">
                    <div className="w-10 h-10 rounded-lg bg-white/95 flex items-center justify-center overflow-hidden shrink-0">
                      <Logo url={t.logo_url} site={t.url} name={t.name} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-white text-sm font-medium truncate">{t.name}</p>
                      <p className="text-zinc-500 text-xs truncate">{t.description}</p>
                    </div>
                    <a href={t.url} target="_blank" rel="noopener noreferrer"
                      className="text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    <button onClick={() => unbookmarkTool(t.id)} className="text-zinc-500 hover:text-red-400 transition">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )
          ) : reels.length === 0 ? (
            <p className="text-zinc-600 text-sm text-center py-12">No saved reels yet.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {reels.map((r) => (
                <div key={r.id} className="relative aspect-[9/16] rounded-lg overflow-hidden bg-black group">
                  <video src={r.video_url} poster={r.thumbnail_url || undefined} preload="metadata" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                  <p className="absolute bottom-1 left-1.5 right-1.5 text-white text-[11px] line-clamp-2">{r.caption}</p>
                  <div className="absolute top-1.5 right-1.5 flex items-center gap-1 text-white text-[10px] bg-black/40 rounded px-1.5 py-0.5">
                    <Play className="w-3 h-3 fill-white" /> {compactNum(r.likes_count)}
                  </div>
                  <button
                    onClick={() => unsaveReel(r.id)}
                    className="absolute top-1.5 left-1.5 w-7 h-7 rounded-full bg-black/40 text-red-400 hover:bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
