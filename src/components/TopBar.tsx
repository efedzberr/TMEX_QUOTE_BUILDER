import { useState } from 'react';
import { LogOut, UserCircle2, Activity, X, KeyRound } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { SecurityLogPanel } from './admin/SecurityLogPanel';
import { ChangePasswordModal } from './auth/ChangePasswordModal';

export function TopBar() {
  const { userEmail, session, signOut } = useAuth();
  const [showActivity, setShowActivity] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [passwordChanged, setPasswordChanged] = useState(false);
  const userId = session?.user?.id;

  return (
    <header className="sticky top-0 z-30 h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      <img
        src="/Transmex_Logo.jpeg"
        alt="Transmex"
        className="h-8 w-auto object-contain"
      />

      <div className="flex items-center gap-4">
        {userEmail && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <UserCircle2 className="w-5 h-5 text-gray-400" />
            <span className="hidden sm:inline">{userEmail}</span>
          </div>
        )}
        {userId && (
          <button
            onClick={() => setShowActivity(true)}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-blue-600 transition-colors"
            title="Mi actividad"
          >
            <Activity className="w-4 h-4" />
            <span className="hidden sm:inline">Mi actividad</span>
          </button>
        )}
        {userId && (
          <button
            onClick={() => setShowChangePassword(true)}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-blue-600 transition-colors"
            title="Cambiar contraseña"
          >
            <KeyRound className="w-4 h-4" />
            <span className="hidden sm:inline">Contraseña</span>
          </button>
        )}
        <button
          onClick={signOut}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-600 transition-colors"
          title="Cerrar sesión"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Salir</span>
        </button>
      </div>

      {showChangePassword && (
        <ChangePasswordModal
          onClose={() => setShowChangePassword(false)}
          onChanged={() => { setShowChangePassword(false); setPasswordChanged(true); window.setTimeout(() => setPasswordChanged(false), 4000); }}
        />
      )}
      {passwordChanged && (
        <div className="fixed bottom-6 right-6 z-[70] bg-emerald-600 text-white text-sm px-4 py-2.5 rounded-md shadow-lg">Contraseña actualizada</div>
      )}
      {showActivity && userId && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-4 overflow-y-auto" onClick={() => setShowActivity(false)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl mt-8" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Mi actividad</h3>
                <p className="text-sm text-gray-500 mt-0.5">Tus inicios de sesión, sesiones y acciones recientes.</p>
              </div>
              <button onClick={() => setShowActivity(false)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500"><X className="w-4 h-4" /></button>
            </div>
            <div className="px-6 py-4">
              <SecurityLogPanel userId={userId} />
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
