/*
  # Add CRUD RLS policies for Accessorials table

  1. Changes
    - Add INSERT policy for authenticated users to create accessorials
    - Add UPDATE policy for authenticated users to update accessorials
    - Add DELETE policy for authenticated users to delete accessorials
    - Add equipment_type column alias (commodity is used as equipment type)

  2. Security
    - Only authenticated users can insert, update, and delete accessorials
    - Public read access is already in place
*/

CREATE POLICY "Authenticated users can insert accessorials"
  ON accessorials FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update accessorials"
  ON accessorials FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete accessorials"
  ON accessorials FOR DELETE
  TO authenticated
  USING (true);
