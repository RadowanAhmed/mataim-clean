// app/(restaurant)/analytics.tsx
import { useAuth } from "@/backend/AuthContext";
import { supabase } from "@/backend/supabase";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
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
import { BarChart, LineChart, PieChart } from "react-native-chart-kit";
import { SafeAreaView } from "react-native-safe-area-context";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface AnalyticsData {
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  totalCustomers: number;
  totalPosts: number;
  totalMenuItems: number;
  averageRating: number;
  completionRate: number;
}

interface DailyStats {
  date: string;
  orders: number;
  revenue: number;
  customers: number;
}

interface OrderStatusCount {
  name: string;
  count: number;
  color: string;
  legendFontColor: string;
}

interface TopItem {
  id: string;
  name: string;
  orderCount: number;
  revenue: number;
  image?: string;
}

interface HourlyData {
  hour: string;
  orders: number;
}

export default function RestaurantAnalyticsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timeRange, setTimeRange] = useState<"week" | "month" | "year">("week");

  // Analytics data states
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalOrders: 0,
    totalRevenue: 0,
    averageOrderValue: 0,
    totalCustomers: 0,
    totalPosts: 0,
    totalMenuItems: 0,
    averageRating: 0,
    completionRate: 0,
  });

  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [orderStatusStats, setOrderStatusStats] = useState<OrderStatusCount[]>(
    [],
  );
  const [topItems, setTopItems] = useState<TopItem[]>([]);
  const [hourlyData, setHourlyData] = useState<HourlyData[]>([]);
  const [revenueChange, setRevenueChange] = useState({
    value: 0,
    isPositive: true,
  });
  const [ordersChange, setOrdersChange] = useState({
    value: 0,
    isPositive: true,
  });

  useEffect(() => {
    fetchAnalyticsData();
  }, [timeRange]);

  const fetchAnalyticsData = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);

      // Get date range based on selected time range
      const endDate = new Date();
      const startDate = new Date();

      if (timeRange === "week") {
        startDate.setDate(startDate.getDate() - 7);
      } else if (timeRange === "month") {
        startDate.setMonth(startDate.getMonth() - 1);
      } else {
        startDate.setFullYear(startDate.getFullYear() - 1);
      }

      const startDateStr = startDate.toISOString();
      const endDateStr = endDate.toISOString();

      // Fetch orders in date range
      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select(
          `
          id,
          status,
          final_amount,
          customer_id,
          created_at
        `,
        )
        .eq("restaurant_id", user.id)
        .gte("created_at", startDateStr)
        .lte("created_at", endDateStr);

      if (ordersError) throw ordersError;

      // Fetch total posts count
      const { count: postsCount, error: postsError } = await supabase
        .from("posts")
        .select("*", { count: "exact", head: true })
        .eq("restaurant_id", user.id)
        .eq("is_active", true);

      if (postsError) throw postsError;

      // Fetch menu items count
      const { count: menuCount, error: menuError } = await supabase
        .from("menu_items")
        .select("*", { count: "exact", head: true })
        .eq("restaurant_id", user.id)
        .eq("is_available", true);

      if (menuError) throw menuError;

      // Fetch restaurant rating
      const { data: restaurantData, error: restaurantError } = await supabase
        .from("restaurants")
        .select("restaurant_rating, total_orders")
        .eq("id", user.id)
        .single();

      if (restaurantError) throw restaurantError;

      // Process orders data
      const orders = ordersData || [];

      // Calculate analytics
      const totalOrders = orders.length;
      const totalRevenue = orders.reduce(
        (sum, order) => sum + (order.final_amount || 0),
        0,
      );
      const uniqueCustomers = new Set(orders.map((o) => o.customer_id)).size;
      const averageOrderValue =
        totalOrders > 0 ? totalRevenue / totalOrders : 0;

      // Calculate completion rate (non-cancelled orders)
      const completedOrders = orders.filter(
        (o) => o.status !== "cancelled" && o.status !== "pending",
      ).length;
      const completionRate =
        totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 0;

      setAnalytics({
        totalOrders,
        totalRevenue,
        averageOrderValue,
        totalCustomers: uniqueCustomers,
        totalPosts: postsCount || 0,
        totalMenuItems: menuCount || 0,
        averageRating: restaurantData?.restaurant_rating || 0,
        completionRate,
      });

      // Process daily stats for chart
      const dailyMap = new Map<
        string,
        { orders: number; revenue: number; customers: Set<string> }
      >();

      orders.forEach((order) => {
        const date = new Date(order.created_at).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });

        if (!dailyMap.has(date)) {
          dailyMap.set(date, { orders: 0, revenue: 0, customers: new Set() });
        }

        const dayData = dailyMap.get(date)!;
        dayData.orders += 1;
        dayData.revenue += order.final_amount || 0;
        if (order.customer_id) {
          dayData.customers.add(order.customer_id);
        }
      });

      const dailyArray = Array.from(dailyMap.entries()).map(([date, data]) => ({
        date,
        orders: data.orders,
        revenue: data.revenue,
        customers: data.customers.size,
      }));

      // Sort by date
      dailyArray.sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return dateA.getTime() - dateB.getTime();
      });

      setDailyStats(dailyArray);

      // Calculate change percentages
      if (dailyArray.length >= 2) {
        const currentPeriod = dailyArray.slice(
          -Math.floor(dailyArray.length / 2),
        );
        const previousPeriod = dailyArray.slice(
          0,
          Math.floor(dailyArray.length / 2),
        );

        const currentRevenue = currentPeriod.reduce(
          (sum, d) => sum + d.revenue,
          0,
        );
        const previousRevenue = previousPeriod.reduce(
          (sum, d) => sum + d.revenue,
          0,
        );
        const revenueChangeValue =
          previousRevenue > 0
            ? ((currentRevenue - previousRevenue) / previousRevenue) * 100
            : 0;

        const currentOrders = currentPeriod.reduce(
          (sum, d) => sum + d.orders,
          0,
        );
        const previousOrders = previousPeriod.reduce(
          (sum, d) => sum + d.orders,
          0,
        );
        const ordersChangeValue =
          previousOrders > 0
            ? ((currentOrders - previousOrders) / previousOrders) * 100
            : 0;

        setRevenueChange({
          value: Math.abs(Math.round(revenueChangeValue * 10) / 10),
          isPositive: revenueChangeValue >= 0,
        });

        setOrdersChange({
          value: Math.abs(Math.round(ordersChangeValue * 10) / 10),
          isPositive: ordersChangeValue >= 0,
        });
      }

      // Process order status for pie chart
      const statusMap = new Map<string, number>();
      const statusColors: { [key: string]: string } = {
        pending: "#F59E0B",
        confirmed: "#3B82F6",
        preparing: "#8B5CF6",
        ready: "#10B981",
        out_for_delivery: "#6366F1",
        delivered: "#10B981",
        cancelled: "#EF4444",
      };

      orders.forEach((order) => {
        const status = order.status || "pending";
        statusMap.set(status, (statusMap.get(status) || 0) + 1);
      });

      const statusArray = Array.from(statusMap.entries()).map(
        ([name, count]) => ({
          name: name.replace(/_/g, " ").toUpperCase(),
          count,
          color: statusColors[name] || "#6B7280",
          legendFontColor: "#7F7F7F",
          legendFontSize: 12,
        }),
      );

      setOrderStatusStats(statusArray);

      // Fetch top items
      const { data: itemsData, error: itemsError } = await supabase
        .from("order_items")
        .select(
          `
          post_id,
          menu_item_id,
          quantity,
          unit_price
        `,
        )
        .eq(
          "order_id",
          supabase.rpc("get_order_ids", {
            rest_id: user.id,
            start_date: startDateStr,
            end_date: endDateStr,
          }),
        );

      if (!itemsError && itemsData) {
        const itemMap = new Map<
          string,
          { count: number; revenue: number; name: string }
        >();

        for (const item of itemsData) {
          let itemName = "Unknown Item";

          if (item.post_id) {
            const { data: postData } = await supabase
              .from("posts")
              .select("title")
              .eq("id", item.post_id)
              .single();

            if (postData) {
              itemName = postData.title;
            }
          } else if (item.menu_item_id) {
            const { data: menuData } = await supabase
              .from("menu_items")
              .select("name")
              .eq("id", item.menu_item_id)
              .single();

            if (menuData) {
              itemName = menuData.name;
            }
          }

          const itemId =
            item.post_id || item.menu_item_id || `unknown-${Date.now()}`;
          const current = itemMap.get(itemId) || {
            count: 0,
            revenue: 0,
            name: itemName,
          };
          current.count += item.quantity || 1;
          current.revenue += (item.quantity || 1) * (item.unit_price || 0);
          itemMap.set(itemId, current);
        }

        const topItemsArray = Array.from(itemMap.entries())
          .map(([id, data]) => ({
            id,
            name: data.name,
            orderCount: data.count,
            revenue: data.revenue,
          }))
          .sort((a, b) => b.orderCount - a.orderCount)
          .slice(0, 5);

        setTopItems(topItemsArray);
      }

      // Generate hourly data (simulated for now)
      const hours = Array.from({ length: 24 }, (_, i) => {
        const hour = i.toString().padStart(2, "0") + ":00";
        const randomOrders = Math.floor(Math.random() * 10) + 1;
        return { hour, orders: randomOrders };
      });
      setHourlyData(hours);
    } catch (error) {
      console.error("Error fetching analytics:", error);
      Alert.alert("Error", "Failed to load analytics data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAnalyticsData();
  };

  const chartConfig = {
    backgroundColor: "#ffffff",
    backgroundGradientFrom: "#ffffff",
    backgroundGradientTo: "#ffffff",
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(255, 107, 53, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(107, 114, 128, ${opacity})`,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: "6",
      strokeWidth: "2",
      stroke: "#FF6B35",
    },
    propsForBackgroundLines: {
      stroke: "#E5E7EB",
      strokeDasharray: "",
      strokeWidth: 1,
    },
  };

  const formatCurrency = (value: number) => {
    return `AED ${value.toFixed(2)}`;
  };

  const formatNumber = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toString();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={styles.loadingText}>Loading analytics...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Analytics & Reports</Text>
        <TouchableOpacity onPress={onRefresh} disabled={refreshing}>
          <Ionicons
            name="refresh"
            size={20}
            color={refreshing ? "#9CA3AF" : "#FF6B35"}
          />
        </TouchableOpacity>
      </View>

      {/* Time Range Selector */}
      <View style={styles.timeRangeContainer}>
        {["week", "month", "year"].map((range) => (
          <TouchableOpacity
            key={range}
            style={[
              styles.timeRangeButton,
              timeRange === range && styles.timeRangeButtonActive,
            ]}
            onPress={() => setTimeRange(range as any)}
          >
            <Text
              style={[
                styles.timeRangeText,
                timeRange === range && styles.timeRangeTextActive,
              ]}
            >
              {range.charAt(0).toUpperCase() + range.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Key Metrics Cards */}
        <View style={styles.metricsGrid}>
          <LinearGradient
            colors={["#FF6B35", "#FF8A5C"]}
            style={styles.metricCardLarge}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.metricIconContainer}>
              <Ionicons name="cash-outline" size={24} color="#fff" />
            </View>
            <Text style={styles.metricValueLarge}>
              {formatCurrency(analytics.totalRevenue)}
            </Text>
            <Text style={styles.metricLabelLarge}>Total Revenue</Text>
            <View style={styles.metricChange}>
              <Ionicons
                name={revenueChange.isPositive ? "arrow-up" : "arrow-down"}
                size={14}
                color="#fff"
              />
              <Text style={styles.metricChangeText}>
                {revenueChange.value}% vs last period
              </Text>
            </View>
          </LinearGradient>

          <View style={styles.metricsRow}>
            <View style={[styles.metricCard, { backgroundColor: "#EFF6FF" }]}>
              <Ionicons name="receipt-outline" size={20} color="#3B82F6" />
              <Text style={[styles.metricValue, { color: "#3B82F6" }]}>
                {analytics.totalOrders}
              </Text>
              <Text style={styles.metricLabel}>Orders</Text>
              <View style={styles.metricSmallChange}>
                <Ionicons
                  name={ordersChange.isPositive ? "arrow-up" : "arrow-down"}
                  size={10}
                  color={ordersChange.isPositive ? "#10B981" : "#EF4444"}
                />
                <Text
                  style={[
                    styles.metricSmallChangeText,
                    { color: ordersChange.isPositive ? "#10B981" : "#EF4444" },
                  ]}
                >
                  {ordersChange.value}%
                </Text>
              </View>
            </View>

            <View style={[styles.metricCard, { backgroundColor: "#FEF3C7" }]}>
              <Ionicons name="people-outline" size={20} color="#F59E0B" />
              <Text style={[styles.metricValue, { color: "#F59E0B" }]}>
                {analytics.totalCustomers}
              </Text>
              <Text style={styles.metricLabel}>Customers</Text>
            </View>
          </View>

          <View style={styles.metricsRow}>
            <View style={[styles.metricCard, { backgroundColor: "#EDE9FE" }]}>
              <Ionicons name="fast-food-outline" size={20} color="#8B5CF6" />
              <Text style={[styles.metricValue, { color: "#8B5CF6" }]}>
                {analytics.totalMenuItems}
              </Text>
              <Text style={styles.metricLabel}>Menu Items</Text>
            </View>

            <View style={[styles.metricCard, { backgroundColor: "#D1FAE5" }]}>
              <Ionicons name="star-outline" size={20} color="#10B981" />
              <Text style={[styles.metricValue, { color: "#10B981" }]}>
                {analytics.averageRating.toFixed(1)}
              </Text>
              <Text style={styles.metricLabel}>Rating</Text>
            </View>
          </View>
        </View>

        {/* Revenue Chart */}
        {dailyStats.length > 0 && (
          <View style={styles.chartCard}>
            <View style={styles.chartHeader}>
              <Text style={styles.chartTitle}>Revenue Overview</Text>
              <Text style={styles.chartSubtitle}>
                {timeRange === "week"
                  ? "Last 7 days"
                  : timeRange === "month"
                    ? "Last 30 days"
                    : "Last 12 months"}
              </Text>
            </View>
            <LineChart
              data={{
                labels: dailyStats.map((d) => d.date),
                datasets: [
                  {
                    data: dailyStats.map((d) => d.revenue),
                    color: (opacity = 1) => `rgba(255, 107, 53, ${opacity})`,
                    strokeWidth: 2,
                  },
                ],
              }}
              width={SCREEN_WIDTH - 32}
              height={220}
              chartConfig={chartConfig}
              bezier
              style={styles.chart}
              formatYLabel={(value) => `AED ${formatNumber(parseFloat(value))}`}
            />
          </View>
        )}

        {/* Orders Chart */}
        {dailyStats.length > 0 && (
          <View style={styles.chartCard}>
            <View style={styles.chartHeader}>
              <Text style={styles.chartTitle}>Orders Overview</Text>
              <Text style={styles.chartSubtitle}>Daily order count</Text>
            </View>
            <BarChart
              data={{
                labels: dailyStats.map((d) => d.date),
                datasets: [
                  {
                    data: dailyStats.map((d) => d.orders),
                  },
                ],
              }}
              width={SCREEN_WIDTH - 32}
              height={220}
              chartConfig={chartConfig}
              style={styles.chart}
              showValuesOnTopOfBars
              yAxisLabel=""
              yAxisSuffix=""
            />
          </View>
        )}

        {/* Order Status Distribution */}
        {orderStatusStats.length > 0 && (
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Order Status Distribution</Text>
            <PieChart
              data={orderStatusStats}
              width={SCREEN_WIDTH - 32}
              height={200}
              chartConfig={chartConfig}
              accessor="count"
              backgroundColor="transparent"
              paddingLeft="15"
              absolute
            />
          </View>
        )}

        {/* Top Items */}
        {topItems.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Top Selling Items</Text>
            {topItems.map((item, index) => (
              <View key={item.id} style={styles.topItemCard}>
                <View style={styles.topItemRank}>
                  <Text style={styles.topItemRankText}>{index + 1}</Text>
                </View>
                <View style={styles.topItemInfo}>
                  <Text style={styles.topItemName}>{item.name}</Text>
                  <Text style={styles.topItemStats}>
                    {item.orderCount} orders • {formatCurrency(item.revenue)}
                  </Text>
                </View>
                <View style={styles.topItemProgress}>
                  <View
                    style={[
                      styles.topItemProgressBar,
                      {
                        width: `${(item.orderCount / topItems[0].orderCount) * 100}%`,
                        backgroundColor: "#FF6B35",
                      },
                    ]}
                  />
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Hourly Distribution */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Peak Hours</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.hourlyContainer}>
              {hourlyData.map((hour, index) => (
                <View key={index} style={styles.hourlyBar}>
                  <View style={styles.hourlyBarContainer}>
                    <View
                      style={[
                        styles.hourlyBarFill,
                        {
                          height: `${(hour.orders / 30) * 100}%`,
                          backgroundColor:
                            hour.orders > 20 ? "#FF6B35" : "#8B5CF6",
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.hourlyLabel}>{hour.hour}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Additional Metrics */}
        <View style={styles.metricsFooter}>
          <View style={styles.footerMetric}>
            <Text style={styles.footerMetricLabel}>Average Order Value</Text>
            <Text style={styles.footerMetricValue}>
              {formatCurrency(analytics.averageOrderValue)}
            </Text>
          </View>
          <View style={styles.footerMetric}>
            <Text style={styles.footerMetricLabel}>Completion Rate</Text>
            <Text style={styles.footerMetricValue}>
              {analytics.completionRate.toFixed(1)}%
            </Text>
          </View>
          <View style={styles.footerMetric}>
            <Text style={styles.footerMetricLabel}>Total Posts</Text>
            <Text style={styles.footerMetricValue}>{analytics.totalPosts}</Text>
          </View>
        </View>

        <View style={styles.spacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
    fontSize: 14,
    color: "#6B7280",
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
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  timeRangeContainer: {
    flexDirection: "row",
    backgroundColor: "#fff",
    padding: 4,
    margin: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  timeRangeButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 6,
  },
  timeRangeButtonActive: {
    backgroundColor: "#FF6B35",
  },
  timeRangeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },
  timeRangeTextActive: {
    color: "#fff",
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  metricsGrid: {
    marginBottom: 16,
  },
  metricCardLarge: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: "#FF6B35",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  metricIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  metricValueLarge: {
    fontSize: 32,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 4,
  },
  metricLabelLarge: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.9)",
    marginBottom: 8,
  },
  metricChange: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: "flex-start",
    gap: 4,
  },
  metricChangeText: {
    fontSize: 12,
    color: "#fff",
    fontWeight: "500",
  },
  metricsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  metricCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  metricValue: {
    fontSize: 24,
    fontWeight: "700",
    marginTop: 8,
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 12,
    color: "#6B7280",
  },
  metricSmallChange: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 2,
  },
  metricSmallChangeText: {
    fontSize: 10,
    fontWeight: "500",
  },
  chartCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 0.5,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  chartSubtitle: {
    fontSize: 12,
    color: "#6B7280",
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
    marginLeft: -8,
  },
  section: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 16,
  },
  topItemCard: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  topItemRank: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  topItemRankText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
  },
  topItemInfo: {
    flex: 1,
    marginRight: 12,
  },
  topItemName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 2,
  },
  topItemStats: {
    fontSize: 12,
    color: "#6B7280",
  },
  topItemProgress: {
    width: 60,
    height: 4,
    backgroundColor: "#F3F4F6",
    borderRadius: 2,
    overflow: "hidden",
  },
  topItemProgressBar: {
    height: "100%",
    borderRadius: 2,
  },
  hourlyContainer: {
    flexDirection: "row",
    paddingVertical: 8,
  },
  hourlyBar: {
    alignItems: "center",
    marginRight: 12,
    width: 40,
  },
  hourlyBarContainer: {
    width: 24,
    height: 100,
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    justifyContent: "flex-end",
    overflow: "hidden",
    marginBottom: 8,
  },
  hourlyBarFill: {
    width: "100%",
    borderRadius: 12,
  },
  hourlyLabel: {
    fontSize: 10,
    color: "#6B7280",
  },
  metricsFooter: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    justifyContent: "space-around",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  footerMetric: {
    alignItems: "center",
  },
  footerMetricLabel: {
    fontSize: 11,
    color: "#6B7280",
    marginBottom: 4,
  },
  footerMetricValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  spacer: {
    height: 20,
  },
});
