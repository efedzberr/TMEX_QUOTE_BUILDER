import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

type OtpType = 'invite' | 'recovery' | 'signup' | 'magiclink' | 'email_change';

/**
 * Landing page for invitation / password-reset emails.
 *
 * The email links here instead of to Supabase's direct verification URL because corporate
 * email scanners (e.g. Microsoft Safe Links) pre-open every link and would consume the
 * one-time token before the user clicks. This page is safe to pre-open: the token is only
 * verified when the user presses the button.
 */
export function ConfirmLinkPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const tokenHash = params.get('token_hash') || '';
  const type = (params.get('type') || 'invite') as OtpType;
  const [state, setState] = useState<'idle' | 'verifying' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const copy = useMemo(() => {
    if (type === 'recovery') {
      return { title: 'Reset your password', action: 'Continue to reset password', hint: 'You will choose a new password on the next screen.' };
    }
    return { title: 'Welcome to the Smart Pricing Hub', action: 'Continue to account setup', hint: 'You will set your password on the next screen.' };
  }, [type]);

  async function handleContinue() {
    if (!tokenHash) { setState('error'); setErrorMsg('This link is incomplete. Ask your administrator to send a new one.'); return; }
    setState('verifying');
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) {
      setState('error');
      const msg = (error.message || '').toLowerCase();
      setErrorMsg(
        msg.includes('expired') || msg.includes('invalid')
          ? 'This link has expired or was already used. Ask your administrator to send you a new invitation or password reset.'
          : error.message
      );
      return;
    }
    navigate('/', { replace: true });
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-6">
          <img src="/Transmex_Logo.jpeg" alt="TransMex" className="h-14 object-contain" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          {state !== 'error' ? (
            <>
              <div className="mx-auto w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mb-4">
                <ShieldCheck className="w-6 h-6 text-blue-600" />
              </div>
              <h1 className="text-lg font-semibold text-gray-900 mb-1">{copy.title}</h1>
              <p className="text-sm text-gray-500 mb-6">{copy.hint}</p>
              <button
                onClick={handleContinue}
                disabled={state === 'verifying'}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
              >
                {state === 'verifying' ? (<><Loader2 className="w-4 h-4 animate-spin" /> Verifying...</>) : copy.action}
              </button>
              <p className="mt-4 text-xs text-gray-400">This link can be used once and expires 24 hours after it was sent.</p>
            </>
          ) : (
            <>
              <div className="mx-auto w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-4">
                <AlertCircle className="w-6 h-6 text-red-500" />
              </div>
              <h1 className="text-lg font-semibold text-gray-900 mb-2">Link not valid</h1>
              <p className="text-sm text-gray-600 mb-6">{errorMsg}</p>
              <button onClick={() => navigate('/', { replace: true })} className="text-sm font-medium text-blue-600 hover:text-blue-700">Go to sign in</button>
            </>
          )}
        </div>
        <p className="mt-6 text-center text-xs text-gray-400">Smart Pricing Hub &middot; Restricted access</p>
      </div>
    </div>
  );
}
