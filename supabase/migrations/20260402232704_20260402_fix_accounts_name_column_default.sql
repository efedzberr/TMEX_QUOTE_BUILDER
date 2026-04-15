/*
  # Fix accounts name column default value

  1. Changes
    - Add default value `''` to the `name` column on `accounts` table
    - This column is NOT NULL with no default, causing inserts to fail silently
      when the application code doesn't explicitly set it

  2. Notes
    - Existing rows already have `name` populated (equal to `account_name`)
    - This prevents insert failures when `name` is not provided
*/

ALTER TABLE accounts ALTER COLUMN name SET DEFAULT '';
