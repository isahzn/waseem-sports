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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      admin_users: {
        Row: {
          created_at: string
          is_active: boolean
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          is_active?: boolean
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          is_active?: boolean
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      attribute_definitions: {
        Row: {
          created_at: string
          id: string
          input_type: string
          is_filterable: boolean
          is_variant_option: boolean
          name: string
          options: Json | null
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          input_type?: string
          is_filterable?: boolean
          is_variant_option?: boolean
          name: string
          options?: Json | null
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          input_type?: string
          is_filterable?: boolean
          is_variant_option?: boolean
          name?: string
          options?: Json | null
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor: string | null
          created_at: string
          entity: string | null
          entity_id: string | null
          id: number
          ip: unknown
          meta: Json | null
        }
        Insert: {
          action: string
          actor?: string | null
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: never
          ip?: unknown
          meta?: Json | null
        }
        Update: {
          action?: string
          actor?: string | null
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: never
          ip?: unknown
          meta?: Json | null
        }
        Relationships: []
      }
      brands: {
        Row: {
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          is_featured: boolean
          is_visible: boolean
          logo_alt: string | null
          logo_path: string | null
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_featured?: boolean
          is_visible?: boolean
          logo_alt?: string | null
          logo_path?: string | null
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_featured?: boolean
          is_visible?: boolean
          logo_alt?: string | null
          logo_path?: string | null
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          image_alt: string | null
          image_path: string | null
          is_visible: boolean
          name: string
          parent_id: string | null
          seo_description: string | null
          seo_title: string | null
          slug: string
          sort_order: number
          sport_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          image_alt?: string | null
          image_path?: string | null
          is_visible?: boolean
          name: string
          parent_id?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          sort_order?: number
          sport_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          image_alt?: string | null
          image_path?: string | null
          is_visible?: boolean
          name?: string
          parent_id?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          sort_order?: number
          sport_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory: {
        Row: {
          low_stock_threshold: number
          on_hand: number
          reserved: number
          track_inventory: boolean
          updated_at: string
          variant_id: string
        }
        Insert: {
          low_stock_threshold?: number
          on_hand?: number
          reserved?: number
          track_inventory?: boolean
          updated_at?: string
          variant_id: string
        }
        Update: {
          low_stock_threshold?: number
          on_hand?: number
          reserved?: number
          track_inventory?: boolean
          updated_at?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: true
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          actor: string | null
          created_at: string
          id: number
          note: string | null
          on_hand_delta: number
          order_id: string | null
          reason: string
          reserved_delta: number
          variant_id: string
        }
        Insert: {
          actor?: string | null
          created_at?: string
          id?: never
          note?: string | null
          on_hand_delta?: number
          order_id?: string | null
          reason: string
          reserved_delta?: number
          variant_id: string
        }
        Update: {
          actor?: string | null
          created_at?: string
          id?: never
          note?: string | null
          on_hand_delta?: number
          order_id?: string | null
          reason?: string
          reserved_delta?: number
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inv_mov_order_fk"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          attempts: number
          channel: string
          created_at: string
          dedupe_key: string
          event: string
          id: string
          last_error: string | null
          order_id: string | null
          provider: string | null
          recipient: string
          sent_at: string | null
          status: string
        }
        Insert: {
          attempts?: number
          channel: string
          created_at?: string
          dedupe_key: string
          event: string
          id?: string
          last_error?: string | null
          order_id?: string | null
          provider?: string | null
          recipient: string
          sent_at?: string | null
          status?: string
        }
        Update: {
          attempts?: number
          channel?: string
          created_at?: string
          dedupe_key?: string
          event?: string
          id?: string
          last_error?: string | null
          order_id?: string | null
          provider?: string | null
          recipient?: string
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          attributes: Json
          id: string
          line_total: number
          order_id: string
          product_id: string | null
          product_name: string
          quantity: number
          sku: string | null
          unit_price: number
          variant_id: string | null
          variant_name: string | null
        }
        Insert: {
          attributes?: Json
          id?: string
          line_total: number
          order_id: string
          product_id?: string | null
          product_name: string
          quantity: number
          sku?: string | null
          unit_price: number
          variant_id?: string | null
          variant_name?: string | null
        }
        Update: {
          attributes?: Json
          id?: string
          line_total?: number
          order_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          sku?: string | null
          unit_price?: number
          variant_id?: string | null
          variant_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_history: {
        Row: {
          actor: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["order_status"] | null
          id: number
          note: string | null
          order_id: string
          to_status: Database["public"]["Enums"]["order_status"]
        }
        Insert: {
          actor?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["order_status"] | null
          id?: never
          note?: string | null
          order_id: string
          to_status: Database["public"]["Enums"]["order_status"]
        }
        Update: {
          actor?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["order_status"] | null
          id?: never
          note?: string | null
          order_id?: string
          to_status?: Database["public"]["Enums"]["order_status"]
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          currency: string
          customer_email: string | null
          customer_name: string
          customer_phone: string
          id: string
          idempotency_key: string
          notes: string | null
          order_number: string
          payment_method: string
          payment_status: Database["public"]["Enums"]["payment_status"]
          placed_at: string
          shipping_address: Json
          shipping_fee: number
          shipping_method: string | null
          status: Database["public"]["Enums"]["order_status"]
          stock_committed: boolean
          stock_reserved: boolean
          subtotal: number
          total: number
          tracking_token_hash: string
          updated_at: string
        }
        Insert: {
          currency: string
          customer_email?: string | null
          customer_name: string
          customer_phone: string
          id?: string
          idempotency_key: string
          notes?: string | null
          order_number: string
          payment_method: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          placed_at?: string
          shipping_address: Json
          shipping_fee?: number
          shipping_method?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          stock_committed?: boolean
          stock_reserved?: boolean
          subtotal: number
          total: number
          tracking_token_hash: string
          updated_at?: string
        }
        Update: {
          currency?: string
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string
          id?: string
          idempotency_key?: string
          notes?: string | null
          order_number?: string
          payment_method?: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          placed_at?: string
          shipping_address?: Json
          shipping_fee?: number
          shipping_method?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          stock_committed?: boolean
          stock_reserved?: boolean
          subtotal?: number
          total?: number
          tracking_token_hash?: string
          updated_at?: string
        }
        Relationships: []
      }
      page_sections: {
        Row: {
          content: Json
          created_at: string
          draft_content: Json | null
          id: string
          is_visible: boolean
          page_id: string
          sort_order: number
          type: string
          updated_at: string
        }
        Insert: {
          content?: Json
          created_at?: string
          draft_content?: Json | null
          id?: string
          is_visible?: boolean
          page_id: string
          sort_order?: number
          type: string
          updated_at?: string
        }
        Update: {
          content?: Json
          created_at?: string
          draft_content?: Json | null
          id?: string
          is_visible?: boolean
          page_id?: string
          sort_order?: number
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "page_sections_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
        ]
      }
      pages: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          layout: string
          og_image_path: string | null
          published_at: string | null
          seo_description: string | null
          seo_title: string | null
          slug: string
          status: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          layout?: string
          og_image_path?: string | null
          published_at?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          status?: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          layout?: string
          og_image_path?: string | null
          published_at?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["content_status"]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      payment_transactions: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          idempotency_key: string | null
          order_id: string
          provider: string
          provider_txn_id: string | null
          raw: Json | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency: string
          id?: string
          idempotency_key?: string | null
          order_id: string
          provider: string
          provider_txn_id?: string | null
          raw?: Json | null
          status: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          idempotency_key?: string | null
          order_id?: string
          provider?: string
          provider_txn_id?: string | null
          raw?: Json | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      product_attribute_values: {
        Row: {
          attribute_id: string
          product_id: string
          value_text: string
        }
        Insert: {
          attribute_id: string
          product_id: string
          value_text: string
        }
        Update: {
          attribute_id?: string
          product_id?: string
          value_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_attribute_values_attribute_id_fkey"
            columns: ["attribute_id"]
            isOneToOne: false
            referencedRelation: "attribute_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_attribute_values_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          alt_text: string | null
          created_at: string
          id: string
          is_primary: boolean
          license_note: string | null
          product_id: string
          sort_order: number
          source_note: string | null
          source_url: string | null
          storage_path: string
          variant_id: string | null
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean
          license_note?: string | null
          product_id: string
          sort_order?: number
          source_note?: string | null
          source_url?: string | null
          storage_path: string
          variant_id?: string | null
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean
          license_note?: string | null
          product_id?: string
          sort_order?: number
          source_note?: string | null
          source_url?: string | null
          storage_path?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_images_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          options: Json
          price: number | null
          product_id: string
          sku: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          options?: Json
          price?: number | null
          product_id: string
          sku?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          options?: Json
          price?: number | null
          product_id?: string
          sku?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          base_price: number
          brand_id: string | null
          category_id: string | null
          compare_at_price: number | null
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          is_featured: boolean
          name: string
          promo: Json | null
          published_at: string | null
          search_tsv: unknown
          seo_description: string | null
          seo_title: string | null
          slug: string
          sport_id: string | null
          status: Database["public"]["Enums"]["content_status"]
          updated_at: string
        }
        Insert: {
          base_price: number
          brand_id?: string | null
          category_id?: string | null
          compare_at_price?: number | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_featured?: boolean
          name: string
          promo?: Json | null
          published_at?: string | null
          search_tsv?: unknown
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          sport_id?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          updated_at?: string
        }
        Update: {
          base_price?: number
          brand_id?: string | null
          category_id?: string | null
          compare_at_price?: number | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_featured?: boolean
          name?: string
          promo?: Json | null
          published_at?: string | null
          search_tsv?: unknown
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          sport_id?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          created_at: string
          id: number
          key: string
        }
        Insert: {
          created_at?: string
          id?: never
          key: string
        }
        Update: {
          created_at?: string
          id?: never
          key?: string
        }
        Relationships: []
      }
      shipping_rules: {
        Row: {
          country_codes: string[]
          created_at: string
          est_days_max: number | null
          est_days_min: number | null
          fee: number
          free_over: number | null
          id: string
          is_active: boolean
          method: string
          name: string
          regions: string[]
          sort_order: number
          updated_at: string
        }
        Insert: {
          country_codes?: string[]
          created_at?: string
          est_days_max?: number | null
          est_days_min?: number | null
          fee?: number
          free_over?: number | null
          id?: string
          is_active?: boolean
          method?: string
          name: string
          regions?: string[]
          sort_order?: number
          updated_at?: string
        }
        Update: {
          country_codes?: string[]
          created_at?: string
          est_days_max?: number | null
          est_days_min?: number | null
          fee?: number
          free_over?: number | null
          id?: string
          is_active?: boolean
          method?: string
          name?: string
          regions?: string[]
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      sports: {
        Row: {
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          image_alt: string | null
          image_path: string | null
          is_featured: boolean
          is_visible: boolean
          name: string
          seo_description: string | null
          seo_title: string | null
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          image_alt?: string | null
          image_path?: string | null
          is_featured?: boolean
          is_visible?: boolean
          name: string
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          image_alt?: string | null
          image_path?: string | null
          is_featured?: boolean
          is_visible?: boolean
          name?: string
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      store_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      webhook_events: {
        Row: {
          error: string | null
          event_id: string
          id: string
          payload: Json | null
          processed_at: string | null
          provider: string
          received_at: string
        }
        Insert: {
          error?: string | null
          event_id: string
          id?: string
          payload?: Json | null
          processed_at?: string | null
          provider: string
          received_at?: string
        }
        Update: {
          error?: string | null
          event_id?: string
          id?: string
          payload?: Json | null
          processed_at?: string | null
          provider?: string
          received_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      variant_availability: {
        Row: {
          product_id: string | null
          status: string | null
          variant_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: true
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      adjust_order_stock: {
        Args: { p_action: string; p_order_id: string }
        Returns: undefined
      }
      admin_adjust_stock: {
        Args: {
          p_note?: string
          p_on_hand_delta: number
          p_reason: string
          p_variant_id: string
        }
        Returns: undefined
      }
      admin_role: { Args: never; Returns: string }
      is_admin: { Args: never; Returns: boolean }
      place_order: {
        Args: {
          p_customer: Json
          p_idempotency_key: string
          p_items: Json
          p_notes?: string
          p_payment_method: string
          p_shipping_address: Json
          p_shipping_method: string
          p_tracking_token_hash: string
        }
        Returns: {
          currency: string
          customer_email: string | null
          customer_name: string
          customer_phone: string
          id: string
          idempotency_key: string
          notes: string | null
          order_number: string
          payment_method: string
          payment_status: Database["public"]["Enums"]["payment_status"]
          placed_at: string
          shipping_address: Json
          shipping_fee: number
          shipping_method: string | null
          status: Database["public"]["Enums"]["order_status"]
          stock_committed: boolean
          stock_reserved: boolean
          subtotal: number
          total: number
          tracking_token_hash: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      publish_page: { Args: { p_page_id: string }; Returns: number }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      content_status: "draft" | "published" | "archived"
      order_status:
        | "new"
        | "confirmed"
        | "processing"
        | "shipped"
        | "delivered"
        | "cancelled"
        | "payment_failed"
        | "refunded"
      payment_status:
        | "unpaid"
        | "pending"
        | "paid"
        | "failed"
        | "refunded"
        | "partially_refunded"
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
  public: {
    Enums: {
      content_status: ["draft", "published", "archived"],
      order_status: [
        "new",
        "confirmed",
        "processing",
        "shipped",
        "delivered",
        "cancelled",
        "payment_failed",
        "refunded",
      ],
      payment_status: [
        "unpaid",
        "pending",
        "paid",
        "failed",
        "refunded",
        "partially_refunded",
      ],
    },
  },
} as const
