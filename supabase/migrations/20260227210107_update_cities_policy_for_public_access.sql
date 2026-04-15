/*
  # Update Cities Table RLS Policy for Public Access
  
  ## Changes
  - Drop existing restrictive policy for authenticated users only
  - Add new policy allowing public (anon) read access to cities
  - Cities are lookup data and safe to be publicly readable
  
  ## Security
  - Read-only access for all users (authenticated and anonymous)
  - No write permissions granted
*/

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Anyone can read cities" ON cities;

-- Create new policy allowing public read access
CREATE POLICY "Public read access for cities"
  ON cities
  FOR SELECT
  TO anon, authenticated
  USING (true);