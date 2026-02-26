import { useGuestAction } from "@/backend/hooks/useGuestAction";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../backend/AuthContext";
import { supabase } from "../../backend/supabase";
import { GuestProfileBanner } from "../components/GuestProfileBanner";

const PROFILE_MENU_ITEMS = {
  customer: [
    {
      icon: "person-outline",
      title: "Personal Information",
      description: "Update your profile details",
      screen: "/profile/personal-info",
    },
    {
      icon: "location-outline",
      title: "Addresses",
      description: "Manage your delivery addresses",
      screen: "./addresses",
    },
    {
      icon: "fast-food-outline",
      title: "Favorite Restaurants",
      description: "Your favorite dining spots",
      screen: "/profile/favorites",
    },
    {
      icon: "receipt-outline",
      title: "Order History",
      description: "View your past orders",
      screen: "/profile/orders",
    },
    {
      icon: "card-outline",
      title: "Payment Methods",
      description: "Add or remove payment cards",
      screen: "/profile/payments",
    },
    {
      icon: "gift-outline",
      title: "Loyalty Points",
      description: "Check your rewards and points",
      screen: "/profile/loyalty",
    },
    {
      icon: "notifications-outline",
      title: "Notifications",
      description: "Manage your notification preferences",
      screen: "/profile/notifications",
    },
    {
      icon: "shield-checkmark-outline",
      title: "Privacy & Security",
      description: "Control your privacy settings",
      screen: "/profile/privacy",
    },
  ],
  restaurant: [
    {
      icon: "restaurant-outline",
      title: "Restaurant Information",
      description: "Update your restaurant details",
      screen: "/restaurant/profile",
    },
    {
      icon: "book-outline",
      title: "Menu Management",
      description: "Manage your menu items",
      screen: "/restaurant/menu",
    },
    {
      icon: "receipt-outline",
      title: "Orders & Reservations",
      description: "View and manage orders",
      screen: "/restaurant/orders",
    },
    {
      icon: "time-outline",
      title: "Business Hours",
      description: "Set your operating hours",
      screen: "/restaurant/hours",
    },
    {
      icon: "navigate-outline",
      title: "Delivery Settings",
      description: "Configure delivery options",
      screen: "/restaurant/delivery",
    },
    {
      icon: "analytics-outline",
      title: "Analytics & Reports",
      description: "View business insights",
      screen: "/restaurant/analytics",
    },
    {
      icon: "card-outline",
      title: "Payment Setup",
      description: "Configure payment methods",
      screen: "/restaurant/payments",
    },
    {
      icon: "notifications-outline",
      title: "Notifications",
      description: "Manage order notifications",
      screen: "/restaurant/notifications",
    },
  ],
  driver: [
    {
      icon: "person-outline",
      title: "Driver Profile",
      description: "Update your driver information",
      screen: "/driver/profile",
    },
    {
      icon: "car-outline",
      title: "Vehicle Information",
      description: "Update vehicle details",
      screen: "/driver/vehicle",
    },
    {
      icon: "navigate-outline",
      title: "Delivery Areas",
      description: "Set your delivery zones",
      screen: "/driver/areas",
    },
    {
      icon: "time-outline",
      title: "Availability",
      description: "Set your working hours",
      screen: "/driver/availability",
    },
    {
      icon: "receipt-outline",
      title: "Delivery History",
      description: "View your past deliveries",
      screen: "/driver/history",
    },
    {
      icon: "cash-outline",
      title: "Earnings & Payouts",
      description: "Track your earnings",
      screen: "/driver/earnings",
    },
    {
      icon: "trending-up-outline",
      title: "Performance",
      description: "View your ratings and stats",
      screen: "/driver/performance",
    },
    {
      icon: "notifications-outline",
      title: "Notifications",
      description: "Manage delivery notifications",
      screen: "/driver/notifications",
    },
  ],
};

