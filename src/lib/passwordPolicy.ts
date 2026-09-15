import { supabase } from './supabase';

export type Complexity = 'none' | 'alpha_numeric' | 'alpha_numeric_special' | 'upper_lower_numeric' | 'upper_lower_numeric_special';

export interface PasswordPolicy {
  expiration_days: number | null;
  history_count: number;
  min_length: number;
  complexity: Complexity;
  max_login_attempts: number | null;
  lockout_minutes: number | null;
  disallow_username: boolean;
}

export const DEFAULT_POLICY: PasswordPolicy = {
  expiration_days: 90, history_count: 3, min_length: 8, complexity: 'alpha_numeric',
  max_login_attempts: 10, lockout_minutes: 15, disallow_username: true,
};

export const COMPLEXITY_LABELS: Record<Complexity, string> = {
  none: 'No restriction',
  alpha_numeric: 'Must include alpha and numeric characters',
  alpha_numeric_special: 'Must include alpha, numeric, and special characters',
  upper_lower_numeric: 'Must include numbers and uppercase and lowercase letters',
  upper_lower_numeric_special: 'Must include numbers, uppercase and lowercase letters, and special characters',
};

export async function fetchPasswordPolicy(): Promise<PasswordPolicy> {
  const { data, error } = await supabase.rpc('get_password_policy');
  if (error || !data) return DEFAULT_POLICY;
  return { ...DEFAULT_POLICY, ...(data as Partial<PasswordPolicy>) };
}

export interface PasswordRule { id: string; label: string; ok: boolean }

const SPECIAL = /[^A-Za-z0-9]/;

/** Evaluates a candidate password against the policy. Same logic as the Edge Function. */
export function evaluatePassword(password: string, policy: PasswordPolicy, email?: string | null): PasswordRule[] {
  const rules: PasswordRule[] = [];
  rules.push({ id: 'length', label: `At least ${policy.min_length} characters`, ok: password.length >= policy.min_length });

  const hasAlpha = /[A-Za-z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasSpecial = SPECIAL.test(password);

  switch (policy.complexity) {
    case 'alpha_numeric':
      rules.push({ id: 'alpha', label: 'Contains a letter', ok: hasAlpha });
      rules.push({ id: 'digit', label: 'Contains a number', ok: hasDigit });
      break;
    case 'alpha_numeric_special':
      rules.push({ id: 'alpha', label: 'Contains a letter', ok: hasAlpha });
      rules.push({ id: 'digit', label: 'Contains a number', ok: hasDigit });
      rules.push({ id: 'special', label: 'Contains a special character (e.g. ! @ # $ %)', ok: hasSpecial });
      break;
    case 'upper_lower_numeric':
      rules.push({ id: 'upper', label: 'Contains an uppercase letter', ok: hasUpper });
      rules.push({ id: 'lower', label: 'Contains a lowercase letter', ok: hasLower });
      rules.push({ id: 'digit', label: 'Contains a number', ok: hasDigit });
      break;
    case 'upper_lower_numeric_special':
      rules.push({ id: 'upper', label: 'Contains an uppercase letter', ok: hasUpper });
      rules.push({ id: 'lower', label: 'Contains a lowercase letter', ok: hasLower });
      rules.push({ id: 'digit', label: 'Contains a number', ok: hasDigit });
      rules.push({ id: 'special', label: 'Contains a special character (e.g. ! @ # $ %)', ok: hasSpecial });
      break;
    default:
      break;
  }

  if (policy.disallow_username && email) {
    const local = email.split('@')[0].toLowerCase();
    const ok = local.length < 3 || !password.toLowerCase().includes(local);
    rules.push({ id: 'username', label: 'Does not contain your username', ok });
  }
  return rules;
}

export function passwordMeetsPolicy(password: string, policy: PasswordPolicy, email?: string | null): boolean {
  return evaluatePassword(password, policy, email).every(r => r.ok);
}

export interface ChangePasswordResult { ok: boolean; error?: string; failed_rules?: string[] }

/**
 * Sets a new password through the change-password Edge Function (the only path that enforces
 * the policy and the password history). Requires a Supabase session (any AAL).
 */
export async function changePassword(newPassword: string, currentPassword?: string): Promise<ChangePasswordResult> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { ok: false, error: 'No session' };
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/change-password`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ new_password: newPassword, current_password: currentPassword ?? null }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: data.message || data.error || `Error ${res.status}`, failed_rules: data.failed_rules };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Network error' };
  }
}
