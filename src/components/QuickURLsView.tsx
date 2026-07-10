import { useEffect, useState } from 'react';
import { Plus, Trash2, ExternalLink, Link2, Lock } from 'lucide-react';
import { useAuth } from '../lib/auth';

export type QuickUrl = {
  id: string;
  title: string;
  url: string;
  logo_url: string;
  created_at: string;
};

function storageKey(userId: string) {
  return `quick_urls_${userId}`;
}

function loadUrls(userId: string): QuickUrl[] {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    return JSON.parse(raw) as QuickUrl[];
  } catch {
    return [];
  }
}

function saveUrls(userId: string, urls: QuickUrl[]) {
  localStorage.setItem(storageKey(userId), JSON.stringify(urls));
}

export function getQuickUrlCount(userId: string): number {
  return loadUrls(userId).length;
}

export function getLatestQuickUrlTime(userId: string): number {
  const urls = loadUrls(userId);
  if (urls.length === 0) return 0;
  return new Date(urls[0].created_at).getTime();
}

export default function QuickURLsView({ onOpenAuth }: { onOpenAuth: () => void }) {
  const { user } = useAuth();
  const [urls, setUrls] = useState<QuickUrl[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!user) { setUrls([]); return; }
    setUrls(loadUrls(user.id));
  }, [user]);

  async function addUrl(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setErr(null);
    let normalized = url.trim();
    if (!/^https?:\/\//i.test(normalized)) normalized = `https://${normalized}`;
    try {
      new URL(normalized);
    } catch {
      setErr('Enter a valid URL');
      return;
    }
    setBusy(true);
    // Always use Google favicon service — clean logo detection, no blobs
    const logo = `https://www.google.com/s2/favicons?domain=${hostnameOf(normalized)}&sz=128`;
    const entry: QuickUrl = {
      id: crypto.randomUUID(),
      title: title.trim() || hostnameOf(normalized),
      url: normalized,
      logo_url: logo,
      created_at: new Date().toISOString(),
    };
    const next = [entry, ...urls];
    setUrls(next);
    saveUrls(user.id, next);
    setBusy(false);
    setTitle('');
    setUrl('');
    setShowAdd(false);
  }

  function deleteUrl(id: string) {
    if (!user) return;
    const next = urls.filter((u) => u.id !== id);
    setUrls(next);
    saveUrls(user.id, next);
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4">
          <Lock className="w-7 h-7 text-red-500" />
        </div>
        <p className="text-white font-semibold text-lg">Your private links</p>
        <p className="text-zinc-400 text-sm mt-1 max-w-sm">
          Quick URLs are personal — stored locally on your device, only visible to you. Sign up or log in to start adding.
        </p>
        <button
          onClick={onOpenAuth}
          className="mt-5 rounded-full bg-red-600 hover:bg-red-500 text-white font-medium px-5 py-2.5 transition shadow-lg shadow-red-900/30"
        >
          Sign up / Log in
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold text-white">Quick URLs</h2>
          <p className="text-sm text-zinc-500">Your private shortcuts — stored on this device, only visible to you.</p>
        </div>
        <button
          onClick={() => setShowAdd((s) => !s)}
          className="flex items-center gap-1.5 rounded-full bg-red-600 hover:bg-red-500 text-white font-medium px-4 py-2 text-sm transition shadow-lg shadow-red-900/30"
        >
          <Plus className="w-4 h-4" /> Add URL
        </button>
      </div>

      {showAdd && (
        <form onSubmit={addUrl} className="mb-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 p-4 space-y-3">
          {err && <div className="text-sm text-red-300 bg-red-950/50 border border-red-800 rounded-lg px-3 py-2">{err}</div>}
          <div className="grid sm:grid-cols-[1fr_2fr_auto] gap-3">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title (optional)"
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-red-600 outline-none"
            />
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              required
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-red-600 outline-none"
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-medium px-4 py-2 text-sm transition"
            >
              {busy ? 'Adding…' : 'Save'}
            </button>
          </div>
        </form>
      )}

      {urls.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4">
            <Link2 className="w-7 h-7 text-zinc-600" />
          </div>
          <p className="text-zinc-400 font-medium">No quick URLs yet</p>
          <p className="text-zinc-600 text-sm mt-1">Click "Add URL" to save your first shortcut.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {urls.map((u) => (
            <div
              key={u.id}
              className="group relative rounded-2xl bg-zinc-900/70 border border-zinc-800 hover:border-red-700/70 p-4 transition-all hover:-translate-y-0.5"
            >
              <button
                onClick={() => deleteUrl(u.id)}
                className="absolute top-3 right-3 text-zinc-500 hover:text-red-400 transition opacity-0 group-hover:opacity-100"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <a href={u.url} target="_blank" rel="noopener noreferrer" className="block">
                <div className="w-12 h-12 rounded-xl bg-white/95 flex items-center justify-center overflow-hidden mb-3 ring-1 ring-zinc-700">
                  <FavLogo url={u.logo_url} site={u.url} name={u.title} />
                </div>
                <h3 className="font-semibold text-white text-sm truncate pr-5">{u.title}</h3>
                <p className="text-xs text-zinc-500 truncate mt-0.5">{hostnameOf(u.url)}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-red-400">
                  Open <ExternalLink className="w-3 h-3" />
                </span>
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FavLogo({ url, site, name }: { url: string; site: string; name: string }) {
  const sources = buildFavSources(url, site);
  const [idx, setIdx] = useState(0);
  if (idx < sources.length) {
    return <img key={sources[idx]} src={sources[idx]} alt={name} className="w-7 h-7 object-contain" onError={() => setIdx((i) => i + 1)} />;
  }
  return <span className="text-xl font-bold text-zinc-700 select-none">{name.charAt(0).toUpperCase()}</span>;
}

function buildFavSources(logoUrl: string, siteUrl: string): string[] {
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

function hostnameOf(u: string) {
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return u;
  }
}
