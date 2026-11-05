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
      admin_account_status: {
        Row: {
          status: string
          updated_at: string
          updated_by: string | null
          user_id: string
          verification: string
          verification_note: string | null
        }
        Insert: {
          status?: string
          updated_at?: string
          updated_by?: string | null
          user_id: string
          verification?: string
          verification_note?: string | null
        }
        Update: {
          status?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string
          verification?: string
          verification_note?: string | null
        }
        Relationships: []
      }
      admin_audit_log: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          detail: Json
          id: string
          target_user_id: string | null
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          detail?: Json
          id?: string
          target_user_id?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          detail?: Json
          id?: string
          target_user_id?: string | null
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
      balance_adjustments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          direction: string
          id: string
          ledger_id: string | null
          reason: string
          requested_by: string
          status: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          direction: string
          id?: string
          ledger_id?: string | null
          reason: string
          requested_by: string
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          direction?: string
          id?: string
          ledger_id?: string | null
          reason?: string
          requested_by?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "balance_adjustments_ledger_id_fkey"
            columns: ["ledger_id"]
            isOneToOne: false
            referencedRelation: "account_ledger"
            referencedColumns: ["id"]
          },
        ]
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
      currency_swaps: {
        Row: {
          created_at: string
          destination_amount: number
          from_currency: string
          id: string
          idempotency_key: string
          rate: number
          reference: string | null
          source_amount: number
          status: string
          to_currency: string
          user_id: string
        }
        Insert: {
          created_at?: string
          destination_amount: number
          from_currency: string
          id?: string
          idempotency_key: string
          rate: number
          reference?: string | null
          source_amount: number
          status: string
          to_currency: string
          user_id: string
        }
        Update: {
          created_at?: string
          destination_amount?: number
          from_currency?: string
          id?: string
          idempotency_key?: string
          rate?: number
          reference?: string | null
          source_amount?: number
          status?: string
          to_currency?: string
          user_id?: string
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
      fee_versions: {
        Row: {
          change_key: string
          changed_by: string
          created_at: string
          flat_ngn: number
          high_rate_bps: number
          id: string
          previous_id: string | null
          rate_bps: number
          service: string
          threshold_usd: number
        }
        Insert: {
          change_key: string
          changed_by: string
          created_at?: string
          flat_ngn?: number
          high_rate_bps: number
          id?: string
          previous_id?: string | null
          rate_bps: number
          service: string
          threshold_usd?: number
        }
        Update: {
          change_key?: string
          changed_by?: string
          created_at?: string
          flat_ngn?: number
          high_rate_bps?: number
          id?: string
          previous_id?: string | null
          rate_bps?: number
          service?: string
          threshold_usd?: number
        }
        Relationships: [
          {
            foreignKeyName: "fee_versions_previous_id_fkey"
            columns: ["previous_id"]
            isOneToOne: false
            referencedRelation: "fee_versions"
            referencedColumns: ["id"]
          },
        ]
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
      flw_topup_refunds: {
        Row: {
          amount: number
          provider_created_at: string | null
          provider_refund_id: string
          provider_status: string
          provider_tx_id: string
          refund_state: string
          request_id: string
          review_state: string
          verified_at: string
        }
        Insert: {
          amount: number
          provider_created_at?: string | null
          provider_refund_id: string
          provider_status: string
          provider_tx_id: string
          refund_state: string
          request_id: string
          review_state?: string
          verified_at?: string
        }
        Update: {
          amount?: number
          provider_created_at?: string | null
          provider_refund_id?: string
          provider_status?: string
          provider_tx_id?: string
          refund_state?: string
          request_id?: string
          review_state?: string
          verified_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "flw_topup_refunds_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "ngn_topup_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      flw_webhook_events: {
        Row: {
          amount: number | null
          currency: string | null
          event_key: string
          event_kind: string
          id: string
          outcome: string
          provider_refund_id: string | null
          provider_status: string
          provider_tx_id: string
          request_id: string | null
          verified_at: string
        }
        Insert: {
          amount?: number | null
          currency?: string | null
          event_key: string
          event_kind: string
          id?: string
          outcome: string
          provider_refund_id?: string | null
          provider_status: string
          provider_tx_id: string
          request_id?: string | null
          verified_at?: string
        }
        Update: {
          amount?: number | null
          currency?: string | null
          event_key?: string
          event_kind?: string
          id?: string
          outcome?: string
          provider_refund_id?: string | null
          provider_status?: string
          provider_tx_id?: string
          request_id?: string | null
          verified_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "flw_webhook_events_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "ngn_topup_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      fx_settings: {
        Row: {
          id: boolean
          ngn_per_usd: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: boolean
          ngn_per_usd?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: boolean
          ngn_per_usd?: number
          updated_at?: string
          updated_by?: string | null
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
      ngn_topup_requests: {
        Row: {
          account_id: string
          account_number: string
          amount_paid: number | null
          bank_name: string
          created_at: string
          credited_amount: number | null
          expires_at: string
          fee_version_id: string | null
          fin3a_fee: number
          id: string
          ledger_id: string | null
          provider_created_at: string | null
          provider_state: string | null
          provider_tx_id: string | null
          provider_verified_at: string | null
          requested_amount: number
          review_reason: string | null
          review_state: string
          status: string
          tx_ref: string
          updated_at: string
          user_id: string
          verified_amount: number | null
          verified_app_fee: number | null
          verified_charged_amount: number | null
          verified_currency: string | null
          verified_merchant_fee: number | null
        }
        Insert: {
          account_id: string
          account_number: string
          amount_paid?: number | null
          bank_name: string
          created_at?: string
          credited_amount?: number | null
          expires_at: string
          fee_version_id?: string | null
          fin3a_fee: number
          id?: string
          ledger_id?: string | null
          provider_created_at?: string | null
          provider_state?: string | null
          provider_tx_id?: string | null
          provider_verified_at?: string | null
          requested_amount: number
          review_reason?: string | null
          review_state?: string
          status?: string
          tx_ref: string
          updated_at?: string
          user_id: string
          verified_amount?: number | null
          verified_app_fee?: number | null
          verified_charged_amount?: number | null
          verified_currency?: string | null
          verified_merchant_fee?: number | null
        }
        Update: {
          account_id?: string
          account_number?: string
          amount_paid?: number | null
          bank_name?: string
          created_at?: string
          credited_amount?: number | null
          expires_at?: string
          fee_version_id?: string | null
          fin3a_fee?: number
          id?: string
          ledger_id?: string | null
          provider_created_at?: string | null
          provider_state?: string | null
          provider_tx_id?: string | null
          provider_verified_at?: string | null
          requested_amount?: number
          review_reason?: string | null
          review_state?: string
          status?: string
          tx_ref?: string
          updated_at?: string
          user_id?: string
          verified_amount?: number | null
          verified_app_fee?: number | null
          verified_charged_amount?: number | null
          verified_currency?: string | null
          verified_merchant_fee?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ngn_topup_requests_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ngn_topup_requests_fee_version_id_fkey"
            columns: ["fee_version_id"]
            isOneToOne: false
            referencedRelation: "fee_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ngn_topup_requests_ledger_id_fkey"
            columns: ["ledger_id"]
            isOneToOne: false
            referencedRelation: "account_ledger"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_fee_snapshots: {
        Row: {
          account_id: string
          asset: string | null
          blockchain_hash: string | null
          commission_included: boolean
          created_at: string
          currency: string
          fee_rate_bps: number
          fee_version_id: string | null
          fin3a_fee: number
          final_amount: number
          id: string
          idempotency_key: string
          ledger_id: string | null
          network: string | null
          network_charge: number
          original_amount: number
          provider: string
          provider_charge: number
          provider_rate: number | null
          provider_reference: string
          quote_expires_at: string | null
          quoted_payout: number
          rate_state: string
          receiving_currency: string | null
          service: string
          usd_value: number | null
          user_id: string
          verified_network_charge: number | null
          verified_provider_charge: number | null
        }
        Insert: {
          account_id: string
          asset?: string | null
          blockchain_hash?: string | null
          commission_included?: boolean
          created_at?: string
          currency: string
          fee_rate_bps: number
          fee_version_id?: string | null
          fin3a_fee: number
          final_amount: number
          id?: string
          idempotency_key: string
          ledger_id?: string | null
          network?: string | null
          network_charge: number
          original_amount: number
          provider: string
          provider_charge: number
          provider_rate?: number | null
          provider_reference: string
          quote_expires_at?: string | null
          quoted_payout: number
          rate_state: string
          receiving_currency?: string | null
          service: string
          usd_value?: number | null
          user_id: string
          verified_network_charge?: number | null
          verified_provider_charge?: number | null
        }
        Update: {
          account_id?: string
          asset?: string | null
          blockchain_hash?: string | null
          commission_included?: boolean
          created_at?: string
          currency?: string
          fee_rate_bps?: number
          fee_version_id?: string | null
          fin3a_fee?: number
          final_amount?: number
          id?: string
          idempotency_key?: string
          ledger_id?: string | null
          network?: string | null
          network_charge?: number
          original_amount?: number
          provider?: string
          provider_charge?: number
          provider_rate?: number | null
          provider_reference?: string
          quote_expires_at?: string | null
          quoted_payout?: number
          rate_state?: string
          receiving_currency?: string | null
          service?: string
          usd_value?: number | null
          user_id?: string
          verified_network_charge?: number | null
          verified_provider_charge?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_fee_snapshots_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_fee_snapshots_fee_version_id_fkey"
            columns: ["fee_version_id"]
            isOneToOne: false
            referencedRelation: "fee_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_fee_snapshots_ledger_id_fkey"
            columns: ["ledger_id"]
            isOneToOne: false
            referencedRelation: "account_ledger"
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
      qr_payment_requests: {
        Row: {
          amount: number | null
          created_at: string
          currency: string
          description: string | null
          expires_at: string | null
          id: string
          owner_user_id: string
          paid_at: string | null
          paid_by: string | null
          status: string
          transfer_id: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string
          currency: string
          description?: string | null
          expires_at?: string | null
          id?: string
          owner_user_id: string
          paid_at?: string | null
          paid_by?: string | null
          status?: string
          transfer_id?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string
          currency?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          owner_user_id?: string
          paid_at?: string | null
          paid_by?: string | null
          status?: string
          transfer_id?: string | null
        }
        Relationships: []
      }
      qr_scan_events: {
        Row: {
          created_at: string
          detail: string | null
          id: string
          kind: string
          request_id: string | null
          scanner_user_id: string | null
        }
        Insert: {
          created_at?: string
          detail?: string | null
          id?: string
          kind: string
          request_id?: string | null
          scanner_user_id?: string | null
        }
        Update: {
          created_at?: string
          detail?: string | null
          id?: string
          kind?: string
          request_id?: string | null
          scanner_user_id?: string | null
        }
        Relationships: []
      }
      rate_limit_counters: {
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
      revenue_events: {
        Row: {
          created_at: string
          event_kind: string
          fin3a_fee: number
          id: string
          network_charge: number
          occurred_at: string
          provider_charge: number
          provider_commission: number
          provider_event_reference: string
          related_event_id: string | null
          snapshot_id: string
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          event_kind: string
          fin3a_fee?: number
          id?: string
          network_charge?: number
          occurred_at: string
          provider_charge?: number
          provider_commission?: number
          provider_event_reference: string
          related_event_id?: string | null
          snapshot_id: string
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          event_kind?: string
          fin3a_fee?: number
          id?: string
          network_charge?: number
          occurred_at?: string
          provider_charge?: number
          provider_commission?: number
          provider_event_reference?: string
          related_event_id?: string | null
          snapshot_id?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "revenue_events_related_event_id_fkey"
            columns: ["related_event_id"]
            isOneToOne: false
            referencedRelation: "revenue_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_events_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "payment_fee_snapshots"
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
          country: string
          created_at: string
          currency: string
          deposit_credit_currency: string | null
          display_name: string | null
          fin3a_id: string | null
          id: string
          onboarding_completed: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          country?: string
          created_at?: string
          currency?: string
          deposit_credit_currency?: string | null
          display_name?: string | null
          fin3a_id?: string | null
          id?: string
          onboarding_completed?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          country?: string
          created_at?: string
          currency?: string
          deposit_credit_currency?: string | null
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
      account_blocked: { Args: { _user_id: string }; Returns: boolean }
      admin_audit_feed: { Args: { _limit: number }; Returns: Json }
      admin_balance: {
        Args: { _completed_only: boolean; _currency: string; _user_id: string }
        Returns: number
      }
      admin_change_fee: {
        Args: {
          _change_key: string
          _expected_id: string
          _flat_ngn: number
          _high_rate_bps: number
          _rate_bps: number
          _service: string
        }
        Returns: string
      }
      admin_decide_adjustment: {
        Args: { _approve: boolean; _id: string; _note: string }
        Returns: string
      }
      admin_internal_payment_usage: {
        Args: { _from: string; _to: string }
        Returns: Json
      }
      admin_list_users: {
        Args: { _limit: number; _offset: number; _search: string }
        Returns: Json
      }
      admin_qr_overview: { Args: never; Returns: Json }
      admin_request_adjustment: {
        Args: {
          _amount: number
          _currency: string
          _direction: string
          _reason: string
          _user_id: string
        }
        Returns: string
      }
      admin_require: { Args: never; Returns: undefined }
      admin_set_account_status: {
        Args: { _reason: string; _status: string; _user_id: string }
        Returns: string
      }
      admin_set_fx_rate: { Args: { _ngn_per_usd: number }; Returns: undefined }
      admin_set_verification: {
        Args: { _note: string; _user_id: string; _verification: string }
        Returns: undefined
      }
      admin_split_overview: { Args: never; Returns: Json }
      admin_update_profile: {
        Args: { _display_name: string; _reason: string; _user_id: string }
        Returns: undefined
      }
      admin_user_activity: {
        Args: never
        Returns: {
          created_at: string
          email: string
          last_active: string
          phone: string
          user_id: string
        }[]
      }
      admin_user_country: { Args: { _user_id: string }; Returns: string }
      admin_user_currency_ledger: {
        Args: { _currency: string; _user_id: string }
        Returns: {
          amount: number
          kind: string
          status: string
        }[]
      }
      admin_user_detail: { Args: { _user_id: string }; Returns: Json }
      admin_user_stats: { Args: never; Returns: Json }
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
      apply_flw_topup_evidence: {
        Args: {
          _amount: number
          _app_fee: number
          _charged_amount: number
          _currency: string
          _merchant_fee: number
          _notice_tx_id: string
          _provider_date: string
          _provider_tx_id: string
          _reference_matches: boolean
          _status: string
          _tx_ref: string
        }
        Returns: Json
      }
      consume_ai_quota: {
        Args: { _bucket: string; _limit: number; _window_seconds: number }
        Returns: boolean
      }
      consume_rate_limit: {
        Args: { _bucket: string; _limit: number; _window_seconds: number }
        Returns: boolean
      }
      create_qr_request: {
        Args: {
          _amount: number
          _currency: string
          _description?: string
          _expires_in_minutes?: number
        }
        Returns: string
      }
      credit_ngn_topup: {
        Args: { _amount_paid: number; _provider_tx_id: string; _tx_ref: string }
        Returns: Json
      }
      current_fee_schedule: { Args: never; Returns: Json }
      execute_currency_swap: {
        Args: {
          _amount: number
          _from_currency: string
          _idempotency_key: string
          _reference: string
          _user_id: string
        }
        Returns: Json
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
        Returns: Json
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
      is_split_participant: {
        Args: { _bill_id: string; _user_id: string }
        Returns: boolean
      }
      log_qr_scan: {
        Args: { _detail?: string; _kind: string }
        Returns: undefined
      }
      lookup_recipient: {
        Args: { _identifier: string }
        Returns: {
          display_name: string
          fin3a_id: string
          user_id: string
        }[]
      }
      pay_qr_request: {
        Args: { _amount: number; _idempotency_key: string; _request_id: string }
        Returns: Json
      }
      pay_split_share: {
        Args: { _idempotency_key: string; _participant_id: string }
        Returns: Json
      }
      record_flw_topup_refund: {
        Args: {
          _amount: number
          _charge_amount: number
          _charge_currency: string
          _charge_status: string
          _matches: boolean
          _provider_date: string
          _provider_tx_id: string
          _refund_id: string
          _refund_state: string
          _refund_status: string
          _tx_ref: string
        }
        Returns: Json
      }
      resolve_qr_request: { Args: { _request_id: string }; Returns: Json }
      send_split_reminder: {
        Args: { _participant_id: string }
        Returns: undefined
      }
      split_participant_directory: {
        Args: { _bill_id: string }
        Returns: {
          display_name: string
          fin3a_id: string
          user_id: string
        }[]
      }
      transfer_internal: {
        Args: {
          _amount: number
          _currency: string
          _idempotency_key: string
          _reference?: string
          _to_user: string
        }
        Returns: Json
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
