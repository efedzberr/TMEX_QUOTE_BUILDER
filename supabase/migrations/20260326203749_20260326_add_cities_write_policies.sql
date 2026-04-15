/*
  # Add write policies for cities table

  ## Problem
  The cities table only had a SELECT policy. INSERT, UPDATE, and DELETE
  operations were silently blocked by RLS, so edits made in the
  Administration > Cities tab (including the Border Crossing City toggle)
  were never persisted to the database.

  ## Changes
  - Add INSERT policy allowing anon users to add cities
  - Add UPDATE policy allowing anon users to update cities (including is_border_crossing_city)
  - Add DELETE policy allowing anon users to delete cities
*/

CREATE POLICY "Allow anon insert cities"
  ON cities
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anon update cities"
  ON cities
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon delete cities"
  ON cities
  FOR DELETE
  TO anon
  USING (true);
