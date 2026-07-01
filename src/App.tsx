import { useState, useEffect, useCallback } from 'react';
import { supabase } from './lib/supabase';
import type { Category, AITool, QuickUrl, Profile } from './types/database';
import { getFaviconUrl, getHostname } from './lib/utils';
import AuthModal from './components/AuthModal';
import AdminPanel from './components/AdminPanel';
import {
  Search,
  Bookmark,
  BookmarkCheck,
  ExternalLink,
  Plus,
  Trash2,
  X,
  Code,
  Music,
  Film,
  PenTool,
  Palette,
  Sparkles,
  Folder,
  ChevronRight,
  Globe,
  User,
  LogOut,
  Shield,
} from 'lucide-react';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Code,
  Music,
  Film,
  PenTool,
  Palette,
  Sparkles,
  Folder,
};

function App() {
  const [activeTab, setActiveTab] = useState<'tools' | 'urls'>('tools');
  const [searchQuery, setSearchQuery] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [aiTools, setAiTools] = useState<AITool[]>([]);
  const [quickUrls, setQuickUrls] = useState<QuickUrl[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showAddUrlModal, setShowAddUrlModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [newUrl, setNewUrl] = useState({ title: '', url: '' });

  const fetchData = useCallback(async () => {
    const [catRes, toolsRes, urlsRes] = await Promise.all([
      supabase.from('categories').select('*').order('sort_order'),
      supabase.from('ai_tools').select('*').order('sort_order'),
      supabase.from('quick_urls').select('*').order('created_at', { ascending: false }),
    ]);

    if (catRes.data) setCategories(catRes.data);
    if (toolsRes.data) setAiTools(toolsRes.data);
    if (urlsRes.data) setQuickUrls(urlsRes.data);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredTools = aiTools.filter((tool) => {
    const matchesSearch = tool.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || tool.category_id === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const toggleToolBookmark = async (id: string, current: boolean) => {
    await supabase.from('ai_tools').update({ is_bookmarked: !current }).eq('id', id);
    fetchData();
  };

  const logToolUsage = async (tool: AITool) => {
    await supabase.from('tool_usage_logs').insert({
      tool_id: tool.id,
      tool_name: tool.name,
      user_id: currentProfile?.id || null,
    });
  };

  const deleteUrl = async (id: string) => {
    await supabase.from('quick_urls').delete().eq('id', id);
    fetchData();
  };

  const addUrl = async () => {
    if (!newUrl.title || !newUrl.url) return;
    await supabase.from('quick_urls').insert({
      title: newUrl.title,
      url: newUrl.url.startsWith('http') ? newUrl.url : `https://${newUrl.url}`,
    });
    setNewUrl({ title: '', url: '' });
    setShowAddUrlModal(false);
    fetchData();
  };

  const handleAuthSuccess = (profile: Profile) => {
    setCurrentProfile(profile);
    if (profile.is_admin) {
      setIsAdmin(true);
    }
  };

  const handleLogout = () => {
    setCurrentProfile(null);
    setIsAdmin(false);
    setShowAdminPanel(false);
  };

  const CategoryIcon = ({ iconName }: { iconName: string }) => {
    const Icon = iconMap[iconName] || Folder;
    return <Icon className="w-5 h-5" />;
  };

  return (
    <div className="min-h-screen bg-black text-gray-100">
      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-black/90 border-b border-gray-800/50">
        <div className="w-full px-6 py-4">
          <div className="flex items-center gap-4">
           <div className="w-56 flex items-center">
            <img
              src="/drstoragge.png"
              alt="Storagge"
              className="h-10 w-auto object-contain scale-[3.2] origin-left"
             />
           </div>
        

            {/* Search Bar - only in AI Tools tab */}
            {activeTab === 'tools' && (
              <div className="flex-1 max-w-xl mx-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="text"
                    placeholder="Search AI tools..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-800/60 border border-gray-700/50 rounded-xl text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 transition-all"
                  />
                </div>
              </div>
            )}

            {activeTab !== 'tools' && <div className="flex-1" />}

            {/* Right corner: Auth / Admin / Profile */}
            <div className="flex items-center gap-2 ml-auto">
              {isAdmin && (
                <button
                  onClick={() => setShowAdminPanel(true)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all text-sm font-medium"
                >
                  <Shield className="w-4 h-4" />
                  <span className="hidden sm:inline">Admin Panel</span>
                </button>
              )}

              {currentProfile ? (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800/60 border border-gray-700/50">
                    {currentProfile.display_picture_url ? (
                      <img
                        src={currentProfile.display_picture_url}
                        alt={currentProfile.name}
                        className="w-6 h-6 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-red-600 to-rose-600 flex items-center justify-center text-xs font-bold text-white">
                        {currentProfile.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="text-sm text-gray-200 hidden sm:inline">{currentProfile.name}</span>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="p-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
                    title="Logout"
                  >
                    <LogOut className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-red-600 to-rose-600 text-white font-medium text-sm hover:shadow-lg hover:shadow-red-500/25 transition-all"
                >
                  <User className="w-4 h-4" />
                  Sign In / Sign Up
                </button>
              )}
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-1 mt-4 bg-gray-800/40 p-1 rounded-xl w-fit">
            <button
              onClick={() => setActiveTab('tools')}
              className={`px-6 py-2 rounded-lg font-medium transition-all ${
                activeTab === 'tools'
                  ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-lg shadow-red-500/25'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              AI Tools
            </button>
            <button
              onClick={() => setActiveTab('urls')}
              className={`px-6 py-2 rounded-lg font-medium transition-all ${
                activeTab === 'urls'
                  ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-lg shadow-red-500/25'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Quick URLs
            </button>
          </div>
        </div>
      </header>

      <main className="w-full px-6 py-6">
        {activeTab === 'tools' ? (
          <div className="flex gap-6">
            {/* Category Sidebar */}
            <aside className="w-48 flex-shrink-0 hidden md:block">
              <div className="sticky top-36 space-y-1">
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all ${
                    !selectedCategory
                      ? 'bg-red-500/20 text-red-400'
                      : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  <span className="text-sm font-medium">All Tools</span>
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all ${
                      selectedCategory === cat.id
                        ? 'bg-red-500/20 text-red-400'
                        : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'
                    }`}
                  >
                    <CategoryIcon iconName={cat.icon} />
                    <span className="text-sm font-medium">{cat.name}</span>
                  </button>
                ))}
              </div>
            </aside>

            {/* Tools Grid */}
            <div className="flex-1">
              {/* Mobile category filter */}
              <div className="md:hidden mb-4 flex gap-2 overflow-x-auto pb-2">
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap ${
                    !selectedCategory ? 'bg-red-500/20 text-red-400' : 'text-gray-400 bg-gray-800/50'
                  }`}
                >
                  All
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap ${
                      selectedCategory === cat.id ? 'bg-red-500/20 text-red-400' : 'text-gray-400 bg-gray-800/50'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredTools.map((tool) => (
                  <div
                    key={tool.id}
                    className="group relative bg-gray-800/40 border border-gray-700/50 rounded-xl p-4 hover:border-red-500/50 hover:bg-gray-800/60 transition-all duration-300"
                  >
                    <a
                      href={tool.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => logToolUsage(tool)}
                      className="flex items-start gap-3"
                    >
                      <div className="w-12 h-12 flex-shrink-0 rounded-xl bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center overflow-hidden border border-gray-600/50">
                        {tool.logo_url ? (
                          <img
                            src={tool.logo_url}
                            alt={tool.name}
                            className="w-10 h-10 object-cover rounded-lg"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = getFaviconUrl(tool.url);
                            }}
                          />
                        ) : (
                          <img
                            src={getFaviconUrl(tool.url)}
                            alt={tool.name}
                            className="w-7 h-7 object-contain"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-100 truncate group-hover:text-red-400 transition-colors">
                          {tool.name}
                        </h3>
                        <p className="text-xs text-gray-500 truncate">{getHostname(tool.url)}</p>
                      </div>
                      <ExternalLink className="w-4 h-4 text-gray-600 group-hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100" />
                    </a>

                    <div className="absolute top-2 right-2 flex items-center gap-1">
                      <button
                        onClick={() => toggleToolBookmark(tool.id, tool.is_bookmarked)}
                        className={`p-1.5 rounded-lg transition-all ${
                          tool.is_bookmarked
                            ? 'text-rose-400 bg-rose-500/20'
                            : 'text-gray-600 hover:text-rose-400 hover:bg-rose-500/10 opacity-0 group-hover:opacity-100'
                        }`}
                      >
                        {tool.is_bookmarked ? (
                          <BookmarkCheck className="w-4 h-4" />
                        ) : (
                          <Bookmark className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {filteredTools.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No tools found</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-200">Quick Access URLs</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              <button
                onClick={() => setShowAddUrlModal(true)}
                className="flex items-center justify-center gap-2 bg-gray-800/40 border border-dashed border-gray-700 rounded-xl p-4 text-gray-500 hover:text-red-400 hover:border-red-500/50 transition-all"
              >
                <Plus className="w-5 h-5" />
                <span>Add URL</span>
              </button>

              {quickUrls.map((url) => (
                <div
                  key={url.id}
                  className="group relative bg-gray-800/40 border border-gray-700/50 rounded-xl p-4 hover:border-rose-500/50 hover:bg-gray-800/60 transition-all duration-300"
                >
                  <a
                    href={url.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3"
                  >
                    <div className="w-10 h-10 flex-shrink-0 rounded-lg bg-gradient-to-br from-rose-600/20 to-red-600/20 flex items-center justify-center border border-rose-500/30 overflow-hidden">
                      <img
                        src={getFaviconUrl(url.url)}
                        alt={url.title}
                        className="w-6 h-6 object-contain"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          target.parentElement!.innerHTML = '<div class="w-5 h-5 text-rose-400"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg></div>';
                        }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-100 truncate group-hover:text-rose-400 transition-colors">
                        {url.title}
                      </h3>
                      <p className="text-xs text-gray-500 truncate">{getHostname(url.url)}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-rose-400 transition-colors" />
                  </a>

                  <div className="absolute top-2 right-2">
                    <button
                      onClick={() => deleteUrl(url.id)}
                      className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {quickUrls.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <Globe className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No URLs saved yet</p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Add URL Modal */}
      {showAddUrlModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-100">Add Quick URL</h3>
              <button onClick={() => setShowAddUrlModal(false)} className="text-gray-500 hover:text-gray-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Title</label>
                <input
                  type="text"
                  value={newUrl.title}
                  onChange={(e) => setNewUrl({ ...newUrl, title: e.target.value })}
                  placeholder="My Favorite Site"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">URL</label>
                <input
                  type="text"
                  value={newUrl.url}
                  onChange={(e) => setNewUrl({ ...newUrl, url: e.target.value })}
                  placeholder="https://example.com"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
              <button
                onClick={addUrl}
                className="w-full py-2.5 bg-gradient-to-r from-rose-600 to-red-600 rounded-lg font-medium text-white hover:shadow-lg hover:shadow-rose-500/25 transition-all"
              >
                Add URL
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auth Modal */}
      {showAuthModal && (
        <AuthModal
          onClose={() => setShowAuthModal(false)}
          onAuthSuccess={handleAuthSuccess}
          onAdminLogin={() => setShowAdminPanel(true)}
        />
      )}

      {/* Admin Panel */}
      {showAdminPanel && isAdmin && (
        <AdminPanel
          onClose={() => setShowAdminPanel(false)}
          categories={categories}
          aiTools={aiTools}
          onDataChange={fetchData}
        />
      )}
    </div>
  );
}

export default App;
