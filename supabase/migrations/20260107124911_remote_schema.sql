drop trigger if exists "update_accounts_updated_at" on "public"."accounts";

drop trigger if exists "update_clients_updated_at" on "public"."clients";

drop trigger if exists "update_companies_updated_at" on "public"."companies";

drop trigger if exists "update_company_plans_updated_at" on "public"."company_plans";

drop trigger if exists "update_documents_updated_at" on "public"."documents";

drop trigger if exists "trg_invoice_items_recompute_totals" on "public"."invoice_items";

drop trigger if exists "trg_audit_invoices" on "public"."invoices";

drop trigger if exists "trg_invoices_recompute_on_change" on "public"."invoices";

drop trigger if exists "update_invoices_updated_at" on "public"."invoices";

drop trigger if exists "trg_ensure_balanced" on "public"."journal_lines";

drop trigger if exists "trg_invoice_status_after_payment" on "public"."payments";

drop trigger if exists "update_payments_updated_at" on "public"."payments";

drop trigger if exists "update_plan_features_updated_at" on "public"."plan_features";

drop trigger if exists "update_plans_updated_at" on "public"."plans";

drop trigger if exists "update_products_updated_at" on "public"."products";

drop trigger if exists "update_profiles_updated_at" on "public"."profiles";

drop trigger if exists "update_suppliers_updated_at" on "public"."suppliers";

drop policy "clients_company_members_read" on "public"."clients";

drop policy "clients_super_admin_all" on "public"."clients";

drop policy "Company admins can update their companies" on "public"."companies";

drop policy "Super admins can delete companies" on "public"."companies";

drop policy "Users can view their companies" on "public"."companies";

drop policy "companies_members_read" on "public"."companies";

drop policy "companies_super_admin_all" on "public"."companies";

drop policy "Admins manage company plans" on "public"."company_plans";

drop policy "company_plans_company_members_read" on "public"."company_plans";

drop policy "company_plans_super_admin_all" on "public"."company_plans";

drop policy "Super admins can manage company status logs" on "public"."company_status_logs";

drop policy "Company admins can add members" on "public"."company_users";

drop policy "Company admins can remove members" on "public"."company_users";

drop policy "Company admins can update member roles" on "public"."company_users";

drop policy "Company admins can view company memberships" on "public"."company_users";

drop policy "Users can view own memberships" on "public"."company_users";

drop policy "Super admins can insert impersonation logs" on "public"."impersonation_logs";

drop policy "Super admins can view impersonation logs" on "public"."impersonation_logs";

drop policy "Users can create invoice items" on "public"."invoice_items";

drop policy "Users can delete invoice items" on "public"."invoice_items";

drop policy "Users can update invoice items" on "public"."invoice_items";

drop policy "Users can view invoice items" on "public"."invoice_items";

drop policy "invoice_items_company_members_read" on "public"."invoice_items";

drop policy "invoice_items_super_admin_all" on "public"."invoice_items";

drop policy "Users can update their own invoices" on "public"."invoices";

drop policy "invoices_company_members_read" on "public"."invoices";

drop policy "invoices_super_admin_all" on "public"."invoices";

drop policy "Users can create journal lines" on "public"."journal_lines";

drop policy "Users can delete journal lines" on "public"."journal_lines";

drop policy "Users can update journal lines" on "public"."journal_lines";

drop policy "Users can view journal lines" on "public"."journal_lines";

drop policy "pay_insert" on "public"."payments";

drop policy "Admins manage features" on "public"."plan_features";

drop policy "Admins manage plans" on "public"."plans";

drop policy "products_company_members_read" on "public"."products";

drop policy "products_super_admin_all" on "public"."products";

drop policy "Super admins can view all profiles" on "public"."profiles";

drop policy "profiles_delete" on "public"."profiles";

drop policy "profiles_manage" on "public"."profiles";

drop policy "profiles_update" on "public"."profiles";

drop policy "suppliers_company_members_read" on "public"."suppliers";

drop policy "suppliers_super_admin_all" on "public"."suppliers";

drop policy "ucr_company_admin_delete" on "public"."user_company_roles";

drop policy "ucr_company_admin_manage" on "public"."user_company_roles";

