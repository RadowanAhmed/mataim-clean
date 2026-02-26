// app/(tabs)/orders/track.tsx - Live Order Tracking Screen
import { useAuth } from "@/backend/AuthContext";
import { supabase } from "@/backend/supabase";
import animations from "@/constent/animations";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import LottieView from "lottie-react-native";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  Image,
  Linking,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

export default function TrackOrderScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const {
    orderId,
    restaurantId,
    restaurantName,
    restaurantLat,
    restaurantLng,
  } = params;
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [order, setOrder] = useState<any>(null);
  const [restaurant, setRestaurant] = useState<any>(null);
  const [driver, setDriver] = useState<any>(null);
  const [orderItems, setOrderItems] = useState<any[]>([]);

  // Location states
  const [userLocation, setUserLocation] = useState<any>(null);
  const [restaurantLocation, setRestaurantLocation] = useState<any>(null);
  const [driverLocation, setDriverLocation] = useState<any>(null);
  const [deliveryLocation, setDeliveryLocation] = useState<any>(null);
  const [region, setRegion] = useState<any>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<any[]>([]);
  const [distanceToDriver, setDistanceToDriver] = useState<number | null>(null);
  const [estimatedArrival, setEstimatedArrival] = useState<string>("");

  // Order tracking states
  const [orderUpdates, setOrderUpdates] = useState<any[]>([]);
  const [timeRemaining, setTimeRemaining] = useState<string>("");
  const [driverSpeed, setDriverSpeed] = useState<number>(0);
  const [isArriving, setIsArriving] = useState(false);

  // Animation refs
  const mapRef = useRef<MapView>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const orderSubscription = useRef<any>(null);
  const locationInterval = useRef<any>(null);
  const driverAnimation = useRef<any>(null);

  // Animated driver marker
  const [driverAnimationCoords, setDriverAnimationCoords] = useState<any>(null);
  const [animationKey, setAnimationKey] = useState(0);

  // Get order status progress (0 to 1)
  const getOrderProgress = () => {
    if (!order) return 0;

    const statusWeights: { [key: string]: number } = {
      pending: 0.1,
      confirmed: 0.2,
      preparing: 0.4,
      ready: 0.6,
      out_for_delivery: 0.8,
      delivered: 1.0,
      cancelled: 0,
    };

    return statusWeights[order.status] || 0;
  };

  // Update animation key when status changes
  useEffect(() => {
    if (order?.status) {
      setAnimationKey((prev) => prev + 1);
    }
  }, [order?.status]);

  useEffect(() => {
    // Start pulse animation
    const pulse = () => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    };

    pulse();

    // Animate progress bar
    Animated.timing(progressAnim, {
      toValue: getOrderProgress(),
      duration: 1000,
      useNativeDriver: false,
    }).start();

    return () => {
      if (orderSubscription.current) {
        orderSubscription.current.unsubscribe();
      }
      if (locationInterval.current) {
        clearInterval(locationInterval.current);
      }
      if (driverAnimation.current) {
        clearInterval(driverAnimation.current);
      }
    };
  }, [order?.status]);

  useEffect(() => {
    if (orderId) {
      fetchOrderDetails();
      subscribeToOrderUpdates();
      startLocationTracking();
    }

    // Try to get user location
    getUserLocation();

    return () => {
      if (orderSubscription.current) {
        orderSubscription.current.unsubscribe();
      }
      if (locationInterval.current) {
        clearInterval(locationInterval.current);
      }
    };
  }, [orderId]);

  const getUserLocation = async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;

      let location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      setUserLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
    } catch (error) {
      console.error("Error getting user location:", error);
    }
  };

  const fetchOrderDetails = async () => {
    try {
      setLoading(true);

      // First, fetch order without nested relationships
      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .select(
          `
          id,
          order_number,
          restaurant_id,
          driver_id,
          status,
          total_amount,
          delivery_fee,
          tax_amount,
          final_amount,
          payment_method,
          payment_status,
          delivery_address,
          special_instructions,
          estimated_delivery_time,
          actual_delivery_time,
          created_at,
          updated_at
        `,
        )
        .eq("id", orderId)
        .single();

      if (orderError) throw orderError;
      setOrder(orderData);

      // Fetch restaurant details separately
      if (orderData.restaurant_id) {
        const { data: restaurantData, error: restaurantError } = await supabase
          .from("restaurants")
          .select(
            `
            *,
            users!inner(
              full_name,
              phone,
              profile_image_url
            )
          `,
          )
          .eq("id", orderData.restaurant_id)
          .single();

        if (!restaurantError && restaurantData) {
          setRestaurant(restaurantData);

          // Set restaurant location
          if (restaurantData.latitude && restaurantData.longitude) {
            setRestaurantLocation({
              latitude: parseFloat(restaurantData.latitude),
              longitude: parseFloat(restaurantData.longitude),
            });
          } else if (restaurantLat && restaurantLng) {
            setRestaurantLocation({
              latitude: parseFloat(restaurantLat as string),
              longitude: parseFloat(restaurantLng as string),
            });
          }
        }
      }

      // Fetch driver details if assigned
      if (orderData.driver_id) {
        const { data: driverData, error: driverError } = await supabase
          .from("delivery_users")
          .select(
            `
            *,
            users!inner(
              full_name,
              phone,
              profile_image_url
            )
          `,
          )
          .eq("id", orderData.driver_id)
          .single();

        if (!driverError && driverData) {
          setDriver(driverData);

          // Set driver location
          if (
            driverData.current_location_lat &&
            driverData.current_location_lng
          ) {
            const location = {
              latitude: parseFloat(driverData.current_location_lat),
              longitude: parseFloat(driverData.current_location_lng),
            };
            setDriverLocation(location);
            setDriverAnimationCoords(location);
          }
        }
      }

      // Parse delivery address
      if (orderData.delivery_address) {
        try {
          const address =
            typeof orderData.delivery_address === "string"
              ? JSON.parse(orderData.delivery_address)
              : orderData.delivery_address;

          if (address.latitude && address.longitude) {
            setDeliveryLocation({
              latitude: parseFloat(address.latitude),
              longitude: parseFloat(address.longitude),
            });
          }
        } catch (error) {
          console.error("Error parsing delivery address:", error);
        }
      }

      // Fetch order items
      const { data: itemsData, error: itemsError } = await supabase
        .from("order_items")
        .select(
          `
          id,
          quantity,
          unit_price,
          post_id,
          menu_item_id
        `,
        )
        .eq("order_id", orderId);

      if (!itemsError && itemsData) {
        // Fetch item details
        const itemsWithDetails = await Promise.all(
          itemsData.map(async (item: any) => {
            let itemDetails: any = { ...item };

            if (item.post_id) {
              const { data: postData } = await supabase
                .from("posts")
                .select("title, image_url")
                .eq("id", item.post_id)
                .single();

              if (postData) {
                itemDetails.posts = postData;
              }
            } else if (item.menu_item_id) {
              const { data: menuData } = await supabase
                .from("menu_items")
                .select("name, image_url")
                .eq("id", item.menu_item_id)
                .single();

              if (menuData) {
                itemDetails.menu_items = menuData;
              }
            }

            return itemDetails;
          }),
        );

        setOrderItems(itemsWithDetails);
      }

      // Fetch order updates
      const { data: updatesData } = await supabase
        .from("order_notifications")
        .select("*")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false });

      setOrderUpdates(updatesData || []);

      // Calculate initial distance and time
      calculateDistanceAndTime();
    } catch (error) {
      console.error("Error fetching order details:", error);
      Alert.alert("Error", "Failed to load order tracking");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const subscribeToOrderUpdates = () => {
    if (!orderId) return;

    orderSubscription.current = supabase
      .channel(`order-track-${orderId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `id=eq.${orderId}`,
        },
        async (payload) => {
          const updatedOrder = payload.new;
          setOrder(updatedOrder);

          // Animate progress bar on status change
          Animated.timing(progressAnim, {
            toValue: getOrderProgress(),
            duration: 500,
            useNativeDriver: false,
          }).start();

          // Add to order updates
          const newUpdate = {
            id: Date.now().toString(),
            title: "Status Update",
            message: `Order status updated to ${updatedOrder.status.replace(/_/g, " ")}`,
            created_at: new Date().toISOString(),
          };

          setOrderUpdates((prev) => [newUpdate, ...prev]);

          // Check if arriving
          if (updatedOrder.status === "out_for_delivery") {
            calculateDistanceAndTime();
            setIsArriving(true);
          }

          if (updatedOrder.status === "delivered") {
            setIsArriving(false);
          }

          // Fetch updated driver details if driver changed
          if (
            updatedOrder.driver_id &&
            (!driver || driver.id !== updatedOrder.driver_id)
          ) {
            const { data: driverData } = await supabase
              .from("delivery_users")
              .select(
                `
                *,
                users!inner(
                  full_name,
                  phone,
                  profile_image_url
                )
              `,
              )
              .eq("id", updatedOrder.driver_id)
              .single();

            if (driverData) {
              setDriver(driverData);
            }
          }
        },
      )
      .subscribe();
  };

  const startLocationTracking = () => {
    // Simulate driver movement (in real app, this would come from WebSockets)
    locationInterval.current = setInterval(() => {
      if (driverLocation && order?.status === "out_for_delivery") {
        simulateDriverMovement();
        calculateDistanceAndTime();
      }
    }, 10000); // Update every 10 seconds
  };

  const simulateDriverMovement = () => {
    if (!driverLocation || !deliveryLocation) return;

    // Simulate moving towards delivery location
    const latDiff = deliveryLocation.latitude - driverLocation.latitude;
    const lngDiff = deliveryLocation.longitude - driverLocation.longitude;

    // Move 10% closer each update
    const newLocation = {
      latitude: driverLocation.latitude + latDiff * 0.1,
      longitude: driverLocation.longitude + lngDiff * 0.1,
    };

    setDriverLocation(newLocation);

    // Animate driver marker movement
    animateDriverMarker(newLocation);
  };

  const animateDriverMarker = (newLocation: any) => {
    if (!driverAnimationCoords) return;

    const steps = 20;
    const latStep =
      (newLocation.latitude - driverAnimationCoords.latitude) / steps;
    const lngStep =
      (newLocation.longitude - driverAnimationCoords.longitude) / steps;

    let step = 0;

    if (driverAnimation.current) {
      clearInterval(driverAnimation.current);
    }

    driverAnimation.current = setInterval(() => {
      if (step >= steps) {
        clearInterval(driverAnimation.current);
        setDriverAnimationCoords(newLocation);
        return;
      }

      setDriverAnimationCoords({
        latitude: driverAnimationCoords.latitude + latStep,
        longitude: driverAnimationCoords.longitude + lngStep,
      });

      step++;
    }, 50);
  };

  const calculateDistanceAndTime = () => {
    if (!driverLocation || !deliveryLocation) return;

    // Calculate distance between driver and delivery location
    const R = 6371; // Earth's radius in km
    const lat1 = (driverLocation.latitude * Math.PI) / 180;
    const lat2 = (deliveryLocation.latitude * Math.PI) / 180;
    const dLat =
      ((deliveryLocation.latitude - driverLocation.latitude) * Math.PI) / 180;
    const dLng =
      ((deliveryLocation.longitude - driverLocation.longitude) * Math.PI) / 180;

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in km

    setDistanceToDriver(distance);

    // Calculate estimated arrival time (assuming average speed of 30 km/h in traffic)
    const averageSpeed = 30; // km/h
    const timeInHours = distance / averageSpeed;
    const timeInMinutes = Math.round(timeInHours * 60);

    if (timeInMinutes < 1) {
      setEstimatedArrival("Arriving now");
      setTimeRemaining("Less than 1 min");
    } else if (timeInMinutes <= 5) {
      setEstimatedArrival("Arriving soon");
      setTimeRemaining(`${timeInMinutes} min`);
    } else {
      const now = new Date();
      const arrivalTime = new Date(now.getTime() + timeInMinutes * 60000);
      setEstimatedArrival(
        arrivalTime.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
      setTimeRemaining(`${timeInMinutes} min`);
    }

    // Calculate driver speed (simulated)
    const speed = Math.random() * 10 + 20; // Random speed between 20-30 km/h
    setDriverSpeed(Math.round(speed));
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchOrderDetails();
  };

  const setupMapRegion = () => {
    const locations = [];

    if (restaurantLocation) locations.push(restaurantLocation);
    if (driverAnimationCoords) locations.push(driverAnimationCoords);
    if (deliveryLocation) locations.push(deliveryLocation);

    if (locations.length === 0 && userLocation) {
      locations.push(userLocation);
    }

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

      const padding = 0.01;
      const region = {
        latitude: (minLat + maxLat) / 2,
        longitude: (minLng + maxLng) / 2,
        latitudeDelta: Math.max((maxLat - minLat) * 1.5 + padding, 0.05),
        longitudeDelta: Math.max((maxLng - minLng) * 1.5 + padding, 0.05),
      };

      setRegion(region);

      // Animate map to region
      if (mapRef.current) {
        mapRef.current.animateToRegion(region, 1000);
      }

      // Set route coordinates for polyline
      if (restaurantLocation && deliveryLocation) {
        const route = [restaurantLocation];
        if (driverAnimationCoords) {
          route.push(driverAnimationCoords);
        }
        route.push(deliveryLocation);
        setRouteCoordinates(route);
      }
    }
  };

  useEffect(() => {
    if (
      restaurantLocation ||
      driverAnimationCoords ||
      deliveryLocation ||
      userLocation
    ) {
      setupMapRegion();
    }
  }, [
    restaurantLocation,
    driverAnimationCoords,
    deliveryLocation,
    userLocation,
  ]);

  const handleContactDriver = () => {
    if (driver?.users?.phone) {
      Linking.openURL(`tel:${driver.users.phone}`).catch((err) => {
        Alert.alert("Error", "Unable to make phone call");
      });
    }
  };

  const handleContactRestaurant = () => {
    if (restaurant?.users?.phone) {
      Linking.openURL(`tel:${restaurant.users.phone}`).catch((err) => {
        Alert.alert("Error", "Unable to make phone call");
      });
    }
  };

  const handleViewOrderDetails = () => {
    if (orderId) {
      router.push(`/orders/${orderId}`);
    }
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
        return animations.restaurant_cafe;
    }
  };

  const getStatusText = (status: string) => {
    switch (status?.toLowerCase()) {
      case "pending":
        return "Order Placed";
      case "confirmed":
        return "Order Confirmed";
      case "preparing":
        return "Preparing Your Order";
      case "ready":
        return "Ready for Pickup";
      case "out_for_delivery":
        return "On the Way to You";
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

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <View style={styles.loadingContent}>
          <LottieView
            source={animations.fast_delivery || animations.restaurant_cafe}
            style={styles.loadingAnimation}
            autoPlay
            loop
          />
          <Text style={styles.loadingTitle}>Loading Live Tracking</Text>
          <Text style={styles.loadingText}>Getting your order location...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <View style={styles.errorContent}>
          <LottieView
            source={animations.empty_box || animations.restaurant_cafe}
            style={styles.errorAnimation}
            autoPlay
            loop
          />
          <Text style={styles.errorTitle}>Order Not Found</Text>
          <Text style={styles.errorText}>
            We couldn't find the order you're trying to track.
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
        <Text style={styles.headerTitle}>Live Tracking</Text>
        <TouchableOpacity onPress={onRefresh} disabled={refreshing}>
          <Ionicons
            name="refresh"
            size={20}
            color={refreshing ? "#9CA3AF" : "#FF6B35"}
          />
        </TouchableOpacity>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <Animated.View
            style={[
              styles.progressFill,
              {
                width: progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["0%", "100%"],
                }),
                backgroundColor: getStatusColor(order.status),
              },
            ]}
          />
        </View>
        <View style={styles.progressLabels}>
          <Text style={styles.progressText}>Ordered</Text>
          <Text style={styles.progressText}>Preparing</Text>
          <Text style={styles.progressText}>On the Way</Text>
          <Text style={styles.progressText}>Delivered</Text>
        </View>
      </View>

      {/* Map Section - Now takes half screen */}
      <View style={styles.mapContainer}>
        {region && (
          <MapView
            ref={mapRef}
            style={styles.map}
            provider={PROVIDER_GOOGLE}
            initialRegion={region}
            showsUserLocation={true}
            showsMyLocationButton={false}
            showsCompass={true}
            zoomControlEnabled={true}
          >
            {/* Restaurant Marker */}
            {restaurantLocation && (
              <Marker coordinate={restaurantLocation}>
                <Animated.View
                  style={[
                    styles.restaurantMarker,
                    { transform: [{ scale: pulseAnim }] },
                  ]}
                >
                  <Ionicons name="restaurant" size={20} color="#fff" />
                </Animated.View>
              </Marker>
            )}

            {/* Driver Marker (animated) */}
            {driverAnimationCoords && (
              <Marker coordinate={driverAnimationCoords}>
                <View style={styles.driverMarker}>
                  <Ionicons name="bicycle" size={18} color="#fff" />
                </View>
              </Marker>
            )}

            {/* Delivery Location Marker */}
            {deliveryLocation && (
              <Marker coordinate={deliveryLocation}>
                <View style={styles.deliveryMarker}>
                  <Ionicons name="location" size={20} color="#fff" />
                </View>
              </Marker>
            )}

            {/* Route Polyline */}
            {routeCoordinates.length > 1 && (
              <Polyline
                coordinates={routeCoordinates}
                strokeColor="#3B82F6"
                strokeWidth={3}
                lineDashPattern={[10, 10]}
              />
            )}
          </MapView>
        )}

        {/* Driver Info Card */}
        {driver && (
          <View style={styles.driverCard}>
            <View style={styles.driverInfo}>
              <Image
                source={{
                  uri:
                    driver.users?.profile_image_url ||
                    "https://via.placeholder.com/50",
                }}
                style={styles.driverAvatar}
              />
              <View style={styles.driverDetails}>
                <Text style={styles.driverName}>{driver.users?.full_name}</Text>
                <View style={styles.driverStats}>
                  <View style={styles.driverStat}>
                    <Ionicons name="star" size={12} color="#FFD700" />
                    <Text style={styles.driverStatText}>
                      {driver.rating?.toFixed(1) || "4.5"}
                    </Text>
                  </View>
                  <View style={styles.driverStat}>
                    <Ionicons name="bicycle" size={12} color="#6B7280" />
                    <Text style={styles.driverStatText}>
                      {driver.vehicle_type || "Bike"}
                    </Text>
                  </View>
                  <View style={styles.driverStat}>
                    <Ionicons name="speedometer" size={12} color="#6B7280" />
                    <Text style={styles.driverStatText}>
                      {driverSpeed} km/h
                    </Text>
                  </View>
                </View>
              </View>
              <TouchableOpacity
                style={styles.contactButton}
                onPress={handleContactDriver}
              >
                <Ionicons name="call" size={18} color="#3B82F6" />
                <Text style={styles.contactText}>Call</Text>
              </TouchableOpacity>
            </View>

            {distanceToDriver !== null && (
              <View style={styles.distanceInfo}>
                <Ionicons name="navigate" size={16} color="#FF6B35" />
                <Text style={styles.distanceText}>
                  {distanceToDriver < 1
                    ? `${(distanceToDriver * 1000).toFixed(0)} m away`
                    : `${distanceToDriver.toFixed(1)} km away`}
                </Text>
                <Text style={styles.arrivalText}>
                  • ETA: {estimatedArrival}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Map Legend - Positioned at bottom of map */}
        <View style={styles.mapLegend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: "#FF6B35" }]} />
            <Text style={styles.legendText}>Restaurant</Text>
          </View>
          {driver && (
            <View style={styles.legendItem}>
              <View
                style={[styles.legendDot, { backgroundColor: "#3B82F6" }]}
              />
              <Text style={styles.legendText}>Driver</Text>
            </View>
          )}
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: "#10B981" }]} />
            <Text style={styles.legendText}>Your Location</Text>
          </View>
        </View>
      </View>

      {/* Order Info Section - Takes the other half */}
      <ScrollView
        style={styles.infoContainer}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.infoContent}
      >
        {/* Current Status */}
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
                {getStatusText(order.status)}
              </Text>
              <Text style={styles.statusSubtitle}>
                {order.status === "out_for_delivery"
                  ? `Arriving in ${timeRemaining}`
                  : order.estimated_delivery_time
                    ? `Estimated delivery: ${formatTime(order.estimated_delivery_time)}`
                    : "Processing your order"}
              </Text>
            </View>
            <Text style={styles.orderNumber}>#{order.order_number}</Text>
          </View>
        </View>

        {/* Restaurant Info */}
        {restaurant && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Restaurant</Text>
            <TouchableOpacity
              style={styles.restaurantCard}
              onPress={() => router.push(`/restaurant/${restaurant.id}`)}
            >
              <Image
                source={{
                  uri:
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
                  <Text style={styles.restaurantOrders}>
                    📦 {restaurant.total_orders?.toLocaleString() || "0"} orders
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.callButton}
                onPress={handleContactRestaurant}
              >
                <Ionicons name="call" size={16} color="#3B82F6" />
                <Text style={styles.callText}>Call</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </View>
        )}

        {/* Order Items Preview */}
        {orderItems.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Order</Text>
            <View style={styles.itemsPreview}>
              {orderItems.slice(0, 3).map((item, index) => (
                <View key={index} style={styles.itemPreview}>
                  <Image
                    source={{
                      uri:
                        item.posts?.image_url ||
                        item.menu_items?.image_url ||
                        "https://via.placeholder.com/40",
                    }}
                    style={styles.itemPreviewImage}
                  />
                  <Text style={styles.itemPreviewName} numberOfLines={1}>
                    {item.posts?.title || item.menu_items?.name}
                  </Text>
                  <Text style={styles.itemPreviewQuantity}>
                    ×{item.quantity}
                  </Text>
                </View>
              ))}
              {orderItems.length > 3 && (
                <Text style={styles.moreItemsText}>
                  +{orderItems.length - 3} more items
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Order Updates */}
        {orderUpdates.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Order Updates</Text>
              <Text style={styles.updatesCount}>{orderUpdates.length}</Text>
            </View>
            <View style={styles.updatesList}>
              {orderUpdates.slice(0, 3).map((update, index) => (
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

        {/* Delivery Instructions */}
        {order.special_instructions && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Delivery Instructions</Text>
            <View style={styles.instructionsCard}>
              <Ionicons name="document-text" size={18} color="#6B7280" />
              <Text style={styles.instructionsText}>
                {order.special_instructions}
              </Text>
            </View>
          </View>
        )}

        {/* Safety Tips */}
        {isArriving && (
          <View style={[styles.section, styles.safetySection]}>
            <Text style={styles.safetyTitle}>🚨 Arriving Soon</Text>
            <View style={styles.safetyTips}>
              <Text style={styles.safetyTip}>
                • Wait in a safe, visible location
              </Text>
              <Text style={styles.safetyTip}>
                • Have your payment ready (if cash)
              </Text>
              <Text style={styles.safetyTip}>
                • Check order before driver leaves
              </Text>
              <Text style={styles.safetyTip}>• Maintain social distance</Text>
            </View>
          </View>
        )}

        <View style={styles.spacer} />
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.actionButton, styles.detailsButton]}
          onPress={handleViewOrderDetails}
        >
          <Ionicons name="receipt" size={20} color="#6B7280" />
          <Text style={styles.detailsButtonText}>View Order Details</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.supportButton]}
          onPress={() => Linking.openURL("tel:+971123456789")}
        >
          <Ionicons name="headset" size={20} color="#3B82F6" />
          <Text style={styles.supportButtonText}>Live Support</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#fff",
  },
  loadingContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  loadingAnimation: {
    width: 120,
    height: 120,
    marginBottom: 20,
  },
  errorAnimation: {
    width: 120,
    height: 120,
    marginBottom: 20,
  },
  loadingTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
  },
  loadingText: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
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
  progressContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#F9FAFB",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  progressBar: {
    height: 6,
    backgroundColor: "#E5E7EB",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  progressLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  progressText: {
    fontSize: 10,
    color: "#6B7280",
    fontWeight: "500",
  },
  // Map now takes half the screen
  mapContainer: {
    height: SCREEN_HEIGHT * 0.4,
    backgroundColor: "#f3f4f6",
    position: "relative",
  },
  map: {
    width: "100%",
    height: "100%",
  },
  restaurantMarker: {
    backgroundColor: "#FF6B35",
    padding: 8,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  driverMarker: {
    backgroundColor: "#3B82F6",
    padding: 8,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  deliveryMarker: {
    backgroundColor: "#10B981",
    padding: 8,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  driverCard: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: 12,
    padding: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  driverInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  driverAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  driverDetails: {
    flex: 1,
  },
  driverName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  driverStats: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  driverStat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  driverStatText: {
    fontSize: 12,
    color: "#6B7280",
  },
  contactButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  contactText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#3B82F6",
  },
  distanceInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  distanceText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#111827",
  },
  arrivalText: {
    fontSize: 13,
    color: "#6B7280",
  },
  mapLegend: {
    position: "absolute",
    bottom: 12,
    left: 12,
    right: 12,
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    borderRadius: 12,
    padding: 12,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 12,
    color: "#fff",
  },
  // Info container takes the other half
  infoContainer: {
    flex: 1,
  },
  infoContent: {
    padding: 16,
    paddingBottom: 100,
  },
  statusCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  statusHeader: {
    flexDirection: "row",
    alignItems: "center",
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
    width: 50,
    height: 50,
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
  },
  orderNumber: {
    fontSize: 12,
    color: "#9CA3AF",
    fontWeight: "600",
  },
  section: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  updatesCount: {
    fontSize: 12,
    color: "#6B7280",
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  restaurantCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  restaurantImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  restaurantInfo: {
    flex: 1,
  },
  restaurantName: {
    fontSize: 14,
    fontWeight: "700",
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
  restaurantOrders: {
    fontSize: 12,
    color: "#6B7280",
  },
  callButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  callText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#3B82F6",
  },
  itemsPreview: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  itemPreview: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  itemPreviewImage: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginRight: 12,
  },
  itemPreviewName: {
    flex: 1,
    fontSize: 13,
    color: "#111827",
  },
  itemPreviewQuantity: {
    fontSize: 13,
    color: "#6B7280",
    fontWeight: "600",
  },
  moreItemsText: {
    fontSize: 12,
    color: "#9CA3AF",
    textAlign: "center",
    marginTop: 4,
  },
  updatesList: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    overflow: "hidden",
  },
  updateItem: {
    flexDirection: "row",
    alignItems: "center",
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
    fontSize: 13,
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
    color: "#374151",
    lineHeight: 18,
  },
  safetySection: {
    backgroundColor: "#FEF3C7",
    borderRadius: 12,
    padding: 16,
  },
  safetyTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#92400E",
    marginBottom: 8,
  },
  safetyTips: {
    gap: 4,
  },
  safetyTip: {
    fontSize: 12,
    color: "#92400E",
    lineHeight: 16,
  },
  spacer: {
    height: 20,
  },
  actionButtons: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    padding: 16,
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
  },
  detailsButton: {
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  detailsButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
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
});
