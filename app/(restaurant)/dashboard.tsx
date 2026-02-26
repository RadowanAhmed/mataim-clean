//app/(restaurant)/dashboard
import { useAuth } from "@/backend/AuthContext";
import { useNotification } from "@/backend/NotificationContext";
import { supabase } from "@/backend/supabase";
import {
  Ionicons,
  MaterialCommunityIcons,
  MaterialIcons,
} from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
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
import NotificationBell from "../components/NotificationBell";

const { width } = Dimensions.get("window");

export default function RestaurantDashboardScreen() {
  const router = useRouter();
  const { user, checkRestaurantSetupComplete } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);

  const { unreadCount } = useNotification();
  const [restaurantNotifications, setRestaurantNotifications] = useState([]);
  const [loading, setLoading] = useState(false);

  // Add this state near your other useState declarations
  const [hasNewOrders, setHasNewOrders] = useState(false);

  // Add this useEffect to check for new orders
  useEffect(() => {
    checkNewOrders();
  }, []);

  useEffect(() => {
    fetchRestaurantNotifications();
  }, [user?.id]);

  useEffect(() => {
    const verifySetup = async () => {
      if (user?.user_type === "restaurant") {
        const isComplete = await checkRestaurantSetupComplete(user.id);
        console.log("🔍 Dashboard setup check:", {
          isComplete,
          userId: user.id,
        });

        if (!isComplete) {
          Alert.alert(
            "Setup Required",
            "Please complete your restaurant profile setup to access the dashboard.",
            [
              {
                text: "Complete Setup",
                onPress: () =>
                  router.push({
                    pathname: "/(restaurant)/setup",
                    params: { userId: user.id },
                  }),
              },
            ],
          );
        } else {
          fetchDashboardData();
        }
      }
    };

    verifySetup();
  }, [user]);

  const fetchRestaurantNotifications = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);

      // First, fetch notifications
      const { data: notifications, error } = await supabase
        .from("restaurant_notifications")
        .select("*")
        .eq("restaurant_id", user.id)
        .eq("read", false)
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) {
        console.error("Error fetching notifications:", error);
        return;
      }

      if (!notifications || notifications.length === 0) {
        setRestaurantNotifications([]);
        return;
      }

      // For each notification, try to get post data
      const notificationsWithPosts = await Promise.all(
        notifications.map(async (notification) => {
          let postData = null;

          // Try to get post_id from notification data
          const postId = notification.data?.post_id;
          const orderId = notification.data?.order_id;

          if (postId) {
            // Try to fetch post directly
            try {
              const { data: post } = await supabase
                .from("posts")
                .select("id, title, image_url, description")
                .eq("id", postId)
                .single();
              postData = post;
            } catch (postError) {
              console.log("No post found for ID:", postId);
            }
          } else if (orderId) {
            // Try to get post from order
            try {
              const { data: order } = await supabase
                .from("orders")
                .select("post_id")
                .eq("id", orderId)
                .single();

              if (order?.post_id) {
                const { data: post } = await supabase
                  .from("posts")
                  .select("id, title, image_url, description")
                  .eq("id", order.post_id)
                  .single();
                postData = post;
              }
            } catch (orderError) {
              console.log("No order found for ID:", orderId);
            }
          }

          return {
            ...notification,
            post: postData,
          };
        }),
      );

      setRestaurantNotifications(notificationsWithPosts);
    } catch (error) {
      console.error("Error in fetchRestaurantNotifications:", error);
      // Set empty array if there's an error
      setRestaurantNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  const [stats, setStats] = useState({
    totalOrders: 0,
    todayOrders: 0,
    pendingOrders: 0,
    preparingOrders: 0,
    readyOrders: 0,
    deliveredOrders: 0,
    totalEarnings: 0,
    todayEarnings: 0,
    menuItems: 0,
    posts: 0,
    rating: 0,
    reviews: 0,
  });

  const [recentOrders, setRecentOrders] = useState([]);
  const [popularItems, setPopularItems] = useState([]);
  const [lowStockItems, setLowStockItems] = useState([]);

  useEffect(() => {
    fetchDashboardData();
  }, [user]);

  // Fetch notification count
  useEffect(() => {
    const fetchNotificationCount = async () => {
      if (!user?.id) return;

      try {
        const { count, error } = await supabase
          .from("notifications")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("read", false);

        if (!error && count !== null) {
          setNotificationCount(count);
        }
      } catch (error) {
        console.error("Error fetching notification count:", error);
      }
    };

    fetchNotificationCount();
  }, [user]);

  const fetchDashboardData = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);

      // Get restaurant ID
      const { data: restaurantData } = await supabase
        .from("restaurants")
        .select("id")
        .eq("id", user.id)
        .single();

      if (!restaurantData) return;

      const restaurantId = restaurantData.id;

      // Today's date range
      const today = new Date();
      const startOfToday = new Date(today.setHours(0, 0, 0, 0)).toISOString();
      const endOfToday = new Date(
        today.setHours(23, 59, 59, 999),
      ).toISOString();

      // Fetch all orders for stats
      const { data: allOrders } = await supabase
        .from("orders")
        .select("*")
        .eq("restaurant_id", restaurantId);

      // Fetch today's orders
      const { data: todayOrders } = await supabase
        .from("orders")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .gte("created_at", startOfToday)
        .lte("created_at", endOfToday);

      // Fetch recent orders (last 5)
      const { data: recentOrdersData } = await supabase
        .from("orders")
        .select(
          `
        *,
        customers:users!orders_customer_id_fkey(
          full_name
        )
      `,
        )
        .eq("restaurant_id", restaurantId)
        .order("created_at", { ascending: false })
        .limit(5);

      // Calculate statistics
      const statsData = {
        totalOrders: allOrders?.length || 0,
        todayOrders: todayOrders?.length || 0,
        pendingOrders:
          allOrders?.filter((o) => o.status === "pending")?.length || 0,
        preparingOrders:
          allOrders?.filter((o) => o.status === "preparing")?.length || 0,
        readyOrders:
          allOrders?.filter((o) => o.status === "ready")?.length || 0,
        deliveredOrders:
          allOrders?.filter((o) => o.status === "delivered")?.length || 0,
        totalEarnings:
          allOrders?.reduce((sum, o) => sum + (o.final_amount || 0), 0) || 0,
        todayEarnings:
          todayOrders?.reduce((sum, o) => sum + (o.final_amount || 0), 0) || 0,
        menuItems: 0, // You can fetch this separately
        posts: 0, // You can fetch this separately
        rating: 4.5, // You can fetch this from reviews
        reviews: 0, // You can fetch this separately
      };

      // Fetch menu items count
      const { count: menuItemsCount } = await supabase
        .from("menu_items")
        .select("*", { count: "exact", head: true })
        .eq("restaurant_id", restaurantId);

      // Fetch posts count
      const { count: postsCount } = await supabase
        .from("posts")
        .select("*", { count: "exact", head: true })
        .eq("restaurant_id", restaurantId);

      // Fetch reviews count and rating
      const { data: reviewsData } = await supabase
        .from("reviews")
        .select("rating")
        .eq("restaurant_id", restaurantId);

      // Update stats with fetched data
      setStats({
        ...statsData,
        menuItems: menuItemsCount || 0,
        posts: postsCount || 0,
        rating: reviewsData?.length
          ? reviewsData.reduce((sum, r) => sum + (r.rating || 0), 0) /
            reviewsData.length
          : 0,
        reviews: reviewsData?.length || 0,
      });

      // Set recent orders
      setRecentOrders(recentOrdersData || []);

      const pendingOrders = allOrders?.filter((o) => o.status === "pending");
      setHasNewOrders(pendingOrders && pendingOrders.length > 0);

      // Fetch low stock items
      const { data: lowStockData } = await supabase
        .from("menu_items")
        .select("id, name, stock")
        .lt("stock", 5)
        .eq("restaurant_id", restaurantId);
      setLowStockItems(lowStockData || []);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      Alert.alert("Error", "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  const formatNotificationTime = (timestamp: string) => {
    try {
      const now = new Date();
      const date = new Date(timestamp);

      if (isNaN(date.getTime())) {
        return "Recently";
      }

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
    } catch (error) {
      return "Recently";
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
  };

  const checkNewOrders = async () => {
    if (!user?.id) return;

    try {
      const { data: restaurantData } = await supabase
        .from("restaurants")
        .select("id")
        .eq("id", user.id)
        .single();

      if (!restaurantData) return;

      // Get pending orders count
      const { data: pendingOrders, count } = await supabase
        .from("orders")
        .select("id", { count: "exact" })
        .eq("restaurant_id", restaurantData.id)
        .eq("status", "pending");

      // Update user context with count
      // You'll need to update your AuthContext to store this
      setHasNewOrders(pendingOrders && pendingOrders.length > 0);

      // Store count for display
      // Add newOrdersCount to your user object in AuthContext
    } catch (error) {
      console.error("Error checking new orders:", error);
    }
  };
  const renderStatCard = (
    title: string,
    value: string | number,
    icon: React.ReactNode,
    color: string,
  ) => (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <View style={[styles.statIcon, { backgroundColor: `${color}15` }]}>
        {icon}
      </View>
      <View style={styles.statContent}>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statTitle}>{title}</Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Dashboard</Text>
          <Text style={styles.headerSubtitle}>Manage your restaurant</Text>
        </View>
        <View style={styles.headerActions}>
          {/* Notifications Icon */}
          <NotificationBell />

          {/* Create Post Button */}
          <TouchableOpacity
            style={styles.createPostButton}
            onPress={() => router.push("/(restaurant)/posts/create")}
          >
            <Ionicons name="add-circle-outline" size={20} color="#FF6B35" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#FF6B35"
          />
        }
        contentContainerStyle={styles.scrollContent}
      >
        {/* Rating & Reviews */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Restaurant Rating</Text>
          <View style={styles.ratingContainer}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Ionicons name="star" size={16} color="#FF6B35" />
              <Text style={styles.ratingText}>
                {stats.rating.toFixed(1)} / 5
              </Text>
              <Text style={styles.reviewText}>({stats.reviews} reviews)</Text>
            </View>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsGrid}>
          <View style={styles.statsRow}>
            {renderStatCard(
              "Today Orders",
              stats.todayOrders,
              <MaterialIcons name="receipt" size={18} color="#FF6B35" />,
              "#FF6B35",
            )}
            {renderStatCard(
              "Pending",
              stats.pendingOrders,
              <MaterialCommunityIcons
                name="clock-time-three"
                size={18}
                color="#FF6B35"
              />,
              "#FF6B35",
            )}
          </View>
          <View style={styles.statsRow}>
            {renderStatCard(
              "Preparing",
              stats.preparingOrders,
              <MaterialCommunityIcons
                name="chef-hat"
                size={18}
                color="#FF6B35"
              />,
              "#FF6B35",
            )}
            {renderStatCard(
              "Ready",
              stats.readyOrders,
              <MaterialIcons
                name="delivery-dining"
                size={18}
                color="#FF6B35"
              />,
              "#FF6B35",
            )}
          </View>
          <View style={styles.statsRow}>
            {renderStatCard(
              "Delivered",
              stats.deliveredOrders,
              <Ionicons name="checkmark-done" size={18} color="#10B981" />,
              "#10B981",
            )}
            {renderStatCard(
              "Today Earnings",
              `AED ${stats.todayEarnings.toFixed(2)}`,
              <Ionicons name="cash" size={18} color="#FF6B35" />,
              "#FF6B35",
            )}
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => router.push("/(restaurant)/menu")}
            >
              <View
                style={[styles.actionIcon, { backgroundColor: "#FF6B3515" }]}
              >
                <Ionicons name="restaurant" size={20} color="#FF6B35" />
              </View>
              <Text style={styles.actionText}>Menu</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => router.push("/(restaurant)/orders")}
            >
              <View
                style={[styles.actionIcon, { backgroundColor: "#FF6B3515" }]}
              >
                <Ionicons name="receipt" size={20} color="#FF6B35" />
                {hasNewOrders && (
                  <View style={styles.newOrderBadge}>
                    <Ionicons name="notifications" size={10} color="#fff" />
                  </View>
                )}
              </View>
              <Text style={styles.actionText}>Orders</Text>
              {hasNewOrders && (
                <View style={styles.newOrderTextBadge}>
                  <Text style={styles.newOrderText}>New!</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => router.push("/(restaurant)/posts")}
            >
              <View
                style={[styles.actionIcon, { backgroundColor: "#FF6B3515" }]}
              >
                <Ionicons name="newspaper" size={20} color="#FF6B35" />
              </View>
              <Text style={styles.actionText}>Posts</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => router.push("/(restaurant)/analytics/analytics")}
            >
              <View
                style={[styles.actionIcon, { backgroundColor: "#FF6B3515" }]}
              >
                <Ionicons name="analytics" size={20} color="#FF6B35" />
              </View>
              <Text style={styles.actionText}>Analytics</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Low Stock Alerts */}
        {lowStockItems.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Low Stock Items</Text>
            {lowStockItems.map((item) => (
              <View key={item.id} style={styles.alertCard}>
                <Ionicons
                  name="alert-circle-outline"
                  size={16}
                  color="#EF4444"
                />
                <Text style={styles.alertText}>
                  {item.name} is running low ({item.stock} left)
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Recent Orders */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Orders</Text>
            <TouchableOpacity
              onPress={() => router.push("/(restaurant)/orders")}
            >
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>

          {recentOrders.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={40} color="#D1D5DB" />
              <Text style={styles.emptyStateText}>No orders yet</Text>
            </View>
          ) : (
            <View style={styles.ordersList}>
              {recentOrders.map((order) => (
                <TouchableOpacity
                  key={order.id}
                  style={styles.orderCard}
                  onPress={() =>
                    router.push(`/(restaurant)/orders/${order.id}`)
                  }
                >
                  <View style={styles.orderInfo}>
                    <Text style={styles.orderNumber}>
                      #{order.order_number}
                    </Text>
                    <Text style={styles.orderCustomer}>
                      {order.customers?.full_name || "Customer"}
                    </Text>
                  </View>
                  <View style={styles.orderMeta}>
                    <Text style={styles.orderAmount}>
                      AED {order.final_amount.toFixed(2)}
                    </Text>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: getStatusColor(order.status) },
                      ]}
                    >
                      <Text style={styles.statusText}>{order.status}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {restaurantNotifications.length > 0 && (
          <View style={styles.notificationPanel}>
            <View style={styles.notificationPanelHeader}>
              <Text style={styles.notificationPanelTitle}>
                Recent Notifications ({restaurantNotifications.length})
              </Text>
              <TouchableOpacity
                onPress={() =>
                  router.push(
                    "/(restaurant)/notifications/restaurant_notifications",
                  )
                }
              >
                <Text style={styles.viewAllText}>View All</Text>
              </TouchableOpacity>
            </View>

            {restaurantNotifications.slice(0, 3).map((notification) => (
              <TouchableOpacity
                key={notification.id}
                style={styles.notificationItem}
                onPress={() => {
                  if (notification.data?.order_id) {
                    // Make sure we're passing only the UUID, not the filename
                    const orderId = notification.data.order_id;
                    // Extract just the UUID if it's concatenated with filename
                    const cleanOrderId = orderId.replace(
                      "OrderActions.tsx",
                      "",
                    );
                    router.push(`/(restaurant)/orders/${cleanOrderId}`);
                  }
                }}
                activeOpacity={0.7}
              >
                {/* Left side: Image or Icon */}
                <View style={styles.notificationImageContainer}>
                  {notification.post?.image_url ? (
                    <Image
                      source={{ uri: notification.post.image_url }}
                      style={styles.notificationPostImage}
                      defaultSource={require("@/assets/images/food images/Dessert.png")}
                    />
                  ) : (
                    <View style={styles.notificationIconContainer}>
                      <Ionicons
                        name={getNotificationIcon(notification.type)}
                        size={20}
                        color="#FF6B35"
                      />
                    </View>
                  )}
                  {!notification.read && (
                    <View style={styles.unreadIndicator} />
                  )}
                </View>

                {/* Right side: Content */}
                <View style={styles.notificationContent}>
                  <View style={styles.notificationHeader}>
                    <Text style={styles.notificationTitle}>
                      {notification.title}
                    </Text>
                    <Text style={styles.notificationTime}>
                      {formatNotificationTime(notification.created_at)}
                    </Text>
                  </View>

                  {/* Post Details if available */}
                  {notification.post && (
                    <View style={styles.postInfo}>
                      <Text style={styles.postTitle} numberOfLines={1}>
                        {notification.post.title}
                      </Text>
                      {notification.post.description && (
                        <Text style={styles.postDescription} numberOfLines={1}>
                          {notification.post.description}
                        </Text>
                      )}
                    </View>
                  )}

                  {/* Order info if available */}
                  {notification.data?.order_number && (
                    <View style={styles.orderInfo}>
                      <Text style={styles.orderNumbernotification}>
                        Order #{notification.data.order_number}
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
const getNotificationIcon = (type: string) => {
  switch (type) {
    case "order":
      return "fast-food";
    case "review":
      return "star";
    case "promotion":
      return "megaphone";
    case "system":
      return "settings";
    default:
      return "notifications";
  }
};

const getStatusColor = (status: string) => {
  switch (status?.toLowerCase()) {
    case "pending":
      return "#FF6B3520"; // Lighter background
    case "preparing":
      return "#3B82F620"; // Blue
    case "ready":
      return "#10B98120"; // Green
    case "out_for_delivery":
      return "#8B5CF620"; // Purple
    case "delivered":
      return "#10B98120"; // Green
    case "cancelled":
      return "#EF444420"; // Red
    default:
      return "#F3F4F6";
  }
};

// Also add a getStatusTextColor for the text
const getStatusTextColor = (status: string) => {
  switch (status?.toLowerCase()) {
    case "pending":
      return "#FF6B35"; // Orange text
    case "preparing":
      return "#3B82F6"; // Blue text
    case "ready":
      return "#10B981"; // Green text
    case "out_for_delivery":
      return "#8B5CF6"; // Purple text
    case "delivered":
      return "#10B981"; // Green text
    case "cancelled":
      return "#EF4444"; // Red text
    default:
      return "#374151";
  }
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB", paddingBottom: -22 },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "500",
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
    fontWeight: "500",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  notificationButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F9FAFB",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    position: "relative",
  },
  notificationBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#EF4444",
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  notificationBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
  createPostButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F9FAFB",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 0.6,
    borderColor: "#E5E7EB",
  },

  content: { flex: 1 },
  scrollContent: { paddingBottom: 20 },

  statsGrid: { paddingHorizontal: 16, marginTop: 16 },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111827",
    borderRadius: 10,
    padding: 16,
    marginHorizontal: 4,
    borderLeftWidth: 4,
    borderColor: "#E5E7EB",
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  statContent: { flex: 1 },
  statValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#E5E7EB",
    marginBottom: 2,
  },
  statTitle: {
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "500",
    letterSpacing: -0.2,
  },

  section: {
    backgroundColor: "#FFFFFF",
    marginTop: 16,
    marginHorizontal: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 10,
    borderWidth: 0.4,
    borderColor: "#E5E7EB",
    paddingBottom: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: "#111827" },
  seeAllText: { fontSize: 12, color: "#FF6B35", fontWeight: "600" },

  actionsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
    top: 8,
  },
  actionCard: {
    width: "48%",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 10,
    paddingVertical: 12,
    borderWidth: 0.4,
    borderColor: "#E5E7EB",
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },
  actionText: { fontSize: 12, fontWeight: "500", color: "#374151" },

  ratingContainer: { flexDirection: "row", alignItems: "center", marginTop: 6 },
  ratingText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FF6B35",
    marginLeft: 4,
  },
  reviewText: {
    fontSize: 12,
    color: "#6B7280",
    marginLeft: 6,
    fontWeight: "500",
  },

  alertCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  alertText: {
    fontSize: 12,
    color: "#EF4444",
    marginLeft: 6,
    fontWeight: "500",
  },

  ordersList: { gap: 10, marginTop: 10 },
  orderCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    padding: 12,
    borderWidth: 0.3,
    borderColor: "#E5E7EB",
  },
  orderInfo: { flex: 1 },

  orderCustomer: { fontSize: 12, color: "#4B5563", fontWeight: "400" },
  orderMeta: { alignItems: "flex-end" },
  orderAmount: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FF6B35",
    marginBottom: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    minWidth: 70,
    alignItems: "center",
  },
  statusText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#374151",
    textTransform: "capitalize",
  },

  emptyState: { alignItems: "center", paddingVertical: 20 },
  emptyStateText: {
    marginTop: 8,
    fontSize: 12,
    color: "#9CA3AF",
    fontWeight: "500",
  },

  notificationPanel: {
    backgroundColor: "#FFFFFF",
    marginTop: 16,
    marginHorizontal: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: "#E5E7EB", // Light gray border color
  },
  notificationPanelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  notificationPanelTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  viewAllText: {
    fontSize: 12, // Adjust the font size as needed
    fontWeight: "500",
    color: "#FF6B35",
  },
  notificationItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#6B728020", // Light gray with some transparency
    marginTop: 10, // Add margin top to separate items
  },
  notificationIcon: {
    marginRight: 10,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#111827", // Dark gray color
  },
  notificationBody: {
    fontSize: 11,
    color: "#6B7280", // Medium gray color
    marginTop: 2,
  },

  notificationPostImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  postInfo: {
    marginTop: 4,
    marginBottom: 4,
  },

  postTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 2,
  },

  notificationFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },

  notificationTime: {
    fontSize: 10,
    color: "#9CA3AF",
  },

  unreadBadge: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FF6B35",
  },
  notificationImageContainer: {
    position: "relative",
    marginRight: 12,
  },

  notificationIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: "#FF6B3515",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#FF6B3520",
  },

  unreadIndicator: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#FF6B35",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },

  notificationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  },

  postDescription: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 2,
    fontWeight: "400",
  },

  orderNumbernotification: {
    fontSize: 11,
    color: "#3B82F6",
    fontWeight: "500",
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: "flex-start",
  },

  newOrderBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#EF4444",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  newOrderTextBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "#EF4444",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  newOrderText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "700",
  },
  orderNumber: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
});
