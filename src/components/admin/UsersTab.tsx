import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase as supabaseClient } from '../../lib/supabase';
import { Search, X, UserPlus, Shield, ShieldOff, Ban, CheckCircle, KeyRound, MoreHorizontal, Users, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';

interface UserRow {
  id: string;
  email: string;
  display_name: string | null;
  is_admin: boolean;
  role_id: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  banned_until: string | null;
  mfa_enrolled: boolean;
}

interface RoleOption {
  id: string;
  name: string;
  is_system: boolean;
}

async function fetchRoles(): Promise<RoleOption[]> {
  const { data, error } = await supabaseClient.from('roles').select('id,name,is_system').order('is_system', { ascending: false }).order('name');
  if (error) throw error;
  return (data || []) as RoleOption[];
}

interface UsersTabProps {
  onToast: (message: string, type: 'success' | 'error') => void;
}

async function callAdminUsers(action: string, payload: Record<string, unknown> = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('No session');

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action, ...payload }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error || `Error ${res.status}`);
  return data;
}

export function UsersTab({ onToast }: UsersTabProps) {
  const { session } = useAuth();
  const currentUserId = session?.user?.id;

  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ type: string; user: UserRow } | null>(null);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [changeRoleUser, setChangeRoleUser] = useState<UserRow | null>(null);
  const roleName = (id: string | null) => roles.find(r => r.id === id)?.name || null;
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  async function loadUsers() {
    setLoading(true);
    setError(null);
    try {
      const data = await callAdminUsers('list');
      setUsers(data.users || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
    fetchRoles().then(setRoles).catch(err => console.error('Error loading roles:', err));
  }, []);

  async function handleChangeRole(user: UserRow, newRoleId: string) {
    try {
      const { error: updErr } = await supabaseClient.from('user_profiles').update({ role_id: newRoleId }).eq('id', user.id);
      if (updErr) throw updErr;
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, role_id: newRoleId } : u));
      onToast(`${user.display_name || user.email} is now "${roleName(newRoleId) || 'Unassigned'}"`, 'success');
    } catch (e: any) {
      onToast(e.message || "We couldn't change the role.", 'error');
    } finally {
      setChangeRoleUser(null);
    }
  }

  const closeMenu = useCallback(() => {
    setActionMenuId(null);
    setMenuPos(null);
  }, []);

  useEffect(() => {
    if (!actionMenuId) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeMenu();
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeMenu();
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [actionMenuId, closeMenu]);

  function openMenu(userId: string, buttonEl: HTMLButtonElement) {
    if (actionMenuId === userId) {
      closeMenu();
      return;
    }
    const rect = buttonEl.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 4, left: rect.right - 208 });
    setActionMenuId(userId);
  }

  const filtered = users
    .filter(u => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (u.display_name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q);
    })
    .sort((a, b) => (a.display_name || '').localeCompare(b.display_name || ''));

  function isActive(u: UserRow) {
    if (!u.banned_until) return true;
    return new Date(u.banned_until) < new Date();
  }

  async function handleToggleAdmin(user: UserRow) {
    try {
      await callAdminUsers('set_admin', { user_id: user.id, is_admin: !user.is_admin });
      onToast(`${user.display_name || user.email} is now ${!user.is_admin ? 'an Admin' : 'a User'}`, 'success');
      loadUsers();
    } catch (e: any) {
      onToast(e.message, 'error');
    }
  }

  async function handleToggleActive(user: UserRow) {
    const currentlyActive = isActive(user);
    try {
      await callAdminUsers('set_active', { user_id: user.id, active: !currentlyActive });
      onToast(`${user.display_name || user.email} ${currentlyActive ? 'deactivated' : 'activated'}`, 'success');
      loadUsers();
    } catch (e: any) {
      onToast(e.message, 'error');
    }
  }

  async function handleResetMfa(user: UserRow) {
    try {
      await callAdminUsers('reset_mfa', { user_id: user.id });
      onToast(`2FA reset for ${user.display_name || user.email}. They will set it up again on next login.`, 'success');
      loadUsers();
    } catch (e: any) {
      onToast(e.message, 'error');
    }
  }

  async function handleDelete(user: UserRow) {
    try {
      await callAdminUsers('delete', { user_id: user.id });
      onToast(`${user.display_name || user.email} has been permanently deleted.`, 'success');
      loadUsers();
    } catch (e: any) {
      onToast(e.message, 'error');
    }
  }

  function executeConfirm() {
    if (!confirmAction) return;
    const { type, user } = confirmAction;
    setConfirmAction(null);
    if (type === 'toggle_admin') handleToggleAdmin(user);
    else if (type === 'toggle_active') handleToggleActive(user);
    else if (type === 'reset_mfa') handleResetMfa(user);
    else if (type === 'delete') handleDelete(user);
  }

  const menuUser = actionMenuId ? users.find(u => u.id === actionMenuId) : null;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-gray-400" />
          <span className="text-sm text-gray-500">{users.length} users</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search users..."
              className="pl-8 pr-8 py-2 w-56 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            <UserPlus className="w-4 h-4" />
            Invite User
          </button>
        </div>
      </div>

      {/* Loading / Error */}
      {loading && <div className="text-center py-12 text-sm text-gray-400">Loading users...</div>}
      {error && <div className="text-center py-12 text-sm text-red-600">{error}</div>}

      {/* Table */}
      {!loading && !error && (
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Display Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Access</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Role</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">2FA</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Last Sign-in</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(user => {
                const active = isActive(user);
                const isSelf = user.id === currentUserId;
                return (
                  <tr key={user.id} className={`hover:bg-gray-50 ${!active ? 'opacity-60' : ''}`}>
                    <td className="px-4 py-3 font-medium text-gray-900">{user.display_name || '-'}</td>
                    <td className="px-4 py-3 text-gray-600">{user.email}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${user.is_admin ? 'bg-purple-50 text-purple-700 border border-purple-200' : 'bg-gray-100 text-gray-600 border border-gray-200'}`}>
                        {user.is_admin ? 'Admin' : 'User'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {user.is_admin ? (
                        <span className="text-xs text-gray-400 italic">All permissions</span>
                      ) : roleName(user.role_id) ? (
                        <span className="text-sm text-gray-900">{roleName(user.role_id)}</span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-amber-50 text-amber-700 border border-amber-200">No role — Home only</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${active ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                        {active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${user.mfa_enrolled ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                        {user.mfa_enrolled ? 'Enrolled' : 'Not enrolled'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Never'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={(e) => openMenu(user.id, e.currentTarget)}
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="text-center py-8 text-sm text-gray-400">No users found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Portal-based dropdown menu */}
      {actionMenuId && menuPos && menuUser && (
        <div
          ref={menuRef}
          className="fixed w-52 bg-white border border-gray-200 rounded-lg shadow-lg z-[9999] py-1"
          style={{ top: menuPos.top, left: menuPos.left }}
        >
          <MenuButton
            icon={menuUser.is_admin ? <ShieldOff className="w-4 h-4 text-gray-400" /> : <Shield className="w-4 h-4 text-gray-400" />}
            label={menuUser.is_admin ? 'Remove Admin' : 'Make Admin'}
            disabled={menuUser.id === currentUserId}
            tooltip="You can't change your own role"
            onClick={() => { closeMenu(); setConfirmAction({ type: 'toggle_admin', user: menuUser }); }}
          />
          <MenuButton
            icon={isActive(menuUser) ? <Ban className="w-4 h-4 text-gray-400" /> : <CheckCircle className="w-4 h-4 text-gray-400" />}
            label={isActive(menuUser) ? 'Deactivate' : 'Activate'}
            disabled={menuUser.id === currentUserId}
            tooltip="You can't deactivate your own account"
            onClick={() => { closeMenu(); setConfirmAction({ type: 'toggle_active', user: menuUser }); }}
          />
          <MenuButton
            icon={<Shield className="w-4 h-4 text-gray-400" />}
            label="Change Role"
            onClick={() => { closeMenu(); setChangeRoleUser(menuUser); }}
          />
          <MenuButton
            icon={<KeyRound className="w-4 h-4 text-gray-400" />}
            label="Reset 2FA"
            onClick={() => { closeMenu(); setConfirmAction({ type: 'reset_mfa', user: menuUser }); }}
          />
          <div className="border-t border-gray-100 my-1" />
          <MenuButton
            icon={<Trash2 className="w-4 h-4 text-red-400" />}
            label="Delete User"
            disabled={menuUser.id === currentUserId}
            tooltip="You can't delete your own account"
            destructive
            onClick={() => { closeMenu(); setConfirmAction({ type: 'delete', user: menuUser }); }}
          />
        </div>
      )}

      {/* Invite Modal */}
      {showInvite && <InviteModal roles={roles} onClose={() => setShowInvite(false)} onSuccess={(email) => { onToast(`Invitation sent to ${email}`, 'success'); loadUsers(); }} />}

      {changeRoleUser && (
        <ChangeRoleModal
          user={changeRoleUser}
          roles={roles}
          onClose={() => setChangeRoleUser(null)}
          onSave={(roleId) => handleChangeRole(changeRoleUser, roleId)}
        />
      )}

      {/* Confirm Modal */}
      {confirmAction && (
        <ConfirmActionModal
          action={confirmAction}
          onConfirm={executeConfirm}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  );
}

function MenuButton({ icon, label, disabled, tooltip, destructive, onClick }: {
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
  tooltip?: string;
  destructive?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={disabled ? tooltip : undefined}
      className={`w-full flex items-center gap-2 px-4 py-2 text-sm text-left transition-colors ${
        disabled
          ? 'text-gray-300 cursor-not-allowed'
          : destructive
            ? 'text-red-600 hover:bg-red-50'
            : 'text-gray-700 hover:bg-gray-50'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function ChangeRoleModal({ user, roles, onClose, onSave }: { user: UserRow; roles: RoleOption[]; onClose: () => void; onSave: (roleId: string) => void }) {
  const [roleId, setRoleId] = useState(user.role_id || '');
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Change Role</h2>
        <p className="text-sm text-gray-500 mb-4">{user.display_name || user.email}</p>
        <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
        <select
          value={roleId}
          onChange={e => setRoleId(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select a role...</option>
          {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <p className="mt-2 text-xs text-gray-400">The change applies the next time the user loads the app.</p>
        <div className="flex justify-end gap-3 pt-5">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
          <button
            type="button"
            disabled={!roleId || roleId === (user.role_id || '')}
            onClick={() => onSave(roleId)}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function InviteModal({ roles, onClose, onSuccess }: { roles: RoleOption[]; onClose: () => void; onSuccess: (email: string) => void }) {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [roleId, setRoleId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) { setError('Enter a valid email'); return; }
    if (!displayName.trim()) { setError('Display name is required'); return; }
    if (!roleId) { setError('Role is required'); return; }

    setLoading(true);
    setError(null);
    try {
      await callAdminUsers('invite', { email: email.trim(), display_name: displayName.trim(), is_admin: isAdmin, role_id: roleId });
      onSuccess(email.trim());
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Invite User</h2>
        <p className="text-sm text-gray-500 mb-5">The user will receive an email with a link to set their own password.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="user@company.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="John Doe"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role <span className="text-red-600">*</span></label>
            <select
              value={roleId}
              onChange={e => setRoleId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a role...</option>
              {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isAdmin}
              onChange={e => setIsAdmin(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Administrator</span>
          </label>

          {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Sending...' : 'Send Invitation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ConfirmActionModal({ action, onConfirm, onCancel }: { action: { type: string; user: UserRow }; onConfirm: () => void; onCancel: () => void }) {
  const { type, user } = action;
  const name = user.display_name || user.email;

  let title = '';
  let description = '';
  let isDestructive = false;

  if (type === 'toggle_admin') {
    title = user.is_admin ? 'Remove Admin Role' : 'Grant Admin Role';
    description = user.is_admin
      ? `Remove admin privileges from ${name}? They will no longer be able to manage system settings or users.`
      : `Grant admin privileges to ${name}? They will be able to manage system settings and users.`;
  } else if (type === 'toggle_active') {
    const active = !user.banned_until || new Date(user.banned_until) < new Date();
    title = active ? 'Deactivate User' : 'Activate User';
    description = active
      ? `Deactivate ${name}? They will no longer be able to sign in.`
      : `Activate ${name}? They will be able to sign in again.`;
    isDestructive = active;
  } else if (type === 'reset_mfa') {
    title = 'Reset 2FA';
    description = `Reset 2FA for ${name}? They will need to set it up again on their next login.`;
  } else if (type === 'delete') {
    title = 'Delete User';
    description = `Delete ${name}? This permanently removes the user and cannot be undone.`;
    isDestructive = true;
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">{title}</h2>
        <p className="text-sm text-gray-600 mb-5">{description}</p>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-medium rounded-lg text-white transition-colors ${isDestructive ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
