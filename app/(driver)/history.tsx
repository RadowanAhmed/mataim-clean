import { useAuth } from "@/backend/AuthContext";
import { supabase } from "@/backend/supabase";
import animations from "@/constent/animations";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import LottieView from "lottie-react-native";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
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

export default function DriverHistoryScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deliveries, setDeliveries] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState("week");
  const [stats, setStats] = useState({
    totalDeliveries: 0,
    completed: 0,
    cancelled: 0,
    totalEarnings: 0,
    averageRating: 0,
    onTimeRate: 0,
  });

  const periods = [
    { id: "today", label: "Today" },
    { id: "week", label: "This Week" },
    { id: "month", label: "This Month" },
    { id: "all", label: "All Time" },
  ];

  useEffect(() => {
    fetchHistory();
  }, [user, selectedPeriod]);

  const fetchHistory = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);

      // Calculate date range based on selected period
      let startDate = new Date();
      const endDate = new Date();

      switch (selectedPeriod) {
        case "today":
          startDate.setHours(0, 0, 0, 0);
          break;
        case "week":
          startDate.setDate(startDate.getDate() - 7);
          break;
        case "month":
          startDate.setMonth(startDate.getMonth() - 1);
          break;
        case "all":
          startDate = new Date(0); // Beginning of time
          break;
      }

      // First, fetch deliveries with basic info
      const { data: deliveriesData, error: deliveriesError } = await supabase
        .from("orders")
        .select(
          `
        id,
        order_number,
        status,
        final_amount,
        delivery_fee,
        created_at,
        actual_delivery_time,
        estimated_delivery_time,
        driver_id,
        restaurant_id,
        customer_id,
        restaurants:restaurants(
          restaurant_name,
          address,
          latitude,
          longitude
        )
      `,
        )
        .eq("driver_id", user.id)
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString())
        .order("created_at", { ascending: false });

      if (deliveriesError) {
        console.error("Error fetching deliveries:", deliveriesError);
        throw deliveriesError;
      }

      // If no deliveries found
      if (!deliveriesData || deliveriesData.length === 0) {
        setDeliveries([]);
        await calculateStats([]);
        return;
      }

      // Get all customer IDs from deliveries
      const customerIds = deliveriesData
        .map((order) => order.customer_id)
        .filter((id, index, self) => id && self.indexOf(id) === index);

      // Fetch customer info separately
      let customersMap = {};
      if (customerIds.length > 0) {
        const { data: customersData, error: customersError } = await supabase
          .from("users")
          .select(
            `
          id,
          full_name,
          profile_image_url
        `,
          )
          .in("id", customerIds);

        if (!customersError && customersData) {
          // Create a map for easy lookup
          customersData.forEach((customer) => {
            customersMap[customer.id] = customer;
          });
        }
      }

      // Fetch reviews for these orders
      const orderIds = deliveriesData.map((order) => order.id);
      let reviewsMap = {};

      const { data: reviewsData, error: reviewsError } = await supabase
        .from("reviews")
        .select("*")
        .eq("type", "driver")
        .in("order_id", orderIds);

      if (!reviewsError && reviewsData) {
        // Create a map of order_id -> review
        reviewsData.forEach((review) => {
          reviewsMap[review.order_id] = review;
        });
      }

      // Combine all data
      const deliveriesWithDetails = deliveriesData.map((delivery) => ({
        ...delivery,
        customers: {
          users: customersMap[delivery.customer_id] || null,
        },
        reviews: reviewsMap[delivery.id] ? [reviewsMap[delivery.id]] : [],
      }));

      setDeliveries(deliveriesWithDetails);

      // Calculate stats
      await calculateStats(deliveriesWithDetails);
    } catch (error) {
      console.error("Error fetching history:", error);
      Alert.alert("Error", "Failed to load delivery history");
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = async (deliveriesData) => {
    if (!user?.id) return;

    try {
      // Calculate basic stats from fetched data
      const totalDeliveries = deliveriesData.length;
      const completed = deliveriesData.filter(
        (d) => d.status === "delivered",
      ).length;
      const cancelled = deliveriesData.filter(
        (d) => d.status === "cancelled",
      ).length;

      // Calculate earnings from delivery fees
      const totalEarnings = deliveriesData.reduce(
        (sum, d) => sum + (d.delivery_fee || 0),
        0,
      );

      // Calculate average rating from reviews
      let totalRating = 0;
      let ratingCount = 0;
      deliveriesData.forEach((delivery) => {
        if (delivery.reviews && delivery.reviews.length > 0) {
          delivery.reviews.forEach((review) => {
            totalRating += review.rating;
            ratingCount++;
          });
        }
      });
      const averageRating = ratingCount > 0 ? totalRating / ratingCount : 0;

      // Calculate on-time rate (delivered before or at estimated time)
      let onTimeCount = 0;
      deliveriesData.forEach((delivery) => {
        if (
          delivery.status === "delivered" &&
          delivery.actual_delivery_time &&
          delivery.estimated_delivery_time
        ) {
          const actual = new Date(delivery.actual_delivery_time);
          const estimated = new Date(delivery.estimated_delivery_time);
          if (actual <= estimated) {
            onTimeCount++;
          }
        }
      });
      const onTimeRate = completed > 0 ? (onTimeCount / completed) * 100 : 0;

      // Get driver's rating from delivery_users table (use this as fallback)
      const { data: driverData } = await supabase
        .from("delivery_users")
        .select("rating")
        .eq("id", user.id)
        .single();

      // Use driver's rating from database, or calculated average rating
      const finalAverageRating = driverData?.rating || averageRating;

      setStats({
        totalDeliveries: deliveriesData.length,
        completed: completed,
        cancelled: cancelled,
        totalEarnings,
        averageRating: finalAverageRating,
        onTimeRate,
      });
    } catch (error) {
      console.error("Error calculating stats:", error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchHistory();
    setRefreshing(false);
  };

  const formatCurrency = (amount: number) => {
    return `AED ${amount?.toFixed(2) || "0.00"}`;
  };

  const formatTime = (dateString: string) => {
    if (!dateString) return "";
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (error) {
      return "";
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "";
    try {
      const date = new Date(dateString);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      if (date.toDateString() === today.toDateString()) {
        return "Today";
      } else if (date.toDateString() === yesterday.toDateString()) {
        return "Yesterday";
      } else {
        return date.toLocaleDateString([], {
          weekday: "short",
          month: "short",
          day: "numeric",
        });
      }
    } catch (error) {
      return "";
    }
  };

  const calculateDeliveryTime = (start: string, end: string) => {
    if (!start || !end) return "N/A";

    try {
      const startTime = new Date(start);
      const endTime = new Date(end);
      const diffMs = endTime.getTime() - startTime.getTime();
      const diffMins = Math.round(diffMs / 60000);

      if (diffMins < 60) {
        return `${diffMins} min`;
      } else {
        const hours = Math.floor(diffMins / 60);
        const minutes = diffMins % 60;
        return `${hours}h ${minutes}m`;
      }
    } catch (error) {
      return "N/A";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "delivered":
        return "#10B981";
      case "cancelled":
        return "#EF4444";
      case "out_for_delivery":
        return "#3B82F6";
      case "ready":
        return "#F59E0B";
      default:
        return "#6B7280";
    }
  };

  const renderDeliveryItem = ({ item }: any) => {
    const hasReview = item.reviews && item.reviews.length > 0;
    const review = hasReview ? item.reviews[0] : null;
    const customerName = item.customers?.users?.full_name || "Customer";
    const restaurantName = item.restaurants?.restaurant_name || "Restaurant";

    return (
      <View style={styles.deliveryCard}>
        <View style={styles.deliveryHeader}>
          <View>
            <Text style={styles.orderNumber}>#{item.order_number}</Text>
            <Text style={styles.customerName}>{customerName}</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.deliveryTime}>
              {formatDate(item.created_at)}
            </Text>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: getStatusColor(item.status) + "20" },
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  { color: getStatusColor(item.status) },
                ]}
              >
                {item.status?.replace(/_/g, " ").toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.deliveryDetails}>
          <View style={styles.detailRow}>
            <Ionicons name="restaurant-outline" size={14} color="#666" />
            <Text style={styles.detailText}>{restaurantName}</Text>
          </View>

          <View style={styles.detailRow}>
            <MaterialCommunityIcons name="cash" size={14} color="#666" />
            <Text style={styles.detailText}>
              Fee: {formatCurrency(item.delivery_fee || 0)}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Ionicons name="cash-outline" size={14} color="#666" />
            <Text style={styles.detailText}>
              Total: {formatCurrency(item.final_amount || 0)}
            </Text>
          </View>

          {item.actual_delivery_time && (
            <View style={styles.detailRow}>
              <Ionicons name="time-outline" size={14} color="#666" />
              <Text style={styles.detailText}>
                Delivered: {formatTime(item.actual_delivery_time)}
              </Text>
            </View>
          )}
        </View>

        {review && (
          <View style={styles.reviewSection}>
            <View style={styles.reviewHeader}>
              <View style={styles.ratingContainer}>
                <Ionicons name="star" size={14} color="#FFD700" />
                <Text style={styles.ratingText}>
                  {review.rating.toFixed(1)}
                </Text>
              </View>
              <Text style={styles.reviewTime}>
                {formatDate(review.created_at)}
              </Text>
            </View>
            {review.comment && (
              <Text style={styles.reviewComment} numberOfLines={2}>
                "{review.comment}"
              </Text>
            )}
          </View>
        )}

        <View style={styles.deliveryFooter}>
          <View style={styles.footerInfo}>
            <Text style={styles.footerText}>
              {item.actual_delivery_time
                ? `Delivered on ${new Date(item.actual_delivery_time).toLocaleDateString()}`
                : formatDate(item.created_at)}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.detailsButton}
            onPress={() => router.push(`/(driver)/orders/${item.id}`)}
          >
            <Text style={styles.detailsButtonText}>Details</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2E86DE" />
        <Text style={styles.loadingText}>Loading history...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Delivery History</Text>
        <TouchableOpacity
          style={styles.statsButton}
          onPress={() => router.push("/(driver)/analytics")}
        >
          <Text style={styles.statsButtonText}>Analytics</Text>
        </TouchableOpacity>
      </View>

      {/* Stats Overview */}
      {/* Stats Overview */}
      <View style={styles.statsOverview}>
        <View style={styles.statItem}>
          <LottieView
            source={animations.driver_delivery_stats}
            style={styles.statAnimation}
            autoPlay
            loop
            speed={0.5}
          />
          <Text style={styles.statNumber}>{stats.completed}</Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <LottieView
            source={animations.driver_earnings}
            style={styles.statAnimation}
            autoPlay
            loop
            speed={0.5}
          />
          <Text style={[styles.statNumber, { color: "#2E86DE" }]}>
            {formatCurrency(stats.totalEarnings)}
          </Text>
          <Text style={styles.statLabel}>Earnings</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <LottieView
            source={animations.driver_rating}
            style={styles.statAnimation}
            autoPlay
            loop
            speed={0.5}
          />
          <Text style={[styles.statNumber, { color: "#FFD700" }]}>
            {stats.averageRating.toFixed(1)}
          </Text>
          <Text style={styles.statLabel}>Rating</Text>
        </View>
      </View>

      {/* Period Filter */}
      <View style={styles.periodFilter}>
        {periods.map((period) => (
          <TouchableOpacity
            key={period.id}
            style={[
              styles.periodButton,
              selectedPeriod === period.id && styles.periodButtonActive,
            ]}
            onPress={() => setSelectedPeriod(period.id)}
          >
            <Text
              style={[
                styles.periodButtonText,
                selectedPeriod === period.id && styles.periodButtonTextActive,
              ]}
            >
              {period.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Deliveries List */}
      {deliveries.length === 0 ? (
        <View style={styles.emptyState}>
          <LottieView
            source={animations.driver_empty_state}
            style={styles.historyEmptyAnimation}
            autoPlay
            loop={false}
          />
          <Text style={styles.emptyStateTitle}>No delivery history</Text>
          <Text style={styles.emptyStateText}>
            {selectedPeriod === "today"
              ? "No deliveries today yet"
              : `No deliveries found for ${selectedPeriod}`}
          </Text>
          <TouchableOpacity
            style={styles.availableButton}
            onPress={() => router.push("/(driver)/orders")}
          >
            <Text style={styles.availableButtonText}>
              View Available Orders
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={deliveries}
          renderItem={renderDeliveryItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.deliveriesList}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#2E86DE"
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f8f8",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8f8f8",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#666",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1a1a1a",
  },
  statsButton: {
    backgroundColor: "#2E86DE20",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  statsButtonText: {
    color: "#2E86DE",
    fontSize: 14,
    fontWeight: "600",
  },
  statsOverview: {
    flexDirection: "row",
    backgroundColor: "#fff",
    paddingVertical: 20,
    marginBottom: 1,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statNumber: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1a1a1a",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: "#666",
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: "#f0f0f0",
  },
  periodFilter: {
    flexDirection: "row",
    backgroundColor: "#fff",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  periodButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  periodButtonActive: {
    backgroundColor: "#2E86DE",
  },
  periodButtonText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#666",
  },
  periodButtonTextActive: {
    color: "#fff",
  },
  deliveriesList: {
    padding: 16,
    paddingBottom: 20,
  },
  deliveryCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  deliveryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  headerRight: {
    alignItems: "flex-end",
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1a1a1a",
    marginBottom: 4,
  },
  customerName: {
    fontSize: 14,
    color: "#666",
  },
  deliveryTime: {
    fontSize: 12,
    color: "#999",
    fontWeight: "500",
    marginBottom: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  deliveryDetails: {
    gap: 8,
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  detailText: {
    fontSize: 13,
    color: "#666",
  },
  reviewSection: {
    backgroundColor: "#FFF9E6",
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  reviewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#333",
  },
  reviewTime: {
    fontSize: 11,
    color: "#999",
  },
  reviewComment: {
    fontSize: 13,
    color: "#666",
    fontStyle: "italic",
    lineHeight: 18,
  },
  deliveryFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerInfo: {
    flex: 1,
  },
  footerText: {
    fontSize: 12,
    color: "#999",
  },
  detailsButton: {
    backgroundColor: "#f8f8f8",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  detailsButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
    paddingTop: 80,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
  },
  availableButton: {
    backgroundColor: "#2E86DE",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  availableButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },

  statAnimation: {
    width: 40,
    height: 40,
    marginBottom: 8,
  },
  historyEmptyAnimation: {
    width: 150,
    height: 150,
  },
});
