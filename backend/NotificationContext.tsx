// backend/NotificationContext.tsx
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import React, { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "./AuthContext";
import { NotificationService } from "./services/notificationService";
import { supabase } from "./supabase";

const isExpoGo = Constants.appOwnership === "expo";

const NotificationContext = createContext<any>(null);

export const NotificationProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { user } = useAuth();
  const router = useRouter();
  const [notificationCount, setNotificationCount] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const initialize = async () => {
      await NotificationService.initialize();
      setIsInitialized(true);

      if (user) {
        loadNotificationCount();
        setupRealTimeSubscriptions();
      }
    };

    initialize();

    // Setup notification listeners
    const responseSubscription =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data;
        handleNotificationTap(data);
      });

    return () => {
      responseSubscription.remove();
    };
  }, [user]);

  const loadNotificationCount = async () => {
    if (!user) return;

    try {
      const result = await NotificationService.getUnreadCount(
        user.id,
        user.user_type,
      );
      if (result.success) {
        setNotificationCount(result.count);
      }
    } catch (error) {
      console.error("Error loading notification count:", error);
    }
  };

  const setupRealTimeSubscriptions = () => {
    if (!user) return;

    let channelName;
    switch (user.user_type) {
      case "restaurant":
        channelName = "restaurant-notifications";
        break;
      case "driver":
        channelName = "driver-notifications";
        break;
      default:
        channelName = "user-notifications";
    }

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table:
            channelName === "user-notifications"
              ? "user_notifications"
              : channelName === "restaurant-notifications"
                ? "restaurant_notifications"
                : "driver_notifications",
          filter:
            channelName === "user-notifications"
              ? `user_id=eq.${user.id}`
              : channelName === "restaurant-notifications"
                ? `restaurant_id=eq.${user.id}`
                : `driver_id=eq.${user.id}`,
        },
        (payload) => {
          console.log("New notification received:", payload);
          setNotificationCount((prev) => prev + 1);

          // Show local notification
          Notifications.scheduleNotificationAsync({
            content: {
              title: payload.new.title,
              body: payload.new.body,
              data: payload.new.data,
              sound: true,
            },
            trigger: null,
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleNotificationTap = (data: any) => {
    console.log("Notification tapped:", data);

    if (data.screen) {
      router.push(data.screen);
    } else if (data.order_id) {
      if (user?.user_type === "driver") {
        router.push(`/(driver)/orders/${data.order_id}`);
      } else if (user?.user_type === "restaurant") {
        router.push(`/(restaurant)/orders/${data.order_id}`);
      } else {
        router.push(`/orders/${data.order_id}`);
      }
    }
  };

  const markAsRead = async (notificationId: string) => {
    if (!user) return;

    try {
      const result = await NotificationService.markNotificationAsRead(
        notificationId,
        user.user_type,
      );
      if (result.success) {
        setNotificationCount((prev) => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;

    try {
      let tableName;
      let userIdColumn;

      switch (user.user_type) {
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
        .eq(userIdColumn, user.id)
        .eq("read", false);

      if (!error) {
        setNotificationCount(0);
      }
    } catch (error) {
      console.error("Error marking all as read:", error);
    }
  };

  const clearBadgeCount = () => {
    setNotificationCount(0);
    if (!isExpoGo) {
      Notifications.setBadgeCountAsync(0);
    }
  };

  const sendWelcomeNotification = async () => {
    if (!user) return;

    await NotificationService.sendWelcomeNotification(
      user.id,
      user.full_name || "User",
    );
  };

  const sendSignInNotification = async () => {
    if (!user) return;

    await NotificationService.sendSignInNotification(user.id);
  };

  const value = {
    notificationCount,
    clearBadgeCount,
    markAllAsRead,
    markAsRead,
    isInitialized,
    sendWelcomeNotification,
    sendSignInNotification,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotification must be used within NotificationProvider");
  }
  return context;
};
