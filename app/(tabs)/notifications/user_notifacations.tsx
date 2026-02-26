// customer
// app/%28tabs%29/notifications/user_notifacations.tsx
import { useAuth } from "@/backend/AuthContext";
import { useNotification } from "@/backend/NotificationContext";
import { NotificationService } from "@/backend/services/notificationService";
import { supabase } from "@/backend/supabase";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Add this at the top with other imports
import { useGuestAction } from "@/backend/hooks/useGuestAction";
import { GuestProfileBanner } from "../../components/GuestProfileBanner";

interface Notification {
  id: string;
  title: string;
  body: string;
  type: "security" | "order" | "promotional" | "info" | "system";
  data: any;
  read: boolean;
  created_at: string;
  read_at: string | null;
}

const NOTIFICATION_TYPES = {
  security: {
    icon: "shield-checkmark",
    color: "#3B82F6",
    bgColor: "#EFF6FF",
    name: "Security",
  },
  order: {
    icon: "fast-food",
    color: "#10B981",
    bgColor: "#ECFDF5",
    name: "Order",
  },
  promotional: {
    icon: "megaphone",
    color: "#F59E0B",
    bgColor: "#FFFBEB",
    name: "Promotion",
  },
  info: {
    icon: "information-circle",
    color: "#FF6B35",
    bgColor: "#FFF7ED",
    name: "Information",
  },
  system: {
    icon: "settings",
    color: "#6B7280",
    bgColor: "#F3F4F6",
    name: "System",
  },
  message: {
    // ADD THIS
    icon: "chatbubble-ellipses",
    color: "#6B7280",
    bgColor: "#F5F3FF",
    name: "Message",
  },
};

