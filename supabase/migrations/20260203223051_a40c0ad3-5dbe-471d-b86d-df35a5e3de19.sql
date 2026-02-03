-- Add delivery information fields to invoices table for Bon de Livraison documents
-- These fields capture the logistics and transport details for delivery notes

-- Delivery address (if different from client address)
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS delivery_address TEXT;

-- Delivery contact person
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS delivery_contact TEXT;

-- Delivery contact phone
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS delivery_phone TEXT;

-- Transport method (vehicule propre, transporteur, etc.)
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS transport_method TEXT;

-- Driver/transporter name
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS driver_name TEXT;

-- Vehicle information (license plate, truck number, etc.)
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS vehicle_info TEXT;

-- Delivery date/time (when delivery is scheduled or completed)
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS delivery_date TIMESTAMP WITH TIME ZONE;

-- Number of packages/colis
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS package_count INTEGER;

-- Total weight (in kg)
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS total_weight NUMERIC;

-- Delivery notes/instructions
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS delivery_notes TEXT;

-- Add comment to document the purpose
COMMENT ON COLUMN public.invoices.delivery_address IS 'Delivery address for bon de livraison (if different from client address)';
COMMENT ON COLUMN public.invoices.delivery_contact IS 'Delivery contact person name';
COMMENT ON COLUMN public.invoices.delivery_phone IS 'Delivery contact phone number';
COMMENT ON COLUMN public.invoices.transport_method IS 'Transport method (ex: vehicule propre, transporteur externe)';
COMMENT ON COLUMN public.invoices.driver_name IS 'Driver or transporter name';
COMMENT ON COLUMN public.invoices.vehicle_info IS 'Vehicle information (license plate, truck number)';
COMMENT ON COLUMN public.invoices.delivery_date IS 'Scheduled or actual delivery date/time';
COMMENT ON COLUMN public.invoices.package_count IS 'Number of packages/colis';
COMMENT ON COLUMN public.invoices.total_weight IS 'Total weight in kilograms';
COMMENT ON COLUMN public.invoices.delivery_notes IS 'Special delivery instructions or notes';