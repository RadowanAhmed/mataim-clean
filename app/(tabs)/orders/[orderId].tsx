// app/(tabs)/orders/[orderId].tsx - Customer Order Details
import { useAuth } from "@/backend/AuthContext";
import { supabase } from "@/backend/supabase";
import animations from "@/constent/animations";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import LottieView from "lottie-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";

import { ConversationService } from "@/backend/services/conversationService";

export default function CustomerOrderDetailScreen() {
  const { orderId } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [order, setOrder] = useState<any>(null);
  const [restaurant, setRestaurant] = useState<any>(null);
  const [driver, setDriver] = useState<any>(null);
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);

  // Map states
  const [restaurantLocation, setRestaurantLocation] = useState<any>(null);
  const [driverLocation, setDriverLocation] = useState<any>(null);
  const [userLocation, setUserLocation] = useState<any>(null);
  const [mapRegion, setMapRegion] = useState<any>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<any[]>([]);
  const [showMap, setShowMap] = useState(false);

  // Order updates
  const [orderUpdates, setOrderUpdates] = useState<any[]>([]);
  const [estimatedTime, setEstimatedTime] = useState<string>("");

  // Add animation refs for better control
  const [animationKey, setAnimationKey] = useState(0);

  useEffect(() => {
    if (orderId) {
      fetchOrderDetails();
    }
  }, [orderId]);

  // Update animation key when status changes to restart animation
  useEffect(() => {
    if (order?.status) {
      setAnimationKey((prev) => prev + 1);
    }
  }, [order?.status]);

  const fetchOrderDetails = async () => {
    try {
      setLoading(true);

      // Fetch order with all related data
      const { data: orderData, error } = await supabase
        .from("orders")
        .select(
          `
          *,
          restaurants:restaurants!orders_restaurant_id_fkey(
            *,
            users!inner(
              full_name,
              phone,
              profile_image_url
            )
          ),
          delivery_users:delivery_users(
            *,
            users!inner(
              full_name,
              phone,
              profile_image_url
            )
          )
        `,
        )
        .eq("id", orderId)
        .single();

      if (error) throw error;
      setOrder(orderData);

      // Set restaurant data
      if (orderData.restaurants) {
        setRestaurant(orderData.restaurants);

        // Set restaurant location for map
        if (orderData.restaurants.latitude && orderData.restaurants.longitude) {
          const location = {
            latitude: parseFloat(orderData.restaurants.latitude),
            longitude: parseFloat(orderData.restaurants.longitude),
          };
          setRestaurantLocation(location);
        }
      }

      // Set driver data if assigned
      if (orderData.delivery_users) {
        setDriver(orderData.delivery_users);

        // Set driver location for map
        if (
          orderData.delivery_users.current_location_lat &&
          orderData.delivery_users.current_location_lng
        ) {
          const location = {
            latitude: parseFloat(orderData.delivery_users.current_location_lat),
            longitude: parseFloat(
              orderData.delivery_users.current_location_lng,
            ),
          };
          setDriverLocation(location);
        }
      }

      // Fetch order items
      const { data: itemsData } = await supabase
        .from("order_items")
        .select(
          `
          *,
          posts!left(
            id,
            title,
            image_url,
            description,
            original_price,
            discounted_price
          ),
          menu_items!left(
            id,
            name,
            image_url,
            description,
            price
          )
        `,
        )
        .eq("order_id", orderId);

      setOrderItems(itemsData || []);

      // Fetch reviews for this order
      const { data: reviewsData } = await supabase
        .from("reviews")
        .select("*")
        .eq("order_id", orderId);

      setReviews(reviewsData || []);

      // Fetch order notifications/updates
      const { data: updatesData } = await supabase
        .from("order_notifications")
        .select("*")
        .eq("order_id", orderId)
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false });

      setOrderUpdates(updatesData || []);

      // Calculate estimated delivery time
      calculateEstimatedTime(orderData);

      // Setup map
      setupMap(orderData);
    } catch (error) {
      console.error("Error fetching order details:", error);
      Alert.alert("Error", "Failed to load order details");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const setupMap = (orderData: any) => {
    const locations = [];

    if (restaurantLocation) locations.push(restaurantLocation);
    if (driverLocation) locations.push(driverLocation);

    // Try to get delivery address location
    if (
      orderData.delivery_address?.latitude &&
      orderData.delivery_address?.longitude
    ) {
      const userLoc = {
        latitude: parseFloat(orderData.delivery_address.latitude),
        longitude: parseFloat(orderData.delivery_address.longitude),
      };
      setUserLocation(userLoc);
      locations.push(userLoc);
    }

    if (locations.length > 0) {
      // Calculate map region to show all points
      let minLat = locations[0].latitude;
      let maxLat = locations[0].latitude;
      let minLng = locations[0].longitude;
      let maxLng = locations[0].longitude;

      locations.forEach((loc) => {
        minLat = Math.min(minLat, loc.latitude);
        maxLat = Math.max(maxLat, loc.latitude);
        minLng = Math.min(minLng, loc.longitude);
        maxLng = Math.max(maxLng, loc.longitude);
      });

      setMapRegion({
        latitude: (minLat + maxLat) / 2,
        longitude: (minLng + maxLng) / 2,
        latitudeDelta: Math.max((maxLat - minLat) * 1.5, 0.05),
        longitudeDelta: Math.max((maxLng - minLng) * 1.5, 0.05),
      });

      // Set route from restaurant to user
      if (restaurantLocation && userLocation) {
        setRouteCoordinates([restaurantLocation, userLocation]);
      }
    }
  };

  const calculateEstimatedTime = (orderData: any) => {
    if (orderData.estimated_delivery_time) {
      const estimated = new Date(orderData.estimated_delivery_time);
      setEstimatedTime(
        estimated.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
    } else {
      // Calculate based on status
      const now = new Date();
      let estimated = new Date();

      switch (orderData.status) {
        case "pending":
          estimated.setMinutes(estimated.getMinutes() + 40);
          break;
        case "confirmed":
          estimated.setMinutes(estimated.getMinutes() + 35);
          break;
        case "preparing":
          estimated.setMinutes(estimated.getMinutes() + 25);
          break;
        case "ready":
          estimated.setMinutes(estimated.getMinutes() + 20);
          break;
        case "out_for_delivery":
          estimated.setMinutes(estimated.getMinutes() + 15);
          break;
        default:
          estimated.setMinutes(estimated.getMinutes() + 30);
      }

      setEstimatedTime(
        estimated.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchOrderDetails();
  };

  const handleContactRestaurant = () => {
    if (restaurant?.users?.phone) {
      Linking.openURL(`tel:${restaurant.users.phone}`).catch((err) => {
        Alert.alert("Error", "Unable to make phone call");
      });
    }
  };

  const handleContactDriver = () => {
    if (driver?.users?.phone) {
      Linking.openURL(`tel:${driver.users.phone}`).catch((err) => {
        Alert.alert("Error", "Unable to make phone call");
      });
    }
  };

  const handleTrackOrder = () => {
    if (order?.id && restaurant?.id) {
      router.push({
        pathname: "/orders/track",
        params: {
          orderId: order.id,
          restaurantId: restaurant.id,
          restaurantName: restaurant.restaurant_name,
          restaurantLat: restaurant.latitude,
          restaurantLng: restaurant.longitude,
        },
      });
    }
  };

  const handleReorder = async () => {
    if (!order || !restaurant) return;

    Alert.alert("Reorder", "Would you like to reorder the same items?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reorder",
        onPress: async () => {
          try {
            // Create new cart with same items
            const cartItems = orderItems.map((item: any) => ({
              post_id: item.post_id,
              menu_item_id: item.menu_item_id,
              quantity: item.quantity,
              unit_price: item.unit_price,
              special_instructions: item.special_instructions,
            }));

            const { data: cartData, error: cartError } = await supabase
              .from("carts")
              .upsert({
                user_id: user?.id,
                restaurant_id: restaurant.id,
                items: cartItems,
                subtotal: order.total_amount,
                total_items: orderItems.length,
                updated_at: new Date().toISOString(),
              })
              .select()
              .single();

            if (cartError) throw cartError;

            Alert.alert("Success", "Items added to cart!");
            router.push(`/restaurant/${restaurant.id}`);
          } catch (error) {
            console.error("Reorder error:", error);
            Alert.alert("Error", "Failed to reorder items");
          }
        },
      },
    ]);
  };

  const handleRateOrder = () => {
    if (order?.id) {
      router.push(`/orders/rate?orderId=${order.id}`);
    }
  };

  const handleReportIssue = () => {
    Alert.alert("Report Issue", "Please describe the issue with your order", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Missing Items",
        onPress: () => submitIssue("Missing Items"),
      },
      {
        text: "Wrong Order",
        onPress: () => submitIssue("Wrong Order"),
      },
      {
        text: "Quality Issue",
        onPress: () => submitIssue("Quality Issue"),
      },
      {
        text: "Other",
        onPress: () => promptForIssueDetails(),
      },
    ]);
  };

  const submitIssue = async (issueType: string) => {
    try {
      const { error } = await supabase.from("order_issues").insert({
        order_id: order.id,
        user_id: user?.id,
        issue_type: issueType,
        status: "pending",
        created_at: new Date().toISOString(),
      });

      if (error) throw error;
      Alert.alert(
        "Success",
        "Issue reported successfully. Our team will contact you shortly.",
      );
    } catch (error) {
      console.error("Issue report error:", error);
      Alert.alert("Error", "Failed to report issue");
    }
  };

  const promptForIssueDetails = () => {
    Alert.prompt(
      "Describe Issue",
      "Please describe the issue in detail:",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Submit",
          onPress: async (description) => {
            if (description) {
              await submitIssue(`Other: ${description}`);
            }
          },
        },
      ],
      "plain-text",
    );
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "delivered":
        return "#10B981";
      case "out_for_delivery":
        return "#3B82F6";
      case "ready":
        return "#8B5CF6";
      case "preparing":
        return "#F59E0B";
      case "confirmed":
        return "#3B82F6";
      case "cancelled":
        return "#EF4444";
      case "pending":
        return "#6B7280";
      default:
        return "#6B7280";
    }
  };

  // New function to get animation based on order status
  const getStatusAnimation = (status: string) => {
    switch (status?.toLowerCase()) {
      case "pending":
        return animations.pending_animation; // Clock animation for pending
      case "confirmed":
        return animations.confirmed_animation; // Success checkmark for confirmed
      case "preparing":
        return animations.preparing_animation; // Food preparation animation
      case "ready":
        return animations.ready_animation; // Pickup food ready animation
      case "out_for_delivery":
        return animations.out_for_delivery_animation; // Delivery guy out for delivery
      case "delivered":
        return animations.delivered_animation; // Order delivered celebration
      case "cancelled":
        return animations.cancelled_animation; // Order cancelled animation
      default:
        return animations.restaurant_cafe_cup; // Default cafe animation
    }
  };

  const getStatusDescription = (status: string) => {
    switch (status?.toLowerCase()) {
      case "pending":
        return "Restaurant is reviewing your order";
      case "confirmed":
        return "Restaurant has accepted your order";
      case "preparing":
        return "Chef is preparing your food";
      case "ready":
        return "Your order is ready for pickup";
      case "out_for_delivery":
        return "Driver is on the way to you";
      case "delivered":
        return "Order has been delivered";
      case "cancelled":
        return "Order has been cancelled";
      default:
        return "Processing your order";
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Add this function to handle messaging the driver
  const handleMessageDriver = async () => {
    if (!order?.delivery_users?.id) {
      Alert.alert("No Driver", "No driver assigned to this order yet");
      return;
    }

    try {
      const conversationId =
        await ConversationService.getOrCreateCustomerDriverConversation(
          user?.id,
          order.delivery_users.id,
          order.id,
        );

      if (conversationId) {
        // Navigate to the chat with all necessary params
        router.push({
          pathname: "/(tabs)/messages/[id]",
          params: {
            id: conversationId,
            driverId: order.delivery_users.id,
            driverName: order.delivery_users.users?.full_name || "Driver",
            driverImage: order.delivery_users.users?.profile_image_url || "",
            orderId: order.id,
          },
        });
      } else {
        Alert.alert("Error", "Failed to start conversation with driver");
      }
    } catch (error) {
      console.error("Error messaging driver:", error);
      Alert.alert("Error", "Failed to start conversation with driver");
    }
  };

  // Add this function to check if driver is available for messaging
  const canMessageDriver = () => {
    return (
      order?.delivery_users?.id &&
      ["out_for_delivery", "ready", "picked_up"].includes(
        order?.status?.toLowerCase(),
      )
    );
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={styles.loadingText}>Loading order details...</Text>
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <View style={styles.errorContent}>
          <Ionicons name="alert-circle" size={48} color="#EF4444" />
          <Text style={styles.errorTitle}>Order Not Found</Text>
          <Text style={styles.errorText}>
            The order you're looking for doesn't exist or you don't have
            permission to view it.
          </Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
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
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Order Details</Text>
        <TouchableOpacity onPress={onRefresh} disabled={refreshing}>
          <Ionicons
            name="refresh"
            size={20}
            color={refreshing ? "#9CA3AF" : "#FF6B35"}
          />
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
        {/* Order Status Card */}
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <View
              style={[
                styles.statusIcon,
                { backgroundColor: getStatusColor(order.status) + "20" },
              ]}
            >
              <LottieView
                key={animationKey}
                source={getStatusAnimation(order.status)}
                style={styles.statusAnimation}
                autoPlay
                loop
                resizeMode="cover"
              />
            </View>
            <View style={styles.statusInfo}>
              <Text style={styles.statusTitle}>
                {order.status?.replace(/_/g, " ").toUpperCase()}
              </Text>
              <Text style={styles.statusDescription}>
                {getStatusDescription(order.status)}
              </Text>
            </View>
          </View>

          {/* Order Info */}
          <View style={styles.orderInfo}>
            <View style={styles.orderInfoRow}>
              <Ionicons name="receipt" size={16} color="#6B7280" />
              <Text style={styles.orderLabel}>Order #</Text>
              <Text style={styles.orderValue}>{order.order_number}</Text>
            </View>
            <View style={styles.orderInfoRow}>
              <Ionicons name="calendar" size={16} color="#6B7280" />
              <Text style={styles.orderLabel}>Date</Text>
              <Text style={styles.orderValue}>
                {formatDate(order.created_at)} at {formatTime(order.created_at)}
              </Text>
            </View>
            {estimatedTime && (
              <View style={styles.orderInfoRow}>
                <Ionicons name="time" size={16} color="#6B7280" />
                <Text style={styles.orderLabel}>Estimated Delivery</Text>
                <Text style={styles.orderValue}>{estimatedTime}</Text>
              </View>
            )}
          </View>

          {/* Progress Steps */}
          <View style={styles.progressContainer}>
            {["confirmed", "preparing", "ready", "delivered"].map(
              (step, index) => {
                const isActive =
                  ["confirmed", "preparing", "ready", "delivered"].indexOf(
                    order.status,
                  ) >= index;
                const isCurrent = order.status === step;

                return (
                  <View key={step} style={styles.progressStep}>
                    <View
                      style={[
                        styles.progressDot,
                        isActive && styles.activeDot,
                        isCurrent && styles.currentDot,
                      ]}
                    >
                      {isActive && !isCurrent ? (
                        <Ionicons name="checkmark" size={12} color="white" />
                      ) : null}
                    </View>
                    <Text
                      style={[
                        styles.progressLabel,
                        isActive && styles.activeLabel,
                      ]}
                    >
                      {step.charAt(0).toUpperCase() + step.slice(1)}
                    </Text>
                    {index < 3 && (
                      <View
                        style={[
                          styles.progressLine,
                          isActive && styles.activeLine,
                        ]}
                      />
                    )}
                  </View>
                );
              },
            )}
          </View>
        </View>

        {/* Restaurant Information */}
        {/* Restaurant Information */}
        {restaurant && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Restaurant</Text>
            <TouchableOpacity
              style={styles.restaurantCard}
              onPress={() => router.push(`/restaurant/${restaurant.id}`)}
              activeOpacity={0.7}
            >
              <Image
                source={{
                  uri:
                    restaurant.image_url ||
                    restaurant.users?.profile_image_url ||
                    "https://via.placeholder.com/50",
                }}
                style={styles.restaurantImage}
              />
              <View style={styles.restaurantInfo}>
                <Text style={styles.restaurantName}>
                  {restaurant.restaurant_name}
                </Text>
                <Text style={styles.restaurantCuisine}>
                  {restaurant.cuisine_type}
                </Text>
                <View style={styles.restaurantMeta}>
                  <Text style={styles.restaurantRating}>
                    ⭐ {restaurant.restaurant_rating?.toFixed(1) || "4.0"}
                  </Text>
                  <Text style={styles.restaurantDistance}>
                    {restaurant.delivery_fee > 0
                      ? `AED ${restaurant.delivery_fee} delivery`
                      : "Free delivery"}
                  </Text>
                </View>
              </View>

              {/* Message Button - Add this */}
              <View style={styles.driverActions}>
                <TouchableOpacity
                  style={styles.messageButton}
                  onPress={async () => {
                    try {
                      // Create/get conversation with restaurant
                      const conversationId =
                        await ConversationService.getOrCreateCustomerRestaurantConversation(
                          user?.id,
                          restaurant.id,
                          order.id,
                        );

                      if (conversationId) {
                        router.push({
                          pathname: "/(tabs)/messages/[id]",
                          params: {
                            id: conversationId,
                            restaurantId: restaurant.id,
                            restaurantName: restaurant.restaurant_name,
                            restaurantImage:
                              restaurant.image_url ||
                              restaurant.users?.profile_image_url,
                            orderId: order.id,
                          },
                        });
                      } else {
                        Alert.alert(
                          "Error",
                          "Failed to start conversation with restaurant",
                        );
                      }
                    } catch (error) {
                      console.error("Error messaging restaurant:", error);
                      Alert.alert("Error", "Failed to start conversation");
                    }
                  }}
                >
                  <Ionicons
                    name="chatbubble-outline"
                    size={18}
                    color="#8B5CF6"
                  />
                  <Text style={styles.messageButtonText}>Message</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.callButton}
                  onPress={handleContactRestaurant}
                >
                  <Ionicons name="call" size={18} color="#3B82F6" />
                  <Text style={styles.callText}>Call</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Driver Information */}
        {driver && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Delivery Partner</Text>
            <View style={styles.driverCard}>
              <Image
                source={{
                  uri:
                    driver.users?.profile_image_url ||
                    "https://via.placeholder.com/50",
                }}
                style={styles.driverImage}
              />
              <View style={styles.driverInfo}>
                <Text style={styles.driverName}>{driver.users?.full_name}</Text>
                <View style={styles.driverStats}>
                  <Text style={styles.driverRating}>
                    ⭐ {driver.rating?.toFixed(1)}
                  </Text>
                  <Text style={styles.driverDeliveries}>
                    📦 {driver.total_deliveries} deliveries
                  </Text>
                </View>
                <Text style={styles.driverVehicle}>
                  {driver.vehicle_type} • {driver.vehicle_plate}
                </Text>
              </View>

              {/* Add Message Button */}
              <View style={styles.driverActions}>
                <TouchableOpacity
                  style={styles.messageButton}
                  onPress={handleMessageDriver}
                >
                  <Ionicons
                    name="chatbubble-outline"
                    size={18}
                    color="#8B5CF6"
                  />
                  <Text style={styles.messageButtonText}>Message</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.callButton}
                  onPress={handleContactDriver}
                >
                  <Ionicons name="call" size={18} color="#3B82F6" />
                  <Text style={styles.callText}>Call</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Order Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Order Items ({orderItems.length})
          </Text>
          <View style={styles.itemsList}>
            {orderItems.map((item, index) => (
              <View key={index} style={styles.orderItem}>
                <Image
                  source={{
                    uri:
                      item.posts?.image_url ||
                      item.menu_items?.image_url ||
                      "https://via.placeholder.com/50",
                  }}
                  style={styles.itemImage}
                />
                <View style={styles.itemDetails}>
                  <Text style={styles.itemName}>
                    {item.posts?.title || item.menu_items?.name}
                  </Text>
                  <Text style={styles.itemDescription} numberOfLines={1}>
                    {item.posts?.description || item.menu_items?.description}
                  </Text>
                  <View style={styles.itemMeta}>
                    <Text style={styles.itemQuantity}>
                      Qty: {item.quantity}
                    </Text>
                    <Text style={styles.itemPrice}>
                      AED {item.unit_price} × {item.quantity}
                    </Text>
                  </View>
                  {item.special_instructions && (
                    <Text style={styles.itemInstructions}>
                      Note: {item.special_instructions}
                    </Text>
                  )}
                </View>
                <Text style={styles.itemTotal}>
                  AED {(item.unit_price * item.quantity).toFixed(2)}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Order Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Summary</Text>
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal</Text>
              <Text style={styles.summaryValue}>
                AED {order.total_amount?.toFixed(2)}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Delivery Fee</Text>
              <Text style={styles.summaryValue}>
                AED {order.delivery_fee?.toFixed(2)}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Tax (5%)</Text>
              <Text style={styles.summaryValue}>
                AED {order.tax_amount?.toFixed(2)}
              </Text>
            </View>
            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>
                AED {order.final_amount?.toFixed(2)}
              </Text>
            </View>
            <View style={styles.paymentInfo}>
              <Text style={styles.paymentMethod}>
                Payment: {order.payment_method?.toUpperCase()}
              </Text>
              <Text
                style={[
                  styles.paymentStatus,
                  {
                    color:
                      order.payment_status === "completed"
                        ? "#10B981"
                        : "#F59E0B",
                  },
                ]}
              >
                {order.payment_status?.toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        {/* Delivery Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delivery Details</Text>
          <View style={styles.deliveryCard}>
            <View style={styles.deliveryInfo}>
              <Ionicons name="location" size={16} color="#FF6B35" />
              <View style={styles.deliveryAddress}>
                <Text style={styles.deliveryLabel}>Delivery Address</Text>
                <Text style={styles.deliveryText}>
                  {order.delivery_address?.address_line1 ||
                    "No address provided"}
                </Text>
                {order.delivery_address?.address_line2 && (
                  <Text style={styles.deliveryText}>
                    {order.delivery_address.address_line2}
                  </Text>
                )}
              </View>
            </View>
            {order.special_instructions && (
              <View style={styles.instructionsContainer}>
                <Ionicons name="document-text" size={16} color="#6B7280" />
                <Text style={styles.instructionsText}>
                  {order.special_instructions}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Map Section */}
        {(restaurantLocation || driverLocation) && (
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.mapHeader}
              onPress={() => setShowMap(!showMap)}
              activeOpacity={0.8}
            >
              <Ionicons name="map" size={20} color="#FF6B35" />
              <Text style={styles.mapTitle}>
                {showMap ? "Hide Map" : "Show Delivery Map"}
              </Text>
              <Ionicons
                name={showMap ? "chevron-up" : "chevron-down"}
                size={20}
                color="#6B7280"
              />
            </TouchableOpacity>

            {showMap && mapRegion && (
              <>
                <MapView
                  style={styles.map}
                  provider={PROVIDER_GOOGLE}
                  region={mapRegion}
                  showsUserLocation={true}
                >
                  {/* Restaurant Marker */}
                  {restaurantLocation && (
                    <Marker coordinate={restaurantLocation}>
                      <View style={styles.restaurantMarker}>
                        <Ionicons name="restaurant" size={24} color="#FF6B35" />
                      </View>
                    </Marker>
                  )}

                  {/* Driver Marker */}
                  {driverLocation && (
                    <Marker coordinate={driverLocation}>
                      <View style={styles.driverMarker}>
                        <Ionicons name="bicycle" size={20} color="#3B82F6" />
                      </View>
                    </Marker>
                  )}

                  {/* User Marker */}
                  {userLocation && (
                    <Marker coordinate={userLocation}>
                      <View style={styles.userMarker}>
                        <Ionicons name="person" size={20} color="#10B981" />
                      </View>
                    </Marker>
                  )}

                  {/* Route Line */}
                  {routeCoordinates.length > 1 && (
                    <Polyline
                      coordinates={routeCoordinates}
                      strokeColor="#3B82F6"
                      strokeWidth={3}
                    />
                  )}
                </MapView>

                <View style={styles.mapLegend}>
                  <View style={styles.legendItem}>
                    <View
                      style={[styles.legendDot, { backgroundColor: "#FF6B35" }]}
                    />
                    <Text style={styles.legendText}>Restaurant</Text>
                  </View>
                  {driverLocation && (
                    <View style={styles.legendItem}>
                      <View
                        style={[
                          styles.legendDot,
                          { backgroundColor: "#3B82F6" },
                        ]}
                      />
                      <Text style={styles.legendText}>Driver</Text>
                    </View>
                  )}
                  {userLocation && (
                    <View style={styles.legendItem}>
                      <View
                        style={[
                          styles.legendDot,
                          { backgroundColor: "#10B981" },
                        ]}
                      />
                      <Text style={styles.legendText}>Your Location</Text>
                    </View>
                  )}
                </View>
              </>
            )}
          </View>
        )}

        {/* Order Updates */}
        {orderUpdates.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Order Updates</Text>
            <View style={styles.updatesList}>
              {orderUpdates.slice(0, 5).map((update, index) => (
                <View key={index} style={styles.updateItem}>
                  <View style={styles.updateIcon}>
                    <Ionicons name="notifications" size={14} color="#FF6B35" />
                  </View>
                  <View style={styles.updateContent}>
                    <Text style={styles.updateTitle}>{update.title}</Text>
                    <Text style={styles.updateMessage}>{update.message}</Text>
                    <Text style={styles.updateTime}>
                      {formatTime(update.created_at)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Reviews */}
        {reviews.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Review</Text>
            <View style={styles.reviewCard}>
              {reviews.map((review, index) => (
                <View key={index} style={styles.reviewItem}>
                  <View style={styles.reviewRating}>
                    {[...Array(5)].map((_, i) => (
                      <Ionicons
                        key={i}
                        name={i < review.rating ? "star" : "star-outline"}
                        size={16}
                        color="#FFD700"
                      />
                    ))}
                  </View>
                  {review.comment && (
                    <Text style={styles.reviewComment}>{review.comment}</Text>
                  )}
                  <Text style={styles.reviewDate}>
                    Reviewed on {formatDate(review.created_at)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.spacer} />
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        {order.status === "delivered" ? (
          <>
            <TouchableOpacity
              style={[styles.actionButton, styles.reorderButton]}
              onPress={handleReorder}
            >
              <Ionicons name="repeat" size={20} color="#FF6B35" />
              <Text style={styles.reorderButtonText}>Reorder</Text>
            </TouchableOpacity>

            {reviews.length === 0 && (
              <TouchableOpacity
                style={[styles.actionButton, styles.rateButton]}
                onPress={handleRateOrder}
              >
                <Ionicons name="star" size={20} color="#F59E0B" />
                <Text style={styles.rateButtonText}>Rate Order</Text>
              </TouchableOpacity>
            )}
          </>
        ) : (
          <TouchableOpacity
            style={[styles.actionButton, styles.trackButton]}
            onPress={handleTrackOrder}
          >
            <Ionicons name="navigate" size={20} color="white" />
            <Text style={styles.trackButtonText}>Live Track Order</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.actionButton, styles.supportButton]}
          onPress={() =>
            Alert.alert(
              "Contact Support",
              "Call: +971 1234 56789\nEmail: support@mataim.com\nWhatsApp: +971 1234 56789",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Call Now",
                  onPress: () => Linking.openURL("tel:+971123456789"),
                },
              ],
            )
          }
        >
          <Ionicons name="headset" size={20} color="#3B82F6" />
          <Text style={styles.supportButtonText}>Contact Support</Text>
        </TouchableOpacity>

        {order.status === "delivered" && (
          <TouchableOpacity
            style={[styles.actionButton, styles.issueButton]}
            onPress={() =>
              router.push({
                pathname: "/orders/report-issue",
                params: {
                  orderId: order.id,
                  orderNumber: order.order_number,
                },
              })
            }
          >
            <Ionicons name="alert-circle" size={20} color="#EF4444" />
            <Text style={styles.issueButtonText}>Report Issue</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3F4F6",
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
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 20,
  },
  errorContent: {
    alignItems: "center",
  },
  errorTitle: {
    fontSize: 18,
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
  backButton: {
    backgroundColor: "#FF6B35",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
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
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  content: {
    flex: 1,
    padding: 16,
  },
  statusCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  statusHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  statusIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    overflow: "hidden",
  },
  statusAnimation: {
    width: 60,
    height: 60,
  },
  statusInfo: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  statusDescription: {
    fontSize: 14,
    color: "#6B7280",
  },
  orderInfo: {
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  orderInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  orderLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginLeft: 8,
    marginRight: 12,
    flex: 1,
  },
  orderValue: {
    fontSize: 12,
    fontWeight: "500",
    color: "#111827",
  },
  progressContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  progressStep: {
    alignItems: "center",
    position: "relative",
    flex: 1,
  },
  progressDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#E5E7EB",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  activeDot: {
    backgroundColor: "#FF6B35",
  },
  currentDot: {
    backgroundColor: "#FF6B35",
    borderWidth: 3,
    borderColor: "#FF6B3520",
  },
  progressLabel: {
    fontSize: 10,
    color: "#9CA3AF",
    textAlign: "center",
  },
  activeLabel: {
    color: "#111827",
    fontWeight: "500",
  },
  progressLine: {
    position: "absolute",
    top: 12,
    left: "60%",
    right: "-40%",
    height: 2,
    backgroundColor: "#E5E7EB",
    zIndex: -1,
  },
  activeLine: {
    backgroundColor: "#FF6B35",
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
  },
  restaurantCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 8, // Add this for spacing between buttons
  },
  restaurantImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  restaurantInfo: {
    flex: 1,
    marginLeft: 12,
  },
  restaurantName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 2,
  },
  restaurantCuisine: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 4,
  },
  restaurantMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  restaurantRating: {
    fontSize: 12,
    color: "#F59E0B",
  },
  restaurantDistance: {
    fontSize: 12,
    color: "#6B7280",
  },
  callButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#EFF6FF",
    borderRadius: 20,
  },
  callText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#3B82F6",
  },
  driverCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  driverImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  driverInfo: {
    flex: 1,
    marginLeft: 12,
  },
  driverName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 4,
  },
  driverStats: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 4,
  },
  driverRating: {
    fontSize: 12,
    color: "#F59E0B",
  },
  driverDeliveries: {
    fontSize: 12,
    color: "#6B7280",
  },
  driverVehicle: {
    fontSize: 12,
    color: "#6B7280",
  },
  itemsList: {
    backgroundColor: "white",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  orderItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  itemImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
  },
  itemDetails: {
    flex: 1,
    marginLeft: 12,
  },
  itemName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 2,
  },
  itemDescription: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 4,
  },
  itemMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  itemQuantity: {
    fontSize: 12,
    color: "#6B7280",
  },
  itemPrice: {
    fontSize: 12,
    color: "#6B7280",
  },
  itemInstructions: {
    fontSize: 12,
    color: "#F59E0B",
    fontStyle: "italic",
  },
  itemTotal: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    marginLeft: 12,
  },
  summaryCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 14,
    color: "#6B7280",
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: "500",
    color: "#111827",
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingTop: 12,
    marginTop: 4,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  totalValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  paymentInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  paymentMethod: {
    fontSize: 12,
    color: "#6B7280",
  },
  paymentStatus: {
    fontSize: 12,
    fontWeight: "500",
  },
  deliveryCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  deliveryInfo: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  deliveryAddress: {
    flex: 1,
    marginLeft: 12,
  },
  deliveryLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 4,
  },
  deliveryText: {
    fontSize: 14,
    color: "#111827",
  },
  instructionsContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 12,
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
  },
  instructionsText: {
    flex: 1,
    fontSize: 14,
    color: "#6B7280",
    marginLeft: 8,
  },
  mapHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "white",
    padding: 16,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  mapTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginLeft: 8,
  },
  map: {
    height: 200,
    width: "100%",
  },
  restaurantMarker: {
    backgroundColor: "white",
    padding: 4,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#FF6B35",
  },
  driverMarker: {
    backgroundColor: "white",
    padding: 4,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: "#3B82F6",
  },
  userMarker: {
    backgroundColor: "white",
    padding: 4,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: "#10B981",
  },
  mapLegend: {
    flexDirection: "row",
    justifyContent: "space-around",
    padding: 12,
    backgroundColor: "white",
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderTopWidth: 0,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 12,
    color: "#6B7280",
  },
  updatesList: {
    backgroundColor: "white",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 42,
  },
  updateItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  updateIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#FF6B3520",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  updateContent: {
    flex: 1,
  },
  updateTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 2,
  },
  updateMessage: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 4,
  },
  updateTime: {
    fontSize: 10,
    color: "#9CA3AF",
  },
  reviewCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  reviewItem: {
    marginBottom: 12,
  },
  reviewRating: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  reviewComment: {
    fontSize: 14,
    color: "#111827",
    marginBottom: 8,
  },
  reviewDate: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  spacer: {
    height: 100,
  },
  actionButtons: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "white",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    padding: 16,
    paddingBottom: 32,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    flex: 1,
    minWidth: "30%",
    gap: 8,
  },
  reorderButton: {
    backgroundColor: "#FF6B3510",
    borderWidth: 1,
    borderColor: "#FF6B35",
  },
  reorderButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FF6B35",
  },
  rateButton: {
    backgroundColor: "#F59E0B10",
    borderWidth: 1,
    borderColor: "#F59E0B",
  },
  rateButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#F59E0B",
  },
  trackButton: {
    backgroundColor: "#FF6B35",
  },
  trackButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "white",
  },
  supportButton: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  supportButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#3B82F6",
  },
  issueButton: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  issueButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#EF4444",
  },

  driverActions: {
    flexDirection: "column",
    gap: 8,
  },
  messageButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3E8FF",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  messageButtonText: {
    color: "#8B5CF6",
    fontSize: 12,
    fontWeight: "600",
  },
});
