// components/common/NotificationBadge.tsx
import { useAuth } from "@/backend/AuthContext";
import { useNotification } from "@/backend/NotificationContext";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

const NotificationBadge = () => {
  const { unreadCount } = useNotification();
  const router = useRouter();
  const { user } = useAuth();

  if (!user) return null;

  const notificationScreen =
    user.user_type === "restaurant"
      ? "/(restaurant)/notifications/restaurant_notifications.tsx"
      : user.user_type === "driver"
        ? "/(driver)/notifications/driver_notifications.tsx"
        : "../../(tabs)/notifications/user_notifacations.tsx";

  return (
    <TouchableOpacity
      style={styles.notificationButton}
      onPress={() => router.push(notificationScreen)}
    >
      <Ionicons name="notifications-outline" size={22} color="#111827" />
      {unreadCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {unreadCount > 99 ? "99+" : unreadCount}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  notificationButton: {
    position: "relative",
    padding: 8,
  },
  badge: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "#FF6B35",
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  badgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "bold",
  },
});

export default NotificationBadge;
