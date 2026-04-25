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
      _internal_config: {
        Row: {
          key: string
          value: string
        }
        Insert: {
          key: string
          value: string
        }
        Update: {
          key?: string
          value?: string
        }
        Relationships: []
      }
      articles: {
        Row: {
          ai_provider: string | null
          category: string
          content: string | null
          created_at: string
          excerpt: string | null
          fact_check_notes: string | null
          fact_check_status: string | null
          featured_image_url: string | null
          focus_keyword: string | null
          id: string
          is_approved: boolean | null
          meta_description: string | null
          meta_title: string | null
          published_at: string | null
          research_references: Json | null
          scheduled_at: string | null
          seo_audit_log: Json | null
          seo_keyword: string | null
          seo_title: string | null
          slug: string | null
          source_urls: string[] | null
          status: string
          title: string
          trending_topic: string | null
          updated_at: string
          user_id: string
          wordpress_post_id: string | null
        }
        Insert: {
          ai_provider?: string | null
          category: string
          content?: string | null
          created_at?: string
          excerpt?: string | null
          fact_check_notes?: string | null
          fact_check_status?: string | null
          featured_image_url?: string | null
          focus_keyword?: string | null
          id?: string
          is_approved?: boolean | null
          meta_description?: string | null
          meta_title?: string | null
          published_at?: string | null
          research_references?: Json | null
          scheduled_at?: string | null
          seo_audit_log?: Json | null
          seo_keyword?: string | null
          seo_title?: string | null
          slug?: string | null
          source_urls?: string[] | null
          status?: string
          title: string
          trending_topic?: string | null
          updated_at?: string
          user_id: string
          wordpress_post_id?: string | null
        }
        Update: {
          ai_provider?: string | null
          category?: string
          content?: string | null
          created_at?: string
          excerpt?: string | null
          fact_check_notes?: string | null
          fact_check_status?: string | null
          featured_image_url?: string | null
          focus_keyword?: string | null
          id?: string
          is_approved?: boolean | null
          meta_description?: string | null
          meta_title?: string | null
          published_at?: string | null
          research_references?: Json | null
          scheduled_at?: string | null
          seo_audit_log?: Json | null
          seo_keyword?: string | null
          seo_title?: string | null
          slug?: string | null
          source_urls?: string[] | null
          status?: string
          title?: string
          trending_topic?: string | null
          updated_at?: string
          user_id?: string
          wordpress_post_id?: string | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      facebook_accounts: {
        Row: {
          access_token: string
          created_at: string | null
          id: string
          instagram_account_id: string | null
          is_active: boolean | null
          page_id: string
          page_name: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string | null
          id?: string
          instagram_account_id?: string | null
          is_active?: boolean | null
          page_id: string
          page_name?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string | null
          id?: string
          instagram_account_id?: string | null
          is_active?: boolean | null
          page_id?: string
          page_name?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      facebook_oauth_states: {
        Row: {
          created_at: string | null
          expires_at: string | null
          id: string
          state: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          state: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          state?: string
          user_id?: string
        }
        Relationships: []
      }
      publish_log: {
        Row: {
          article_id: string
          created_at: string
          error_message: string | null
          id: string
          platform: string
          published_url: string | null
          status: string
          user_id: string
        }
        Insert: {
          article_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          platform: string
          published_url?: string | null
          status?: string
          user_id: string
        }
        Update: {
          article_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          platform?: string
          published_url?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "publish_log_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
        ]
      }
      trending_topics: {
        Row: {
          category: string
          context: string | null
          created_at: string
          fetched_at: string
          id: string
          related_queries: string[] | null
          search_volume: string | null
          topic: string
          used: boolean | null
          user_id: string
        }
        Insert: {
          category: string
          context?: string | null
          created_at?: string
          fetched_at?: string
          id?: string
          related_queries?: string[] | null
          search_volume?: string | null
          topic: string
          used?: boolean | null
          user_id: string
        }
        Update: {
          category?: string
          context?: string | null
          created_at?: string
          fetched_at?: string
          id?: string
          related_queries?: string[] | null
          search_volume?: string | null
          topic?: string
          used?: boolean | null
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          articles_per_day: number | null
          auto_publish: boolean | null
          categories: string[] | null
          created_at: string
          facebook_access_token: string | null
          facebook_ad_account_id: string | null
          facebook_page_id: string | null
          gemini_api_key: string | null
          google_analytics_property_id: string | null
          groq_api_key: string | null
          id: string
          instagram_account_id: string | null
          last_trends_fetch: string | null
          linkedin_access_token: string | null
          linkedin_org_id: string | null
          openai_api_key: string | null
          trends_refresh_interval: number | null
          updated_at: string
          user_id: string
          wordpress_app_password: string | null
          wordpress_application_password: string | null
          wordpress_url: string | null
          wordpress_username: string | null
          writer_prompt: string | null
        }
        Insert: {
          articles_per_day?: number | null
          auto_publish?: boolean | null
          categories?: string[] | null
          created_at?: string
          facebook_access_token?: string | null
          facebook_ad_account_id?: string | null
          facebook_page_id?: string | null
          gemini_api_key?: string | null
          google_analytics_property_id?: string | null
          groq_api_key?: string | null
          id?: string
          instagram_account_id?: string | null
          last_trends_fetch?: string | null
          linkedin_access_token?: string | null
          linkedin_org_id?: string | null
          openai_api_key?: string | null
          trends_refresh_interval?: number | null
          updated_at?: string
          user_id: string
          wordpress_app_password?: string | null
          wordpress_application_password?: string | null
          wordpress_url?: string | null
          wordpress_username?: string | null
          writer_prompt?: string | null
        }
        Update: {
          articles_per_day?: number | null
          auto_publish?: boolean | null
          categories?: string[] | null
          created_at?: string
          facebook_access_token?: string | null
          facebook_ad_account_id?: string | null
          facebook_page_id?: string | null
          gemini_api_key?: string | null
          google_analytics_property_id?: string | null
          groq_api_key?: string | null
          id?: string
          instagram_account_id?: string | null
          last_trends_fetch?: string | null
          linkedin_access_token?: string | null
          linkedin_org_id?: string | null
          openai_api_key?: string | null
          trends_refresh_interval?: number | null
          updated_at?: string
          user_id?: string
          wordpress_app_password?: string | null
          wordpress_application_password?: string | null
          wordpress_url?: string | null
          wordpress_username?: string | null
          writer_prompt?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      decrypt_credential: {
        Args: { enc_key: string; val: string }
        Returns: string
      }
      encrypt_credential: { Args: { val: string }; Returns: string }
      get_credentials_status: { Args: never; Returns: Json }
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
    Enums: {},
  },
} as const
