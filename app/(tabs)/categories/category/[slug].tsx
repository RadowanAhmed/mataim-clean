// app/(tabs)/category/[slug].tsx
import { useAuth } from "@/backend/AuthContext";
import { supabase } from "@/backend/supabase";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
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

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Category images mapping
const CATEGORY_IMAGES: { [key: string]: string } = {
  Arabic:
    "https://images.unsplash.com/photo-1563245372-f21724e3856d?w=400&h=300&fit=crop",
  Indian:
    "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=400&h=300&fit=crop",
  Italian:
    "https://images.unsplash.com/photo-1579684947550-22e945225d9a?w=400&h=300&fit=crop",
  Pizza:
    "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&h=300&fit=crop",
  Burgers:
    "https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=400&h=300&fit=crop",
  Sushi:
    "https://images.unsplash.com/photo-1553621042-f6e147245754?w=400&h=300&fit=crop",
  Chinese:
    "https://images.unsplash.com/photo-1525755662777-989b66e3895c?w=400&h=300&fit=crop",
  Desserts:
    "https://images.unsplash.com/photo-1551024506-0bccd828d307?w=400&h=300&fit=crop",
  Seafood:
    "https://images.unsplash.com/photo-1559847844-5315695dadae?w=400&h=300&fit=crop",
  Mexican:
    "https://images.unsplash.com/photo-1599974579688-8dbdd335c77f?w=400&h=300&fit=crop",
  Thai: "https://images.unsplash.com/photo-1559314809-0d155014e29e?w=400&h=300&fit=crop",
  Japanese:
    "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=400&h=300&fit=crop",
  Korean:
    "https://images.unsplash.com/photo-1590301157890-4810ed352733?w=400&h=300&fit=crop",
  Vietnamese:
    "https://images.unsplash.com/photo-1582878826629-39b7ad3e4f5c?w=400&h=300&fit=crop",
  Lebanese:
    "https://images.unsplash.com/photo-1564834744159-ff0ea41ba4b9?w=400&h=300&fit=crop",
  Turkish:
    "https://images.unsplash.com/photo-1544148103-077e404be65a?w=400&h=300&fit=crop",
};

// Filter options
type FilterType = "all" | "restaurants" | "posts" | "deals";

