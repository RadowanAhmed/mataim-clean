// app/(restaurant)/orders/index.tsx - COMPLETE FIXED VERSION
import { useAuth } from "@/backend/AuthContext";
import { DriverOrderMatchingService } from "@/backend/services/DriverOrderMatchingService";
import { EnhancedNotificationService } from "@/backend/services/EnhancedNotificationService";
import { supabase } from "@/backend/supabase";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Linking,
  Modal,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import NotificationBell from "../components/NotificationBell";

interface Order {
  id: string;
  order_number: string;
  customer_id: string;
  driver_id: string | null;
  status: string;
  total_amount: number;
  delivery_fee: number;
  final_amount: number;
  payment_method: string;
  payment_status: string;
  special_instructions: string | null;
  estimated_delivery_time: string | null;
  actual_delivery_time: string | null;
  created_at: string;
  updated_at: string;
  customers: {
    users: {
      full_name: string;
      email: string;
      phone: string | null;
      profile_image_url: string | null;
    };
  } | null;
  delivery_users: any | null;
  restaurants: {
    restaurant_name: string;
    address: string;
    phone: string;
  } | null;
  order_items: {
    id: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    posts: {
      title: string;
      image_url: string | null;
    } | null;
    menu_items: any | null;
  }[];
  post_data?: {
    title: string;
    description?: string;
    image_url: string | null;
  } | null;
}