export default function UserNotificationsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { markAsRead, clearBadgeCount } = useNotification();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState("all");
  const [selectedType, setSelectedType] = useState<string | null>(null);
  // Inside the component, add:
  const { checkGuestAction, isGuest } = useGuestAction();

  const fetchNotifications = useCallback(async () => {
    if (!user?.id) {
      setNotifications([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      setLoading(true);

      // Simple query without joins
      let query = supabase
        .from("user_notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (activeFilter === "unread") {
        query = query.eq("read", false);
      } else if (activeFilter === "type" && selectedType) {
        query = query.eq("type", selectedType);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Check which notifications have post data
      const enhancedNotifications = (data || []).map(
        (notification) => notification,
      );

      setNotifications(enhancedNotifications || []);

      // Clear badge count when user views notifications
      if (activeFilter === "all") {
        clearBadgeCount();
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
      Alert.alert("Error", "Failed to load notifications");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id, activeFilter, selectedType]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n)),
      );

      // Use the correct method
      const { error } = await supabase
        .from("user_notifications")
        .update({
          read: true,
          read_at: new Date().toISOString(),
        })
        .eq("id", notificationId);

      if (error) throw error;

      // If using NotificationService directly:
      await NotificationService.markNotificationAsRead(
        notificationId,
        "customer",
      );

      // Or if you want to use the context:
      if (markAsRead) {
        await markAsRead(notificationId);
      }
    } catch (error) {
      console.error("Error marking as read:", error);
      fetchNotifications();
    }
  };

  const handleDeleteNotification = async (notificationId: string) => {
    Alert.alert(
      "Delete Notification",
      "Are you sure you want to delete this notification?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await supabase
                .from("user_notifications")
                .delete()
                .eq("id", notificationId);

              if (error) throw error;

              setNotifications((prev) =>
                prev.filter((n) => n.id !== notificationId),
              );
            } catch (error) {
              console.error("Error deleting notification:", error);
              Alert.alert("Error", "Failed to delete notification");
            }
          },
        },
      ],
    );
  };

  // Update handleNotificationPress
  const handleNotificationPress = (notification: Notification) => {
    checkGuestAction("view notifications", () => {
      if (!notification.read) {
        handleMarkAsRead(notification.id);
      }

      if (
        notification.data?.action === "view_order" &&
        notification.data?.order_id
      ) {
        router.push(`/orders/${notification.data.order_id}`);
      } else if (notification.data?.screen) {
        router.push(notification.data.screen);
      } else if (notification.data?.post_id) {
        router.push(`/post/${notification.data.post_id}`);
      }
    });
  };

  const markAllAsRead = async () => {
    if (!user?.id) return;

    try {
      const { error } = await supabase
        .from("user_notifications")
        .update({
          read: true,
          read_at: new Date().toISOString(),
        })
        .eq("user_id", user.id)
        .eq("read", false);

      if (error) throw error;

      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

      clearBadgeCount();
      Alert.alert("Success", "All notifications marked as read");
    } catch (error) {
      console.error("Error marking all as read:", error);
      Alert.alert("Error", "Failed to mark all notifications as read");
    }
  };

  const getTimeAgo = (timestamp: string) => {
    const now = new Date();
    const date = new Date(timestamp);
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 1) return "Just now";
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const filteredNotifications = notifications.filter((notification) => {
    if (activeFilter === "all") return true;
    if (activeFilter === "unread") return !notification.read;
    if (activeFilter === "type" && selectedType)
      return notification.type === selectedType;
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;
  const typeCounts = notifications.reduce((acc: any, n) => {
    acc[n.type] = (acc[n.type] || 0) + 1;
    return acc;
  }, {});

  const renderNotification = ({ item }: { item: Notification }) => {
    const notificationType =
      NOTIFICATION_TYPES[item.type as keyof typeof NOTIFICATION_TYPES] ||
      NOTIFICATION_TYPES.info;

    // Get sender data from notification.data
    const senderImage = item.data?.sender_image_url;
    const senderName = item.data?.sender_name;
    const senderType = item.data?.sender_type;
    const message = item.data?.message;
    const conversationId = item.data?.conversation_id;

    return (
      <TouchableOpacity
        style={[
          styles.notificationCard,
          !item.read && styles.unreadCard,
          item.type === "order" && styles.orderCard,
          item.type === "message" && styles.messageCard, // Add message style
        ]}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.7}
      >
        {/* Left side: Sender Image or Icon */}
        <View style={styles.leftContainer}>
          {senderImage ? (
            <View style={styles.senderImageContainer}>
              <Image source={{ uri: senderImage }} style={styles.senderImage} />
              {!item.read && <View style={styles.unreadDot} />}
            </View>
          ) : (
            <View
              style={[
                styles.iconContainer,
                { backgroundColor: notificationType.bgColor },
              ]}
            >
              <Ionicons
                name={notificationType.icon as any}
                size={20}
                color={notificationType.color}
              />
              {!item.read && <View style={styles.unreadDot} />}
            </View>
          )}
        </View>

        {/* Right side: Content */}
        <View style={styles.rightContainer}>
          <View style={styles.notificationHeader}>
            <View style={styles.titleContainer}>
              <Text style={styles.notificationTitle} numberOfLines={2}>
                {item.title}
              </Text>
            </View>
            <Text style={styles.notificationTime}>
              {getTimeAgo(item.created_at)}
            </Text>
          </View>

          {/* Message preview for message notifications */}
          {item.type === "message" && message && (
            <View style={styles.messagePreviewContainer}>
              <View style={styles.messageBubble}>
                <Text style={styles.messagePreview} numberOfLines={2}>
                  {message}
                </Text>
              </View>
            </View>
          )}

          <View style={styles.notificationFooter}>
            <View style={styles.typeBadge}>
              <View
                style={[
                  styles.typeBadgeDot,
                  { backgroundColor: notificationType.color },
                ]}
              />
              <Text style={styles.typeBadgeText}>{notificationType.name}</Text>
            </View>

            <View style={styles.notificationActions}>
              <TouchableOpacity
                style={styles.replyButton}
                onPress={() => {
                  if (conversationId) {
                    router.push(`/messages/${conversationId}`);
                  }
                }}
              >
                <Ionicons name="arrow-redo" size={14} color="#3B82F6" />
                <Text style={styles.replyText}>Reply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6B35" />
          <Text style={styles.loadingText}>Loading notifications...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={styles.headerActions}>
          {/* Add Message Button */}
          <TouchableOpacity
            style={styles.messageHeaderButton}
            onPress={() => router.push("/(tabs)/messages")}
          >
            <Ionicons name="chatbubble-ellipses" size={22} color="#FF6B35" />
          </TouchableOpacity>

          {unreadCount > 0 && (
            <TouchableOpacity
              style={styles.markAllButton}
              onPress={markAllAsRead}
            >
              <Ionicons name="checkmark-done" size={16} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      </View>
      {isGuest && <GuestProfileBanner />}
      {/* Stats Summary */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{notifications.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{unreadCount}</Text>
          <Text style={styles.statLabel}>Unread</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{typeCounts.order || 0}</Text>
          <Text style={styles.statLabel}>Orders</Text>
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filtersContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersContent}
        >
          {[
            "all",
            "unread",
            "order",
            "promotional",
            "security",
            "info",
            "system",
          ].map((filter) => {
            const typeConfig =
              NOTIFICATION_TYPES[filter as keyof typeof NOTIFICATION_TYPES];
            const isActive =
              (activeFilter === "type" && selectedType === filter) ||
              activeFilter === filter;

            return (
              <TouchableOpacity
                key={filter}
                style={[
                  styles.filterTab,
                  isActive && styles.filterTabActive,
                  typeConfig && { borderColor: typeConfig.color + "40" },
                ]}
                onPress={() => {
                  if (filter === "all" || filter === "unread") {
                    setActiveFilter(filter);
                    setSelectedType(null);
                  } else {
                    setActiveFilter("type");
                    setSelectedType(filter);
                  }
                }}
              >
                {typeConfig && (
                  <Ionicons
                    name={typeConfig.icon as any}
                    size={14}
                    color={isActive ? "#fff" : typeConfig.color}
                  />
                )}
                <Text
                  style={[
                    styles.filterTabText,
                    isActive && styles.filterTabTextActive,
                  ]}
                >
                  {filter === "all"
                    ? "All"
                    : filter === "unread"
                      ? "Unread"
                      : typeConfig?.name || filter}
                </Text>
                {filter === "all" && notifications.length > 0 && (
                  <View style={styles.filterCount}>
                    <Text style={styles.filterCountText}>
                      {notifications.length}
                    </Text>
                  </View>
                )}
                {filter === "unread" && unreadCount > 0 && (
                  <View style={styles.filterCount}>
                    <Text style={styles.filterCountText}>{unreadCount}</Text>
                  </View>
                )}
                {typeConfig && typeCounts[filter] > 0 && (
                  <View style={styles.filterCount}>
                    <Text style={styles.filterCountText}>
                      {typeCounts[filter]}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Notifications List */}
      <FlatList
        data={filteredNotifications}
        renderItem={renderNotification}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#FF6B35"]}
            tintColor="#FF6B35"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons
              name="notifications-off-outline"
              size={64}
              color="#D1D5DB"
            />
            <Text style={styles.emptyStateTitle}>
              {isGuest
                ? "Guest Mode"
                : activeFilter === "unread"
                  ? "No unread notifications"
                  : activeFilter === "type"
                    ? `No ${selectedType} notifications`
                    : "No notifications yet"}
            </Text>
            <Text style={styles.emptyStateText}>
              {isGuest
                ? "Sign in to receive notifications"
                : activeFilter === "unread"
                  ? "You're all caught up!"
                  : "New notifications will appear here."}
            </Text>
            {isGuest && (
              <TouchableOpacity
                style={styles.signInButton}
                onPress={() => router.push("/(auth)/signin")}
              >
                <Text style={styles.signInButtonText}>Sign In</Text>
              </TouchableOpacity>
            )}
          </View>
        }
        contentContainerStyle={[
          styles.listContainer,
          filteredNotifications.length === 0 && styles.emptyListContainer,
        ]}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#6B7280",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  markAllButton: {
    backgroundColor: "#FF6B35",
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  statsContainer: {
    flexDirection: "row",
    backgroundColor: "#fff",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statDivider: {
    width: 1,
    backgroundColor: "#E5E7EB",
  },
  statNumber: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
  },
  statLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 4,
  },
  filtersContainer: {
    backgroundColor: "#fff",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  filtersContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterTab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  filterTabActive: {
    backgroundColor: "#FF6B35",
    borderColor: "#FF6B35",
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },
  filterTabTextActive: {
    color: "#fff",
  },
  filterCount: {
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
  },
  filterCountText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
  },
  listContainer: {
    padding: 16,
  },
  emptyListContainer: {
    flex: 1,
  },
  notificationCard: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  unreadCard: {
    backgroundColor: "#FF6B3510",
    borderColor: "#FF6B35",
  },
  // New styles for image display
  leftContainer: {
    marginRight: 12,
    position: "relative",
  },
  rightContainer: {
    flex: 1,
  },
  postImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
  },
  iconContainer: {
    width: 20,
    height: 20,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  titleContainer: {
    flex: 1,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  restaurantName: {
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "600",
    flex: 1,
  },
  postName: {
    fontSize: 11,
    color: "#4B5563",
    fontWeight: "600",
    flex: 1,
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  unreadDot: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#FF6B35",
    borderWidth: 2,
    borderColor: "#fff",
  },
  notificationTime: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  notificationBody: {
    fontSize: 14,
    color: "#6B7280",
    lineHeight: 18,
    marginBottom: 8,
  },
  notificationFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  typeBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  typeBadgeText: {
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "600",
  },
  notificationActions: {
    flexDirection: "row",
    gap: 8,
  },
  markReadButton: {
    padding: 6,
    backgroundColor: "#10B98110",
    borderRadius: 6,
  },
  deleteButton: {
    padding: 6,
    backgroundColor: "#EF444410",
    borderRadius: 6,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 24,
  },
  emptyStateTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
    marginTop: 12,
    marginBottom: 4,
  },
  emptyStateText: {
    fontSize: 12,
    color: "#6B7280",
    textAlign: "center",
    maxWidth: 200,
    fontWeight: "400",
  },

  /* Message-specific styles */
  messageCard: {
    borderLeftWidth: 2,
    borderLeftColor: "#10B981",
  },

  senderImageContainer: {
    position: "relative",
  },

  senderImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1.5,
    borderColor: "#fff",
  },

  senderTypeBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#fff",
  },

  customerIndicator: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#10B981",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },

  senderInfoRow: {
    marginTop: 4,
  },

  senderNameContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },

  senderName: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "500",
  },

  messagePreviewContainer: {
    marginVertical: 8,
  },

  messagePreviewWrapper: {
    marginVertical: 6,
  },

  messageBubble: {
    backgroundColor: "#F5F3FF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5DEFF",
  },

  messageIcon: {
    marginRight: 6,
  },

  messageText: {
    fontSize: 13,
    color: "#6B7280",
    flex: 1,
  },

  messagePreview: {
    fontSize: 13,
    color: "#6B7280",
    flex: 1,
  },

  messageBody: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 4,
  },

  customerInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },

  customerName: {
    fontSize: 11,
    color: "#6B7280",
  },

  titleWithSender: {
    flex: 1,
  },

  replyButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#F5F3FF",
    borderRadius: 8,
    gap: 4,
  },

  replyText: {
    fontSize: 11,
    color: "#3B82F6",
    fontWeight: "600",
  },

  markReadText: {
    fontSize: 11,
    color: "#10B981",
    fontWeight: "600",
    marginLeft: 2,
  },

  orderCard: {
    backgroundColor: "#F5F3FF",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5DEFF",
    marginBottom: 12,
  },
  messageHeaderButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFF7ED",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },

  // Add styles
  signInButton: {
    marginTop: 16,
    backgroundColor: "#FF6B35",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  signInButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});
