/*
  # Allow anon role to perform CRUD on accessorials

  1. Problem
    - The app has no authentication, so all requests run as the `anon` role
    - Existing INSERT/UPDATE/DELETE policies only allow `authenticated` role
    - This causes a 42501 RLS violation when creating or editing accessorials

  2. Changes
    - Add INSERT, UPDATE, and DELETE policies for the `anon` role on the accessorials table
    - SELECT is already public (anon can read)
*/

CREATE POLICY "Anon users can insert accessorials"
  ON accessorials FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anon users can update accessorials"
  ON accessorials FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anon users can delete accessorials"
  ON accessorials FOR DELETE
  TO anon
  USING (true);
