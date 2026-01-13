-- Comptes (caisse / banque), dépenses, et alignement paiements ↔ statut de paiement facture
-- Objectif: implémenter une gestion simple et cohérente sans casser le plan comptable existant.

begin;

-- 1) Étendre la table accounts pour supporter les "comptes" (caisse/banque)
-- NOTE: on conserve accounts.type (plan comptable) et on ajoute account_kind pour discriminer.
alter table public.accounts
  add column if not exists account_kind text,
  add column if not exists currency text not null default 'TND',
  add column if not exists bank text,
  add column if not exists agency text,
  add column if not exists iban text;

-- 2) Étendre payments pour supporter vente/achat + lien au compte (caisse/banque)
alter table public.payments
  add column if not exists payment_type text, -- 'vente' | 'achat'
  add column if not exists supplier_id uuid references public.suppliers(id) on delete set null,
  add column if not exists account_id uuid references public.accounts(id) on delete set null,
  add column if not exists payment_method text,
  add column if not exists payment_date date,
  add column if not exists attachment_document_id uuid references public.documents(id) on delete set null;

-- Backfill: if legacy columns exist, try to keep payment_date in sync with paid_at
update public.payments
set payment_date = coalesce(payment_date, paid_at)
where payment_date is null and paid_at is not null;

-- 3) Ajouter les champs requis sur invoices: total_paid, remaining_amount, payment_status
alter table public.invoices
  add column if not exists total_paid numeric(12,2) not null default 0,
  add column if not exists remaining_amount numeric(12,2) not null default 0,
  add column if not exists payment_status text not null default 'unpaid';

-- Constraint légère sur payment_status
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'invoices_payment_status_check') then
    alter table public.invoices
      add constraint invoices_payment_status_check
      check (payment_status in ('unpaid','partial','paid','overdue'));
  end if;
exception when others then
  -- Si un ancien schéma a déjà une contrainte incompatible, on n'échoue pas la migration.
  null;
end $$;

-- 4) Fonction: recalculer les champs de paiement d'une facture
create or replace function public.recompute_invoice_payment_fields(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total numeric(12,2);
  v_due_date date;
  v_lifecycle_status text;
  v_paid numeric(12,2);
  v_remaining numeric(12,2);
  v_payment_status text;
begin
  select total, due_date, status
    into v_total, v_due_date, v_lifecycle_status
  from public.invoices
  where id = p_invoice_id;

  if not found then
    return;
  end if;

  -- Ne pas recalculer le paiement pour un brouillon/annulé (garde cohérence UX)
  if v_lifecycle_status in ('draft', 'cancelled') then
    update public.invoices
    set total_paid = 0,
        remaining_amount = v_total,
        payment_status = 'unpaid'
    where id = p_invoice_id;
    return;
  end if;

  -- Somme des paiements
  select coalesce(sum(coalesce(net_amount, amount)), 0)
    into v_paid
  from public.payments
  where invoice_id = p_invoice_id;

  v_remaining := greatest(round((v_total - v_paid)::numeric, 2), 0);

  if v_paid <= 0 then
    v_payment_status := 'unpaid';
  elsif v_remaining <= 0 then
    v_payment_status := 'paid';
  else
    if v_due_date is not null and v_due_date < current_date then
      v_payment_status := 'overdue';
    else
      v_payment_status := 'partial';
    end if;
  end if;

  update public.invoices
  set total_paid = round(v_paid::numeric, 2),
      remaining_amount = v_remaining,
      payment_status = v_payment_status
  where id = p_invoice_id;
end;
$$;

-- 5) Trigger: recalculer après insert/update/delete sur payments
create or replace function public.trg_payments_recompute_invoice_payment_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.invoice_id is not null then
      perform public.recompute_invoice_payment_fields(old.invoice_id);
    end if;
    return old;
  end if;

  if new.invoice_id is not null then
    perform public.recompute_invoice_payment_fields(new.invoice_id);
  end if;
  if tg_op = 'UPDATE' and old.invoice_id is distinct from new.invoice_id and old.invoice_id is not null then
    perform public.recompute_invoice_payment_fields(old.invoice_id);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_payments_update_invoice_status on public.payments;
drop trigger if exists trg_invoice_status_after_payment on public.payments;
create trigger trg_payments_recompute_invoice_payment_fields
after insert or update or delete on public.payments
for each row execute function public.trg_payments_recompute_invoice_payment_fields();

-- 6) Dépenses
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete restrict,
  amount numeric(12,2) not null,
  currency text not null default 'TND',
  expense_date date not null default current_date,
  category text,
  description text,
  payment_method text,
  reference text,
  attachment_document_id uuid references public.documents(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_expenses_company_date on public.expenses(company_id, expense_date desc);
create index if not exists idx_expenses_account on public.expenses(account_id);

-- Trigger updated_at pour expenses
drop trigger if exists update_expenses_updated_at on public.expenses;
create trigger update_expenses_updated_at
before update on public.expenses
for each row execute function public.update_updated_at_column();

-- 7) RLS: dépenses (sur le modèle user_company_roles)
alter table public.expenses enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='expenses' and policyname='expenses_super_admin_all') then
    create policy expenses_super_admin_all on public.expenses for all
      using (public.has_global_role('SUPER_ADMIN', auth.uid()))
      with check (public.has_global_role('SUPER_ADMIN', auth.uid()));
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='expenses' and policyname='expenses_company_members_all') then
    create policy expenses_company_members_all on public.expenses for all
      using (
        public.has_global_role('SUPER_ADMIN', auth.uid())
        or exists (select 1 from public.user_company_roles ucr where ucr.user_id = auth.uid() and ucr.company_id = expenses.company_id)
      )
      with check (
        public.has_global_role('SUPER_ADMIN', auth.uid())
        or exists (select 1 from public.user_company_roles ucr where ucr.user_id = auth.uid() and ucr.company_id = expenses.company_id)
      );
  end if;
end $$;

commit;
