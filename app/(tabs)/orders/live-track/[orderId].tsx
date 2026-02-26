// app(tabs)/orders/live-track/[orderId].tsx
import { useLocation } from "@/backend/LocationContext";
import { RealTimeLocationService } from "@/backend/services/RealTimeLocationService";
import { supabase } from "@/backend/supabase";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Image,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function CustomerLiveTrackingScreen() {
  const { orderId } = useLocalSearchParams();
  const router = useRouter();
  const { subscribeToDriverLocation, driverLocations } = useLocation();

  const [order, setOrder] = useState<any>(null);
  const [driver, setDriver] = useState<any>(null);
  const [restaurant, setRestaurant] = useState<any>(null);
  const [driverLocation, setDriverLocation] = useState<any>(null);
  const [deliveryLocation, setDeliveryLocation] = useState<any>(null);
  const [restaurantLocation, setRestaurantLocation] = useState<any>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<any[]>([]);
  const [estimatedTime, setEstimatedTime] = useState<string>("");
  const [distanceRemaining, setDistanceRemaining] = useState<number>(0);
  const [driverSpeed, setDriverSpeed] = useState<number>(0);

  const mapRef = useRef<MapView>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const driverMarkerRef = useRef<any>(null);

  useEffect(() => {
    fetchOrderDetails();
    startLocationTracking();

    // Start pulse animation
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
      const { data: orderData } = await supabase
        .from("orders")
        .select(
          `
          *,
          restaurants:restaurants!orders_restaurant_id_fkey(*),
          delivery_users:delivery_users(*, users!inner(*))
        `,
        )
        .eq("id", orderId)
        .single();

      if (orderData) {
        setOrder(orderData);
        setDriver(orderData.delivery_users);
        setRestaurant(orderData.restaurants);

        // Set locations
        if (
          orderData.restaurants?.latitude &&
          orderData.restaurants?.longitude
        ) {
          setRestaurantLocation({
            latitude: parseFloat(orderData.restaurants.latitude),
            longitude: parseFloat(orderData.restaurants.longitude),
          });
        }

        // Parse delivery address
        if (orderData.delivery_address) {
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
        }

        // Get driver's current location
        if (orderData.driver_id) {
          const driverLoc = await RealTimeLocationService.getDriverLocation(
            orderData.driver_id,
          );
          if (
            driverLoc?.current_location_lat &&
            driverLoc.current_location_lng
          ) {
            setDriverLocation({
              latitude: parseFloat(driverLoc.current_location_lat),
              longitude: parseFloat(driverLoc.current_location_lng),
            });
          }
        }
      }
    } catch (error) {
      console.error("Error fetching order details:", error);
    }
  };

  const startLocationTracking = () => {
    if (!orderId) return;

    // Subscribe to real-time location updates
    const unsubscribe = subscribeToDriverLocation(orderId as string);

    // Also set up Supabase subscription for this order
    const channel = supabase
      .channel(`customer-track-${orderId}`)
      .on("broadcast", { event: "location_update" }, (payload) => {
        const { location } = payload.payload;
        const newLocation = {
          latitude: parseFloat(location.latitude),
          longitude: parseFloat(location.longitude),
        };

        setDriverLocation(newLocation);

        // Calculate distance and ETA
        calculateDistanceAndETA(newLocation);

        // Animate marker
        if (
          driverMarkerRef.current &&
          driverMarkerRef.current.animateMarkerToCoordinate
        ) {
          driverMarkerRef.current.animateMarkerToCoordinate(newLocation, 1000);
        }

        // Update map view
        if (mapRef.current) {
          mapRef.current.animateToRegion(
            {
              ...newLocation,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            },
            1000,
          );
        }
      })
      .subscribe();

    return () => {
      unsubscribe();
      channel.unsubscribe();
    };
  };

  const calculateDistanceAndETA = (driverLoc: any) => {
    if (!deliveryLocation) return;

    // Calculate distance
    const distance = calculateDistance(
      driverLoc.latitude,
      driverLoc.longitude,
      deliveryLocation.latitude,
      deliveryLocation.longitude,
    );

    setDistanceRemaining(distance);

    // Calculate ETA (assuming average speed of 25 km/h in traffic)
    const timeInHours = distance / 25;
    const timeInMinutes = Math.round(timeInHours * 60);

    if (timeInMinutes < 1) {
      setEstimatedTime("Arriving now");
    } else if (timeInMinutes <= 5) {
      setEstimatedTime(`${timeInMinutes} min`);
    } else {
      const now = new Date();
      const arrivalTime = new Date(now.getTime() + timeInMinutes * 60000);
      setEstimatedTime(
        arrivalTime.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
    }
  };

  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ) => {
    const R = 6371; // Earth's radius in km
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

  const handleContactDriver = () => {
    if (driver?.users?.phone) {
      Linking.openURL(`tel:${driver.users.phone}`);
    }
  };

  const handleViewOrderDetails = () => {
    router.push(`/orders/${orderId}`);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Live Tracking</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Map */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          initialRegion={{
            latitude: restaurantLocation?.latitude || 25.2048,
            longitude: restaurantLocation?.longitude || 55.2708,
            latitudeDelta: 0.1,
            longitudeDelta: 0.1,
          }}
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

          {/* Delivery Location Marker */}
          {deliveryLocation && (
            <Marker coordinate={deliveryLocation}>
              <View style={styles.deliveryMarker}>
                <Ionicons name="home" size={24} color="#10B981" />
              </View>
            </Marker>
          )}

          {/* Driver Marker with Animation */}
          {driverLocation && (
            <Marker ref={driverMarkerRef} coordinate={driverLocation}>
              <Animated.View
                style={[
                  styles.driverMarker,
                  { transform: [{ scale: pulseAnim }] },
                ]}
              >
                <Ionicons name="bicycle" size={20} color="#fff" />
              </Animated.View>
            </Marker>
          )}

          {/* Route Line */}
          {driverLocation && deliveryLocation && (
            <Polyline
              coordinates={[driverLocation, deliveryLocation]}
              strokeColor="#3B82F6"
              strokeWidth={3}
              lineDashPattern={[10, 10]}
            />
          )}
        </MapView>

        {/* Driver Info Card */}
        {driver && (
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
              <View style={styles.driverDetails}>
                <Text style={styles.driverRating}>
                  ⭐ {driver.rating?.toFixed(1) || "4.5"}
                </Text>
                <Text style={styles.driverVehicle}>{driver.vehicle_type}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.callButton}
              onPress={handleContactDriver}
            >
              <Ionicons name="call" size={20} color="#3B82F6" />
            </TouchableOpacity>
          </View>
        )}

        {/* Distance & ETA Card */}
        <View style={styles.etaCard}>
          <View style={styles.etaRow}>
            <Ionicons name="navigate" size={20} color="#FF6B35" />
            <Text style={styles.distanceText}>
              {distanceRemaining > 0
                ? `${distanceRemaining.toFixed(1)} km away`
                : "Calculating distance..."}
            </Text>
          </View>
          <View style={styles.etaRow}>
            <Ionicons name="time" size={20} color="#3B82F6" />
            <Text style={styles.etaText}>
              {estimatedTime
                ? `ETA: ${estimatedTime}`
                : "Calculating arrival time..."}
            </Text>
          </View>
        </View>
      </View>

      {/* Order Status */}
      <View style={styles.statusCard}>
        <View style={styles.statusHeader}>
          <Ionicons name="bicycle" size={24} color="#3B82F6" />
          <View style={styles.statusInfo}>
            <Text style={styles.statusTitle}>Driver is on the way</Text>
            <Text style={styles.statusSubtitle}>
              {driverLocation
                ? "Your order is being delivered now"
                : "Waiting for driver location..."}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.detailsButton}
          onPress={handleViewOrderDetails}
        >
          <Text style={styles.detailsButtonText}>View Order Details</Text>
          <Ionicons name="chevron-forward" size={16} color="#6B7280" />
        </TouchableOpacity>
      </View>

      {/* Safety Tips */}
      <View style={styles.safetyCard}>
        <Text style={styles.safetyTitle}>Safety Tips</Text>
        <View style={styles.safetyTips}>
          <View style={styles.safetyTip}>
            <Ionicons name="checkmark-circle" size={16} color="#10B981" />
            <Text style={styles.safetyTipText}>Meet in a public place</Text>
          </View>
          <View style={styles.safetyTip}>
            <Ionicons name="checkmark-circle" size={16} color="#10B981" />
            <Text style={styles.safetyTipText}>Check order before paying</Text>
          </View>
          <View style={styles.safetyTip}>
            <Ionicons name="checkmark-circle" size={16} color="#10B981" />
            <Text style={styles.safetyTipText}>Keep social distance</Text>
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
  mapContainer: {
    flex: 1,
    position: "relative",
  },
  map: {
    width: "100%",
    height: "100%",
  },
  restaurantMarker: {
    backgroundColor: "#fff",
    padding: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#FF6B35",
  },
  deliveryMarker: {
    backgroundColor: "#fff",
    padding: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#10B981",
  },
  driverMarker: {
    backgroundColor: "#3B82F6",
    padding: 10,
    borderRadius: 20,
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
    top: 16,
    left: 16,
    right: 16,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  driverImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  driverInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  driverDetails: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  driverRating: {
    fontSize: 14,
    color: "#F59E0B",
  },
  driverVehicle: {
    fontSize: 14,
    color: "#6B7280",
  },
  callButton: {
    padding: 8,
    backgroundColor: "#EFF6FF",
    borderRadius: 20,
  },
  etaCard: {
    position: "absolute",
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  etaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  distanceText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  etaText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#3B82F6",
  },
  statusCard: {
    backgroundColor: "#F9FAFB",
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  statusHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  statusInfo: {
    flex: 1,
    marginLeft: 12,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  statusSubtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 2,
  },
  detailsButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  detailsButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
  },
  safetyCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    backgroundColor: "#FFFBEB",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  safetyTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#92400E",
    marginBottom: 12,
  },
  safetyTips: {
    gap: 8,
  },
  safetyTip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  safetyTipText: {
    fontSize: 14,
    color: "#92400E",
  },
});
