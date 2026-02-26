// app/(restaurant)/orders/[orderId].tsx
import { useAuth } from "@/backend/AuthContext";
import { supabase } from "@/backend/supabase";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import OrderActions from "./OrderActions";
//import { calculateDistance } from "@/backend/utils/distanceCalculator";

import { useLocation } from "@/backend/LocationContext";
import { RealTimeLocationService } from "@/backend/services/RealTimeLocationService";
import animations from "@/constent/animations";
import LottieView from "lottie-react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";

import { ConversationService } from "@/backend/services/conversationService";

const DEFAULT_DRIVER_IMAGE =
  "https://i.postimg.cc/c1TwB7YX/delivery-guy-(1).png";
const DEFAULT_USER_IMAGE =
  "https://cdn-icons-png.flaticon.com/512/3135/3135715.png";

export default function RestaurantOrderDetailScreen() {
  const { orderId } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<any>(null);
  const [customer, setCustomer] = useState<any>(null);
  const [driver, setDriver] = useState<any>(null);
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [orderUpdates, setOrderUpdates] = useState<any[]>([]);

  // Add these states
  const [driverLocation, setDriverLocation] = useState<any>(null);
  const [showLiveMap, setShowLiveMap] = useState(false);
  const { subscribeToDriverLocation } = useLocation();
  const [restaurantLocation, setRestaurantLocation] = useState<any>(null);

  // Add this effect for real-time driver location
  useEffect(() => {
    if (order?.id && order.driver_id) {
      // Subscribe to driver location updates
      const unsubscribe = subscribeToDriverLocation(order.id);

      // Also fetch current driver location
      const fetchDriverLocation = async () => {
        const location = await RealTimeLocationService.getDriverLocation(
          order.driver_id,
        );
        if (location?.current_location_lat && location.current_location_lng) {
          setDriverLocation({
            latitude: parseFloat(location.current_location_lat),
            longitude: parseFloat(location.current_location_lng),
          });
        }
      };

      fetchDriverLocation();

      return () => {
        unsubscribe();
      };
    }
  }, [order?.id, order?.driver_id]);

  useEffect(() => {
    if (orderId) {
      fetchOrderDetails();
    }
  }, [orderId]);

  const fetchOrderDetails = async () => {
    try {
      setLoading(true);

      // Fetch order with related data
      const { data: orderData, error } = await supabase
        .from("orders")
        .select(
          `
        *,
        users!orders_customer_id_fkey(
          id,
          full_name,
          phone,
          email,
          profile_image_url
        ),
        delivery_users:delivery_users(
          *,
          users!inner(
            full_name,
            phone,
            profile_image_url
          )
        ),
        restaurants!inner(
          *,
          users!inner(
            full_name,
            profile_image_url
          )
        )
      `,
        )
        .eq("id", orderId)
        .single();

      if (error) throw error;
      setOrder(orderData);

      // Set customer data from users table
      if (orderData.users) {
        setCustomer({
          id: orderData.users.id,
          users: orderData.users,
        });
      }

      // Set driver data if assigned
      if (orderData.delivery_users) {
        setDriver(orderData.delivery_users);
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

      // Fetch order updates/notifications
      const { data: updatesData } = await supabase
        .from("order_notifications")
        .select("*")
        .eq("order_id", orderId)
        .eq("restaurant_id", user?.id)
        .order("created_at", { ascending: false });

      setOrderUpdates(updatesData || []);
    } catch (error) {
      console.error("Error fetching order details:", error);
      Alert.alert("Error", "Failed to load order details");
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    fetchOrderDetails();
  };

  const handleContactCustomer = () => {
    if (customer?.users?.phone) {
      Linking.openURL(`tel:${customer.users.phone}`).catch((err) => {
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

  const handleViewCustomerProfile = () => {
    if (customer?.id) {
      router.push(`/(restaurant)/customers/${customer.id}`);
    }
  };

  const handleViewDriverProfile = () => {
    if (driver?.id) {
      router.push(`/(restaurant)/drivers/${driver.id}`);
    }
  };

  const formatTime = (dateString: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

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

  // New function to get animation based on status
  const getStatusAnimation = (status: string) => {
    switch (status?.toLowerCase()) {
      case "pending":
        return animations.pending_animation;
      case "confirmed":
        return animations.confirmed_animation;
      case "preparing":
        return animations.preparing_animation;
      case "ready":
        return animations.ready_animation;
      case "out_for_delivery":
        return animations.out_for_delivery_animation;
      case "delivered":
        return animations.delivered_animation;
      case "cancelled":
        return animations.cancelled_animation;
      default:
        return animations.restaurant_cafe_cup;
    }
  };

  // Add this function to handle messaging the driver
  const handleMessageDriver = async () => {
    if (!order?.delivery_users?.id) {
      Alert.alert("No Driver", "No driver assigned to this order yet");
      return;
    }

    try {
      const conversationId =
        await ConversationService.getOrCreateRestaurantDriverConversation(
          user?.id,
          order.delivery_users.id,
          order.id,
        );

      if (conversationId) {
        router.push({
          pathname: "/(restaurant)/messages/[id]",
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

  // Add this function to handle messaging the customer
  const handleMessageCustomer = async () => {
    if (!order?.customer_id) {
      Alert.alert("No Customer", "Customer information not available");
      return;
    }

    try {
      // Check if conversation exists between restaurant and customer
      const { data: existing } = await supabase
        .from("conversations")
        .select("id")
        .eq("restaurant_id", user?.id)
        .eq("customer_id", order.customer_id)
        .maybeSingle();

      if (existing) {
        // Navigate to existing conversation
        router.push({
          pathname: "/(restaurant)/messages/[id]",
          params: { id: existing.id },
        });
      } else {
        // Create new conversation
        const { data: newConversation, error: createError } = await supabase
          .from("conversations")
          .insert({
            restaurant_id: user?.id,
            customer_id: order.customer_id,
            is_active: true,
          })
          .select("id")
          .single();

        if (createError) throw createError;

        router.push({
          pathname: "/(restaurant)/messages/[id]",
          params: { id: newConversation.id },
        });
      }
    } catch (error) {
      console.error("Error messaging customer:", error);
      Alert.alert("Error", "Failed to start conversation with customer");
    }
  };

  const calculatePreparationTime = () => {
    if (!order?.created_at || !order?.estimated_delivery_time)
      return "Calculating...";

    const created = new Date(order.created_at);
    const estimated = new Date(order.estimated_delivery_time);
    const diffMs = estimated.getTime() - created.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    return `${diffMinutes} minutes`;
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
          <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
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
        <TouchableOpacity
          onPress={() =>
            router.push("/(restaurant)/notifications/restaurant_notifications")
          }
        >
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Order Details</Text>
        <TouchableOpacity onPress={handleRefresh}>
          <Ionicons name="reload" size={20} color="#FF6B35" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Order Status Card */}
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <View
              style={[
                styles.statusIcon,
                { backgroundColor: getStatusColor(order.status) + "20" },
              ]}
            >
              {/* Replace Ionicons with Lottie animation */}
              <LottieView
                source={getStatusAnimation(order.status)}
                style={styles.statusAnimation}
                autoPlay
                loop
              />
            </View>
            <View style={styles.statusInfo}>
              <Text style={styles.statusTitle}>
                {order.status?.replace(/_/g, " ").toUpperCase()}
              </Text>
              <Text style={styles.statusSubtitle}>
                Order #{order.order_number}
              </Text>
              <Text style={styles.statusTime}>
                Placed on {formatDate(order.created_at)} at{" "}
                {formatTime(order.created_at)}
              </Text>
            </View>
          </View>

          {/* Order Progress */}
          <View style={styles.progressContainer}>
            <View style={styles.progressStep}>
              <View
                style={[
                  styles.progressDot,
                  [
                    "pending",
                    "confirmed",
                    "preparing",
                    "ready",
                    "out_for_delivery",
                    "delivered",
                  ].includes(order.status?.toLowerCase()) &&
                    styles.progressDotActive,
                ]}
              >
                {[
                  "confirmed",
                  "preparing",
                  "ready",
                  "out_for_delivery",
                  "delivered",
                ].includes(order.status?.toLowerCase()) && (
                  <Ionicons name="checkmark" size={12} color="#fff" />
                )}
              </View>
              <Text style={styles.progressLabel}>Order Placed</Text>
            </View>

            <View style={styles.progressLine} />

            <View style={styles.progressStep}>
              <View
                style={[
                  styles.progressDot,
                  [
                    "confirmed",
                    "preparing",
                    "ready",
                    "out_for_delivery",
                    "delivered",
                  ].includes(order.status?.toLowerCase()) &&
                    styles.progressDotActive,
                ]}
              >
                {[
                  "preparing",
                  "ready",
                  "out_for_delivery",
                  "delivered",
                ].includes(order.status?.toLowerCase()) && (
                  <Ionicons name="checkmark" size={12} color="#fff" />
                )}
              </View>
              <Text style={styles.progressLabel}>Confirmed</Text>
            </View>

            <View style={styles.progressLine} />

            <View style={styles.progressStep}>
              <View
                style={[
                  styles.progressDot,
                  [
                    "preparing",
                    "ready",
                    "out_for_delivery",
                    "delivered",
                  ].includes(order.status?.toLowerCase()) &&
                    styles.progressDotActive,
                ]}
              >
                {["ready", "out_for_delivery", "delivered"].includes(
                  order.status?.toLowerCase(),
                ) && <Ionicons name="checkmark" size={12} color="#fff" />}
              </View>
              <Text style={styles.progressLabel}>Preparing</Text>
            </View>

            <View style={styles.progressLine} />

            <View style={styles.progressStep}>
              <View
                style={[
                  styles.progressDot,
                  ["ready", "out_for_delivery", "delivered"].includes(
                    order.status?.toLowerCase(),
                  ) && styles.progressDotActive,
                ]}
              >
                {["out_for_delivery", "delivered"].includes(
                  order.status?.toLowerCase(),
                ) && <Ionicons name="checkmark" size={12} color="#fff" />}
              </View>
              <Text style={styles.progressLabel}>Ready</Text>
            </View>

            <View style={styles.progressLine} />

            <View style={styles.progressStep}>
              <View
                style={[
                  styles.progressDot,
                  ["out_for_delivery", "delivered"].includes(
                    order.status?.toLowerCase(),
                  ) && styles.progressDotActive,
                ]}
              >
                {["delivered"].includes(order.status?.toLowerCase()) && (
                  <Ionicons name="checkmark" size={12} color="#fff" />
                )}
              </View>
              <Text style={styles.progressLabel}>Delivered</Text>
            </View>
          </View>

          {/* Order Actions */}
          <OrderActions
            orderId={orderId as string}
            currentStatus={order.status}
            onStatusChange={fetchOrderDetails}
          />
        </View>

        {/* Customer Information */}
        {/* Customer Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Customer Information</Text>
          <TouchableOpacity
            style={styles.customerCard}
            onPress={handleViewCustomerProfile}
            activeOpacity={0.7}
          >
            <Image
              source={{
                uri: customer?.users?.profile_image_url || DEFAULT_USER_IMAGE,
              }}
              style={styles.customerImage}
            />
            <View style={styles.customerInfo}>
              <Text style={styles.customerName}>
                {customer?.users?.full_name || "Customer"}
              </Text>
              <Text style={styles.customerPhone}>
                <Ionicons
                  name="phone-portrait-outline"
                  size={12}
                  color="#6B7280"
                />{" "}
                {customer?.users?.phone || "No phone"}
              </Text>
              <Text style={styles.customerEmail}>
                <Ionicons name="mail-outline" size={12} color="#6B7280" />{" "}
                {customer?.users?.email || "No email"}
              </Text>
            </View>

            {/* Add Message Button */}
            <View style={styles.customerActions}>
              <TouchableOpacity
                style={styles.messageButton}
                onPress={handleMessageCustomer}
              >
                <Ionicons name="chatbubble-outline" size={18} color="#8B5CF6" />
                <Text style={styles.messageButtonText}>Message</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.callButton}
                onPress={handleContactCustomer}
              >
                <Ionicons name="call" size={18} color="#3B82F6" />
                <Text style={styles.callText}>Call</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </View>

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
                    {item.posts?.title || item.menu_items?.name || "Item"}
                  </Text>
                  <Text style={styles.itemDescription} numberOfLines={2}>
                    {item.posts?.description ||
                      item.menu_items?.description ||
                      "No description"}
                  </Text>
                  <View style={styles.itemMeta}>
                    <Text style={styles.itemQuantity}>
                      <Ionicons name="cube-outline" size={10} color="#6B7280" />{" "}
                      Qty: {item.quantity}
                    </Text>
                    <Text style={styles.itemPrice}>
                      AED {item.unit_price} × {item.quantity}
                    </Text>
                  </View>
                  {item.special_instructions && (
                    <Text style={styles.itemInstructions}>
                      <Ionicons
                        name="create-outline"
                        size={10}
                        color="#FF6B35"
                      />{" "}
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

        {/* Delivery Information */}
        {driver && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Delivery Partner</Text>
            <View style={styles.driverCard}>
              <TouchableOpacity onPress={handleViewDriverProfile}>
                <Image
                  source={{
                    uri:
                      driver.users?.profile_image_url || DEFAULT_DRIVER_IMAGE,
                  }}
                  style={styles.driverImage}
                />
              </TouchableOpacity>
              <View style={styles.driverInfo}>
                <Text style={styles.driverName}>
                  {driver.users?.full_name || "Driver"}
                </Text>
                <Text style={styles.driverPhone}>
                  <Ionicons
                    name="phone-portrait-outline"
                    size={12}
                    color="#6B7280"
                  />{" "}
                  {driver.users?.phone || "No phone"}
                </Text>
                <View style={styles.driverStats}>
                  <Text style={styles.driverRating}>
                    <Ionicons name="star" size={12} color="#F59E0B" />{" "}
                    {driver.rating?.toFixed(1) || "0.0"}
                  </Text>
                  <Text style={styles.driverDeliveries}>
                    <Ionicons name="cube" size={12} color="#6B7280" />{" "}
                    {driver.total_deliveries || 0} deliveries
                  </Text>
                </View>
                <Text style={styles.driverVehicle}>
                  <Ionicons name="car-outline" size={12} color="#6B7280" />{" "}
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

        {/* Order Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Summary</Text>
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>
                <Ionicons name="receipt-outline" size={12} color="#6B7280" />{" "}
                Subtotal
              </Text>
              <Text style={styles.summaryValue}>
                AED {order.total_amount?.toFixed(2) || "0.00"}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>
                <Ionicons name="bicycle" size={12} color="#6B7280" /> Delivery
                Fee
              </Text>
              <Text style={styles.summaryValue}>
                AED {order.delivery_fee?.toFixed(2) || "0.00"}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>
                <Ionicons name="calculator-outline" size={12} color="#6B7280" />{" "}
                Tax (5%)
              </Text>
              <Text style={styles.summaryValue}>
                AED {order.tax_amount?.toFixed(2) || "0.00"}
              </Text>
            </View>
            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>
                <Ionicons name="wallet-outline" size={14} color="#111827" />{" "}
                Total Amount
              </Text>
              <Text style={styles.totalValue}>
                AED {order.final_amount?.toFixed(2) || "0.00"}
              </Text>
            </View>
            <View style={styles.paymentInfo}>
              <Text style={styles.paymentMethod}>
                <Ionicons name="card-outline" size={12} color="#6B7280" />{" "}
                {order.payment_method?.toUpperCase()}
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
                <Ionicons
                  name={
                    order.payment_status === "completed"
                      ? "checkmark-circle"
                      : "time"
                  }
                  size={12}
                  color={
                    order.payment_status === "completed" ? "#10B981" : "#F59E0B"
                  }
                />{" "}
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
              <Ionicons name="location-outline" size={16} color="#FF6B35" />
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
                <Ionicons
                  name="document-text-outline"
                  size={16}
                  color="#6B7280"
                />
                <Text style={styles.instructionsText}>
                  <Text style={{ fontWeight: "600" }}>
                    Special Instructions:
                  </Text>{" "}
                  {order.special_instructions}
                </Text>
              </View>
            )}
            <View style={styles.deliveryTiming}>
              <View style={styles.timingItem}>
                <Ionicons name="timer-outline" size={14} color="#6B7280" />
                <Text style={styles.timingText}>
                  Preparation Time: {calculatePreparationTime()}
                </Text>
              </View>
              {order.estimated_delivery_time && (
                <View style={styles.timingItem}>
                  <Ionicons name="alarm-outline" size={14} color="#FF6B35" />
                  <Text style={[styles.timingText, styles.estimatedTime]}>
                    Estimated Delivery:{" "}
                    {formatTime(order.estimated_delivery_time)}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Order Updates */}
        {orderUpdates.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Order Updates</Text>
            <View style={styles.updatesList}>
              {orderUpdates.slice(0, 5).map((update, index) => (
                <View key={index} style={styles.updateItem}>
                  <View style={styles.updateIcon}>
                    <Ionicons
                      name="notifications-outline"
                      size={14}
                      color="#FF6B35"
                    />
                  </View>
                  <View style={styles.updateContent}>
                    <Text style={styles.updateTitle}>{update.title}</Text>
                    <Text style={styles.updateMessage}>{update.message}</Text>
                    <Text style={styles.updateTime}>
                      <Ionicons name="time-outline" size={10} color="#9CA3AF" />{" "}
                      {formatDate(update.created_at)} at{" "}
                      {formatTime(update.created_at)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {driverLocation && (
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.mapHeader}
              onPress={() => setShowLiveMap(!showLiveMap)}
            >
              <Ionicons name="map-outline" size={20} color="#3B82F6" />
              <Text style={styles.mapTitle}>Live Driver Location</Text>
              <Ionicons
                name={showLiveMap ? "chevron-up" : "chevron-down"}
                size={20}
                color="#6B7280"
              />
            </TouchableOpacity>

            {showLiveMap && (
              <View style={styles.mapContainer}>
                <MapView
                  style={styles.map}
                  provider={PROVIDER_GOOGLE}
                  region={{
                    latitude: driverLocation.latitude,
                    longitude: driverLocation.longitude,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                  }}
                >
                  <Marker coordinate={driverLocation}>
                    <View style={styles.liveDriverMarker}>
                      <Ionicons name="bicycle" size={24} color="#3B82F6" />
                    </View>
                  </Marker>

                  {/* Add restaurant marker if available */}
                  {restaurantLocation && (
                    <Marker coordinate={restaurantLocation}>
                      <View style={styles.restaurantMarker}>
                        <Ionicons name="restaurant" size={24} color="#FF6B35" />
                      </View>
                    </Marker>
                  )}

                  {/* Route line */}
                  {restaurantLocation && driverLocation && (
                    <Polyline
                      coordinates={[restaurantLocation, driverLocation]}
                      strokeColor="#3B82F6"
                      strokeWidth={2}
                      lineDashPattern={[5, 5]}
                    />
                  )}
                </MapView>

                <View style={styles.mapInfo}>
                  <Text style={styles.driverStatus}>
                    <Ionicons
                      name="navigate-outline"
                      size={14}
                      color="#3B82F6"
                    />
                    Driver is currently{" "}
                    {driverLocation && restaurantLocation
                      ? `en route to destination`
                      : "on the way"}
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}

        <View style={styles.spacer} />
      </ScrollView>
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
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  statusHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  statusIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
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
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  statusSubtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 4,
  },
  statusTime: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  progressContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  progressStep: {
    alignItems: "center",
  },
  progressDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#E5E7EB",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  progressDotActive: {
    backgroundColor: "#10B981",
  },
  progressLine: {
    flex: 1,
    height: 2,
    backgroundColor: "#E5E7EB",
    marginHorizontal: 4,
  },
  progressLabel: {
    fontSize: 10,
    color: "#6B7280",
    textAlign: "center",
  },
  section: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
  },
  customerCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  customerImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  customerInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 4,
  },
  customerPhone: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 2,
  },
  customerEmail: {
    fontSize: 12,
    color: "#6B7280",
  },
  callButton: {
    alignItems: "center",
    paddingHorizontal: 8,
  },
  callText: {
    fontSize: 12,
    color: "#3B82F6",
    marginTop: 2,
  },
  itemsList: {
    backgroundColor: "#fff",
    borderRadius: 12,
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
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  itemDetails: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 4,
  },
  itemDescription: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 8,
  },
  itemMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
    fontSize: 11,
    color: "#FF6B35",
    fontStyle: "italic",
  },
  itemTotal: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  driverCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  driverImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 16,
  },
  driverInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 4,
  },
  driverPhone: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 4,
  },
  driverStats: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  driverRating: {
    fontSize: 12,
    color: "#F59E0B",
    marginRight: 12,
  },
  driverDeliveries: {
    fontSize: 12,
    color: "#6B7280",
  },
  driverVehicle: {
    fontSize: 12,
    color: "#6B7280",
  },
  summaryCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
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
    fontSize: 18,
    fontWeight: "800",
    color: "#FF6B35",
  },
  paymentInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  paymentMethod: {
    fontSize: 12,
    color: "#6B7280",
  },
  paymentStatus: {
    fontSize: 12,
    fontWeight: "600",
  },
  deliveryCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
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
    marginBottom: 2,
  },
  instructionsContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#F9FAFB",
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  instructionsText: {
    flex: 1,
    fontSize: 12,
    color: "#6B7280",
    marginLeft: 8,
    lineHeight: 16,
  },
  deliveryTiming: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  timingItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  timingText: {
    fontSize: 12,
    color: "#6B7280",
    marginLeft: 6,
  },
  estimatedTime: {
    color: "#FF6B35",
    fontWeight: "600",
  },
  updatesList: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  updateItem: {
    flexDirection: "row",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  updateIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FF6B3515",
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
    marginBottom: 4,
  },
  updateMessage: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 4,
  },
  updateTime: {
    fontSize: 11,
    color: "#9CA3AF",
  },
  spacer: {
    height: 20,
  },

  mapHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    marginBottom: 8,
  },
  mapTitle: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  mapContainer: {
    height: 200,
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  map: {
    flex: 1,
  },
  liveDriverMarker: {
    backgroundColor: "#fff",
    padding: 8,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: "#3B82F6",
  },
  restaurantMarker: {
    backgroundColor: "#fff",
    padding: 8,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: "#FF6B35",
  },
  mapInfo: {
    padding: 8,
    backgroundColor: "#EFF6FF",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  driverStatus: {
    fontSize: 12,
    color: "#3B82F6",
    fontWeight: "500",
  },

  customerActions: {
    flexDirection: "column",
    gap: 8,
    marginLeft: "auto",
  },
  driverActions: {
    flexDirection: "column",
    gap: 8,
    marginLeft: "auto",
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
