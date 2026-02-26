import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LineChart } from "react-native-chart-kit";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/backend/AuthContext";
import { supabase } from "@/backend/supabase";
import animations from "@/constent/animations";
import LottieView from "lottie-react-native";

const { width } = Dimensions.get("window");

export default function DriverEarningsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [earnings, setEarnings] = useState({
    today: 0,
    weekly: 0,
    monthly: 0,
    total: 0,
    pending: 0,
    lastPayout: 0,
    nextPayout: 0,
  });
  const [weeklyData, setWeeklyData] = useState([]);
  const [recentTransactions, setRecentTransactions] = useState([]);

  useEffect(() => {
    fetchEarningsData();
  }, [user]);

  const fetchEarningsData = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);

      // Get driver data with existing columns
      const { data: driverData, error: driverError } = await supabase
        .from("delivery_users")
        .select("earnings_today, total_earnings, is_online, driver_status")
        .eq("id", user.id)
        .single();

      if (driverError) {
        console.error("Error fetching driver data:", driverError);
        // Continue with default values if driver not found
      }

      // Calculate today's date range
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Calculate weekly date range (last 7 days)
      const weekStart = new Date(today);
      weekStart.setDate(weekStart.getDate() - 6); // Last 7 days including today

      // Calculate monthly date range (this month)
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      monthEnd.setHours(23, 59, 59, 999);

      // Fetch all delivered orders for the driver
      const { data: allDeliveredOrders, error: ordersError } = await supabase
        .from("orders")
        .select(
          "delivery_fee, actual_delivery_time, created_at, payment_status",
        )
        .eq("driver_id", user.id)
        .eq("status", "delivered")
        .order("actual_delivery_time", { ascending: false });

      if (ordersError) {
        console.error("Error fetching orders:", ordersError);
        throw ordersError;
      }

      // Calculate earnings based on time periods
      let todayEarnings = 0;
      let weeklyEarnings = 0;
      let monthlyEarnings = 0;
      let totalEarnings = 0;
      let pendingEarnings = 0; // Orders with payment_status = "completed" but not paid out
      const dailyEarnings = Array(7).fill(0); // For weekly chart

      if (allDeliveredOrders) {
        // Process each order
        allDeliveredOrders.forEach((order) => {
          const deliveryTime = order.actual_delivery_time || order.created_at;
          const deliveryDate = new Date(deliveryTime);
          const fee = order.delivery_fee || 0;

          // Add to total earnings
          totalEarnings += fee;

          // Check if payment is completed but not paid out (pending)
          if (order.payment_status === "completed") {
            pendingEarnings += fee;
          }

          // Check if delivered today
          if (deliveryDate >= today && deliveryDate < tomorrow) {
            todayEarnings += fee;
          }

          // Check if delivered this week (last 7 days)
          if (deliveryDate >= weekStart) {
            weeklyEarnings += fee;

            // Add to daily earnings for chart (0 = Sunday, 6 = Saturday)
            const dayOfWeek = deliveryDate.getDay();
            dailyEarnings[dayOfWeek] += fee;
          }

          // Check if delivered this month
          if (deliveryDate >= monthStart && deliveryDate <= monthEnd) {
            monthlyEarnings += fee;
          }
        });
      }

      // Set weekly data for chart
      setWeeklyData(dailyEarnings);

      // Fetch recent transactions (last 10 delivered orders with restaurant info)
      const { data: recentOrdersData } = await supabase
        .from("orders")
        .select(
          `
        id,
        order_number,
        delivery_fee,
        actual_delivery_time,
        created_at,
        restaurant_id,
        restaurants (
          restaurant_name
        )
      `,
        )
        .eq("driver_id", user.id)
        .eq("status", "delivered")
        .order("actual_delivery_time", { ascending: false })
        .limit(10);

      // Process recent transactions
      const processedTransactions = (recentOrdersData || []).map((order) => ({
        id: order.id,
        order_number: order.order_number,
        delivery_fee: order.delivery_fee || 0,
        actual_delivery_time: order.actual_delivery_time || order.created_at,
        restaurants: order.restaurants || { restaurant_name: "Restaurant" },
      }));

      setRecentTransactions(processedTransactions);

      // Calculate next payout (every Monday)
      const now = new Date();
      const daysUntilMonday = (8 - now.getDay()) % 7 || 7;
      const nextPayoutDate = new Date(now);
      nextPayoutDate.setDate(now.getDate() + daysUntilMonday);
      nextPayoutDate.setHours(0, 0, 0, 0);

      // Calculate total earnings from driver data or from our calculation
      const finalTotalEarnings = driverData?.total_earnings || totalEarnings;

      // Use calculated pending earnings (orders with payment_status = "completed")
      const finalPendingEarnings = pendingEarnings;

      setEarnings({
        today: todayEarnings,
        weekly: weeklyEarnings,
        monthly: monthlyEarnings,
        total: finalTotalEarnings,
        pending: finalPendingEarnings,
        lastPayout: 0, // You would fetch this from a payouts table if you have one
        nextPayout: nextPayoutDate.getTime(),
      });
    } catch (error) {
      console.error("Error fetching earnings data:", error);
      Alert.alert("Error", "Failed to load earnings data");
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchEarningsData();
    setRefreshing(false);
  };

  const formatCurrency = (amount: number) => {
    return `AED ${amount?.toFixed(2) || "0.00"}`;
  };

  const formatDate = (timestamp: number) => {
    if (!timestamp) return "Monday";
    try {
      const date = new Date(timestamp);
      return date.toLocaleDateString([], {
        weekday: "long",
        month: "short",
        day: "numeric",
      });
    } catch (error) {
      return "Monday";
    }
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

  const chartConfig = {
    backgroundColor: "#fff",
    backgroundGradientFrom: "#fff",
    backgroundGradientTo: "#fff",
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(42, 134, 222, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: "6",
      strokeWidth: "2",
      stroke: "#2E86DE",
    },
  };

  const chartData = {
    labels: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    datasets: [
      {
        data: weeklyData,
        color: (opacity = 1) => `rgba(42, 134, 222, ${opacity})`,
        strokeWidth: 2,
      },
    ],
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2E86DE" />
        <Text style={styles.loadingText}>Loading earnings...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#2E86DE"
          />
        }
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Earnings</Text>
          <TouchableOpacity
            style={styles.payoutButton}
            onPress={() => router.push("/(driver)/payouts")}
          >
            <Text style={styles.payoutButtonText}>Payouts</Text>
          </TouchableOpacity>
        </View>

        {/* Total Earnings */}
        {/* Total Earnings with Animation */}
        <View style={styles.totalEarningsCard}>
          <LottieView
            source={animations.driver_earnings}
            style={styles.earningsAnimation}
            autoPlay
            loop
            speed={0.8}
          />
          <Text style={styles.totalLabel}>Total Earnings</Text>
          <Text style={styles.totalAmount}>
            {formatCurrency(earnings.total)}
          </Text>
          <Text style={styles.totalSubtitle}>
            Lifetime earnings from all deliveries
          </Text>
        </View>

        {/* Earnings Stats */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: "#10AC8420" }]}>
              <Ionicons name="today" size={20} color="#10AC84" />
            </View>
            <Text style={styles.statAmount}>
              {formatCurrency(earnings.today)}
            </Text>
            <Text style={styles.statLabel}>Today</Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: "#2E86DE20" }]}>
              <Ionicons name="calendar" size={20} color="#2E86DE" />
            </View>
            <Text style={styles.statAmount}>
              {formatCurrency(earnings.weekly)}
            </Text>
            <Text style={styles.statLabel}>This Week</Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: "#D980FA20" }]}>
              <MaterialCommunityIcons
                name="calendar-month"
                size={20}
                color="#D980FA"
              />
            </View>
            <Text style={styles.statAmount}>
              {formatCurrency(earnings.monthly)}
            </Text>
            <Text style={styles.statLabel}>This Month</Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: "#FF9F4320" }]}>
              <Ionicons name="cash" size={20} color="#FF9F43" />
            </View>
            <Text style={styles.statAmount}>
              {formatCurrency(earnings.pending)}
            </Text>
            <Text style={styles.statLabel}>Available</Text>
          </View>
        </View>

        {/* Weekly Chart */}
        <View style={styles.chartSection}>
          <Text style={styles.sectionTitle}>Weekly Earnings</Text>
          {weeklyData.some((value) => value > 0) ? (
            <LineChart
              data={chartData}
              width={width - 40}
              height={200}
              chartConfig={chartConfig}
              bezier
              style={styles.chart}
              withInnerLines={false}
              withOuterLines={false}
            />
          ) : (
            <View style={styles.noChartData}>
              <LottieView
                source={animations.driver_empty_state}
                style={styles.smallAnimation}
                autoPlay
                loop={true}
              />
              <Text style={styles.noChartDataText}>
                No earnings data for this week yet
              </Text>
            </View>
          )}
        </View>

        {/* Payout Information */}
        <View style={styles.payoutInfo}>
          <View style={styles.payoutCard}>
            <Ionicons name="wallet-outline" size={24} color="#2E86DE" />
            <View style={styles.payoutContent}>
              <Text style={styles.payoutTitle}>Next Payout</Text>
              <Text style={styles.payoutDate}>
                {formatDate(earnings.nextPayout)}
              </Text>
              <Text style={styles.payoutAmount}>
                {formatCurrency(earnings.pending)} available
              </Text>
            </View>
            <TouchableOpacity style={styles.withdrawButton}>
              <Text style={styles.withdrawButtonText}>Withdraw</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recent Transactions */}
        <View style={styles.transactionsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Transactions</Text>
            <TouchableOpacity
              onPress={() => router.push("/(driver)/transactions")}
            >
              <Text style={styles.seeAllText}>View All</Text>
            </TouchableOpacity>
          </View>

          {recentTransactions.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={48} color="#ccc" />
              <Text style={styles.emptyStateText}>No transactions yet</Text>
            </View>
          ) : (
            <View style={styles.transactionsList}>
              {recentTransactions.map((transaction) => (
                <View key={transaction.id} style={styles.transactionCard}>
                  <View style={styles.transactionInfo}>
                    <Text style={styles.transactionRestaurant}>
                      {transaction.restaurants?.restaurant_name || "Restaurant"}
                    </Text>
                    <Text style={styles.transactionOrder}>
                      Order #{transaction.order_number}
                    </Text>
                    <Text style={styles.transactionTime}>
                      {formatTime(transaction.actual_delivery_time)}
                    </Text>
                  </View>
                  <View style={styles.transactionAmount}>
                    <Text style={styles.transactionFee}>
                      {formatCurrency(transaction.delivery_fee || 0)}
                    </Text>
                    <View style={styles.statusBadge}>
                      <Text style={styles.statusText}>Completed</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Tips & Insights */}
        <View style={styles.insightsSection}>
          <Text style={styles.sectionTitle}>Earnings Tips</Text>
          <View style={styles.insightsGrid}>
            <View style={styles.insightCard}>
              <Ionicons name="time" size={20} color="#FF9F43" />
              <Text style={styles.insightTitle}>Peak Hours</Text>
              <Text style={styles.insightText}>12 PM - 2 PM, 7 PM - 9 PM</Text>
            </View>

            <View style={styles.insightCard}>
              <Ionicons name="location" size={20} color="#10AC84" />
              <Text style={styles.insightTitle}>Busy Areas</Text>
              <Text style={styles.insightText}>
                Downtown, Business District
              </Text>
            </View>

            <View style={styles.insightCard}>
              <MaterialCommunityIcons
                name="trending-up"
                size={20}
                color="#2E86DE"
              />
              <Text style={styles.insightTitle}>Best Day</Text>
              <Text style={styles.insightText}>Friday +15% avg earnings</Text>
            </View>

            <View style={styles.insightCard}>
              <Ionicons name="star" size={20} color="#FFD700" />
              <Text style={styles.insightTitle}>Rating Bonus</Text>
              <Text style={styles.insightText}>+5% for 4.8+ rating</Text>
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
    fontSize: 13, // Reduced from 14
    color: "#666",
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
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
  headerTitle: {
    fontSize: 22, // Reduced from 24
    fontWeight: "bold",
    color: "#1a1a1a",
  },
  payoutButton: {
    backgroundColor: "#2E86DE20",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  payoutButtonText: {
    color: "#2E86DE",
    fontSize: 13, // Reduced from 14
    fontWeight: "600",
  },
  totalEarningsCard: {
    backgroundColor: "#2E86DE",
    margin: 20,
    padding: 20, // Reduced from 24
    borderRadius: 16,
    alignItems: "center",
  },
  totalLabel: {
    fontSize: 13, // Reduced from 14
    color: "rgba(255, 255, 255, 0.9)",
    marginBottom: 6,
  },
  totalAmount: {
    fontSize: 32, // Reduced from 36
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 4,
  },
  totalSubtitle: {
    fontSize: 11, // Reduced from 12
    color: "rgba(255, 255, 255, 0.8)",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  statCard: {
    width: "48%",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14, // Reduced from 16
    marginHorizontal: "1%",
    marginBottom: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statIcon: {
    width: 36, // Reduced from 40
    height: 36, // Reduced from 40
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  statAmount: {
    fontSize: 17, // Reduced from 18
    fontWeight: "bold",
    color: "#1a1a1a",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11, // Reduced from 12
    color: "#666",
  },
  chartSection: {
    backgroundColor: "#fff",
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 16, // Reduced from 20
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 17, // Reduced from 18
    fontWeight: "bold",
    color: "#1a1a1a",
    marginBottom: 12,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  noChartData: {
    height: 200,
    justifyContent: "center",
    alignItems: "center",
  },
  noChartDataText: {
    marginTop: 12,
    fontSize: 13, // Reduced from 14
    color: "#999",
    textAlign: "center",
  },
  payoutInfo: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  payoutCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 16, // Reduced from 20
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  payoutContent: {
    flex: 1,
    marginLeft: 12,
  },
  payoutTitle: {
    fontSize: 15, // Reduced from 16
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 2,
  },
  payoutDate: {
    fontSize: 13, // Reduced from 14
    color: "#666",
    marginBottom: 2,
  },
  payoutAmount: {
    fontSize: 13, // Reduced from 14
    fontWeight: "bold",
    color: "#2E86DE",
  },
  withdrawButton: {
    backgroundColor: "#2E86DE",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  withdrawButtonText: {
    color: "#fff",
    fontSize: 13, // Reduced from 14
    fontWeight: "600",
  },
  transactionsSection: {
    backgroundColor: "#fff",
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 16, // Reduced from 20
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  seeAllText: {
    fontSize: 13, // Reduced from 14
    color: "#2E86DE",
    fontWeight: "600",
  },
  transactionsList: {
    gap: 10,
  },
  transactionCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#f8f8f8",
    padding: 12,
    borderRadius: 8,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionRestaurant: {
    fontSize: 13, // Reduced from 14
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 2,
  },
  transactionOrder: {
    fontSize: 11, // Reduced from 12
    color: "#666",
    marginBottom: 2,
  },
  transactionTime: {
    fontSize: 10, // Reduced from 11
    color: "#999",
  },
  transactionAmount: {
    alignItems: "flex-end",
  },
  transactionFee: {
    fontSize: 15, // Reduced from 16
    fontWeight: "bold",
    color: "#2E86DE",
    marginBottom: 4,
  },
  statusBadge: {
    backgroundColor: "#10AC8420",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 9, // Reduced from 10
    fontWeight: "600",
    color: "#10AC84",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 28,
  },
  emptyStateText: {
    marginTop: 12,
    fontSize: 13, // Reduced from 14
    color: "#999",
  },
  insightsSection: {
    backgroundColor: "#fff",
    marginHorizontal: 20,
    padding: 16, // Reduced from 20
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  insightsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  insightCard: {
    width: "48%",
    backgroundColor: "#f8f8f8",
    padding: 14, // Reduced from 16
    borderRadius: 12,
  },
  insightTitle: {
    fontSize: 13, // Reduced from 14
    fontWeight: "600",
    color: "#1a1a1a",
    marginTop: 6,
    marginBottom: 4,
  },
  insightText: {
    fontSize: 11, // Reduced from 12
    color: "#666",
    lineHeight: 15,
  },

  earningsAnimation: {
    width: 80,
    height: 80,
    marginBottom: 10,
  },
  smallAnimation: {
    width: 80,
    height: 80,
  },
});
