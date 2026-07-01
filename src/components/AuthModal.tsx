import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { sha256 } from '../lib/utils';
import type { Profile } from '../types/database';
import { X, User, Mail, Phone, Lock, Eye, EyeOff, ArrowLeft, KeyRound, CheckCircle2, Upload, Shield } from 'lucide-react';

interface AuthModalProps {
  onClose: () => void;
  onAuthSuccess: (profile: Profile) => void;
  onAdminLogin: () => void;
}

type Mode = 'login' | 'signup' | 'forgot-request' | 'forgot-otp' | 'forgot-reset' | 'admin-login';

export default function AuthModal({ onClose, onAuthSuccess, onAdminLogin }: AuthModalProps) {
  const [mode, setMode] = useState<Mode>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [resetIdentifier, setResetIdentifier] = useState('');

  // Signup fields
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPhone, setSignupPhone] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
  const [signupDp, setSignupDp] = useState<string>('');

  // Login fields
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Forgot password fields
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  // Admin login fields
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  useEffect(() => {
    setError('');
  }, [mode]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setSignupDp(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSignup = async () => {
    setError('');
    if (!signupName.trim()) return setError('Name is required');
    if (!signupEmail.trim() && !signupPhone.trim())
      return setError('Email or phone number is required');
    if (signupPassword.length < 6)
      return setError('Password must be at least 6 characters');
    if (signupPassword !== signupConfirmPassword)
      return setError('Passwords do not match');

    setLoading(true);
    try {
      const passwordHash = await sha256(signupPassword);

      // Check if email or phone already exists
      if (signupEmail.trim()) {
        const { data: existing } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', signupEmail.trim())
          .maybeSingle();
        if (existing) {
          setError('An account with this email already exists');
          setLoading(false);
          return;
        }
      }
      if (signupPhone.trim()) {
        const { data: existing } = await supabase
          .from('profiles')
          .select('id')
          .eq('phone', signupPhone.trim())
          .maybeSingle();
        if (existing) {
          setError('An account with this phone number already exists');
          setLoading(false);
          return;
        }
      }

      const { data, error } = await supabase
        .from('profiles')
        .insert({
          name: signupName.trim(),
          email: signupEmail.trim() || null,
          phone: signupPhone.trim() || null,
          password_hash: passwordHash,
          display_picture_url: signupDp || null,
          is_admin: false,
        })
        .select()
        .single();

      if (error) throw error;
      if (data) {
        onAuthSuccess(data as Profile);
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    setError('');
    if (!loginIdentifier.trim()) return setError('Email or phone is required');
    if (!loginPassword) return setError('Password is required');

    setLoading(true);
    try {
      const passwordHash = await sha256(loginPassword);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .or(`email.eq.${loginIdentifier.trim()},phone.eq.${loginIdentifier.trim()}`)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        setError('No account found with this email or phone');
        setLoading(false);
        return;
      }
      if (data.password_hash !== passwordHash) {
        setError('Incorrect password');
        setLoading(false);
        return;
      }

      onAuthSuccess(data as Profile);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotRequest = async () => {
    setError('');
    if (!forgotIdentifier.trim()) return setError('Email or phone is required');

    setLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/password-reset`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ action: 'request', identifier: forgotIdentifier.trim() }),
        }
      );
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || 'Failed to send OTP');
        setLoading(false);
        return;
      }
      setGeneratedOtp(result.otp || '');
      setResetIdentifier(forgotIdentifier.trim());
      setMode('forgot-otp');
    } catch {
      setError('Failed to request OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setError('');
    if (!otpInput.trim()) return setError('Please enter the OTP code');

    setLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/password-reset`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            action: 'verify',
            identifier: resetIdentifier,
            otp: otpInput.trim(),
          }),
        }
      );
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || 'Invalid OTP');
        setLoading(false);
        return;
      }
      setMode('forgot-reset');
    } catch {
      setError('Failed to verify OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    setError('');
    if (newPassword.length < 6)
      return setError('Password must be at least 6 characters');
    if (newPassword !== confirmNewPassword)
      return setError('Passwords do not match');

    setLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/password-reset`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            action: 'reset',
            identifier: resetIdentifier,
            newPassword,
          }),
        }
      );
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || 'Failed to reset password');
        setLoading(false);
        return;
      }
      setMode('login');
      setNewPassword('');
      setConfirmNewPassword('');
      setOtpInput('');
      setForgotIdentifier('');
      setError('');
    } catch {
      setError('Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminLogin = async () => {
    setError('');
    if (!adminEmail.trim() || !adminPassword) return setError('Email and password are required');

    setLoading(true);
    try {
      const passwordHash = await sha256(adminPassword);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', adminEmail.trim())
        .eq('is_admin', true)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        setError('Invalid admin credentials');
        setLoading(false);
        return;
      }
      if (data.password_hash !== passwordHash) {
        setError('Incorrect admin password');
        setLoading(false);
        return;
      }

      onAuthSuccess(data as Profile);
      onAdminLogin();
      onClose();
    } catch {
      setError('Admin login failed');
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full pl-10 pr-3 py-2.5 bg-gray-800/60 border border-gray-700/50 rounded-xl text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 transition-all';

  const labelClass = 'block text-sm text-gray-400 mb-1.5';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-700/50 rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 pb-4 border-b border-gray-800/50">
          <div className="flex items-center gap-2">
            {mode !== 'login' && mode !== 'signup' && mode !== 'admin-login' && (
              <button
                onClick={() => setMode('login')}
                className="text-gray-500 hover:text-gray-300 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <h3 className="text-lg font-semibold text-gray-100">
              {mode === 'login' && 'Welcome Back'}
              {mode === 'signup' && 'Create Account'}
              {mode === 'forgot-request' && 'Reset Password'}
              {mode === 'forgot-otp' && 'Enter OTP'}
              {mode === 'forgot-reset' && 'Set New Password'}
              {mode === 'admin-login' && 'Admin Login'}
            </h3>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 pt-4">
          {error && (
            <div className="mb-4 px-4 py-2.5 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* LOGIN MODE */}
          {mode === 'login' && (
            <div className="space-y-4">
              <div>
                <label className={labelClass}>Email or Phone Number</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    placeholder="you@example.com or +1234567890"
                    className={inputClass}
                    onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className={inputClass}
                    onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button
                onClick={handleLogin}
                disabled={loading}
                className="w-full py-2.5 bg-gradient-to-r from-red-600 to-rose-600 rounded-xl font-medium text-white hover:shadow-lg hover:shadow-red-500/25 transition-all disabled:opacity-50"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
              <div className="flex justify-between items-center text-sm">
                <button
                  onClick={() => setMode('forgot-request')}
                  className="text-red-400 hover:text-red-300 transition-colors"
                >
                  Forgot Password?
                </button>
                <button
                  onClick={() => setMode('signup')}
                  className="text-gray-400 hover:text-gray-200 transition-colors"
                >
                  Create Account
                </button>
              </div>
              <div className="relative pt-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-800/50" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-gray-900 px-3 text-xs text-gray-500">or</span>
                </div>
              </div>
              <button
                onClick={() => setMode('admin-login')}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-red-500/10 border border-red-500/30 rounded-xl font-medium text-red-400 hover:bg-red-500/20 transition-all"
              >
                <Shield className="w-4 h-4" />
                Admin Login
              </button>
            </div>
          )}

          {/* SIGNUP MODE */}
          {mode === 'signup' && (
            <div className="space-y-4">
              {/* Display Picture */}
              <div className="flex flex-col items-center gap-2">
                <div className="w-20 h-20 rounded-full bg-gray-800 border-2 border-gray-700 flex items-center justify-center overflow-hidden">
                  {signupDp ? (
                    <img src={signupDp} alt="DP" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-8 h-8 text-gray-500" />
                  )}
                </div>
                <label className="cursor-pointer text-sm text-red-400 hover:text-red-300 transition-colors flex items-center gap-1">
                  <Upload className="w-3.5 h-3.5" />
                  Upload Display Picture
                  <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                </label>
              </div>

              <div>
                <label className={labelClass}>Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    value={signupName}
                    onChange={(e) => setSignupName(e.target.value)}
                    placeholder="John Doe"
                    className={inputClass}
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="email"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    placeholder="you@example.com"
                    className={inputClass}
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="tel"
                    value={signupPhone}
                    onChange={(e) => setSignupPhone(e.target.value)}
                    placeholder="+1234567890"
                    className={inputClass}
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500">Provide either email or phone (or both).</p>
              <div>
                <label className={labelClass}>Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    placeholder="••••••••"
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className={labelClass}>Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={signupConfirmPassword}
                    onChange={(e) => setSignupConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button
                onClick={handleSignup}
                disabled={loading}
                className="w-full py-2.5 bg-gradient-to-r from-red-600 to-rose-600 rounded-xl font-medium text-white hover:shadow-lg hover:shadow-red-500/25 transition-all disabled:opacity-50"
              >
                {loading ? 'Creating account...' : 'Sign Up'}
              </button>
              <button
                onClick={() => setMode('login')}
                className="w-full text-center text-sm text-gray-400 hover:text-gray-200 transition-colors"
              >
                Already have an account? Sign In
              </button>
            </div>
          )}

          {/* FORGOT - REQUEST OTP */}
          {mode === 'forgot-request' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-400">
                Enter your registered email or phone number. We'll send you a 6-digit OTP code.
              </p>
              <div>
                <label className={labelClass}>Email or Phone Number</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    value={forgotIdentifier}
                    onChange={(e) => setForgotIdentifier(e.target.value)}
                    placeholder="you@example.com or +1234567890"
                    className={inputClass}
                    onKeyDown={(e) => e.key === 'Enter' && handleForgotRequest()}
                  />
                </div>
              </div>
              <button
                onClick={handleForgotRequest}
                disabled={loading}
                className="w-full py-2.5 bg-gradient-to-r from-red-600 to-rose-600 rounded-xl font-medium text-white hover:shadow-lg hover:shadow-red-500/25 transition-all disabled:opacity-50"
              >
                {loading ? 'Sending OTP...' : 'Send OTP'}
              </button>
            </div>
          )}

          {/* FORGOT - ENTER OTP */}
          {mode === 'forgot-otp' && (
            <div className="space-y-4">
              {generatedOtp && (
                <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300 text-sm">
                  <p className="font-medium">Your OTP code (demo mode):</p>
                  <p className="text-2xl font-bold tracking-widest mt-1">{generatedOtp}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    In production, this would be sent via email/SMS.
                  </p>
                </div>
              )}
              <div>
                <label className={labelClass}>Enter 6-digit OTP</label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    maxLength={6}
                    value={otpInput}
                    onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    className="w-full pl-10 pr-3 py-2.5 bg-gray-800/60 border border-gray-700/50 rounded-xl text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500/50 text-center text-2xl tracking-widest font-bold"
                    onKeyDown={(e) => e.key === 'Enter' && handleVerifyOtp()}
                  />
                </div>
              </div>
              <button
                onClick={handleVerifyOtp}
                disabled={loading}
                className="w-full py-2.5 bg-gradient-to-r from-red-600 to-rose-600 rounded-xl font-medium text-white hover:shadow-lg hover:shadow-red-500/25 transition-all disabled:opacity-50"
              >
                {loading ? 'Verifying...' : 'Verify OTP'}
              </button>
            </div>
          )}

          {/* FORGOT - SET NEW PASSWORD */}
          {mode === 'forgot-reset' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-rose-400 text-sm">
                <CheckCircle2 className="w-5 h-5" />
                OTP verified! Set your new password.
              </div>
              <div>
                <label className={labelClass}>New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className={labelClass}>Confirm New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button
                onClick={handleResetPassword}
                disabled={loading}
                className="w-full py-2.5 bg-gradient-to-r from-red-600 to-rose-600 rounded-xl font-medium text-white hover:shadow-lg hover:shadow-red-500/25 transition-all disabled:opacity-50"
              >
                {loading ? 'Updating...' : 'Set New Password'}
              </button>
            </div>
          )}

          {/* ADMIN LOGIN */}
          {mode === 'admin-login' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                <Shield className="w-4 h-4" />
                Admin access only
              </div>
              <div>
                <label className={labelClass}>Admin Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="Admin Email"
                    className={inputClass}
                    onKeyDown={(e) => e.key === 'Enter' && handleAdminLogin()}
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Admin Password"
                    className={inputClass}
                    onKeyDown={(e) => e.key === 'Enter' && handleAdminLogin()}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button
                onClick={handleAdminLogin}
                disabled={loading}
                className="w-full py-2.5 bg-gradient-to-r from-red-600 to-rose-600 rounded-xl font-medium text-white hover:shadow-lg hover:shadow-red-500/25 transition-all disabled:opacity-50"
              >
                {loading ? 'Authenticating...' : 'Login as Admin'}
              </button>
              <button
                onClick={() => setMode('login')}
                className="w-full text-center text-sm text-gray-400 hover:text-gray-200 transition-colors"
              >
                Back to User Login
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
