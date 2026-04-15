/*
  # Create PDF Configurations and Templates Tables

  1. New Tables
    - `pdf_configurations`
      - `id` (uuid, primary key)
      - `quote_id` (uuid, references quotes, unique)
      - `view_type` (text, 'condensed' or 'full', default 'condensed')
      - `orientation` (text, 'portrait' or 'landscape', default 'portrait')
      - `language` (text, 'en' or 'es', default 'en')
      - `currency_mode` (text, 'default' or specific currency, default 'default')
      - `units_mode` (text, 'default', 'miles', or 'kilometers', default 'default')
      - `header_left` (jsonb, array of header field configs)
      - `header_middle` (jsonb, array of header field configs)
      - `header_right` (jsonb, array of header field configs)
      - `condensed_columns` (jsonb, array of column configs)
      - `full_view_sections` (jsonb, section visibility and field configs)
      - `full_view_colors` (jsonb, section color mode selections)
      - `footer_sections` (jsonb, ordered footer section configs)
      - `footer_accessorials` (jsonb, toggle states for individual accessorials)
      - `footer_terms` (jsonb, toggle states for individual terms)
      - `footer_acceptance` (jsonb, acceptance section config)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `pdf_config_templates`
      - `id` (uuid, primary key)
      - `name` (text, template name)
      - `is_system` (boolean, true for protected system templates)
      - `config_data` (jsonb, full configuration snapshot)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Allow anon read/write for pdf_configurations (matches existing app pattern)
    - Allow anon read for system templates, read/write for user templates
*/

CREATE TABLE IF NOT EXISTS pdf_configurations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  view_type text NOT NULL DEFAULT 'condensed',
  orientation text NOT NULL DEFAULT 'portrait',
  language text NOT NULL DEFAULT 'en',
  currency_mode text NOT NULL DEFAULT 'default',
  units_mode text NOT NULL DEFAULT 'default',
  header_left jsonb NOT NULL DEFAULT '[]'::jsonb,
  header_middle jsonb NOT NULL DEFAULT '[]'::jsonb,
  header_right jsonb NOT NULL DEFAULT '[]'::jsonb,
  condensed_columns jsonb NOT NULL DEFAULT '[]'::jsonb,
  full_view_sections jsonb NOT NULL DEFAULT '{}'::jsonb,
  full_view_colors jsonb NOT NULL DEFAULT '{}'::jsonb,
  footer_sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  footer_accessorials jsonb NOT NULL DEFAULT '{}'::jsonb,
  footer_terms jsonb NOT NULL DEFAULT '{}'::jsonb,
  footer_acceptance jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_quote_pdf_config UNIQUE (quote_id)
);

ALTER TABLE pdf_configurations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon select pdf_configurations"
  ON pdf_configurations FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anon insert pdf_configurations"
  ON pdf_configurations FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anon update pdf_configurations"
  ON pdf_configurations FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon delete pdf_configurations"
  ON pdf_configurations FOR DELETE
  TO anon
  USING (true);

CREATE TABLE IF NOT EXISTS pdf_config_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  is_system boolean NOT NULL DEFAULT false,
  config_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pdf_config_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon select pdf_config_templates"
  ON pdf_config_templates FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anon insert non-system pdf_config_templates"
  ON pdf_config_templates FOR INSERT
  TO anon
  WITH CHECK (is_system = false);

CREATE POLICY "Allow anon update non-system pdf_config_templates"
  ON pdf_config_templates FOR UPDATE
  TO anon
  USING (is_system = false)
  WITH CHECK (is_system = false);

CREATE POLICY "Allow anon delete non-system pdf_config_templates"
  ON pdf_config_templates FOR DELETE
  TO anon
  USING (is_system = false);

INSERT INTO pdf_config_templates (name, is_system, config_data) VALUES
('Default Condensed', true, '{"view_type":"condensed","orientation":"portrait","language":"en","currency_mode":"default","units_mode":"default"}'::jsonb),
('Default Full View', true, '{"view_type":"full","orientation":"portrait","language":"en","currency_mode":"default","units_mode":"default"}'::jsonb)
ON CONFLICT DO NOTHING;
