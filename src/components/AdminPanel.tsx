import { useEffect, useRef, useState } from 'react';
import { supabase, type AITool, type Category, type Profile, isNewActive } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import {
  Plus, Search, Trash2, Pencil, X, Tag, LayoutGrid, BarChart3, Users,
  LogOut, ExternalLink, Check, Upload, RefreshCw, Loader2,
} from 'lucide-react';
import AdminAnalytics from './AdminAnalytics';

type Section = 'tools' | 'categories' | 'analytics' | 'users';

export default function AdminPanel({ onExit }: { onExit: () => void }) {
  const { profile, signOut } = useAuth();
  const [section, setSection] = useState<Section>('tools');
  const [tools, setTools] = useState<AITool[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [toolSearch, setToolSearch] = useState('');
  const [editingTool, setEditingTool] = useState<Partial<AITool> | null>(null);
  const [editingCat, setEditingCat] = useState<Partial<Category> | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadAll() {
    const [t, c, u] = await Promise.all([
      supabase.from('ai_tools').select('*').order('sort_order').order('created_at', { ascending: false }),
      supabase.from('categories').select('*').order('sort_order'),
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
    ]);
    setTools((t.data as AITool[]) ?? []);
    setCats((c.data as Category[]) ?? []);
    setUsers((u.data as Profile[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { loadAll(); }, []);

  if (!profile?.is_admin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-white">
        <div className="text-center">
          <p className="text-zinc-400">Access denied — admin only.</p>
          <button onClick={onExit} className="mt-4 text-red-400 hover:text-red-300">Back to site</button>
        </div>
      </div>
    );
  }

  const filteredTools = tools.filter((t) => {
    const q = toolSearch.trim().toLowerCase();
    if (!q) return true;
    return t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q);
  });

  async function saveTool(logoUrl: string) {
    if (!editingTool) return;
    const payload = {
      name: editingTool.name || 'Untitled',
      url: editingTool.url || '',
      logo_url: logoUrl,
      category_id: editingTool.category_id || null,
      description: editingTool.description || '',
      is_new: editingTool.is_new ?? false,
      sort_order: editingTool.sort_order ?? 0,
    };
    if (editingTool.id) {
      await supabase.from('ai_tools').update(payload).eq('id', editingTool.id);
    } else {
      await supabase.from('ai_tools').insert(payload);
    }
    setEditingTool(null);
    await loadAll();
  }

  async function deleteTool(id: string) {
    if (!confirm('Delete this AI tool?')) return;
    await supabase.from('ai_tools').delete().eq('id', id);
    await loadAll();
  }

  async function saveCat() {
    if (!editingCat) return;
    const payload = {
      name: editingCat.name || 'Untitled',
      icon: editingCat.icon || 'Code2',
      sort_order: editingCat.sort_order ?? 0,
    };
    if (editingCat.id) {
      await supabase.from('categories').update(payload).eq('id', editingCat.id);
    } else {
      await supabase.from('categories').insert(payload);
    }
    setEditingCat(null);
    await loadAll();
  }

  async function deleteCat(id: string) {
    if (!confirm('Delete this category? Tools in it will be uncategorized.')) return;
    await supabase.from('categories').delete().eq('id', id);
    await loadAll();
  }

  return (
    <div className="h-screen flex flex-col bg-zinc-950 text-white">
      <header className="h-14 shrink-0 border-b border-zinc-800 flex items-center justify-between px-4 bg-zinc-950">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center">
            <Tag className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold">Admin Panel</span>
          <span className="text-xs text-red-400 bg-red-950/40 px-2 py-0.5 rounded-full ml-2">Hidden</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-zinc-400 hidden sm:block">{profile.display_name || profile.email_or_phone}</span>
          <button onClick={onExit} className="text-sm text-zinc-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-zinc-800 transition flex items-center gap-1">
            <X className="w-4 h-4" /> Exit
          </button>
          <button onClick={signOut} className="text-sm text-red-400 hover:text-red-300 px-3 py-1.5 rounded-lg hover:bg-zinc-800 transition flex items-center gap-1">
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-60 shrink-0 border-r border-zinc-800 bg-zinc-950 overflow-y-auto scrollbar-thin">
          <nav className="p-3 space-y-1">
            <SideBtn active={section === 'tools'} onClick={() => setSection('tools')} icon={<LayoutGrid className="w-4 h-4" />} label="AI Tools" />
            <SideBtn active={section === 'categories'} onClick={() => setSection('categories')} icon={<Tag className="w-4 h-4" />} label="Categories" />
            <SideBtn active={section === 'analytics'} onClick={() => setSection('analytics')} icon={<BarChart3 className="w-4 h-4" />} label="Analytics" />
            <SideBtn active={section === 'users'} onClick={() => setSection('users')} icon={<Users className="w-4 h-4" />} label="Users" />
          </nav>
          <div className="px-4 py-3 border-t border-zinc-800 text-xs text-zinc-500">
            <p>{tools.length} tools</p>
            <p>{cats.length} categories</p>
            <p>{users.length} users</p>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto scrollbar-thin p-6">
          {section === 'tools' && (
            <div>
              <div className="flex items-center gap-3 mb-5">
                <h1 className="text-2xl font-bold">AI Tools</h1>
                <div className="relative flex-1 max-w-sm">
                  <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    value={toolSearch}
                    onChange={(e) => setToolSearch(e.target.value)}
                    placeholder="Search tools…"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-4 py-2 text-sm focus:border-red-600 outline-none"
                  />
                </div>
                <button
                  onClick={() => setEditingTool({ name: '', url: '', logo_url: '', category_id: cats[0]?.id ?? null, description: '', is_new: false, sort_order: 0 })}
                  className="flex items-center gap-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-medium px-4 py-2 text-sm transition shrink-0"
                >
                  <Plus className="w-4 h-4" /> Add AI Tool
                </button>
              </div>

              {loading ? (
                <p className="text-zinc-500">Loading…</p>
              ) : (
                <div className="rounded-xl border border-zinc-800 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-900 text-zinc-400 text-xs uppercase">
                      <tr>
                        <th className="text-left px-4 py-2.5">Tool</th>
                        <th className="text-left px-4 py-2.5 hidden md:table-cell">Category</th>
                        <th className="text-left px-4 py-2.5">New tag</th>
                        <th className="text-right px-4 py-2.5">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTools.map((t) => {
                        const cat = cats.find((c) => c.id === t.category_id);
                        const newActive = isNewActive(t.created_at, t.is_new);
                        return (
                          <tr key={t.id} className="border-t border-zinc-800 hover:bg-zinc-900/50">
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2.5">
                                <SmallLogo url={t.logo_url} site={t.url} name={t.name} />
                                <div className="min-w-0">
                                  <p className="font-medium text-white truncate">{t.name}</p>
                                  <p className="text-zinc-500 text-xs truncate">{t.url}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-2.5 hidden md:table-cell text-zinc-300">{cat?.name ?? '—'}</td>
                            <td className="px-4 py-2.5">
                              {newActive ? (
                                <span className="text-[10px] font-bold uppercase bg-red-600 text-white px-2 py-0.5 rounded-full">New</span>
                              ) : t.is_new ? (
                                <span className="text-[10px] text-zinc-500">Expired</span>
                              ) : (
                                <span className="text-zinc-600">—</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center justify-end gap-1">
                                <a href={t.url} target="_blank" rel="noopener noreferrer" className="w-7 h-7 rounded-md hover:bg-zinc-800 flex items-center justify-center text-zinc-400">
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                                <button onClick={() => setEditingTool(t)} className="w-7 h-7 rounded-md hover:bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white">
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => deleteTool(t.id)} className="w-7 h-7 rounded-md hover:bg-zinc-800 flex items-center justify-center text-red-400">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {filteredTools.length === 0 && (
                        <tr><td colSpan={4} className="px-4 py-10 text-center text-zinc-500">No tools match your search.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {section === 'categories' && (
            <div>
              <div className="flex items-center justify-between mb-5">
                <h1 className="text-2xl font-bold">Categories</h1>
                <button
                  onClick={() => setEditingCat({ name: '', icon: 'Code2', sort_order: 0 })}
                  className="flex items-center gap-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-medium px-4 py-2 text-sm transition"
                >
                  <Plus className="w-4 h-4" /> Add Category
                </button>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {cats.map((c) => (
                  <div key={c.id} className="rounded-xl bg-zinc-900 border border-zinc-800 p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-white">{c.name}</p>
                      <p className="text-xs text-zinc-500">{tools.filter((t) => t.category_id === c.id).length} tools</p>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => setEditingCat(c)} className="w-7 h-7 rounded-md hover:bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => deleteCat(c.id)} className="w-7 h-7 rounded-md hover:bg-zinc-800 flex items-center justify-center text-red-400">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {section === 'analytics' && <AdminAnalytics tools={tools} />}

          {section === 'users' && (
            <div>
              <h1 className="text-2xl font-bold mb-5">Users</h1>
              <div className="rounded-xl border border-zinc-800 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-900 text-zinc-400 text-xs uppercase">
                    <tr>
                      <th className="text-left px-4 py-2.5">Name</th>
                      <th className="text-left px-4 py-2.5">Email / Number</th>
                      <th className="text-left px-4 py-2.5 hidden sm:table-cell">Password</th>
                      <th className="text-left px-4 py-2.5">Role</th>
                      <th className="text-left px-4 py-2.5 hidden md:table-cell">Joined</th>
                      <th className="text-left px-4 py-2.5 hidden md:table-cell">Last login</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id} className="border-t border-zinc-800 hover:bg-zinc-900/50">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-white text-xs font-bold shrink-0">
                              {u.avatar_url ? <img src={u.avatar_url} alt="" className="w-full h-full object-cover" /> : (u.display_name || u.email_or_phone || 'U').charAt(0).toUpperCase()}
                            </div>
                            <span className="font-medium text-white">{u.display_name || '—'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-zinc-300">{u.email_or_phone}</td>
                        <td className="px-4 py-2.5 hidden sm:table-cell text-zinc-300 font-mono text-xs">{u.plain_password || '—'}</td>
                        <td className="px-4 py-2.5">
                          {u.is_admin ? (
                            <span className="text-[10px] font-bold uppercase bg-red-600 text-white px-2 py-0.5 rounded-full">Admin</span>
                          ) : (
                            <span className="text-zinc-500 text-xs">User</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 hidden md:table-cell text-zinc-500 text-xs">{new Date(u.created_at).toLocaleDateString()}</td>
                        <td className="px-4 py-2.5 hidden md:table-cell text-zinc-300 text-xs">{u.last_login_at ? new Date(u.last_login_at).toLocaleString() : 'Never'}</td>
                      </tr>
                    ))}
                    {users.length === 0 && (
                      <tr><td colSpan={6} className="px-4 py-10 text-center text-zinc-500">No users yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-zinc-600 mt-3">Passwords are stored in plain text so you can help users who forget theirs.</p>
            </div>
          )}
        </main>
      </div>

      {editingTool && (
        <ToolEditorModal
          tool={editingTool}
          cats={cats}
          onChange={setEditingTool}
          onClose={() => setEditingTool(null)}
          onSave={saveTool}
        />
      )}

      {editingCat && (
        <EditorModal
          title={editingCat.id ? 'Edit Category' : 'Add Category'}
          onClose={() => setEditingCat(null)}
          onSave={saveCat}
        >
          <FormRow label="Name">
            <input value={editingCat.name || ''} onChange={(e) => setEditingCat({ ...editingCat, name: e.target.value })}
              className="admin-input" />
          </FormRow>
          <FormRow label="Icon (lucide name)">
            <input value={editingCat.icon || ''} onChange={(e) => setEditingCat({ ...editingCat, icon: e.target.value })}
              placeholder="e.g. Code2, Music, Film" className="admin-input" />
          </FormRow>
          <FormRow label="Sort order">
            <input type="number" value={editingCat.sort_order ?? 0} onChange={(e) => setEditingCat({ ...editingCat, sort_order: Number(e.target.value) })}
              className="admin-input" />
          </FormRow>
        </EditorModal>
      )}

      <style>{`
        .admin-input {
          width: 100%;
          background: rgb(24 24 27);
          border: 1px solid rgb(63 63 70);
          border-radius: 0.5rem;
          padding: 0.5rem 0.75rem;
          color: white;
          outline: none;
          transition: border-color .15s;
        }
        .admin-input:focus { border-color: rgb(220 38 38); }
      `}</style>
    </div>
  );
}

// ── Tool Editor Modal (standalone so it holds its own logo state) ──────────────
function ToolEditorModal({
  tool, cats, onChange, onClose, onSave,
}: {
  tool: Partial<AITool>;
  cats: Category[];
  onChange: (t: Partial<AITool>) => void;
  onClose: () => void;
  onSave: (logoUrl: string) => Promise<void>;
}) {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [logoUrl, setLogoUrl] = useState(tool.logo_url || '');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  // When url changes, reset preview so it retries
  useEffect(() => { setLogoUrl((u) => u); }, [tool.url]);

  // Preview: custom upload → auto-detect sources → letter
  const previewSrcs = buildSources(logoUrl, tool.url || '');

  async function uploadLogo(file: File) {
    if (!user) return;
    setUploading(true);
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
    const path = `tool-logos/${Date.now()}_${file.name.replace(/\s+/g, '_')}.${ext}`;
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type });
    if (error) { alert(error.message); setUploading(false); return; }
    const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
    setLogoUrl(pub.publicUrl);
    setUploading(false);
  }

  async function handleSave() {
    setSaving(true);
    // If no custom logo uploaded, use auto-detect (google favicon)
    const finalLogo = logoUrl || autoFavicon(tool.url || '');
    await onSave(finalLogo);
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800">
          <h3 className="font-semibold text-white">{tool.id ? 'Edit Tool' : 'Add AI Tool'}</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-3 max-h-[70vh] overflow-y-auto scrollbar-thin">
          {/* Logo picker */}
          <div>
            <span className="block text-xs text-zinc-400 mb-2">Logo / Icon</span>
            <div className="flex items-center gap-4">
              {/* Preview box */}
              <div className="w-16 h-16 rounded-xl bg-white/95 border border-zinc-700 flex items-center justify-center shrink-0 overflow-hidden">
                <LogoPreview srcs={previewSrcs} name={tool.name || '?'} />
              </div>

              <div className="flex-1 space-y-2">
                {/* File picker button */}
                <input ref={fileRef} type="file" accept="image/*,.ico,.svg,.png,.jpg,.jpeg,.webp" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadLogo(f); e.target.value = ''; }} />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-2 w-full rounded-lg border border-dashed border-zinc-600 hover:border-red-600 bg-zinc-950 py-2.5 px-3 text-sm text-zinc-300 hover:text-white transition"
                >
                  {uploading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</>
                    : <><Upload className="w-4 h-4 text-red-500" /> Choose logo from file</>
                  }
                </button>

                {/* Reset to auto-detect */}
                {logoUrl && (
                  <button
                    type="button"
                    onClick={() => setLogoUrl('')}
                    className="flex items-center gap-2 text-xs text-zinc-500 hover:text-white transition"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Reset — auto-detect from URL
                  </button>
                )}
                <p className="text-[11px] text-zinc-600">
                  {logoUrl ? 'Custom logo set. Click Reset to use auto-detect.' : 'No custom logo — will auto-detect from URL (Google, DuckDuckGo).'}
                </p>
              </div>
            </div>
          </div>

          <FormRow label="Name">
            <input value={tool.name || ''} onChange={(e) => onChange({ ...tool, name: e.target.value })}
              className="admin-input" />
          </FormRow>
          <FormRow label="URL">
            <input value={tool.url || ''} onChange={(e) => onChange({ ...tool, url: e.target.value })}
              placeholder="https://…" className="admin-input" />
          </FormRow>
          <FormRow label="Category">
            <select value={tool.category_id || ''} onChange={(e) => onChange({ ...tool, category_id: e.target.value || null })}
              className="admin-input">
              <option value="">— Uncategorized —</option>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </FormRow>
          <FormRow label="Description">
            <textarea value={tool.description || ''} onChange={(e) => onChange({ ...tool, description: e.target.value })}
              rows={2} className="admin-input resize-none" />
          </FormRow>
          <div className="grid grid-cols-2 gap-3">
            <FormRow label="Sort order">
              <input type="number" value={tool.sort_order ?? 0} onChange={(e) => onChange({ ...tool, sort_order: Number(e.target.value) })}
                className="admin-input" />
            </FormRow>
            <FormRow label="New tag (1 week)">
              <label className="flex items-center gap-2 mt-2">
                <input type="checkbox" checked={tool.is_new ?? false} onChange={(e) => onChange({ ...tool, is_new: e.target.checked })}
                  className="w-4 h-4 accent-red-600" />
                <span className="text-sm text-zinc-300">Mark as new</span>
              </label>
            </FormRow>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-3 border-t border-zinc-800">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 transition">Cancel</button>
          <button onClick={handleSave} disabled={saving || uploading}
            className="rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white px-4 py-2 text-sm font-medium transition flex items-center gap-1.5">
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <><Check className="w-4 h-4" /> Save</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// Shows logo with cascading fallback — same strategy as AIToolsView
function LogoPreview({ srcs, name }: { srcs: string[]; name: string }) {
  const [idx, setIdx] = useState(0);
  if (idx < srcs.length) {
    return (
      <img
        key={srcs[idx]}
        src={srcs[idx]}
        alt={name}
        className="w-full h-full object-contain"
        onError={() => setIdx((i) => i + 1)}
      />
    );
  }
  return <span className="text-2xl font-bold text-zinc-700 select-none">{name.charAt(0).toUpperCase()}</span>;
}

function SmallLogo({ url, site, name }: { url: string; site: string; name: string }) {
  const srcs = buildSources(url, site);
  const [idx, setIdx] = useState(0);
  return (
    <div className="w-8 h-8 rounded-lg bg-white/90 flex items-center justify-center overflow-hidden shrink-0">
      {idx < srcs.length ? (
        <img key={srcs[idx]} src={srcs[idx]} alt={name} className="w-full h-full object-contain" onError={() => setIdx((i) => i + 1)} />
      ) : (
        <span className="text-zinc-700 text-xs font-bold">{name.charAt(0).toUpperCase()}</span>
      )}
    </div>
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

function autoFavicon(siteUrl: string): string {
  try {
    const { hostname } = new URL(siteUrl);
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=128`;
  } catch { return ''; }
}

function SideBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
        active ? 'bg-red-600 text-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
      }`}
    >
      {icon} {label}
    </button>
  );
}

function EditorModal({ title, onClose, onSave, children }: { title: string; onClose: () => void; onSave: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800">
          <h3 className="font-semibold text-white">{title}</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-3 max-h-[70vh] overflow-y-auto scrollbar-thin">{children}</div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-zinc-800">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 transition">Cancel</button>
          <button onClick={onSave} className="rounded-lg bg-red-600 hover:bg-red-500 text-white px-4 py-2 text-sm font-medium transition flex items-center gap-1.5">
            <Check className="w-4 h-4" /> Save
          </button>
        </div>
      </div>
    </div>
  );
}

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs text-zinc-400 mb-1">{label}</span>
      {children}
    </label>
  );
}
