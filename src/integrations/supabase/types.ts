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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      account_ledger: {
        Row: {
          account_id: string
          amount: number
          created_at: string
          currency: string
          id: string
          kind: string
          provider: string | null
          provider_ref: string | null
          reference: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          amount: number
          created_at?: string
          currency: string
          id?: string
          kind: string
          provider?: string | null
          provider_ref?: string | null
          reference?: string | null
          status: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          kind?: string
          provider?: string | null
          provider_ref?: string | null
          reference?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_ledger_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts: {
        Row: {
          created_at: string
          currency: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          currency: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_guest_usage: {
        Row: {
          created_at: string
          est_cost_usd: number | null
          id: string
          input_tokens: number | null
          network_hash: string
          output_tokens: number | null
          reserved_usd: number
          status: string
          web_reserved_usd: number
        }
        Insert: {
          created_at?: string
          est_cost_usd?: number | null
          id?: string
          input_tokens?: number | null
          network_hash: string
          output_tokens?: number | null
          reserved_usd?: number
          status?: string
          web_reserved_usd?: number
        }
        Update: {
          created_at?: string
          est_cost_usd?: number | null
          id?: string
          input_tokens?: number | null
          network_hash?: string
          output_tokens?: number | null
          reserved_usd?: number
          status?: string
          web_reserved_usd?: number
        }
        Relationships: []
      }
      ai_model_prices: {
        Row: {
          cached_input_per_mtok: number | null
          input_per_mtok: number
          model: string
          output_per_mtok: number
          source_note: string | null
          updated_at: string
        }
        Insert: {
          cached_input_per_mtok?: number | null
          input_per_mtok: number
          model: string
          output_per_mtok: number
          source_note?: string | null
          updated_at?: string
        }
        Update: {
          cached_input_per_mtok?: number | null
          input_per_mtok?: number
          model?: string
          output_per_mtok?: number
          source_note?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ai_settings: {
        Row: {
          ai_enabled: boolean
          daily_budget_usd: number | null
          id: boolean
          monthly_budget_usd: number | null
          updated_at: string
          updated_by: string | null
          user_daily_requests: number
          user_daily_scans: number
          user_monthly_scans: number
          warn_percent: number
        }
        Insert: {
          ai_enabled?: boolean
          daily_budget_usd?: number | null
          id?: boolean
          monthly_budget_usd?: number | null
          updated_at?: string
          updated_by?: string | null
          user_daily_requests?: number
          user_daily_scans?: number
          user_monthly_scans?: number
          warn_percent?: number
        }
        Update: {
          ai_enabled?: boolean
          daily_budget_usd?: number | null
          id?: boolean
          monthly_budget_usd?: number | null
          updated_at?: string
          updated_by?: string | null
          user_daily_requests?: number
          user_daily_scans?: number
          user_monthly_scans?: number
          warn_percent?: number
        }
        Relationships: []
      }
      ai_usage_counters: {
        Row: {
          bucket: string
          used: number
          user_id: string
          window_start: string
        }
        Insert: {
          bucket: string
          used?: number
          user_id: string
          window_start: string
        }
        Update: {
          bucket?: string
          used?: number
          user_id?: string
          window_start?: string
        }
        Relationships: []
      }
      ai_usage_log: {
        Row: {
          cached_input_tokens: number | null
          created_at: string
          error_code: string | null
          est_cost_usd: number | null
          feature: string
          finished_at: string | null
          id: string
          input_tokens: number | null
          model: string | null
          output_tokens: number | null
          request_key: string | null
          status: string
          units: number
          user_id: string
          web_cost_usd: number | null
          web_reserved_usd: number
        }
        Insert: {
          cached_input_tokens?: number | null
          created_at?: string
          error_code?: string | null
          est_cost_usd?: number | null
          feature: string
          finished_at?: string | null
          id?: string
          input_tokens?: number | null
          model?: string | null
          output_tokens?: number | null
          request_key?: string | null
          status?: string
          units?: number
          user_id: string
          web_cost_usd?: number | null
          web_reserved_usd?: number
        }
        Update: {
          cached_input_tokens?: number | null
          created_at?: string
          error_code?: string | null
          est_cost_usd?: number | null
          feature?: string
          finished_at?: string | null
          id?: string
          input_tokens?: number | null
          model?: string | null
          output_tokens?: number | null
          request_key?: string | null
          status?: string
          units?: number
          user_id?: string
          web_cost_usd?: number | null
          web_reserved_usd?: number
        }
        Relationships: []
      }
      ai_user_limits: {
        Row: {
          blocked: boolean
          daily_requests: number | null
          daily_scans: number | null
          monthly_scans: number | null
          note: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          blocked?: boolean
          daily_requests?: number | null
          daily_scans?: number | null
          monthly_scans?: number | null
          note?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          blocked?: boolean
          daily_requests?: number | null
          daily_scans?: number | null
          monthly_scans?: number | null
          note?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          icon: string
          id: string
          kind: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          icon?: string
          id?: string
          kind: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          icon?: string
          id?: string
          kind?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          created_at: string
          id: string
          message_id: string
          parts: Json
          role: string
          thread_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_id: string
          parts?: Json
          role: string
          thread_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message_id?: string
          parts?: Json
          role?: string
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "chat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_threads: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      confirmed_balances: {
        Row: {
          amount: number
          as_of: string
          coverage_confirmed: boolean
          created_at: string
          currency: string
          id: string
          user_id: string
        }
        Insert: {
          amount: number
          as_of: string
          coverage_confirmed?: boolean
          created_at?: string
          currency: string
          id?: string
          user_id: string
        }
        Update: {
          amount?: number
          as_of?: string
          coverage_confirmed?: boolean
          created_at?: string
          currency?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      crypto_addresses: {
        Row: {
          address: string
          asset_id: string
          created_at: string
          id: string
          status: string
          user_id: string
        }
        Insert: {
          address: string
          asset_id: string
          created_at?: string
          id?: string
          status?: string
          user_id: string
        }
        Update: {
          address?: string
          asset_id?: string
          created_at?: string
          id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crypto_addresses_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "crypto_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      crypto_assets: {
        Row: {
          active: boolean
          id: string
          min_deposit: number | null
          name: string
          network: string
          symbol: string
        }
        Insert: {
          active?: boolean
          id?: string
          min_deposit?: number | null
          name: string
          network: string
          symbol: string
        }
        Update: {
          active?: boolean
          id?: string
          min_deposit?: number | null
          name?: string
          network?: string
          symbol?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          created_at: string
          doc_type: string
          error_message: string | null
          filename: string
          fingerprint: string
          id: string
          mime_type: string
          page_count: number | null
          reconciliation: Json | null
          size_bytes: number
          status: string
          storage_path: string
          summary: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          doc_type?: string
          error_message?: string | null
          filename: string
          fingerprint: string
          id?: string
          mime_type: string
          page_count?: number | null
          reconciliation?: Json | null
          size_bytes?: number
          status?: string
          storage_path: string
          summary?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          doc_type?: string
          error_message?: string | null
          filename?: string
          fingerprint?: string
          id?: string
          mime_type?: string
          page_count?: number | null
          reconciliation?: Json | null
          size_bytes?: number
          status?: string
          storage_path?: string
          summary?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      financial_commitments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          due_date: string
          id: string
          included_in_history: boolean
          matched_transaction_id: string | null
          name: string
          settled: boolean
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency: string
          due_date: string
          id?: string
          included_in_history?: boolean
          matched_transaction_id?: string | null
          name: string
          settled?: boolean
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          due_date?: string
          id?: string
          included_in_history?: boolean
          matched_transaction_id?: string | null
          name?: string
          settled?: boolean
          user_id?: string
        }
        Relationships: []
      }
      financial_goals: {
        Row: {
          contribution_amount: number
          created_at: string
          currency: string
          frequency: string
          id: string
          name: string
          start_date: string
          target_amount: number
          target_date: string
          user_id: string
        }
        Insert: {
          contribution_amount?: number
          created_at?: string
          currency: string
          frequency: string
          id?: string
          name: string
          start_date: string
          target_amount: number
          target_date: string
          user_id: string
        }
        Update: {
          contribution_amount?: number
          created_at?: string
          currency?: string
          frequency?: string
          id?: string
          name?: string
          start_date?: string
          target_amount?: number
          target_date?: string
          user_id?: string
        }
        Relationships: []
      }
      goal_progress: {
        Row: {
          amount: number
          created_at: string
          currency: string
          goal_id: string
          id: string
          occurred_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency: string
          goal_id: string
          id?: string
          occurred_at: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          goal_id?: string
          id?: string
          occurred_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_progress_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "financial_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_transfers: {
        Row: {
          amount: number
          created_at: string
          currency: string
          from_user_id: string
          id: string
          idempotency_key: string
          reference: string | null
          status: string
          to_user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency: string
          from_user_id: string
          id?: string
          idempotency_key: string
          reference?: string | null
          status?: string
          to_user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          from_user_id?: string
          id?: string
          idempotency_key?: string
          reference?: string | null
          status?: string
          to_user_id?: string
        }
        Relationships: []
      }
      merchant_rules: {
        Row: {
          category_id: string | null
          created_at: string
          id: string
          merchant_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          id?: string
          merchant_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          id?: string
          merchant_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_rules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      phone_identities: {
        Row: {
          phone: string
          user_id: string
          verified_at: string
        }
        Insert: {
          phone: string
          user_id: string
          verified_at?: string
        }
        Update: {
          phone?: string
          user_id?: string
          verified_at?: string
        }
        Relationships: []
      }
      phone_otps: {
        Row: {
          attempts: number
          code_hash: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          ip: string | null
          phone: string
          purpose: string
          user_id: string | null
        }
        Insert: {
          attempts?: number
          code_hash: string
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          ip?: string | null
          phone: string
          purpose: string
          user_id?: string | null
        }
        Update: {
          attempts?: number
          code_hash?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          ip?: string | null
          phone?: string
          purpose?: string
          user_id?: string | null
        }
        Relationships: []
      }
      recurring_bills: {
        Row: {
          active: boolean
          amount: number
          category_id: string | null
          created_at: string
          frequency: string
          id: string
          kind: string
          name: string
          next_due_date: string
          notes: string | null
          user_id: string
        }
        Insert: {
          active?: boolean
          amount: number
          category_id?: string | null
          created_at?: string
          frequency: string
          id?: string
          kind?: string
          name: string
          next_due_date: string
          notes?: string | null
          user_id: string
        }
        Update: {
          active?: boolean
          amount?: number
          category_id?: string | null
          created_at?: string
          frequency?: string
          id?: string
          kind?: string
          name?: string
          next_due_date?: string
          notes?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_bills_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_scenarios: {
        Row: {
          balance_id: string
          budget: number | null
          created_at: string
          currency: string
          id: string
          income_change: number
          months: number
          name: string
          purchase: number
          savings_contribution: number
          spending_change: number
          user_id: string
        }
        Insert: {
          balance_id: string
          budget?: number | null
          created_at?: string
          currency: string
          id?: string
          income_change?: number
          months?: number
          name: string
          purchase?: number
          savings_contribution?: number
          spending_change?: number
          user_id: string
        }
        Update: {
          balance_id?: string
          budget?: number | null
          created_at?: string
          currency?: string
          id?: string
          income_change?: number
          months?: number
          name?: string
          purchase?: number
          savings_contribution?: number
          spending_change?: number
          user_id?: string
        }
        Relationships: []
      }
      split_bill_participants: {
        Row: {
          amount: number
          bill_id: string
          created_at: string
          id: string
          is_creator: boolean
          last_reminder_at: string | null
          paid_at: string | null
          reminder_count: number
          status: string
          transfer_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          bill_id: string
          created_at?: string
          id?: string
          is_creator?: boolean
          last_reminder_at?: string | null
          paid_at?: string | null
          reminder_count?: number
          status?: string
          transfer_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          bill_id?: string
          created_at?: string
          id?: string
          is_creator?: boolean
          last_reminder_at?: string | null
          paid_at?: string | null
          reminder_count?: number
          status?: string
          transfer_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "split_bill_participants_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "split_bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "split_bill_participants_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "internal_transfers"
            referencedColumns: ["id"]
          },
        ]
      }
      split_bills: {
        Row: {
          created_at: string
          creator_id: string
          currency: string
          deadline: string | null
          id: string
          note: string | null
          status: string
          title: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          creator_id: string
          currency: string
          deadline?: string | null
          id?: string
          note?: string | null
          status?: string
          title: string
          total_amount: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          creator_id?: string
          currency?: string
          deadline?: string | null
          id?: string
          note?: string | null
          status?: string
          title?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: []
      }
      transaction_drafts: {
        Row: {
          amount: number | null
          category_hint: string | null
          classification: string
          confidence: string
          confirmed_separate: boolean
          created_at: string
          currency: string | null
          description: string | null
          document_id: string
          duplicate_confidence: string | null
          duplicate_of: string | null
          duplicate_reason: string | null
          id: string
          imported_transaction_id: string | null
          merchant: string | null
          payment_method: string | null
          reference: string | null
          review_confirmed: boolean
          status: string
          txn_date: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount?: number | null
          category_hint?: string | null
          classification?: string
          confidence?: string
          confirmed_separate?: boolean
          created_at?: string
          currency?: string | null
          description?: string | null
          document_id: string
          duplicate_confidence?: string | null
          duplicate_of?: string | null
          duplicate_reason?: string | null
          id?: string
          imported_transaction_id?: string | null
          merchant?: string | null
          payment_method?: string | null
          reference?: string | null
          review_confirmed?: boolean
          status?: string
          txn_date?: string | null
          type?: string
          user_id: string
        }
        Update: {
          amount?: number | null
          category_hint?: string | null
          classification?: string
          confidence?: string
          confirmed_separate?: boolean
          created_at?: string
          currency?: string | null
          description?: string | null
          document_id?: string
          duplicate_confidence?: string | null
          duplicate_of?: string | null
          duplicate_reason?: string | null
          id?: string
          imported_transaction_id?: string | null
          merchant?: string | null
          payment_method?: string | null
          reference?: string | null
          review_confirmed?: boolean
          status?: string
          txn_date?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_drafts_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_drafts_duplicate_of_fkey"
            columns: ["duplicate_of"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          category_id: string | null
          classification: string
          created_at: string
          currency: string | null
          description: string | null
          flag: string | null
          flag_note: string | null
          id: string
          import_identity: string | null
          merchant: string | null
          notes: string | null
          occurred_at: string
          payment_method: string | null
          recurring_bill_id: string | null
          reference: string | null
          source: string
          source_document_id: string | null
          status: string
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          classification?: string
          created_at?: string
          currency?: string | null
          description?: string | null
          flag?: string | null
          flag_note?: string | null
          id?: string
          import_identity?: string | null
          merchant?: string | null
          notes?: string | null
          occurred_at?: string
          payment_method?: string | null
          recurring_bill_id?: string | null
          reference?: string | null
          source?: string
          source_document_id?: string | null
          status?: string
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          classification?: string
          created_at?: string
          currency?: string | null
          description?: string | null
          flag?: string | null
          flag_note?: string | null
          id?: string
          import_identity?: string | null
          merchant?: string | null
          notes?: string | null
          occurred_at?: string
          payment_method?: string | null
          recurring_bill_id?: string | null
          reference?: string | null
          source?: string
          source_document_id?: string | null
          status?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_source_document_id_fkey"
            columns: ["source_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
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
          role: Database["public"]["Enums"]["app_role"]
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
      user_settings: {
        Row: {
          created_at: string
          currency: string
          display_name: string | null
          fin3a_id: string | null
          id: string
          onboarding_completed: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          currency?: string
          display_name?: string | null
          fin3a_id?: string | null
          id?: string
          onboarding_completed?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          display_name?: string | null
          fin3a_id?: string | null
          id?: string
          onboarding_completed?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_split_overview: { Args: never; Returns: Json }
      ai_admin_overview: { Args: never; Returns: Json }
      ai_admin_set_price: {
        Args: {
          _cached: number
          _input: number
          _model: string
          _note: string
          _output: number
        }
        Returns: undefined
      }
      ai_admin_set_user_limit: {
        Args: {
          _blocked: boolean
          _daily: number
          _note: string
          _scans_daily: number
          _scans_monthly: number
          _user_id: string
        }
        Returns: undefined
      }
      ai_admin_update_settings: {
        Args: {
          _daily: number
          _enabled: boolean
          _monthly: number
          _scans_daily: number
          _scans_monthly: number
          _user_daily: number
          _warn: number
        }
        Returns: undefined
      }
      ai_begin: {
        Args: { _feature: string; _request_key: string; _units?: number }
        Returns: Json
      }
      ai_finish: {
        Args: {
          _cached: number
          _error?: string
          _in: number
          _model: string
          _out: number
          _status: string
          _usage_id: string
        }
        Returns: undefined
      }
      ai_guest_begin: { Args: { _network_hash: string }; Returns: Json }
      ai_guest_finish: {
        Args: { _id: string; _input: number; _ok: boolean; _output: number }
        Returns: undefined
      }
      ai_price_estimate: {
        Args: { _cached: number; _in: number; _model: string; _out: number }
        Returns: number
      }
      ai_web_finish: {
        Args: {
          _guest: boolean
          _id: string
          _input: number
          _ok: boolean
          _output: number
        }
        Returns: undefined
      }
      ai_web_reserve: {
        Args: { _guest: boolean; _id: string }
        Returns: boolean
      }
      consume_ai_quota: {
        Args: { _bucket: string; _limit: number; _window_seconds: number }
        Returns: boolean
      }
      execute_internal_transfer: {
        Args: {
          _amount: number
          _currency: string
          _from_user: string
          _idempotency_key: string
          _reference: string
          _to_user: string
        }
        Returns: string
      }
      get_public_share_profile: {
        Args: { _fin3a_id: string }
        Returns: {
          display_name: string
          fin3a_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      import_document_drafts: {
        Args: { p_document_id: string }
        Returns: number
      }
      lookup_recipient: {
        Args: { _identifier: string }
        Returns: {
          display_name: string
          fin3a_id: string
          user_id: string
        }[]
      }
      pay_split_share: {
        Args: { _idempotency_key: string; _participant_id: string }
        Returns: string
      }
      send_split_reminder: {
        Args: { _participant_id: string }
        Returns: undefined
      }
      transfer_internal: {
        Args: {
          _amount: number
          _currency: string
          _idempotency_key: string
          _reference?: string
          _to_user: string
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "user"],
    },
  },
} as const
