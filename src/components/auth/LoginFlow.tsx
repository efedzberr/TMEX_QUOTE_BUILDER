import { useState, useEffect, FormEvent } from 'react';
import { Lock, ShieldCheck, LogOut, KeyRound, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';

/* ============================================================
   Shell visual compartido (consistente con la app: fondo gris,
   tarjeta blanca, logo Transmex)
   ============================================================ */
function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-6">
          <img
            src="/Transmex_Logo.jpeg"
            alt="Transmex"
            className="h-12 w-auto object-contain"
          />
        </div>
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-8">
          {children}
        </div>
        <p className="text-center text-xs text-gray-400 mt-6">
          Smart Pricing Hub · Acceso restringido
        </p>
      </div>
    </div>
  );
}

/* ============================================================
   Paso 1: Email + contraseña
   ============================================================ */
function PasswordStep() {
  const { refreshAuthState } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (signInError) {
      setError('Correo o contraseña incorrectos.');
      return;
    }
    await refreshAuthState();
  }

  return (
    <AuthShell>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
          <Lock className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Iniciar sesión</h1>
          <p className="text-sm text-gray-500">Ingresa tus credenciales</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Correo electrónico
          </label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="usuario@empresa.com"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Contraseña
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-md transition-colors"
        >
          {loading ? 'Verificando…' : 'Continuar'}
        </button>
      </form>
    </AuthShell>
  );
}

/* ============================================================
   Paso 2a: Reto TOTP (usuario ya tiene 2FA enrolado)
   ============================================================ */
function MfaChallengeStep() {
  const { refreshAuthState, signOut } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data: factors, error: fErr } = await supabase.auth.mfa.listFactors();
      if (fErr) throw fErr;
      const totp = factors.totp.find(f => f.status === 'verified');
      if (!totp) throw new Error('No se encontró un factor TOTP verificado.');

      const { data: challenge, error: cErr } = await supabase.auth.mfa.challenge({
        factorId: totp.id,
      });
      if (cErr) throw cErr;

      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId: totp.id,
        challengeId: challenge.id,
        code: code.trim(),
      });
      if (vErr) throw vErr;

      await refreshAuthState();
    } catch {
      setError('Código inválido o expirado. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
          <ShieldCheck className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Verificación en dos pasos</h1>
          <p className="text-sm text-gray-500">
            Ingresa el código de 6 dígitos de tu app autenticadora
          </p>
        </div>
      </div>

      <form onSubmit={handleVerify} className="space-y-4">
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          value={code}
          onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
          required
          autoFocus
          className="w-full px-3 py-3 border border-gray-300 rounded-md text-center text-2xl tracking-[0.5em] font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="000000"
        />

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || code.length !== 6}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-md transition-colors"
        >
          {loading ? 'Verificando…' : 'Verificar código'}
        </button>

        <button
          type="button"
          onClick={signOut}
          className="w-full flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-gray-700 py-2"
        >
          <LogOut className="w-4 h-4" />
          Cancelar y cerrar sesión
        </button>
      </form>
    </AuthShell>
  );
}

/* ============================================================
   Paso 2b: Enrolamiento obligatorio de 2FA (primer inicio)
   ============================================================ */
