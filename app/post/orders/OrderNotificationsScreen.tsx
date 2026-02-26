// app/orders/OrderNotificationsScreen.tsx
import { useAuth } from "@/backend/AuthContext";
import { supabase } from "@/backend/supabase";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Types for notifications
const NOTIFICATION_TYPES = {
  ORDER_CREATED: "order_created",
  ORDER_CONFIRMED: "order_confirmed",
  ORDER_PREPARING: "order_preparing",
  ORDER_READY: "order_ready",
  ORDER_PICKED_UP: "order_picked_up",
  ORDER_OUT_FOR_DELIVERY: "order_out_for_delivery",
  ORDER_DELIVERED: "order_delivered",
  ORDER_CANCELLED: "order_cancelled",
  PAYMENT_RECEIVED: "payment_received",
  PAYMENT_FAILED: "payment_failed",
  DRIVER_ASSIGNED: "driver_assigned",
  DRIVER_ARRIVED: "driver_arrived",
  ORDER_DELAYED: "order_delayed",
  RATING_REMINDER: "rating_reminder",
  ORDER_SPECIAL_REQUEST: "order_special_request",
};

export default function OrderNotificationsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [filter, setFilter] = useState("all");
  const [unreadCount, setUnreadCount] = useState(0);

  const filters = [
    { id: "all", label: "All", icon: "list" },
    { id: "unread", label: "Unread", icon: "mail-unread" },
    { id: "orders", label: "Orders", icon: "receipt" },
    { id: "payments", label: "Payments", icon: "cash" },
    { id: "system", label: "System", icon: "notifications" },
  ];

  useEffect(() => {
    if (user?.id) {
      fetchNotifications();
      fetchUnreadCount();
    }
  }, [user, filter]);

  const fetchNotifications = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);

      // Build query based on user type
      let query = supabase
        .from("order_notifications")
        .select(
          `
          *,
          orders!inner (
            order_number,
            status,
            final_amount,
            restaurants!inner (restaurant_name),
            customers!inner (full_name)
          )
        `,
        )
        .order("created_at", { ascending: false });

      // Apply user-specific filters
      if (user.user_type === "customer") {
        query = query.eq("user_id", user.id);
      } else if (user.user_type === "restaurant") {
        query = query.eq("restaurant_id", user.id);
      } else if (user.user_type === "driver") {
        query = query.eq("driver_id", user.id);
      }

      // Apply notification type filter
      if (filter === "orders") {
        query = query.ilike("notification_type", "order_%");
      } else if (filter === "payments") {
        query = query.ilike("notification_type", "payment_%");
      } else if (filter === "unread") {
        query = query.eq("is_read", false);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Group notifications by date
      const groupedNotifications = groupNotificationsByDate(data || []);
      setNotifications(groupedNotifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      Alert.alert("Error", "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  };

  const fetchUnreadCount = async () => {
    if (!user?.id) return;

    try {
      let query = supabase
        .from("order_notifications")
        .select("id", { count: "exact", head: true })
        .eq("is_read", false);

      if (user.user_type === "customer") {
        query = query.eq("user_id", user.id);
      } else if (user.user_type === "restaurant") {
        query = query.eq("restaurant_id", user.id);
      } else if (user.user_type === "driver") {
        query = query.eq("driver_id", user.id);
      }

      const { count, error } = await query;

      if (!error) {
        setUnreadCount(count || 0);
      }
    } catch (error) {
      console.error("Error fetching unread count:", error);
    }
  };

  const groupNotificationsByDate = (notifications) => {
    const groups = {};
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    notifications.forEach((notification) => {
      const date = new Date(notification.created_at);
      let groupKey;

      if (date.toDateString() === today.toDateString()) {
        groupKey = "Today";
      } else if (date.toDateString() === yesterday.toDateString()) {
        groupKey = "Yesterday";
      } else {
        groupKey = date.toLocaleDateString("en-US", {
          weekday: "long",
          month: "short",
          day: "numeric",
        });
      }

      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(notification);
    });

    return Object.entries(groups).map(([date, items]) => ({
      date,
      items,
    }));
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchNotifications(), fetchUnreadCount()]);
    setRefreshing(false);
  };

  const markAsRead = async (notificationId) => {
    try {
      const { error } = await supabase
        .from("order_notifications")
        .update({
          is_read: true,
          read_at: new Date().toISOString(),
        })
        .eq("id", notificationId);

      if (error) throw error;

      // Update local state
      setNotifications((prev) =>
        prev.map((group) => ({
          ...group,
          items: group.items.map((item) =>
            item.id === notificationId ? { ...item, is_read: true } : item,
          ),
        })),
      );

      // Update unread count
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      let query = supabase
        .from("order_notifications")
        .update({
          is_read: true,
          read_at: new Date().toISOString(),
        })
        .eq("is_read", false);

      if (user.user_type === "customer") {
        query = query.eq("user_id", user.id);
      } else if (user.user_type === "restaurant") {
        query = query.eq("restaurant_id", user.id);
      } else if (user.user_type === "driver") {
        query = query.eq("driver_id", user.id);
      }

      const { error } = await query;

      if (error) throw error;

      // Update all notifications to read
      setNotifications((prev) =>
        prev.map((group) => ({
          ...group,
          items: group.items.map((item) => ({ ...item, is_read: true })),
        })),
      );

      setUnreadCount(0);
      Alert.alert("Success", "All notifications marked as read");
    } catch (error) {
      console.error("Error marking all as read:", error);
      Alert.alert("Error", "Failed to mark all as read");
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case NOTIFICATION_TYPES.ORDER_CREATED:
      case NOTIFICATION_TYPES.ORDER_CONFIRMED:
        return "receipt";
      case NOTIFICATION_TYPES.ORDER_PREPARING:
        return "restaurant";
      case NOTIFICATION_TYPES.ORDER_READY:
        return "checkmark-circle";
      case NOTIFICATION_TYPES.ORDER_PICKED_UP:
      case NOTIFICATION_TYPES.ORDER_OUT_FOR_DELIVERY:
        return "bicycle";
      case NOTIFICATION_TYPES.ORDER_DELIVERED:
        return "checkmark-done";
      case NOTIFICATION_TYPES.ORDER_CANCELLED:
        return "close-circle";
      case NOTIFICATION_TYPES.PAYMENT_RECEIVED:
        return "cash";
      case NOTIFICATION_TYPES.PAYMENT_FAILED:
        return "card";
      case NOTIFICATION_TYPES.DRIVER_ASSIGNED:
        return "person";
      case NOTIFICATION_TYPES.ORDER_DELAYED:
        return "time";
      case NOTIFICATION_TYPES.RATING_REMINDER:
        return "star";
      default:
        return "notifications";
    }
  };

  const getNotificationColor = (type) => {
    switch (type) {
      case NOTIFICATION_TYPES.ORDER_CREATED:
      case NOTIFICATION_TYPES.ORDER_CONFIRMED:
        return "#FF9F43";
      case NOTIFICATION_TYPES.ORDER_PREPARING:
        return "#2E86DE";
      case NOTIFICATION_TYPES.ORDER_READY:
        return "#10AC84";
      case NOTIFICATION_TYPES.ORDER_PICKED_UP:
      case NOTIFICATION_TYPES.ORDER_OUT_FOR_DELIVERY:
        return "#2E86DE";
      case NOTIFICATION_TYPES.ORDER_DELIVERED:
        return "#10AC84";
      case NOTIFICATION_TYPES.ORDER_CANCELLED:
        return "#FF4757";
      case NOTIFICATION_TYPES.PAYMENT_RECEIVED:
        return "#10AC84";
      case NOTIFICATION_TYPES.PAYMENT_FAILED:
        return "#FF4757";
      case NOTIFICATION_TYPES.DRIVER_ASSIGNED:
        return "#2E86DE";
      case NOTIFICATION_TYPES.ORDER_DELAYED:
        return "#FF9F43";
      case NOTIFICATION_TYPES.RATING_REMINDER:
        return "#FFD700";
      default:
        return "#666";
    }
  };

  const getNotificationTitle = (notification) => {
    const orderNumber = notification.orders?.order_number
      ? `#${notification.orders.order_number}`
      : "";

    switch (notification.notification_type) {
      case NOTIFICATION_TYPES.ORDER_CREATED:
        return `New Order ${orderNumber}`;
      case NOTIFICATION_TYPES.ORDER_CONFIRMED:
        return `Order Confirmed ${orderNumber}`;
      case NOTIFICATION_TYPES.ORDER_PREPARING:
        return `Preparing Order ${orderNumber}`;
      case NOTIFICATION_TYPES.ORDER_READY:
        return `Order Ready ${orderNumber}`;
      case NOTIFICATION_TYPES.ORDER_PICKED_UP:
        return `Order Picked Up ${orderNumber}`;
      case NOTIFICATION_TYPES.ORDER_OUT_FOR_DELIVERY:
        return `Out for Delivery ${orderNumber}`;
      case NOTIFICATION_TYPES.ORDER_DELIVERED:
        return `Order Delivered ${orderNumber}`;
      case NOTIFICATION_TYPES.ORDER_CANCELLED:
        return `Order Cancelled ${orderNumber}`;
      case NOTIFICATION_TYPES.PAYMENT_RECEIVED:
        return `Payment Received ${orderNumber}`;
      case NOTIFICATION_TYPES.PAYMENT_FAILED:
        return `Payment Failed ${orderNumber}`;
      case NOTIFICATION_TYPES.DRIVER_ASSIGNED:
        return `Driver Assigned ${orderNumber}`;
      case NOTIFICATION_TYPES.ORDER_DELAYED:
        return `Order Delayed ${orderNumber}`;
      case NOTIFICATION_TYPES.RATING_REMINDER:
        return `Rate Your Order ${orderNumber}`;
      default:
        return "New Notification";
    }
  };

  const getNotificationDescription = (notification) => {
    const restaurantName =
      notification.orders?.restaurants?.restaurant_name || "";
    const customerName = notification.orders?.customers?.full_name || "";
    const amount = notification.orders?.final_amount
      ? `AED ${notification.orders.final_amount.toFixed(2)}`
      : "";

    switch (notification.notification_type) {
      case NOTIFICATION_TYPES.ORDER_CREATED:
        return user.user_type === "restaurant"
          ? `New order from ${customerName}`
          : `Order placed at ${restaurantName}`;
      case NOTIFICATION_TYPES.ORDER_CONFIRMED:
        return user.user_type === "customer"
          ? `${restaurantName} has confirmed your order`
          : `Order confirmed successfully`;
      case NOTIFICATION_TYPES.ORDER_PREPARING:
        return user.user_type === "customer"
          ? `${restaurantName} is preparing your order`
          : `Order preparation started`;
      case NOTIFICATION_TYPES.ORDER_READY:
        return user.user_type === "customer"
          ? `Your order is ready for pickup`
          : `Order is ready for delivery`;
      case NOTIFICATION_TYPES.ORDER_PICKED_UP:
        return user.user_type === "customer"
          ? `Driver has picked up your order`
          : `Order picked up successfully`;
      case NOTIFICATION_TYPES.ORDER_OUT_FOR_DELIVERY:
        return user.user_type === "customer"
          ? `Your order is on the way`
          : `Order out for delivery`;
      case NOTIFICATION_TYPES.ORDER_DELIVERED:
        return user.user_type === "customer"
          ? `Order has been delivered successfully`
          : `Order delivered successfully`;
      case NOTIFICATION_TYPES.ORDER_CANCELLED:
        return `Order has been cancelled`;
      case NOTIFICATION_TYPES.PAYMENT_RECEIVED:
        return `Payment of ${amount} received`;
      case NOTIFICATION_TYPES.PAYMENT_FAILED:
        return `Payment of ${amount} failed. Please try again`;
      case NOTIFICATION_TYPES.DRIVER_ASSIGNED:
        return user.user_type === "customer"
          ? `Driver assigned to your order`
          : `You've been assigned to an order`;
      case NOTIFICATION_TYPES.ORDER_DELAYED:
        return `Order delivery is delayed`;
      case NOTIFICATION_TYPES.RATING_REMINDER:
        return `Rate your experience with ${restaurantName}`;
      default:
        return notification.message;
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const handleNotificationPress = async (notification) => {
    // Mark as read
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }

    // Navigate to order details if available
    if (notification.order_id) {
      router.push(`/orders/${notification.order_id}`);
    }
  };

  const renderNotificationItem = ({ item }) => {
    return (
      <TouchableOpacity
        style={[
          styles.notificationItem,
          !item.is_read && styles.unreadNotification,
        ]}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.notificationIconContainer}>
          <Ionicons
            name={getNotificationIcon(item.notification_type)}
            size={20}
            color={getNotificationColor(item.notification_type)}
          />
          {!item.is_read && <View style={styles.unreadDot} />}
        </View>

        <View style={styles.notificationContent}>
          <Text style={styles.notificationTitle}>
            {getNotificationTitle(item)}
          </Text>
          <Text style={styles.notificationDescription} numberOfLines={2}>
            {getNotificationDescription(item)}
          </Text>
          <Text style={styles.notificationTime}>
            {formatTime(item.created_at)}
          </Text>
        </View>

        {item.orders?.final_amount && (
          <View style={styles.orderAmount}>
            <Text style={styles.orderAmountText}>
              AED {item.orders.final_amount.toFixed(2)}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderSectionHeader = ({ section }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{section.date}</Text>
    </View>
  );

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={styles.loadingText}>Loading notifications...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Order Notifications</Text>
        </View>
        <View style={styles.headerRight}>
          {unreadCount > 0 && (
            <TouchableOpacity
              style={styles.markAllButton}
              onPress={markAllAsRead}
            >
              <Text style={styles.markAllText}>Mark all read</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
            <Ionicons
              name="refresh"
              size={22}
              color="#FF6B35"
              style={refreshing && styles.refreshingIcon}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filtersContainer}>
        <FlatList
          data={filters}
          horizontal
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.filterButton,
                filter === item.id && styles.filterButtonActive,
              ]}
              onPress={() => setFilter(item.id)}
            >
              <Ionicons
                name={item.icon}
                size={18}
                color={filter === item.id ? "#FF6B35" : "#666"}
              />
              <Text
                style={[
                  styles.filterButtonText,
                  filter === item.id && styles.filterButtonTextActive,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.filtersContent}
        />
      </View>

      {/* Stats Banner */}
      <View style={styles.statsBanner}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{unreadCount}</Text>
          <Text style={styles.statLabel}>Unread</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>
            {notifications.reduce((acc, group) => acc + group.items.length, 0)}
          </Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>
            {notifications.reduce(
              (acc, group) =>
                acc + group.items.filter((item) => !item.is_read).length,
              0,
            )}
          </Text>
          <Text style={styles.statLabel}>New Today</Text>
        </View>
      </View>

      {/* Notifications List */}
      {notifications.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons
            name="bell-off-outline"
            size={64}
            color="#D1D5DB"
          />
          <Text style={styles.emptyStateTitle}>No notifications</Text>
          <Text style={styles.emptyStateText}>
            {filter === "unread"
              ? "You're all caught up!"
              : `No ${filter === "all" ? "" : filter} notifications found`}
          </Text>
          <TouchableOpacity
            style={styles.refreshButtonLarge}
            onPress={onRefresh}
          >
            <Ionicons name="refresh" size={20} color="#FF6B35" />
            <Text style={styles.refreshButtonText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.date}
          renderSectionHeader={renderSectionHeader}
          renderItem={({ item }) => (
            <FlatList
              data={item.items}
              keyExtractor={(notification) => notification.id}
              renderItem={renderNotificationItem}
              scrollEnabled={false}
              contentContainerStyle={styles.notificationsList}
            />
          )}
          contentContainerStyle={styles.notificationsContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#FF6B35"
              colors={["#FF6B35"]}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
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
    backgroundColor: "#F9FAFB",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#6B7280",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  markAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#FF6B3510",
    borderRadius: 8,
  },
  markAllText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FF6B35",
  },
  refreshButton: {
    padding: 4,
  },
  refreshingIcon: {
    transform: [{ rotate: "360deg" }],
  },
  filtersContainer: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  filtersContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  filterButtonActive: {
    backgroundColor: "#FF6B3510",
    borderWidth: 1,
    borderColor: "#FF6B35",
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#6B7280",
  },
  filterButtonTextActive: {
    color: "#FF6B35",
    fontWeight: "600",
  },
  statsBanner: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    margin: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statNumber: {
    fontSize: 24,
    fontWeight: "700",
    color: "#FF6B35",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: "#6B7280",
  },
  statDivider: {
    width: 1,
    height: "60%",
    backgroundColor: "#E5E7EB",
    marginHorizontal: 8,
    alignSelf: "center",
  },
  notificationsContainer: {
    paddingBottom: 20,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#F9FAFB",
  },
  sectionHeaderText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  notificationsList: {
    paddingHorizontal: 16,
  },
  notificationItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 16,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  unreadNotification: {
    backgroundColor: "#FF6B3508",
    borderColor: "#FF6B3520",
  },
  notificationIconContainer: {
    position: "relative",
    marginRight: 12,
  },
  unreadDot: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FF6B35",
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 4,
  },
  notificationDescription: {
    fontSize: 13,
    color: "#6B7280",
    lineHeight: 18,
    marginBottom: 6,
  },
  notificationTime: {
    fontSize: 11,
    color: "#9CA3AF",
  },
  orderAmount: {
    backgroundColor: "#FF6B3510",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 8,
  },
  orderAmountText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FF6B35",
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
    marginTop: 60,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#374151",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  refreshButtonLarge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FF6B35",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
  },
  refreshButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
});
