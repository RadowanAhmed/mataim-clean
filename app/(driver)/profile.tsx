// app/(driver)/profile.tsx - Updated version
import { useAuth } from "@/backend/AuthContext";
import { supabase } from "@/backend/supabase";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
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

export default function DriverProfileScreen() {
  const router = useRouter();
  const { user, profile, signOut } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    // Add refresh logic here if needed
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
            // Set driver offline before signing out
            if (user?.is_online) {
              await supabase
                .from("delivery_users")
                .update({
                  is_online: false,
                  driver_status: "offline",
                })
                .eq("id", user.id);
            }

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
        .toUpperCase() || "D"
    );
  };

  const toggleOnlineStatus = async () => {
    if (!user) return;

    try {
      const newStatus = !user.is_online;

      const { error } = await supabase
        .from("delivery_users")
        .update({
          is_online: newStatus,
          driver_status: newStatus ? "available" : "offline",
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (error) throw error;

      // Update local user state (you might need to refresh user data)
      Alert.alert(
        "Success",
        newStatus
          ? "You are now online and ready for deliveries"
          : "You are now offline",
      );
    } catch (error) {
      console.error("Error updating online status:", error);
      Alert.alert("Error", "Failed to update status");
    }
  };

  // Check if user is driver
  if (!user || user.user_type !== "driver") {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Driver Profile</Text>
        </View>
        <View style={styles.setupContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#EF4444" />
          <Text style={styles.setupTitle}>Driver Account Required</Text>
          <Text style={styles.setupDescription}>
            This screen is only available for driver accounts
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

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#2563EB"
          />
        }
      >
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            {profile?.avatar_url ? (
              <Image
                source={{ uri: profile.avatar_url }}
                style={styles.profileImage}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitials}>
                  {getInitials(user?.full_name)}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.profileInfo}>
            <View style={styles.nameContainer}>
              <Text style={styles.driverName}>{user?.full_name}</Text>
            </View>

            <View style={styles.statusContainer}>
              <View
                style={[
                  styles.statusIndicator,
                  { backgroundColor: user?.is_online ? "#10B981" : "#6B7280" },
                ]}
              />
              <Text style={styles.statusText}>
                {user?.is_online ? "Online" : "Offline"}
              </Text>
              <TouchableOpacity
                style={styles.statusToggle}
                onPress={toggleOnlineStatus}
              >
                <Text style={styles.statusToggleText}>
                  {user?.is_online ? "Go Offline" : "Go Online"}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.contactInfo}>
              <Ionicons name="mail-outline" size={13} color="#6B7280" />
              <Text style={styles.contactText}>{user?.email}</Text>
            </View>

            {user?.phone && (
              <View style={styles.contactInfo}>
                <Ionicons name="call-outline" size={13} color="#6B7280" />
                <Text style={styles.contactText}>{user?.phone}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Driver Stats */}

        {/* Driver Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{user?.total_deliveries || 0}</Text>
            <Text style={styles.statLabel}>Deliveries</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>
              {user?.rating?.toFixed(1) || "0.0"}
            </Text>
            <Text style={styles.statLabel}>Rating</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>
              AED {user?.total_earnings?.toFixed(0) || "0"}
            </Text>
            <Text style={styles.statLabel}>Earnings</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>
              {user?.years_of_experience || "0"}y
            </Text>
            <Text style={styles.statLabel}>Experience</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push("/(driver)/dashboard")}
            >
              <MaterialCommunityIcons
                name="view-dashboard"
                size={22}
                color="#2563EB"
              />
              <Text style={styles.actionText}>Dashboard</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push("/(driver)/earnings")}
            >
              <Ionicons name="cash" size={22} color="#2563EB" />
              <Text style={styles.actionText}>Earnings</Text>
            </TouchableOpacity>
          </View>
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

// Styles remain the same...

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "500",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  headerTitle: {
    fontSize: 18,
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
    paddingBottom: 24,
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  avatarContainer: {
    position: "relative",
    marginRight: 16,
  },
  profileImage: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  avatarPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#2563EB",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInitials: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "700",
  },
  verifiedBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 2,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  profileInfo: {
    flex: 1,
  },
  nameContainer: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: 8,
  },
  driverName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginRight: 8,
  },
  driverTypeBadge: {
    backgroundColor: "#2563EB",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  driverTypeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "600",
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 6,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "500",
    flex: 1,
  },
  statusToggle: {
    backgroundColor: "#2563EB15",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  statusToggleText: {
    color: "#2563EB",
    fontSize: 12,
    fontWeight: "600",
  },
  contactInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  contactText: {
    fontSize: 13,
    color: "#6B7280",
    fontWeight: "500",
    marginLeft: 6,
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
  statsContainer: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginVertical: 16,
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
    justifyContent: "center",
  },
  statNumber: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "500",
    textAlign: "center",
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: "#E5E7EB",
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
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 16,
  },
  actionsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    flexWrap: "wrap",
  },
  actionButton: {
    width: "48%",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  actionText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
    marginTop: 8,
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
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#2563EB15",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  menuContent: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 2,
  },
  menuDescription: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "500",
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
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  supportText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    color: "#374151",
    marginLeft: 12,
  },
  signOutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#EF4444",
    gap: 8,
    marginBottom: 20,
  },
  signOutText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#EF4444",
  },
  footer: {
    alignItems: "center",
    padding: 16,
  },
  versionText: {
    fontSize: 13,
    color: "#6B7280",
    fontWeight: "500",
    marginBottom: 4,
  },
  copyrightText: {
    fontSize: 12,
    color: "#9CA3AF",
  },

  profileStatAnimation: {
    width: 40,
    height: 40,
    marginBottom: 8,
  },
});
