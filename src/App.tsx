import { useEffect, useState, useCallback } from 'react';
import { AuthProvider, useAuth } from './lib/auth';
import { supabase, type AITool, type Reel, isNewActive } from './lib/supabase';
import Navbar, { type Tab } from './components/Navbar';
import AuthModal from './components/AuthModal';
import AIToolsView from './components/AIToolsView';
import QuickURLsView, { getLatestQuickUrlTime } from './components/QuickURLsView';
import PostsView from './components/PostsView';
import EventsView from './components/EventsView';
import MessagesView from './components/MessagesView';
import NotificationsView, { getUnreadNotifCount } from './components/NotificationsView';
import ConnectionsView from './components/ConnectionsView';
import ProfileModal from './components/ProfileModal';
import SavedDrawer from './components/SavedDrawer';
import AdminPanel from './components/AdminPanel';
import { Sparkles } from 'lucide-react';

function Hub() {
  const { user, profile, loading } = useAuth();
  
  // Tab ko sessionStorage se initialize karein taaki refresh par wahi rahe
  const [tab, setTab] = useState<Tab>(() => {
    return (sessionStorage.getItem('active_tab') as Tab) || 'tools';
  });
  
  const [search, setSearch] = useState('');
  const [showAuth, setShowAuth] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [viewProfileId, setViewProfileId] = useState<string | null>(null);
  const [showSaved, setShowSaved] = useState(false);
  
  // Messages modal aur user ko bhi sessionStorage mein save karein
  const [showMessages, setShowMessages] = useState<boolean>(() => {
    return sessionStorage.getItem('show_messages') === 'true';
  });
  const [messageTo, setMessageTo] = useState<string | null>(() => {
    return sessionStorage.getItem('message_to');
  });

  const [showNotifications, setShowNotifications] = useState(false);
  const [adminMode, setAdminMode] = useState(false);

  const [dots, setDots] = useState({ tools: false, urls: false, posts: false, messages: false, notifications: false });
  const [seenToolsAt, setSeenToolsAt] = useState<number>(Number(localStorage.getItem('seenToolsAt') || Date.now()));
  const [seenPostsAt, setSeenPostsAt] = useState<number>(Number(localStorage.getItem('seenPostsAt') || Date.now()));

  useEffect(() => {
    function checkHash() {
      if (window.location.hash === '#admin') setAdminMode(true);
    }
    checkHash();
    window.addEventListener('hashchange', checkHash);
    return () => window.removeEventListener('hashchange', checkHash);
  }, []);

  useEffect(() => {
    if (adminMode) return;
    let active = true;
    (async () => {
      const { data } = await supabase
        .from('ai_tools')
        .select('created_at, is_new')
        .order('created_at', { ascending: false })
        .limit(50);
      if (!active || !data) return;
      const hasNew = (data as AITool[]).some(
        (t) => isNewActive(t.created_at, t.is_new) && new Date(t.created_at).getTime() > seenToolsAt
      );
      setDots((d) => ({ ...d, tools: hasNew }));
    })();
    return () => { active = false; };
  }, [seenToolsAt, adminMode]);

  useEffect(() => {
    if (adminMode) return;
    let active = true;
    (async () => {
      const { data } = await supabase
        .from('reels')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1);
      if (!active || !data || data.length === 0) return;
      const newest = new Date((data as Reel[])[0].created_at).getTime();
      setDots((d) => ({ ...d, posts: newest > seenPostsAt }));
    })();
    return () => { active = false; };
  }, [seenPostsAt, adminMode]);

  useEffect(() => {
    if (adminMode || !user) { setDots((d) => ({ ...d, urls: false })); return; }
    const seenUrlsAt = Number(localStorage.getItem('seenUrlsAt') || Date.now());
    const latest = getLatestQuickUrlTime(user.id);
    setDots((d) => ({ ...d, urls: latest > seenUrlsAt }));
  }, [user, adminMode]);

  // unread notifications dot
  useEffect(() => {
    if (!user) { setDots((d) => ({ ...d, notifications: false })); return; }
    let active = true;
    getUnreadNotifCount(user.id).then((count) => {
      if (active) setDots((d) => ({ ...d, notifications: count > 0 }));
    });
    return () => { active = false; };
  }, [user, showNotifications]);

  // unread messages dot
  useEffect(() => {
    if (!user) { setDots((d) => ({ ...d, messages: false })); return; }
    let active = true;
    (async () => {
      const { data } = await supabase
        .from('messages')
        .select('id')
        .neq('sender_id', user.id)
        .eq('seen', false)
        .limit(1);
      if (!active) return;
      setDots((d) => ({ ...d, messages: !!(data && data.length > 0) }));
    })();
    return () => { active = false; };
  }, [user, showMessages]);

  const onTab = useCallback((t: Tab) => {
    setTab(t);
    sessionStorage.setItem('active_tab', t);
    if (t === 'tools') {
      const now = Date.now();
      setSeenToolsAt(now);
      localStorage.setItem('seenToolsAt', String(now));
      setDots((d) => ({ ...d, tools: false }));
    } else if (t === 'posts') {
      const now = Date.now();
      setSeenPostsAt(now);
      localStorage.setItem('seenPostsAt', String(now));
      setDots((d) => ({ ...d, posts: false }));
    } else if (t === 'urls') {
      const now = Date.now();
      localStorage.setItem('seenUrlsAt', String(now));
      setDots((d) => ({ ...d, urls: false }));
    }
  }, []);

  function openMessages(toUserId?: string) {
    const targetId = toUserId ?? null;
    setMessageTo(targetId);
    setShowMessages(true);
    sessionStorage.setItem('show_messages', 'true');
    if (targetId) {
      sessionStorage.setItem('message_to', targetId);
    } else {
      sessionStorage.removeItem('message_to');
    }
    setDots((d) => ({ ...d, messages: false }));
  }

  function closeMessages() {
    setShowMessages(false);
    setMessageTo(null);
    sessionStorage.removeItem('show_messages');
    sessionStorage.removeItem('message_to');
  }

  function openNotifications() {
    setShowNotifications(true);
    setDots((d) => ({ ...d, notifications: false }));
  }

  if (adminMode) {
    if (loading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-zinc-950">
          <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
        </div>
      );
    }
    return (
      <AdminPanel
        onExit={() => {
          setAdminMode(false);
          if (window.location.hash === '#admin') {
            history.replaceState(null, '', window.location.pathname + window.location.search);
          }
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <Navbar
        tab={tab}
        onTab={onTab}
        search={search}
        onSearch={setSearch}
        onOpenAuth={() => setShowAuth(true)}
        onOpenProfile={() => { setViewProfileId(null); setShowProfile(true); }}
        onOpenSaved={() => setShowSaved(true)}
        onOpenMessages={() => openMessages()}
        onOpenNotifications={openNotifications}
        dots={dots}
      />

      <main className="w-full px-4 py-6">
        {tab === 'tools' && <AIToolsView search={search} />}
        {tab === 'urls' && <QuickURLsView onOpenAuth={() => setShowAuth(true)} />}
        {tab === 'posts' && (
          <PostsView
            onOpenAuth={() => setShowAuth(true)}
            onOpenProfile={(p) => { setViewProfileId(p.id); setShowProfile(true); }}
            onMessage={(uid) => openMessages(uid)}
          />
        )}
        {tab === 'connections' && (
          <ConnectionsView
            onOpenAuth={() => setShowAuth(true)}
            onOpenProfile={(p) => { setViewProfileId(p.id); setShowProfile(true); }}
          />
        )}
        {tab === 'events' && (
          <EventsView
            onOpenAuth={() => setShowAuth(true)}
            onOpenProfile={(p) => { setViewProfileId(p.id); setShowProfile(true); }}
          />
        )}
      </main>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      {showProfile && user && (
        <ProfileModal
          onClose={() => setShowProfile(false)}
          profileId={viewProfileId}
          onOpenAdmin={() => { setShowProfile(false); setAdminMode(true); window.location.hash = 'admin'; }}
          onMessage={(uid) => { setShowProfile(false); openMessages(uid); }}
        />
      )}
      {showSaved && user && <SavedDrawer onClose={() => setShowSaved(false)} />}
      {showMessages && user && (
        <MessagesView
          onClose={closeMessages}
          initialUserId={messageTo}
          onOpenProfile={(p) => { setShowMessages(false); setViewProfileId(p.id); setShowProfile(true); }}
        />
      )}
      {showNotifications && user && (
        <NotificationsView
          onClose={() => setShowNotifications(false)}
          onOpenProfile={(p) => { setShowNotifications(false); setViewProfileId(p.id); setShowProfile(true); }}
        />
      )}

      {profile?.is_admin && (
        <button
          onClick={() => { setAdminMode(true); window.location.hash = 'admin'; }}
          className="fixed bottom-4 left-4 z-30 w-9 h-9 rounded-full bg-zinc-900/80 border border-zinc-800 text-zinc-600 hover:text-red-400 flex items-center justify-center transition"
          title="Admin"
        >
          <Sparkles className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Hub />
    </AuthProvider>
  );
}