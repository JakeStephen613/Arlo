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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      assigned_sessions: {
        Row: {
          assigned_at: string | null
          completed_at: string | null
          description: string | null
          id: string
          session_plan: Json
          status: string | null
          student_id: string
          title: string
          tutor_id: string
        }
        Insert: {
          assigned_at?: string | null
          completed_at?: string | null
          description?: string | null
          id?: string
          session_plan?: Json
          status?: string | null
          student_id: string
          title: string
          tutor_id: string
        }
        Update: {
          assigned_at?: string | null
          completed_at?: string | null
          description?: string | null
          id?: string
          session_plan?: Json
          status?: string | null
          student_id?: string
          title?: string
          tutor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assigned_sessions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assigned_sessions_tutor_id_fkey"
            columns: ["tutor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      context_cache: {
        Row: {
          cached_json: Json
          last_updated: string
          user_id: string
        }
        Insert: {
          cached_json: Json
          last_updated?: string
          user_id: string
        }
        Update: {
          cached_json?: Json
          last_updated?: string
          user_id?: string
        }
        Relationships: []
      }
      context_log: {
        Row: {
          current_topic: string | null
          emphasized_facts: string[] | null
          feedback_flag: boolean | null
          id: number
          learning_event: Json | null
          preferred_learning_styles: string[] | null
          review_queue: string[] | null
          source: string | null
          timestamp: string
          user_goals: string[] | null
          user_id: string | null
          weak_areas: string[] | null
        }
        Insert: {
          current_topic?: string | null
          emphasized_facts?: string[] | null
          feedback_flag?: boolean | null
          id?: number
          learning_event?: Json | null
          preferred_learning_styles?: string[] | null
          review_queue?: string[] | null
          source?: string | null
          timestamp?: string
          user_goals?: string[] | null
          user_id?: string | null
          weak_areas?: string[] | null
        }
        Update: {
          current_topic?: string | null
          emphasized_facts?: string[] | null
          feedback_flag?: boolean | null
          id?: number
          learning_event?: Json | null
          preferred_learning_styles?: string[] | null
          review_queue?: string[] | null
          source?: string | null
          timestamp?: string
          user_goals?: string[] | null
          user_id?: string | null
          weak_areas?: string[] | null
        }
        Relationships: []
      }
      context_state: {
        Row: {
          context: Json
          last_updated: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          context: Json
          last_updated?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          context?: Json
          last_updated?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      paused_sessions: {
        Row: {
          created_at: string
          current_block_index: number
          expires_at: string
          id: string
          paused_at: string
          progress_data: Json
          session_plan: Json
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_block_index?: number
          expires_at?: string
          id?: string
          paused_at?: string
          progress_data?: Json
          session_plan?: Json
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_block_index?: number
          expires_at?: string
          id?: string
          paused_at?: string
          progress_data?: Json
          session_plan?: Json
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_mode: Database["public"]["Enums"]["account_mode"]
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          tutor_code: string | null
          updated_at: string
        }
        Insert: {
          account_mode?: Database["public"]["Enums"]["account_mode"]
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          tutor_code?: string | null
          updated_at?: string
        }
        Update: {
          account_mode?: Database["public"]["Enums"]["account_mode"]
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          tutor_code?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      study_session_data: {
        Row: {
          created_at: string
          duration_minutes: number
          flashcards: Json | null
          id: string
          quiz_mistakes: Json | null
          review_sheet: Json | null
          timestamp: string
          topic: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_minutes: number
          flashcards?: Json | null
          id?: string
          quiz_mistakes?: Json | null
          review_sheet?: Json | null
          timestamp?: string
          topic: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          duration_minutes?: number
          flashcards?: Json | null
          id?: string
          quiz_mistakes?: Json | null
          review_sheet?: Json | null
          timestamp?: string
          topic?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tutor_student_links: {
        Row: {
          created_at: string
          id: string
          status: string
          student_id: string
          tutor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          status?: string
          student_id: string
          tutor_id: string
        }
        Update: {
          created_at?: string
          id?: string
          status?: string
          student_id?: string
          tutor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutor_student_links_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_student_links_tutor_id_fkey"
            columns: ["tutor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_profile: {
        Args: { profile_user_id: string }
        Returns: boolean
      }
      cleanup_expired_paused_sessions: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      generate_tutor_code: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
    }
    Enums: {
      account_mode: "arlo_tutoring" | "hybrid" | "tutor"
      difficulty_level: "easy" | "medium" | "hard"
      study_technique:
        | "flashcards"
        | "quiz"
        | "feynman"
        | "blurting"
        | "mindmap"
        | "review-sheet"
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
      account_mode: ["arlo_tutoring", "hybrid", "tutor"],
      difficulty_level: ["easy", "medium", "hard"],
      study_technique: [
        "flashcards",
        "quiz",
        "feynman",
        "blurting",
        "mindmap",
        "review-sheet",
      ],
    },
  },
} as const