drop policy "ucr_company_admin_update" on "public"."user_company_roles";

drop policy "ucr_super_admin_all" on "public"."user_company_roles";

drop policy "ugr_super_admin_manage" on "public"."user_global_roles";

drop policy "Admins can manage own roles" on "public"."user_roles";

drop policy "Admins can manage team roles" on "public"."user_roles";

drop policy "Admins can view team roles" on "public"."user_roles";

drop policy "user_roles_delete" on "public"."user_roles";

drop policy "user_roles_insert" on "public"."user_roles";

drop policy "user_roles_update" on "public"."user_roles";

alter table "public"."accounts" drop constraint "accounts_company_id_fkey";

alter table "public"."clients" drop constraint "clients_company_fk";

alter table "public"."company_plans" drop constraint "company_plans_company_fk";

alter table "public"."company_plans" drop constraint "company_plans_plan_fk";

alter table "public"."company_plans" drop constraint "company_plans_plan_id_fkey";

alter table "public"."company_status_logs" drop constraint "company_status_logs_company_id_fkey";

alter table "public"."company_users" drop constraint "company_users_company_id_fkey";

alter table "public"."documents" drop constraint "documents_client_id_fkey";

alter table "public"."documents" drop constraint "documents_company_id_fkey";

alter table "public"."documents" drop constraint "documents_invoice_id_fkey";

alter table "public"."documents" drop constraint "documents_supplier_id_fkey";

alter table "public"."invoice_items" drop constraint "invoice_items_company_fk";

alter table "public"."invoice_items" drop constraint "invoice_items_invoice_id_fkey";

alter table "public"."invoices" drop constraint "invoices_client_id_fkey";

alter table "public"."invoices" drop constraint "invoices_company_fk";

alter table "public"."invoices" drop constraint "invoices_supplier_id_fkey";

alter table "public"."journal_entries" drop constraint "journal_entries_company_id_fkey";

alter table "public"."journal_lines" drop constraint "journal_lines_account_id_fkey";

alter table "public"."journal_lines" drop constraint "journal_lines_entry_id_fkey";

alter table "public"."journal_lines" drop constraint "journal_lines_invoice_id_fkey";

alter table "public"."journal_lines" drop constraint "journal_lines_payment_id_fkey";

alter table "public"."payments" drop constraint "payments_client_id_fkey";

alter table "public"."payments" drop constraint "payments_company_id_fkey";

alter table "public"."payments" drop constraint "payments_invoice_id_fkey";

alter table "public"."payments" drop constraint "payments_method_id_fkey";

alter table "public"."plan_features" drop constraint "plan_features_plan_id_fkey";

alter table "public"."products" drop constraint "products_company_fk";

alter table "public"."products" drop constraint "products_supplier_id_fkey";

alter table "public"."stock_movements" drop constraint "stock_movements_company_id_fkey";

alter table "public"."stock_movements" drop constraint "stock_movements_product_id_fkey";

alter table "public"."suppliers" drop constraint "suppliers_company_fk";

alter table "public"."user_company_roles" drop constraint "user_company_roles_company_id_fkey";

drop function if exists "public"."has_company_role"(_user_id uuid, _company_id uuid, _role company_role);

drop function if exists "public"."has_role"(_user_id uuid, _role app_role);

alter table "public"."company_users" alter column "role" set default 'company_admin'::public.company_role;

alter table "public"."company_users" alter column "role" set data type public.company_role using "role"::text::public.company_role;

alter table "public"."user_roles" alter column "role" set default 'cashier'::public.app_role;

alter table "public"."user_roles" alter column "role" set data type public.app_role using "role"::text::public.app_role;

alter table "public"."accounts" add constraint "accounts_company_id_fkey" FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE not valid;

alter table "public"."accounts" validate constraint "accounts_company_id_fkey";

alter table "public"."clients" add constraint "clients_company_fk" FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE RESTRICT not valid;

alter table "public"."clients" validate constraint "clients_company_fk";

alter table "public"."company_plans" add constraint "company_plans_company_fk" FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE not valid;

alter table "public"."company_plans" validate constraint "company_plans_company_fk";

alter table "public"."company_plans" add constraint "company_plans_plan_fk" FOREIGN KEY (plan_id) REFERENCES public.plans(id) ON DELETE RESTRICT not valid;

