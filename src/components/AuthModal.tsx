import { useState } from 'react';
import { X, Mail, Lock, User as UserIcon, ArrowLeft, KeyRound, CheckCircle2, Eye, EyeOff, Calendar, AtSign, Loader2 } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';

type Mode = 'login' | 'signup' | 'forgot' | 'otp' | 'reset';

function generateUsername(dob: string): string {
  const d = new Date(dob);
  if (isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear().toString();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const letters = Array.from({ length: 3 }, () => String.fromCharCode(97 + Math.floor(Math.random() * 26))).join('');
  return `${yyyy}${letters}${mm}${dd}`;
}

async function findAvailableUsername(dob: string): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const candidate = generateUsername(dob);
    const { data } = await supabase.from('profiles').select('id').eq('username', candidate).maybeSingle();
    if (!data) return candidate;
  }
  return generateUsername(dob) + Math.floor(Math.random() * 100);
}

export default function AuthModal({ onClose }: { onClose: () => void }) {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [fullName, setFullName] = useState('');
  const [dob, setDob] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [newPass, setNewPass] = useState('');
  const [newPass2, setNewPass2] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showNewPass2, setShowNewPass2] = useState(false);
  const [generatedUsername, setGeneratedUsername] = useState('');
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [storedOtpRow, setStoredOtpRow] = useState<string | null>(null);

  function reset() { setErr(null); setInfo(null); }

  async function handleDobChange(val: string) {
    setDob(val);
    if (!val) { setGeneratedUsername(''); return; }
    setUsernameChecking(true);
    const uname = await findAvailableUsername(val);
    setGeneratedUsername(uname);
    setUsernameChecking(false);
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault(); reset(); setBusy(true);
    let loginEmail = email.trim();
    if (!loginEmail.includes('@')) {
      const { data } = await supabase.from('profiles').select('email_or_phone').eq('username', loginEmail.toLowerCase()).maybeSingle();
      if (data?.email_or_phone) { loginEmail = data.email_or_phone; }
      else { setBusy(false); setErr('No account found with that username.'); return; }
    }
    const { error } = await signIn(loginEmail, password);
    setBusy(false);
    if (error) setErr(error); else onClose();
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault(); reset();
    if (!fullName.trim()) { setErr('Full name is required'); return; }
    if (!dob) { setErr('Date of birth is required'); return; }
    if (password.length < 6) { setErr('Password must be at least 6 characters'); return; }
    setBusy(true);
    const username = generatedUsername || await findAvailableUsername(dob);
    const { error } = await signUp(email, password, fullName.trim(), { username, date_of_birth: dob, full_name: fullName.trim() });
    setBusy(false);
    if (error) setErr(error);
    else { setInfo(`Account created! Your username is @${username}`); setTimeout(onClose, 1800); }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault(); reset(); setBusy(true);
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const { data, error } = await supabase.from('password_resets').insert({ email_or_phone: email, otp: code, new_password: '', expires_at: expires }).select('id').maybeSingle();
    setBusy(false);
    if (error || !data) { setErr('Could not start reset. Try again.'); return; }
    setStoredOtpRow(data.id);
    setInfo(`Reset code sent. (Demo OTP: ${code})`);
    console.log(`%c[AIHub] OTP for ${email}: ${code}`, 'color:#ef4444;font-weight:bold');
    setMode('otp');
  }

  async function handleOtp(e: React.FormEvent) {
    e.preventDefault(); reset(); setBusy(true);
    const { data, error } = await supabase.from('password_resets').select('id, otp, expires_at, consumed').eq('email_or_phone', email).order('created_at', { ascending: false }).limit(1).maybeSingle();
    setBusy(false);
    if (error || !data) { setErr('Invalid code.'); return; }
    if (data.consumed) { setErr('Code already used.'); return; }
    if (new Date(data.expires_at).getTime() < Date.now()) { setErr('Code expired. Request a new one.'); return; }
    if (data.otp !== otp.trim()) { setErr('Wrong code.'); return; }
    setMode('reset');
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault(); reset();
    if (newPass.length < 6) { setErr('Password must be at least 6 characters'); return; }
    if (newPass !== newPass2) { setErr('Passwords do not match'); return; }
    setBusy(true);
    const { error: updErr } = await supabase.from('password_resets').update({ consumed: true, new_password: newPass }).eq('id', storedOtpRow ?? '');
    setBusy(false);
    if (updErr) { setErr('Could not complete reset.'); return; }
    setInfo('Password reset verified. Please log in with your new password once updated.');
    setMode('login');
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl shadow-red-950/40 overflow-hidden max-h-[95vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 shrink-0">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            {mode === 'login' && <Lock className="w-5 h-5 text-red-500" />}
            {mode === 'signup' && <UserIcon className="w-5 h-5 text-red-500" />}
            {mode === 'forgot' && <KeyRound className="w-5 h-5 text-red-500" />}
            {mode === 'otp' && <Mail className="w-5 h-5 text-red-500" />}
            {mode === 'reset' && <CheckCircle2 className="w-5 h-5 text-red-500" />}
            {mode === 'login' && 'Log In'}
            {mode === 'signup' && 'Create Account'}
            {mode === 'forgot' && 'Forgot Password'}
            {mode === 'otp' && 'Enter Code'}
            {mode === 'reset' && 'New Password'}
          </h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white transition"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 overflow-y-auto">
          {err && <div className="mb-4 rounded-lg bg-red-950/60 border border-red-800 px-3 py-2 text-sm text-red-200">{err}</div>}
          {info && <div className="mb-4 rounded-lg bg-emerald-950/60 border border-emerald-800 px-3 py-2 text-sm text-emerald-200">{info}</div>}

          {(mode === 'login' || mode === 'signup') && (
            <form onSubmit={mode === 'login' ? handleLogin : handleSignup} className="space-y-3">
              {mode === 'signup' && (
                <>
                  <Field icon={<UserIcon className="w-4 h-4" />} label="Full name *">
                    <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="auth-input" placeholder="Your full name" required />
                  </Field>
                  <Field icon={<Calendar className="w-4 h-4" />} label="Date of birth *">
                    <input type="date" value={dob} onChange={(e) => handleDobChange(e.target.value)} className="auth-input" required
                      max={new Date(Date.now() - 10 * 365.25 * 24 * 3600 * 1000).toISOString().split('T')[0]} />
                  </Field>
                  {dob && (
                    <div className="flex items-center gap-2 rounded-lg bg-zinc-800/60 border border-zinc-700 px-3 py-2">
                      <AtSign className="w-4 h-4 text-red-400 shrink-0" />
                      {usernameChecking
                        ? <span className="text-zinc-400 text-sm flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating…</span>
                        : <span className="text-white text-sm font-mono font-semibold">{generatedUsername}</span>
                      }
                      <span className="text-zinc-500 text-xs ml-auto">Your username</span>
                    </div>
                  )}
                </>
              )}
              <Field icon={<Mail className="w-4 h-4" />} label={mode === 'login' ? 'Email / Username' : 'Email'}>
                <input type={mode === 'login' ? 'text' : 'email'} value={email} onChange={(e) => setEmail(e.target.value)}
                  className="auth-input" placeholder={mode === 'login' ? 'you@email.com or @username' : 'you@email.com'} required />
              </Field>
              <Field icon={<Lock className="w-4 h-4" />} label="Password">
                <div className="relative">
                  <input type={showPass ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} className="auth-input pr-10" placeholder="••••••••" required />
                  <button type="button" onClick={() => setShowPass((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </Field>
              {mode === 'login' && (
                <div className="flex justify-end">
                  <button type="button" onClick={() => { reset(); setMode('forgot'); }} className="text-xs text-red-400 hover:text-red-300">Forgot password?</button>
                </div>
              )}
              <button type="submit" disabled={busy || (mode === 'signup' && usernameChecking)}
                className="w-full rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-medium py-2.5 transition">
                {busy ? 'Please wait…' : mode === 'login' ? 'Log In' : 'Create Account'}
              </button>
              <p className="text-center text-sm text-zinc-400">
                {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
                <button type="button" onClick={() => { reset(); setMode(mode === 'login' ? 'signup' : 'login'); }} className="text-red-400 hover:text-red-300 font-medium">
                  {mode === 'login' ? 'Register' : 'Log in'}
                </button>
              </p>
            </form>
          )}

          {mode === 'forgot' && (
            <form onSubmit={handleForgot} className="space-y-3">
              <p className="text-sm text-zinc-400">Enter your email. We'll send you a one-time code to reset your password.</p>
              <Field icon={<Mail className="w-4 h-4" />} label="Email">
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="auth-input" placeholder="you@email.com" required />
              </Field>
              <button type="submit" disabled={busy} className="w-full rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-medium py-2.5 transition">
                {busy ? 'Sending…' : 'Send Reset Code'}
              </button>
              <button type="button" onClick={() => { reset(); setMode('login'); }} className="flex items-center gap-1 text-sm text-zinc-400 hover:text-white mx-auto">
                <ArrowLeft className="w-4 h-4" /> Back to login
              </button>
            </form>
          )}

          {mode === 'otp' && (
            <form onSubmit={handleOtp} className="space-y-3">
              <p className="text-sm text-zinc-400">Enter the 6-digit code sent to <span className="text-white">{email}</span>.</p>
              <input value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="auth-input text-center text-2xl tracking-[0.5em] font-bold" placeholder="000000" required />
              <button type="submit" disabled={busy} className="w-full rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-medium py-2.5 transition">
                {busy ? 'Verifying…' : 'Verify Code'}
              </button>
            </form>
          )}

          {mode === 'reset' && (
            <form onSubmit={handleReset} className="space-y-3">
              <Field icon={<Lock className="w-4 h-4" />} label="New password">
                <div className="relative">
                  <input type={showNewPass ? 'text' : 'password'} value={newPass} onChange={(e) => setNewPass(e.target.value)} className="auth-input pr-10" placeholder="••••••••" required />
                  <button type="button" onClick={() => setShowNewPass((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition">
                    {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </Field>
              <Field icon={<Lock className="w-4 h-4" />} label="Confirm new password">
                <div className="relative">
                  <input type={showNewPass2 ? 'text' : 'password'} value={newPass2} onChange={(e) => setNewPass2(e.target.value)} className="auth-input pr-10" placeholder="••••••••" required />
                  <button type="button" onClick={() => setShowNewPass2((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition">
                    {showNewPass2 ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </Field>
              <button type="submit" disabled={busy} className="w-full rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-medium py-2.5 transition">
                {busy ? 'Saving…' : 'Set New Password'}
              </button>
            </form>
          )}
        </div>
      </div>

      <style>{`
        .auth-input {
          width: 100%;
          background: rgb(24 24 27);
          border: 1px solid rgb(63 63 70);
          border-radius: 0.5rem;
          padding: 0.625rem 0.75rem 0.625rem 2.25rem;
          color: white;
          outline: none;
          transition: border-color .15s, box-shadow .15s;
        }
        .auth-input:focus { border-color: rgb(220 38 38); box-shadow: 0 0 0 3px rgba(220,38,38,0.15); }
        .auth-input::placeholder { color: rgb(113 113 122); }
        input[type="date"].auth-input::-webkit-calendar-picker-indicator { filter: invert(0.4); cursor: pointer; }
      `}</style>
    </div>
  );
}

function Field({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs text-zinc-400 mb-1">{label}</span>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">{icon}</span>
        {children}
      </div>
    </label>
  );
}
