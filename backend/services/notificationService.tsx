// backend/services/NotificationService.tsx (Updated)
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { supabase } from "../supabase";

const isExpoGo = Constants.appOwnership === "expo";

// Configure notification handling
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export class NotificationService {
  // Initialize notification service
  static async initialize() {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== "granted") {
        await Notifications.requestPermissionsAsync();
      }
      console.log("🔔 Notification service initialized");
    } catch (error) {
      console.error("❌ Error initializing notification service:", error);
    }
  }

  // Send notification based on user type
  static async sendNotification(
    userId: string,
    title: string,
    body: string,
    type: string = "info",
    data: any = {},
    userType?: string,
  ) {
    try {
      // Get user type if not provided
      if (!userType) {
        const { data: userData } = await supabase
          .from("users")
          .select("user_type")
          .eq("id", userId)
          .single();
        userType = userData?.user_type || "customer";
      }

      // Determine which table to insert into
      let tableName: string;
      let userIdColumn: string;

      switch (userType) {
        case "restaurant":
          tableName = "restaurant_notifications";
          userIdColumn = "restaurant_id";
          break;
        case "driver":
          tableName = "driver_notifications";
          userIdColumn = "driver_id";
          break;
        default:
          tableName = "user_notifications";
          userIdColumn = "user_id";
      }

      // Insert notification
      const { data: notification, error } = await supabase
        .from(tableName)
        .insert([
          {
            [userIdColumn]: userId,
            title,
            body,
            type,
            data,
            read: false,
            created_at: new Date().toISOString(),
          },
        ])
        .select()
        .single();

      if (error) throw error;

      // Send push notification
      await this.sendPushNotification(title, body, data);

      return { success: true, data: notification };
    } catch (error: any) {
      console.error("❌ Error sending notification:", error);
      return { success: false, error: error.message };
    }
  }

  // Order lifecycle notifications
  // Order lifecycle notifications - FIXED VERSION
  // SIMPLIFIED VERSION - Basic order notification
  // FIXED - Order lifecycle notifications
  // Enhanced sendOrderNotification with post data
  static async sendOrderNotification(orderId: string, status: string) {
    try {
      console.log("📦 Sending order notification for:", orderId, status);

      // Get order with post data
      const { data: order, error } = await supabase
        .from("orders")
        .select(
          `
        id,
        order_number,
        customer_id,
        restaurant_id,
        driver_id,
        status,
        post_id,
        restaurants:restaurants!orders_restaurant_id_fkey(
          restaurant_name
        )
      `,
        )
        .eq("id", orderId)
        .single();

      if (error) {
        console.error("❌ Error fetching order:", error);
        throw error;
      }

      // Try to get post data
      let postData = null;
      if (order.post_id) {
        try {
          const { data: post } = await supabase
            .from("posts")
            .select("id, title, image_url")
            .eq("id", order.post_id)
            .single();
          postData = post;
        } catch (postError) {
          console.log("No post data found for:", order.post_id);
        }
      }

      console.log("✅ Order and post data:", { order, postData });

      // Get notification config
      const config = this.getOrderNotificationConfig(status, order, postData);

      // Send to customer
      if (config.customer && order.customer_id) {
        console.log("📤 Sending to customer:", order.customer_id);
        await this.sendNotification(
          order.customer_id,
          config.customer.title,
          config.customer.body,
          "order",
          {
            order_id: orderId,
            order_number: order.order_number,
            status: status,
            post_id: postData?.id,
            post_title: postData?.title,
            post_image_url: postData?.image_url,
            restaurant_name: order.restaurants?.restaurant_name,
            action: "view_order",
            screen: `/orders/${orderId}`,
          },
          "customer",
        );
      }

      // Send to restaurant
      if (config.restaurant && order.restaurant_id) {
        console.log("📤 Sending to restaurant:", order.restaurant_id);
        await this.sendNotification(
          order.restaurant_id,
          config.restaurant.title,
          config.restaurant.body,
          "order",
          {
            order_id: orderId,
            order_number: order.order_number,
            status: status,
            post_id: postData?.id,
            post_title: postData?.title,
            post_image_url: postData?.image_url,
            restaurant_name: order.restaurants?.restaurant_name,
            action: "view_order",
            screen: `/(restaurant)/orders/${orderId}`,
          },
          "restaurant",
        );
      }

      // Send to driver if assigned
      if (order.driver_id && config.driver) {
        console.log("📤 Sending to driver:", order.driver_id);
        await this.sendNotification(
          order.driver_id,
          config.driver.title,
          config.driver.body,
          "order",
          {
            order_id: orderId,
            order_number: order.order_number,
            status: status,
            post_id: postData?.id,
            post_title: postData?.title,
            post_image_url: postData?.image_url,
            restaurant_name: order.restaurants?.restaurant_name,
            action: "view_order",
            screen: `/(driver)/orders/${orderId}`,
          },
          "driver",
        );
      }

      return { success: true };
    } catch (error: any) {
      console.error("❌ Error sending order notification:", error);
      return { success: false, error: error.message };
    }
  }

  // Welcome notification for new users
  static async sendWelcomeNotification(
    userId: string,
    userName: string,
    userType: string,
  ) {
    const messages = {
      customer: {
        title: `Welcome to Mataim, ${userName}! 🎉`,
        body: "Thank you for joining us! Discover amazing food from local restaurants.",
      },
      restaurant: {
        title: `Welcome to Mataim, ${userName}! 🍽️`,
        body: "Start managing your restaurant and receiving orders from hungry customers.",
      },
      driver: {
        title: `Welcome to Mataim, ${userName}! 🚚`,
        body: "Start earning by delivering food to customers. Go online to receive orders.",
      },
    };

    const message =
      messages[userType as keyof typeof messages] || messages.customer;

    return await this.sendNotification(
      userId,
      message.title,
      message.body,
      "system",
      {
        action: "welcome",
        screen:
          userType === "restaurant"
            ? "/(restaurant)/dashboard"
            : userType === "driver"
              ? "/(driver)/dashboard"
              : "/(tabs)/home",
      },
      userType,
    );
  }

  // Sign in notification
  static async sendSignInNotification(userId: string, userType: string) {
    const titles = {
      customer: "Welcome Back! 👋",
      restaurant: "Restaurant Dashboard 🍽️",
      driver: "Driver Dashboard 🚚",
    };

    return await this.sendNotification(
      userId,
      titles[userType as keyof typeof titles] || "Welcome Back!",
      "You have successfully signed in to your account.",
      "security",
      {
        action: "sign_in",
        screen:
          userType === "restaurant"
            ? "/(restaurant)/dashboard"
            : userType === "driver"
              ? "/(driver)/dashboard"
              : "/(tabs)",
      },
      userType,
    );
  }

  // Driver assignment notification
  static async sendDriverAssignmentNotification(
    orderId: string,
    driverId: string,
  ) {
    try {
      // Get order details
      const { data: order } = await supabase
        .from("orders")
        .select(
          `
          id,
          order_number,
          final_amount,
          estimated_delivery_time,
          restaurants!inner(
            restaurant_name,
            address,
            phone
          ),
          customers!inner(
            full_name
          ),
          delivery_address
        `,
        )
        .eq("id", orderId)
        .single();

      if (!order) {
        throw new Error("Order not found");
      }

      // Get post data if available
      let postData = null;
      const { data: orderWithPost } = await supabase
        .from("orders")
        .select("post_id")
        .eq("id", orderId)
        .single();

      if (orderWithPost?.post_id) {
        const { data: post } = await supabase
          .from("posts")
          .select("title, image_url, description")
          .eq("id", orderWithPost.post_id)
          .single();
        postData = post;
      }

      // Notify Driver
      await this.sendNotification(
        driverId,
        "🚴 New Delivery Assignment!",
        `You've been assigned to deliver order #${order.order_number} from ${order.restaurants?.restaurant_name}. Pickup required within 15 minutes.`,
        "order",
        {
          order_id: orderId,
          order_number: order.order_number,
          restaurant_name: order.restaurants?.restaurant_name,
          restaurant_address: order.restaurants?.address,
          restaurant_phone: order.restaurants?.phone,
          customer_name: order.customers?.full_name,
          delivery_address: order.delivery_address,
          estimated_delivery_time: order.estimated_delivery_time,
          earnings: `AED ${(order.final_amount * 0.8).toFixed(2)}`,
          post_title: postData?.title,
          post_image_url: postData?.image_url,
          action: "view_delivery",
          screen: `/(driver)/orders/${orderId}`,
          priority: "high",
        },
        "driver",
      );

      // Notify Customer
      await this.sendNotification(
        order.customer_id,
        "🚚 Driver Assigned!",
        `A driver has been assigned to your order #${order.order_number}. Your food will be on the way soon!`,
        "order",
        {
          order_id: orderId,
          order_number: order.order_number,
          action: "track_order",
          screen: `/orders/${orderId}`,
        },
        "customer",
      );

      // Notify Restaurant
      await this.sendNotification(
        order.restaurant_id,
        "✅ Driver Assigned Successfully",
        `A driver has been assigned to order #${order.order_number}. The order is now out for delivery.`,
        "order",
        {
          order_id: orderId,
          order_number: order.order_number,
          action: "view_order",
          screen: `/(restaurant)/orders/${orderId}`,
        },
        "restaurant",
      );

      return { success: true };
    } catch (error: any) {
      console.error("❌ Error sending driver assignment notification:", error);
      return { success: false, error: error.message };
    }
  }

  // Find nearest driver (for restaurant when order is ready)
  static async findAndAssignNearestDriver(orderId: string) {
    try {
      // Get order and restaurant location
      const { data: order } = await supabase
        .from("orders")
        .select("*, restaurants(latitude, longitude)")
        .eq("id", orderId)
        .single();

      if (!order || !order.restaurants) {
        throw new Error("Order or restaurant not found");
      }

      // Find available drivers within 20km radius
      const { data: drivers } = await supabase
        .from("delivery_users")
        .select("*, users!inner(full_name)")
        .eq("is_online", true)
        .eq("driver_status", "available");

      if (!drivers || drivers.length === 0) {
        // Send notification to restaurant that no drivers available
        await this.sendNotification(
          order.restaurant_id,
          "No Drivers Available ⚠️",
          "We couldn't find an available driver for your order. Customers will be notified about the delay.",
          "system",
          { order_id: orderId },
          "restaurant",
        );
        return null;
      }

      // Calculate distances and find nearest driver (simplified)
      const nearestDriver = drivers[0]; // In production, implement distance calculation

      // Assign driver
      const { error } = await supabase
        .from("orders")
        .update({
          driver_id: nearestDriver.id,
          status: "out_for_delivery",
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId);

      if (error) throw error;

      // Update driver status
      await supabase
        .from("delivery_users")
        .update({
          driver_status: "busy",
          updated_at: new Date().toISOString(),
        })
        .eq("id", nearestDriver.id);

      // Send assignment notifications
      await this.sendDriverAssignmentNotification(orderId, nearestDriver.id);

      return nearestDriver;
    } catch (error: any) {
      console.error("❌ Error finding/assigning driver:", error);
      return null;
    }
  }

  // Get notifications for a user
  static async getUserNotifications(
    userId: string,
    userType: string,
    limit: number = 50,
  ) {
    try {
      let tableName: string;
      let userIdColumn: string;

      switch (userType) {
        case "restaurant":
          tableName = "restaurant_notifications";
          userIdColumn = "restaurant_id";
          break;
        case "driver":
          tableName = "driver_notifications";
          userIdColumn = "driver_id";
          break;
        default:
          tableName = "user_notifications";
          userIdColumn = "user_id";
      }

      const { data, error } = await supabase
        .from(tableName)
        .select("*")
        .eq(userIdColumn, userId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error: any) {
      console.error("❌ Error getting notifications:", error);
      return { success: false, error: error.message };
    }
  }

  // Mark notification as read
  // Mark notification as read for a specific user type
  static async markNotificationAsRead(
    notificationId: string,
    userType: string = "customer",
  ) {
    try {
      console.log("📝 Marking notification as read:", notificationId, userType);

      let tableName: string;
      let notificationColumn: string;

      // Determine which notification table to use based on user type
      switch (userType.toLowerCase()) {
        case "restaurant":
          tableName = "restaurant_notifications";
          notificationColumn = "restaurant_id";
          break;
        case "driver":
          tableName = "driver_notifications";
          notificationColumn = "driver_id";
          break;
        default:
          tableName = "user_notifications";
          notificationColumn = "user_id";
      }

      // First, get the notification to verify it exists and get user_id
      const { data: notification, error: fetchError } = await supabase
        .from(tableName)
        .select("*")
        .eq("id", notificationId)
        .single();

      if (fetchError) {
        console.error("❌ Error fetching notification:", fetchError);
        throw new Error(`Notification not found: ${fetchError.message}`);
      }

      if (!notification) {
        throw new Error(`Notification with ID ${notificationId} not found`);
      }

      // Update the notification to mark as read
      const { error: updateError } = await supabase
        .from(tableName)
        .update({
          read: true,
          read_at: new Date().toISOString(),
        })
        .eq("id", notificationId);

      if (updateError) {
        console.error("❌ Error updating notification:", updateError);
        throw new Error(`Failed to mark as read: ${updateError.message}`);
      }

      console.log("✅ Notification marked as read:", notificationId);

      return {
        success: true,
        data: {
          id: notificationId,
          read: true,
          read_at: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      console.error("❌ Error in markNotificationAsRead:", error);
      return {
        success: false,
        error: error.message || "Failed to mark notification as read",
      };
    }
  }

  // Mark all notifications as read
  static async markAllNotificationsAsRead(userId: string, userType: string) {
    try {
      let tableName: string;
      let userIdColumn: string;

      switch (userType) {
        case "restaurant":
          tableName = "restaurant_notifications";
          userIdColumn = "restaurant_id";
          break;
        case "driver":
          tableName = "driver_notifications";
          userIdColumn = "driver_id";
          break;
        default:
          tableName = "user_notifications";
          userIdColumn = "user_id";
      }

      const { error } = await supabase
        .from(tableName)
        .update({
          read: true,
          read_at: new Date().toISOString(),
        })
        .eq(userIdColumn, userId)
        .eq("read", false);

      if (error) throw error;
      return { success: true };
    } catch (error: any) {
      console.error("❌ Error marking all notifications as read:", error);
      return { success: false, error: error.message };
    }
  }

  // Get unread notification count
  static async getUnreadCount(userId: string, userType: string) {
    try {
      let tableName: string;
      let userIdColumn: string;

      switch (userType) {
        case "restaurant":
          tableName = "restaurant_notifications";
          userIdColumn = "restaurant_id";
          break;
        case "driver":
          tableName = "driver_notifications";
          userIdColumn = "driver_id";
          break;
        default:
          tableName = "user_notifications";
          userIdColumn = "user_id";
      }

      const { count, error } = await supabase
        .from(tableName)
        .select("*", { count: "exact", head: true })
        .eq(userIdColumn, userId)
        .eq("read", false);

      if (error) throw error;
      return { success: true, count: count || 0 };
    } catch (error: any) {
      console.error("❌ Error getting unread count:", error);
      return { success: false, error: error.message };
    }
  }

  // Private helper methods
  private static async sendPushNotification(
    title: string,
    body: string,
    data: any = {},
  ) {
    try {
      if (isExpoGo) {
        // For Expo Go, schedule local notification
        await Notifications.scheduleNotificationAsync({
          content: {
            title,
            body,
            data,
            sound: true,
            badge: 1,
          },
          trigger: null, // Show immediately
        });
      } else {
        // For production, you would implement push notifications here
        // This requires storing push tokens in your database
        console.log("📤 Would send push notification:", { title, body });
      }
    } catch (error) {
      console.error("❌ Error sending push notification:", error);
    }
  }

  private static getOrderNotificationConfig(
    status: string,
    order: any,
    postData: any,
  ) {
    const restaurantName = order.restaurants?.restaurant_name || "Restaurant";
    const postTitle = postData?.title || "your order";

    const configs: any = {
      pending: {
        customer: {
          title: "Order Placed! 🎉",
          body: `Your order "${postTitle}" has been placed with ${restaurantName}.`,
        },
        restaurant: {
          title: "New Order! 📦",
          body: `New order for "${postTitle}" received.`,
        },
      },
      confirmed: {
        customer: {
          title: "Order Confirmed! ✅",
          body: `${restaurantName} has confirmed your "${postTitle}" order.`,
        },
        restaurant: {
          title: "Order Confirmed",
          body: `You confirmed "${postTitle}" order.`,
        },
      },
      preparing: {
        customer: {
          title: "Order Being Prepared! 👨‍🍳",
          body: `${restaurantName} is preparing your "${postTitle}".`,
        },
        restaurant: {
          title: "Preparation Started",
          body: `Started preparing "${postTitle}".`,
        },
      },
      ready: {
        customer: {
          title: "Order Ready! 📦",
          body: `Your "${postTitle}" from ${restaurantName} is ready.`,
        },
        restaurant: {
          title: "Order Ready for Pickup",
          body: `"${postTitle}" is ready for pickup.`,
        },
        driver: {
          title: "Pickup Available! 🚴",
          body: `Order "${postTitle}" from ${restaurantName} is ready.`,
        },
      },
      out_for_delivery: {
        customer: {
          title: "Order On The Way! 🚚",
          body: `Your "${postTitle}" is out for delivery.`,
        },
        restaurant: {
          title: "Order Out for Delivery",
          body: `"${postTitle}" is on its way.`,
        },
        driver: {
          title: "Delivery in Progress",
          body: `You're delivering "${postTitle}".`,
        },
      },
      delivered: {
        customer: {
          title: "Order Delivered! ✅",
          body: `Your "${postTitle}" has been delivered. Enjoy!`,
        },
        restaurant: {
          title: "Order Delivered",
          body: `"${postTitle}" has been delivered.`,
        },
        driver: {
          title: "Delivery Completed! 🎉",
          body: `You delivered "${postTitle}" successfully.`,
        },
      },
      cancelled: {
        customer: {
          title: "Order Cancelled ❌",
          body: `Your "${postTitle}" order has been cancelled.`,
        },
        restaurant: {
          title: "Order Cancelled",
          body: `"${postTitle}" order has been cancelled.`,
        },
        driver: {
          title: "Order Cancelled",
          body: `"${postTitle}" order has been cancelled.`,
        },
      },
    };

    return configs[status] || configs.pending;
  }

  // Add this method to NotificationService class
  static async sendNewOrderToRestaurant(orderId: string) {
    try {
      // Get order details
      const { data: order } = await supabase
        .from("orders")
        .select("*, restaurants(id, restaurant_name)")
        .eq("id", orderId)
        .single();

      if (!order) return { success: false, error: "Order not found" };

      // Send notification to restaurant
      return await this.sendNotification(
        order.restaurant_id,
        "🚨 New Order Received!",
        `You have a new order #${order.order_number}. Tap to view details.`,
        "order",
        {
          order_id: orderId,
          order_number: order.order_number,
          action: "view_order",
          screen: `/(restaurant)/orders/${orderId}`,
        },
        "restaurant",
      );
    } catch (error: any) {
      console.error("❌ Error sending new order notification:", error);
      return { success: false, error: error.message };
    }
  }

  // Add this method to your existing NotificationService class

  // backend/services/notificationService.ts

  // backend/services/notificationService.ts

  // backend/services/NotificationService.ts

  static async sendMessageNotification(
    conversationId: string,
    senderId: string,
    message: string,
    senderName: string,
    senderType: string,
    recipientId: string,
    recipientType: string,
  ) {
    try {
      console.log("📱 Sending message notification...");
      console.log(
        "Sender:",
        senderId,
        "Recipient:",
        recipientId,
        "Type:",
        recipientType,
      );
      console.log("Recipient ID being used:", recipientId);

      // CRITICAL: Don't send to self
      if (senderId === recipientId) {
        console.log("⏭️ SKIPPING - sender is same as recipient");
        return { success: true, skipped: true };
      }

      // Validate recipientId
      if (!recipientId) {
        console.error("❌ CRITICAL: recipientId is undefined or null!");
        return { success: false, error: "No recipient ID provided" };
      }

      // Fetch sender's profile image
      let senderImageUrl = null;
      try {
        if (senderType === "restaurant") {
          const { data: restaurantData } = await supabase
            .from("restaurants")
            .select("image_url")
            .eq("id", senderId)
            .single();
          senderImageUrl = restaurantData?.image_url;
        } else {
          const { data: userData } = await supabase
            .from("users")
            .select("profile_image_url")
            .eq("id", senderId)
            .single();
          senderImageUrl = userData?.profile_image_url;
        }
      } catch (error) {
        console.log("Could not fetch sender image:", error);
      }

      // Prepare notification data
      const notificationData = {
        conversation_id: conversationId,
        sender_id: senderId,
        sender_name: senderName,
        sender_image_url: senderImageUrl,
        sender_type: senderType,
        message: message.substring(0, 100),
        action: "view_conversation",
        timestamp: new Date().toISOString(),
        recipient_id: recipientId,
      };

      // Determine screen based on recipient type
      if (recipientType === "restaurant") {
        notificationData.screen = `/(restaurant)/messages/${conversationId}`;
      } else if (recipientType === "driver") {
        notificationData.screen = `/(driver)/messages/${conversationId}`;
      } else {
        notificationData.screen = `/messages/${conversationId}`;
      }

      // Determine notification table
      let tableName: string;
      let userIdColumn: string;

      switch (recipientType) {
        case "restaurant":
          tableName = "restaurant_notifications";
          userIdColumn = "restaurant_id";
          break;
        case "driver":
          tableName = "driver_notifications";
          userIdColumn = "driver_id";
          break;
        default:
          tableName = "user_notifications";
          userIdColumn = "user_id";
      }

      console.log(
        `📝 Saving to ${tableName} with ${userIdColumn}=${recipientId}`,
      );

      // Create notification in database
      const { error: insertError, data: insertedData } = await supabase
        .from(tableName)
        .insert({
          [userIdColumn]: recipientId,
          title: `💬 New message from ${senderName}`,
          body:
            message.length > 50 ? `${message.substring(0, 50)}...` : message,
          type: "message",
          data: notificationData,
          read: false,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) {
        console.error("❌ Error saving message notification:", insertError);
        return { success: false, error: insertError.message };
      }

      console.log("✅ Message notification saved for recipient:", recipientId);

      // 🔴 FIXED: Handle push tokens gracefully without breaking
      try {
        const { data: tokens, error: tokensError } = await supabase
          .from("user_push_tokens")
          .select("expo_push_token")
          .eq("user_id", recipientId)
          .eq("is_active", true);

        if (tokensError) {
          console.error("Error fetching push tokens:", tokensError);
        } else if (tokens && tokens.length > 0) {
          console.log(
            `📱 Found ${tokens.length} tokens for user ${recipientId}`,
          );

          // Prepare messages for Expo
          const messages = tokens.map((t) => ({
            to: t.expo_push_token,
            sound: "default",
            title: `💬 New message from ${senderName}`,
            body:
              message.length > 50 ? `${message.substring(0, 50)}...` : message,
            data: {
              ...notificationData,
              _displayInForeground: true,
            },
            priority: "high",
            channelId: "messages",
          }));

          // Send to Expo - but don't await or throw errors
          fetch("https://exp.host/--/api/v2/push/send", {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Accept-encoding": "gzip, deflate",
              "Content-Type": "application/json",
            },
            body: JSON.stringify(messages),
          })
            .then((response) => response.json())
            .then((result) => {
              console.log(
                "Push notification sent:",
                result.data?.map((r: any) => r.status).join(", "),
              );
              // Check for invalid tokens and deactivate them
              if (result.data) {
                result.data.forEach((item: any, index: number) => {
                  if (
                    item.status === "error" &&
                    (item.details?.error === "DeviceNotRegistered" ||
                      item.message?.includes("not registered"))
                  ) {
                    // Deactivate invalid token
                    supabase
                      .from("user_push_tokens")
                      .update({ is_active: false })
                      .eq("expo_push_token", tokens[index].expo_push_token)
                      .then(() => console.log("Deactivated invalid token"));
                  }
                });
              }
            })
            .catch((err) =>
              console.log("Push notification error (non-critical):", err),
            );
        } else {
          console.log("ℹ️ No push tokens found for user:", recipientId);
        }
      } catch (pushError) {
        // Log but don't fail - this is non-critical
        console.log("⚠️ Push notification error (non-critical):", pushError);
      }

      // 🔴 FIXED: Local notification fallback
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `💬 New message from ${senderName}`,
            body:
              message.length > 50 ? `${message.substring(0, 50)}...` : message,
            data: notificationData,
            sound: true,
            badge: 1,
          },
          trigger: null,
        });
        console.log("📱 Local fallback notification sent");
      } catch (localError) {
        console.log("⚠️ Local notification error:", localError);
      }

      // Trigger real-time notification
      try {
        const channel = supabase.channel(`notifications-${recipientId}`);
        await channel.send({
          type: "broadcast",
          event: "new_notification",
          payload: {
            ...notificationData,
            id: insertedData?.id,
            title: `💬 New message from ${senderName}`,
            body:
              message.length > 50 ? `${message.substring(0, 50)}...` : message,
          },
        });
        console.log("📡 Real-time notification triggered for:", recipientId);
      } catch (realtimeError) {
        console.log("⚠️ Realtime notification error:", realtimeError);
      }

      return { success: true, data: insertedData };
    } catch (error: any) {
      console.error("❌ Error in sendMessageNotification:", error);
      // 🔴 FIXED: Still return success for the message even if notification fails
      return { success: true, error: error.message };
    }
  }
  // NEW METHOD: Send push notification to specific user using their push tokens
  static async sendPushNotificationToUser(
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

      // Prepare messages for Expo push service
      const messages = tokens.map((token) => ({
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

  // Make sure this method is properly implemented for background notifications
  static async sendMessagePushNotification(
    title: string,
    body: string,
    data: any = {},
  ) {
    try {
      console.log("📱 Sending push notification:", title);

      // Schedule the notification with proper configuration for background delivery
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: true,
          badge: 1,
          color: "#FF6B35",
          priority: Notifications.AndroidNotificationPriority.HIGH,
          // These settings help ensure delivery when app is closed
          categoryIdentifier: "message",
          interruptionLevel: "timeSensitive",
        },
        trigger: null, // Show immediately
      });

      console.log("✅ Push notification sent successfully");
      return true;
    } catch (error) {
      console.error("❌ Error sending push notification:", error);
      return false;
    }
  }

  // Add this new method for real-time notifications
  static async triggerRealtimeNotification(
    recipientId: string,
    recipientType: string,
    notificationData: any,
  ) {
    try {
      const channel = supabase.channel(`notifications-${recipientId}`);

      await channel.send({
        type: "broadcast",
        event: "new_notification",
        payload: notificationData,
      });

      console.log("📡 Real-time notification triggered for:", recipientId);
    } catch (error) {
      console.error("Error triggering real-time notification:", error);
    }
  }

  // REMOVE the sendPushNotificationWithImage method completely - don't use it for messages
  // OR keep it but don't call it from sendMessageNotification

  // Add this new method for sending push notifications with images
  private static async sendPushNotificationWithImage(
    title: string,
    body: string,
    imageUrl: string | null,
    data: any = {},
  ) {
    try {
      console.log("📱 Sending push notification with image:", title);

      // REMOVE the broken getCurrentUserId check

      // Prepare notification content
      const notificationContent: any = {
        title,
        body,
        data: {
          ...data,
          sender_image_url: imageUrl || null,
        },
        sound: true,
        badge: 1,
        color: "#FF6B35",
      };

      // Android
      if (Platform.OS === "android") {
        notificationContent.android = {
          channelId: "messages",
          priority: Notifications.AndroidNotificationPriority.HIGH,
          vibrate: [0, 250, 250, 250],
        };
      }

      // iOS
      if (Platform.OS === "ios") {
        notificationContent.ios = {
          sound: true,
          badge: 1,
        };
      }

      await Notifications.scheduleNotificationAsync({
        content: notificationContent,
        trigger: null,
      });

      console.log("✅ Push notification sent successfully");
    } catch (error: any) {
      console.error("❌ Error sending push notification:", error);

      // Fallback: Simple notification
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title,
            body,
            data,
            sound: true,
            badge: 1,
          },
          trigger: null,
        });
      } catch (fallbackError) {
        console.error("❌ Fallback notification failed:", fallbackError);
      }
    }
  }
}
