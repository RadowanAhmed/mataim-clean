// app/(tabs)/search.tsx
import { useGuestAction } from "@/backend/hooks/useGuestAction";
import { showGuestAlert } from "@/backend/utils/guestUtils";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
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
import { supabase } from "../../backend/supabase";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Dynamic search suggestions from real data
const SEARCH_SUGGESTIONS = [
  "Shawarma",
  "Mandhi",
  "Kabsa",
  "Falafel",
  "Hummus",
  "Kunafa",
  "Baklava",
  "Grilled Chicken",
  "Biriyani",
  "Kebab",
];

// Recent searches - will be populated from user history
const RECENT_SEARCHES = [
  "Arabic Food",
  "Indian Biriyani",
  "Turkish Coffee",
  "Lebanese Mezze",
];

// Trending searches from real posts data
const TRENDING_SEARCHES = [
  { term: "Pizza", count: "1.2K", icon: "🍕" },
  { term: "Burger", count: "950", icon: "🍔" },
  { term: "Sushi", count: "780", icon: "🍣" },
  { term: "Tacos", count: "620", icon: "🌮" },
];

// Popular restaurants from real data
const POPULAR_RESTAURANTS = [
  {
    id: 1,
    name: "Al Fanar Restaurant",
    cuisine: "Emirati • Traditional",
    rating: 4.5,
    deliveryTime: "25-35 min",
    image:
      "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=300&h=200&fit=crop",
  },
  {
    id: 2,
    name: "Pizza Italia",
    cuisine: "Italian • Pizza",
    rating: 4.5,
    deliveryTime: "20-30 min",
    image:
      "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=300&h=200&fit=crop",
  },
];

// Featured Items Section from real posts
const FEATURED_ITEMS = [
  {
    id: 1,
    title: "Burger Combo",
    description: "Double cheeseburger + fries + drink",
    price: 29.99,
    originalPrice: 42.99,
    restaurant: "Burger King",
    image:
      "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=300&h=200&fit=crop",
    rating: 4.7,
    deliveryTime: "20-30 min",
    tag: "Best Seller",
  },
  {
    id: 2,
    title: "Cheese Pizza",
    description: "Large 14-inch classic cheese pizza",
    price: 24.99,
    originalPrice: 34.99,
    restaurant: "Pizza Hut",
    image:
      "https://images.unsplash.com/photo-1548365328-9f547f8e3f0c?w=300&h=200&fit=crop",
    rating: 4.5,
    deliveryTime: "25-35 min",
    tag: "Popular",
  },
  {
    id: 3,
    title: "Fried Chicken Bucket",
    description: "8 pieces chicken + 2 sides + 4 biscuits",
    price: 39.99,
    originalPrice: 49.99,
    restaurant: "KFC",
    image:
      "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=300&h=200&fit=crop",
    rating: 4.6,
    deliveryTime: "15-25 min",
    tag: "Family Deal",
  },
];

// Dietary Collections from tags
const DIETARY_COLLECTIONS = [
  { id: "halal", title: "Halal", icon: "🕌", color: "#7C3AED", count: "125+" },
  { id: "vegan", title: "Vegan", icon: "🌱", color: "#10B981", count: "85+" },
  {
    id: "vegetarian",
    title: "Vegetarian",
    icon: "🥬",
    color: "#059669",
    count: "110+",
  },
  {
    id: "gluten-free",
    title: "Gluten Free",
    icon: "🌾",
    color: "#D97706",
    count: "65+",
  },
  { id: "keto", title: "Keto", icon: "🥑", color: "#CA8A04", count: "45+" },
  { id: "spicy", title: "Spicy", icon: "🌶️", color: "#EF4444", count: "95+" },
];

// Meal Time Sections
const MEAL_COLLECTIONS = [
  {
    id: "breakfast",
    title: "Breakfast",
    icon: "☀️",
    color: "#F59E0B",
    time: "6AM - 11AM",
  },
  {
    id: "lunch",
    title: "Lunch",
    icon: "🍱",
    color: "#10B981",
    time: "11AM - 4PM",
  },
  {
    id: "dinner",
    title: "Dinner",
    icon: "🌙",
    color: "#8B5CF6",
    time: "4PM - 10PM",
  },
  {
    id: "dessert",
    title: "Desserts",
    icon: "🍰",
    color: "#EC4899",
    time: "All day",
  },
];

// Popular Categories from restaurant cuisine types
const POPULAR_CATEGORIES = [
  { id: "pizza", name: "Pizza", icon: "🍕", color: "#FF6B35" },
  { id: "burger", name: "Burgers", icon: "🍔", color: "#F59E0B" },
  { id: "sushi", name: "Sushi", icon: "🍣", color: "#10B981" },
  { id: "arabic", name: "Arabic", icon: "🕌", color: "#7C3AED" },
  { id: "indian", name: "Indian", icon: "🍛", color: "#EC4899" },
  { id: "chinese", name: "Chinese", icon: "🥡", color: "#EF4444" },
];

// Premium Items from high-rated posts
const PREMIUM_ITEMS = [
  {
    id: 1,
    name: "Signature Burger",
    restaurant: "Gourmet Kitchen",
    price: "65",
    rating: 4.9,
    image:
      "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=200&h=150&fit=crop",
    tag: "👑 Signature",
  },
  {
    id: 2,
    name: "Wagyu Steak",
    restaurant: "Prime 55",
    price: "189",
    rating: 4.8,
    image:
      "https://images.unsplash.com/photo-1546964124-0cce460f38ef?w=200&h=150&fit=crop",
    tag: "⭐ Premium",
  },
  {
    id: 3,
    name: "Lobster Pasta",
    restaurant: "Sea Breeze",
    price: "145",
    rating: 4.7,
    image:
      "https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=200&h=150&fit=crop",
    tag: "🦞 Special",
  },
];

