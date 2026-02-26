// app/(driver)/orders.tsx - COMPLETE FIXED VERSION with single-order lock
import { useAuth } from "@/backend/AuthContext";
import { useDriverOrderChannel } from "@/backend/hooks/useDriverOrderChannel";
import { supabase } from "@/backend/supabase";
import animations from "@/constent/animations";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import LottieView from "lottie-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import NotificationBell from "../components/NotificationBell";

interface Order {
  id: string;
  order_number: string;
  status: string;
  final_amount: number;
  delivery_fee: number;
  created_at: string;
  estimated_delivery_time: string | null;
  special_instructions: string | null;
  driver_id: string | null;
  restaurant_id: string;
  customer_id: string;
  restaurants?: {
    restaurant_name: string;
    address: string;
    latitude?: number;
    longitude?: number;
    restaurant_rating?: number;
    delivery_fee?: number;
  };
  customers?: {
    users?: {
      full_name: string;
      phone?: string;
    };
  };
  delivery_address?: any;
  distance?: number;
  earnings?: number;
  eta?: number;
  isNearby?: boolean;
}

export default function DriverOrdersScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedFilter, setSelectedFilter] = useState("available");
  const [isOnline, setIsOnline] = useState(false);
  const [driverLocation, setDriverLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  // 🔴 NEW: Track if driver has an active order
  const [hasActiveOrder, setHasActiveOrder] = useState(false);

  const isMounted = useRef(true);
  const subscriptionRef = useRef<any>(null);

  const {
    availableOrders: realTimeOrders,
    showNewOrderAlert,
    latestOrder,
    acceptOrder,
    dismissAlert,
  } = useDriverOrderChannel();

  useEffect(() => {
    if (selectedFilter === "available" && realTimeOrders.length > 0) {
      setOrders((prev) => {
        const orderMap = new Map(prev.map((o) => [o.id, o]));
        realTimeOrders.forEach((rtOrder: any) => {
          if (!orderMap.has(rtOrder.id)) {
            orderMap.set(rtOrder.id, rtOrder);
          }
        });
        return Array.from(orderMap.values());
      });
    }
  }, [realTimeOrders, selectedFilter]);

  const filters = [
    { id: "available", label: "Available", icon: "checkmark-circle" },
    { id: "active", label: "Active", icon: "bicycle" },
    { id: "completed", label: "Completed", icon: "checkmark-done" },
    { id: "cancelled", label: "Cancelled", icon: "close-circle" },
  ];

  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 999;
    const R = 6371;
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(deg2rad(lat1)) *
        Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    return parseFloat(distance.toFixed(1));
  };

  const deg2rad = (deg: number): number => {
    return deg * (Math.PI / 180);
  };

  // 🔴 NEW: Check if driver has any active order
  const checkActiveOrder = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from("orders")
        .select("id, status")
        .eq("driver_id", user.id)
        .in("status", ["confirmed", "preparing", "ready", "out_for_delivery"])
        .maybeSingle();

      if (error) {
        console.error("Error checking active order:", error);
        return;
      }

      setHasActiveOrder(!!data);

      // If driver has active order and is on available tab, switch to active tab
      if (data && selectedFilter === "available") {
        setSelectedFilter("active");
      }
    } catch (error) {
      console.error("Error in checkActiveOrder:", error);
    }
  }, [user?.id, selectedFilter]);

  const fetchDriverStatus = useCallback(async () => {
    if (!user?.id || !isMounted.current) return;
    try {
      const { data, error } = await supabase
        .from("delivery_users")
        .select("is_online, current_location_lat, current_location_lng")
        .eq("id", user.id)
        .single();

      if (!error && data) {
        if (isMounted.current) {
          setIsOnline(data.is_online);
          if (data.current_location_lat && data.current_location_lng) {
            setDriverLocation({
              lat: parseFloat(data.current_location_lat),
              lng: parseFloat(data.current_location_lng),
            });
          }
        }
      }
    } catch (error) {
      console.error("Error fetching driver status:", error);
    }
  }, [user?.id]);

  const setupSubscription = useCallback(() => {
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
      subscriptionRef.current = null;
    }

    if (selectedFilter === "available" && isOnline && user?.id) {
      subscriptionRef.current = supabase
        .channel(`available-orders-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "orders",
            filter: "status=eq.ready",
          },
          (payload) => {
            console.log(
              "Order status changed to ready:",
              payload.new.order_number,
            );
            setTimeout(() => {
              if (isMounted.current) {
                fetchOrders();
              }
            }, 1000);
          },
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "orders",
          },
          (payload) => {
            if (payload.new.driver_id && payload.old.driver_id === null) {
              setOrders((prev) =>
                prev.filter((order) => order.id !== payload.new.id),
              );
            }
          },
        )
        .subscribe();
    }
  }, [selectedFilter, isOnline, user?.id]);

  const fetchOrders = useCallback(async () => {
    if (!user?.id || !isMounted.current) return;

    try {
      setLoading(true);
      let ordersData: Order[] = [];

      switch (selectedFilter) {
        case "available":
          const { data: availableOrders, error: availableError } =
            await supabase
              .from("orders")
              .select(
                `
              id,
              order_number,
              status,
              final_amount,
              delivery_fee,
              created_at,
              estimated_delivery_time,
              special_instructions,
              restaurant_id,
              customer_id,
              restaurants:restaurants!orders_restaurant_id_fkey(
                restaurant_name,
                address,
                latitude,
                longitude,
                restaurant_rating,
                delivery_fee
              )
            `,
              )
              .eq("status", "ready")
              .is("driver_id", null)
              .order("created_at", { ascending: true })
              .limit(50);

          if (availableError) {
            console.error("Error fetching available orders:", availableError);
            const { data: simpleOrders } = await supabase
              .from("orders")
              .select("*")
              .eq("status", "ready")
              .is("driver_id", null)
              .order("created_at", { ascending: true })
              .limit(50);

            if (simpleOrders) {
              const restaurantIds = simpleOrders
                .map((o) => o.restaurant_id)
                .filter(Boolean);
              let restaurantsMap = {};

              if (restaurantIds.length > 0) {
                const { data: restaurants } = await supabase
                  .from("restaurants")
                  .select(
                    "id, restaurant_name, address, latitude, longitude, restaurant_rating, delivery_fee",
                  )
                  .in("id", restaurantIds);

                if (restaurants) {
                  restaurants.forEach((r) => {
                    restaurantsMap[r.id] = r;
                  });
                }
              }

              ordersData = simpleOrders.map((order) => ({
                ...order,
                restaurants: restaurantsMap[order.restaurant_id] || {
                  restaurant_name: "Restaurant",
                  address: "",
                },
                customers: {},
              }));
            }
          } else if (availableOrders) {
            ordersData = availableOrders.map((order) => ({
              ...order,
              customers: {},
            }));
          }
          break;

        case "active":
          const { data: activeOrders, error: activeError } = await supabase
            .from("orders")
            .select(
              `
              id,
              order_number,
              status,
              final_amount,
              delivery_fee,
              created_at,
              estimated_delivery_time,
              special_instructions,
              restaurant_id,
              customer_id,
              restaurants:restaurants!orders_restaurant_id_fkey(
                restaurant_name,
                address,
                latitude,
                longitude
              )
            `,
            )
            .eq("driver_id", user.id)
            .in("status", [
              "confirmed",
              "preparing",
              "ready",
              "out_for_delivery",
            ])
            .order("created_at", { ascending: false })
            .limit(50);

          if (activeError) {
            console.error("Error fetching active orders:", activeError);
          } else if (activeOrders) {
            ordersData = activeOrders;

            const customerIds = activeOrders
              .map((o) => o.customer_id)
              .filter(Boolean);
            if (customerIds.length > 0) {
              const { data: customers } = await supabase
                .from("users")
                .select("id, full_name")
                .in("id", customerIds);

              if (customers) {
                const customersMap = {};
                customers.forEach((c) => {
                  customersMap[c.id] = c;
                });

                ordersData = ordersData.map((order) => ({
                  ...order,
                  customers: {
                    users: customersMap[order.customer_id] || {
                      full_name: "Customer",
                    },
                  },
                }));
              }
            }
          }
          break;

        case "completed":
          const { data: completedOrders, error: completedError } =
            await supabase
              .from("orders")
              .select(
                `
              id,
              order_number,
              status,
              final_amount,
              delivery_fee,
              created_at,
              estimated_delivery_time,
              actual_delivery_time,
              restaurant_id,
              customer_id,
              restaurants:restaurants!orders_restaurant_id_fkey(
                restaurant_name,
                address
              )
            `,
              )
              .eq("driver_id", user.id)
              .eq("status", "delivered")
              .order("created_at", { ascending: false })
              .limit(50);

          if (completedError) {
            console.error("Error fetching completed orders:", completedError);
          } else if (completedOrders) {
            ordersData = completedOrders;
          }
          break;

        case "cancelled":
          const { data: cancelledOrders, error: cancelledError } =
            await supabase
              .from("orders")
              .select(
                `
              id,
              order_number,
              status,
              final_amount,
              delivery_fee,
              created_at,
              restaurant_id,
              restaurants:restaurants!orders_restaurant_id_fkey(
                restaurant_name,
                address
              )
            `,
              )
              .eq("driver_id", user.id)
              .eq("status", "cancelled")
              .order("created_at", { ascending: false })
              .limit(50);

          if (cancelledError) {
            console.error("Error fetching cancelled orders:", cancelledError);
          } else if (cancelledOrders) {
            ordersData = cancelledOrders;
          }
          break;

        default:
          const { data: allOrders, error: allError } = await supabase
            .from("orders")
            .select("*")
            .eq("driver_id", user.id)
            .order("created_at", { ascending: false })
            .limit(50);

          if (allError) {
            console.error("Error fetching all orders:", allError);
          } else if (allOrders) {
            ordersData = allOrders;
          }
      }

      if (selectedFilter === "available" && driverLocation) {
        ordersData = ordersData.map((order) => {
          let distance = null;
          if (order.restaurants?.latitude && order.restaurants?.longitude) {
            distance = calculateDistance(
              driverLocation.lat,
              driverLocation.lng,
              order.restaurants.latitude,
              order.restaurants.longitude,
            );
          }

          const earnings = (order.delivery_fee || 5) * 0.8;
          const eta = distance ? Math.round(distance * 3) : null;
          const isNearby = distance !== null && distance <= 10;

          return {
            ...order,
            distance,
            earnings,
            eta,
            isNearby,
          };
        });

        ordersData.sort((a: any, b: any) => {
          const distA = a.distance || 999;
          const distB = b.distance || 999;
          return distA - distB;
        });
      }

      if (isMounted.current) {
        setOrders(ordersData);
      }
    } catch (error: any) {
      console.error("Error fetching orders:", error);
      if (isMounted.current) {
        setOrders([]);
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [user?.id, selectedFilter, driverLocation]);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
    };
  }, []);

  useEffect(() => {
    if (user?.id) {
      fetchDriverStatus();
      checkActiveOrder(); // 🔴 Check for active orders
      fetchOrders();
    }
  }, [user?.id, selectedFilter]);

  // 🔴 NEW: Listen for order status changes that might affect active order
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`driver-active-order-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `driver_id=eq.${user.id}`,
        },
        (payload) => {
          // If order is delivered or cancelled, driver becomes free
          if (
            payload.new.status === "delivered" ||
            payload.new.status === "cancelled"
          ) {
            setHasActiveOrder(false);

            // If driver was on active tab and order is completed, show success and maybe switch to available
            if (selectedFilter === "active") {
              Alert.alert(
                "✅ Delivery Complete!",
                "Order has been delivered. Ready for new deliveries?",
                [
                  { text: "Stay on Active", style: "cancel" },
                  {
                    text: "See Available Orders",
                    onPress: () => setSelectedFilter("available"),
                  },
                ],
              );
            }
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, selectedFilter]);

  useEffect(() => {
    setupSubscription();
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
    };
  }, [setupSubscription]);

  // 🔴 UPDATED: Handle accept with active order check
  const handleAcceptOrder = async (orderId: string) => {
    if (!user?.id) return;

    if (!isOnline) {
      Alert.alert("Offline", "Please go online to accept orders");
      return;
    }

    // 🔴 Check if driver already has an active order
    if (hasActiveOrder) {
      Alert.alert(
        "Active Delivery",
        "You already have an active delivery. Complete it before accepting a new one.",
        [
          {
            text: "View Active Order",
            onPress: () => setSelectedFilter("active"),
          },
          { text: "Cancel", style: "cancel" },
        ],
      );
      return;
    }

    Alert.alert(
      "Accept Delivery",
      "Are you sure you want to accept this delivery?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Accept",
          onPress: async () => {
            const success = await acceptOrder(orderId);
            if (success) {
              setHasActiveOrder(true); // 🔴 Set active order flag
              Alert.alert(
                "Order Accepted! 🎉",
                "You have successfully accepted this delivery.",
                [
                  {
                    text: "View Details",
                    onPress: () => router.push(`/(driver)/orders/${orderId}`),
                  },
                  {
                    text: "Continue",
                    onPress: () => {
                      fetchOrders();
                      fetchDriverStatus();
                    },
                  },
                ],
              );
            }
          },
        },
      ],
    );
  };

  const onRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    await Promise.all([fetchDriverStatus(), checkActiveOrder(), fetchOrders()]); // 🔴 Added checkActiveOrder
  };

  // In app/(driver)/orders.tsx - Update the updateOrderStatus function

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      // Get order details first for notification
      const { data: orderData } = await supabase
        .from("orders")
        .select(
          `
        order_number,
        customer_id,
        restaurants!orders_restaurant_id_fkey(restaurant_name)
      `,
        )
        .eq("id", orderId)
        .single();

      const { error } = await supabase
        .from("orders")
        .update({
          status: newStatus,
          updated_at: new Date().toISOString(),
          ...(newStatus === "delivered" && {
            actual_delivery_time: new Date().toISOString(),
          }),
        })
        .eq("id", orderId)
        .eq("driver_id", user?.id);

      if (error) throw error;

      // 🔴 Send notification to customer when order is out for delivery
      if (newStatus === "out_for_delivery" && orderData) {
        await supabase.from("user_notifications").insert({
          user_id: orderData.customer_id,
          title: "🚚 Your Order is On The Way!",
          body: `Your order #${orderData.order_number} from ${orderData.restaurants?.restaurant_name || "the restaurant"} has been picked up and is on its way to you.`,
          type: "order",
          data: {
            order_id: orderId,
            order_number: orderData.order_number,
            status: "out_for_delivery",
            action: "track_order",
            screen: `/orders/${orderId}`,
          },
          created_at: new Date().toISOString(),
        });

        // Also send push notification if you have the service
        try {
          await fetch("https://exp.host/--/api/v2/push/send", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              to: userPushToken, // You'll need to get this from your database
              title: "🚚 Your Order is On The Way!",
              body: `Order #${orderData.order_number} has been picked up and is on its way.`,
              data: { orderId, type: "order_update" },
            }),
          });
        } catch (pushError) {
          console.log("Push notification error:", pushError);
        }
      }

      Alert.alert("Success", `Order status updated to ${newStatus}`);

      // If order is delivered, update active order status
      if (newStatus === "delivered") {
        setHasActiveOrder(false);
      }

      fetchOrders();
    } catch (error) {
      console.error("Error updating order:", error);
      Alert.alert("Error", "Failed to update order status");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "ready":
        return "#10B981";
      case "confirmed":
      case "preparing":
        return "#3B82F6";
      case "out_for_delivery":
        return "#FF6B35";
      case "delivered":
        return "#10B981";
      case "cancelled":
        return "#EF4444";
      default:
        return "#6B7280";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case "ready":
        return "checkmark-circle-outline";
      case "confirmed":
      case "preparing":
        return "restaurant-outline";
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

  const formatTime = (dateString: string) => {
    if (!dateString) return "";
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (error) {
      return "";
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "";
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - date.getTime());
      const diffMinutes = Math.floor(diffTime / (1000 * 60));
      const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      if (diffMinutes < 1) return "Just now";
      if (diffMinutes < 60) return `${diffMinutes}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays === 1) return "Yesterday";
      if (diffDays < 7) return `${diffDays}d ago`;

      return date.toLocaleDateString([], { month: "short", day: "numeric" });
    } catch (error) {
      return "";
    }
  };

  const renderOrderItem = ({ item }: { item: Order }) => {
    const isAvailableOrder = selectedFilter === "available";
    const customerName = item.customers?.users?.full_name || "Customer";
    const restaurantName = item.restaurants?.restaurant_name || "Restaurant";
    const restaurantAddress = item.restaurants?.address || "";
    const earnings = (item as any).earnings || (item.delivery_fee || 5) * 0.8;

    return (
      <TouchableOpacity
        style={styles.orderCard}
        onPress={() => router.push(`/(driver)/order-detail/${item.id}`)}
        activeOpacity={0.7}
      >
        <View style={styles.orderHeader}>
          <View style={styles.orderHeaderLeft}>
            <Text style={styles.orderNumber}>#{item.order_number}</Text>
            <Text style={styles.orderCustomer}>{customerName}</Text>
          </View>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: getStatusColor(item.status) + "20" },
            ]}
          >
            <Ionicons
              name={getStatusIcon(item.status) as any}
              size={12}
              color={getStatusColor(item.status)}
            />
            <Text
              style={[
                styles.statusText,
                { color: getStatusColor(item.status) },
              ]}
            >
              {item.status.replace(/_/g, " ")}
            </Text>
          </View>
        </View>

        <View style={styles.orderDetails}>
          <View style={styles.orderDetail}>
            <Ionicons name="restaurant-outline" size={14} color="#6B7280" />
            <Text style={styles.orderDetailText} numberOfLines={1}>
              {restaurantName}
            </Text>
          </View>

          <View style={styles.orderDetail}>
            <Ionicons name="location-outline" size={14} color="#6B7280" />
            <Text style={styles.orderDetailText} numberOfLines={1}>
              {restaurantAddress}
            </Text>
          </View>

          {isAvailableOrder && (item as any).distance && (
            <View style={styles.orderDetail}>
              <Ionicons name="navigate" size={14} color="#3B82F6" />
              <Text style={styles.orderDetailText}>
                {(item as any).distance} km away • {(item as any).eta || "?"}{" "}
                min
              </Text>
            </View>
          )}

          {isAvailableOrder && (item as any).isNearby && (
            <View style={styles.nearbyBadge}>
              <Ionicons name="flash" size={12} color="#FF6B35" />
              <Text style={styles.nearbyText}>Nearby</Text>
            </View>
          )}

          {item.special_instructions && (
            <View style={styles.orderDetail}>
              <Ionicons name="document-text" size={14} color="#6B7280" />
              <Text style={styles.orderDetailText} numberOfLines={1}>
                Note: {item.special_instructions}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.orderMeta}>
          <View style={styles.metaItem}>
            <Ionicons name="time-outline" size={14} color="#6B7280" />
            <Text style={styles.metaText}>{formatDate(item.created_at)}</Text>
          </View>

          <View style={styles.earningsContainer}>
            <Ionicons name="cash-outline" size={14} color="#10B981" />
            <Text style={styles.earningsText}>AED {earnings.toFixed(2)}</Text>
          </View>
        </View>

        {isAvailableOrder && (
          <TouchableOpacity
            style={[
              styles.acceptButton,
              (!isOnline || hasActiveOrder) && styles.acceptButtonDisabled, // 🔴 Disable if has active order
            ]}
            onPress={() => handleAcceptOrder(item.id)}
            disabled={!isOnline || hasActiveOrder} // 🔴 Disable if has active order
          >
            <Ionicons name="checkmark-circle" size={18} color="#fff" />
            <Text style={styles.acceptButtonText}>
              {!isOnline
                ? "Go Online to Accept"
                : hasActiveOrder
                  ? "Complete Current Delivery First"
                  : "Accept Delivery"}
            </Text>
          </TouchableOpacity>
        )}

        {selectedFilter === "active" && (
          <View style={styles.orderActions}>
            {item.status === "ready" && (
              <TouchableOpacity
                style={[styles.actionButton, { borderColor: "#3B82F6" }]}
                onPress={() => updateOrderStatus(item.id, "out_for_delivery")}
              >
                <Ionicons name="bicycle-outline" size={14} color="#3B82F6" />
                <Text style={[styles.actionButtonText, { color: "#3B82F6" }]}>
                  Pick Up
                </Text>
              </TouchableOpacity>
            )}

            {item.status === "out_for_delivery" && (
              <TouchableOpacity
                style={[styles.actionButton, { borderColor: "#10B981" }]}
                onPress={() => updateOrderStatus(item.id, "delivered")}
              >
                <Ionicons name="checkmark-done" size={14} color="#10B981" />
                <Text style={[styles.actionButtonText, { color: "#10B981" }]}>
                  Deliver
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.actionButton, { borderColor: "#E5E7EB" }]}
              onPress={() => router.push(`/(driver)/order-detail/${item.id}`)}
            >
              <Ionicons name="eye-outline" size={14} color="#6B7280" />
              <Text style={[styles.actionButtonText, { color: "#6B7280" }]}>
                Details
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderNewOrderAlert = () => {
    if (!showNewOrderAlert || !latestOrder) return null;

    return (
      <Modal transparent visible={showNewOrderAlert} animationType="slide">
        <View style={styles.alertOverlay}>
          <View style={styles.alertContainer}>
            <View style={styles.alertHeader}>
              <Ionicons name="flash" size={24} color="#FF6B35" />
              <Text style={styles.alertTitle}>New Delivery Available!</Text>
              <TouchableOpacity onPress={dismissAlert}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.alertContent}>
              <Text style={styles.alertRestaurant}>
                {latestOrder.restaurant_name}
              </Text>

              <View style={styles.alertDetails}>
                <View style={styles.alertDetail}>
                  <Ionicons name="location" size={16} color="#6B7280" />
                  <Text style={styles.alertDetailText}>
                    {latestOrder.distance_km
                      ? `${latestOrder.distance_km} km away`
                      : "Distance unknown"}
                  </Text>
                </View>
                <View style={styles.alertDetail}>
                  <Ionicons name="time" size={16} color="#6B7280" />
                  <Text style={styles.alertDetailText}>
                    {latestOrder.estimated_time
                      ? `~${latestOrder.estimated_time} min`
                      : "ETA unknown"}
                  </Text>
                </View>
                <View style={styles.alertDetail}>
                  <Ionicons name="cube" size={16} color="#6B7280" />
                  <Text style={styles.alertDetailText}>
                    {latestOrder.items_count} items
                  </Text>
                </View>
                <View style={styles.alertDetail}>
                  <Ionicons name="cash" size={16} color="#10B981" />
                  <Text style={[styles.alertDetailText, styles.alertEarnings]}>
                    AED {(latestOrder.delivery_fee * 0.8).toFixed(2)} earnings
                  </Text>
                </View>
              </View>

              <View style={styles.alertActions}>
                <TouchableOpacity
                  style={styles.alertDeclineButton}
                  onPress={dismissAlert}
                >
                  <Text style={styles.alertDeclineText}>Decline</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.alertAcceptButton,
                    hasActiveOrder && styles.alertAcceptButtonDisabled, // 🔴 Disable if has active order
                  ]}
                  onPress={() => handleAcceptOrder(latestOrder.id)}
                  disabled={hasActiveOrder} // 🔴 Disable if has active order
                >
                  <Text style={styles.alertAcceptText}>
                    {hasActiveOrder
                      ? "Complete Current Delivery First"
                      : "Accept"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={styles.loadingText}>Loading orders...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Deliveries</Text>
          <Text style={styles.headerSubtitle}>
            {isOnline ? "Online - Ready for deliveries" : "Offline"}
          </Text>
          {/* 🔴 NEW: Show active order indicator */}
          {hasActiveOrder && (
            <View style={styles.activeOrderIndicator}>
              <View style={styles.activeOrderDot} />
              <Text style={styles.activeOrderText}>Active Delivery</Text>
            </View>
          )}
        </View>
        <View style={styles.headerActions}>
          <NotificationBell />
          <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
            <Ionicons
              name="refresh"
              size={18}
              color="#FF6B35"
              style={refreshing && styles.refreshingIcon}
            />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.statusCard}>
        <View style={styles.statusInfo}>
          <View
            style={[
              styles.statusIndicator,
              { backgroundColor: isOnline ? "#10B981" : "#FF6B35" },
            ]}
          />
          <Text style={styles.statusText}>
            {isOnline ? "You are online" : "You are offline"}
          </Text>
          {isOnline && driverLocation && (
            <Text style={styles.locationText}>• Location active</Text>
          )}
        </View>
        <TouchableOpacity
          style={[
            styles.toggleButton,
            isOnline ? styles.toggleButtonOnline : styles.toggleButtonOffline,
          ]}
          onPress={() => router.push("/(driver)/dashboard")}
        >
          <Text style={styles.toggleButtonText}>
            {isOnline ? "Dashboard" : "Go Online"}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.filtersContainer}>
        <FlatList
          data={filters}
          horizontal
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.filterTab,
                selectedFilter === item.id && styles.filterTabActive,
              ]}
              onPress={() => setSelectedFilter(item.id)}
            >
              <Ionicons
                name={item.icon as any}
                size={16}
                color={selectedFilter === item.id ? "#FF6B35" : "#6B7280"}
              />
              <Text
                style={[
                  styles.filterTabText,
                  selectedFilter === item.id && styles.filterTabTextActive,
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

      {orders.length > 0 && (
        <View style={styles.countBanner}>
          <Text style={styles.countText}>
            {orders.length}{" "}
            {selectedFilter === "available" ? "available" : selectedFilter}{" "}
            {orders.length === 1 ? "delivery" : "deliveries"}
          </Text>
          {selectedFilter === "available" && (
            <Text style={styles.countSubtext}>
              {orders.filter((o: any) => o.isNearby).length} nearby • Sorted by
              distance
            </Text>
          )}
        </View>
      )}

      {orders.length === 0 ? (
        <View style={styles.emptyState}>
          <LottieView
            source={animations.driver_empty_state}
            style={styles.emptyStateAnimation}
            autoPlay
            loop={true}
          />
          <Text style={styles.emptyStateTitle}>
            {selectedFilter === "available"
              ? "No deliveries available"
              : `No ${selectedFilter} deliveries`}
          </Text>
          <Text style={styles.emptyStateText}>
            {selectedFilter === "available"
              ? isOnline
                ? hasActiveOrder
                  ? "Complete your current delivery to see new orders"
                  : "Waiting for restaurants to mark orders as ready..."
                : "Go online to see available deliveries"
              : `You don't have any ${selectedFilter} deliveries at the moment`}
          </Text>
          {selectedFilter === "available" && !isOnline && (
            <TouchableOpacity
              style={styles.goOnlineButton}
              onPress={() => router.push("/(driver)/dashboard")}
            >
              <Text style={styles.goOnlineButtonText}>
                Go Online to See Deliveries
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.refreshButtonLarge}
            onPress={onRefresh}
          >
            <Ionicons name="refresh" size={16} color="#FF6B35" />
            <Text style={styles.refreshButtonText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={orders}
          renderItem={renderOrderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.ordersList}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#FF6B35"
              colors={["#FF6B35"]}
            />
          }
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            selectedFilter === "available" && orders.length > 0 ? (
              <View style={styles.listHeader}>
                <Ionicons name="information-circle" size={14} color="#FF6B35" />
                <Text style={styles.listHeaderText}>
                  Nearest deliveries shown first
                </Text>
              </View>
            ) : null
          }
        />
      )}

      {renderNewOrderAlert()}
    </SafeAreaView>
  );
}

