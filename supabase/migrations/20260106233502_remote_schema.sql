drop extension if exists "pg_net";

drop policy "ugr_super_admin_manage" on "public"."user_global_roles";

alter table "public"."audit_logs" drop constraint "audit_logs_action_check";


  create table "public"."company_status_logs" (
    "id" uuid not null default gen_random_uuid(),
    "company_id" uuid not null,
    "action" text not null,
    "reason" text,
    "disabled_until" timestamp with time zone,
    "performed_by" uuid not null,
    "performed_at" timestamp with time zone not null default now(),
    "metadata" jsonb
      );


alter table "public"."company_status_logs" enable row level security;

alter table "public"."companies" add column "bank_accounts" jsonb default '[]'::jsonb;

alter table "public"."companies" add column "disabled_at" timestamp with time zone;

alter table "public"."companies" add column "disabled_by" uuid;

alter table "public"."companies" add column "disabled_reason" text;

alter table "public"."companies" add column "disabled_until" timestamp with time zone;

alter table "public"."companies" add column "is_configured" boolean default false;

alter table "public"."companies" add column "legal_name" text;

alter table "public"."companies" add column "matricule_fiscale" text;

CREATE UNIQUE INDEX company_status_logs_pkey ON public.company_status_logs USING btree (id);

CREATE UNIQUE INDEX company_users_user_company_unique ON public.company_users USING btree (user_id, company_id);

CREATE INDEX idx_companies_disabled_until ON public.companies USING btree (disabled_until) WHERE (disabled_until IS NOT NULL);

CREATE INDEX idx_company_status_logs_company_id ON public.company_status_logs USING btree (company_id);

CREATE UNIQUE INDEX profiles_user_id_unique ON public.profiles USING btree (user_id);

CREATE UNIQUE INDEX user_roles_user_id_unique ON public.user_roles USING btree (user_id);

alter table "public"."company_status_logs" add constraint "company_status_logs_pkey" PRIMARY KEY using index "company_status_logs_pkey";

alter table "public"."company_status_logs" add constraint "company_status_logs_company_id_fkey" FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE not valid;

alter table "public"."company_status_logs" validate constraint "company_status_logs_company_id_fkey";

alter table "public"."company_users" add constraint "company_users_user_company_unique" UNIQUE using index "company_users_user_company_unique";

alter table "public"."profiles" add constraint "profiles_user_id_unique" UNIQUE using index "profiles_user_id_unique";

alter table "public"."user_roles" add constraint "user_roles_user_id_unique" UNIQUE using index "user_roles_user_id_unique";

alter table "public"."audit_logs" add constraint "audit_logs_action_check" CHECK ((action = ANY (ARRAY['create'::text, 'update'::text, 'delete'::text, 'print'::text, 'email'::text, 'export'::text, 'creation'::text]))) not valid;

