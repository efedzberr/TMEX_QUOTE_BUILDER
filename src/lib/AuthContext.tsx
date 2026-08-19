import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

/**
 * Estados posibles del flujo de autenticación:
 *  - loading:        verificando sesión al cargar la app
 *  - signed_out:     sin sesión → mostrar login
 *  - needs_mfa:      password correcto, pero falta verificar el código TOTP (tiene factor enrolado)
 *  - needs_enroll:   password correcto, pero el usuario aún NO tiene 2FA configurado (obligatorio)
 *  - authenticated:  sesión completa con AAL2 (password + TOTP verificados)
 */
export type AuthStatus = 'loading' | 'signed_out' | 'needs_mfa' | 'needs_enroll' | 'authenticated';

interface AuthContextValue {
  status: AuthStatus;
  session: Session | null;
  userEmail: string | null;
  refreshAuthState: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [session, setSession] = useState<Session | null>(null);

  const evaluateSession = useCallback(async (s: Session | null) => {
    if (!s) {
      setSession(null);
      setStatus('signed_out');
      return;
    }
    setSession(s);

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
    setSession(null);
    setStatus('signed_out');
  }, []);

  useEffect(() => {
    refreshAuthState();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      evaluateSession(s);
    });

    return () => listener.subscription.unsubscribe();
  }, [refreshAuthState, evaluateSession]);

  return (
    <AuthContext.Provider
      value={{
        status,
        session,
        userEmail: session?.user?.email ?? null,
        refreshAuthState,
        signOut,
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
