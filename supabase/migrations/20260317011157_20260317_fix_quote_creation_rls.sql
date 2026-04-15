/*
  # Fix Quote Creation RLS Policy
  
  The quotes table had RLS policies that only allowed authenticated users to create quotes,
  but the application uses the Supabase anon key. This migration updates the policy to
  allow public (unauthenticated) users to create quotes.
  
  Changes:
  - Modify the "Authenticated users can create quotes" policy to also allow public role
  - This enables the Create New Quote button to work with the anon key
*/

DROP POLICY IF EXISTS "Authenticated users can create quotes" ON quotes;

CREATE POLICY "Users can create quotes"
  ON quotes
  FOR INSERT
  TO public, authenticated
  WITH CHECK (true);
