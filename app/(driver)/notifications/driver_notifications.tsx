// app/(driver)/notifications/driver_notifications.tsx - MODERN REDESIGN
import { useAuth } from "@/backend/AuthContext";
import { useNotification } from "@/backend/NotificationContext";
import { supabase } from "@/backend/supabase";
import animations from "@/constent/animations";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import LottieView from "lottie-react-native";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  FadeInDown,
  FadeInRight,
  Layout,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

const { width } = Dimensions.get("window");

interface Notification {
  id: string;
  title: string;
  body: string;
  type:
    | "order"
    | "earning"
    | "system"
    | "rating"
    | "message"
    | "delivery"
    | "assignment";
  data: any;
  read: boolean;
  created_at: string;
  read_at: string | null;
  posts?: {
    id: string;
    title: string;
    image_url: string;
    description?: string;
  } | null;
  order_data?: any;
  restaurant_data?: any;
}

const NOTIFICATION_TYPES = {
  order: {
    icon: "bicycle-outline",
    filledIcon: "bicycle",
    color: "#0891B2",
    lightColor: "#E0F2FE",
    gradient: ["#06B6D4", "#0891B2"],
    name: "Delivery",
  },
  earning: {
    icon: "wallet-outline",
    filledIcon: "wallet",
    color: "#059669",
    lightColor: "#D1FAE5",
    gradient: ["#10B981", "#059669"],
    name: "Earnings",
  },
  system: {
    icon: "settings-outline",
    filledIcon: "settings",
    color: "#7C3AED",
    lightColor: "#EDE9FE",
    gradient: ["#8B5CF6", "#7C3AED"],
    name: "System",
  },
  rating: {
    icon: "star-outline",
    filledIcon: "star",
    color: "#D97706",
    lightColor: "#FEF3C7",
    gradient: ["#F59E0B", "#D97706"],
    name: "Rating",
  },
  message: {
    icon: "chatbubble-outline",
    filledIcon: "chatbubble",
    color: "#8B5CF6",
    lightColor: "#F3E8FF",
    gradient: ["#A78BFA", "#8B5CF6"],
    name: "Message",
  },
  delivery: {
    icon: "navigate-outline",
    filledIcon: "navigate",
    color: "#2563EB",
    lightColor: "#DBEAFE",
    gradient: ["#3B82F6", "#2563EB"],
    name: "Delivery",
  },
  assignment: {
    icon: "checkmark-circle-outline",
    filledIcon: "checkmark-circle",
    color: "#059669",
    lightColor: "#D1FAE5",
    gradient: ["#10B981", "#059669"],
    name: "Assignment",
  },
};

