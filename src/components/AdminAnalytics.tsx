import { useEffect, useMemo, useState } from 'react';
import { supabase, type AITool, compactNum } from '../lib/supabase';
import { Users, MousePointerClick, Calendar, LogIn } from 'lucide-react';

type UsageRow = { tool_id: string | null; tool_name: string | null; created_at: string };
type ProfileRow = { id: string; display_name: string; email_or_phone: string; created_at: string; last_login_at: string | null };

export default function AdminAnalytics({ tools }: { tools: AITool[] }) {
  void tools;
  const [usage, setUsage] = useState<UsageRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [u, p] = await Promise.all([
        supabase.from('tool_usage').select('tool_id, tool_name, created_at'),
        supabase.from('profiles').select('id, display_name, email_or_phone, created_at, last_login_at'),
      ]);
      setUsage((u.data as UsageRow[]) ?? []);
      setProfiles((p.data as ProfileRow[]) ?? []);
      setLoading(false);
    })();
  }, []);

  // ── Signups (new users) ──
  const newUsersToday = useMemo(() => dayCount(profiles.map(p => p.created_at)), [profiles]);
  const newUsersWeek = useMemo(() => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return profiles.filter((p) => new Date(p.created_at).getTime() >= cutoff).length;
  }, [profiles]);
  const newUsers30 = useMemo(() => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return profiles.filter((p) => new Date(p.created_at).getTime() >= cutoff).length;
  }, [profiles]);

  // ── Logins (last_login_at) ──
  const loginsToday = useMemo(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0);
    return profiles.filter((p) => p.last_login_at && new Date(p.last_login_at).getTime() >= d.getTime()).length;
  }, [profiles]);
  const loginsWeek = useMemo(() => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return profiles.filter((p) => p.last_login_at && new Date(p.last_login_at).getTime() >= cutoff).length;
  }, [profiles]);
  const logins30 = useMemo(() => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return profiles.filter((p) => p.last_login_at && new Date(p.last_login_at).getTime() >= cutoff).length;
  }, [profiles]);

  // ── Tool usage ──
  const usesToday = useMemo(() => dayCount(usage.map(u => u.created_at)), [usage]);
  const usesWeek = useMemo(() => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return usage.filter((u) => new Date(u.created_at).getTime() >= cutoff).length;
  }, [usage]);

  // ── Bar chart: new signups per day (last 7 days) ──
  const signupWeek = useMemo(() => {
    const days: { label: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
      const next = new Date(d); next.setDate(d.getDate() + 1);
      const count = profiles.filter((p) => {
        const t = new Date(p.created_at).getTime();
        return t >= d.getTime() && t < next.getTime();
      }).length;
      days.push({ label: d.toLocaleDateString('en', { weekday: 'short' }), count });
    }
    return days;
  }, [profiles]);

  // ── Bar chart: logins per day (last 7 days) ──
  const loginWeek = useMemo(() => {
    const days: { label: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
      const next = new Date(d); next.setDate(d.getDate() + 1);
      const count = profiles.filter((p) => {
        if (!p.last_login_at) return false;
        const t = new Date(p.last_login_at).getTime();
        return t >= d.getTime() && t < next.getTime();
      }).length;
      days.push({ label: d.toLocaleDateString('en', { weekday: 'short' }), count });
    }
    return days;
  }, [profiles]);

  // ── Bar chart: 30-day signups (weekly buckets) ──
  const monthSignups = useMemo(() => {
    const weeks: { label: string; count: number }[] = [];
    const now = new Date(); now.setHours(0, 0, 0, 0);
    for (let i = 3; i >= 0; i--) {
      const end = new Date(now); end.setDate(now.getDate() - i * 7);
      const start = new Date(end); start.setDate(end.getDate() - 7);
      const count = profiles.filter((p) => {
        const t = new Date(p.created_at).getTime();
        return t >= start.getTime() && t < end.getTime();
      }).length;
      weeks.push({ label: `W${4 - i}`, count });
    }
    return weeks;
  }, [profiles]);

  // ── Per-tool usage top 8 ──
  const perTool = useMemo(() => {
    const m = new Map<string, number>();
    for (const u of usage) {
      const key = u.tool_name || 'Unknown';
      m.set(key, (m.get(key) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [usage]);

  const maxSignupWeek = Math.max(1, ...signupWeek.map((d) => d.count));
  const maxLoginWeek = Math.max(1, ...loginWeek.map((d) => d.count));
  const maxMonth = Math.max(1, ...monthSignups.map((d) => d.count));
  const maxTool = Math.max(1, ...perTool.map(([, c]) => c));

  if (loading) {
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-5">Analytics</h1>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Kpi icon={<Users className="w-5 h-5" />} label="New users today" value={newUsersToday} sub={`${newUsersWeek} this week`} />
        <Kpi icon={<LogIn className="w-5 h-5" />} label="Logins today" value={loginsToday} sub={`${loginsWeek} this week`} />
        <Kpi icon={<Calendar className="w-5 h-5" />} label="New users (30d)" value={newUsers30} sub={`${logins30} logins (30d)`} />
        <Kpi icon={<MousePointerClick className="w-5 h-5" />} label="Tool uses today" value={usesToday} sub={`${usesWeek} this week`} />
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* New signups this week */}
        <Card title="New users this week" subtitle="Signups per day (last 7 days)">
          <BarChart data={signupWeek} max={maxSignupWeek} colorFrom="from-red-700" colorTo="to-red-500" />
        </Card>

        {/* Logins this week */}
        <Card title="Logins this week" subtitle="Active users per day (last 7 days)">
          <BarChart data={loginWeek} max={maxLoginWeek} colorFrom="from-red-800" colorTo="to-red-600" />
        </Card>

        {/* 30-day signups (weekly) */}
        <Card title="New users — last 4 weeks" subtitle="Monthly signup trend">
          <BarChart data={monthSignups} max={maxMonth} colorFrom="from-red-700" colorTo="to-red-500" />
        </Card>

        {/* Per-tool usage */}
        <Card title="Top tools used" subtitle="All time">
          {perTool.length === 0 ? (
            <p className="text-zinc-500 text-sm py-8 text-center">No usage data yet.</p>
          ) : (
            <div className="space-y-2.5 mt-3">
              {perTool.map(([name, count]) => (
                <div key={name} className="flex items-center gap-3">
                  <span className="text-sm text-zinc-300 w-32 truncate shrink-0">{name}</span>
                  <div className="flex-1 bg-zinc-800 rounded-full h-2.5 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-red-600 to-red-400 rounded-full transition-all" style={{ width: `${(count / maxTool) * 100}%` }} />
                  </div>
                  <span className="text-sm text-white font-medium w-12 text-right">{compactNum(count)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Recent logins table */}
      <Card title="Recent logins" subtitle="Users who logged in recently" className="mt-5">
        <div className="overflow-x-auto mt-3">
          <table className="w-full text-sm">
            <thead className="text-zinc-400 text-xs uppercase">
              <tr>
                <th className="text-left px-3 py-2">Name</th>
                <th className="text-left px-3 py-2 hidden sm:table-cell">Email / Number</th>
                <th className="text-left px-3 py-2">Last login</th>
              </tr>
            </thead>
            <tbody>
              {profiles
                .filter((p) => p.last_login_at)
                .sort((a, b) => new Date(b.last_login_at!).getTime() - new Date(a.last_login_at!).getTime())
                .slice(0, 10)
                .map((p) => (
                  <tr key={p.id} className="border-t border-zinc-800">
                    <td className="px-3 py-2 text-white font-medium">{p.display_name || '—'}</td>
                    <td className="px-3 py-2 text-zinc-400 hidden sm:table-cell">{p.email_or_phone}</td>
                    <td className="px-3 py-2 text-zinc-300">{timeSince(p.last_login_at!)}</td>
                  </tr>
                ))}
              {profiles.filter((p) => p.last_login_at).length === 0 && (
                <tr><td colSpan={3} className="px-3 py-6 text-center text-zinc-500">No logins recorded yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function dayCount(timestamps: string[]): number {
  const d = new Date(); d.setHours(0, 0, 0, 0);
  return timestamps.filter((t) => new Date(t).getTime() >= d.getTime()).length;
}

function timeSince(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function BarChart({ data, max, colorFrom, colorTo }: { data: { label: string; count: number }[]; max: number; colorFrom: string; colorTo: string }) {
  return (
    <div className="flex items-stretch justify-between gap-2 h-40 mt-4">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
          <span className="text-xs text-zinc-400">{d.count}</span>
          <div className="w-full bg-zinc-800 rounded-t-md relative flex-1 flex items-end overflow-hidden">
            <div className={`w-full bg-gradient-to-t ${colorFrom} ${colorTo} rounded-t-md transition-all`} style={{ height: `${Math.max(2, (d.count / max) * 100)}%` }} />
          </div>
          <span className="text-xs text-zinc-500">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

function Kpi({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: number; sub?: string }) {
  return (
    <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4">
      <div className="w-9 h-9 rounded-lg bg-red-950/50 border border-red-900/50 flex items-center justify-center text-red-400 mb-3">
        {icon}
      </div>
      <p className="text-2xl font-bold text-white">{compactNum(value)}</p>
      <p className="text-xs text-zinc-500 mt-0.5">{label}</p>
      {sub && <p className="text-[11px] text-zinc-600 mt-0.5">{sub}</p>}
    </div>
  );
}

function Card({ title, subtitle, children, className = '' }: { title: string; subtitle?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl bg-zinc-900 border border-zinc-800 p-5 ${className}`}>
      <h3 className="font-semibold text-white">{title}</h3>
      {subtitle && <p className="text-xs text-zinc-500 mt-0.5">{subtitle}</p>}
      {children}
    </div>
  );
}