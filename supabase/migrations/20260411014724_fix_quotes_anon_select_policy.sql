/*
  # Fix Quotes Anon SELECT Policy

  1. Changes
    - Add anon SELECT policy on `quotes` so the app (which uses the anon key)
      can read all quotes, not just those with a review_token
    - The existing "Anon can read quotes by review_token" policy is kept for
      the customer portal, but a broader policy is needed for the main app

  2. Important Notes
    - No data is modified
    - The "Authenticated users can view all quotes" policy remains unchanged
*/

CREATE POLICY "Anon can read all quotes"
  ON public.quotes
  FOR SELECT
  TO anon
  USING (true);
