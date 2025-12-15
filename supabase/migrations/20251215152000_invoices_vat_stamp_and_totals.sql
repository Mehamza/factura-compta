-- Add VAT and stamp fields to invoices and enforce valid values

alter table if exists public.invoices
  add column if not exists tax_rate numeric default 19 not null,
  add column if not exists stamp_included boolean default false not null,
  add column if not exists stamp_amount numeric default 1 not null;

-- Ensure non-negative amounts
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'invoices_stamp_non_negative') then
    alter table public.invoices add constraint invoices_stamp_non_negative check (stamp_amount >= 0);
  end if;
end $$;

-- Restrict VAT rates to Tunisian standard set
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'invoices_tax_rate_tn_set') then
    alter table public.invoices add constraint invoices_tax_rate_tn_set check (tax_rate in (0,7,13,19));
  end if;
end $$;

-- Trigger to recompute invoice totals whenever invoice_items change
create or replace function public.recompute_invoice_totals(p_invoice_id uuid)
returns void as $$
declare
  v_subtotal numeric := 0;
  v_tax_rate numeric := 0;
  v_tax_amount numeric := 0;
  v_stamp_included boolean := false;
  v_stamp_amount numeric := 0;
begin
  select coalesce(sum(total),0) into v_subtotal from public.invoice_items where invoice_id = p_invoice_id;
  select tax_rate, stamp_included, stamp_amount into v_tax_rate, v_stamp_included, v_stamp_amount from public.invoices where id = p_invoice_id;
  v_tax_amount := v_subtotal * (coalesce(v_tax_rate,0) / 100.0);
  update public.invoices
    set subtotal = v_subtotal,
        tax_amount = v_tax_amount,
        total = v_subtotal + v_tax_amount + case when v_stamp_included then coalesce(v_stamp_amount,0) else 0 end
    where id = p_invoice_id;
end; $$ language plpgsql security definer;

drop trigger if exists trg_invoice_items_recompute_totals on public.invoice_items;
create trigger trg_invoice_items_recompute_totals
after insert or update or delete on public.invoice_items
for each row execute procedure public.recompute_invoice_totals(
  case when tg_op = 'DELETE' then old.invoice_id else new.invoice_id end
);

-- Also recompute when invoices' tax_rate, stamp fields change
drop trigger if exists trg_invoices_recompute_on_change on public.invoices;
create trigger trg_invoices_recompute_on_change
after update of tax_rate, stamp_included, stamp_amount on public.invoices
for each row execute procedure public.recompute_invoice_totals(new.id);
