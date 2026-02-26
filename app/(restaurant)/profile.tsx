// app/(restaurant)/profile.tsx - Updated with debugging
import { useAuth } from "@/backend/AuthContext";
import { supabase } from "@/backend/supabase";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";

const PROFILE_MENU_ITEMS = [
  {
    icon: "restaurant-outline",
    title: "Restaurant Information",
    description: "Update your restaurant details",
    screen: "/(restaurant)/settings",
  },
  {
    icon: "book-outline",
    title: "Menu Management",
    description: "Manage your menu items",
    screen: "/(restaurant)/menu",
  },
  {
    icon: "receipt-outline",
    title: "Orders & Reservations",
    description: "View and manage orders",
    screen: "/(restaurant)/orders",
  },
  {
    icon: "time-outline",
    title: "Business Hours",
    description: "Set your operating hours",
    screen: "/(restaurant)/hours",
  },
  {
    icon: "navigate-outline",
    title: "Delivery Settings",
    description: "Configure delivery options",
    screen: "/(restaurant)/delivery",
  },
  {
    icon: "analytics-outline",
    title: "Analytics & Reports",
    description: "View business insights",
    screen: "/(restaurant)/analytics/analytics",
  },
  {
    icon: "card-outline",
    title: "Payment Setup",
    description: "Configure payment methods",
    screen: "/(restaurant)/payments",
  },
  {
    icon: "notifications-outline",
    title: "Notifications",
    description: "Manage order notifications",
    screen: "/(restaurant)/notifications/restaurant_notifications",
  },
  {
    icon: "chatbox-ellipses-outline",
    title: "Messages",
    description: "View and respond to messages",
    screen: "/(restaurant)/messages",
  },
];

