// backend/services/PushNotificationService.ts
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { supabase } from "../supabase";

export class PushNotificationService {
  private static initialized = false;

  // Notification sound configuration
  private static SOUNDS = {
    DEFAULT: "default",
    ORDER: "order-ready.wav",
    NEW_ORDER: "new-order.wav",
    DELIVERY: "delivery.wav",
    ALERT: "alert.wav",
    SUCCESS: "success.wav",
  };

  // Initialize notifications with sound support
  static async initialize() {
    if (this.initialized) return;

    console.log("📱 Initializing push notifications with sound...");

    try {
      // Configure notification handler with sound
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });

      // Request permissions
      await this.requestPermissions();

      // Create notification channels with sound (Android)
      if (Platform.OS === "android") {
        await this.createNotificationChannels();
      }

      this.initialized = true;
      console.log("✅ Push notifications with sound initialized");
    } catch (error) {
      console.error("❌ Error initializing push notifications:", error);
    }
  }

  // Create notification channels with sound
  private static async createNotificationChannels() {
    try {
      // Main orders channel with custom sound
      await Notifications.setNotificationChannelAsync("orders", {
        name: "Orders",
        description: "Order updates and notifications",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF6B35",
        lockscreenVisibility:
          Notifications.AndroidNotificationVisibility.PUBLIC,
        sound: this.SOUNDS.ORDER,
        enableVibrate: true,
        showBadge: true,
      });

      // Messages channel
      await Notifications.setNotificationChannelAsync("messages", {
        name: "Messages",
        description: "Message notifications",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#3B82F6",
        sound: "default",
        enableVibrate: true,
        showBadge: true,
      });

      // Delivery channel
      await Notifications.setNotificationChannelAsync("delivery", {
        name: "Delivery",
        description: "Delivery updates",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 500, 250, 500],
        lightColor: "#10B981",
        sound: this.SOUNDS.DELIVERY,
        enableVibrate: true,
      });

      console.log("✅ Notification channels with sounds created");
    } catch (error) {
      console.error("❌ Error creating notification channels:", error);
    }
  }

  // Register push token for user
  // In backend/services/PushNotificationService.ts

  // backend/services/PushNotificationService.ts

  // backend/services/PushNotificationService.ts

  // backend/services/PushNotificationService.ts

  static async registerPushToken(userId: string) {
    try {
      console.log("📱 Registering push token for user:", userId);

      // Simplified check - just try to get token, don't block on emulator
      const isEmulator = !Device.isDevice;

      if (isEmulator) {
        console.log(
          "📱 Running on emulator - will attempt to get token anyway",
        );
        // Just continue - some emulators with Google Play work
      }

      // Check permissions
      const { status: existingStatus } =
        await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== "granted") {
        console.log("⚠️ Notification permission not granted");

        // For emulators, insert a mock token for testing
        if (isEmulator) {
          console.log("📱 Inserting mock token for emulator testing");
          const mockToken = `MockToken_${userId}_${Date.now()}`;

          await supabase.from("user_push_tokens").upsert(
            {
              user_id: userId,
              expo_push_token: mockToken,
              device_type: "android_emulator",
              is_active: true,
              updated_at: new Date().toISOString(),
            },
            {
              onConflict: "user_id",
            },
          );

          console.log("✅ Mock token inserted");
          return true;
        }

        return false;
      }

      // Get projectId
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      if (!projectId) {
        console.log("⚠️ No projectId found");
        return false;
      }

      // Get Expo push token
      console.log("📱 Getting Expo push token...");
      const token = await Notifications.getExpoPushTokenAsync({
        projectId,
      });

      console.log("✅ Got push token:", token.data);

      // Store token in database
      const { data: existing } = await supabase
        .from("user_push_tokens")
        .select("id")
        .eq("expo_push_token", token.data)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("user_push_tokens")
          .update({
            user_id: userId,
            device_type: Platform.OS,
            is_active: true,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);

        console.log("✅ Updated existing token for user:", userId);
      } else {
        await supabase.from("user_push_tokens").insert({
          user_id: userId,
          expo_push_token: token.data,
          device_type: Platform.OS,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        console.log("✅ Inserted new token for user:", userId);
      }

      // Verify
      const { data: verify } = await supabase
        .from("user_push_tokens")
        .select("id")
        .eq("user_id", userId)
        .eq("is_active", true);

      console.log(
        `✅ User ${userId} now has ${verify?.length || 0} active tokens`,
      );
      return true;
    } catch (error) {
      console.error("❌ Error in registerPushToken:", error);

      // For emulators, insert mock token on error too
      if (!Device.isDevice) {
        try {
          const mockToken = `MockToken_${userId}_${Date.now()}`;
          await supabase.from("user_push_tokens").upsert(
            {
              user_id: userId,
              expo_push_token: mockToken,
              device_type: "android_emulator",
              is_active: true,
              updated_at: new Date().toISOString(),
            },
            {
              onConflict: "user_id",
            },
          );
          console.log("✅ Mock token inserted after error");
          return true;
        } catch (mockError) {
          console.error("❌ Even mock token failed:", mockError);
        }
      }

      return false;
    }
  }

  // Helper to get or generate device ID
  private static async getDeviceId(): Promise<string> {
    try {
      // Try to get from storage
      const { getItemAsync } = await import("expo-secure-store");
      let deviceId = await getItemAsync("device_id");

      if (!deviceId) {
        // Generate new device ID
        deviceId = `device_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const { setItemAsync } = await import("expo-secure-store");
        await setItemAsync("device_id", deviceId);
      }

      return deviceId;
    } catch (error) {
      // Fallback to random ID
      return `device_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
  }

  // Clean up old tokens
  private static async cleanupOldTokens(userId: string) {
    try {
      // Get all active tokens for user, ordered by last_used_at
      const { data: tokens } = await supabase
        .from("user_push_tokens")
        .select("id, last_used_at")
        .eq("user_id", userId)
        .eq("is_active", true)
        .order("last_used_at", { ascending: false });

      if (tokens && tokens.length > 3) {
        // Deactivate all but the 3 most recently used
        const keepIds = tokens.slice(0, 3).map((t) => t.id);

        await supabase
          .from("user_push_tokens")
          .update({ is_active: false })
          .eq("user_id", userId)
          .not("id", "in", `(${keepIds.join(",")})`);

        console.log(
          `🧹 Cleaned up ${tokens.length - 3} old tokens for user ${userId}`,
        );
      }
    } catch (error) {
      console.error("Error cleaning up old tokens:", error);
    }
  }

  // Update sendToUser to handle multiple tokens properly
  static async sendToUser(
    userId: string,
    title: string,
    body: string,
    data: any = {},
  ) {
    try {
      console.log(`📱 Sending push notification to user: ${userId}`);

      // Get user's push tokens from the database
      const { data: tokens, error } = await supabase
        .from("user_push_tokens")
        .select("expo_push_token")
        .eq("user_id", userId);

      if (error) {
        console.error("Error fetching push tokens:", error);
        return false;
      }

      if (!tokens || tokens.length === 0) {
        console.log("No push tokens found for user:", userId);
        return false;
      }

      // Remove duplicate tokens (in case of duplicates)
      const uniqueTokens = [
        ...new Map(tokens.map((item) => [item.expo_push_token, item])).values(),
      ];

      console.log(
        `📱 Found ${uniqueTokens.length} unique tokens for user ${userId}`,
      );

      // Prepare messages for Expo push service
      const messages = uniqueTokens.map((token) => ({
        to: token.expo_push_token,
        sound: "default",
        title: title,
        body: body,
        data: {
          ...data,
          _displayInForeground: true,
        },
        priority: "high",
        channelId: "messages",
      }));

      // Send to Expo's push service
      const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(messages),
      });

      const result = await response.json();
      console.log("Push notification result:", result);

      return true;
    } catch (error) {
      console.error("Error sending push notification:", error);
      return false;
    }
  }

  // Add this method to PushNotificationService
  static async removeUserTokens(userId: string) {
    try {
      const { error } = await supabase
        .from("user_push_tokens")
        .delete()
        .eq("user_id", userId);

      if (error) {
        console.error("Error removing user tokens:", error);
      } else {
        console.log("✅ Removed push tokens for user:", userId);
      }
    } catch (error) {
      console.error("Error in removeUserTokens:", error);
    }
  }

  // Request permissions
  private static async requestPermissions() {
    if (!Device.isDevice) {
      console.log("📱 Not a physical device, skipping permissions");
      return false;
    }

    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.log("⚠️ Notification permission not granted");
      return false;
    }

    console.log("✅ Notification permission granted");
    return true;
  }

  // Setup notification handler
  static setupNotificationHandler(onNotificationTap?: (data: any) => void) {
    // Handle notification received in foreground
    const receivedSubscription = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log(
          "📱 Notification received with sound:",
          notification.request.content,
        );
      },
    );

    // Handle notification response (tap)
    const responseSubscription =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data;
        console.log("📱 Notification tapped:", data);

        if (onNotificationTap) {
          onNotificationTap(data);
        }
      });

    return () => {
      receivedSubscription.remove();
      responseSubscription.remove();
    };
  }

  // Clear all notifications
  static async clearAllNotifications() {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      await Notifications.setBadgeCountAsync(0);
      console.log("✅ All notifications cleared");
    } catch (error) {
      console.error("❌ Error clearing notifications:", error);
    }
  }
}
