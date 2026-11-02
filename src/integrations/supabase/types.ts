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
      documents: {
        Row: {
          created_at: string
          doc_type: string
          error_message: string | null
          filename: string
          fingerprint: string
          id: string
          mime_type: string
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
      transaction_drafts: {
        Row: {
          amount: number | null
          category_hint: string | null
          confidence: string
          created_at: string
          currency: string | null
          description: string | null
          document_id: string
          duplicate_of: string | null
          id: string
          merchant: string | null
          payment_method: string | null
          reference: string | null
          status: string
          txn_date: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount?: number | null
          category_hint?: string | null
          confidence?: string
          created_at?: string
          currency?: string | null
          description?: string | null
          document_id: string
          duplicate_of?: string | null
          id?: string
          merchant?: string | null
          payment_method?: string | null
          reference?: string | null
          status?: string
          txn_date?: string | null
          type?: string
          user_id: string
        }
        Update: {
          amount?: number | null
          category_hint?: string | null
          confidence?: string
          created_at?: string
          currency?: string | null
          description?: string | null
          document_id?: string
          duplicate_of?: string | null
          id?: string
          merchant?: string | null
          payment_method?: string | null
          reference?: string | null
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
      user_settings: {
        Row: {
          created_at: string
          currency: string
          display_name: string | null
          id: string
          onboarding_completed: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          currency?: string
          display_name?: string | null
          id?: string
          onboarding_completed?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          display_name?: string | null
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
      import_document_drafts: {
        Args: { p_document_id: string }
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
