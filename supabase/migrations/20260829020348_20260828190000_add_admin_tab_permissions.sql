/*
# Add one permission per Admin tab to the "Full Access" system role

Adds the 8 Admin tab keys that were not in the initial catalog so existing
users keep every tab.

1. Modified Tables
   - `role_permissions` — inserts 8 new rows for the Full Access role

2. New permission keys added
   - admin.partner_accounts
   - admin.bill_to
   - admin.shippers
   - admin.cities
   - admin.global_variables
   - admin.border_crossings
   - admin.accessorials
   - admin.terms_conditions

3. Security
   - No RLS or policy changes.
   - ON CONFLICT DO NOTHING makes this idempotent.
*/
INSERT INTO public.role_permissions (role_id, permission_key, can_view, can_edit, can_delete)
SELECT 'b0000000-0000-0000-0000-000000000001', k, true, true, true
FROM unnest(ARRAY[
  'admin.partner_accounts', 'admin.bill_to', 'admin.shippers', 'admin.cities',
  'admin.global_variables', 'admin.border_crossings', 'admin.accessorials', 'admin.terms_conditions'
]) AS k
ON CONFLICT (role_id, permission_key) DO NOTHING;