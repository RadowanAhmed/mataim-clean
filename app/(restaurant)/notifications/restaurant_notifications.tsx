// app/(restaurant)/notifications/restaurant_notifications.tsx - COMPLETE FIXED VERSION
import { useAuth } from "@/backend/AuthContext";
import { useNotification } from "@/backend/NotificationContext";
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
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface Notification {
  id: string;
  title: string;
  body: string;
  type: "order" | "review" | "system" | "promotion";
  data: any;
  read: boolean;
  created_at: string;
  read_at: string | null;
  posts?: {
    id: string;
    title: string;
    image_url: string;
    description?: string;
  } | null;
}

const NOTIFICATION_TYPES = {
  order: {
    icon: "fast-food",
    color: "#FF6B35",
    bgColor: "#FFF7ED",
    name: "Order",
  },
  review: {
    icon: "star",
    color: "#FFD700",
    bgColor: "#FEFCE8",
    name: "Review",
  },
  system: {
    icon: "settings",
    color: "#3B82F6",
    bgColor: "#EFF6FF",
    name: "System",
  },
  promotion: {
    icon: "megaphone",
    color: "#10B981",
    bgColor: "#ECFDF5",
    name: "Promotion",
  },
  message: {
    // ADD THIS
    icon: "chatbubble-ellipses",
    color: "#6B7280",
    bgColor: "#F5F3FF",
    name: "Message",
  },
};

