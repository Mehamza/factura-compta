-- Payments & Methods
create table if not exists public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  type text check (type in ('cash','card','bank_transfer','check','other')),
  created_at timestamptz default now()
);

alter table public.payment_methods enable row level security;
create policy pm_select on public.payment_methods for select using (user_id = auth.uid());
create policy pm_insert on public.payment_methods for insert with check (user_id = auth.uid());
create policy pm_update on public.payment_methods for update using (user_id = auth.uid());

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  client_id uuid references public.clients(id) on delete set null,
  invoice_id uuid references public.invoices(id) on delete set null,
  method_id uuid references public.payment_methods(id) on delete set null,
  amount numeric(12,2) not null,
  currency text default 'TND',
  paid_at date not null,
  reference text,
  notes text,
  created_by_user_id uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.payments enable row level security;
create policy pay_select on public.payments for select using (user_id = auth.uid());
create policy pay_insert on public.payments for insert with check (user_id = auth.uid());
create policy pay_update on public.payments for update using (user_id = auth.uid());

create index if not exists idx_payments_user on public.payments(user_id);
create index if not exists idx_payments_invoice on public.payments(invoice_id);
create index if not exists idx_payments_client on public.payments(client_id);
create index if not exists idx_payments_paid_at on public.payments(paid_at);

-- Helper function: invoice balance
create or replace function public.invoice_outstanding(p_invoice_id uuid)
returns numeric language sql as $$
  select (i.total - coalesce((select sum(p.amount) from public.payments p where p.invoice_id = i.id), 0))
  from public.invoices i where i.id = p_invoice_id;
$$;

-- Trigger to update invoice status on payment changes
create or replace function public.refresh_invoice_status()
returns trigger language plpgsql as $$
begin
  update public.invoices i
  set status = case
    when public.invoice_outstanding(i.id) <= 0 then 'paid'
    when i.due_date < now()::date then 'overdue'
    else i.status
  end
  where i.id = coalesce(new.invoice_id, old.invoice_id);
  return null;
end;$$;

create trigger trg_invoice_status_after_payment
after insert or update or delete on public.payments
for each row execute function public.refresh_invoice_status();

-- Journal (basic)
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  code text not null,
  name text not null,
  type text check (type in ('asset','liability','equity','income','expense')),
  is_active boolean default true,
  created_at timestamptz default now(),
  unique(user_id, code)
);

alter table public.accounts enable row level security;
create policy acc_select on public.accounts for select using (user_id = auth.uid());
create policy acc_insert on public.accounts for insert with check (user_id = auth.uid());
create policy acc_update on public.accounts for update using (user_id = auth.uid());

create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  entry_date date not null,
  reference text,
  description text,
  created_by_user_id uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.journal_entries enable row level security;
create policy je_select on public.journal_entries for select using (user_id = auth.uid());
create policy je_insert on public.journal_entries for insert with check (user_id = auth.uid());
create policy je_update on public.journal_entries for update using (user_id = auth.uid());

create index if not exists idx_journal_entries_user_date on public.journal_entries(user_id, entry_date);

create table if not exists public.journal_lines (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid references public.journal_entries(id) on delete cascade,
  account_id uuid references public.accounts(id),
  invoice_id uuid references public.invoices(id) on delete set null,
  payment_id uuid references public.payments(id) on delete set null,
  debit numeric(12,2) default 0 check (debit >= 0),
  credit numeric(12,2) default 0 check (credit >= 0)
);

create index if not exists idx_journal_lines_account on public.journal_lines(account_id);

-- Enforce balanced entry via trigger
create or replace function public.ensure_balanced_entry()
returns trigger language plpgsql as $$
declare s_debit numeric; s_credit numeric; begin
  select coalesce(sum(debit),0), coalesce(sum(credit),0)
  into s_debit, s_credit from public.journal_lines where entry_id = coalesce(new.entry_id, old.entry_id);
  if s_debit <> s_credit then
    raise exception 'Journal entry not balanced: debit % credit %', s_debit, s_credit;
  end if;
  return null;
end;$$;

create trigger trg_ensure_balanced
after insert or update or delete on public.journal_lines
for each row execute function public.ensure_balanced_entry();

-- Audit logs
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  action text check (action in ('insert','update','delete')),
  table_name text,
  record_id uuid,
  changes jsonb,
  created_at timestamptz default now()
);

alter table public.audit_logs enable row level security;
create policy audit_select on public.audit_logs for select using (user_id = auth.uid());

-- Simple audit trigger for invoices
create or replace function public.audit_invoices()
returns trigger language plpgsql as $$
begin
  insert into public.audit_logs(user_id, action, table_name, record_id, changes)
  values (auth.uid(), tg_op::text, 'invoices', coalesce(new.id, old.id),
          case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end);
  return null;
end;$$;

create trigger trg_audit_invoices
after insert or update or delete on public.invoices
for each row execute function public.audit_invoices();
