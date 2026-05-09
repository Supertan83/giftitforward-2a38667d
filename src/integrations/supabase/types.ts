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
      allocation_traceability_logs: {
        Row: {
          action_type: string
          allocation_id: string | null
          card_unique_id: string | null
          created_at: string
          deleted_at: string | null
          description: string
          id: string
          item_type_id: string | null
          marketplace_id: string | null
          marketplace_name: string
          performed_by: string | null
          performed_by_email: string | null
          quantity_after: number
          quantity_before: number
        }
        Insert: {
          action_type: string
          allocation_id?: string | null
          card_unique_id?: string | null
          created_at?: string
          deleted_at?: string | null
          description: string
          id?: string
          item_type_id?: string | null
          marketplace_id?: string | null
          marketplace_name: string
          performed_by?: string | null
          performed_by_email?: string | null
          quantity_after?: number
          quantity_before?: number
        }
        Update: {
          action_type?: string
          allocation_id?: string | null
          card_unique_id?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string
          id?: string
          item_type_id?: string | null
          marketplace_id?: string | null
          marketplace_name?: string
          performed_by?: string | null
          performed_by_email?: string | null
          quantity_after?: number
          quantity_before?: number
        }
        Relationships: []
      }
      archived_card_data: {
        Row: {
          activated_at: string | null
          archived_at: string
          checked_out_at: string | null
          children_count: number | null
          collected_items: Json | null
          created_at: string
          credit_balance: number | null
          deleted_at: string | null
          gender: string | null
          id: string
          marital_status: string | null
          marketplace_id: string | null
          nationality: string | null
          original_card_id: string | null
          total_items_collected: number | null
          unique_id: string
        }
        Insert: {
          activated_at?: string | null
          archived_at?: string
          checked_out_at?: string | null
          children_count?: number | null
          collected_items?: Json | null
          created_at?: string
          credit_balance?: number | null
          deleted_at?: string | null
          gender?: string | null
          id?: string
          marital_status?: string | null
          marketplace_id?: string | null
          nationality?: string | null
          original_card_id?: string | null
          total_items_collected?: number | null
          unique_id: string
        }
        Update: {
          activated_at?: string | null
          archived_at?: string
          checked_out_at?: string | null
          children_count?: number | null
          collected_items?: Json | null
          created_at?: string
          credit_balance?: number | null
          deleted_at?: string | null
          gender?: string | null
          id?: string
          marital_status?: string | null
          marketplace_id?: string | null
          nationality?: string | null
          original_card_id?: string | null
          total_items_collected?: number | null
          unique_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "archived_card_data_marketplace_id_fkey"
            columns: ["marketplace_id"]
            isOneToOne: false
            referencedRelation: "marketplace_events"
            referencedColumns: ["id"]
          },
        ]
      }
      cleanup_archive: {
        Row: {
          archive_batch_id: string | null
          archived_at: string
          archived_by: string | null
          deleted_at: string | null
          id: string
          original_id: string
          record_data: Json
          source_table: string
        }
        Insert: {
          archive_batch_id?: string | null
          archived_at?: string
          archived_by?: string | null
          deleted_at?: string | null
          id?: string
          original_id: string
          record_data: Json
          source_table: string
        }
        Update: {
          archive_batch_id?: string | null
          archived_at?: string
          archived_by?: string | null
          deleted_at?: string | null
          id?: string
          original_id?: string
          record_data?: Json
          source_table?: string
        }
        Relationships: []
      }
      email_automation_logs: {
        Row: {
          automation_id: string
          campaign_id: string | null
          deleted_at: string | null
          id: string
          notes: string | null
          recipients_count: number
          status: string
          triggered_at: string
        }
        Insert: {
          automation_id: string
          campaign_id?: string | null
          deleted_at?: string | null
          id?: string
          notes?: string | null
          recipients_count?: number
          status?: string
          triggered_at?: string
        }
        Update: {
          automation_id?: string
          campaign_id?: string | null
          deleted_at?: string | null
          id?: string
          notes?: string | null
          recipients_count?: number
          status?: string
          triggered_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_automation_logs_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "email_automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_automation_logs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      email_automations: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          is_active: boolean
          last_run_at: string | null
          name: string
          recipient_filter: Json
          template_id: string
          trigger_days: number
          trigger_time: string
          trigger_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          name: string
          recipient_filter?: Json
          template_id: string
          trigger_days?: number
          trigger_time?: string
          trigger_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          name?: string
          recipient_filter?: Json
          template_id?: string
          trigger_days?: number
          trigger_time?: string
          trigger_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_automations_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      email_campaign_recipients: {
        Row: {
          campaign_id: string
          created_at: string
          deleted_at: string | null
          error_message: string | null
          id: string
          recipient_email: string
          recipient_name: string
          sent_at: string | null
          status: string
          volunteer_id: string | null
        }
        Insert: {
          campaign_id: string
          created_at?: string
          deleted_at?: string | null
          error_message?: string | null
          id?: string
          recipient_email: string
          recipient_name?: string
          sent_at?: string | null
          status?: string
          volunteer_id?: string | null
        }
        Update: {
          campaign_id?: string
          created_at?: string
          deleted_at?: string | null
          error_message?: string | null
          id?: string
          recipient_email?: string
          recipient_name?: string
          sent_at?: string | null
          status?: string
          volunteer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_campaign_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_campaign_recipients_volunteer_id_fkey"
            columns: ["volunteer_id"]
            isOneToOne: false
            referencedRelation: "pending_volunteers"
            referencedColumns: ["id"]
          },
        ]
      }
      email_campaigns: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          failed_count: number
          id: string
          name: string
          recipient_filter: Json
          scheduled_at: string | null
          sent_at: string | null
          sent_count: number
          status: string
          template_id: string
          total_recipients: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          failed_count?: number
          id?: string
          name: string
          recipient_filter?: Json
          scheduled_at?: string | null
          sent_at?: string | null
          sent_count?: number
          status?: string
          template_id: string
          total_recipients?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          failed_count?: number
          id?: string
          name?: string
          recipient_filter?: Json
          scheduled_at?: string | null
          sent_at?: string | null
          sent_count?: number
          status?: string
          template_id?: string
          total_recipients?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_campaigns_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      email_provider_config: {
        Row: {
          created_at: string
          deleted_at: string | null
          email_type: string
          fallback_enabled: boolean
          id: string
          primary_provider: string
          resend_sender: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          email_type: string
          fallback_enabled?: boolean
          id?: string
          primary_provider?: string
          resend_sender?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          email_type?: string
          fallback_enabled?: boolean
          id?: string
          primary_provider?: string
          resend_sender?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      email_send_logs: {
        Row: {
          created_at: string
          deleted_at: string | null
          email_type: string
          error_message: string | null
          id: string
          pending_volunteer_id: string | null
          provider: string
          recipient_email: string
          request_payload: Json | null
          response_data: Json | null
          success: boolean
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          email_type: string
          error_message?: string | null
          id?: string
          pending_volunteer_id?: string | null
          provider: string
          recipient_email: string
          request_payload?: Json | null
          response_data?: Json | null
          success?: boolean
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          email_type?: string
          error_message?: string | null
          id?: string
          pending_volunteer_id?: string | null
          provider?: string
          recipient_email?: string
          request_payload?: Json | null
          response_data?: Json | null
          success?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "email_send_logs_pending_volunteer_id_fkey"
            columns: ["pending_volunteer_id"]
            isOneToOne: false
            referencedRelation: "pending_volunteers"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          body_sections: Json
          category: string
          created_at: string
          created_by: string | null
          cta_text: string | null
          cta_url: string | null
          deleted_at: string | null
          greeting: string
          id: string
          is_active: boolean
          name: string
          subject: string
          updated_at: string
        }
        Insert: {
          body_sections?: Json
          category: string
          created_at?: string
          created_by?: string | null
          cta_text?: string | null
          cta_url?: string | null
          deleted_at?: string | null
          greeting?: string
          id?: string
          is_active?: boolean
          name: string
          subject: string
          updated_at?: string
        }
        Update: {
          body_sections?: Json
          category?: string
          created_at?: string
          created_by?: string | null
          cta_text?: string | null
          cta_url?: string | null
          deleted_at?: string | null
          greeting?: string
          id?: string
          is_active?: boolean
          name?: string
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      event_dependents: {
        Row: {
          created_at: string
          deleted_at: string | null
          dependent_index: number | null
          dependent_type: string
          gender: string | null
          id: string
          name: string
          registration_event_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          dependent_index?: number | null
          dependent_type: string
          gender?: string | null
          id?: string
          name: string
          registration_event_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
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
          deleted_at: string | null
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
          deleted_at?: string | null
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
          deleted_at?: string | null
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
          deleted_at: string | null
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
          deleted_at?: string | null
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
          deleted_at?: string | null
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
          deleted_at: string | null
          id: string
          item_id: string
          sdg_goal_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          item_id: string
          sdg_goal_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
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
          deleted_at: string | null
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
          deleted_at?: string | null
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
          deleted_at?: string | null
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
          deleted_at: string | null
          external_id: number
          id: string
          name: string
          uom: string | null
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          deleted_at?: string | null
          external_id: number
          id?: string
          name: string
          uom?: string | null
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          deleted_at?: string | null
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
          deleted_at: string | null
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
          deleted_at?: string | null
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
          deleted_at?: string | null
          description?: string | null
          external_id?: number
          id?: string
          image_url?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      external_survey_responses: {
        Row: {
          answers: Json | null
          certificate_sent_at: string | null
          company_name: string | null
          completed_at: string | null
          created_at: string
          deleted_at: string | null
          experience_word: string | null
          id: string
          improvement_suggestions: string | null
          marketplace_id: string | null
          volunteer_email: string
          volunteer_name: string
          volunteer_user_id: string | null
          would_volunteer_again: boolean | null
        }
        Insert: {
          answers?: Json | null
          certificate_sent_at?: string | null
          company_name?: string | null
          completed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          experience_word?: string | null
          id?: string
          improvement_suggestions?: string | null
          marketplace_id?: string | null
          volunteer_email: string
          volunteer_name: string
          volunteer_user_id?: string | null
          would_volunteer_again?: boolean | null
        }
        Update: {
          answers?: Json | null
          certificate_sent_at?: string | null
          company_name?: string | null
          completed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          experience_word?: string | null
          id?: string
          improvement_suggestions?: string | null
          marketplace_id?: string | null
          volunteer_email?: string
          volunteer_name?: string
          volunteer_user_id?: string | null
          would_volunteer_again?: boolean | null
        }
        Relationships: []
      }
      hubspot_email_config: {
        Row: {
          created_at: string
          deleted_at: string | null
          email_type: string
          enabled: boolean | null
          id: string
          template_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          email_type: string
          enabled?: boolean | null
          id?: string
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          email_type?: string
          enabled?: boolean | null
          id?: string
          template_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      item_types: {
        Row: {
          allocated_to_marketplace: number
          category: string | null
          created_at: string
          deleted_at: string | null
          distributed: number
          external_material_id: number | null
          icon: string
          id: string
          name: string
          stock_locked: boolean
          subcategory: string | null
          surpluss_url: string | null
          total_stock: number
          updated_at: string
        }
        Insert: {
          allocated_to_marketplace?: number
          category?: string | null
          created_at?: string
          deleted_at?: string | null
          distributed?: number
          external_material_id?: number | null
          icon?: string
          id?: string
          name: string
          stock_locked?: boolean
          subcategory?: string | null
          surpluss_url?: string | null
          total_stock?: number
          updated_at?: string
        }
        Update: {
          allocated_to_marketplace?: number
          category?: string | null
          created_at?: string
          deleted_at?: string | null
          distributed?: number
          external_material_id?: number | null
          icon?: string
          id?: string
          name?: string
          stock_locked?: boolean
          subcategory?: string | null
          surpluss_url?: string | null
          total_stock?: number
          updated_at?: string
        }
        Relationships: []
      }
      marketplace_events: {
        Row: {
          beneficiary_credit_limit: number
          created_at: string
          deleted_at: string | null
          demographics_female_adults: number | null
          demographics_female_children: number | null
          demographics_male_adults: number | null
          demographics_male_children: number | null
          demographics_nationalities: Json | null
          demographics_notes: string | null
          demographics_reach: number | null
          demographics_target: number | null
          demographics_total_adults: number | null
          demographics_total_children: number | null
          demographics_total_families: number | null
          demographics_updated_at: string | null
          end_time: string | null
          event_date: string | null
          external_id: number | null
          id: string
          location: string | null
          manual_beneficiary_count: number | null
          max_items_per_scan: number
          name: string
          outreach_partner: string | null
          start_time: string | null
          status: string
          status_locked_by_admin: boolean
          updated_at: string
        }
        Insert: {
          beneficiary_credit_limit?: number
          created_at?: string
          deleted_at?: string | null
          demographics_female_adults?: number | null
          demographics_female_children?: number | null
          demographics_male_adults?: number | null
          demographics_male_children?: number | null
          demographics_nationalities?: Json | null
          demographics_notes?: string | null
          demographics_reach?: number | null
          demographics_target?: number | null
          demographics_total_adults?: number | null
          demographics_total_children?: number | null
          demographics_total_families?: number | null
          demographics_updated_at?: string | null
          end_time?: string | null
          event_date?: string | null
          external_id?: number | null
          id?: string
          location?: string | null
          manual_beneficiary_count?: number | null
          max_items_per_scan?: number
          name: string
          outreach_partner?: string | null
          start_time?: string | null
          status?: string
          status_locked_by_admin?: boolean
          updated_at?: string
        }
        Update: {
          beneficiary_credit_limit?: number
          created_at?: string
          deleted_at?: string | null
          demographics_female_adults?: number | null
          demographics_female_children?: number | null
          demographics_male_adults?: number | null
          demographics_male_children?: number | null
          demographics_nationalities?: Json | null
          demographics_notes?: string | null
          demographics_reach?: number | null
          demographics_target?: number | null
          demographics_total_adults?: number | null
          demographics_total_children?: number | null
          demographics_total_families?: number | null
          demographics_updated_at?: string | null
          end_time?: string | null
          event_date?: string | null
          external_id?: number | null
          id?: string
          location?: string | null
          manual_beneficiary_count?: number | null
          max_items_per_scan?: number
          name?: string
          outreach_partner?: string | null
          start_time?: string | null
          status?: string
          status_locked_by_admin?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      marketplace_item_allocations: {
        Row: {
          allocated_quantity: number
          created_at: string
          deleted_at: string | null
          distributed_quantity: number
          id: string
          item_type_id: string
          marketplace_id: string
          surpluss_allocation_id: number | null
          updated_at: string
        }
        Insert: {
          allocated_quantity?: number
          created_at?: string
          deleted_at?: string | null
          distributed_quantity?: number
          id?: string
          item_type_id: string
          marketplace_id: string
          surpluss_allocation_id?: number | null
          updated_at?: string
        }
        Update: {
          allocated_quantity?: number
          created_at?: string
          deleted_at?: string | null
          distributed_quantity?: number
          id?: string
          item_type_id?: string
          marketplace_id?: string
          surpluss_allocation_id?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_item_allocations_item_type_id_fkey"
            columns: ["item_type_id"]
            isOneToOne: false
            referencedRelation: "item_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_item_allocations_marketplace_id_fkey"
            columns: ["marketplace_id"]
            isOneToOne: false
            referencedRelation: "marketplace_events"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_manual_counts: {
        Row: {
          actual_distributed: number
          actual_remaining: number
          allocation_id: string | null
          counted_at: string
          counted_by: string | null
          created_at: string
          deleted_at: string | null
          id: string
          item_type_id: string
          marketplace_id: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          actual_distributed?: number
          actual_remaining?: number
          allocation_id?: string | null
          counted_at?: string
          counted_by?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          item_type_id: string
          marketplace_id: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          actual_distributed?: number
          actual_remaining?: number
          allocation_id?: string | null
          counted_at?: string
          counted_by?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          item_type_id?: string
          marketplace_id?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_manual_counts_allocation_id_fkey"
            columns: ["allocation_id"]
            isOneToOne: false
            referencedRelation: "marketplace_item_allocations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_manual_counts_item_type_id_fkey"
            columns: ["item_type_id"]
            isOneToOne: false
            referencedRelation: "item_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_manual_counts_marketplace_id_fkey"
            columns: ["marketplace_id"]
            isOneToOne: false
            referencedRelation: "marketplace_events"
            referencedColumns: ["id"]
          },
        ]
      }
      outreach_partners: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          id: string
          is_active: boolean | null
          name: string
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
        }
        Relationships: []
      }
      partner_registrations: {
        Row: {
          created_at: string
          deleted_at: string | null
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
          deleted_at?: string | null
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
          deleted_at?: string | null
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
      pending_beneficiaries: {
        Row: {
          age_0_17_count: number | null
          age_18_30_count: number | null
          age_31_40_count: number | null
          age_41_50_count: number | null
          age_51_60_count: number | null
          age_61_plus_count: number | null
          beneficiary_type_id: number | null
          children_count: number | null
          created_at: string
          deleted_at: string | null
          gender: string | null
          id: string
          items_collected: number | null
          marital_status: string | null
          marketplace_event_id: string | null
          marketplace_id: string | null
          nationality: string | null
          qr_id: string | null
          unique_id: string | null
          updated_at: string
        }
        Insert: {
          age_0_17_count?: number | null
          age_18_30_count?: number | null
          age_31_40_count?: number | null
          age_41_50_count?: number | null
          age_51_60_count?: number | null
          age_61_plus_count?: number | null
          beneficiary_type_id?: number | null
          children_count?: number | null
          created_at?: string
          deleted_at?: string | null
          gender?: string | null
          id?: string
          items_collected?: number | null
          marital_status?: string | null
          marketplace_event_id?: string | null
          marketplace_id?: string | null
          nationality?: string | null
          qr_id?: string | null
          unique_id?: string | null
          updated_at?: string
        }
        Update: {
          age_0_17_count?: number | null
          age_18_30_count?: number | null
          age_31_40_count?: number | null
          age_41_50_count?: number | null
          age_51_60_count?: number | null
          age_61_plus_count?: number | null
          beneficiary_type_id?: number | null
          children_count?: number | null
          created_at?: string
          deleted_at?: string | null
          gender?: string | null
          id?: string
          items_collected?: number | null
          marital_status?: string | null
          marketplace_event_id?: string | null
          marketplace_id?: string | null
          nationality?: string | null
          qr_id?: string | null
          unique_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_beneficiaries_marketplace_event_id_fkey"
            columns: ["marketplace_event_id"]
            isOneToOne: false
            referencedRelation: "marketplace_events"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_volunteers: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          certificate_sent_at: string | null
          created_at: string
          created_user_id: string | null
          deleted_at: string | null
          email: string
          email_opened: boolean | null
          email_opened_at: string | null
          email_send_count: number | null
          email_sent: boolean | null
          email_sent_at: string | null
          emergency_contact_name: string | null
          emergency_contact_number: string | null
          emergency_contact_relationship: string | null
          employee_join_date: string | null
          employee_number: string | null
          employee_vertical: string | null
          events_json: Json | null
          events_list: string | null
          external_company: string | null
          first_name: string
          gender: string | null
          has_medical_condition: boolean | null
          id: string
          is_employee: boolean | null
          is_fasting: boolean | null
          last_name: string
          medical_condition_details: string | null
          phone_number: string | null
          rejection_reason: string | null
          source: string | null
          source_data: Json | null
          status: string
          temp_password: string | null
          training_completed: boolean | null
          training_completed_at: string | null
          updated_at: string
          webhook_event_id: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          certificate_sent_at?: string | null
          created_at?: string
          created_user_id?: string | null
          deleted_at?: string | null
          email: string
          email_opened?: boolean | null
          email_opened_at?: string | null
          email_send_count?: number | null
          email_sent?: boolean | null
          email_sent_at?: string | null
          emergency_contact_name?: string | null
          emergency_contact_number?: string | null
          emergency_contact_relationship?: string | null
          employee_join_date?: string | null
          employee_number?: string | null
          employee_vertical?: string | null
          events_json?: Json | null
          events_list?: string | null
          external_company?: string | null
          first_name: string
          gender?: string | null
          has_medical_condition?: boolean | null
          id?: string
          is_employee?: boolean | null
          is_fasting?: boolean | null
          last_name: string
          medical_condition_details?: string | null
          phone_number?: string | null
          rejection_reason?: string | null
          source?: string | null
          source_data?: Json | null
          status?: string
          temp_password?: string | null
          training_completed?: boolean | null
          training_completed_at?: string | null
          updated_at?: string
          webhook_event_id?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          certificate_sent_at?: string | null
          created_at?: string
          created_user_id?: string | null
          deleted_at?: string | null
          email?: string
          email_opened?: boolean | null
          email_opened_at?: string | null
          email_send_count?: number | null
          email_sent?: boolean | null
          email_sent_at?: string | null
          emergency_contact_name?: string | null
          emergency_contact_number?: string | null
          emergency_contact_relationship?: string | null
          employee_join_date?: string | null
          employee_number?: string | null
          employee_vertical?: string | null
          events_json?: Json | null
          events_list?: string | null
          external_company?: string | null
          first_name?: string
          gender?: string | null
          has_medical_condition?: boolean | null
          id?: string
          is_employee?: boolean | null
          is_fasting?: boolean | null
          last_name?: string
          medical_condition_details?: string | null
          phone_number?: string | null
          rejection_reason?: string | null
          source?: string | null
          source_data?: Json | null
          status?: string
          temp_password?: string | null
          training_completed?: boolean | null
          training_completed_at?: string | null
          updated_at?: string
          webhook_event_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pending_volunteers_webhook_event_id_fkey"
            columns: ["webhook_event_id"]
            isOneToOne: false
            referencedRelation: "webhook_events"
            referencedColumns: ["id"]
          },
        ]
      }
      qr_cards: {
        Row: {
          activated_at: string | null
          children_count: number | null
          collected_items: Json
          created_at: string
          credit_balance: number
          deleted_at: string | null
          gender: string | null
          id: string
          marital_status: string | null
          marketplace_id: string | null
          nationality: string | null
          registration_batch: string | null
          status: Database["public"]["Enums"]["card_status"]
          total_items_collected: number
          unique_id: string
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          children_count?: number | null
          collected_items?: Json
          created_at?: string
          credit_balance?: number
          deleted_at?: string | null
          gender?: string | null
          id?: string
          marital_status?: string | null
          marketplace_id?: string | null
          nationality?: string | null
          registration_batch?: string | null
          status?: Database["public"]["Enums"]["card_status"]
          total_items_collected?: number
          unique_id: string
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          children_count?: number | null
          collected_items?: Json
          created_at?: string
          credit_balance?: number
          deleted_at?: string | null
          gender?: string | null
          id?: string
          marital_status?: string | null
          marketplace_id?: string | null
          nationality?: string | null
          registration_batch?: string | null
          status?: Database["public"]["Enums"]["card_status"]
          total_items_collected?: number
          unique_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "qr_cards_marketplace_id_fkey"
            columns: ["marketplace_id"]
            isOneToOne: false
            referencedRelation: "marketplace_events"
            referencedColumns: ["id"]
          },
        ]
      }
      registration_events: {
        Row: {
          created_at: string
          deleted_at: string | null
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
          deleted_at?: string | null
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
          deleted_at?: string | null
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
      surpluss_allocation_sync: {
        Row: {
          allocation_id: number
          created_at: string
          deleted_at: string | null
          environment: string
          id: string
          marketplace_external_id: number | null
          synced_at: string
          synced_by: string | null
          updated_at: string
        }
        Insert: {
          allocation_id: number
          created_at?: string
          deleted_at?: string | null
          environment?: string
          id?: string
          marketplace_external_id?: number | null
          synced_at?: string
          synced_by?: string | null
          updated_at?: string
        }
        Update: {
          allocation_id?: number
          created_at?: string
          deleted_at?: string | null
          environment?: string
          id?: string
          marketplace_external_id?: number | null
          synced_at?: string
          synced_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      surpluss_api_audit_log: {
        Row: {
          action: string
          created_at: string
          deleted_at: string | null
          environment: string
          id: string
          request_payload: Json | null
          response_body: Json | null
          response_status: number | null
          success: boolean | null
        }
        Insert: {
          action: string
          created_at?: string
          deleted_at?: string | null
          environment?: string
          id?: string
          request_payload?: Json | null
          response_body?: Json | null
          response_status?: number | null
          success?: boolean | null
        }
        Update: {
          action?: string
          created_at?: string
          deleted_at?: string | null
          environment?: string
          id?: string
          request_payload?: Json | null
          response_body?: Json | null
          response_status?: number | null
          success?: boolean | null
        }
        Relationships: []
      }
      surpluss_distribution_reports: {
        Row: {
          allocated_total: number
          allocation_id: number
          api_response_body: Json | null
          api_response_status: number | null
          created_at: string
          deleted_at: string | null
          distributed_total: number
          environment: string
          id: string
          marketplace_external_id: number | null
          reported_at: string
          request_payload: Json | null
          updated_at: string
        }
        Insert: {
          allocated_total?: number
          allocation_id: number
          api_response_body?: Json | null
          api_response_status?: number | null
          created_at?: string
          deleted_at?: string | null
          distributed_total?: number
          environment?: string
          id?: string
          marketplace_external_id?: number | null
          reported_at?: string
          request_payload?: Json | null
          updated_at?: string
        }
        Update: {
          allocated_total?: number
          allocation_id?: number
          api_response_body?: Json | null
          api_response_status?: number | null
          created_at?: string
          deleted_at?: string | null
          distributed_total?: number
          environment?: string
          id?: string
          marketplace_external_id?: number | null
          reported_at?: string
          request_payload?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      survey_questions: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          is_active: boolean
          is_required: boolean
          options: Json | null
          options_ar: Json | null
          question_text: string
          question_text_ar: string | null
          question_type: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          is_required?: boolean
          options?: Json | null
          options_ar?: Json | null
          question_text: string
          question_text_ar?: string | null
          question_type?: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          is_required?: boolean
          options?: Json | null
          options_ar?: Json | null
          question_text?: string
          question_text_ar?: string | null
          question_type?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          card_id: string
          credit_change: number
          deleted_at: string | null
          id: string
          item_type: string | null
          marketplace_id: string | null
          scanned_by: string | null
          timestamp: string
          type: Database["public"]["Enums"]["transaction_type"]
        }
        Insert: {
          card_id: string
          credit_change?: number
          deleted_at?: string | null
          id?: string
          item_type?: string | null
          marketplace_id?: string | null
          scanned_by?: string | null
          timestamp?: string
          type: Database["public"]["Enums"]["transaction_type"]
        }
        Update: {
          card_id?: string
          credit_change?: number
          deleted_at?: string | null
          id?: string
          item_type?: string | null
          marketplace_id?: string | null
          scanned_by?: string | null
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
      volunteer_attendance: {
        Row: {
          check_in_time: string
          check_out_time: string | null
          created_at: string
          deleted_at: string | null
          hours_worked: number | null
          id: string
          marketplace_id: string | null
          volunteer_card_id: string
        }
        Insert: {
          check_in_time?: string
          check_out_time?: string | null
          created_at?: string
          deleted_at?: string | null
          hours_worked?: number | null
          id?: string
          marketplace_id?: string | null
          volunteer_card_id: string
        }
        Update: {
          check_in_time?: string
          check_out_time?: string | null
          created_at?: string
          deleted_at?: string | null
          hours_worked?: number | null
          id?: string
          marketplace_id?: string | null
          volunteer_card_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "volunteer_attendance_marketplace_id_fkey"
            columns: ["marketplace_id"]
            isOneToOne: false
            referencedRelation: "marketplace_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "volunteer_attendance_volunteer_card_id_fkey"
            columns: ["volunteer_card_id"]
            isOneToOne: false
            referencedRelation: "volunteer_qr_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      volunteer_qr_cards: {
        Row: {
          assigned_zone: Database["public"]["Enums"]["volunteer_zone"] | null
          checked_in_at: string | null
          checked_out_at: string | null
          created_at: string
          deleted_at: string | null
          id: string
          marketplace_id: string | null
          status: string
          survey_completed_at: string | null
          survey_sent_at: string | null
          total_hours_worked: number | null
          unique_id: string
          updated_at: string
          volunteer_id: string | null
        }
        Insert: {
          assigned_zone?: Database["public"]["Enums"]["volunteer_zone"] | null
          checked_in_at?: string | null
          checked_out_at?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          marketplace_id?: string | null
          status?: string
          survey_completed_at?: string | null
          survey_sent_at?: string | null
          total_hours_worked?: number | null
          unique_id: string
          updated_at?: string
          volunteer_id?: string | null
        }
        Update: {
          assigned_zone?: Database["public"]["Enums"]["volunteer_zone"] | null
          checked_in_at?: string | null
          checked_out_at?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          marketplace_id?: string | null
          status?: string
          survey_completed_at?: string | null
          survey_sent_at?: string | null
          total_hours_worked?: number | null
          unique_id?: string
          updated_at?: string
          volunteer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "volunteer_qr_cards_marketplace_id_fkey"
            columns: ["marketplace_id"]
            isOneToOne: false
            referencedRelation: "marketplace_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "volunteer_qr_cards_volunteer_id_fkey"
            columns: ["volunteer_id"]
            isOneToOne: false
            referencedRelation: "pending_volunteers"
            referencedColumns: ["id"]
          },
        ]
      }
      volunteer_surveys: {
        Row: {
          answers: Json | null
          certificate_sent_at: string | null
          completed_at: string | null
          created_at: string
          experience_word: string | null
          id: string
          improvement_suggestions: string | null
          marketplace_id: string | null
          survey_token: string
          updated_at: string
          volunteer_card_id: string | null
          volunteer_email: string
          volunteer_id: string | null
          volunteer_name: string
          would_volunteer_again: boolean | null
        }
        Insert: {
          answers?: Json | null
          certificate_sent_at?: string | null
          completed_at?: string | null
          created_at?: string
          experience_word?: string | null
          id?: string
          improvement_suggestions?: string | null
          marketplace_id?: string | null
          survey_token: string
          updated_at?: string
          volunteer_card_id?: string | null
          volunteer_email: string
          volunteer_id?: string | null
          volunteer_name: string
          would_volunteer_again?: boolean | null
        }
        Update: {
          answers?: Json | null
          certificate_sent_at?: string | null
          completed_at?: string | null
          created_at?: string
          experience_word?: string | null
          id?: string
          improvement_suggestions?: string | null
          marketplace_id?: string | null
          survey_token?: string
          updated_at?: string
          volunteer_card_id?: string | null
          volunteer_email?: string
          volunteer_id?: string | null
          volunteer_name?: string
          would_volunteer_again?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "volunteer_surveys_marketplace_id_fkey"
            columns: ["marketplace_id"]
            isOneToOne: false
            referencedRelation: "marketplace_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "volunteer_surveys_volunteer_card_id_fkey"
            columns: ["volunteer_card_id"]
            isOneToOne: false
            referencedRelation: "volunteer_qr_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "volunteer_surveys_volunteer_id_fkey"
            columns: ["volunteer_id"]
            isOneToOne: false
            referencedRelation: "pending_volunteers"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouse_returns: {
        Row: {
          allocation_id: string | null
          created_at: string | null
          id: string
          item_type_id: string
          marketplace_id: string
          notes: string | null
          quantity_returned: number
          return_batch_code: string | null
          returned_at: string | null
          returned_by: string | null
        }
        Insert: {
          allocation_id?: string | null
          created_at?: string | null
          id?: string
          item_type_id: string
          marketplace_id: string
          notes?: string | null
          quantity_returned?: number
          return_batch_code?: string | null
          returned_at?: string | null
          returned_by?: string | null
        }
        Update: {
          allocation_id?: string | null
          created_at?: string | null
          id?: string
          item_type_id?: string
          marketplace_id?: string
          notes?: string | null
          quantity_returned?: number
          return_batch_code?: string | null
          returned_at?: string | null
          returned_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_returns_allocation_id_fkey"
            columns: ["allocation_id"]
            isOneToOne: false
            referencedRelation: "marketplace_item_allocations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_returns_item_type_id_fkey"
            columns: ["item_type_id"]
            isOneToOne: false
            referencedRelation: "item_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_returns_marketplace_id_fkey"
            columns: ["marketplace_id"]
            isOneToOne: false
            referencedRelation: "marketplace_events"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          created_at: string
          headers: Json | null
          id: string
          payload: Json
          processed: boolean
          received_at: string
          source_identifier: string | null
          source_ip: string | null
        }
        Insert: {
          created_at?: string
          headers?: Json | null
          id?: string
          payload: Json
          processed?: boolean
          received_at?: string
          source_identifier?: string | null
          source_ip?: string | null
        }
        Update: {
          created_at?: string
          headers?: Json | null
          id?: string
          payload?: Json
          processed?: boolean
          received_at?: string
          source_identifier?: string | null
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
      activate_beneficiary_card: {
        Args: {
          p_children_count?: number
          p_gender?: string
          p_marital_status?: string
          p_marketplace_id?: string
          p_nationality?: string
          p_unique_id: string
        }
        Returns: Json
      }
      admin_adjust_card_balance: {
        Args: { p_card_id: string; p_new_items_collected: number }
        Returns: Json
      }
      admin_reset_qr_card: { Args: { p_unique_id: string }; Returns: Json }
      checkout_beneficiary_card: {
        Args: { p_unique_id: string }
        Returns: Json
      }
      checkout_volunteer_card: { Args: { p_unique_id: string }; Returns: Json }
      decrement_marketplace_allocation_distributed: {
        Args: { _allocation_id: string }
        Returns: number
      }
      distribute_marketplace_item: {
        Args: { p_marketplace_id: string; p_unique_id: string }
        Returns: Json
      }
      distribute_marketplace_items_batch: {
        Args: {
          p_marketplace_id: string
          p_quantity: number
          p_unique_id: string
        }
        Returns: Json
      }
      get_marketplace_distribution_count: {
        Args: { p_marketplace_id: string }
        Returns: number
      }
      get_marketplace_kiosk_stats: {
        Args: { p_marketplace_id: string }
        Returns: Json
      }
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
      increment_marketplace_allocation_distributed: {
        Args: { _allocation_id: string }
        Returns: number
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      return_marketplace_item: {
        Args: { p_marketplace_id: string; p_unique_id: string }
        Returns: Json
      }
      return_marketplace_items_batch: {
        Args: {
          p_marketplace_id: string
          p_quantity: number
          p_unique_id: string
        }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "volunteer" | "employee"
      card_status: "inactive" | "active" | "checked_out"
      transaction_type:
        | "CheckIn"
        | "Distribution"
        | "Return"
        | "CheckOut"
        | "Adjustment"
      volunteer_zone: "entrance" | "marketplace" | "exit"
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
      app_role: ["admin", "volunteer", "employee"],
      card_status: ["inactive", "active", "checked_out"],
      transaction_type: [
        "CheckIn",
        "Distribution",
        "Return",
        "CheckOut",
        "Adjustment",
      ],
      volunteer_zone: ["entrance", "marketplace", "exit"],
    },
  },
} as const
