import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Profile, ToolUsageLog, AITool, Category } from '../types/database';
import { getHostname } from '../lib/utils';
import {
  X,
  Users,
  BarChart3,
  TrendingUp,
  Calendar,
  Activity,
  Trash2,
  Search,
  Eye,
  EyeOff,
  Shield,
  Plus,
  Globe,
} from 'lucide-react';

interface AdminPanelProps {
  onClose: () => void;
  categories: Category[];
  aiTools: AITool[];
  onDataChange: () => void;
}

export default function AdminPanel({ onClose, categories, aiTools, onDataChange }: AdminPanelProps) {
  const [activeSection, setActiveSection] = useState<'dashboard' | 'users' | 'tools'>('dashboard');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [usageLogs, setUsageLogs] = useState<ToolUsageLog[]>([]);
  const [searchUser, setSearchUser] = useState('');
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [showAddToolModal, setShowAddToolModal] = useState(false);
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [newTool, setNewTool] = useState({ name: '', url: '', logo_url: '', category_id: '' });
  const [newCategory, setNewCategory] = useState({ name: '', icon: 'Folder' });

  const fetchAdminData = useCallback(async () => {
    const [profilesRes, logsRes] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('tool_usage_logs').select('*').order('clicked_at', { ascending: false }).limit(1000),
    ]);
    if (profilesRes.data) setProfiles(profilesRes.data as Profile[]);
    if (logsRes.data) setUsageLogs(logsRes.data as ToolUsageLog[]);
  }, []);

  useEffect(() => {
    fetchAdminData();
  }, [fetchAdminData]);

  // Analytics calculations
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const todayUsers = new Set(
    usageLogs.filter((l) => new Date(l.clicked_at) >= todayStart).map((l) => l.user_id)
  ).size;
  const weekUsers = new Set(
    usageLogs.filter((l) => new Date(l.clicked_at) >= weekStart).map((l) => l.user_id)
  ).size;
  const monthUsers = new Set(
    usageLogs.filter((l) => new Date(l.clicked_at) >= monthStart).map((l) => l.user_id)
  ).size;

  const todayClicks = usageLogs.filter((l) => new Date(l.clicked_at) >= todayStart).length;
  const weekClicks = usageLogs.filter((l) => new Date(l.clicked_at) >= weekStart).length;
  const monthClicks = usageLogs.filter((l) => new Date(l.clicked_at) >= monthStart).length;

  // Per-tool usage counts
  const toolUsageMap = new Map<string, number>();
  usageLogs.forEach((log) => {
    const key = log.tool_name;
    toolUsageMap.set(key, (toolUsageMap.get(key) || 0) + 1);
  });
  const toolUsageSorted = Array.from(toolUsageMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  const maxToolUsage = Math.max(...toolUsageSorted.map((t) => t[1]), 1);

  // Weekly chart data (last 7 days)
  const weekDays: { day: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const dayStart = new Date(todayStart);
    dayStart.setDate(dayStart.getDate() - i);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    const count = usageLogs.filter(
      (l) => new Date(l.clicked_at) >= dayStart && new Date(l.clicked_at) < dayEnd
    ).length;
    weekDays.push({
      day: dayStart.toLocaleDateString('en', { weekday: 'short' }),
      count,
    });
  }
  const maxWeekCount = Math.max(...weekDays.map((d) => d.count), 1);

  // Monthly chart data (last 30 days, grouped by day)
  const monthDays: { day: number; count: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const dayStart = new Date(todayStart);
    dayStart.setDate(dayStart.getDate() - i);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    const count = usageLogs.filter(
      (l) => new Date(l.clicked_at) >= dayStart && new Date(l.clicked_at) < dayEnd
    ).length;
    monthDays.push({ day: dayStart.getDate(), count });
  }
  const maxMonthCount = Math.max(...monthDays.map((d) => d.count), 1);

  const filteredProfiles = profiles.filter(
    (p) =>
      p.name.toLowerCase().includes(searchUser.toLowerCase()) ||
      (p.email || '').toLowerCase().includes(searchUser.toLowerCase()) ||
      (p.phone || '').toLowerCase().includes(searchUser.toLowerCase())
  );

  const addTool = async () => {
    if (!newTool.name || !newTool.url) return;
    const maxOrder = Math.max(...aiTools.map((t) => t.sort_order), 0);
    await supabase.from('ai_tools').insert({
      name: newTool.name,
      url: newTool.url.startsWith('http') ? newTool.url : `https://${newTool.url}`,
      logo_url: newTool.logo_url || null,
      category_id: newTool.category_id || null,
      sort_order: maxOrder + 1,
    });
    setNewTool({ name: '', url: '', logo_url: '', category_id: '' });
    setShowAddToolModal(false);
    onDataChange();
  };

  const deleteTool = async (id: string) => {
    await supabase.from('ai_tools').delete().eq('id', id);
    onDataChange();
  };

  const addCategory = async () => {
    if (!newCategory.name) return;
    const maxOrder = Math.max(...categories.map((c) => c.sort_order), 0);
    await supabase.from('categories').insert({
      name: newCategory.name,
      icon: newCategory.icon,
      sort_order: maxOrder + 1,
    });
    setNewCategory({ name: '', icon: '' });
    setShowAddCategoryModal(false);
    onDataChange();
  };

  const deleteCategory = async (id: string) => {
    await supabase.from('ai_tools').update({ category_id: null }).eq('category_id', id);
    await supabase.from('categories').delete().eq('id', id);
    onDataChange();
  };

  const togglePasswordVisibility = (id: string) => {
    setVisiblePasswords((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const statCard = (icon: React.ReactNode, label: string, value: number, color: string) => (
    <div className="bg-gray-800/40 border border-gray-700/50 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={`p-2 rounded-lg ${color}`}>{icon}</div>
        <span className="text-sm text-gray-400">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-100">{value}</p>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex">
      <div className="bg-gray-900 border-l border-gray-700/50 w-full max-w-5xl ml-auto h-full overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur-xl border-b border-gray-800/50 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-red-400" />
            <h2 className="text-xl font-bold text-gray-100">Admin Panel</h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-6 py-4 flex gap-2 border-b border-gray-800/50">
          {[
            { id: 'dashboard' as const, label: 'Dashboard', icon: <BarChart3 className="w-4 h-4" /> },
            { id: 'users' as const, label: 'Users', icon: <Users className="w-4 h-4" /> },
            { id: 'tools' as const, label: 'Tools & Categories', icon: <Activity className="w-4 h-4" /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                activeSection === tab.id
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* DASHBOARD */}
          {activeSection === 'dashboard' && (
            <div className="space-y-6">
              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {statCard(<Users className="w-5 h-5 text-red-400" />, "Today's Users", todayUsers, 'bg-red-500/10')}
                {statCard(<TrendingUp className="w-5 h-5 text-rose-400" />, "Today's Clicks", todayClicks, 'bg-rose-500/10')}
                {statCard(<Calendar className="w-5 h-5 text-red-300" />, 'Weekly Users', weekUsers, 'bg-red-500/10')}
                {statCard(<Activity className="w-5 h-5 text-rose-300" />, 'Weekly Clicks', weekClicks, 'bg-rose-500/10')}
                {statCard(<Calendar className="w-5 h-5 text-red-400" />, 'Monthly Users', monthUsers, 'bg-red-500/10')}
                {statCard(<BarChart3 className="w-5 h-5 text-rose-400" />, 'Monthly Clicks', monthClicks, 'bg-rose-500/10')}
              </div>

              {/* Weekly Chart */}
              <div className="bg-gray-800/40 border border-gray-700/50 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-gray-300 mb-4">Weekly Usage (Last 7 Days)</h3>
                <div className="flex items-end justify-between gap-2 h-40">
                  {weekDays.map((d, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-2">
                      <div className="w-full flex-1 flex items-end">
                        <div
                          className="w-full bg-gradient-to-t from-red-500 to-rose-500 rounded-t-lg transition-all hover:opacity-80 relative group"
                          style={{ height: `${(d.count / maxWeekCount) * 100}%`, minHeight: d.count > 0 ? '8px' : '2px' }}
                        >
                          <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                            {d.count}
                          </span>
                        </div>
                      </div>
                      <span className="text-xs text-gray-500">{d.day}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Monthly Chart */}
              <div className="bg-gray-800/40 border border-gray-700/50 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-gray-300 mb-4">Monthly Usage (Last 30 Days)</h3>
                <div className="flex items-end justify-between gap-1 h-32">
                  {monthDays.map((d, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center">
                      <div className="w-full flex-1 flex items-end">
                        <div
                          className="w-full bg-gradient-to-t from-red-600 to-rose-600 rounded-t transition-all hover:opacity-80 relative group"
                          style={{ height: `${(d.count / maxMonthCount) * 100}%`, minHeight: d.count > 0 ? '4px' : '1px' }}
                        >
                          <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-xs text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                            {d.count}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between mt-2 text-xs text-gray-500">
                  <span>30 days ago</span>
                  <span>Today</span>
                </div>
              </div>

              {/* Per-Tool Usage */}
              <div className="bg-gray-800/40 border border-gray-700/50 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-gray-300 mb-4">Most Used Tools</h3>
                {toolUsageSorted.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-4">No usage data yet</p>
                ) : (
                  <div className="space-y-3">
                    {toolUsageSorted.map(([name, count]) => (
                      <div key={name} className="flex items-center gap-3">
                        <span className="text-sm text-gray-300 w-32 truncate">{name}</span>
                        <div className="flex-1 bg-gray-700/30 rounded-full h-6 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-red-500 to-rose-500 rounded-full flex items-center justify-end pr-2 transition-all"
                            style={{ width: `${(count / maxToolUsage) * 100}%` }}
                          >
                            <span className="text-xs text-white font-medium">{count}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* USERS */}
          {activeSection === 'users' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-200">
                  Registered Users ({profiles.length})
                </h3>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    value={searchUser}
                    onChange={(e) => setSearchUser(e.target.value)}
                    placeholder="Search users..."
                    className="w-full pl-9 pr-3 py-2 bg-gray-800/60 border border-gray-700/50 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500/50 text-sm"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-700/50 text-left text-sm text-gray-400">
                      <th className="py-3 px-3">Name</th>
                      <th className="py-3 px-3">Email</th>
                      <th className="py-3 px-3">Phone</th>
                      <th className="py-3 px-3">Password</th>
                      <th className="py-3 px-3">Admin</th>
                      <th className="py-3 px-3">Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProfiles.map((p) => (
                      <tr key={p.id} className="border-b border-gray-800/30 hover:bg-gray-800/30 transition-colors">
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            {p.display_picture_url ? (
                              <img src={p.display_picture_url} alt={p.name} className="w-8 h-8 rounded-full object-cover" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs text-gray-400">
                                {p.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <span className="text-gray-200 text-sm">{p.name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-gray-400 text-sm">{p.email || '-'}</td>
                        <td className="py-3 px-3 text-gray-400 text-sm">{p.phone || '-'}</td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-400 text-sm font-mono">
                              {visiblePasswords[p.id] ? p.password_hash : '••••••••••••'}
                            </span>
                            <button
                              onClick={() => togglePasswordVisibility(p.id)}
                              className="text-gray-500 hover:text-gray-300 transition-colors"
                            >
                              {visiblePasswords[p.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          {p.is_admin ? (
                            <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full">Admin</span>
                          ) : (
                            <span className="text-gray-600 text-xs">User</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-gray-500 text-sm">
                          {new Date(p.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredProfiles.length === 0 && (
                  <p className="text-center text-gray-500 py-8">No users found</p>
                )}
              </div>
            </div>
          )}

          {/* TOOLS & CATEGORIES */}
          {activeSection === 'tools' && (
            <div className="space-y-6">
              {/* Categories */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-gray-200">Categories</h3>
                  <button
                    onClick={() => setShowAddCategoryModal(true)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg text-sm font-medium hover:bg-red-500/30 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    Add Category
                  </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {categories.map((cat) => (
                    <div
                      key={cat.id}
                      className="flex items-center justify-between bg-gray-800/40 border border-gray-700/50 rounded-lg px-3 py-2"
                    >
                      <span className="text-gray-200 text-sm">{cat.name}</span>
                      <button
                        onClick={() => deleteCategory(cat.id)}
                        className="text-gray-600 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* AI Tools */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-gray-200">AI Tools ({aiTools.length})</h3>
                  <button
                    onClick={() => setShowAddToolModal(true)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-red-600 to-rose-600 text-white rounded-lg text-sm font-medium hover:shadow-lg hover:shadow-red-500/25 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    Add AI Tool
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {aiTools.map((tool) => {
                    const cat = categories.find((c) => c.id === tool.category_id);
                    return (
                      <div
                        key={tool.id}
                        className="flex items-center gap-3 bg-gray-800/40 border border-gray-700/50 rounded-lg px-3 py-2"
                      >
                        <div className="w-8 h-8 rounded-lg bg-gray-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                          {tool.logo_url ? (
                            <img src={tool.logo_url} alt={tool.name} className="w-full h-full object-cover" />
                          ) : (
                            <Globe className="w-4 h-4 text-gray-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-gray-200 text-sm font-medium truncate">{tool.name}</p>
                          <p className="text-gray-500 text-xs truncate">{getHostname(tool.url)}</p>
                        </div>
                        {cat && (
                          <span className="px-2 py-0.5 bg-red-500/10 text-red-400 text-xs rounded-full flex-shrink-0">
                            {cat.name}
                          </span>
                        )}
                        <button
                          onClick={() => deleteTool(tool.id)}
                          className="text-gray-600 hover:text-red-400 transition-colors flex-shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Tool Modal */}
      {showAddToolModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-100">Add AI Tool</h3>
              <button onClick={() => setShowAddToolModal(false)} className="text-gray-500 hover:text-gray-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Tool Name</label>
                <input
                  type="text"
                  value={newTool.name}
                  onChange={(e) => setNewTool({ ...newTool, name: e.target.value })}
                  placeholder="ChatGPT"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">URL</label>
                <input
                  type="text"
                  value={newTool.url}
                  onChange={(e) => setNewTool({ ...newTool, url: e.target.value })}
                  placeholder="https://chat.openai.com"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Logo URL (optional)</label>
                <input
                  type="text"
                  value={newTool.logo_url}
                  onChange={(e) => setNewTool({ ...newTool, logo_url: e.target.value })}
                  placeholder="https://example.com/logo.png"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Category</label>
                <select
                  value={newTool.category_id}
                  onChange={(e) => setNewTool({ ...newTool, category_id: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  <option value="">No Category</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={addTool}
                className="w-full py-2.5 bg-gradient-to-r from-red-600 to-rose-600 rounded-lg font-medium text-white hover:shadow-lg hover:shadow-red-500/25 transition-all"
              >
                Add Tool
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Category Modal */}
      {showAddCategoryModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-100">Add Category</h3>
              <button onClick={() => setShowAddCategoryModal(false)} className="text-gray-500 hover:text-gray-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Category Name</label>
                <input
                  type="text"
                  value={newCategory.name}
                  onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                  placeholder="Analytics"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Icon</label>
                <select
                  value={newCategory.icon}
                  onChange={(e) => setNewCategory({ ...newCategory, icon: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  <option value="">No Icon</option>
                  <option value="Folder">Folder</option>
                  <option value="Code">Code</option>
                  <option value="Music">Music</option>
                  <option value="Film">Film</option>
                  <option value="PenTool">Writing</option>
                  <option value="Palette">Design</option>
                  <option value="Sparkles">Sparkles</option>
                </select>
              </div>
              <button
                onClick={addCategory}
                className="w-full py-2.5 bg-gradient-to-r from-red-600 to-rose-600 rounded-lg font-medium text-white hover:shadow-lg hover:shadow-red-500/25 transition-all"
              >
                Add Category
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
