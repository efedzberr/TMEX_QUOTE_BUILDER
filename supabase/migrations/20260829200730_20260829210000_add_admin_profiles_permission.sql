/*
# Permission key for the new Admin → Profiles tab (admin.roles now refers to the hierarchy tab)
*/
INSERT INTO public.profile_permissions (profile_id, permission_key, can_view, can_create, can_edit, can_delete)
VALUES ('b0000000-0000-0000-0000-000000000001', 'admin.profiles', true, true, true, true)
ON CONFLICT (profile_id, permission_key) DO NOTHING;