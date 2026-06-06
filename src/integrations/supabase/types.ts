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
          author_id: string | null
          category: string
          content: string | null
          created_at: string
          excerpt: string | null
          fact_check_notes: string | null
          fact_check_status: string | null
          featured_image_url: string | null
          focus_keyword: string | null
          id: string
          image_alt: string | null
          image_caption: string | null
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
          visual_elements: Json | null
          wordpress_post_id: string | null
        }
        Insert: {
          ai_provider?: string | null
          author_id?: string | null
          category: string
          content?: string | null
          created_at?: string
          excerpt?: string | null
          fact_check_notes?: string | null
          fact_check_status?: string | null
          featured_image_url?: string | null
          focus_keyword?: string | null
          id?: string
          image_alt?: string | null
          image_caption?: string | null
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
          visual_elements?: Json | null
          wordpress_post_id?: string | null
        }
        Update: {
          ai_provider?: string | null
          author_id?: string | null
          category?: string
          content?: string | null
          created_at?: string
          excerpt?: string | null
          fact_check_notes?: string | null
          fact_check_status?: string | null
          featured_image_url?: string | null
          focus_keyword?: string | null
          id?: string
          image_alt?: string | null
          image_caption?: string | null
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
          visual_elements?: Json | null
          wordpress_post_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "articles_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "authors"
            referencedColumns: ["id"]
          },
        ]
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
      authors: {
        Row: {
          avatar_url: string | null
          bio: string | null
          category: string | null
          created_at: string
          id: string
          name: string
          role: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          category?: string | null
          created_at?: string
          id?: string
          name: string
          role?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          category?: string | null
          created_at?: string
          id?: string
          name?: string
          role?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      automation_logs: {
        Row: {
          created_at: string | null
          details: Json | null
          id: string
          level: string
          message: string
          module: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          details?: Json | null
          id?: string
          level?: string
          message: string
          module: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          details?: Json | null
          id?: string
          level?: string
          message?: string
          module?: string
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
          last_metrics: Json | null
          metrics_updated_at: string | null
          page_id: string
          page_name: string | null
          picture_url: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string | null
          id?: string
          instagram_account_id?: string | null
          is_active?: boolean | null
          last_metrics?: Json | null
          metrics_updated_at?: string | null
          page_id: string
          page_name?: string | null
          picture_url?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string | null
          id?: string
          instagram_account_id?: string | null
          is_active?: boolean | null
          last_metrics?: Json | null
          metrics_updated_at?: string | null
          page_id?: string
          page_name?: string | null
          picture_url?: string | null
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
      google_indexing_history: {
        Row: {
          article_id: string | null
          created_at: string
          id: string
          response_details: Json | null
          status: string
          url: string
          user_id: string
        }
        Insert: {
          article_id?: string | null
          created_at?: string
          id?: string
          response_details?: Json | null
          status: string
          url: string
          user_id: string
        }
        Update: {
          article_id?: string | null
          created_at?: string
          id?: string
          response_details?: Json | null
          status?: string
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_indexing_history_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "google_indexing_history_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "public_articles"
            referencedColumns: ["id"]
          },
        ]
      }
      google_search_console_oauth_states: {
        Row: {
          expires_at: string | null
          state: string
          user_id: string
        }
        Insert: {
          expires_at?: string | null
          state: string
          user_id: string
        }
        Update: {
          expires_at?: string | null
          state?: string
          user_id?: string
        }
        Relationships: []
      }
      instagram_accounts_direct: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          last_login: string | null
          password: string
          updated_at: string
          user_id: string
          username: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          last_login?: string | null
          password: string
          updated_at?: string
          user_id: string
          username: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          last_login?: string | null
          password?: string
          updated_at?: string
          user_id?: string
          username?: string
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
          {
            foreignKeyName: "publish_log_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "public_articles"
            referencedColumns: ["id"]
          },
        ]
      }
      social_follows: {
        Row: {
          created_at: string
          followed_at: string
          id: string
          platform: string
          status: string
          target_avatar: string | null
          target_external_id: string
          target_username: string | null
          unfollowed_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          followed_at?: string
          id?: string
          platform?: string
          status?: string
          target_avatar?: string | null
          target_external_id: string
          target_username?: string | null
          unfollowed_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          followed_at?: string
          id?: string
          platform?: string
          status?: string
          target_avatar?: string | null
          target_external_id?: string
          target_username?: string | null
          unfollowed_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      social_interactions: {
        Row: {
          ai_response: string | null
          author_avatar: string | null
          author_name: string | null
          content: string
          created_at: string
          error_message: string | null
          external_id: string
          id: string
          interaction_type: string | null
          original_link: string | null
          page_avatar: string | null
          page_id: string
          platform: string
          processed_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_response?: string | null
          author_avatar?: string | null
          author_name?: string | null
          content: string
          created_at?: string
          error_message?: string | null
          external_id: string
          id?: string
          interaction_type?: string | null
          original_link?: string | null
          page_avatar?: string | null
          page_id: string
          platform: string
          processed_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_response?: string | null
          author_avatar?: string | null
          author_name?: string | null
          content?: string
          created_at?: string
          error_message?: string | null
          external_id?: string
          id?: string
          interaction_type?: string | null
          original_link?: string | null
          page_avatar?: string | null
          page_id?: string
          platform?: string
          processed_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
          source_name: string | null
          source_url: string | null
          topic: string
          update_count: number | null
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
          source_name?: string | null
          source_url?: string | null
          topic: string
          update_count?: number | null
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
          source_name?: string | null
          source_url?: string | null
          topic?: string
          update_count?: number | null
          used?: boolean | null
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          articles_per_day: number | null
          auto_publish: boolean | null
          automation_enabled: boolean | null
          azure_openai_api_key: string | null
          azure_openai_deployment_name: string | null
          azure_openai_endpoint: string | null
          categories: string[] | null
          created_at: string
          dashboard_order: string[] | null
          dashboard_widgets: Json | null
          facebook_access_token: string | null
          facebook_ad_account_id: string | null
          facebook_page_id: string | null
          follower_growth_mode: boolean | null
          gemini_api_key: string | null
          google_analytics_property_id: string | null
          google_indexing_key: string | null
          google_search_console_token: string | null
          groq_api_key: string | null
          id: string
          image_mode: string
          image_prompt: string | null
          image_prompt_template: string | null
          instagram_account_id: string | null
          instagram_automation_human_like: boolean | null
          instagram_follow_duration_max: number | null
          instagram_follow_duration_min: number | null
          instagram_follows_per_day_max: number | null
          instagram_follows_per_day_min: number | null
          interaction_mode: string | null
          last_trends_fetch: string | null
          linkedin_access_token: string | null
          linkedin_org_id: string | null
          metrics_refresh_interval: number | null
          openai_api_key: string | null
          social_posting_mode: string
          social_reply_prompt: string | null
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
          automation_enabled?: boolean | null
          azure_openai_api_key?: string | null
          azure_openai_deployment_name?: string | null
          azure_openai_endpoint?: string | null
          categories?: string[] | null
          created_at?: string
          dashboard_order?: string[] | null
          dashboard_widgets?: Json | null
          facebook_access_token?: string | null
          facebook_ad_account_id?: string | null
          facebook_page_id?: string | null
          follower_growth_mode?: boolean | null
          gemini_api_key?: string | null
          google_analytics_property_id?: string | null
          google_indexing_key?: string | null
          google_search_console_token?: string | null
          groq_api_key?: string | null
          id?: string
          image_mode?: string
          image_prompt?: string | null
          image_prompt_template?: string | null
          instagram_account_id?: string | null
          instagram_automation_human_like?: boolean | null
          instagram_follow_duration_max?: number | null
          instagram_follow_duration_min?: number | null
          instagram_follows_per_day_max?: number | null
          instagram_follows_per_day_min?: number | null
          interaction_mode?: string | null
          last_trends_fetch?: string | null
          linkedin_access_token?: string | null
          linkedin_org_id?: string | null
          metrics_refresh_interval?: number | null
          openai_api_key?: string | null
          social_posting_mode?: string
          social_reply_prompt?: string | null
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
          automation_enabled?: boolean | null
          azure_openai_api_key?: string | null
          azure_openai_deployment_name?: string | null
          azure_openai_endpoint?: string | null
          categories?: string[] | null
          created_at?: string
          dashboard_order?: string[] | null
          dashboard_widgets?: Json | null
          facebook_access_token?: string | null
          facebook_ad_account_id?: string | null
          facebook_page_id?: string | null
          follower_growth_mode?: boolean | null
          gemini_api_key?: string | null
          google_analytics_property_id?: string | null
          google_indexing_key?: string | null
          google_search_console_token?: string | null
          groq_api_key?: string | null
          id?: string
          image_mode?: string
          image_prompt?: string | null
          image_prompt_template?: string | null
          instagram_account_id?: string | null
          instagram_automation_human_like?: boolean | null
          instagram_follow_duration_max?: number | null
          instagram_follow_duration_min?: number | null
          instagram_follows_per_day_max?: number | null
          instagram_follows_per_day_min?: number | null
          interaction_mode?: string | null
          last_trends_fetch?: string | null
          linkedin_access_token?: string | null
          linkedin_org_id?: string | null
          metrics_refresh_interval?: number | null
          openai_api_key?: string | null
          social_posting_mode?: string
          social_reply_prompt?: string | null
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
      public_articles: {
        Row: {
          ai_provider: string | null
          author_id: string | null
          category: string | null
          content: string | null
          created_at: string | null
          excerpt: string | null
          featured_image_url: string | null
          focus_keyword: string | null
          id: string | null
          image_alt: string | null
          image_caption: string | null
          meta_description: string | null
          meta_title: string | null
          published_at: string | null
          scheduled_at: string | null
          seo_keyword: string | null
          seo_title: string | null
          slug: string | null
          status: string | null
          title: string | null
          trending_topic: string | null
          updated_at: string | null
          visual_elements: Json | null
          wordpress_post_id: string | null
        }
        Insert: {
          ai_provider?: string | null
          author_id?: string | null
          category?: string | null
          content?: string | null
          created_at?: string | null
          excerpt?: string | null
          featured_image_url?: string | null
          focus_keyword?: string | null
          id?: string | null
          image_alt?: string | null
          image_caption?: string | null
          meta_description?: string | null
          meta_title?: string | null
          published_at?: string | null
          scheduled_at?: string | null
          seo_keyword?: string | null
          seo_title?: string | null
          slug?: string | null
          status?: string | null
          title?: string | null
          trending_topic?: string | null
          updated_at?: string | null
          visual_elements?: Json | null
          wordpress_post_id?: string | null
        }
        Update: {
          ai_provider?: string | null
          author_id?: string | null
          category?: string | null
          content?: string | null
          created_at?: string | null
          excerpt?: string | null
          featured_image_url?: string | null
          focus_keyword?: string | null
          id?: string | null
          image_alt?: string | null
          image_caption?: string | null
          meta_description?: string | null
          meta_title?: string | null
          published_at?: string | null
          scheduled_at?: string | null
          seo_keyword?: string | null
          seo_title?: string | null
          slug?: string | null
          status?: string | null
          title?: string | null
          trending_topic?: string | null
          updated_at?: string | null
          visual_elements?: Json | null
          wordpress_post_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "articles_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "authors"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      clean_old_trending_topics: { Args: never; Returns: undefined }
      cleanup_expired_data: { Args: never; Returns: undefined }
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
