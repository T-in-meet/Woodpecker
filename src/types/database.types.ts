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
          feedback_id: string | null;
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
          feedback_id?: string | null;
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
          feedback_id?: string | null;
          id?: string;
          metadata?: Json;
          title?: string;
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "admin_notification_events_feedback_id_fkey";
            columns: ["feedback_id"];
            isOneToOne: false;
            referencedRelation: "feedbacks";
            referencedColumns: ["id"];
          },
        ];
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
      ai_embedding_active_generations: {
        Row: {
          active_generation_id: string;
          active_model_config_id: string;
          input_kind: string;
          owner_user_id: string;
          source_id: string;
          source_type: string;
          updated_at: string;
        };
        Insert: {
          active_generation_id: string;
          active_model_config_id: string;
          input_kind: string;
          owner_user_id: string;
          source_id: string;
          source_type: string;
          updated_at?: string;
        };
        Update: {
          active_generation_id?: string;
          active_model_config_id?: string;
          input_kind?: string;
          owner_user_id?: string;
          source_id?: string;
          source_type?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_embedding_active_generations_model_config_id_fkey";
            columns: ["active_model_config_id"];
            isOneToOne: false;
            referencedRelation: "admin_ai_model_list";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_embedding_active_generations_model_config_id_fkey";
            columns: ["active_model_config_id"];
            isOneToOne: false;
            referencedRelation: "ai_model_configs";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_embeddings: {
        Row: {
          chunk_count: number;
          chunk_index: number;
          content_hash: string;
          created_at: string;
          embedding: string;
          generation_id: string;
          id: string;
          input_hash: string;
          input_kind: string;
          input_preview: string;
          input_text: string;
          model_config_id: string;
          owner_user_id: string;
          source_id: string;
          source_type: string;
          token_count: number | null;
        };
        Insert: {
          chunk_count?: number;
          chunk_index?: number;
          content_hash: string;
          created_at?: string;
          embedding: string;
          generation_id?: string;
          id?: string;
          input_hash: string;
          input_kind: string;
          input_preview: string;
          input_text: string;
          model_config_id: string;
          owner_user_id: string;
          source_id: string;
          source_type: string;
          token_count?: number | null;
        };
        Update: {
          chunk_count?: number;
          chunk_index?: number;
          content_hash?: string;
          created_at?: string;
          embedding?: string;
          generation_id?: string;
          id?: string;
          input_hash?: string;
          input_kind?: string;
          input_preview?: string;
          input_text?: string;
          model_config_id?: string;
          owner_user_id?: string;
          source_id?: string;
          source_type?: string;
          token_count?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "ai_embeddings_model_config_id_fkey";
            columns: ["model_config_id"];
            isOneToOne: false;
            referencedRelation: "admin_ai_model_list";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_embeddings_model_config_id_fkey";
            columns: ["model_config_id"];
            isOneToOne: false;
            referencedRelation: "ai_model_configs";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_model_configs: {
        Row: {
          capability: string;
          created_at: string;
          dimensions: number | null;
          display_name: string;
          distance_metric: string | null;
          id: string;
          is_active: boolean;
          model: string;
          notes: string | null;
          provider: string;
          updated_at: string;
        };
        Insert: {
          capability: string;
          created_at?: string;
          dimensions?: number | null;
          display_name: string;
          distance_metric?: string | null;
          id?: string;
          is_active?: boolean;
          model: string;
          notes?: string | null;
          provider: string;
          updated_at?: string;
        };
        Update: {
          capability?: string;
          created_at?: string;
          dimensions?: number | null;
          display_name?: string;
          distance_metric?: string | null;
          id?: string;
          is_active?: boolean;
          model?: string;
          notes?: string | null;
          provider?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      ai_prompt_agents: {
        Row: {
          created_at: string;
          description: string | null;
          display_name: string;
          id: string;
          purpose: string | null;
          tags: string[];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          display_name: string;
          id?: string;
          purpose?: string | null;
          tags?: string[];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          display_name?: string;
          id?: string;
          purpose?: string | null;
          tags?: string[];
          updated_at?: string;
        };
        Relationships: [];
      };
      ai_prompt_families: {
        Row: {
          agent_id: string;
          created_at: string;
          description: string | null;
          display_name: string;
          id: string;
          tags: string[];
          updated_at: string;
        };
        Insert: {
          agent_id: string;
          created_at?: string;
          description?: string | null;
          display_name: string;
          id?: string;
          tags?: string[];
          updated_at?: string;
        };
        Update: {
          agent_id?: string;
          created_at?: string;
          description?: string | null;
          display_name?: string;
          id?: string;
          tags?: string[];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_prompt_families_agent_id_fkey";
            columns: ["agent_id"];
            isOneToOne: false;
            referencedRelation: "admin_ai_agent_list";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_prompt_families_agent_id_fkey";
            columns: ["agent_id"];
            isOneToOne: false;
            referencedRelation: "ai_prompt_agents";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_prompt_versions: {
        Row: {
          change_summary: string | null;
          created_at: string;
          created_by: string | null;
          created_by_kind: string;
          display_name: string;
          family_id: string;
          id: string;
          lifecycle_status: string;
          response_schema: Json;
          system_template: string;
          tags: string[];
          user_template: string;
          variables: Json;
          version_number: number;
        };
        Insert: {
          change_summary?: string | null;
          created_at?: string;
          created_by?: string | null;
          created_by_kind?: string;
          display_name: string;
          family_id: string;
          id?: string;
          lifecycle_status?: string;
          response_schema?: Json;
          system_template: string;
          tags?: string[];
          user_template: string;
          variables?: Json;
          version_number: number;
        };
        Update: {
          change_summary?: string | null;
          created_at?: string;
          created_by?: string | null;
          created_by_kind?: string;
          display_name?: string;
          family_id?: string;
          id?: string;
          lifecycle_status?: string;
          response_schema?: Json;
          system_template?: string;
          tags?: string[];
          user_template?: string;
          variables?: Json;
          version_number?: number;
        };
        Relationships: [
          {
            foreignKeyName: "ai_prompt_versions_family_id_fkey";
            columns: ["family_id"];
            isOneToOne: false;
            referencedRelation: "admin_ai_prompt_family_list";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_prompt_versions_family_id_fkey";
            columns: ["family_id"];
            isOneToOne: false;
            referencedRelation: "admin_note_chat_run_detail";
            referencedColumns: ["prompt_family_id"];
          },
          {
            foreignKeyName: "ai_prompt_versions_family_id_fkey";
            columns: ["family_id"];
            isOneToOne: false;
            referencedRelation: "ai_prompt_families";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_setting_configurations: {
        Row: {
          created_at: string;
          id: string;
          kind: string;
          model_config_id: string;
          prompt_version_id: string | null;
          role_key: string;
          setting_id: string;
          sort_order: number;
          temperature: number | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          kind: string;
          model_config_id: string;
          prompt_version_id?: string | null;
          role_key: string;
          setting_id: string;
          sort_order?: number;
          temperature?: number | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          kind?: string;
          model_config_id?: string;
          prompt_version_id?: string | null;
          role_key?: string;
          setting_id?: string;
          sort_order?: number;
          temperature?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_setting_configurations_model_config_id_fkey";
            columns: ["model_config_id"];
            isOneToOne: false;
            referencedRelation: "admin_ai_model_list";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_setting_configurations_model_config_id_fkey";
            columns: ["model_config_id"];
            isOneToOne: false;
            referencedRelation: "ai_model_configs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_setting_configurations_prompt_version_id_fkey";
            columns: ["prompt_version_id"];
            isOneToOne: false;
            referencedRelation: "ai_prompt_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_setting_configurations_setting_id_fkey";
            columns: ["setting_id"];
            isOneToOne: false;
            referencedRelation: "ai_settings";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_settings: {
        Row: {
          created_at: string;
          description: string;
          display_name: string;
          id: string;
          key: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string;
          display_name: string;
          id?: string;
          key: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string;
          display_name?: string;
          id?: string;
          key?: string;
          updated_at?: string;
        };
        Relationships: [];
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
      feedbacks: {
        Row: {
          area: string;
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
          area?: string;
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
          area?: string;
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
      note_chat_conversations: {
        Row: {
          created_at: string;
          id: string;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          title: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "note_chat_conversations_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "admin_note_chat_run_detail";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "note_chat_conversations_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "admin_user_list";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "note_chat_conversations_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      note_chat_execution_claims: {
        Row: {
          claimed_at: string;
          completed_at: string | null;
          conversation_id: string;
          id: string;
          status: string;
          user_id: string;
        };
        Insert: {
          claimed_at?: string;
          completed_at?: string | null;
          conversation_id: string;
          id?: string;
          status?: string;
          user_id: string;
        };
        Update: {
          claimed_at?: string;
          completed_at?: string | null;
          conversation_id?: string;
          id?: string;
          status?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "note_chat_execution_claims_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "admin_note_chat_run_detail";
            referencedColumns: ["conversation_id"];
          },
          {
            foreignKeyName: "note_chat_execution_claims_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "note_chat_conversation_list";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "note_chat_execution_claims_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "note_chat_conversations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "note_chat_execution_claims_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "admin_note_chat_run_detail";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "note_chat_execution_claims_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "admin_user_list";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "note_chat_execution_claims_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      note_chat_messages: {
        Row: {
          content: Json;
          conversation_id: string;
          created_at: string;
          id: string;
          role: string;
          sequence_number: number;
          updated_at: string;
        };
        Insert: {
          content: Json;
          conversation_id: string;
          created_at?: string;
          id?: string;
          role: string;
          sequence_number: number;
          updated_at?: string;
        };
        Update: {
          content?: Json;
          conversation_id?: string;
          created_at?: string;
          id?: string;
          role?: string;
          sequence_number?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "note_chat_messages_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "admin_note_chat_run_detail";
            referencedColumns: ["conversation_id"];
          },
          {
            foreignKeyName: "note_chat_messages_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "note_chat_conversation_list";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "note_chat_messages_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "note_chat_conversations";
            referencedColumns: ["id"];
          },
        ];
      };
      note_chat_runs: {
        Row: {
          agent_id: string | null;
          answer_generation_cost_usd: number | null;
          answer_generation_usage: Json | null;
          assistant_message_id: string | null;
          chat_model_config_id: string | null;
          completed_at: string | null;
          created_at: string;
          embedding_model_config_id: string | null;
          expanded_query: string | null;
          failure_message: string | null;
          id: string;
          memo: string | null;
          memo_updated_at: string | null;
          prompt_version_id: string | null;
          query_embedding_cost_usd: number | null;
          query_embedding_usage: Json | null;
          query_expansion_cost_usd: number | null;
          query_expansion_usage: Json | null;
          sources: Json;
          started_at: string | null;
          status: string;
          total_cost_usd: number | null;
          updated_at: string;
          user_message_id: string;
        };
        Insert: {
          agent_id?: string | null;
          answer_generation_cost_usd?: number | null;
          answer_generation_usage?: Json | null;
          assistant_message_id?: string | null;
          chat_model_config_id?: string | null;
          completed_at?: string | null;
          created_at?: string;
          embedding_model_config_id?: string | null;
          expanded_query?: string | null;
          failure_message?: string | null;
          id?: string;
          memo?: string | null;
          memo_updated_at?: string | null;
          prompt_version_id?: string | null;
          query_embedding_cost_usd?: number | null;
          query_embedding_usage?: Json | null;
          query_expansion_cost_usd?: number | null;
          query_expansion_usage?: Json | null;
          sources?: Json;
          started_at?: string | null;
          status?: string;
          total_cost_usd?: number | null;
          updated_at?: string;
          user_message_id: string;
        };
        Update: {
          agent_id?: string | null;
          answer_generation_cost_usd?: number | null;
          answer_generation_usage?: Json | null;
          assistant_message_id?: string | null;
          chat_model_config_id?: string | null;
          completed_at?: string | null;
          created_at?: string;
          embedding_model_config_id?: string | null;
          expanded_query?: string | null;
          failure_message?: string | null;
          id?: string;
          memo?: string | null;
          memo_updated_at?: string | null;
          prompt_version_id?: string | null;
          query_embedding_cost_usd?: number | null;
          query_embedding_usage?: Json | null;
          query_expansion_cost_usd?: number | null;
          query_expansion_usage?: Json | null;
          sources?: Json;
          started_at?: string | null;
          status?: string;
          total_cost_usd?: number | null;
          updated_at?: string;
          user_message_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "note_chat_runs_agent_id_fkey";
            columns: ["agent_id"];
            isOneToOne: false;
            referencedRelation: "admin_ai_agent_list";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "note_chat_runs_agent_id_fkey";
            columns: ["agent_id"];
            isOneToOne: false;
            referencedRelation: "ai_prompt_agents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "note_chat_runs_assistant_message_id_fkey";
            columns: ["assistant_message_id"];
            isOneToOne: true;
            referencedRelation: "note_chat_conversation_list";
            referencedColumns: ["last_message_id"];
          },
          {
            foreignKeyName: "note_chat_runs_assistant_message_id_fkey";
            columns: ["assistant_message_id"];
            isOneToOne: true;
            referencedRelation: "note_chat_messages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "note_chat_runs_chat_model_config_id_fkey";
            columns: ["chat_model_config_id"];
            isOneToOne: false;
            referencedRelation: "admin_ai_model_list";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "note_chat_runs_chat_model_config_id_fkey";
            columns: ["chat_model_config_id"];
            isOneToOne: false;
            referencedRelation: "ai_model_configs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "note_chat_runs_embedding_model_config_id_fkey";
            columns: ["embedding_model_config_id"];
            isOneToOne: false;
            referencedRelation: "admin_ai_model_list";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "note_chat_runs_embedding_model_config_id_fkey";
            columns: ["embedding_model_config_id"];
            isOneToOne: false;
            referencedRelation: "ai_model_configs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "note_chat_runs_prompt_version_id_fkey";
            columns: ["prompt_version_id"];
            isOneToOne: false;
            referencedRelation: "ai_prompt_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "note_chat_runs_user_message_id_fkey";
            columns: ["user_message_id"];
            isOneToOne: false;
            referencedRelation: "note_chat_conversation_list";
            referencedColumns: ["last_message_id"];
          },
          {
            foreignKeyName: "note_chat_runs_user_message_id_fkey";
            columns: ["user_message_id"];
            isOneToOne: false;
            referencedRelation: "note_chat_messages";
            referencedColumns: ["id"];
          },
        ];
      };
      note_related_notes: {
        Row: {
          created_at: string;
          metadata: Json;
          note_id: string;
          origin: string;
          related_note_id: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          metadata?: Json;
          note_id: string;
          origin: string;
          related_note_id: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          metadata?: Json;
          note_id?: string;
          origin?: string;
          related_note_id?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "note_related_notes_note_id_fkey";
            columns: ["note_id"];
            isOneToOne: false;
            referencedRelation: "notes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "note_related_notes_related_note_id_fkey";
            columns: ["related_note_id"];
            isOneToOne: false;
            referencedRelation: "notes";
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
      quiz_generations: {
        Row: {
          claim_token: string | null;
          completed_at: string | null;
          created_at: string;
          id: string;
          note_id: string | null;
          quiz_type: string;
          user_id: string;
        };
        Insert: {
          claim_token?: string | null;
          completed_at?: string | null;
          created_at?: string;
          id?: string;
          note_id?: string | null;
          quiz_type: string;
          user_id: string;
        };
        Update: {
          claim_token?: string | null;
          completed_at?: string | null;
          created_at?: string;
          id?: string;
          note_id?: string | null;
          quiz_type?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "quiz_generations_note_id_fkey";
            columns: ["note_id"];
            isOneToOne: false;
            referencedRelation: "notes";
            referencedColumns: ["id"];
          },
        ];
      };
      quizzes: {
        Row: {
          created_at: string;
          id: string;
          note_content_hash: string;
          note_id: string;
          questions: Json;
          quiz_type: string;
          recent_questions: Json;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          note_content_hash: string;
          note_id: string;
          questions: Json;
          quiz_type: string;
          recent_questions?: Json;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          note_content_hash?: string;
          note_id?: string;
          questions?: Json;
          quiz_type?: string;
          recent_questions?: Json;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "quizzes_note_id_fkey";
            columns: ["note_id"];
            isOneToOne: false;
            referencedRelation: "notes";
            referencedColumns: ["id"];
          },
        ];
      };
      related_note_recommendation_execution_claims: {
        Row: {
          claimed_at: string;
          completed_at: string | null;
          id: string;
          note_id: string;
          source_updated_at: string;
          status: string;
          user_id: string;
        };
        Insert: {
          claimed_at?: string;
          completed_at?: string | null;
          id?: string;
          note_id: string;
          source_updated_at: string;
          status?: string;
          user_id: string;
        };
        Update: {
          claimed_at?: string;
          completed_at?: string | null;
          id?: string;
          note_id?: string;
          source_updated_at?: string;
          status?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "related_note_recommendation_execution_claims_note_id_fkey";
            columns: ["note_id"];
            isOneToOne: false;
            referencedRelation: "notes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "related_note_recommendation_execution_claims_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "admin_note_chat_run_detail";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "related_note_recommendation_execution_claims_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "admin_user_list";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "related_note_recommendation_execution_claims_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      related_note_recommendation_runs: {
        Row: {
          answer_generation_cost_usd: number | null;
          answer_generation_model_config_id: string | null;
          answer_generation_usage: Json | null;
          completed_at: string | null;
          created_at: string;
          embedding_model_config_id: string | null;
          expanded_query: string | null;
          failure_message: string | null;
          id: string;
          matched_note_ids: string[];
          note_id: string;
          query_embedding_cost_usd: number | null;
          query_embedding_usage: Json | null;
          query_expansion_cost_usd: number | null;
          query_expansion_model_config_id: string | null;
          query_expansion_usage: Json | null;
          recommendations: Json;
          source_updated_at: string | null;
          started_at: string;
          status: string;
          total_cost_usd: number | null;
          updated_at: string;
          user_id: string;
          verification_cost_usd: number | null;
          verification_model_config_id: string | null;
          verification_results: Json;
          verification_usage: Json | null;
        };
        Insert: {
          answer_generation_cost_usd?: number | null;
          answer_generation_model_config_id?: string | null;
          answer_generation_usage?: Json | null;
          completed_at?: string | null;
          created_at?: string;
          embedding_model_config_id?: string | null;
          expanded_query?: string | null;
          failure_message?: string | null;
          id?: string;
          matched_note_ids?: string[];
          note_id: string;
          query_embedding_cost_usd?: number | null;
          query_embedding_usage?: Json | null;
          query_expansion_cost_usd?: number | null;
          query_expansion_model_config_id?: string | null;
          query_expansion_usage?: Json | null;
          recommendations?: Json;
          source_updated_at?: string | null;
          started_at?: string;
          status?: string;
          total_cost_usd?: number | null;
          updated_at?: string;
          user_id: string;
          verification_cost_usd?: number | null;
          verification_model_config_id?: string | null;
          verification_results?: Json;
          verification_usage?: Json | null;
        };
        Update: {
          answer_generation_cost_usd?: number | null;
          answer_generation_model_config_id?: string | null;
          answer_generation_usage?: Json | null;
          completed_at?: string | null;
          created_at?: string;
          embedding_model_config_id?: string | null;
          expanded_query?: string | null;
          failure_message?: string | null;
          id?: string;
          matched_note_ids?: string[];
          note_id?: string;
          query_embedding_cost_usd?: number | null;
          query_embedding_usage?: Json | null;
          query_expansion_cost_usd?: number | null;
          query_expansion_model_config_id?: string | null;
          query_expansion_usage?: Json | null;
          recommendations?: Json;
          source_updated_at?: string | null;
          started_at?: string;
          status?: string;
          total_cost_usd?: number | null;
          updated_at?: string;
          user_id?: string;
          verification_cost_usd?: number | null;
          verification_model_config_id?: string | null;
          verification_results?: Json;
          verification_usage?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: "related_note_recommendation_runs_note_id_fkey";
            columns: ["note_id"];
            isOneToOne: false;
            referencedRelation: "notes";
            referencedColumns: ["id"];
          },
        ];
      };
      review_grading_generations: {
        Row: {
          created_at: string;
          id: string;
          review_log_id: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          review_log_id?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          review_log_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "review_grading_generations_review_log_id_fkey";
            columns: ["review_log_id"];
            isOneToOne: false;
            referencedRelation: "review_logs";
            referencedColumns: ["id"];
          },
        ];
      };
      review_gradings: {
        Row: {
          claim_token: string | null;
          created_at: string;
          feedback: Json | null;
          graded_content_hash: string | null;
          id: string;
          note_id: string;
          review_log_id: string;
          round: number;
          score: number | null;
          user_answer: string;
          user_id: string;
        };
        Insert: {
          claim_token?: string | null;
          created_at?: string;
          feedback?: Json | null;
          graded_content_hash?: string | null;
          id?: string;
          note_id: string;
          review_log_id: string;
          round: number;
          score?: number | null;
          user_answer: string;
          user_id: string;
        };
        Update: {
          claim_token?: string | null;
          created_at?: string;
          feedback?: Json | null;
          graded_content_hash?: string | null;
          id?: string;
          note_id?: string;
          review_log_id?: string;
          round?: number;
          score?: number | null;
          user_answer?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "review_gradings_note_id_fkey";
            columns: ["note_id"];
            isOneToOne: false;
            referencedRelation: "notes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "review_gradings_review_log_id_fkey";
            columns: ["review_log_id"];
            isOneToOne: false;
            referencedRelation: "review_logs";
            referencedColumns: ["id"];
          },
        ];
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
      user_legal_acceptances: {
        Row: {
          document_version: string;
          event_type: string;
          id: number;
          occurred_at: string;
          source: string;
          user_id: string;
        };
        Insert: {
          document_version: string;
          event_type: string;
          id?: never;
          occurred_at?: string;
          source: string;
          user_id: string;
        };
        Update: {
          document_version?: string;
          event_type?: string;
          id?: never;
          occurred_at?: string;
          source?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      admin_ai_agent_list: {
        Row: {
          created_at: string | null;
          display_name: string | null;
          family_count: number | null;
          id: string | null;
          purpose: string | null;
          updated_at: string | null;
        };
        Relationships: [];
      };
      admin_ai_model_list: {
        Row: {
          capability: string | null;
          created_at: string | null;
          display_name: string | null;
          embedding_reference_count: number | null;
          id: string | null;
          is_active: boolean | null;
          model: string | null;
          provider: string | null;
          updated_at: string | null;
        };
        Relationships: [];
      };
      admin_ai_prompt_family_list: {
        Row: {
          agent_display_name: string | null;
          agent_id: string | null;
          archived_version_count: number | null;
          created_at: string | null;
          display_name: string | null;
          draft_version_count: number | null;
          id: string | null;
          published_version_count: number | null;
          updated_at: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "ai_prompt_families_agent_id_fkey";
            columns: ["agent_id"];
            isOneToOne: false;
            referencedRelation: "admin_ai_agent_list";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_prompt_families_agent_id_fkey";
            columns: ["agent_id"];
            isOneToOne: false;
            referencedRelation: "ai_prompt_agents";
            referencedColumns: ["id"];
          },
        ];
      };
      admin_note_chat_run_detail: {
        Row: {
          agent_display_name: string | null;
          agent_id: string | null;
          answer_generation_cost_usd: number | null;
          answer_generation_usage: Json | null;
          assistant_message_content: Json | null;
          assistant_message_created_at: string | null;
          assistant_message_id: string | null;
          assistant_message_sequence_number: number | null;
          assistant_message_updated_at: string | null;
          chat_model_config_id: string | null;
          chat_model_display_name: string | null;
          completed_at: string | null;
          conversation_id: string | null;
          conversation_title: string | null;
          created_at: string | null;
          embedding_model_config_id: string | null;
          embedding_model_display_name: string | null;
          expanded_query: string | null;
          failure_message: string | null;
          id: string | null;
          memo: string | null;
          memo_updated_at: string | null;
          prompt_family_display_name: string | null;
          prompt_family_id: string | null;
          prompt_version_display_name: string | null;
          prompt_version_id: string | null;
          prompt_version_number: number | null;
          query_embedding_cost_usd: number | null;
          query_embedding_usage: Json | null;
          query_expansion_cost_usd: number | null;
          query_expansion_usage: Json | null;
          sources: Json | null;
          started_at: string | null;
          status: string | null;
          total_cost_usd: number | null;
          updated_at: string | null;
          user_avatar_url: string | null;
          user_id: string | null;
          user_message_content: Json | null;
          user_message_created_at: string | null;
          user_message_id: string | null;
          user_message_sequence_number: number | null;
          user_message_updated_at: string | null;
          user_nickname: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "note_chat_runs_agent_id_fkey";
            columns: ["agent_id"];
            isOneToOne: false;
            referencedRelation: "admin_ai_agent_list";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "note_chat_runs_agent_id_fkey";
            columns: ["agent_id"];
            isOneToOne: false;
            referencedRelation: "ai_prompt_agents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "note_chat_runs_assistant_message_id_fkey";
            columns: ["assistant_message_id"];
            isOneToOne: true;
            referencedRelation: "note_chat_conversation_list";
            referencedColumns: ["last_message_id"];
          },
          {
            foreignKeyName: "note_chat_runs_assistant_message_id_fkey";
            columns: ["assistant_message_id"];
            isOneToOne: true;
            referencedRelation: "note_chat_messages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "note_chat_runs_chat_model_config_id_fkey";
            columns: ["chat_model_config_id"];
            isOneToOne: false;
            referencedRelation: "admin_ai_model_list";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "note_chat_runs_chat_model_config_id_fkey";
            columns: ["chat_model_config_id"];
            isOneToOne: false;
            referencedRelation: "ai_model_configs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "note_chat_runs_embedding_model_config_id_fkey";
            columns: ["embedding_model_config_id"];
            isOneToOne: false;
            referencedRelation: "admin_ai_model_list";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "note_chat_runs_embedding_model_config_id_fkey";
            columns: ["embedding_model_config_id"];
            isOneToOne: false;
            referencedRelation: "ai_model_configs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "note_chat_runs_prompt_version_id_fkey";
            columns: ["prompt_version_id"];
            isOneToOne: false;
            referencedRelation: "ai_prompt_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "note_chat_runs_user_message_id_fkey";
            columns: ["user_message_id"];
            isOneToOne: false;
            referencedRelation: "note_chat_conversation_list";
            referencedColumns: ["last_message_id"];
          },
          {
            foreignKeyName: "note_chat_runs_user_message_id_fkey";
            columns: ["user_message_id"];
            isOneToOne: false;
            referencedRelation: "note_chat_messages";
            referencedColumns: ["id"];
          },
        ];
      };
      admin_user_list: {
        Row: {
          agreement_source: string | null;
          agreement_status: string | null;
          avatar_url: string | null;
          canonical_email: string | null;
          created_at: string | null;
          id: string | null;
          nickname: string | null;
          privacy_agreed: boolean | null;
          role: string | null;
          signup_method: string | null;
          terms_agreed: boolean | null;
        };
        Relationships: [];
      };
      note_chat_conversation_list: {
        Row: {
          created_at: string | null;
          id: string | null;
          last_message_content: Json | null;
          last_message_created_at: string | null;
          last_message_id: string | null;
          last_message_role: string | null;
          title: string | null;
          updated_at: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      activate_ai_embedding_generation: {
        Args: {
          p_generation_id: string;
          p_input_kind: string;
          p_model_config_id: string;
          p_owner_user_id: string;
          p_source_id: string;
          p_source_type: string;
          p_source_updated_at: string;
        };
        Returns: undefined;
      };
      add_note_related_manual: {
        Args: { p_note_id: string; p_related_notes: Json };
        Returns: undefined;
      };
      apply_time_of_day: { Args: { t: string; ts: string }; Returns: string };
      apply_time_of_day_not_before: {
        Args: { t: string; ts: string };
        Returns: string;
      };
      archive_ai_prompt_version: {
        Args: { p_version_id: string };
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
      claim_note_chat_execution: {
        Args: {
          p_conversation_id: string;
          p_daily_execution_limit: number;
          p_user_id: string;
        };
        Returns: {
          claim_id: string;
          status: string;
        }[];
      };
      claim_quiz_generation_v2: {
        Args: { p_note_id: string; p_quiz_type: string; p_user_id: string };
        Returns: Json;
      };
      claim_related_note_recommendation_execution: {
        Args: {
          p_daily_recommendation_limit: number;
          p_note_id: string;
          p_source_updated_at: string;
          p_user_id: string;
        };
        Returns: {
          claim_id: string;
          status: string;
        }[];
      };
      claim_review_grading: {
        Args: {
          p_content_hash: string;
          p_review_log_id: string;
          p_user_answer: string;
          p_user_id: string;
        };
        Returns: Json;
      };
      cleanup_related_note_recommendation_stale_execution_claims: {
        Args: { p_note_id: string };
        Returns: number;
      };
      complete_note_chat_execution_claim: {
        Args: { p_claim_id: string; p_status: string };
        Returns: string;
      };
      complete_note_chat_execution_success: {
        Args: {
          p_claim_id: string;
          p_content: Json;
          p_user_id: string;
          p_user_message_id: string;
        };
        Returns: string;
      };
      complete_related_note_recommendation_execution_claim: {
        Args: { p_claim_id: string; p_status: string };
        Returns: string;
      };
      complete_review_and_schedule_next: {
        Args: { p_note_id: string; p_review_log_id: string };
        Returns: string;
      };
      create_ai_prompt_family_with_initial_version: {
        Args: {
          p_admin_user_id: string;
          p_agent_id: string;
          p_change_summary: string;
          p_description: string;
          p_display_name: string;
          p_response_schema: Json;
          p_system_template: string;
          p_tags: string[];
          p_user_template: string;
          p_variables: Json;
          p_version_display_name: string;
        };
        Returns: string;
      };
      create_ai_prompt_version: {
        Args: {
          p_admin_user_id: string;
          p_change_summary: string;
          p_display_name: string;
          p_family_id: string;
          p_response_schema: Json;
          p_system_template: string;
          p_tags: string[];
          p_user_template: string;
          p_variables: Json;
        };
        Returns: string;
      };
      create_note_chat_assistant_message: {
        Args: { p_content: Json; p_user_id: string; p_user_message_id: string };
        Returns: string;
      };
      create_note_chat_question: {
        Args: { p_content: Json; p_conversation_id: string; p_user_id: string };
        Returns: string;
      };
      create_note_with_initial_review_log: {
        Args: { p_content: string; p_scheduled_at: string; p_title: string };
        Returns: string;
      };
      delete_admin_ai_agent: { Args: { p_agent_id: string }; Returns: string };
      delete_admin_ai_prompt_family: {
        Args: { p_family_id: string };
        Returns: string;
      };
      delete_feedback_reply_with_notifications: {
        Args: { p_feedback_id: string };
        Returns: {
          deleted_notification_count: number;
          image_paths: string[];
        }[];
      };
      delete_inactive_ai_embedding_generation: {
        Args: {
          p_generation_id: string;
          p_input_kind: string;
          p_model_config_id: string;
          p_owner_user_id: string;
          p_source_id: string;
          p_source_type: string;
        };
        Returns: number;
      };
      delete_note_related: {
        Args: { p_note_id: string; p_related_note_id: string };
        Returns: undefined;
      };
      finalize_quiz_generation_v2:
        | {
            Args: {
              p_claim_token: string;
              p_note_id: string;
              p_quiz_type: string;
              p_user_id: string;
            };
            Returns: string;
          }
        | {
            Args: {
              p_claim_token: string;
              p_content_hash: string;
              p_history: Json;
              p_note_id: string;
              p_questions: Json;
              p_quiz_type: string;
              p_user_id: string;
            };
            Returns: string;
          };
      finalize_review_grading: {
        Args: {
          p_claim_token: string;
          p_feedback: Json;
          p_review_log_id: string;
          p_score: number;
          p_user_id: string;
        };
        Returns: string;
      };
      get_admin_ai_agent_list: {
        Args: {
          p_created_from: string;
          p_created_to: string;
          p_family_count_max: number;
          p_family_count_min: number;
          p_page: number;
          p_page_size: number;
          p_search_field: string;
          p_search_query: string;
          p_sort_direction: string;
          p_sort_field: string;
          p_updated_from: string;
          p_updated_to: string;
        };
        Returns: {
          items: Json;
          total_count: number;
        }[];
      };
      get_admin_ai_model_list: {
        Args: {
          p_capability_filters: string[];
          p_created_from: string;
          p_created_to: string;
          p_is_active_filter: boolean;
          p_page: number;
          p_page_size: number;
          p_provider_filters: string[];
          p_reference_count_max: number;
          p_reference_count_min: number;
          p_search_field: string;
          p_search_query: string;
          p_sort_direction: string;
          p_sort_field: string;
          p_updated_from: string;
          p_updated_to: string;
        };
        Returns: {
          items: Json;
          total_count: number;
        }[];
      };
      get_admin_ai_prompt_family_list: {
        Args: {
          p_agent_id_filters: string[];
          p_archived_count_max: number;
          p_archived_count_min: number;
          p_created_from: string;
          p_created_to: string;
          p_draft_count_max: number;
          p_draft_count_min: number;
          p_page: number;
          p_page_size: number;
          p_published_count_max: number;
          p_published_count_min: number;
          p_search_field: string;
          p_search_query: string;
          p_sort_direction: string;
          p_sort_field: string;
          p_updated_from: string;
          p_updated_to: string;
        };
        Returns: {
          items: Json;
          total_count: number;
        }[];
      };
      get_admin_ai_setting_list: {
        Args: {
          p_chat_count_max?: number;
          p_chat_count_min?: number;
          p_chat_model_id_filters?: string[];
          p_created_from?: string;
          p_created_to?: string;
          p_embedding_count_max?: number;
          p_embedding_count_min?: number;
          p_embedding_model_id_filters?: string[];
          p_page?: number;
          p_page_size?: number;
          p_search_field?: string;
          p_search_query?: string;
          p_sort_direction?: string;
          p_sort_field?: string;
          p_updated_from?: string;
          p_updated_to?: string;
        };
        Returns: {
          items: Json;
          total_count: number;
        }[];
      };
      get_admin_note_chat_run_list: {
        Args: {
          p_chat_model_config_id_filters: string[];
          p_created_from: string;
          p_created_to: string;
          p_has_memo_filter: boolean;
          p_page: number;
          p_page_size: number;
          p_search_query: string;
          p_sort_direction: string;
          p_sort_field: string;
          p_status_filters: string[];
        };
        Returns: {
          items: Json;
          total_count: number;
        }[];
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
          body: string;
          click_path: string;
          created_at: string;
          id: string;
          title: string;
          type: string;
        }[];
      };
      get_note_chat_daily_usage: { Args: never; Returns: number };
      get_related_note_recommendation_daily_usage: {
        Args: { p_note_id: string };
        Returns: number;
      };
      increment_operational_error_occurrence: {
        Args: {
          p_actor_user_id: string;
          p_context: Json;
          p_id: string;
          p_message: string;
          p_severity: string;
          p_user_id: string;
        };
        Returns: string;
      };
      is_current_user_email_confirmed: { Args: never; Returns: boolean };
      kst_date: { Args: { ts: string }; Returns: string };
      kst_day_start: { Args: { ts: string }; Returns: string };
      lock_note_related_note_pair: {
        Args: { p_note_id: string; p_related_note_id: string };
        Returns: undefined;
      };
      mark_all_admin_notifications_as_read: {
        Args: { p_admin_user_id: string };
        Returns: number;
      };
      mark_notification_as_read: {
        Args: { p_notification_id: string };
        Returns: boolean;
      };
      match_ai_embeddings: {
        Args: {
          p_exclude_source_ids?: string[];
          p_input_kind: string;
          p_limit?: number;
          p_min_similarity?: number;
          p_model_config_id: string;
          p_owner_user_id: string;
          p_query_embedding: string;
          p_source_type: string;
        };
        Returns: {
          chunk_index: number;
          distance: number;
          embedding_id: string;
          similarity: number;
          source_id: string;
        }[];
      };
      publish_ai_prompt_version: {
        Args: { p_version_id: string };
        Returns: string;
      };
      replace_note_related_ai_recommendations: {
        Args: {
          p_note_id: string;
          p_owner_user_id: string;
          p_recommendations: Json;
          p_source_updated_at: string;
        };
        Returns: string;
      };
      save_ai_setting_configurations: {
        Args: { p_configurations: Json; p_setting_id: string };
        Returns: undefined;
      };
      update_note_chat_user_message: {
        Args: { p_content: Json; p_message_id: string; p_user_id: string };
        Returns: {
          conversation_id: string;
          user_message_id: string;
        }[];
      };
      update_note_related_manual_reason: {
        Args: {
          p_note_id: string;
          p_reason?: string;
          p_related_note_id: string;
        };
        Returns: undefined;
      };
      update_notification_schedule: {
        Args: { p_note_id: string; p_scheduled_at: string };
        Returns: undefined;
      };
      update_notification_time_of_day: {
        Args: { p_note_id: string; p_time?: string };
        Returns: undefined;
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
