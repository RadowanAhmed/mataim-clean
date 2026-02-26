// app/admin/bulk-create-restaurants.tsx
import { useAuth } from "@/backend/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from "react-native";

const restaurants = [
  {
    email: "alfanar.dxb@mataim.ae",
    password: "Restaurant123!",
    fullName: "Al Fanar Restaurant",
    restaurantName: "Al Fanar Restaurant & Cafe",
    cuisineType: "Arabic • Emirati",
    phone: "501234567",
    address: "Sheikh Zayed Road - Dubai",
    businessLicense: "BL-2024-0001",
    openingHours:
      '{"monday":{"open":"08:00","close":"23:00"},"tuesday":{"open":"08:00","close":"23:00"},"wednesday":{"open":"08:00","close":"23:00"},"thursday":{"open":"08:00","close":"00:00"},"friday":{"open":"13:00","close":"01:00"},"saturday":{"open":"13:00","close":"01:00"},"sunday":{"open":"08:00","close":"23:00"}}',
    latitude: 25.2048,
    longitude: 55.2708,
  },
  {
    email: "pizzaitalia.dxb@mataim.ae",
    password: "Restaurant123!",
    fullName: "Pizza Italia",
    restaurantName: "Pizza Italia",
    cuisineType: "Italian • Pizza",
    phone: "502345678",
    address: "Jumeirah Beach Road - Dubai",
    businessLicense: "BL-2024-0002",
    openingHours:
      '{"monday":{"open":"11:00","close":"23:00"},"tuesday":{"open":"11:00","close":"23:00"},"wednesday":{"open":"11:00","close":"23:00"},"thursday":{"open":"11:00","close":"00:00"},"friday":{"open":"12:00","close":"01:00"},"saturday":{"open":"12:00","close":"01:00"},"sunday":{"open":"11:00","close":"23:00"}}',
    latitude: 25.2148,
    longitude: 55.2508,
  },
  {
    email: "bombayspice.dxb@mataim.ae",
    password: "Restaurant123!",
    fullName: "Bombay Spice",
    restaurantName: "Bombay Spice",
    cuisineType: "Indian • Curry",
    phone: "503456789",
    address: "Karama - Dubai",
    businessLicense: "BL-2024-0003",
    openingHours:
      '{"monday":{"open":"12:00","close":"23:00"},"tuesday":{"open":"12:00","close":"23:00"},"wednesday":{"open":"12:00","close":"23:00"},"thursday":{"open":"12:00","close":"23:30"},"friday":{"open":"13:00","close":"23:30"},"saturday":{"open":"13:00","close":"23:30"},"sunday":{"open":"12:00","close":"23:00"}}',
    latitude: 25.2348,
    longitude: 55.3008,
  },
  {
    email: "sushimaster.dxb@mataim.ae",
    password: "Restaurant123!",
    fullName: "Sushi Master",
    restaurantName: "Sushi Master",
    cuisineType: "Japanese • Sushi",
    phone: "504567890",
    address: "Dubai Mall - Dubai",
    businessLicense: "BL-2024-0004",
    openingHours:
      '{"monday":{"open":"12:00","close":"23:00"},"tuesday":{"open":"12:00","close":"23:00"},"wednesday":{"open":"12:00","close":"23:00"},"thursday":{"open":"12:00","close":"00:00"},"friday":{"open":"13:00","close":"00:00"},"saturday":{"open":"13:00","close":"00:00"},"sunday":{"open":"12:00","close":"23:00"}}',
    latitude: 25.1978,
    longitude: 55.2798,
  },
  {
    email: "burgerhouse.dxb@mataim.ae",
    password: "Restaurant123!",
    fullName: "Burger House",
    restaurantName: "Burger House",
    cuisineType: "American • Burgers",
    phone: "505678901",
    address: "Al Rigga Street - Dubai",
    businessLicense: "BL-2024-0005",
    openingHours:
      '{"monday":{"open":"10:00","close":"02:00"},"tuesday":{"open":"10:00","close":"02:00"},"wednesday":{"open":"10:00","close":"02:00"},"thursday":{"open":"10:00","close":"03:00"},"friday":{"open":"12:00","close":"03:00"},"saturday":{"open":"12:00","close":"03:00"},"sunday":{"open":"10:00","close":"02:00"}}',
    latitude: 25.2678,
    longitude: 55.3208,
  },
  {
    email: "pekinggarden.dxb@mataim.ae",
    password: "Restaurant123!",
    fullName: "Peking Garden",
    restaurantName: "Peking Garden",
    cuisineType: "Chinese • Dim Sum",
    phone: "506789012",
    address: "Deira - Dubai",
    businessLicense: "BL-2024-0006",
    openingHours:
      '{"monday":{"open":"11:30","close":"23:00"},"tuesday":{"open":"11:30","close":"23:00"},"wednesday":{"open":"11:30","close":"23:00"},"thursday":{"open":"11:30","close":"23:30"},"friday":{"open":"12:00","close":"23:30"},"saturday":{"open":"12:00","close":"23:30"},"sunday":{"open":"11:30","close":"23:00"}}',
    latitude: 25.2778,
    longitude: 55.3308,
  },
  {
    email: "lamerseafood.dxb@mataim.ae",
    password: "Restaurant123!",
    fullName: "La Mer Seafood",
    restaurantName: "La Mer Seafood",
    cuisineType: "Seafood • Mediterranean",
    phone: "507890123",
    address: "Jumeirah 1 - La Mer - Dubai",
    businessLicense: "BL-2024-0007",
    openingHours:
      '{"monday":{"open":"12:00","close":"23:00"},"tuesday":{"open":"12:00","close":"23:00"},"wednesday":{"open":"12:00","close":"23:00"},"thursday":{"open":"12:00","close":"00:00"},"friday":{"open":"13:00","close":"00:00"},"saturday":{"open":"13:00","close":"00:00"},"sunday":{"open":"12:00","close":"23:00"}}',
    latitude: 25.2258,
    longitude: 55.2508,
  },
  {
    email: "tandooriflames.dxb@mataim.ae",
    password: "Restaurant123!",
    fullName: "Tandoori Flames",
    restaurantName: "Tandoori Flames",
    cuisineType: "Pakistani • BBQ",
    phone: "508901234",
    address: "Al Nahda - Dubai",
    businessLicense: "BL-2024-0008",
    openingHours:
      '{"monday":{"open":"12:00","close":"00:00"},"tuesday":{"open":"12:00","close":"00:00"},"wednesday":{"open":"12:00","close":"00:00"},"thursday":{"open":"12:00","close":"01:00"},"friday":{"open":"13:00","close":"01:00"},"saturday":{"open":"13:00","close":"01:00"},"sunday":{"open":"12:00","close":"00:00"}}',
    latitude: 25.2978,
    longitude: 55.3908,
  },
  {
    email: "noodlehouse.dxb@mataim.ae",
    password: "Restaurant123!",
    fullName: "Noodle House",
    restaurantName: "Noodle House",
    cuisineType: "Asian • Noodles",
    phone: "509012345",
    address: "Dubai Marina - Dubai",
    businessLicense: "BL-2024-0009",
    openingHours:
      '{"monday":{"open":"11:00","close":"23:00"},"tuesday":{"open":"11:00","close":"23:00"},"wednesday":{"open":"11:00","close":"23:00"},"thursday":{"open":"11:00","close":"00:00"},"friday":{"open":"12:00","close":"00:00"},"saturday":{"open":"12:00","close":"00:00"},"sunday":{"open":"11:00","close":"23:00"}}',
    latitude: 25.0798,
    longitude: 55.1408,
  },
  {
    email: "habibasweets.dxb@mataim.ae",
    password: "Restaurant123!",
    fullName: "Habiba Sweets",
    restaurantName: "Habiba Sweets",
    cuisineType: "Desserts • Bakery",
    phone: "501234568",
    address: "Al Barsha - Dubai",
    businessLicense: "BL-2024-0010",
    openingHours:
      '{"monday":{"open":"08:00","close":"23:00"},"tuesday":{"open":"08:00","close":"23:00"},"wednesday":{"open":"08:00","close":"23:00"},"thursday":{"open":"08:00","close":"23:30"},"friday":{"open":"09:00","close":"23:30"},"saturday":{"open":"09:00","close":"23:30"},"sunday":{"open":"08:00","close":"23:00"}}',
    latitude: 25.1148,
    longitude: 55.1908,
  },
  {
    email: "thaiorchid.dxb@mataim.ae",
    password: "Restaurant123!",
    fullName: "Thai Orchid",
    restaurantName: "Thai Orchid",
    cuisineType: "Thai • Curry",
    phone: "512345678",
    address: "Al Wasl Road - Dubai",
    businessLicense: "BL-2024-0011",
    openingHours:
      '{"monday":{"open":"12:00","close":"23:00"},"tuesday":{"open":"12:00","close":"23:00"},"wednesday":{"open":"12:00","close":"23:00"},"thursday":{"open":"12:00","close":"00:00"},"friday":{"open":"13:00","close":"00:00"},"saturday":{"open":"13:00","close":"00:00"},"sunday":{"open":"12:00","close":"23:00"}}',
    latitude: 25.2348,
    longitude: 55.2608,
  },
  {
    email: "turkishkebab.dxb@mataim.ae",
    password: "Restaurant123!",
    fullName: "Turkish Kebab House",
    restaurantName: "Turkish Kebab House",
    cuisineType: "Turkish • Kebab",
    phone: "523456789",
    address: "Al Rigga - Dubai",
    businessLicense: "BL-2024-0012",
    openingHours:
      '{"monday":{"open":"11:00","close":"02:00"},"tuesday":{"open":"11:00","close":"02:00"},"wednesday":{"open":"11:00","close":"02:00"},"thursday":{"open":"11:00","close":"03:00"},"friday":{"open":"12:00","close":"03:00"},"saturday":{"open":"12:00","close":"03:00"},"sunday":{"open":"11:00","close":"02:00"}}',
    latitude: 25.2678,
    longitude: 55.3258,
  },
  {
    email: "greenleaf.dxb@mataim.ae",
    password: "Restaurant123!",
    fullName: "Green Leaf",
    restaurantName: "Green Leaf",
    cuisineType: "Vegetarian • Vegan",
    phone: "534567890",
    address: "Dubai Silicon Oasis - Dubai",
    businessLicense: "BL-2024-0013",
    openingHours:
      '{"monday":{"open":"09:00","close":"22:00"},"tuesday":{"open":"09:00","close":"22:00"},"wednesday":{"open":"09:00","close":"22:00"},"thursday":{"open":"09:00","close":"23:00"},"friday":{"open":"10:00","close":"23:00"},"saturday":{"open":"10:00","close":"23:00"},"sunday":{"open":"09:00","close":"22:00"}}',
    latitude: 25.1278,
    longitude: 55.4108,
  },
  {
    email: "moroccannights.dxb@mataim.ae",
    password: "Restaurant123!",
    fullName: "Moroccan Nights",
    restaurantName: "Moroccan Nights",
    cuisineType: "Moroccan • Tagine",
    phone: "545678901",
    address: "Al Sufouh - Dubai",
    businessLicense: "BL-2024-0014",
    openingHours:
      '{"monday":{"open":"12:00","close":"23:00"},"tuesday":{"open":"12:00","close":"23:00"},"wednesday":{"open":"12:00","close":"23:00"},"thursday":{"open":"12:00","close":"00:00"},"friday":{"open":"13:00","close":"00:00"},"saturday":{"open":"13:00","close":"00:00"},"sunday":{"open":"12:00","close":"23:00"}}',
    latitude: 25.1458,
    longitude: 55.1708,
  },
  {
    email: "lebanesegrill.dxb@mataim.ae",
    password: "Restaurant123!",
    fullName: "Lebanese Grill",
    restaurantName: "Lebanese Grill",
    cuisineType: "Lebanese • Mezze",
    phone: "556789012",
    address: "Al Mankhool - Dubai",
    businessLicense: "BL-2024-0015",
    openingHours:
      '{"monday":{"open":"11:00","close":"01:00"},"tuesday":{"open":"11:00","close":"01:00"},"wednesday":{"open":"11:00","close":"01:00"},"thursday":{"open":"11:00","close":"02:00"},"friday":{"open":"12:00","close":"02:00"},"saturday":{"open":"12:00","close":"02:00"},"sunday":{"open":"11:00","close":"01:00"}}',
    latitude: 25.2578,
    longitude: 55.3108,
  },
  {
    email: "cafesupreme.dxb@mataim.ae",
    password: "Restaurant123!",
    fullName: "Cafe Supreme",
    restaurantName: "Cafe Supreme",
    cuisineType: "Cafe • Breakfast",
    phone: "567890123",
    address: "Downtown - Dubai",
    businessLicense: "BL-2024-0016",
    openingHours:
      '{"monday":{"open":"07:00","close":"22:00"},"tuesday":{"open":"07:00","close":"22:00"},"wednesday":{"open":"07:00","close":"22:00"},"thursday":{"open":"07:00","close":"23:00"},"friday":{"open":"08:00","close":"23:00"},"saturday":{"open":"08:00","close":"23:00"},"sunday":{"open":"07:00","close":"22:00"}}',
    latitude: 25.1948,
    longitude: 55.2808,
  },
];