alter table "public"."audit_logs" validate constraint "audit_logs_action_check";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.auto_reactivate_companies()
 RETURNS TABLE(company_id uuid, company_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT id, name 
    FROM public.companies 
    WHERE active = false 
      AND disabled_until IS NOT NULL 
      AND disabled_until <= now()
  LOOP
    -- Reactivate the company
    UPDATE public.companies 
    SET 
      active = true, 
      disabled_until = NULL,
      disabled_reason = NULL,
      disabled_at = NULL,
      disabled_by = NULL
    WHERE id = r.id;
    
    -- Log the auto-reactivation (use a system UUID for automated actions)
    INSERT INTO public.company_status_logs (
      company_id, 
      action, 
      reason, 
      performed_by,
      metadata
    ) VALUES (
      r.id, 
      'auto_reactivate', 
      'Réactivation automatique après expiration de la période de désactivation',
      '00000000-0000-0000-0000-000000000000'::uuid, -- System user
      jsonb_build_object('automated', true)
    );
    
    company_id := r.id;
    company_name := r.name;
    RETURN NEXT;
  END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_company_disabled(p_company_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$
  SELECT 
    NOT active 
    OR (disabled_until IS NOT NULL AND disabled_until > now())
  FROM public.companies 
  WHERE id = p_company_id
$function$
;

CREATE OR REPLACE FUNCTION public.is_super_admin_direct(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_global_roles 
    WHERE user_id = _user_id AND role = 'SUPER_ADMIN'
  )
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_company_id uuid;
  user_name text;
  is_employee boolean;
  invited_company_id uuid;
  desired_role public.app_role;
  company_role_value public.company_role;
BEGIN
  is_employee := COALESCE((NEW.raw_user_meta_data->>'is_employee')::boolean, false);
  invited_company_id := NULLIF(NEW.raw_user_meta_data->>'company_id', '')::uuid;
  desired_role := COALESCE(NULLIF(NEW.raw_user_meta_data->>'role','')::public.app_role, 'cashier'::public.app_role);

  -- Map app_role to company_role
  company_role_value := CASE desired_role::text
    WHEN 'admin' THEN 'company_admin'::public.company_role
    WHEN 'manager' THEN 'gerant'::public.company_role
    WHEN 'accountant' THEN 'comptable'::public.company_role
    WHEN 'cashier' THEN 'caissier'::public.company_role
    ELSE 'caissier'::public.company_role
  END;

  -- Always: upsert profile
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.email)
  ON CONFLICT (user_id) DO UPDATE
    SET email = excluded.email,
        full_name = COALESCE(excluded.full_name, public.profiles.full_name);

  IF is_employee THEN
    -- Employee path: no company creation
    IF invited_company_id IS NOT NULL THEN
      INSERT INTO public.company_users (user_id, company_id, role)
      VALUES (NEW.id, invited_company_id, company_role_value)
      ON CONFLICT (user_id, company_id) DO NOTHING;
    END IF;

    -- Set app role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, desired_role)
    ON CONFLICT (user_id) DO UPDATE SET role = excluded.role;

    RETURN NEW;
  END IF;

  -- Owner path: create company
  user_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'company_name', 'Entreprise');

  INSERT INTO public.companies (name)
  VALUES (user_name)
  RETURNING id INTO new_company_id;

  INSERT INTO public.company_users (user_id, company_id, role)
  VALUES (NEW.id, new_company_id, 'company_admin')
  ON CONFLICT (user_id, company_id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'admin'::public.app_role)
  ON CONFLICT (user_id) DO UPDATE SET role = excluded.role;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.recompute_invoice_totals(p_invoice_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_subtotal numeric := 0;
  v_tax_amount numeric := 0;
  v_fodec_amount numeric := 0;
  v_stamp_included boolean := false;
  v_stamp_amount numeric := 0;
BEGIN
  -- Sum HT totals from items
  SELECT COALESCE(SUM(total), 0) INTO v_subtotal 
  FROM public.invoice_items WHERE invoice_id = p_invoice_id;
  
  -- Sum VAT amounts from items (per-item VAT)
  SELECT COALESCE(SUM(vat_amount), 0) INTO v_tax_amount 
  FROM public.invoice_items WHERE invoice_id = p_invoice_id;
  
  -- Sum FODEC amounts from items
  SELECT COALESCE(SUM(fodec_amount), 0) INTO v_fodec_amount 
  FROM public.invoice_items WHERE invoice_id = p_invoice_id;
  
  -- Get stamp info
  SELECT stamp_included, stamp_amount INTO v_stamp_included, v_stamp_amount 
  FROM public.invoices WHERE id = p_invoice_id;
  
  -- Update invoice with calculated totals
  UPDATE public.invoices
  SET subtotal = v_subtotal,
      tax_amount = v_tax_amount,
      fodec_amount = v_fodec_amount,
      total = v_subtotal + v_fodec_amount + v_tax_amount + CASE WHEN v_stamp_included THEN COALESCE(v_stamp_amount, 0) ELSE 0 END
  WHERE id = p_invoice_id;
END;
$function$
;

grant delete on table "public"."company_status_logs" to "anon";

grant insert on table "public"."company_status_logs" to "anon";

grant references on table "public"."company_status_logs" to "anon";

grant select on table "public"."company_status_logs" to "anon";

grant trigger on table "public"."company_status_logs" to "anon";

grant truncate on table "public"."company_status_logs" to "anon";

grant update on table "public"."company_status_logs" to "anon";

grant delete on table "public"."company_status_logs" to "authenticated";

grant insert on table "public"."company_status_logs" to "authenticated";

grant references on table "public"."company_status_logs" to "authenticated";

grant select on table "public"."company_status_logs" to "authenticated";

grant trigger on table "public"."company_status_logs" to "authenticated";

grant truncate on table "public"."company_status_logs" to "authenticated";

grant update on table "public"."company_status_logs" to "authenticated";

grant delete on table "public"."company_status_logs" to "service_role";

grant insert on table "public"."company_status_logs" to "service_role";

grant references on table "public"."company_status_logs" to "service_role";

grant select on table "public"."company_status_logs" to "service_role";

grant trigger on table "public"."company_status_logs" to "service_role";

grant truncate on table "public"."company_status_logs" to "service_role";

grant update on table "public"."company_status_logs" to "service_role";


  create policy "audit_logs_insert_by_self"
  on "public"."audit_logs"
  as permissive
  for insert
  to authenticated
with check ((user_id = auth.uid()));



  create policy "audit_logs_select_by_self"
  on "public"."audit_logs"
  as permissive
  for select
  to authenticated
using ((user_id = auth.uid()));



  create policy "Super admins can manage company status logs"
  on "public"."company_status_logs"
  as permissive
  for all
  to authenticated
using (public.is_super_admin_direct(auth.uid()))
with check (public.is_super_admin_direct(auth.uid()));



  create policy "ugr_super_admin_manage"
  on "public"."user_global_roles"
  as permissive
  for all
  to authenticated
using (public.is_super_admin_direct(auth.uid()))
with check (public.is_super_admin_direct(auth.uid()));