export default function CategoryScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const { user } = useAuth();

  // State
  const [categoryName, setCategoryName] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Data states
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());

  // Pagination
  const [restaurantsPage, setRestaurantsPage] = useState(1);
  const [restaurantsHasMore, setRestaurantsHasMore] = useState(true);
  const [restaurantsLoading, setRestaurantsLoading] = useState(false);

  const [postsPage, setPostsPage] = useState(1);
  const [postsHasMore, setPostsHasMore] = useState(true);
  const [postsLoading, setPostsLoading] = useState(false);

  const [dealsPage, setDealsPage] = useState(1);
  const [dealsHasMore, setDealsHasMore] = useState(true);
  const [dealsLoading, setDealsLoading] = useState(false);

  // Format category name from slug
  useEffect(() => {
    if (slug) {
      const formatted = slug
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
      setCategoryName(formatted);
    }
  }, [slug]);

  // Load initial data
  useEffect(() => {
    loadInitialData();
  }, [categoryName]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      fetchRestaurants(1, true),
      fetchPosts(1, true),
      fetchDeals(1, true),
      fetchLikedPosts(),
    ]);
    setRefreshing(false);
  }, []);

  // Fetch liked posts
  const fetchLikedPosts = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { data } = await supabase
        .from("post_likes")
        .select("post_id")
        .eq("user_id", user.id);

      if (data) {
        setLikedPosts(new Set(data.map((like) => like.post_id)));
      }
    } catch (error) {
      console.error("Error fetching liked posts:", error);
    }
  }, [user?.id]);

  // Fetch restaurants by cuisine
  // app/category/[slug].tsx - Updated fetchRestaurants

  // Fetch restaurants by cuisine type
  const fetchRestaurants = useCallback(
    async (page: number = 1, reset: boolean = false) => {
      if (!categoryName) return;

      try {
        if (reset) {
          setRestaurantsLoading(true);
        } else {
          setRestaurantsLoading(true);
        }

        const from = (page - 1) * 6;
        const to = from + 5;

        const { data, error } = await supabase
          .from("restaurants")
          .select(
            `
        id,
        restaurant_name,
        cuisine_type,
        restaurant_rating,
        image_url,
        delivery_fee,
        min_order_amount,
        restaurant_status,
        opening_hours,
        has_delivery
      `,
          )
          .eq("restaurant_status", "active")
          .ilike("cuisine_type", `%${categoryName}%`)
          .order("restaurant_rating", { ascending: false })
          .range(from, to);

        if (error) throw error;

        const transformed = (data || []).map((restaurant, index) => ({
          id: restaurant.id,
          name: restaurant.restaurant_name,
          cuisine: restaurant.cuisine_type,
          rating: restaurant.restaurant_rating || 4.0,
          // Use default delivery time since column doesn't exist
          deliveryTime: "25-35 min",
          price: "$$",
          image:
            restaurant.image_url ||
            CATEGORY_IMAGES[categoryName] ||
            "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&h=300&fit=crop",
          promotion: restaurant.delivery_fee === 0 ? "Free Delivery" : null,
          isOpen: true,
          deliveryFee:
            restaurant.delivery_fee === 0
              ? "Free"
              : `AED ${restaurant.delivery_fee || 5}`,
          minOrder: `AED ${restaurant.min_order_amount || 20}`,
          distance: `${(index * 0.5 + 0.5).toFixed(1)} km`,
        }));

        setRestaurants((prev) =>
          reset ? transformed : [...prev, ...transformed],
        );
        setRestaurantsHasMore((data?.length || 0) === 6);
        setRestaurantsPage(page);
      } catch (error) {
        console.error("Error fetching restaurants:", error);
      } finally {
        setRestaurantsLoading(false);
      }
    },
    [categoryName],
  );

  // Fetch posts by restaurant cuisine type
  const fetchPosts = useCallback(
    async (page: number = 1, reset: boolean = false) => {
      if (!categoryName) return;

      try {
        if (reset) {
          setPostsLoading(true);
        } else {
          setPostsLoading(true);
        }

        const from = (page - 1) * 6;
        const to = from + 5;

        const { data, error } = await supabase
          .from("posts")
          .select(
            `
        id,
        restaurant_id,
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
          .eq("is_active", true)
          .ilike("restaurants.cuisine_type", `%${categoryName}%`)
          .order("created_at", { ascending: false })
          .range(from, to);

        if (error) throw error;

        const transformed = (data || []).map((post, index) => ({
          ...post,
          distanceText: `${(((post.id?.charCodeAt(0) || index) % 30) + 5) / 10}km`,
          likes_count: post.likes_count || 0,
          comments_count: post.comments_count || 0,
          view_count: post.view_count || 0,
          restaurant_name: post.restaurants?.restaurant_name || "Restaurant",
          cuisine_type: post.restaurants?.cuisine_type || "Various",
          restaurant_rating: post.restaurants?.restaurant_rating || 4.0,
          delivery_fee:
            post.restaurants?.delivery_fee === 0
              ? "Free"
              : `AED ${post.restaurants?.delivery_fee || 5}`,
          min_order_amount: `AED ${post.restaurants?.min_order_amount || 25}`,
        }));

        setPosts((prev) => (reset ? transformed : [...prev, ...transformed]));
        setPostsHasMore((data?.length || 0) === 6);
        setPostsPage(page);
      } catch (error) {
        console.error("Error fetching posts:", error);
      } finally {
        setPostsLoading(false);
      }
    },
    [categoryName],
  );

  // Fetch deals by restaurant cuisine type
  const fetchDeals = useCallback(
    async (page: number = 1, reset: boolean = false) => {
      if (!categoryName) return;

      try {
        if (reset) {
          setDealsLoading(true);
        } else {
          setDealsLoading(true);
        }

        const from = (page - 1) * 6;
        const to = from + 5;

        const { data, error } = await supabase
          .from("posts")
          .select(
            `
        id,
        restaurant_id,
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
          .eq("is_active", true)
          .eq("post_type", "promotion")
          .gt("discount_percentage", 0)
          .ilike("restaurants.cuisine_type", `%${categoryName}%`)
          .order("discount_percentage", { ascending: false })
          .range(from, to);

        if (error) throw error;

        const transformed = (data || []).map((post, index) => ({
          ...post,
          distanceText: `${(((post.id?.charCodeAt(0) || index) % 30) + 5) / 10}km`,
          likes_count: post.likes_count || 0,
          comments_count: post.comments_count || 0,
          view_count: post.view_count || 0,
          restaurant_name: post.restaurants?.restaurant_name || "Restaurant",
          cuisine_type: post.restaurants?.cuisine_type || "Various",
          restaurant_rating: post.restaurants?.restaurant_rating || 4.0,
          delivery_fee:
            post.restaurants?.delivery_fee === 0
              ? "Free"
              : `AED ${post.restaurants?.delivery_fee || 5}`,
          min_order_amount: `AED ${post.restaurants?.min_order_amount || 25}`,
        }));

        setDeals((prev) => (reset ? transformed : [...prev, ...transformed]));
        setDealsHasMore((data?.length || 0) === 6);
        setDealsPage(page);
      } catch (error) {
        console.error("Error fetching deals:", error);
      } finally {
        setDealsLoading(false);
      }
    },
    [categoryName],
  );

  // Also update the loadInitialData function
  const loadInitialData = async () => {
    setLoading(true);
    await Promise.all([
      fetchRestaurants(1, true),
      fetchPosts(1, true),
      fetchDeals(1, true),
      fetchLikedPosts(),
    ]);
    setLoading(false);
  };

  // Load more based on active filter
  const loadMore = useCallback(() => {
    if (activeFilter === "all" || activeFilter === "restaurants") {
      if (!restaurantsLoading && restaurantsHasMore) {
        fetchRestaurants(restaurantsPage + 1, false);
      }
    }
    if (activeFilter === "all" || activeFilter === "posts") {
      if (!postsLoading && postsHasMore) {
        fetchPosts(postsPage + 1, false);
      }
    }
    if (activeFilter === "all" || activeFilter === "deals") {
      if (!dealsLoading && dealsHasMore) {
        fetchDeals(dealsPage + 1, false);
      }
    }
  }, [
    activeFilter,
    restaurantsLoading,
    restaurantsHasMore,
    restaurantsPage,
    postsLoading,
    postsHasMore,
    postsPage,
    dealsLoading,
    dealsHasMore,
    dealsPage,
  ]);

  // Handle like post
  const handleLikePost = useCallback(
    async (postId: string) => {
      if (!user?.id) {
        router.push("/login");
        return;
      }

      try {
        const isCurrentlyLiked = likedPosts.has(postId);

        // Update posts arrays
        const updatePosts = (postsArray: any[]) =>
          postsArray.map((post) => {
            if (post.id === postId) {
              return {
                ...post,
                likes_count: isCurrentlyLiked
                  ? post.likes_count - 1
                  : post.likes_count + 1,
              };
            }
            return post;
          });

        setPosts((prev) => updatePosts(prev));
        setDeals((prev) => updatePosts(prev));

        setLikedPosts((prev) => {
          const newSet = new Set(prev);
          if (isCurrentlyLiked) {
            newSet.delete(postId);
          } else {
            newSet.add(postId);
          }
          return newSet;
        });

        if (isCurrentlyLiked) {
          await supabase
            .from("post_likes")
            .delete()
            .eq("post_id", postId)
            .eq("user_id", user.id);
        } else {
          await supabase.from("post_likes").insert({
            post_id: postId,
            user_id: user.id,
          });
        }
      } catch (error) {
        console.error("Error liking post:", error);
      }
    },
    [user?.id, likedPosts],
  );

  // Get time remaining
  const getTimeRemaining = (availableUntil: string) => {
    if (!availableUntil) return "Limited";

    try {
      const endDate = new Date(availableUntil);
      const now = new Date();
      const diffTime = endDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays <= 0) return "Ended";
      if (diffDays === 1) return "Today";
      if (diffDays <= 7) return `${diffDays}d`;
      return "Soon";
    } catch {
      return "Limited";
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays === 1) return "Yesterday";
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    } catch {
      return "";
    }
  };

  // Filter components
  const FilterButton = ({
    type,
    label,
  }: {
    type: FilterType;
    label: string;
  }) => (
    <TouchableOpacity
      style={[
        styles.filterButton,
        activeFilter === type && styles.filterButtonActive,
      ]}
      onPress={() => setActiveFilter(type)}
    >
      <Text
        style={[
          styles.filterButtonText,
          activeFilter === type && styles.filterButtonTextActive,
        ]}
      >
        {label}
      </Text>
      {type === "all" && (
        <View style={styles.filterBadge}>
          <Text style={styles.filterBadgeText}>
            {restaurants.length + posts.length + deals.length}
          </Text>
        </View>
      )}
      {type === "restaurants" && (
        <View style={styles.filterBadge}>
          <Text style={styles.filterBadgeText}>{restaurants.length}</Text>
        </View>
      )}
      {type === "posts" && (
        <View style={styles.filterBadge}>
          <Text style={styles.filterBadgeText}>{posts.length}</Text>
        </View>
      )}
      {type === "deals" && (
        <View style={styles.filterBadge}>
          <Text style={styles.filterBadgeText}>{deals.length}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  // Restaurant Card Component
  const RestaurantCard = ({ restaurant }: { restaurant: any }) => (
    <TouchableOpacity
      style={styles.restaurantCard}
      onPress={() =>
        router.push(`/(tabs)/profiles/restaurant-profile/${restaurant.id}`)
      }
      activeOpacity={0.9}
    >
      <View style={styles.restaurantImageContainer}>
        <Image
          source={{ uri: restaurant.image }}
          style={styles.restaurantImage}
        />
        {restaurant.promotion && (
          <View style={styles.promotionBadge}>
            <Text style={styles.promotionText}>{restaurant.promotion}</Text>
          </View>
        )}
        <View style={styles.ratingBadge}>
          <Ionicons name="star" size={12} color="#FFD700" />
          <Text style={styles.ratingBadgeText}>
            {restaurant.rating.toFixed(1)}
          </Text>
        </View>
      </View>
      <View style={styles.restaurantInfo}>
        <Text style={styles.restaurantName} numberOfLines={1}>
          {restaurant.name}
        </Text>
        <Text style={styles.restaurantCuisine} numberOfLines={1}>
          {restaurant.cuisine}
        </Text>
        <View style={styles.restaurantMeta}>
          <View style={styles.metaItem}>
            <Ionicons name="time-outline" size={12} color="#6B7280" />
            <Text style={styles.metaText}>{restaurant.deliveryTime}</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="location" size={12} color="#6B7280" />
            <Text style={styles.metaText}>{restaurant.distance}</Text>
          </View>
        </View>
        <View style={styles.restaurantFooter}>
          <Text style={styles.deliveryFee}>{restaurant.deliveryFee}</Text>
          <Text style={styles.minOrder}>Min {restaurant.minOrder}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  // Post Card Component
  const PostCard = ({ post }: { post: any }) => {
    const isLiked = likedPosts.has(post.id);
    const timeRemaining = getTimeRemaining(post.available_until);
    const formattedDate = formatDate(post.created_at);

    return (
      <TouchableOpacity
        style={styles.postCard}
        onPress={() => router.push(`/post/${post.id}`)}
        activeOpacity={0.9}
      >
        <View style={styles.postImageContainer}>
          <Image
            source={{
              uri:
                post.image_url ||
                "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=300&h=200&fit=crop",
            }}
            style={styles.postImage}
          />
          {post.discount_percentage && (
            <View style={styles.postDiscountBadge}>
              <Text style={styles.postDiscountText}>
                {post.discount_percentage}% OFF
              </Text>
            </View>
          )}
          {post.post_type === "event" && (
            <View style={styles.postEventBadge}>
              <Text style={styles.postEventText}>🎉 EVENT</Text>
            </View>
          )}
        </View>

        <View style={styles.postContent}>
          <Text style={styles.postRestaurant} numberOfLines={1}>
            {post.restaurant_name}
          </Text>
          <Text style={styles.postTitle} numberOfLines={2}>
            {post.title}
          </Text>

          {post.description && (
            <Text style={styles.postDescription} numberOfLines={2}>
              {post.description}
            </Text>
          )}

          {post.discounted_price && (
            <View style={styles.postPriceContainer}>
              <Text style={styles.postDiscountedPrice}>
                AED {post.discounted_price}
              </Text>
              {post.original_price && (
                <Text style={styles.postOriginalPrice}>
                  AED {post.original_price}
                </Text>
              )}
            </View>
          )}

          <View style={styles.postFooter}>
            <View style={styles.postStats}>
              <TouchableOpacity
                style={styles.postStat}
                onPress={(e) => {
                  e.stopPropagation();
                  handleLikePost(post.id);
                }}
              >
                <Ionicons
                  name={isLiked ? "heart" : "heart-outline"}
                  size={14}
                  color={isLiked ? "#EF4444" : "#6B7280"}
                />
                <Text
                  style={[styles.postStatText, isLiked && styles.likedText]}
                >
                  {post.likes_count}
                </Text>
              </TouchableOpacity>
              <View style={styles.postStat}>
                <Ionicons name="chatbubble-outline" size={14} color="#6B7280" />
                <Text style={styles.postStatText}>{post.comments_count}</Text>
              </View>
            </View>
            <Text style={styles.postTime}>{formattedDate}</Text>
          </View>

          {timeRemaining && timeRemaining !== "Soon" && (
            <View style={styles.postTimeRemaining}>
              <Ionicons name="time-outline" size={12} color="#FF6B35" />
              <Text style={styles.postTimeRemainingText}>{timeRemaining}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // Deal Card Component (similar to PostCard but with deal styling)
  const DealCard = ({ deal }: { deal: any }) => {
    const isLiked = likedPosts.has(deal.id);
    const timeRemaining = getTimeRemaining(deal.available_until);

    return (
      <TouchableOpacity
        style={styles.dealCard}
        onPress={() => router.push(`/post/${deal.id}`)}
        activeOpacity={0.9}
      >
        <LinearGradient
          colors={["#FF6B35", "#FF8C5A"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.dealGradient}
        >
          <View style={styles.dealContent}>
            <View style={styles.dealHeader}>
              <Text style={styles.dealDiscount}>
                {deal.discount_percentage}% OFF
              </Text>
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  handleLikePost(deal.id);
                }}
              >
                <Ionicons
                  name={isLiked ? "heart" : "heart-outline"}
                  size={18}
                  color="#FFFFFF"
                />
              </TouchableOpacity>
            </View>

            <Text style={styles.dealRestaurant} numberOfLines={1}>
              {deal.restaurant_name}
            </Text>
            <Text style={styles.dealTitle} numberOfLines={2}>
              {deal.title}
            </Text>

            <View style={styles.dealFooter}>
              <View style={styles.dealPrice}>
                <Text style={styles.dealPriceText}>
                  AED {deal.discounted_price}
                </Text>
                {deal.original_price && (
                  <Text style={styles.dealOriginalPrice}>
                    AED {deal.original_price}
                  </Text>
                )}
              </View>
              <View style={styles.dealTime}>
                <Ionicons name="time-outline" size={12} color="#FFFFFF" />
                <Text style={styles.dealTimeText}>{timeRemaining}</Text>
              </View>
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  // Render item based on active filter
  const renderItem = ({ item }: { item: any }) => {
    if (activeFilter === "restaurants") {
      return <RestaurantCard restaurant={item} />;
    }
    if (activeFilter === "posts") {
      return <PostCard post={item} />;
    }
    if (activeFilter === "deals") {
      return <DealCard deal={item} />;
    }
    return null;
  };

  // Get data based on active filter
  const getData = () => {
    if (activeFilter === "restaurants") return restaurants;
    if (activeFilter === "posts") return posts;
    if (activeFilter === "deals") return deals;
    return [];
  };

  // Get loading state based on active filter
  const getLoading = () => {
    if (activeFilter === "restaurants") return restaurantsLoading;
    if (activeFilter === "posts") return postsLoading;
    if (activeFilter === "deals") return dealsLoading;
    return false;
  };

  // Get has more based on active filter
  const getHasMore = () => {
    if (activeFilter === "restaurants") return restaurantsHasMore;
    if (activeFilter === "posts") return postsHasMore;
    if (activeFilter === "deals") return dealsHasMore;
    return false;
  };

  // Render empty state
  const renderEmpty = () => {
    let message = "";
    if (activeFilter === "restaurants")
      message = "No restaurants found in this category";
    if (activeFilter === "posts") message = "No posts found in this category";
    if (activeFilter === "deals") message = "No deals found in this category";

    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="restaurant-outline" size={64} color="#D1D5DB" />
        <Text style={styles.emptyTitle}>{message}</Text>
        <Text style={styles.emptyText}>
          Check back later or try another category
        </Text>
      </View>
    );
  };

  // Render header
  const renderHeader = () => (
    <>
      {/* Category Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>{categoryName}</Text>
          <Text style={styles.headerSubtitle}>Cuisine & Specialties</Text>
        </View>
        <TouchableOpacity style={styles.shareButton}>
          <Ionicons name="share-outline" size={24} color="#111827" />
        </TouchableOpacity>
      </View>

      {/* Category Image */}
      <Image
        source={{
          uri:
            CATEGORY_IMAGES[categoryName] ||
            "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&h=300&fit=crop",
        }}
        style={styles.categoryImage}
      />

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScrollContent}
        >
          <FilterButton type="all" label="All" />
          <FilterButton type="restaurants" label="Restaurants" />
          <FilterButton type="posts" label="Posts" />
          <FilterButton type="deals" label="Deals" />
        </ScrollView>
      </View>

      {/* Stats Bar */}
      <View style={styles.statsBar}>
        <Text style={styles.statsText}>
          {activeFilter === "all" &&
            `Showing ${restaurants.length + posts.length + deals.length} items`}
          {activeFilter === "restaurants" &&
            `${restaurants.length} restaurants available`}
          {activeFilter === "posts" && `${posts.length} posts`}
          {activeFilter === "deals" && `${deals.length} active deals`}
        </Text>
      </View>
    </>
  );

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6B35" />
          <Text style={styles.loadingText}>Loading {categoryName}...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {activeFilter === "all" ? (
        // All view - sections
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {/* Your existing header and sections */}
          {renderHeader()}

          {/* Restaurants Section */}
          {restaurants.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Restaurants</Text>
                <TouchableOpacity
                  onPress={() => setActiveFilter("restaurants")}
                >
                  <Text style={styles.seeAllText}>See All</Text>
                </TouchableOpacity>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalScrollContent}
              >
                {restaurants.slice(0, 5).map((restaurant) => (
                  <RestaurantCard key={restaurant.id} restaurant={restaurant} />
                ))}
              </ScrollView>
            </View>
          )}

          {/* Posts Section */}
          {posts.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Latest Posts</Text>
                <TouchableOpacity onPress={() => setActiveFilter("posts")}>
                  <Text style={styles.seeAllText}>See All</Text>
                </TouchableOpacity>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalScrollContent}
              >
                {posts.slice(0, 5).map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </ScrollView>
            </View>
          )}

          {/* Deals Section */}
          {deals.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Hot Deals</Text>
                <TouchableOpacity onPress={() => setActiveFilter("deals")}>
                  <Text style={styles.seeAllText}>See All</Text>
                </TouchableOpacity>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalScrollContent}
              >
                {deals.slice(0, 5).map((deal) => (
                  <DealCard key={deal.id} deal={deal} />
                ))}
              </ScrollView>
            </View>
          )}

          <View style={styles.bottomSpacer} />
        </ScrollView>
      ) : (
        // Filtered view - use different FlatList for each filter type with unique key
        <>
          {activeFilter === "restaurants" && (
            <FlatList
              key="restaurants-list"
              data={getData()}
              renderItem={renderItem}
              keyExtractor={(item) => item.id}
              numColumns={1}
              contentContainerStyle={styles.gridContent}
              ListHeaderComponent={renderHeader}
              ListEmptyComponent={renderEmpty}
              ListFooterComponent={
                getHasMore() ? (
                  <TouchableOpacity
                    style={styles.loadMoreButton}
                    onPress={loadMore}
                    disabled={getLoading()}
                  >
                    {getLoading() ? (
                      <ActivityIndicator size="small" color="#FF6B35" />
                    ) : (
                      <>
                        <Text style={styles.loadMoreText}>Load More</Text>
                        <Ionicons name="arrow-down" size={16} color="#FF6B35" />
                      </>
                    )}
                  </TouchableOpacity>
                ) : getData().length > 0 ? (
                  <Text style={styles.endText}>You've reached the end</Text>
                ) : null
              }
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
            />
          )}

          {activeFilter === "posts" && (
            <FlatList
              key="posts-list"
              data={getData()}
              renderItem={renderItem}
              keyExtractor={(item) => item.id}
              numColumns={2}
              columnWrapperStyle={styles.gridColumnWrapper}
              contentContainerStyle={styles.gridContent}
              ListHeaderComponent={renderHeader}
              ListEmptyComponent={renderEmpty}
              ListFooterComponent={
                getHasMore() ? (
                  <TouchableOpacity
                    style={styles.loadMoreButton}
                    onPress={loadMore}
                    disabled={getLoading()}
                  >
                    {getLoading() ? (
                      <ActivityIndicator size="small" color="#FF6B35" />
                    ) : (
                      <>
                        <Text style={styles.loadMoreText}>Load More</Text>
                        <Ionicons name="arrow-down" size={16} color="#FF6B35" />
                      </>
                    )}
                  </TouchableOpacity>
                ) : getData().length > 0 ? (
                  <Text style={styles.endText}>You've reached the end</Text>
                ) : null
              }
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
            />
          )}

          {activeFilter === "deals" && (
            <FlatList
              key="deals-list"
              data={getData()}
              renderItem={renderItem}
              keyExtractor={(item) => item.id}
              numColumns={2}
              columnWrapperStyle={styles.gridColumnWrapper}
              contentContainerStyle={styles.gridContent}
              ListHeaderComponent={renderHeader}
              ListEmptyComponent={renderEmpty}
              ListFooterComponent={
                getHasMore() ? (
                  <TouchableOpacity
                    style={styles.loadMoreButton}
                    onPress={loadMore}
                    disabled={getLoading()}
                  >
                    {getLoading() ? (
                      <ActivityIndicator size="small" color="#FF6B35" />
                    ) : (
                      <>
                        <Text style={styles.loadMoreText}>Load More</Text>
                        <Ionicons name="arrow-down" size={16} color="#FF6B35" />
                      </>
                    )}
                  </TouchableOpacity>
                ) : getData().length > 0 ? (
                  <Text style={styles.endText}>You've reached the end</Text>
                ) : null
              }
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
            />
          )}
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#6B7280",
    fontWeight: "500",
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  backButton: {
    padding: 4,
  },
  headerTitleContainer: {
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  shareButton: {
    padding: 4,
  },
  categoryImage: {
    width: "100%",
    height: 180,
    resizeMode: "cover",
  },
  filterContainer: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  filterScrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    gap: 6,
  },
  filterButtonActive: {
    backgroundColor: "#FF6B35",
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
  },
  filterButtonTextActive: {
    color: "#FFFFFF",
  },
  filterBadge: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  filterBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  statsBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#F9FAFB",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  statsText: {
    fontSize: 13,
    color: "#6B7280",
    fontWeight: "500",
  },
  section: {
    marginBottom: 24,
    marginTop: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  seeAllText: {
    fontSize: 13,
    color: "#FF6B35",
    fontWeight: "600",
  },
  horizontalScrollContent: {
    paddingHorizontal: 16,
    gap: 16,
  },

  // Restaurant Card Styles
  restaurantCard: {
    width: SCREEN_WIDTH * 0.75,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 0.5,
    borderColor: "#F3F4F6",
    marginBottom: 3,
  },
  restaurantImageContainer: {
    position: "relative",
    height: 140,
    overflow: "hidden",
  },
  restaurantImage: {
    width: "100%",
    height: "100%",
  },
  promotionBadge: {
    position: "absolute",
    bottom: 12,
    left: 12,
    backgroundColor: "#FF6B35",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  promotionText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
  ratingBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  ratingBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  restaurantInfo: {
    padding: 14,
  },
  restaurantName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  restaurantCuisine: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 8,
  },
  restaurantMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 8,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 11,
    color: "#6B7280",
  },
  restaurantFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    paddingTop: 10,
  },
  deliveryFee: {
    fontSize: 13,
    fontWeight: "700",
    color: "#10B981",
  },
  minOrder: {
    fontSize: 12,
    color: "#6B7280",
  },

  // Post Card Styles
  postCard: {
    width: SCREEN_WIDTH * 0.7,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 0.5,
    borderColor: "#F3F4F6",
    marginBottom: 3,
  },
  postImageContainer: {
    position: "relative",
    height: 130,
    overflow: "hidden",
  },
  postImage: {
    width: "100%",
    height: "100%",
  },
  postDiscountBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    backgroundColor: "#FF6B35",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  postDiscountText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },
  postEventBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "#8B5CF6",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  postEventText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
  postContent: {
    padding: 14,
  },
  postRestaurant: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 4,
  },
  postTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 6,
  },
  postDescription: {
    fontSize: 12,
    color: "#6B7280",
    lineHeight: 16,
    marginBottom: 10,
  },
  postPriceContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  postDiscountedPrice: {
    fontSize: 16,
    fontWeight: "900",
    color: "#FF6B35",
  },
  postOriginalPrice: {
    fontSize: 12,
    color: "#9CA3AF",
    textDecorationLine: "line-through",
  },
  postFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  postStats: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  postStat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  postStatText: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "600",
  },
  likedText: {
    color: "#EF4444",
  },
  postTime: {
    fontSize: 11,
    color: "#9CA3AF",
  },
  postTimeRemaining: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FFF5F0",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  postTimeRemainingText: {
    fontSize: 10,
    color: "#FF6B35",
    fontWeight: "600",
  },

  // Deal Card Styles
  dealCard: {
    width: SCREEN_WIDTH * 0.7,
    height: 180,
    borderRadius: 16,
    overflow: "hidden",
  },
  dealGradient: {
    flex: 1,
  },
  dealContent: {
    flex: 1,
    padding: 16,
    justifyContent: "space-between",
  },
  dealHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dealDiscount: {
    fontSize: 20,
    fontWeight: "900",
    color: "#FFFFFF",
    textShadowColor: "rgba(0,0,0,0.2)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  dealRestaurant: {
    fontSize: 13,
    color: "rgba(255,255,255,0.9)",
    fontWeight: "600",
    textShadowColor: "rgba(0,0,0,0.2)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  dealTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#FFFFFF",
    marginTop: 4,
    textShadowColor: "rgba(0,0,0,0.3)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  dealFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dealPrice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dealPriceText: {
    fontSize: 18,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  dealOriginalPrice: {
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
    textDecorationLine: "line-through",
  },
  dealTime: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 4,
  },
  dealTimeText: {
    fontSize: 11,
    color: "#FFFFFF",
    fontWeight: "600",
  },

  // Grid Styles
  gridContent: {
    paddingBottom: 20,
  },
  gridColumnWrapper: {
    justifyContent: "space-between",
    paddingHorizontal: 12,
    gap: 12,
    marginBottom: 12,
  },

  // Empty State
  emptyContainer: {
    padding: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    marginTop: 20,
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
  },
  emptyText: {
    marginTop: 8,
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
  },

  // Load More
  loadMoreButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F4F6",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    gap: 8,
  },
  loadMoreText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FF6B35",
  },
  endText: {
    textAlign: "center",
    color: "#9CA3AF",
    fontSize: 13,
    marginTop: 20,
    marginBottom: 8,
  },
  bottomSpacer: {
    height: 24,
  },
});