export default function RestaurantProfileScreen() {
  const router = useRouter();
  const {
    user,
    profile,
    signOut,
    refreshUserData,
    checkRestaurantSetupComplete,
  } = useAuth();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [profileCompletion, setProfileCompletion] = useState(0);
  const [debugInfo, setDebugInfo] = useState("");

  useEffect(() => {
    const checkSetupComplete = async () => {
      if (user?.id && user?.user_type === "restaurant") {
        const isComplete = await checkRestaurantSetupComplete(user.id);
        console.log("🔍 Profile setup check:", { isComplete, userId: user.id });

        if (!isComplete) {
          router.push({
            pathname: "/(restaurant)/setup",
            params: { userId: user.id },
          });
        } else {
          calculateProfileCompletion();
          checkRestaurantData();
        }
      }
    };

    checkSetupComplete();
  }, [user]);
  const checkRestaurantData = async () => {
    if (!user?.id) return;

    try {
      // Directly check restaurants table and include image_url
      const { data, error } = await supabase
        .from("restaurants")
        .select("restaurant_name, image_url")
        .eq("id", user.id)
        .single();

      console.log("🔍 Direct restaurant table check:", {
        found: !!data,
        error: error?.message,
        restaurantName: data?.restaurant_name,
        image_url: data?.image_url,
        userId: user.id,
      });

      // If we have an image_url but user object doesn't have it, refresh data
      if (data?.image_url && !user.image_url && refreshUserData) {
        console.log("🔄 Refreshing user data to get image_url");
        await refreshUserData();
      }

      setDebugInfo(`
      User ID: ${user.id}
      User Type: ${user.user_type}
      Has restaurant_name in user object: ${!!user.restaurant_name}
      Has image_url in user object: ${!!user.image_url}
      Direct DB check: ${data ? "Found" : "Not found"}
      Restaurant Name in DB: ${data?.restaurant_name || "N/A"}
      Image URL in DB: ${data?.image_url || "N/A"}
      Error: ${error?.message || "None"}
    `);
    } catch (error) {
      console.error("Error checking restaurant data:", error);
    }
  };

  const calculateProfileCompletion = async () => {
    if (!user?.id) return;

    try {
      // Get restaurant data directly
      const { data: restaurantData } = await supabase
        .from("restaurants")
        .select(
          "restaurant_name, cuisine_type, address, opening_hours, business_license",
        )
        .eq("id", user.id)
        .single();

      if (!restaurantData) {
        setProfileCompletion(0);
        return;
      }

      const requiredFields = [
        restaurantData.restaurant_name,
        restaurantData.cuisine_type,
        restaurantData.address,
        restaurantData.opening_hours,
        restaurantData.business_license,
      ];

      let completedCount = 0;
      requiredFields.forEach((field) => {
        if (field && String(field).trim().length > 0) {
          completedCount++;
        }
      });

      const completionPercentage = Math.round(
        (completedCount / requiredFields.length) * 100,
      );
      setProfileCompletion(completionPercentage);
    } catch (error) {
      console.error("Error calculating profile completion:", error);
      setProfileCompletion(0);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    if (refreshUserData) {
      await refreshUserData();
    }
    setRefreshing(false);
  };

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          try {
            await signOut();
            router.replace("/(auth)/signin");
          } catch (error) {
            console.error("Error during sign out:", error);
          }
        },
      },
    ]);
  };

  const getInitials = (name: string) => {
    return (
      name
        ?.split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase() || "R"
    );
  };

  // Debug button
  const handleDebug = async () => {
    console.log("🔄 DEBUG: Current user data:", {
      id: user?.id,
      email: user?.email,
      user_type: user?.user_type,
      restaurant_name: user?.restaurant_name,
      full_user_object: user,
    });

    // Refresh user data
    if (refreshUserData) {
      await refreshUserData();
      Alert.alert("Debug", "User data refreshed. Check console for details.");
    }
  };

  // Check if user is restaurant
  if (!user || user.user_type !== "restaurant") {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Restaurant Profile</Text>
        </View>
        <View style={styles.setupContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#EF4444" />
          <Text style={styles.setupTitle}>Restaurant Account Required</Text>
          <Text style={styles.setupDescription}>
            This screen is only available for restaurant accounts
          </Text>
          <Text style={styles.debugText}>
            Current user type: {user?.user_type || "Not logged in"}
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

  // Check if restaurant data exists
  if (!user.restaurant_name) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Restaurant Profile</Text>
          <TouchableOpacity onPress={handleDebug}>
            <Ionicons name="bug-outline" size={20} color="#666" />
          </TouchableOpacity>
        </View>
        <View style={styles.setupContainer}>
          <Ionicons name="restaurant-outline" size={64} color="#FF6B35" />
          <Text style={styles.setupTitle}>
            Complete Your Restaurant Profile
          </Text>
          <Text style={styles.setupDescription}>
            You need to complete your restaurant profile setup to access all
            features
          </Text>

          <Text style={styles.debugText}>
            Debug Info:{"\n"}
            User ID: {user?.id}
            {"\n"}
            User Type: {user?.user_type}
            {"\n"}
            Has restaurant_name: {user?.restaurant_name ? "Yes" : "No"}
          </Text>

          <TouchableOpacity
            style={styles.setupButton}
            onPress={() =>
              router.push({
                pathname: "/(restaurant)/setup",
                params: { userId: user?.id },
              })
            }
          >
            <Text style={styles.setupButtonText}>Complete Profile</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.debugButton} onPress={handleDebug}>
            <Text style={styles.debugButtonText}>Debug Refresh</Text>
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
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Profile</Text>
          {profileCompletion < 100 && (
            <View style={styles.profileCompletionBadge}>
              <Text style={styles.profileCompletionText}>
                {profileCompletion}% Complete
              </Text>
            </View>
          )}
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.completeProfileButton}
            onPress={() =>
              router.push({
                pathname: "/(restaurant)/setup",
                params: { userId: user?.id },
              })
            }
          >
            <Ionicons name="construct-outline" size={18} color="#FF6B35" />
            <Text style={styles.completeProfileButtonText}>
              Complete Profile
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Add Message Button - Absolutely positioned */}
      <TouchableOpacity
        style={styles.absoluteMessageButton}
        onPress={() => router.push("/(restaurant)/messages")}
        activeOpacity={0.8}
      >
        <View style={styles.messageButtonInner}>
          <Ionicons name="chatbubble-ellipses" size={24} color="#fff" />
        </View>
      </TouchableOpacity>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#FF6B35"
          />
        }
      >
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            {user?.image_url ? (
              <Image
                source={{ uri: user.image_url }}
                style={styles.profileImage}
                onError={(e) =>
                  console.log("Image error:", e.nativeEvent.error)
                }
              />
            ) : profile?.avatar_url ? (
              <Image
                source={{ uri: profile.avatar_url }}
                style={styles.profileImage}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitials}>
                  {getInitials(user?.restaurant_name || "Restaurant")}
                </Text>
              </View>
            )}
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark-circle" size={16} color="#10B981" />
            </View>
          </View>

          <View style={styles.profileInfo}>
            <View style={styles.nameContainer}>
              <Text style={styles.restaurantName}>
                {user?.restaurant_name || "Restaurant"}
              </Text>
              <View style={styles.restaurantTypeBadge}>
                <Text style={styles.restaurantTypeText}>Restaurant</Text>
              </View>
            </View>

            {user?.cuisine_type && (
              <View style={styles.cuisineContainer}>
                <Ionicons name="restaurant-outline" size={14} color="#6B7280" />
                <Text style={styles.cuisineText}>{user.cuisine_type}</Text>
              </View>
            )}

            <View style={styles.contactInfo}>
              <Ionicons name="mail-outline" size={14} color="#6B7280" />
              <Text style={styles.contactText}>
                {user?.email || "No email"}
              </Text>
            </View>

            {user?.phone && (
              <View style={styles.contactInfo}>
                <Ionicons name="call-outline" size={14} color="#6B7280" />
                <Text style={styles.contactText}>{user?.phone}</Text>
              </View>
            )}

            {user?.address && (
              <View style={styles.contactInfo}>
                <Ionicons name="location-outline" size={14} color="#6B7280" />
                <Text style={styles.contactText}>{user.address}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Profile Completion Progress Bar */}
        {profileCompletion < 100 && (
          <View style={styles.progressCard}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressTitle}>Profile Completion</Text>
              <Text style={styles.progressPercentage}>
                {profileCompletion}%
              </Text>
            </View>
            <View style={styles.progressBarContainer}>
              <View style={styles.progressBarBackground}>
                <View
                  style={[
                    styles.progressBarFill,
                    { width: `${profileCompletion}%` },
                  ]}
                />
              </View>
            </View>
            <Text style={styles.progressText}>
              Complete your profile to unlock all features and improve customer
              trust.
            </Text>
          </View>
        )}

        {/* Restaurant Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{user?.total_orders || 0}</Text>
            <Text style={styles.statLabel}>Total Orders</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>
              {user?.restaurant_rating?.toFixed(1) || "0.0"}
            </Text>
            <Text style={styles.statLabel}>Rating</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>
              {user?.has_delivery ? "Yes" : "No"}
            </Text>
            <Text style={styles.statLabel}>Delivery</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>
              {user?.has_pickup ? "Yes" : "No"}
            </Text>
            <Text style={styles.statLabel}>Pickup</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push("/(restaurant)/posts/create")}
            >
              <Ionicons name="add-circle" size={20} color="#10B981" />
              <Text style={styles.actionText}>New Post</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push("/(restaurant)/menu/create")}
            >
              <Ionicons name="fast-food" size={20} color="#10B981" />
              <Text style={styles.actionText}>Add Item</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push("/(restaurant)/orders")}
            >
              <Ionicons name="receipt" size={20} color="#10B981" />
              <Text style={styles.actionText}>View Orders</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push("/(restaurant)/analytics/analytics")}
            >
              <MaterialCommunityIcons
                name="chart-line"
                size={20}
                color="#10B981"
              />
              <Text style={styles.actionText}>Analytics</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Menu Items */}
        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle} top={6} left={8}>
            Restaurant Settings
          </Text>
          {PROFILE_MENU_ITEMS.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.menuItem}
              onPress={() => router.push(item.screen as any)}
            >
              <View style={styles.menuIcon}>
                <Ionicons name={item.icon as any} size={18} color="#10B981" />
              </View>
              <View style={styles.menuContent}>
                <Text style={styles.menuTitle}>{item.title}</Text>
                <Text style={styles.menuDescription}>{item.description}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
            </TouchableOpacity>
          ))}
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={18} color="#EF4444" />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    paddingBottom: -22,
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
  setupContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  setupTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginTop: 16,
    marginBottom: 8,
    textAlign: "center",
  },
  setupDescription: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
  },
  debugText: {
    fontSize: 12,
    color: "#666",
    textAlign: "center",
    marginVertical: 10,
    backgroundColor: "#f0f0f0",
    padding: 10,
    borderRadius: 8,
  },
  setupButton: {
    backgroundColor: "#FF6B35",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  setupButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  debugButton: {
    backgroundColor: "#666",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  debugButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  backButton: {
    backgroundColor: "#6B7280",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  backButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
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
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  profileCompletionBadge: {
    backgroundColor: "#FF6B35",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  profileCompletionText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  completeProfileButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FF6B3510",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#FF6B3520",
    gap: 4,
  },
  completeProfileButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FF6B35",
  },
  settingsButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F9FAFB",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FFFFFF",
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  avatarContainer: {
    position: "relative",
    marginRight: 12,
  },
  profileImage: {
    width: 70,
    height: 70,
    borderRadius: 35,
  },
  avatarPlaceholder: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#10B981",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInitials: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
  },
  verifiedBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 2,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  profileInfo: {
    flex: 1,
    marginTop: 2,
  },
  nameContainer: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: 6,
  },
  restaurantName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginRight: 8,
  },
  restaurantTypeBadge: {
    backgroundColor: "#10B981",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  restaurantTypeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "600",
  },
  cuisineContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  cuisineText: {
    fontSize: 12,
    color: "#6B7280",
    marginLeft: 4,
    fontWeight: "500",
  },
  contactInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  contactText: {
    fontSize: 12,
    color: "#6B7280",
    marginLeft: 4,
    fontWeight: "400",
  },
  editButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F9FAFB",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  progressCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  progressTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  progressPercentage: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FF6B35",
  },
  progressBarContainer: {
    marginBottom: 12,
  },
  progressBarBackground: {
    height: 6,
    backgroundColor: "#F3F4F6",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#FF6B35",
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: "#6B7280",
    lineHeight: 16,
    marginBottom: 12,
  },
  progressButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FF6B3510",
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: "#FF6B3520",
  },
  progressButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FF6B35",
  },
  statsContainer: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statNumber: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    color: "#6B7280",
    textAlign: "center",
    fontWeight: "500",
    letterSpacing: -0.2,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: "#E5E7EB",
  },
  quickActions: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
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
  actionButton: {
    width: "48%",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    padding: 12,
    borderRadius: 10,
    borderWidth: 0.6,
    borderColor: "#E5E7EB",
  },
  disabledButton: {
    opacity: 0.5,
  },
  actionText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#374151",
    marginTop: 4,
  },
  disabledText: {
    color: "#9CA3AF",
  },
  menuSection: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  disabledMenuItem: {
    opacity: 0.6,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  menuContent: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 2,
  },
  menuDescription: {
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "400",
  },
  supportSection: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  supportItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  supportText: {
    flex: 1,
    fontSize: 12,
    color: "#374151",
    marginLeft: 10,
    fontWeight: "500",
  },
  signOutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#EF4444",
    gap: 6,
  },
  signOutText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#EF4444",
  },
  footer: {
    alignItems: "center",
    padding: 16,
  },
  versionText: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 2,
    fontWeight: "500",
  },
  copyrightText: {
    fontSize: 10,
    color: "#9CA3AF",
  },

  absoluteMessageButton: {
    position: "absolute",
    bottom: 45, // Adjust based on your tab bar height
    right: 20,
    zIndex: 999,
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },

  messageButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#10B981",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#fff",
  },
});
