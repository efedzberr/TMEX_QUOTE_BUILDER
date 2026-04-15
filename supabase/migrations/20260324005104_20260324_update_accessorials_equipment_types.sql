/*
  # Update Accessorials Equipment Types

  1. Changes
    - Updates the `commodity` field on existing accessorials to use equipment type values
    - Maps: General → Dry Van, Loading → Dry Van, Documentation → Dry Van
    - Maps: Hazmat → Flat Bed, Special Handling → Flat Bed
    - Maps: Temperature Control → Refer

  2. Notes
    - This realigns the commodity field to match equipment types as requested
    - Existing records get assigned to the closest matching equipment type
*/

UPDATE accessorials SET commodity = 'Dry Van' WHERE commodity IN ('General', 'Loading', 'Documentation');
UPDATE accessorials SET commodity = 'Flat Bed' WHERE commodity IN ('Hazmat', 'Special Handling');
UPDATE accessorials SET commodity = 'Refer' WHERE commodity = 'Temperature Control';