export default function RestaurantOrdersScreen() {
  const router = useRouter();
  const { user, clearNewOrdersNotification } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTab, setSelectedTab] = useState("pending");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [filterDate, setFilterDate] = useState<string>("");
  const [filterText, setFilterText] = useState<string>("");
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [stats, setStats] = useState({
    pending: 0,
    preparing: 0,
    ready: 0,
    out_for_delivery: 0,
    delivered: 0,
    cancelled: 0,
  });
  const [assigningDriver, setAssigningDriver] = useState<string | null>(null);

  const statusTabs = [
    { key: "all", label: "All", count: orders.length },
    { key: "pending", label: "New", count: stats.pending },
    { key: "preparing", label: "Preparing", count: stats.preparing },
    { key: "ready", label: "Ready", count: stats.ready },
    {
      key: "out_for_delivery",
      label: "Delivery",
      count: stats.out_for_delivery,
    },
    { key: "delivered", label: "Completed", count: stats.delivered },
    { key: "cancelled", label: "Cancelled", count: stats.cancelled },
  ];

  useEffect(() => {
    if (user?.hasNewOrders) {
      clearNewOrdersNotification();
    }
  }, []);

  const fetchOrders = async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const { data: restaurantData, error: restaurantError } = await supabase
        .from("restaurants")
        .select("id")
        .eq("id", user.id)
        .single();

      if (restaurantError) {
        console.error("Error fetching restaurant:", restaurantError);
        Alert.alert("Error", "Restaurant not found");
        setOrders([]);
        return;
      }

      if (!restaurantData) {
        setOrders([]);
        return;
      }

      let query = supabase
        .from("orders")
        .select("*")
        .eq("restaurant_id", restaurantData.id);

      if (selectedTab !== "all") {
        query = query.eq("status", selectedTab);
      }

      if (filterDate) {
        const startDate = new Date(filterDate);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(filterDate);
        endDate.setHours(23, 59, 59, 999);
        query = query
          .gte("created_at", startDate.toISOString())
          .lte("created_at", endDate.toISOString());
      }

      query = query.order("updated_at", { ascending: false });

      const { data: ordersData, error: ordersError } = await query;

      if (ordersError) {
        console.error("Error fetching orders:", ordersError);
        throw ordersError;
      }

      if (!ordersData || ordersData.length === 0) {
        setOrders([]);
        return;
      }

      const customerIds = ordersData
        .map((order) => order.customer_id)
        .filter(Boolean)
        .filter((value, index, self) => self.indexOf(value) === index);

      let customersMap = {};
      if (customerIds.length > 0) {
        const { data: usersData } = await supabase
          .from("users")
          .select("id, full_name, email, phone, profile_image_url")
          .in("id", customerIds);

        usersData?.forEach((user) => {
          customersMap[user.id] = {
            users: {
              full_name: user.full_name,
              email: user.email,
              phone: user.phone,
              profile_image_url: user.profile_image_url,
            },
          };
        });
      }

      const postIds = ordersData
        .map((order) => order.post_id)
        .filter(Boolean)
        .filter((value, index, self) => self.indexOf(value) === index);

      let postsMap = {};
      if (postIds.length > 0) {
        const { data: postsData } = await supabase
          .from("posts")
          .select("id, title, description, image_url")
          .in("id", postIds);

        postsData?.forEach((post) => {
          postsMap[post.id] = {
            title: post.title,
            description: post.description,
            image_url: post.image_url,
          };
        });
      }

      const orderIds = ordersData.map((order) => order.id);
      let orderItemsMap = {};
      if (orderIds.length > 0) {
        const { data: itemsData } = await supabase
          .from("order_items")
          .select(
            `
          id,
          order_id,
          menu_item_id,
          post_id,
          quantity,
          unit_price,
          total_price,
          special_instructions,
          item_name,
          item_description,
          item_price,
          item_image_url,
          posts:post_id (
            title,
            description,
            image_url
          ),
          menu_items:menu_item_id (
            id,
            name,
            description,
            image_url,
            price
          )
        `,
          )
          .in("order_id", orderIds);

        itemsData?.forEach((item) => {
          if (!orderItemsMap[item.order_id]) {
            orderItemsMap[item.order_id] = [];
          }
          if (item.item_name) {
            orderItemsMap[item.order_id].push({
              ...item,
              posts: null,
              menu_items: {
                name: item.item_name,
                description: item.item_description,
                image_url: item.item_image_url,
                price: item.item_price,
              },
            });
          } else {
            orderItemsMap[item.order_id].push({
              ...item,
              posts: item.posts || null,
              menu_items: item.menu_items || null,
            });
          }
        });
      }

      const { data: restaurantInfo } = await supabase
        .from("restaurants")
        .select("restaurant_name, address, phone")
        .eq("id", restaurantData.id)
        .single();

      const ordersWithDetails: Order[] = ordersData.map((order) => {
        const orderPost = order.post_id ? postsMap[order.post_id] : null;
        return {
          id: order.id,
          order_number: order.order_number || `ORD-${order.id.slice(0, 8)}`,
          customer_id: order.customer_id,
          driver_id: order.driver_id,
          status: order.status,
          total_amount: parseFloat(order.total_amount) || 0,
          delivery_fee: parseFloat(order.delivery_fee) || 0,
          final_amount: parseFloat(order.final_amount) || 0,
          payment_method: order.payment_method,
          payment_status: order.payment_status,
          special_instructions: order.special_instructions,
          estimated_delivery_time: order.estimated_delivery_time,
          actual_delivery_time: order.actual_delivery_time,
          created_at: order.created_at,
          updated_at: order.updated_at,
          customers: customersMap[order.customer_id] || null,
          delivery_users: null,
          restaurants: restaurantInfo
            ? {
                restaurant_name: restaurantInfo.restaurant_name,
                address: restaurantInfo.address,
                phone: restaurantInfo.phone,
              }
            : null,
          order_items: orderItemsMap[order.id] || [],
          post_data: orderPost,
        };
      });

      setOrders(ordersWithDetails);
    } catch (error) {
      console.error("Error fetching orders:", error);
      Alert.alert("Error", "Failed to load orders");
      setOrders([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchStats = async () => {
    if (!user?.id) return;
    try {
      const { data: restaurantData } = await supabase
        .from("restaurants")
        .select("id")
        .eq("id", user.id)
        .single();

      if (!restaurantData) return;

      const { data: statsData } = await supabase
        .from("orders")
        .select("status")
        .eq("restaurant_id", restaurantData.id);

      if (statsData) {
        const counts = {
          pending: 0,
          preparing: 0,
          ready: 0,
          out_for_delivery: 0,
          delivered: 0,
          cancelled: 0,
        };

        statsData.forEach((order) => {
          if (counts[order.status as keyof typeof counts] !== undefined) {
            counts[order.status as keyof typeof counts]++;
          }
        });

        setStats(counts);
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchOrders();
      fetchStats();
    }, [user?.id, selectedTab, filterText, filterDate]),
  );

  // 🔴 PLACE THIS CODE IN THE RETURN WHERE SHOWN BELOW
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`restaurant-orders-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `restaurant_id=eq.${user.id}`,
        },
        (payload) => {
          if (
            payload.old.driver_id !== payload.new.driver_id &&
            payload.new.driver_id
          ) {
            Alert.alert(
              "✅ Driver Assigned!",
              `A driver has been assigned to order #${payload.new.order_number}. They will arrive shortly.`,
              [
                {
                  text: "View Order",
                  onPress: () =>
                    router.push(`/(restaurant)/orders/${payload.new.id}`),
                },
              ],
            );
            fetchOrders();
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchOrders();
    fetchStats();
  };

  const handleOrderPress = (order: Order) => {
    setSelectedOrder(order);
    setModalVisible(true);
  };

  // Update the handleStatusChange function - MODIFY THIS SECTION
  const handleStatusChange = async (orderId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("orders")
        .update({
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId);

      if (error) throw error;

      await EnhancedNotificationService.sendOrderStatusNotification(
        orderId,
        newStatus,
      );

      // If status changed to "ready", broadcast to drivers
      if (newStatus === "ready") {
        setAssigningDriver(orderId);

        Alert.alert(
          "Finding Driver",
          "Looking for available drivers nearby...",
          [],
          { cancelable: false },
        );

        const broadcastResult =
          await DriverOrderMatchingService.broadcastAvailableOrder(orderId);

        if (broadcastResult) {
          Alert.alert(
            "Driver Search Started",
            "We've notified nearby drivers about this order. They have 5 minutes to accept.",
            [{ text: "OK" }],
          );
        } else {
          Alert.alert(
            "No Drivers Available",
            "There are no drivers online at the moment. The order will remain in 'ready' status.",
            [{ text: "OK" }],
          );
        }

        setAssigningDriver(null);
      }

      Alert.alert("Success", `Order status updated to ${newStatus}`);

      setModalVisible(false);
      setSelectedOrder(null);

      // REMOVE THIS - Don't automatically set to out_for_delivery
      // if (newStatus === "out_for_delivery") {
      //   const updatedOrder = orders.find((order) => order.id === orderId);
      //   if (updatedOrder) {
      //     router.push(`/(restaurant)/orders/${orderId}`);
      //     return;
      //   }
      // }

      fetchOrders();
      fetchStats();
    } catch (error) {
      console.error("Error updating order status:", error);
      Alert.alert("Error", "Failed to update order status");
    }
  };

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
        return "#EC4899";
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diff / (1000 * 60));
    const diffHours = Math.floor(diff / (1000 * 60 * 60));
    const diffDays = Math.floor(diff / (1000 * 60 * 60 * 24));

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

  const calculatePreparationTime = (order: Order) => {
    const created = new Date(order.created_at);
    const now = new Date();
    const diffMinutes = Math.floor(
      (now.getTime() - created.getTime()) / (1000 * 60),
    );
    return diffMinutes;
  };

  const renderOrderItem = ({ item }: { item: Order }) => {
    const prepTime = calculatePreparationTime(item);
    const totalItems = item.order_items.reduce(
      (sum, orderItem) => sum + (orderItem.quantity || 1),
      0,
    );
    const customerName = item.customers?.users?.full_name || "Customer";

    let postData = item.post_data;
    let itemName = "Order";
    let itemImage = null;

    if (!postData && item.order_items.length > 0) {
      const firstItem = item.order_items[0];
      postData = firstItem.posts;
    }

    if (postData) {
      itemName = postData.title || "Order";
      itemImage = postData.image_url;
    } else if (item.order_items.length > 0) {
      itemName = `${totalItems} item${totalItems !== 1 ? "s" : ""}`;
    }

    return (
      <TouchableOpacity
        style={styles.orderCard}
        onPress={() => handleOrderPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.orderHeader}>
          <View>
            <Text style={styles.orderNumber}>#{item.order_number}</Text>
            <Text style={styles.customerName}>{customerName}</Text>
          </View>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: getStatusColor(item.status) + "20" },
            ]}
          >
            <Ionicons
              name={getStatusIcon(item.status)}
              size={12}
              color={getStatusColor(item.status)}
            />
            <Text
              style={[
                styles.statusText,
                { color: getStatusColor(item.status) },
              ]}
            >
              {item.status.replace(/_/g, " ").toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={styles.orderDetails}>
          <View style={styles.itemPreviewRow}>
            {itemImage ? (
              <Image
                source={{ uri: itemImage }}
                style={styles.itemPreviewImage}
                resizeMode="cover"
              />
            ) : (
              <View
                style={[
                  styles.itemPreviewImage,
                  styles.itemPreviewImagePlaceholder,
                ]}
              >
                <Ionicons name="fast-food-outline" size={16} color="#9CA3AF" />
              </View>
            )}
            <View style={styles.itemPreviewInfo}>
              <Text style={styles.itemName} numberOfLines={1}>
                {itemName}
              </Text>
              <Text style={styles.itemCount}>
                {totalItems} item{totalItems !== 1 ? "s" : ""}
              </Text>
              {postData?.description && (
                <Text style={styles.itemDescription} numberOfLines={1}>
                  {postData.description}
                </Text>
              )}
            </View>
          </View>

          <View style={styles.detailRow}>
            <Ionicons name="time-outline" size={14} color="#6B7280" />
            <Text style={styles.detailText}>
              {formatDate(item.created_at)} • {prepTime} min
            </Text>
          </View>

          {item.special_instructions && (
            <View style={styles.detailRow}>
              <Ionicons name="chatbubble-outline" size={14} color="#6B7280" />
              <Text style={styles.detailText} numberOfLines={1}>
                {item.special_instructions}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.orderFooter}>
          <Text style={styles.orderTotal}>
            AED {item.final_amount.toFixed(2)}
          </Text>
          <View style={styles.paymentBadge}>
            <Ionicons
              name={item.payment_method === "cash" ? "cash" : "card"}
              size={12}
              color="#6B7280"
            />
            <Text style={styles.paymentText}>
              {item.payment_method === "cash" ? "Cash" : "Card"} •{" "}
              {item.payment_status}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderOrderModal = () => {
    if (!selectedOrder) return null;

    const totalItems = selectedOrder.order_items.reduce(
      (sum, orderItem) => sum + orderItem.quantity,
      0,
    );
    const prepTime = calculatePreparationTime(selectedOrder);
    const customerName =
      selectedOrder.customers?.users?.full_name || "Customer";
    const customerEmail = selectedOrder.customers?.users?.email || "";
    const customerPhone = selectedOrder.customers?.users?.phone || "";
    const driverName = selectedOrder.delivery_users?.users?.full_name;
    const driverVehicle = selectedOrder.delivery_users?.vehicle_type;

    return (
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Order Details</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalBody}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.modalOrderHeader}>
                <View>
                  <Text style={styles.modalOrderNumber}>
                    #{selectedOrder.order_number}
                  </Text>
                  <View style={styles.prepTimeContainer}>
                    <Ionicons name="time-outline" size={14} color="#6B7280" />
                    <Text style={styles.prepTimeText}>
                      Preparation time: {prepTime} min
                    </Text>
                  </View>
                </View>
                <View
                  style={[
                    styles.modalStatusBadge,
                    {
                      backgroundColor:
                        getStatusColor(selectedOrder.status) + "20",
                    },
                  ]}
                >
                  <Ionicons
                    name={getStatusIcon(selectedOrder.status)}
                    size={14}
                    color={getStatusColor(selectedOrder.status)}
                  />
                  <Text
                    style={[
                      styles.modalStatusText,
                      { color: getStatusColor(selectedOrder.status) },
                    ]}
                  >
                    {selectedOrder.status.replace(/_/g, " ").toUpperCase()}
                  </Text>
                </View>
              </View>

              <View style={styles.modalSection}>
                <Text style={styles.sectionTitle}>Customer Information</Text>
                <View style={styles.customerInfoWithImage}>
                  <View style={styles.customerImageContainer}>
                    {selectedOrder.customers?.users?.profile_image_url ? (
                      <Image
                        source={{
                          uri: selectedOrder.customers.users.profile_image_url,
                        }}
                        style={styles.customerImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <View
                        style={[
                          styles.customerImage,
                          styles.customerImagePlaceholder,
                        ]}
                      >
                        <Text style={styles.customerImageText}>
                          {customerName.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.customerDetails}>
                    <Text style={styles.customerName}>{customerName}</Text>

                    {customerEmail && (
                      <View style={styles.customerDetailRow}>
                        <Ionicons
                          name="mail-outline"
                          size={14}
                          color="#6B7280"
                        />
                        <Text style={styles.customerDetailText}>
                          {customerEmail}
                        </Text>
                      </View>
                    )}

                    {customerPhone && (
                      <View style={styles.customerDetailRow}>
                        <Ionicons
                          name="call-outline"
                          size={14}
                          color="#6B7280"
                        />
                        <Text style={styles.customerDetailText}>
                          {customerPhone}
                        </Text>
                        <TouchableOpacity
                          style={styles.callButton}
                          onPress={() => {
                            if (customerPhone) {
                              Linking.openURL(`tel:${customerPhone}`);
                            }
                          }}
                        >
                          <Ionicons name="call" size={14} color="#3B82F6" />
                        </TouchableOpacity>
                      </View>
                    )}

                    <View style={styles.customerStats}>
                      <View style={styles.customerStat}>
                        <Ionicons
                          name="receipt-outline"
                          size={12}
                          color="#6B7280"
                        />
                        <Text style={styles.customerStatText}>
                          Regular customer
                        </Text>
                      </View>
                      {selectedOrder.customers?.users?.profile_image_url && (
                        <TouchableOpacity
                          style={styles.viewProfileButton}
                          onPress={() => {
                            router.push(
                              `/(restaurant)/customers/${selectedOrder.customer_id}`,
                            );
                          }}
                        >
                          <Text style={styles.viewProfileText}>
                            View Profile
                          </Text>
                          <Ionicons
                            name="chevron-forward"
                            size={12}
                            color="#3B82F6"
                          />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </View>
              </View>

              {driverName && (
                <View style={styles.modalSection}>
                  <Text style={styles.sectionTitle}>Delivery Driver</Text>
                  <View style={styles.driverInfo}>
                    <Text style={styles.driverName}>{driverName}</Text>
                    {driverVehicle && (
                      <Text style={styles.driverDetail}>
                        <Ionicons
                          name="car-outline"
                          size={12}
                          color="#6B7280"
                        />{" "}
                        {driverVehicle}
                      </Text>
                    )}
                  </View>
                </View>
              )}

              <View style={styles.modalSection}>
                <Text style={styles.sectionTitle}>
                  Order Items ({totalItems})
                </Text>
                {selectedOrder.order_items.map((item, index) => {
                  const itemName =
                    item.posts?.title ||
                    item.menu_items?.name ||
                    `Item ${index + 1}`;
                  const itemImage =
                    item.posts?.image_url || item.menu_items?.image_url;
                  const itemDescription =
                    item.posts?.description ||
                    item.menu_items?.description ||
                    "";

                  return (
                    <View key={item.id} style={styles.orderItemRowWithImage}>
                      <View style={styles.orderItemImageContainer}>
                        {itemImage ? (
                          <Image
                            source={{ uri: itemImage }}
                            style={styles.orderItemImage}
                            resizeMode="cover"
                          />
                        ) : (
                          <View
                            style={[
                              styles.orderItemImage,
                              styles.orderItemImagePlaceholder,
                            ]}
                          >
                            <Ionicons
                              name="fast-food-outline"
                              size={16}
                              color="#9CA3AF"
                            />
                          </View>
                        )}
                      </View>

                      <View style={styles.orderItemInfo}>
                        <Text style={styles.itemName}>{itemName}</Text>
                        <Text style={styles.itemDescriptionModal}>
                          {itemDescription}
                        </Text>
                        <Text style={styles.itemDetails}>
                          {item.quantity} × AED {item.unit_price.toFixed(2)}
                        </Text>
                      </View>

                      <Text style={styles.itemTotal}>
                        AED{" "}
                        {(
                          (item.quantity || 1) * (item.unit_price || 0)
                        ).toFixed(2)}
                      </Text>
                    </View>
                  );
                })}
              </View>

              {selectedOrder.special_instructions && (
                <View style={styles.modalSection}>
                  <Text style={styles.sectionTitle}>Special Instructions</Text>
                  <Text style={styles.instructionsText}>
                    {selectedOrder.special_instructions}
                  </Text>
                </View>
              )}

              <View style={styles.modalSection}>
                <Text style={styles.sectionTitle}>Order Timeline</Text>
                <View style={styles.timeline}>
                  <View style={styles.timelineItem}>
                    <View style={styles.timelineDot} />
                    <Text style={styles.timelineText}>Order placed</Text>
                    <Text style={styles.timelineTime}>
                      {formatDate(selectedOrder.created_at)}
                    </Text>
                  </View>

                  <View style={styles.timelineItem}>
                    <View
                      style={[
                        styles.timelineDot,
                        { backgroundColor: "#FF6B35" },
                      ]}
                    />
                    <Text style={styles.timelineText}>Preparation time</Text>
                    <Text style={styles.timelineTime}>{prepTime} minutes</Text>
                  </View>

                  {selectedOrder.estimated_delivery_time && (
                    <View style={styles.timelineItem}>
                      <View style={styles.timelineDot} />
                      <Text style={styles.timelineText}>
                        Estimated delivery
                      </Text>
                      <Text style={styles.timelineTime}>
                        {new Date(
                          selectedOrder.estimated_delivery_time,
                        ).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </Text>
                    </View>
                  )}
                  {selectedOrder.actual_delivery_time && (
                    <View style={styles.timelineItem}>
                      <View
                        style={[
                          styles.timelineDot,
                          { backgroundColor: "#10B981" },
                        ]}
                      />
                      <Text style={styles.timelineText}>Delivered</Text>
                      <Text style={styles.timelineTime}>
                        {formatDate(selectedOrder.actual_delivery_time)}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              <View style={styles.modalSection}>
                <Text style={styles.sectionTitle}>Order Summary</Text>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Subtotal</Text>
                  <Text style={styles.summaryValue}>
                    AED {selectedOrder.total_amount.toFixed(2)}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Delivery Fee</Text>
                  <Text style={styles.summaryValue}>
                    AED {selectedOrder.delivery_fee.toFixed(2)}
                  </Text>
                </View>
                <View style={[styles.summaryRow, styles.totalRow]}>
                  <Text style={styles.totalLabel}>Total</Text>
                  <Text style={styles.totalValue}>
                    AED {selectedOrder.final_amount.toFixed(2)}
                  </Text>
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              {selectedOrder.status === "pending" && (
                <>
                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      { backgroundColor: "#EF4444" },
                    ]}
                    onPress={() =>
                      handleStatusChange(selectedOrder.id, "cancelled")
                    }
                  >
                    <Ionicons name="close-circle" size={18} color="#fff" />
                    <Text style={styles.actionButtonText}>Cancel Order</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      { backgroundColor: "#10B981" },
                    ]}
                    onPress={() =>
                      handleStatusChange(selectedOrder.id, "confirmed")
                    }
                  >
                    <Ionicons name="checkmark-circle" size={18} color="#fff" />
                    <Text style={styles.actionButtonText}>Confirm Order</Text>
                  </TouchableOpacity>
                </>
              )}
              {selectedOrder.status === "confirmed" && (
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: "#8B5CF6" }]}
                  onPress={() =>
                    handleStatusChange(selectedOrder.id, "preparing")
                  }
                >
                  <Ionicons name="restaurant" size={18} color="#fff" />
                  <Text style={styles.actionButtonText}>Start Preparing</Text>
                </TouchableOpacity>
              )}
              {selectedOrder.status === "preparing" && (
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: "#10B981" }]}
                  onPress={() => handleStatusChange(selectedOrder.id, "ready")}
                  // 🔴 ADD THIS loading state for assigningDriver
                  disabled={assigningDriver === selectedOrder.id}
                >
                  {assigningDriver === selectedOrder.id ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-done" size={18} color="#fff" />
                      <Text style={styles.actionButtonText}>Mark as Ready</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              {selectedOrder.status === "ready" && (
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: "#3B82F6" }]}
                  onPress={() => {
                    // 🔴 FIX: Call broadcast directly instead of status change
                    setModalVisible(false);
                    setSelectedOrder(null);

                    Alert.alert(
                      "Find Driver",
                      "Looking for available drivers for this order?",
                      [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Find Driver",
                          onPress: async () => {
                            setAssigningDriver(orderId);

                            Alert.alert(
                              "Finding Driver",
                              "Searching for nearby drivers...",
                              [],
                              { cancelable: false },
                            );

                            const broadcastResult =
                              await DriverOrderMatchingService.broadcastAvailableOrder(
                                orderId,
                              );

                            if (broadcastResult) {
                              Alert.alert(
                                "✅ Driver Search Started",
                                "Drivers have been notified. They have 5 minutes to accept.",
                                [{ text: "OK" }],
                              );
                            } else {
                              Alert.alert(
                                "⚠️ No Drivers Available",
                                "No drivers are online at the moment. The order will stay ready for pickup.",
                                [{ text: "OK" }],
                              );
                            }

                            setAssigningDriver(null);
                          },
                        },
                      ],
                    );
                  }}
                >
                  <Ionicons name="bicycle" size={18} color="#fff" />
                  <Text style={styles.actionButtonText}>Find Driver</Text>
                </TouchableOpacity>
              )}
              {selectedOrder.status === "out_for_delivery" && (
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: "#3B82F6" }]}
                  onPress={() => {
                    setModalVisible(false);
                    setSelectedOrder(null);
                    router.push(`/(restaurant)/orders/${selectedOrder.id}`);
                  }}
                >
                  <Ionicons name="document-text" size={18} color="#fff" />
                  <Text style={styles.actionButtonText}>
                    View Order Details
                  </Text>
                </TouchableOpacity>
              )}
              {selectedOrder.status === "delivered" && (
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: "#3B82F6" }]}
                  onPress={() => {
                    setModalVisible(false);
                    setSelectedOrder(null);
                    router.push(`/(restaurant)/orders/${selectedOrder.id}`);
                  }}
                >
                  <Ionicons name="document-text" size={18} color="#fff" />
                  <Text style={styles.actionButtonText}>
                    View Order Details
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Orders</Text>
          <Text style={styles.headerSubtitle}>Manage and track all orders</Text>
        </View>
        <View style={styles.headerActions}>
          <NotificationBell />
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => {
              Alert.alert("Filter Options", "Choose filter options", [
                {
                  text: "Clear All",
                  onPress: () => {
                    setFilterText("");
                    setFilterDate("");
                    setActiveFilters([]);
                    setSelectedTab("pending");
                  },
                  style: "destructive",
                },
                {
                  text: "Today's Orders",
                  onPress: () => {
                    const today = new Date().toISOString().split("T")[0];
                    setFilterDate(today);
                    setSelectedTab("pending");
                    if (!activeFilters.includes("date")) {
                      setActiveFilters([...activeFilters, "date"]);
                    }
                  },
                },
                {
                  text: "All Orders Today",
                  onPress: () => {
                    const today = new Date().toISOString().split("T")[0];
                    setFilterDate(today);
                    setSelectedTab("pending");
                    if (!activeFilters.includes("date")) {
                      setActiveFilters([...activeFilters, "date"]);
                    }
                  },
                },
                {
                  text: "Cancel",
                  style: "cancel",
                },
              ]);
            }}
          >
            <Ionicons
              name={activeFilters.length > 0 ? "filter" : "filter-outline"}
              size={20}
              color={activeFilters.length > 0 ? "#FF6B35" : "#6B7280"}
            />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color="#9CA3AF" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by order number or customer name..."
          placeholderTextColor="#9CA3AF"
          value={filterText}
          onChangeText={setFilterText}
          clearButtonMode="while-editing"
        />
        {filterText.length > 0 && (
          <TouchableOpacity onPress={() => setFilterText("")}>
            <Ionicons name="close-circle" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        )}
      </View>

      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabsContainer}
          contentContainerStyle={styles.tabsContent}
        >
          {statusTabs.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, selectedTab === tab.key && styles.tabActive]}
              onPress={() => setSelectedTab(tab.key)}
            >
              <Text
                style={[
                  styles.tabText,
                  selectedTab === tab.key && styles.tabTextActive,
                ]}
              >
                {tab.label}
              </Text>
              {tab.count > 0 && (
                <View
                  style={[
                    styles.tabBadge,
                    selectedTab === tab.key && styles.tabBadgeActive,
                  ]}
                >
                  <Text style={styles.tabBadgeText}>{tab.count}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {activeFilters.length > 0 && (
        <View style={styles.activeFiltersContainer}>
          <Text style={styles.activeFiltersTitle}>Active Filters:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {filterDate && (
              <View style={styles.filterChip}>
                <Text style={styles.filterChipText}>
                  Date: {new Date(filterDate).toLocaleDateString()}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setFilterDate("");
                    setActiveFilters(activeFilters.filter((f) => f !== "date"));
                  }}
                >
                  <Ionicons name="close" size={14} color="#6B7280" />
                </TouchableOpacity>
              </View>
            )}
            {filterText && (
              <View style={styles.filterChip}>
                <Text style={styles.filterChipText}>Search: {filterText}</Text>
                <TouchableOpacity onPress={() => setFilterText("")}>
                  <Ionicons name="close" size={14} color="#6B7280" />
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6B35" />
          <Text style={styles.loadingText}>Loading orders...</Text>
        </View>
      ) : orders.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="receipt-outline" size={64} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>No orders found</Text>
          <Text style={styles.emptySubtitle}>
            {selectedTab === "all"
              ? "You don't have any orders yet"
              : `No ${selectedTab} orders at the moment`}
          </Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => {
              setSelectedTab("all");
              fetchOrders();
            }}
          >
            <Text style={styles.emptyButtonText}>View All Orders</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={orders}
          renderItem={renderOrderItem}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={["#FF6B35"]}
              tintColor="#FF6B35"
            />
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        />
      )}

      {renderOrderModal()}
    </SafeAreaView>
  );
}

