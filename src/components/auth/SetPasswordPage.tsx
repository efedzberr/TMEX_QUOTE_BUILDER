import { useState, useEffect, FormEvent } from 'react';
import { Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export function SetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [invalidLink, setInvalidLink] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Supabase processes the token from the URL hash on load via onAuthStateChange.
    // We listen for PASSWORD_RECOVERY or SIGNED_IN events that signal the token was valid.
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setSessionReady(true);
      }
    });

    // Also check if a session already exists (token already exchanged)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessionReady(true);
    });

    // If no session after a timeout, the link is invalid
    const timeout = setTimeout(() => {
      setSessionReady(prev => {
        if (!prev) setInvalidLink(true);
        return prev;
      });
    }, 5000);

    return () => {
      listener.subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const passwordValid = password.length >= 8;
  const passwordsMatch = password === confirm;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!passwordValid) { setError('Password must be at least 8 characters'); return; }
    if (!passwordsMatch) { setError('Passwords do not match'); return; }

    setLoading(true);
    setError(null);

    const { error: updateErr } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateErr) {
      setError(updateErr.message);
      return;
    }

    setDone(true);
    // Redirect to main app - AuthGate will handle MFA enrollment
    setTimeout(() => {
      window.location.hash = '/';
    }, 1500);
  }

  if (invalidLink) {
    return (
      <Shell>
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-50 flex items-center justify-center">
            <AlertCircle className="w-6 h-6 text-red-500" />
          </div>
          <h1 className="text-lg font-semibold text-gray-900 mb-2">Invalid or Expired Link</h1>
          <p className="text-sm text-gray-500">This invitation link is no longer valid. Please contact your administrator to receive a new one.</p>
        </div>
      </Shell>
    );
  }

  if (!sessionReady) {
    return (
      <Shell>
        <div className="text-center py-8">
          <div className="text-sm text-gray-400">Verifying invitation...</div>
        </div>
      </Shell>
    );
  }

  if (done) {
    return (
      <Shell>
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-green-50 flex items-center justify-center">
            <Lock className="w-6 h-6 text-green-600" />
          </div>
          <h1 className="text-lg font-semibold text-gray-900 mb-2">Password Set Successfully</h1>
          <p className="text-sm text-gray-500">Redirecting to set up two-factor authentication...</p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
          <Lock className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Set Your Password</h1>
          <p className="text-sm text-gray-500">Create a password for your account</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-10"
              placeholder="Minimum 8 characters"
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <div className={`h-1 flex-1 rounded-full ${password.length === 0 ? 'bg-gray-200' : password.length < 8 ? 'bg-red-300' : password.length < 12 ? 'bg-amber-300' : 'bg-green-400'}`} />
            <span className="text-xs text-gray-400">{password.length < 8 ? 'Min 8 chars' : password.length < 12 ? 'Good' : 'Strong'}</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
          <input
            type={showPassword ? 'text' : 'password'}
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            required
            className={`w-full px-3 py-2.5 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${confirm && !passwordsMatch ? 'border-red-300' : 'border-gray-300'}`}
            placeholder="Re-enter password"
          />
          {confirm && !passwordsMatch && (
            <p className="mt-1 text-xs text-red-500">Passwords do not match</p>
          )}
        </div>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>
        )}

        <button
          type="submit"
          disabled={loading || !passwordValid || !passwordsMatch}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-md transition-colors"
        >
          {loading ? 'Setting password...' : 'Set Password & Continue'}
        </button>
      </form>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-6">
          <img src="/Transmex_Logo.jpeg" alt="Transmex" className="h-12 w-auto object-contain" />
        </div>
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-8">
          {children}
        </div>
        <p className="text-center text-xs text-gray-400 mt-6">Smart Pricing Hub</p>
      </div>
    </div>
  );
}
