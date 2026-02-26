import { useAuth } from "@/backend/AuthContext";
import { useGuestAction } from "@/backend/hooks/useGuestAction";
import { supabase } from "@/backend/supabase";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Linking,
  Modal,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface DriverProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  profile_image_url: string | null;
  country_code: string;
  is_verified: boolean;
  created_at: string;
  last_login: string | null;
  user_type: string;
}

interface DriverDetails {
  id: string;
  vehicle_type: string | null;
  license_number: string;
  vehicle_plate: string;
  years_of_experience: number | null;
  availability: string | null;
  insurance_number: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  location_code: string | null;
  driver_status: string;
  total_deliveries: number;
  rating: number;
  current_location_lat: number | null;
  current_location_lng: number | null;
  is_online: boolean;
  earnings_today: number;
  total_earnings: number;
  created_at: string;
  updated_at: string;
}

interface Delivery {
  id: string;
  order_number: string;
  status: string;
  final_amount: number;
  delivery_fee: number;
  created_at: string;
  estimated_delivery_time: string | null;
  actual_delivery_time: string | null;
  restaurants: {
    restaurant_name: string;
    image_url: string | null;
  } | null;
  customers: {
    full_name: string;
    profile_image_url: string | null;
  } | null;
}

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  order_id: string | null;
  users: {
    full_name: string;
    profile_image_url: string | null;
  } | null;
  restaurants: {
    restaurant_name: string;
    id: string;
  } | null;
}

interface DriverStats {
  total_deliveries: number;
  total_earnings: number;
  average_rating: number;
  completion_rate: number;
  on_time_rate: number;
  deliveries_today: number;
  earnings_today: number;
  experience_years: number;
  recent_activity: {
    last_30_days: number;
    this_week: number;
    today: number;
  };
}

// Rating Stars Component
const RatingStars = ({
  rating,
  size = 12,
  showRating = true,
}: {
  rating: number;
  size?: number;
  showRating?: boolean;
}) => {
  return (
    <View style={styles.ratingStars}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Ionicons
          key={star}
          name={
            star <= rating
              ? "star"
              : star - 0.5 <= rating
                ? "star-half"
                : "star-outline"
          }
          size={size}
          color="#FFD700"
        />
      ))}
      {showRating && (
        <Text style={[styles.ratingText, { fontSize: size }]}>
          {rating.toFixed(1)}
        </Text>
      )}
    </View>
  );
};

