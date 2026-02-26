export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          phone: string | null;
          country_code: string;
          full_name: string;
          user_type: "customer" | "restaurant" | "driver";
          profile_image_url: string | null;
          is_verified: boolean;
          is_active: boolean;
          last_login: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          phone?: string | null;
          country_code?: string;
          full_name: string;
          user_type: "customer" | "restaurant" | "driver";
          profile_image_url?: string | null;
          is_verified?: boolean;
          is_active?: boolean;
          last_login?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          phone?: string | null;
          country_code?: string;
          full_name?: string;
          user_type?: "customer" | "restaurant" | "driver";
          profile_image_url?: string | null;
          is_verified?: boolean;
          is_active?: boolean;
          last_login?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      user_profiles: {
        Row: {
          id: string;
          user_id: string;
          avatar_url: string | null;
          bio: string | null;
          addresses: Json;
          preferences: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          avatar_url?: string | null;
          bio?: string | null;
          addresses?: Json;
          preferences?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          avatar_url?: string | null;
          bio?: string | null;
          addresses?: Json;
          preferences?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      customers: {
        Row: {
          id: string;
          date_of_birth: string | null;
          gender: string | null;
          address: string | null;
          latitude: number | null;
          longitude: number | null;
          location_code: string | null;
          total_orders: number;
          loyalty_points: number;
          favorite_cuisines: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          date_of_birth?: string | null;
          gender?: string | null;
          address?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          location_code?: string | null;
          total_orders?: number;
          loyalty_points?: number;
          favorite_cuisines?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          date_of_birth?: string | null;
          gender?: string | null;
          address?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          location_code?: string | null;
          total_orders?: number;
          loyalty_points?: number;
          favorite_cuisines?: string[];
          created_at?: string;
          updated_at?: string;
        };
      };
      restaurants: {
        Row: {
          id: string;
          restaurant_name: string;
          cuisine_type: string | null;
          business_license: string;
          opening_hours: string | null;
          capacity: number | null;
          delivery_radius: number | null;
          payment_methods: string[];
          address: string;
          latitude: number | null;
          longitude: number | null;
          location_code: string | null;
          restaurant_status: "active" | "inactive" | "suspended";
          total_orders: number;
          restaurant_rating: number;
          is_halal: boolean;
          has_delivery: boolean;
          has_pickup: boolean;
          min_order_amount: number;
          delivery_fee: number;
          description: string | null;
          minimum_order: number | null;
          features: Json;
          image_url: string | null;
          is_verified: boolean;
          has_dine_in: boolean;
          has_outdoor: boolean;
          has_wifi: boolean;
          has_parking: boolean;
          is_family: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          restaurant_name: string;
          cuisine_type?: string | null;
          business_license: string;
          opening_hours?: string | null;
          capacity?: number | null;
          delivery_radius?: number | null;
          payment_methods?: string[];
          address: string;
          latitude?: number | null;
          longitude?: number | null;
          location_code?: string | null;
          restaurant_status?: "active" | "inactive" | "suspended";
          total_orders?: number;
          restaurant_rating?: number;
          is_halal?: boolean;
          has_delivery?: boolean;
          has_pickup?: boolean;
          min_order_amount?: number;
          delivery_fee?: number;
          description?: string | null;
          minimum_order?: number | null;
          features?: Json;
          image_url?: string | null;
          is_verified?: boolean;
          has_dine_in?: boolean;
          has_outdoor?: boolean;
          has_wifi?: boolean;
          has_parking?: boolean;
          is_family?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          restaurant_name?: string;
          cuisine_type?: string | null;
          business_license?: string;
          opening_hours?: string | null;
          capacity?: number | null;
          delivery_radius?: number | null;
          payment_methods?: string[];
          address?: string;
          latitude?: number | null;
          longitude?: number | null;
          location_code?: string | null;
          restaurant_status?: "active" | "inactive" | "suspended";
          total_orders?: number;
          restaurant_rating?: number;
          is_halal?: boolean;
          has_delivery?: boolean;
          has_pickup?: boolean;
          min_order_amount?: number;
          delivery_fee?: number;
          description?: string | null;
          minimum_order?: number | null;
          features?: Json;
          image_url?: string | null;
          is_verified?: boolean;
          has_dine_in?: boolean;
          has_outdoor?: boolean;
          has_wifi?: boolean;
          has_parking?: boolean;
          is_family?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      delivery_users: {
        Row: {
          id: string;
          vehicle_type: string | null;
          license_number: string;
          vehicle_plate: string;
          years_of_experience: number | null;
          availability: string | null;
          insurance_number: string | null;
          address: string | null;
          latitude: number | null;
          longitude: number | null;
          location_code: string | null;
          driver_status: "available" | "busy" | "offline" | "suspended";
          total_deliveries: number;
          rating: number;
          current_location_lat: number | null;
          current_location_lng: number | null;
          is_online: boolean;
          earnings_today: number;
          total_earnings: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          vehicle_type?: string | null;
          license_number: string;
          vehicle_plate: string;
          years_of_experience?: number | null;
          availability?: string | null;
          insurance_number?: string | null;
          address?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          location_code?: string | null;
          driver_status?: "available" | "busy" | "offline" | "suspended";
          total_deliveries?: number;
          rating?: number;
          current_location_lat?: number | null;
          current_location_lng?: number | null;
          is_online?: boolean;
          earnings_today?: number;
          total_earnings?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          vehicle_type?: string | null;
          license_number?: string;
          vehicle_plate?: string;
          years_of_experience?: number | null;
          availability?: string | null;
          insurance_number?: string | null;
          address?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          location_code?: string | null;
          driver_status?: "available" | "busy" | "offline" | "suspended";
          total_deliveries?: number;
          rating?: number;
          current_location_lat?: number | null;
          current_location_lng?: number | null;
          is_online?: boolean;
          earnings_today?: number;
          total_earnings?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      user_notifications: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          body: string;
          type: "security" | "order" | "promotional" | "info" | "system";
          data: Json;
          read: boolean;
          created_at: string;
          read_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          body: string;
          type?: "security" | "order" | "promotional" | "info" | "system";
          data?: Json;
          read?: boolean;
          created_at?: string;
          read_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          body?: string;
          type?: "security" | "order" | "promotional" | "info" | "system";
          data?: Json;
          read?: boolean;
          created_at?: string;
          read_at?: string | null;
        };
      };
      addresses: {
        Row: {
          id: string;
          user_id: string;
          label: string;
          address_line1: string;
          address_line2: string | null;
          city: string;
          state: string | null;
          country: string;
          postal_code: string | null;
          latitude: number | null;
          longitude: number | null;
          is_default: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          label: string;
          address_line1: string;
          address_line2?: string | null;
          city: string;
          state?: string | null;
          country?: string;
          postal_code?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          label?: string;
          address_line1?: string;
          address_line2?: string | null;
          city?: string;
          state?: string | null;
          country?: string;
          postal_code?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      menu_items: {
        Row: {
          id: string;
          restaurant_id: string;
          name: string;
          description: string | null;
          price: number;
          category: string | null;
          image_url: string | null;
          is_available: boolean;
          preparation_time: number | null;
          calories: number | null;
          dietary_tags: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          restaurant_id: string;
          name: string;
          description?: string | null;
          price: number;
          category?: string | null;
          image_url?: string | null;
          is_available?: boolean;
          preparation_time?: number | null;
          calories?: number | null;
          dietary_tags?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          restaurant_id?: string;
          name?: string;
          description?: string | null;
          price?: number;
          category?: string | null;
          image_url?: string | null;
          is_available?: boolean;
          preparation_time?: number | null;
          calories?: number | null;
          dietary_tags?: string[];
          created_at?: string;
          updated_at?: string;
        };
      };
      orders: {
        Row: {
          id: string;
          order_number: string;
          customer_id: string;
          restaurant_id: string;
          driver_id: string | null;
          status:
            | "pending"
            | "confirmed"
            | "preparing"
            | "ready"
            | "out_for_delivery"
            | "delivered"
            | "cancelled";
          total_amount: number;
          delivery_fee: number;
          tax_amount: number;
          discount_amount: number;
          final_amount: number;
          payment_method: string;
          payment_status: "pending" | "completed" | "failed" | "refunded";
          delivery_address: Json;
          special_instructions: string | null;
          estimated_delivery_time: string | null;
          actual_delivery_time: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_number?: string;
          customer_id: string;
          restaurant_id: string;
          driver_id?: string | null;
          status?:
            | "pending"
            | "confirmed"
            | "preparing"
            | "ready"
            | "out_for_delivery"
            | "delivered"
            | "cancelled";
          total_amount: number;
          delivery_fee?: number;
          tax_amount?: number;
          discount_amount?: number;
          final_amount: number;
          payment_method: string;
          payment_status?: "pending" | "completed" | "failed" | "refunded";
          delivery_address: Json;
          special_instructions?: string | null;
          estimated_delivery_time?: string | null;
          actual_delivery_time?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          order_number?: string;
          customer_id?: string;
          restaurant_id?: string;
          driver_id?: string | null;
          status?:
            | "pending"
            | "confirmed"
            | "preparing"
            | "ready"
            | "out_for_delivery"
            | "delivered"
            | "cancelled";
          total_amount?: number;
          delivery_fee?: number;
          tax_amount?: number;
          discount_amount?: number;
          final_amount?: number;
          payment_method?: string;
          payment_status?: "pending" | "completed" | "failed" | "refunded";
          delivery_address?: Json;
          special_instructions?: string | null;
          estimated_delivery_time?: string | null;
          actual_delivery_time?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          menu_item_id: string;
          quantity: number;
          unit_price: number;
          total_price: number;
          special_instructions: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          menu_item_id: string;
          quantity: number;
          unit_price: number;
          total_price?: number;
          special_instructions?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          menu_item_id?: string;
          quantity?: number;
          unit_price?: number;
          total_price?: number;
          special_instructions?: string | null;
          created_at?: string;
        };
      };
      reviews: {
        Row: {
          id: string;
          order_id: string;
          customer_id: string;
          restaurant_id: string;
          driver_id: string | null;
          rating: number;
          comment: string | null;
          type: "restaurant" | "driver";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          customer_id: string;
          restaurant_id: string;
          driver_id?: string | null;
          rating: number;
          comment?: string | null;
          type: "restaurant" | "driver";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          customer_id?: string;
          restaurant_id?: string;
          driver_id?: string | null;
          rating?: number;
          comment?: string | null;
          type?: "restaurant" | "driver";
          created_at?: string;
          updated_at?: string;
        };
      };
      payment_methods: {
        Row: {
          id: string;
          user_id: string;
          type:
            | "credit_card"
            | "debit_card"
            | "digital_wallet"
            | "cash_on_delivery";
          provider: string | null;
          card_last_four: string | null;
          is_default: boolean;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type:
            | "credit_card"
            | "debit_card"
            | "digital_wallet"
            | "cash_on_delivery";
          provider?: string | null;
          card_last_four?: string | null;
          is_default?: boolean;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?:
            | "credit_card"
            | "debit_card"
            | "digital_wallet"
            | "cash_on_delivery";
          provider?: string | null;
          card_last_four?: string | null;
          is_default?: boolean;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      carts: {
        Row: {
          id: string;
          user_id: string;
          restaurant_id: string;
          items: Json;
          subtotal: number;
          total_items: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          restaurant_id: string;
          items?: Json;
          subtotal?: number;
          total_items?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          restaurant_id?: string;
          items?: Json;
          subtotal?: number;
          total_items?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      favorites: {
        Row: {
          id: string;
          user_id: string;
          restaurant_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          restaurant_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          restaurant_id?: string;
          created_at?: string;
        };
      };
      categories: {
        Row: {
          id: string;
          name: string;
          icon: string | null;
          color: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          icon?: string | null;
          color?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          icon?: string | null;
          color?: string | null;
          sort_order?: number;
          created_at?: string;
        };
      };
      posts: {
        Row: {
          id: string;
          restaurant_id: string;
          title: string;
          description: string | null;
          image_url: string | null;
          post_type: "food" | "promotion" | "announcement" | "event";
          discount_percentage: number | null;
          original_price: number | null;
          discounted_price: number | null;
          available_from: string;
          available_until: string | null;
          is_active: boolean;
          likes_count: number;
          comments_count: number;
          view_count: number;
          tags: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          restaurant_id: string;
          title: string;
          description?: string | null;
          image_url?: string | null;
          post_type?: "food" | "promotion" | "announcement" | "event";
          discount_percentage?: number | null;
          original_price?: number | null;
          discounted_price?: number | null;
          available_from?: string;
          available_until?: string | null;
          is_active?: boolean;
          likes_count?: number;
          comments_count?: number;
          view_count?: number;
          tags?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          restaurant_id?: string;
          title?: string;
          description?: string | null;
          image_url?: string | null;
          post_type?: "food" | "promotion" | "announcement" | "event";
          discount_percentage?: number | null;
          original_price?: number | null;
          discounted_price?: number | null;
          available_from?: string;
          available_until?: string | null;
          is_active?: boolean;
          likes_count?: number;
          comments_count?: number;
          view_count?: number;
          tags?: string[];
          created_at?: string;
          updated_at?: string;
        };
      };
      post_comments: {
        Row: {
          id: string;
          post_id: string;
          user_id: string;
          comment: string;
          parent_comment_id: string | null;
          likes_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          user_id: string;
          comment: string;
          parent_comment_id?: string | null;
          likes_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          post_id?: string;
          user_id?: string;
          comment?: string;
          parent_comment_id?: string | null;
          likes_count?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      post_likes: {
        Row: {
          id: string;
          post_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          post_id?: string;
          user_id?: string;
          created_at?: string;
        };
      };
      restaurant_notifications: {
        Row: {
          id: string;
          restaurant_id: string;
          title: string;
          body: string;
          type: "order" | "review" | "system" | "promotion";
          data: Json;
          read: boolean;
          created_at: string;
          read_at: string | null;
        };
        Insert: {
          id?: string;
          restaurant_id: string;
          title: string;
          body: string;
          type?: "order" | "review" | "system" | "promotion";
          data?: Json;
          read?: boolean;
          created_at?: string;
          read_at?: string | null;
        };
        Update: {
          id?: string;
          restaurant_id?: string;
          title?: string;
          body?: string;
          type?: "order" | "review" | "system" | "promotion";
          data?: Json;
          read?: boolean;
          created_at?: string;
          read_at?: string | null;
        };
      };
      driver_notifications: {
        Row: {
          id: string;
          driver_id: string;
          title: string;
          body: string;
          type: "order" | "earning" | "system" | "rating";
          data: Json;
          read: boolean;
          created_at: string;
          read_at: string | null;
        };
        Insert: {
          id?: string;
          driver_id: string;
          title: string;
          body: string;
          type?: "order" | "earning" | "system" | "rating";
          data?: Json;
          read?: boolean;
          created_at?: string;
          read_at?: string | null;
        };
        Update: {
          id?: string;
          driver_id?: string;
          title?: string;
          body?: string;
          type?: "order" | "earning" | "system" | "rating";
          data?: Json;
          read?: boolean;
          created_at?: string;
          read_at?: string | null;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

export type CommentLike = {
  id: string;
  comment_id: string;
  user_id: string;
  created_at: string;
};

export type PostView = {
  id: string;
  post_id: string;
  user_id: string | null;
  view_date: string;
  view_time: string;
  device_info: Json;
  created_at: string;
};
