// app/(restaurant)/customers/[id].tsx
import { useAuth } from "@/backend/AuthContext";
import { supabase } from "@/backend/supabase";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Linking,
  Modal,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface CustomerProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  profile_image_url: string | null;
  country_code: string;
  is_verified: boolean;
  created_at: string;
  last_login: string | null;
}

interface CustomerStats {
  total_orders: number;
  total_spent: number;
  average_order_value: number;
  favorite_items: any[];
  favorite_cuisines: string[];
  first_order_date: string | null;
  last_order_date: string | null;
  orders_by_status: {
    completed: number;
    cancelled: number;
    pending: number;
  };
}

interface Order {
  id: string;
  order_number: string;
  status: string;
  total_amount: number;
  delivery_fee: number;
  final_amount: number;
  created_at: string;
  estimated_delivery_time: string | null;
  actual_delivery_time: string | null;
  payment_method: string;
  payment_status: string;
  restaurants: {
    restaurant_name: string;
    restaurant_rating: number;
    image_url: string | null;
  } | null;
  order_items: {
    id: string;
    quantity: number;
    unit_price: number;
    item_name: string | null;
    item_image_url: string | null;
    menu_items?: {
      name: string;
      image_url: string | null;
    } | null;
    posts?: {
      title: string;
      image_url: string | null;
    } | null;
  }[];
}

interface Address {
  id: string;
  label: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string | null;
  country: string;
  postal_code: string | null;
  is_default: boolean;
}

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  order_id: string | null;
  restaurants: {
    restaurant_name: string;
    id: string;
  } | null;
}

export default function RestaurantCustomerProfileScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();

  const [customer, setCustomer] = useState<CustomerProfile | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState<CustomerStats | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "overview" | "orders" | "reviews" | "addresses"
  >("overview");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
  const [addressModalVisible, setAddressModalVisible] = useState(false);

  useEffect(() => {
    if (id) {
      fetchCustomerData();
    }
  }, [id]);

  const fetchCustomerData = async () => {
    try {
      setLoading(true);

      // Fetch customer profile
      const { data: customerData, error: customerError } = await supabase
        .from("users")
        .select(
          `
          id,
          full_name,
          email,
          phone,
          profile_image_url,
          country_code,
          is_verified,
          created_at,
          last_login
        `,
        )
        .eq("id", id)
        .single();

      if (customerError) throw customerError;
      setCustomer(customerData);

      // Fetch customer addresses
      const { data: addressesData, error: addressesError } = await supabase
        .from("addresses")
        .select("*")
        .eq("user_id", id)
        .order("is_default", { ascending: false });

      if (!addressesError) {
        setAddresses(addressesData || []);
      }

      // Fetch customer orders
      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select(
          `
          *,
          restaurants (
            restaurant_name,
            restaurant_rating,
            image_url
          ),
          order_items (
            id,
            quantity,
            unit_price,
            item_name,
            item_image_url,
            menu_items (
              name,
              image_url
            ),
            posts (
              title,
              image_url
            )
          )
        `,
        )
        .eq("customer_id", id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (!ordersError) {
        setOrders(ordersData || []);
      }

      // Fetch customer reviews
      const { data: reviewsData, error: reviewsError } = await supabase
        .from("reviews")
        .select(
          `
          *,
          restaurants (
            id,
            restaurant_name
          )
        `,
        )
        .eq("customer_id", id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (!reviewsError) {
        setReviews(reviewsData || []);
      }

      // Calculate customer stats
      if (ordersData) {
        const completedOrders = ordersData.filter(
          (o) => o.status === "delivered",
        );
        const cancelledOrders = ordersData.filter(
          (o) => o.status === "cancelled",
        );
        const pendingOrders = ordersData.filter((o) =>
          [
            "pending",
            "confirmed",
            "preparing",
            "ready",
            "out_for_delivery",
          ].includes(o.status),
        );

        const totalSpent = completedOrders.reduce(
          (sum, order) => sum + (order.final_amount || 0),
          0,
        );

        // Extract favorite items
        const itemFrequency: Record<
          string,
          { name: string; count: number; image: string | null }
        > = {};
        ordersData.forEach((order) => {
          order.order_items?.forEach((item: any) => {
            const itemName =
              item.item_name ||
              item.menu_items?.name ||
              item.posts?.title ||
              `Item ${item.id.substring(0, 4)}`;
            const itemImage =
              item.item_image_url ||
              item.menu_items?.image_url ||
              item.posts?.image_url;

            if (!itemFrequency[itemName]) {
              itemFrequency[itemName] = {
                name: itemName,
                count: 0,
                image: itemImage,
              };
            }
            itemFrequency[itemName].count += item.quantity || 1;
          });
        });

        const favoriteItems = Object.values(itemFrequency)
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        // Extract favorite cuisines
        const cuisineFrequency: Record<string, number> = {};
        ordersData.forEach((order) => {
          if (order.restaurants?.cuisine_type) {
            cuisineFrequency[order.restaurants.cuisine_type] =
              (cuisineFrequency[order.restaurants.cuisine_type] || 0) + 1;
          }
        });

        const favoriteCuisines = Object.entries(cuisineFrequency)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 3)
          .map(([cuisine]) => cuisine);

        setStats({
          total_orders: ordersData.length,
          total_spent: totalSpent,
          average_order_value:
            completedOrders.length > 0
              ? totalSpent / completedOrders.length
              : 0,
          favorite_items: favoriteItems,
          favorite_cuisines: favoriteCuisines,
          first_order_date:
            ordersData.length > 0
              ? ordersData[ordersData.length - 1]?.created_at
              : null,
          last_order_date:
            ordersData.length > 0 ? ordersData[0]?.created_at : null,
          orders_by_status: {
            completed: completedOrders.length,
            cancelled: cancelledOrders.length,
            pending: pendingOrders.length,
          },
        });
      }
    } catch (error) {
      console.error("Error fetching customer data:", error);
      Alert.alert("Error", "Failed to load customer profile");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchCustomerData();
  };

  // Add this function in your RestaurantCustomerProfileScreen component (around line 150-180)

  const startConversation = async () => {
    if (!user?.id || !customer?.id) {
      Alert.alert("Error", "Unable to start conversation");
      return;
    }

    try {
      // Check if conversation already exists
      const { data: existingConversation, error: checkError } = await supabase
        .from("conversations")
        .select("id")
        .eq("customer_id", customer.id)
        .eq("restaurant_id", user.id)
        .eq("is_active", true)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existingConversation) {
        // Navigate to existing conversation
        router.push(`/(restaurant)/messages/${existingConversation.id}`);
        return;
      }

      // Create new conversation
      const { data: newConversation, error: createError } = await supabase
        .from("conversations")
        .insert({
          customer_id: customer.id,
          restaurant_id: user.id,
          last_message: "Conversation started from customer profile",
          last_message_at: new Date().toISOString(),
          is_active: true,
        })
        .select("id")
        .single();

      if (createError) throw createError;

      if (newConversation) {
        // Navigate to new conversation
        router.push(`/(restaurant)/messages/${newConversation.id}`);
      }
    } catch (error) {
      console.error("Error starting conversation:", error);
      Alert.alert("Error", "Failed to start conversation. Please try again.");
    }
  };

  const handleCall = () => {
    if (!customer?.phone) {
      Alert.alert("Error", "Phone number not available");
      return;
    }

    const phoneNumber = `${customer.country_code || "+971"}${customer.phone}`;
    Linking.openURL(`tel:${phoneNumber}`).catch(() => {
      Alert.alert("Error", "Unable to make phone call");
    });
  };

  const handleEmail = () => {
    if (!customer?.email) {
      Alert.alert("Error", "Email not available");
      return;
    }

    Linking.openURL(`mailto:${customer.email}`).catch(() => {
      Alert.alert("Error", "Unable to send email");
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
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
      year: "numeric",
    });
  };

  const formatCurrency = (amount: number) => {
    return `AED ${amount.toFixed(2)}`;
  };

  const getInitials = (name: string) => {
    return (
      name
        ?.split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .substring(0, 2) || "CU"
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "delivered":
        return "#10B981";
      case "cancelled":
        return "#EF4444";
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
      default:
        return "#6B7280";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "delivered":
        return "checkmark-done-circle";
      case "cancelled":
        return "close-circle";
      case "pending":
        return "time";
      case "confirmed":
        return "checkmark-circle";
      case "preparing":
        return "restaurant";
      case "ready":
        return "fast-food";
      case "out_for_delivery":
        return "bicycle";
      default:
        return "help-circle";
    }
  };

  const renderOverview = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      {/* Customer Bio Card */}
      <LinearGradient
        colors={["#FF6B3510", "#FF8B3510"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.bioCard}
      >
        <View style={styles.bioHeader}>
          <Ionicons name="information-circle" size={20} color="#FF6B35" />
          <Text style={styles.bioTitle}>About Customer</Text>
        </View>
        <Text style={styles.bioText}>
          Customer since{" "}
          {customer?.created_at
            ? new Date(customer.created_at).toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              })
            : "N/A"}
        </Text>
        {customer?.is_verified && (
          <View style={styles.verifiedBadge}>
            <Ionicons name="checkmark-circle" size={14} color="#10B981" />
            <Text style={styles.verifiedText}>Verified Customer</Text>
          </View>
        )}
      </LinearGradient>

      {/* Quick Stats Grid */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <View
            style={[styles.statIconContainer, { backgroundColor: "#FF6B3515" }]}
          >
            <Ionicons name="receipt" size={24} color="#FF6B35" />
          </View>
          <Text style={styles.statValue}>{stats?.total_orders || 0}</Text>
          <Text style={styles.statLabel}>Total Orders</Text>
        </View>

        <View style={styles.statCard}>
          <View
            style={[styles.statIconContainer, { backgroundColor: "#10B98115" }]}
          >
            <Ionicons name="wallet" size={24} color="#10B981" />
          </View>
          <Text style={styles.statValue}>
            {formatCurrency(stats?.total_spent || 0)}
          </Text>
          <Text style={styles.statLabel}>Total Spent</Text>
        </View>

        <View style={styles.statCard}>
          <View
            style={[styles.statIconContainer, { backgroundColor: "#8B5CF615" }]}
          >
            <Ionicons name="cart" size={24} color="#8B5CF6" />
          </View>
          <Text style={styles.statValue}>
            {formatCurrency(stats?.average_order_value || 0)}
          </Text>
          <Text style={styles.statLabel}>Avg. Order</Text>
        </View>

        <View style={styles.statCard}>
          <View
            style={[styles.statIconContainer, { backgroundColor: "#3B82F615" }]}
          >
            <Ionicons name="calendar" size={24} color="#3B82F6" />
          </View>
          <Text style={styles.statValue}>
            {stats?.last_order_date
              ? formatDate(stats.last_order_date).split(" ")[0]
              : "Never"}
          </Text>
          <Text style={styles.statLabel}>Last Order</Text>
        </View>
      </View>

      {/* Order Status Breakdown */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Order Activity</Text>
        </View>
        <View style={styles.statusBreakdown}>
          <View style={styles.statusItem}>
            <View style={[styles.statusDot, { backgroundColor: "#10B981" }]} />
            <Text style={styles.statusLabel}>Completed</Text>
            <Text style={styles.statusCount}>
              {stats?.orders_by_status?.completed || 0}
            </Text>
          </View>
          <View style={styles.statusItem}>
            <View style={[styles.statusDot, { backgroundColor: "#F59E0B" }]} />
            <Text style={styles.statusLabel}>Pending</Text>
            <Text style={styles.statusCount}>
              {stats?.orders_by_status?.pending || 0}
            </Text>
          </View>
          <View style={styles.statusItem}>
            <View style={[styles.statusDot, { backgroundColor: "#EF4444" }]} />
            <Text style={styles.statusLabel}>Cancelled</Text>
            <Text style={styles.statusCount}>
              {stats?.orders_by_status?.cancelled || 0}
            </Text>
          </View>
        </View>
      </View>

      {/* Favorite Items */}
      {stats?.favorite_items && stats.favorite_items.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Favorite Items</Text>
            <TouchableOpacity onPress={() => setActiveTab("orders")}>
              <Text style={styles.seeAllText}>View Orders</Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.favoriteItemsContainer}
          >
            {stats.favorite_items.map((item, index) => (
              <View key={index} style={styles.favoriteItemCard}>
                {item.image ? (
                  <Image
                    source={{ uri: item.image }}
                    style={styles.favoriteItemImage}
                  />
                ) : (
                  <View style={styles.favoriteItemImagePlaceholder}>
                    <Ionicons name="fast-food" size={24} color="#9CA3AF" />
                  </View>
                )}
                <Text style={styles.favoriteItemName} numberOfLines={1}>
                  {item.name}
                </Text>
                <View style={styles.favoriteItemCount}>
                  <Ionicons name="repeat" size={12} color="#FF6B35" />
                  <Text style={styles.favoriteItemCountText}>
                    {item.count}x
                  </Text>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Favorite Cuisines */}
      {stats?.favorite_cuisines && stats.favorite_cuisines.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Favorite Cuisines</Text>
          <View style={styles.cuisinesContainer}>
            {stats.favorite_cuisines.map((cuisine, index) => (
              <View key={index} style={styles.cuisineTag}>
                <Text style={styles.cuisineText}>{cuisine}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Contact Information */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Contact Information</Text>
        <View style={styles.contactCard}>
          {customer?.phone && (
            <TouchableOpacity style={styles.contactRow} onPress={handleCall}>
              <View
                style={[styles.contactIcon, { backgroundColor: "#10B98115" }]}
              >
                <Ionicons name="call" size={18} color="#10B981" />
              </View>
              <View style={styles.contactInfo}>
                <Text style={styles.contactLabel}>Phone</Text>
                <Text style={styles.contactValue}>
                  {customer.country_code} {customer.phone}
                </Text>
              </View>
              <Ionicons name="open-outline" size={16} color="#6B7280" />
            </TouchableOpacity>
          )}

          {customer?.email && (
            <TouchableOpacity style={styles.contactRow} onPress={handleEmail}>
              <View
                style={[styles.contactIcon, { backgroundColor: "#3B82F615" }]}
              >
                <Ionicons name="mail" size={18} color="#3B82F6" />
              </View>
              <View style={styles.contactInfo}>
                <Text style={styles.contactLabel}>Email</Text>
                <Text style={styles.contactValue}>{customer.email}</Text>
              </View>
              <Ionicons name="open-outline" size={16} color="#6B7280" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </ScrollView>
  );

  const renderOrders = () => (
    <View style={styles.tabContent}>
      {orders.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="receipt-outline" size={48} color="#D1D5DB" />
          <Text style={styles.emptyStateTitle}>No orders yet</Text>
          <Text style={styles.emptyStateText}>
            This customer hasn't placed any orders
          </Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const firstItem = item.order_items?.[0];
            const itemName =
              firstItem?.item_name ||
              firstItem?.menu_items?.name ||
              firstItem?.posts?.title ||
              `${item.order_items?.length || 0} items`;
            const itemImage =
              firstItem?.item_image_url ||
              firstItem?.menu_items?.image_url ||
              firstItem?.posts?.image_url;

            return (
              <TouchableOpacity
                style={styles.orderCard}
                onPress={() => {
                  setSelectedOrder(item);
                  setModalVisible(true);
                }}
              >
                <View style={styles.orderHeader}>
                  <View>
                    <Text style={styles.orderNumber}>#{item.order_number}</Text>
                    <Text style={styles.orderDate}>
                      {formatDate(item.created_at)}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.orderStatusBadge,
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
                        styles.orderStatusText,
                        { color: getStatusColor(item.status) },
                      ]}
                    >
                      {item.status.replace(/_/g, " ")}
                    </Text>
                  </View>
                </View>

                <View style={styles.orderContent}>
                  <View style={styles.orderItemRow}>
                    {itemImage ? (
                      <Image
                        source={{ uri: itemImage }}
                        style={styles.orderItemImage}
                      />
                    ) : (
                      <View style={styles.orderItemImagePlaceholder}>
                        <Ionicons name="fast-food" size={20} color="#9CA3AF" />
                      </View>
                    )}
                    <View style={styles.orderItemInfo}>
                      <Text style={styles.orderItemName} numberOfLines={1}>
                        {itemName}
                      </Text>
                      <Text style={styles.orderRestaurant}>
                        {item.restaurants?.restaurant_name || "Restaurant"}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.orderFooter}>
                  <Text style={styles.orderTotal}>
                    {formatCurrency(item.final_amount)}
                  </Text>
                  <View style={styles.paymentBadge}>
                    <Ionicons
                      name={item.payment_method === "cash" ? "cash" : "card"}
                      size={12}
                      color="#6B7280"
                    />
                    <Text style={styles.paymentText}>
                      {item.payment_status}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.ordersList}
        />
      )}
    </View>
  );

  const renderReviews = () => (
    <View style={styles.tabContent}>
      {reviews.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="chatbubble-outline" size={48} color="#D1D5DB" />
          <Text style={styles.emptyStateTitle}>No reviews yet</Text>
          <Text style={styles.emptyStateText}>
            This customer hasn't written any reviews
          </Text>
        </View>
      ) : (
        <FlatList
          data={reviews}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.reviewCard}>
              <View style={styles.reviewHeader}>
                <View style={styles.reviewRestaurantInfo}>
                  <Text style={styles.reviewRestaurantName}>
                    {item.restaurants?.restaurant_name || "Restaurant"}
                  </Text>
                  <View style={styles.reviewRating}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Ionicons
                        key={star}
                        name={star <= item.rating ? "star" : "star-outline"}
                        size={12}
                        color="#FFD700"
                      />
                    ))}
                  </View>
                </View>
                <Text style={styles.reviewDate}>
                  {formatDate(item.created_at)}
                </Text>
              </View>
              {item.comment && (
                <Text style={styles.reviewComment}>{item.comment}</Text>
              )}
              {item.order_id && (
                <TouchableOpacity
                  style={styles.viewOrderButton}
                  onPress={() => {
                    const order = orders.find((o) => o.id === item.order_id);
                    if (order) {
                      setSelectedOrder(order);
                      setModalVisible(true);
                    }
                  }}
                >
                  <Ionicons name="receipt" size={14} color="#6B7280" />
                  <Text style={styles.viewOrderText}>View Order</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.reviewsList}
        />
      )}
    </View>
  );

  const renderAddresses = () => (
    <View style={styles.tabContent}>
      {addresses.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="location-outline" size={48} color="#D1D5DB" />
          <Text style={styles.emptyStateTitle}>No addresses saved</Text>
          <Text style={styles.emptyStateText}>
            This customer hasn't added any delivery addresses
          </Text>
        </View>
      ) : (
        <FlatList
          data={addresses}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.addressCard}
              onPress={() => {
                setSelectedAddress(item);
                setAddressModalVisible(true);
              }}
            >
              <View style={styles.addressHeader}>
                <View style={styles.addressLabelContainer}>
                  <View
                    style={[
                      styles.addressIcon,
                      {
                        backgroundColor: item.is_default
                          ? "#FF6B3515"
                          : "#F3F4F6",
                      },
                    ]}
                  >
                    <Ionicons
                      name={
                        item.label === "Home"
                          ? "home"
                          : item.label === "Work"
                            ? "briefcase"
                            : "location"
                      }
                      size={18}
                      color={item.is_default ? "#FF6B35" : "#6B7280"}
                    />
                  </View>
                  <View>
                    <View style={styles.addressLabelRow}>
                      <Text style={styles.addressLabel}>{item.label}</Text>
                      {item.is_default && (
                        <View style={styles.defaultBadge}>
                          <Text style={styles.defaultBadgeText}>Default</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.addressText} numberOfLines={2}>
                      {item.address_line1}
                      {item.address_line2 ? `, ${item.address_line2}` : ""}
                    </Text>
                    <Text style={styles.addressCity}>
                      {item.city}, {item.country} {item.postal_code || ""}
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
              </View>
            </TouchableOpacity>
          )}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.addressesList}
        />
      )}
    </View>
  );

  const renderOrderModal = () => {
    if (!selectedOrder) return null;

    const totalItems =
      selectedOrder.order_items?.reduce(
        (sum, item) => sum + (item.quantity || 1),
        0,
      ) || 0;

    return (
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <BlurView intensity={50} tint="dark" style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Order Details</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.modalOrderHeader}>
                <View>
                  <Text style={styles.modalOrderNumber}>
                    #{selectedOrder.order_number}
                  </Text>
                  <Text style={styles.modalOrderDate}>
                    {new Date(selectedOrder.created_at).toLocaleDateString(
                      "en-US",
                      {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      },
                    )}
                  </Text>
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
                <Text style={styles.modalSectionTitle}>Restaurant</Text>
                <View style={styles.modalRestaurantCard}>
                  {selectedOrder.restaurants?.image_url ? (
                    <Image
                      source={{ uri: selectedOrder.restaurants.image_url }}
                      style={styles.modalRestaurantImage}
                    />
                  ) : (
                    <View style={styles.modalRestaurantImagePlaceholder}>
                      <Ionicons name="restaurant" size={24} color="#9CA3AF" />
                    </View>
                  )}
                  <View style={styles.modalRestaurantInfo}>
                    <Text style={styles.modalRestaurantName}>
                      {selectedOrder.restaurants?.restaurant_name ||
                        "Restaurant"}
                    </Text>
                    {selectedOrder.restaurants?.restaurant_rating && (
                      <View style={styles.modalRestaurantRating}>
                        <Ionicons name="star" size={12} color="#FFD700" />
                        <Text style={styles.modalRestaurantRatingText}>
                          {selectedOrder.restaurants.restaurant_rating.toFixed(
                            1,
                          )}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>

              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>
                  Order Items ({totalItems})
                </Text>
                {selectedOrder.order_items?.map((item, index) => {
                  const itemName =
                    item.item_name ||
                    item.menu_items?.name ||
                    item.posts?.title ||
                    `Item ${index + 1}`;
                  const itemImage =
                    item.item_image_url ||
                    item.menu_items?.image_url ||
                    item.posts?.image_url;

                  return (
                    <View key={item.id} style={styles.modalOrderItem}>
                      {itemImage ? (
                        <Image
                          source={{ uri: itemImage }}
                          style={styles.modalOrderItemImage}
                        />
                      ) : (
                        <View style={styles.modalOrderItemImagePlaceholder}>
                          <Ionicons
                            name="fast-food"
                            size={20}
                            color="#9CA3AF"
                          />
                        </View>
                      )}
                      <View style={styles.modalOrderItemInfo}>
                        <Text style={styles.modalOrderItemName}>
                          {itemName}
                        </Text>
                        <Text style={styles.modalOrderItemQuantity}>
                          {item.quantity} × {formatCurrency(item.unit_price)}
                        </Text>
                      </View>
                      <Text style={styles.modalOrderItemTotal}>
                        {formatCurrency(
                          (item.quantity || 1) * (item.unit_price || 0),
                        )}
                      </Text>
                    </View>
                  );
                })}
              </View>

              {selectedOrder.delivery_address && (
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Delivery Address</Text>
                  <View style={styles.modalAddressCard}>
                    <View style={styles.modalAddressRow}>
                      <Ionicons name="location" size={16} color="#FF6B35" />
                      <Text style={styles.modalAddressText}>
                        {typeof selectedOrder.delivery_address === "string"
                          ? selectedOrder.delivery_address
                          : JSON.stringify(selectedOrder.delivery_address)}
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              {selectedOrder.special_instructions && (
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>
                    Special Instructions
                  </Text>
                  <View style={styles.modalInstructionsCard}>
                    <Ionicons name="chatbubble" size={16} color="#6B7280" />
                    <Text style={styles.modalInstructionsText}>
                      {selectedOrder.special_instructions}
                    </Text>
                  </View>
                </View>
              )}

              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Payment Summary</Text>
                <View style={styles.modalSummary}>
                  <View style={styles.modalSummaryRow}>
                    <Text style={styles.modalSummaryLabel}>Subtotal</Text>
                    <Text style={styles.modalSummaryValue}>
                      {formatCurrency(selectedOrder.total_amount)}
                    </Text>
                  </View>
                  <View style={styles.modalSummaryRow}>
                    <Text style={styles.modalSummaryLabel}>Delivery Fee</Text>
                    <Text style={styles.modalSummaryValue}>
                      {formatCurrency(selectedOrder.delivery_fee || 0)}
                    </Text>
                  </View>
                  <View style={[styles.modalSummaryRow, styles.modalTotalRow]}>
                    <Text style={styles.modalTotalLabel}>Total</Text>
                    <Text style={styles.modalTotalValue}>
                      {formatCurrency(selectedOrder.final_amount)}
                    </Text>
                  </View>
                  <View style={styles.modalPaymentMethod}>
                    <Ionicons
                      name={
                        selectedOrder.payment_method === "cash"
                          ? "cash"
                          : "card"
                      }
                      size={14}
                      color="#6B7280"
                    />
                    <Text style={styles.modalPaymentMethodText}>
                      Paid via {selectedOrder.payment_method} •{" "}
                      {selectedOrder.payment_status}
                    </Text>
                  </View>
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalMessageButton}
                onPress={() => {
                  setModalVisible(false);
                  startConversation();
                }}
              >
                <Ionicons name="chatbubble" size={18} color="#fff" />
                <Text style={styles.modalMessageButtonText}>
                  Message Customer
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </BlurView>
      </Modal>
    );
  };

  const renderAddressModal = () => {
    if (!selectedAddress) return null;

    return (
      <Modal
        animationType="slide"
        transparent={true}
        visible={addressModalVisible}
        onRequestClose={() => setAddressModalVisible(false)}
      >
        <BlurView intensity={50} tint="dark" style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Address Details</Text>
              <TouchableOpacity onPress={() => setAddressModalVisible(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.addressDetailCard}>
                <View style={styles.addressDetailHeader}>
                  <View
                    style={[
                      styles.addressDetailIcon,
                      {
                        backgroundColor: selectedAddress.is_default
                          ? "#FF6B3515"
                          : "#F3F4F6",
                      },
                    ]}
                  >
                    <Ionicons
                      name={
                        selectedAddress.label === "Home"
                          ? "home"
                          : selectedAddress.label === "Work"
                            ? "briefcase"
                            : "location"
                      }
                      size={28}
                      color={selectedAddress.is_default ? "#FF6B35" : "#6B7280"}
                    />
                  </View>
                  <View>
                    <View style={styles.addressDetailLabelRow}>
                      <Text style={styles.addressDetailLabel}>
                        {selectedAddress.label}
                      </Text>
                      {selectedAddress.is_default && (
                        <View style={styles.addressDetailDefaultBadge}>
                          <Text style={styles.addressDetailDefaultText}>
                            Default
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.addressDetailType}>
                      {selectedAddress.label} Address
                    </Text>
                  </View>
                </View>

                <View style={styles.addressDetailSection}>
                  <Text style={styles.addressDetailSectionTitle}>Address</Text>
                  <Text style={styles.addressDetailFull}>
                    {selectedAddress.address_line1}
                  </Text>
                  {selectedAddress.address_line2 && (
                    <Text style={styles.addressDetailFull}>
                      {selectedAddress.address_line2}
                    </Text>
                  )}
                  <Text style={styles.addressDetailFull}>
                    {selectedAddress.city}, {selectedAddress.state || ""}{" "}
                    {selectedAddress.postal_code || ""}
                  </Text>
                  <Text style={styles.addressDetailFull}>
                    {selectedAddress.country}
                  </Text>
                </View>

                {selectedAddress.latitude && selectedAddress.longitude && (
                  <View style={styles.addressDetailSection}>
                    <Text style={styles.addressDetailSectionTitle}>
                      Coordinates
                    </Text>
                    <View style={styles.coordinatesContainer}>
                      <View style={styles.coordinateItem}>
                        <Text style={styles.coordinateLabel}>Latitude</Text>
                        <Text style={styles.coordinateValue}>
                          {selectedAddress.latitude}
                        </Text>
                      </View>
                      <View style={styles.coordinateItem}>
                        <Text style={styles.coordinateLabel}>Longitude</Text>
                        <Text style={styles.coordinateValue}>
                          {selectedAddress.longitude}
                        </Text>
                      </View>
                    </View>
                  </View>
                )}
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[
                  styles.modalMessageButton,
                  { backgroundColor: "#3B82F6" },
                ]}
                onPress={() => {
                  setAddressModalVisible(false);
                  // Open in maps if coordinates available
                  if (selectedAddress.latitude && selectedAddress.longitude) {
                    Linking.openURL(
                      `https://maps.google.com/?q=${selectedAddress.latitude},${selectedAddress.longitude}`,
                    );
                  } else {
                    Alert.alert(
                      "Info",
                      "Coordinates not available for this address",
                    );
                  }
                }}
              >
                <Ionicons name="map" size={18} color="#fff" />
                <Text style={styles.modalMessageButtonText}>Open in Maps</Text>
              </TouchableOpacity>
            </View>
          </View>
        </BlurView>
      </Modal>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={styles.loadingText}>Loading customer profile...</Text>
      </SafeAreaView>
    );
  }

  if (!customer) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <View style={styles.errorContent}>
          <Ionicons name="person-outline" size={64} color="#EF4444" />
          <Text style={styles.errorTitle}>Customer Not Found</Text>
          <Text style={styles.errorText}>
            This customer profile may have been deleted
          </Text>
          <TouchableOpacity
            style={styles.errorBackButton}
            onPress={() => router.back()}
          >
            <Text style={styles.errorBackButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Customer Profile</Text>
        <TouchableOpacity
          style={styles.messageButton}
          onPress={startConversation}
        >
          <Ionicons name="chatbubble" size={20} color="#FF6B35" />
        </TouchableOpacity>
      </View>

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
        {/* Profile Header */}
        <LinearGradient
          colors={["#FF6B3520", "#FF8B3510"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.profileHeader}
        >
          <View style={styles.profileImageContainer}>
            {customer.profile_image_url ? (
              <Image
                source={{ uri: customer.profile_image_url }}
                style={styles.profileImage}
              />
            ) : (
              <View style={styles.profileImagePlaceholder}>
                <Text style={styles.profileInitials}>
                  {getInitials(customer.full_name)}
                </Text>
              </View>
            )}
            {customer.is_verified && (
              <View style={styles.verifiedBadgeLarge}>
                <Ionicons name="checkmark-circle" size={20} color="#10B981" />
              </View>
            )}
          </View>

          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{customer.full_name}</Text>
            <View style={styles.profileMeta}>
              <View style={styles.profileMetaItem}>
                <Ionicons name="calendar-outline" size={14} color="#6B7280" />
                <Text style={styles.profileMetaText}>
                  Joined{" "}
                  {new Date(customer.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    year: "numeric",
                  })}
                </Text>
              </View>
              {customer.last_login && (
                <View style={styles.profileMetaItem}>
                  <Ionicons name="time-outline" size={14} color="#6B7280" />
                  <Text style={styles.profileMetaText}>
                    Last active {formatDate(customer.last_login)}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </LinearGradient>

        {/* Quick Action Buttons */}
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.quickAction} onPress={handleCall}>
            <View
              style={[styles.quickActionIcon, { backgroundColor: "#10B98115" }]}
            >
              <Ionicons name="call" size={20} color="#10B981" />
            </View>
            <Text style={styles.quickActionText}>Call</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.quickAction} onPress={handleEmail}>
            <View
              style={[styles.quickActionIcon, { backgroundColor: "#3B82F615" }]}
            >
              <Ionicons name="mail" size={20} color="#3B82F6" />
            </View>
            <Text style={styles.quickActionText}>Email</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickAction}
            onPress={startConversation}
          >
            <View
              style={[styles.quickActionIcon, { backgroundColor: "#FF6B3515" }]}
            >
              <Ionicons name="chatbubble" size={20} color="#FF6B35" />
            </View>
            <Text style={styles.quickActionText}>Message</Text>
          </TouchableOpacity>
        </View>

        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          {[
            { key: "overview", label: "Overview", icon: "person" },
            {
              key: "orders",
              label: "Orders",
              icon: "receipt",
              count: stats?.total_orders,
            },
            {
              key: "reviews",
              label: "Reviews",
              icon: "star",
              count: reviews.length,
            },
            {
              key: "addresses",
              label: "Addresses",
              icon: "location",
              count: addresses.length,
            },
          ].map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.tabButton,
                activeTab === tab.key && styles.tabButtonActive,
              ]}
              onPress={() => setActiveTab(tab.key as any)}
            >
              <Ionicons
                name={tab.key === activeTab ? tab.icon : `${tab.icon}-outline`}
                size={18}
                color={activeTab === tab.key ? "#FF6B35" : "#6B7280"}
              />
              <Text
                style={[
                  styles.tabText,
                  activeTab === tab.key && styles.tabTextActive,
                ]}
              >
                {tab.label}
              </Text>
              {tab.count
                ? tab.count > 0 && (
                    <View
                      style={[
                        styles.tabBadge,
                        activeTab === tab.key && styles.tabBadgeActive,
                      ]}
                    >
                      <Text style={styles.tabBadgeText}>
                        {tab.count > 99 ? "99+" : tab.count}
                      </Text>
                    </View>
                  )
                : null}
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab Content */}
        {activeTab === "overview" && renderOverview()}
        {activeTab === "orders" && renderOrders()}
        {activeTab === "reviews" && renderReviews()}
        {activeTab === "addresses" && renderAddresses()}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Modals */}
      {renderOrderModal()}
      {renderAddressModal()}
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
  errorContainer: {
    flex: 1,
    backgroundColor: "#fff",
  },
  errorContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 24,
  },
  errorBackButton: {
    backgroundColor: "#FF6B35",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  errorBackButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  messageButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FF6B3515",
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    flex: 1,
  },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  profileImageContainer: {
    position: "relative",
    marginRight: 16,
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: "#fff",
  },
  profileImagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#FF6B35",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#fff",
  },
  profileInitials: {
    color: "#fff",
    fontSize: 32,
    fontWeight: "700",
  },
  verifiedBadgeLarge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 2,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 6,
  },
  profileMeta: {
    gap: 4,
  },
  profileMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  profileMetaText: {
    fontSize: 12,
    color: "#6B7280",
  },
  quickActions: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  quickAction: {
    alignItems: "center",
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },
  quickActionText: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "500",
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#fff",
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  tabButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 6,
  },
  tabButtonActive: {
    backgroundColor: "#FF6B3515",
  },
  tabText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6B7280",
  },
  tabTextActive: {
    color: "#FF6B35",
  },
  tabBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  tabBadgeActive: {
    backgroundColor: "#FF6B35",
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#6B7280",
  },
  tabContent: {
    flex: 1,
    padding: 16,
  },
  bioCard: {
    padding: 14,
    borderRadius: 16,
    marginBottom: 16,
  },
  bioHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  bioTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  bioText: {
    fontSize: 14,
    color: "#6B7280",
    lineHeight: 20,
    marginBottom: 12,
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#10B98115",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 4,
  },
  verifiedText: {
    fontSize: 11,
    color: "#10B981",
    fontWeight: "600",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  statCard: {
    width: (SCREEN_WIDTH - 42) / 2,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: "#6B7280",
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  seeAllText: {
    fontSize: 13,
    color: "#FF6B35",
    fontWeight: "600",
  },
  statusBreakdown: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  statusItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusLabel: {
    flex: 1,
    fontSize: 14,
    color: "#374151",
  },
  statusCount: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  favoriteItemsContainer: {
    paddingRight: 16,
    gap: 12,
  },
  favoriteItemCard: {
    width: 100,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#F3F4F6",
    marginRight: 0,
  },
  favoriteItemImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 8,
  },
  favoriteItemImagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  favoriteItemName: {
    fontSize: 12,
    fontWeight: "600",
    color: "#111827",
    textAlign: "center",
    marginBottom: 4,
  },
  favoriteItemCount: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  favoriteItemCountText: {
    fontSize: 11,
    color: "#FF6B35",
    fontWeight: "600",
  },
  cuisinesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  cuisineTag: {
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  cuisineText: {
    fontSize: 12,
    color: "#374151",
  },
  contactCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  contactIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  contactInfo: {
    flex: 1,
  },
  contactLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 2,
  },
  contactValue: {
    fontSize: 14,
    color: "#111827",
    fontWeight: "500",
  },
  ordersList: {
    paddingBottom: 20,
  },
  orderCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  orderNumber: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 2,
  },
  orderDate: {
    fontSize: 12,
    color: "#6B7280",
  },
  orderStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 4,
  },
  orderStatusText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  orderContent: {
    marginBottom: 12,
  },
  orderItemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  orderItemImage: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  orderItemImagePlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  orderItemInfo: {
    flex: 1,
  },
  orderItemName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 2,
  },
  orderRestaurant: {
    fontSize: 12,
    color: "#6B7280",
  },
  orderFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
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
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
  },
  paymentText: {
    fontSize: 11,
    color: "#6B7280",
  },
  reviewsList: {
    paddingBottom: 20,
  },
  reviewCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  reviewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  reviewRestaurantInfo: {
    flex: 1,
  },
  reviewRestaurantName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 4,
  },
  reviewRating: {
    flexDirection: "row",
    gap: 2,
  },
  reviewDate: {
    fontSize: 11,
    color: "#9CA3AF",
  },
  reviewComment: {
    fontSize: 14,
    color: "#374151",
    lineHeight: 20,
    marginBottom: 12,
  },
  viewOrderButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
    gap: 6,
  },
  viewOrderText: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "600",
  },
  addressesList: {
    paddingBottom: 20,
  },
  addressCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  addressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  addressLabelContainer: {
    flex: 1,
    flexDirection: "row",
    gap: 12,
  },
  addressIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  addressLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  addressLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
  },
  defaultBadge: {
    backgroundColor: "#10B98115",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  defaultBadgeText: {
    fontSize: 10,
    color: "#10B981",
    fontWeight: "600",
  },
  addressText: {
    fontSize: 13,
    color: "#374151",
    marginBottom: 2,
  },
  addressCity: {
    fontSize: 12,
    color: "#6B7280",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginTop: 16,
    marginBottom: 4,
  },
  emptyStateText: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
  },
  bottomSpacer: {
    height: 24,
  },
  modalOverlay: {
    flex: 1,
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
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  modalBody: {
    padding: 20,
  },
  modalOrderHeader: {
    marginBottom: 20,
  },
  modalOrderNumber: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 4,
  },
  modalOrderDate: {
    fontSize: 13,
    color: "#6B7280",
  },
  modalStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
    marginTop: 12,
  },
  modalStatusText: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  modalSection: {
    marginBottom: 24,
  },
  modalSectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
  },
  modalRestaurantCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    padding: 12,
    borderRadius: 12,
    gap: 12,
  },
  modalRestaurantImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
  },
  modalRestaurantImagePlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  modalRestaurantInfo: {
    flex: 1,
  },
  modalRestaurantName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 4,
  },
  modalRestaurantRating: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  modalRestaurantRatingText: {
    fontSize: 12,
    color: "#374151",
    fontWeight: "600",
  },
  modalOrderItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    gap: 12,
  },
  modalOrderItemImage: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  modalOrderItemImagePlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  modalOrderItemInfo: {
    flex: 1,
  },
  modalOrderItemName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 2,
  },
  modalOrderItemQuantity: {
    fontSize: 12,
    color: "#6B7280",
  },
  modalOrderItemTotal: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  modalAddressCard: {
    backgroundColor: "#F9FAFB",
    padding: 12,
    borderRadius: 12,
  },
  modalAddressRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  modalAddressText: {
    flex: 1,
    fontSize: 14,
    color: "#374151",
    lineHeight: 20,
  },
  modalInstructionsCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#F9FAFB",
    padding: 12,
    borderRadius: 12,
    gap: 8,
  },
  modalInstructionsText: {
    flex: 1,
    fontSize: 14,
    color: "#374151",
    lineHeight: 20,
  },
  modalSummary: {
    backgroundColor: "#F9FAFB",
    padding: 16,
    borderRadius: 12,
  },
  modalSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  modalSummaryLabel: {
    fontSize: 14,
    color: "#6B7280",
  },
  modalSummaryValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  modalTotalRow: {
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    marginTop: 8,
    paddingTop: 12,
  },
  modalTotalLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  modalTotalValue: {
    fontSize: 20,
    fontWeight: "800",
    color: "#FF6B35",
  },
  modalPaymentMethod: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    gap: 8,
  },
  modalPaymentMethodText: {
    fontSize: 13,
    color: "#6B7280",
  },
  modalActions: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  modalMessageButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FF6B35",
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  modalMessageButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  addressDetailCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
  },
  addressDetailHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 24,
  },
  addressDetailIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
  },
  addressDetailLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  addressDetailLabel: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  addressDetailDefaultBadge: {
    backgroundColor: "#10B98115",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  addressDetailDefaultText: {
    fontSize: 11,
    color: "#10B981",
    fontWeight: "600",
  },
  addressDetailType: {
    fontSize: 14,
    color: "#6B7280",
  },
  addressDetailSection: {
    marginBottom: 20,
  },
  addressDetailSectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 12,
  },
  addressDetailFull: {
    fontSize: 15,
    color: "#374151",
    marginBottom: 4,
    lineHeight: 22,
  },
  coordinatesContainer: {
    flexDirection: "row",
    gap: 16,
  },
  coordinateItem: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    padding: 12,
    borderRadius: 8,
  },
  coordinateLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 4,
  },
  coordinateValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
});
