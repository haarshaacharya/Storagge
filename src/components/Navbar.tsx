import { Search, Sparkles, Link2, Clapperboard, User as UserIcon, Bookmark, MessageCircle, CalendarDays, Bell, Users } from 'lucide-react';
import { useAuth } from '../lib/auth';

export type Tab = 'tools' | 'urls' | 'posts' | 'events' | 'connections';

type Props = {
  tab: Tab;
  onTab: (t: Tab) => void;
  search: string;
  onSearch: (s: string) => void;
  onOpenAuth: () => void;
  onOpenProfile: () => void;
  onOpenSaved: () => void;
  onOpenMessages: () => void;
  onOpenNotifications: () => void;
  dots: { tools: boolean; urls: boolean; posts: boolean; messages: boolean; notifications: boolean };
};

export default function Navbar({
  tab, onTab, search, onSearch, onOpenAuth, onOpenProfile, onOpenSaved, onOpenMessages, onOpenNotifications, dots,
}: Props) {
  const { user, profile } = useAuth();

  return (
    <header className="sticky top-0 z-50 bg-zinc-950/90 backdrop-blur-x1 border-b border-zinc-800">
    <div className="w-full px-4 h-16 flex items-center gap-3">

      {/* Logo */}

      <div className="flex items-center gap-3 shrink-0">
      <img src="/drstoragge.png" alt="DrStoragge" className="h-36 w-auto object-contain mt-4"/> 

     </div>

        {/* Center tabs */}
        <div className="flex-1 flex justify-center overflow-x-auto">
          <nav className="flex items-center gap-1 bg-zinc-900/80 border border-zinc-800 rounded-full p-1 shrink-0">
            <TabBtn active={tab === 'tools'} onClick={() => onTab('tools')} dot={dots.tools} icon={<Sparkles className="w-4 h-4" />} label="AI Tools" />
            <TabBtn active={tab === 'urls'} onClick={() => onTab('urls')} dot={dots.urls} icon={<Link2 className="w-4 h-4" />} label="Quick URLs" />
            <TabBtn active={tab === 'posts'} onClick={() => onTab('posts')} dot={dots.posts} icon={<Clapperboard className="w-4 h-4" />} label="Posts" />
            <TabBtn active={tab === 'connections'} onClick={() => onTab('connections')} dot={false} icon={<Users className="w-4 h-4" />} label="Connects" />
            <TabBtn active={tab === 'events'} onClick={() => onTab('events')} dot={false} icon={<CalendarDays className="w-4 h-4" />} label="Events" />
          </nav>
        </div>

        {/* Right: search + auth */}
        <div className="flex items-center gap-2 shrink-0">
          {tab === 'tools' && (
            <div className="hidden md:flex items-center relative">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3 pointer-events-none" />
              <input
                value={search}
                onChange={(e) => onSearch(e.target.value)}
                placeholder="Search tools…"
                className="w-44 lg:w-56 bg-zinc-900 border border-zinc-800 rounded-full pl-9 pr-4 py-2 text-sm text-white placeholder-zinc-500 focus:border-red-600 focus:w-56 lg:focus:w-64 transition-all outline-none"
              />
            </div>
          )}

          {user ? (
            <div className="flex items-center gap-2">
              <button
                onClick={onOpenNotifications}
                title="Notifications"
                className="relative w-9 h-9 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300 hover:text-red-400 hover:border-red-700 transition"
              >
                <Bell className="w-4 h-4" />
                {dots.notifications && (
                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-zinc-950 animate-pulse" />
                )}
              </button>
              <button
                onClick={onOpenMessages}
                title="Messages"
                className="relative w-9 h-9 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300 hover:text-red-400 hover:border-red-700 transition"
              >
                <MessageCircle className="w-4 h-4" />
                {dots.messages && (
                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-zinc-950 animate-pulse" />
                )}
              </button>
              <button
                onClick={onOpenSaved}
                title="Saved"
                className="w-9 h-9 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300 hover:text-red-400 hover:border-red-700 transition"
              >
                <Bookmark className="w-4 h-4" />
              </button>
              <button
                onClick={onOpenProfile}
                className="w-9 h-9 rounded-full overflow-hidden border-2 border-red-600 hover:border-red-400 transition"
              >
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-white text-sm font-bold">
                    {(profile?.display_name || user.email || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="flex items-center gap-1.5 rounded-full bg-red-600 hover:bg-red-500 text-white font-medium px-4 py-2 text-sm transition shadow-lg shadow-red-900/30"
            >
              <UserIcon className="w-4 h-4" />
              Sign up
            </button>
          )}
        </div>
      </div>

      {/* Mobile search row (tools only) */}
      {tab === 'tools' && (
        <div className="md:hidden px-4 pb-3">
          <div className="flex items-center relative">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              placeholder="Search tools…"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-full pl-9 pr-4 py-2 text-sm text-white placeholder-zinc-500 focus:border-red-600 outline-none"
            />
          </div>
        </div>
      )}
    </header>
  );
}

function TabBtn({
  active, onClick, dot, icon, label,
}: { active: boolean; onClick: () => void; dot: boolean; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`relative flex items-center gap-1.5 rounded-full px-3 sm:px-4 py-1.5 text-sm font-medium transition ${
        active ? 'bg-red-600 text-white shadow-lg shadow-red-900/40' : 'text-zinc-400 hover:text-white'
      }`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
      {dot && (
        <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-zinc-950 animate-pulse" />
      )}
    </button>
  );
}
