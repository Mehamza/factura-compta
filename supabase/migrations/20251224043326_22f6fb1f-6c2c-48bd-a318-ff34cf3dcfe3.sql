-- Add optional columns to products table
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS initial_qty numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS unit text DEFAULT 'pièce',
ADD COLUMN IF NOT EXISTS purchase_price numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS sale_price numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS vat_rate numeric DEFAULT 19,
ADD COLUMN IF NOT EXISTS category text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS description text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS supplier_id uuid DEFAULT NULL;

-- Add foreign key for supplier
ALTER TABLE public.products
ADD CONSTRAINT products_supplier_id_fkey 
FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE SET NULL;