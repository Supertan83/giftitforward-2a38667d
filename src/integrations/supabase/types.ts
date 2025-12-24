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
      event_dependents: {
        Row: {
          created_at: string
          dependent_index: number | null
          dependent_type: string
          gender: string | null
          id: string
          name: string
          registration_event_id: string
        }
        Insert: {
          created_at?: string
          dependent_index?: number | null
          dependent_type: string
          gender?: string | null
          id?: string
          name: string
          registration_event_id: string
        }
        Update: {
          created_at?: string
          dependent_index?: number | null
          dependent_type?: string
          gender?: string | null
          id?: string
          name?: string
          registration_event_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_dependents_registration_event_id_fkey"
            columns: ["registration_event_id"]
            isOneToOne: false
            referencedRelation: "registration_events"
            referencedColumns: ["id"]
          },
        ]
      }
      external_addresses: {
        Row: {
          address: string
          city: string | null
          company_id: string | null
          country: string | null
          created_at: string
          external_id: number
          id: string
          is_primary: boolean | null
          location_latitude: number | null
          location_longitude: number | null
          state: string | null
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          address: string
          city?: string | null
          company_id?: string | null
          country?: string | null
          created_at?: string
          external_id: number
          id?: string
          is_primary?: boolean | null
          location_latitude?: number | null
          location_longitude?: number | null
          state?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          address?: string
          city?: string | null
          company_id?: string | null
          country?: string | null
          created_at?: string
          external_id?: number
          id?: string
          is_primary?: boolean | null
          location_latitude?: number | null
          location_longitude?: number | null
          state?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "external_addresses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "external_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      external_companies: {
        Row: {
          about_info: string | null
          company_license_number: string | null
          company_size: string | null
          created_at: string
          currency: string | null
          designation: string | null
          external_id: number
          id: string
          image_url: string | null
          is_parent_company: boolean | null
          main_business: string | null
          name: string
          sector: string | null
          updated_at: string
          uuid: string | null
          website_url: string | null
        }
        Insert: {
          about_info?: string | null
          company_license_number?: string | null
          company_size?: string | null
          created_at?: string
          currency?: string | null
          designation?: string | null
          external_id: number
          id?: string
          image_url?: string | null
          is_parent_company?: boolean | null
          main_business?: string | null
          name: string
          sector?: string | null
          updated_at?: string
          uuid?: string | null
          website_url?: string | null
        }
        Update: {
          about_info?: string | null
          company_license_number?: string | null
          company_size?: string | null
          created_at?: string
          currency?: string | null
          designation?: string | null
          external_id?: number
          id?: string
          image_url?: string | null
          is_parent_company?: boolean | null
          main_business?: string | null
          name?: string
          sector?: string | null
          updated_at?: string
          uuid?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
      external_item_sdg_goals: {
        Row: {
          created_at: string
          id: string
          item_id: string
          sdg_goal_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          sdg_goal_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          sdg_goal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_item_sdg_goals_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "external_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_item_sdg_goals_sdg_goal_id_fkey"
            columns: ["sdg_goal_id"]
            isOneToOne: false
            referencedRelation: "external_sdg_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      external_items: {
        Row: {
          active: boolean | null
          address_id: string | null
          box_count: number | null
          company_id: string | null
          condition_id: number | null
          created_at: string
          description: string | null
          external_id: number
          frequency: Json | null
          id: string
          image_url: string | null
          item_count: number | null
          material_group_id: string | null
          per: string | null
          price: number | null
          quantity: number | null
          third_level_subcategory_id: number | null
          title: string
          type_data: Json | null
          updated_at: string
          uuid: string | null
          webhook_event_id: string | null
        }
        Insert: {
          active?: boolean | null
          address_id?: string | null
          box_count?: number | null
          company_id?: string | null
          condition_id?: number | null
          created_at?: string
          description?: string | null
          external_id: number
          frequency?: Json | null
          id?: string
          image_url?: string | null
          item_count?: number | null
          material_group_id?: string | null
          per?: string | null
          price?: number | null
          quantity?: number | null
          third_level_subcategory_id?: number | null
          title: string
          type_data?: Json | null
          updated_at?: string
          uuid?: string | null
          webhook_event_id?: string | null
        }
        Update: {
          active?: boolean | null
          address_id?: string | null
          box_count?: number | null
          company_id?: string | null
          condition_id?: number | null
          created_at?: string
          description?: string | null
          external_id?: number
          frequency?: Json | null
          id?: string
          image_url?: string | null
          item_count?: number | null
          material_group_id?: string | null
          per?: string | null
          price?: number | null
          quantity?: number | null
          third_level_subcategory_id?: number | null
          title?: string
          type_data?: Json | null
          updated_at?: string
          uuid?: string | null
          webhook_event_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "external_items_address_id_fkey"
            columns: ["address_id"]
            isOneToOne: false
            referencedRelation: "external_addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "external_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_items_material_group_id_fkey"
            columns: ["material_group_id"]
            isOneToOne: false
            referencedRelation: "external_material_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      external_material_groups: {
        Row: {
          code: string | null
          created_at: string
          external_id: number
          id: string
          name: string
          uom: string | null
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          external_id: number
          id?: string
          name: string
          uom?: string | null
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          external_id?: number
          id?: string
          name?: string
          uom?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      external_sdg_goals: {
        Row: {
          code: string | null
          created_at: string
          description: string | null
          external_id: number
          id: string
          image_url: string | null
          name: string
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          description?: string | null
          external_id: number
          id?: string
          image_url?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          description?: string | null
          external_id?: number
          id?: string
          image_url?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
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
      partner_registrations: {
        Row: {
          created_at: string
          emergency_contact_name: string | null
          emergency_contact_number: string | null
          emergency_contact_relationship: string | null
          employee_join_date: string | null
          employee_number: string | null
          employee_vertical: string | null
          events_list: string | null
          external_company: string | null
          first_name: string
          ga_campaign: string | null
          ga_medium: string | null
          ga_source: string | null
          gender: string | null
          has_medical_condition: boolean | null
          id: string
          ip_address: string | null
          is_employee: boolean | null
          is_fasting: boolean | null
          last_name: string
          medical_condition_details: string | null
          phone_number: string | null
          submission_date: string | null
          terms_accepted: boolean | null
          updated_at: string
          webhook_event_id: string | null
          work_email: string
        }
        Insert: {
          created_at?: string
          emergency_contact_name?: string | null
          emergency_contact_number?: string | null
          emergency_contact_relationship?: string | null
          employee_join_date?: string | null
          employee_number?: string | null
          employee_vertical?: string | null
          events_list?: string | null
          external_company?: string | null
          first_name: string
          ga_campaign?: string | null
          ga_medium?: string | null
          ga_source?: string | null
          gender?: string | null
          has_medical_condition?: boolean | null
          id?: string
          ip_address?: string | null
          is_employee?: boolean | null
          is_fasting?: boolean | null
          last_name: string
          medical_condition_details?: string | null
          phone_number?: string | null
          submission_date?: string | null
          terms_accepted?: boolean | null
          updated_at?: string
          webhook_event_id?: string | null
          work_email: string
        }
        Update: {
          created_at?: string
          emergency_contact_name?: string | null
          emergency_contact_number?: string | null
          emergency_contact_relationship?: string | null
          employee_join_date?: string | null
          employee_number?: string | null
          employee_vertical?: string | null
          events_list?: string | null
          external_company?: string | null
          first_name?: string
          ga_campaign?: string | null
          ga_medium?: string | null
          ga_source?: string | null
          gender?: string | null
          has_medical_condition?: boolean | null
          id?: string
          ip_address?: string | null
          is_employee?: boolean | null
          is_fasting?: boolean | null
          last_name?: string
          medical_condition_details?: string | null
          phone_number?: string | null
          submission_date?: string | null
          terms_accepted?: boolean | null
          updated_at?: string
          webhook_event_id?: string | null
          work_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_registrations_webhook_event_id_fkey"
            columns: ["webhook_event_id"]
            isOneToOne: false
            referencedRelation: "webhook_events"
            referencedColumns: ["id"]
          },
        ]
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
      registration_events: {
        Row: {
          created_at: string
          event_date: string | null
          event_slug: string
          family_members_joining: boolean | null
          fnb_required: boolean | null
          id: string
          number_of_adults: number | null
          number_of_children: number | null
          registration_id: string
        }
        Insert: {
          created_at?: string
          event_date?: string | null
          event_slug: string
          family_members_joining?: boolean | null
          fnb_required?: boolean | null
          id?: string
          number_of_adults?: number | null
          number_of_children?: number | null
          registration_id: string
        }
        Update: {
          created_at?: string
          event_date?: string | null
          event_slug?: string
          family_members_joining?: boolean | null
          fnb_required?: boolean | null
          id?: string
          number_of_adults?: number | null
          number_of_children?: number | null
          registration_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "registration_events_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "partner_registrations"
            referencedColumns: ["id"]
          },
        ]
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
