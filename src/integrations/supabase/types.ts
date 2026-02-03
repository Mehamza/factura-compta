export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      account_loads: {
        Row: {
          account_id: string
          amount: number
          attachment_document_id: string | null
          company_id: string
          created_at: string
          currency: string
          id: string
          journal_entry_id: string | null
          load_date: string
          notes: string | null
          origin: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          amount: number
          attachment_document_id?: string | null
          company_id: string
          created_at?: string
          currency?: string
          id?: string
          journal_entry_id?: string | null
          load_date?: string
          notes?: string | null
          origin?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          amount?: number
          attachment_document_id?: string | null
          company_id?: string
          created_at?: string
          currency?: string
          id?: string
          journal_entry_id?: string | null
          load_date?: string
          notes?: string | null
          origin?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_loads_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_loads_attachment_document_id_fkey"
            columns: ["attachment_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_loads_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_loads_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts: {
        Row: {
          account_kind: string | null
          agency: string | null
          bank: string | null
          code: string
          company_id: string | null
          created_at: string | null
          currency: string
          iban: string | null
          id: string
          is_active: boolean | null
          name: string
          type: string | null
          user_id: string
        }
        Insert: {
          account_kind?: string | null
          agency?: string | null
          bank?: string | null
          code: string
          company_id?: string | null
          created_at?: string | null
          currency?: string
          iban?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          type?: string | null
          user_id: string
        }
        Update: {
          account_kind?: string | null
          agency?: string | null
          bank?: string | null
          code?: string
          company_id?: string | null
          created_at?: string | null
          currency?: string
          iban?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string | null
          changes: Json | null
          created_at: string | null
          id: string
          record_id: string | null
          table_name: string | null
          user_id: string | null
        }
        Insert: {
          action?: string | null
          changes?: Json | null
          created_at?: string | null
          id?: string
          record_id?: string | null
          table_name?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string | null
          changes?: Json | null
          created_at?: string | null
          id?: string
          record_id?: string | null
          table_name?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      clients: {
        Row: {
          address: string | null
          city: string | null
          company_id: string
          country: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          postal_code: string | null
          siret: string | null
          updated_at: string
          user_id: string
          vat_number: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          company_id: string
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          postal_code?: string | null
          siret?: string | null
          updated_at?: string
          user_id: string
          vat_number?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          company_id?: string
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          postal_code?: string | null
          siret?: string | null
          updated_at?: string
          user_id?: string
          vat_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_company_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          active: boolean
          activity: string | null
          address: string | null
          bank_accounts: Json | null
          city: string | null
          company_country: string | null
          company_tax_id: string | null
          company_trade_register: string | null
          company_vat_number: string | null
          created_at: string
          default_currency: string | null
          default_vat_rate: number | null
          disabled_at: string | null
          disabled_by: string | null
          disabled_reason: string | null
          disabled_until: string | null
          email: string | null
          id: string
          invoice_format: string | null
          invoice_next_number: number | null
          invoice_number_padding: number | null
          invoice_prefix: string | null
          is_configured: boolean | null
          legal_name: string | null
          logo_url: string | null
          matricule_fiscale: string | null
          name: string
          phone: string | null
          postal_code: string | null
          signature_url: string | null
          stamp_url: string | null
          updated_at: string
          vat_rates: Json | null
        }
        Insert: {
          active?: boolean
          activity?: string | null
          address?: string | null
          bank_accounts?: Json | null
          city?: string | null
          company_country?: string | null
          company_tax_id?: string | null
          company_trade_register?: string | null
          company_vat_number?: string | null
          created_at?: string
          default_currency?: string | null
          default_vat_rate?: number | null
          disabled_at?: string | null
          disabled_by?: string | null
          disabled_reason?: string | null
          disabled_until?: string | null
          email?: string | null
          id?: string
          invoice_format?: string | null
          invoice_next_number?: number | null
          invoice_number_padding?: number | null
          invoice_prefix?: string | null
          is_configured?: boolean | null
          legal_name?: string | null
          logo_url?: string | null
          matricule_fiscale?: string | null
          name: string
          phone?: string | null
          postal_code?: string | null
          signature_url?: string | null
          stamp_url?: string | null
          updated_at?: string
          vat_rates?: Json | null
        }
        Update: {
          active?: boolean
          activity?: string | null
          address?: string | null
          bank_accounts?: Json | null
          city?: string | null
          company_country?: string | null
          company_tax_id?: string | null
          company_trade_register?: string | null
          company_vat_number?: string | null
          created_at?: string
          default_currency?: string | null
          default_vat_rate?: number | null
          disabled_at?: string | null
          disabled_by?: string | null
          disabled_reason?: string | null
          disabled_until?: string | null
          email?: string | null
          id?: string
          invoice_format?: string | null
          invoice_next_number?: number | null
          invoice_number_padding?: number | null
          invoice_prefix?: string | null
          is_configured?: boolean | null
          legal_name?: string | null
          logo_url?: string | null
          matricule_fiscale?: string | null
          name?: string
          phone?: string | null
          postal_code?: string | null
          signature_url?: string | null
          stamp_url?: string | null
          updated_at?: string
          vat_rates?: Json | null
        }
        Relationships: []
      }
      company_plans: {
        Row: {
          active: boolean
          assigned_at: string | null
          company_id: string | null
          expires_at: string | null
          id: string
          plan_id: string
          started_at: string | null
          user_id: string
        }
        Insert: {
          active?: boolean
          assigned_at?: string | null
          company_id?: string | null
          expires_at?: string | null
          id?: string
          plan_id: string
          started_at?: string | null
          user_id: string
        }
        Update: {
          active?: boolean
          assigned_at?: string | null
          company_id?: string | null
          expires_at?: string | null
          id?: string
          plan_id?: string
          started_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_plans_company_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_plans_plan_fk"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_plans_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      company_status_logs: {
        Row: {
          action: string
          company_id: string
          disabled_until: string | null
          id: string
          metadata: Json | null
          performed_at: string
          performed_by: string
          reason: string | null
        }
        Insert: {
          action: string
          company_id: string
          disabled_until?: string | null
          id?: string
          metadata?: Json | null
          performed_at?: string
          performed_by: string
          reason?: string | null
        }
        Update: {
          action?: string
          company_id?: string
          disabled_until?: string | null
          id?: string
          metadata?: Json | null
          performed_at?: string
          performed_by?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_status_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_users: {
        Row: {
          company_id: string
          created_at: string
          id: string
          permissions: Json
          role: Database["public"]["Enums"]["company_role"]
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          permissions?: Json
          role?: Database["public"]["Enums"]["company_role"]
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          permissions?: Json
          role?: Database["public"]["Enums"]["company_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_users_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      document_number_sequences: {
        Row: {
          company_id: string
          created_at: string
          kind: string
          next_number: number
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          kind: string
          next_number?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          kind?: string
          next_number?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_number_sequences_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          category: string
          client_id: string | null
          company_id: string | null
          created_at: string
          description: string | null
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id: string
          invoice_id: string | null
          supplier_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          client_id?: string | null
          company_id?: string | null
          created_at?: string
          description?: string | null
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id?: string
          invoice_id?: string | null
          supplier_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          client_id?: string | null
          company_id?: string | null
          created_at?: string
          description?: string | null
          file_name?: string
          file_path?: string
          file_size?: number
          file_type?: string
          id?: string
          invoice_id?: string | null
          supplier_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          account_id: string
          amount: number
          attachment_document_id: string | null
          category: string | null
          company_id: string
          created_at: string
          currency: string
          description: string | null
          expense_date: string
          id: string
          journal_entry_id: string | null
          payment_method: string | null
          reference: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          amount: number
          attachment_document_id?: string | null
          category?: string | null
          company_id: string
          created_at?: string
          currency?: string
          description?: string | null
          expense_date?: string
          id?: string
          journal_entry_id?: string | null
          payment_method?: string | null
          reference?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          amount?: number
          attachment_document_id?: string | null
          category?: string | null
          company_id?: string
          created_at?: string
          currency?: string
          description?: string | null
          expense_date?: string
          id?: string
          journal_entry_id?: string | null
          payment_method?: string | null
          reference?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_attachment_document_id_fkey"
            columns: ["attachment_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      impersonation_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          ip_address: string | null
          super_admin_id: string
          target_user_id: string
          user_agent: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          ip_address?: string | null
          super_admin_id: string
          target_user_id: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          super_admin_id?: string
          target_user_id?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      invoice_items: {
        Row: {
          company_id: string
          created_at: string
          description: string
          fodec_amount: number | null
          fodec_applicable: boolean | null
          fodec_rate: number | null
          id: string
          invoice_id: string
          product_id: string | null
          quantity: number
          reference: string | null
          total: number
          unit_price: number
          vat_amount: number | null
          vat_rate: number | null
        }
        Insert: {
          company_id: string
          created_at?: string
          description: string
          fodec_amount?: number | null
          fodec_applicable?: boolean | null
          fodec_rate?: number | null
          id?: string
          invoice_id: string
          product_id?: string | null
          quantity?: number
          reference?: string | null
          total: number
          unit_price: number
          vat_amount?: number | null
          vat_rate?: number | null
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string
          fodec_amount?: number | null
          fodec_applicable?: boolean | null
          fodec_rate?: number | null
          id?: string
          invoice_id?: string
          product_id?: string | null
          quantity?: number
          reference?: string | null
          total?: number
          unit_price?: number
          vat_amount?: number | null
          vat_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_company_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          client_id: string | null
          company_id: string
          created_at: string
          created_by_user_id: string | null
          currency: string | null
          delivery_address: string | null
          delivery_contact: string | null
          delivery_date: string | null
          delivery_notes: string | null
          delivery_phone: string | null
          discount_amount: number | null
          discount_type: string | null
          discount_value: number | null
          document_kind: string
          driver_name: string | null
          due_date: string
          fodec_amount: number | null
          id: string
          invoice_number: string
          issue_date: string
          notes: string | null
          package_count: number | null
          reference_devis: string | null
          remaining_amount: number
          source_invoice_id: string | null
          stamp_amount: number
          stamp_included: boolean
          status: string
          subtotal: number
          supplier_id: string | null
          tax_amount: number
          tax_rate: number
          template_type: string | null
          total: number
          total_paid: number
          total_weight: number | null
          transport_method: string | null
          updated_at: string
          user_id: string
          validity_date: string | null
          vehicle_info: string | null
        }
        Insert: {
          client_id?: string | null
          company_id: string
          created_at?: string
          created_by_user_id?: string | null
          currency?: string | null
          delivery_address?: string | null
          delivery_contact?: string | null
          delivery_date?: string | null
          delivery_notes?: string | null
          delivery_phone?: string | null
          discount_amount?: number | null
          discount_type?: string | null
          discount_value?: number | null
          document_kind?: string
          driver_name?: string | null
          due_date: string
          fodec_amount?: number | null
          id?: string
          invoice_number: string
          issue_date?: string
          notes?: string | null
          package_count?: number | null
          reference_devis?: string | null
          remaining_amount?: number
          source_invoice_id?: string | null
          stamp_amount?: number
          stamp_included?: boolean
          status?: string
          subtotal?: number
          supplier_id?: string | null
          tax_amount?: number
          tax_rate?: number
          template_type?: string | null
          total?: number
          total_paid?: number
          total_weight?: number | null
          transport_method?: string | null
          updated_at?: string
          user_id: string
          validity_date?: string | null
          vehicle_info?: string | null
        }
        Update: {
          client_id?: string | null
          company_id?: string
          created_at?: string
          created_by_user_id?: string | null
          currency?: string | null
          delivery_address?: string | null
          delivery_contact?: string | null
          delivery_date?: string | null
          delivery_notes?: string | null
          delivery_phone?: string | null
          discount_amount?: number | null
          discount_type?: string | null
          discount_value?: number | null
          document_kind?: string
          driver_name?: string | null
          due_date?: string
          fodec_amount?: number | null
          id?: string
          invoice_number?: string
          issue_date?: string
          notes?: string | null
          package_count?: number | null
          reference_devis?: string | null
          remaining_amount?: number
          source_invoice_id?: string | null
          stamp_amount?: number
          stamp_included?: boolean
          status?: string
          subtotal?: number
          supplier_id?: string | null
          tax_amount?: number
          tax_rate?: number
          template_type?: string | null
          total?: number
          total_paid?: number
          total_weight?: number | null
          transport_method?: string | null
          updated_at?: string
          user_id?: string
          validity_date?: string | null
          vehicle_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_company_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_source_invoice_id_fkey"
            columns: ["source_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          company_id: string | null
          created_at: string | null
          created_by_user_id: string | null
          description: string | null
          entry_date: string
          id: string
          reference: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          created_by_user_id?: string | null
          description?: string | null
          entry_date: string
          id?: string
          reference?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          created_by_user_id?: string | null
          description?: string | null
          entry_date?: string
          id?: string
          reference?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_lines: {
        Row: {
          account_id: string | null
          credit: number | null
          debit: number | null
          entry_id: string | null
          id: string
          invoice_id: string | null
          payment_id: string | null
        }
        Insert: {
          account_id?: string | null
          credit?: number | null
          debit?: number | null
          entry_id?: string | null
          id?: string
          invoice_id?: string | null
          payment_id?: string | null
        }
        Update: {
          account_id?: string | null
          credit?: number | null
          debit?: number | null
          entry_id?: string | null
          id?: string
          invoice_id?: string | null
          payment_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          created_at: string | null
          id: string
          name: string
          type: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          type?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          account_id: string | null
          amount: number
          attachment_document_id: string | null
          client_id: string | null
          company_id: string | null
          created_at: string | null
          created_by_user_id: string | null
          currency: string | null
          gross_amount: number | null
          id: string
          invoice_id: string | null
          journal_entry_id: string | null
          method_id: string | null
          net_amount: number | null
          notes: string | null
          paid_at: string
          payment_date: string | null
          payment_method: string | null
          payment_type: string | null
          reference: string | null
          supplier_id: string | null
          updated_at: string | null
          user_id: string
          withholding_amount: number | null
          withholding_rate: number | null
        }
        Insert: {
          account_id?: string | null
          amount: number
          attachment_document_id?: string | null
          client_id?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by_user_id?: string | null
          currency?: string | null
          gross_amount?: number | null
          id?: string
          invoice_id?: string | null
          journal_entry_id?: string | null
          method_id?: string | null
          net_amount?: number | null
          notes?: string | null
          paid_at: string
          payment_date?: string | null
          payment_method?: string | null
          payment_type?: string | null
          reference?: string | null
          supplier_id?: string | null
          updated_at?: string | null
          user_id: string
          withholding_amount?: number | null
          withholding_rate?: number | null
        }
        Update: {
          account_id?: string | null
          amount?: number
          attachment_document_id?: string | null
          client_id?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by_user_id?: string | null
          currency?: string | null
          gross_amount?: number | null
          id?: string
          invoice_id?: string | null
          journal_entry_id?: string | null
          method_id?: string | null
          net_amount?: number | null
          notes?: string | null
          paid_at?: string
          payment_date?: string | null
          payment_method?: string | null
          payment_type?: string | null
          reference?: string | null
          supplier_id?: string | null
          updated_at?: string | null
          user_id?: string
          withholding_amount?: number | null
          withholding_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_attachment_document_id_fkey"
            columns: ["attachment_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_method_id_fkey"
            columns: ["method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_features: {
        Row: {
          created_at: string | null
          id: string
          key: string
          plan_id: string
          value: Json
        }
        Insert: {
          created_at?: string | null
          id?: string
          key: string
          plan_id: string
          value: Json
        }
        Update: {
          created_at?: string | null
          id?: string
          key?: string
          plan_id?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "plan_features_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          active: boolean
          created_at: string | null
          description: string | null
          display_order: number
          duration: string
          id: string
          name: string
          price_year: number
          updated_at: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string | null
          description?: string | null
          display_order?: number
          duration?: string
          id?: string
          name: string
          price_year?: number
          updated_at?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string | null
          description?: string | null
          display_order?: number
          duration?: string
          id?: string
          name?: string
          price_year?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      product_pricing_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          company_id: string
          document_id: string | null
          id: string
          new_sale_price: number | null
          new_vat_rate: number | null
          old_sale_price: number | null
          old_vat_rate: number | null
          product_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          company_id: string
          document_id?: string | null
          id?: string
          new_sale_price?: number | null
          new_vat_rate?: number | null
          old_sale_price?: number | null
          old_vat_rate?: number | null
          product_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          company_id?: string
          document_id?: string | null
          id?: string
          new_sale_price?: number | null
          new_vat_rate?: number | null
          old_sale_price?: number | null
          old_vat_rate?: number | null
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_pricing_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_pricing_history_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "stock_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_pricing_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string | null
          company_id: string
          created_at: string
          currency: string | null
          description: string | null
          fodec_applicable: boolean | null
          fodec_rate: number | null
          id: string
          initial_qty: number
          min_stock: number
          name: string
          purchase_price: number
          quantity: number
          sale_price: number
          sku: string | null
          supplier: string | null
          supplier_id: string | null
          unit: string
          unit_price: number
          updated_at: string
          user_id: string
          vat_rate: number
        }
        Insert: {
          category?: string | null
          company_id: string
          created_at?: string
          currency?: string | null
          description?: string | null
          fodec_applicable?: boolean | null
          fodec_rate?: number | null
          id?: string
          initial_qty: number
          min_stock?: number
          name: string
          purchase_price: number
          quantity?: number
          sale_price: number
          sku?: string | null
          supplier?: string | null
          supplier_id?: string | null
          unit: string
          unit_price?: number
          updated_at?: string
          user_id: string
          vat_rate: number
        }
        Update: {
          category?: string | null
          company_id?: string
          created_at?: string
          currency?: string | null
          description?: string | null
          fodec_applicable?: boolean | null
          fodec_rate?: number | null
          id?: string
          initial_qty?: number
          min_stock?: number
          name?: string
          purchase_price?: number
          quantity?: number
          sale_price?: number
          sku?: string | null
          supplier?: string | null
          supplier_id?: string | null
          unit?: string
          unit_price?: number
          updated_at?: string
          user_id?: string
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "products_company_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          company_name: string | null
          created_at: string
          disabled: boolean | null
          email: string | null
          full_name: string | null
          id: string
          owner_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          company_name?: string | null
          created_at?: string
          disabled?: boolean | null
          email?: string | null
          full_name?: string | null
          id?: string
          owner_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          company_name?: string | null
          created_at?: string
          disabled?: boolean | null
          email?: string | null
          full_name?: string | null
          id?: string
          owner_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      stock_document_items: {
        Row: {
          apply_pricing_updates: boolean
          created_at: string
          document_id: string
          id: string
          new_sale_price: number | null
          new_vat_rate: number | null
          product_id: string
          quantity: number
        }
        Insert: {
          apply_pricing_updates?: boolean
          created_at?: string
          document_id: string
          id?: string
          new_sale_price?: number | null
          new_vat_rate?: number | null
          product_id: string
          quantity: number
        }
        Update: {
          apply_pricing_updates?: boolean
          created_at?: string
          document_id?: string
          id?: string
          new_sale_price?: number | null
          new_vat_rate?: number | null
          product_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "stock_document_items_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "stock_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_document_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_documents: {
        Row: {
          company_id: string
          created_at: string
          created_by: string
          destination_warehouse_id: string | null
          document_number: string
          document_type: string
          id: string
          note: string | null
          source_warehouse_id: string | null
          updated_at: string
          warehouse_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by: string
          destination_warehouse_id?: string | null
          document_number: string
          document_type: string
          id?: string
          note?: string | null
          source_warehouse_id?: string | null
          updated_at?: string
          warehouse_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string
          destination_warehouse_id?: string | null
          document_number?: string
          document_type?: string
          id?: string
          note?: string | null
          source_warehouse_id?: string | null
          updated_at?: string
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_documents_destination_warehouse_id_fkey"
            columns: ["destination_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_documents_source_warehouse_id_fkey"
            columns: ["source_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_documents_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          company_id: string | null
          created_at: string
          destination_warehouse_id: string | null
          id: string
          movement_type: string
          note: string | null
          product_id: string
          quantity: number
          reference_id: string | null
          reference_type: string | null
          source_warehouse_id: string | null
          user_id: string
          warehouse_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          destination_warehouse_id?: string | null
          id?: string
          movement_type?: string
          note?: string | null
          product_id: string
          quantity: number
          reference_id?: string | null
          reference_type?: string | null
          source_warehouse_id?: string | null
          user_id: string
          warehouse_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          destination_warehouse_id?: string | null
          id?: string
          movement_type?: string
          note?: string | null
          product_id?: string
          quantity?: number
          reference_id?: string | null
          reference_type?: string | null
          source_warehouse_id?: string | null
          user_id?: string
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_destination_warehouse_id_fkey"
            columns: ["destination_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_source_warehouse_id_fkey"
            columns: ["source_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          city: string | null
          company_id: string
          country: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          postal_code: string | null
          siret: string | null
          updated_at: string
          user_id: string
          vat_number: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          company_id: string
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          postal_code?: string | null
          siret?: string | null
          updated_at?: string
          user_id: string
          vat_number?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          company_id?: string
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          postal_code?: string | null
          siret?: string | null
          updated_at?: string
          user_id?: string
          vat_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_company_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_company_roles: {
        Row: {
          company_id: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_company_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_global_roles: {
        Row: {
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      warehouse_products: {
        Row: {
          created_at: string | null
          id: string
          max_stock: number | null
          min_stock: number | null
          product_id: string
          quantity: number | null
          updated_at: string | null
          warehouse_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          max_stock?: number | null
          min_stock?: number | null
          product_id: string
          quantity?: number | null
          updated_at?: string | null
          warehouse_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          max_stock?: number | null
          min_stock?: number | null
          product_id?: string
          quantity?: number | null
          updated_at?: string | null
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_products_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouses: {
        Row: {
          address: string | null
          city: string | null
          code: string
          company_id: string
          country: string | null
          created_at: string | null
          deleted_at: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          manager_name: string | null
          manager_phone: string | null
          name: string
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          code: string
          company_id: string
          country?: string | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          manager_name?: string | null
          manager_phone?: string | null
          name: string
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          code?: string
          company_id?: string
          country?: string | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          manager_name?: string | null
          manager_phone?: string | null
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "warehouses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _get_default_company_id: { Args: never; Returns: string }
      apply_warehouse_stock_movement: {
        Args: {
          p_company_id: string
          p_destination_warehouse_id?: string
          p_kind: string
          p_note?: string
          p_product_id: string
          p_quantity: number
          p_reference_id?: string
          p_reference_type?: string
          p_source_warehouse_id?: string
          p_user_id: string
          p_warehouse_id?: string
        }
        Returns: string
      }
      auto_reactivate_companies: {
        Args: never
        Returns: {
          company_id: string
          company_name: string
        }[]
      }
      can_manage_company_users: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      convert_purchase_quote_to_invoice: {
        Args: { p_invoice_id: string }
        Returns: {
          id: string
          status: string
        }[]
      }
      create_account_load_operation: {
        Args: {
          p_account_id: string
          p_amount: number
          p_attachment_document_id?: string
          p_company_id: string
          p_currency?: string
          p_load_date: string
          p_notes: string
          p_origin: string
        }
        Returns: string
      }
      create_expense_operation: {
        Args: {
          p_account_id: string
          p_amount: number
          p_attachment_document_id?: string
          p_category: string
          p_company_id: string
          p_currency?: string
          p_description: string
          p_expense_date: string
          p_payment_method: string
          p_reference?: string
        }
        Returns: string
      }
      create_payment_operation: {
        Args: {
          p_account_id: string
          p_amount: number
          p_attachment_document_id?: string
          p_client_id?: string
          p_company_id: string
          p_currency?: string
          p_invoice_id: string
          p_notes?: string
          p_payment_date: string
          p_payment_method: string
          p_payment_type: string
          p_reference?: string
          p_supplier_id?: string
        }
        Returns: string
      }
      create_payment_with_account: {
        Args: {
          p_account_id: string
          p_amount: number
          p_invoice_id: string
          p_notes: string
          p_payment_date: string
          p_payment_method: string
          p_reference: string
          p_user_id: string
        }
        Returns: undefined
      }
      create_stock_entry_document: {
        Args: {
          p_company_id: string
          p_created_by?: string
          p_items: Json
          p_note?: string
          p_warehouse_id: string
        }
        Returns: string
      }
      create_stock_transfer_document: {
        Args: {
          p_company_id: string
          p_created_by?: string
          p_destination_warehouse_id: string
          p_items: Json
          p_note?: string
          p_source_warehouse_id: string
        }
        Returns: string
      }
      delete_payment_operation: {
        Args: { p_payment_id: string }
        Returns: undefined
      }
      ensure_company_account: {
        Args: {
          p_code: string
          p_company_id: string
          p_name: string
          p_type: string
        }
        Returns: string
      }
      ensure_default_warehouse_id: {
        Args: { p_company_id: string }
        Returns: string
      }
      get_company_role: {
        Args: { _company_id: string; _user_id: string }
        Returns: Database["public"]["Enums"]["company_role"]
      }
      get_effective_permissions: { Args: { p_user_id: string }; Returns: Json }
      get_user_company_ids: { Args: { _user_id: string }; Returns: string[] }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_company_role:
        | {
            Args: {
              _company_id: string
              _role: Database["public"]["Enums"]["company_role"]
              _user_id: string
            }
            Returns: boolean
          }
        | {
            Args: { p_company_id: string; p_role: string; p_user_id: string }
            Returns: boolean
          }
      has_global_role: {
        Args: { p_role: string; p_user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      invoice_outstanding: { Args: { p_invoice_id: string }; Returns: number }
      is_company_admin: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      is_company_disabled: { Args: { p_company_id: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      is_super_admin_direct: { Args: { _user_id: string }; Returns: boolean }
      next_document_number: {
        Args: {
          p_company_id: string
          p_format?: string
          p_issue_date?: string
          p_kind: string
          p_padding?: number
          p_prefix: string
        }
        Returns: string
      }
      next_stock_document_number: {
        Args: { p_prefix: string }
        Returns: string
      }
      recompute_invoice_payment_fields: {
        Args: { p_invoice_id: string }
        Returns: undefined
      }
      recompute_invoice_totals: {
        Args: { p_invoice_id: string }
        Returns: undefined
      }
      update_payment_operation: {
        Args: {
          p_account_id: string
          p_amount: number
          p_attachment_document_id?: string
          p_client_id?: string
          p_currency?: string
          p_invoice_id: string
          p_notes?: string
          p_payment_date: string
          p_payment_id: string
          p_payment_method: string
          p_payment_type: string
          p_reference?: string
          p_supplier_id?: string
        }
        Returns: undefined
      }
      user_in_company: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      users_share_company: {
        Args: { _actor: string; _target: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "accountant" | "manager" | "cashier"
      company_role: "company_admin" | "gerant" | "comptable" | "caissier"
      company_type: "personne_physique" | "personne_morale"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "accountant", "manager", "cashier"],
      company_role: ["company_admin", "gerant", "comptable", "caissier"],
      company_type: ["personne_physique", "personne_morale"],
    },
  },
} as const
