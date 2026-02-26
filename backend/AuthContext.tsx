// backend/AuthContext.tsx - Complete version with all helper functions
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { passwordResetManager } from "./PasswordResetManager";
import { NotificationService } from "./services/notificationService";
import { supabase, User, UserProfile } from "./supabase";

import { checkRestaurantSetupComplete as checkRestaurantSetup } from "./helper/restaurantSetup";

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (
    email: string,
    password: string,
    userData: any,
  ) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  updateProfile: (profile: Partial<UserProfile>) => Promise<void>;
  hasNewOrders?: boolean;
  newOrdersCount?: number;

  isGuest: boolean;
  signInAsGuest: () => Promise<void>;
  convertGuestToUser: (
    email: string,
    password: string,
    userData: any,
  ) => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Add to AuthProvider component
  const [isGuest, setIsGuest] = useState(false);

  // Function to check if a session is a recovery session that should be blocked
  const isRecoverySessionToBlock = async (session: any): Promise<boolean> => {
    try {
      // Check if we have an active recovery session marker
      const recoverySessionActive = await AsyncStorage.getItem(
        "recovery_session_active",
      );
      const hasValidResetSession = await AsyncStorage.getItem(
        "has_valid_reset_session",
      );

      if (recoverySessionActive === "true" || hasValidResetSession === "true") {
        console.log("🔐 Recovery session detected - blocking auto-login");
        return true;
      }

      return false;
    } catch (error) {
      console.error("Error checking recovery session:", error);
      return false;
    }
  };

  useEffect(() => {
    console.log("AuthProvider: Initializing auth");

    // Initialize password reset manager
    passwordResetManager.initialize();

    let mounted = true;

    const initializeAuth = async () => {
      try {
        console.log("Checking for existing session...");

        // Get current session from Supabase
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (!mounted) return;

        if (error) {
          console.error("Error getting session:", error);
          setIsLoading(false);
          return;
        }

        console.log(
          "Session found:",
          session ? `yes (user: ${session.user.id})` : "no",
        );

        if (session?.user) {
          // Check if this is a recovery session that should be blocked
          const shouldBlock = await isRecoverySessionToBlock(session);

          if (shouldBlock) {
            console.log("🔐 Blocking recovery session during initialization");
            // Don't fetch profile - this prevents auto-login
            setIsLoading(false);
            return;
          }

          console.log("Normal session, fetching profile...");
          await fetchUserProfile(session.user.id);
        } else {
          console.log("No session found, user needs to sign in");
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Error in initializeAuth:", error);
        if (mounted) setIsLoading(false);
      }
    };

    initializeAuth();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(
        "Auth state changed:",
        event,
        session ? `session exists (${session?.user?.id})` : "no session",
      );

      if (!mounted) return;

      // Check if this is a recovery session that should be blocked
      const shouldBlock = await isRecoverySessionToBlock(session);

      if (shouldBlock) {
        console.log("🔐 Blocking recovery session from auth state change");
        setIsLoading(false);
        return;
      }

      // Handle PASSWORD_RECOVERY events - allow them but don't auto-login
      if (event === "PASSWORD_RECOVERY") {
        console.log(
          "🔐 PASSWORD_RECOVERY event detected - allowing password reset flow",
        );
        setIsLoading(false);
        return;
      }

      // Normal auth flow
      if (session?.user) {
        console.log("Normal authentication, fetching profile...");
        await fetchUserProfile(session.user.id);
      } else {
        console.log("User signed out, clearing state");
        setUser(null);
        setProfile(null);
        setIsLoading(false);
      }
    });

    return () => {
      console.log("AuthProvider: Cleaning up");
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // In AuthContext.tsx - update fetchUserProfile

  const fetchUserProfile = async (userId: string) => {
    try {
      console.log("📥 Fetching profile for user:", userId);

      // Step 1: Get base user from users table
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (userError || !userData) {
        console.error("❌ Error fetching base user:", userError);
        setIsLoading(false);
        return;
      }

      console.log("✅ Base user data found:", userData.email);

      // Step 2: Get specific user data based on user type
      let specificUserData = null;
      switch (userData.user_type) {
        case "customer":
          const { data: customerData } = await supabase
            .from("customers")
            .select("*")
            .eq("id", userId)
            .maybeSingle();
          specificUserData = customerData;
          break;
        case "restaurant":
          const { data: restaurantData } = await supabase
            .from("restaurants")
            .select("*")
            .eq("id", userId)
            .maybeSingle();
          specificUserData = restaurantData;
          break;
        case "driver":
          const { data: driverData } = await supabase
            .from("delivery_users")
            .select("*")
            .eq("id", userId)
            .maybeSingle();
          specificUserData = driverData;
          break;
      }

      if (specificUserData) {
        console.log("✅ Specific user data found");
      } else {
        console.log(
          "ℹ️ No specific user data found - user may be newly created",
        );
      }

      // Step 3: Get profile data
      const { data: profileData } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      // Step 4: Combine all data
      const combinedUserData = {
        ...userData,
        ...specificUserData,
        role: userData.user_type,
        profile: profileData,
      };

      setUser(combinedUserData);
      setProfile(profileData);

      // Check for new orders if user is restaurant
      if (combinedUserData.user_type === "restaurant") {
        await updateNewOrdersStatus(userId);
      }

      setIsLoading(false);

      // IMPORTANT: Register push token AFTER user data is set
      // Use setTimeout to ensure it doesn't block the main flow
      setTimeout(() => {
        setupPushNotifications(userId);
      }, 1000);

      console.log("✅ User profile fully loaded");
    } catch (error) {
      console.error("💥 Error in fetchUserProfile:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Update the setupPushNotifications function with better error handling
  // Update this function in AuthContext.tsx
  const setupPushNotifications = async (userId: string) => {
    try {
      console.log("Setting up push notifications for user:", userId);

      // Import and call the register method
      const { PushNotificationService } =
        await import("./services/PushNotificationService");

      // Make sure PushNotificationService is initialized first
      await PushNotificationService.initialize();

      // Register the push token
      await PushNotificationService.registerPushToken(userId);

      console.log("✅ Push notification setup completed for user:", userId);
    } catch (error) {
      console.log("Push notification setup failed:", error);
    }
  };

  // In your signIn function in AuthContext
  const signIn = async (email: string, password: string) => {
    try {
      console.log("Signing in user:", email);

      // Clear any reset sessions
      await passwordResetManager.clearSession();
      await AsyncStorage.multiRemove([
        "has_valid_reset_session",
        "recovery_session_active",
      ]);

      const { error, data } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        console.error("Sign in error:", error);
        return { error };
      }

      console.log("Sign in successful for user:", data.user.id);

      // Send sign in notification
      try {
        await NotificationService.sendSignInNotification(data.user.id, {});
      } catch (notifError) {
        console.log("Sign in notification error (non-critical):", notifError);
      }

      // The auth state change listener will handle the rest
      return { error: null, data };
    } catch (error: any) {
      console.error("Error in signIn:", error);
      return { error };
    }
  };

  // Add these functions
  const signInAsGuest = async () => {
    try {
      // Create a temporary guest session
      const guestId = `guest_${Date.now()}`;
      const guestUser = {
        id: guestId,
        email: `guest_${Date.now()}@temp.com`,
        full_name: "Guest User",
        user_type: "customer",
        is_guest: true,
        profile_image_url: null,
      };

      setUser(guestUser as any);
      setIsGuest(true);

      // Store guest flag
      await AsyncStorage.setItem("is_guest", "true");

      console.log("👤 Guest user created:", guestId);
    } catch (error) {
      console.error("Error creating guest user:", error);
    }
  };

  const convertGuestToUser = async (
    email: string,
    password: string,
    userData: any,
  ) => {
    try {
      // Sign up the guest user
      const { error, data } = await signUp(email, password, userData);

      if (!error) {
        // Clear guest flag
        await AsyncStorage.removeItem("is_guest");
        setIsGuest(false);
      }

      return { error, data };
    } catch (error) {
      return { error };
    }
  };

  // Helper functions for inserting specific user data
  const insertCustomerData = async (userId: string, userData: any) => {
    try {
      const customerRecord = {
        id: userId,
        date_of_birth: userData.dateOfBirth || null,
        gender: userData.gender || null,
        address: userData.address || "",
        latitude: userData.latitude || null,
        longitude: userData.longitude || null,
        location_code: userData.locationCode || null,
        total_orders: 0,
        loyalty_points: 100,
        favorite_cuisines: userData.preferredCuisines || [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      console.log("📝 Inserting customer data:", customerRecord);

      const { error } = await supabase
        .from("customers")
        .insert([customerRecord]);

      if (error) {
        console.error("❌ Customer data insertion error:", error);
        if (error.code === "23505") {
          console.log("🔄 Customer already exists");
        } else if (error.code === "23503") {
          console.log("⚠️ Foreign key violation - user might not exist yet");
          // Try again after a delay
          await new Promise((resolve) => setTimeout(resolve, 1000));
          const { error: retryError } = await supabase
            .from("customers")
            .insert([customerRecord]);
          if (retryError) {
            console.error("❌ Retry failed:", retryError);
          }
        }
      } else {
        console.log("✅ Customer data inserted successfully");
      }
    } catch (error) {
      console.error("💥 Error in insertCustomerData:", error);
    }
  };

  const insertRestaurantData = async (userId: string, userData: any) => {
    try {
      const restaurantRecord = {
        id: userId,
        restaurant_name: userData.restaurantName || "",
        cuisine_type: userData.cuisineType || null,
        business_license: userData.businessLicense || "",
        opening_hours: userData.openingHours || "",
        capacity: userData.capacity ? parseInt(userData.capacity) : null,
        delivery_radius: userData.deliveryRadius
          ? parseInt(userData.deliveryRadius)
          : null,
        payment_methods: userData.paymentMethods || [],
        address: userData.address || "",
        latitude: userData.latitude || null,
        longitude: userData.longitude || null,
        location_code: userData.locationCode || null,
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

      console.log("📝 Inserting restaurant data:", restaurantRecord);

      const { error } = await supabase
        .from("restaurants")
        .insert([restaurantRecord]);

      if (error) {
        console.error("❌ Restaurant data insertion error:", error);
        if (error.code === "23505") {
          console.log("🔄 Restaurant already exists");
        } else if (error.code === "23503") {
          console.log("⚠️ Foreign key violation - user might not exist yet");
          // Try again after a delay
          await new Promise((resolve) => setTimeout(resolve, 1000));
          const { error: retryError } = await supabase
            .from("restaurants")
            .insert([restaurantRecord]);
          if (retryError) {
            console.error("❌ Retry failed:", retryError);
          }
        }
      } else {
        console.log("✅ Restaurant data inserted successfully");
      }
    } catch (error) {
      console.error("💥 Error in insertRestaurantData:", error);
    }
  };

  const insertDeliveryUserData = async (userId: string, userData: any) => {
    try {
      const deliveryUserRecord = {
        id: userId,
        vehicle_type: userData.vehicleType || null,
        license_number: userData.licenseNumber || "",
        vehicle_plate: userData.vehiclePlate || "",
        years_of_experience: userData.yearsOfExperience
          ? parseInt(userData.yearsOfExperience)
          : null,
        availability: userData.availability || null,
        insurance_number: userData.insuranceNumber || null,
        address: userData.address || "",
        latitude: userData.latitude || null,
        longitude: userData.longitude || null,
        location_code: userData.locationCode || null,
        driver_status: "available",
        total_deliveries: 0,
        rating: 0.0,
        current_location_lat: userData.latitude || null,
        current_location_lng: userData.longitude || null,
        is_online: false,
        earnings_today: 0.0,
        total_earnings: 0.0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      console.log("📝 Inserting delivery user data:", deliveryUserRecord);

      const { error } = await supabase
        .from("delivery_users")
        .insert([deliveryUserRecord]);

      if (error) {
        console.error("❌ Delivery user data insertion error:", error);
        if (error.code === "23505") {
          console.log("🔄 Delivery user already exists");
        } else if (error.code === "23503") {
          console.log("⚠️ Foreign key violation - user might not exist yet");
          // Try again after a delay
          await new Promise((resolve) => setTimeout(resolve, 1000));
          const { error: retryError } = await supabase
            .from("delivery_users")
            .insert([deliveryUserRecord]);
          if (retryError) {
            console.error("❌ Retry failed:", retryError);
          }
        }
      } else {
        console.log("✅ Delivery user data inserted successfully");
      }
    } catch (error) {
      console.error("💥 Error in insertDeliveryUserData:", error);
    }
  };

  const signUp = async (email: string, password: string, userData: any) => {
    try {
      console.log("🚀 Starting sign up process for:", email);
      console.log("📋 User type:", userData.userType);

      // Step 1: Create user in Supabase Auth
      console.log("🔐 Creating auth user...");
      const { error: authError, data: authData } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            user_type: userData.userType,
            full_name: userData.fullName,
            phone: userData.phone,
            countryCode: userData.countryCode,
            address: userData.address,
            latitude: userData.latitude,
            longitude: userData.longitude,
            locationCode: userData.locationCode,
            ...(userData.userType === "customer" && {
              dateOfBirth: userData.dateOfBirth,
              gender: userData.gender,
            }),
            ...(userData.userType === "restaurant" && {
              restaurantName: userData.restaurantName,
              cuisineType: userData.cuisineType,
              businessLicense: userData.businessLicense,
              openingHours: userData.openingHours,
              capacity: userData.capacity,
              deliveryRadius: userData.deliveryRadius,
              paymentMethods: userData.paymentMethods,
            }),
            ...(userData.userType === "driver" && {
              vehicleType: userData.vehicleType,
              licenseNumber: userData.licenseNumber,
              vehiclePlate: userData.vehiclePlate,
              yearsOfExperience: userData.yearsOfExperience,
              availability: userData.availability,
              insuranceNumber: userData.insuranceNumber,
            }),
          },
          emailRedirectTo: "mataim://home",
        },
      });

      if (authError) {
        console.error("❌ Auth sign up error:", authError);
        return { error: authError };
      }

      if (!authData.user) {
        console.error("❌ No user data returned from auth");
        return { error: new Error("No user data returned") };
      }

      console.log("✅ Auth user created:", authData.user.id);

      // Wait for auth user to be fully created
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Step 2: Create user in custom users table
      console.log("📝 Creating base user record...");
      const baseUserRecord = {
        id: authData.user.id,
        email: email.trim().toLowerCase(),
        phone: userData.phone,
        country_code: userData.countryCode,
        full_name: userData.fullName,
        user_type: userData.userType,
        is_verified: false,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error: userInsertError } = await supabase
        .from("users")
        .insert([baseUserRecord]);

      if (userInsertError) {
        if (userInsertError.code === "23505") {
          console.log("🔄 User already exists in users table");
        } else {
          console.error("❌ Error creating base user:", userInsertError);
          // Continue anyway - try to create specific data
        }
      } else {
        console.log("✅ Base user record created");
      }

      // Step 3: Create specific user data based on type
      console.log("🎯 Creating specific user data...");

      switch (userData.userType) {
        case "customer":
          await insertCustomerData(authData.user.id, userData);
          break;
        case "restaurant":
          await insertRestaurantData(authData.user.id, userData);
          break;
        case "driver":
          await insertDeliveryUserData(authData.user.id, userData);
          break;
      }

      // Step 4: Create user profile
      console.log("👤 Creating user profile...");
      const { error: profileError } = await supabase
        .from("user_profiles")
        .insert({
          user_id: authData.user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (profileError && profileError.code !== "23505") {
        console.log("ℹ️ Profile creation note:", profileError.message);
      } else {
        console.log("✅ Profile created/updated");
      }

      // Step 5: Send welcome notification
      try {
        await NotificationService.sendWelcomeNotification(
          authData.user.id,
          userData.fullName,
        );
      } catch (notifError) {
        console.log("Notification error (non-critical):", notifError);
      }

      console.log("🎉 Sign up completed successfully!");

      return {
        data: {
          user: authData.user,
          session: authData.session,
        },
        error: null,
      };
    } catch (error: any) {
      console.error("💥 Unexpected error in signUp:", error);
      return { error };
    }
  };
  // In your AuthContext signOut function
  const signOut = async () => {
    try {
      console.log("AuthContext: Starting sign out process");

      // Remove push token before signing out
      if (user?.id) {
        const { PushNotificationService } =
          await import("./services/PushNotificationService");
        await PushNotificationService.removeUserTokens(user.id);
      }

      // Clear password reset session
      await passwordResetManager.clearSession();
      await AsyncStorage.multiRemove([
        "has_valid_reset_session",
        "recovery_session_active",
      ]);

      // Sign out from Supabase
      const { error } = await supabase.auth.signOut();

      if (error) {
        console.error("Sign out error:", error);
      }

      setUser(null);
      setProfile(null);
    } catch (error) {
      console.error("Error in signOut:", error);
      setUser(null);
      setProfile(null);
    }
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!profile) return;

    const { error, data } = await supabase
      .from("user_profiles")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", profile.id);

    if (!error && data) {
      setProfile(data[0]);
    }
  };

  const checkRestaurantSetupComplete = async (userId: string) => {
    return await checkRestaurantSetup(userId);
  };

  const clearNewOrdersNotification = useCallback(() => {
    setUser((prev) =>
      prev
        ? {
            ...prev,
            hasNewOrders: false,
            newOrdersCount: 0,
          }
        : prev,
    );
  }, []);

  // Add this function in your AuthProvider
  const updateNewOrdersStatus = useCallback(async (userId: string) => {
    if (!userId) return;

    try {
      const { data: restaurantData } = await supabase
        .from("restaurants")
        .select("id")
        .eq("id", userId)
        .single();

      if (!restaurantData) return;

      // Get pending orders count
      const { data: pendingOrders, count } = await supabase
        .from("orders")
        .select("*", { count: "exact" })
        .eq("restaurant_id", restaurantData.id)
        .eq("status", "pending");

      const hasNew = pendingOrders && pendingOrders.length > 0;
      const newCount = count || 0;

      // Update user object
      setUser((prev) =>
        prev
          ? {
              ...prev,
              hasNewOrders: hasNew,
              newOrdersCount: newCount,
            }
          : prev,
      );

      console.log(`📊 New orders status: ${hasNew} (${newCount} pending)`);
    } catch (error) {
      console.error("Error updating new orders status:", error);
    }
  }, []);

  // Add this function to your AuthContext or use it in profile screen
  const refreshRestaurantData = async () => {
    if (!user?.id) return;

    try {
      setIsLoading(true);

      // Fetch combined user data with restaurant image
      const { data: combinedData, error } = await supabase
        .from("users")
        .select(
          `
        *,
        restaurants!inner (
          restaurant_name,
          cuisine_type,
          address,
          image_url,
          opening_hours,
          business_license,
          total_orders,
          restaurant_rating,
          has_delivery,
          has_pickup
        ),
        user_profiles!left (
          avatar_url,
          bio
        )
      `,
        )
        .eq("id", user.id)
        .single();

      if (error) {
        console.error("Error refreshing restaurant data:", error);
        return;
      }

      // Update local state with combined data
      if (combinedData) {
        // The combinedData will have restaurant fields directly accessible
        console.log(
          "🔄 Refreshed restaurant data with image:",
          combinedData.restaurants?.image_url,
        );

        // You might need to update your user state here
        // This depends on how your auth context is structured
      }
    } catch (error) {
      console.error("Error in refreshRestaurantData:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshUserData = async () => {
    if (user?.id) {
      await fetchUserProfile(user.id);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        isLoading,
        signIn,
        signUp,
        signOut,
        updateProfile,
        refreshUserData,
        checkRestaurantSetupComplete,
        refreshRestaurantData,
        updateNewOrdersStatus,
        clearNewOrdersNotification,

        isGuest,
        signInAsGuest,
        convertGuestToUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

// Add this function to your AuthContext or a separate helper file
export const getCombinedUserData = async (userId: string) => {
  try {
    // Get user data
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();

    if (userError) throw userError;

    // Get restaurant data if user is a restaurant
    let restaurantData = null;
    if (userData.user_type === "restaurant") {
      const { data: restData, error: restError } = await supabase
        .from("restaurants")
        .select("*")
        .eq("id", userId)
        .single();

      if (!restError) {
        restaurantData = restData;
      }
    }

    // Get profile data
    const { data: profileData } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    // Combine all data
    return {
      ...userData,
      ...restaurantData,
      profile: profileData,
    };
  } catch (error) {
    console.error("Error getting combined user data:", error);
    return null;
  }
};

export const markRestaurantSetupComplete = async (userId: string) => {
  try {
    // This will automatically set setup_completed to true via the trigger
    // when all required fields are filled
    const { error } = await supabase
      .from("restaurants")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", userId);

    if (error) throw error;

    return true;
  } catch (error) {
    console.error("Error marking setup as complete:", error);
    return false;
  }
};
