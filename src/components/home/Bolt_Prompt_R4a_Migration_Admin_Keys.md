Create ONE new Supabase migration file and apply it. Do NOT modify any file under `src/`. Do NOT touch any other migration.

File: `supabase/migrations/20260828190000_add_admin_tab_permissions.sql`

Use exactly this SQL:

```sql
/*
# Add one permission per Admin tab to the "Full Access" system role
Adds the 8 Admin tab keys that were not in the initial catalog so existing users keep every tab.
*/
INSERT INTO public.role_permissions (role_id, permission_key, can_view, can_edit, can_delete)
SELECT 'b0000000-0000-0000-0000-000000000001', k, true, true, true
FROM unnest(ARRAY[
  'admin.partner_accounts', 'admin.bill_to', 'admin.shippers', 'admin.cities',
  'admin.global_variables', 'admin.border_crossings', 'admin.accessorials', 'admin.terms_conditions'
]) AS k
ON CONFLICT (role_id, permission_key) DO NOTHING;
```

After applying, confirm the migration ran without errors. Do not generate any TypeScript or additional migrations.
