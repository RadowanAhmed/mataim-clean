// app/(driver)/dashboard.tsx
import { useAuth } from "@/backend/AuthContext";
import { useLocation } from "@/backend/LocationContext";
import { supabase } from "@/backend/supabase";
import {
  calculateRoute,
  Coordinate,
  geocodeAddress,
} from "@/backend/utils/openRouteService";
import animations from "@/constent/animations";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import LottieView from "lottie-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  AppStateStatus,
  Dimensions,
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
import NotificationBell from "../components/NotificationBell";
import OrderAlert from "./orders/OrderAlert";

const { width, height } = Dimensions.get("window");

// Map Panel Component for Active Delivery
// app/(driver)/dashboard.tsx - Fixed ActiveDeliveryMapPanel

const ActiveDeliveryMapPanel = ({
  order,
  driverLocation,
}: {
  order: any;
  driverLocation: Coordinate;
}) => {
  const [routeCoordinates, setRouteCoordinates] = useState<Coordinate[]>([]);
  const [mapRegion, setMapRegion] = useState(null);
  const [restaurantCoords, setRestaurantCoords] = useState<Coordinate | null>(
    null,
  );
  const [customerCoords, setCustomerCoords] = useState<Coordinate | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [eta, setEta] = useState<string>("Calculating...");
  const [customerAddress, setCustomerAddress] = useState<string>("");
  const mapRef = useRef(null);

  useEffect(() => {
    if (order && driverLocation) {
      loadLocationData();
    }
  }, [order, driverLocation]);

  const loadLocationData = async () => {
    try {
      // Get restaurant coordinates
      let restaurantLatLng: Coordinate | null = null;
      if (order.restaurants?.latitude && order.restaurants?.longitude) {
        restaurantLatLng = {
          latitude: order.restaurants.latitude,
          longitude: order.restaurants.longitude,
        };
      } else if (order.restaurants?.address) {
        // Geocode restaurant address
        restaurantLatLng = await geocodeAddress(order.restaurants.address);
      }
      setRestaurantCoords(restaurantLatLng);

      // Get customer coordinates from delivery address
      let customerLatLng: Coordinate | null = null;

      // Parse delivery address if it's an object
      if (order.delivery_address) {
        // Check if delivery_address is a string or object
        if (typeof order.delivery_address === "string") {
          try {
            // Try to parse if it's a JSON string
            const parsedAddress = JSON.parse(order.delivery_address);
            if (parsedAddress.latitude && parsedAddress.longitude) {
              customerLatLng = {
                latitude: parsedAddress.latitude,
                longitude: parsedAddress.longitude,
              };
            }
            // Set formatted address string
            setCustomerAddress(formatAddress(parsedAddress));
          } catch (e) {
            // Not JSON, use as plain string
            customerLatLng = await geocodeAddress(order.delivery_address);
            setCustomerAddress(order.delivery_address);
          }
        } else if (typeof order.delivery_address === "object") {
          // It's already an object
          if (
            order.delivery_address.latitude &&
            order.delivery_address.longitude
          ) {
            customerLatLng = {
              latitude: order.delivery_address.latitude,
              longitude: order.delivery_address.longitude,
            };
          }
          setCustomerAddress(formatAddress(order.delivery_address));
        }
      }
      setCustomerCoords(customerLatLng);

      // Calculate route based on order status
      await calculateAndSetRoute(restaurantLatLng, customerLatLng);

      // Update map region to fit all points
      updateMapRegion(restaurantLatLng, customerLatLng);
    } catch (error) {
      console.error("Error loading location data:", error);
    }
  };

  // Helper function to format address object to string
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

  const calculateAndSetRoute = async (
    restaurantCoords: Coordinate | null,
    customerCoords: Coordinate | null,
  ) => {
    setLoadingRoute(true);

    try {
      let route: Coordinate[] = [];
      let totalDuration = 0;

      if (order.status === "ready" || order.status === "out_for_delivery") {
        // Calculate route from driver to restaurant
        if (restaurantCoords) {
          const routeToRestaurant = await calculateRoute(
            driverLocation,
            restaurantCoords,
            "driving-car",
          );
          if (routeToRestaurant) {
            route = routeToRestaurant.coordinates;
            totalDuration += routeToRestaurant.duration;
          }
        }
      } else if (
        order.status === "picked_up" &&
        restaurantCoords &&
        customerCoords
      ) {
        // Calculate route from restaurant to customer
        const routeToCustomer = await calculateRoute(
          restaurantCoords,
          customerCoords,
          "driving-car",
        );
        if (routeToCustomer) {
          route = routeToCustomer.coordinates;
          totalDuration += routeToCustomer.duration;
        }
      }

      setRouteCoordinates(route);

      // Update ETA
      if (totalDuration > 0) {
        const etaMinutes = Math.ceil(totalDuration / 60);
        setEta(`${etaMinutes} min`);
      }
    } catch (error) {
      console.error("Error calculating route:", error);
      // Fallback to straight line if API fails
      if (restaurantCoords) {
        setRouteCoordinates([driverLocation, restaurantCoords]);
      }
    } finally {
      setLoadingRoute(false);
    }
  };

  const updateMapRegion = (
    restaurantCoords: Coordinate | null,
    customerCoords: Coordinate | null,
  ) => {
    const points: Coordinate[] = [driverLocation];

    if (restaurantCoords) points.push(restaurantCoords);
    if (customerCoords) points.push(customerCoords);

    if (points.length >= 2) {
      const latitudes = points.map((p) => p.latitude);
      const longitudes = points.map((p) => p.longitude);

      setMapRegion({
        latitude: (Math.min(...latitudes) + Math.max(...latitudes)) / 2,
        longitude: (Math.min(...longitudes) + Math.max(...longitudes)) / 2,
        latitudeDelta:
          Math.abs(Math.max(...latitudes) - Math.min(...latitudes)) * 1.5 +
          0.01,
        longitudeDelta:
          Math.abs(Math.max(...longitudes) - Math.min(...longitudes)) * 1.5 +
          0.01,
      });
    } else {
      // If we only have driver location, center on it
      setMapRegion({
        latitude: driverLocation.latitude,
        longitude: driverLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    }
  };

  const getOrderProgress = () => {
    switch (order.status) {
      case "ready":
      case "out_for_delivery":
        return {
          step: 1,
          totalSteps: 3,
          currentStep: "Going to restaurant",
          nextStep: "Pick up order",
        };
      case "picked_up":
        return {
          step: 2,
          totalSteps: 3,
          currentStep: "Going to customer",
          nextStep: "Deliver order",
        };
      default:
        return {
          step: 1,
          totalSteps: 3,
          currentStep: "Preparing",
          nextStep: "Start delivery",
        };
    }
  };

  if (!order || !driverLocation) return null;

  const progress = getOrderProgress();

  return (
    <View style={styles.mapPanel}>
      <View style={styles.mapPanelHeader}>
        <Text style={styles.mapPanelTitle}>Active Delivery</Text>
        <Text style={styles.mapPanelSubtitle}>
          Step {progress.step} of {progress.totalSteps}: {progress.currentStep}
        </Text>
      </View>

      <View style={styles.mapContainer}>
        {mapRegion ? (
          <MapView
            ref={mapRef}
            style={styles.map}
            provider={PROVIDER_GOOGLE}
            region={mapRegion}
            showsUserLocation={true}
            showsMyLocationButton={true}
            showsCompass={true}
            zoomEnabled={true}
            scrollEnabled={true}
            rotateEnabled={false}
          >
            {/* Driver Marker */}
            <Marker
              coordinate={driverLocation}
              title="Your Location"
              description="You are here"
            >
              <View style={styles.driverMarker}>
                <Ionicons name="navigate" size={20} color="#FFFFFF" />
              </View>
            </Marker>

            {/* Restaurant Marker */}
            {restaurantCoords && (
              <Marker
                coordinate={restaurantCoords}
                title="Restaurant"
                description={order.restaurants?.restaurant_name}
              >
                <View style={styles.restaurantMarker}>
                  <Ionicons name="restaurant" size={16} color="#FFFFFF" />
                </View>
              </Marker>
            )}

            {/* Customer Marker */}
            {customerCoords && (
              <Marker
                coordinate={customerCoords}
                title="Customer"
                description={order.customers?.full_name}
              >
                <View style={styles.customerMarker}>
                  <Ionicons name="person" size={16} color="#FFFFFF" />
                </View>
              </Marker>
            )}

            {/* Route Polyline */}
            {routeCoordinates.length > 1 && !loadingRoute && (
              <Polyline
                coordinates={routeCoordinates}
                strokeColor="#3B82F6"
                strokeWidth={4}
                lineDashPattern={[0]}
              />
            )}

            {/* Start and End Markers on Route */}
            {routeCoordinates.length > 0 && !loadingRoute && (
              <>
                <Marker coordinate={routeCoordinates[0]}>
                  <View style={styles.routeStartMarker}>
                    <View style={styles.routeStartInner} />
                  </View>
                </Marker>
                <Marker
                  coordinate={routeCoordinates[routeCoordinates.length - 1]}
                >
                  <View style={styles.routeEndMarker}>
                    <View style={styles.routeEndInner} />
                  </View>
                </Marker>
              </>
            )}
          </MapView>
        ) : (
          <View style={styles.mapPlaceholder}>
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text style={styles.mapPlaceholderText}>Loading map...</Text>
          </View>
        )}

        {loadingRoute && (
          <View style={styles.routeLoadingOverlay}>
            <ActivityIndicator size="small" color="#3B82F6" />
            <Text style={styles.routeLoadingText}>Calculating route...</Text>
          </View>
        )}
      </View>

      <View style={styles.deliveryInfo}>
        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <Ionicons name="restaurant" size={16} color="#6B7280" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Restaurant</Text>
              <Text style={styles.infoValue} numberOfLines={1}>
                {order.restaurants?.restaurant_name || "N/A"}
              </Text>
            </View>
          </View>

          <View style={styles.infoItem}>
            <Ionicons name="person" size={16} color="#6B7280" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Customer</Text>
              <Text style={styles.infoValue} numberOfLines={1}>
                {order.customers?.full_name || "N/A"}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <Ionicons name="location" size={16} color="#6B7280" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Delivery Address</Text>
              {/* FIXED: Use customerAddress state instead of raw order.delivery_address */}
              <Text style={styles.infoValue} numberOfLines={2}>
                {customerAddress || "Address not available"}
              </Text>
            </View>
          </View>

          <View style={styles.infoItem}>
            <Ionicons name="time" size={16} color="#6B7280" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>ETA</Text>
              <Text style={[styles.infoValue, styles.etaValue]}>{eta}</Text>
            </View>
          </View>
        </View>

        {/* Route Status */}
        {!loadingRoute && routeCoordinates.length > 0 && (
          <View style={styles.routeStatus}>
            <View style={styles.routeStatusItem}>
              <Ionicons name="navigate" size={14} color="#10B981" />
              <Text style={styles.routeStatusText}>Route calculated</Text>
            </View>
            <TouchableOpacity
              style={styles.navigationButton}
              onPress={() => {
                // Open in Google Maps or Apple Maps
                const destination =
                  order.status === "picked_up" && customerCoords
                    ? customerCoords
                    : restaurantCoords;

                if (destination) {
                  const url = `https://www.google.com/maps/dir/?api=1&destination=${destination.latitude},${destination.longitude}&travelmode=driving`;
                  Linking.openURL(url);
                }
              }}
            >
              <Text style={styles.navigationButtonText}>Start Navigation</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
};

export default function DriverDashboardScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<any>(null);
  const [availableOrdersCount, setAvailableOrdersCount] = useState(0);
  const [earnings, setEarnings] = useState({
    today: 0,
    total: 0,
    pending: 0,
  });
  const [stats, setStats] = useState({
    deliveriesToday: 0,
    totalDeliveries: 0,
    rating: 0,
    acceptanceRate: 0,
  });
  const [driverLocation, setDriverLocation] = useState<Coordinate | null>(null);
  const [locationWatcher, setLocationWatcher] = useState(null);

  // Refs to track component state and prevent unnecessary updates
  const isMounted = useRef(true);
  const refreshInterval = useRef<NodeJS.Timeout | null>(null);
  const appState = useRef(AppState.currentState);
  const orderSubscription = useRef<any>(null);
  const lastFetchTime = useRef<number>(0);
  const fetchInProgress = useRef(false);

  const { startTracking, stopTracking, isTracking } = useLocation();

  // Setup auto-refresh every minute when app is active
  const setupAutoRefresh = useCallback(() => {
    if (refreshInterval.current) {
      clearInterval(refreshInterval.current);
    }

    if (isOnline && appState.current === "active") {
      refreshInterval.current = setInterval(() => {
        const now = Date.now();
        // Only refresh if it's been more than 30 seconds since last fetch
        if (now - lastFetchTime.current > 30000 && !fetchInProgress.current) {
          console.log("🔄 Auto-refreshing dashboard data...");
          fetchDashboardData();
        }
      }, 60000); // Check every minute, but only fetch if needed
    }
  }, [isOnline]);

  // Handle app state changes
  useEffect(() => {
    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange,
    );

    return () => {
      subscription.remove();
      if (refreshInterval.current) {
        clearInterval(refreshInterval.current);
      }
      if (orderSubscription.current) {
        orderSubscription.current.unsubscribe();
      }
      if (locationWatcher) {
        locationWatcher.remove();
      }
      isMounted.current = false;
    };
  }, []);

  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (
      appState.current.match(/inactive|background/) &&
      nextAppState === "active"
    ) {
      console.log("App has come to the foreground!");
      // Refresh data when app comes to foreground, but only if it's been a while
      const now = Date.now();
      if (now - lastFetchTime.current > 30000 && !fetchInProgress.current) {
        fetchDashboardData();
      }
    }

    appState.current = nextAppState;

    // Setup auto-refresh based on new state
    if (nextAppState === "active") {
      setupAutoRefresh();
    } else {
      if (refreshInterval.current) {
        clearInterval(refreshInterval.current);
        refreshInterval.current = null;
      }
    }
  };

  // Setup real-time subscription
  const setupRealTimeSubscription = useCallback(() => {
    // Cleanup existing subscription
    if (orderSubscription.current) {
      orderSubscription.current.unsubscribe();
      orderSubscription.current = null;
    }

    if (user?.id) {
      orderSubscription.current = supabase
        .channel(`dashboard-orders-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "orders",
            filter: "status=eq.ready",
          },
          (payload) => {
            console.log("📦 Real-time order update:", payload.new.order_number);
            // Use debounced update
            setTimeout(() => {
              if (isMounted.current) {
                fetchAvailableOrdersCount();
                if (isOnline && !currentOrder) {
                  Alert.alert(
                    "New Delivery Available!",
                    `Order #${payload.new.order_number} is ready for delivery.`,
                    [
                      { text: "Ignore", style: "cancel" },
                      {
                        text: "View",
                        onPress: () => router.push(`/(driver)/orders`),
                      },
                    ],
                  );
                }
              }
            }, 1000); // 1 second debounce
          },
        )
        .subscribe();
    }
  }, [user?.id, isOnline, currentOrder, router]);

  // Initialize location and data
  useEffect(() => {
    isMounted.current = true;

    if (user?.id) {
      initializeLocation();
      fetchDashboardData();
      setupRealTimeSubscription();
    }

    return () => {
      isMounted.current = false;
      if (orderSubscription.current) {
        orderSubscription.current.unsubscribe();
      }
      if (refreshInterval.current) {
        clearInterval(refreshInterval.current);
      }
    };
  }, [user?.id]);

  // Update subscription when online status or current order changes
  useEffect(() => {
    if (user?.id) {
      setupRealTimeSubscription();
    }
  }, [isOnline, currentOrder, setupRealTimeSubscription]);

  // Setup auto-refresh when online status changes
  useEffect(() => {
    setupAutoRefresh();
  }, [isOnline, setupAutoRefresh]);

  const initializeLocation = async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Denied",
          "Location permission is required for delivery",
        );
        return;
      }

      // Get initial location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const newCoords: Coordinate = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      setDriverLocation(newCoords);

      // Update driver location in database if online
      if (isOnline && user?.id) {
        await updateDriverLocation(location.coords);
      }

      // Start watching position
      const watcher = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: 50, // Update every 50 meters
          timeInterval: 30000, // Update every 30 seconds
        },
        (newLocation) => {
          const newCoords: Coordinate = {
            latitude: newLocation.coords.latitude,
            longitude: newLocation.coords.longitude,
          };
          setDriverLocation(newCoords);

          // Update driver location in database if online
          if (isOnline && user?.id) {
            updateDriverLocation(newLocation.coords);
          }
        },
      );

      setLocationWatcher(watcher);
    } catch (error) {
      console.error("Error getting location:", error);
    }
  };

  const updateDriverLocation = async (
    coords: Location.LocationObjectCoords,
  ) => {
    try {
      await supabase
        .from("delivery_users")
        .update({
          current_location_lat: coords.latitude,
          current_location_lng: coords.longitude,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);
    } catch (error) {
      console.error("Error updating location:", error);
    }
  };

  const fetchDashboardData = async () => {
    if (!user?.id || !isMounted.current || fetchInProgress.current) return;

    try {
      fetchInProgress.current = true;
      setLoading(true);

      // Fetch driver data
      const { data: driverData, error: driverError } = await supabase
        .from("delivery_users")
        .select("*")
        .eq("id", user.id)
        .single();

      if (driverError) {
        console.error("Error fetching driver data:", driverError);
        throw driverError;
      }

      if (driverData) {
        setIsOnline(driverData.is_online);

        // Calculate today's date
        const today = new Date();
        const startOfToday = new Date(today.setHours(0, 0, 0, 0)).toISOString();
        const endOfToday = new Date(
          today.setHours(23, 59, 59, 999),
        ).toISOString();

        // Fetch today's deliveries count
        const { count: deliveriesTodayCount, error: deliveriesError } =
          await supabase
            .from("orders")
            .select("*", { count: "exact", head: true })
            .eq("driver_id", user.id)
            .eq("status", "delivered")
            .gte("updated_at", startOfToday)
            .lte("updated_at", endOfToday);

        // Fetch total earnings
        const { data: earningsData, error: earningsError } = await supabase
          .from("orders")
          .select("final_amount")
          .eq("driver_id", user.id)
          .eq("status", "delivered");

        // Calculate total earnings
        const totalEarnings =
          earningsData?.reduce(
            (sum, order) => sum + (order.final_amount || 0),
            0,
          ) || 0;

        // Fetch today's earnings
        const { data: todayEarningsData } = await supabase
          .from("orders")
          .select("final_amount")
          .eq("driver_id", user.id)
          .eq("status", "delivered")
          .gte("updated_at", startOfToday)
          .lte("updated_at", endOfToday);

        const todayEarnings =
          todayEarningsData?.reduce(
            (sum, order) => sum + (order.final_amount || 0),
            0,
          ) || 0;

        // Calculate acceptance rate (based on total offers vs accepted)
        const { count: totalOffers } = await supabase
          .from("driver_order_offers")
          .select("*", { count: "exact", head: true })
          .eq("driver_id", user.id);

        const { count: acceptedOffers } = await supabase
          .from("driver_order_offers")
          .select("*", { count: "exact", head: true })
          .eq("driver_id", user.id)
          .eq("status", "accepted");

        const acceptanceRate = totalOffers
          ? Math.round((acceptedOffers / totalOffers) * 100)
          : 0;

        // Fetch driver's rating from reviews
        const { data: reviewsData } = await supabase
          .from("driver_reviews")
          .select("rating")
          .eq("driver_id", user.id);

        const averageRating = reviewsData?.length
          ? reviewsData.reduce((sum, review) => sum + (review.rating || 0), 0) /
            reviewsData.length
          : 0;

        setStats({
          deliveriesToday: deliveriesTodayCount || 0,
          totalDeliveries: driverData.total_deliveries || 0,
          rating: averageRating,
          acceptanceRate: acceptanceRate,
        });

        setEarnings({
          today: todayEarnings,
          total: totalEarnings,
          pending: driverData.pending_earnings || 0,
        });
      }

      // Fetch current active order - FIXED QUERY (removed latitude/longitude from users)
      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .select(
          `
        id,
        order_number,
        status,
        final_amount,
        estimated_delivery_time,
        delivery_address,
        created_at,
        restaurants:restaurants!orders_restaurant_id_fkey(
          restaurant_name,
          address,
          latitude,
          longitude
        ),
        customers:users!orders_customer_id_fkey(
          full_name,
          phone
        )
      `,
        )
        .eq("driver_id", user.id)
        .in("status", [
          "confirmed",
          "preparing",
          "ready",
          "out_for_delivery",
          "picked_up",
        ])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (orderError) {
        console.error("Error fetching current order:", orderError);
        // Don't throw error, just log it and continue without current order
      } else {
        setCurrentOrder(orderData);
      }

      // Fetch count of available orders
      await fetchAvailableOrdersCount();

      lastFetchTime.current = Date.now();
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      if (isMounted.current) {
        Alert.alert("Error", "Failed to load dashboard data");
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
      fetchInProgress.current = false;
    }
  };

  const fetchAvailableOrdersCount = async () => {
    if (!user?.id || !isMounted.current) return;

    try {
      // First, get the driver's location to find nearby orders
      const { data: driverLocation, error: locationError } = await supabase
        .from("delivery_users")
        .select("current_location_lat, current_location_lng")
        .eq("id", user.id)
        .single();

      if (locationError) {
        console.error("Error fetching driver location:", locationError);
        return;
      }

      // If driver has location, find orders within a certain radius
      if (
        driverLocation?.current_location_lat &&
        driverLocation?.current_location_lng
      ) {
        // For now, we'll just count all ready orders without driver
        // In a real app, you'd implement geospatial queries
        const { count, error } = await supabase
          .from("orders")
          .select("*", { count: "exact", head: true })
          .eq("status", "ready")
          .is("driver_id", null)
          .limit(20); // Limit to prevent too many requests

        if (error) {
          console.error("Error fetching available orders count:", error);
        } else if (isMounted.current) {
          setAvailableOrdersCount(count || 0);
        }
      } else {
        // If no location, just count all ready orders
        const { count, error } = await supabase
          .from("orders")
          .select("*", { count: "exact", head: true })
          .eq("status", "ready")
          .is("driver_id", null)
          .limit(20);

        if (error) {
          console.error("Error fetching available orders count:", error);
        } else if (isMounted.current) {
          setAvailableOrdersCount(count || 0);
        }
      }
    } catch (error) {
      console.error("Error fetching available orders count:", error);
    }
  };

  const toggleOnlineStatus = async () => {
    try {
      const newStatus = !isOnline;

      const { error } = await supabase
        .from("delivery_users")
        .update({
          is_online: newStatus,
          driver_status: newStatus ? "available" : "offline",
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (error) throw error;

      setIsOnline(newStatus);

      if (newStatus) {
        // Get current location and update
        try {
          const location = await Location.getCurrentPositionAsync({});
          const newCoords: Coordinate = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          };
          setDriverLocation(newCoords);
          await updateDriverLocation(location.coords);
        } catch (locationError) {
          console.error("Error getting location:", locationError);
        }

        // Refresh data and fetch available orders
        fetchDashboardData();
        fetchAvailableOrdersCount();

        Alert.alert(
          "You're Online! 🎉",
          "You will now receive delivery assignments.",
        );
      } else {
        // Clear available orders count when going offline
        setAvailableOrdersCount(0);

        Alert.alert(
          "You're Offline",
          "You will no longer receive delivery assignments.",
        );
      }
    } catch (error) {
      console.error("Error updating online status:", error);
      Alert.alert("Error", "Failed to update status");
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("orders")
        .update({ status: newStatus })
        .eq("id", orderId)
        .eq("driver_id", user.id);

      if (error) throw error;

      Alert.alert("Success", `Order status updated to ${newStatus}`);
      fetchDashboardData(); // Refresh data
    } catch (error) {
      console.error("Error updating order:", error);
      Alert.alert("Error", "Failed to update order status");
    }
  };

  const onRefresh = async () => {
    if (refreshing) return; // Prevent multiple simultaneous refreshes
    setRefreshing(true);
    await fetchDashboardData();
  };

  const getOrderStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "ready":
        return "#10B98115";
      case "out_for_delivery":
        return "#3B82F615";
      case "picked_up":
        return "#8B5CF615";
      default:
        return "#6B728015";
    }
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Active Delivery Map Panel 
      {currentOrder && driverLocation && (
        <ActiveDeliveryMapPanel
          order={currentOrder}
          driverLocation={driverLocation}
        />
      )}
      */}

      {/* Order Alert */}
      <OrderAlert isOnline={isOnline} />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Delivery Dashboard</Text>
          <Text style={styles.headerSubtitle}>
            {isOnline ? "Online - Ready for deliveries" : "Offline"}
          </Text>
        </View>
        <NotificationBell />
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#FF6B35"
            colors={["#FF6B35"]}
          />
        }
      >
        <View style={[styles.content, currentOrder && styles.contentWithMap]}>
          {/* Online Status Toggle */}
          {/* Online Status Toggle */}
          <View style={styles.statusCard}>
            <View style={styles.statusInfo}>
              <View style={styles.statusAnimationContainer}>
                <LottieView
                  source={
                    isOnline
                      ? animations.driver_online
                      : animations.driver_offline
                  }
                  style={styles.statusLottie}
                  autoPlay
                  loop={isOnline}
                  speed={1.5}
                  resizeMode="cover"
                />
              </View>
              <View>
                <Text style={styles.statusText}>
                  {isOnline ? "You are online" : "You are offline"}
                </Text>
                {isOnline && availableOrdersCount > 0 && (
                  <Text style={styles.availableOrdersText}>
                    • {availableOrdersCount} available
                  </Text>
                )}
              </View>
            </View>
            <TouchableOpacity
              style={[
                styles.statusButton,
                isOnline
                  ? styles.statusButtonOffline
                  : styles.statusButtonOnline,
              ]}
              onPress={toggleOnlineStatus}
            >
              <Text style={styles.statusButtonText}>
                {isOnline ? "Go Offline" : "Go Online"}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.locationControl}>
            <TouchableOpacity
              style={[
                styles.locationButton,
                isTracking
                  ? styles.locationButtonActive
                  : styles.locationButtonInactive,
              ]}
              onPress={() => {
                if (isTracking) {
                  stopTracking();
                } else {
                  startTracking(user?.id || "");
                }
              }}
            >
              <Ionicons
                name={isTracking ? "location" : "location-outline"}
                size={20}
                color={isTracking ? "#fff" : "#6B7280"}
              />
              <Text
                style={[
                  styles.locationButtonText,
                  isTracking && styles.locationButtonTextActive,
                ]}
              >
                {isTracking ? "Tracking Active" : "Start Tracking"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Available Orders Banner */}
          {isOnline && availableOrdersCount > 0 && !currentOrder && (
            <TouchableOpacity
              style={styles.availableOrdersBanner}
              onPress={() => router.push("/(driver)/orders")}
              activeOpacity={0.8}
            >
              <View style={styles.bannerContent}>
                <Ionicons name="flash" size={18} color="#fff" />
                <View style={styles.bannerTextContainer}>
                  <Text style={styles.bannerTitle}>
                    {availableOrdersCount} New Delivery
                    {availableOrdersCount !== 1 ? "s" : ""}
                  </Text>
                  <Text style={styles.bannerSubtitle}>Tap to view orders</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#fff" />
              </View>
            </TouchableOpacity>
          )}

          {/* Current Order Details */}
          {currentOrder ? (
            <View style={styles.currentOrderCard}>
              <View style={styles.orderHeader}>
                <Text style={styles.orderTitle}>Active Delivery</Text>
                <View
                  style={[
                    styles.orderStatusBadge,
                    {
                      backgroundColor: getOrderStatusColor(currentOrder.status),
                    },
                  ]}
                >
                  <Text style={styles.orderStatusText}>
                    {currentOrder.status.replace("_", " ").toUpperCase()}
                  </Text>
                </View>
              </View>

              <Text style={styles.orderNumber}>
                #{currentOrder.order_number}
              </Text>

              <View style={styles.orderDetails}>
                <View style={styles.orderDetail}>
                  <Ionicons name="restaurant" size={16} color="#6B7280" />
                  <Text style={styles.orderDetailText}>
                    {currentOrder.restaurants?.restaurant_name}
                  </Text>
                </View>
                <View style={styles.orderDetail}>
                  <Ionicons name="person" size={16} color="#6B7280" />
                  <Text style={styles.orderDetailText}>
                    {currentOrder.customers?.full_name}
                  </Text>
                </View>
                <View style={styles.orderDetail}>
                  <Ionicons name="cash" size={16} color="#6B7280" />
                  <Text style={styles.orderDetailText}>
                    AED {currentOrder.final_amount?.toFixed(2) || "0.00"}
                  </Text>
                </View>
              </View>

              <View style={styles.orderActions}>
                {currentOrder.status === "ready" && (
                  <TouchableOpacity
                    style={[styles.orderButton, styles.pickupButton]}
                    onPress={() =>
                      updateOrderStatus(currentOrder.id, "out_for_delivery")
                    }
                  >
                    <Text style={styles.orderButtonText}>Pick Up Order</Text>
                  </TouchableOpacity>
                )}
                {/** {currentOrder.status === "out_for_delivery" && (
                  <TouchableOpacity
                    style={[styles.orderButton, styles.deliverButton]}
                    onPress={() =>
                      updateOrderStatus(currentOrder.id, "delivered")
                    }
                  >
                    <Text style={styles.orderButtonText}>
                      Mark as Delivered
                    </Text>
                  </TouchableOpacity>
                )} */}
                {/* {currentOrder.status === "picked_up" && (
                  <TouchableOpacity
                    style={[styles.orderButton, styles.deliverButton]}
                    onPress={() =>
                      updateOrderStatus(currentOrder.id, "delivered")
                    }
                  >
                    <Text style={styles.orderButtonText}>
                      Mark as Delivered
                    </Text>
                  </TouchableOpacity>
                )} */}
                <TouchableOpacity
                  style={[styles.orderButton, styles.detailsButton]}
                  onPress={() =>
                    router.push(`/(driver)/order-detail/${currentOrder.id}`)
                  }
                >
                  <Ionicons name="eye-outline" size={20} color="#FF6B35" />
                  <Text style={[styles.orderButtonText, { color: "#FF6B35" }]}>
                    View Details
                  </Text>
                </TouchableOpacity>

                {currentOrder && (
                  <TouchableOpacity
                    style={styles.messageRestaurantButton}
                    onPress={() => {
                      router.push({
                        pathname: "/(driver)/messages/[id]",
                        params: {
                          id: `order-${currentOrder.id}`,
                          orderId: currentOrder.id,
                          restaurantId: currentOrder.restaurant_id,
                          restaurantName:
                            currentOrder.restaurants?.restaurant_name,
                          restaurantImage: currentOrder.restaurants?.image_url,
                        },
                      });
                    }}
                  >
                    <Ionicons
                      name="chatbubble-outline"
                      size={20}
                      color="#FF6B35"
                    />
                    <Text style={styles.messageRestaurantText}>
                      Message Restaurant
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              {/* Add Live Track Button */}
              <TouchableOpacity
                style={styles.liveTrackButton}
                onPress={() =>
                  router.push(`/(driver)/live-track/${currentOrder.id}`)
                }
              >
                <Ionicons name="navigate" size={20} color="#fff" />
                <Text style={styles.liveTrackButtonText}>Live Track</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.noOrderCard}>
              <LottieView
                source={animations.driver_searching}
                style={styles.noOrderAnimation}
                autoPlay
                loop={isOnline}
                speed={1}
              />
              <Text style={styles.noOrderText}>No active deliveries</Text>
              <Text style={styles.noOrderSubtext}>
                {isOnline
                  ? availableOrdersCount > 0
                    ? `${availableOrdersCount} deliveries available`
                    : "Waiting for new orders..."
                  : "Go online to receive orders"}
              </Text>
              {isOnline && availableOrdersCount > 0 && (
                <TouchableOpacity
                  style={styles.viewOrdersButton}
                  onPress={() => router.push("/(driver)/orders")}
                >
                  <Text style={styles.viewOrdersButtonText}>View Orders</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Stats Grid */}
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <MaterialCommunityIcons
                name="cash-fast"
                size={22}
                color="#FF6B35"
              />
              <Text style={styles.statValue}>
                AED {earnings.today.toFixed(2)}
              </Text>
              <Text style={styles.statLabel}>Today's Earnings</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="bicycle" size={22} color="#10B981" />
              <Text style={styles.statValue}>{stats.deliveriesToday}</Text>
              <Text style={styles.statLabel}>Today's Deliveries</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="star" size={22} color="#FFD700" />
              <Text style={styles.statValue}>{stats.rating.toFixed(1)}</Text>
              <Text style={styles.statLabel}>Rating</Text>
            </View>
            <View style={styles.statCard}>
              <MaterialCommunityIcons
                name="percent"
                size={22}
                color="#3B82F6"
              />
              <Text style={styles.statValue}>{stats.acceptanceRate}%</Text>
              <Text style={styles.statLabel}>Acceptance Rate</Text>
            </View>
          </View>

          {/* Quick Actions */}
          <View style={styles.quickActions}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.actionsGrid}>
              <TouchableOpacity
                style={styles.actionCard}
                onPress={() => router.push("/(driver)/orders")}
              >
                <View
                  style={[styles.actionIcon, { backgroundColor: "#FF6B3515" }]}
                >
                  <Ionicons name="receipt" size={20} color="#FF6B35" />
                </View>
                <Text style={styles.actionText}>Orders</Text>
                {availableOrdersCount > 0 && (
                  <View style={styles.actionBadge}>
                    <Text style={styles.actionBadgeText}>
                      {availableOrdersCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionCard}
                onPress={() => router.push("/(driver)/earnings")}
              >
                <View
                  style={[styles.actionIcon, { backgroundColor: "#10B98115" }]}
                >
                  <Ionicons name="cash" size={20} color="#10B981" />
                </View>
                <Text style={styles.actionText}>Earnings</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionCard}
                onPress={() => router.push("/(driver)/history")}
              >
                <View
                  style={[styles.actionIcon, { backgroundColor: "#3B82F615" }]}
                >
                  <MaterialCommunityIcons
                    name="history"
                    size={20}
                    color="#3B82F6"
                  />
                </View>
                <Text style={styles.actionText}>History</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionCard}
                onPress={() => router.push("/(driver)/profile")}
              >
                <View
                  style={[styles.actionIcon, { backgroundColor: "#8B5CF615" }]}
                >
                  <Ionicons name="person" size={20} color="#8B5CF6" />
                </View>
                <Text style={styles.actionText}>Profile</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
  scrollView: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  contentWithMap: {
    paddingTop: 8,
  },
  statusCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#000",
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  statusInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    flexWrap: "wrap",
  },
  statusIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#fff",
    lineHeight: 16,
    marginRight: 8,
  },
  availableOrdersText: {
    fontSize: 12,
    color: "#3B82F6",
    fontWeight: "600",
  },
  statusButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    minWidth: 100,
  },
  statusButtonOnline: {
    backgroundColor: "#10B981",
    borderColor: "#10B981",
  },
  statusButtonOffline: {
    backgroundColor: "#FF6B35",
    borderColor: "#FF6B35",
  },
  statusButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 16,
    textAlign: "center",
  },
  availableOrdersBanner: {
    backgroundColor: "#3B82F6",
    borderRadius: 12,
    marginBottom: 16,
    padding: 14,
  },
  bannerContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  bannerTextContainer: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 2,
  },
  bannerSubtitle: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.9)",
  },
  currentOrderCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 0.6,
    borderColor: "#E5E7EB",
  },
  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  orderTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
    lineHeight: 20,
  },
  orderStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  orderStatusText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#374151",
    textTransform: "uppercase",
  },
  orderNumber: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 12,
    fontWeight: "500",
  },
  orderDetails: {
    gap: 8,
    marginBottom: 16,
  },
  orderDetail: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  orderDetailText: {
    fontSize: 12,
    color: "#374151",
    fontWeight: "400",
  },
  orderActions: {
    flexDirection: "row",
    gap: 8,
  },
  orderButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
  },
  pickupButton: {
    backgroundColor: "#3B82F6",
    borderColor: "#3B82F6",
  },
  deliverButton: {
    backgroundColor: "#10B981",
    borderColor: "#10B981",
  },
  detailsButton: {
    backgroundColor: "#FFFFFF",
    borderColor: "#FF6B35",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  orderButtonText: {
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 16,
    color: "#F3F4F6",
  },
  noOrderCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 24,
    marginBottom: 16,
    alignItems: "center",
    borderWidth: 0.6,
    borderColor: "#E5E7EB",
  },
  noOrderText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#374151",
    marginTop: 8,
    marginBottom: 4,
  },
  noOrderSubtext: {
    fontSize: 12,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 16,
    fontWeight: "400",
  },
  viewOrdersButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "#3B82F6",
    borderRadius: 8,
  },
  viewOrdersButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  statCard: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: "center",
    borderWidth: 0.6,
    borderColor: "#E5E7EB",
  },
  statValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginTop: 6,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    color: "#6B7280",
    textAlign: "center",
    fontWeight: "500",
    letterSpacing: -0.2,
  },
  quickActions: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 0.6,
    borderColor: "#E5E7EB",
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
  },
  actionsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
  },
  actionCard: {
    width: "48%",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 20,
    padding: 12,
    borderWidth: 0.4,
    borderColor: "#E5E7EB",
    position: "relative",
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },
  actionText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#374151",
  },
  actionBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#EF4444",
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  actionBadgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "700",
  },
  locationControl: {
    alignItems: "flex-end",
    marginBottom: 16,
  },
  locationButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 0.4,
    borderColor: "#D1D5DB",
  },
  locationButtonActive: {
    backgroundColor: "#10B981",
  },
  locationButtonInactive: {
    backgroundColor: "#FFFFFF",
  },
  locationButtonText: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },
  locationButtonTextActive: {
    color: "#FFFFFF",
  },
  // Map Panel Styles
  mapPanel: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  mapPanelHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
  },
  mapPanelTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  mapPanelSubtitle: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "500",
  },
  mapContainer: {
    height: 250,
    width: "100%",
    position: "relative",
  },
  map: {
    flex: 1,
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
  },
  mapPlaceholderText: {
    marginTop: 8,
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "500",
  },
  driverMarker: {
    backgroundColor: "#10B981",
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  restaurantMarker: {
    backgroundColor: "#FF6B35",
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  customerMarker: {
    backgroundColor: "#3B82F6",
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  routeStartMarker: {
    backgroundColor: "#10B981",
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  routeStartInner: {
    backgroundColor: "#FFFFFF",
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  routeEndMarker: {
    backgroundColor: "#3B82F6",
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  routeEndInner: {
    backgroundColor: "#FFFFFF",
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  deliveryInfo: {
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  infoItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    marginRight: 16,
  },
  infoContent: {
    marginLeft: 8,
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "500",
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 12,
    color: "#374151",
    fontWeight: "600",
  },
  etaValue: {
    color: "#3B82F6",
    fontWeight: "700",
  },
  routeStatus: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  routeStatusItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  routeStatusText: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "500",
  },
  navigationButton: {
    backgroundColor: "#3B82F6",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  navigationButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  routeLoadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    justifyContent: "center",
    alignItems: "center",
  },
  routeLoadingText: {
    marginTop: 8,
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "500",
  },

  statusAnimationContainer: {
    width: 50,
    height: 50,
    marginRight: 16,
  },
  statusLottie: {
    width: 68,
    height: 68,
    marginTop: -8,
  },
  noOrderAnimation: {
    width: 140,
    height: 140,
    marginBottom: 8,
  },

  messageRestaurantButton: {
    backgroundColor: "#3B82F6",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  messageRestaurantButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  messageRestaurantText: {
    fontSize: 12,
    color: "#F3F4F6",
    fontWeight: "500",
  },

  // Add to your styles
  liveTrackButton: {
    backgroundColor: "#3B82F6",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
    marginTop: 8,
  },
  liveTrackButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});
