import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { Database } from "./database.types";

const supabaseUrl = "";
const supabaseAnonKey = "";
// Create a custom AsyncStorage adapter for Supabase
const asyncStorageAdapter = {
  getItem: (key: string) => {
    return AsyncStorage.getItem(key);
  },
  setItem: (key: string, value: string) => {
    return AsyncStorage.setItem(key, value);
  },
  removeItem: (key: string) => {
    return AsyncStorage.removeItem(key);
  },
};

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: asyncStorageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: {
    headers: {
      "Content-Type": "application/json",
    },
  },
});

// Extended User type that includes all possible fields from specific tables
export type User = Database["public"]["Tables"]["users"]["Row"] & {
  // Customer fields (from customers table)
  date_of_birth?: string | null;
  gender?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  location_code?: string | null;
  total_orders?: number;
  loyalty_points?: number;
  favorite_cuisines?: string[];

  // Restaurant fields (from restaurants table)
  restaurant_name?: string;
  cuisine_type?: string | null;
  business_license?: string;
  opening_hours?: string | null;
  capacity?: number | null;
  delivery_radius?: number | null;
  payment_methods?: string[];
  restaurant_status?: "active" | "inactive" | "suspended";
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

  // Driver fields (from delivery_users table)
  vehicle_type?: string | null;
  license_number?: string;
  vehicle_plate?: string;
  years_of_experience?: number | null;
  availability?: string | null;
  insurance_number?: string | null;
  driver_status?: "available" | "busy" | "offline" | "suspended";
  total_deliveries?: number;
  rating?: number;
  current_location_lat?: number | null;
  current_location_lng?: number | null;
  is_online?: boolean;
  earnings_today?: number;
  total_earnings?: number;

  // Profile reference
  profile?: UserProfile;
};

export type UserProfile = Database["public"]["Tables"]["user_profiles"]["Row"];

export type Customer = Database["public"]["Tables"]["customers"]["Row"];
export type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"];
export type DeliveryUser =
  Database["public"]["Tables"]["delivery_users"]["Row"];
export type Notification =
  Database["public"]["Tables"]["user_notifications"]["Row"];
export type RestaurantNotification =
  Database["public"]["Tables"]["restaurant_notifications"]["Row"];
export type DriverNotification =
  Database["public"]["Tables"]["driver_notifications"]["Row"];
export type Address = Database["public"]["Tables"]["addresses"]["Row"];
export type MenuItem = Database["public"]["Tables"]["menu_items"]["Row"];
export type Order = Database["public"]["Tables"]["orders"]["Row"];
export type Review = Database["public"]["Tables"]["reviews"]["Row"];
export type Post = Database["public"]["Tables"]["posts"]["Row"];
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// Helper function to get full user data
export const getUserWithProfile = async (
  userId: string,
): Promise<User | null> => {
  try {
    // Get user from users table
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();

    if (userError || !userData) {
      console.error("Error fetching user:", userError);
      return null;
    }

    // Get user profile
    const { data: profileData } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    // Get specific data based on user type
    let specificData: any = null;

    switch (userData.user_type) {
      case "customer":
        const { data: customerData } = await supabase
          .from("customers")
          .select("*")
          .eq("id", userId)
          .maybeSingle();
        specificData = customerData;
        break;

      case "restaurant":
        const { data: restaurantData } = await supabase
          .from("restaurants")
          .select("*")
          .eq("id", userId)
          .maybeSingle();
        specificData = restaurantData;
        break;

      case "driver":
        const { data: driverData } = await supabase
          .from("delivery_users")
          .select("*")
          .eq("id", userId)
          .maybeSingle();
        specificData = driverData;
        break;
    }

    // Combine all data
    return {
      ...userData,
      ...specificData,
      profile: profileData,
    } as User;
  } catch (error) {
    console.error("Error in getUserWithProfile:", error);
    return null;
  }
};

