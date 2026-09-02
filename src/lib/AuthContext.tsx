import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

/**
 * Estados posibles del flujo de autenticación:
 *  - loading:        verificando sesión al cargar la app
 *  - signed_out:     sin sesión → mostrar login
 *  - needs_password: sesión de invite/recovery → debe definir contraseña primero
 *  - needs_mfa:      password correcto, pero falta verificar el código TOTP (tiene factor enrolado)
 *  - needs_enroll:   password correcto, pero el usuario aún NO tiene 2FA configurado (obligatorio)
 *  - authenticated:  sesión completa con AAL2 (password + TOTP verificados)
 */
export type AuthStatus = 'loading' | 'signed_out' | 'needs_password' | 'needs_mfa' | 'needs_enroll' | 'authenticated';

interface AuthContextValue {
  status: AuthStatus;
  session: Session | null;
  userEmail: string | null;
  refreshAuthState: () => Promise<void>;
  signOut: () => Promise<void>;
  clearPasswordNeeded: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function detectInviteOrRecoveryInHash(): boolean {
  const hash = window.location.hash;
  // Supabase appends auth params like #access_token=...&type=invite or type=recovery,
  // and the /auth/confirm landing page uses #/auth/confirm?token_hash=...&type=invite
  return hash.includes('type=invite') || hash.includes('type=recovery') || hash.includes('type=signup');
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [session, setSession] = useState<Session | null>(null);

  /**
   * True while the user arrived through an invite / recovery link and has not yet set
   * their password. A ref (not state) so every evaluation reads the CURRENT value —
   * with state, stale closures kept re-forcing the password screen after it was cleared,
   * which made the app ask for the password twice during onboarding.
   */
  const passwordFlowRef = useRef(false);

  const evaluateSession = useCallback(async (s: Session | null) => {
    if (!s) {
      setSession(null);
      setStatus('signed_out');
      return;
    }
    setSession(s);

    // Invite / recovery in progress: force password setup first (until cleared)
    if (passwordFlowRef.current) {
      setStatus('needs_password');
      return;
    }

    // Verificar nivel de aseguramiento (AAL) y factores enrolados
    const { data: aalData, error: aalError } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

    if (aalError) {
      console.error('Error verificando AAL:', aalError.message);
      setStatus('signed_out');
      return;
    }

    const { currentLevel, nextLevel } = aalData;

    if (currentLevel === 'aal2') {
      // Password + TOTP verificados: acceso completo
      setStatus('authenticated');
    } else if (nextLevel === 'aal2') {
      // Tiene factor TOTP enrolado pero no ha verificado el código en esta sesión
      setStatus('needs_mfa');
    } else {
      // No tiene ningún factor enrolado → forzar enrolamiento (2FA obligatorio)
      setStatus('needs_enroll');
    }
  }, []);

  const refreshAuthState = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    await evaluateSession(data.session);
  }, [evaluateSession]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    passwordFlowRef.current = false;
    setSession(null);
    setStatus('signed_out');
  }, []);

  const clearPasswordNeeded = useCallback(() => {
    // Synchronous: the very next evaluation already sees the flow as finished
    passwordFlowRef.current = false;
  }, []);

  useEffect(() => {
    // On initial load, check if the URL contains invite/recovery tokens
    if (detectInviteOrRecoveryInHash()) {
      passwordFlowRef.current = true;
    }

    const { data: listener } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') {
        passwordFlowRef.current = true;
      }
      (async () => { await evaluateSession(s); })();
    });

    // Initial session check
    (async () => {
      const { data } = await supabase.auth.getSession();
      await evaluateSession(data.session);
    })();

    return () => listener.subscription.unsubscribe();
  }, [evaluateSession]);

  return (
    <AuthContext.Provider
      value={{
        status,
        session,
        userEmail: session?.user?.email ?? null,
        refreshAuthState,
        signOut,
        clearPasswordNeeded,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
