// app/(driver)/live-track/[orderId].tsx - Driver Live Tracking Screen
import { useAuth } from "@/backend/AuthContext";
import { useLocation } from "@/backend/LocationContext";
import { RealTimeLocationService } from "@/backend/services/RealTimeLocationService";
import { supabase } from "@/backend/supabase";
import {
  calculateRoute,
  Coordinate,
  createStraightLine,
} from "@/backend/utils/openRouteService";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";

const { width, height } = Dimensions.get("window");

export default function DriverLiveTrackingScreen() {
  const { orderId } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const { subscribeToDriverLocation } = useLocation();

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<any>(null);
  const [restaurantLocation, setRestaurantLocation] =
    useState<Coordinate | null>(null);
  const [customerLocation, setCustomerLocation] = useState<Coordinate | null>(
    null,
  );
  const [driverLocation, setDriverLocation] = useState<Coordinate | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<Coordinate[]>([]);
  const [mapRegion, setMapRegion] = useState<any>(null);
  const [eta, setEta] = useState<string>("");
  const [distance, setDistance] = useState<string>("");
  const [destinationType, setDestinationType] = useState<
    "restaurant" | "customer"
  >("restaurant");

  const mapRef = useRef<MapView>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const driverMarkerRef = useRef<any>(null);

  useEffect(() => {
    fetchOrderDetails();
    startLocationTracking();

    // Start pulse animation for driver marker
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

    return () => {
      // Cleanup
    };
  }, [orderId]);

  const fetchOrderDetails = async () => {
    try {
      setLoading(true);

      const { data: orderData, error } = await supabase
        .from("orders")
        .select(
          `
          *,
          restaurants:restaurants!orders_restaurant_id_fkey(
            restaurant_name,
            address,
            latitude,
            longitude
          ),
          users!orders_customer_id_fkey(
            full_name,
            phone
          )
        `,
        )
        .eq("id", orderId)
        .single();

      if (error) throw error;

      setOrder(orderData);

      // Set restaurant location
      if (orderData.restaurants?.latitude && orderData.restaurants?.longitude) {
        setRestaurantLocation({
          latitude: parseFloat(orderData.restaurants.latitude),
          longitude: parseFloat(orderData.restaurants.longitude),
        });
      }

      // Parse delivery address for customer location
      if (orderData.delivery_address) {
        try {
          const address =
            typeof orderData.delivery_address === "string"
              ? JSON.parse(orderData.delivery_address)
              : orderData.delivery_address;

          if (address.latitude && address.longitude) {
            setCustomerLocation({
              latitude: parseFloat(address.latitude),
              longitude: parseFloat(address.longitude),
            });
          }
        } catch (e) {
          console.error("Error parsing delivery address:", e);
        }
      }

      // Get driver's current location
      if (user?.id) {
        const driverLoc = await RealTimeLocationService.getDriverLocation(
          user.id,
        );
        if (driverLoc?.current_location_lat && driverLoc.current_location_lng) {
          setDriverLocation({
            latitude: parseFloat(driverLoc.current_location_lat),
            longitude: parseFloat(driverLoc.current_location_lng),
          });
        }
      }

      // Determine destination based on order status
      if (
        orderData.status === "ready" ||
        orderData.status === "out_for_delivery"
      ) {
        setDestinationType("restaurant");
      } else if (orderData.status === "picked_up") {
        setDestinationType("customer");
      }
    } catch (error) {
      console.error("Error fetching order details:", error);
    } finally {
      setLoading(false);
    }
  };

  // Add this useEffect after fetchOrderDetails

  useEffect(() => {
    if (!orderId) return;

    // Subscribe to order status changes
    const orderChannel = supabase
      .channel(`order-status-${orderId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `id=eq.${orderId}`,
        },
        (payload) => {
          console.log("Order status updated:", payload.new.status);

          // Update destination type based on new status
          if (
            payload.new.status === "out_for_delivery" ||
            payload.new.status === "picked_up"
          ) {
            setDestinationType("customer");

            // Recalculate route to customer
            if (driverLocation && customerLocation) {
              calculateAndSetRoute(driverLocation);
            }
          } else if (payload.new.status === "ready") {
            setDestinationType("restaurant");

            // Recalculate route to restaurant
            if (driverLocation && restaurantLocation) {
              calculateAndSetRoute(driverLocation);
            }
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(orderChannel);
    };
  }, [orderId, driverLocation, restaurantLocation, customerLocation]);

  const startLocationTracking = () => {
    if (!orderId || !user?.id) return;

    // Subscribe to driver's own location updates
    const channel = supabase
      .channel(`driver-track-${orderId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "delivery_users",
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          if (
            payload.new.current_location_lat &&
            payload.new.current_location_lng
          ) {
            const newLocation = {
              latitude: parseFloat(payload.new.current_location_lat),
              longitude: parseFloat(payload.new.current_location_lng),
            };

            setDriverLocation(newLocation);

            // Update route when driver moves
            calculateAndSetRoute(newLocation);

            // Animate marker
            if (driverMarkerRef.current?.animateMarkerToCoordinate) {
              driverMarkerRef.current.animateMarkerToCoordinate(
                newLocation,
                1000,
              );
            }
          }
        },
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  };

  const calculateAndSetRoute = async (currentLocation: Coordinate) => {
    let destination: Coordinate | null = null;

    if (destinationType === "restaurant" && restaurantLocation) {
      destination = restaurantLocation;
    } else if (destinationType === "customer" && customerLocation) {
      destination = customerLocation;
    }

    if (!destination) return;

    try {
      // Try to get actual route from OpenRouteService
      const route = await calculateRoute(
        currentLocation,
        destination,
        "driving-car",
      );

      if (route) {
        setRouteCoordinates(route.coordinates);

        // Update ETA and distance
        const minutes = Math.ceil(route.duration / 60);
        setEta(`${minutes} min`);
        setDistance(`${route.distance.toFixed(1)} km`);

        // Fit map to show route
        fitMapToCoordinates([currentLocation, destination]);
      } else {
        // Fallback to straight line
        const straightLine = createStraightLine(
          currentLocation,
          destination,
          20,
        );
        setRouteCoordinates(straightLine);

        // Calculate straight line distance
        const dist = calculateDistance(
          currentLocation.latitude,
          currentLocation.longitude,
          destination.latitude,
          destination.longitude,
        );
        setDistance(`${dist.toFixed(1)} km`);
        setEta(`${Math.ceil(dist * 3)} min`); // Rough estimate: 3 min per km
      }
    } catch (error) {
      console.error("Error calculating route:", error);
    }
  };

  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const fitMapToCoordinates = (coordinates: Coordinate[]) => {
    if (coordinates.length === 0 || !mapRef.current) return;

    let minLat = coordinates[0].latitude;
    let maxLat = coordinates[0].latitude;
    let minLng = coordinates[0].longitude;
    let maxLng = coordinates[0].longitude;

    coordinates.forEach((coord) => {
      minLat = Math.min(minLat, coord.latitude);
      maxLat = Math.max(maxLat, coord.latitude);
      minLng = Math.min(minLng, coord.longitude);
      maxLng = Math.max(maxLng, coord.longitude);
    });

    const padding = 0.02;
    mapRef.current.animateToRegion(
      {
        latitude: (minLat + maxLat) / 2,
        longitude: (minLng + maxLng) / 2,
        latitudeDelta: Math.max((maxLat - minLat) * 1.5 + padding, 0.01),
        longitudeDelta: Math.max((maxLng - minLng) * 1.5 + padding, 0.01),
      },
      1000,
    );
  };

  const handleNavigate = () => {
    if (!driverLocation) return;

    let destination: Coordinate | null = null;
    if (destinationType === "restaurant" && restaurantLocation) {
      destination = restaurantLocation;
    } else if (destinationType === "customer" && customerLocation) {
      destination = customerLocation;
    }

    if (destination) {
      const url = `https://www.google.com/maps/dir/?api=1&origin=${driverLocation.latitude},${driverLocation.longitude}&destination=${destination.latitude},${destination.longitude}&travelmode=driving`;
      Linking.openURL(url);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={styles.loadingText}>Loading live tracking...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Minimal Header */}

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Live Tracking</Text>
          {order && (
            <Text style={styles.orderIdText}>Order #{order.order_number}</Text>
          )}
        </View>

        <TouchableOpacity
          style={styles.refreshButton}
          onPress={() => {
            fetchOrderDetails();
            if (driverLocation) {
              calculateAndSetRoute(driverLocation);
            }
          }}
        >
          <Ionicons name="refresh" size={20} color="#FF6B35" />
        </TouchableOpacity>
      </View>

      {/* Full Screen Map */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          initialRegion={{
            latitude: driverLocation?.latitude || 25.2048,
            longitude: driverLocation?.longitude || 55.2708,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
          showsUserLocation={true}
          showsMyLocationButton={true}
          showsCompass={true}
        >
          {/* Driver Marker (You) */}
          {driverLocation && (
            <Marker ref={driverMarkerRef} coordinate={driverLocation}>
              <Animated.View
                style={[
                  styles.driverMarker,
                  { transform: [{ scale: pulseAnim }] },
                ]}
              >
                <Ionicons name="bicycle" size={24} color="#fff" />
              </Animated.View>
            </Marker>
          )}

          {/* Restaurant Marker */}
          {restaurantLocation && destinationType === "restaurant" && (
            <Marker coordinate={restaurantLocation}>
              <View style={styles.restaurantMarker}>
                <Ionicons name="restaurant" size={20} color="#fff" />
              </View>
            </Marker>
          )}

          {/* Customer Marker */}
          {customerLocation && destinationType === "customer" && (
            <Marker coordinate={customerLocation}>
              <View style={styles.customerMarker}>
                <Ionicons name="home" size={20} color="#fff" />
              </View>
            </Marker>
          )}

          {/* Route Line */}
          {routeCoordinates.length > 1 && (
            <Polyline
              coordinates={routeCoordinates}
              strokeColor="#3B82F6"
              strokeWidth={4}
              lineDashPattern={[0]}
            />
          )}
        </MapView>

        {/* Minimal Info Overlay */}
        <View style={styles.infoOverlay}>
          <View style={styles.destinationCard}>
            <View style={styles.destinationRow}>
              <Ionicons
                name={destinationType === "restaurant" ? "restaurant" : "home"}
                size={20}
                color={destinationType === "restaurant" ? "#FF6B35" : "#10B981"}
              />
              <Text style={styles.destinationText}>
                {destinationType === "restaurant"
                  ? "To Restaurant"
                  : "To Customer"}
              </Text>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Ionicons name="navigate" size={15} color="#6B7280" />
                <Text style={styles.statText}>{distance || "---"}</Text>
              </View>
              <View style={styles.statItem}>
                <Ionicons name="time" size={15} color="#6B7280" />
                <Text style={styles.statText}>{eta || "---"}</Text>
              </View>
            </View>
          </View>

          {/* Navigation Button */}
          <TouchableOpacity style={styles.navButton} onPress={handleNavigate}>
            <Ionicons name="navigate" size={20} color="#fff" />
            <Text style={styles.navButtonText}>Navigate</Text>
          </TouchableOpacity>
        </View>

        {/* Map Legend */}
        <View style={styles.legendOverlay}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: "#3B82F6" }]} />
            <Text style={styles.legendText}>You</Text>
          </View>
          <View style={styles.legendItem}>
            <View
              style={[
                styles.legendDot,
                {
                  backgroundColor:
                    destinationType === "restaurant" ? "#FF6B35" : "#10B981",
                },
              ]}
            />
            <Text style={styles.legendText}>
              {destinationType === "restaurant" ? "Restaurant" : "Customer"}
            </Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
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
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  // Add styles
  headerCenter: {
    alignItems: "center",
  },
  orderIdText: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  mapContainer: {
    flex: 1,
    position: "relative",
  },
  map: {
    width: "100%",
    height: "100%",
  },
  driverMarker: {
    backgroundColor: "#3B82F6",
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  restaurantMarker: {
    backgroundColor: "#FF6B35",
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  customerMarker: {
    backgroundColor: "#10B981",
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  infoOverlay: {
    position: "absolute",
    bottom: 20,
    left: 16,
    right: 16,
    flexDirection: "row",
    gap: 12,
  },
  destinationCard: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: 22,
    padding: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 0.8,
    borderColor: "#E5E7EB",
  },
  destinationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  destinationText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#111827",
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    gap: 10,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
  },
  navButton: {
    backgroundColor: "#3B82F6",
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  navButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  legendOverlay: {
    position: "absolute",
    top: 20,
    left: 16,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: 8,
    padding: 8,
    flexDirection: "row",
    gap: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 12,
    color: "#6B7280",
  },
  refreshButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
});
