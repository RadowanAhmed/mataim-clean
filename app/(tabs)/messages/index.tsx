// customer
// app/(tabs)/messages/index.tsx
import { useAuth } from "@/backend/AuthContext";
import { supabase } from "@/backend/supabase";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function MessagesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    if (user?.id) {
      // Start entrance animations
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 60,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start();

      fetchConversations();
      subscribeToConversations();
    }
  }, [user?.id]);

  const animateRefresh = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.98,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 6,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const fetchConversations = async () => {
    try {
      setLoading(true);

      let query = supabase
        .from("conversations")
        .select(
          `
        *,
        customer:users!conversations_customer_id_fkey(
          id,
          full_name,
          profile_image_url,
          user_type
        ),
        restaurant:restaurants!conversations_restaurant_id_fkey(
          id,
          restaurant_name,
          image_url
        ),
        driver:delivery_users!conversations_driver_id_fkey(
          id,
          users!inner(
            id,
            full_name,
            profile_image_url
          ),
          vehicle_type
        )
      `,
        )
        .eq("is_active", true)
        .order("last_message_at", { ascending: false });

      // Filter based on user type
      if (user?.user_type === "customer") {
        query = query.eq("customer_id", user.id);
      } else if (user?.user_type === "restaurant") {
        query = query.eq("restaurant_id", user.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      setConversations(data || []);
    } catch (error) {
      console.error("Error fetching conversations:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getConversationName = (conversation: any) => {
    if (user?.user_type === "customer") {
      if (conversation.restaurant_id) {
        return conversation.restaurant?.restaurant_name || "Restaurant";
      } else if (conversation.driver_id) {
        return conversation.driver?.users?.full_name || "Driver";
      }
    } else {
      return conversation.customer?.full_name || "Customer";
    }
    return "Chat";
  };

  const getConversationImage = (conversation: any) => {
    if (user?.user_type === "customer") {
      if (conversation.restaurant_id) {
        return conversation.restaurant?.image_url;
      } else if (conversation.driver_id) {
        return conversation.driver?.users?.profile_image_url;
      }
    } else {
      return conversation.customer?.profile_image_url;
    }
    return null;
  };

  const getConversationType = (conversation: any) => {
    if (user?.user_type === "customer") {
      if (conversation.restaurant_id) return "restaurant";
      if (conversation.driver_id) return "driver";
    }
    return "customer";
  };

  const subscribeToConversations = () => {
    const channel = supabase
      .channel("conversations-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversations",
          filter:
            user?.user_type === "customer"
              ? `customer_id=eq.${user.id}`
              : `restaurant_id=eq.${user.id}`,
        },
        () => {
          fetchConversations();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        async (payload) => {
          // If the message is for one of our conversations, update the list
          const { data: conversation } = await supabase
            .from("conversations")
            .select("id")
            .eq("id", payload.new.conversation_id)
            .single();

          if (conversation) {
            fetchConversations();
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const getUnreadCount = (conversation: any) => {
    if (user?.user_type === "customer") {
      return conversation.unread_count_customer || 0;
    } else {
      return conversation.unread_count_restaurant || 0;
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
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
    });
  };

  const onRefresh = () => {
    setRefreshing(true);
    animateRefresh();
    fetchConversations();
  };

  const renderConversationItem = ({
    item,
    index,
  }: {
    item: any;
    index: number;
  }) => {
    const animationDelay = Math.min(index * 50, 300);
    const unreadCount = getUnreadCount(item);
    const hasUnread = unreadCount > 0;
    const conversationName = getConversationName(item);
    const conversationImage = getConversationImage(item);
    const conversationType = getConversationType(item);

    return (
      <Animated.View
        style={{
          opacity: fadeAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 1],
          }),
          transform: [
            {
              translateY: slideAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0],
              }),
            },
            {
              scale: scaleAnim,
            },
          ],
        }}
      >
        <TouchableOpacity
          style={[
            styles.conversationItem,
            hasUnread && styles.conversationItemUnread,
          ]}
          onPress={() => router.push(`/(tabs)/messages/${item.id}`)}
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
                  conversationType === "driver" && {
                    backgroundColor: "#8B5CF6",
                  },
                ]}
              >
                <Text style={styles.avatarInitials}>
                  {conversationName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            {hasUnread && <View style={styles.unreadDot} />}
          </View>

          <View style={styles.conversationInfo}>
            <View style={styles.conversationHeader}>
              <Text
                style={[
                  styles.conversationName,
                  hasUnread && styles.conversationNameUnread,
                ]}
                numberOfLines={1}
              >
                {getConversationName(item)}
              </Text>
              <View style={styles.timeContainer}>
                <Ionicons
                  name="time-outline"
                  size={10}
                  color="#9CA3AF"
                  style={styles.timeIcon}
                />
                <Text style={styles.timeText}>
                  {formatTime(item.last_message_at)}
                </Text>
              </View>
            </View>
            <View style={styles.lastMessageContainer}>
              <Text
                style={[
                  styles.lastMessage,
                  hasUnread && styles.lastMessageUnread,
                ]}
                numberOfLines={2}
              >
                {item.last_message || "No messages yet"}
              </Text>
              {hasUnread && (
                <View style={styles.unreadIndicator}>
                  <Ionicons name="ellipse" size={8} color="#FF6B35" />
                </View>
              )}
            </View>
          </View>

          <Ionicons
            name="chevron-forward"
            size={18}
            color="#D1D5DB"
            style={styles.chevronIcon}
          />
        </TouchableOpacity>
      </Animated.View>
    );
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Animated.View
          style={{
            opacity: fadeAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 1],
            }),
          }}
        >
          <ActivityIndicator size="large" color="#FF6B35" />
          <Text style={styles.loadingText}>Loading messages...</Text>
        </Animated.View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Animated Header */}
      <Animated.View
        style={[
          styles.header,
          {
            opacity: fadeAnim,
            transform: [
              {
                translateY: slideAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-20, 0],
                }),
              },
            ],
          },
        ]}
      >
        <View style={styles.headerTitleContainer}>
          <Ionicons
            name="chatbubbles-outline"
            size={22}
            color="#FF6B35"
            style={styles.headerIcon}
          />
          <Text style={styles.headerTitle}>Messages</Text>
        </View>
        <TouchableOpacity style={styles.newMessageButton} activeOpacity={0.7}>
          <Ionicons name="create-outline" size={22} color="#FF6B35" />
        </TouchableOpacity>
      </Animated.View>

      {conversations.length === 0 ? (
        <Animated.View
          style={[
            styles.emptyState,
            {
              opacity: fadeAnim,
              transform: [
                {
                  scale: scaleAnim,
                },
              ],
            },
          ]}
        >
          <Ionicons
            name="chatbubble-ellipses-outline"
            size={80}
            color="#E5E7EB"
          />
          <Text style={styles.emptyStateTitle}>No messages yet</Text>
          <Text style={styles.emptyStateText}>
            Start a conversation with{" "}
            {user?.user_type === "customer" ? "a restaurant" : "a customer"}
          </Text>
          <TouchableOpacity style={styles.emptyStateButton} activeOpacity={0.7}>
            <Ionicons name="add-circle" size={18} color="#fff" />
            <Text style={styles.emptyStateButtonText}>Start New Chat</Text>
          </TouchableOpacity>
        </Animated.View>
      ) : (
        <Animated.FlatList
          data={conversations}
          renderItem={renderConversationItem}
          keyExtractor={(item) => item.id}
          refreshing={refreshing}
          onRefresh={onRefresh}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
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
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    backgroundColor: "#fff",
  },
  headerTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerIcon: {
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
  },
  newMessageButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFF7ED",
    justifyContent: "center",
    alignItems: "center",
  },
  conversationItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    backgroundColor: "#fff",
  },
  conversationItemUnread: {
    backgroundColor: "#FFF7ED",
  },
  avatarContainer: {
    position: "relative",
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#FF6B35",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  avatarInitials: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "600",
  },
  unreadBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    backgroundColor: "#EF4444",
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  unreadBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
  conversationInfo: {
    flex: 1,
    marginLeft: 16,
  },
  conversationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  conversationName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    flex: 1,
  },
  conversationNameUnread: {
    color: "#111827",
    fontWeight: "700",
  },
  timeContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  timeIcon: {
    marginRight: 4,
  },
  timeText: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  lastMessageContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  lastMessage: {
    fontSize: 14,
    color: "#6B7280",
    lineHeight: 18,
    flex: 1,
  },
  lastMessageUnread: {
    color: "#374151",
    fontWeight: "500",
  },
  unreadIndicator: {
    marginLeft: 8,
  },
  chevronIcon: {
    marginLeft: 12,
  },
  listContent: {
    paddingBottom: 20,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#374151",
    marginTop: 20,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: "#9CA3AF",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  emptyStateButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FF6B35",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    shadowColor: "#FF6B35",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  emptyStateButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 8,
  },

  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FF6B35",
  },
});
