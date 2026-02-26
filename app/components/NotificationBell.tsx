// components/EnhancedNotificationBell.tsx
import { useAuth } from "@/backend/AuthContext";
import { useNotification } from "@/backend/NotificationContext";
import { supabase } from "@/backend/supabase";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface NotificationBellProps {
  tintColor?: string;
  size?: number;
  showBadge?: boolean;
  showQuickView?: boolean;
}

const NotificationBell: React.FC<NotificationBellProps> = ({
  tintColor = "#111827",
  size = 24,
  showBadge = true,
  showQuickView = true,
}) => {
  const router = useRouter();
  const { user } = useAuth();
  const { notificationCount, clearBadgeCount } = useNotification();
  const [isLoading, setIsLoading] = useState(false);
  const [quickViewVisible, setQuickViewVisible] = useState(false);
  const [recentNotifications, setRecentNotifications] = useState<any[]>([]);
  const [badgeAnim] = useState(new Animated.Value(1));
  const [pulseAnim] = useState(new Animated.Value(0));

  // Load recent notifications for quick view
  useEffect(() => {
    if (quickViewVisible && user) {
      loadRecentNotifications();
    }
  }, [quickViewVisible, user]);

  // Pulse animation for new notifications
  useEffect(() => {
    if (notificationCount > 0) {
      // Badge bounce animation
      Animated.sequence([
        Animated.spring(badgeAnim, {
          toValue: 1.3,
          useNativeDriver: true,
          tension: 150,
          friction: 3,
        }),
        Animated.spring(badgeAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 150,
          friction: 3,
        }),
      ]).start();

      // Continuous pulse animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    } else {
      pulseAnim.setValue(0);
    }

    return () => {
      badgeAnim.stopAnimation();
      pulseAnim.stopAnimation();
    };
  }, [notificationCount]);

  const loadRecentNotifications = async () => {
    if (!user) return;

    try {
      let query;
      const limit = 5;

      switch (user.user_type) {
        case "restaurant":
          query = supabase
            .from("restaurant_notifications")
            .select("*")
            .eq("restaurant_id", user.id)
            .order("created_at", { ascending: false })
            .limit(limit);
          break;
        case "driver":
          query = supabase
            .from("driver_notifications")
            .select("*")
            .eq("driver_id", user.id)
            .order("created_at", { ascending: false })
            .limit(limit);
          break;
        default:
          query = supabase
            .from("user_notifications")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(limit);
      }

      const { data, error } = await query;

      if (error) throw error;
      setRecentNotifications(data || []);
    } catch (error) {
      console.error("Error loading recent notifications:", error);
    }
  };

  const handleBellPress = () => {
    if (!user) {
      router.push("/(auth)/signin");
      return;
    }

    if (showQuickView && Platform.OS === "web") {
      setQuickViewVisible(true);
    } else {
      navigateToNotifications();
    }
  };

  const handleLongPress = () => {
    if (Platform.OS !== "web" && showQuickView) {
      setQuickViewVisible(true);
    }
  };

  const navigateToNotifications = async () => {
    if (!user) return;

    setIsLoading(true);

    try {
      // Clear badge count
      clearBadgeCount();

      // Navigate based on user type
      switch (user.user_type) {
        case "driver":
          router.push("/(driver)/notifications/driver_notifications");
          break;
        case "restaurant":
          router.push("/(restaurant)/notifications/restaurant_notifications");
          break;
        default:
          router.push("/(tabs)/notifications/user_notifacations");
      }
    } catch (error) {
      console.error("Error navigating to notifications:", error);
      Alert.alert("Error", "Failed to navigate to notifications");
    } finally {
      setIsLoading(false);
      setQuickViewVisible(false);
    }
  };

  const handleQuickViewNotificationPress = (notification: any) => {
    setQuickViewVisible(false);

    // Handle notification action
    if (notification.data?.order_id) {
      if (user?.user_type === "driver") {
        router.push(`../(driver)/orders/${notification.data.order_id}`);
      } else if (user?.user_type === "restaurant") {
        router.push(`../(restaurant)/orders/${notification.data.order_id}`);
      } else {
        router.push(`../(tabs)/orders/${notification.data.order_id}`);
      }
    } else if (notification.data?.screen) {
      router.push(notification.data.screen);
    } else {
      navigateToNotifications();
    }
  };

  const markAsReadFromQuickView = async (notificationId: string) => {
    if (!user) return;

    try {
      let tableName;
      switch (user.user_type) {
        case "restaurant":
          tableName = "restaurant_notifications";
          break;
        case "driver":
          tableName = "driver_notifications";
          break;
        default:
          tableName = "user_notifications";
      }

      await supabase
        .from(tableName)
        .update({
          read: true,
          read_at: new Date().toISOString(),
        })
        .eq("id", notificationId);

      // Update local state
      setRecentNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n)),
      );
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const getTimeAgo = (timestamp: string) => {
    const now = new Date();
    const date = new Date(timestamp);
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffMinutes < 1) return "Just now";
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "order":
        return user?.user_type === "driver" ? "bicycle" : "fast-food";
      case "security":
        return "shield-checkmark";
      case "promotional":
        return "megaphone";
      case "earning":
        return "cash";
      case "review":
        return "star";
      case "system":
        return "settings";
      default:
        return "notifications";
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case "order":
        return "#10B981";
      case "security":
        return "#3B82F6";
      case "promotional":
        return "#F59E0B";
      case "earning":
        return "#F59E0B";
      case "review":
        return "#FFD700";
      case "system":
        return "#6B7280";
      default:
        return "#FF6B35";
    }
  };

  const renderBadge = () => {
    if (!showBadge || notificationCount === 0) return null;

    const badgeContent =
      notificationCount > 99 ? "99+" : notificationCount.toString();

    return (
      <Animated.View
        style={[
          styles.badge,
          {
            transform: [{ scale: badgeAnim }],
            backgroundColor: tintColor === "#111827" ? "#FF6B35" : tintColor,
          },
        ]}
      >
        <View style={styles.badgeInner}>
          <Text style={styles.badgeText}>{badgeContent}</Text>
        </View>
        {/* Animated pulse ring */}
        <Animated.View
          style={[
            styles.pulseRing,
            {
              opacity: pulseAnim,
              transform: [
                {
                  scale: pulseAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.5],
                  }),
                },
              ],
              borderColor: tintColor === "#111827" ? "#FF6B35" : tintColor,
            },
          ]}
        />
      </Animated.View>
    );
  };

  const renderQuickViewModal = () => (
    <Modal
      visible={quickViewVisible}
      transparent
      animationType="fade"
      onRequestClose={() => setQuickViewVisible(false)}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => setQuickViewVisible(false)}
      >
        <View style={styles.quickViewContainer}>
          <TouchableOpacity
            style={styles.quickViewContent}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.quickViewHeader}>
              <Text style={styles.quickViewTitle}>Recent Notifications</Text>
              <TouchableOpacity onPress={() => setQuickViewVisible(false)}>
                <Ionicons name="close" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.quickViewList}>
              {recentNotifications.length === 0 ? (
                <View style={styles.emptyQuickView}>
                  <Ionicons
                    name="notifications-off"
                    size={32}
                    color="#D1D5DB"
                  />
                  <Text style={styles.emptyQuickViewText}>
                    No recent notifications
                  </Text>
                </View>
              ) : (
                recentNotifications.map((notification) => (
                  <TouchableOpacity
                    key={notification.id}
                    style={[
                      styles.quickViewItem,
                      !notification.read && styles.quickViewItemUnread,
                    ]}
                    onPress={() =>
                      handleQuickViewNotificationPress(notification)
                    }
                  >
                    <View style={styles.quickViewItemHeader}>
                      <View style={styles.quickViewItemIconContainer}>
                        <Ionicons
                          name={getNotificationIcon(notification.type) as any}
                          size={16}
                          color={getNotificationColor(notification.type)}
                        />
                      </View>
                      <Text style={styles.quickViewItemTitle} numberOfLines={1}>
                        {notification.title}
                      </Text>
                      {!notification.read && (
                        <TouchableOpacity
                          style={styles.markReadButton}
                          onPress={() =>
                            markAsReadFromQuickView(notification.id)
                          }
                        >
                          <Ionicons
                            name="checkmark"
                            size={12}
                            color="#10B981"
                          />
                        </TouchableOpacity>
                      )}
                    </View>
                    <Text style={styles.quickViewItemBody} numberOfLines={2}>
                      {notification.body}
                    </Text>
                    <Text style={styles.quickViewItemTime}>
                      {getTimeAgo(notification.created_at)}
                    </Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>

            <TouchableOpacity
              style={styles.viewAllButton}
              onPress={navigateToNotifications}
            >
              <Text style={styles.viewAllButtonText}>
                View All Notifications
              </Text>
              <Ionicons name="arrow-forward" size={16} color="#FF6B35" />
            </TouchableOpacity>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  return (
    <>
      <TouchableOpacity
        style={styles.container}
        onPress={handleBellPress}
        onLongPress={handleLongPress}
        delayLongPress={500}
        disabled={isLoading}
        activeOpacity={0.7}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={tintColor} />
        ) : (
          <>
            <Ionicons
              name={
                notificationCount > 0
                  ? "notifications"
                  : "notifications-outline"
              }
              size={size}
              color={tintColor}
            />
            {renderBadge()}
          </>
        )}
      </TouchableOpacity>

      {renderQuickViewModal()}
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "relative",
    padding: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  badge: {
    position: "absolute",
    top: 4,
    right: 4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
    zIndex: 10,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  badgeInner: {
    minWidth: 17,
    height: 12,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 2,
    marginLeft: -0.8,
  },
  badgeText: {
    color: "#fff",
    fontSize: 9.8,
    fontWeight: "900",
    textAlign: "center",
    includeFontPadding: false,
  },
  pulseRing: {
    position: "absolute",
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FF6B35",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  quickViewContainer: {
    width: "95%",
    maxWidth: 420,
    maxHeight: "85%",
  },
  quickViewContent: {
    backgroundColor: "#fff",
    borderRadius: 14,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  quickViewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 15,
    backgroundColor: "#F9FAFB",
    borderBottomWidth: 0.8,
    borderBottomColor: "#E5E7EB",
  },
  quickViewTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
  },
  quickViewList: {
    maxHeight: 420,
    padding: 15,
  },
  emptyQuickView: {
    paddingVertical: 32,
    alignItems: "center",
  },
  emptyQuickViewText: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 8,
  },
  quickViewItem: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#F9FAFB",
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  quickViewItemUnread: {
    backgroundColor: "#FF6B3510",
    borderColor: "#FF6B35",
  },
  quickViewItemHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  quickViewItemIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  quickViewItemTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  markReadButton: {
    padding: 4,
    backgroundColor: "#10B98110",
    borderRadius: 4,
    marginLeft: 8,
  },
  quickViewItemBody: {
    fontSize: 12,
    color: "#6B7280",
    lineHeight: 16,
    marginBottom: 4,
  },
  quickViewItemTime: {
    fontSize: 10,
    color: "#9CA3AF",
    alignSelf: "flex-end",
  },
  viewAllButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    backgroundColor: "#F9FAFB",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    gap: 8,
  },
  viewAllButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FF6B35",
  },
});

export default NotificationBell;