export default function ProfileScreen() {
  const router = useRouter();
  const { user, profile, signOut } = useAuth();
  const [userStats, setUserStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [profileImage, setProfileImage] = useState(null);

  // Inside the component
  const { checkGuestAction, isGuest } = useGuestAction();

  useEffect(() => {
    fetchUserStats();
    loadProfileImage();
  }, [user]);

  const fetchUserStats = async () => {
    if (!user?.id) return;

    try {
      setLoadingStats(true);

      switch (user.user_type) {
        case "customer":
          const { data: customerData } = await supabase
            .from("customers")
            .select("total_orders, loyalty_points, favorite_cuisines")
            .eq("id", user.id)
            .single();

          // Fetch addresses count
          const { count: addressesCount } = await supabase
            .from("addresses")
            .select("*", { count: "exact", head: true })
            .eq("user_id", user.id);

          setUserStats({
            orders: customerData?.total_orders || 0,
            points: customerData?.loyalty_points || 0,
            addresses: addressesCount || 0,
            favorites: customerData?.favorite_cuisines?.length || 0,
          });
          break;

        case "restaurant":
          const { data: restaurantData } = await supabase
            .from("restaurants")
            .select(
              "total_orders, restaurant_rating, capacity, delivery_radius",
            )
            .eq("id", user.id)
            .single();

          // Fetch menu items count
          const { count: menuItemsCount } = await supabase
            .from("menu_items")
            .select("*", { count: "exact", head: true })
            .eq("restaurant_id", user.id);

          setUserStats({
            orders: restaurantData?.total_orders || 0,
            rating: restaurantData?.restaurant_rating || 0.0,
            capacity: restaurantData?.capacity || 0,
            menuItems: menuItemsCount || 0,
            deliveryRadius: restaurantData?.delivery_radius || 0,
          });
          break;

        case "driver":
          const { data: driverData } = await supabase
            .from("delivery_users")
            .select(
              "total_deliveries, rating, total_earnings, is_online, driver_status",
            )
            .eq("id", user.id)
            .single();

          setUserStats({
            deliveries: driverData?.total_deliveries || 0,
            rating: driverData?.rating || 0.0,
            earnings: driverData?.total_earnings || 0,
            isOnline: driverData?.is_online || false,
            status: driverData?.driver_status || "offline",
          });
          break;

        default:
          setUserStats({
            orders: 0,
            rating: 0,
            addresses: 0,
          });
      }
    } catch (error) {
      console.error("Error fetching user stats:", error);
    } finally {
      setLoadingStats(false);
    }
  };

  const loadProfileImage = async () => {
    if (user?.profile_image_url) {
      setProfileImage(user.profile_image_url);
    }
  };

  // Update all action handlers
  const handleMenuItemPress = (screen: string) => {
    checkGuestAction("view this section", () => {
      router.push(screen as any);
    });
  };

  const handleSignOut = () => {
    if (isGuest) {
      // For guest, just clear guest mode and go to auth
      Alert.alert(
        "Exit Guest Mode",
        "Are you sure you want to exit guest mode?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Exit",
            onPress: async () => {
              await signOut();
              router.replace("/(auth)");
            },
          },
        ],
      );
      return;
    }

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

  const handleEditProfile = () => {
    const editScreen =
      user?.user_type === "restaurant"
        ? "/restaurant/edit-profile"
        : user?.user_type === "driver"
          ? "/driver/edit-profile"
          : "/profiles/edit";

    router.push(editScreen);
  };

  const getInitials = (name) => {
    return (
      name
        ?.split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase() || "U"
    );
  };

  const getUserDisplayName = () => {
    if (user?.user_type === "restaurant") {
      return user?.restaurant_name || user?.full_name || "Restaurant";
    }
    return user?.full_name || "User";
  };

  const getUserTypeDisplay = () => {
    switch (user?.user_type) {
      case "customer":
        return "Customer Account";
      case "restaurant":
        return "Restaurant Account";
      case "driver":
        return "Delivery Partner";
      default:
        return "Account";
    }
  };

  const getUserTypeColor = () => {
    switch (user?.user_type) {
      case "customer":
        return "#FF6B35";
      case "restaurant":
        return "#10B981";
      case "driver":
        return "#3B82F6";
      default:
        return "#FF6B35";
    }
  };

  const renderCustomerStats = () => (
    <>
      <View style={styles.statItem}>
        <Text style={styles.statNumber}>{userStats?.orders || 0}</Text>
        <Text style={styles.statLabel}>Orders</Text>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.statItem}>
        <Text style={styles.statNumber}>{userStats?.points || 0}</Text>
        <Text style={styles.statLabel}>Points</Text>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.statItem}>
        <Text style={styles.statNumber}>{userStats?.addresses || 0}</Text>
        <Text style={styles.statLabel}>Addresses</Text>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.statItem}>
        <Text style={styles.statNumber}>{userStats?.favorites || 0}</Text>
        <Text style={styles.statLabel}>Favorites</Text>
      </View>
    </>
  );

  const renderRestaurantStats = () => (
    <>
      <View style={styles.statItem}>
        <Text style={styles.statNumber}>{userStats?.orders || 0}</Text>
        <Text style={styles.statLabel}>Orders</Text>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.statItem}>
        <Text style={styles.statNumber}>{userStats?.rating || 0.0}</Text>
        <Text style={styles.statLabel}>Rating</Text>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.statItem}>
        <Text style={styles.statNumber}>{userStats?.menuItems || 0}</Text>
        <Text style={styles.statLabel}>Menu Items</Text>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.statItem}>
        <Text style={styles.statNumber}>{userStats?.capacity || 0}</Text>
        <Text style={styles.statLabel}>Capacity</Text>
      </View>
    </>
  );

  const renderDriverStats = () => (
    <>
      <View style={styles.statItem}>
        <Text style={styles.statNumber}>{userStats?.deliveries || 0}</Text>
        <Text style={styles.statLabel}>Deliveries</Text>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.statItem}>
        <Text style={styles.statNumber}>{userStats?.rating || 0.0}</Text>
        <Text style={styles.statLabel}>Rating</Text>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.statItem}>
        <Text style={styles.statNumber}>AED {userStats?.earnings || 0}</Text>
        <Text style={styles.statLabel}>Earnings</Text>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.statItem}>
        <View
          style={[
            styles.statusIndicator,
            { backgroundColor: userStats?.isOnline ? "#10B981" : "#FF6B35" },
          ]}
        />
        <Text style={styles.statLabel}>
          {userStats?.isOnline ? "Online" : "Offline"}
        </Text>
      </View>
    </>
  );

  const renderStats = () => {
    if (loadingStats) {
      return (
        <View style={styles.statsContainer}>
          <ActivityIndicator size="small" color={getUserTypeColor()} />
          <Text style={styles.loadingText}>Loading stats...</Text>
        </View>
      );
    }

    return (
      <View style={styles.statsContainer}>
        {user?.user_type === "customer" && renderCustomerStats()}
        {user?.user_type === "restaurant" && renderRestaurantStats()}
        {user?.user_type === "driver" && renderDriverStats()}
      </View>
    );
  };

  const getMenuItems = () => {
    return (
      PROFILE_MENU_ITEMS[user?.user_type || "customer"] ||
      PROFILE_MENU_ITEMS.customer
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => router.push("/profile/settings")}
        >
          <Ionicons name="settings-outline" size={18} color="#374151" />
        </TouchableOpacity>
      </View>
      {isGuest && <GuestProfileBanner />}

      {/* Add Message Button - Absolutely positioned */}
      <TouchableOpacity
        style={styles.absoluteMessageButton}
        onPress={() => router.push("/(tabs)/messages")}
        activeOpacity={0.8}
      >
        <View style={styles.messageButtonInner}>
          <Ionicons name="chatbubble-ellipses" size={24} color="#fff" />
          <View style={styles.messageBadge}>
            <Text style={styles.messageBadgeText}>3</Text>
          </View>
        </View>
      </TouchableOpacity>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Profile Card */}
        <View
          style={[styles.profileCard, { borderLeftColor: getUserTypeColor() }]}
        >
          <View style={styles.avatarContainer}>
            {profileImage ? (
              <Image
                source={{ uri: profileImage }}
                style={styles.profileImage}
              />
            ) : (
              <View
                style={[
                  styles.avatarPlaceholder,
                  { backgroundColor: getUserTypeColor() },
                ]}
              >
                <Text style={styles.avatarInitials}>
                  {getInitials(getUserDisplayName())}
                </Text>
              </View>
            )}
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark-circle" size={14} color="#10B981" />
            </View>
          </View>

          <View style={styles.profileInfo}>
            <View style={styles.nameContainer}>
              <Text style={styles.userName}>{getUserDisplayName()}</Text>
              <View
                style={[
                  styles.userTypeBadge,
                  { backgroundColor: getUserTypeColor() },
                ]}
              >
                <Text style={styles.userTypeBadgeText}>
                  {getUserTypeDisplay()}
                </Text>
              </View>
            </View>

            <View style={styles.contactInfo}>
              <Ionicons name="mail-outline" size={12} color="#6B7280" />
              <Text style={styles.userEmail}>{user?.email}</Text>
            </View>

            {user?.phone && (
              <View style={styles.contactInfo}>
                <Ionicons name="call-outline" size={12} color="#6B7280" />
                <Text style={styles.userPhone}>{user?.phone}</Text>
              </View>
            )}

            {user?.user_type === "restaurant" && user?.cuisine_type && (
              <View style={styles.contactInfo}>
                <Ionicons name="restaurant-outline" size={12} color="#6B7280" />
                <Text style={styles.cuisineType}>{user.cuisine_type}</Text>
              </View>
            )}

            {user?.user_type === "driver" && user?.vehicle_type && (
              <View style={styles.contactInfo}>
                <MaterialCommunityIcons name="car" size={12} color="#6B7280" />
                <Text style={styles.vehicleType}>{user.vehicle_type}</Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            style={styles.editButton}
            onPress={handleEditProfile}
          >
            <Ionicons
              name="pencil-outline"
              size={16}
              color={getUserTypeColor()}
            />
          </TouchableOpacity>
        </View>

        {/* Stats Section */}
        {renderStats()}

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            {user?.user_type === "customer" && (
              <>
                <TouchableOpacity style={styles.actionButton}>
                  <Ionicons name="heart-outline" size={18} color="#FF6B35" />
                  <Text style={styles.actionText}>Favorites</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton}>
                  <Ionicons name="bag-outline" size={18} color="#FF6B35" />
                  <Text style={styles.actionText}>Orders</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton}>
                  <Ionicons name="location-outline" size={18} color="#FF6B35" />
                  <Text style={styles.actionText}>Addresses</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton}>
                  <Ionicons name="card-outline" size={18} color="#FF6B35" />
                  <Text style={styles.actionText}>Payments</Text>
                </TouchableOpacity>
              </>
            )}
            {user?.user_type === "restaurant" && (
              <>
                <TouchableOpacity style={styles.actionButton}>
                  <Ionicons
                    name="restaurant-outline"
                    size={18}
                    color="#10B981"
                  />
                  <Text style={styles.actionText}>Menu</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton}>
                  <Ionicons name="receipt-outline" size={18} color="#10B981" />
                  <Text style={styles.actionText}>Orders</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton}>
                  <Ionicons
                    name="analytics-outline"
                    size={18}
                    color="#10B981"
                  />
                  <Text style={styles.actionText}>Analytics</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton}>
                  <Ionicons name="time-outline" size={18} color="#10B981" />
                  <Text style={styles.actionText}>Hours</Text>
                </TouchableOpacity>
              </>
            )}
            {user?.user_type === "driver" && (
              <>
                <TouchableOpacity style={styles.actionButton}>
                  <Ionicons name="navigate-outline" size={18} color="#3B82F6" />
                  <Text style={styles.actionText}>Deliveries</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton}>
                  <Ionicons name="cash-outline" size={18} color="#3B82F6" />
                  <Text style={styles.actionText}>Earnings</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton}>
                  <Ionicons name="car-outline" size={18} color="#3B82F6" />
                  <Text style={styles.actionText}>Vehicle</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton}>
                  <Ionicons name="time-outline" size={18} color="#3B82F6" />
                  <Text style={styles.actionText}>Availability</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {/* Menu Items */}
        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle} top={12} left={12}>
            Account Settings
          </Text>
          {getMenuItems().map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.menuItem}
              onPress={() => router.push(item.screen as any)}
            >
              <View
                style={[
                  styles.menuIcon,
                  { backgroundColor: `${getUserTypeColor()}15` },
                ]}
              >
                <Ionicons
                  name={item.icon as any}
                  size={18}
                  color={getUserTypeColor()}
                />
              </View>
              <View style={styles.menuContent}>
                <Text style={styles.menuTitle}>{item.title}</Text>
                <Text style={styles.menuDescription}>{item.description}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />
            </TouchableOpacity>
          ))}
        </View>

        {/* Support Section */}
        <View style={styles.supportSection}>
          <Text style={styles.sectionTitle}>Support</Text>
          <TouchableOpacity style={styles.supportItem}>
            <Ionicons name="help-circle-outline" size={18} color="#6B7280" />
            <Text style={styles.supportText}>Help Center</Text>
            <Ionicons name="chevron-forward" size={14} color="#D1D5DB" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.supportItem}>
            <Ionicons name="chatbubble-outline" size={18} color="#6B7280" />
            <Text style={styles.supportText}>Contact Support</Text>
            <Ionicons name="chevron-forward" size={14} color="#D1D5DB" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.supportItem}>
            <Ionicons
              name="information-circle-outline"
              size={18}
              color="#6B7280"
            />
            <Text style={styles.supportText}>About Mataim UAE</Text>
            <Ionicons name="chevron-forward" size={14} color="#D1D5DB" />
          </TouchableOpacity>
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity
          style={[styles.signOutButton, { borderColor: getUserTypeColor() }]}
          onPress={handleSignOut}
        >
          <Ionicons
            name="log-out-outline"
            size={16}
            color={getUserTypeColor()}
          />
          <Text style={[styles.signOutText, { color: getUserTypeColor() }]}>
            Sign Out
          </Text>
        </TouchableOpacity>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.versionText}>Mataim UAE v2.0.0</Text>
          <Text style={styles.copyrightText}>
            © 2024 Mataim. All rights reserved.
          </Text>
        </View>
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
    paddingBottom: 16,
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
    borderLeftWidth: 4,
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
  userName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginRight: 8,
  },
  userTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  userTypeBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
  contactInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 12,
    color: "#6B7280",
    marginLeft: 4,
    fontWeight: "400",
  },
  userPhone: {
    fontSize: 12,
    color: "#6B7280",
    marginLeft: 4,
    fontWeight: "400",
  },
  cuisineType: {
    fontSize: 12,
    color: "#6B7280",
    marginLeft: 4,
    fontWeight: "400",
  },
  vehicleType: {
    fontSize: 12,
    color: "#6B7280",
    marginLeft: 4,
    fontWeight: "400",
  },
  editButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F9FAFB",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
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
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: 4,
  },
  loadingText: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "500",
  },
  quickActions: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
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
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  actionText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#374151",
    marginLeft: 6,
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
    gap: 6,
  },
  signOutText: {
    fontSize: 12,
    fontWeight: "600",
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
    fontWeight: "400",
  },

  absoluteMessageButton: {
    position: "absolute",
    bottom: 40, // Adjust this value based on your tab bar height
    right: 20,
    zIndex: 999,
    shadowColor: "#FF6B35",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },

  messageButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#FF6B35",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#fff",
  },

  messageBadge: {
    position: "absolute",
    top: -5,
    right: -5,
    backgroundColor: "#EF4444",
    borderRadius: 12,
    minWidth: 22,
    height: 22,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },

  messageBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
});