// 🔴 PUT YOUR EXISTING STYLES HERE (from your original driver orders screen)
// All your styles from the original file go here

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
    paddingVertical: 14,
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
    gap: 6, // Add some gap between the buttons
  },
  refreshButton: {
    width: 32,
    height: 32,
    borderRadius: 18,
    backgroundColor: "#F9FAFB",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  refreshingIcon: {
    transform: [{ rotate: "360deg" }],
  },
  statusCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  statusInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    flexWrap: "wrap",
    gap: 8,
  },
  statusIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#111827",
    lineHeight: 16,
  },
  locationText: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "500",
  },
  toggleButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    minWidth: 80,
  },
  toggleButtonOnline: {
    backgroundColor: "#FF6B35",
    borderColor: "#FF6B35",
  },
  toggleButtonOffline: {
    backgroundColor: "#10B981",
    borderColor: "#10B981",
  },
  toggleButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 16,
    textAlign: "center",
  },
  filtersContainer: {
    marginTop: 16,
  },
  filtersContent: {
    paddingHorizontal: 14,
  },
  filterTab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: "#f3f4f6",
    gap: 6,
    borderWidth: 0.8,
    borderColor: "#E5E7EB",
  },
  filterTabActive: {
    backgroundColor: "#FFFFFF",
    borderColor: "#FF6B35",
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#6B7280",
  },
  filterTabTextActive: {
    color: "#FF6B35",
    fontWeight: "600",
  },
  countBanner: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  countText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 2,
  },
  countSubtext: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "400",
  },
  ordersList: {
    padding: 16,
    paddingTop: 0,
    paddingBottom: 32,
  },
  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FF6B3510",
    padding: 8,
    borderRadius: 8,
    marginBottom: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  listHeaderText: {
    fontSize: 12,
    color: "#FF6B35",
    fontWeight: "500",
    flex: 1,
  },
  orderCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  orderHeaderLeft: {
    flex: 1,
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 2,
  },
  orderCustomer: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "400",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  statusText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#374151",
    textTransform: "capitalize",
  },
  orderDetails: {
    gap: 8,
    marginBottom: 12,
  },
  orderDetail: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  orderDetailText: {
    fontSize: 12,
    color: "#374151",
    fontWeight: "400",
    flex: 1,
  },
  nearbyBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#FF6B3515",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
    marginTop: 2,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  nearbyText: {
    fontSize: 10,
    color: "#FF6B35",
    fontWeight: "600",
  },
  orderMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "400",
  },
  earningsContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#10B98115",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 6,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  earningsText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#10B981",
  },
  acceptButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FF6B35",
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
    borderWidth: 1,
    borderColor: "#FF6B35",
  },
  acceptButtonDisabled: {
    backgroundColor: "#9CA3AF",
    borderColor: "#9CA3AF",
  },
  acceptButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 16,
  },
  orderActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 16,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingTop: 60,
  },
  emptyStateTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#374151",
    marginTop: 16,
    textAlign: "center",
    marginBottom: 4,
  },
  emptyStateText: {
    fontSize: 12,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 16,
    fontWeight: "400",
  },
  goOnlineButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: "#FF6B35",
    borderRadius: 8,
  },
  goOnlineButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 16,
  },
  refreshButtonLarge: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    gap: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  refreshButtonText: {
    color: "#FF6B35",
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 16,
  },
  emptyStateAnimation: {
    width: 150,
    height: 150,
  },

  alertOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  alertContainer: {
    backgroundColor: "#fff",
    borderRadius: 16,
    width: "90%",
    maxWidth: 400,
    overflow: "hidden",
  },
  alertHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    backgroundColor: "#FF6B3510",
  },
  alertTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    color: "#FF6B35",
    marginLeft: 8,
  },
  alertContent: {
    padding: 20,
  },
  alertRestaurant: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 16,
  },
  alertDetails: {
    gap: 12,
    marginBottom: 24,
  },
  alertDetail: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  alertDetailText: {
    fontSize: 14,
    color: "#374151",
  },
  alertEarnings: {
    color: "#10B981",
    fontWeight: "700",
  },
  alertActions: {
    flexDirection: "row",
    gap: 12,
  },
  alertDeclineButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
  },
  alertDeclineText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6B7280",
  },
  alertAcceptButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: "#FF6B35",
    alignItems: "center",
  },
  alertAcceptText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },

  // 🔴 NEW: Add these styles
  activeOrderIndicator: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  activeOrderDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FF6B35",
    marginRight: 6,
  },
  activeOrderText: {
    fontSize: 11,
    color: "#FF6B35",
    fontWeight: "600",
  },
  alertAcceptButtonDisabled: {
    backgroundColor: "#9CA3AF",
    borderColor: "#9CA3AF",
  },
});