alter table "public"."company_plans" validate constraint "company_plans_plan_fk";

alter table "public"."company_plans" add constraint "company_plans_plan_id_fkey" FOREIGN KEY (plan_id) REFERENCES public.plans(id) ON DELETE RESTRICT not valid;

alter table "public"."company_plans" validate constraint "company_plans_plan_id_fkey";

alter table "public"."company_status_logs" add constraint "company_status_logs_company_id_fkey" FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE not valid;

alter table "public"."company_status_logs" validate constraint "company_status_logs_company_id_fkey";

alter table "public"."company_users" add constraint "company_users_company_id_fkey" FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE not valid;

alter table "public"."company_users" validate constraint "company_users_company_id_fkey";

alter table "public"."documents" add constraint "documents_client_id_fkey" FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL not valid;

alter table "public"."documents" validate constraint "documents_client_id_fkey";

alter table "public"."documents" add constraint "documents_company_id_fkey" FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE not valid;

alter table "public"."documents" validate constraint "documents_company_id_fkey";

alter table "public"."documents" add constraint "documents_invoice_id_fkey" FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE SET NULL not valid;

alter table "public"."documents" validate constraint "documents_invoice_id_fkey";

alter table "public"."documents" add constraint "documents_supplier_id_fkey" FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE SET NULL not valid;

alter table "public"."documents" validate constraint "documents_supplier_id_fkey";

alter table "public"."invoice_items" add constraint "invoice_items_company_fk" FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE RESTRICT not valid;

alter table "public"."invoice_items" validate constraint "invoice_items_company_fk";

alter table "public"."invoice_items" add constraint "invoice_items_invoice_id_fkey" FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE not valid;

alter table "public"."invoice_items" validate constraint "invoice_items_invoice_id_fkey";

alter table "public"."invoices" add constraint "invoices_client_id_fkey" FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL not valid;

alter table "public"."invoices" validate constraint "invoices_client_id_fkey";

alter table "public"."invoices" add constraint "invoices_company_fk" FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE RESTRICT not valid;

alter table "public"."invoices" validate constraint "invoices_company_fk";

alter table "public"."invoices" add constraint "invoices_supplier_id_fkey" FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE SET NULL not valid;

alter table "public"."invoices" validate constraint "invoices_supplier_id_fkey";

alter table "public"."journal_entries" add constraint "journal_entries_company_id_fkey" FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE not valid;

alter table "public"."journal_entries" validate constraint "journal_entries_company_id_fkey";

alter table "public"."journal_lines" add constraint "journal_lines_account_id_fkey" FOREIGN KEY (account_id) REFERENCES public.accounts(id) not valid;

alter table "public"."journal_lines" validate constraint "journal_lines_account_id_fkey";

alter table "public"."journal_lines" add constraint "journal_lines_entry_id_fkey" FOREIGN KEY (entry_id) REFERENCES public.journal_entries(id) ON DELETE CASCADE not valid;

alter table "public"."journal_lines" validate constraint "journal_lines_entry_id_fkey";

alter table "public"."journal_lines" add constraint "journal_lines_invoice_id_fkey" FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE SET NULL not valid;

alter table "public"."journal_lines" validate constraint "journal_lines_invoice_id_fkey";

alter table "public"."journal_lines" add constraint "journal_lines_payment_id_fkey" FOREIGN KEY (payment_id) REFERENCES public.payments(id) ON DELETE SET NULL not valid;

alter table "public"."journal_lines" validate constraint "journal_lines_payment_id_fkey";

alter table "public"."payments" add constraint "payments_client_id_fkey" FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL not valid;

alter table "public"."payments" validate constraint "payments_client_id_fkey";

alter table "public"."payments" add constraint "payments_company_id_fkey" FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE not valid;

alter table "public"."payments" validate constraint "payments_company_id_fkey";

alter table "public"."payments" add constraint "payments_invoice_id_fkey" FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE SET NULL not valid;

alter table "public"."payments" validate constraint "payments_invoice_id_fkey";

alter table "public"."payments" add constraint "payments_method_id_fkey" FOREIGN KEY (method_id) REFERENCES public.payment_methods(id) ON DELETE SET NULL not valid;

