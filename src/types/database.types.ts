export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      admin_notification_events: {
        Row: {
          body: string | null;
          click_path: string;
          created_at: string;
          created_by: string | null;
          id: string;
          metadata: Json;
          title: string;
          type: string;
        };
        Insert: {
          body?: string | null;
          click_path: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          metadata?: Json;
          title: string;
          type: string;
        };
        Update: {
          body?: string | null;
          click_path?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          metadata?: Json;
          title?: string;
          type?: string;
        };
        Relationships: [];
      };
      admin_notification_reads: {
        Row: {
          admin_user_id: string;
          event_id: string;
          read_at: string;
        };
        Insert: {
          admin_user_id: string;
          event_id: string;
          read_at?: string;
        };
        Update: {
          admin_user_id?: string;
          event_id?: string;
          read_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "admin_notification_reads_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "admin_notification_events";
            referencedColumns: ["id"];
          },
        ];
      };
      feedbacks: {
        Row: {
          category: string;
          content: string;
          created_at: string;
          id: string;
          image_urls: string[];
          note_id: string | null;
          status: string;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          category: string;
          content: string;
          created_at?: string;
          id?: string;
          image_urls?: string[];
          note_id?: string | null;
          status?: string;
          title: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          category?: string;
          content?: string;
          created_at?: string;
          id?: string;
          image_urls?: string[];
          note_id?: string | null;
          status?: string;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "feedbacks_note_id_fkey";
            columns: ["note_id"];
            isOneToOne: false;
            referencedRelation: "notes";
            referencedColumns: ["id"];
          },
        ];
      };
      feedback_replies: {
        Row: {
          content: string;
          created_at: string;
          created_by: string;
          feedback_id: string;
          id: string;
          image_paths: string[];
          title: string;
          updated_at: string;
        };
        Insert: {
          content: string;
          created_at?: string;
          created_by: string;
          feedback_id: string;
          id?: string;
          image_paths?: string[];
          title: string;
          updated_at?: string;
        };
        Update: {
          content?: string;
          created_at?: string;
          created_by?: string;
          feedback_id?: string;
          id?: string;
          image_paths?: string[];
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "feedback_replies_feedback_id_fkey";
            columns: ["feedback_id"];
            isOneToOne: true;
            referencedRelation: "feedbacks";
            referencedColumns: ["id"];
          },
        ];
      };
      notes: {
        Row: {
          content: string;
          created_at: string;
          id: string;
          next_review_at: string | null;
          notification_time_of_day: string | null;
          review_round: number;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          content: string;
          created_at?: string;
          id?: string;
          next_review_at?: string | null;
          notification_time_of_day?: string | null;
          review_round?: number;
          title: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          content?: string;
          created_at?: string;
          id?: string;
          next_review_at?: string | null;
          notification_time_of_day?: string | null;
          review_round?: number;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          body: string | null;
          click_path: string;
          id: string;
          metadata: Json;
          note_id: string | null;
          read_at: string | null;
          review_log_id: string | null;
          sent_at: string;
          status: string;
          title: string;
          type: string;
          user_id: string;
        };
        Insert: {
          body?: string | null;
          click_path: string;
          id?: string;
          metadata?: Json;
          note_id?: string | null;
          read_at?: string | null;
          review_log_id?: string | null;
          sent_at?: string;
          status?: string;
          title: string;
          type: string;
          user_id: string;
        };
        Update: {
          body?: string | null;
          click_path?: string;
          id?: string;
          metadata?: Json;
          note_id?: string | null;
          read_at?: string | null;
          review_log_id?: string | null;
          sent_at?: string;
          status?: string;
          title?: string;
          type?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_note_id_fkey";
            columns: ["note_id"];
            isOneToOne: false;
            referencedRelation: "notes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_review_log_id_fkey";
            columns: ["review_log_id"];
            isOneToOne: false;
            referencedRelation: "review_logs";
            referencedColumns: ["id"];
          },
        ];
      };
      operational_errors: {
        Row: {
          actor_user_id: string | null;
          context: Json;
          created_at: string;
          error_code: string;
          feature: string;
          fingerprint: string;
          first_seen_at: string;
          id: string;
          last_seen_at: string;
          message: string;
          occurrence_count: number;
          operation: string;
          resolution_note: string | null;
          resolved_at: string | null;
          resolved_by: string | null;
          severity: string;
          stage: string;
          status: string;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          actor_user_id?: string | null;
          context?: Json;
          created_at?: string;
          error_code: string;
          feature: string;
          fingerprint: string;
          first_seen_at?: string;
          id?: string;
          last_seen_at?: string;
          message: string;
          occurrence_count?: number;
          operation: string;
          resolution_note?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          severity: string;
          stage: string;
          status?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          actor_user_id?: string | null;
          context?: Json;
          created_at?: string;
          error_code?: string;
          feature?: string;
          fingerprint?: string;
          first_seen_at?: string;
          id?: string;
          last_seen_at?: string;
          message?: string;
          occurrence_count?: number;
          operation?: string;
          resolution_note?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          severity?: string;
          stage?: string;
          status?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      operational_error_status_history: {
        Row: {
          changed_by: string | null;
          created_at: string;
          from_status: string | null;
          id: string;
          note: string | null;
          operational_error_id: string;
          to_status: string;
        };
        Insert: {
          changed_by?: string | null;
          created_at?: string;
          from_status?: string | null;
          id?: string;
          note?: string | null;
          operational_error_id: string;
          to_status: string;
        };
        Update: {
          changed_by?: string | null;
          created_at?: string;
          from_status?: string | null;
          id?: string;
          note?: string | null;
          operational_error_id?: string;
          to_status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "operational_error_status_history_error_id_fkey";
            columns: ["operational_error_id"];
            isOneToOne: false;
            referencedRelation: "operational_errors";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          canonical_email: string | null;
          created_at: string;
          id: string;
          nickname: string;
          role: string;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          canonical_email?: string | null;
          created_at?: string;
          id: string;
          nickname: string;
          role?: string;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          canonical_email?: string | null;
          created_at?: string;
          id?: string;
          nickname?: string;
          role?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_agreements: {
        Row: {
          created_at: string;
          privacy_agreed_at: string;
          source: string;
          terms_agreed_at: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          privacy_agreed_at: string;
          source: string;
          terms_agreed_at: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          privacy_agreed_at?: string;
          source?: string;
          terms_agreed_at?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      push_subscriptions: {
        Row: {
          auth: string;
          created_at: string;
          endpoint: string;
          id: string;
          p256dh: string;
          user_id: string;
        };
        Insert: {
          auth: string;
          created_at?: string;
          endpoint: string;
          id?: string;
          p256dh: string;
          user_id: string;
        };
        Update: {
          auth?: string;
          created_at?: string;
          endpoint?: string;
          id?: string;
          p256dh?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      review_logs: {
        Row: {
          completed_at: string | null;
          created_at: string;
          id: string;
          note_id: string;
          notification_base_scheduled_at: string | null;
          notification_claimed_at: string | null;
          notification_dispatch_attempts: number;
          notification_dispatch_failed_at: string | null;
          notification_dispatched_at: string | null;
          round: number;
          scheduled_at: string;
          user_id: string;
        };
        Insert: {
          completed_at?: string | null;
          created_at?: string;
          id?: string;
          note_id: string;
          notification_base_scheduled_at?: string | null;
          notification_claimed_at?: string | null;
          notification_dispatch_attempts?: number;
          notification_dispatch_failed_at?: string | null;
          notification_dispatched_at?: string | null;
          round: number;
          scheduled_at: string;
          user_id: string;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string;
          id?: string;
          note_id?: string;
          notification_base_scheduled_at?: string | null;
          notification_claimed_at?: string | null;
          notification_dispatch_attempts?: number;
          notification_dispatch_failed_at?: string | null;
          notification_dispatched_at?: string | null;
          round?: number;
          scheduled_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "review_logs_note_id_fkey";
            columns: ["note_id"];
            isOneToOne: false;
            referencedRelation: "notes";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      apply_time_of_day: { Args: { t: string; ts: string }; Returns: string };
      apply_time_of_day_not_before: {
        Args: { t: string; ts: string };
        Returns: string;
      };
      claim_due_review_logs: {
        Args: { p_limit?: number };
        Returns: {
          id: string;
          note_id: string;
          round: number;
          scheduled_at: string;
          user_id: string;
        }[];
      };
      complete_review_and_schedule_next: {
        Args: { p_note_id: string; p_review_log_id: string };
        Returns: string;
      };
      get_admin_unread_notification_counts: {
        Args: { p_admin_user_id: string };
        Returns: {
          type: string;
          unread_count: number;
        }[];
      };
      get_admin_unread_notification_list: {
        Args: { p_admin_user_id: string; p_limit?: number };
        Returns: {
          body: string | null;
          click_path: string;
          created_at: string;
          id: string;
          title: string;
          type: string;
        }[];
      };
      increment_operational_error_occurrence: {
        Args: {
          p_actor_user_id: string | null;
          p_context: Json;
          p_id: string;
          p_message: string;
          p_severity: string;
          p_user_id: string | null;
        };
        Returns: string;
      };
      update_operational_error_status_with_history: {
        Args: {
          p_admin_user_id: string;
          p_operational_error_id: string;
          p_resolution_note: string;
          p_status: string;
        };
        Returns: string;
      };
      create_note_with_initial_review_log: {
        Args: { p_content: string; p_scheduled_at: string; p_title: string };
        Returns: string;
      };
      is_current_user_email_confirmed: { Args: never; Returns: boolean };
      kst_date: { Args: { ts: string }; Returns: string };
      mark_notification_as_read: {
        Args: { p_notification_id: string };
        Returns: boolean;
      };
      update_notification_time_of_day: {
        Args: { p_note_id: string; p_time?: string };
        Returns: undefined;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