export default function RestaurantNotificationsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { markAsRead, clearBadgeCount } = useNotification();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState("all");
  const [stats, setStats] = useState({
    total: 0,
    unread: 0,
    orders: 0,
  });

  const fetchNotifications = useCallback(async () => {
    if (!user?.id) {
      setNotifications([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      setLoading(true);

      // First, get all notifications for this restaurant
      let query = supabase
        .from("restaurant_notifications")
        .select("*")
        .eq("restaurant_id", user.id)
        .order("created_at", { ascending: false });

      if (activeFilter === "unread") {
        query = query.eq("read", false);
      } else if (activeFilter !== "all") {
        query = query.eq("type", activeFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      console.log("Raw notifications:", data?.length);

      // Extract all post IDs from notifications data
      const postIds = new Set<string>();
      data?.forEach((notification) => {
        // Check different possible locations for post_id
        const postId =
          notification.data?.post_id ||
          notification.data?.order_data?.post_id ||
          notification.data?.post_data?.id;

        if (postId) {
          postIds.add(postId);
        }

        // Also check if there's order_id and fetch order to get post_id
        const orderId = notification.data?.order_id;
        if (orderId) {
          // We'll handle this separately if needed
        }
      });

      console.log("Post IDs found:", Array.from(postIds));

      // Fetch all post data at once
      let postsMap = {};
      if (postIds.size > 0) {
        const { data: postsData, error: postsError } = await supabase
          .from("posts")
          .select("id, title, description, image_url, restaurant_id")
          .in("id", Array.from(postIds))
          .eq("restaurant_id", user.id); // Only posts from this restaurant

        if (postsError) {
          console.error("Error fetching posts:", postsError);
        } else {
          // Create map for easy lookup
          postsData?.forEach((post) => {
            postsMap[post.id] = {
              id: post.id,
              title: post.title,
              description: post.description,
              image_url: post.image_url,
            };
          });
        }
      }

      // For orders that don't have post_id in notification data, try to fetch order data
      const orderIds =
        data
          ?.filter((n) => n.type === "order" && n.data?.order_id)
          .map((n) => n.data.order_id)
          .filter(Boolean) || [];

      let ordersMap = {};
      if (orderIds.length > 0) {
        const { data: ordersData, error: ordersError } = await supabase
          .from("orders")
          .select("id, post_id")
          .in("id", orderIds);

        if (ordersError) {
          console.error("Error fetching orders:", ordersError);
        } else {
          ordersData?.forEach((order) => {
            ordersMap[order.id] = order;
          });
        }
      }

      // Combine notification data with post data
      const notificationsWithPostData = (data || []).map((notification) => {
        let postData = null;

        // Try to get post_id from different locations
        const postId =
          notification.data?.post_id ||
          notification.data?.order_data?.post_id ||
          notification.data?.post_data?.id;

        if (postId && postsMap[postId]) {
          postData = postsMap[postId];
        }
        // If no post_id in notification but it's an order, check order data
        else if (notification.type === "order" && notification.data?.order_id) {
          const order = ordersMap[notification.data.order_id];
          if (order?.post_id && postsMap[order.post_id]) {
            postData = postsMap[order.post_id];
          }
        }

        return {
          ...notification,
          posts: postData,
        };
      });

      console.log(
        "Notifications with post data:",
        notificationsWithPostData.length,
      );
      setNotifications(notificationsWithPostData);

      // Update stats
      const total = notificationsWithPostData.length;
      const unread = notificationsWithPostData.filter((n) => !n.read).length;
      const orders = notificationsWithPostData.filter(
        (n) => n.type === "order",
      ).length;
      const reviews = notificationsWithPostData.filter(
        (n) => n.type === "review",
      ).length;

      setStats({ total, unread, orders });

      // Clear badge count
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
  }, [user?.id, activeFilter]);

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

      const { error } = await supabase
        .from("restaurant_notifications")
        .update({
          read: true,
          read_at: new Date().toISOString(),
        })
        .eq("id", notificationId);

      if (error) throw error;

      await markAsRead(notificationId);

      // Update stats
      setStats((prev) => ({
        ...prev,
        unread: Math.max(0, prev.unread - 1),
      }));
    } catch (error) {
      console.error("Error marking as read:", error);
      fetchNotifications();
    }
  };

  const handleNotificationPress = (notification: Notification) => {
    // Mark as read
    if (!notification.read) {
      handleMarkAsRead(notification.id);
    }

    // Handle navigation
    if (notification.type === "order" && notification.data?.order_id) {
      router.push(`/(restaurant)/orders/${notification.data.order_id}`);
    } else if (notification.type === "review") {
      router.push("/(restaurant)/reviews");
    } else if (notification.data?.screen) {
      router.push(notification.data.screen);
    } else if (notification.posts?.id) {
      // Navigate to post detail
      router.push(`/post/${notification.posts.id}`);
    }
  };

  const markAllAsRead = async () => {
    if (!user?.id) return;

    try {
      const { error } = await supabase
        .from("restaurant_notifications")
        .update({
          read: true,
          read_at: new Date().toISOString(),
        })
        .eq("restaurant_id", user.id)
        .eq("read", false);

      if (error) throw error;

      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

      clearBadgeCount();
      setStats((prev) => ({ ...prev, unread: 0 }));

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
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const renderOrderDetails = (notification: Notification) => {
    if (notification.type !== "order" || !notification.data?.order_id) {
      return null;
    }

    return (
      <View style={styles.orderDetailsContainer}>
        <Text style={styles.orderDetailsTitle}>
          Order #
          {notification.data.order_number ||
            notification.data.order_id.slice(0, 8)}
        </Text>

        {notification.data.amount && (
          <Text style={styles.orderDetailsAmount}>
            AED {notification.data.amount.toFixed(2)}
          </Text>
        )}

        {notification.data.status && (
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor:
                  getStatusColor(notification.data.status) + "20",
              },
            ]}
          >
            <Text
              style={[
                styles.statusText,
                { color: getStatusColor(notification.data.status) },
              ]}
            >
              {notification.data.status.replace(/_/g, " ").toUpperCase()}
            </Text>
          </View>
        )}

        {notification.posts && (
          <View style={styles.postInfo}>
            <Text style={styles.postTitle} numberOfLines={1}>
              📦 {notification.posts.title}
            </Text>
            {notification.posts.description && (
              <Text style={styles.postDescription} numberOfLines={1}>
                {notification.posts.description}
              </Text>
            )}
          </View>
        )}
      </View>
    );
  };

  const renderNotification = ({ item }: { item: Notification }) => {
    const notificationType =
      NOTIFICATION_TYPES[item.type as keyof typeof NOTIFICATION_TYPES] ||
      NOTIFICATION_TYPES.system;

    // Get message data
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
        {/* Left Side: Sender Image or Icon */}
        <View style={styles.notificationLeft}>
          {item.type === "message" && senderImage ? (
            <View style={styles.senderImageContainer}>
              <Image
                source={{ uri: senderImage }}
                style={styles.senderImage}
                resizeMode="cover"
              />
              {!item.read && <View style={styles.unreadIndicator} />}

              {/* Customer indicator */}
              <View style={styles.customerIndicator}>
                <Ionicons name="person" size={8} color="#fff" />
              </View>
            </View>
          ) : item.posts?.image_url ? (
            <View style={styles.postImageContainer}>
              <Image
                source={{ uri: item.posts.image_url }}
                style={styles.postImage}
                resizeMode="cover"
              />
              {!item.read && <View style={styles.unreadIndicator} />}
            </View>
          ) : (
            <View style={styles.iconContainer}>
              <View
                style={[
                  styles.iconBackground,
                  { backgroundColor: notificationType.bgColor },
                ]}
              >
                <Ionicons
                  name={notificationType.icon as any}
                  size={20}
                  color={notificationType.color}
                />
              </View>
              {!item.read && <View style={styles.unreadIndicator} />}
            </View>
          )}
        </View>

        {/* Right Side: Content */}
        <View style={styles.notificationContent}>
          <View style={styles.notificationHeader}>
            <View style={styles.titleWithSender}>
              <Text style={styles.notificationTitle} numberOfLines={1}>
                {item.title}
              </Text>
            </View>
            <Text style={styles.notificationTime}>
              {getTimeAgo(item.created_at)}
            </Text>
          </View>

          {/* Message preview */}
          {item.type === "message" && message && (
            <View style={styles.messagePreviewWrapper}>
              <View style={styles.messageBubble}>
                <Text style={styles.messageText} numberOfLines={2}>
                  {message}
                </Text>
              </View>
            </View>
          )}

          {/* Footer */}
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

            {item.type === "order" && item.data?.order_number && (
              <Text style={styles.orderNumber}>#{item.data.order_number}</Text>
            )}

            {item.type === "message" && (
              <TouchableOpacity
                style={styles.replyButton}
                onPress={() => {
                  if (conversationId) {
                    router.push(`/(restaurant)/messages/${conversationId}`);
                  }
                }}
              >
                <Ionicons name="arrow-redo-outline" size={14} color="#3B82F6" />
                <Text style={styles.replyText}>Reply</Text>
              </TouchableOpacity>
            )}
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
        <Text style={styles.headerTitle}>Restaurant Notifications</Text>
        <View style={styles.headerActions}>
          {stats.unread > 0 && (
            <TouchableOpacity
              style={styles.markAllButton}
              onPress={markAllAsRead}
            >
              <Ionicons name="checkmark-done" size={16} color="#fff" />
              <Text style={styles.markAllButtonText}>Mark All</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Stats Grid */}
      {/* Stats Grid - Now with only 3 items */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.total}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, { color: "#FF6B35" }]}>
            {stats.unread}
          </Text>
          <Text style={styles.statLabel}>Unread</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, { color: "#FF6B35" }]}>
            {stats.orders}
          </Text>
          <Text style={styles.statLabel}>Orders</Text>
        </View>
      </View>

      {/* Add Message Button - Absolutely positioned */}
      <TouchableOpacity
        style={styles.absoluteMessageButton}
        onPress={() => router.push("/(restaurant)/messages")}
        activeOpacity={0.8}
      >
        <View style={styles.messageButtonInner}>
          <Ionicons name="chatbubble-ellipses" size={24} color="#fff" />
          {/* Optional: Add unread message badge if you have message count */}
          {/* <View style={styles.messageBadge}>
      <Text style={styles.messageBadgeText}>3</Text>
    </View> */}
        </View>
      </TouchableOpacity>

      {/* Filter Tabs */}
      <View style={styles.filtersContainer}>
        {["all", "unread", "order", "review", "promotion", "system"].map(
          (filter) => {
            const typeConfig =
              NOTIFICATION_TYPES[filter as keyof typeof NOTIFICATION_TYPES];
            const isActive = activeFilter === filter;
            let count = 0;

            if (filter === "all") count = stats.total;
            else if (filter === "unread") count = stats.unread;
            else count = notifications.filter((n) => n.type === filter).length;

            return (
              <TouchableOpacity
                key={filter}
                style={[styles.filterTab, isActive && styles.filterTabActive]}
                onPress={() => setActiveFilter(filter)}
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
                {count > 0 && (
                  <View style={styles.filterCount}>
                    <Text style={styles.filterCountText}>{count}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          },
        )}
      </View>

      {/* Notifications List */}
      <FlatList
        data={notifications}
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
              {activeFilter === "unread"
                ? "No unread notifications"
                : `No ${activeFilter} notifications`}
            </Text>
            <Text style={styles.emptyStateText}>
              {activeFilter === "unread"
                ? "You're all caught up!"
                : "New notifications will appear here."}
            </Text>
          </View>
        }
        contentContainerStyle={styles.listContainer}
      />
    </SafeAreaView>
  );
}