alter table "public"."payments" validate constraint "payments_method_id_fkey";

alter table "public"."plan_features" add constraint "plan_features_plan_id_fkey" FOREIGN KEY (plan_id) REFERENCES public.plans(id) ON DELETE CASCADE not valid;

alter table "public"."plan_features" validate constraint "plan_features_plan_id_fkey";

alter table "public"."products" add constraint "products_company_fk" FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE RESTRICT not valid;

alter table "public"."products" validate constraint "products_company_fk";

alter table "public"."products" add constraint "products_supplier_id_fkey" FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE SET NULL not valid;

alter table "public"."products" validate constraint "products_supplier_id_fkey";

alter table "public"."stock_movements" add constraint "stock_movements_company_id_fkey" FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE not valid;

alter table "public"."stock_movements" validate constraint "stock_movements_company_id_fkey";

alter table "public"."stock_movements" add constraint "stock_movements_product_id_fkey" FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE not valid;

alter table "public"."stock_movements" validate constraint "stock_movements_product_id_fkey";

alter table "public"."suppliers" add constraint "suppliers_company_fk" FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE RESTRICT not valid;

alter table "public"."suppliers" validate constraint "suppliers_company_fk";

alter table "public"."user_company_roles" add constraint "user_company_roles_company_id_fkey" FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE not valid;

alter table "public"."user_company_roles" validate constraint "user_company_roles_company_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.has_company_role(_user_id uuid, _company_id uuid, _role public.company_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.company_users 
    WHERE user_id = _user_id 
      AND company_id = _company_id 
      AND role = _role
  )
$function$
;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$function$
;

CREATE OR REPLACE FUNCTION public.get_company_role(_user_id uuid, _company_id uuid)
 RETURNS public.company_role
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT role FROM public.company_users 
  WHERE user_id = _user_id AND company_id = _company_id
  LIMIT 1
$function$
;

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
 RETURNS public.app_role
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$function$
;


  create policy "clients_company_members_read"
  on "public"."clients"
  as permissive
  for select
  to public
using ((public.has_global_role('SUPER_ADMIN'::text, auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.user_company_roles ucr
  WHERE ((ucr.user_id = auth.uid()) AND (ucr.company_id = clients.company_id))))));



  create policy "clients_super_admin_all"
  on "public"."clients"
  as permissive
  for all
  to public
using (public.has_global_role('SUPER_ADMIN'::text, auth.uid()))
with check (public.has_global_role('SUPER_ADMIN'::text, auth.uid()));



  create policy "Company admins can update their companies"
  on "public"."companies"
  as permissive
  for update
  to public
using ((public.is_company_admin(auth.uid(), id) OR public.is_super_admin(auth.uid())));



  create policy "Super admins can delete companies"
  on "public"."companies"
  as permissive
  for delete
  to public
using (public.is_super_admin(auth.uid()));



  create policy "Users can view their companies"
  on "public"."companies"
  as permissive
  for select
  to public
using ((public.user_in_company(auth.uid(), id) OR public.is_super_admin(auth.uid())));



  create policy "companies_members_read"
  on "public"."companies"
  as permissive
  for select
  to public
using ((public.has_global_role('SUPER_ADMIN'::text, auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.user_company_roles ucr
  WHERE ((ucr.user_id = auth.uid()) AND (ucr.company_id = companies.id))))));



  create policy "companies_super_admin_all"
  on "public"."companies"
  as permissive
  for all
  to public
using (public.has_global_role('SUPER_ADMIN'::text, auth.uid()))
with check (public.has_global_role('SUPER_ADMIN'::text, auth.uid()));



  create policy "Admins manage company plans"
  on "public"."company_plans"
  as permissive
  for all
  to public
using (public.has_role(auth.uid(), 'admin'::public.app_role));



  create policy "company_plans_company_members_read"
  on "public"."company_plans"
  as permissive
  for select
  to public
using ((public.has_global_role('SUPER_ADMIN'::text, auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.user_company_roles ucr
  WHERE ((ucr.user_id = auth.uid()) AND (ucr.company_id = company_plans.company_id))))));



  create policy "company_plans_super_admin_all"
  on "public"."company_plans"
  as permissive
  for all
  to public