export default function BulkCreateScreen() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [completed, setCompleted] = useState(false);

  const createAll = async () => {
    setLoading(true);
    const resultsArray = [];

    for (let i = 0; i < restaurants.length; i++) {
      const r = restaurants[i];
      setCurrentIndex(i + 1);

      try {
        const result = await signUp(r.email, r.password, {
          userType: "restaurant",
          fullName: r.fullName,
          phone: r.phone,
          countryCode: "+971",
          address: r.address,
          latitude: r.latitude,
          longitude: r.longitude,
          restaurantName: r.restaurantName,
          cuisineType: r.cuisineType,
          businessLicense: r.businessLicense,
          openingHours: r.openingHours,
        });

        resultsArray.push({
          email: r.email,
          success: true,
          message: "Created successfully",
        });
      } catch (error: any) {
        console.error(`Failed to create ${r.email}:`, error);
        resultsArray.push({
          email: r.email,
          success: false,
          error: error.message || "Unknown error",
        });
      }

      // Update results progressively
      setResults([...resultsArray]);

      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    setCompleted(true);
    setLoading(false);
  };

  const startOver = () => {
    setResults([]);
    setCurrentIndex(0);
    setCompleted(false);
    createAll();
  };

  useEffect(() => {
    createAll();
  }, []);

  const getSuccessCount = () => results.filter((r) => r.success).length;
  const getFailureCount = () => results.filter((r) => !r.success).length;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bulk Create Restaurants</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.statsCard}>
          <Text style={styles.statsTitle}>Progress</Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                {currentIndex}/{restaurants.length}
              </Text>
              <Text style={styles.statLabel}>Processed</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: "#10B981" }]}>
                {getSuccessCount()}
              </Text>
              <Text style={styles.statLabel}>Success</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: "#EF4444" }]}>
                {getFailureCount()}
              </Text>
              <Text style={styles.statLabel}>Failed</Text>
            </View>
          </View>

          {loading && (
            <View style={styles.progressContainer}>
              <ActivityIndicator size="large" color="#FF6B35" />
              <Text style={styles.progressText}>
                Creating restaurants... {currentIndex}/{restaurants.length}
              </Text>
            </View>
          )}
        </View>

        {completed && (
          <View style={styles.completedCard}>
            <Ionicons
              name={
                getFailureCount() === 0
                  ? "checkmark-circle"
                  : "information-circle"
              }
              size={40}
              color={getFailureCount() === 0 ? "#10B981" : "#F59E0B"}
            />
            <Text style={styles.completedTitle}>
              {getFailureCount() === 0
                ? "All Restaurants Created!"
                : "Process Completed with Errors"}
            </Text>
            <Text style={styles.completedText}>
              {getSuccessCount()} successful, {getFailureCount()} failed
            </Text>

            <View style={styles.completedButtons}>
              <TouchableOpacity
                style={[styles.button, styles.retryButton]}
                onPress={startOver}
              >
                <Text style={styles.retryButtonText}>Retry Failed</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.doneButton]}
                onPress={() => router.back()}
              >
                <Text style={styles.doneButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={styles.resultsCard}>
          <Text style={styles.resultsTitle}>Results</Text>

          {results.map((result, index) => (
            <View
              key={index}
              style={[
                styles.resultItem,
                result.success ? styles.successItem : styles.errorItem,
              ]}
            >
              <View style={styles.resultHeader}>
                <Text style={styles.resultEmail} numberOfLines={1}>
                  {result.email}
                </Text>
                {result.success ? (
                  <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                ) : (
                  <Ionicons name="close-circle" size={20} color="#EF4444" />
                )}
              </View>

              {!result.success && result.error && (
                <Text style={styles.errorMessage} numberOfLines={2}>
                  Error: {result.error}
                </Text>
              )}
            </View>
          ))}

          {results.length === 0 && !loading && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No results yet</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  statsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 20,
  },
  statItem: {
    alignItems: "center",
  },
  statNumber: {
    fontSize: 24,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "500",
  },
  progressContainer: {
    alignItems: "center",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  progressText: {
    marginTop: 12,
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "500",
  },
  completedCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 24,
    marginBottom: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  completedTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginTop: 12,
    marginBottom: 4,
  },
  completedText: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 20,
  },
  completedButtons: {
    flexDirection: "row",
    gap: 12,
  },
  button: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 100,
    alignItems: "center",
  },
  retryButton: {
    backgroundColor: "#FF6B35",
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  doneButton: {
    backgroundColor: "#F3F4F6",
  },
  doneButtonText: {
    color: "#374151",
    fontSize: 14,
    fontWeight: "600",
  },
  resultsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  resultsTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 16,
  },
  resultItem: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
  },
  successItem: {
    backgroundColor: "#F0FDF4",
    borderColor: "#DCFCE7",
  },
  errorItem: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FEE2E2",
  },
  resultHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  resultEmail: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
    color: "#111827",
    marginRight: 8,
  },
  errorMessage: {
    fontSize: 12,
    color: "#EF4444",
    marginTop: 4,
  },
  emptyState: {
    padding: 32,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    color: "#9CA3AF",
  },
});