// 🔴 PUT YOUR EXISTING STYLES HERE (they're too long to repeat)
// All your styles from the original file go here

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    marginBottom: -22,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: "#fff",
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#111827",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 2,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  filterButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 0.2,
    borderColor: "#6B7280",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 0.4,
    borderColor: "#6B7280",
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 14,
    paddingHorizontal: 8,
    color: "#111827",
  },
  tabsContainer: {
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    paddingHorizontal: 16,
  },
  tabsContent: {
    paddingVertical: 12,
    gap: 8,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    gap: 4,
    borderWidth: 1,
    borderColor: "#F9FAFB",
  },
  tabActive: {
    backgroundColor: "#FF6B35",
  },
  tabText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6B7280",
  },
  tabTextActive: {
    color: "#fff",
  },
  tabBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#E5E7EB",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  tabBadgeActive: {
    backgroundColor: "#fff",
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6B7280",
  },
  activeFiltersContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#F9FAFB",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  activeFiltersTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 6,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginRight: 8,
    gap: 6,
  },
  filterChipText: {
    fontSize: 12,
    color: "#4B5563",
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
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
    backgroundColor: "#fff",
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginTop: 16,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 24,
  },
  emptyButton: {
    backgroundColor: "#FF6B35",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  orderCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginVertical: 6,
    borderWidth: 0.4,
    borderColor: "#F3F3F3",
    elevation: 1,
  },
  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 2,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  orderDetails: {
    gap: 6,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  detailText: {
    fontSize: 13,
    color: "#6B7280",
    flex: 1,
  },
  orderFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  orderTotal: {
    fontSize: 16,
    fontWeight: "800",
    color: "#FF6B35",
  },
  paymentBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
    borderColor: "#6B7280",
    borderWidth: 0.1,
  },
  paymentText: {
    fontSize: 11,
    color: "#6B7280",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  modalBody: {
    padding: 16,
  },
  modalOrderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalOrderNumber: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
  },
  modalStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  modalStatusText: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  modalSection: {
    marginBottom: 22,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  customerInfo: {
    backgroundColor: "#F9FAFB",
    padding: 12,
    borderRadius: 8,
  },
  customerName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  customerDetail: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 4,
  },
  driverInfo: {
    backgroundColor: "#F0F9FF",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E0F2FE",
  },
  driverName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0369A1",
    marginBottom: 4,
  },
  driverDetail: {
    fontSize: 13,
    color: "#0C4A6E",
    marginTop: 4,
  },
  orderItemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  orderItemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 2,
  },
  itemDetails: {
    fontSize: 12,
    color: "#6B7280",
  },
  itemTotal: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  instructionsText: {
    fontSize: 14,
    color: "#4B5563",
    lineHeight: 20,
    backgroundColor: "#F9FAFB",
    padding: 12,
    borderRadius: 8,
  },
  timeline: {
    marginLeft: 8,
  },
  timelineItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#3B82F6",
    marginRight: 12,
    marginLeft: -4,
  },
  timelineText: {
    fontSize: 13,
    color: "#4B5563",
    flex: 1,
  },
  timelineTime: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: "#6B7280",
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    marginTop: 8,
    paddingTop: 12,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  totalValue: {
    fontSize: 20,
    fontWeight: "800",
    color: "#FF6B35",
  },
  modalActions: {
    flexDirection: "row",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 10,
  },
  actionButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },

  itemPreviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },

  itemPreviewImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
  },

  itemPreviewImagePlaceholder: {
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  itemPreviewInfo: {
    flex: 1,
  },

  itemCount: {
    fontSize: 12,
    color: "#6B7280",
  },

  itemDescription: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 2,
  },

  orderItemRowWithImage: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    gap: 12,
  },

  orderItemImageContainer: {
    width: 50,
    height: 50,
  },

  orderItemImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
  },

  orderItemImagePlaceholder: {
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  // Add these styles to your StyleSheet:

  customerInfoWithImage: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#F9FAFB",
    padding: 12,
    borderRadius: 8,
    gap: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  customerImageContainer: {
    width: 60,
    height: 60,
  },

  customerImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#F3F4F6",
  },

  customerImagePlaceholder: {
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FF6B3510",
  },

  customerImageText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FF6B35",
  },

  customerDetails: {
    flex: 1,
    gap: 0,
  },

  customerDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 0,
  },

  customerDetailText: {
    fontSize: 14,
    color: "#4B5563",
    flex: 1,
  },

  callButton: {
    padding: 6,
    backgroundColor: "#3B82F610",
    borderRadius: 20,
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#3B82F620",
  },

  customerStats: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },

  customerStat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },

  customerStatText: {
    fontSize: 12,
    color: "#6B7280",
  },

  viewProfileButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#3B82F610",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#3B82F620",
  },

  viewProfileText: {
    fontSize: 11,
    color: "#3B82F6",
    fontWeight: "600",
  },

  itemDescriptionModal: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },

  prepTimeContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  prepTimeText: {
    fontSize: 13,
    color: "#6B7280",
  },
});
