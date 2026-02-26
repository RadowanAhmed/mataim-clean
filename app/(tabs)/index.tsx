// app/(tabs)/index.tsx
import { Post } from "@/backend/database.types";
import { useNotification } from "@/backend/NotificationContext";
import {
  FontAwesome5,
  Ionicons,
  MaterialCommunityIcons,
  MaterialIcons,
} from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Animated,
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
import { useAuth } from "../../backend/AuthContext";
import { supabase } from "../../backend/supabase";
import { GuestProfileBanner } from "../components/GuestProfileBanner";
import NotificationBell from "../components/NotificationBell";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function HomeScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const [currentLocation, setCurrentLocation] = useState("Getting location...");
  const [locationLoading, setLocationLoading] = useState(true);
  const [restaurantsLoading, setRestaurantsLoading] = useState(true);
  const [menuItemsLoading, setMenuItemsLoading] = useState(true);
  const [activePromoIndex, setActivePromoIndex] = useState(0);
  const scrollY = useRef(new Animated.Value(0)).current;
  const promoScrollRef = useRef<ScrollView>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [restaurantPosts, setRestaurantPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [featuredRestaurants, setFeaturedRestaurants] = useState<any[]>([]);

  const [recommendedPosts, setRecommendedPosts] = useState<any[]>([]);
  const [recommendedLoading, setRecommendedLoading] = useState(true);

  // State for menu items
  const [menuItems, setMenuItems] = useState<any[]>([]);

  // State for all posts grid
  const [allPosts, setAllPosts] = useState<any[]>([]);
  const [allPostsLoading, setAllPostsLoading] = useState(true);
  const [allPostsPage, setAllPostsPage] = useState(1);
  const [allPostsHasMore, setAllPostsHasMore] = useState(true);
  const [allPostsRefreshing, setAllPostsRefreshing] = useState(false);

  // State for additional dynamic sections
  const [hotDealPosts, setHotDealPosts] = useState<any[]>([]);
  const [eventPosts, setEventPosts] = useState<any[]>([]);
  const [trendingPosts, setTrendingPosts] = useState<any[]>([]);
  const [limitedTimePosts, setLimitedTimePosts] = useState<any[]>([]);
  const [popularPosts, setPopularPosts] = useState<any[]>([]);
  const [veganPosts, setVeganPosts] = useState<any[]>([]);
  const [halalPosts, setHalalPosts] = useState<any[]>([]);
  const [nearbyPosts, setNearbyPosts] = useState<any[]>([]);
  const [breakfastPosts, setBreakfastPosts] = useState<any[]>([]);
  const [lunchPosts, setLunchPosts] = useState<any[]>([]);
  const [dinnerPosts, setDinnerPosts] = useState<any[]>([]);
  const [dessertPosts, setDessertPosts] = useState<any[]>([]);

  // State for quick deals (from posts with high discounts)
  const [quickDeals, setQuickDeals] = useState<any[]>([]);
  const [quickDealsLoading, setQuickDealsLoading] = useState(true);

  // State for categories (from restaurant cuisine types)
  const [categories, setCategories] = useState<any[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);

  const [loadingHotDeals, setLoadingHotDeals] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [loadingTrending, setLoadingTrending] = useState(false);
  const [loadingLimited, setLoadingLimited] = useState(false);
  const [loadingPopular, setLoadingPopular] = useState(false);
  const [loadingVegan, setLoadingVegan] = useState(false);
  const [loadingHalal, setLoadingHalal] = useState(false);
  const [loadingNearby, setLoadingNearby] = useState(false);
  const [loadingBreakfast, setLoadingBreakfast] = useState(false);
  const [loadingLunch, setLoadingLunch] = useState(false);
  const [loadingDinner, setLoadingDinner] = useState(false);
  const [loadingDessert, setLoadingDessert] = useState(false);

  // Add these with your other state declarations (around line 100-120)
  const [pizzaPosts, setPizzaPosts] = useState<any[]>([]);
  const [loadingPizza, setLoadingPizza] = useState(false);
  const [kfcPosts, setKfcPosts] = useState<any[]>([]);
  const [loadingKfc, setLoadingKfc] = useState(false);
  const [drinksPosts, setDrinksPosts] = useState<any[]>([]);
  const [loadingDrinks, setLoadingDrinks] = useState(false);
  const [dessertsPosts, setDessertsPosts] = useState<any[]>([]);
  const [loadingDesserts, setLoadingDesserts] = useState(false);

  const { notificationCount } = useNotification();

  // 🔴 NEW: Favorites state
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [favoriteItems, setFavoriteItems] = useState<any[]>([]);
  const [showFavorites, setShowFavorites] = useState(false);

  // 🔴 NEW: Cart state
  const [cartItemCount, setCartItemCount] = useState(0);
  const [cartTotal, setCartTotal] = useState(0);
  const [cartId, setCartId] = useState<string | null>(null);

  // 🔴 NEW: Dietary preferences state
  const [dietaryFilters, setDietaryFilters] = useState({
    halal: false,
    vegan: false,
    vegetarian: false,
    glutenFree: false,
    spicy: false,
  });

  // 🔴 NEW: Price comparison state
  const [showPriceComparison, setShowPriceComparison] = useState(false);
  const [selectedItemForComparison, setSelectedItemForComparison] =
    useState<any>(null);
  const [comparisonItems, setComparisonItems] = useState<any[]>([]);

  // 🔴 NEW: Active order tracking
  const [activeOrder, setActiveOrder] = useState<any>(null);
  const [showOrderTracker, setShowOrderTracker] = useState(false);

  // Get greeting - memoized
  const getGreeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 18) return "Good Afternoon";
    return "Good Evening";
  }, []);

  // Get meal time for meal-based sections
  const getCurrentMeal = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 11) return "breakfast";
    if (hour < 16) return "lunch";
    return "dinner";
  }, []);

  // Get initials - memoized
  const getInitials = useCallback((name: string) => {
    return (
      name
        ?.split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase() || "U"
    );
  }, []);

  // Auto scroll promotions
  useEffect(() => {
    if (quickDeals.length === 0) return;

    const interval = setInterval(() => {
      if (promoScrollRef.current) {
        const nextIndex = (activePromoIndex + 1) % quickDeals.length;
        setActivePromoIndex(nextIndex);
        promoScrollRef.current.scrollTo({
          x: nextIndex * (SCREEN_WIDTH - 32),
          animated: true,
        });
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [activePromoIndex, quickDeals.length]);

  // 🔴 NEW: Fetch active order
  const fetchActiveOrder = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from("orders")
        .select(
          `
          id,
          order_number,
          status,
          final_amount,
          estimated_delivery_time,
          restaurants (
            restaurant_name,
            image_url,
            latitude,
            longitude
          ),
          driver_id
        `,
        )
        .eq("customer_id", user.id)
        .in("status", [
          "pending",
          "confirmed",
          "preparing",
          "ready",
          "out_for_delivery",
        ])
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (error) {
        setActiveOrder(null);
        return;
      }

      setActiveOrder(data);
      setShowOrderTracker(true);
    } catch (error) {
      console.error("Error fetching active order:", error);
      setActiveOrder(null);
    }
  }, [user?.id]);

  // 🔴 NEW: Fetch cart
  // Replace your fetchCart function
  const fetchCart = useCallback(async () => {
    if (!user?.id) {
      setCartItemCount(0);
      setCartTotal(0);
      return;
    }

    try {
      // Get active cart - use maybeSingle() instead of single()
      const { data: cartData, error: cartError } = await supabase
        .from("carts")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle(); // Changed from .single()

      if (cartError && cartError.code !== "PGRST116") throw cartError;

      let currentCart = cartData;

      if (!currentCart) {
        const { data: newCart, error: createError } = await supabase
          .from("carts")
          .insert({
            user_id: user.id,
            status: "active",
          })
          .select()
          .single();

        if (createError) throw createError;
        currentCart = newCart;
      }

      setCartId(currentCart?.id || null);

      if (currentCart) {
        // Fetch cart items
        const { data: itemsData, error: itemsError } = await supabase
          .from("cart_items")
          .select(
            `
          *,
          posts (
            discounted_price,
            original_price
          )
        `,
          )
          .eq("cart_id", currentCart.id);

        if (itemsError) throw itemsError;

        const count = itemsData?.length || 0;
        const total =
          itemsData?.reduce((sum, item) => {
            const price =
              item.posts?.discounted_price || item.posts?.original_price || 0;
            return sum + price * (item.quantity || 1);
          }, 0) || 0;

        setCartItemCount(count);
        setCartTotal(total);
      } else {
        setCartItemCount(0);
        setCartTotal(0);
      }
    } catch (error) {
      console.error("Error fetching cart:", error);
      setCartItemCount(0);
      setCartTotal(0);
    }
  }, [user?.id]);

  // 🔴 NEW: Fetch favorites
  // 🔴 FIXED: Fetch favorites with correct relationship
  const fetchFavorites = useCallback(async () => {
    if (!user?.id) return;

    try {
      console.log("Fetching favorites for user:", user.id);

      // First, get favorite post IDs
      const { data: favoritesData, error: favError } = await supabase
        .from("favorites")
        .select("post_id")
        .eq("user_id", user.id);

      if (favError) throw favError;

      if (!favoritesData || favoritesData.length === 0) {
        setFavorites(new Set());
        setFavoriteItems([]);
        return;
      }

      const favoriteIds = favoritesData.map((f) => f.post_id);
      const favoriteSet = new Set(favoriteIds);
      setFavorites(favoriteSet);

      // Then fetch the actual post data separately
      const { data: postsData, error: postsError } = await supabase
        .from("posts")
        .select(
          `
        id,
        title,
        description,
        image_url,
        discount_percentage,
        original_price,
        discounted_price,
        restaurants!inner (
          restaurant_name,
          restaurant_rating
        )
      `,
        )
        .in("id", favoriteIds)
        .eq("is_active", true);

      if (postsError) throw postsError;

      // Transform the data to match expected format
      const items = (postsData || []).map((post) => ({
        id: post.id,
        title: post.title,
        description: post.description,
        image_url: post.image_url,
        discount_percentage: post.discount_percentage,
        original_price: post.original_price,
        discounted_price: post.discounted_price,
        restaurants: post.restaurants,
      }));

      setFavoriteItems(items);
      console.log("Favorites loaded:", items.length);
    } catch (error) {
      console.error("Error fetching favorites:", error);
      setFavorites(new Set());
      setFavoriteItems([]);
    }
  }, [user?.id]);

  // 🔴 FIXED: Toggle favorite
  const toggleFavorite = useCallback(
    async (postId: string) => {
      if (!user?.id) {
        router.push("/login");
        return;
      }

      try {
        const isFavorite = favorites.has(postId);

        if (isFavorite) {
          // Remove from favorites
          const { error } = await supabase
            .from("favorites")
            .delete()
            .eq("post_id", postId)
            .eq("user_id", user.id);

          if (error) throw error;

          // Update local state
          setFavorites((prev) => {
            const newSet = new Set(prev);
            newSet.delete(postId);
            return newSet;
          });
          setFavoriteItems((prev) => prev.filter((item) => item.id !== postId));

          console.log("Removed from favorites:", postId);
        } else {
          // Add to favorites
          const { error } = await supabase.from("favorites").insert({
            post_id: postId,
            user_id: user.id,
          });

          if (error) throw error;

          // Update local state
          setFavorites((prev) => new Set(prev).add(postId));

          // Fetch the new favorite item data
          const { data: postData, error: postError } = await supabase
            .from("posts")
            .select(
              `
          id,
          title,
          description,
          image_url,
          discount_percentage,
          original_price,
          discounted_price,
          restaurants!inner (
            restaurant_name,
            restaurant_rating
          )
        `,
            )
            .eq("id", postId)
            .single();

          if (!postError && postData) {
            setFavoriteItems((prev) => [
              ...prev,
              {
                id: postData.id,
                title: postData.title,
                description: postData.description,
                image_url: postData.image_url,
                discount_percentage: postData.discount_percentage,
                original_price: postData.original_price,
                discounted_price: postData.discounted_price,
                restaurants: postData.restaurants,
              },
            ]);
          }

          console.log("Added to favorites:", postId);
        }
      } catch (error) {
        console.error("Error toggling favorite:", error);
      }
    },
    [user?.id, favorites, router],
  );

  // 🔴 NEW: Add to cart
  const addToCart = useCallback(
    async (post: any) => {
      if (!user?.id) {
        router.push("/login");
        return;
      }

      if (!cartId) return;

      try {
        const price = post.discounted_price || post.original_price;

        // Check if item already in cart
        const { data: existingItems } = await supabase
          .from("cart_items")
          .select("*")
          .eq("cart_id", cartId)
          .eq("post_id", post.id);

        if (existingItems && existingItems.length > 0) {
          // Update quantity
          await supabase
            .from("cart_items")
            .update({
              quantity: existingItems[0].quantity + 1,
              total_price: (existingItems[0].quantity + 1) * price,
            })
            .eq("id", existingItems[0].id);
        } else {
          // Insert new item
          await supabase.from("cart_items").insert({
            cart_id: cartId,
            post_id: post.id,
            quantity: 1,
            unit_price: price,
            total_price: price,
          });
        }

        // Refresh cart
        fetchCart();

        // Show feedback
        alert("Added to cart!");
      } catch (error) {
        console.error("Error adding to cart:", error);
      }
    },
    [user?.id, cartId, fetchCart, router],
  );

  // 🔴 NEW: Toggle dietary filter
  const toggleDietaryFilter = (filter: keyof typeof dietaryFilters) => {
    setDietaryFilters((prev) => ({
      ...prev,
      [filter]: !prev[filter],
    }));
  };

  // 🔴 NEW: Find similar items (price comparison)
  const findSimilarItems = useCallback(async (post: any) => {
    setSelectedItemForComparison(post);
    setShowPriceComparison(true);

    try {
      // Find similar items from other restaurants
      const { data, error } = await supabase
        .from("posts")
        .select(
          `
          id,
          title,
          description,
          image_url,
          discount_percentage,
          original_price,
          discounted_price,
          restaurants!inner (
            restaurant_name,
            restaurant_rating,
            delivery_fee
          )
        `,
        )
        .eq("is_active", true)
        .neq("id", post.id)
        .ilike("title", `%${post.title.split(" ")[0]}%`)
        .limit(5);

      if (error) throw error;

      const items = (data || []).map((item) => ({
        ...item,
        restaurant_name: item.restaurants?.restaurant_name,
        restaurant_rating: item.restaurants?.restaurant_rating,
        delivery_fee: item.restaurants?.delivery_fee,
      }));

      setComparisonItems(items);
    } catch (error) {
      console.error("Error finding similar items:", error);
      setComparisonItems([]);
    }
  }, []);

  // Fetch data on mount
  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (user?.id) {
      fetchCart();
      fetchFavorites();
      fetchActiveOrder();
    }
  }, [user?.id, fetchCart, fetchFavorites, fetchActiveOrder]);

  const loadInitialData = async () => {
    await Promise.all([
      getCurrentLocation(),
      fetchRestaurants(),
      fetchMenuItems(),
      fetchRestaurantPosts(),
      fetchQuickDeals(),
      fetchCategories(),
      fetchAllSections(),
      fetchAllPosts(1, true),
      fetchRecommendedPosts(),
    ]);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadInitialData();
    if (user?.id) {
      await Promise.all([fetchCart(), fetchFavorites(), fetchActiveOrder()]);
    }
    setRefreshing(false);
  }, [user?.id, fetchCart, fetchFavorites, fetchActiveOrder]);

  // Fetch all dynamic sections in parallel
  const fetchAllSections = useCallback(async () => {
    await Promise.allSettled([
      fetchHotDealPosts(),
      fetchEventPosts(),
      fetchTrendingPosts(),
      fetchLimitedTimePosts(),
      fetchPopularPosts(),
      fetchVeganPosts(),
      fetchHalalPosts(),
      fetchNearbyPosts(),
      fetchBreakfastPosts(),
      fetchLunchPosts(),
      fetchDinnerPosts(),
      fetchDessertPosts(),

      fetchPizzaPosts(), // Add this
      fetchKfcPosts(), // Add this
      fetchDrinksPosts(), // Add this
      fetchDessertsPosts(), // Add this
    ]);
  }, []);

  // Fetch quick deals from posts (highest discounts)
  const fetchQuickDeals = useCallback(async () => {
    try {
      setQuickDealsLoading(true);
      const { data, error } = await supabase
        .from("posts")
        .select(
          `
          id,
          title,
          description,
          image_url,
          discount_percentage,
          original_price,
          discounted_price,
          available_until,
          restaurants!inner (
            restaurant_name,
            cuisine_type,
            restaurant_rating
          )
        `,
        )
        .eq("is_active", true)
        .gt("discount_percentage", 0)
        .order("discount_percentage", { ascending: false })
        .limit(5);

      if (error) throw error;

      const colors = ["#FF4757", "#10AC84", "#FECA57", "#8B5CF6", "#3B82F6"];
      const deals = (data || []).map((deal, index) => ({
        id: deal.id,
        title: deal.discount_percentage >= 30 ? "Flash Sale" : "Special Deal",
        subtitle:
          deal.discount_percentage >= 40 ? "Limited time" : "Today only",
        discount: `${deal.discount_percentage}% OFF`,
        restaurant: deal.restaurants?.restaurant_name || "Restaurant",
        image:
          deal.image_url ||
          "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=200&fit=crop",
        timeLeft: "2h 30m",
        color: colors[index % colors.length],
      }));

      setQuickDeals(deals);
    } catch (error) {
      console.error("Error fetching quick deals:", error);
      setQuickDeals([]);
    } finally {
      setQuickDealsLoading(false);
    }
  }, []);

  // Fetch categories from restaurants
  // Replace your fetchCategories function with this fixed version
  const fetchCategories = useCallback(async () => {
    try {
      setCategoriesLoading(true);
      const { data, error } = await supabase
        .from("restaurants")
        .select("cuisine_type, image_url")
        .eq("restaurant_status", "active")
        .not("cuisine_type", "is", null);

      if (error) throw error;

      // Define default images FIRST
      const defaultImages: { [key: string]: string } = {
        Arabic:
          "https://images.unsplash.com/photo-1563245372-f21724e3856d?w=200&h=200&fit=crop",
        Indian:
          "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=200&h=200&fit=crop",
        Italian:
          "https://images.unsplash.com/photo-1604068549290-dea0e4a305ca?w=200&h=200&fit=crop",
        Pizza:
          "https://images.unsplash.com/photo-1604068549290-dea0e4a305ca?w=200&h=200&fit=crop",
        Burgers:
          "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=200&h=200&fit=crop",
        Sushi:
          "https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=200&h=200&fit=crop",
        Chinese:
          "https://images.unsplash.com/photo-1585032226651-759b368d7246?w=200&h=200&fit=crop",
        Desserts:
          "https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?w=200&h=200&fit=crop",
      };

      // Define helper function
      const getCategoryImage = (cuisine: string) => {
        if (!cuisine)
          return "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=200&h=200&fit=crop";

        for (const [key, url] of Object.entries(defaultImages)) {
          if (cuisine.toLowerCase().includes(key.toLowerCase())) {
            return url;
          }
        }
        return "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=200&h=200&fit=crop";
      };

      const cuisineMap = new Map();

      // Safe iteration
      if (data && Array.isArray(data)) {
        data.forEach((item) => {
          if (item?.cuisine_type && !cuisineMap.has(item.cuisine_type)) {
            cuisineMap.set(item.cuisine_type, {
              id: item.cuisine_type,
              name: item.cuisine_type.split(" • ")[0] || item.cuisine_type,
              image: item.image_url || getCategoryImage(item.cuisine_type),
            });
          }
        });
      }

      const categoriesList = Array.from(cuisineMap.values()).slice(0, 8);
      setCategories(
        categoriesList.length > 0 ? categoriesList : fallbackCategories,
      );
    } catch (error) {
      console.error("Error fetching categories:", error);
      setCategories(fallbackCategories);
    } finally {
      setCategoriesLoading(false);
    }
  }, []);

  // Add fallback categories
  const fallbackCategories = [
    {
      id: "1",
      name: "Arabic",
      image:
        "https://images.unsplash.com/photo-1563245372-f21724e3856d?w=200&h=200&fit=crop",
    },
    {
      id: "2",
      name: "Indian",
      image:
        "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=200&h=200&fit=crop",
    },
    {
      id: "3",
      name: "Pizza",
      image:
        "https://images.unsplash.com/photo-1604068549290-dea0e4a305ca?w=200&h=200&fit=crop",
    },
    {
      id: "4",
      name: "Burgers",
      image:
        "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=200&h=200&fit=crop",
    },
  ];

  // Helper to transform raw post data
  const transformPosts = (posts: any[]) => {
    return posts.map((post, index) => ({
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
  };

  // Fetch menu items from restaurants
  const fetchMenuItems = useCallback(async () => {
    try {
      setMenuItemsLoading(true);
      const { data, error } = await supabase
        .from("menu_items")
        .select(
          `
          id,
          name,
          description,
          price,
          category,
          image_url,
          is_available,
          preparation_time,
          calories,
          dietary_tags,
          popularity,
          spice_level,
          restaurant_id,
          restaurants!inner (
            restaurant_name,
            cuisine_type,
            restaurant_rating,
            delivery_fee,
            image_url
          )
        `,
        )
        .eq("is_available", true)
        .order("created_at", { ascending: false })
        .limit(6);

      if (error) throw error;

      const transformedItems = (data || []).map((item, index) => ({
        ...item,
        distanceText: `${(index * 0.5 + 0.3).toFixed(1)}km`,
        restaurant_name: item.restaurants?.restaurant_name || "Restaurant",
        cuisine_type: item.restaurants?.cuisine_type || "Various",
        restaurant_rating: item.restaurants?.restaurant_rating || 4.0,
        delivery_fee:
          item.restaurants?.delivery_fee === 0
            ? "Free"
            : `AED ${item.restaurants?.delivery_fee || 5}`,
      }));

      setMenuItems(transformedItems);
    } catch (error) {
      console.error("Error fetching menu items:", error);
      setMenuItems([]);
    } finally {
      setMenuItemsLoading(false);
    }
  }, []);

  // Fetch all posts for grid view with pagination
  const fetchAllPosts = useCallback(
    async (page: number = 1, reset: boolean = false) => {
      try {
        if (reset) {
          setAllPostsLoading(true);
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
          .order("created_at", { ascending: false })
          .range(from, to);

        if (error) throw error;

        const transformedPosts = transformPosts(data || []);

        setAllPosts((prev) =>
          reset ? transformedPosts : [...prev, ...transformedPosts],
        );
        setAllPostsHasMore((data?.length || 0) === 6);
        setAllPostsPage(page);
      } catch (error) {
        console.error("Error fetching all posts:", error);
        setAllPosts([]);
      } finally {
        setAllPostsLoading(false);
        setAllPostsRefreshing(false);
      }
    },
    [],
  );

  // Load more posts for infinite scroll
  const loadMorePosts = useCallback(() => {
    if (!allPostsLoading && allPostsHasMore) {
      fetchAllPosts(allPostsPage + 1, false);
    }
  }, [allPostsLoading, allPostsHasMore, allPostsPage, fetchAllPosts]);

  // Refresh all posts
  const refreshAllPosts = useCallback(() => {
    setAllPostsRefreshing(true);
    fetchAllPosts(1, true);
  }, [fetchAllPosts]);

  // Fetch functions for each section
  const fetchHotDealPosts = useCallback(async () => {
    try {
      setLoadingHotDeals(true);
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
        .eq("post_type", "promotion")
        .gt("discount_percentage", 0)
        .order("discount_percentage", { ascending: false })
        .limit(4);

      if (error) throw error;
      setHotDealPosts(transformPosts(data || []));
    } catch (error) {
      console.error("Error fetching hot deals:", error);
      setHotDealPosts([]);
    } finally {
      setLoadingHotDeals(false);
    }
  }, []);

  const fetchRecommendedPosts = useCallback(async () => {
    try {
      setRecommendedLoading(true);
      const { data, error } = await supabase
        .from("posts")
        .select(
          `
        id,
        title,
        description,
        image_url,
        discount_percentage,
        original_price,
        discounted_price,
        available_until,
        likes_count,
        comments_count,
        view_count,
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
        .order("view_count", { ascending: false })
        .order("likes_count", { ascending: false })
        .limit(5);

      if (error) throw error;

      const transformedPosts = (data || []).map((post, index) => ({
        id: post.id,
        title: post.title,
        description: post.description,
        price: post.discounted_price || post.original_price || 0,
        originalPrice: post.original_price || 0,
        restaurant: post.restaurants?.restaurant_name || "Restaurant",
        image:
          post.image_url ||
          "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=300&h=200&fit=crop",
        rating: post.restaurants?.restaurant_rating || 4.0,
        deliveryTime: "25-35 min",
        tag: post.discount_percentage
          ? `${post.discount_percentage}% OFF`
          : "Recommended",
      }));

      setRecommendedPosts(transformedPosts);
    } catch (error) {
      console.error("Error fetching recommended posts:", error);
      setRecommendedPosts([]);
    } finally {
      setRecommendedLoading(false);
    }
  }, []);

  const fetchEventPosts = useCallback(async () => {
    try {
      setLoadingEvents(true);
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
        .eq("post_type", "event")
        .order("created_at", { ascending: false })
        .limit(3);

      if (error) throw error;
      setEventPosts(transformPosts(data || []));
    } catch (error) {
      console.error("Error fetching events:", error);
      setEventPosts([]);
    } finally {
      setLoadingEvents(false);
    }
  }, []);

  const fetchTrendingPosts = useCallback(async () => {
    try {
      setLoadingTrending(true);
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
        .order("view_count", { ascending: false })
        .limit(4);

      if (error) throw error;
      setTrendingPosts(transformPosts(data || []));
    } catch (error) {
      console.error("Error fetching trending:", error);
      setTrendingPosts([]);
    } finally {
      setLoadingTrending(false);
    }
  }, []);

  const fetchLimitedTimePosts = useCallback(async () => {
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
        .not("available_until", "is", null)
        .lte("available_until", sevenDaysFromNow.toISOString())
        .order("available_until", { ascending: true })
        .limit(3);

      if (error) throw error;
      setLimitedTimePosts(transformPosts(data || []));
    } catch (error) {
      console.error("Error fetching limited time:", error);
      setLimitedTimePosts([]);
    } finally {
      setLoadingLimited(false);
    }
  }, []);

  const fetchPopularPosts = useCallback(async () => {
    try {
      setLoadingPopular(true);
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
        .order("likes_count", { ascending: false })
        .limit(4);

      if (error) throw error;
      setPopularPosts(transformPosts(data || []));
    } catch (error) {
      console.error("Error fetching popular:", error);
      setPopularPosts([]);
    } finally {
      setLoadingPopular(false);
    }
  }, []);

  const fetchVeganPosts = useCallback(async () => {
    try {
      setLoadingVegan(true);
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
        .overlaps("tags", ["Vegan", "Vegetarian"])
        .order("created_at", { ascending: false })
        .limit(3);

      if (error) throw error;
      setVeganPosts(transformPosts(data || []));
    } catch (error) {
      console.error("Error fetching vegan posts:", error);
      setVeganPosts([]);
    } finally {
      setLoadingVegan(false);
    }
  }, []);

  const fetchHalalPosts = useCallback(async () => {
    try {
      setLoadingHalal(true);
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
        .contains("tags", ["Halal"])
        .order("created_at", { ascending: false })
        .limit(3);

      if (error) throw error;
      setHalalPosts(transformPosts(data || []));
    } catch (error) {
      console.error("Error fetching halal posts:", error);
      setHalalPosts([]);
    } finally {
      setLoadingHalal(false);
    }
  }, []);

  const fetchNearbyPosts = useCallback(async () => {
    try {
      setLoadingNearby(true);
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
        .limit(3);

      if (error) throw error;
      setNearbyPosts(transformPosts(data || []));
    } catch (error) {
      console.error("Error fetching nearby posts:", error);
      setNearbyPosts([]);
    } finally {
      setLoadingNearby(false);
    }
  }, []);

  const fetchBreakfastPosts = useCallback(async () => {
    try {
      setLoadingBreakfast(true);
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
        .overlaps("tags", ["Breakfast", "Morning"])
        .order("created_at", { ascending: false })
        .limit(3);

      if (error) throw error;
      setBreakfastPosts(transformPosts(data || []));
    } catch (error) {
      console.error("Error fetching breakfast posts:", error);
      setBreakfastPosts([]);
    } finally {
      setLoadingBreakfast(false);
    }
  }, []);

  const fetchLunchPosts = useCallback(async () => {
    try {
      setLoadingLunch(true);
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
        .overlaps("tags", ["Lunch", "Lunch Special"])
        .order("created_at", { ascending: false })
        .limit(3);

      if (error) throw error;
      setLunchPosts(transformPosts(data || []));
    } catch (error) {
      console.error("Error fetching lunch posts:", error);
      setLunchPosts([]);
    } finally {
      setLoadingLunch(false);
    }
  }, []);

  const fetchDinnerPosts = useCallback(async () => {
    try {
      setLoadingDinner(true);
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
        .overlaps("tags", ["Dinner", "Dinner Special"])
        .order("created_at", { ascending: false })
        .limit(3);

      if (error) throw error;
      setDinnerPosts(transformPosts(data || []));
    } catch (error) {
      console.error("Error fetching dinner posts:", error);
      setDinnerPosts([]);
    } finally {
      setLoadingDinner(false);
    }
  }, []);

  const fetchDessertPosts = useCallback(async () => {
    try {
      setLoadingDessert(true);
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
        .overlaps("tags", ["Dessert", "Sweet"])
        .order("created_at", { ascending: false })
        .limit(3);

      if (error) throw error;
      setDessertPosts(transformPosts(data || []));
    } catch (error) {
      console.error("Error fetching dessert posts:", error);
      setDessertPosts([]);
    } finally {
      setLoadingDessert(false);
    }
  }, []);

  // Fetch restaurants from Supabase
  const fetchRestaurants = async () => {
    try {
      setRestaurantsLoading(true);
      const { data, error } = await supabase
        .from("restaurants")
        .select(
          "id, restaurant_name, cuisine_type, restaurant_rating, image_url, delivery_fee, min_order_amount",
        )
        .eq("restaurant_status", "active")
        .limit(6);

      if (error) throw error;

      const transformedRestaurants = (data || []).map((restaurant, index) => ({
        id: restaurant.id,
        name: restaurant.restaurant_name,
        cuisine: restaurant.cuisine_type || "Various",
        rating: restaurant.restaurant_rating || 4.0,
        deliveryTime: "25-35 min",
        price: "$$",
        image:
          restaurant.image_url ||
          "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=300&h=200&fit=crop",
        promotion:
          restaurant.delivery_fee === 0 ? "Free Delivery" : "Special Offer",
        isOpen: true,
        deliveryFee:
          restaurant.delivery_fee === 0
            ? "Free"
            : `AED ${restaurant.delivery_fee || 5}`,
        minOrder: `AED ${restaurant.min_order_amount || 20}`,
        distance: `${(index * 0.5 + 0.5).toFixed(1)} km`,
      }));

      setFeaturedRestaurants(transformedRestaurants);
    } catch (error) {
      console.error("Error fetching restaurants:", error);
      setFeaturedRestaurants([]);
    } finally {
      setRestaurantsLoading(false);
    }
  };

  // Fetch restaurant posts
  const fetchRestaurantPosts = useCallback(async () => {
    try {
      setPostsLoading(true);

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
        .limit(4);

      if (error) throw error;

      const postsWithDetails = transformPosts(data || []);
      setRestaurantPosts(postsWithDetails);
    } catch (error) {
      console.error("Error fetching posts:", error);
      setRestaurantPosts([]);
    } finally {
      setPostsLoading(false);
    }
  }, []);

  // Get location
  const getCurrentLocation = async () => {
    try {
      setLocationLoading(true);

      let { status } = await Location.requestForegroundPermissionsAsync();

      if (status === "granted") {
        let location = await Location.getCurrentPositionAsync({});

        let [address] = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });

        if (address) {
          const city = address.city || address.region || "";
          const street = address.street || address.name || "";
          const locationText = city
            ? `${city}${street ? ", " + street : ""}`
            : "Current Location";
          setCurrentLocation(locationText);
        } else {
          setCurrentLocation("Current Location");
        }
      } else {
        setCurrentLocation("Enable location access");
      }
    } catch (error) {
      console.log("Location error:", error);
      setCurrentLocation("Dubai, UAE");
    } finally {
      setLocationLoading(false);
    }
  };

  // Handle post click
  const handlePostClick = useCallback(
    async (post: any) => {
      router.push({
        pathname: "/post/[id]",
        params: {
          id: post.id,
          restaurantId: post.restaurant_id,
        },
      });
    },
    [router],
  );

  // Handle menu item click
  const handleMenuItemClick = useCallback(
    (item: any) => {
      router.push({
        pathname: "/menu/[restaurantId]",
        params: {
          restaurantId: item.restaurant_id,
          highlightedItemId: item.id,
        },
      });
    },
    [router],
  );

  // Handle like post
  const handleLikePost = useCallback(
    async (postId: string) => {
      if (!user?.id) {
        router.push("/login");
        return;
      }

      try {
        const isCurrentlyLiked = likedPosts.has(postId);

        const updatePostsArray = (postsArray: any[]) =>
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

        setRestaurantPosts((prev) => updatePostsArray(prev));
        setHotDealPosts((prev) => updatePostsArray(prev));
        setEventPosts((prev) => updatePostsArray(prev));
        setTrendingPosts((prev) => updatePostsArray(prev));
        setLimitedTimePosts((prev) => updatePostsArray(prev));
        setPopularPosts((prev) => updatePostsArray(prev));
        setVeganPosts((prev) => updatePostsArray(prev));
        setHalalPosts((prev) => updatePostsArray(prev));
        setNearbyPosts((prev) => updatePostsArray(prev));
        setBreakfastPosts((prev) => updatePostsArray(prev));
        setLunchPosts((prev) => updatePostsArray(prev));
        setDinnerPosts((prev) => updatePostsArray(prev));
        setDessertPosts((prev) => updatePostsArray(prev));
        setAllPosts((prev) => updatePostsArray(prev));

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
    [user?.id, likedPosts, router],
  );

  // Get post type info
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

  // Add with your other fetch functions (around line 500-600)

  // Fetch Pizza Posts
  // Fetch Pizza Posts - FIXED
  const fetchPizzaPosts = useCallback(async () => {
    try {
      setLoadingPizza(true);
      const { data, error } = await supabase
        .from("posts")
        .select(
          `
        id,
        title,
        description,
        image_url,
        discount_percentage,
        original_price,
        discounted_price,
        restaurants!inner (
          restaurant_name,
          cuisine_type,
          restaurant_rating
        )
      `,
        )
        .eq("is_active", true)
        .or("title.ilike.%pizza%,description.ilike.%pizza%")
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;

      const transformedPosts = (data || []).map((post) => ({
        ...post,
        restaurant_name: post.restaurants?.restaurant_name,
        restaurant_rating: post.restaurants?.restaurant_rating,
      }));

      setPizzaPosts(transformedPosts);
    } catch (error) {
      console.error("Error fetching pizza posts:", error);
      setPizzaPosts([]);
    } finally {
      setLoadingPizza(false);
    }
  }, []);

  // Fetch KFC/Fried Chicken Posts - FIXED
  const fetchKfcPosts = useCallback(async () => {
    try {
      setLoadingKfc(true);
      const { data, error } = await supabase
        .from("posts")
        .select(
          `
        id,
        title,
        description,
        image_url,
        discount_percentage,
        original_price,
        discounted_price,
        restaurants!inner (
          restaurant_name,
          cuisine_type,
          restaurant_rating
        )
      `,
        )
        .eq("is_active", true)
        .or("title.ilike.%chicken%,title.ilike.%kfc%,description.ilike.%fried%")
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;

      const transformedPosts = (data || []).map((post) => ({
        ...post,
        restaurant_name: post.restaurants?.restaurant_name,
        restaurant_rating: post.restaurants?.restaurant_rating,
      }));

      setKfcPosts(transformedPosts);
    } catch (error) {
      console.error("Error fetching chicken posts:", error);
      setKfcPosts([]);
    } finally {
      setLoadingKfc(false);
    }
  }, []);

  // Fetch Drinks Posts - FIXED
  const fetchDrinksPosts = useCallback(async () => {
    try {
      setLoadingDrinks(true);
      const { data, error } = await supabase
        .from("posts")
        .select(
          `
        id,
        title,
        description,
        image_url,
        discount_percentage,
        original_price,
        discounted_price,
        restaurants!inner (
          restaurant_name,
          cuisine_type,
          restaurant_rating
        )
      `,
        )
        .eq("is_active", true)
        .or(
          "title.ilike.%drink%,title.ilike.%juice%,title.ilike.%soda%,title.ilike.%coffee%,title.ilike.%tea%,title.ilike.%mocktail%",
        )
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;

      const transformedPosts = (data || []).map((post) => ({
        ...post,
        restaurant_name: post.restaurants?.restaurant_name,
        restaurant_rating: post.restaurants?.restaurant_rating,
      }));

      setDrinksPosts(transformedPosts);
    } catch (error) {
      console.error("Error fetching drinks posts:", error);
      setDrinksPosts([]);
    } finally {
      setLoadingDrinks(false);
    }
  }, []);

  // Fetch Desserts Posts - FIXED
  const fetchDessertsPosts = useCallback(async () => {
    try {
      setLoadingDesserts(true);
      const { data, error } = await supabase
        .from("posts")
        .select(
          `
        id,
        title,
        description,
        image_url,
        discount_percentage,
        original_price,
        discounted_price,
        restaurants!inner (
          restaurant_name,
          cuisine_type,
          restaurant_rating
        )
      `,
        )
        .eq("is_active", true)
        .or(
          "title.ilike.%dessert%,title.ilike.%cake%,title.ilike.%ice cream%,title.ilike.%chocolate%,title.ilike.%sweet%",
        )
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;

      const transformedPosts = (data || []).map((post) => ({
        ...post,
        restaurant_name: post.restaurants?.restaurant_name,
        restaurant_rating: post.restaurants?.restaurant_rating,
      }));

      setDessertsPosts(transformedPosts);
    } catch (error) {
      console.error("Error fetching desserts posts:", error);
      setDessertsPosts([]);
    } finally {
      setLoadingDesserts(false);
    }
  }, []);

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

  // Handle Test Item Click
  const handleTestItemClick = useCallback(
    (item: any) => {
      router.push({
        pathname: "/post/[id]",
        params: {
          id: item.id,
        },
      });
    },
    [router],
  );

  // Memoized Post Card Component
  const PostCard = React.memo(({ post }: { post: any }) => {
    const postTypeInfo = getPostTypeInfo(post.post_type);
    const timeRemaining = getTimeRemaining(post.available_until);
    const isLiked = likedPosts.has(post.id);
    const isFavorited = favorites.has(post.id);
    const hasDietaryTags = post.tags && post.tags.length > 0;

    return (
      <TouchableOpacity
        style={styles.postCard}
        onPress={() => handlePostClick(post)}
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

          <View style={styles.topBadgesContainer}>
            <View
              style={[
                styles.postTypeBadge,
                { backgroundColor: postTypeInfo.color },
              ]}
            >
              <Text style={styles.postTypeIcon}>{postTypeInfo.icon}</Text>
              <Text style={styles.postTypeText}>{postTypeInfo.label}</Text>
            </View>

            <View style={styles.distanceBadge}>
              <Ionicons name="location" size={9} color="#FFFFFF" />
              <Text style={styles.distanceText}>
                {post.distanceText || "1.2km"}
              </Text>
            </View>
          </View>

          {/* 🔴 NEW: Favorite Button */}
          <TouchableOpacity
            style={styles.favoriteButton}
            onPress={(e) => {
              e.stopPropagation();
              toggleFavorite(post.id);
            }}
          >
            <Ionicons
              name={isFavorited ? "heart" : "heart-outline"}
              size={20}
              color={isFavorited ? "#FF6B35" : "#FFFFFF"}
            />
          </TouchableOpacity>

          {post.discount_percentage && (
            <View style={styles.discountBadge}>
              {/* These need to be in <Text> */}
              <Text style={styles.discountPercentage}>
                {post.discount_percentage}%
              </Text>
              <Text style={styles.discountLabel}>OFF</Text>
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
              <View style={styles.priceInfo}>
                {post.original_price && (
                  <Text style={styles.originalPrice}>
                    AED {post.original_price}
                  </Text>
                )}
                {post.discounted_price && (
                  <Text style={styles.discountedPrice}>
                    AED {post.discounted_price}
                  </Text>
                )}
              </View>
              <View style={styles.timeBadge}>
                <Ionicons name="time-outline" size={9} color="#6B7280" />
                <Text style={styles.timeText}>{timeRemaining}</Text>
              </View>
            </View>
          )}

          <View style={styles.postFooter}>
            <View style={styles.statsContainer}>
              <TouchableOpacity
                style={styles.statItem}
                onPress={(e) => {
                  e.stopPropagation();
                  handleLikePost(post.id);
                }}
              >
                <Ionicons
                  name={isLiked ? "heart" : "heart-outline"}
                  size={12}
                  color={isLiked ? "#EF4444" : "#6B7280"}
                />
                <Text style={[styles.statText, isLiked && styles.likedText]}>
                  {post.likes_count > 1000
                    ? `${(post.likes_count / 1000).toFixed(1)}k`
                    : post.likes_count}
                </Text>
              </TouchableOpacity>

              <View style={styles.statItem}>
                <Ionicons name="chatbubble-outline" size={12} color="#6B7280" />
                <Text style={styles.statText}>
                  {post.comments_count > 1000
                    ? `${(post.comments_count / 1000).toFixed(1)}k`
                    : post.comments_count}
                </Text>
              </View>
            </View>

            <View style={styles.postActions}>
              {/* Compare Button - Only show on Hot Deals and Trending sections */}
              {(post.post_type === "promotion" || post.view_count > 100) && (
                <TouchableOpacity
                  style={styles.compareButton}
                  onPress={(e) => {
                    e.stopPropagation();
                    findSimilarItems(post);
                  }}
                >
                  <Ionicons name="git-compare" size={12} color="#3B82F6" />
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.orderButton}
                onPress={(e) => {
                  e.stopPropagation();
                  router.push(
                    `/orders/${post.restaurant_id || post.id}?postId=${post.id}`,
                  );
                }}
              >
                <Text style={styles.orderButtonText}>Order</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  });

  // Menu Item Card Component
  const MenuItemCard = React.memo(({ item }: { item: any }) => {
    const getPopularityColor = (popularity: string) => {
      switch (popularity) {
        case "signature":
          return "#8B5CF6";
        case "bestseller":
          return "#FF6B35";
        case "popular":
          return "#F59E0B";
        default:
          return "#6B7280";
      }
    };

    const getPopularityIcon = (popularity: string) => {
      switch (popularity) {
        case "signature":
          return "crown";
        case "bestseller":
          return "star";
        case "popular":
          return "flame";
        default:
          return "restaurant";
      }
    };

    return (
      <TouchableOpacity
        style={styles.menuItemCard}
        onPress={() => handleMenuItemClick(item)}
        activeOpacity={0.9}
      >
        <View style={styles.menuItemImageContainer}>
          <Image
            source={{
              uri:
                item.image_url ||
                "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=300&h=200&fit=crop",
            }}
            style={styles.menuItemImage}
          />
          {item.popularity && item.popularity !== "regular" && (
            <View
              style={[
                styles.menuItemPopularityBadge,
                { backgroundColor: getPopularityColor(item.popularity) },
              ]}
            >
              <Ionicons
                name={getPopularityIcon(item.popularity)}
                size={10}
                color="#fff"
              />
              <Text style={styles.menuItemPopularityText}>
                {item.popularity === "signature"
                  ? "Signature"
                  : item.popularity === "bestseller"
                    ? "Best Seller"
                    : "Popular"}
              </Text>
            </View>
          )}
          {item.spice_level > 0 && (
            <View style={styles.menuItemSpiceBadge}>
              <Ionicons name="flame" size={10} color="#FF6B35" />
              <Text style={styles.menuItemSpiceText}>
                Level {item.spice_level}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.menuItemContent}>
          <View style={styles.menuItemHeader}>
            <Text style={styles.menuItemName} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.menuItemPrice}>AED {item.price}</Text>
          </View>

          <Text style={styles.menuItemRestaurant} numberOfLines={1}>
            {item.restaurant_name}
          </Text>

          {item.description && (
            <Text style={styles.menuItemDescription} numberOfLines={2}>
              {item.description}
            </Text>
          )}

          <View style={styles.menuItemFooter}>
            <View style={styles.menuItemRating}>
              <Ionicons name="star" size={10} color="#FFD700" />
              <Text style={styles.menuItemRatingText}>
                {item.restaurant_rating?.toFixed(1) || "4.0"}
              </Text>
            </View>

            <View style={styles.menuItemDistance}>
              <Ionicons name="location" size={10} color="#6B7280" />
              <Text style={styles.menuItemDistanceText}>
                {item.distanceText || "1.2km"}
              </Text>
            </View>

            {item.delivery_fee === "Free" ? (
              <View style={styles.menuItemFreeDelivery}>
                <Text style={styles.menuItemFreeDeliveryText}>Free</Text>
              </View>
            ) : (
              <Text style={styles.menuItemDeliveryFee}>
                {item.delivery_fee}
              </Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  });

  // Compact Post Card for Grid View
  const CompactPostCard = React.memo(({ post }: { post: any }) => {
    const postTypeInfo = getPostTypeInfo(post.post_type);
    const timeRemaining = getTimeRemaining(post.available_until);
    const isLiked = likedPosts.has(post.id);
    const isFavorited = favorites.has(post.id);
    const formattedDate = formatDate(post.created_at);

    return (
      <TouchableOpacity
        style={styles.compactPostCard}
        onPress={() => handlePostClick(post)}
        activeOpacity={0.9}
      >
        <View style={styles.compactPostImageContainer}>
          <Image
            source={{
              uri:
                post.image_url ||
                "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=300&h=200&fit=crop",
            }}
            style={styles.compactPostImage}
          />
          <View style={styles.compactPostOverlay}>
            {post.discount_percentage && (
              <View style={styles.compactDiscountBadge}>
                <Text style={styles.compactDiscountText}>
                  {post.discount_percentage}%
                </Text>
              </View>
            )}
            <View style={styles.compactPostTypeBadge}>
              <Text style={styles.compactPostTypeText}>
                {postTypeInfo.icon}
              </Text>
            </View>
          </View>

          {/* 🔴 NEW: Favorite Button for Compact Card */}
          <TouchableOpacity
            style={styles.compactFavoriteButton}
            onPress={(e) => {
              e.stopPropagation();
              toggleFavorite(post.id);
            }}
          >
            <Ionicons
              name={isFavorited ? "heart" : "heart-outline"}
              size={14}
              color={isFavorited ? "#FF6B35" : "#FFFFFF"}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.compactPostContent}>
          <Text style={styles.compactPostTitle} numberOfLines={1}>
            {post.title}
          </Text>

          <Text style={styles.compactRestaurantName} numberOfLines={1}>
            {post.restaurant_name}
          </Text>

          <View style={styles.compactPostFooter}>
            <View style={styles.compactPostRating}>
              <Ionicons name="star" size={9} color="#FFD700" />
              <Text style={styles.compactPostRatingText}>
                {post.restaurant_rating?.toFixed(1) || "4.0"}
              </Text>
            </View>

            <View style={styles.compactPostPrice}>
              {post.discounted_price ? (
                <>
                  <Text style={styles.compactOriginalPrice}>
                    AED {post.original_price}
                  </Text>
                  <Text style={styles.compactDiscountedPrice}>
                    AED {post.discounted_price}
                  </Text>
                </>
              ) : (
                <Text style={styles.compactPrice}>
                  AED {post.original_price || "—"}
                </Text>
              )}
            </View>
          </View>

          <View style={styles.compactPostActions}>
            <TouchableOpacity
              style={styles.compactLikeButton}
              onPress={(e) => {
                e.stopPropagation();
                handleLikePost(post.id);
              }}
            >
              <Ionicons
                name={isLiked ? "heart" : "heart-outline"}
                size={12}
                color={isLiked ? "#EF4444" : "#6B7280"}
              />
              <Text style={styles.compactLikeCount}>
                {post.likes_count > 999
                  ? `${(post.likes_count / 1000).toFixed(1)}k`
                  : post.likes_count}
              </Text>
            </TouchableOpacity>

            <View style={styles.compactTimeRemaining}>
              <Ionicons name="time-outline" size={10} color="#6B7280" />
              <Text style={styles.compactTimeText}>{formattedDate}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  });

  // Event Card Component
  const EventCard = React.memo(({ post }: { post: any }) => {
    const timeRemaining = getTimeRemaining(post.available_until);

    return (
      <TouchableOpacity
        style={styles.eventCard}
        onPress={() => handlePostClick(post)}
        activeOpacity={0.9}
      >
        <Image
          source={{
            uri:
              post.image_url ||
              "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&h=200&fit=crop",
          }}
          style={styles.eventImage}
        />
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.8)"]}
          style={styles.eventGradient}
        >
          <View style={styles.eventContent}>
            <View style={styles.eventTag}>
              <Text style={styles.eventTagText}>🎉 EVENT</Text>
            </View>
            <Text style={styles.eventTitle} numberOfLines={2}>
              {post.title}
            </Text>
            <Text style={styles.eventRestaurant} numberOfLines={1}>
              {post.restaurant_name}
            </Text>
            <View style={styles.eventFooter}>
              <View style={styles.eventTime}>
                <Ionicons name="time-outline" size={10} color="#FFFFFF" />
                <Text style={styles.eventTimeText}>{timeRemaining}</Text>
              </View>
              <View style={styles.eventDistance}>
                <Ionicons name="location" size={10} color="#FFFFFF" />
                <Text style={styles.eventDistanceText}>
                  {post.distanceText || "1.2km"}
                </Text>
              </View>
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  });

  // Add this with your other component definitions (around line 800-900)

  // Compact Drink Card - Simple with LinearGradient
  const DrinkCard = React.memo(({ item }: { item: any }) => {
    const discountPercentage = item.discount_percentage;
    const colors = ["#FF6B35", "#8B5CF6", "#10B981", "#3B82F6", "#F59E0B"];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    return (
      <TouchableOpacity
        style={styles.drinkCard}
        onPress={() => handlePostClick(item)}
        activeOpacity={0.9}
      >
        <Image
          source={{
            uri:
              item.image_url ||
              "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200&h=300&fit=crop",
          }}
          style={styles.drinkImage}
        />
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.8)"]}
          style={styles.drinkGradient}
        >
          <Text style={styles.drinkName} numberOfLines={1}>
            {item.title}
          </Text>
          <View style={styles.drinkPriceRow}>
            {discountPercentage ? (
              <>
                <Text style={styles.drinkDiscountedPrice}>
                  AED {item.discounted_price}
                </Text>
                <Text style={styles.drinkOriginalPrice}>
                  AED {item.original_price}
                </Text>
              </>
            ) : (
              <Text style={styles.drinkPrice}>
                AED {item.original_price || item.discounted_price}
              </Text>
            )}
          </View>
        </LinearGradient>
        {discountPercentage && (
          <View
            style={[
              styles.drinkDiscountBadge,
              { backgroundColor: randomColor },
            ]}
          >
            <Text style={styles.drinkDiscountText}>{discountPercentage}%</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  });
  // Memoized Quick Deal Card
  const QuickDealCard = React.memo(({ deal }: { deal: any }) => (
    <TouchableOpacity
      style={[styles.quickDealCard, { backgroundColor: deal.color }]}
      activeOpacity={0.9}
      onPress={() => router.push(`/post/${deal.id}`)}
    >
      <Image source={{ uri: deal.image }} style={styles.quickDealImage} />
      <View style={styles.quickDealContent}>
        <Text style={styles.quickDealTitle}>{deal.title}</Text>
        <Text style={styles.quickDealSubtitle}>{deal.subtitle}</Text>
        <View style={styles.discountBadgeQuick}>
          <Text style={styles.discountTextQuick}>{deal.discount}</Text>
        </View>
        <View style={styles.timeBadgeQuick}>
          <Ionicons name="time-outline" size={9} color="#FFFFFF" />
          <Text style={styles.timeTextQuick}>{deal.timeLeft}</Text>
        </View>
      </View>
    </TouchableOpacity>
  ));

  // Memoized Restaurant Card
  const RestaurantCard = React.memo(({ restaurant }: { restaurant: any }) => (
    <TouchableOpacity
      style={styles.restaurantCard}
      onPress={() =>
        router.push(`/(tabs)/profiles/restaurant-profile/${restaurant.id}`)
      }
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
      </View>
      <View style={styles.restaurantInfo}>
        <Text style={styles.restaurantName} numberOfLines={1}>
          {restaurant.name}
        </Text>
        <Text style={styles.restaurantCuisine} numberOfLines={1}>
          {restaurant.cuisine}
        </Text>
        <View style={styles.restaurantMeta}>
          <View style={styles.rating}>
            <Ionicons name="star" size={10} color="#FFD700" />
            <Text style={styles.ratingTextSmall}>{restaurant.rating}</Text>
          </View>
          <Text style={styles.metaText}>•</Text>
          <Text style={styles.metaText}>{restaurant.deliveryTime}</Text>
          <Text style={styles.metaText}>•</Text>
          <Text style={styles.metaText}>{restaurant.price}</Text>
        </View>
        <Text style={styles.distanceTextSmall}>{restaurant.distance}</Text>
      </View>
    </TouchableOpacity>
  ));

  // Memoized Test Section Card
  const TestSectionCard = React.memo(({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.testCard}
      onPress={() => handleTestItemClick(item)}
      activeOpacity={0.9}
    >
      <View style={styles.testImageContainer}>
        <Image source={{ uri: item.image }} style={styles.testImage} />
        {item.tag && (
          <View style={styles.testTag}>
            <Text style={styles.testTagText}>{item.tag}</Text>
          </View>
        )}
        <View style={styles.testDiscountBadge}>
          <Text style={styles.testDiscountText}>
            {Math.round(
              ((item.originalPrice - item.price) / item.originalPrice) * 100,
            )}
            % OFF
          </Text>
        </View>
      </View>

      <View style={styles.testContent}>
        <Text style={styles.testTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.testDescription} numberOfLines={2}>
          {item.description}
        </Text>

        <View style={styles.testRestaurantInfo}>
          <Text style={styles.testRestaurantName} numberOfLines={1}>
            {item.restaurant}
          </Text>
          <View style={styles.testRating}>
            <Ionicons name="star" size={10} color="#FFD700" />
            <Text style={styles.testRatingText}>{item.rating}</Text>
          </View>
        </View>

        <View style={styles.testFooter}>
          <View style={styles.testPriceContainer}>
            <Text style={styles.testCurrentPrice}>AED {item.price}</Text>
            <Text style={styles.testOriginalPrice}>
              AED {item.originalPrice}
            </Text>
          </View>

          <View style={styles.testDeliveryInfo}>
            <Ionicons name="time-outline" size={10} color="#6B7280" />
            <Text style={styles.testDeliveryText}>{item.deliveryTime}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  ));

  const renderPromoDots = () => {
    if (quickDeals.length === 0) return null;

    return (
      <View style={styles.promoDots}>
        {quickDeals.map((_, index) => (
          <TouchableOpacity
            key={index}
            onPress={() => {
              setActivePromoIndex(index);
              promoScrollRef.current?.scrollTo({
                x: index * (SCREEN_WIDTH - 32),
                animated: true,
              });
            }}
          >
            <View
              style={[
                styles.promoDot,
                index === activePromoIndex && styles.promoDotActive,
              ]}
            />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  // Section Header Component
  const SectionHeader = ({
    title,
    seeAllLink,
    seeAllText = "View All",
    icon,
    onSeeAll,
  }: {
    title: string;
    seeAllLink?: string;
    seeAllText?: string;
    icon?: string;
    onSeeAll?: () => void;
  }) => (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionTitleContainer}>
        {icon && <Text style={styles.sectionIcon}>{icon}</Text>}
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {onSeeAll ? (
        <TouchableOpacity onPress={onSeeAll}>
          <Text style={styles.seeAllText}>{seeAllText}</Text>
        </TouchableOpacity>
      ) : (
        seeAllLink && (
          <TouchableOpacity onPress={() => router.push(seeAllLink)}>
            <Text style={styles.seeAllText}>{seeAllText}</Text>
          </TouchableOpacity>
        )
      )}
    </View>
  );

  // 🔴 NEW: Favorites Section Component
  // 🔴 UPDATED: Favorites Section Component with proper navigation
  const FavoritesSection = () => (
    <View style={styles.section}>
      <SectionHeader
        title="Your Favorites"
        icon="❤️"
        onSeeAll={() => router.push("/(tabs)/favorites/favorites")}
      />
      {favoriteItems.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.favoritesContainer}
        >
          {favoriteItems.slice(0, 5).map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.favoriteCard}
              onPress={() => {
                router.push({
                  pathname: "/post/[id]",
                  params: { id: item.id },
                });
              }}
            >
              <Image
                source={{
                  uri:
                    item.image_url ||
                    "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=200&h=150&fit=crop",
                }}
                style={styles.favoriteImage}
              />
              <LinearGradient
                colors={["transparent", "rgba(0,0,0,0.8)"]}
                style={styles.favoriteGradient}
              >
                <Text style={styles.favoriteTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.favoriteRestaurant} numberOfLines={1}>
                  {item.restaurants?.restaurant_name || "Restaurant"}
                </Text>
                {item.discounted_price ? (
                  <Text style={styles.favoritePrice}>
                    AED {item.discounted_price}
                  </Text>
                ) : (
                  <Text style={styles.favoritePrice}>
                    AED {item.original_price}
                  </Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.emptyFavorites}>
          <Ionicons name="heart-outline" size={48} color="#D1D5DB" />
          <Text style={styles.emptyFavoritesTitle}>No favorites yet</Text>
          <Text style={styles.emptyFavoritesText}>
            Tap the ❤️ on items you love to save them here
          </Text>
        </View>
      )}
    </View>
  );

  // 🔴 NEW: Dietary Preferences Filter
  const DietaryFilterBar = () => (
    <View style={styles.dietaryFilterBar}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.dietaryFilterContent}
      >
        <TouchableOpacity
          style={[
            styles.dietaryFilterChip,
            dietaryFilters.halal && styles.dietaryFilterChipActive,
          ]}
          onPress={() => toggleDietaryFilter("halal")}
        >
          <Text style={styles.dietaryFilterEmoji}>🕌</Text>
          <Text
            style={[
              styles.dietaryFilterText,
              dietaryFilters.halal && styles.dietaryFilterTextActive,
            ]}
          >
            Halal
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.dietaryFilterChip,
            dietaryFilters.vegan && styles.dietaryFilterChipActive,
          ]}
          onPress={() => toggleDietaryFilter("vegan")}
        >
          <Text style={styles.dietaryFilterEmoji}>🌱</Text>
          <Text
            style={[
              styles.dietaryFilterText,
              dietaryFilters.vegan && styles.dietaryFilterTextActive,
            ]}
          >
            Vegan
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.dietaryFilterChip,
            dietaryFilters.vegetarian && styles.dietaryFilterChipActive,
          ]}
          onPress={() => toggleDietaryFilter("vegetarian")}
        >
          <Text style={styles.dietaryFilterEmoji}>🥬</Text>
          <Text
            style={[
              styles.dietaryFilterText,
              dietaryFilters.vegetarian && styles.dietaryFilterTextActive,
            ]}
          >
            Vegetarian
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.dietaryFilterChip,
            dietaryFilters.glutenFree && styles.dietaryFilterChipActive,
          ]}
          onPress={() => toggleDietaryFilter("glutenFree")}
        >
          <Text style={styles.dietaryFilterEmoji}>🌾</Text>
          <Text
            style={[
              styles.dietaryFilterText,
              dietaryFilters.glutenFree && styles.dietaryFilterTextActive,
            ]}
          >
            Gluten Free
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.dietaryFilterChip,
            dietaryFilters.spicy && styles.dietaryFilterChipActive,
          ]}
          onPress={() => toggleDietaryFilter("spicy")}
        >
          <Text style={styles.dietaryFilterEmoji}>🌶️</Text>
          <Text
            style={[
              styles.dietaryFilterText,
              dietaryFilters.spicy && styles.dietaryFilterTextActive,
            ]}
          >
            Spicy
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );

  // 🔴 NEW: Price Comparison Modal
  const PriceComparisonModal = () => {
    if (!showPriceComparison || !selectedItemForComparison) return null;

    return (
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Compare Prices</Text>
            <TouchableOpacity onPress={() => setShowPriceComparison(false)}>
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            <Text style={styles.comparisonItemTitle}>
              {selectedItemForComparison.title}
            </Text>

            {comparisonItems.length > 0 ? (
              comparisonItems.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.comparisonItem}
                  onPress={() => {
                    setShowPriceComparison(false);
                    handlePostClick(item);
                  }}
                >
                  <Image
                    source={{
                      uri:
                        item.image_url ||
                        "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=100&h=100&fit=crop",
                    }}
                    style={styles.comparisonItemImage}
                  />
                  <View style={styles.comparisonItemInfo}>
                    <Text style={styles.comparisonItemName} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text
                      style={styles.comparisonItemRestaurant}
                      numberOfLines={1}
                    >
                      {item.restaurant_name}
                    </Text>
                    <View style={styles.comparisonItemRating}>
                      <Ionicons name="star" size={12} color="#FFD700" />
                      <Text style={styles.comparisonItemRatingText}>
                        {item.restaurant_rating?.toFixed(1) || "4.0"}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.comparisonItemPrice}>
                    <Text style={styles.comparisonItemPriceText}>
                      AED {item.discounted_price || item.original_price}
                    </Text>
                    {item.delivery_fee === 0 ? (
                      <Text style={styles.comparisonItemFreeDelivery}>
                        Free Delivery
                      </Text>
                    ) : (
                      <Text style={styles.comparisonItemDeliveryFee}>
                        +AED {item.delivery_fee || 5}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.emptyComparison}>
                <Ionicons name="search-outline" size={48} color="#D1D5DB" />
                <Text style={styles.emptyComparisonText}>
                  No similar items found
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    );
  };

  // 🔴 NEW: Order Tracker Banner
  const OrderTrackerBanner = () => {
    if (!activeOrder) return null;

    const getStatusText = (status: string) => {
      switch (status) {
        case "pending":
          return "Order Placed";
        case "confirmed":
          return "Order Confirmed";
        case "preparing":
          return "Preparing";
        case "ready":
          return "Ready for Pickup";
        case "out_for_delivery":
          return "On the Way";
        default:
          return status;
      }
    };

    const getStatusIcon = (status: string) => {
      switch (status) {
        case "pending":
          return "time-outline";
        case "confirmed":
          return "checkmark-circle-outline";
        case "preparing":
          return "restaurant-outline";
        case "ready":
          return "fast-food-outline";
        case "out_for_delivery":
          return "bicycle-outline";
        default:
          return "help-circle-outline";
      }
    };

    return (
      <TouchableOpacity
        style={styles.orderTrackerBanner}
        onPress={() => router.push(`/orders/${activeOrder.id}`)}
        activeOpacity={0.9}
      >
        <View style={styles.orderTrackerContent}>
          <View style={styles.orderTrackerIconContainer}>
            <Ionicons
              name={getStatusIcon(activeOrder.status)}
              size={24}
              color="#FF6B35"
            />
          </View>
          <View style={styles.orderTrackerInfo}>
            <Text style={styles.orderTrackerTitle}>
              Order #{activeOrder.order_number}
            </Text>
            <Text style={styles.orderTrackerStatus}>
              {getStatusText(activeOrder.status)}
            </Text>
            {activeOrder.estimated_delivery_time && (
              <Text style={styles.orderTrackerTime}>
                Est.{" "}
                {new Date(
                  activeOrder.estimated_delivery_time,
                ).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            )}
          </View>
          <View style={styles.orderTrackerArrow}>
            <Ionicons name="chevron-forward" size={20} color="#6B7280" />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // 🔴 NEW: Reorder Section
  const ReorderSection = () => {
    // This would fetch from real data
    const recentOrders = [
      {
        id: "1",
        restaurantName: "Burger King",
        restaurantImage:
          "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=200&h=150&fit=crop",
        items: "2 items",
        total: 45.5,
        date: "2 days ago",
      },
      {
        id: "2",
        restaurantName: "Pizza Hut",
        restaurantImage:
          "https://images.unsplash.com/photo-1548365328-9f547f8e3f0c?w=200&h=150&fit=crop",
        items: "1 item",
        total: 32.0,
        date: "5 days ago",
      },
    ];

    if (recentOrders.length === 0) return null;

    return (
      <View style={styles.section}>
        <SectionHeader title="Order Again" icon="🔄" />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.reorderContainer}
        >
          {recentOrders.map((order) => (
            <TouchableOpacity
              key={order.id}
              style={styles.reorderCard}
              onPress={() => router.push(`/restaurant/${order.id}`)}
            >
              <Image
                source={{ uri: order.restaurantImage }}
                style={styles.reorderImage}
              />
              <View style={styles.reorderInfo}>
                <Text style={styles.reorderName}>{order.restaurantName}</Text>
                <Text style={styles.reorderItems}>{order.items}</Text>
                <Text style={styles.reorderPrice}>AED {order.total}</Text>
                <Text style={styles.reorderDate}>{order.date}</Text>
              </View>
              <TouchableOpacity style={styles.reorderButton}>
                <Text style={styles.reorderButtonText}>Reorder</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.topBar}>
        <View style={styles.topBarContent}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => router.push("/(tabs)/profile")}
          >
            <View style={styles.userAvatar}>
              {user?.profile_image_url ? (
                <Image
                  source={{ uri: user.profile_image_url }}
                  style={styles.userAvatarImage}
                />
              ) : (
                <Text style={styles.userInitials}>
                  {getInitials(user?.full_name || "User")}
                </Text>
              )}
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.locationContainer}
            onPress={getCurrentLocation}
          >
            <View style={styles.locationContent}>
              <Ionicons name="location-sharp" size={14} color="#FF6B35" />
              <View style={styles.locationTextContainer}>
                {locationLoading ? (
                  <ActivityIndicator size="small" color="#FF6B35" />
                ) : (
                  <Text style={styles.locationText} numberOfLines={1}>
                    {currentLocation}
                  </Text>
                )}
              </View>
            </View>
          </TouchableOpacity>

          <View style={styles.headerRight}>
            {/* 🔴 NEW: Cart Icon with Badge */}
            <TouchableOpacity
              style={styles.cartIcon}
              onPress={() => router.push("/(tabs)/cart")}
            >
              <Ionicons name="cart-outline" size={22} color="#111827" />
              {cartItemCount > 0 && (
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>{cartItemCount}</Text>
                </View>
              )}
            </TouchableOpacity>
            <NotificationBell />
          </View>
        </View>
      </View>
      {user?.is_guest && <GuestProfileBanner />}

      {/* 🔴 NEW: Search Bar 
          <TouchableOpacity
            style={styles.searchBar}
            onPress={() => router.push("/(tabs)/search")}
            activeOpacity={0.8}
          >
            <Ionicons name="search" size={18} color="#9CA3AF" />
            <Text style={styles.searchPlaceholder}>
              Search for food or restaurants...
            </Text>
            <View style={styles.searchFilter}>
              <Ionicons name="options-outline" size={16} color="#FF6B35" />
            </View>
          </TouchableOpacity>*/}
      {/* 🔴 NEW: Order Tracker Banner */}
      <View style={{ marginTop: 6 }}>
        <OrderTrackerBanner />
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Welcome Section */}
        <View style={styles.welcomeSection}>
          <View style={styles.welcomeHeader}>
            <View>
              <Text style={styles.greeting}>{getGreeting} 👋</Text>
              <Text style={styles.userName}>
                {user?.full_name || "Welcome!"}
              </Text>
            </View>
            <TouchableOpacity style={styles.pointsContainer}>
              <FontAwesome5 name="coins" size={12} color="#FFD700" />
              <Text style={styles.pointsText}>125 pts</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 🔴 NEW: Dietary Filter Bar
        <DietaryFilterBar /> */}

        {/* Quick Deals */}
        {quickDeals.length > 0 && (
          <View style={styles.quickDealsSection}>
            <SectionHeader title="Quick Deals" icon="🔥" />
            {quickDealsLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#FF6B35" />
              </View>
            ) : (
              <>
                <ScrollView
                  ref={promoScrollRef}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  pagingEnabled
                  contentContainerStyle={styles.quickDealsContainer}
                >
                  {quickDeals.map((deal) => (
                    <QuickDealCard key={deal.id} deal={deal} />
                  ))}
                </ScrollView>
                {renderPromoDots()}
              </>
            )}
          </View>
        )}

        {/* Categories */}
        <View style={styles.section}>
          <SectionHeader
            title="Categories"
            icon="🍽️"
            seeAllLink="/categories"
          />
          {categoriesLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#FF6B35" />
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryImagesContainer}
            >
              {categories.map((category) => (
                <View key={category.id} style={styles.categoryImageWrapper}>
                  <TouchableOpacity
                    style={styles.categoryImageCard}
                    onPress={() =>
                      router.push(
                        `/categories/category/${category.name.toLowerCase().replace(/\s+/g, "-")}`,
                      )
                    }
                  >
                    <Image
                      source={{ uri: category.image }}
                      style={styles.categoryOnlyImage}
                    />
                    <Text style={styles.categoryName}>{category.name}</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}
        </View>

        {/* 🔥 Hot Deals Section */}
        {hotDealPosts.length > 0 && (
          <View style={styles.section}>
            <SectionHeader
              title="Hot Deals"
              icon="🔥"
              seeAllLink="/posts?filter=promotion"
            />
            {loadingHotDeals ? (
              <View style={styles.postsLoadingContainer}>
                <ActivityIndicator size="small" color="#FF6B35" />
                <Text style={styles.postsLoadingText}>Loading deals...</Text>
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.postsContainer}
              >
                {hotDealPosts.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </ScrollView>
            )}
          </View>
        )}

        {/* 📅 Events Near You */}
        {eventPosts.length > 0 && (
          <View style={styles.section}>
            <SectionHeader
              title="Events Near You"
              icon="📅"
              seeAllLink="/posts?filter=event"
            />
            {loadingEvents ? (
              <View style={styles.postsLoadingContainer}>
                <ActivityIndicator size="small" color="#8B5CF6" />
                <Text style={styles.postsLoadingText}>Loading events...</Text>
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.eventsContainer}
              >
                {eventPosts.map((post) => (
                  <EventCard key={post.id} post={post} />
                ))}
              </ScrollView>
            )}
          </View>
        )}

        {/* 📈 Trending Now */}
        {trendingPosts.length > 0 && (
          <View style={styles.section}>
            <SectionHeader
              title="Trending Now"
              icon="📈"
              seeAllLink="/posts?sort=views"
            />
            {loadingTrending ? (
              <View style={styles.postsLoadingContainer}>
                <ActivityIndicator size="small" color="#3B82F6" />
                <Text style={styles.postsLoadingText}>Loading trending...</Text>
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.postsContainer}
              >
                {trendingPosts.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </ScrollView>
            )}
          </View>
        )}

        {/* 🍕 Pizza Section */}
        {pizzaPosts.length > 0 && (
          <View style={styles.section}>
            <SectionHeader
              title="🍕 Pizza Specials"
              icon="🍕"
              seeAllLink="/posts?search=pizza"
            />
            {loadingPizza ? (
              <View style={styles.postsLoadingContainer}>
                <ActivityIndicator size="small" color="#FF6B35" />
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.eventsContainer}
              >
                {pizzaPosts.map((post) => (
                  <EventCard key={post.id} post={post} />
                ))}
              </ScrollView>
            )}
          </View>
        )}

        {/* 🍗 Fried Chicken Section */}
        {kfcPosts.length > 0 && (
          <View style={styles.section}>
            <SectionHeader
              title="Fried Chicken"
              icon="🍗"
              seeAllLink="/posts?search=chicken"
            />
            {loadingKfc ? (
              <View style={styles.postsLoadingContainer}>
                <ActivityIndicator size="small" color="#FF6B35" />
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.eventsContainer}
              >
                {kfcPosts.map((post) => (
                  <EventCard key={post.id} post={post} />
                ))}
              </ScrollView>
            )}
          </View>
        )}

        {/* 🥤 Drinks Section */}
        {drinksPosts.length > 0 && (
          <View style={styles.section}>
            <SectionHeader
              title="Refreshing Drinks"
              icon="🥤"
              seeAllLink="/posts?search=drinks"
            />
            {loadingDrinks ? (
              <View style={styles.postsLoadingContainer}>
                <ActivityIndicator size="small" color="#FF6B35" />
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.drinksContainer}
              >
                {drinksPosts.map((item) => (
                  <DrinkCard key={item.id} item={item} />
                ))}
              </ScrollView>
            )}
          </View>
        )}

        {/* 🍰 Desserts Section */}
        {dessertsPosts.length > 0 && (
          <View style={styles.section}>
            <SectionHeader
              title="Sweet Treats"
              icon="🍰"
              seeAllLink="/posts?tag=dessert"
            />
            {loadingDesserts ? (
              <View style={styles.postsLoadingContainer}>
                <ActivityIndicator size="small" color="#EC4899" />
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.eventsContainer}
              >
                {dessertsPosts.map((post) => (
                  <EventCard key={post.id} post={post} />
                ))}
              </ScrollView>
            )}
          </View>
        )}

        {/* ⏳ Limited Time Offers */}
        {limitedTimePosts.length > 0 && (
          <View style={styles.section}>
            <SectionHeader
              title="Limited Time Offers"
              icon="⏳"
              seeAllLink="/posts?filter=endingSoon"
            />
            {loadingLimited ? (
              <View style={styles.postsLoadingContainer}>
                <ActivityIndicator size="small" color="#F59E0B" />
                <Text style={styles.postsLoadingText}>Loading offers...</Text>
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.postsContainer}
              >
                {limitedTimePosts.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </ScrollView>
            )}
          </View>
        )}

        {/* ❤️ Popular This Week */}
        {popularPosts.length > 0 && (
          <View style={styles.section}>
            <SectionHeader
              title="Popular This Week"
              icon="❤️"
              seeAllLink="/posts?sort=likes"
            />
            {loadingPopular ? (
              <View style={styles.postsLoadingContainer}>
                <ActivityIndicator size="small" color="#EF4444" />
                <Text style={styles.postsLoadingText}>Loading popular...</Text>
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.postsContainer}
              >
                {popularPosts.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </ScrollView>
            )}
          </View>
        )}

        {/* 🥗 Vegan & Vegetarian */}
        {veganPosts.length > 0 && (
          <View style={styles.section}>
            <SectionHeader
              title="Vegan & Vegetarian"
              icon="🥗"
              seeAllLink="/posts?tag=vegan"
            />
            {loadingVegan ? (
              <View style={styles.postsLoadingContainer}>
                <ActivityIndicator size="small" color="#10B981" />
                <Text style={styles.postsLoadingText}>
                  Loading vegan options...
                </Text>
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.postsContainer}
              >
                {veganPosts.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </ScrollView>
            )}
          </View>
        )}

        {/* 🕌 Halal Certified */}
        {halalPosts.length > 0 && (
          <View style={styles.section}>
            <SectionHeader
              title="Halal Certified"
              icon="🕌"
              seeAllLink="/posts?tag=halal"
            />
            {loadingHalal ? (
              <View style={styles.postsLoadingContainer}>
                <ActivityIndicator size="small" color="#7C3AED" />
                <Text style={styles.postsLoadingText}>
                  Loading halal options...
                </Text>
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.postsContainer}
              >
                {halalPosts.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </ScrollView>
            )}
          </View>
        )}

        {/* 🏠 Nearby Restaurants Posts */}
        {nearbyPosts.length > 0 && (
          <View style={styles.section}>
            <SectionHeader
              title="Nearby"
              icon="🏠"
              seeAllLink="/posts?filter=nearby"
            />
            {loadingNearby ? (
              <View style={styles.postsLoadingContainer}>
                <ActivityIndicator size="small" color="#6366F1" />
                <Text style={styles.postsLoadingText}>Finding nearby...</Text>
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.postsContainer}
              >
                {nearbyPosts.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </ScrollView>
            )}
          </View>
        )}

        {/* Restaurant Menu Items Section */}
        {menuItems.length > 0 && (
          <View style={styles.section}>
            <SectionHeader
              title="Popular Dishes"
              icon="🍽️"
              seeAllLink="/(tabs)/menu/inedx"
              seeAllText="View Full Menu"
            />
            {menuItemsLoading ? (
              <View style={styles.postsLoadingContainer}>
                <ActivityIndicator size="small" color="#10B981" />
                <Text style={styles.postsLoadingText}>
                  Loading menu items...
                </Text>
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.menuItemsContainer}
              >
                {menuItems.map((item) => (
                  <MenuItemCard key={item.id} item={item} />
                ))}
              </ScrollView>
            )}
          </View>
        )}

        {/* Meal-based sections - show based on time of day */}
        {getCurrentMeal === "breakfast" && breakfastPosts.length > 0 && (
          <View style={styles.section}>
            <SectionHeader
              title="Breakfast Specials"
              icon="☀️"
              seeAllLink="/posts?tag=breakfast"
            />
            {loadingBreakfast ? (
              <View style={styles.postsLoadingContainer}>
                <ActivityIndicator size="small" color="#F59E0B" />
                <Text style={styles.postsLoadingText}>
                  Loading breakfast...
                </Text>
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.postsContainer}
              >
                {breakfastPosts.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </ScrollView>
            )}
          </View>
        )}

        {getCurrentMeal === "lunch" && lunchPosts.length > 0 && (
          <View style={styles.section}>
            <SectionHeader
              title="Lunch Deals"
              icon="🍱"
              seeAllLink="/posts?tag=lunch"
            />
            {loadingLunch ? (
              <View style={styles.postsLoadingContainer}>
                <ActivityIndicator size="small" color="#10B981" />
                <Text style={styles.postsLoadingText}>
                  Loading lunch deals...
                </Text>
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.postsContainer}
              >
                {lunchPosts.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </ScrollView>
            )}
          </View>
        )}

        {getCurrentMeal === "dinner" && dinnerPosts.length > 0 && (
          <View style={styles.section}>
            <SectionHeader
              title="Dinner Specials"
              icon="🌙"
              seeAllLink="/posts?tag=dinner"
            />
            {loadingDinner ? (
              <View style={styles.postsLoadingContainer}>
                <ActivityIndicator size="small" color="#8B5CF6" />
                <Text style={styles.postsLoadingText}>
                  Loading dinner deals...
                </Text>
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.postsContainer}
              >
                {dinnerPosts.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </ScrollView>
            )}
          </View>
        )}

        {/* 🍰 Desserts & Sweets */}
        {dessertPosts.length > 0 && (
          <View style={styles.section}>
            <SectionHeader
              title="Desserts & Sweets"
              icon="🍰"
              seeAllLink="/posts?tag=dessert"
            />
            {loadingDessert ? (
              <View style={styles.postsLoadingContainer}>
                <ActivityIndicator size="small" color="#EC4899" />
                <Text style={styles.postsLoadingText}>Loading desserts...</Text>
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.postsContainer}
              >
                {dessertPosts.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </ScrollView>
            )}
          </View>
        )}

        {/* recommendedPosts Section */}
        <View style={styles.section}>
          <SectionHeader
            title="Recommended For You"
            icon="✨"
            seeAllLink="/recommendations"
          />
          {recommendedLoading ? (
            <View style={styles.postsLoadingContainer}>
              <ActivityIndicator size="small" color="#FF6B35" />
              <Text style={styles.postsLoadingText}>
                Loading recommendations...
              </Text>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.testSectionContainer}
            >
              {recommendedPosts.map((item) => (
                <TestSectionCard key={item.id} item={item} />
              ))}
            </ScrollView>
          )}
        </View>

        {/* Fresh Posts */}
        {restaurantPosts.length > 0 && (
          <View style={styles.section}>
            <SectionHeader title="Fresh Posts" icon="📱" seeAllLink="/posts" />
            {postsLoading ? (
              <View style={styles.postsLoadingContainer}>
                <ActivityIndicator size="small" color="#FF6B35" />
                <Text style={styles.postsLoadingText}>Loading posts...</Text>
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.postsContainer}
              >
                {restaurantPosts.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </ScrollView>
            )}
          </View>
        )}

        {/* Featured Restaurants */}
        <View style={styles.section}>
          <SectionHeader
            title="Featured Restaurants"
            icon="⭐"
            seeAllLink="/restaurants"
          />
          {restaurantsLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#FF6B35" />
            </View>
          ) : featuredRestaurants.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.restaurantsContainer}
            >
              {featuredRestaurants.map((restaurant) => (
                <RestaurantCard key={restaurant.id} restaurant={restaurant} />
              ))}
            </ScrollView>
          ) : (
            <View style={styles.emptyPostsContainer}>
              <Ionicons name="restaurant-outline" size={32} color="#D1D5DB" />
              <Text style={styles.emptyPostsTitle}>No restaurants</Text>
            </View>
          )}
        </View>

        {/* All Posts Grid Section (Two Columns) */}
        <View style={styles.section}>
          <View style={styles.allPostsHeader}>
            <View style={styles.sectionTitleContainer}>
              <Text style={styles.sectionIcon}>📋</Text>
              <Text style={styles.sectionTitle}>All Posts</Text>
            </View>
            <TouchableOpacity
              onPress={refreshAllPosts}
              style={styles.refreshButton}
            >
              <Ionicons
                name="refresh"
                size={18}
                color="#FF6B35"
                style={allPostsRefreshing ? styles.refreshRotating : undefined}
              />
            </TouchableOpacity>
          </View>

          {allPostsLoading && allPosts.length === 0 ? (
            <View style={styles.postsLoadingContainer}>
              <ActivityIndicator size="large" color="#FF6B35" />
              <Text style={styles.postsLoadingText}>Loading all posts...</Text>
            </View>
          ) : allPosts.length > 0 ? (
            <FlatList
              data={allPosts}
              renderItem={({ item }) => <CompactPostCard post={item} />}
              keyExtractor={(item) => item.id}
              numColumns={2}
              columnWrapperStyle={styles.postGridColumnWrapper}
              contentContainerStyle={styles.postGridContent}
              scrollEnabled={false}
              ListFooterComponent={
                allPostsHasMore ? (
                  <TouchableOpacity
                    style={styles.loadMoreButton}
                    onPress={loadMorePosts}
                    disabled={allPostsLoading}
                  >
                    {allPostsLoading ? (
                      <ActivityIndicator size="small" color="#FF6B35" />
                    ) : (
                      <>
                        <Text style={styles.loadMoreText}>Load More Posts</Text>
                        <Ionicons name="arrow-down" size={16} color="#FF6B35" />
                      </>
                    )}
                  </TouchableOpacity>
                ) : allPosts.length > 6 ? (
                  <Text style={styles.noMorePostsText}>
                    You've reached the end
                  </Text>
                ) : null
              }
            />
          ) : (
            <View style={styles.emptyPostsContainer}>
              <Ionicons name="images-outline" size={32} color="#D1D5DB" />
              <Text style={styles.emptyPostsTitle}>No posts available</Text>
              <Text style={styles.emptyPostsText}>Check back later</Text>
            </View>
          )}
        </View>

        {/* 🔴 NEW: Favorites Section */}
        <FavoritesSection />

        {/* 🔴 NEW: Reorder Section */}
        <ReorderSection />

        {/* 🔴 NEW: Payment Methods Preview */}
        <View style={styles.section}>
          <SectionHeader title="Payment Methods" icon="💳" />
          <View style={styles.paymentMethodsPreview}>
            <View style={styles.paymentMethodChip}>
              <Ionicons name="cash" size={16} color="#10B981" />
              <Text style={styles.paymentMethodText}>Cash</Text>
            </View>
            <View style={styles.paymentMethodChip}>
              <Ionicons name="card" size={16} color="#3B82F6" />
              <Text style={styles.paymentMethodText}>Card</Text>
            </View>
            <View style={styles.paymentMethodChip}>
              <Ionicons name="logo-apple" size={16} color="#000" />
              <Text style={styles.paymentMethodText}>Apple Pay</Text>
            </View>
          </View>
        </View>

        {/* Info Cards */}
        <View style={styles.infoSection}>
          <View style={styles.infoCard}>
            <MaterialCommunityIcons
              name="clock-fast"
              size={20}
              color="#FF6B35"
            />
            <Text style={styles.infoText}>Fast Delivery</Text>
          </View>
          <View style={styles.infoCard}>
            <MaterialIcons name="verified" size={20} color="#10B981" />
            <Text style={styles.infoText}>Verified</Text>
          </View>
          <View style={styles.infoCard}>
            <MaterialCommunityIcons
              name="shield-check"
              size={20}
              color="#3B82F6"
            />
            <Text style={styles.infoText}>Safe</Text>
          </View>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* 🔴 NEW: Floating Cart Button (when scrolled) */}
      {cartItemCount > 0 && (
        <TouchableOpacity
          style={styles.floatingCart}
          onPress={() => router.push("/(tabs)/cart")}
          activeOpacity={0.9}
        >
          <View style={styles.floatingCartBadge}>
            <Text style={styles.floatingCartBadgeText}>{cartItemCount}</Text>
          </View>
          <Ionicons name="cart" size={24} color="#FFFFFF" />
          <Text style={styles.floatingCartTotal}>
            AED {cartTotal.toFixed(2)}
          </Text>
        </TouchableOpacity>
      )}

      {/* 🔴 NEW: Price Comparison Modal */}
      <PriceComparisonModal />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    marginBottom: -22,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  topBarContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flex: 1,
  },
  iconButton: {
    padding: 4,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FF6B35",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  userAvatarImage: {
    width: "100%",
    height: "100%",
  },
  userInitials: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  locationContainer: {
    flex: 1,
    marginHorizontal: 12,
  },
  locationContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  locationTextContainer: {
    flex: 1,
  },
  locationText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  cartIcon: {
    position: "relative",
    padding: 4,
  },
  cartBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#FF6B35",
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  cartBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 6,
    paddingHorizontal: 12,
    paddingVertical: 13.2,
    borderRadius: 12,
    borderWidth: 0.8,
    borderColor: "#E5E7EB",
  },
  searchPlaceholder: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: "#9CA3AF",
  },
  searchFilter: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  welcomeSection: {
    paddingHorizontal: 15,
    paddingTop: 8,
    paddingBottom: 8,
  },
  welcomeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  greeting: {
    fontSize: 13.5,
    color: "#6B7280",
    fontWeight: "500",
    marginBottom: 4,
  },
  userName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  pointsContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFBEB",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  pointsText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#92400E",
  },
  quickDealsSection: {
    marginBottom: 16,
  },
  quickDealsContainer: {
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 4,
  },
  quickDealCard: {
    width: SCREEN_WIDTH - 32,
    height: 162,
    borderRadius: 16,
    overflow: "hidden",
    position: "relative",
  },
  quickDealImage: {
    width: "100%",
    height: "100%",
    position: "absolute",
  },
  quickDealContent: {
    padding: 16,
    height: "100%",
    justifyContent: "flex-end",
  },
  quickDealTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 4,
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  quickDealSubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.9)",
    marginBottom: 8,
    fontWeight: "500",
  },
  discountBadgeQuick: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  discountTextQuick: {
    fontSize: 12,
    fontWeight: "800",
    color: "#FF6B35",
  },
  timeBadgeQuick: {
    position: "absolute",
    bottom: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 4,
  },
  timeTextQuick: {
    fontSize: 11,
    color: "#FFFFFF",
    fontWeight: "600",
  },
  promoDots: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
    gap: 6,
  },
  promoDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#E5E7EB",
  },
  promoDotActive: {
    backgroundColor: "#FF6B35",
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionIcon: {
    fontSize: 16,
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
  categoryImagesContainer: {
    paddingHorizontal: 16,
    gap: 12,
  },
  categoryImageWrapper: {
    alignItems: "center",
  },
  categoryImageCard: {
    width: 72,
    alignItems: "center",
  },
  categoryOnlyImage: {
    width: 63,
    height: 63,
    borderRadius: 32,
    marginBottom: 8,
  },
  categoryName: {
    fontSize: 11,
    color: "#374151",
    fontWeight: "600",
  },

  // Test Section Styles
  testSectionContainer: {
    paddingHorizontal: 16,
    gap: 16,
    marginBottom: 4,
  },
  testCard: {
    width: SCREEN_WIDTH * 0.75,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 0.5,
    borderColor: "#E5E7EB",
  },
  testImageContainer: {
    position: "relative",
    height: 150,
    overflow: "hidden",
  },
  testImage: {
    width: "100%",
    height: "100%",
  },
  testTag: {
    position: "absolute",
    top: 12,
    left: 12,
    backgroundColor: "#FF6B35",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  testTagText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
  testDiscountBadge: {
    position: "absolute",
    bottom: 12,
    right: 12,
    backgroundColor: "#10B981",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  testDiscountText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },
  testContent: {
    padding: 14,
  },
  testTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 6,
  },
  testDescription: {
    fontSize: 13,
    color: "#6B7280",
    lineHeight: 18,
    marginBottom: 12,
  },
  testRestaurantInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  testRestaurantName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#374151",
    flex: 1,
    marginRight: 8,
  },
  testRating: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFBEB",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  testRatingText: {
    fontSize: 11,
    color: "#92400E",
    fontWeight: "700",
  },
  testFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  testPriceContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  testCurrentPrice: {
    fontSize: 16,
    fontWeight: "900",
    color: "#FF6B35",
  },
  testOriginalPrice: {
    fontSize: 13,
    color: "#9CA3AF",
    textDecorationLine: "line-through",
    fontWeight: "500",
  },
  testDeliveryInfo: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 4,
  },
  testDeliveryText: {
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "600",
  },

  // Post Card Styles
  postsContainer: {
    paddingHorizontal: 16,
    gap: 16,
    marginBottom: 6,
  },
  postCard: {
    width: SCREEN_WIDTH * 0.78,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    overflow: "hidden",
    elevation: 2,
    borderWidth: 0.4,
    borderColor: "#F3F4F6",
  },
  postImageContainer: {
    position: "relative",
    height: 160,
    overflow: "hidden",
  },
  postImage: {
    width: "100%",
    height: "100%",
  },
  topBadgesContainer: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  postTypeBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 107, 53, 0.95)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 4,
  },
  postTypeIcon: {
    fontSize: 12,
  },
  postTypeText: {
    fontSize: 10,
    color: "#FFFFFF",
    fontWeight: "700",
  },
  distanceBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 4,
  },
  distanceText: {
    fontSize: 10,
    color: "#FFFFFF",
    fontWeight: "600",
  },
  favoriteButton: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "rgba(0,0,0,0.5)",
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  discountBadge: {
    position: "absolute",
    bottom: 12,
    right: 12,
    backgroundColor: "#FF6B35",
    width: 43,
    height: 43,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  discountPercentage: {
    fontSize: 12.5,
    fontWeight: "900",
    color: "#FFFFFF",
    lineHeight: 15,
  },
  discountLabel: {
    fontSize: 8.8,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  postContent: {
    padding: 14,
  },
  restaurantInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  restaurantName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
    flex: 1,
  },
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFBEB",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  ratingText: {
    fontSize: 11,
    color: "#92400E",
    fontWeight: "700",
  },
  postTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 6,
  },
  postDescription: {
    fontSize: 12,
    color: "#6B7280",
    lineHeight: 16,
    marginBottom: 10,
  },
  dietaryTagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 10,
  },
  dietaryTag: {
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  dietaryTagText: {
    fontSize: 9,
    color: "#6B7280",
    fontWeight: "600",
  },
  priceContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  priceInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  originalPrice: {
    fontSize: 12,
    color: "#9CA3AF",
    textDecorationLine: "line-through",
    fontWeight: "500",
  },
  discountedPrice: {
    fontSize: 16,
    fontWeight: "900",
    color: "#FF6B35",
  },
  timeBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 4,
  },
  timeText: {
    fontSize: 10,
    color: "#6B7280",
    fontWeight: "600",
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
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "600",
  },
  likedText: {
    color: "#EF4444",
  },
  postActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  compareButton: {
    backgroundColor: "#3B82F610",
    width: 30,
    height: 30,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 0.5,
    borderColor: "#3B82F630",
  },
  addToCartButton: {
    backgroundColor: "#FF6B35",
    width: 30,
    height: 30,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  orderButton: {
    backgroundColor: "#FF6B35",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  orderButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  // Menu Item Card Styles
  menuItemsContainer: {
    paddingHorizontal: 16,
    gap: 16,
    marginBottom: 6,
  },
  menuItemCard: {
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
  },
  menuItemImageContainer: {
    position: "relative",
    height: 140,
    overflow: "hidden",
  },
  menuItemImage: {
    width: "100%",
    height: "100%",
  },
  menuItemPopularityBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 4,
  },
  menuItemPopularityText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  menuItemSpiceBadge: {
    position: "absolute",
    bottom: 12,
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 4,
  },
  menuItemSpiceText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#FF6B35",
  },
  menuItemContent: {
    padding: 14,
  },
  menuItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  menuItemName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
    flex: 1,
  },
  menuItemPrice: {
    fontSize: 15,
    fontWeight: "800",
    color: "#10B981",
  },
  menuItemRestaurant: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 8,
  },
  menuItemDescription: {
    fontSize: 12,
    color: "#6B7280",
    lineHeight: 16,
    marginBottom: 10,
  },
  menuItemFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  menuItemRating: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  menuItemRatingText: {
    fontSize: 11,
    color: "#374151",
    fontWeight: "600",
  },
  menuItemDistance: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  menuItemDistanceText: {
    fontSize: 11,
    color: "#6B7280",
  },
  menuItemFreeDelivery: {
    backgroundColor: "#10B98115",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  menuItemFreeDeliveryText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#10B981",
  },
  menuItemDeliveryFee: {
    fontSize: 11,
    color: "#6B7280",
  },

  // Event Card Styles
  eventsContainer: {
    paddingHorizontal: 16,
    gap: 16,
    marginBottom: 6,
  },
  eventCard: {
    width: SCREEN_WIDTH * 0.7,
    height: 180,
    borderRadius: 16,
    overflow: "hidden",
    position: "relative",
  },
  eventImage: {
    width: "100%",
    height: "100%",
  },
  eventGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "100%",
    justifyContent: "flex-end",
  },
  eventContent: {
    padding: 16,
  },
  eventTag: {
    backgroundColor: "#FF6B35",
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    marginBottom: 10,
  },
  eventTagText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 6,
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  eventRestaurant: {
    fontSize: 13,
    color: "#FFFFFF",
    marginBottom: 10,
    textShadowColor: "rgba(0,0,0,0.3)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
    fontWeight: "500",
  },
  eventFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  eventTime: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  eventTimeText: {
    fontSize: 11,
    color: "#FFFFFF",
    fontWeight: "600",
  },
  eventDistance: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  eventDistanceText: {
    fontSize: 11,
    color: "#FFFFFF",
    fontWeight: "600",
  },

  // Compact Post Card for Grid View
  compactPostCard: {
    flex: 1,
    marginHorizontal: 6,
    marginBottom: 8,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 0.5,
    borderColor: "#F3F4F6",
  },
  compactPostImageContainer: {
    position: "relative",
    height: 130,
    overflow: "hidden",
  },
  compactPostImage: {
    width: "100%",
    height: "100%",
  },
  compactPostOverlay: {
    position: "absolute",
    top: 8,
    left: 8,
    right: 8,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  compactDiscountBadge: {
    backgroundColor: "#FF6B35",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  compactDiscountText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },
  compactPostTypeBadge: {
    backgroundColor: "rgba(0,0,0,0.6)",
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
  },
  compactPostTypeText: {
    fontSize: 13,
  },
  compactFavoriteButton: {
    position: "absolute",
    bottom: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.5)",
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  compactPostContent: {
    padding: 12,
  },
  compactPostTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  compactRestaurantName: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 8,
  },
  compactPostFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  compactPostRating: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  compactPostRatingText: {
    fontSize: 11,
    color: "#374151",
    fontWeight: "600",
  },
  compactPostPrice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  compactOriginalPrice: {
    fontSize: 11,
    color: "#9CA3AF",
    textDecorationLine: "line-through",
  },
  compactDiscountedPrice: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FF6B35",
  },
  compactPrice: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
  },
  compactPostActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    paddingTop: 8,
  },
  compactLikeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  compactLikeCount: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "600",
  },
  compactTimeRemaining: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  compactTimeText: {
    fontSize: 11,
    color: "#6B7280",
  },

  // All Posts Grid Styles
  allPostsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    marginBottom: 6,
  },
  refreshButton: {
    padding: 8,
  },
  refreshRotating: {
    transform: [{ rotate: "180deg" }],
  },
  postGridContent: {
    paddingHorizontal: 10,
    paddingBottom: 8,
  },
  postGridColumnWrapper: {
    justifyContent: "space-between",
    marginBottom: 8,
  },
  loadMoreButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F4F6",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 12,
    gap: 8,
  },
  loadMoreText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FF6B35",
  },
  noMorePostsText: {
    textAlign: "center",
    color: "#9CA3AF",
    fontSize: 13,
    marginTop: 20,
    marginBottom: 8,
  },

  // Loading States
  loadingContainer: {
    padding: 30,
    alignItems: "center",
  },
  bottomSpacer: {
    height: 24,
  },
  postsLoadingContainer: {
    padding: 30,
    alignItems: "center",
  },
  postsLoadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#6B7280",
  },

  // Empty States
  emptyPostsContainer: {
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 16,
    marginHorizontal: 16,
  },
  emptyPostsTitle: {
    marginTop: 16,
    fontSize: 16,
    color: "#111827",
    fontWeight: "700",
  },
  emptyPostsText: {
    marginTop: 8,
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
  },

  // Restaurant Card Styles
  restaurantsContainer: {
    paddingHorizontal: 16,
    gap: 16,
    marginBottom: 8,
  },
  restaurantCard: {
    width: 160,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 0.4,
    borderColor: "#F3F4F6",
  },
  restaurantImageContainer: {
    position: "relative",
    height: 110,
    overflow: "hidden",
  },
  restaurantImage: {
    width: "100%",
    height: "100%",
  },
  promotionBadge: {
    position: "absolute",
    bottom: 8,
    left: 8,
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
  restaurantInfo: {
    padding: 12,
  },
  restaurantName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 2,
  },
  restaurantCuisine: {
    fontSize: 11,
    color: "#6B7280",
    marginBottom: 8,
  },
  restaurantMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 6,
  },
  rating: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  ratingTextSmall: {
    fontSize: 11,
    color: "#374151",
    fontWeight: "700",
  },
  metaText: {
    fontSize: 10,
    color: "#6B7280",
  },
  distanceTextSmall: {
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "500",
  },

  // Info Cards
  infoSection: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  infoCard: {
    alignItems: "center",
    padding: 12,
  },
  infoText: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 6,
    fontWeight: "500",
  },

  // 🔴 NEW STYLES

  // Dietary Filter Bar
  dietaryFilterBar: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  dietaryFilterContent: {
    gap: 8,
  },
  dietaryFilterChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 6,
  },
  dietaryFilterChipActive: {
    backgroundColor: "#FF6B35",
    borderColor: "#FF6B35",
  },
  dietaryFilterEmoji: {
    fontSize: 14,
  },
  dietaryFilterText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },
  dietaryFilterTextActive: {
    color: "#FFFFFF",
  },

  // Favorites Section
  favoritesContainer: {
    paddingHorizontal: 16,
    gap: 12,
  },
  favoriteCard: {
    width: 120,
    height: 120,
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
  },
  favoriteImage: {
    width: "100%",
    height: "100%",
  },
  favoriteOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 8,
  },
  favoriteTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  favoriteRestaurant: {
    fontSize: 10,
    color: "#E5E7EB",
  },
  emptyFavorites: {
    padding: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyFavoritesText: {
    marginTop: 8,
    fontSize: 13,
    color: "#9CA3AF",
    textAlign: "center",
  },

  // Reorder Section
  reorderContainer: {
    paddingHorizontal: 16,
    gap: 16,
  },
  reorderCard: {
    width: 160,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  reorderImage: {
    width: "100%",
    height: 100,
  },
  reorderInfo: {
    padding: 12,
  },
  reorderName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  reorderItems: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 4,
  },
  reorderPrice: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FF6B35",
    marginBottom: 2,
  },
  reorderDate: {
    fontSize: 10,
    color: "#9CA3AF",
  },
  reorderButton: {
    marginTop: 8,
    paddingVertical: 8,
    backgroundColor: "#FF6B35",
    alignItems: "center",
    borderRadius: 6,
  },
  reorderButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
  },

  // Floating Cart
  floatingCart: {
    position: "absolute",
    bottom: 40,
    right: 18,
    backgroundColor: "#FF6B35",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
    gap: 7,
  },
  floatingCartBadge: {
    position: "absolute",
    top: -6,
    left: -6,
    backgroundColor: "#EF4444",
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  floatingCartBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
  floatingCartTotal: {
    color: "#FFFFFF",
    fontSize: 13.8,
    fontWeight: "700",
  },

  // Payment Methods Preview
  paymentMethodsPreview: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 16,
  },
  paymentMethodChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 6,
  },
  paymentMethodText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#374151",
  },

  // Order Tracker Banner
  orderTrackerBanner: {
    marginHorizontal: 12,
    marginBottom: 6,
    backgroundColor: "#F0F9FF",
    borderRadius: 12,
    borderWidth: 0.6,
    borderColor: "#E0F2FE",
  },
  orderTrackerContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
  },
  orderTrackerIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    borderWidth: 1,
    borderColor: "#FF6B35",
  },
  orderTrackerInfo: {
    flex: 1,
  },
  orderTrackerTitle: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#0369A1",
    marginBottom: 2,
  },
  orderTrackerStatus: {
    fontSize: 12.5,
    color: "#0C4A6E",
    marginBottom: 2,
  },
  orderTrackerTime: {
    fontSize: 11.5,
    color: "#6B7280",
  },
  orderTrackerArrow: {
    marginLeft: 8,
  },

  // Price Comparison Modal
  modalOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 0.6,
    borderBottomColor: "#E5E7EB",
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#111827",
  },
  modalBody: {
    padding: 15,
  },
  comparisonItemTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 16,
    paddingBottom: 8,
    borderBottomWidth: 0.6,
    borderBottomColor: "#E5E7EB",
  },
  comparisonItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 0.4,
    borderColor: "#E5E7EB",
  },
  comparisonItemImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
  },
  comparisonItemInfo: {
    flex: 1,
    marginLeft: 12,
  },
  comparisonItemName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 2,
  },
  comparisonItemRestaurant: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 4,
  },
  comparisonItemRating: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  comparisonItemRatingText: {
    fontSize: 11,
    color: "#374151",
    fontWeight: "600",
  },
  comparisonItemPrice: {
    alignItems: "flex-end",
  },
  comparisonItemPriceText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FF6B35",
  },
  comparisonItemFreeDelivery: {
    fontSize: 10,
    color: "#10B981",
    fontWeight: "600",
  },
  comparisonItemDeliveryFee: {
    fontSize: 10,
    color: "#6B7280",
  },
  emptyComparison: {
    padding: 40,
    alignItems: "center",
  },
  emptyComparisonText: {
    marginTop: 12,
    fontSize: 14,
    color: "#6B7280",
  },

  // Add to your StyleSheet
  favoriteGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
    paddingTop: 40,
  },
  favoritePrice: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFD700",
    marginTop: 4,
  },
  emptyFavoritesTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
    marginTop: 12,
    marginBottom: 4,
  },

  // Add these styles to your StyleSheet

  drinkCard: {
    width: 130,
    height: 180,
    borderRadius: 16,
    overflow: "hidden",
    marginRight: 12,
    position: "relative",
  },
  drinkImage: {
    width: "100%",
    height: "100%",
  },
  drinkGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
    paddingTop: 40,
  },
  drinkName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  drinkPriceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  drinkPrice: {
    fontSize: 16,
    fontWeight: "800",
    color: "#FFD700",
  },
  drinkDiscountedPrice: {
    fontSize: 16,
    fontWeight: "800",
    color: "#FFD700",
  },
  drinkOriginalPrice: {
    fontSize: 12,
    color: "#E5E7EB",
    textDecorationLine: "line-through",
  },
  drinkDiscountBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  drinkDiscountText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },
  // Add to your StyleSheet
  drinksContainer: {
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
});
