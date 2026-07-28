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
  public: {
    Tables: {
      notification_preferences: {
        Row: {
          created_at: string
          event_toggles: Json
          quiet_hours_end: number | null
          quiet_hours_start: number | null
          sounds_enabled: boolean
          updated_at: string
          user_id: string
          volume_normal: number
          volume_urgent: number
        }
        Insert: {
          created_at?: string
          event_toggles?: Json
          quiet_hours_end?: number | null
          quiet_hours_start?: number | null
          sounds_enabled?: boolean
          updated_at?: string
          user_id: string
          volume_normal?: number
          volume_urgent?: number
        }
        Update: {
          created_at?: string
          event_toggles?: Json
          quiet_hours_end?: number | null
          quiet_hours_start?: number | null
          sounds_enabled?: boolean
          updated_at?: string
          user_id?: string
          volume_normal?: number
          volume_urgent?: number
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          data: Json
          id: string
          is_read: boolean
          kind: string
          played_at: string | null
          severity: string
          task_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          data?: Json
          id?: string
          is_read?: boolean
          kind?: string
          played_at?: string | null
          severity?: string
          task_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          data?: Json
          id?: string
          is_read?: boolean
          kind?: string
          played_at?: string | null
          severity?: string
          task_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      overdue_events: {
        Row: {
          id: string
          sent_at: string
          stage: string
          task_id: string
          user_id: string
        }
        Insert: {
          id?: string
          sent_at?: string
          stage: string
          task_id: string
          user_id: string
        }
        Update: {
          id?: string
          sent_at?: string
          stage?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "overdue_events_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          archived_at: string | null
          avatar_url: string | null
          branch: string | null
          created_at: string
          department: string | null
          email: string
          full_name: string
          id: string
          is_active: boolean
          job_title: string | null
          last_sign_in_at: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          avatar_url?: string | null
          branch?: string | null
          created_at?: string
          department?: string | null
          email: string
          full_name?: string
          id: string
          is_active?: boolean
          job_title?: string | null
          last_sign_in_at?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          avatar_url?: string | null
          branch?: string | null
          created_at?: string
          department?: string | null
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          job_title?: string | null
          last_sign_in_at?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      task_activity: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json
          id: string
          task_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          task_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_activity_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          kind: string
          mime_type: string | null
          task_id: string
          uploader_id: string
          version: number
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          kind?: string
          mime_type?: string | null
          task_id: string
          uploader_id: string
          version?: number
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          kind?: string
          mime_type?: string | null
          task_id?: string
          uploader_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "task_attachments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          edited_at: string | null
          id: string
          is_internal: boolean
          is_pinned: boolean
          parent_id: string | null
          task_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          edited_at?: string | null
          id?: string
          is_internal?: boolean
          is_pinned?: boolean
          parent_id?: string | null
          task_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          is_internal?: boolean
          is_pinned?: boolean
          parent_id?: string | null
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "task_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          actual_delivery_date: string | null
          created_at: string
          created_by: string | null
          customer_name: string
          customer_type: Database["public"]["Enums"]["customer_type"] | null
          deleted_at: string | null
          delivered: boolean
          delivery_due_date: string | null
          delivery_due_time: string | null
          design_brief: string | null
          design_checklist: Json
          design_start_date: string | null
          design_status: Database["public"]["Enums"]["design_status"]
          designer_id: string | null
          designer_notes: string | null
          due_at: string | null
          files_url: string | null
          final_version_url: string | null
          id: string
          is_archived: boolean
          is_demo: boolean
          month_code: string
          order_details: string | null
          overall_status: Database["public"]["Enums"]["overall_status"]
          priority: Database["public"]["Enums"]["priority"]
          products: Database["public"]["Enums"]["product_service"][]
          reopen_note: string | null
          request_date: string | null
          revision_note: string | null
          sales_checklist: Json
          sales_client_revisions: string | null
          sales_owner_id: string | null
          size_qty_material: string | null
          stop_reason: string | null
          task_code: string | null
          task_name: string
          updated_at: string
        }
        Insert: {
          actual_delivery_date?: string | null
          created_at?: string
          created_by?: string | null
          customer_name?: string
          customer_type?: Database["public"]["Enums"]["customer_type"] | null
          deleted_at?: string | null
          delivered?: boolean
          delivery_due_date?: string | null
          delivery_due_time?: string | null
          design_brief?: string | null
          design_checklist?: Json
          design_start_date?: string | null
          design_status?: Database["public"]["Enums"]["design_status"]
          designer_id?: string | null
          designer_notes?: string | null
          due_at?: string | null
          files_url?: string | null
          final_version_url?: string | null
          id?: string
          is_archived?: boolean
          is_demo?: boolean
          month_code: string
          order_details?: string | null
          overall_status?: Database["public"]["Enums"]["overall_status"]
          priority?: Database["public"]["Enums"]["priority"]
          products?: Database["public"]["Enums"]["product_service"][]
          reopen_note?: string | null
          request_date?: string | null
          revision_note?: string | null
          sales_checklist?: Json
          sales_client_revisions?: string | null
          sales_owner_id?: string | null
          size_qty_material?: string | null
          stop_reason?: string | null
          task_code?: string | null
          task_name: string
          updated_at?: string
        }
        Update: {
          actual_delivery_date?: string | null
          created_at?: string
          created_by?: string | null
          customer_name?: string
          customer_type?: Database["public"]["Enums"]["customer_type"] | null
          deleted_at?: string | null
          delivered?: boolean
          delivery_due_date?: string | null
          delivery_due_time?: string | null
          design_brief?: string | null
          design_checklist?: Json
          design_start_date?: string | null
          design_status?: Database["public"]["Enums"]["design_status"]
          designer_id?: string | null
          designer_notes?: string | null
          due_at?: string | null
          files_url?: string | null
          final_version_url?: string | null
          id?: string
          is_archived?: boolean
          is_demo?: boolean
          month_code?: string
          order_details?: string | null
          overall_status?: Database["public"]["Enums"]["overall_status"]
          priority?: Database["public"]["Enums"]["priority"]
          products?: Database["public"]["Enums"]["product_service"][]
          reopen_note?: string | null
          request_date?: string | null
          revision_note?: string | null
          sales_checklist?: Json
          sales_client_revisions?: string | null
          sales_owner_id?: string | null
          size_qty_material?: string | null
          stop_reason?: string | null
          task_code?: string | null
          task_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_permission_overrides: {
        Row: {
          created_at: string
          id: string
          permission_key: string
          updated_at: string
          user_id: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          permission_key: string
          updated_at?: string
          user_id: string
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          permission_key?: string
          updated_at?: string
          user_id?: string
          value?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      verify_overdue_scan_secret: { Args: { _token: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "admin"
        | "sales_manager"
        | "sales_executive"
        | "design_manager"
        | "designer"
        | "view_only"
      customer_type: "عميل حالي" | "عميل جديد" | "عميل محتمل"
      design_status:
        | "لم يبدأ"
        | "قيد التنفيذ"
        | "مراجعة داخلية"
        | "تعديلات"
        | "بانتظار الاعتماد"
        | "معتمد"
        | "متوقف"
      overall_status:
        | "جديد"
        | "عند السيلز"
        | "جاهز للتصميم"
        | "قيد التصميم"
        | "تعديلات"
        | "بانتظار الاعتماد"
        | "مكتمل"
        | "متوقف"
      priority: "عاجل" | "عالية" | "متوسطة" | "عادية"
      product_service:
        | "طباعة ديجيتال"
        | "طباعة أوفست"
        | "علب وتغليف"
        | "ليبل واستيكر"
        | "بروشور وكتالوج"
        | "شيتات 50×70"
        | "أخرى"
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
      app_role: [
        "super_admin",
        "admin",
        "sales_manager",
        "sales_executive",
        "design_manager",
        "designer",
        "view_only",
      ],
      customer_type: ["عميل حالي", "عميل جديد", "عميل محتمل"],
      design_status: [
        "لم يبدأ",
        "قيد التنفيذ",
        "مراجعة داخلية",
        "تعديلات",
        "بانتظار الاعتماد",
        "معتمد",
        "متوقف",
      ],
      overall_status: [
        "جديد",
        "عند السيلز",
        "جاهز للتصميم",
        "قيد التصميم",
        "تعديلات",
        "بانتظار الاعتماد",
        "مكتمل",
        "متوقف",
      ],
      priority: ["عاجل", "عالية", "متوسطة", "عادية"],
      product_service: [
        "طباعة ديجيتال",
        "طباعة أوفست",
        "علب وتغليف",
        "ليبل واستيكر",
        "بروشور وكتالوج",
        "شيتات 50×70",
        "أخرى",
      ],
    },
  },
} as const