// Also add this helper function for status colors
const getStatusColor = (status: string) => {
  switch (status?.toLowerCase()) {
    case "pending":
      return "#F59E0B";
    case "confirmed":
      return "#3B82F6";
    case "preparing":
      return "#8B5CF6";
    case "ready":
      return "#10B981";
    case "out_for_delivery":
      return "#6366F1";
    case "delivered":
      return "#10B981";
    case "cancelled":
      return "#EF4444";
    default:
      return "#6B7280";
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    marginBottom: -22,
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
  },
  markAllButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FF6B35",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  markAllButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  statsGrid: {
    flexDirection: "row",
    backgroundColor: "#fff",
    padding: 15,
    alignItems: "center",
    justifyContent: "space-around",
    gap: 6,
  },

  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: "#E5E7EB",
  },

  absoluteMessageButton: {
    position: "absolute",
    bottom: 45, // Adjust based on your tab bar height
    right: 20,
    zIndex: 999,
    shadowColor: "#FF6B35",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },

  messageButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#FF6B35",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#fff",
  },

  messageBadge: {
    position: "absolute",
    top: -5,
    right: -5,
    backgroundColor: "#EF4444",
    borderRadius: 12,
    minWidth: 22,
    height: 22,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },

  messageBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
  statCard: {
    flex: 1,
    minWidth: "29%",
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    borderWidth: 0.6,
    borderColor: "#E5E7EB",
  },
  statNumber: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
  },
  statLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 4,
    fontWeight: "600",
  },
  filtersContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    backgroundColor: "#fff",
    padding: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
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
  notificationCard: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 0.6,
    borderColor: "#E5E7EB",
  },
  unreadCard: {
    backgroundColor: "#FF6B3510",
    borderColor: "#FF6B35",
  },
  notificationLeft: {
    marginRight: 12,
    position: "relative",
  },
  iconContainer: {
    width: 40,
    height: 40,
  },
  iconBackground: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  postImageContainer: {
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: "hidden",
  },
  postImage: {
    width: "100%",
    height: "100%",
    backgroundColor: "#F3F4F6",
  },
  unreadIndicator: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#FF6B35",
    borderWidth: 2,
    borderColor: "#fff",
    zIndex: 1,
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
  notificationTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
    flex: 1,
    marginRight: 8,
  },
  notificationTime: {
    fontSize: 11,
    color: "#9CA3AF",
  },
  postInfoContainer: {
    marginBottom: 8,
    padding: 8,
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  postTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 2,
  },
  postDescription: {
    fontSize: 11,
    color: "#6B7280",
  },
  notificationBody: {
    fontSize: 13,
    color: "#6B7280",
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
    borderRadius: 12,
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
  orderNumber: {
    fontSize: 11,
    color: "#FF6B35",
    fontWeight: "700",
    backgroundColor: "#FF6B3510",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  emptyState: {
    paddingVertical: 60,
    alignItems: "center",
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

  // Add these new styles:
  orderDetailsContainer: {
    marginVertical: 8,
    padding: 12,
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  orderDetailsTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 4,
  },
  orderDetailsAmount: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FF6B35",
    marginBottom: 8,
  },
  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "600",
  },
  postInfo: {
    marginTop: 4,
  },
  notificationWithDetails: {
    borderLeftWidth: 4,
    borderLeftColor: "#FF6B35",
    backgroundColor: "#FFF",
  },

  postDate: {
    fontSize: 10,
    color: "#6B7280",
    marginTop: 4,
  },
  postDetails: {
    marginTop: 8,
    fontSize: 12,
    color: "#374151",
  },
  /* Message-specific styles */
  messageCard: {
    borderLeftWidth: 2,
    borderLeftColor: "#6B7280",
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
    borderWidth: 2,
    borderColor: "#fff",
  },

  customerIndicator: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#FF6B35",
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
    paddingVertical: 8,
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
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "#EFF6FF",
    borderRadius: 12,
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
    backgroundColor: "#F9FAFB",
    padding: 12,
    borderRadius: 12,
    borderWidth: 0.6,
    borderColor: "#E5DEFF",
    marginBottom: 8,
  },

  orderTitle: {
    fontSize: 14,
    color: "#111827",
    fontWeight: "600",
  },
});
