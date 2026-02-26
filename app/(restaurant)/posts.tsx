// app/(restaurant)/posts.tsx
import { useAuth } from "@/backend/AuthContext";
import { supabase } from "@/backend/supabase";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { MotiText, MotiView } from "moti";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Animated,
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
import {
  GestureHandlerRootView,
  Swipeable,
} from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";

const { width } = Dimensions.get("window");

export default function RestaurantPostsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [posts, setPosts] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState("all"); // 'all', 'active', 'inactive'

  useEffect(() => {
    fetchPosts();
  }, [user]);

  const fetchPosts = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      let query = supabase
        .from("posts")
        .select("*")
        .eq("restaurant_id", user.id)
        .order("created_at", { ascending: false });

      // Apply filters
      if (filter === "active") {
        query = query.eq("is_active", true);
      } else if (filter === "inactive") {
        query = query.eq("is_active", false);
      }

      const { data, error } = await query;

      if (error) throw error;
      setPosts(data || []);
    } catch (error) {
      console.error("Error fetching posts:", error);
      Alert.alert("Error", "Failed to load posts");
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchPosts();
    setRefreshing(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const deletePost = async (postId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    Alert.alert("Delete Post", "Are you sure you want to delete this post?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const { error } = await supabase
              .from("posts")
              .delete()
              .eq("id", postId)
              .eq("restaurant_id", user.id);

            if (error) throw error;

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            Alert.alert("Success", "Post deleted successfully");
            fetchPosts();
          } catch (error) {
            console.error("Error deleting post:", error);
            Alert.alert("Error", "Failed to delete post");
          }
        },
      },
    ]);
  };

  const togglePostStatus = async (postId: string, currentStatus: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const { error } = await supabase
        .from("posts")
        .update({ is_active: !currentStatus })
        .eq("id", postId)
        .eq("restaurant_id", user.id);

      if (error) throw error;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        "Success",
        `Post ${currentStatus ? "deactivated" : "activated"} successfully`,
      );
      fetchPosts();
    } catch (error) {
      console.error("Error updating post:", error);
      Alert.alert("Error", "Failed to update post");
    }
  };

  const handleQuickAction = (
    postId: string,
    action: "share" | "analytics" | "boost",
  ) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    switch (action) {
      case "share":
        // Implement share functionality
        Alert.alert("Share", "Share functionality would go here");
        break;
      case "analytics":
        router.push(`/(restaurant)/posts/analytics?id=${postId}`);
        break;
      case "boost":
        Alert.alert("Boost", "Boost post functionality");
        break;
    }
  };

  const renderRightActions = (progress, dragX, item) => {
    const trans = dragX.interpolate({
      inputRange: [-100, 0],
      outputRange: [0, 60],
      extrapolate: "clamp",
    });

    return (
      <Animated.View
        style={[styles.swipeActions, { transform: [{ translateX: trans }] }]}
      >
        <TouchableOpacity
          style={[styles.swipeButton, { backgroundColor: "#3B82F6" }]}
          onPress={() => router.push(`/(restaurant)/posts/edit?id=${item.id}`)}
        >
          <Ionicons name="pencil" size={20} color="#fff" />
          <Text style={styles.swipeButtonText}>Edit</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.swipeButton,
            { backgroundColor: item.is_active ? "#6B7280" : "#10B981" },
          ]}
          onPress={() => togglePostStatus(item.id, item.is_active)}
        >
          <Ionicons
            name={item.is_active ? "pause" : "play"}
            size={20}
            color="#fff"
          />
          <Text style={styles.swipeButtonText}>
            {item.is_active ? "Pause" : "Activate"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.swipeButton, { backgroundColor: "#EF4444" }]}
          onPress={() => deletePost(item.id)}
        >
          <Ionicons name="trash" size={20} color="#fff" />
          <Text style={styles.swipeButtonText}>Delete</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderPostItem = ({ item, index }) => (
    <MotiView
      from={{ opacity: 0, translateY: 50 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ delay: index * 100 }}
    >
      <Swipeable
        renderRightActions={(progress, dragX) =>
          renderRightActions(progress, dragX, item)
        }
        friction={2}
        rightThreshold={40}
      >
        <View style={styles.postCard}>
          <View style={styles.postCardHeader}>
            <View style={styles.postHeaderLeft}>
              <View
                style={[
                  styles.postTypeBadge,
                  {
                    backgroundColor:
                      item.post_type === "promotion"
                        ? "#FF6B3515"
                        : item.post_type === "event"
                          ? "#8B5CF615"
                          : "#10B98115",
                  },
                ]}
              >
                <Ionicons
                  name={
                    item.post_type === "promotion"
                      ? "flash"
                      : item.post_type === "event"
                        ? "calendar"
                        : "megaphone"
                  }
                  size={12}
                  color={
                    item.post_type === "promotion"
                      ? "#FF6B35"
                      : item.post_type === "event"
                        ? "#8B5CF6"
                        : "#10B981"
                  }
                />
                <Text
                  style={[
                    styles.postTypeText,
                    {
                      color:
                        item.post_type === "promotion"
                          ? "#FF6B35"
                          : item.post_type === "event"
                            ? "#8B5CF6"
                            : "#10B981",
                    },
                  ]}
                >
                  {item.post_type}
                </Text>
              </View>

              <MotiView
                animate={{
                  scale: item.is_active ? [1, 1.2, 1] : 1,
                }}
                transition={{
                  type: "timing",
                  duration: 2000,
                  loop: item.is_active,
                }}
              >
                <View
                  style={[
                    styles.statusIndicator,
                    { backgroundColor: item.is_active ? "#10B981" : "#6B7280" },
                  ]}
                >
                  <Text style={styles.statusIndicatorText}>
                    {item.is_active ? "●" : "○"}
                  </Text>
                </View>
              </MotiView>
            </View>

            <Text style={styles.postDate}>
              {new Date(item.created_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </Text>
          </View>

          <View style={styles.postContent}>
            {item.image_url ? (
              <Image
                source={{ uri: item.image_url }}
                style={styles.postImage}
                resizeMode="cover"
              />
            ) : (
              <LinearGradient
                colors={["#F3F4F6", "#E5E7EB"]}
                style={styles.imagePlaceholder}
              >
                <Ionicons name="image-outline" size={32} color="#9CA3AF" />
              </LinearGradient>
            )}

            <View style={styles.postInfo}>
              <View style={styles.postTitleRow}>
                <Text style={styles.postTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <View style={styles.quickActions}>
                  <TouchableOpacity
                    style={styles.quickActionButton}
                    onPress={() => handleQuickAction(item.id, "share")}
                  >
                    <Ionicons name="share-outline" size={16} color="#6B7280" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.quickActionButton}
                    onPress={() => handleQuickAction(item.id, "analytics")}
                  >
                    <Ionicons name="stats-chart" size={16} color="#6B7280" />
                  </TouchableOpacity>
                </View>
              </View>

              {item.description && (
                <Text style={styles.postDescription} numberOfLines={2}>
                  {item.description}
                </Text>
              )}

              {(item.original_price || item.discounted_price) && (
                <View style={styles.priceContainer}>
                  {item.original_price && (
                    <Text style={styles.originalPrice}>
                      AED {item.original_price.toFixed(2)}
                    </Text>
                  )}
                  {item.discounted_price && (
                    <View style={styles.discountContainer}>
                      <Text style={styles.discountedPrice}>
                        AED {item.discounted_price.toFixed(2)}
                      </Text>
                      {item.discount_percentage && (
                        <View style={styles.discountBadge}>
                          <Text style={styles.discountText}>
                            {item.discount_percentage}% OFF
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              )}

              <View style={styles.postStats}>
                <View style={styles.statItem}>
                  <Ionicons name="eye" size={14} color="#6B7280" />
                  <Text style={styles.statText}>
                    {(item.view_count || 0).toLocaleString()}
                  </Text>
                </View>
                <View style={styles.statItem}>
                  <Ionicons name="heart" size={14} color="#EF4444" />
                  <Text style={styles.statText}>
                    {(item.likes_count || 0).toLocaleString()}
                  </Text>
                </View>
                <View style={styles.statItem}>
                  <Ionicons name="chatbubble" size={14} color="#6B7280" />
                  <Text style={styles.statText}>
                    {(item.comments_count || 0).toLocaleString()}
                  </Text>
                </View>
                <View style={styles.statItem}>
                  <Ionicons name="arrow-redo" size={14} color="#6B7280" />
                  <Text style={styles.statText}>
                    {(item.shares_count || 0).toLocaleString()}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      </Swipeable>
    </MotiView>
  );

  const FilterButton = ({ label, value, isActive, onPress }) => (
    <TouchableOpacity
      style={[styles.filterButton, isActive && styles.filterButtonActive]}
      onPress={() => {
        setFilter(value);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }}
    >
      <Text style={[styles.filterText, isActive && styles.filterTextActive]}>
        {label}
      </Text>
      {isActive && (
        <MotiView
          from={{ scale: 0 }}
          animate={{ scale: 1 }}
          style={styles.filterActiveDot}
        />
      )}
    </TouchableOpacity>
  );

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <MotiView
          animate={{ rotate: "360deg" }}
          transition={{
            type: "timing",
            duration: 1000,
            loop: true,
          }}
        >
          <Ionicons name="infinite" size={48} color="#FF6B35" />
        </MotiView>
        <MotiText
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ type: "timing", duration: 1000, loop: true }}
          style={styles.loadingText}
        >
          Loading posts...
        </MotiText>
      </SafeAreaView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />

        {/* Modern Header */}
        <BlurView intensity={90} tint="light" style={styles.header}>
          <View style={styles.headerContent}>
            <View>
              <Text style={styles.headerTitle}>Posts & Promotions</Text>
              <Text style={styles.headerSubtitle}>
                {posts.length} {posts.length === 1 ? "post" : "posts"} total
              </Text>
            </View>

            <TouchableOpacity
              style={styles.createButton}
              onPress={() => {
                router.push("/(restaurant)/posts/create");
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              }}
            >
              <LinearGradient
                colors={["#FF6B35", "#FF8B35"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.gradientButton}
              >
                <Ionicons name="add" size={18} color="#fff" />
                <Text style={styles.createButtonText}>New Post</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Filter Tabs */}
          <View style={styles.filterContainer}>
            <FilterButton
              label="All Posts"
              value="all"
              isActive={filter === "all"}
              onPress={setFilter}
            />
            <FilterButton
              label="Active"
              value="active"
              isActive={filter === "active"}
              onPress={setFilter}
            />
            <FilterButton
              label="Inactive"
              value="inactive"
              isActive={filter === "inactive"}
              onPress={setFilter}
            />
          </View>
        </BlurView>

        {posts.length === 0 ? (
          <MotiView
            from={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            style={styles.emptyState}
          >
            <LinearGradient
              colors={["#F9FAFB", "#F3F4F6"]}
              style={styles.emptyStateGradient}
            >
              <Ionicons name="newspaper" size={64} color="#D1D5DB" />
              <Text style={styles.emptyStateTitle}>No posts yet</Text>
              <Text style={styles.emptyStateText}>
                Create your first post or promotion to engage with customers
              </Text>
              <TouchableOpacity
                style={styles.emptyStateButton}
                onPress={() => {
                  router.push("/(restaurant)/posts/create");
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                }}
              >
                <LinearGradient
                  colors={["#FF6B35", "#FF8B35"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.emptyStateButtonGradient}
                >
                  <Ionicons name="add" size={16} color="#fff" />
                  <Text style={styles.emptyStateButtonText}>
                    Create First Post
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </LinearGradient>
          </MotiView>
        ) : (
          <FlatList
            data={posts}
            renderItem={renderPostItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#FF6B35"
                colors={["#FF6B35"]}
                progressBackgroundColor="#F3F4F6"
              />
            }
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        )}
      </SafeAreaView>
    </GestureHandlerRootView>
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
    backgroundColor: "#F9FAFB",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "500",
  },
  header: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    paddingTop: 8,
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
    fontWeight: "400",
  },
  createButton: {
    borderRadius: 12,
    overflow: "hidden",
    elevation: 3,
    shadowColor: "#FF6B35",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  gradientButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  createButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  filterContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  filterButtonActive: {
    backgroundColor: "#FF6B3515",
    borderWidth: 1,
    borderColor: "#FF6B35",
  },
  filterText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },
  filterTextActive: {
    color: "#FF6B35",
  },
  filterActiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#FF6B35",
  },
  listContent: {
    padding: 16,
  },
  separator: {
    height: 12,
  },
  postCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    overflow: "hidden",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: "#6B728014",
  },
  postCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  postHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  postTypeBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  postTypeText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  statusIndicatorText: {
    color: "#fff",
    fontSize: 8,
    fontWeight: "bold",
  },
  postDate: {
    fontSize: 11,
    color: "#9CA3AF",
    fontWeight: "500",
  },
  postContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  postImage: {
    width: "100%",
    height: 200,
    borderRadius: 12,
    marginBottom: 12,
  },
  imagePlaceholder: {
    width: "100%",
    height: 200,
    borderRadius: 12,
    marginBottom: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  postInfo: {
    gap: 8,
  },
  postTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  postTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
    flex: 1,
    marginRight: 8,
  },
  quickActions: {
    flexDirection: "row",
    gap: 8,
  },
  quickActionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  postDescription: {
    fontSize: 13,
    color: "#6B7280",
    lineHeight: 18,
    fontWeight: "400",
  },
  priceContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  originalPrice: {
    fontSize: 14,
    color: "#9CA3AF",
    textDecorationLine: "line-through",
    fontWeight: "500",
  },
  discountContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  discountedPrice: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FF6B35",
  },
  discountBadge: {
    backgroundColor: "#FF6B3515",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  discountText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#FF6B35",
  },
  postStats: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statText: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "600",
  },
  swipeActions: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 8,
  },
  swipeButton: {
    width: 60,
    height: "90%",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
    borderRadius: 12,
    paddingHorizontal: 8,
  },
  swipeButtonText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
    marginTop: 4,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  emptyStateGradient: {
    width: "100%",
    alignItems: "center",
    padding: 40,
    borderRadius: 24,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
    fontWeight: "400",
  },
  emptyStateButton: {
    borderRadius: 12,
    overflow: "hidden",
    elevation: 2,
    shadowColor: "#FF6B35",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  emptyStateButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  emptyStateButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
});
