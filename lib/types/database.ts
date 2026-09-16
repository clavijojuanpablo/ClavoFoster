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
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      appointments: {
        Row: {
          blocked_range: unknown
          buffer_after_minutes: number
          buffer_before_minutes: number
          business_id: string
          cancelled_at: string | null
          cancelled_by: string | null
          completed_at: string | null
          created_at: string
          customer_id: string
          customer_note: string | null
          duration_minutes: number
          end_at: string
          expires_at: string | null
          id: string
          internal_note: string | null
          manage_token: string
          price_cop: number
          service_id: string
          source: Database["public"]["Enums"]["booking_source"]
          staff_id: string
          start_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          updated_at: string
        }
        Insert: {
          blocked_range?: unknown
          buffer_after_minutes?: number
          buffer_before_minutes?: number
          business_id: string
          cancelled_at?: string | null
          cancelled_by?: string | null
          completed_at?: string | null
          created_at?: string
          customer_id: string
          customer_note?: string | null
          duration_minutes: number
          end_at: string
          expires_at?: string | null
          id?: string
          internal_note?: string | null
          manage_token?: string
          price_cop: number
          service_id: string
          source?: Database["public"]["Enums"]["booking_source"]
          staff_id: string
          start_at: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Update: {
          blocked_range?: unknown
          buffer_after_minutes?: number
          buffer_before_minutes?: number
          business_id?: string
          cancelled_at?: string | null
          cancelled_by?: string | null
          completed_at?: string | null
          created_at?: string
          customer_id?: string
          customer_note?: string | null
          duration_minutes?: number
          end_at?: string
          expires_at?: string | null
          id?: string
          internal_note?: string | null
          manage_token?: string
          price_cop?: number
          service_id?: string
          source?: Database["public"]["Enums"]["booking_source"]
          staff_id?: string
          start_at?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          address: string | null
          align_to_clock: boolean
          allow_staff_choice: boolean
          brand_color: string | null
          cancel_notice_minutes: number
          category: string
          city: string | null
          cover_url: string | null
          created_at: string
          email: string | null
          id: string
          is_published: boolean
          latitude: number | null
          logo_url: string | null
          longitude: number | null
          max_advance_days: number
          min_notice_minutes: number
          name: string
          phone: string | null
          photos: Json
          slot_granularity_minutes: number
          slug: string
          status: Database["public"]["Enums"]["business_status"]
          timezone: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          align_to_clock?: boolean
          allow_staff_choice?: boolean
          brand_color?: string | null
          cancel_notice_minutes?: number
          category: string
          city?: string | null
          cover_url?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_published?: boolean
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          max_advance_days?: number
          min_notice_minutes?: number
          name: string
          phone?: string | null
          photos?: Json
          slot_granularity_minutes?: number
          slug: string
          status?: Database["public"]["Enums"]["business_status"]
          timezone?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          align_to_clock?: boolean
          allow_staff_choice?: boolean
          brand_color?: string | null
          cancel_notice_minutes?: number
          category?: string
          city?: string | null
          cover_url?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_published?: boolean
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          max_advance_days?: number
          min_notice_minutes?: number
          name?: string
          phone?: string | null
          photos?: Json
          slot_granularity_minutes?: number
          slug?: string
          status?: Database["public"]["Enums"]["business_status"]
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          business_id: string
          created_at: string
          email: string | null
          first_seen_at: string
          id: string
          is_blocked: boolean
          last_visit_at: string | null
          name: string
          no_show_count: number
          notes: string | null
          phone: string
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          email?: string | null
          first_seen_at?: string
          id?: string
          is_blocked?: boolean
          last_visit_at?: string | null
          name: string
          no_show_count?: number
          notes?: string | null
          phone: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          email?: string | null
          first_seen_at?: string
          id?: string
          is_blocked?: boolean
          last_visit_at?: string | null
          name?: string
          no_show_count?: number
          notes?: string | null
          phone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_categories: {
        Row: {
          business_id: string
          created_at: string
          direction: Database["public"]["Enums"]["ledger_direction"]
          id: string
          is_system: boolean
          name: string
        }
        Insert: {
          business_id: string
          created_at?: string
          direction: Database["public"]["Enums"]["ledger_direction"]
          id?: string
          is_system?: boolean
          name: string
        }
        Update: {
          business_id?: string
          created_at?: string
          direction?: Database["public"]["Enums"]["ledger_direction"]
          id?: string
          is_system?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_categories_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_entries: {
        Row: {
          amount_cop: number
          appointment_id: string | null
          business_id: string
          category_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          direction: Database["public"]["Enums"]["ledger_direction"]
          id: string
          occurred_on: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          reverses_id: string | null
          staff_id: string | null
        }
        Insert: {
          amount_cop: number
          appointment_id?: string | null
          business_id: string
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          direction: Database["public"]["Enums"]["ledger_direction"]
          id?: string
          occurred_on: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          reverses_id?: string | null
          staff_id?: string | null
        }
        Update: {
          amount_cop?: number
          appointment_id?: string | null
          business_id?: string
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          direction?: Database["public"]["Enums"]["ledger_direction"]
          id?: string
          occurred_on?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          reverses_id?: string | null
          staff_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entries_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "ledger_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_reverses_id_fkey"
            columns: ["reverses_id"]
            isOneToOne: false
            referencedRelation: "ledger_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          business_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          staff_id: string | null
          user_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          staff_id?: string | null
          user_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          staff_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_log: {
        Row: {
          appointment_id: string | null
          business_id: string | null
          channel: string
          cost_usd: number | null
          created_at: string
          error: string | null
          id: string
          provider_ref: string | null
          recipient: string
          sent_at: string | null
          status: string
          template: string
        }
        Insert: {
          appointment_id?: string | null
          business_id?: string | null
          channel: string
          cost_usd?: number | null
          created_at?: string
          error?: string | null
          id?: string
          provider_ref?: string | null
          recipient: string
          sent_at?: string | null
          status?: string
          template: string
        }
        Update: {
          appointment_id?: string | null
          business_id?: string | null
          channel?: string
          cost_usd?: number | null
          created_at?: string
          error?: string | null
          id?: string
          provider_ref?: string | null
          recipient?: string
          sent_at?: string | null
          status?: string
          template?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_log_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_log_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      otp_codes: {
        Row: {
          attempts: number
          business_id: string | null
          code_hash: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          ip_hash: string | null
          phone: string
        }
        Insert: {
          attempts?: number
          business_id?: string | null
          code_hash: string
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          ip_hash?: string | null
          phone: string
        }
        Update: {
          attempts?: number
          business_id?: string | null
          code_hash?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          ip_hash?: string | null
          phone?: string
        }
        Relationships: [
          {
            foreignKeyName: "otp_codes_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          appointment_id: string
          business_id: string
          comment: string | null
          created_at: string
          id: string
          is_public: boolean
          rating: number
          staff_id: string | null
        }
        Insert: {
          appointment_id: string
          business_id: string
          comment?: string | null
          created_at?: string
          id?: string
          is_public?: boolean
          rating: number
          staff_id?: string | null
        }
        Update: {
          appointment_id?: string
          business_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          is_public?: boolean
          rating?: number
          staff_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: true
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      service_templates: {
        Row: {
          buffer_after_minutes: number
          category: string
          display_order: number
          duration_minutes: number
          id: string
          name: string
          price_cop: number
        }
        Insert: {
          buffer_after_minutes?: number
          category: string
          display_order?: number
          duration_minutes: number
          id?: string
          name: string
          price_cop: number
        }
        Update: {
          buffer_after_minutes?: number
          category?: string
          display_order?: number
          duration_minutes?: number
          id?: string
          name?: string
          price_cop?: number
        }
        Relationships: []
      }
      services: {
        Row: {
          buffer_after_minutes: number
          buffer_before_minutes: number
          business_id: string
          category: string | null
          color: string | null
          created_at: string
          description: string | null
          display_order: number
          duration_minutes: number
          id: string
          is_active: boolean
          name: string
          price_cop: number
          updated_at: string
        }
        Insert: {
          buffer_after_minutes?: number
          buffer_before_minutes?: number
          business_id: string
          category?: string | null
          color?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          duration_minutes: number
          id?: string
          is_active?: boolean
          name: string
          price_cop: number
          updated_at?: string
        }
        Update: {
          buffer_after_minutes?: number
          buffer_before_minutes?: number
          business_id?: string
          category?: string | null
          color?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          duration_minutes?: number
          id?: string
          is_active?: boolean
          name?: string
          price_cop?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          bio: string | null
          business_id: string
          can_block_own_schedule: boolean
          commission_pct: number | null
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          name: string
          phone: string | null
          photo_url: string | null
          updated_at: string
        }
        Insert: {
          bio?: string | null
          business_id: string
          can_block_own_schedule?: boolean
          commission_pct?: number | null
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          photo_url?: string | null
          updated_at?: string
        }
        Update: {
          bio?: string | null
          business_id?: string
          can_block_own_schedule?: boolean
          commission_pct?: number | null
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          photo_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_services: {
        Row: {
          business_id: string
          duration_override_minutes: number | null
          price_override_cop: number | null
          service_id: string
          staff_id: string
        }
        Insert: {
          business_id: string
          duration_override_minutes?: number | null
          price_override_cop?: number | null
          service_id: string
          staff_id: string
        }
        Update: {
          business_id?: string
          duration_override_minutes?: number | null
          price_override_cop?: number | null
          service_id?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_services_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_services_servicio_mismo_negocio"
            columns: ["service_id", "business_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id", "business_id"]
          },
          {
            foreignKeyName: "staff_services_trabajador_mismo_negocio"
            columns: ["staff_id", "business_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id", "business_id"]
          },
        ]
      }
      subscription_events: {
        Row: {
          business_id: string | null
          error: string | null
          event_id: string
          event_type: string
          id: string
          payload: Json
          processed_at: string | null
          provider: string
          received_at: string
        }
        Insert: {
          business_id?: string | null
          error?: string | null
          event_id: string
          event_type: string
          id?: string
          payload: Json
          processed_at?: string | null
          provider: string
          received_at?: string
        }
        Update: {
          business_id?: string | null
          error?: string | null
          event_id?: string
          event_type?: string
          id?: string
          payload?: Json
          processed_at?: string | null
          provider?: string
          received_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_events_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          amount_cop: number
          billing_period: string
          business_id: string
          cancel_reason: string | null
          cancelled_at: string | null
          created_at: string
          current_period_end: string | null
          grace_until: string | null
          id: string
          plan: string
          provider: string | null
          provider_ref: string | null
          status: Database["public"]["Enums"]["business_status"]
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          amount_cop: number
          billing_period?: string
          business_id: string
          cancel_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          grace_until?: string | null
          id?: string
          plan: string
          provider?: string | null
          provider_ref?: string | null
          status?: Database["public"]["Enums"]["business_status"]
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          amount_cop?: number
          billing_period?: string
          business_id?: string
          cancel_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          grace_until?: string | null
          id?: string
          plan?: string
          provider?: string | null
          provider_ref?: string | null
          status?: Database["public"]["Enums"]["business_status"]
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      time_off: {
        Row: {
          business_id: string
          created_at: string
          ends_at: string
          id: string
          reason: string | null
          staff_id: string | null
          starts_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          ends_at: string
          id?: string
          reason?: string | null
          staff_id?: string | null
          starts_at: string
        }
        Update: {
          business_id?: string
          created_at?: string
          ends_at?: string
          id?: string
          reason?: string | null
          staff_id?: string | null
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_off_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_off_trabajador_mismo_negocio"
            columns: ["staff_id", "business_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id", "business_id"]
          },
        ]
      }
      working_hours: {
        Row: {
          business_id: string
          ends_at: string
          id: string
          staff_id: string
          starts_at: string
          weekday: number
        }
        Insert: {
          business_id: string
          ends_at: string
          id?: string
          staff_id: string
          starts_at: string
          weekday: number
        }
        Update: {
          business_id?: string
          ends_at?: string
          id?: string
          staff_id?: string
          starts_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "working_hours_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "working_hours_trabajador_mismo_negocio"
            columns: ["staff_id", "business_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id", "business_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auth_business_ids: { Args: never; Returns: string[] }
      create_business: {
        Args: {
          p_category: string
          p_name: string
          p_phone?: string
          p_slug: string
          p_timezone?: string
        }
        Returns: string
      }
      es_dueno_de_carpeta: { Args: { p_nombre: string }; Returns: boolean }
      estado_tiene_pagina_publica: {
        Args: { p_status: Database["public"]["Enums"]["business_status"] }
        Returns: boolean
      }
      guardar_horario: {
        Args: { p_staff_id: string; p_turnos: Json }
        Returns: undefined
      }
      is_owner: { Args: { b_id: string }; Returns: boolean }
      limpiar_otp_vencidos: { Args: never; Returns: number }
      minutos_del_dia: { Args: { p_hora: string }; Returns: number }
      slug_disponible: { Args: { p_slug: string }; Returns: boolean }
      slug_es_reservado: { Args: { p_slug: string }; Returns: boolean }
      slug_tiene_formato: { Args: { p_slug: string }; Returns: boolean }
    }
    Enums: {
      app_role: "owner" | "staff"
      appointment_status:
        | "pending"
        | "confirmed"
        | "completed"
        | "no_show"
        | "cancelled"
      booking_source: "online" | "manual" | "walk_in"
      business_status:
        | "trialing"
        | "active"
        | "past_due"
        | "suspended"
        | "cancelled"
      ledger_direction: "income" | "expense"
      payment_method: "cash" | "transfer" | "nequi" | "card" | "other"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["owner", "staff"],
      appointment_status: [
        "pending",
        "confirmed",
        "completed",
        "no_show",
        "cancelled",
      ],
      booking_source: ["online", "manual", "walk_in"],
      business_status: [
        "trialing",
        "active",
        "past_due",
        "suspended",
        "cancelled",
      ],
      ledger_direction: ["income", "expense"],
      payment_method: ["cash", "transfer", "nequi", "card", "other"],
    },
  },
} as const
