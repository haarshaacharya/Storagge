import { useEffect, useRef, useState, useCallback } from 'react';
import { X, Send, Search, ArrowLeft, MessageCircle, Lock, Plus, Image as ImageIcon, Film, FileText, Paperclip } from 'lucide-react';
import { supabase, type Conversation, type Message, type Profile, timeAgo, getOrCreateConversation } from '../lib/supabase';
import { useAuth } from '../lib/auth';

type MessageWithMedia = Message & { media_url?: string | null; media_type?: string | null };

type ConvWithOther = Conversation & { other: Profile; lastMsg?: string; unread?: number };

const MIN_SIDEBAR_WIDTH = 240;
const MAX_SIDEBAR_WIDTH = 520;
const DEFAULT_SIDEBAR_WIDTH = 320;

export default function MessagesView({
  onClose,
  initialUserId,
  onOpenProfile,
}: {
  onClose: () => void;
  initialUserId: string | null;
  onOpenProfile: (p: Profile) => void;
}) {
  const { user } = useAuth();
  const [convs, setConvs] = useState<ConvWithOther[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Resizable sidebar
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function check() { setIsDesktop(window.innerWidth >= 768); }
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    if (!isResizing) return;
    function onMove(e: MouseEvent) {
      const containerLeft = containerRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - containerLeft;
      setSidebarWidth(Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, newWidth)));
    }
    function onUp() { setIsResizing(false); }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  const loadConversations = useCallback(async () => {
    if (!user) return;
    const { data: rawConvs } = await supabase
      .from('conversations')
      .select('*')
      .or(`participant_a.eq.${user.id},participant_b.eq.${user.id}`)
      .order('last_message_at', { ascending: false, nullsFirst: false });

    if (!rawConvs || rawConvs.length === 0) { setConvs([]); setLoading(false); return; }

    const otherIds = (rawConvs as Conversation[]).map((c) =>
      c.participant_a === user.id ? c.participant_b : c.participant_a
    );
    const { data: profiles } = await supabase.from('profiles').select('*').in('id', otherIds);
    const profileMap: Record<string, Profile> = {};
    for (const p of (profiles as Profile[]) ?? []) profileMap[p.id] = p;

    // Load last messages
    const convIds = (rawConvs as Conversation[]).map((c) => c.id);
    const { data: lastMsgs } = await supabase
      .from('messages')
      .select('conversation_id, text, created_at, sender_id, seen')
      .in('conversation_id', convIds)
      .order('created_at', { ascending: false });

    const lastMsgMap: Record<string, { text: string; unread: number }> = {};
    for (const msg of (lastMsgs as (Message & { conversation_id: string })[]) ?? []) {
      if (!lastMsgMap[msg.conversation_id]) {
        lastMsgMap[msg.conversation_id] = { text: msg.text, unread: 0 };
      }
      if (!msg.seen && msg.sender_id !== user.id) {
        lastMsgMap[msg.conversation_id].unread++;
      }
    }

    const enriched: ConvWithOther[] = (rawConvs as Conversation[]).map((c) => {
      const otherId = c.participant_a === user.id ? c.participant_b : c.participant_a;
      return {
        ...c,
        other: profileMap[otherId] || ({ id: otherId, display_name: 'Unknown', avatar_url: '' } as Profile),
        lastMsg: lastMsgMap[c.id]?.text,
        unread: lastMsgMap[c.id]?.unread ?? 0,
      };
    });

    setConvs(enriched);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Open conversation with initialUserId
  useEffect(() => {
    if (!initialUserId || !user) return;
    (async () => {
      const convId = await getOrCreateConversation(user.id, initialUserId);
      if (convId) {
        await loadConversations();
        setActiveConvId(convId);
      }
    })();
  }, [initialUserId, user, loadConversations]);

  // User search
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!search.trim()) { setSearchResults([]); return; }
    searchTimeout.current = setTimeout(async () => {
      setSearchLoading(true);
      const q = search.trim();
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
        .neq('id', user?.id ?? '')
        .limit(8);
      setSearchResults((data as Profile[]) ?? []);
      setSearchLoading(false);
    }, 350);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [search, user?.id]);

  async function openConvWithUser(otherUser: Profile) {
    if (!user) return;
    setSearch('');
    setSearchResults([]);
    const convId = await getOrCreateConversation(user.id, otherUser.id);
    if (convId) {
      await loadConversations();
      setActiveConvId(convId);
    }
  }

  const activeConv = convs.find((c) => c.id === activeConvId);

  return (
    <div className="fixed inset-0 z-[100] flex bg-zinc-950" onClick={onClose}>
      <div ref={containerRef} className="flex w-full h-full" onClick={(e) => e.stopPropagation()}>
        {/* Sidebar */}
        <div
          className={`flex flex-col border-r border-zinc-800 bg-zinc-950 ${activeConvId ? 'hidden md:flex' : 'flex w-full'}`}
          style={isDesktop ? { width: sidebarWidth, flexShrink: 0 } : undefined}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-4 border-b border-zinc-800">
            <button onClick={onClose} className="text-zinc-400 hover:text-white transition">
              <X className="w-5 h-5" />
            </button>
            <h2 className="font-bold text-white text-lg flex-1">Messages</h2>
          </div>

          {/* Search */}
          <div className="px-4 py-3 border-b border-zinc-800">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search users…"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-full pl-9 pr-4 py-2 text-sm text-white placeholder-zinc-500 focus:border-red-600 outline-none"
              />
            </div>
            {/* Search results dropdown */}
            {(searchResults.length > 0 || searchLoading) && (
              <div className="mt-2 rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden">
                {searchLoading ? (
                  <div className="px-3 py-2 text-xs text-zinc-500 text-center">Searching…</div>
                ) : searchResults.map((p) => (
                  <button key={p.id} onClick={() => openConvWithUser(p)}
                    className="flex items-center gap-3 px-3 py-2.5 w-full hover:bg-zinc-800 transition border-b border-zinc-800/40 last:border-0">
                    <div className="w-8 h-8 rounded-full overflow-hidden shrink-0">
                      {p.avatar_url ? (
                        <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-white text-xs font-bold">
                          {(p.display_name || 'U').charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="text-left min-w-0">
                      <p className="text-white text-sm font-medium truncate">{p.display_name || 'User'}</p>
                      {p.username && <p className="text-zinc-500 text-xs">@{p.username}</p>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Conversation list */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : convs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-3">
                  <MessageCircle className="w-7 h-7 text-zinc-600" />
                </div>
                <p className="text-zinc-400 font-medium">No messages yet</p>
                <p className="text-zinc-600 text-sm mt-1">Search for users above to start a conversation</p>
              </div>
            ) : (
              convs.map((c) => (
                <button key={c.id} onClick={() => setActiveConvId(c.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 transition border-b border-zinc-800/50 hover:bg-zinc-900/60 ${activeConvId === c.id ? 'bg-zinc-900' : ''}`}>
                  <div className="relative shrink-0">
                    <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-zinc-700">
                      {c.other.avatar_url ? (
                        <img src={c.other.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-white font-bold">
                          {(c.other.display_name || 'U').charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    {(c.unread ?? 0) > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-600 text-white text-[9px] font-bold flex items-center justify-center">{c.unread}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 text-left">
                    <p className="text-white text-sm font-semibold truncate">{c.other.display_name || 'User'}</p>
                    <p className={`text-xs truncate ${(c.unread ?? 0) > 0 ? 'text-white font-medium' : 'text-zinc-500'}`}>
                      {c.lastMsg || 'No messages yet'}
                    </p>
                  </div>
                  {c.last_message_at && (
                    <span className="text-[10px] text-zinc-600 shrink-0">{timeAgo(c.last_message_at)}</span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Resize handle */}
        <div
          onMouseDown={() => setIsResizing(true)}
          className={`hidden md:block w-1 shrink-0 cursor-col-resize relative group ${isResizing ? 'bg-red-600' : 'bg-transparent hover:bg-red-600/60'} transition`}
        >
          <div className="absolute inset-y-0 -left-1.5 -right-1.5" />
        </div>

        {/* Chat area */}
        {activeConvId && activeConv ? (
          <ChatArea
            conv={activeConv}
            onBack={() => setActiveConvId(null)}
            onOpenProfile={onOpenProfile}
            onConversationUpdate={loadConversations}
          />
        ) : (
          <div className="hidden md:flex flex-1 items-center justify-center flex-col gap-4 bg-zinc-950">
            <div className="w-20 h-20 rounded-3xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
              <MessageCircle className="w-10 h-10 text-zinc-700" />
            </div>
            <div className="text-center">
              <p className="text-white font-semibold text-lg">Your Messages</p>
              <p className="text-zinc-500 text-sm mt-1">Select a conversation or search for a user to message</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ChatArea({
  conv,
  onBack,
  onOpenProfile,
  onConversationUpdate,
}: {
  conv: ConvWithOther;
  onBack: () => void;
  onOpenProfile: (p: Profile) => void;
  onConversationUpdate: () => Promise<void>;
}) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<MessageWithMedia[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [canMessage, setCanMessage] = useState<boolean | null>(null);
  const [sending, setSending] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [pendingMedia, setPendingMedia] = useState<{ file: File; preview: string; type: 'image' | 'video' | 'document' } | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showAttachMenu) return;
    function handler(e: MouseEvent) {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node)) setShowAttachMenu(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showAttachMenu]);

  function pickFile(accept: string) {
    setShowAttachMenu(false);
    if (fileRef.current) { fileRef.current.accept = accept; fileRef.current.click(); }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const isImage = f.type.startsWith('image/');
    const isVideo = f.type.startsWith('video/');
    const type = isImage ? 'image' : isVideo ? 'video' : 'document';
    const preview = (isImage || isVideo) ? URL.createObjectURL(f) : '';
    setPendingMedia({ file: f, preview, type });
    e.target.value = '';
  }

  function removePendingMedia() {
    if (pendingMedia?.preview) URL.revokeObjectURL(pendingMedia.preview);
    setPendingMedia(null);
  }

  // Check mutual follow
  useEffect(() => {
    if (!user) return;
    (async () => {
      const otherId = conv.other.id;
      const [f1, f2] = await Promise.all([
        supabase.from('follows').select('id').eq('follower_id', user.id).eq('following_id', otherId).maybeSingle(),
        supabase.from('follows').select('id').eq('follower_id', otherId).eq('following_id', user.id).maybeSingle(),
      ]);
      setCanMessage(!!(f1.data && f2.data));
    })();
  }, [conv.other.id, user]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conv.id)
        .order('created_at', { ascending: true });
      setMessages((data as MessageWithMedia[]) ?? []);
      setLoading(false);
      await supabase
        .from('messages')
        .update({ seen: true })
        .eq('conversation_id', conv.id)
        .neq('sender_id', user.id)
        .eq('seen', false);
        onConversationUpdate();
    })();
  }, [conv.id, user]);

  // Scroll to bottom on new messages
  // Scroll to bottom — instantly on chat open, smoothly on new messages
  const isFirstLoadRef = useRef(true);

  useEffect(() => {
    isFirstLoadRef.current = true;
  }, [conv.id]);

  useEffect(() => {
    if (messages.length === 0) return;
    bottomRef.current?.scrollIntoView({ behavior: isFirstLoadRef.current ? 'auto' : 'smooth' });
    isFirstLoadRef.current = false;
  }, [messages]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`messages:${conv.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conv.id}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as MessageWithMedia]);
          if ((payload.new as Message).sender_id !== user?.id) {
            supabase.from('messages').update({ seen: true }).eq('id', payload.new.id).then(() => {});
          }
          onConversationUpdate();
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conv.id, user?.id, onConversationUpdate]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if ((!text.trim() && !pendingMedia) || !user || sending || !canMessage) return;
    setSending(true);
    const msg = text.trim();
    setText('');

    let media_url: string | null = null;
    let media_type: string | null = null;

    if (pendingMedia) {
      setUploadingMedia(true);
      const ext = pendingMedia.file.name.split('.').pop()?.toLowerCase() || 'bin';
      const path = `${conv.id}/${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('message-media').upload(path, pendingMedia.file, { contentType: pendingMedia.file.type });
      if (!upErr) {
        const { data: pub } = supabase.storage.from('message-media').getPublicUrl(path);
        media_url = pub.publicUrl;
        media_type = pendingMedia.type;
      }
      removePendingMedia();
      setUploadingMedia(false);
    }

    const { error } = await supabase.from('messages').insert({
      conversation_id: conv.id,
      sender_id: user.id,
      text: msg || (media_type === 'document' ? pendingMedia?.file.name ?? '' : ''),
      media_url,
      media_type,
    });
    if (error) { console.warn('Message send error:', error.message); setText(msg); }
    setSending(false);
    inputRef.current?.focus();
  }

  return (
    <div className="flex-1 flex flex-col bg-zinc-950 min-w-0">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3.5 border-b border-zinc-800 shrink-0 bg-zinc-950/95 backdrop-blur">
        <button onClick={onBack} className="md:hidden text-zinc-400 hover:text-white transition">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <button onClick={() => onOpenProfile(conv.other)} className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 border-2 border-zinc-700">
            {conv.other.avatar_url ? (
              <img src={conv.other.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-white font-bold">
                {(conv.other.display_name || 'U').charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-white font-semibold text-sm truncate">{conv.other.display_name || 'User'}</p>
            {conv.other.username && <p className="text-zinc-500 text-xs">@{conv.other.username}</p>}
          </div>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-3">
              <MessageCircle className="w-7 h-7 text-zinc-600" />
            </div>
            <p className="text-zinc-400 font-medium">Say hello!</p>
            <p className="text-zinc-600 text-sm mt-1">Start your conversation with {conv.other.display_name || 'this user'}</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.sender_id === user?.id;
            const m = msg as MessageWithMedia;
            return (
              <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                {!isOwn && (
                  <div className="w-7 h-7 rounded-full overflow-hidden shrink-0 mr-2 mt-auto">
                    {conv.other.avatar_url ? (
                      <img src={conv.other.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-white text-xs font-bold">
                        {(conv.other.display_name || 'U').charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                )}
                <div className={`max-w-[70%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                  {m.media_url && m.media_type === 'image' && (
                    <a href={m.media_url} target="_blank" rel="noopener noreferrer" className="block rounded-xl overflow-hidden border border-zinc-700">
                      <img src={m.media_url} alt="attachment" className="max-w-[240px] max-h-60 object-cover" />
                    </a>
                  )}
                  {m.media_url && m.media_type === 'video' && (
                    <video src={m.media_url} controls className="max-w-[240px] max-h-60 rounded-xl border border-zinc-700" />
                  )}
                  {m.media_url && m.media_type === 'document' && (
                    <a href={m.media_url} target="_blank" rel="noopener noreferrer"
                      className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm border ${isOwn ? 'bg-red-700 border-red-500 text-white' : 'bg-zinc-800 border-zinc-700 text-zinc-100'}`}>
                      <FileText className="w-4 h-4 shrink-0" />
                      <span className="truncate max-w-[160px]">{msg.text || 'Document'}</span>
                    </a>
                  )}
                  {msg.text && !(m.media_type === 'document' && m.media_url) && (
                    <div className={`rounded-2xl px-4 py-2.5 text-sm break-words ${
                      isOwn ? 'bg-red-600 text-white rounded-br-md' : 'bg-zinc-800 text-zinc-100 rounded-bl-md'
                    }`}>
                      {msg.text}
                    </div>
                  )}
                  <span className="text-[10px] text-zinc-600 px-1">{timeAgo(msg.created_at)}</span>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {canMessage === false ? (
        <div className="px-4 py-4 border-t border-zinc-800 flex items-center justify-center gap-2 bg-zinc-900/50">
          <Lock className="w-4 h-4 text-zinc-500" />
          <p className="text-zinc-500 text-sm text-center">You must both follow each other to send messages</p>
        </div>
      ) : (
        <div className="border-t border-zinc-800 bg-zinc-950 shrink-0">
          {/* Pending media preview */}
          {pendingMedia && (
            <div className="px-4 pt-3 flex items-center gap-2">
              {pendingMedia.type === 'image' && <img src={pendingMedia.preview} alt="" className="h-16 w-16 rounded-lg object-cover border border-zinc-700" />}
              {pendingMedia.type === 'video' && <video src={pendingMedia.preview} className="h-16 w-24 rounded-lg object-cover border border-zinc-700" />}
              {pendingMedia.type === 'document' && (
                <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2">
                  <FileText className="w-4 h-4 text-zinc-400" />
                  <span className="text-xs text-zinc-300 max-w-[150px] truncate">{pendingMedia.file.name}</span>
                </div>
              )}
              <button onClick={removePendingMedia} className="w-6 h-6 rounded-full bg-zinc-700 hover:bg-zinc-600 text-white flex items-center justify-center transition">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <form onSubmit={send} className="px-4 py-3 flex gap-2 items-center">
            {/* Hidden file input */}
            <input ref={fileRef} type="file" className="hidden" onChange={handleFileChange} />

            {/* Attachment button (left side) */}
            <div ref={attachMenuRef} className="relative shrink-0">
              <button
                type="button"
                onClick={() => setShowAttachMenu((o) => !o)}
                disabled={canMessage === null}
                className="w-9 h-9 rounded-full bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-400 hover:text-white flex items-center justify-center transition disabled:opacity-50"
                title="Attach file"
              >
                <Plus className="w-4 h-4" />
              </button>
              {showAttachMenu && (
                <div className="absolute bottom-11 left-0 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden min-w-[160px]">
                  <button type="button" onClick={() => pickFile('image/*')}
                    className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-zinc-200 hover:bg-zinc-800 transition">
                    <ImageIcon className="w-4 h-4 text-blue-400" /> Photo
                  </button>
                  <button type="button" onClick={() => pickFile('video/*')}
                    className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-zinc-200 hover:bg-zinc-800 transition border-t border-zinc-800">
                    <Film className="w-4 h-4 text-purple-400" /> Video
                  </button>
                  <button type="button" onClick={() => pickFile('.pdf,.doc,.docx,.txt,.ppt,.pptx,.xls,.xlsx,.zip')}
                    className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-zinc-200 hover:bg-zinc-800 transition border-t border-zinc-800">
                    <FileText className="w-4 h-4 text-amber-400" /> Document
                  </button>
                </div>
              )}
            </div>

            <input
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Message…"
              disabled={canMessage === null}
              className="flex-1 bg-zinc-900 border border-zinc-800 rounded-full px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-red-600 outline-none disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={(!text.trim() && !pendingMedia) || sending || uploadingMedia || canMessage === null || !canMessage}
              className="w-10 h-10 rounded-full bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white flex items-center justify-center transition shrink-0"
            >
              {(sending || uploadingMedia) ? <div className="w-4 h-4 border-2 border-white/40 border-t-transparent rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}