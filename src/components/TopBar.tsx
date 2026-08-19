import { LogOut, UserCircle2 } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';

export function TopBar() {
  const { userEmail, signOut } = useAuth();

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
        <button
          onClick={signOut}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-600 transition-colors"
          title="Cerrar sesiĂłn"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Salir</span>
        </button>
      </div>
    </header>
  );
}