// app/(tabs)/favorites/favorites.tsx
import { useAuth } from "@/backend/AuthContext";
import { supabase } from "@/backend/supabase";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function FavoritesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchFavorites = useCallback(async () => {
    if (!user?.id) {
      setFavorites([]);
      setLoading(false);
      return;
    }

    try {
      // First get favorite post IDs
      const { data: favData, error: favError } = await supabase
        .from("favorites")
        .select("post_id, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (favError) throw favError;

      if (!favData || favData.length === 0) {
        setFavorites([]);
        return;
      }

      const postIds = favData.map((f) => f.post_id);

      // Then fetch full post details
      const { data: postsData, error: postsError } = await supabase
        .from("posts")
        .select(
          `
          id,
          title,
          description,
          image_url,
          post_type,
          discount_percentage,
          original_price,
          discounted_price,
          available_until,
          likes_count,
          comments_count,
          view_count,
          tags,
          created_at,
          restaurants!inner (
            restaurant_name,
            cuisine_type,
            restaurant_rating,
            delivery_fee,
            min_order_amount,
            image_url
          )
        `,
        )
        .in("id", postIds)
        .eq("is_active", true);

      if (postsError) throw postsError;

      // Combine with created_at from favorites
      const favoritesWithDates = (postsData || []).map((post) => {
        const fav = favData.find((f) => f.post_id === post.id);
        return {
          ...post,
          favorited_at: fav?.created_at,
          distanceText: `${(Math.random() * 3 + 0.5).toFixed(1)}km`,
          restaurant_name: post.restaurants?.restaurant_name || "Restaurant",
          restaurant_rating: post.restaurants?.restaurant_rating || 4.0,
        };
      });

      setFavorites(favoritesWithDates);
    } catch (error) {
      console.error("Error fetching favorites:", error);
      Alert.alert("Error", "Failed to load favorites");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      fetchFavorites();
    }, [fetchFavorites]),
  );

  const handleRemoveFavorite = async (postId: string) => {
    Alert.alert(
      "Remove from Favorites",
      "Are you sure you want to remove this item?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await supabase
                .from("favorites")
                .delete()
                .eq("post_id", postId)
                .eq("user_id", user?.id);

              if (error) throw error;

              setFavorites((prev) => prev.filter((item) => item.id !== postId));
            } catch (error) {
              console.error("Error removing favorite:", error);
              Alert.alert("Error", "Failed to remove from favorites");
            }
          },
        },
      ],
    );
  };

  const handlePostPress = (post: any) => {
    router.push({
      pathname: "/post/[id]",
      params: { id: post.id, restaurantId: post.restaurant_id },
    });
  };

  const getTimeRemaining = (availableUntil: string) => {
    if (!availableUntil) return null;
    try {
      const end = new Date(availableUntil);
      const now = new Date();
      const days = Math.ceil(
        (end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (days <= 0) return "Ended";
      if (days === 1) return "1 day left";
      if (days < 7) return `${days} days left`;
      return "Limited time";
    } catch {
      return null;
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffDays = Math.floor(
        (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (diffDays === 0) return "Today";
      if (diffDays === 1) return "Yesterday";
      if (diffDays < 7) return `${diffDays} days ago`;
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    } catch {
      return "";
    }
  };

  const renderFavoriteItem = ({ item }: { item: any }) => {
    const timeLeft = getTimeRemaining(item.available_until);
    const discountPercentage = item.discount_percentage;

    return (
      <TouchableOpacity
        style={styles.favoriteCard}
        onPress={() => handlePostPress(item)}
        activeOpacity={0.8}
      >
        <View style={styles.imageContainer}>
          <Image
            source={{
              uri:
                item.image_url ||
                "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&h=300&fit=crop",
            }}
            style={styles.image}
          />
          {discountPercentage > 0 && (
            <View style={styles.discountBadge}>
              <Text style={styles.discountText}>{discountPercentage}% OFF</Text>
            </View>
          )}
          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => handleRemoveFavorite(item.id)}
          >
            <Ionicons name="close" size={16} color="#fff" />
          </TouchableOpacity>
        </View>

        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.8)"]}
          style={styles.gradient}
        >
          <View style={styles.content}>
            <View style={styles.header}>
              <Text style={styles.title} numberOfLines={1}>
                {item.title}
              </Text>
              <View style={styles.rating}>
                <Ionicons name="star" size={12} color="#FFD700" />
                <Text style={styles.ratingText}>
                  {item.restaurant_rating?.toFixed(1)}
                </Text>
              </View>
            </View>

            <Text style={styles.restaurant} numberOfLines={1}>
              {item.restaurant_name}
            </Text>

            {item.description && (
              <Text style={styles.description} numberOfLines={2}>
                {item.description}
              </Text>
            )}

            <View style={styles.footer}>
              <View style={styles.priceContainer}>
                {item.discounted_price ? (
                  <>
                    <Text style={styles.discountedPrice}>
                      AED {item.discounted_price}
                    </Text>
                    <Text style={styles.originalPrice}>
                      AED {item.original_price}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.price}>AED {item.original_price}</Text>
                )}
              </View>

              <View style={styles.stats}>
                <View style={styles.stat}>
                  <Ionicons name="heart" size={12} color="#EF4444" />
                  <Text style={styles.statText}>{item.likes_count || 0}</Text>
                </View>
                <View style={styles.stat}>
                  <Ionicons name="chatbubble" size={12} color="#fff" />
                  <Text style={styles.statText}>
                    {item.comments_count || 0}
                  </Text>
                </View>
              </View>

              <Text style={styles.favoritedDate}>
                Saved {formatDate(item.favorited_at)}
              </Text>
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  if (!user?.id) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Favorites</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.emptyContainer}>
          <Ionicons name="heart-outline" size={64} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>Login to view favorites</Text>
          <Text style={styles.emptyText}>
            Sign in to save and see your favorite items
          </Text>
          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => router.push("/(auth)/signin")}
          >
            <Text style={styles.loginButtonText}>Login</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Favorites</Text>
        <Text style={styles.headerCount}>{favorites.length}</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6B35" />
          <Text style={styles.loadingText}>Loading favorites...</Text>
        </View>
      ) : favorites.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="heart-outline" size={64} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>No favorites yet</Text>
          <Text style={styles.emptyText}>
            Tap the ❤️ on items you love to save them here
          </Text>
          <TouchableOpacity
            style={styles.browseButton}
            onPress={() => router.push("/(tabs)")}
          >
            <Text style={styles.browseButtonText}>Browse Items</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={favorites}
          renderItem={renderFavoriteItem}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchFavorites();
              }}
              colors={["#FF6B35"]}
              tintColor="#FF6B35"
            />
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    marginBottom: -22,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  headerCount: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FF6B35",
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
  listContent: {
    padding: 16,
    gap: 16,
  },
  favoriteCard: {
    height: 300,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#000",
  },
  imageContainer: {
    position: "relative",
    width: "100%",
    height: "100%",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  discountBadge: {
    position: "absolute",
    top: 16,
    left: 16,
    backgroundColor: "#FF6B35",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  discountText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  removeButton: {
    position: "absolute",
    top: 16,
    right: 16,
    backgroundColor: "rgba(0,0,0,0.5)",
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#fff",
  },
  gradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
  },
  content: {
    gap: 8,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: "#fff",
    flex: 1,
    marginRight: 8,
  },
  rating: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  ratingText: {
    fontSize: 12,
    color: "#fff",
    fontWeight: "600",
  },
  restaurant: {
    fontSize: 14,
    color: "#E5E7EB",
  },
  description: {
    fontSize: 13,
    color: "#D1D5DB",
    lineHeight: 18,
  },
  footer: {
    marginTop: 8,
    gap: 8,
  },
  priceContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  discountedPrice: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFD700",
  },
  originalPrice: {
    fontSize: 14,
    color: "#9CA3AF",
    textDecorationLine: "line-through",
  },
  price: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFD700",
  },
  metaContainer: {
    flexDirection: "row",
    gap: 12,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: "#E5E7EB",
  },
  stats: {
    flexDirection: "row",
    gap: 12,
  },
  stat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statText: {
    fontSize: 12,
    color: "#fff",
  },
  favoritedDate: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
  },
  browseButton: {
    backgroundColor: "#FF6B35",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  browseButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  loginButton: {
    backgroundColor: "#3B82F6",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  loginButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});
