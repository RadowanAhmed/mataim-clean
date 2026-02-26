// app/_layout.tsx
import { LocationProvider } from "@/backend/LocationContext";
import { PushNotificationService } from "@/backend/services/PushNotificationService";
import { NotificationService } from "@/backend/services/notificationService";
import * as Notifications from "expo-notifications";
import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { AuthProvider, useAuth } from "../backend/AuthContext";
import { NotificationProvider } from "../backend/NotificationContext";

import { supabase } from "@/backend/supabase";
import {
  OnboardingProvider,
  useOnboarding,
} from "../backend/OnboardingContext";
import { passwordResetManager } from "../backend/PasswordResetManager";
import { useNotifications } from "../backend/hooks/useNotifications";

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { hasCompletedOnboarding, isLoading: onboardingLoading } =
    useOnboarding();
  const [initialized, setInitialized] = useState(false);
  const [notificationInitialized, setNotificationInitialized] = useState(false);

  // In your _layout.tsx, update the registerToken useEffect:

  useEffect(() => {
    const registerToken = async () => {
      if (user?.id) {
        console.log(`📱 Attempting to register push token for:`);
        console.log(`   - User ID: ${user.id}`);
        console.log(`   - Email: ${user.email}`);
        console.log(`   - Type: ${user.user_type}`);

        try {
          await PushNotificationService.registerPushToken(user.id);

          // Verify after registration
          const { data } = await supabase
            .from("user_push_tokens")
            .select("*")
            .eq("user_id", user.id);

          console.log(
            `✅ Verification: User ${user.email} now has ${data?.length || 0} tokens`,
          );
        } catch (error) {
          console.error(
            `❌ Failed to register token for ${user.email}:`,
            error,
          );
        }
      }
    };

    registerToken();
  }, [user?.id]);

  // Initialize all services
  useEffect(() => {
    const initializeServices = async () => {
      try {
        console.log("🔄 Initializing application services...");

        // 1. Initialize password reset manager
        await passwordResetManager.initialize();
        console.log("✅ PasswordResetManager initialized");

        // 2. Initialize basic notification service
        await NotificationService.initialize();
        console.log("✅ NotificationService initialized");

        // 3. Initialize push notifications (local notifications)
        await PushNotificationService.initialize();
        console.log("✅ PushNotificationService initialized");

        setNotificationInitialized(true);
        setInitialized(true);

        console.log("🎉 All services initialized successfully");
      } catch (error) {
        console.error("❌ Error initializing services:", error);
        // Still set initialized to true to allow app to load
        setInitialized(true);
      }
    };

    initializeServices();
  }, []);

  // Setup notification tap handler
  useEffect(() => {
    if (!notificationInitialized) return;

    console.log("🔔 Setting up notification handlers...");

    // Handle notification response (tap) - this works when app is in background or closed
    const responseListener =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data;
        console.log("📱 Notification tapped with data:", data);

        // Navigate based on notification data
        if (data.screen) {
          console.log("📍 Navigating to screen:", data.screen);
          router.push(data.screen);
        } else if (data.order_id) {
          let screen = "";
          if (user?.user_type === "driver") {
            screen = `/(driver)/orders/${data.order_id}`;
          } else if (user?.user_type === "restaurant") {
            screen = `/(restaurant)/orders/${data.order_id}`;
          } else {
            screen = `/orders/${data.order_id}`;
          }
          console.log("📍 Navigating to order:", screen);
          router.push(screen);
        } else if (data.conversation_id) {
          let screen = "";
          if (user?.user_type === "driver") {
            screen = `/(driver)/messages/${data.conversation_id}`;
          } else if (user?.user_type === "restaurant") {
            screen = `/(restaurant)/messages/${data.conversation_id}`;
          } else {
            screen = `/messages/${data.conversation_id}`;
          }
          router.push(screen);
        }
      });

    return () => {
      responseListener.remove();
    };
  }, [notificationInitialized, user, router]);

  // Initialize notification listeners (for in-app notifications)
  useNotifications();

  // Hide splash screen when everything is ready
  useEffect(() => {
    if (initialized && !authLoading && !onboardingLoading) {
      console.log("✅ All data loaded, hiding splash screen");
      setTimeout(() => {
        SplashScreen.hideAsync();
      }, 1000); // 1 second delay for smooth transition
    }
  }, [authLoading, onboardingLoading, initialized]);

  // Show loading screen while initializing
  if (!initialized || authLoading || onboardingLoading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#fff",
        }}
      >
        <ActivityIndicator size="large" color="#FF6B35" />
      </View>
    );
  }

  return (
    <NotificationProvider>
      <Stack screenOptions={{ headerShown: false }}>
        {/* Authentication screens */}
        <Stack.Screen name="(auth)" />

        {/* Onboarding screens */}
        <Stack.Screen name="(onboarding)" />

        {/* Main customer app */}
        <Stack.Screen name="(tabs)" />

        {/* Restaurant panel */}
        <Stack.Screen name="(restaurant)" />

        {/* Driver panel */}
        <Stack.Screen name="(driver)" />

        {/* Splash and index screens */}
        <Stack.Screen name="splash" />
        <Stack.Screen name="index" />

        {/* Modal screens - optional */}
        {/* <Stack.Screen 
          name="modal" 
          options={{ 
            presentation: 'modal',
            animation: 'slide_from_bottom'
          }} 
        /> */}

        <Stack.Screen
          name="admin/bulk-create-restaurants"
          options={{ headerShown: false }}
        />
      </Stack>
    </NotificationProvider>
  );
}

export default function RootLayout() {
  return (
    <OnboardingProvider>
      <LocationProvider>
        <AuthProvider>
          <RootLayoutNav />
        </AuthProvider>
      </LocationProvider>
    </OnboardingProvider>
  );
}
