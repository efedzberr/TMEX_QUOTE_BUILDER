# Project memory

## Product intent & audience

- Web app with authentication, session management, and admin security tooling (e.g., Security Log panel).
- Backend via Supabase (RPC calls like `end_session`).
- UI surfaces Spanish-language strings for end users; admin/log labels are English.
- Security model: server-verified sessions, inactivity timeouts, shared multi-tab sessions, daily midnight sign-out.

## Brand personality & voice

- Authoritative global UI/design instructions live in `.bolt/prompt` (not restated here).
- End-user-facing copy is in Spanish (e.g., "Tu sesión expiró por inactividad.").
- Admin/technical labels in English (e.g., "Signed out", "Daily sign-out").

## Visual design & UX direction

- Tailwind CSS with Lucide React icons; no extra UI packages.
- Modals: `fixed inset-0 z-[100] bg-black/50`, centered white card `rounded-lg shadow-xl max-w-md p-6`.
- Primary buttons: `bg-blue-600 hover:bg-blue-700 text-white`; secondary: bordered gray.
- Warning icon chips: `rounded-full bg-amber-50` with `text-amber-600` icon; banners use `border-amber-200 bg-amber-50 text-amber-800`.
- Countdown text uses `tabular-nums` for stable numeric width.
- Dialogs are `role="dialog" aria-modal="true"`; primary action uses `autoFocus`.

## Decisions, constraints & rationale

- Session ID storage moved from `sessionStorage` to `localStorage` (`sph.session_id`) to share one session across tabs; stale IDs are removed on no-auth and fresh login.
- `sph.logout_reason` moved to localStorage so all tabs see the reason; cleared when next session starts.
- `sph.login_id` remains in sessionStorage.
- `SessionGuard` warns before inactivity timeout and before midnight; cross-tab extension clears warnings.
- Logout reasons supported: `timeout`, `midnight`, `expired`, `unverified`, `logout`, `admin`; SecurityLogPanel labels `midnight` as "Daily sign-out".
- Edits are applied exactly as provided; unrelated bugs are reported, not silently fixed.

## Open questions & assumptions

- Known bug (not yet fixed): password-reset screen renders "ñ" as "\u00f1" in the "Nueva contraseña" label and two error messages.
- Midnight sign-out UI gated behind a later step ("S7"); current code may not yet fully activate it.
- App abbreviates as "sph" (storage prefix); full product name unconfirmed.