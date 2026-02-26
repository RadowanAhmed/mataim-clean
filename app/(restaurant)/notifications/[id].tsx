// app/(restaurant)/notifications/[id].tsx
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
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";

export default function RestaurantNotificationDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();

  const [notification, setNotification] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [orderDetails, setOrderDetails] = useState<any>(null);
  const [customerLocation, setCustomerLocation] = useState<any>(null);
  const [driverLocation, setDriverLocation] = useState<any>(null);
  const [restaurantLocation, setRestaurantLocation] = useState<any>(null);
  const [showMap, setShowMap] = useState(false);
  const [mapRegion, setMapRegion] = useState<any>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<any[]>([]);
  const [preparationTime, setPreparationTime] = useState<number>(0);
  const [availableDrivers, setAvailableDrivers] = useState<any[]>([]);
  const [assigningDriver, setAssigningDriver] = useState(false);
  const [preparationTimer, setPreparationTimer] =
    useState<NodeJS.Timeout | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);

  useEffect(() => {
    fetchNotificationDetails();
    getRestaurantLocation();
    return () => {
      if (preparationTimer) clearInterval(preparationTimer);
    };
  }, [id]);

  const getRestaurantLocation = async () => {
    try {
      const { data: restaurant } = await supabase
        .from("restaurants")
        .select("latitude, longitude")
        .eq("id", user?.id)
        .single();

      if (restaurant?.latitude && restaurant?.longitude) {
        const location = {
          latitude: parseFloat(restaurant.latitude),
          longitude: parseFloat(restaurant.longitude),
          title: "Your Restaurant",
        };
        setRestaurantLocation(location);
      }
    } catch (error) {
      console.error("Error getting restaurant location:", error);
    }
  };

  const fetchNotificationDetails = async () => {
    try {
      setLoading(true);

      // Fetch notification
      const { data: notificationData, error: notifError } = await supabase
        .from("restaurant_notifications")
        .select("*")
        .eq("id", id)
        .single();

      if (notifError) throw notifError;
      setNotification(notificationData);

      // Mark as read
      if (!notificationData.read) {
        await supabase
          .from("restaurant_notifications")
          .update({ read: true, read_at: new Date().toISOString() })
          .eq("id", id);
      }

      // If notification has order_id, fetch order details
      if (notificationData.data?.order_id) {
        const { data: orderData } = await supabase
          .from("orders")
          .select(
            `
            *,
            customers!inner(
              *,
              users!inner(full_name, phone, email, profile_image_url)
            ),
            delivery_users!inner(
              *,
              users!inner(full_name, profile_image_url, phone)
            ),
            order_items(
              *,
              posts!inner(title, image_url, discount_percentage, preparation_time),
              menu_items!inner(name, image_url, price, preparation_time)
            )
          `,
          )
          .eq("id", notificationData.data.order_id)
          .single();

        if (orderData) {
          setOrderDetails(orderData);

          // Get customer address location
          if (orderData.customers?.latitude && orderData.customers?.longitude) {
            const customerLoc = {
              latitude: parseFloat(orderData.customers.latitude),
              longitude: parseFloat(orderData.customers.longitude),
              title: orderData.customers.users?.full_name,
            };
            setCustomerLocation(customerLoc);
          }

          // Get driver location
          if (
            orderData.delivery_users?.current_location_lat &&
            orderData.delivery_users?.current_location_lng
          ) {
            const driverLoc = {
              latitude: parseFloat(
                orderData.delivery_users.current_location_lat,
              ),
              longitude: parseFloat(
                orderData.delivery_users.current_location_lng,
              ),
              title: orderData.delivery_users.users?.full_name,
            };
            setDriverLocation(driverLoc);
          }

          // Calculate total preparation time
          let totalPrepTime = 0;
          if (orderData.order_items) {
            orderData.order_items.forEach((item: any) => {
              const prepTime =
                item.posts?.preparation_time ||
                item.menu_items?.preparation_time ||
                15;
              totalPrepTime = Math.max(totalPrepTime, prepTime);
            });
          }
          setPreparationTime(totalPrepTime);
          setTimeRemaining(totalPrepTime * 60); // Convert to seconds

          // Start preparation timer if order is being prepared
          if (orderData.status === "preparing") {
            startPreparationTimer(totalPrepTime);
          }

          // Setup map region
          setupMapRegion(orderData);
        }
      }
    } catch (error) {
      console.error("Error fetching notification:", error);
      Alert.alert("Error", "Failed to load notification details");
    } finally {
      setLoading(false);
    }
  };

  const setupMapRegion = (orderData: any) => {
    const locations = [];

    if (restaurantLocation) locations.push(restaurantLocation);
    if (customerLocation) locations.push(customerLocation);
    if (driverLocation) locations.push(driverLocation);

    if (locations.length > 0) {
      // Calculate bounds
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

      // Set route coordinates
      if (restaurantLocation && customerLocation) {
        setRouteCoordinates([restaurantLocation, customerLocation]);
      }
    }
  };

  const startPreparationTimer = (minutes: number) => {
    if (preparationTimer) clearInterval(preparationTimer);

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 0) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    setPreparationTimer(timer);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleUpdateOrderStatus = async (newStatus: string) => {
    if (!orderDetails?.id) return;

    Alert.alert(
      "Update Order Status",
      `Change order status to ${newStatus.replace(/_/g, " ")}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: async () => {
            try {
              const updateData: any = {
                status: newStatus,
                updated_at: new Date().toISOString(),
              };

              // Start preparation timer if status is preparing
              if (newStatus === "preparing") {
                updateData.estimated_delivery_time = new Date(
                  Date.now() + (preparationTime + 20) * 60000,
                ).toISOString();
                startPreparationTimer(preparationTime);
              }

              // If marking as ready, find available drivers
              if (newStatus === "ready") {
                await findAvailableDrivers();
                if (preparationTimer) clearInterval(preparationTimer);
              }

              const { error } = await supabase
                .from("orders")
                .update(updateData)
                .eq("id", orderDetails.id);

              if (error) throw error;

              Alert.alert("Success", `Order status updated to ${newStatus}`);
              fetchNotificationDetails();
            } catch (error) {
              console.error("Update error:", error);
              Alert.alert("Error", "Failed to update order status");
            }
          },
        },
      ],
    );
  };

  const findAvailableDrivers = async () => {
    try {
      setAssigningDriver(true);

      const { data: drivers } = await supabase.rpc("find_nearest_driver", {
        p_restaurant_id: user?.id,
        p_radius_km: 10,
      });

      if (drivers && drivers.length > 0) {
        setAvailableDrivers(drivers);
        showDriverSelection(drivers);
      } else {
        Alert.alert(
          "No Drivers Available",
          "No drivers are currently available in your area. Please try again later.",
        );
      }
    } catch (error) {
      console.error("Error finding drivers:", error);
      Alert.alert("Error", "Failed to find available drivers");
    } finally {
      setAssigningDriver(false);
    }
  };

  const showDriverSelection = (drivers: any[]) => {
    Alert.alert(
      "Assign Driver",
      "Select a driver to assign to this order:",
      drivers
        .map((driver) => ({
          text: `${driver.driver_name} (${driver.distance_km?.toFixed(1)} km away) ⭐${driver.rating}`,
          onPress: () => assignDriverToOrder(driver.driver_id),
        }))
        .concat([{ text: "Cancel", style: "cancel" }]),
    );
  };

  const assignDriverToOrder = async (driverId: string) => {
    try {
      const { error } = await supabase
        .from("orders")
        .update({
          driver_id: driverId,
          status: "out_for_delivery",
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderDetails.id);

      if (error) throw error;

      // Update driver status
      await supabase
        .from("delivery_users")
        .update({ driver_status: "busy" })
        .eq("id", driverId);

      Alert.alert("Success", "Driver assigned successfully!");
      fetchNotificationDetails();
    } catch (error) {
      console.error("Assign driver error:", error);
      Alert.alert("Error", "Failed to assign driver");
    }
  };

  const handleViewOrderDetails = () => {
    if (orderDetails?.id) {
      router.push(`/(restaurant)/orders/${orderDetails.id}`);
    }
  };

  const handleContactCustomer = () => {
    if (orderDetails?.customers?.users?.phone) {
      Linking.openURL(`tel:${orderDetails.customers.users.phone}`).catch(
        (err) => {
          Alert.alert("Error", "Unable to make phone call");
        },
      );
    }
  };

  const handleContactDriver = () => {
    if (orderDetails?.delivery_users?.users?.phone) {
      Linking.openURL(`tel:${orderDetails.delivery_users.users.phone}`).catch(
        (err) => {
          Alert.alert("Error", "Unable to make phone call");
        },
      );
    }
  };

  const handlePrintReceipt = () => {
    if (orderDetails) {
      const receiptText = `
        =================================
                 RESTAURANT RECEIPT
        =================================
        Order #: ${orderDetails.order_number}
        Date: ${new Date(orderDetails.created_at).toLocaleString()}
        
        Items:
        ${orderDetails.order_items
          ?.map(
            (item: any, index: number) => `
        ${index + 1}. ${item.posts?.title || item.menu_items?.name}
           Qty: ${item.quantity} × AED ${item.unit_price}
           Total: AED ${(item.unit_price * item.quantity).toFixed(2)}
        `,
          )
          .join("")}
        
        Subtotal: AED ${orderDetails.total_amount?.toFixed(2)}
        Delivery: AED ${orderDetails.delivery_fee?.toFixed(2)}
        Tax: AED ${orderDetails.tax_amount?.toFixed(2)}
        ---------------------------------
        TOTAL: AED ${orderDetails.final_amount?.toFixed(2)}
        =================================
        Customer: ${orderDetails.customers?.users?.full_name}
        Phone: ${orderDetails.customers?.users?.phone}
        Payment: ${orderDetails.payment_method?.toUpperCase()}
        Status: ${orderDetails.payment_status?.toUpperCase()}
        =================================
      `;

      Alert.alert("Order Receipt", receiptText);
    }
  };

  const getStatusActions = () => {
    switch (orderDetails?.status) {
      case "pending":
        return [
          {
            label: "Confirm Order",
            status: "confirmed",
            color: "#10B981",
            icon: "checkmark-circle",
          },
          {
            label: "Reject Order",
            status: "cancelled",
            color: "#EF4444",
            icon: "close-circle",
          },
        ];
      case "confirmed":
        return [
          {
            label: "Start Preparing",
            status: "preparing",
            color: "#F59E0B",
            icon: "restaurant",
          },
        ];
      case "preparing":
        return [
          {
            label: "Mark as Ready",
            status: "ready",
            color: "#8B5CF6",
            icon: "checkmark-done",
          },
        ];
      case "ready":
        return [
          {
            label: "Assign Driver",
            status: "out_for_delivery",
            color: "#3B82F6",
            icon: "person-add",
          },
        ];
      default:
        return [];
    }
  };

  const getPreparationProgress = () => {
    if (orderDetails?.status !== "preparing") return 0;
    const totalSeconds = preparationTime * 60;
    return ((totalSeconds - timeRemaining) / totalSeconds) * 100;
  };

  if (loading) {
    return (
      <SafeAreaView>
        <View style={styles.loadingContainer}>
          <Text>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const statusActions = getStatusActions();

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() =>
            router.push("/(restaurant)/notifications/restaurant_notifications")
          }
        >
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Restaurant Order</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Notification Card */}
        <View style={styles.notificationCard}>
          <View style={styles.notificationHeader}>
            <Ionicons name="restaurant" size={28} color="#FF6B35" />
            <View style={styles.notificationInfo}>
              <Text style={styles.notificationTitle}>
                {notification?.title}
              </Text>
              <Text style={styles.notificationBody}>{notification?.body}</Text>
              <Text style={styles.notificationTime}>
                {new Date(notification?.created_at).toLocaleString()}
              </Text>
            </View>
          </View>

          <View style={styles.orderAlert}>
            <Ionicons name="alert-circle" size={20} color="#F59E0B" />
            <Text style={styles.alertText}>This order requires attention</Text>
          </View>
        </View>

        {/* Order Status & Timer */}
        <View style={styles.statusSection}>
          <View style={styles.statusHeader}>
            <Text style={styles.sectionTitle}>Order Status</Text>
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor:
                    orderDetails?.status === "delivered"
                      ? "#10B98120"
                      : orderDetails?.status === "out_for_delivery"
                        ? "#3B82F620"
                        : orderDetails?.status === "preparing"
                          ? "#F59E0B20"
                          : orderDetails?.status === "cancelled"
                            ? "#EF444420"
                            : "#6B728020",
                },
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  {
                    color:
                      orderDetails?.status === "delivered"
                        ? "#10B981"
                        : orderDetails?.status === "out_for_delivery"
                          ? "#3B82F6"
                          : orderDetails?.status === "preparing"
                            ? "#F59E0B"
                            : orderDetails?.status === "cancelled"
                              ? "#EF4444"
                              : "#6B7280",
                  },
                ]}
              >
                {orderDetails?.status?.replace(/_/g, " ").toUpperCase()}
              </Text>
            </View>
          </View>

          {orderDetails?.status === "preparing" && (
            <View style={styles.timerCard}>
              <View style={styles.timerHeader}>
                <Ionicons name="time" size={20} color="#F59E0B" />
                <Text style={styles.timerTitle}>Preparation Time</Text>
                <Text style={styles.timerCountdown}>
                  {formatTime(timeRemaining)}
                </Text>
              </View>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${getPreparationProgress()}%` },
                  ]}
                />
              </View>
              <Text style={styles.timerNote}>
                Estimated completion: {preparationTime} minutes
              </Text>
            </View>
          )}
        </View>

        {/* Order Information */}
        {orderDetails && (
          <View style={styles.orderSection}>
            <Text style={styles.sectionTitle}>Order Details</Text>

            <View style={styles.orderCard}>
              {/* Order Header */}
              <View style={styles.orderHeader}>
                <View>
                  <Text style={styles.orderNumber}>
                    #{orderDetails.order_number}
                  </Text>
                  <Text style={styles.orderTime}>
                    {new Date(orderDetails.created_at).toLocaleString()}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.printButton}
                  onPress={handlePrintReceipt}
                >
                  <Ionicons name="print" size={18} color="#6B7280" />
                  <Text style={styles.printText}>Print</Text>
                </TouchableOpacity>
              </View>

              {/* Customer Information */}
              <View style={styles.customerCard}>
                <Image
                  source={{
                    uri:
                      orderDetails.customers?.users?.profile_image_url ||
                      "https://via.placeholder.com/40",
                  }}
                  style={styles.customerImage}
                />
                <View style={styles.customerInfo}>
                  <View style={styles.customerHeader}>
                    <Text style={styles.customerName}>
                      {orderDetails.customers?.users?.full_name}
                    </Text>
                    <TouchableOpacity
                      style={styles.callButtonSmall}
                      onPress={handleContactCustomer}
                    >
                      <Ionicons name="call" size={14} color="#3B82F6" />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.customerPhone}>
                    📱 {orderDetails.customers?.users?.phone}
                  </Text>
                  <Text style={styles.customerAddress}>
                    📍 {orderDetails.delivery_address?.address_line1}
                  </Text>
                  {orderDetails.special_instructions && (
                    <View style={styles.instructionsBox}>
                      <Ionicons
                        name="document-text"
                        size={14}
                        color="#6B7280"
                      />
                      <Text style={styles.instructionsText}>
                        Note: {orderDetails.special_instructions}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Order Items */}
              <View style={styles.itemsSection}>
                <Text style={styles.itemsTitle}>
                  Order Items ({orderDetails.order_items?.length || 0})
                </Text>
                {orderDetails.order_items?.map((item: any, index: number) => (
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
                      <Text style={styles.itemPrice}>
                        AED {item.unit_price} × {item.quantity}
                      </Text>
                      {item.posts?.discount_percentage && (
                        <Text style={styles.discountBadge}>
                          {item.posts.discount_percentage}% OFF
                        </Text>
                      )}
                      {item.special_instructions && (
                        <Text style={styles.itemNote}>
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

              {/* Order Summary */}
              <View style={styles.summaryCard}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Subtotal</Text>
                  <Text style={styles.summaryValue}>
                    AED {orderDetails.total_amount?.toFixed(2)}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Delivery Fee</Text>
                  <Text style={styles.summaryValue}>
                    AED {orderDetails.delivery_fee?.toFixed(2)}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Tax (5%)</Text>
                  <Text style={styles.summaryValue}>
                    AED {orderDetails.tax_amount?.toFixed(2)}
                  </Text>
                </View>
                <View style={[styles.summaryRow, styles.totalRow]}>
                  <Text style={styles.totalLabel}>Total Amount</Text>
                  <Text style={styles.totalValue}>
                    AED {orderDetails.final_amount?.toFixed(2)}
                  </Text>
                </View>
                <View style={styles.paymentRow}>
                  <Text style={styles.paymentMethod}>
                    Payment: {orderDetails.payment_method?.toUpperCase()}
                  </Text>
                  <Text
                    style={[
                      styles.paymentStatus,
                      {
                        color:
                          orderDetails.payment_status === "completed"
                            ? "#10B981"
                            : "#F59E0B",
                      },
                    ]}
                  >
                    {orderDetails.payment_status?.toUpperCase()}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Driver Information */}
        {orderDetails?.delivery_users && (
          <View style={styles.driverSection}>
            <Text style={styles.sectionTitle}>Delivery Partner</Text>
            <View style={styles.driverCard}>
              <Image
                source={{
                  uri:
                    orderDetails.delivery_users?.users?.profile_image_url ||
                    "https://via.placeholder.com/50",
                }}
                style={styles.driverImage}
              />
              <View style={styles.driverInfo}>
                <View style={styles.driverHeader}>
                  <Text style={styles.driverName}>
                    {orderDetails.delivery_users?.users?.full_name}
                  </Text>
                  <TouchableOpacity
                    style={styles.callButtonSmall}
                    onPress={handleContactDriver}
                  >
                    <Ionicons name="call" size={14} color="#3B82F6" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.driverPhone}>
                  📱 {orderDetails.delivery_users?.users?.phone}
                </Text>
                <View style={styles.driverStats}>
                  <Text style={styles.driverRating}>
                    ⭐ {orderDetails.delivery_users?.rating?.toFixed(1)}/5.0
                  </Text>
                  <Text style={styles.driverDeliveries}>
                    📦 {orderDetails.delivery_users?.total_deliveries}{" "}
                    deliveries
                  </Text>
                </View>
                <View style={styles.vehicleInfo}>
                  <Ionicons name="car" size={14} color="#6B7280" />
                  <Text style={styles.vehicleText}>
                    {orderDetails.delivery_users?.vehicle_type} •{" "}
                    {orderDetails.delivery_users?.vehicle_plate}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Map Section */}
        {(restaurantLocation || customerLocation) && (
          <View style={styles.mapSection}>
            <View style={styles.mapHeader}>
              <Ionicons name="map" size={20} color="#FF6B35" />
              <Text style={styles.mapTitle}>Delivery Route</Text>
              <TouchableOpacity onPress={() => setShowMap(!showMap)}>
                <Ionicons
                  name={showMap ? "chevron-up" : "chevron-down"}
                  size={20}
                  color="#6B7280"
                />
              </TouchableOpacity>
            </View>

            {showMap && mapRegion && (
              <>
                <MapView
                  style={styles.map}
                  provider={PROVIDER_GOOGLE}
                  region={mapRegion}
                >
                  {/* Restaurant Marker */}
                  {restaurantLocation && (
                    <Marker coordinate={restaurantLocation}>
                      <View style={styles.restaurantMarker}>
                        <Ionicons name="restaurant" size={24} color="#FF6B35" />
                      </View>
                    </Marker>
                  )}

                  {/* Customer Marker */}
                  {customerLocation && (
                    <Marker coordinate={customerLocation}>
                      <View style={styles.customerMarker}>
                        <Ionicons name="home" size={20} color="#10B981" />
                      </View>
                    </Marker>
                  )}

                  {/* Driver Marker */}
                  {driverLocation && (
                    <Marker coordinate={driverLocation}>
                      <View style={styles.driverMarker}>
                        <Ionicons name="bicycle" size={18} color="#3B82F6" />
                      </View>
                    </Marker>
                  )}

                  {/* Route Line */}
                  {routeCoordinates.length > 1 && (
                    <Polyline
                      coordinates={routeCoordinates}
                      strokeColor="#3B82F6"
                      strokeWidth={3}
                      lineDashPattern={[5, 5]}
                    />
                  )}
                </MapView>

                <View style={styles.distanceInfo}>
                  <View style={styles.distanceItem}>
                    <Ionicons name="restaurant" size={16} color="#FF6B35" />
                    <Text style={styles.distanceLabel}>Your Location</Text>
                  </View>
                  <View style={styles.distanceItem}>
                    <Ionicons name="arrow-forward" size={16} color="#6B7280" />
                    <Text style={styles.distanceValue}>
                      {routeCoordinates.length > 1
                        ? "~5.2 km"
                        : "Calculating..."}
                    </Text>
                  </View>
                  <View style={styles.distanceItem}>
                    <Ionicons name="home" size={16} color="#10B981" />
                    <Text style={styles.distanceLabel}>Customer</Text>
                  </View>
                </View>
              </>
            )}
          </View>
        )}

        {/* Action Buttons Section */}
        <View style={styles.actionsSection}>
          {statusActions.map((action, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.statusActionButton,
                { backgroundColor: action.color },
              ]}
              onPress={() => handleUpdateOrderStatus(action.status)}
            >
              <Ionicons name={action.icon as any} size={18} color="#fff" />
              <Text style={styles.statusActionText}>{action.label}</Text>
            </TouchableOpacity>
          ))}

          {assigningDriver && (
            <View style={styles.loadingButton}>
              <ActivityIndicator color="#3B82F6" />
              <Text style={styles.loadingText}>Finding Drivers...</Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.viewOrderButton}
            onPress={handleViewOrderDetails}
          >
            <Ionicons name="document-text" size={18} color="#FF6B35" />
            <Text style={styles.viewOrderText}>View Full Order Details</Text>
          </TouchableOpacity>

          <View style={styles.quickActions}>
            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={handleContactCustomer}
            >
              <Ionicons name="call" size={16} color="#3B82F6" />
              <Text style={styles.quickActionText}>Call Customer</Text>
            </TouchableOpacity>

            {orderDetails?.delivery_users && (
              <TouchableOpacity
                style={styles.quickActionButton}
                onPress={handleContactDriver}
              >
                <Ionicons name="bicycle" size={16} color="#10B981" />
                <Text style={styles.quickActionText}>Call Driver</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={() => Linking.openURL("tel:+971123456789")}
            >
              <Ionicons name="headset" size={16} color="#8B5CF6" />
              <Text style={styles.quickActionText}>Support</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // Add your styles here
  container: { flex: 1, backgroundColor: "#F3F4F6" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
  },
  content: { flex: 1, padding: 16 },
  notificationCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: "#FF6B35",
  },
  notificationHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  notificationInfo: {
    marginLeft: 12,
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  notificationBody: {
    fontSize: 14,
    color: "#6B7280",
    lineHeight: 20,
    marginBottom: 8,
  },
  notificationTime: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  orderAlert: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFBEB",
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  alertText: {
    fontSize: 14,
    color: "#92400E",
    marginLeft: 8,
  },
  statusSection: { marginBottom: 16 },
  statusHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "700",
  },
  timerCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
  },
  timerHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  timerTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    flex: 1,
    marginLeft: 8,
  },
  timerCountdown: {
    fontSize: 20,
    fontWeight: "700",
    color: "#F59E0B",
  },
  progressBar: {
    height: 8,
    backgroundColor: "#E5E7EB",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 8,
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#F59E0B",
    borderRadius: 4,
  },
  timerNote: {
    fontSize: 12,
    color: "#6B7280",
    textAlign: "center",
  },
  orderSection: { marginBottom: 16 },
  orderCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
  },
  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  orderNumber: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  orderTime: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  printButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
  },
  printText: {
    fontSize: 12,
    color: "#6B7280",
    marginLeft: 4,
  },
  customerCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  customerImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  customerInfo: { flex: 1 },
  customerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  customerName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  callButtonSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#EFF6FF",
    justifyContent: "center",
    alignItems: "center",
  },
  customerPhone: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 4,
  },
  customerAddress: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 8,
  },
  instructionsBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#F3F4F6",
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  instructionsText: {
    fontSize: 12,
    color: "#6B7280",
    flex: 1,
    marginLeft: 8,
    lineHeight: 16,
  },
  itemsSection: { marginBottom: 16 },
  itemsTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 12,
  },
  orderItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  itemImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginRight: 12,
  },
  itemDetails: { flex: 1 },
  itemName: {
    fontSize: 14,
    fontWeight: "500",
    color: "#111827",
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 4,
  },
  discountBadge: {
    fontSize: 10,
    color: "#10B981",
    backgroundColor: "#10B98120",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: "flex-start",
    marginBottom: 4,
  },
  itemNote: {
    fontSize: 11,
    color: "#6B7280",
    fontStyle: "italic",
  },
  itemTotal: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  summaryCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    padding: 16,
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
    paddingTop: 8,
    marginTop: 4,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  totalValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  paymentRow: {
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
  driverSection: { marginBottom: 16 },
  driverCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  driverImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  driverInfo: { flex: 1 },
  driverHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  driverName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  driverPhone: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 8,
  },
  driverStats: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
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
  vehicleInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  vehicleText: {
    fontSize: 12,
    color: "#6B7280",
    marginLeft: 4,
  },
  mapSection: {
    backgroundColor: "white",
    borderRadius: 12,
    marginBottom: 16,
    overflow: "hidden",
  },
  mapHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
  },
  mapTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    flex: 1,
    marginLeft: 8,
  },
  map: {
    width: "100%",
    height: 250,
  },
  distanceInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#F9FAFB",
  },
  distanceItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  distanceLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginLeft: 6,
  },
  distanceValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    marginLeft: 6,
  },
  restaurantMarker: {
    backgroundColor: "white",
    padding: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#FF6B35",
  },
  customerMarker: {
    backgroundColor: "white",
    padding: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#10B981",
  },
  driverMarker: {
    backgroundColor: "white",
    padding: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#3B82F6",
  },
  actionsSection: { marginBottom: 24 },
  statusActionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  statusActionText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  loadingButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    marginBottom: 8,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6B7280",
    marginLeft: 8,
  },
  viewOrderButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: "white",
    borderWidth: 2,
    borderColor: "#FF6B35",
    marginBottom: 16,
  },
  viewOrderText: {
    color: "#FF6B35",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  quickActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  quickActionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  quickActionText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6B7280",
    marginLeft: 6,
  },
});
