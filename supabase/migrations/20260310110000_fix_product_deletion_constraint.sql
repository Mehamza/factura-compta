-- Allow deletion of products by changing stock_document_items constraint
-- from ON DELETE RESTRICT to ON DELETE SET NULL

-- First, make product_id nullable
alter table public.stock_document_items
  alter column product_id drop not null;

-- Drop the old constraint
alter table public.stock_document_items
  drop constraint stock_document_items_product_id_fkey;

-- Add the new constraint with ON DELETE SET NULL
alter table public.stock_document_items
  add constraint stock_document_items_product_id_fkey
  foreign key (product_id) references public.products(id) on delete set null;