using (public.has_global_role('SUPER_ADMIN'::text, auth.uid()))
with check (public.has_global_role('SUPER_ADMIN'::text, auth.uid()));



  create policy "Super admins can manage company status logs"
  on "public"."company_status_logs"
  as permissive
  for all
  to authenticated
using (public.is_super_admin_direct(auth.uid()))
with check (public.is_super_admin_direct(auth.uid()));



  create policy "Company admins can add members"
  on "public"."company_users"
  as permissive
  for insert
  to public
with check ((public.is_company_admin(auth.uid(), company_id) OR (auth.uid() = user_id)));



  create policy "Company admins can remove members"
  on "public"."company_users"
  as permissive
  for delete
  to public
using ((public.is_company_admin(auth.uid(), company_id) OR public.is_super_admin(auth.uid())));



  create policy "Company admins can update member roles"
  on "public"."company_users"
  as permissive
  for update
  to public
using ((public.is_company_admin(auth.uid(), company_id) OR public.is_super_admin(auth.uid())));



  create policy "Company admins can view company memberships"
  on "public"."company_users"
  as permissive
  for select
  to public
using (public.is_company_admin(auth.uid(), company_id));



  create policy "Users can view own memberships"
  on "public"."company_users"
  as permissive
  for select
  to public
using (((user_id = auth.uid()) OR public.is_super_admin(auth.uid())));



  create policy "Super admins can insert impersonation logs"
  on "public"."impersonation_logs"
  as permissive
  for insert
  to public
with check (public.has_global_role('SUPER_ADMIN'::text, auth.uid()));



  create policy "Super admins can view impersonation logs"
  on "public"."impersonation_logs"
  as permissive
  for select
  to public
using (public.has_global_role('SUPER_ADMIN'::text, auth.uid()));



  create policy "Users can create invoice items"
  on "public"."invoice_items"
  as permissive
  for insert
  to public
with check ((EXISTS ( SELECT 1
   FROM public.invoices
  WHERE ((invoices.id = invoice_items.invoice_id) AND ((invoices.user_id = auth.uid()) OR public.user_in_company(auth.uid(), invoices.company_id))))));



  create policy "Users can delete invoice items"
  on "public"."invoice_items"
  as permissive
  for delete
  to public
using ((EXISTS ( SELECT 1
   FROM public.invoices
  WHERE ((invoices.id = invoice_items.invoice_id) AND ((invoices.user_id = auth.uid()) OR public.user_in_company(auth.uid(), invoices.company_id) OR public.is_super_admin(auth.uid()))))));



  create policy "Users can update invoice items"
  on "public"."invoice_items"
  as permissive
  for update
  to public
using ((EXISTS ( SELECT 1
   FROM public.invoices
  WHERE ((invoices.id = invoice_items.invoice_id) AND ((invoices.user_id = auth.uid()) OR public.user_in_company(auth.uid(), invoices.company_id) OR public.is_super_admin(auth.uid()))))));



  create policy "Users can view invoice items"
  on "public"."invoice_items"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.invoices
  WHERE ((invoices.id = invoice_items.invoice_id) AND ((invoices.user_id = auth.uid()) OR public.user_in_company(auth.uid(), invoices.company_id) OR public.is_super_admin(auth.uid()))))));



  create policy "invoice_items_company_members_read"
  on "public"."invoice_items"
  as permissive
  for select
  to public
using ((public.has_global_role('SUPER_ADMIN'::text, auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.user_company_roles ucr
  WHERE ((ucr.user_id = auth.uid()) AND (ucr.company_id = invoice_items.company_id))))));



  create policy "invoice_items_super_admin_all"
  on "public"."invoice_items"
  as permissive
  for all
  to public
using (public.has_global_role('SUPER_ADMIN'::text, auth.uid()))
with check (public.has_global_role('SUPER_ADMIN'::text, auth.uid()));



  create policy "Users can update their own invoices"
  on "public"."invoices"
  as permissive
  for update
  to public
using ((((status <> 'purchase_quote'::text) AND (user_id = auth.uid())) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'accountant'::public.app_role)));



  create policy "invoices_company_members_read"
  on "public"."invoices"
  as permissive
  for select
  to public