export default function DriverNotificationsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { markAsRead, clearBadgeCount } = useNotification();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState("all");
  const [stats, setStats] = useState({
    total: 0,
    unread: 0,
    orders: 0,
    earnings: 0,
    messages: 0,
    delivery: 0,
  });

  const fetchNotifications = useCallback(async () => {
    if (!user?.id) {
      setNotifications([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      setLoading(true);

      let query = supabase
        .from("driver_notifications")
        .select("*")
        .eq("driver_id", user.id)
        .order("created_at", { ascending: false });

      if (activeFilter === "unread") {
        query = query.eq("read", false);
      } else if (activeFilter !== "all") {
        query = query.eq("type", activeFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      const postIds = new Set<string>();
      const orderIds = new Set<string>();
      const conversationIds = new Set<string>();

      data?.forEach((notification) => {
        if (notification.data?.post_id) {
          postIds.add(notification.data.post_id);
        }
        if (notification.data?.order_id) {
          orderIds.add(notification.data.order_id);
        }
        if (notification.data?.conversation_id) {
          conversationIds.add(notification.data.conversation_id);
        }
      });

      let postsMap = {};
      if (postIds.size > 0) {
        const { data: postsData } = await supabase
          .from("posts")
          .select("id, title, description, image_url")
          .in("id", Array.from(postIds));

        postsData?.forEach((post) => {
          postsMap[post.id] = {
            id: post.id,
            title: post.title,
            description: post.description,
            image_url: post.image_url,
          };
        });
      }

      let ordersMap = {};
      let restaurantIds = new Set<string>();
      if (orderIds.size > 0) {
        const { data: ordersData } = await supabase
          .from("orders")
          .select(
            `
            id, 
            post_id, 
            restaurant_id,
            order_number,
            final_amount,
            status,
            restaurants:restaurants!orders_restaurant_id_fkey(
              restaurant_name,
              image_url
            )
          `,
          )
          .in("id", Array.from(orderIds));

        ordersData?.forEach((order) => {
          ordersMap[order.id] = order;
          if (order.restaurant_id) {
            restaurantIds.add(order.restaurant_id);
          }
        });
      }

      let restaurantsMap = {};
      if (restaurantIds.size > 0) {
        const { data: restaurantsData } = await supabase
          .from("restaurants")
          .select("id, restaurant_name, image_url")
          .in("id", Array.from(restaurantIds));

        restaurantsData?.forEach((restaurant) => {
          restaurantsMap[restaurant.id] = restaurant;
        });
      }

      let conversationsMap = {};
      if (conversationIds.size > 0) {
        const { data: conversationsData } = await supabase
          .from("conversations")
          .select(
            `
            id,
            restaurant_id,
            customer_id,
            restaurant:restaurants!conversations_restaurant_id_fkey(
              restaurant_name,
              image_url
            )
          `,
          )
          .in("id", Array.from(conversationIds));

        conversationsData?.forEach((conv) => {
          conversationsMap[conv.id] = conv;
        });
      }

      const enhancedNotifications = (data || []).map((notification) => {
        let postData = null;
        let orderData = null;
        let restaurantData = null;
        let conversationData = null;

        const postId = notification.data?.post_id;
        if (postId && postsMap[postId]) {
          postData = postsMap[postId];
        } else if (notification.data?.order_id) {
          const order = ordersMap[notification.data.order_id];
          if (order?.post_id && postsMap[order.post_id]) {
            postData = postsMap[order.post_id];
          }
        }

        if (notification.data?.order_id) {
          orderData = ordersMap[notification.data.order_id];
        }

        if (
          orderData?.restaurant_id &&
          restaurantsMap[orderData.restaurant_id]
        ) {
          restaurantData = restaurantsMap[orderData.restaurant_id];
        } else if (notification.data?.restaurant_id) {
          restaurantData = restaurantsMap[notification.data.restaurant_id];
        }

        if (notification.data?.conversation_id) {
          conversationData =
            conversationsMap[notification.data.conversation_id];
        }

        return {
          ...notification,
          posts: postData,
          order_data: orderData,
          restaurant_data:
            restaurantData ||
            orderData?.restaurants ||
            notification.data?.restaurant,
          conversation_data: conversationData,
        };
      });

      setNotifications(enhancedNotifications);

      const total = enhancedNotifications.length;
      const unread = enhancedNotifications.filter((n) => !n.read).length;
      const orders = enhancedNotifications.filter(
        (n) => n.type === "order",
      ).length;
      const earnings = enhancedNotifications.filter(
        (n) => n.type === "earning",
      ).length;
      const messages = enhancedNotifications.filter(
        (n) => n.type === "message",
      ).length;
      const delivery = enhancedNotifications.filter(
        (n) => n.type === "delivery" || n.type === "assignment",
      ).length;

      setStats({ total, unread, orders, earnings, messages, delivery });

      if (activeFilter === "all") {
        clearBadgeCount();
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
      Alert.alert("Error", "Failed to load notifications");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id, activeFilter]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n)),
      );

      const { error } = await supabase
        .from("driver_notifications")
        .update({
          read: true,
          read_at: new Date().toISOString(),
        })
        .eq("id", notificationId);

      if (error) throw error;

      await markAsRead(notificationId);

      setStats((prev) => ({
        ...prev,
        unread: Math.max(0, prev.unread - 1),
      }));
    } catch (error) {
      console.error("Error marking as read:", error);
      fetchNotifications();
    }
  };

  const handleNotificationPress = (notification: Notification) => {
    // Mark as read if unread
    if (!notification.read) {
      handleMarkAsRead(notification.id);
    }

    // Handle different notification types
    if (notification.type === "message") {
      // Extract ALL possible data sources for message notifications
      const conversationId = notification.data?.conversation_id;
      const orderId = notification.data?.order_id;

      // Try multiple paths to get restaurant ID
      const restaurantId =
        notification.data?.restaurant_id ||
        notification.data?.sender_id ||
        notification.restaurant_data?.id ||
        notification.data?.restaurant?.id ||
        notification.conversation_data?.restaurant_id;

      // Try multiple paths to get restaurant name
      const restaurantName =
        notification.data?.restaurant_name ||
        notification.restaurant_data?.restaurant_name ||
        notification.data?.restaurant?.restaurant_name ||
        notification.conversation_data?.restaurant?.restaurant_name ||
        "Restaurant";

      // Try multiple paths to get restaurant image
      const restaurantImage =
        notification.data?.restaurant_image ||
        notification.data?.sender_image_url ||
        notification.restaurant_data?.image_url ||
        notification.data?.restaurant?.image_url ||
        notification.conversation_data?.restaurant?.image_url;

      // Get customer ID if available
      const customerId =
        notification.data?.customer_id ||
        notification.conversation_data?.customer_id;

      console.log("📱 Message notification pressed:", {
        conversationId,
        orderId,
        restaurantId,
        restaurantName,
        customerId,
      });

      // CASE 1: We have a direct conversation ID
      if (conversationId) {
        router.push({
          pathname: "/(driver)/messages/[id]",
          params: {
            id: conversationId,
            orderId: orderId || "",
            restaurantId: restaurantId || "",
            customerId: customerId || "",
            restaurantName: restaurantName,
            restaurantImage: restaurantImage || "",
          },
        });
      }
      // CASE 2: We have an order ID - will need to resolve/find conversation
      else if (orderId) {
        router.push({
          pathname: "/(driver)/messages/[id]",
          params: {
            id: `order-${orderId}`,
            orderId: orderId,
            restaurantId: restaurantId || "",
            customerId: customerId || "",
            restaurantName: restaurantName,
            restaurantImage: restaurantImage || "",
          },
        });
      }
      // CASE 3: We have restaurant ID but no conversation/order - create new
      else if (restaurantId) {
        // Check if we need customer ID - you might need to fetch this
        if (!customerId) {
          Alert.alert(
            "Cannot Open Chat",
            "Customer information is missing. Please try again from the order screen.",
            [{ text: "OK" }],
          );
          return;
        }

        router.push({
          pathname: "/(driver)/messages/[id]",
          params: {
            id: `new-${Date.now()}`,
            restaurantId: restaurantId,
            customerId: customerId,
            restaurantName: restaurantName,
            restaurantImage: restaurantImage || "",
          },
        });
      }
      // CASE 4: No usable identifiers
      else {
        Alert.alert(
          "Cannot Open Chat",
          "Unable to open this conversation. Please try again from the messages screen.",
          [{ text: "OK" }],
        );
      }
    }

    // Handle order notifications
    else if (notification.type === "order" && notification.data?.order_id) {
      router.push(`/(driver)/order-detail/${notification.data.order_id}`);
    }

    // Handle delivery notifications
    else if (notification.type === "delivery" && notification.data?.order_id) {
      router.push(`/(driver)/order-detail/${notification.data.order_id}`);
    }

    // Handle assignment notifications
    else if (
      notification.type === "assignment" &&
      notification.data?.order_id
    ) {
      router.push(`/(driver)/order-detail/${notification.data.order_id}`);
    }

    // Handle earning notifications
    else if (notification.type === "earning") {
      router.push("/(driver)/earnings");
    }

    // Handle any notification with a screen path
    else if (notification.data?.screen) {
      router.push(notification.data.screen);
    }

    // Default fallback
    else {
      console.log("No navigation handler for notification:", notification);
    }
  };

  const markAllAsRead = async () => {
    if (!user?.id) return;

    try {
      const { error } = await supabase
        .from("driver_notifications")
        .update({
          read: true,
          read_at: new Date().toISOString(),
        })
        .eq("driver_id", user.id)
        .eq("read", false);

      if (error) throw error;

      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      clearBadgeCount();
      setStats((prev) => ({ ...prev, unread: 0 }));
    } catch (error) {
      console.error("Error marking all as read:", error);
    }
  };

  const getTimeAgo = (timestamp: string) => {
    const now = new Date();
    const date = new Date(timestamp);
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 1) return "Just now";
    if (diffMinutes < 60) return `${diffMinutes}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const renderNotification = ({
    item,
    index,
  }: {
    item: Notification;
    index: number;
  }) => {
    const notificationType =
      NOTIFICATION_TYPES[item.type as keyof typeof NOTIFICATION_TYPES] ||
      NOTIFICATION_TYPES.system;

    const isMessage = item.type === "message";
    const senderName = item.data?.sender_name || "Restaurant";
    const restaurantInfo = item.restaurant_data || item.data?.restaurant;

    return (
      <Animated.View
        entering={FadeInDown.delay(index * 50).springify()}
        layout={Layout.springify()}
      >
        <TouchableOpacity
          style={[styles.notificationCard, !item.read && styles.unreadCard]}
          onPress={() => handleNotificationPress(item)}
          activeOpacity={0.7}
        >
          <LinearGradient
            colors={
              !item.read ? ["#FFFFFF", "#FAFAFA"] : ["#FFFFFF", "#FFFFFF"]
            }
            style={styles.cardGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />

          <View style={styles.notificationLeft}>
            {isMessage && item.data?.sender_image_url ? (
              <View style={styles.imageWrapper}>
                <Image
                  source={{ uri: item.data.sender_image_url }}
                  style={styles.notificationImage}
                />
                <View
                  style={[
                    styles.typeIconBadge,
                    { backgroundColor: notificationType.lightColor },
                  ]}
                >
                  <Ionicons
                    name="chatbubble"
                    size={8}
                    color={notificationType.color}
                  />
                </View>
              </View>
            ) : item.posts?.image_url ? (
              <View style={styles.imageWrapper}>
                <Image
                  source={{ uri: item.posts.image_url }}
                  style={styles.notificationImage}
                />
              </View>
            ) : (
              <LinearGradient
                colors={notificationType.gradient}
                style={styles.iconWrapper}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons
                  name={
                    item.read
                      ? notificationType.icon
                      : notificationType.filledIcon
                  }
                  size={24}
                  color="#FFFFFF"
                />
              </LinearGradient>
            )}

            {!item.read && (
              <View style={styles.unreadDot}>
                <LinearGradient
                  colors={notificationType.gradient}
                  style={styles.unreadDotGradient}
                />
              </View>
            )}
          </View>

          <View style={styles.notificationContent}>
            <View style={styles.notificationHeader}>
              <View style={styles.titleRow}>
                <Text style={styles.notificationTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                {item.type === "earning" && item.data?.amount && (
                  <View
                    style={[
                      styles.amountBadge,
                      { backgroundColor: notificationType.lightColor },
                    ]}
                  >
                    <Text
                      style={[
                        styles.amountText,
                        { color: notificationType.color },
                      ]}
                    >
                      +AED {parseFloat(item.data.amount).toFixed(2)}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={styles.notificationTime}>
                {getTimeAgo(item.created_at)}
              </Text>
            </View>

            {(restaurantInfo?.restaurant_name ||
              item.order_data?.order_number ||
              item.posts) && (
              <View style={styles.contextContainer}>
                {restaurantInfo?.restaurant_name && (
                  <View style={styles.contextChip}>
                    <Ionicons
                      name="restaurant-outline"
                      size={12}
                      color="#64748B"
                    />
                    <Text style={styles.contextText} numberOfLines={1}>
                      {restaurantInfo.restaurant_name}
                    </Text>
                  </View>
                )}
                {item.posts && !restaurantInfo?.restaurant_name && (
                  <View style={styles.contextChip}>
                    <Ionicons name="cube-outline" size={12} color="#64748B" />
                    <Text style={styles.contextText} numberOfLines={1}>
                      {item.posts.title}
                    </Text>
                  </View>
                )}
                {item.order_data?.order_number && (
                  <View style={[styles.contextChip, styles.orderChip]}>
                    <Ionicons
                      name="receipt-outline"
                      size={12}
                      color="#0891B2"
                    />
                    <Text style={[styles.contextText, styles.orderChipText]}>
                      #{item.order_data.order_number}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {isMessage ? (
              <View style={styles.messagePreview}>
                <Text style={styles.senderName}>{senderName}:</Text>
                <Text style={styles.messageText} numberOfLines={1}>
                  {item.body}
                </Text>
              </View>
            ) : (
              <Text style={styles.notificationBody} numberOfLines={2}>
                {item.body}
              </Text>
            )}

            <View style={styles.notificationFooter}>
              <View
                style={[
                  styles.typeBadge,
                  { backgroundColor: notificationType.lightColor },
                ]}
              >
                <Ionicons
                  name={notificationType.icon}
                  size={10}
                  color={notificationType.color}
                />
                <Text
                  style={[styles.typeText, { color: notificationType.color }]}
                >
                  {notificationType.name}
                </Text>
              </View>

              {item.type === "order" && item.order_data?.final_amount && (
                <Text
                  style={[styles.amountText, { color: notificationType.color }]}
                >
                  AED {item.order_data.final_amount.toFixed(2)}
                </Text>
              )}
            </View>
          </View>

          {!item.read && (
            <TouchableOpacity
              style={styles.markReadButton}
              onPress={() => handleMarkAsRead(item.id)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="checkmark-circle" size={20} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const FilterButton = ({ filter, label, icon, color }: any) => {
    const isActive = activeFilter === filter;
    let count = 0;

    if (filter === "all") count = stats.total;
    else if (filter === "unread") count = stats.unread;
    else if (filter === "message") count = stats.messages;
    else if (filter === "order") count = stats.orders;
    else if (filter === "earning") count = stats.earnings;

    return (
      <TouchableOpacity
        onPress={() => setActiveFilter(filter)}
        style={styles.filterButtonWrapper}
      >
        <Animated.View entering={FadeInRight}>
          <LinearGradient
            colors={
              isActive
                ? NOTIFICATION_TYPES[filter]?.gradient || ["#FF6B35", "#FF8C5A"]
                : ["#F1F5F9", "#F1F5F9"]
            }
            style={styles.filterButton}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Ionicons
              name={icon}
              size={14}
              color={isActive ? "#FFFFFF" : color || "#64748B"}
            />
            <Text
              style={[styles.filterText, isActive && styles.filterTextActive]}
            >
              {label}
            </Text>
            {count > 0 && (
              <View
                style={[
                  styles.filterCount,
                  isActive && styles.filterCountActive,
                ]}
              >
                <Text
                  style={[
                    styles.filterCountText,
                    isActive && styles.filterCountTextActive,
                  ]}
                >
                  {count > 9 ? "9+" : count}
                </Text>
              </View>
            )}
          </LinearGradient>
        </Animated.View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6B35" />
          <Text style={styles.loadingText}>Loading notifications...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#0F172A" />
        </TouchableOpacity>

        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Notifications</Text>
          {stats.unread > 0 && (
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>{stats.unread}</Text>
            </View>
          )}
        </View>

        {stats.unread > 0 && (
          <TouchableOpacity
            style={styles.markAllButton}
            onPress={markAllAsRead}
          >
            <LinearGradient
              colors={["#FF6B35", "#FF8C5A"]}
              style={styles.markAllGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name="checkmark-done" size={16} color="#FFFFFF" />
              <Text style={styles.markAllText}>Mark all</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.total}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: "#FF6B35" }]}>
            {stats.unread}
          </Text>
          <Text style={styles.statLabel}>Unread</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: "#8B5CF6" }]}>
            {stats.messages}
          </Text>
          <Text style={styles.statLabel}>Messages</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: "#0891B2" }]}>
            {stats.orders}
          </Text>
          <Text style={styles.statLabel}>Orders</Text>
        </View>
      </View>

      <View style={styles.filtersSection}>
        <FlatList
          horizontal
          data={[
            {
              filter: "all",
              label: "All",
              icon: "apps-outline",
              color: "#64748B",
            },
            {
              filter: "unread",
              label: "Unread",
              icon: "mail-unread-outline",
              color: "#FF6B35",
            },
            {
              filter: "message",
              label: "Messages",
              icon: "chatbubble-outline",
              color: "#8B5CF6",
            },
            {
              filter: "order",
              label: "Orders",
              icon: "bicycle-outline",
              color: "#0891B2",
            },
            {
              filter: "earning",
              label: "Earnings",
              icon: "wallet-outline",
              color: "#059669",
            },
          ]}
          renderItem={({ item }) => <FilterButton {...item} />}
          keyExtractor={(item) => item.filter}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersList}
        />
      </View>

      <FlatList
        data={notifications}
        renderItem={renderNotification}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#FF6B35"]}
            tintColor="#FF6B35"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <LottieView
              source={
                animations.driver_empty_state || animations.driver_searching
              }
              style={styles.emptyAnimation}
              autoPlay
              loop={false}
            />
            <Text style={styles.emptyTitle}>
              {activeFilter === "unread"
                ? "All caught up! 🎉"
                : activeFilter === "message"
                  ? "No messages yet"
                  : activeFilter === "order"
                    ? "No delivery notifications"
                    : activeFilter === "earning"
                      ? "No earning notifications"
                      : "No notifications yet"}
            </Text>
            <Text style={styles.emptyText}>
              {activeFilter === "message"
                ? "Messages from restaurants will appear here"
                : activeFilter === "order"
                  ? "Delivery updates will appear here"
                  : "We'll notify you when something new arrives"}
            </Text>
          </View>
        }
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    marginBottom: -22,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: "#64748B",
    fontWeight: "500",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F8FAFC",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0F172A",
  },
  headerBadge: {
    backgroundColor: "#FF6B35",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  headerBadgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  markAllButton: {
    borderRadius: 20,
    overflow: "hidden",
  },
  markAllGradient: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
  },
  markAllText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  statsContainer: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginTop: 16,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: "#E2E8F0",
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "500",
  },
  statDivider: {
    width: 1,
    backgroundColor: "#E2E8F0",
    marginHorizontal: 4,
  },
  filtersSection: {
    marginTop: 16,
    marginBottom: 8,
  },
  filtersList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterButtonWrapper: {
    marginRight: 8,
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  filterText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
  },
  filterTextActive: {
    color: "#FFFFFF",
  },
  filterCount: {
    backgroundColor: "rgba(0,0,0,0.05)",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: "center",
  },
  filterCountActive: {
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  filterCountText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#475569",
  },
  filterCountTextActive: {
    color: "#FFFFFF",
  },
  listContainer: {
    padding: 16,
    paddingTop: 8,
  },
  notificationCard: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
    overflow: "hidden",
  },
  cardGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  unreadCard: {
    shadowColor: "#FF6B35",
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  notificationLeft: {
    marginRight: 14,
    position: "relative",
  },
  imageWrapper: {
    width: 56,
    height: 56,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#F1F5F9",
  },
  notificationImage: {
    width: "100%",
    height: "100%",
  },
  iconWrapper: {
    width: 56,
    height: 56,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  typeIconBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  unreadDot: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },
  unreadDotGradient: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  titleRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginRight: 8,
  },
  notificationTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
    flex: 1,
  },
  notificationTime: {
    fontSize: 11,
    color: "#94A3B8",
    fontWeight: "500",
  },
  amountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  amountText: {
    fontSize: 11,
    fontWeight: "700",
  },
  contextContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 8,
  },
  contextChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    gap: 4,
  },
  contextText: {
    fontSize: 11,
    color: "#475569",
    fontWeight: "500",
  },
  orderChip: {
    backgroundColor: "#E0F2FE",
  },
  orderChipText: {
    color: "#0891B2",
  },
  messagePreview: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    padding: 8,
    borderRadius: 10,
    marginBottom: 8,
    gap: 4,
  },
  senderName: {
    fontSize: 12,
    fontWeight: "600",
    color: "#8B5CF6",
  },
  messageText: {
    fontSize: 12,
    color: "#475569",
    flex: 1,
  },
  notificationBody: {
    fontSize: 13,
    color: "#64748B",
    lineHeight: 18,
    marginBottom: 8,
  },
  notificationFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
    alignSelf: "flex-start",
  },
  typeText: {
    fontSize: 10,
    fontWeight: "600",
  },
  markReadButton: {
    marginLeft: 8,
    justifyContent: "center",
  },
  emptyState: {
    paddingVertical: 60,
    alignItems: "center",
  },
  emptyAnimation: {
    width: 160,
    height: 160,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    maxWidth: 250,
    lineHeight: 20,
  },
});
