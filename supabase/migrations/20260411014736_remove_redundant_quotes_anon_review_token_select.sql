/*
  # Remove Redundant Quotes Anon Review Token SELECT Policy

  1. Changes
    - Drop "Anon can read quotes by review_token" SELECT policy since the broader
      "Anon can read all quotes" policy already covers all rows for anon

  2. Important Notes
    - No data is modified
    - This eliminates the duplicate permissive SELECT policy warning for anon on quotes
*/

DROP POLICY IF EXISTS "Anon can read quotes by review_token" ON public.quotes;
