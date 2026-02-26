// app/(driver)/messages/index.tsx
import { useAuth } from "@/backend/AuthContext";
import { supabase } from "@/backend/supabase";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  FlatList,
  Image,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function DriverMessagesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState("all");

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const headerFade = useRef(new Animated.Value(0)).current;
  const headerSlide = useRef(new Animated.Value(-30)).current;
  const filterSlide = useRef(new Animated.Value(30)).current;

  // Item animations
  const itemAnimations = useRef<{ [key: string]: Animated.Value }>({}).current;

  useEffect(() => {
    if (user?.id) {
      // Start entrance animations
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 60,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 5,
          useNativeDriver: true,
        }),
        Animated.timing(headerFade, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.spring(headerSlide, {
          toValue: 0,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.spring(filterSlide, {
          toValue: 0,
          tension: 50,
          friction: 7,
          delay: 200,
          useNativeDriver: true,
        }),
      ]).start();

      fetchConversations();
      subscribeToConversations();
    }
  }, [user?.id]);

  const fetchConversations = async () => {
    try {
      setLoading(true);

      // Get conversations where driver is participant (with restaurants OR customers)
      const { data: driverConversations, error: convError } = await supabase
        .from("conversations")
        .select(
          `
          *,
          customer:users!conversations_customer_id_fkey(
            id,
            full_name,
            profile_image_url,
            phone
          ),
          restaurant:restaurants!conversations_restaurant_id_fkey(
            id,
            restaurant_name,
            image_url,
            address
          ),
          last_message_details:messages(
            message,
            created_at,
            sender_id
          )
        `,
        )
        .eq("driver_id", user.id)
        .eq("is_active", true)
        .order("last_message_at", { ascending: false });

      if (convError) throw convError;

      // Get active orders for order-based conversations
      const { data: orders, error: ordersError } = await supabase
        .from("orders")
        .select(
          `
          id,
          order_number,
          status,
          customer_id,
          restaurant_id,
          restaurants:restaurants!orders_restaurant_id_fkey(
            id,
            restaurant_name,
            image_url
          ),
          customers:users!orders_customer_id_fkey(
            id,
            full_name,
            profile_image_url
          )
        `,
        )
        .eq("driver_id", user.id)
        .in("status", ["ready", "out_for_delivery", "picked_up"])
        .order("created_at", { ascending: false });

      // Combine both types
      const allConversations = [
        ...(driverConversations || []).map((c) => ({
          ...c,
          type: c.restaurant_id ? "restaurant" : "customer",
          is_direct: true,
        })),
        ...(orders || []).map((o) => ({
          id: `order-${o.id}`,
          order_id: o.id,
          order_number: o.order_number,
          order_status: o.status,
          is_order_based: true,
          last_message: `Order #${o.order_number}`,
          last_message_at: o.created_at,
          unread_count_driver: 0,
          restaurant: o.restaurants,
          customer: o.customers,
          type: "order_based",
        })),
      ];

      // Sort by last_message_at
      allConversations.sort(
        (a, b) =>
          new Date(b.last_message_at).getTime() -
          new Date(a.last_message_at).getTime(),
      );

      // Create animations for new items
      allConversations.forEach((conv) => {
        if (!itemAnimations[conv.id]) {
          itemAnimations[conv.id] = new Animated.Value(0);
        }
      });

      setConversations(allConversations);

      // Animate items in
      Animated.stagger(
        50,
        allConversations.map((conv) =>
          Animated.timing(itemAnimations[conv.id], {
            toValue: 1,
            duration: 400,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ),
      ).start();
    } catch (error) {
      console.error("Error fetching conversations:", error);
      Alert.alert("Error", "Failed to load messages");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const subscribeToConversations = () => {
    const channel = supabase
      .channel("driver-messages-changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "driver_notifications",
          filter: `driver_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.new.type === "message") {
            // Animate new message arrival
            Animated.sequence([
              Animated.delay(100),
              Animated.timing(scaleAnim, {
                toValue: 1.02,
                duration: 200,
                useNativeDriver: true,
              }),
              Animated.spring(scaleAnim, {
                toValue: 1,
                tension: 100,
                friction: 5,
                useNativeDriver: true,
              }),
            ]).start();

            fetchConversations();
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const onRefresh = () => {
    setRefreshing(true);

    // Refresh animation
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.98,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 100,
        friction: 5,
        useNativeDriver: true,
      }),
    ]).start();

    fetchConversations();
  };

  const getUnreadCount = (conversation: any) => {
    return conversation.unread_count_driver || 0;
  };

  const getConversationName = (conversation: any) => {
    if (conversation.is_order_based) {
      return conversation.restaurant?.restaurant_name || "Restaurant";
    } else if (conversation.is_direct) {
      if (conversation.restaurant_id && conversation.restaurant) {
        return conversation.restaurant.restaurant_name || "Restaurant";
      }
      if (conversation.customer_id && conversation.customer) {
        return conversation.customer.full_name || "Customer";
      }
    }
    return "Chat";
  };

  const getConversationImage = (conversation: any) => {
    if (conversation.is_order_based) {
      return conversation.restaurant?.image_url;
    } else if (conversation.is_direct) {
      if (conversation.restaurant_id) {
        return conversation.restaurant?.image_url;
      }
      if (conversation.customer_id) {
        return conversation.customer?.profile_image_url;
      }
    }
    return null;
  };

  const getConversationType = (conversation: any) => {
    if (conversation.is_order_based) {
      return "order";
    } else if (conversation.is_direct) {
      return conversation.restaurant_id ? "restaurant" : "customer";
    }
    return "unknown";
  };

  const getLastMessagePreview = (conversation: any) => {
    if (conversation.last_message) {
      return conversation.last_message.length > 40
        ? conversation.last_message.substring(0, 40) + "..."
        : conversation.last_message;
    }
    return "No messages yet";
  };

  const getLastMessageTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 1) return "Just now";
    if (diffMinutes < 60) return `${diffMinutes}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const formatTime = (timestamp: string) => {
    return getLastMessageTime(timestamp);
  };

  const handleConversationPress = (conversation: any) => {
    // Animate press
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.98,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 150,
        friction: 5,
        useNativeDriver: true,
      }),
    ]).start();

    if (conversation.is_order_based) {
      // Order-based chat (with customer)
      router.push({
        pathname: "/(driver)/messages/[id]",
        params: {
          id: conversation.id,
          orderId: conversation.order_id,
          orderNumber: conversation.order_number,
          restaurantId: conversation.restaurant?.id,
          customerId: conversation.customer?.id,
          restaurantName: conversation.restaurant?.restaurant_name,
          customerName: conversation.customer?.full_name,
          restaurantImage: conversation.restaurant?.image_url,
          customerImage: conversation.customer?.profile_image_url,
          // Add timestamp to force refresh
          _t: Date.now().toString(),
        },
      });
    } else if (conversation.is_direct) {
      // Direct chat (with restaurant or customer)
      const params: any = {
        id: conversation.id,
        _t: Date.now().toString(), // Force refresh
      };

      if (conversation.restaurant_id && conversation.restaurant) {
        params.restaurantId = conversation.restaurant.id;
        params.restaurantName = conversation.restaurant.restaurant_name;
        params.restaurantImage = conversation.restaurant.image_url;
      }

      if (conversation.customer_id && conversation.customer) {
        params.customerId = conversation.customer.id;
        params.customerName = conversation.customer.full_name;
        params.customerImage = conversation.customer.profile_image_url;
      }

      router.push({
        pathname: "/(driver)/messages/[id]",
        params,
      });
    }
  };

  const filteredConversations = conversations.filter((conv) => {
    if (selectedFilter === "all") return true;
    if (selectedFilter === "unread") return getUnreadCount(conv) > 0;
    if (selectedFilter === "restaurant") return conv.type === "restaurant";
    if (selectedFilter === "customer") return conv.type === "customer";
    if (selectedFilter === "orders") return conv.type === "order_based";
    return true;
  });

  const renderConversationItem = ({
    item,
    index,
  }: {
    item: any;
    index: number;
  }) => {
    const unreadCount = getUnreadCount(item);
    const hasUnread = unreadCount > 0;
    const conversationName = getConversationName(item);
    const conversationImage = getConversationImage(item);
    const conversationType = getConversationType(item);
    const lastMessage = getLastMessagePreview(item);
    const lastMessageTime = getLastMessageTime(item.last_message_at);

    return (
      <Animated.View
        style={{
          opacity: itemAnimations[item.id] || fadeAnim,
          transform: [
            {
              translateX: (itemAnimations[item.id] || fadeAnim).interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0],
              }),
            },
            {
              scale: (itemAnimations[item.id] || fadeAnim).interpolate({
                inputRange: [0, 1],
                outputRange: [1, 1],
              }),
            },
          ],
        }}
      >
        <TouchableOpacity
          style={[
            styles.conversationItem,
            hasUnread && styles.conversationItemUnread,
          ]}
          onPress={() => handleConversationPress(item)}
          activeOpacity={0.7}
        >
          <View style={styles.avatarContainer}>
            {conversationImage ? (
              <Image
                source={{ uri: conversationImage }}
                style={styles.avatar}
              />
            ) : (
              <View
                style={[
                  styles.avatarPlaceholder,
                  conversationType === "customer" && {
                    backgroundColor: "#10B981",
                  },
                  conversationType === "order" && {
                    backgroundColor: "#8B5CF6",
                  },
                ]}
              >
                <Text style={styles.avatarInitials}>
                  {conversationName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}

            {/* Type indicator badge */}
            <View
              style={[
                styles.typeBadge,
                {
                  backgroundColor:
                    conversationType === "customer"
                      ? "#10B981"
                      : conversationType === "restaurant"
                        ? "#FF6B35"
                        : "#8B5CF6",
                },
              ]}
            >
              <Ionicons
                name={
                  conversationType === "customer"
                    ? "person"
                    : conversationType === "restaurant"
                      ? "restaurant"
                      : "receipt"
                }
                size={8}
                color="#fff"
              />
            </View>

            {hasUnread && <View style={styles.unreadDot} />}
          </View>

          <View style={styles.conversationContent}>
            <View style={styles.conversationHeader}>
              <View style={styles.nameContainer}>
                <Text
                  style={[
                    styles.conversationName,
                    hasUnread && styles.conversationNameUnread,
                  ]}
                  numberOfLines={1}
                >
                  {conversationName}
                </Text>
                <Text
                  style={[
                    styles.typeLabel,
                    {
                      color:
                        conversationType === "customer"
                          ? "#10B981"
                          : conversationType === "restaurant"
                            ? "#FF6B35"
                            : "#8B5CF6",
                    },
                  ]}
                >
                  {conversationType === "customer"
                    ? "Customer"
                    : conversationType === "restaurant"
                      ? "Restaurant"
                      : "Order"}
                </Text>
              </View>
              <Text style={styles.timeText}>{lastMessageTime}</Text>
            </View>

            <View style={styles.messagePreviewContainer}>
              <Text
                style={[
                  styles.lastMessage,
                  hasUnread && styles.lastMessageUnread,
                ]}
                numberOfLines={1}
              >
                {lastMessage}
              </Text>
              {hasUnread && (
                <View style={styles.unreadCountBadge}>
                  <Text style={styles.unreadCountText}>{unreadCount}</Text>
                </View>
              )}
            </View>

            {item.order_status && (
              <View style={styles.orderStatusContainer}>
                <View
                  style={[
                    styles.orderStatusBadge,
                    {
                      backgroundColor:
                        getOrderStatusColor(item.order_status) + "20",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.orderStatusText,
                      { color: getOrderStatusColor(item.order_status) },
                    ]}
                  >
                    {item.order_status?.replace("_", " ").toUpperCase()}
                  </Text>
                </View>
              </View>
            )}
          </View>

          <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
          </Animated.View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const getOrderStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "ready":
        return "#10B981";
      case "out_for_delivery":
        return "#3B82F6";
      case "picked_up":
        return "#8B5CF6";
      default:
        return "#6B7280";
    }
  };

  const FilterButton = ({ filter, label, icon, count = 0 }: any) => {
    const isActive = selectedFilter === filter;

    return (
      <TouchableOpacity
        onPress={() => setSelectedFilter(filter)}
        activeOpacity={0.7}
      >
        <Animated.View
          style={[
            styles.filterButton,
            isActive && styles.filterButtonActive,
            { transform: [{ translateY: filterSlide }] },
          ]}
        >
          <Ionicons
            name={icon}
            size={16}
            color={isActive ? "#FF6B35" : "#9CA3AF"}
          />
          <Text
            style={[
              styles.filterButtonText,
              isActive && styles.filterButtonTextActive,
            ]}
          >
            {label}
          </Text>
          {count > 0 && (
            <View
              style={[styles.filterCount, isActive && styles.filterCountActive]}
            >
              <Text style={styles.filterCountText}>{count}</Text>
            </View>
          )}
        </Animated.View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          }}
        >
          <ActivityIndicator size="large" color="#FF6B35" />
          <Text style={styles.loadingText}>Loading messages...</Text>
        </Animated.View>
      </SafeAreaView>
    );
  }

  const unreadCount = conversations.filter((c) => getUnreadCount(c) > 0).length;
  const restaurantCount = conversations.filter(
    (c) => c.type === "restaurant",
  ).length;
  const customerCount = conversations.filter(
    (c) => c.type === "customer",
  ).length;
  const orderCount = conversations.filter(
    (c) => c.type === "order_based",
  ).length;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Animated Header */}
      <Animated.View
        style={[
          styles.header,
          {
            opacity: headerFade,
            transform: [{ translateY: headerSlide }],
          },
        ]}
      >
        <View>
          <Text style={styles.headerTitle}>Messages</Text>
          <Text style={styles.headerSubtitle}>
            {filteredConversations.length} conversation
            {filteredConversations.length !== 1 ? "s" : ""}
          </Text>
        </View>

        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={onRefresh}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh-outline" size={20} color="#FF6B35" />
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>

      {/* Filter Buttons */}
      <Animated.View
        style={[
          styles.filterContainer,
          {
            opacity: headerFade,
            transform: [{ translateY: filterSlide }],
          },
        ]}
      >
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[
            {
              filter: "all",
              label: "All",
              icon: "apps-outline",
              count: conversations.length,
            },
            {
              filter: "unread",
              label: "Unread",
              icon: "mail-unread-outline",
              count: unreadCount,
            },
            {
              filter: "restaurant",
              label: "Restaurants",
              icon: "restaurant-outline",
              count: restaurantCount,
            },
            {
              filter: "customer",
              label: "Customers",
              icon: "person-outline",
              count: customerCount,
            },
            {
              filter: "orders",
              label: "Orders",
              icon: "receipt-outline",
              count: orderCount,
            },
          ]}
          renderItem={({ item }) => (
            <FilterButton
              filter={item.filter}
              label={item.label}
              icon={item.icon}
              count={item.count}
            />
          )}
          keyExtractor={(item) => item.filter}
          contentContainerStyle={styles.filterList}
        />
      </Animated.View>

      {/* Conversations List */}
      <FlatList
        data={filteredConversations}
        renderItem={renderConversationItem}
        keyExtractor={(item) => item.id}
        refreshing={refreshing}
        onRefresh={onRefresh}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          filteredConversations.length > 0 ? (
            <Animated.Text
              style={[styles.sectionHeader, { opacity: fadeAnim }]}
            >
              Recent Conversations
            </Animated.Text>
          ) : null
        }
        ListEmptyComponent={
          <Animated.View
            style={[
              styles.emptyState,
              {
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }],
              },
            ]}
          >
            <Ionicons
              name="chatbubble-ellipses-outline"
              size={80}
              color="#E5E7EB"
            />
            <Text style={styles.emptyTitle}>No messages yet</Text>
            <Text style={styles.emptyText}>
              {selectedFilter === "all"
                ? "Messages from restaurants and customers will appear here"
                : selectedFilter === "unread"
                  ? "No unread messages"
                  : `No ${selectedFilter} conversations found`}
            </Text>
          </Animated.View>
        }
      />
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
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#6B7280",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: "#fff",
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#111827",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 2,
  },
  refreshButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#F9FAFB",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  filterContainer: {
    backgroundColor: "#fff",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  filterList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    marginRight: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  filterButtonActive: {
    backgroundColor: "#FF6B3510",
    borderColor: "#FF6B35",
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#6B7280",
  },
  filterButtonTextActive: {
    color: "#FF6B35",
    fontWeight: "600",
  },
  filterCount: {
    backgroundColor: "#E5E7EB",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: "center",
  },
  filterCountActive: {
    backgroundColor: "#FF6B35",
  },
  filterCountText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#4B5563",
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 12,
    marginLeft: 4,
  },
  listContent: {
    padding: 14,
  },
  conversationItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    borderWidth: 0.8,
    borderColor: "#F3F4F6",
    elevation: 2,
  },
  conversationItemUnread: {
    backgroundColor: "#FFF7ED",
    borderColor: "#FFE4CC",
  },
  avatarContainer: {
    position: "relative",
    marginRight: 12,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: "#fff",
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#FF6B35",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  avatarInitials: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "600",
  },
  typeBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  unreadDot: {
    position: "absolute",
    top: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#FF6B35",
    borderWidth: 2,
    borderColor: "#fff",
  },
  conversationContent: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  nameContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  conversationName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    flex: 1,
  },
  conversationNameUnread: {
    fontWeight: "700",
    color: "#FF6B35",
  },
  typeLabel: {
    fontSize: 10,
    fontWeight: "600",
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  timeText: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  orderNumber: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 2,
  },
  orderNumberUnread: {
    color: "#374151",
    fontWeight: "600",
  },
  messagePreviewContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  lastMessage: {
    fontSize: 14,
    color: "#6B7280",
    flex: 1,
  },
  lastMessageUnread: {
    color: "#111827",
    fontWeight: "500",
  },
  unreadCountBadge: {
    backgroundColor: "#FF6B35",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
    minWidth: 24,
    alignItems: "center",
  },
  unreadCountText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
  orderStatusContainer: {
    flexDirection: "row",
    marginTop: 4,
  },
  orderStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  orderStatusText: {
    fontSize: 10,
    fontWeight: "600",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginTop: 16,
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    paddingHorizontal: 20,
  },
});
