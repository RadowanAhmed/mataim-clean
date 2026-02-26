// app/(driver)/orders/available.tsx
import { useAuth } from "@/backend/AuthContext";
import { supabase } from "@/backend/supabase";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function AvailableOrdersScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [availableOrders, setAvailableOrders] = useState<any[]>([]);
  const [driverLocation, setDriverLocation] = useState<any>(null);

  useEffect(() => {
    fetchAvailableOrders();
    getDriverLocation();
  }, [user]);

  const getDriverLocation = async () => {
    // Get driver's current location from database
    if (!user?.id) return;

    const { data: driverData } = await supabase
      .from("delivery_users")
      .select("current_location_lat, current_location_lng")
      .eq("id", user.id)
      .single();

    if (driverData) {
      setDriverLocation({
        lat: driverData.current_location_lat,
        lng: driverData.current_location_lng,
      });
    }
  };

  const fetchAvailableOrders = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);

      // Get orders that are ready for delivery and not assigned to any driver
      const { data: orders, error } = await supabase
        .from("orders")
        .select(
          `
          id,
          order_number,
          status,
          final_amount,
          delivery_fee,
          created_at,
          estimated_delivery_time,
          restaurants!inner(
            restaurant_name,
            address,
            latitude,
            longitude,
            restaurant_rating
          ),
          delivery_address,
          special_instructions
        `,
        )
        .eq("status", "ready")
        .is("driver_id", null)
        .order("created_at", { ascending: true })
        .limit(20);

      if (error) throw error;

      // Calculate distances if driver location is available
      const ordersWithDistance = orders?.map((order) => {
        let distance = null;
        if (
          driverLocation &&
          order.restaurants?.latitude &&
          order.restaurants?.longitude
        ) {
          distance = calculateDistance(
            driverLocation.lat,
            driverLocation.lng,
            order.restaurants.latitude,
            order.restaurants.longitude,
          );
        }

        return {
          ...order,
          distance,
          earnings: (order.delivery_fee || 5) * 0.8, // 80% to driver
        };
      });

      // Sort by distance if available
      if (driverLocation) {
        ordersWithDistance?.sort(
          (a, b) => (a.distance || 999) - (b.distance || 999),
        );
      }

      setAvailableOrders(ordersWithDistance || []);
    } catch (error) {
      console.error("Error fetching available orders:", error);
      Alert.alert("Error", "Failed to load available orders");
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
  ) => {
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
    return distance.toFixed(1);
  };

  const deg2rad = (deg: number) => {
    return deg * (Math.PI / 180);
  };

  const acceptOrder = async (orderId: string) => {
    if (!user?.id) return;

    Alert.alert(
      "Accept Delivery?",
      "Are you sure you want to accept this delivery?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Accept",
          onPress: async () => {
            try {
              // Update order with driver assignment
              const { error } = await supabase
                .from("orders")
                .update({
                  driver_id: user.id,
                  status: "out_for_delivery",
                  updated_at: new Date().toISOString(),
                })
                .eq("id", orderId);

              if (error) throw error;

              // Update driver status
              await supabase
                .from("delivery_users")
                .update({
                  driver_status: "busy",
                  updated_at: new Date().toISOString(),
                })
                .eq("id", user.id);

              Alert.alert(
                "Order Accepted!",
                "You have successfully accepted this delivery. Navigate to the restaurant for pickup.",
                [
                  {
                    text: "View Details",
                    onPress: () => router.push(`/(driver)/orders/${orderId}`),
                  },
                  { text: "Continue", style: "default" },
                ],
              );

              // Refresh the list
              fetchAvailableOrders();
            } catch (error) {
              console.error("Error accepting order:", error);
              Alert.alert("Error", "Failed to accept order. Please try again.");
            }
          },
        },
      ],
    );
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchAvailableOrders();
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const renderOrderItem = ({ item }: { item: any }) => (
    <View style={styles.orderCard}>
      <View style={styles.orderHeader}>
        <View>
          <Text style={styles.orderNumber}>#{item.order_number}</Text>
          <Text style={styles.restaurantName}>
            {item.restaurants?.restaurant_name}
          </Text>
        </View>
        <View style={styles.earningsBadge}>
          <Ionicons name="cash" size={14} color="#F59E0B" />
          <Text style={styles.earningsText}>
            AED {item.earnings.toFixed(2)}
          </Text>
        </View>
      </View>

      <View style={styles.orderDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="location" size={14} color="#6B7280" />
          <Text style={styles.detailText}>{item.restaurants?.address}</Text>
        </View>

        <View style={styles.detailRow}>
          <Ionicons name="time" size={14} color="#6B7280" />
          <Text style={styles.detailText}>
            Ready since {formatTime(item.created_at)}
          </Text>
        </View>

        {item.distance && (
          <View style={styles.detailRow}>
            <Ionicons name="navigate" size={14} color="#3B82F6" />
            <Text style={styles.detailText}>
              {item.distance} km away • {Math.round(item.distance * 3)} min
              drive
            </Text>
          </View>
        )}

        {item.special_instructions && (
          <View style={styles.detailRow}>
            <Ionicons name="document-text" size={14} color="#6B7280" />
            <Text style={styles.detailText} numberOfLines={1}>
              Note: {item.special_instructions}
            </Text>
          </View>
        )}
      </View>

      <TouchableOpacity
        style={styles.acceptButton}
        onPress={() => acceptOrder(item.id)}
      >
        <Ionicons name="checkmark-circle" size={18} color="#fff" />
        <Text style={styles.acceptButtonText}>Accept Delivery</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Available Deliveries</Text>
        <TouchableOpacity onPress={onRefresh}>
          <Ionicons name="refresh" size={22} color="#3B82F6" />
        </TouchableOpacity>
      </View>

      {/* Stats Banner */}
      <View style={styles.statsBanner}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{availableOrders.length}</Text>
          <Text style={styles.statLabel}>Available</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <MaterialCommunityIcons name="clock-fast" size={20} color="#F59E0B" />
          <Text style={styles.statLabel}>Quick Pickup</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Ionicons name="cash" size={20} color="#10B981" />
          <Text style={styles.statLabel}>Earn Now</Text>
        </View>
      </View>

      {/* Orders List */}
      <FlatList
        data={availableOrders}
        renderItem={renderOrderItem}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#3B82F6"]}
            tintColor="#3B82F6"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialCommunityIcons
              name="package-variant"
              size={64}
              color="#D1D5DB"
            />
            <Text style={styles.emptyStateTitle}>No deliveries available</Text>
            <Text style={styles.emptyStateText}>
              All available orders have been assigned. New orders will appear
              here when restaurants mark them as ready.
            </Text>
            <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
              <Ionicons name="refresh" size={20} color="#3B82F6" />
              <Text style={styles.refreshButtonText}>Refresh</Text>
            </TouchableOpacity>
          </View>
        }
        contentContainerStyle={styles.listContent}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
  },
  statsBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statNumber: {
    fontSize: 24,
    fontWeight: "700",
    color: "#3B82F6",
  },
  statLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: "#e5e7eb",
  },
  orderCard: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  restaurantName: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 2,
  },
  earningsBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFBEB",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  earningsText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#F59E0B",
  },
  orderDetails: {
    gap: 8,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  detailText: {
    fontSize: 13,
    color: "#6B7280",
    flex: 1,
  },
  acceptButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#10B981",
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  acceptButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#374151",
    marginTop: 16,
  },
  emptyStateText: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
  },
  refreshButton: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "#EFF6FF",
    borderRadius: 8,
    gap: 8,
  },
  refreshButtonText: {
    color: "#3B82F6",
    fontSize: 14,
    fontWeight: "600",
  },
  listContent: {
    paddingBottom: 20,
  },
});