// Status Badge Component
const StatusBadge = ({
  status,
  isOnline,
}: {
  status: string;
  isOnline: boolean;
}) => {
  const getStatusColor = () => {
    if (!isOnline) return "#9CA3AF";
    switch (status) {
      case "available":
        return "#10B981";
      case "busy":
        return "#F59E0B";
      default:
        return "#6B7280";
    }
  };

  const getStatusText = () => {
    if (!isOnline) return "Offline";
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  return (
    <View
      style={[styles.statusBadge, { backgroundColor: getStatusColor() + "15" }]}
    >
      <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
      <Text style={[styles.statusText, { color: getStatusColor() }]}>
        {getStatusText()}
      </Text>
    </View>
  );
};

export default function DriverProfileScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();

  const [driver, setDriver] = useState<DriverProfile | null>(null);
  const [driverDetails, setDriverDetails] = useState<DriverDetails | null>(
    null,
  );
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState<DriverStats | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "overview" | "deliveries" | "reviews"
  >("overview");
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(
    null,
  );
  const [modalVisible, setModalVisible] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [userType, setUserType] = useState<"customer" | "restaurant" | null>(
    null,
  );

  // Inside component
  const { checkGuestAction, isGuest } = useGuestAction();

  useEffect(() => {
    if (id) {
      fetchDriverData();
      determineUserType();
    }
  }, [id]);

  const determineUserType = () => {
    // Determine if current user is customer or restaurant
    if (user?.user_type === "customer" || user?.user_type === "restaurant") {
      setUserType(user.user_type);
    }
  };

  const fetchDriverData = async () => {
    try {
      setLoading(true);

      // Fetch driver profile from users table
      const { data: driverData, error: driverError } = await supabase
        .from("users")
        .select(
          `
          id,
          full_name,
          email,
          phone,
          profile_image_url,
          country_code,
          is_verified,
          created_at,
          last_login,
          user_type
        `,
        )
        .eq("id", id)
        .single();

      if (driverError) throw driverError;
      setDriver(driverData);

      // Fetch driver details from delivery_users table
      const { data: detailsData, error: detailsError } = await supabase
        .from("delivery_users")
        .select("*")
        .eq("id", id)
        .single();

      if (detailsError) throw detailsError;
      setDriverDetails(detailsData);

      // Fetch recent deliveries
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
          estimated_delivery_time,
          actual_delivery_time,
          restaurants:restaurants!orders_restaurant_id_fkey(
            restaurant_name,
            image_url
          ),
          customers:users!orders_customer_id_fkey(
            full_name,
            profile_image_url
          )
        `,
        )
        .eq("driver_id", id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (!deliveriesError) {
        setDeliveries(deliveriesData || []);
      }

      // Fetch reviews for this driver
      const { data: reviewsData, error: reviewsError } = await supabase
        .from("driver_reviews")
        .select(
          `
          *,
          users:users!driver_reviews_customer_id_fkey(
            full_name,
            profile_image_url
          ),
          restaurants:restaurants!driver_reviews_restaurant_id_fkey(
            id,
            restaurant_name
          )
        `,
        )
        .eq("driver_id", id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (!reviewsError) {
        setReviews(reviewsData || []);
      }

      // Calculate driver stats
      if (detailsData && deliveriesData) {
        const completedDeliveries = deliveriesData.filter(
          (d) => d.status === "delivered",
        );
        const cancelledDeliveries = deliveriesData.filter(
          (d) => d.status === "cancelled",
        );
        const totalDeliveries = deliveriesData.length;

        // Calculate on-time rate
        const onTimeDeliveries = completedDeliveries.filter((d) => {
          if (!d.estimated_delivery_time || !d.actual_delivery_time)
            return false;
          const estimated = new Date(d.estimated_delivery_time);
          const actual = new Date(d.actual_delivery_time);
          return actual <= estimated;
        }).length;

        // Calculate recent activity
        const now = new Date();
        const thirtyDaysAgo = new Date(now.setDate(now.getDate() - 30));
        const sevenDaysAgo = new Date(now.setDate(now.getDate() - 7));
        const today = new Date();

        const last30Days = deliveriesData.filter(
          (d) => new Date(d.created_at) >= thirtyDaysAgo,
        ).length;

        const thisWeek = deliveriesData.filter(
          (d) => new Date(d.created_at) >= sevenDaysAgo,
        ).length;

        const todayDeliveries = deliveriesData.filter((d) => {
          const deliveryDate = new Date(d.created_at);
          return (
            deliveryDate.getDate() === today.getDate() &&
            deliveryDate.getMonth() === today.getMonth() &&
            deliveryDate.getFullYear() === today.getFullYear()
          );
        }).length;

        setStats({
          total_deliveries: detailsData.total_deliveries || 0,
          total_earnings: detailsData.total_earnings || 0,
          average_rating: detailsData.rating || 0,
          completion_rate:
            totalDeliveries > 0
              ? (completedDeliveries.length / totalDeliveries) * 100
              : 0,
          on_time_rate:
            completedDeliveries.length > 0
              ? (onTimeDeliveries / completedDeliveries.length) * 100
              : 0,
          deliveries_today: todayDeliveries,
          earnings_today: detailsData.earnings_today || 0,
          experience_years: detailsData.years_of_experience || 0,
          recent_activity: {
            last_30_days: last30Days,
            this_week: thisWeek,
            today: todayDeliveries,
          },
        });
      }
    } catch (error) {
      console.error("Error fetching driver data:", error);
      Alert.alert("Error", "Failed to load driver profile");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchDriverData();
  };

  const startConversation = async () => {
    checkGuestAction("message drivers", async () => {
      if (!user?.id || !driver?.id) {
        Alert.alert("Login Required", "Please login to message this driver");
        return;
      }

      try {
        let conversationId;

        if (userType === "customer") {
          // Customer messaging driver
          const { data: existing } = await supabase
            .from("conversations")
            .select("id")
            .eq("customer_id", user.id)
            .eq("driver_id", driver.id)
            .eq("is_active", true)
            .maybeSingle();

          if (existing) {
            conversationId = existing.id;
          } else {
            const { data: newConversation, error } = await supabase
              .from("conversations")
              .insert({
                customer_id: user.id,
                driver_id: driver.id,
                last_message: "Conversation started from driver profile",
              })
              .select("id")
              .single();

            if (error) throw error;
            conversationId = newConversation.id;
          }

          router.push({
            pathname: "/(tabs)/messages/[id]",
            params: {
              id: conversationId,
              driverId: driver.id,
              driverName: driver.full_name,
              driverImage: driver.profile_image_url,
            },
          });
        } else if (userType === "restaurant") {
          // Restaurant messaging driver
          const { data: existing } = await supabase
            .from("conversations")
            .select("id")
            .eq("restaurant_id", user.id)
            .eq("driver_id", driver.id)
            .eq("is_active", true)
            .maybeSingle();

          if (existing) {
            conversationId = existing.id;
          } else {
            const { data: newConversation, error } = await supabase
              .from("conversations")
              .insert({
                restaurant_id: user.id,
                driver_id: driver.id,
                last_message: "Conversation started from driver profile",
              })
              .select("id")
              .single();

            if (error) throw error;
            conversationId = newConversation.id;
          }

          router.push({
            pathname: "/(restaurant)/messages/[id]",
            params: {
              id: conversationId,
              driverId: driver.id,
              driverName: driver.full_name,
              driverImage: driver.profile_image_url,
            },
          });
        }
      } catch (error) {
        console.error("Error starting conversation:", error);
        Alert.alert("Error", "Failed to start conversation");
      }
    });
  };

  const handleCall = () => {
    checkGuestAction("call drivers", () => {
      if (!driver?.phone) {
        Alert.alert("Error", "Phone number not available");
        return;
      }
      const phoneNumber = `${driver.country_code || "+971"}${driver.phone}`;
      Linking.openURL(`tel:${phoneNumber}`).catch(() => {
        Alert.alert("Error", "Unable to make phone call");
      });
    });
  };

  const handleEmail = () => {
    checkGuestAction("email drivers", () => {
      if (!driver?.email) {
        Alert.alert("Error", "Email not available");
        return;
      }
      Linking.openURL(`mailto:${driver.email}`).catch(() => {
        Alert.alert("Error", "Unable to send email");
      });
    });
  };

  const handleOpenMap = () => {
    if (
      driverDetails?.current_location_lat &&
      driverDetails?.current_location_lng
    ) {
      Linking.openURL(
        `https://maps.google.com/?q=${driverDetails.current_location_lat},${driverDetails.current_location_lng}`,
      );
    } else {
      Alert.alert("Info", "Driver location not available");
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 1) return "Just now";
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatCurrency = (amount: number) => {
    return `AED ${amount.toFixed(2)}`;
  };

  const getInitials = (name: string) => {
    return (
      name
        ?.split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .substring(0, 2) || "DR"
    );
  };

  const getVehicleIcon = (vehicleType: string | null) => {
    switch (vehicleType?.toLowerCase()) {
      case "car":
      case "sedan":
        return "car";
      case "motorcycle":
      case "bike":
        return "bike";
      case "scooter":
        return "scooter";
      case "truck":
      case "van":
        return "truck";
      default:
        return "bicycle";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "delivered":
        return "#10B981";
      case "cancelled":
        return "#EF4444";
      case "out_for_delivery":
        return "#3B82F6";
      case "picked_up":
        return "#8B5CF6";
      case "ready":
        return "#F59E0B";
      default:
        return "#6B7280";
    }
  };

  const renderOverview = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      {/* Driver Bio Card */}
      <LinearGradient
        colors={["#3B82F610", "#8B5CF610"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.bioCard}
      >
        <View style={styles.bioHeader}>
          <Ionicons name="information-circle" size={20} color="#3B82F6" />
          <Text style={styles.bioTitle}>About Driver</Text>
        </View>
        <Text style={styles.bioText}>
          {driverDetails?.years_of_experience
            ? `Experienced driver with ${driverDetails.years_of_experience} years in delivery service.`
            : "Professional delivery partner."}
        </Text>
        {driver?.is_verified && (
          <View style={styles.verifiedBadge}>
            <Ionicons name="checkmark-circle" size={14} color="#10B981" />
            <Text style={styles.verifiedText}>Verified Driver</Text>
          </View>
        )}
      </LinearGradient>

      {/* Quick Stats Grid */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <View
            style={[styles.statIconContainer, { backgroundColor: "#3B82F615" }]}
          >
            <MaterialCommunityIcons name="bike" size={24} color="#3B82F6" />
          </View>
          <Text style={styles.statValue}>{stats?.total_deliveries || 0}</Text>
          <Text style={styles.statLabel}>Deliveries</Text>
        </View>

        <View style={styles.statCard}>
          <View
            style={[styles.statIconContainer, { backgroundColor: "#10B98115" }]}
          >
            <Ionicons name="star" size={24} color="#10B981" />
          </View>
          <Text style={styles.statValue}>
            {stats?.average_rating?.toFixed(1) || "0.0"}
          </Text>
          <Text style={styles.statLabel}>Rating</Text>
        </View>

        <View style={styles.statCard}>
          <View
            style={[styles.statIconContainer, { backgroundColor: "#F59E0B15" }]}
          >
            <Ionicons name="checkmark-circle" size={24} color="#F59E0B" />
          </View>
          <Text style={styles.statValue}>
            {stats?.completion_rate?.toFixed(0) || 0}%
          </Text>
          <Text style={styles.statLabel}>Completion</Text>
        </View>

        <View style={styles.statCard}>
          <View
            style={[styles.statIconContainer, { backgroundColor: "#8B5CF615" }]}
          >
            <Ionicons name="time" size={24} color="#8B5CF6" />
          </View>
          <Text style={styles.statValue}>
            {stats?.on_time_rate?.toFixed(0) || 0}%
          </Text>
          <Text style={styles.statLabel}>On Time</Text>
        </View>
      </View>

      {/* Vehicle Information */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Vehicle Information</Text>
        <View style={styles.vehicleCard}>
          <View style={styles.vehicleIconContainer}>
            <MaterialCommunityIcons
              name={getVehicleIcon(driverDetails?.vehicle_type)}
              size={32}
              color="#3B82F6"
            />
          </View>
          <View style={styles.vehicleInfo}>
            <Text style={styles.vehicleType}>
              {driverDetails?.vehicle_type || "Not specified"}
            </Text>
            <Text style={styles.vehiclePlate}>
              {driverDetails?.vehicle_plate || "N/A"}
            </Text>
            <Text style={styles.vehicleLicense}>
              License: {driverDetails?.license_number || "N/A"}
            </Text>
          </View>
        </View>
      </View>

      {/* Recent Activity */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        <View style={styles.activityGrid}>
          <View style={styles.activityItem}>
            <Text style={styles.activityLabel}>Today</Text>
            <Text style={styles.activityValue}>
              {stats?.recent_activity?.today || 0}
            </Text>
          </View>
          <View style={styles.activityItem}>
            <Text style={styles.activityLabel}>This Week</Text>
            <Text style={styles.activityValue}>
              {stats?.recent_activity?.this_week || 0}
            </Text>
          </View>
          <View style={styles.activityItem}>
            <Text style={styles.activityLabel}>Last 30 Days</Text>
            <Text style={styles.activityValue}>
              {stats?.recent_activity?.last_30_days || 0}
            </Text>
          </View>
        </View>
      </View>

      {/* Earnings Overview (for customers/restaurants to see) */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Earnings Overview</Text>
        <View style={styles.earningsCard}>
          <View style={styles.earningsRow}>
            <View style={styles.earningsItem}>
              <Text style={styles.earningsLabel}>Today</Text>
              <Text style={styles.earningsValue}>
                {formatCurrency(stats?.earnings_today || 0)}
              </Text>
            </View>
            <View style={styles.earningsItem}>
              <Text style={styles.earningsLabel}>Total</Text>
              <Text style={styles.earningsValue}>
                {formatCurrency(stats?.total_earnings || 0)}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Current Location (if available and driver is online) */}
      {driverDetails?.is_online && driverDetails?.current_location_lat && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Current Location</Text>
            <TouchableOpacity onPress={handleOpenMap}>
              <Text style={styles.viewMapText}>View Map</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.locationCard} onPress={handleOpenMap}>
            <MapView
              style={styles.miniMap}
              provider={PROVIDER_GOOGLE}
              region={{
                latitude: driverDetails.current_location_lat,
                longitude: driverDetails.current_location_lng,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
              scrollEnabled={false}
              zoomEnabled={false}
            >
              <Marker
                coordinate={{
                  latitude: driverDetails.current_location_lat,
                  longitude: driverDetails.current_location_lng,
                }}
              >
                <View style={styles.mapMarker}>
                  <MaterialCommunityIcons
                    name="bike"
                    size={24}
                    color="#3B82F6"
                  />
                </View>
              </Marker>
            </MapView>
            <View style={styles.locationInfo}>
              <Ionicons name="location" size={16} color="#3B82F6" />
              <Text style={styles.locationText} numberOfLines={1}>
                Driver is currently at this location
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* Contact Information */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Contact Information</Text>
        <View style={styles.contactCard}>
          {driver?.phone && (
            <TouchableOpacity style={styles.contactRow} onPress={handleCall}>
              <View
                style={[styles.contactIcon, { backgroundColor: "#10B98115" }]}
              >
                <Ionicons name="call" size={18} color="#10B981" />
              </View>
              <View style={styles.contactInfo}>
                <Text style={styles.contactLabel}>Phone</Text>
                <Text style={styles.contactValue}>
                  {driver.country_code} {driver.phone}
                </Text>
              </View>
              <Ionicons name="open-outline" size={16} color="#6B7280" />
            </TouchableOpacity>
          )}

          {driver?.email && (
            <TouchableOpacity style={styles.contactRow} onPress={handleEmail}>
              <View
                style={[styles.contactIcon, { backgroundColor: "#3B82F615" }]}
              >
                <Ionicons name="mail" size={18} color="#3B82F6" />
              </View>
              <View style={styles.contactInfo}>
                <Text style={styles.contactLabel}>Email</Text>
                <Text style={styles.contactValue}>{driver.email}</Text>
              </View>
              <Ionicons name="open-outline" size={16} color="#6B7280" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Driver Since */}
      <View style={styles.section}>
        <Text style={styles.driverSince}>
          Driver since{" "}
          {new Date(driver?.created_at || "").toLocaleDateString("en-US", {
            month: "long",
            year: "numeric",
          })}
        </Text>
      </View>
    </ScrollView>
  );

  const renderDeliveries = () => (
    <View style={styles.tabContent}>
      {deliveries.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="bicycle-outline" size={48} color="#D1D5DB" />
          <Text style={styles.emptyStateTitle}>No deliveries yet</Text>
          <Text style={styles.emptyStateText}>
            This driver hasn't completed any deliveries
          </Text>
        </View>
      ) : (
        <FlatList
          data={deliveries}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.deliveryCard}
              onPress={() => {
                setSelectedDelivery(item);
                setModalVisible(true);
              }}
            >
              <View style={styles.deliveryHeader}>
                <View>
                  <Text style={styles.deliveryNumber}>
                    #{item.order_number}
                  </Text>
                  <Text style={styles.deliveryDate}>
                    {formatDate(item.created_at)}
                  </Text>
                </View>
                <View
                  style={[
                    styles.deliveryStatusBadge,
                    { backgroundColor: getStatusColor(item.status) + "20" },
                  ]}
                >
                  <Text
                    style={[
                      styles.deliveryStatusText,
                      { color: getStatusColor(item.status) },
                    ]}
                  >
                    {item.status.replace(/_/g, " ")}
                  </Text>
                </View>
              </View>

              <View style={styles.deliveryContent}>
                <View style={styles.deliveryRow}>
                  <Ionicons name="restaurant" size={14} color="#6B7280" />
                  <Text style={styles.deliveryRestaurant} numberOfLines={1}>
                    {item.restaurants?.restaurant_name || "Restaurant"}
                  </Text>
                </View>
                <View style={styles.deliveryRow}>
                  <Ionicons name="person" size={14} color="#6B7280" />
                  <Text style={styles.deliveryCustomer} numberOfLines={1}>
                    {item.customers?.full_name || "Customer"}
                  </Text>
                </View>
              </View>

              <View style={styles.deliveryFooter}>
                <Text style={styles.deliveryEarnings}>
                  {formatCurrency(item.delivery_fee || 0)}
                </Text>
                {item.actual_delivery_time && (
                  <View style={styles.deliveryTime}>
                    <Ionicons name="time" size={12} color="#10B981" />
                    <Text style={styles.deliveryTimeText}>
                      {new Date(item.actual_delivery_time).toLocaleTimeString(
                        [],
                        {
                          hour: "2-digit",
                          minute: "2-digit",
                        },
                      )}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          )}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.deliveriesList}
        />
      )}
    </View>
  );

  const renderReviews = () => (
    <View style={styles.tabContent}>
      {reviews.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="chatbubble-outline" size={48} color="#D1D5DB" />
          <Text style={styles.emptyStateTitle}>No reviews yet</Text>
          <Text style={styles.emptyStateText}>
            This driver hasn't received any reviews
          </Text>
        </View>
      ) : (
        <FlatList
          data={reviews}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.reviewCard}>
              <View style={styles.reviewHeader}>
                <View style={styles.reviewerInfo}>
                  {item.users?.profile_image_url ? (
                    <Image
                      source={{ uri: item.users.profile_image_url }}
                      style={styles.reviewerAvatar}
                    />
                  ) : (
                    <View style={styles.reviewerAvatarPlaceholder}>
                      <Text style={styles.reviewerInitials}>
                        {item.users?.full_name?.charAt(0) || "C"}
                      </Text>
                    </View>
                  )}
                  <View>
                    <Text style={styles.reviewerName}>
                      {item.users?.full_name || "Customer"}
                    </Text>
                    {item.restaurants && (
                      <Text style={styles.reviewRestaurant}>
                        from {item.restaurants.restaurant_name}
                      </Text>
                    )}
                  </View>
                </View>
                <View style={styles.reviewRating}>
                  <RatingStars
                    rating={item.rating}
                    size={12}
                    showRating={false}
                  />
                </View>
              </View>
              {item.comment && (
                <Text style={styles.reviewComment}>{item.comment}</Text>
              )}
              <Text style={styles.reviewDate}>
                {formatDate(item.created_at)}
              </Text>
            </View>
          )}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.reviewsList}
        />
      )}
    </View>
  );

  const renderDeliveryModal = () => {
    if (!selectedDelivery) return null;

    return (
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <BlurView intensity={50} tint="dark" style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Delivery Details</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.modalDeliveryHeader}>
                <Text style={styles.modalDeliveryNumber}>
                  #{selectedDelivery.order_number}
                </Text>
                <View
                  style={[
                    styles.modalStatusBadge,
                    {
                      backgroundColor:
                        getStatusColor(selectedDelivery.status) + "20",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.modalStatusText,
                      { color: getStatusColor(selectedDelivery.status) },
                    ]}
                  >
                    {selectedDelivery.status.replace(/_/g, " ").toUpperCase()}
                  </Text>
                </View>
              </View>

              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Restaurant</Text>
                <View style={styles.modalRestaurantCard}>
                  {selectedDelivery.restaurants?.image_url ? (
                    <Image
                      source={{ uri: selectedDelivery.restaurants.image_url }}
                      style={styles.modalRestaurantImage}
                    />
                  ) : (
                    <View style={styles.modalRestaurantImagePlaceholder}>
                      <Ionicons name="restaurant" size={24} color="#9CA3AF" />
                    </View>
                  )}
                  <View style={styles.modalRestaurantInfo}>
                    <Text style={styles.modalRestaurantName}>
                      {selectedDelivery.restaurants?.restaurant_name ||
                        "Restaurant"}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Customer</Text>
                <View style={styles.modalCustomerCard}>
                  {selectedDelivery.customers?.profile_image_url ? (
                    <Image
                      source={{
                        uri: selectedDelivery.customers.profile_image_url,
                      }}
                      style={styles.modalCustomerImage}
                    />
                  ) : (
                    <View style={styles.modalCustomerImagePlaceholder}>
                      <Ionicons name="person" size={24} color="#9CA3AF" />
                    </View>
                  )}
                  <View style={styles.modalCustomerInfo}>
                    <Text style={styles.modalCustomerName}>
                      {selectedDelivery.customers?.full_name || "Customer"}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Delivery Details</Text>
                <View style={styles.modalDetailsGrid}>
                  <View style={styles.modalDetailItem}>
                    <Text style={styles.modalDetailLabel}>Delivery Fee</Text>
                    <Text style={styles.modalDetailValue}>
                      {formatCurrency(selectedDelivery.delivery_fee || 0)}
                    </Text>
                  </View>
                  <View style={styles.modalDetailItem}>
                    <Text style={styles.modalDetailLabel}>Order Total</Text>
                    <Text style={styles.modalDetailValue}>
                      {formatCurrency(selectedDelivery.final_amount || 0)}
                    </Text>
                  </View>
                  <View style={styles.modalDetailItem}>
                    <Text style={styles.modalDetailLabel}>Date</Text>
                    <Text style={styles.modalDetailValue}>
                      {new Date(
                        selectedDelivery.created_at,
                      ).toLocaleDateString()}
                    </Text>
                  </View>
                  <View style={styles.modalDetailItem}>
                    <Text style={styles.modalDetailLabel}>Time</Text>
                    <Text style={styles.modalDetailValue}>
                      {new Date(selectedDelivery.created_at).toLocaleTimeString(
                        [],
                        {
                          hour: "2-digit",
                          minute: "2-digit",
                        },
                      )}
                    </Text>
                  </View>
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.modalCloseButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </BlurView>
      </Modal>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Loading driver profile...</Text>
      </SafeAreaView>
    );
  }

  if (!driver) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <View style={styles.errorContent}>
          <Ionicons name="person-outline" size={64} color="#EF4444" />
          <Text style={styles.errorTitle}>Driver Not Found</Text>
          <Text style={styles.errorText}>
            This driver profile may have been deleted
          </Text>
          <TouchableOpacity
            style={styles.errorBackButton}
            onPress={() => router.back()}
          >
            <Text style={styles.errorBackButtonText}>Go Back</Text>
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
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Driver Profile</Text>
        {userType && (
          <TouchableOpacity
            style={styles.messageButton}
            onPress={startConversation}
          >
            <Ionicons name="chatbubble" size={20} color="#3B82F6" />
          </TouchableOpacity>
        )}
      </View>

      {isGuest && (
        <View style={styles.guestBanner}>
          <Ionicons name="information-circle" size={20} color="#FF6B35" />
          <Text style={styles.guestBannerText}>
            Sign in to message, call, or email this driver
          </Text>
          <TouchableOpacity
            style={styles.guestBannerButton}
            onPress={() => router.push("/(auth)/signin")}
          >
            <Text style={styles.guestBannerButtonText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#3B82F6"]}
            tintColor="#3B82F6"
          />
        }
      >
        {/* Profile Header */}
        <LinearGradient
          colors={["#3B82F620", "#8B5CF620"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.profileHeader}
        >
          <View style={styles.profileImageContainer}>
            {driver.profile_image_url ? (
              <Image
                source={{ uri: driver.profile_image_url }}
                style={styles.profileImage}
              />
            ) : (
              <View style={styles.profileImagePlaceholder}>
                <Text style={styles.profileInitials}>
                  {getInitials(driver.full_name)}
                </Text>
              </View>
            )}
            {driver.is_verified && (
              <View style={styles.verifiedBadgeLarge}>
                <Ionicons name="checkmark-circle" size={20} color="#10B981" />
              </View>
            )}
          </View>

          <View style={styles.profileInfo}>
            <View style={styles.profileNameRow}>
              <Text style={styles.profileName}>{driver.full_name}</Text>
              {driverDetails && (
                <StatusBadge
                  status={driverDetails.driver_status}
                  isOnline={driverDetails.is_online}
                />
              )}
            </View>
            <View style={styles.profileRating}>
              <RatingStars rating={driverDetails?.rating || 0} size={14} />
            </View>
            <View style={styles.profileMeta}>
              <View style={styles.profileMetaItem}>
                <Ionicons name="calendar-outline" size={14} color="#6B7280" />
                <Text style={styles.profileMetaText}>
                  Joined{" "}
                  {new Date(driver.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    year: "numeric",
                  })}
                </Text>
              </View>
              {driver.last_login && (
                <View style={styles.profileMetaItem}>
                  <Ionicons name="time-outline" size={14} color="#6B7280" />
                  <Text style={styles.profileMetaText}>
                    Last active {formatDate(driver.last_login)}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </LinearGradient>

        {/* Quick Action Buttons (only for logged-in users) */}
        {userType && !isGuest && (
          <View style={styles.quickActions}>
            <TouchableOpacity style={styles.quickAction} onPress={handleCall}>
              <View
                style={[
                  styles.quickActionIcon,
                  { backgroundColor: "#10B98115" },
                ]}
              >
                <Ionicons name="call" size={20} color="#10B981" />
              </View>
              <Text style={styles.quickActionText}>Call</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.quickAction} onPress={handleEmail}>
              <View
                style={[
                  styles.quickActionIcon,
                  { backgroundColor: "#3B82F615" },
                ]}
              >
                <Ionicons name="mail" size={20} color="#3B82F6" />
              </View>
              <Text style={styles.quickActionText}>Email</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickAction}
              onPress={startConversation}
            >
              <View
                style={[
                  styles.quickActionIcon,
                  { backgroundColor: "#8B5CF615" },
                ]}
              >
                <Ionicons name="chatbubble" size={20} color="#8B5CF6" />
              </View>
              <Text style={styles.quickActionText}>Message</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          {[
            { key: "overview", label: "Overview", icon: "person" },
            {
              key: "deliveries",
              label: "Deliveries",
              icon: "bicycle",
              count: deliveries.length,
            },
            {
              key: "reviews",
              label: "Reviews",
              icon: "star",
              count: reviews.length,
            },
          ].map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.tabButton,
                activeTab === tab.key && styles.tabButtonActive,
              ]}
              onPress={() => setActiveTab(tab.key as any)}
            >
              <Ionicons
                name={tab.key === activeTab ? tab.icon : `${tab.icon}-outline`}
                size={18}
                color={activeTab === tab.key ? "#3B82F6" : "#6B7280"}
              />
              <Text
                style={[
                  styles.tabText,
                  activeTab === tab.key && styles.tabTextActive,
                ]}
              >
                {tab.label}
              </Text>
              {tab.count && tab.count > 0 && (
                <View
                  style={[
                    styles.tabBadge,
                    activeTab === tab.key && styles.tabBadgeActive,
                  ]}
                >
                  <Text style={styles.tabBadgeText}>
                    {tab.count > 99 ? "99+" : tab.count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab Content */}
        {activeTab === "overview" && renderOverview()}
        {activeTab === "deliveries" && renderDeliveries()}
        {activeTab === "reviews" && renderReviews()}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Delivery Detail Modal */}
      {renderDeliveryModal()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
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
  errorContainer: {
    flex: 1,
    backgroundColor: "#fff",
  },
  errorContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 24,
  },
  errorBackButton: {
    backgroundColor: "#3B82F6",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  errorBackButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
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
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  messageButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#3B82F615",
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    flex: 1,
  },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  profileImageContainer: {
    position: "relative",
    marginRight: 16,
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: "#fff",
  },
  profileImagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#3B82F6",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#fff",
  },
  profileInitials: {
    color: "#fff",
    fontSize: 32,
    fontWeight: "700",
  },
  verifiedBadgeLarge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 2,
  },
  profileInfo: {
    flex: 1,
  },
  profileNameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  profileName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    flex: 1,
  },
  profileRating: {
    marginBottom: 6,
  },
  profileMeta: {
    gap: 4,
  },
  profileMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  profileMetaText: {
    fontSize: 12,
    color: "#6B7280",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
    marginLeft: 8,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "600",
  },
  quickActions: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  quickAction: {
    alignItems: "center",
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },
  quickActionText: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "500",
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#fff",
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  tabButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 6,
  },
  tabButtonActive: {
    backgroundColor: "#3B82F615",
  },
  tabText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6B7280",
  },
  tabTextActive: {
    color: "#3B82F6",
  },
  tabBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  tabBadgeActive: {
    backgroundColor: "#3B82F6",
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#6B7280",
  },
  tabContent: {
    flex: 1,
    padding: 16,
  },
  bioCard: {
    padding: 14,
    borderRadius: 16,
    marginBottom: 16,
  },
  bioHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  bioTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  bioText: {
    fontSize: 14,
    color: "#6B7280",
    lineHeight: 20,
    marginBottom: 12,
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#10B98115",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 4,
  },
  verifiedText: {
    fontSize: 11,
    color: "#10B981",
    fontWeight: "600",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  statCard: {
    width: (SCREEN_WIDTH - 42) / 2,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: "#6B7280",
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  viewMapText: {
    fontSize: 13,
    color: "#3B82F6",
    fontWeight: "600",
  },
  vehicleCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  vehicleIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#3B82F615",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  vehicleInfo: {
    flex: 1,
  },
  vehicleType: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  vehiclePlate: {
    fontSize: 14,
    color: "#3B82F6",
    fontWeight: "600",
    marginBottom: 2,
  },
  vehicleLicense: {
    fontSize: 12,
    color: "#6B7280",
  },
  activityGrid: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  activityItem: {
    flex: 1,
    alignItems: "center",
  },
  activityLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 4,
  },
  activityValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
  },
  earningsCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  earningsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  earningsItem: {
    alignItems: "center",
  },
  earningsLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 4,
  },
  earningsValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#10B981",
  },
  locationCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  miniMap: {
    height: 150,
  },
  locationInfo: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 8,
  },
  locationText: {
    fontSize: 13,
    color: "#374151",
    flex: 1,
  },
  mapMarker: {
    backgroundColor: "#fff",
    padding: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#3B82F6",
  },
  contactCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  contactIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  contactInfo: {
    flex: 1,
  },
  contactLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 2,
  },
  contactValue: {
    fontSize: 14,
    color: "#111827",
    fontWeight: "500",
  },
  driverSince: {
    fontSize: 12,
    color: "#9CA3AF",
    textAlign: "center",
    marginBottom: 8,
  },
  ratingStars: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
    marginLeft: 4,
  },
  deliveriesList: {
    paddingBottom: 20,
  },
  deliveryCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  deliveryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  deliveryNumber: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 2,
  },
  deliveryDate: {
    fontSize: 12,
    color: "#6B7280",
  },
  deliveryStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  deliveryStatusText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  deliveryContent: {
    marginBottom: 12,
    gap: 6,
  },
  deliveryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  deliveryRestaurant: {
    fontSize: 13,
    color: "#374151",
    flex: 1,
  },
  deliveryCustomer: {
    fontSize: 13,
    color: "#374151",
    flex: 1,
  },
  deliveryFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  deliveryEarnings: {
    fontSize: 16,
    fontWeight: "800",
    color: "#10B981",
  },
  deliveryTime: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  deliveryTimeText: {
    fontSize: 11,
    color: "#10B981",
    fontWeight: "600",
  },
  reviewsList: {
    paddingBottom: 20,
  },
  reviewCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  reviewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  reviewerInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 12,
  },
  reviewerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  reviewerAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#3B82F6",
    justifyContent: "center",
    alignItems: "center",
  },
  reviewerInitials: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  reviewerName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  reviewRestaurant: {
    fontSize: 12,
    color: "#6B7280",
  },
  reviewRating: {
    marginLeft: 8,
  },
  reviewComment: {
    fontSize: 14,
    color: "#374151",
    lineHeight: 20,
    marginBottom: 8,
  },
  reviewDate: {
    fontSize: 11,
    color: "#9CA3AF",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginTop: 16,
    marginBottom: 4,
  },
  emptyStateText: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
  },
  bottomSpacer: {
    height: 24,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  modalBody: {
    padding: 20,
  },
  modalDeliveryHeader: {
    marginBottom: 20,
  },
  modalDeliveryNumber: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 8,
  },
  modalStatusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  modalStatusText: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  modalSection: {
    marginBottom: 24,
  },
  modalSectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
  },
  modalRestaurantCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    padding: 12,
    borderRadius: 12,
    gap: 12,
  },
  modalRestaurantImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
  },
  modalRestaurantImagePlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  modalRestaurantInfo: {
    flex: 1,
  },
  modalRestaurantName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
  },
  modalCustomerCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    padding: 12,
    borderRadius: 12,
    gap: 12,
  },
  modalCustomerImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
  },
  modalCustomerImagePlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  modalCustomerInfo: {
    flex: 1,
  },
  modalCustomerName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
  },
  modalDetailsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  modalDetailItem: {
    width: "45%",
  },
  modalDetailLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 2,
  },
  modalDetailValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  modalActions: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  modalCloseButton: {
    backgroundColor: "#F3F4F6",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  modalCloseButtonText: {
    color: "#374151",
    fontSize: 15,
    fontWeight: "600",
  },

  // Add styles
  guestBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FF6B3510",
    padding: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FF6B35",
  },
  guestBannerText: {
    flex: 1,
    fontSize: 12,
    color: "#374151",
    marginLeft: 8,
  },
  guestBannerButton: {
    backgroundColor: "#FF6B35",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  guestBannerButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
});
