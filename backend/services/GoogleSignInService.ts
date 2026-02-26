// backend/services/GoogleSignInService.ts
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";
import { supabase } from "../supabase";

export class GoogleSignInService {
  static async signInWithGoogle(
    userType: "customer" | "restaurant" | "driver" = "customer",
  ) {
    try {
      console.log("🔐 Starting Google Sign-In...");

      // Use Supabase's built-in OAuth which handles everything
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: Platform.select({
            web: "https://zkdbkmukugayxhnmzfxa.supabase.co/auth/v1/callback",
            default: "mataim://auth/callback",
          }),
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });

      if (error) throw error;

      if (!data?.url) {
        throw new Error("No authentication URL received");
      }

      console.log("Opening auth URL...");

      // Open the browser for authentication
      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        "mataim://auth/callback",
      );

      console.log("Auth result:", result.type);

      if (result.type === "success") {
        // Get the session - wait a bit for it to be set
        await new Promise((resolve) => setTimeout(resolve, 1000));

        const { data: sessionData, error: sessionError } =
          await supabase.auth.getSession();

        if (sessionError) throw sessionError;

        if (!sessionData.session) {
          throw new Error("No session found after authentication");
        }

        const user = sessionData.session.user;

        // Check if user exists
        const { data: existingUser } = await supabase
          .from("users")
          .select("*")
          .eq("id", user.id)
          .single();

        // If user doesn't exist, create profile
        if (!existingUser) {
          console.log("📝 Creating new user profile...");

          // Create base user
          await supabase.from("users").insert({
            id: user.id,
            email: user.email!,
            full_name:
              user.user_metadata?.full_name ||
              user.user_metadata?.name ||
              "Google User",
            phone: null,
            country_code: null,
            user_type: userType,
            profile_image_url:
              user.user_metadata?.avatar_url || user.user_metadata?.picture,
            is_verified: true,
            is_active: true,
            google_id: user.id,
          });

          // Create user profile
          await supabase.from("user_profiles").insert({
            user_id: user.id,
            avatar_url:
              user.user_metadata?.avatar_url || user.user_metadata?.picture,
          });

          // Create type-specific profile
          if (userType === "restaurant") {
            await supabase.from("restaurants").insert({
              id: user.id,
              restaurant_name:
                user.user_metadata?.full_name ||
                user.user_metadata?.name ||
                "New Restaurant",
              business_license: "GOOGLE_" + Date.now(),
              address: "",
              restaurant_status: "active",
            });
          } else if (userType === "driver") {
            await supabase.from("delivery_users").insert({
              id: user.id,
              license_number: "PENDING",
              vehicle_plate: "PENDING",
              driver_status: "available",
            });
          }

          console.log("✅ User profile created successfully");
        } else {
          console.log("✅ Existing user found");
          // Update last_login
          await supabase
            .from("users")
            .update({ last_login: new Date().toISOString() })
            .eq("id", user.id);
        }

        return {
          success: true,
          data: sessionData,
          isNewUser: !existingUser,
        };
      }

      return {
        success: false,
        error: "Authentication cancelled",
      };
    } catch (error: any) {
      console.error("❌ Google sign in error:", error);
      return {
        success: false,
        error: error.message || "Failed to sign in with Google",
      };
    }
  }
}