using ((public.has_global_role('SUPER_ADMIN'::text, auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.user_company_roles ucr
  WHERE ((ucr.user_id = auth.uid()) AND (ucr.company_id = invoices.company_id))))));



  create policy "invoices_super_admin_all"
  on "public"."invoices"
  as permissive
  for all
  to public
using (public.has_global_role('SUPER_ADMIN'::text, auth.uid()))
with check (public.has_global_role('SUPER_ADMIN'::text, auth.uid()));



  create policy "Users can create journal lines"
  on "public"."journal_lines"
  as permissive
  for insert
  to public
with check (((EXISTS ( SELECT 1
   FROM public.journal_entries je
  WHERE ((je.id = journal_lines.entry_id) AND (je.user_id = auth.uid())))) AND ((invoice_id IS NULL) OR (EXISTS ( SELECT 1
   FROM public.invoices i
  WHERE ((i.id = journal_lines.invoice_id) AND (i.status <> 'purchase_quote'::text)))))));



  create policy "Users can delete journal lines"
  on "public"."journal_lines"
  as permissive
  for delete
  to public
using ((EXISTS ( SELECT 1
   FROM public.journal_entries
  WHERE ((journal_entries.id = journal_lines.entry_id) AND (journal_entries.user_id = auth.uid())))));



  create policy "Users can update journal lines"
  on "public"."journal_lines"
  as permissive
  for update
  to public
using ((EXISTS ( SELECT 1
   FROM public.journal_entries
  WHERE ((journal_entries.id = journal_lines.entry_id) AND (journal_entries.user_id = auth.uid())))));



  create policy "Users can view journal lines"
  on "public"."journal_lines"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.journal_entries
  WHERE ((journal_entries.id = journal_lines.entry_id) AND (journal_entries.user_id = auth.uid())))));



  create policy "pay_insert"
  on "public"."payments"
  as permissive
  for insert
  to public
with check (((user_id = auth.uid()) AND ((invoice_id IS NULL) OR (EXISTS ( SELECT 1
   FROM public.invoices i
  WHERE ((i.id = payments.invoice_id) AND (i.status <> 'purchase_quote'::text)))))));



  create policy "Admins manage features"
  on "public"."plan_features"
  as permissive
  for all
  to public
using (public.has_role(auth.uid(), 'admin'::public.app_role));



  create policy "Admins manage plans"
  on "public"."plans"
  as permissive
  for all
  to public
using (public.has_role(auth.uid(), 'admin'::public.app_role));



  create policy "products_company_members_read"
  on "public"."products"
  as permissive
  for select
  to public
using ((public.has_global_role('SUPER_ADMIN'::text, auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.user_company_roles ucr
  WHERE ((ucr.user_id = auth.uid()) AND (ucr.company_id = products.company_id))))));



  create policy "products_super_admin_all"
  on "public"."products"
  as permissive
  for all
  to public
using (public.has_global_role('SUPER_ADMIN'::text, auth.uid()))
with check (public.has_global_role('SUPER_ADMIN'::text, auth.uid()));



  create policy "Super admins can view all profiles"
  on "public"."profiles"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.user_global_roles
  WHERE ((user_global_roles.user_id = auth.uid()) AND (user_global_roles.role = 'SUPER_ADMIN'::text)))));



  create policy "profiles_delete"
  on "public"."profiles"
  as permissive
  for delete
  to public
using (public.has_role(auth.uid(), 'admin'::public.app_role));



  create policy "profiles_manage"
  on "public"."profiles"
  as permissive
  for insert
  to public
with check ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role)));



  create policy "profiles_update"
  on "public"."profiles"
  as permissive
  for update
  to public
using ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role)))
with check ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role)));



  create policy "suppliers_company_members_read"
  on "public"."suppliers"
  as permissive
  for select
  to public
using ((public.has_global_role('SUPER_ADMIN'::text, auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.user_company_roles ucr
  WHERE ((ucr.user_id = auth.uid()) AND (ucr.company_id = suppliers.company_id))))));



  create policy "suppliers_super_admin_all"
  on "public"."suppliers"
  as permissive
  for all
  to public
