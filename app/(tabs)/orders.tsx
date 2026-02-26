// app/(tabs)/orders.tsx - UPDATED with Post Info
import { useAuth } from "@/backend/AuthContext";
import { useGuestAction } from "@/backend/hooks/useGuestAction";
import { supabase } from "@/backend/supabase";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { GuestProfileBanner } from "../components/GuestProfileBanner";
import NotificationBell from "../components/NotificationBell";

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  unit_price: number;
  post_id?: string;
  post_title?: string;
  post_image_url?: string;
  post_description?: string;
}

interface Order {
  id: string;
  order_number: string;
  restaurant_id: string;
  restaurant_name: string;
  restaurant_image: string;
  status:
    | "pending"
    | "confirmed"
    | "preparing"
    | "ready"
    | "out_for_delivery"
    | "delivered"
    | "cancelled";
  total_amount: number;
  delivery_fee: number;
  final_amount: number;
  created_at: string;
  estimated_delivery_time: string;
  payment_method: string;
  payment_status: string;
  items: OrderItem[];
  // Post data for the main item
  main_post_image?: string;
  main_post_title?: string;
}

export default function OrdersScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("all");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // Inside the component
  const { checkGuestAction, isGuest } = useGuestAction();

  // Fetch orders from Supabase
  const fetchOrders = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      // First, get orders
      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select(
          `
          id,
          order_number,
          restaurant_id,
          status,
          total_amount,
          delivery_fee,
          final_amount,
          created_at,
          estimated_delivery_time,
          payment_method,
          payment_status,
          post_id,
          restaurants!inner (
            restaurant_name,
            image_url
          )
        `,
        )
        .eq("customer_id", user.id)
        .order("created_at", { ascending: false });

      if (ordersError) {
        console.error("Orders error:", ordersError);
        throw ordersError;
      }

      // If no orders, set empty array
      if (!ordersData || ordersData.length === 0) {
        setOrders([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // Get order items for each order
      const ordersWithItems = await Promise.all(
        ordersData.map(async (order: any) => {
          // Fetch order items with post data
          const { data: itemsData, error: itemsError } = await supabase
            .from("order_items")
            .select(
              `
              id,
              quantity,
              unit_price,
              posts!left (
                title,
                image_url,
                description
              ),
              menu_items!left (
                name,
                image_url,
                description
              )
            `,
            )
            .eq("order_id", order.id);

          let items: OrderItem[] = [];
          let mainPostImage = "";
          let mainPostTitle = "";

          if (!itemsError && itemsData) {
            items = itemsData.map((item: any) => {
              const itemName =
                item.posts?.title || item.menu_items?.name || "Item";
              const itemImage =
                item.posts?.image_url || item.menu_items?.image_url;

              // Set main post image/title for the order card
              if (!mainPostImage && itemImage) {
                mainPostImage = itemImage;
              }
              if (!mainPostTitle && itemName) {
                mainPostTitle = itemName;
              }

              return {
                id: item.id,
                name: itemName,
                quantity: item.quantity || 1,
                unit_price: parseFloat(item.unit_price) || 0,
                post_title: item.posts?.title,
                post_image_url: itemImage,
                post_description:
                  item.posts?.description || item.menu_items?.description,
              };
            });
          }

          // If order has a direct post_id, try to fetch that post
          if (order.post_id && !mainPostImage) {
            const { data: postData } = await supabase
              .from("posts")
              .select("title, image_url")
              .eq("id", order.post_id)
              .single();

            if (postData) {
              mainPostImage = postData.image_url;
              mainPostTitle = postData.title;
            }
          }

          // If still no main image, try to get from restaurant
          if (!mainPostImage && order.restaurants?.image_url) {
            mainPostImage = order.restaurants.image_url;
          }

          return {
            id: order.id,
            order_number: order.order_number || `ORD-${order.id.slice(0, 8)}`,
            restaurant_id: order.restaurant_id,
            restaurant_name:
              order.restaurants?.restaurant_name || "Unknown Restaurant",
            restaurant_image: order.restaurants?.image_url,
            status: order.status,
            total_amount: parseFloat(order.total_amount) || 0,
            delivery_fee: parseFloat(order.delivery_fee) || 0,
            final_amount: parseFloat(order.final_amount) || 0,
            created_at: order.created_at,
            estimated_delivery_time: order.estimated_delivery_time,
            payment_method: order.payment_method,
            payment_status: order.payment_status,
            items: items,
            main_post_image: mainPostImage,
            main_post_title: mainPostTitle || items[0]?.name || "Order",
          };
        }),
      );

      setOrders(ordersWithItems);
    } catch (error) {
      console.error("Error fetching orders:", error);
      Alert.alert("Error", "Failed to load your orders");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchOrders();
  }, [fetchOrders]);

  const getStatusColor = (status: string) => {
    switch (status) {
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return "time-outline";
      case "confirmed":
        return "checkmark-circle-outline";
      case "preparing":
        return "restaurant-outline";
      case "ready":
        return "fast-food-outline";
      case "out_for_delivery":
        return "bicycle-outline";
      case "delivered":
        return "checkmark-done-outline";
      case "cancelled":
        return "close-circle-outline";
      default:
        return "help-circle-outline";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "pending":
        return "Pending";
      case "confirmed":
        return "Confirmed";
      case "preparing":
        return "Preparing";
      case "ready":
        return "Ready";
      case "out_for_delivery":
        return "On the Way";
      case "delivered":
        return "Delivered";
      case "cancelled":
        return "Cancelled";
      default:
        return status;
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "Invalid date";

      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        return `Today, ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
      } else if (diffDays === 1) {
        return `Yesterday, ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
      } else if (diffDays < 7) {
        return `${date.toLocaleDateString("en-US", { weekday: "short" })}, ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
      } else {
        return date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
      }
    } catch (error) {
      return dateString;
    }
  };

  const filteredOrders =
    activeTab === "all"
      ? orders
      : orders.filter((order) => order.status === activeTab);

  // Update the openOrderDetails function
  const openOrderDetails = (orderId: string) => {
    checkGuestAction("view order details", () => {
      console.log("Navigating to order:", orderId);
      router.push(`../orders/${orderId}`);
    });
  };
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6B35" />
          <Text style={styles.loadingText}>Loading your orders...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Orders</Text>
        <NotificationBell />
      </View>
      {isGuest && (
        <View style={styles.guestBannerContainer}>
          <GuestProfileBanner />
        </View>
      )}

      {/* Tabs */}
      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabsContainer}
          contentContainerStyle={styles.tabsContent}
        >
          {[
            { key: "all", label: "All" },
            { key: "pending", label: "Pending" },
            { key: "preparing", label: "Preparing" },
            { key: "out_for_delivery", label: "On the Way" },
            { key: "delivered", label: "Delivered" },
            { key: "cancelled", label: "Cancelled" },
          ].map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.activeTab]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === tab.key && styles.activeTabText,
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Orders List */}
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#FF6B35"]}
            tintColor="#FF6B35"
          />
        }
      >
        {filteredOrders.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={48} color="#D1D5DB" />
            <Text style={styles.emptyStateTitle}>
              {activeTab === "all" ? "No orders yet" : `No ${activeTab} orders`}
            </Text>
            <Text style={styles.emptyStateText}>
              {activeTab === "all"
                ? "You haven't placed any orders yet."
                : `You don't have any ${activeTab} orders.`}
            </Text>
            {activeTab === "all" && (
              <TouchableOpacity
                style={styles.browseButton}
                onPress={() => router.push("/(tabs)/home")}
              >
                <Text style={styles.browseButtonText}>Browse Restaurants</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          filteredOrders.map((order) => (
            <TouchableOpacity
              key={order.id}
              style={styles.orderCard}
              onPress={() => openOrderDetails(order.id)}
              activeOpacity={0.7}
            >
              {/* Order Header with Image */}
              <View style={styles.orderHeader}>
                {/* Food Image */}
                <View style={styles.orderImageContainer}>
                  {order.main_post_image ? (
                    <Image
                      source={{ uri: order.main_post_image }}
                      style={styles.orderImage}
                    />
                  ) : (
                    <View style={styles.orderImagePlaceholder}>
                      <Ionicons
                        name="fast-food-outline"
                        size={24}
                        color="#9CA3AF"
                      />
                    </View>
                  )}
                </View>

                {/* Order Info */}
                <View style={styles.orderInfo}>
                  <View style={styles.orderInfoHeader}>
                    <View>
                      <Text style={styles.orderId}>
                        Order #{order.order_number}
                      </Text>
                      <Text style={styles.restaurantName}>
                        {order.restaurant_name}
                      </Text>
                      {order.main_post_title && (
                        <Text style={styles.foodName} numberOfLines={2}>
                          {order.main_post_title}
                        </Text>
                      )}
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor: `${getStatusColor(order.status)}15`,
                        },
                      ]}
                    >
                      <Ionicons
                        name={getStatusIcon(order.status) as any}
                        size={12}
                        color={getStatusColor(order.status)}
                      />
                      <Text
                        style={[
                          styles.statusText,
                          { color: getStatusColor(order.status) },
                        ]}
                      >
                        {getStatusText(order.status)}
                      </Text>
                    </View>
                  </View>

                  {/* Order Items Summary */}
                  {order.items.length > 0 && (
                    <View style={styles.itemsSummary}>
                      <View style={styles.itemsRow}>
                        <Text style={styles.itemsCount}>
                          {order.items.length} item
                          {order.items.length !== 1 ? "s" : ""}
                        </Text>
                        <Text style={styles.orderTotal}>
                          AED {order.final_amount.toFixed(2)}
                        </Text>
                      </View>
                      {order.items.length > 0 && (
                        <Text style={styles.itemsText} numberOfLines={1}>
                          {order.items.slice(0, 2).map((item, index) => (
                            <Text key={item.id}>
                              {item.quantity}x {item.name}
                              {index < Math.min(order.items.length - 1, 1)
                                ? ", "
                                : ""}
                              {order.items.length > 2 && index === 1
                                ? "..."
                                : ""}
                            </Text>
                          ))}
                        </Text>
                      )}
                    </View>
                  )}

                  {/* Order Footer */}
                  <View style={styles.orderFooter}>
                    <View style={styles.timeInfo}>
                      <Ionicons name="time-outline" size={12} color="#6B7280" />
                      <Text style={styles.orderDate}>
                        {formatDate(order.created_at)}
                      </Text>
                    </View>

                    <View style={styles.orderActions}>
                      {order.status === "delivered" && (
                        <TouchableOpacity
                          style={styles.rateButton}
                          onPress={() =>
                            router.push(`/orders/rate/${order.id}`)
                          }
                        >
                          <Text style={styles.rateButtonText}>Rate Order</Text>
                        </TouchableOpacity>
                      )}
                      {order.status === "out_for_delivery" && (
                        <TouchableOpacity
                          style={styles.trackButton}
                          onPress={() =>
                            router.push(`/orders/track?orderId=${order.id}`)
                          }
                        >
                          <Ionicons name="navigate" size={14} color="#3B82F6" />
                          <Text style={styles.trackButtonText}>Track</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={styles.detailsButton}
                        onPress={() => openOrderDetails(order.id)}
                      >
                        <Text style={styles.detailsButtonText}>Details</Text>
                        <Ionicons
                          name="chevron-forward"
                          size={14}
                          color="#6B7280"
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

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
    backgroundColor: "#fff",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#6B7280",
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  tabsContainer: {
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
  },
  tabsContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  activeTab: {
    backgroundColor: "#FF6B35",
    borderColor: "#FF6B35",
  },
  tabText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },
  activeTabText: {
    color: "#FFFFFF",
  },
  content: {
    flex: 1,
    padding: 16,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
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
  browseButton: {
    marginTop: 16,
    backgroundColor: "#FF6B35",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  browseButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  orderCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 0.6,
    borderColor: "#E5E7EB",
    overflow: "hidden",
  },
  orderHeader: {
    flexDirection: "row",
  },
  orderImageContainer: {
    width: 100,
    height: 120,
    backgroundColor: "#F3F4F6",
  },
  orderImage: {
    width: 100,
    height: 120,
    resizeMode: "cover",
  },
  orderImagePlaceholder: {
    width: 100,
    height: 120,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
  },
  orderInfo: {
    flex: 1,
    padding: 12,
  },
  orderInfoHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  orderId: {
    fontSize: 11,
    color: "#6B7280",
    marginBottom: 2,
    fontWeight: "500",
  },
  restaurantName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
    lineHeight: 18,
    marginBottom: 2,
  },
  foodName: {
    fontSize: 12,
    color: "#4B5563",
    fontWeight: "600",
    lineHeight: 16,
    maxWidth: 120,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 4,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  itemsSummary: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  itemsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  itemsCount: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "500",
  },
  orderTotal: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  itemsText: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "400",
    lineHeight: 16,
  },
  orderFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  timeInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  orderDate: {
    fontSize: 11,
    color: "#9CA3AF",
    fontWeight: "400",
  },
  orderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rateButton: {
    backgroundColor: "#FF6B35",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FF6B35",
  },
  rateButtonText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "600",
  },
  trackButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#EFF6FF",
    gap: 4,
  },
  trackButtonText: {
    color: "#3B82F6",
    fontSize: 11,
    fontWeight: "600",
  },
  detailsButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  detailsButtonText: {
    color: "#6B7280",
    fontSize: 11,
    fontWeight: "600",
  },

  // Add styles
  guestBannerContainer: {
    marginTop: 8,
    marginBottom: 8,
  },
});
