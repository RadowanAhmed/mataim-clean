// app/(restaurant)/messages/index.tsx
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
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function RestaurantMessagesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const searchSlide = useRef(new Animated.Value(-50)).current;

  useEffect(() => {
    if (user?.id) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 600,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(searchSlide, {
          toValue: 0,
          tension: 70,
          friction: 6,
          useNativeDriver: true,
          delay: 200,
        }),
      ]).start();

      fetchConversations();
      subscribeToConversations();
    }
  }, [user?.id]);

  const fetchConversations = async () => {
    try {
      setLoading(true);

      // Get conversations where restaurant is participant (with customers OR drivers)
      const { data, error } = await supabase
        .from("conversations")
        .select(
          `
          *,
          customer:users!conversations_customer_id_fkey(
            id,
            full_name,
            profile_image_url,
            phone,
            email
          ),
          driver:delivery_users!conversations_driver_id_fkey(
            id,
            users!inner(
              id,
              full_name,
              profile_image_url,
              phone
            ),
            vehicle_type,
            rating
          )
        `,
        )
        .eq("restaurant_id", user.id)
        .eq("is_active", true)
        .order("last_message_at", { ascending: false });

      if (error) throw error;
      setConversations(data || []);
    } catch (error) {
      console.error("Error fetching conversations:", error);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToConversations = () => {
    const channel = supabase
      .channel("restaurant-conversations-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversations",
          filter: `restaurant_id=eq.${user.id}`,
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
          const { data: conversation } = await supabase
            .from("conversations")
            .select("restaurant_id")
            .eq("id", payload.new.conversation_id)
            .single();

          if (conversation?.restaurant_id === user.id) {
            fetchConversations();
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const getConversationName = (conversation: any) => {
    if (conversation.customer_id && conversation.customer) {
      return conversation.customer.full_name || "Customer";
    } else if (conversation.driver_id && conversation.driver) {
      return conversation.driver.users?.full_name || "Driver";
    }
    return "Chat";
  };

  const getConversationImage = (conversation: any) => {
    if (conversation.customer_id && conversation.customer) {
      return conversation.customer.profile_image_url;
    } else if (conversation.driver_id && conversation.driver) {
      return conversation.driver.users?.profile_image_url;
    }
    return null;
  };

  const getConversationType = (conversation: any) => {
    if (conversation.customer_id) return "customer";
    if (conversation.driver_id) return "driver";
    return "unknown";
  };

  const getUnreadCount = (conversation: any) => {
    return conversation.unread_count_restaurant || 0;
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

  const filteredConversations = conversations.filter(
    (conv) =>
      (conv.customer?.full_name || conv.driver?.users?.full_name || "")
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      conv.last_message?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const getTodayConversationsCount = () => {
    const today = new Date().getDate();
    return conversations.filter(
      (c) => new Date(c.last_message_at).getDate() === today,
    ).length;
  };

  const getUnreadConversationsCount = () => {
    return conversations.filter((c) => c.unread_count_restaurant > 0).length;
  };

  const renderConversationItem = ({ item }: { item: any }) => {
    const unreadCount = getUnreadCount(item);
    const hasUnread = unreadCount > 0;
    const conversationName = getConversationName(item);
    const conversationImage = getConversationImage(item);
    const conversationType = getConversationType(item);

    return (
      <TouchableOpacity
        style={[
          styles.conversationItem,
          hasUnread && styles.conversationItemUnread,
        ]}
        onPress={() => router.push(`/(restaurant)/messages/${item.id}`)}
        onLongPress={() => {
          if (item.customer?.id) {
            router.push(`/(restaurant)/customers/${item.customer.id}`);
          }
        }}
        delayLongPress={500}
        activeOpacity={0.7}
      >
        <View style={styles.avatarContainer}>
          {conversationImage ? (
            <View style={styles.avatarImageContainer}>
              <Image
                source={{ uri: conversationImage }}
                style={styles.avatar}
              />
            </View>
          ) : (
            <View
              style={[
                styles.avatarPlaceholder,
                conversationType === "driver" && { backgroundColor: "#8B5CF6" },
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
                  conversationType === "customer" ? "#10B981" : "#8B5CF6",
              },
            ]}
          >
            <Ionicons
              name={conversationType === "customer" ? "person" : "bicycle"}
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
              <Text style={styles.typeLabel}>
                {conversationType === "customer" ? "Customer" : "Driver"}
              </Text>
            </View>
            <Text style={styles.timeText}>
              {formatTime(item.last_message_at)}
            </Text>
          </View>

          <Text
            style={[styles.lastMessage, hasUnread && styles.lastMessageUnread]}
            numberOfLines={2}
          >
            {item.last_message || "No messages yet"}
          </Text>

          {unreadCount > 0 && (
            <View style={styles.unreadCounter}>
              <Text style={styles.unreadCounterText}>{unreadCount} new</Text>
            </View>
          )}
        </View>

        <View style={styles.arrowIcon}>
          <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={styles.loadingText}>Loading messages...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <Animated.View
        style={[
          styles.header,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <View>
          <Text style={styles.headerTitle}>Messages</Text>
          <Text style={styles.headerSubtitle}>All conversations</Text>
        </View>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={fetchConversations}
        >
          <Ionicons name="refresh-outline" size={20} color="#FF6B35" />
        </TouchableOpacity>
      </Animated.View>

      <Animated.View
        style={[
          styles.searchContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateY: searchSlide }],
          },
        ]}
      >
        <View style={styles.searchWrapper}>
          <Ionicons name="search-outline" size={20} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search conversations..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>

      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <View style={[styles.statIcon, { backgroundColor: "#FEE2E2" }]}>
            <Ionicons name="mail-unread-outline" size={20} color="#EF4444" />
          </View>
          <Text style={styles.statCount}>{getUnreadConversationsCount()}</Text>
          <Text style={styles.statLabel}>Unread</Text>
        </View>

        <View style={styles.statCard}>
          <View style={[styles.statIcon, { backgroundColor: "#FFEDD5" }]}>
            <Ionicons name="chatbubbles-outline" size={20} color="#FF6B35" />
          </View>
          <Text style={styles.statCount}>{conversations.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>

        <View style={styles.statCard}>
          <View style={[styles.statIcon, { backgroundColor: "#D1FAE5" }]}>
            <Ionicons name="today-outline" size={20} color="#10B981" />
          </View>
          <Text style={styles.statCount}>{getTodayConversationsCount()}</Text>
          <Text style={styles.statLabel}>Today</Text>
        </View>
      </View>

      <ScrollView style={styles.conversationsList}>
        {filteredConversations.length === 0 ? (
          <View style={styles.emptyState}>
            {searchQuery ? (
              <>
                <Ionicons name="search-outline" size={60} color="#E5E7EB" />
                <Text style={styles.emptyTitle}>No results found</Text>
                <Text style={styles.emptyText}>
                  Try a different search term
                </Text>
              </>
            ) : (
              <>
                <Ionicons
                  name="chatbubble-ellipses-outline"
                  size={60}
                  color="#E5E7EB"
                />
                <Text style={styles.emptyTitle}>No messages yet</Text>
                <Text style={styles.emptyText}>
                  Messages will appear here when you chat with customers or
                  drivers
                </Text>
              </>
            )}
          </View>
        ) : (
          filteredConversations.map((item) => (
            <Animated.View
              key={item.id}
              style={{
                opacity: fadeAnim,
              }}
            >
              {renderConversationItem({ item })}
            </Animated.View>
          ))
        )}
      </ScrollView>
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
    paddingHorizontal: 16,
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
    borderRadius: 22,
    backgroundColor: "#F9FAFB",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  searchWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 0.1,
    borderColor: "#000",
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 12,
    paddingHorizontal: 8,
    color: "#111827",
  },
  statsContainer: {
    flexDirection: "row",
    paddingHorizontal: 18,
    marginBottom: 16,
    gap: 14,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    borderRadius: 16,
    padding: 14,
    alignItems: "center",
    borderWidth: 0.2,
    borderColor: "#F9FAFB",
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  statCount: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
  },
  statLabel: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "500",
  },
  conversationsList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  conversationItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 0.6,
    borderColor: "#E5E7EB",
  },
  conversationItemUnread: {
    backgroundColor: "#FFF7ED",
    borderColor: "#FFE4CC",
  },
  avatarContainer: {
    position: "relative",
  },
  avatarImageContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    overflow: "hidden",
  },
  avatar: {
    width: "100%",
    height: "100%",
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#FF6B35",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInitials: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  typeBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 16,
    height: 16,
    borderRadius: 8,
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
    marginLeft: 12,
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
    color: "#9CA3AF",
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  timeText: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  lastMessage: {
    fontSize: 14,
    color: "#6B7280",
    lineHeight: 18,
  },
  lastMessageUnread: {
    color: "#374151",
    fontWeight: "500",
  },
  unreadCounter: {
    alignSelf: "flex-start",
    backgroundColor: "#FF6B35",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 6,
  },
  unreadCounterText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "600",
  },
  arrowIcon: {
    marginLeft: 8,
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