// Helper function to check if user has specific profile
export const checkUserProfileExists = async (
  userId: string,
  userType: string,
): Promise<boolean> => {
  try {
    let tableName = "";

    switch (userType) {
      case "customer":
        tableName = "customers";
        break;
      case "restaurant":
        tableName = "restaurants";
        break;
      case "driver":
        tableName = "delivery_users";
        break;
      default:
        return false;
    }

    const { data, error } = await supabase
      .from(tableName)
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error(`Error checking ${tableName}:`, error);
      return false;
    }

    return !!data;
  } catch (error) {
    console.error("Error in checkUserProfileExists:", error);
    return false;
  }
};

// Helper function to create specific user profile
export const createUserProfile = async (
  userId: string,
  userType: string,
  data: any,
): Promise<boolean> => {
  try {
    let tableName = "";
    let insertData: any = { id: userId };

    switch (userType) {
      case "customer":
        tableName = "customers";
        insertData = {
          ...insertData,
          date_of_birth: data.dateOfBirth || null,
          gender: data.gender || null,
          address: data.address || null,
          latitude: data.latitude || null,
          longitude: data.longitude || null,
          location_code: data.locationCode || null,
          total_orders: 0,
          loyalty_points: 100,
          favorite_cuisines: data.preferredCuisines || [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        break;

      case "restaurant":
        tableName = "restaurants";
        insertData = {
          ...insertData,
          restaurant_name: data.restaurantName || "",
          cuisine_type: data.cuisineType || null,
          business_license: data.businessLicense || "",
          opening_hours: data.openingHours || "",
          capacity: data.capacity ? parseInt(data.capacity) : null,
          delivery_radius: data.deliveryRadius
            ? parseInt(data.deliveryRadius)
            : null,
          payment_methods: data.paymentMethods || [],
          address: data.address || "",
          latitude: data.latitude || null,
          longitude: data.longitude || null,
          location_code: data.locationCode || null,
          restaurant_status: "active",
          total_orders: 0,
          restaurant_rating: 0.0,
          is_halal: false,
          has_delivery: true,
          has_pickup: false,
          min_order_amount: 0.0,
          delivery_fee: 0.0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        break;

      case "driver":
        tableName = "delivery_users";
        insertData = {
          ...insertData,
          vehicle_type: data.vehicleType || null,
          license_number: data.licenseNumber || "",
          vehicle_plate: data.vehiclePlate || "",
          years_of_experience: data.yearsOfExperience
            ? parseInt(data.yearsOfExperience)
            : null,
          availability: data.availability || null,
          insurance_number: data.insuranceNumber || null,
          address: data.address || "",
          latitude: data.latitude || null,
          longitude: data.longitude || null,
          location_code: data.locationCode || null,
          driver_status: "available",
          total_deliveries: 0,
          rating: 0.0,
          current_location_lat: data.latitude || null,
          current_location_lng: data.longitude || null,
          is_online: false,
          earnings_today: 0.0,
          total_earnings: 0.0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        break;

      default:
        return false;
    }

    const { error } = await supabase
      .from(tableName)
      .insert([insertData])
      .select()
      .single();

    if (error) {
      console.error(`Error creating ${tableName} profile:`, error);
      // If duplicate, check if it exists
      if (error.code === "23505") {
        console.log(`${tableName} profile already exists for user ${userId}`);
        return true;
      }
      return false;
    }

    console.log(`✅ Created ${tableName} profile for user ${userId}`);
    return true;
  } catch (error) {
    console.error(`Error in createUserProfile for ${userType}:`, error);
    return false;
  }
};

// Helper to get user type
export const getUserType = async (userId: string): Promise<string | null> => {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("user_type")
      .eq("id", userId)
      .single();

    if (error) {
      console.error("Error getting user type:", error);
      return null;
    }

    return data.user_type;
  } catch (error) {
    console.error("Error in getUserType:", error);
    return null;
  }
};
