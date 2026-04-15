/*
  # Update Quotes Public RLS for Delete and Update

  The quotes table has separate policies for authenticated vs public roles.
  The application uses the anon key (public role), which can create but not
  update or delete. This migration fixes that by allowing public to update/delete.

  Changes:
  - Drop authenticated-only delete policy on quotes
  - Drop authenticated-only update policy on quotes
  - Add public role to delete policy
  - Add public role to update policy
*/

DROP POLICY IF EXISTS "Authenticated users can delete quotes" ON quotes;
DROP POLICY IF EXISTS "Authenticated users can update quotes" ON quotes;

CREATE POLICY "Users can delete quotes"
  ON quotes FOR DELETE
  TO public, authenticated
  USING (true);

CREATE POLICY "Users can update quotes"
  ON quotes FOR UPDATE
  TO public, authenticated
  USING (true)
  WITH CHECK (true);
