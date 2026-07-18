import { useEffect, useState, useCallback } from 'react';
import { X, UserPlus, Bell } from 'lucide-react';
import { supabase, type Notification, type Profile, timeAgo } from '../lib/supabase';
import { useAuth } from '../lib/auth';

export default function NotificationsView({
  onClose,
  onOpenProfile,
}: {
  onClose: () => void;
  onOpenProfile: (p: Profile) => void;
}) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<(Notification & { actor?: Profile })[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    const notifs = (data as Notification[]) ?? [];

    // Load actor profiles
    const actorIds = [...new Set(notifs.map((n) => n.actor_id))];
    const profileMap: Record<string, Profile> = {};
    if (actorIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('*').in('id', actorIds);
      for (const p of (profiles as Profile[]) ?? []) profileMap[p.id] = p;
    }

    setNotifications(notifs.map((n) => ({ ...n, actor: profileMap[n.actor_id] })));
    setLoading(false);

    // Mark all as seen
    await supabase
      .from('notifications')
      .update({ seen: true })
      .eq('user_id', user.id)
      .eq('seen', false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-end" onClick={onClose}>
      <div
        className="w-full max-w-sm h-full bg-zinc-950 border-l border-zinc-800 flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 shrink-0">
          <h2 className="font-bold text-white text-lg flex items-center gap-2">
            <Bell className="w-5 h-5 text-red-500" /> Notifications
          </h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4">
                <Bell className="w-7 h-7 text-zinc-600" />
              </div>
              <p className="text-zinc-400 font-medium">No notifications yet</p>
              <p className="text-zinc-600 text-sm mt-1">When someone joins you, you'll see it here</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-800/60">
              {notifications.map((n) => (
                <NotifRow
                  key={n.id}
                  notif={n}
                  onOpenProfile={() => n.actor && onOpenProfile(n.actor)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function NotifRow({
  notif,
  onOpenProfile,
}: {
  notif: Notification & { actor?: Profile };
  onOpenProfile: () => void;
}) {
  const actor = notif.actor;
  const isNew = !notif.seen;

  return (
    <button
      onClick={onOpenProfile}
      className={`w-full flex items-start gap-3 px-5 py-4 hover:bg-zinc-900/60 transition text-left ${isNew ? 'bg-zinc-900/30' : ''}`}
    >
      {/* Avatar */}
      <div className="relative shrink-0">
        <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-zinc-700">
          {actor?.avatar_url ? (
            <img src={actor.avatar_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-white font-bold">
              {(actor?.display_name || 'U').charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-red-600 flex items-center justify-center border-2 border-zinc-950">
          <UserPlus className="w-2.5 h-2.5 text-white" />
        </div>
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white">
          <span className="font-semibold">{actor?.display_name || 'Someone'}</span>{' '}
          {actor?.username && <span className="text-zinc-500 text-xs">@{actor.username}</span>}{' '}
          <span className="text-zinc-300">{notif.message}</span>
        </p>
        <p className="text-xs text-zinc-600 mt-0.5">{timeAgo(notif.created_at)} ago</p>
      </div>

      {isNew && (
        <div className="w-2 h-2 rounded-full bg-red-500 shrink-0 mt-1.5" />
      )}
    </button>
  );
}

export async function getUnreadNotifCount(userId: string): Promise<number> {
  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('seen', false);
  return count ?? 0;
}
