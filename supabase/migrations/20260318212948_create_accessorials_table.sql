/*
  # Create Accessorials Lookup Table

  1. New Tables
    - `accessorials` - Lookup table for available accessorials/charges
      - `id` (uuid, primary key)
      - `commodity` (text) - Commodity type (Mercancía)
      - `name_en` (text) - English name
      - `name_es` (text) - Spanish name
      - `default_rate` (numeric) - Default rate in USD
      - `unit_type` (text) - FLAT or RPM
      - `notes` (text) - Additional notes
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `accessorials` table
    - Add public SELECT policy for reading accessorials (read-only lookup table)

  3. Data
    - Populate with 39 accessorial entries from the reference list
*/

CREATE TABLE IF NOT EXISTS accessorials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commodity text,
  name_en text NOT NULL,
  name_es text NOT NULL,
  default_rate numeric DEFAULT 0,
  unit_type text DEFAULT 'FLAT',
  notes text,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE accessorials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access to accessorials"
  ON accessorials FOR SELECT
  TO public
  USING (true);

INSERT INTO accessorials (commodity, name_en, name_es, default_rate, unit_type, notes) VALUES
('General', 'Pallet Exchange', 'Intercambio de Paleta', 0, 'FLAT', 'No predefined rate'),
('General', 'Dock Fee', 'Cuota de Muelle', 75, 'FLAT', NULL),
('General', 'Fuel Surcharge', 'Recargo de Combustible', 0, 'RPM', 'Per mile charge'),
('General', 'Extra Stop Charge', 'Cargo por Parada Adicional', 50, 'FLAT', NULL),
('General', 'Wait Time Charge', 'Cargo por Tiempo de Espera', 0.50, 'RPM', 'Per 15-minute increment'),
('General', 'Hazmat Fee', 'Cuota de Material Peligroso', 150, 'FLAT', NULL),
('General', 'Lumper Fee', 'Cuota de Cargador Manual', 100, 'FLAT', NULL),
('General', 'Limited Delivery', 'Entrega Limitada', 0, 'FLAT', 'No predefined rate'),
('General', 'Residential Delivery', 'Entrega Residencial', 50, 'FLAT', NULL),
('General', 'Inside Delivery', 'Entrega al Interior', 75, 'FLAT', NULL),
('General', 'Lift Gate Service', 'Servicio de Plataforma Elevadora', 85, 'FLAT', NULL),
('General', 'Detention Charge', 'Cargo de Demora', 0.75, 'RPM', 'Per hour or part thereof'),
('General', 'Appointment Delivery', 'Entrega por Cita', 25, 'FLAT', NULL),
('General', 'Address Correction', 'Corrección de Dirección', 35, 'FLAT', NULL),
('General', 'Customs Brokerage', 'Agenciamiento Aduanal', 0, 'FLAT', 'No predefined rate'),
('General', 'Insurance', 'Seguro', 0, 'FLAT', 'Based on value'),
('General', 'Reweigh Charge', 'Cargo de Repesaje', 40, 'FLAT', NULL),
('General', 'Paperwork Processing', 'Procesamiento de Documentos', 50, 'FLAT', NULL),
('Hazmat', 'Hazmat Documentation', 'Documentación de Material Peligroso', 125, 'FLAT', NULL),
('Hazmat', 'Overweight Surcharge', 'Recargo por Peso Excesivo', 100, 'FLAT', NULL),
('Hazmat', 'Out of Gauge', 'Fuera de Calibre', 150, 'FLAT', NULL),
('Hazmat', 'MSDS Management', 'Gestión de MSDS', 75, 'FLAT', NULL),
('Hazmat', 'Hazmat Endorsement', 'Endoso de Material Peligroso', 0, 'FLAT', 'No predefined rate'),
('Temperature Control', 'Temperature Control Charge', 'Cargo de Control de Temperatura', 200, 'FLAT', NULL),
('Temperature Control', 'Reefer Truck Charge', 'Cargo de Camión Refrigerado', 250, 'FLAT', NULL),
('Temperature Control', 'Insulated Container', 'Contenedor Aislado', 0, 'FLAT', 'No predefined rate'),
('Loading', 'Hand Load Charge', 'Cargo de Carga Manual', 125, 'FLAT', NULL),
('Loading', 'Forklift Service', 'Servicio de Montacargas', 85, 'FLAT', NULL),
('Loading', 'Pallet Jack Service', 'Servicio de Carrito Manual', 50, 'FLAT', NULL),
('Loading', 'Stacking Service', 'Servicio de Apilamiento', 75, 'FLAT', NULL),
('Documentation', 'Bill of Lading Fee', 'Cuota de Conocimiento de Embarque', 30, 'FLAT', NULL),
('Documentation', 'Proof of Delivery', 'Comprobante de Entrega', 15, 'FLAT', NULL),
('Documentation', 'Export Declaration', 'Declaración de Exportación', 100, 'FLAT', NULL),
('Documentation', 'Import Entry Fee', 'Cuota de Entrada de Importación', 120, 'FLAT', NULL),
('Special Handling', 'Fragile Goods Handling', 'Manejo de Mercancía Frágil', 100, 'FLAT', NULL),
('Special Handling', 'Value Declared', 'Valor Declarado', 0, 'FLAT', 'No predefined rate'),
('Special Handling', 'Signature Required', 'Firma Requerida', 25, 'FLAT', NULL),
('Special Handling', 'Call Before Delivery', 'Llamar Antes de Entregar', 20, 'FLAT', NULL),
('Special Handling', 'Palletization Service', 'Servicio de Paletización', 60, 'FLAT', NULL);