function MfaEnrollStep() {
  const { refreshAuthState, signOut } = useAuth();
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function startEnrollment() {
      // Limpiar factores no verificados de intentos previos abandonados
      const { data: factors } = await supabase.auth.mfa.listFactors();
      if (factors) {
        for (const f of factors.all.filter(f => f.status === 'unverified')) {
          await supabase.auth.mfa.unenroll({ factorId: f.id });
        }
      }

      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'App autenticadora',
      });
      if (cancelled) return;
      if (enrollError || !data) {
        setError('No se pudo iniciar el enrolamiento. Recarga la página.');
        return;
      }
      setFactorId(data.id);
      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
    }

    startEnrollment();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setError(null);
    setLoading(true);
    try {
      const { data: challenge, error: cErr } = await supabase.auth.mfa.challenge({ factorId });
      if (cErr) throw cErr;

      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: code.trim(),
      });
      if (vErr) throw vErr;

      await refreshAuthState();
    } catch {
      setError('Código inválido. Verifica que escaneaste el QR correcto e intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
          <KeyRound className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Configura tu 2FA</h1>
          <p className="text-sm text-gray-500">
            Requerido para acceder al Smart Pricing Hub
          </p>
        </div>
      </div>

      <ol className="text-sm text-gray-600 space-y-1 mb-4 list-decimal list-inside">
        <li>Abre Google Authenticator, Microsoft Authenticator o Authy</li>
        <li>Escanea el código QR</li>
        <li>Ingresa el código de 6 dígitos que aparece en la app</li>
      </ol>

      <div className="flex justify-center mb-4">
        {qrCode ? (
          <img
            src={qrCode}
            alt="Código QR para app autenticadora"
            className="w-44 h-44 border border-gray-200 rounded-md"
          />
        ) : (
          <div className="w-44 h-44 border border-gray-200 rounded-md flex items-center justify-center text-sm text-gray-400">
            Generando QR…
          </div>
        )}
      </div>

      {secret && (
        <p className="text-xs text-gray-400 text-center mb-4 break-all">
          ¿No puedes escanear? Ingresa esta clave manualmente:{' '}
          <span className="font-mono text-gray-600">{secret}</span>
        </p>
      )}

      <form onSubmit={handleVerify} className="space-y-4">
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          value={code}
          onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
          required
          className="w-full px-3 py-3 border border-gray-300 rounded-md text-center text-2xl tracking-[0.5em] font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="000000"
        />

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || code.length !== 6 || !factorId}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-md transition-colors"
        >
          {loading ? 'Activando…' : 'Activar 2FA y entrar'}
        </button>

        <button
          type="button"
          onClick={signOut}
          className="w-full flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-gray-700 py-2"
        >
          <LogOut className="w-4 h-4" />
          Cancelar y cerrar sesión
        </button>
      </form>
    </AuthShell>
  );
}

/* ============================================================
   Paso intermedio: establecer contraseña (invite/recovery flow)
   ============================================================ */
function InvitePasswordStep() {
  const { refreshAuthState, signOut, clearPasswordNeeded } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const passwordValid = password.length >= 8;
  const passwordsMatch = password === confirm;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!passwordValid) { setError('La contraseña debe tener al menos 8 caracteres'); return; }
    if (!passwordsMatch) { setError('Las contraseñas no coinciden'); return; }

    setLoading(true);
    setError(null);

    const { error: updateErr } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateErr) {
      setError(updateErr.message);
      return;
    }

    // Password set successfully, clear the flag and proceed to MFA enrollment
    clearPasswordNeeded();
    await refreshAuthState();
  }

  return (
    <AuthShell>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
          <Lock className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Establece tu contraseña</h1>
          <p className="text-sm text-gray-500">Crea una contraseña para tu cuenta</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nueva contraseña</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-10"
              placeholder="Mínimo 8 caracteres"
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <div className={`h-1 flex-1 rounded-full ${password.length === 0 ? 'bg-gray-200' : password.length < 8 ? 'bg-red-300' : password.length < 12 ? 'bg-amber-300' : 'bg-green-400'}`} />
            <span className="text-xs text-gray-400">{password.length < 8 ? 'Min 8 chars' : password.length < 12 ? 'Buena' : 'Fuerte'}</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar contraseña</label>
          <input
            type={showPassword ? 'text' : 'password'}
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            required
            className={`w-full px-3 py-2.5 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${confirm && !passwordsMatch ? 'border-red-300' : 'border-gray-300'}`}
            placeholder="Repite la contraseña"
          />
          {confirm && !passwordsMatch && (
            <p className="mt-1 text-xs text-red-500">Las contraseñas no coinciden</p>
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
          {loading ? 'Guardando…' : 'Establecer contraseña y continuar'}
        </button>

        <button
          type="button"
          onClick={signOut}
          className="w-full flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-gray-700 py-2"
        >
          <LogOut className="w-4 h-4" />
          Cancelar y cerrar sesión
        </button>
      </form>
    </AuthShell>
  );
}

/* ============================================================
   AuthGate: envuelve la app interna y decide qué mostrar
   ============================================================ */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-sm text-gray-400">Cargando…</div>
      </div>
    );
  }
  if (status === 'signed_out') return <PasswordStep />;
  if (status === 'needs_password') return <InvitePasswordStep />;
  if (status === 'needs_mfa') return <MfaChallengeStep />;
  if (status === 'needs_enroll') return <MfaEnrollStep />;
  return <>{children}</>;
}
