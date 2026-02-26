// app/(driver)/notifications/[id].tsx
import { useAuth } from "@/backend/AuthContext";
import { supabase } from "@/backend/supabase";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";

export default function DriverNotificationDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();

  const [notification, setNotification] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [orderDetails, setOrderDetails] = useState<any>(null);
  const [restaurantLocation, setRestaurantLocation] = useState<any>(null);
  const [customerLocation, setCustomerLocation] = useState<any>(null);
  const [driverLocation, setDriverLocation] = useState<any>(null);
  const [showMap, setShowMap] = useState(false);
  const [mapRegion, setMapRegion] = useState<any>(null);
  const [currentStep, setCurrentStep] = useState<"pickup" | "delivery">(
    "pickup",
  );
  const [routeCoordinates, setRouteCoordinates] = useState<any[]>([]);

  useEffect(() => {
    fetchNotificationDetails();
    getCurrentLocation();
  }, [id]);

  const getCurrentLocation = async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;

      let location = await Location.getCurrentPositionAsync({});
      setDriverLocation(location.coords);

      // Update driver location in database
      await supabase
        .from("delivery_users")
        .update({
          current_location_lat: location.coords.latitude,
          current_location_lng: location.coords.longitude,
        })
        .eq("id", user?.id);
    } catch (error) {
      console.error("Error getting location:", error);
    }
  };

  const fetchNotificationDetails = async () => {
    try {
      setLoading(true);

      // Fetch notification
      const { data: notificationData, error: notifError } = await supabase
        .from("driver_notifications")
        .select("*")
        .eq("id", id)
        .single();

      if (notifError) throw notifError;
      setNotification(notificationData);

      // Mark as read
      if (!notificationData.read) {
        await supabase
          .from("driver_notifications")
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
            restaurants!inner(
              *,
              users!inner(full_name, phone, profile_image_url)
            ),
            customers!inner(
              *,
              users!inner(full_name, phone, profile_image_url)
            ),
            order_items(
              *,
              posts!inner(title, image_url),
              menu_items!inner(name, image_url)
            )
          `,
          )
          .eq("id", notificationData.data.order_id)
          .single();

        if (orderData) {
          setOrderDetails(orderData);

          // Get restaurant location
          if (
            orderData.restaurants?.latitude &&
            orderData.restaurants?.longitude
          ) {
            const restLoc = {
              latitude: parseFloat(orderData.restaurants.latitude),
              longitude: parseFloat(orderData.restaurants.longitude),
            };
            setRestaurantLocation(restLoc);
          }

          // Get customer location
          if (orderData.customers?.latitude && orderData.customers?.longitude) {
            const custLoc = {
              latitude: parseFloat(orderData.customers.latitude),
              longitude: parseFloat(orderData.customers.longitude),
            };
            setCustomerLocation(custLoc);
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

  const handleUpdateOrderStatus = async (newStatus: string) => {
    if (!orderDetails?.id) return;

    Alert.alert(
      "Update Delivery Status",
      `Change order status to ${newStatus}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: async () => {
            try {
              const { error } = await supabase
                .from("orders")
                .update({
                  status: newStatus,
                  updated_at: new Date().toISOString(),
                  ...(newStatus === "picked_up" && { driver_id: user?.id }),
                })
                .eq("id", orderDetails.id);

              if (error) throw error;

              // Update driver status if needed
              if (newStatus === "out_for_delivery") {
                await supabase
                  .from("delivery_users")
                  .update({ driver_status: "busy" })
                  .eq("id", user?.id);
              } else if (newStatus === "delivered") {
                await supabase
                  .from("delivery_users")
                  .update({
                    driver_status: "available",
                    total_deliveries:
                      orderDetails.delivery_users?.total_deliveries + 1 || 1,
                    earnings_today:
                      (orderDetails.delivery_users?.earnings_today || 0) +
                      (orderDetails.delivery_fee || 0),
                  })
                  .eq("id", user?.id);
              }

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

  const handleStartNavigation = () => {
    if (!restaurantLocation && !customerLocation) return;

    const destination =
      currentStep === "pickup" ? restaurantLocation : customerLocation;
    if (!destination) return;

    const url = `https://www.google.com/maps/dir/?api=1&destination=${destination.latitude},${destination.longitude}&travelmode=driving`;

    Linking.openURL(url).catch((err) => {
      Alert.alert("Error", "Unable to open navigation app");
    });
  };

  const handleCallRestaurant = () => {
    if (orderDetails?.restaurants?.users?.phone) {
      Linking.openURL(`tel:${orderDetails.restaurants.users.phone}`).catch(
        (err) => {
          Alert.alert("Error", "Unable to make phone call");
        },
      );
    }
  };

  const handleCallCustomer = () => {
    if (orderDetails?.customers?.users?.phone) {
      Linking.openURL(`tel:${orderDetails.customers.users.phone}`).catch(
        (err) => {
          Alert.alert("Error", "Unable to make phone call");
        },
      );
    }
  };

  const handleToggleStep = () => {
    setCurrentStep(currentStep === "pickup" ? "delivery" : "pickup");
  };

  const getEarningsForDelivery = () => {
    const baseFee = orderDetails?.delivery_fee || 0;
    const distanceFee = 0; // You can calculate based on distance
    const tip = orderDetails?.tip || 0;
    return baseFee + distanceFee + tip;
  };

  const getStepStatus = () => {
    const status = orderDetails?.status;

    switch (status) {
      case "pending":
      case "confirmed":
      case "preparing":
        return { pickup: "pending", delivery: "pending" };
      case "ready":
        return { pickup: "current", delivery: "pending" };
      case "out_for_delivery":
        return { pickup: "completed", delivery: "current" };
      case "delivered":
        return { pickup: "completed", delivery: "completed" };
      default:
        return { pickup: "pending", delivery: "pending" };
    }
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

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Delivery Details</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Notification Card */}
        <View style={styles.notificationCard}>
          <View style={styles.notificationHeader}>
            <Ionicons name="notifications" size={24} color="#3B82F6" />
            <View style={styles.notificationTitleContainer}>
              <Text style={styles.notificationTitle}>
                {notification?.title}
              </Text>
              <Text style={styles.notificationTime}>
                {new Date(notification?.created_at).toLocaleString()}
              </Text>
            </View>
          </View>

          <Text style={styles.notificationBody}>{notification?.body}</Text>

          {notification?.type === "order" && (
            <View style={styles.deliveryBadge}>
              <Ionicons name="bicycle" size={16} color="#fff" />
              <Text style={styles.deliveryBadgeText}>Delivery Assignment</Text>
            </View>
          )}
        </View>

        {/* Order Details */}
        {orderDetails && (
          <>
            {/* Delivery Steps */}
            <View style={styles.stepsContainer}>
              <View style={styles.stepsHeader}>
                <Ionicons name="navigate" size={24} color="#3B82F6" />
                <Text style={styles.stepsTitle}>Delivery Steps</Text>
              </View>

              {/* Pickup Step */}
              <TouchableOpacity
                style={[
                  styles.stepCard,
                  getStepStatus().pickup === "current" && styles.currentStep,
                  getStepStatus().pickup === "completed" &&
                    styles.completedStep,
                ]}
                onPress={handleToggleStep}
              >
                <View style={styles.stepIconContainer}>
                  {getStepStatus().pickup === "completed" ? (
                    <Ionicons
                      name="checkmark-circle"
                      size={24}
                      color="#10B981"
                    />
                  ) : getStepStatus().pickup === "current" ? (
                    <Ionicons name="restaurant" size={24} color="#3B82F6" />
                  ) : (
                    <Ionicons
                      name="restaurant-outline"
                      size={24}
                      color="#9CA3AF"
                    />
                  )}
                </View>
                <View style={styles.stepInfo}>
                  <Text style={styles.stepTitle}>Pickup from Restaurant</Text>
                  <Text style={styles.stepDescription}>
                    {orderDetails.restaurants?.restaurant_name}
                  </Text>
                  <Text style={styles.stepAddress}>
                    {orderDetails.restaurants?.address}
                  </Text>
                  {orderDetails.restaurants?.users?.phone && (
                    <TouchableOpacity
                      style={styles.stepAction}
                      onPress={handleCallRestaurant}
                    >
                      <Ionicons name="call" size={16} color="#3B82F6" />
                      <Text style={styles.stepActionText}>Call Restaurant</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {getStepStatus().pickup === "current" && (
                  <Ionicons name="chevron-forward" size={20} color="#3B82F6" />
                )}
              </TouchableOpacity>

              {/* Delivery Step */}
              <TouchableOpacity
                style={[
                  styles.stepCard,
                  getStepStatus().delivery === "current" && styles.currentStep,
                  getStepStatus().delivery === "completed" &&
                    styles.completedStep,
                ]}
                onPress={handleToggleStep}
              >
                <View style={styles.stepIconContainer}>
                  {getStepStatus().delivery === "completed" ? (
                    <Ionicons
                      name="checkmark-circle"
                      size={24}
                      color="#10B981"
                    />
                  ) : getStepStatus().delivery === "current" ? (
                    <Ionicons name="home" size={24} color="#3B82F6" />
                  ) : (
                    <Ionicons name="home-outline" size={24} color="#9CA3AF" />
                  )}
                </View>
                <View style={styles.stepInfo}>
                  <Text style={styles.stepTitle}>Deliver to Customer</Text>
                  <Text style={styles.stepDescription}>
                    {orderDetails.customers?.users?.full_name}
                  </Text>
                  <Text style={styles.stepAddress}>
                    {orderDetails.delivery_address?.address_line1}
                  </Text>
                  {orderDetails.customers?.users?.phone && (
                    <TouchableOpacity
                      style={styles.stepAction}
                      onPress={handleCallCustomer}
                    >
                      <Ionicons name="call" size={16} color="#3B82F6" />
                      <Text style={styles.stepActionText}>Call Customer</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {getStepStatus().delivery === "current" && (
                  <Ionicons name="chevron-forward" size={20} color="#3B82F6" />
                )}
              </TouchableOpacity>

              {/* Earnings Card */}
              <View style={styles.earningsCard}>
                <View style={styles.earningsHeader}>
                  <Ionicons name="cash" size={24} color="#F59E0B" />
                  <Text style={styles.earningsTitle}>
                    Earnings for this Delivery
                  </Text>
                </View>
                <View style={styles.earningsBreakdown}>
                  <View style={styles.earningRow}>
                    <Text style={styles.earningLabel}>Delivery Fee</Text>
                    <Text style={styles.earningValue}>
                      AED {orderDetails.delivery_fee?.toFixed(2) || "0.00"}
                    </Text>
                  </View>
                  {orderDetails.tip > 0 && (
                    <View style={styles.earningRow}>
                      <Text style={styles.earningLabel}>Tip</Text>
                      <Text style={styles.earningValue}>
                        AED {orderDetails.tip?.toFixed(2) || "0.00"}
                      </Text>
                    </View>
                  )}
                  <View style={[styles.earningRow, styles.totalEarningRow]}>
                    <Text style={styles.totalEarningLabel}>Total Earnings</Text>
                    <Text style={styles.totalEarningValue}>
                      AED {getEarningsForDelivery().toFixed(2)}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Order Summary */}
            <View style={styles.orderSummary}>
              <Text style={styles.summaryTitle}>Order Summary</Text>

              <View style={styles.summaryCard}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Order #</Text>
                  <Text style={styles.summaryValue}>
                    {orderDetails.order_number}
                  </Text>
                </View>

                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Status</Text>
                  <View style={styles.statusContainer}>
                    <Text
                      style={[
                        styles.statusText,
                        {
                          color:
                            orderDetails.status === "delivered"
                              ? "#10B981"
                              : orderDetails.status === "out_for_delivery"
                                ? "#3B82F6"
                                : orderDetails.status === "cancelled"
                                  ? "#EF4444"
                                  : "#F59E0B",
                        },
                      ]}
                    >
                      {orderDetails.status?.replace(/_/g, " ").toUpperCase()}
                    </Text>
                  </View>
                </View>

                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Items</Text>
                  <Text style={styles.summaryValue}>
                    {orderDetails.order_items?.length || 0} items
                  </Text>
                </View>

                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Order Total</Text>
                  <Text style={styles.summaryValue}>
                    AED {orderDetails.final_amount?.toFixed(2)}
                  </Text>
                </View>

                {orderDetails.special_instructions && (
                  <View style={styles.instructionsContainer}>
                    <Text style={styles.instructionsLabel}>
                      Special Instructions:
                    </Text>
                    <Text style={styles.instructionsText}>
                      {orderDetails.special_instructions}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Map Section */}
            {(restaurantLocation || customerLocation) && (
              <TouchableOpacity
                style={styles.mapSection}
                onPress={() => setShowMap(!showMap)}
              >
                <View style={styles.mapHeader}>
                  <Ionicons name="map" size={20} color="#3B82F6" />
                  <Text style={styles.mapTitle}>
                    {showMap ? "Hide Map" : "Show Delivery Route"}
                  </Text>
                  <Ionicons
                    name={showMap ? "chevron-up" : "chevron-down"}
                    size={20}
                    color="#6B7280"
                  />
                </View>

                {showMap && mapRegion && (
                  <MapView
                    style={styles.map}
                    provider={PROVIDER_GOOGLE}
                    region={mapRegion}
                    showsUserLocation={true}
                    showsMyLocationButton={true}
                  >
                    {/* Restaurant Marker */}
                    {restaurantLocation && (
                      <Marker coordinate={restaurantLocation}>
                        <View style={styles.restaurantMarker}>
                          <Ionicons
                            name="restaurant"
                            size={24}
                            color="#EF4444"
                          />
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
                          <Ionicons name="bicycle" size={20} color="#3B82F6" />
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
                )}
              </TouchableOpacity>
            )}
          </>
        )}
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        {/* Navigation Button */}
        {(restaurantLocation || customerLocation) && (
          <TouchableOpacity
            style={styles.navigateButton}
            onPress={handleStartNavigation}
          >
            <Ionicons name="navigate" size={22} color="#fff" />
            <Text style={styles.navigateButtonText}>
              {currentStep === "pickup"
                ? "Navigate to Pickup"
                : "Navigate to Delivery"}
            </Text>
          </TouchableOpacity>
        )}

        {/* Status Update Buttons */}
        {orderDetails && (
          <View style={styles.statusButtons}>
            {orderDetails.status === "ready" && (
              <TouchableOpacity
                style={[styles.statusButton, styles.pickupButton]}
                onPress={() => handleUpdateOrderStatus("out_for_delivery")}
              >
                <Ionicons name="checkmark-circle" size={18} color="#fff" />
                <Text style={styles.statusButtonText}>Mark as Picked Up</Text>
              </TouchableOpacity>
            )}

            {orderDetails.status === "out_for_delivery" && (
              <TouchableOpacity
                style={[styles.statusButton, styles.deliverButton]}
                onPress={() => handleUpdateOrderStatus("delivered")}
              >
                <Ionicons name="checkmark-done" size={18} color="#fff" />
                <Text style={styles.statusButtonText}>Mark as Delivered</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Emergency Button */}
        <TouchableOpacity
          style={styles.emergencyButton}
          onPress={() => {
            Alert.alert(
              "Emergency Support",
              "Contact support team immediately?",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Call Support",
                  onPress: () => Linking.openURL("tel:+971123456789"),
                },
              ],
            );
          }}
        >
          <Ionicons name="alert-circle" size={20} color="#EF4444" />
          <Text style={styles.emergencyButtonText}>Emergency Support</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// Styles will be added separately as requested
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  notificationHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  notificationTitleContainer: {
    marginLeft: 12,
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  notificationTime: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  notificationBody: {
    fontSize: 14,
    color: "#374151",
    lineHeight: 20,
  },
  deliveryBadge: {
    backgroundColor: "#3B82F6",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: "flex-start",
    marginTop: 12,
  },
  deliveryBadgeText: {
    color: "white",
    fontSize: 12,
    fontWeight: "500",
    marginLeft: 4,
  },
  stepsContainer: { marginBottom: 16 },
  stepsHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  stepsTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    marginLeft: 8,
  },
  stepCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  currentStep: {
    borderColor: "#3B82F6",
    backgroundColor: "#EFF6FF",
  },
  completedStep: {
    borderColor: "#10B981",
    backgroundColor: "#ECFDF5",
  },
  stepIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  stepInfo: { flex: 1 },
  stepTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 4,
  },
  stepDescription: {
    fontSize: 14,
    color: "#374151",
    marginBottom: 2,
  },
  stepAddress: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 8,
  },
  stepAction: {
    flexDirection: "row",
    alignItems: "center",
  },
  stepActionText: {
    fontSize: 12,
    color: "#3B82F6",
    marginLeft: 4,
    fontWeight: "500",
  },
  earningsCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#FCD34D",
  },
  earningsHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  earningsTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginLeft: 8,
  },
  earningsBreakdown: { marginTop: 8 },
  earningRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  earningLabel: {
    fontSize: 14,
    color: "#6B7280",
  },
  earningValue: {
    fontSize: 14,
    fontWeight: "500",
    color: "#111827",
  },
  totalEarningRow: {
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingTop: 8,
    marginTop: 4,
  },
  totalEarningLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  totalEarningValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#10B981",
  },
  orderSummary: { marginBottom: 16 },
  summaryTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 12,
  },
  summaryCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
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
  statusContainer: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  instructionsContainer: {
    backgroundColor: "#F3F4F6",
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  instructionsLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 4,
  },
  instructionsText: {
    fontSize: 14,
    color: "#374151",
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
    height: 300,
  },
  restaurantMarker: {
    backgroundColor: "white",
    padding: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#EF4444",
  },
  customerMarker: {
    backgroundColor: "white",
    padding: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#10B981",
  },
  driverMarker: {
    backgroundColor: "#3B82F6",
    padding: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "white",
  },
  actionButtons: {
    padding: 16,
    backgroundColor: "white",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  navigateButton: {
    backgroundColor: "#3B82F6",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 12,
  },
  navigateButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  statusButtons: { marginBottom: 12 },
  statusButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 8,
  },
  pickupButton: { backgroundColor: "#10B981" },
  deliverButton: { backgroundColor: "#8B5CF6" },
  statusButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  emergencyButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#EF4444",
  },
  emergencyButtonText: {
    color: "#EF4444",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
});