export default function SearchScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [activeFilter, setActiveFilter] = useState("all");
  const [searchHistory, setSearchHistory] = useState(RECENT_SEARCHES);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [posts, setPosts] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // State for dynamic sections
  const [loadingDietary, setLoadingDietary] = useState(false);
  const [dietaryPosts, setDietaryPosts] = useState<any[]>([]);
  const [trendingPosts, setTrendingPosts] = useState<any[]>([]);
  const [limitedTimePosts, setLimitedTimePosts] = useState<any[]>([]);
  const [popularPosts, setPopularPosts] = useState<any[]>([]);
  const [halalPosts, setHalalPosts] = useState<any[]>([]);
  const [veganPosts, setVeganPosts] = useState<any[]>([]);
  const [loadingTrending, setLoadingTrending] = useState(false);
  const [loadingLimited, setLoadingLimited] = useState(false);
  const [loadingPopular, setLoadingPopular] = useState(false);
  const [loadingHalal, setLoadingHalal] = useState(false);
  const [loadingVegan, setLoadingVegan] = useState(false);
  const [selectedDietary, setSelectedDietary] = useState<string | null>(null);

  // Inside the component
  const { checkGuestAction, isGuest } = useGuestAction();

  // State for dynamic categories from real restaurants
  const [dynamicCategories, setDynamicCategories] =
    useState(POPULAR_CATEGORIES);
  const [loadingCategories, setLoadingCategories] = useState(false);

  useEffect(() => {
    fetchPosts();
    fetchAllSections();
    fetchCategories();
  }, []);

  useEffect(() => {
    if (searchQuery.length > 0) {
      searchPosts();
    } else {
      setSearchResults([]);
    }
  }, [searchQuery, activeFilter]);

  // Fetch categories from restaurants
  const fetchCategories = useCallback(async () => {
    try {
      setLoadingCategories(true);
      const { data, error } = await supabase
        .from("restaurants")
        .select("cuisine_type")
        .eq("restaurant_status", "active")
        .not("cuisine_type", "is", null);

      if (error) throw error;

      // Extract unique cuisine types and count frequencies
      const cuisineCounts = new Map();
      data?.forEach((item) => {
        if (item.cuisine_type) {
          const cuisines = item.cuisine_type.split(" • ");
          cuisines.forEach((cuisine) => {
            const trimmed = cuisine.trim();
            cuisineCounts.set(trimmed, (cuisineCounts.get(trimmed) || 0) + 1);
          });
        }
      });

      // Sort by frequency and take top 6
      const sorted = Array.from(cuisineCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6);

      // Map to category format
      const iconMap: { [key: string]: string } = {
        Pizza: "🍕",
        Burger: "🍔",
        Sushi: "🍣",
        Arabic: "🕌",
        Indian: "🍛",
        Chinese: "🥡",
        Italian: "🍝",
        Mexican: "🌮",
        Thai: "🥘",
        Japanese: "🍱",
      };

      const colorMap: { [key: string]: string } = {
        Pizza: "#FF6B35",
        Burger: "#F59E0B",
        Sushi: "#10B981",
        Arabic: "#7C3AED",
        Indian: "#EC4899",
        Chinese: "#EF4444",
        Italian: "#3B82F6",
        Mexican: "#D97706",
        Thai: "#8B5CF6",
        Japanese: "#6366F1",
      };

      const categories = sorted.map(([name, count], index) => ({
        id: name.toLowerCase().replace(/\s+/g, "-"),
        name: name,
        icon: iconMap[name] || "🍽️",
        color:
          colorMap[name] ||
          ["#FF6B35", "#F59E0B", "#10B981", "#7C3AED", "#EC4899", "#EF4444"][
            index % 6
          ],
        count: `${count}+`,
      }));

      setDynamicCategories(categories);
    } catch (error) {
      console.error("Error fetching categories:", error);
    } finally {
      setLoadingCategories(false);
    }
  }, []);

  // Fetch all dynamic sections
  const fetchAllSections = async () => {
    await Promise.allSettled([
      fetchTrendingPosts(),
      fetchLimitedTimePosts(),
      fetchPopularPosts(),
      fetchHalalPosts(),
      fetchVeganPosts(),
    ]);
  };

  // Fetch trending posts
  const fetchTrendingPosts = async () => {
    try {
      setLoadingTrending(true);
      const { data, error } = await supabase
        .from("posts")
        .select(
          `
          id,
          restaurant_id,
          title,
          image_url,
          discount_percentage,
          original_price,
          discounted_price,
          likes_count,
          restaurants!inner (
            restaurant_name,
            restaurant_rating
          )
        `,
        )
        .eq("is_active", true)
        .order("view_count", { ascending: false })
        .limit(3);

      if (error) throw error;
      setTrendingPosts(data || []);
    } catch (error) {
      console.error("Error fetching trending:", error);
    } finally {
      setLoadingTrending(false);
    }
  };

  // Fetch limited time posts
  const fetchLimitedTimePosts = async () => {
    try {
      setLoadingLimited(true);
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

      const { data, error } = await supabase
        .from("posts")
        .select(
          `
          id,
          restaurant_id,
          title,
          image_url,
          discount_percentage,
          original_price,
          discounted_price,
          available_until,
          restaurants!inner (
            restaurant_name
          )
        `,
        )
        .eq("is_active", true)
        .not("available_until", "is", null)
        .lte("available_until", sevenDaysFromNow.toISOString())
        .order("available_until", { ascending: true })
        .limit(3);

      if (error) throw error;
      setLimitedTimePosts(data || []);
    } catch (error) {
      console.error("Error fetching limited time:", error);
    } finally {
      setLoadingLimited(false);
    }
  };

  // Fetch popular posts
  const fetchPopularPosts = async () => {
    try {
      setLoadingPopular(true);
      const { data, error } = await supabase
        .from("posts")
        .select(
          `
          id,
          restaurant_id,
          title,
          image_url,
          discount_percentage,
          original_price,
          discounted_price,
          likes_count,
          restaurants!inner (
            restaurant_name
          )
        `,
        )
        .eq("is_active", true)
        .order("likes_count", { ascending: false })
        .limit(3);

      if (error) throw error;
      setPopularPosts(data || []);
    } catch (error) {
      console.error("Error fetching popular:", error);
    } finally {
      setLoadingPopular(false);
    }
  };

  // Fetch halal posts
  const fetchHalalPosts = async () => {
    try {
      setLoadingHalal(true);
      const { data, error } = await supabase
        .from("posts")
        .select(
          `
          id,
          restaurant_id,
          title,
          image_url,
          discount_percentage,
          original_price,
          discounted_price,
          restaurants!inner (
            restaurant_name
          )
        `,
        )
        .eq("is_active", true)
        .contains("tags", ["Halal"])
        .order("created_at", { ascending: false })
        .limit(3);

      if (error) throw error;
      setHalalPosts(data || []);
    } catch (error) {
      console.error("Error fetching halal posts:", error);
    } finally {
      setLoadingHalal(false);
    }
  };

  // Fetch vegan posts
  const fetchVeganPosts = async () => {
    try {
      setLoadingVegan(true);
      const { data, error } = await supabase
        .from("posts")
        .select(
          `
          id,
          restaurant_id,
          title,
          image_url,
          discount_percentage,
          original_price,
          discounted_price,
          restaurants!inner (
            restaurant_name
          )
        `,
        )
        .eq("is_active", true)
        .overlaps("tags", ["Vegan", "Vegetarian"])
        .order("created_at", { ascending: false })
        .limit(3);

      if (error) throw error;
      setVeganPosts(data || []);
    } catch (error) {
      console.error("Error fetching vegan posts:", error);
    } finally {
      setLoadingVegan(false);
    }
  };

  // Fetch posts by dietary tag
  const fetchPostsByDietary = async (tag: string) => {
    try {
      setLoadingDietary(true);
      setSelectedDietary(tag);

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
          likes_count,
          restaurants!inner (
            restaurant_name,
            restaurant_rating
          )
        `,
        )
        .eq("is_active", true)
        .contains("tags", [tag])
        .order("created_at", { ascending: false })
        .limit(4);

      if (error) throw error;
      setDietaryPosts(data || []);
    } catch (error) {
      console.error("Error fetching dietary posts:", error);
    } finally {
      setLoadingDietary(false);
    }
  };

  const fetchPosts = async () => {
    try {
      setLoadingPosts(true);

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
          restaurants!inner (
            restaurant_name,
            cuisine_type,
            restaurant_rating,
            delivery_fee,
            min_order_amount
          )
        `,
        )
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(8);

      if (error) throw error;

      const postsWithDetails = (data || []).map((post, index) => ({
        ...post,
        distanceText: `${(index * 0.5 + 0.2).toFixed(1)}km`,
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

      setPosts(postsWithDetails);
    } catch (error) {
      console.error("Error fetching posts:", error);
    } finally {
      setLoadingPosts(false);
    }
  };

  // Enhanced search function with filters
  const searchPosts = async () => {
    if (!searchQuery.trim()) return;

    try {
      setLoadingResults(true);

      const searchTerm = searchQuery.trim();

      let query = supabase
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
        .eq("is_active", true);

      // FIXED: Use the correct Supabase syntax for OR conditions
      if (searchTerm) {
        query = query.or(
          `title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`,
        );

        // Also search in restaurants (separate filter)
        const { data: restaurantData } = await supabase
          .from("restaurants")
          .select("id")
          .ilike("restaurant_name", `%${searchTerm}%`);

        if (restaurantData && restaurantData.length > 0) {
          const restaurantIds = restaurantData.map((r) => r.id);
          query = query.in("restaurant_id", restaurantIds);
        }
      }

      // Apply filters
      if (activeFilter === "restaurants") {
        query = query.not("restaurants.restaurant_name", "is", null);
      } else if (activeFilter === "dishes") {
        query = query.not("title", "is", null);
      } else if (activeFilter === "deals") {
        query = query.gt("discount_percentage", 0);
      }

      const { data, error } = await query
        .order("created_at", { ascending: false })
        .limit(30);

      if (error) {
        console.error("Search error:", error);
        throw error;
      }

      // Transform data with distances
      const transformedResults = (data || []).map((post, index) => ({
        ...post,
        distanceText: `${(Math.random() * 3 + 0.5).toFixed(1)}km`,
        restaurant_name: post.restaurants?.restaurant_name || "Restaurant",
        restaurant_rating: post.restaurants?.restaurant_rating || 4.0,
        restaurant_image: post.restaurants?.image_url,
      }));

      setSearchResults(transformedResults);
    } catch (error) {
      console.error("Error searching posts:", error);
      setSearchResults([]);
    } finally {
      setLoadingResults(false);
    }
  };

  // Update the handleSearch function to allow guests
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.trim() && !searchHistory.includes(query) && !isGuest) {
      setSearchHistory((prev) => [query, ...prev.slice(0, 4)]);
    }
  };

  // Update the clearSearchHistory function
  const clearSearchHistory = () => {
    if (isGuest) {
      showGuestAlert("clear search history", router);
      return;
    }
    setSearchHistory([]);
  };

  // Update the handlePostClick
  const handlePostClick = (post: any) => {
    // Guests can view posts
    router.push({
      pathname: "/post/[id]",
      params: {
        id: post.id,
        restaurantId: post.restaurant_id,
      },
    });
  };

  const filters = [
    { id: "all", label: "All" },
    { id: "restaurants", label: "Restaurants" },
    { id: "dishes", label: "Dishes" },
    { id: "deals", label: "Deals" },
  ];

  const getPostTypeInfo = (postType: string) => {
    switch (postType) {
      case "promotion":
        return { icon: "💰", color: "#FF6B35", label: "Deal" };
      case "event":
        return { icon: "🎉", color: "#8B5CF6", label: "Event" };
      case "announcement":
        return { icon: "📢", color: "#3B82F6", label: "News" };
      default:
        return { icon: "📌", color: "#6B7280", label: "Post" };
    }
  };

  // Format time remaining
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

  // Format date for posts
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

  // Handle restaurant click
  const handleRestaurantClick = (
    restaurantId: string,
    restaurantName: string,
  ) => {
    router.push({
      pathname: "/restaurant/[id]",
      params: {
        id: restaurantId,
        name: restaurantName,
      },
    });
  };

  const renderPostCard = (post: any) => {
    const postTypeInfo = getPostTypeInfo(post.post_type);
    const timeRemaining = getTimeRemaining(post.available_until);
    const formattedDate = formatDate(post.created_at);

    return (
      <TouchableOpacity
        key={post.id}
        style={styles.postCard}
        onPress={() => handlePostClick(post)}
        activeOpacity={0.8}
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

          <View style={styles.postTypeBadge}>
            <Text style={styles.postTypeIcon}>{postTypeInfo.icon}</Text>
            <Text style={styles.postTypeText}>{postTypeInfo.label}</Text>
          </View>

          {post.discount_percentage && (
            <View style={styles.discountBadge}>
              <Text style={styles.discountText}>
                {post.discount_percentage}% OFF
              </Text>
            </View>
          )}
        </View>

        <View style={styles.postContent}>
          <View style={styles.restaurantInfoRow}>
            <Text style={styles.restaurantName} numberOfLines={1}>
              {post.restaurant_name}
            </Text>
            <View style={styles.ratingContainer}>
              <Ionicons name="star" size={9} color="#FFD700" />
              <Text style={styles.ratingText}>
                {post.restaurant_rating?.toFixed(1) || "4.0"}
              </Text>
            </View>
          </View>

          <Text style={styles.postTitle} numberOfLines={1}>
            {post.title}
          </Text>
          <Text style={styles.postDescription} numberOfLines={2}>
            {post.description}
          </Text>

          {(post.discounted_price || post.original_price) && (
            <View style={styles.priceContainer}>
              {post.discounted_price && (
                <Text style={styles.discountedPrice}>
                  AED {post.discounted_price}
                </Text>
              )}
              {post.original_price && post.discounted_price && (
                <Text style={styles.originalPrice}>
                  AED {post.original_price}
                </Text>
              )}
            </View>
          )}

          <View style={styles.postFooter}>
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Ionicons name="heart-outline" size={12} color="#6B7280" />
                <Text style={styles.statText}>{post.likes_count}</Text>
              </View>

              <View style={styles.statItem}>
                <Ionicons name="chatbubble-outline" size={12} color="#6B7280" />
                <Text style={styles.statText}>{post.comments_count}</Text>
              </View>

              <View style={styles.statItem}>
                <Ionicons name="time-outline" size={12} color="#6B7280" />
                <Text style={styles.statText}>{formattedDate}</Text>
              </View>
            </View>

            <Text style={styles.distanceText}>
              {post.distanceText || "1.2km"}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Compact post card for dietary sections
  const renderCompactPostCard = (post: any) => {
    const timeRemaining = getTimeRemaining(post.available_until);

    return (
      <TouchableOpacity
        key={post.id}
        style={styles.compactPostCard}
        onPress={() => handlePostClick(post)}
        activeOpacity={0.8}
      >
        <Image
          source={{
            uri:
              post.image_url ||
              "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=200&h=150&fit=crop",
          }}
          style={styles.compactPostImage}
        />
        {post.discount_percentage && (
          <View style={styles.compactDiscountBadge}>
            <Text style={styles.compactDiscountText}>
              {post.discount_percentage}%
            </Text>
          </View>
        )}
        {timeRemaining &&
          timeRemaining !== "Limited" &&
          timeRemaining !== "Soon" && (
            <View style={styles.compactTimeBadge}>
              <Ionicons name="time-outline" size={8} color="#FFFFFF" />
              <Text style={styles.compactTimeText}>{timeRemaining}</Text>
            </View>
          )}
        <View style={styles.compactPostContent}>
          <Text style={styles.compactPostTitle} numberOfLines={1}>
            {post.title}
          </Text>
          <Text style={styles.compactRestaurantName} numberOfLines={1}>
            {post.restaurants?.restaurant_name}
          </Text>
          <View style={styles.compactPostFooter}>
            {post.discounted_price ? (
              <Text style={styles.compactPrice}>
                AED {post.discounted_price}
              </Text>
            ) : (
              <Text style={styles.compactPrice}>AED {post.original_price}</Text>
            )}
            <View style={styles.compactRating}>
              <Ionicons name="star" size={9} color="#FFD700" />
              <Text style={styles.compactRatingText}>
                {post.restaurants?.restaurant_rating?.toFixed(1) || "4.0"}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Enhanced search result card - more attractive with better layout
  const renderSearchResult = (item: any) => {
    const postTypeInfo = getPostTypeInfo(item.post_type);
    const timeRemaining = getTimeRemaining(item.available_until);
    const formattedDate = formatDate(item.created_at);
    const discountPercentage = item.discount_percentage;

    return (
      <TouchableOpacity
        key={item.id}
        style={styles.searchResultCard}
        onPress={() => handlePostClick(item)}
        activeOpacity={0.8}
      >
        <View style={styles.searchResultImageContainer}>
          <Image
            source={{
              uri:
                item.image_url ||
                item.restaurant_image ||
                "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=300&h=200&fit=crop",
            }}
            style={styles.searchResultImage}
          />

          {/* Type Badge */}
          <View
            style={[
              styles.searchResultImageBadge,
              { backgroundColor: postTypeInfo.color },
            ]}
          >
            <Text style={styles.searchResultImageBadgeIcon}>
              {postTypeInfo.icon}
            </Text>
          </View>

          {/* Discount Badge */}
          {discountPercentage > 0 && (
            <View style={styles.searchResultImageDiscount}>
              <Text style={styles.searchResultImageDiscountText}>
                {discountPercentage}% OFF
              </Text>
            </View>
          )}
        </View>

        <View style={styles.searchResultContent}>
          {/* Title and Rating */}
          <View style={styles.searchResultHeader}>
            <Text style={styles.searchResultTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <View style={styles.searchResultRating}>
              <Ionicons name="star" size={11} color="#FFD700" />
              <Text style={styles.searchResultRatingText}>
                {item.restaurant_rating?.toFixed(1) || "4.0"}
              </Text>
            </View>
          </View>

          {/* Restaurant Name with Icon */}
          <View style={styles.searchResultRestaurantRow}>
            <Ionicons name="restaurant-outline" size={11} color="#6B7280" />
            <Text style={styles.searchResultRestaurantText} numberOfLines={1}>
              {item.restaurant_name}
            </Text>
          </View>

          {/* Description */}
          {item.description && (
            <Text style={styles.searchResultDescription} numberOfLines={2}>
              {item.description}
            </Text>
          )}

          {/* Tags/Cuisine */}
          {item.restaurants?.cuisine_type && (
            <View style={styles.searchResultCuisineContainer}>
              <Ionicons name="pricetag-outline" size={11} color="#6B7280" />
              <Text style={styles.searchResultCuisineText} numberOfLines={1}>
                {item.restaurants.cuisine_type}
              </Text>
            </View>
          )}

          {/* Footer with Price, Distance, Time */}
          <View style={styles.searchResultFooter}>
            <View style={styles.searchResultPriceContainer}>
              {item.discounted_price ? (
                <>
                  <Text style={styles.searchResultDiscountedPrice}>
                    AED {item.discounted_price}
                  </Text>
                  {item.original_price && (
                    <Text style={styles.searchResultOriginalPrice}>
                      AED {item.original_price}
                    </Text>
                  )}
                </>
              ) : (
                <Text style={styles.searchResultPrice}>
                  AED {item.original_price || "—"}
                </Text>
              )}
            </View>

            <View style={styles.searchResultMetaContainer}>
              <View style={styles.searchResultMetaItem}>
                <Ionicons name="location-outline" size={10} color="#6B7280" />
                <Text style={styles.searchResultMetaText}>
                  {item.distanceText || "1.2km"}
                </Text>
              </View>

              <View style={styles.searchResultMetaDot} />

              <View style={styles.searchResultMetaItem}>
                <Ionicons name="time-outline" size={10} color="#6B7280" />
                <Text style={styles.searchResultMetaText}>{formattedDate}</Text>
              </View>
            </View>
          </View>

          {/* Engagement Stats */}
          <View style={styles.searchResultEngagement}>
            <View style={styles.searchResultEngagementItem}>
              <Ionicons name="heart-outline" size={11} color="#EF4444" />
              <Text style={styles.searchResultEngagementText}>
                {item.likes_count || 0}
              </Text>
            </View>
            <View style={styles.searchResultEngagementItem}>
              <Ionicons name="chatbubble-outline" size={11} color="#6B7280" />
              <Text style={styles.searchResultEngagementText}>
                {item.comments_count || 0}
              </Text>
            </View>
            <View style={styles.searchResultEngagementItem}>
              <Ionicons name="eye-outline" size={11} color="#6B7280" />
              <Text style={styles.searchResultEngagementText}>
                {item.view_count || 0}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Image-only search result for compact view
  const renderImageSearchResult = (item: any) => (
    <TouchableOpacity
      key={item.id}
      style={styles.imageResultCard}
      onPress={() => handlePostClick(item)}
      activeOpacity={0.8}
    >
      <Image
        source={{
          uri:
            item.image_url ||
            "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=200&h=200&fit=crop",
        }}
        style={styles.imageResultImage}
      />
      {item.discount_percentage > 0 && (
        <View style={styles.imageResultDiscount}>
          <Text style={styles.imageResultDiscountText}>
            {item.discount_percentage}%
          </Text>
        </View>
      )}
      <View style={styles.imageResultOverlay}>
        <Text style={styles.imageResultTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.imageResultRestaurant} numberOfLines={1}>
          {item.restaurant_name}
        </Text>
        <View style={styles.imageResultPrice}>
          {item.discounted_price ? (
            <Text style={styles.imageResultPriceText}>
              AED {item.discounted_price}
            </Text>
          ) : (
            <Text style={styles.imageResultPriceText}>
              AED {item.original_price}
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderFeaturedItem = (item: any) => (
    <TouchableOpacity
      key={item.id}
      style={styles.featuredCard}
      onPress={() => handleSuggestionClick(item.title)}
      activeOpacity={0.8}
    >
      <View style={styles.featuredImageContainer}>
        <Image source={{ uri: item.image }} style={styles.featuredImage} />
        {item.tag && (
          <View style={styles.featuredTag}>
            <Text style={styles.featuredTagText}>{item.tag}</Text>
          </View>
        )}
        <View style={styles.featuredDiscountBadge}>
          <Text style={styles.featuredDiscountText}>
            {Math.round(
              ((item.originalPrice - item.price) / item.originalPrice) * 100,
            )}
            % OFF
          </Text>
        </View>
      </View>

      <View style={styles.featuredContent}>
        <Text style={styles.featuredTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.featuredDescription} numberOfLines={2}>
          {item.description}
        </Text>

        <View style={styles.featuredRestaurantInfo}>
          <Text style={styles.featuredRestaurantName} numberOfLines={1}>
            {item.restaurant}
          </Text>
          <View style={styles.featuredRating}>
            <Ionicons name="star" size={10} color="#FFD700" />
            <Text style={styles.featuredRatingText}>{item.rating}</Text>
          </View>
        </View>

        <View style={styles.featuredFooter}>
          <View style={styles.featuredPriceContainer}>
            <Text style={styles.featuredCurrentPrice}>AED {item.price}</Text>
            <Text style={styles.featuredOriginalPrice}>
              AED {item.originalPrice}
            </Text>
          </View>

          <View style={styles.featuredDeliveryInfo}>
            <Ionicons name="time-outline" size={10} color="#6B7280" />
            <Text style={styles.featuredDeliveryText}>{item.deliveryTime}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderPremiumItem = (item: any) => (
    <TouchableOpacity
      key={item.id}
      style={styles.premiumItemCard}
      onPress={() => handleSuggestionClick(item.name)}
      activeOpacity={0.8}
    >
      <Image source={{ uri: item.image }} style={styles.premiumItemImage} />
      <View style={styles.premiumItemTag}>
        <Text style={styles.premiumItemTagText}>{item.tag}</Text>
      </View>
      <View style={styles.premiumItemContent}>
        <Text style={styles.premiumItemName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.premiumItemRestaurant} numberOfLines={1}>
          {item.restaurant}
        </Text>
        <View style={styles.premiumItemFooter}>
          <Text style={styles.premiumItemPrice}>AED {item.price}</Text>
          <View style={styles.premiumItemRating}>
            <Ionicons name="star" size={9} color="#FFD700" />
            <Text style={styles.premiumItemRatingText}>{item.rating}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Search Header */}
      <View style={styles.searchHeader}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={16} color="#6B7280" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search restaurants, dishes, or cuisines..."
            value={searchQuery}
            onChangeText={handleSearch}
            placeholderTextColor="#9CA3AF"
            autoFocus
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={16} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
        {searchQuery.length > 0 && (
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setShowFilters(!showFilters)}
          >
            <Ionicons
              name="filter"
              size={16}
              color={showFilters ? "#FF6B35" : "#6B7280"}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Quick Filters */}
      {searchQuery.length > 0 && showFilters && (
        <Animated.View style={styles.filtersContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filtersContent}
          >
            {filters.map((filter) => (
              <TouchableOpacity
                key={filter.id}
                style={[
                  styles.filterChip,
                  activeFilter === filter.id && styles.filterChipActive,
                ]}
                onPress={() => setActiveFilter(filter.id)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    activeFilter === filter.id && styles.filterChipTextActive,
                  ]}
                >
                  {filter.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Animated.View>
      )}

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {searchQuery.length === 0 ? (
          <>
            {/* Quick Search Suggestions */}
            <View style={styles.quickSuggestions}>
              <Text style={styles.sectionTitle}>Quick Search</Text>
              <View style={styles.quickSuggestionsGrid}>
                <TouchableOpacity
                  style={[
                    styles.quickSuggestionCard,
                    { backgroundColor: "#FF6B3515" },
                  ]}
                  onPress={() => handleSearch("Near Me")}
                >
                  <View
                    style={[
                      styles.quickSuggestionIcon,
                      { backgroundColor: "#FF6B35" },
                    ]}
                  >
                    <Ionicons name="location" size={16} color="#fff" />
                  </View>
                  <Text style={styles.quickSuggestionText}>Near Me</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.quickSuggestionCard,
                    { backgroundColor: "#10B98115" },
                  ]}
                  onPress={() => handleSearch("Free Delivery")}
                >
                  <View
                    style={[
                      styles.quickSuggestionIcon,
                      { backgroundColor: "#10B981" },
                    ]}
                  >
                    <Ionicons name="bicycle" size={16} color="#fff" />
                  </View>
                  <Text style={styles.quickSuggestionText}>Free Delivery</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.quickSuggestionCard,
                    { backgroundColor: "#3B82F615" },
                  ]}
                  onPress={() => handleSearch("Discounts")}
                >
                  <View
                    style={[
                      styles.quickSuggestionIcon,
                      { backgroundColor: "#3B82F6" },
                    ]}
                  >
                    <Ionicons name="pricetag" size={16} color="#fff" />
                  </View>
                  <Text style={styles.quickSuggestionText}>Discounts</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.quickSuggestionCard,
                    { backgroundColor: "#8B5CF615" },
                  ]}
                  onPress={() => handleSearch("Top Rated")}
                >
                  <View
                    style={[
                      styles.quickSuggestionIcon,
                      { backgroundColor: "#8B5CF6" },
                    ]}
                  >
                    <Ionicons name="star" size={16} color="#fff" />
                  </View>
                  <Text style={styles.quickSuggestionText}>Top Rated</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Popular Categories Row - Dynamic from database */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Popular Categories</Text>
                <TouchableOpacity>
                  <Text style={styles.seeAllText}>See All</Text>
                </TouchableOpacity>
              </View>
              {loadingCategories ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#FF6B35" />
                </View>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.popularCategoriesScroll}
                >
                  {dynamicCategories.map((category) => (
                    <TouchableOpacity
                      key={category.id}
                      style={styles.popularCategoryItem}
                      onPress={() => handleSearch(category.name)}
                    >
                      <View
                        style={[
                          styles.popularCategoryIcon,
                          { backgroundColor: `${category.color}15` },
                        ]}
                      >
                        <Text style={styles.popularCategoryIconText}>
                          {category.icon}
                        </Text>
                      </View>
                      <Text style={styles.popularCategoryName}>
                        {category.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>

            {/* Dietary Collections Grid */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Dietary Preferences</Text>
                <TouchableOpacity>
                  <Text style={styles.seeAllText}>View All</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.dietaryGrid}>
                {DIETARY_COLLECTIONS.slice(0, 4).map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.dietaryCard,
                      { backgroundColor: `${item.color}10` },
                    ]}
                    onPress={() => {
                      handleSearch(item.title);
                      fetchPostsByDietary(item.title);
                    }}
                  >
                    <View
                      style={[
                        styles.dietaryIconContainer,
                        { backgroundColor: item.color },
                      ]}
                    >
                      <Text style={styles.dietaryIcon}>{item.icon}</Text>
                    </View>
                    <Text style={styles.dietaryTitle}>{item.title}</Text>
                    <Text style={styles.dietaryCount}>{item.count}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Meal Time Sections */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Meal Time</Text>
              </View>
              <View style={styles.mealContainer}>
                {MEAL_COLLECTIONS.map((meal) => (
                  <TouchableOpacity
                    key={meal.id}
                    style={styles.mealCard}
                    onPress={() => handleSearch(meal.title)}
                  >
                    <View
                      style={[
                        styles.mealIconContainer,
                        { backgroundColor: `${meal.color}15` },
                      ]}
                    >
                      <Text style={styles.mealIcon}>{meal.icon}</Text>
                    </View>
                    <View style={styles.mealInfo}>
                      <Text style={styles.mealTitle}>{meal.title}</Text>
                      <Text style={styles.mealTime}>{meal.time}</Text>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={14}
                      color="#9CA3AF"
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Recent Searches with Clear Option */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Recent Searches</Text>
                {searchHistory.length > 0 && (
                  <TouchableOpacity onPress={clearSearchHistory}>
                    <Text style={styles.clearText}>Clear All</Text>
                  </TouchableOpacity>
                )}
              </View>
              {searchHistory.length > 0 ? (
                searchHistory.map((search, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.recentItem}
                    onPress={() => handleSearch(search)}
                  >
                    <Ionicons name="time-outline" size={14} color="#6B7280" />
                    <Text style={styles.recentText}>{search}</Text>
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() =>
                        setSearchHistory((prev) =>
                          prev.filter((s) => s !== search),
                        )
                      }
                    >
                      <Ionicons name="close" size={14} color="#9CA3AF" />
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))
              ) : (
                <Text style={styles.emptyText}>No recent searches</Text>
              )}
            </View>

            {/* Trending Searches */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Trending Now</Text>
                <Ionicons name="trending-up" size={14} color="#FF6B35" />
              </View>
              <View style={styles.trendingContainer}>
                {TRENDING_SEARCHES.map((item, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.trendingItem}
                    onPress={() => handleSearch(item.term)}
                  >
                    <View style={styles.trendingIconContainer}>
                      <Text style={styles.trendingIcon}>{item.icon}</Text>
                    </View>
                    <View style={styles.trendingInfo}>
                      <Text style={styles.trendingTerm}>{item.term}</Text>
                      <Text style={styles.trendingCount}>
                        {item.count} searches
                      </Text>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={14}
                      color="#9CA3AF"
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Limited Time Offers */}
            {limitedTimePosts.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>⏳ Ending Soon</Text>
                  <TouchableOpacity>
                    <Text style={styles.seeAllText}>View All</Text>
                  </TouchableOpacity>
                </View>
                {loadingLimited ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color="#FF6B35" />
                  </View>
                ) : (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.compactPostsContainer}
                  >
                    {limitedTimePosts.map((post) =>
                      renderCompactPostCard(post),
                    )}
                  </ScrollView>
                )}
              </View>
            )}

            {/* Halal Options */}
            {halalPosts.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>🕌 Halal Certified</Text>
                  <TouchableOpacity onPress={() => handleSearch("Halal")}>
                    <Text style={styles.seeAllText}>View All</Text>
                  </TouchableOpacity>
                </View>
                {loadingHalal ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color="#7C3AED" />
                  </View>
                ) : (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.compactPostsContainer}
                  >
                    {halalPosts.map((post) => renderCompactPostCard(post))}
                  </ScrollView>
                )}
              </View>
            )}

            {/* Vegan Options */}
            {veganPosts.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>🌱 Vegan Friendly</Text>
                  <TouchableOpacity onPress={() => handleSearch("Vegan")}>
                    <Text style={styles.seeAllText}>View All</Text>
                  </TouchableOpacity>
                </View>
                {loadingVegan ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color="#10B981" />
                  </View>
                ) : (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.compactPostsContainer}
                  >
                    {veganPosts.map((post) => renderCompactPostCard(post))}
                  </ScrollView>
                )}
              </View>
            )}

            {/* Premium Items */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>👑 Premium Picks</Text>
                <TouchableOpacity>
                  <Text style={styles.seeAllText}>View All</Text>
                </TouchableOpacity>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.premiumItemsContainer}
              >
                {PREMIUM_ITEMS.map((item) => renderPremiumItem(item))}
              </ScrollView>
            </View>

            {/* Popular Suggestions */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Popular Categories</Text>
              <View style={styles.suggestionsGrid}>
                {SEARCH_SUGGESTIONS.map((suggestion, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.suggestionChip}
                    onPress={() => handleSearch(suggestion)}
                  >
                    <Text style={styles.suggestionText}>{suggestion}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Fresh Posts */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Fresh Posts</Text>
                <TouchableOpacity>
                  <Text style={styles.seeAllText}>View All</Text>
                </TouchableOpacity>
              </View>

              {loadingPosts ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#FF6B35" />
                  <Text style={styles.loadingText}>Loading posts...</Text>
                </View>
              ) : posts.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.postsContainer}
                >
                  {posts.slice(0, 4).map((post) => renderPostCard(post))}
                </ScrollView>
              ) : (
                <View style={styles.emptyPostsContainer}>
                  <Ionicons
                    name="newspaper-outline"
                    size={32}
                    color="#D1D5DB"
                  />
                  <Text style={styles.emptyPostsText}>No posts available</Text>
                </View>
              )}
            </View>

            {/* Featured Items */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Featured Items</Text>
                <TouchableOpacity>
                  <Text style={styles.seeAllText}>View All</Text>
                </TouchableOpacity>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.featuredContainer}
              >
                {FEATURED_ITEMS.map((item) => renderFeaturedItem(item))}
              </ScrollView>
            </View>

            {/* Popular Restaurants */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Popular Restaurants</Text>
                <TouchableOpacity>
                  <Text style={styles.seeAllText}>See All</Text>
                </TouchableOpacity>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.restaurantsScroll}
              >
                {POPULAR_RESTAURANTS.map((restaurant) => (
                  <TouchableOpacity
                    key={restaurant.id}
                    style={styles.popularRestaurantCard}
                    onPress={() => handleSearch(restaurant.name)}
                  >
                    <Image
                      source={{ uri: restaurant.image }}
                      style={styles.popularRestaurantImage}
                    />
                    <View style={styles.popularRestaurantInfo}>
                      <Text
                        style={styles.popularRestaurantName}
                        numberOfLines={1}
                      >
                        {restaurant.name}
                      </Text>
                      <Text
                        style={styles.popularRestaurantCuisine}
                        numberOfLines={1}
                      >
                        {restaurant.cuisine}
                      </Text>
                      <View style={styles.popularRestaurantMeta}>
                        <View style={styles.ratingBadge}>
                          <Ionicons name="star" size={10} color="#FFD700" />
                          <Text style={styles.ratingText}>
                            {restaurant.rating}
                          </Text>
                        </View>
                        <Text style={styles.metaText}>•</Text>
                        <Text style={styles.metaText}>
                          {restaurant.deliveryTime}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Hot Deals */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Hot Deals 🔥</Text>
              </View>
              <View style={styles.hotDealsContainer}>
                <TouchableOpacity
                  style={styles.hotDealCard}
                  onPress={() => handleSearch("Flash Sale")}
                >
                  <View
                    style={[
                      styles.hotDealIcon,
                      { backgroundColor: "#FF6B3515" },
                    ]}
                  >
                    <Ionicons name="flash" size={20} color="#FF6B35" />
                  </View>
                  <View style={styles.hotDealContent}>
                    <Text style={styles.hotDealTitle}>Flash Sale</Text>
                    <Text style={styles.hotDealSubtitle}>Up to 50% OFF</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.hotDealCard}
                  onPress={() => handleSearch("Free Delivery")}
                >
                  <View
                    style={[
                      styles.hotDealIcon,
                      { backgroundColor: "#10B98115" },
                    ]}
                  >
                    <Ionicons name="gift" size={20} color="#10B981" />
                  </View>
                  <View style={styles.hotDealContent}>
                    <Text style={styles.hotDealTitle}>Free Delivery</Text>
                    <Text style={styles.hotDealSubtitle}>All day today</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>

            {/* Trending Posts */}
            {trendingPosts.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>📈 Trending Now</Text>
                  <TouchableOpacity>
                    <Text style={styles.seeAllText}>View All</Text>
                  </TouchableOpacity>
                </View>
                {loadingTrending ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color="#3B82F6" />
                  </View>
                ) : (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.compactPostsContainer}
                  >
                    {trendingPosts.map((post) => renderCompactPostCard(post))}
                  </ScrollView>
                )}
              </View>
            )}

            {/* Most Liked */}
            {popularPosts.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>❤️ Most Liked</Text>
                  <TouchableOpacity>
                    <Text style={styles.seeAllText}>View All</Text>
                  </TouchableOpacity>
                </View>
                {loadingPopular ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color="#EF4444" />
                  </View>
                ) : (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.compactPostsContainer}
                  >
                    {popularPosts.map((post) => renderCompactPostCard(post))}
                  </ScrollView>
                )}
              </View>
            )}
          </>
        ) : (
          // Search Results
          <View style={styles.resultsContainer}>
            <View style={styles.resultsHeader}>
              <View>
                <Text style={styles.resultsTitle}>
                  Results for "{searchQuery}"
                </Text>
                <Text style={styles.resultsCount}>
                  {searchResults.length}{" "}
                  {searchResults.length === 1 ? "result" : "results"} found
                </Text>
              </View>
              {searchResults.length > 0 && (
                <TouchableOpacity style={styles.resultsFilterButton}>
                  <Ionicons name="options-outline" size={18} color="#FF6B35" />
                </TouchableOpacity>
              )}
            </View>

            {loadingResults ? (
              <View style={styles.loadingResultsContainer}>
                <ActivityIndicator size="large" color="#FF6B35" />
                <Text style={styles.loadingResultsText}>Searching...</Text>
              </View>
            ) : (
              <>
                {/* Results Grid - 2 columns for images */}
                {searchResults.length > 0 && (
                  <View style={styles.resultsGrid}>
                    {searchResults.map((result) =>
                      renderImageSearchResult(result),
                    )}
                  </View>
                )}

                {/* Detailed Results List */}
                <View style={styles.resultsList}>
                  {searchResults
                    .slice(0, 5)
                    .map((result) => renderSearchResult(result))}
                </View>

                {/* View More Button if more than 5 results */}
                {searchResults.length > 5 && (
                  <TouchableOpacity style={styles.viewMoreButton}>
                    <Text style={styles.viewMoreButtonText}>
                      View {searchResults.length - 5} More Results
                    </Text>
                    <Ionicons name="arrow-down" size={14} color="#FF6B35" />
                  </TouchableOpacity>
                )}

                {/* No Results State */}
                {searchResults.length === 0 && (
                  <View style={styles.noResults}>
                    <View style={styles.noResultsIconContainer}>
                      <Ionicons
                        name="search-outline"
                        size={48}
                        color="#D1D5DB"
                      />
                    </View>
                    <Text style={styles.noResultsTitle}>No results found</Text>
                    <Text style={styles.noResultsText}>
                      We couldn't find any matches for "{searchQuery}"
                    </Text>

                    <View style={styles.noResultsSuggestions}>
                      <Text style={styles.noResultsSuggestionsTitle}>Try:</Text>
                      <View style={styles.noResultsChips}>
                        <TouchableOpacity
                          style={styles.noResultsChip}
                          onPress={() => handleSearch("Pizza")}
                        >
                          <Text style={styles.noResultsChipText}>Pizza</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.noResultsChip}
                          onPress={() => handleSearch("Burger")}
                        >
                          <Text style={styles.noResultsChipText}>Burger</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.noResultsChip}
                          onPress={() => handleSearch("Sushi")}
                        >
                          <Text style={styles.noResultsChipText}>Sushi</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.noResultsChip}
                          onPress={() => handleSearch("Arabic")}
                        >
                          <Text style={styles.noResultsChipText}>Arabic</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    <TouchableOpacity
                      style={styles.backToBrowse}
                      onPress={() => setSearchQuery("")}
                    >
                      <Text style={styles.backToBrowseText}>
                        Browse All Posts
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Search Tips */}
                {searchResults.length > 0 && (
                  <View style={styles.searchTips}>
                    <Text style={styles.searchTipsTitle}>💡 Search Tips</Text>
                    <View style={styles.tipItem}>
                      <Ionicons
                        name="checkmark-circle"
                        size={14}
                        color="#10B981"
                      />
                      <Text style={styles.tipText}>
                        Use specific dish names for better results
                      </Text>
                    </View>
                    <View style={styles.tipItem}>
                      <Ionicons
                        name="checkmark-circle"
                        size={14}
                        color="#10B981"
                      />
                      <Text style={styles.tipText}>
                        Try searching by cuisine type (e.g., "Italian")
                      </Text>
                    </View>
                    <View style={styles.tipItem}>
                      <Ionicons
                        name="checkmark-circle"
                        size={14}
                        color="#10B981"
                      />
                      <Text style={styles.tipText}>
                        Include restaurant names for exact matches
                      </Text>
                    </View>
                  </View>
                )}
              </>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    marginBottom: -22,
  },
  searchHeader: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  searchContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 0.6,
    borderColor: "#999",
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: "#111827",
    fontWeight: "400",
  },
  filterButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F9FAFB",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  filtersContainer: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    paddingVertical: 12,
  },
  filtersContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  filterChipActive: {
    backgroundColor: "#FF6B35",
    borderColor: "#FF6B35",
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },
  filterChipTextActive: {
    color: "#FFFFFF",
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  quickSuggestions: {
    marginBottom: 24,
  },
  quickSuggestionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  quickSuggestionCard: {
    width: (SCREEN_WIDTH - 52) / 2,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  quickSuggestionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  quickSuggestionText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#111827",
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
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  clearText: {
    fontSize: 12,
    color: "#FF6B35",
    fontWeight: "600",
  },
  recentItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    gap: 12,
  },
  recentText: {
    fontSize: 13,
    color: "#374151",
    fontWeight: "400",
    flex: 1,
  },
  removeButton: {
    padding: 4,
  },
  emptyText: {
    fontSize: 13,
    color: "#9CA3AF",
    textAlign: "center",
    paddingVertical: 24,
    fontWeight: "400",
  },
  trendingContainer: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    overflow: "hidden",
  },
  trendingItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  trendingIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  trendingIcon: {
    fontSize: 20,
  },
  trendingInfo: {
    flex: 1,
  },
  trendingTerm: {
    fontSize: 13,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 2,
  },
  trendingCount: {
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "400",
  },
  suggestionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  suggestionChip: {
    backgroundColor: "#F9FAFB",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  suggestionText: {
    fontSize: 12,
    color: "#374151",
    fontWeight: "500",
  },
  postsContainer: {
    gap: 14,
  },
  postCard: {
    width: SCREEN_WIDTH * 0.75,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  postImageContainer: {
    position: "relative",
    height: 140,
  },
  postImage: {
    width: "100%",
    height: "100%",
  },
  postTypeBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 107, 53, 0.95)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  postTypeIcon: {
    fontSize: 11,
  },
  postTypeText: {
    fontSize: 9,
    color: "#FFFFFF",
    fontWeight: "700",
  },
  discountBadge: {
    position: "absolute",
    bottom: 10,
    right: 10,
    backgroundColor: "#FF6B35",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  discountText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  postContent: {
    padding: 12,
  },
  restaurantInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  restaurantName: {
    fontSize: 12,
    fontWeight: "700",
    color: "#111827",
    flex: 1,
  },
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFBEB",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 3,
  },
  ratingText: {
    fontSize: 10,
    color: "#92400E",
    fontWeight: "700",
  },
  postTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 6,
    lineHeight: 18,
  },
  postDescription: {
    fontSize: 12,
    color: "#6B7280",
    lineHeight: 16,
    marginBottom: 8,
  },
  priceContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  discountedPrice: {
    fontSize: 15,
    fontWeight: "900",
    color: "#FF6B35",
  },
  originalPrice: {
    fontSize: 11,
    color: "#9CA3AF",
    textDecorationLine: "line-through",
    fontWeight: "500",
  },
  postFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statsContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statText: {
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "600",
  },
  distanceText: {
    fontSize: 10,
    color: "#6B7280",
    fontWeight: "600",
  },
  loadingContainer: {
    padding: 30,
    alignItems: "center",
  },
  loadingText: {
    marginTop: 8,
    fontSize: 12,
    color: "#6B7280",
  },
  emptyPostsContainer: {
    padding: 24,
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  emptyPostsText: {
    marginTop: 8,
    fontSize: 12,
    color: "#6B7280",
  },
  featuredContainer: {
    gap: 14,
  },
  featuredCard: {
    width: SCREEN_WIDTH * 0.75,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  featuredImageContainer: {
    position: "relative",
    height: 140,
    overflow: "hidden",
  },
  featuredImage: {
    width: "100%",
    height: "100%",
  },
  featuredTag: {
    position: "absolute",
    top: 10,
    left: 10,
    backgroundColor: "#FF6B35",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  featuredTagText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "700",
  },
  featuredDiscountBadge: {
    position: "absolute",
    bottom: 10,
    right: 10,
    backgroundColor: "#10B981",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  featuredDiscountText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },
  featuredContent: {
    padding: 12,
  },
  featuredTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 6,
    lineHeight: 18,
  },
  featuredDescription: {
    fontSize: 12,
    color: "#6B7280",
    lineHeight: 16,
    marginBottom: 10,
  },
  featuredRestaurantInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  featuredRestaurantName: {
    fontSize: 12,
    fontWeight: "700",
    color: "#374151",
    flex: 1,
    marginRight: 8,
  },
  featuredRating: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFBEB",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 3,
  },
  featuredRatingText: {
    fontSize: 10,
    color: "#92400E",
    fontWeight: "700",
  },
  featuredFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  featuredPriceContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  featuredCurrentPrice: {
    fontSize: 16,
    fontWeight: "900",
    color: "#FF6B35",
  },
  featuredOriginalPrice: {
    fontSize: 12,
    color: "#9CA3AF",
    textDecorationLine: "line-through",
    fontWeight: "500",
  },
  featuredDeliveryInfo: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 4,
  },
  featuredDeliveryText: {
    fontSize: 10,
    color: "#6B7280",
    fontWeight: "600",
  },
  restaurantsScroll: {
    gap: 14,
    paddingVertical: 4,
  },
  popularRestaurantCard: {
    width: SCREEN_WIDTH * 0.65,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  popularRestaurantImage: {
    width: "100%",
    height: 120,
  },
  popularRestaurantInfo: {
    padding: 12,
  },
  popularRestaurantName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  popularRestaurantCuisine: {
    fontSize: 11,
    color: "#6B7280",
    marginBottom: 8,
  },
  popularRestaurantMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFBEB",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 2,
  },
  ratingText: {
    fontSize: 10,
    color: "#92400E",
    fontWeight: "700",
  },
  metaText: {
    fontSize: 10,
    color: "#6B7280",
  },
  seeAllText: {
    fontSize: 12,
    color: "#FF6B35",
    fontWeight: "600",
  },
  hotDealsContainer: {
    flexDirection: "row",
    gap: 12,
  },
  hotDealCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  hotDealIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  hotDealContent: {
    flex: 1,
  },
  hotDealTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 2,
  },
  hotDealSubtitle: {
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "400",
  },
  resultsContainer: {
    flex: 1,
    paddingTop: 8,
    paddingBottom: 24,
  },
  resultsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  resultsTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 2,
  },
  resultsCount: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "400",
  },
  resultsFilterButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F9FAFB",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  resultsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  imageResultCard: {
    width: (SCREEN_WIDTH - 40) / 2,
    marginBottom: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  imageResultImage: {
    width: "100%",
    height: 120,
  },
  imageResultDiscount: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "#FF6B35",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  imageResultDiscountText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  imageResultOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 8,
  },
  imageResultTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 2,
  },
  imageResultRestaurant: {
    fontSize: 10,
    color: "#E5E7EB",
    marginBottom: 4,
  },
  imageResultPrice: {
    flexDirection: "row",
    alignItems: "center",
  },
  imageResultPriceText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#FFD700",
  },
  resultsList: {
    gap: 16,
    marginBottom: 20,
  },
  searchResultCard: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    overflow: "hidden",
  },
  searchResultImageContainer: {
    width: 100,
    height: 140,
    position: "relative",
  },
  searchResultImage: {
    width: "100%",
    height: "100%",
  },
  searchResultImageBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  searchResultImageBadgeIcon: {
    fontSize: 12,
  },
  searchResultImageDiscount: {
    position: "absolute",
    bottom: 8,
    right: 8,
    backgroundColor: "#FF6B35",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  searchResultImageDiscountText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  searchResultContent: {
    flex: 1,
    padding: 12,
  },
  searchResultHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  searchResultTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
    flex: 1,
    marginRight: 8,
  },
  searchResultRating: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFBEB",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 3,
  },
  searchResultRatingText: {
    fontSize: 10,
    color: "#92400E",
    fontWeight: "700",
  },
  searchResultRestaurantRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
    gap: 4,
  },
  searchResultRestaurantText: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "500",
  },
  searchResultDescription: {
    fontSize: 11,
    color: "#6B7280",
    lineHeight: 15,
    marginBottom: 8,
  },
  searchResultCuisineContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 4,
  },
  searchResultCuisineText: {
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "400",
  },
  searchResultFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  searchResultPriceContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  searchResultDiscountedPrice: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FF6B35",
  },
  searchResultOriginalPrice: {
    fontSize: 11,
    color: "#9CA3AF",
    textDecorationLine: "line-through",
  },
  searchResultPrice: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  searchResultMetaContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  searchResultMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  searchResultMetaText: {
    fontSize: 10,
    color: "#6B7280",
  },
  searchResultMetaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "#D1D5DB",
  },
  searchResultEngagement: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    paddingTop: 8,
  },
  searchResultEngagementItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  searchResultEngagementText: {
    fontSize: 10,
    color: "#6B7280",
    fontWeight: "500",
  },
  loadingResultsContainer: {
    padding: 48,
    alignItems: "center",
  },
  loadingResultsText: {
    marginTop: 12,
    fontSize: 13,
    color: "#6B7280",
  },
  noResults: {
    alignItems: "center",
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  noResultsIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#F9FAFB",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  noResultsTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
  },
  noResultsText: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 18,
  },
  noResultsSuggestions: {
    width: "100%",
    marginBottom: 24,
  },
  noResultsSuggestionsTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 12,
  },
  noResultsChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  noResultsChip: {
    backgroundColor: "#F9FAFB",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  noResultsChipText: {
    fontSize: 12,
    color: "#374151",
    fontWeight: "500",
  },
  backToBrowse: {
    backgroundColor: "#FF6B35",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  backToBrowseText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  viewMoreButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F9FAFB",
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    marginBottom: 24,
  },
  viewMoreButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FF6B35",
  },
  searchTips: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    marginTop: 8,
  },
  searchTipsTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 12,
  },
  tipItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 8,
  },
  tipText: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "400",
    flex: 1,
  },

  // Popular Categories Styles
  popularCategoriesScroll: {
    paddingVertical: 4,
    gap: 16,
  },
  popularCategoryItem: {
    alignItems: "center",
    width: 64,
  },
  popularCategoryIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },
  popularCategoryIconText: {
    fontSize: 24,
  },
  popularCategoryName: {
    fontSize: 11,
    color: "#374151",
    fontWeight: "500",
  },

  // Dietary Grid Styles
  dietaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  dietaryCard: {
    width: (SCREEN_WIDTH - 40) / 2,
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  dietaryIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  dietaryIcon: {
    fontSize: 20,
  },
  dietaryTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#111827",
    flex: 1,
  },
  dietaryCount: {
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "500",
  },

  // Meal Time Styles
  mealContainer: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    overflow: "hidden",
  },
  mealCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  mealIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  mealIcon: {
    fontSize: 20,
  },
  mealInfo: {
    flex: 1,
  },
  mealTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 2,
  },
  mealTime: {
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "400",
  },

  // Compact Post Card Styles
  compactPostsContainer: {
    gap: 14,
  },
  compactPostCard: {
    width: 140,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  compactPostImage: {
    width: "100%",
    height: 100,
  },
  compactDiscountBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "#FF6B35",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  compactDiscountText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  compactTimeBadge: {
    position: "absolute",
    bottom: 8,
    left: 8,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 2,
  },
  compactTimeText: {
    fontSize: 8,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  compactPostContent: {
    padding: 10,
  },
  compactPostTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 2,
  },
  compactRestaurantName: {
    fontSize: 11,
    color: "#6B7280",
    marginBottom: 6,
  },
  compactPostFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  compactPrice: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FF6B35",
  },
  compactRating: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  compactRatingText: {
    fontSize: 11,
    color: "#374151",
    fontWeight: "600",
  },

  // Premium Items Styles
  premiumItemsContainer: {
    gap: 14,
  },
  premiumItemCard: {
    width: 130,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  premiumItemImage: {
    width: "100%",
    height: 100,
  },
  premiumItemTag: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "#8B5CF6",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  premiumItemTagText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  premiumItemContent: {
    padding: 10,
  },
  premiumItemName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 2,
  },
  premiumItemRestaurant: {
    fontSize: 11,
    color: "#6B7280",
    marginBottom: 6,
  },
  premiumItemFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  premiumItemPrice: {
    fontSize: 13,
    fontWeight: "800",
    color: "#8B5CF6",
  },
  premiumItemRating: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  premiumItemRatingText: {
    fontSize: 11,
    color: "#374151",
    fontWeight: "600",
  },
});
