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
      item_types: {
        Row: {
          allocated_to_marketplace: number
          created_at: string
          distributed: number
          icon: string
          id: string
          name: string
          total_stock: number
          updated_at: string
        }
        Insert: {
          allocated_to_marketplace?: number
          created_at?: string
          distributed?: number
          icon?: string
          id?: string
          name: string
          total_stock?: number
          updated_at?: string
        }
        Update: {
          allocated_to_marketplace?: number
          created_at?: string
          distributed?: number
          icon?: string
          id?: string
          name?: string
          total_stock?: number
          updated_at?: string
        }
        Relationships: []
      }
      marketplace_events: {
        Row: {
          created_at: string
          event_date: string | null
          id: string
          location: string | null
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_date?: string | null
          id?: string
          location?: string | null
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_date?: string | null
          id?: string
          location?: string | null
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      qr_cards: {
        Row: {
          children_count: number | null
          collected_items: Json
          created_at: string
          credit_balance: number
          gender: string | null
          id: string
          marital_status: string | null
          nationality: string | null
          status: Database["public"]["Enums"]["card_status"]
          total_items_collected: number
          unique_id: string
          updated_at: string
        }
        Insert: {
          children_count?: number | null
          collected_items?: Json
          created_at?: string
          credit_balance?: number
          gender?: string | null
          id?: string
          marital_status?: string | null
          nationality?: string | null
          status?: Database["public"]["Enums"]["card_status"]
          total_items_collected?: number
          unique_id: string
          updated_at?: string
        }
        Update: {
          children_count?: number | null
          collected_items?: Json
          created_at?: string
          credit_balance?: number
          gender?: string | null
          id?: string
          marital_status?: string | null
          nationality?: string | null
          status?: Database["public"]["Enums"]["card_status"]
          total_items_collected?: number
          unique_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          card_id: string
          credit_change: number
          id: string
          item_type: string | null
          timestamp: string
          type: Database["public"]["Enums"]["transaction_type"]
        }
        Insert: {
          card_id: string
          credit_change?: number
          id?: string
          item_type?: string | null
          timestamp?: string
          type: Database["public"]["Enums"]["transaction_type"]
        }
        Update: {
          card_id?: string
          credit_change?: number
          id?: string
          item_type?: string | null
          timestamp?: string
          type?: Database["public"]["Enums"]["transaction_type"]
        }
        Relationships: [
          {
            foreignKeyName: "transactions_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "qr_cards"
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
      webhook_events: {
        Row: {
          created_at: string
          headers: Json | null
          id: string
          payload: Json
          processed: boolean
          received_at: string
          source_ip: string | null
        }
        Insert: {
          created_at?: string
          headers?: Json | null
          id?: string
          payload: Json
          processed?: boolean
          received_at?: string
          source_ip?: string | null
        }
        Update: {
          created_at?: string
          headers?: Json | null
          id?: string
          payload?: Json
          processed?: boolean
          received_at?: string
          source_ip?: string | null
        }
        Relationships: []
      }
      webhook_mapping_templates: {
        Row: {
          array_path: string | null
          created_at: string
          description: string | null
          field_mappings: Json
          id: string
          name: string
          source_identifier: string | null
          updated_at: string
        }
        Insert: {
          array_path?: string | null
          created_at?: string
          description?: string | null
          field_mappings?: Json
          id?: string
          name: string
          source_identifier?: string | null
          updated_at?: string
        }
        Update: {
          array_path?: string | null
          created_at?: string
          description?: string | null
          field_mappings?: Json
          id?: string
          name?: string
          source_identifier?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_item_distributed: {
        Args: { item_id: string }
        Returns: undefined
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "volunteer"
      card_status: "inactive" | "active" | "checked_out"
      transaction_type: "CheckIn" | "Distribution" | "Return" | "CheckOut"
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
      app_role: ["admin", "volunteer"],
      card_status: ["inactive", "active", "checked_out"],
      transaction_type: ["CheckIn", "Distribution", "Return", "CheckOut"],
    },
  },
} as const
