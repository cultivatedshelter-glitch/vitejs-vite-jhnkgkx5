/*
  # Add Portfolio Images and Property Address Fields

  ## Changes Made
  1. Added Fields to Contractors Table
    - `portfolio_images` (text array) - URLs of portfolio images showcasing contractor work
    - `email` (text) - Contractor contact email

  2. Added Fields to Leads Table
    - `property_address` (text) - Full street address of the property for the project

  ## Notes
  - Portfolio images stored as array of URLs
  - Email field allows agents to contact contractors directly
  - Property address provides full context for the lead location
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contractors' AND column_name = 'portfolio_images'
  ) THEN
    ALTER TABLE contractors ADD COLUMN portfolio_images text[] DEFAULT '{}';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contractors' AND column_name = 'email'
  ) THEN
    ALTER TABLE contractors ADD COLUMN email text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'property_address'
  ) THEN
    ALTER TABLE leads ADD COLUMN property_address text;
  END IF;
END $$;