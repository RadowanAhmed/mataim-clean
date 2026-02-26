// app/(driver)/order-detail/[orderId].tsx - FIXED VERSION
import { useAuth } from "@/backend/AuthContext";
import { EnhancedNotificationService } from "@/backend/services/EnhancedNotificationService";
import { RealTimeLocationService } from "@/backend/services/RealTimeLocationService";
import { supabase } from "@/backend/supabase";
import animations from "@/constent/animations";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import LottieView from "lottie-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
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

export default function DriverOrderDetailScreen() {
  const { orderId } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [order, setOrder] = useState<any>(null);
  const [restaurant, setRestaurant] = useState<any>(null);
  const [customer, setCustomer] = useState<any>(null);
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [orderUpdates, setOrderUpdates] = useState<any[]>([]);

  // Location states
  const [restaurantLocation, setRestaurantLocation] = useState<any>(null);
  const [customerLocation, setCustomerLocation] = useState<any>(null);
  const [driverLocation, setDriverLocation] = useState<any>(null);
  const [mapRegion, setMapRegion] = useState<any>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<any[]>([]);
  const [distanceToRestaurant, setDistanceToRestaurant] = useState<
    number | null
  >(null);
  const [distanceToCustomer, setDistanceToCustomer] = useState<number | null>(
    null,
  );
  const [estimatedTimeToRestaurant, setEstimatedTimeToRestaurant] =
    useState<string>("");
  const [estimatedTimeToCustomer, setEstimatedTimeToCustomer] =
    useState<string>("");

  // Order actions
  const [isPickingUp, setIsPickingUp] = useState(false);
  const [isDelivering, setIsDelivering] = useState(false);

  // Add these states
  const [realTimeDriverLocation, setRealTimeDriverLocation] =
    useState<any>(null);
  const [locationUpdates, setLocationUpdates] = useState<any[]>([]);
  const mapRef = useRef<MapView>(null);

  // Update your state declarations to include:
  const [currentRouteType, setCurrentRouteType] = useState<
    "toRestaurant" | "toCustomer"
  >("toRestaurant");

  // Add this effect for real-time location tracking
  useEffect(() => {
    let channel: any = null;
    let unsubscribe: any = null;

    if (order?.id && user?.user_type === "driver") {
      // Start location tracking
      RealTimeLocationService.startTracking(user.id);

      // Subscribe to location updates using channel object
      channel = supabase
        .channel(`order-location-${order.id}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "delivery_users",
            filter: `id=eq.${user.id}`,
          },
          (payload) => {
            const newLocation = payload.new;
            if (
              newLocation.current_location_lat &&
              newLocation.current_location_lng
            ) {
              const location = {
                latitude: parseFloat(newLocation.current_location_lat),
                longitude: parseFloat(newLocation.current_location_lng),
              };
              setRealTimeDriverLocation(location);

              // Update driver location for route calculations
              setDriverLocation(location);

              // Update route if needed
              updateRouteBasedOnStatus();

              // Animate map to driver location
              if (mapRef.current) {
                mapRef.current.animateToRegion(
                  {
                    ...location,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                  },
                  1000,
                );
              }
            }
          },
        )
        .subscribe((status) => {
          console.log("Channel subscription status:", status);
        });

      // Store the channel for cleanup
      unsubscribe = channel;
    }

    return () => {
      // Cleanup function
      if (unsubscribe) {
        // Properly unsubscribe from channel
        supabase.removeChannel(unsubscribe);
      }
      RealTimeLocationService.stopTracking();
    };
  }, [order?.id, user?.id, user?.user_type]);

  useEffect(() => {
    if (orderId) {
      fetchOrderDetails();
      getDriverCurrentLocation();
    }
  }, [orderId]);

  const getDriverCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;

      const location = await Location.getCurrentPositionAsync({});
      setDriverLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      // Update driver location in database
      await supabase
        .from("delivery_users")
        .update({
          current_location_lat: location.coords.latitude.toString(),
          current_location_lng: location.coords.longitude.toString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", user?.id);
    } catch (error) {
      console.error("Error getting driver location:", error);
    }
  };

  const fetchOrderDetails = async () => {
    try {
      setLoading(true);

      // FIXED QUERY: Use users table instead of customers
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
          users!orders_customer_id_fkey(
            full_name,
            phone,
            email,
            profile_image_url
          )
        `,
        )
        .eq("id", orderId)
        .single();

      if (error) {
        console.error("Order fetch error:", error);

        // Try alternative query
        const { data: simpleOrderData, error: simpleError } = await supabase
          .from("orders")
          .select("*")
          .eq("id", orderId)
          .single();

        if (simpleError) throw simpleError;

        setOrder(simpleOrderData);

        // Fetch restaurant separately
        if (simpleOrderData.restaurant_id) {
          const { data: restaurantData } = await supabase
            .from("restaurants")
            .select("*")
            .eq("id", simpleOrderData.restaurant_id)
            .single();
          setRestaurant(restaurantData);
        }

        // Fetch customer separately
        if (simpleOrderData.customer_id) {
          const { data: customerData } = await supabase
            .from("users")
            .select("full_name, phone, email, profile_image_url")
            .eq("id", simpleOrderData.customer_id)
            .single();
          setCustomer(customerData);
        }
      } else {
        setOrder(orderData);

        // Set restaurant data
        if (orderData.restaurants) {
          setRestaurant(orderData.restaurants);

          // Set restaurant location for map
          if (
            orderData.restaurants.latitude &&
            orderData.restaurants.longitude
          ) {
            const location = {
              latitude: parseFloat(orderData.restaurants.latitude),
              longitude: parseFloat(orderData.restaurants.longitude),
            };
            setRestaurantLocation(location);
          }
        }

        // Set customer data from users table
        if (orderData.users) {
          setCustomer(orderData.users);
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
            description
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

      // Parse delivery address for location
      if (orderData?.delivery_address) {
        try {
          const address =
            typeof orderData.delivery_address === "string"
              ? JSON.parse(orderData.delivery_address)
              : orderData.delivery_address;

          if (address.latitude && address.longitude) {
            const location = {
              latitude: parseFloat(address.latitude),
              longitude: parseFloat(address.longitude),
            };
            setCustomerLocation(location);
          } else if (address.lat && address.lng) {
            const location = {
              latitude: parseFloat(address.lat),
              longitude: parseFloat(address.lng),
            };
            setCustomerLocation(location);
          } else if (
            address.coordinates?.latitude &&
            address.coordinates?.longitude
          ) {
            const location = {
              latitude: parseFloat(address.coordinates.latitude),
              longitude: parseFloat(address.coordinates.longitude),
            };
            setCustomerLocation(location);
          }
        } catch (e) {
          console.log("Error parsing delivery address:", e);

          // If parsing fails, try to extract coordinates from address string
          if (typeof orderData.delivery_address === "string") {
            const latLngMatch = orderData.delivery_address.match(
              /lat:([\d.]+),lng:([\d.]+)/,
            );
            if (latLngMatch) {
              const location = {
                latitude: parseFloat(latLngMatch[1]),
                longitude: parseFloat(latLngMatch[2]),
              };
              setCustomerLocation(location);
            }
          }
        }
      }

      // Calculate distances and times
      calculateDistancesAndTimes();
    } catch (error) {
      console.error("Error fetching order details:", error);
      Alert.alert("Error", "Failed to load order details");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number => {
    const R = 6371; // Earth's radius in km
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

  const animateToRoute = () => {
    if (mapRef.current && routeCoordinates.length > 0) {
      // Calculate bounds to show all route points
      const routePoints = routeCoordinates;

      let minLat = routePoints[0].latitude;
      let maxLat = routePoints[0].latitude;
      let minLng = routePoints[0].longitude;
      let maxLng = routePoints[0].longitude;

      routePoints.forEach((point) => {
        minLat = Math.min(minLat, point.latitude);
        maxLat = Math.max(maxLat, point.latitude);
        minLng = Math.min(minLng, point.longitude);
        maxLng = Math.max(maxLng, point.longitude);
      });

      const padding = 0.01; // Add small padding
      mapRef.current.animateToRegion(
        {
          latitude: (minLat + maxLat) / 2,
          longitude: (minLng + maxLng) / 2,
          latitudeDelta: Math.max((maxLat - minLat) * 1.5 + padding, 0.02),
          longitudeDelta: Math.max((maxLng - minLng) * 1.5 + padding, 0.02),
        },
        1000,
      );
    }
  };

  // Call this when route changes
  useEffect(() => {
    if (routeCoordinates.length > 0) {
      animateToRoute();
    }
  }, [routeCoordinates]);

  const deg2rad = (deg: number): number => {
    return deg * (Math.PI / 180);
  };

  const calculateTime = (distance: number): string => {
    // Assuming average speed of 30 km/h
    const timeInHours = distance / 30;
    const timeInMinutes = Math.round(timeInHours * 60);
    return `${timeInMinutes} min`;
  };

  // Update the calculateDistancesAndTimes function to include route setup:
  const calculateDistancesAndTimes = () => {
    if (driverLocation && restaurantLocation) {
      const distance = calculateDistance(
        driverLocation.latitude,
        driverLocation.longitude,
        restaurantLocation.latitude,
        restaurantLocation.longitude,
      );
      setDistanceToRestaurant(distance);
      setEstimatedTimeToRestaurant(calculateTime(distance));
    }

    if (restaurantLocation && customerLocation) {
      const distance = calculateDistance(
        restaurantLocation.latitude,
        restaurantLocation.longitude,
        customerLocation.latitude,
        customerLocation.longitude,
      );
      setDistanceToCustomer(distance);
      setEstimatedTimeToCustomer(calculateTime(distance));
    }

    // Setup map region and initial route
    setupMapAndRoute();
  };

  // Add this new function for route setup:
  const setupMapAndRoute = () => {
    const locations = [];

    // Add driver location if available
    if (driverLocation) {
      locations.push(driverLocation);
    }

    // Add restaurant location
    if (restaurantLocation) {
      locations.push(restaurantLocation);
    }

    // Add customer location
    if (customerLocation) {
      locations.push(customerLocation);
    }

    // Set up map region to show all points
    if (locations.length > 0) {
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

      // Set route based on order status
      updateRouteBasedOnStatus();
    }
  };

  // Add this function to update route based on order status:
  const updateRouteBasedOnStatus = useCallback(() => {
    if (order?.status === "ready") {
      // Show route from driver to restaurant
      if (driverLocation && restaurantLocation) {
        setRouteCoordinates([driverLocation, restaurantLocation]);
        setCurrentRouteType("toRestaurant");
      }
    } else if (order?.status === "out_for_delivery") {
      // Show route from restaurant to customer
      if (restaurantLocation && customerLocation) {
        setRouteCoordinates([restaurantLocation, customerLocation]);
        setCurrentRouteType("toCustomer");
      }
    }
  }, [order?.status, driverLocation, restaurantLocation, customerLocation]);

  // Update the handlePickupOrder function to switch routes:
  const handlePickupOrder = async () => {
    if (!order?.id || !user?.id) return;

    Alert.alert(
      "Pick Up Order",
      "Confirm that you have picked up the order from the restaurant?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm Pickup",
          onPress: async () => {
            try {
              setIsPickingUp(true);

              const { error } = await supabase
                .from("orders")
                .update({
                  status: "out_for_delivery",
                  updated_at: new Date().toISOString(),
                })
                .eq("id", order.id);

              if (error) throw error;

              // Update driver status
              await supabase
                .from("delivery_users")
                .update({
                  driver_status: "busy",
                  updated_at: new Date().toISOString(),
                })
                .eq("id", user.id);

              // Send notification
              await EnhancedNotificationService.sendOrderStatusNotification(
                order.id,
                "out_for_delivery",
              );

              Alert.alert("Success", "Order picked up successfully!");

              // Update the route to show restaurant-to-customer
              if (restaurantLocation && customerLocation) {
                setRouteCoordinates([restaurantLocation, customerLocation]);
                setCurrentRouteType("toCustomer");
              }

              fetchOrderDetails();
            } catch (error) {
              console.error("Error picking up order:", error);
              Alert.alert("Error", "Failed to update order status");
            } finally {
              setIsPickingUp(false);
            }
          },
        },
      ],
    );
  };

  const setupMapRegion = () => {
    const locations = [];
    if (restaurantLocation) locations.push(restaurantLocation);
    if (customerLocation) locations.push(customerLocation);
    if (driverLocation) locations.push(driverLocation);

    if (locations.length > 0) {
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

      // Set route from restaurant to customer
      if (restaurantLocation && customerLocation) {
        setRouteCoordinates([restaurantLocation, customerLocation]);
      }
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchOrderDetails(), getDriverCurrentLocation()]);
  };

  const handleDeliverOrder = async () => {
    if (!order?.id || !user?.id) return;

    Alert.alert(
      "Mark as Delivered",
      "Confirm that you have delivered the order to the customer?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Mark Delivered",
          onPress: async () => {
            try {
              setIsDelivering(true);

              const { error } = await supabase
                .from("orders")
                .update({
                  status: "delivered",
                  actual_delivery_time: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                })
                .eq("id", order.id);

              if (error) throw error;

              // Update driver status
              await supabase
                .from("delivery_users")
                .update({
                  driver_status: "available",
                  updated_at: new Date().toISOString(),
                })
                .eq("id", user.id);

              // Send notification
              await EnhancedNotificationService.sendOrderStatusNotification(
                order.id,
                "delivered",
              );

              Alert.alert("Success", "Order marked as delivered!");
              fetchOrderDetails();
            } catch (error) {
              console.error("Error delivering order:", error);
              Alert.alert("Error", "Failed to update order status");
            } finally {
              setIsDelivering(false);
            }
          },
        },
      ],
    );
  };

  const handleContactRestaurant = () => {
    if (restaurant?.phone || restaurant?.users?.phone) {
      const phoneNumber = restaurant.phone || restaurant.users?.phone;
      Linking.openURL(`tel:${phoneNumber}`).catch((err) => {
        Alert.alert("Error", "Unable to make phone call");
      });
    }
  };

  const handleContactCustomer = () => {
    if (customer?.phone) {
      Linking.openURL(`tel:${customer.phone}`).catch((err) => {
        Alert.alert("Error", "Unable to make phone call");
      });
    }
  };

  const handleNavigateToRestaurant = () => {
    if (restaurantLocation) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${restaurantLocation.latitude},${restaurantLocation.longitude}&travelmode=driving`;
      Linking.openURL(url).catch((err) => {
        Alert.alert("Error", "Unable to open navigation app");
      });
    }
  };

  const handleNavigateToCustomer = () => {
    if (customerLocation) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${customerLocation.latitude},${customerLocation.longitude}&travelmode=driving`;
      Linking.openURL(url).catch((err) => {
        Alert.alert("Error", "Unable to open navigation app");
      });
    }
  };

  const handleCancelDelivery = async () => {
    if (!order?.id || !user?.id) return;

    Alert.alert(
      "Cancel Delivery",
      "Are you sure you want to cancel this delivery? This will make the order available for other drivers.",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await supabase
                .from("orders")
                .update({
                  driver_id: null,
                  status: "ready",
                  updated_at: new Date().toISOString(),
                })
                .eq("id", order.id);

              if (error) throw error;

              // Update driver status
              await supabase
                .from("delivery_users")
                .update({
                  driver_status: "available",
                  updated_at: new Date().toISOString(),
                })
                .eq("id", user.id);

              Alert.alert(
                "Success",
                "Delivery cancelled. Order is now available for other drivers.",
              );
              router.back();
            } catch (error) {
              console.error("Error cancelling delivery:", error);
              Alert.alert("Error", "Failed to cancel delivery");
            }
          },
        },
      ],
    );
  };

  // Add this helper function at the top of your component
  const formatAddress = (addressObj: any): string => {
    if (!addressObj) return "Address not available";

    if (typeof addressObj === "string") return addressObj;

    const parts = [];
    if (addressObj.address_line1) parts.push(addressObj.address_line1);
    if (addressObj.address_line2) parts.push(addressObj.address_line2);
    if (addressObj.city) parts.push(addressObj.city);
    if (addressObj.state) parts.push(addressObj.state);
    if (addressObj.postal_code) parts.push(addressObj.postal_code);
    if (addressObj.country) parts.push(addressObj.country);

    return parts.length > 0 ? parts.join(", ") : "Address not available";
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "ready":
        return "#10B981";
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
    switch (status?.toLowerCase()) {
      case "ready":
        return "Ready for Pickup";
      case "out_for_delivery":
        return "On Delivery";
      case "delivered":
        return "Delivered";
      case "cancelled":
        return "Cancelled";
      default:
        return status;
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
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <LottieView
          source={animations.loading}
          style={styles.loadingAnimation}
          autoPlay
          loop
        />
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
        <Text style={styles.headerTitle}>Delivery Details</Text>
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
                source={
                  order.status === "ready"
                    ? animations.ready_animation
                    : order.status === "out_for_delivery"
                      ? animations.out_for_delivery_animation
                      : order.status === "delivered"
                        ? animations.delivered_animation
                        : order.status === "cancelled"
                          ? animations.cancelled_animation
                          : animations.driver_order_accepted
                }
                style={styles.statusAnimation}
                autoPlay
                loop={
                  order.status !== "delivered" && order.status !== "cancelled"
                }
              />
            </View>
            <View style={styles.statusInfo}>
              <Text style={styles.statusTitle}>
                {getStatusText(order.status)}
              </Text>
              <Text style={styles.orderNumber}>
                Order #{order.order_number || order.id.slice(0, 8)}
              </Text>
            </View>
          </View>

          {/* Order Info */}
          <View style={styles.orderInfo}>
            <View style={styles.orderInfoRow}>
              <Ionicons name="time-outline" size={16} color="#6B7280" />
              <Text style={styles.orderLabel}>Order Time</Text>
              <Text style={styles.orderValue}>
                {formatDate(order.created_at)} at {formatTime(order.created_at)}
              </Text>
            </View>
            {order.estimated_delivery_time && (
              <View style={styles.orderInfoRow}>
                <Ionicons name="time" size={16} color="#6B7280" />
                <Text style={styles.orderLabel}>Estimated Delivery</Text>
                <Text style={styles.orderValue}>
                  {formatTime(order.estimated_delivery_time)}
                </Text>
              </View>
            )}
          </View>

          {/* Earnings */}
          <View style={styles.earningsCard}>
            <View style={styles.earningsRow}>
              <View style={styles.earningItem}>
                <Ionicons name="cash-outline" size={18} color="#F59E0B" />
                <Text style={styles.earningLabel}>Delivery Fee</Text>
                <Text style={styles.earningValue}>
                  AED {order.delivery_fee?.toFixed(2) || "0.00"}
                </Text>
              </View>
              <View style={styles.earningItem}>
                <Ionicons name="wallet-outline" size={18} color="#10B981" />
                <Text style={styles.earningLabel}>Your Earnings</Text>
                <Text style={[styles.earningValue, styles.yourEarnings]}>
                  AED {((order.delivery_fee || 0) * 0.8).toFixed(2)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Delivery Steps */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delivery Steps</Text>

          {/* Pickup Step */}
          <View style={styles.stepCard}>
            <View style={styles.stepHeader}>
              <View
                style={[
                  styles.stepIcon,
                  order.status === "ready" && styles.stepIconCurrent,
                  (order.status === "out_for_delivery" ||
                    order.status === "delivered") &&
                    styles.stepIconCompleted,
                ]}
              >
                {order.status === "out_for_delivery" ||
                order.status === "delivered" ? (
                  <Ionicons name="checkmark" size={16} color="#fff" />
                ) : (
                  <Ionicons name="restaurant" size={16} color="#fff" />
                )}
              </View>
              <View style={styles.stepInfo}>
                <Text style={styles.stepTitle}>Pickup from Restaurant</Text>
                <Text style={styles.stepDescription}>
                  {restaurant?.restaurant_name || "Restaurant"}
                </Text>
                {distanceToRestaurant && (
                  <Text style={styles.stepDistance}>
                    {distanceToRestaurant} km away • {estimatedTimeToRestaurant}
                  </Text>
                )}
              </View>
              <TouchableOpacity
                style={styles.navigateButtonSmall}
                onPress={handleNavigateToRestaurant}
              >
                <Ionicons name="navigate" size={16} color="#3B82F6" />
                <Text style={styles.navigateText}>Navigate</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.stepActions}>
              <TouchableOpacity
                style={styles.contactButton}
                onPress={handleContactRestaurant}
              >
                <Ionicons name="call" size={14} color="#3B82F6" />
                <Text style={styles.contactText}>Call Restaurant</Text>
              </TouchableOpacity>
              <Text style={styles.stepAddress}>
                {restaurant?.address || "Address not available"}
              </Text>
            </View>
          </View>

          {/* Delivery Step */}
          <View style={styles.stepCard}>
            <View style={styles.stepHeader}>
              <View
                style={[
                  styles.stepIcon,
                  order.status === "out_for_delivery" && styles.stepIconCurrent,
                  order.status === "delivered" && styles.stepIconCompleted,
                ]}
              >
                {order.status === "delivered" ? (
                  <Ionicons name="checkmark" size={16} color="#fff" />
                ) : (
                  <Ionicons name="home" size={16} color="#fff" />
                )}
              </View>
              <View style={styles.stepInfo}>
                <Text style={styles.stepTitle}>Deliver to Customer</Text>
                <Text style={styles.stepDescription}>
                  {customer?.full_name || "Customer"}
                </Text>
                {distanceToCustomer && (
                  <Text style={styles.stepDistance}>
                    {distanceToCustomer} km from restaurant •{" "}
                    {estimatedTimeToCustomer}
                  </Text>
                )}
              </View>
              <TouchableOpacity
                style={styles.navigateButtonSmall}
                onPress={handleNavigateToCustomer}
              >
                <Ionicons name="navigate" size={16} color="#3B82F6" />
                <Text style={styles.navigateText}>Navigate</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.stepActions}>
              <TouchableOpacity
                style={styles.contactButton}
                onPress={handleContactCustomer}
              >
                <Ionicons name="call" size={14} color="#3B82F6" />
                <Text style={styles.contactText}>Call Customer</Text>
              </TouchableOpacity>
              {order.delivery_address && (
                <Text style={styles.stepAddress}>
                  {typeof order.delivery_address === "string"
                    ? order.delivery_address
                    : formatAddress(order.delivery_address)}
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* Order Items */}
        {orderItems.length > 0 && (
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
                    <Text style={styles.itemQuantity}>
                      Qty: {item.quantity}
                    </Text>
                  </View>
                  <Text style={styles.itemPrice}>
                    AED {(item.unit_price * item.quantity).toFixed(2)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Special Instructions */}
        {order.special_instructions && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Special Instructions</Text>
            <View style={styles.instructionsCard}>
              <Ionicons name="document-text" size={18} color="#6B7280" />
              <Text style={styles.instructionsText}>
                {order.special_instructions}
              </Text>
            </View>
          </View>
        )}

        {/* Map */}
        {(restaurantLocation || customerLocation) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Delivery Map</Text>
            {mapRegion && (
              <View style={styles.mapContainer}>
                <MapView
                  style={styles.map}
                  provider={PROVIDER_GOOGLE}
                  region={mapRegion}
                  showsUserLocation={true}
                  followsUserLocation={order?.status === "out_for_delivery"}
                  showsMyLocationButton={true}
                  ref={mapRef}
                >
                  {/* Restaurant Marker */}
                  {restaurantLocation && (
                    <Marker coordinate={restaurantLocation}>
                      <View
                        style={[
                          styles.markerContainer,
                          { backgroundColor: "#FF6B35" },
                        ]}
                      >
                        <Ionicons name="restaurant" size={20} color="#fff" />
                      </View>
                    </Marker>
                  )}

                  {/* Customer Marker */}
                  {customerLocation && (
                    <Marker coordinate={customerLocation}>
                      <View
                        style={[
                          styles.markerContainer,
                          { backgroundColor: "#10B981" },
                        ]}
                      >
                        <Ionicons name="home" size={20} color="#fff" />
                      </View>
                    </Marker>
                  )}

                  {/* Driver Marker - Only show if we have driver location */}
                  {driverLocation && (
                    <Marker coordinate={driverLocation}>
                      <View
                        style={[
                          styles.markerContainer,
                          { backgroundColor: "#3B82F6" },
                        ]}
                      >
                        <Ionicons name="bicycle" size={20} color="#fff" />
                      </View>
                    </Marker>
                  )}

                  {/* Route Line - Changes based on order status */}
                  {routeCoordinates.length > 1 && (
                    <>
                      {/* Main Route Line */}
                      <Polyline
                        coordinates={routeCoordinates}
                        strokeColor={
                          currentRouteType === "toRestaurant"
                            ? "#3B82F6"
                            : "#10B981"
                        }
                        strokeWidth={4}
                        lineDashPattern={
                          currentRouteType === "toRestaurant" ? [0] : [10, 10]
                        }
                      />

                      {/* Direction Arrow Markers */}
                      {routeCoordinates.map((coord, index) => {
                        if (index < routeCoordinates.length - 1) {
                          const midPoint = {
                            latitude:
                              (coord.latitude +
                                routeCoordinates[index + 1].latitude) /
                              2,
                            longitude:
                              (coord.longitude +
                                routeCoordinates[index + 1].longitude) /
                              2,
                          };

                          return (
                            <Marker
                              key={`direction-${index}`}
                              coordinate={midPoint}
                              anchor={{ x: 0.5, y: 0.5 }}
                            >
                              <View style={styles.directionArrow}>
                                <Ionicons
                                  name={
                                    currentRouteType === "toRestaurant"
                                      ? "arrow-forward"
                                      : "navigate"
                                  }
                                  size={16}
                                  color={
                                    currentRouteType === "toRestaurant"
                                      ? "#3B82F6"
                                      : "#10B981"
                                  }
                                />
                              </View>
                            </Marker>
                          );
                        }
                        return null;
                      })}
                    </>
                  )}

                  {/* Starting Point Marker */}
                  {routeCoordinates.length > 0 && (
                    <Marker coordinate={routeCoordinates[0]}>
                      <View style={styles.startPoint}>
                        <Text style={styles.startPointText}>
                          {order?.status === "ready" ? "You" : "Restaurant"}
                        </Text>
                      </View>
                    </Marker>
                  )}

                  {/* Destination Marker */}
                  {routeCoordinates.length > 1 && (
                    <Marker
                      coordinate={routeCoordinates[routeCoordinates.length - 1]}
                    >
                      <View style={styles.endPoint}>
                        <Text style={styles.endPointText}>
                          {order?.status === "ready"
                            ? "Restaurant"
                            : "Customer"}
                        </Text>
                      </View>
                    </Marker>
                  )}

                  {/* Route Status */}
                  {routeCoordinates.length === 0 &&
                    order.status === "ready" && (
                      <View style={styles.routeCalculating}>
                        <LottieView
                          source={animations.driver_route_calculating}
                          style={styles.routeAnimation}
                          autoPlay
                          loop
                        />
                        <Text style={styles.routeCalculatingText}>
                          Calculating best route...
                        </Text>
                      </View>
                    )}

                  {order.status === "delivered" && (
                    <View style={styles.deliveryComplete}>
                      <LottieView
                        source={animations.driver_delivery_complete}
                        style={styles.completeAnimation}
                        autoPlay
                        loop={false}
                      />
                      <Text style={styles.completeText}>
                        Delivery Complete! 🎉
                      </Text>
                    </View>
                  )}
                </MapView>

                <View style={styles.mapLegend}>
                  <View style={styles.legendRow}>
                    <View style={styles.legendItem}>
                      <View
                        style={[
                          styles.legendDot,
                          { backgroundColor: "#FF6B35" },
                        ]}
                      />
                      <Text style={styles.legendText}>Restaurant</Text>
                    </View>

                    <View style={styles.legendItem}>
                      <View
                        style={[
                          styles.legendDot,
                          { backgroundColor: "#10B981" },
                        ]}
                      />
                      <Text style={styles.legendText}>Customer</Text>
                    </View>

                    <View style={styles.legendItem}>
                      <View
                        style={[
                          styles.legendDot,
                          { backgroundColor: "#3B82F6" },
                        ]}
                      />
                      <Text style={styles.legendText}>You</Text>
                    </View>
                  </View>

                  {/* Route Status Indicator */}
                  <View style={styles.routeStatus}>
                    <View
                      style={[
                        styles.routeStatusIndicator,
                        {
                          backgroundColor:
                            currentRouteType === "toRestaurant"
                              ? "#3B82F6"
                              : "#10B981",
                        },
                      ]}
                    >
                      <Ionicons
                        name={
                          currentRouteType === "toRestaurant"
                            ? "restaurant"
                            : "home"
                        }
                        size={16}
                        color="#fff"
                      />
                    </View>
                    <Text style={styles.routeStatusText}>
                      {currentRouteType === "toRestaurant"
                        ? "Go to restaurant to pickup order"
                        : "Deliver to customer"}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        )}

        <View style={styles.spacer} />
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        {order.status === "ready" && (
          <TouchableOpacity
            style={[styles.actionButton, styles.pickupButton]}
            onPress={handlePickupOrder}
            disabled={isPickingUp}
          >
            {isPickingUp ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={styles.pickupButtonText}>Pick Up Order</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {order.status === "out_for_delivery" && (
          <TouchableOpacity
            style={[styles.actionButton, styles.deliverButton]}
            onPress={handleDeliverOrder}
            disabled={isDelivering}
          >
            {isDelivering ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-done" size={20} color="#fff" />
                <Text style={styles.deliverButtonText}>Mark as Delivered</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {(order.status === "ready" || order.status === "out_for_delivery") && (
          <TouchableOpacity
            style={[styles.actionButton, styles.cancelButton]}
            onPress={handleCancelDelivery}
          >
            <Ionicons name="close-circle" size={20} color="#EF4444" />
            <Text style={styles.cancelButtonText}>Cancel Delivery</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.actionButton, styles.supportButton]}
          onPress={() => {
            Alert.alert(
              "Contact Support",
              "Call: +971 1234 56789\nWhatsApp: +971 1234 56789",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Call Now",
                  onPress: () => Linking.openURL("tel:+971123456789"),
                },
              ],
            );
          }}
        >
          <Ionicons name="headset" size={20} color="#3B82F6" />
          <Text style={styles.supportButtonText}>Contact Support</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  // Container & Layout
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
    fontSize: 13,
    color: "#6B7280",
    fontWeight: "500",
    letterSpacing: 0.2,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: "#fff",
  },
  errorContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginTop: 16,
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  errorText: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 24,
    fontWeight: "400",
    lineHeight: 18,
    letterSpacing: 0.1,
  },
  backButton: {
    backgroundColor: "#FF6B35",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.2,
  },

  // Header
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
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    letterSpacing: -0.2,
  },

  // Content
  content: {
    flex: 1,
  },

  // Status Card
  statusCard: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  statusHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  statusIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  statusInfo: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
    letterSpacing: -0.1,
    marginBottom: 2,
  },
  orderNumber: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "500",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },

  // Order Info
  orderInfo: {
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
    width: 120,
    fontWeight: "500",
    letterSpacing: 0.2,
  },
  orderValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#111827",
    flex: 1,
    letterSpacing: -0.1,
  },

  // Earnings
  earningsCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    padding: 12,
  },
  earningsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  earningItem: {
    alignItems: "center",
  },
  earningLabel: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 4,
    fontWeight: "600",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  earningValue: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
    marginTop: 2,
    letterSpacing: -0.2,
  },
  yourEarnings: {
    color: "#10B981",
  },

  // Sections
  section: {
    marginHorizontal: 16,
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
    letterSpacing: -0.1,
  },

  // Delivery Steps
  stepCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  stepHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  stepIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#6B7280",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  stepIconCurrent: {
    backgroundColor: "#FF6B35",
  },
  stepIconCompleted: {
    backgroundColor: "#10B981",
  },
  stepInfo: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
    letterSpacing: -0.1,
  },
  stepDescription: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
    fontWeight: "500",
    letterSpacing: 0.1,
  },
  stepDistance: {
    fontSize: 11,
    color: "#3B82F6",
    marginTop: 2,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  navigateButtonSmall: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  navigateText: {
    fontSize: 12,
    color: "#3B82F6",
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  stepActions: {
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    paddingTop: 12,
  },
  contactButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
    marginBottom: 8,
  },
  contactText: {
    fontSize: 12,
    color: "#3B82F6",
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  stepAddress: {
    fontSize: 12,
    color: "#6B7280",
    lineHeight: 16,
    fontWeight: "400",
    letterSpacing: 0.1,
  },

  // Order Items
  itemsList: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    overflow: "hidden",
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
    backgroundColor: "#F3F4F6",
  },
  itemDetails: {
    flex: 1,
    marginLeft: 12,
  },
  itemName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
    letterSpacing: -0.1,
  },
  itemQuantity: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
    fontWeight: "500",
    letterSpacing: 0.1,
  },
  itemPrice: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
    letterSpacing: -0.1,
  },

  // Instructions
  instructionsCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 8,
  },
  instructionsText: {
    flex: 1,
    fontSize: 13,
    color: "#6B7280",
    lineHeight: 18,
    fontWeight: "400",
    letterSpacing: 0.1,
  },

  // Map
  mapContainer: {
    height: 500,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  map: {
    flex: 1,
  },
  restaurantMarker: {
    backgroundColor: "#fff",
    padding: 4,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  customerMarker: {
    backgroundColor: "#fff",
    padding: 4,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  driverMarker: {
    backgroundColor: "#fff",
    padding: 4,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },

  // Spacer
  spacer: {
    height: 300,
  },

  // Action Buttons
  actionButtons: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    gap: 8,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
  },
  pickupButton: {
    backgroundColor: "#FF6B35",
  },
  pickupButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  deliverButton: {
    backgroundColor: "#10B981",
  },
  deliverButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  cancelButton: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  cancelButtonText: {
    color: "#EF4444",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  supportButton: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#DBEAFE",
  },
  supportButtonText: {
    color: "#3B82F6",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  liveDriverMarker: {
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  livePulse: {
    position: "absolute",
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#3B82F6",
    opacity: 0.3,
    animationDuration: "2000ms",
    animationIterationCount: "infinite",
    animationName: "pulse",
  },

  // Add to your existing styles
  markerContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  directionArrow: {
    backgroundColor: "#fff",
    padding: 4,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#E5E7EB",
  },
  startPoint: {
    backgroundColor: "#3B82F6",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  startPointText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
  endPoint: {
    backgroundColor: "#10B981",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  endPointText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
  mapLegend: {
    backgroundColor: "#fff",
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  legendRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 12,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "500",
  },
  routeStatus: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F9FAFB",
    padding: 10,
    borderRadius: 8,
    gap: 8,
  },
  routeStatusIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  routeStatusText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },

  loadingAnimation: {
    width: 100,
    height: 100,
  },
  statusAnimation: {
    width: 50,
    height: 50,
  },
  routeCalculating: {
    alignItems: "center",
    padding: 16,
  },
  routeAnimation: {
    width: 60,
    height: 60,
  },
  routeCalculatingText: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 8,
  },
  deliveryComplete: {
    alignItems: "center",
    padding: 16,
  },
  completeAnimation: {
    width: 80,
    height: 80,
  },
  completeText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#10B981",
    marginTop: 8,
  },
});