using (public.has_global_role('SUPER_ADMIN'::text, auth.uid()))
with check (public.has_global_role('SUPER_ADMIN'::text, auth.uid()));



  create policy "ucr_company_admin_delete"
  on "public"."user_company_roles"
  as permissive
  for delete
  to public
using (public.has_company_role('COMPANY_ADMIN'::text, auth.uid(), company_id));



  create policy "ucr_company_admin_manage"
  on "public"."user_company_roles"
  as permissive
  for insert
  to public
with check (public.has_company_role('COMPANY_ADMIN'::text, auth.uid(), company_id));



  create policy "ucr_company_admin_update"
  on "public"."user_company_roles"
  as permissive
  for update
  to public
using (public.has_company_role('COMPANY_ADMIN'::text, auth.uid(), company_id))
with check (public.has_company_role('COMPANY_ADMIN'::text, auth.uid(), company_id));



  create policy "ucr_super_admin_all"
  on "public"."user_company_roles"
  as permissive
  for all
  to public
using (public.has_global_role('SUPER_ADMIN'::text, auth.uid()))
with check (public.has_global_role('SUPER_ADMIN'::text, auth.uid()));



  create policy "ugr_super_admin_manage"
  on "public"."user_global_roles"
  as permissive
  for all
  to authenticated
using (public.is_super_admin_direct(auth.uid()))
with check (public.is_super_admin_direct(auth.uid()));



  create policy "Admins can manage own roles"
  on "public"."user_roles"
  as permissive
  for all
  to public
using ((public.has_role(auth.uid(), 'admin'::public.app_role) AND (auth.uid() = user_id)));



  create policy "Admins can manage team roles"
  on "public"."user_roles"
  as permissive
  for all
  to public
using ((public.has_role(auth.uid(), 'admin'::public.app_role) AND (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.user_id = user_roles.user_id) AND (profiles.owner_id = auth.uid()))))));



  create policy "Admins can view team roles"
  on "public"."user_roles"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.user_id = user_roles.user_id) AND (profiles.owner_id = auth.uid())))));



  create policy "user_roles_delete"
  on "public"."user_roles"
  as permissive
  for delete
  to public
using ((public.has_role(auth.uid(), 'admin'::public.app_role) OR (public.has_role(auth.uid(), 'manager'::public.app_role) AND (role <> 'admin'::public.app_role))));



  create policy "user_roles_insert"
  on "public"."user_roles"
  as permissive
  for insert
  to public
with check ((public.has_role(auth.uid(), 'admin'::public.app_role) OR (public.has_role(auth.uid(), 'manager'::public.app_role) AND (role <> 'admin'::public.app_role))));



  create policy "user_roles_update"
  on "public"."user_roles"
  as permissive
  for update
  to public
using ((public.has_role(auth.uid(), 'admin'::public.app_role) OR (public.has_role(auth.uid(), 'manager'::public.app_role) AND (role <> 'admin'::public.app_role))))
with check ((public.has_role(auth.uid(), 'admin'::public.app_role) OR (public.has_role(auth.uid(), 'manager'::public.app_role) AND (role <> 'admin'::public.app_role))));


CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON public.accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_company_plans_updated_at BEFORE UPDATE ON public.company_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_invoice_items_recompute_totals AFTER INSERT OR DELETE OR UPDATE ON public.invoice_items FOR EACH ROW EXECUTE FUNCTION public.trg_invoice_items_recompute_totals();

CREATE TRIGGER trg_audit_invoices AFTER INSERT OR DELETE OR UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.audit_invoices();

CREATE TRIGGER trg_invoices_recompute_on_change AFTER UPDATE OF tax_rate, stamp_included, stamp_amount ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.trg_invoices_recompute_on_change();

CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_ensure_balanced AFTER INSERT OR DELETE OR UPDATE ON public.journal_lines FOR EACH ROW EXECUTE FUNCTION public.ensure_balanced_entry();

CREATE TRIGGER trg_invoice_status_after_payment AFTER INSERT OR DELETE OR UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.refresh_invoice_status();

CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_plan_features_updated_at BEFORE UPDATE ON public.plan_features FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_plans_updated_at BEFORE UPDATE ON public.plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

drop trigger if exists "on_auth_user_created" on "auth"."users";

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


