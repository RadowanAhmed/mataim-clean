// app/(tabs)/profiles/restaurant-profile/[id].tsx
import { useAuth } from "@/backend/AuthContext";
import { useGuestAction } from "@/backend/hooks/useGuestAction";
import { supabase } from "@/backend/supabase";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Enhanced rating stars component
const RatingStars = ({
  rating,
  size = 12,
}: {
  rating: number;
  size?: number;
}) => {
  return (
    <View style={styles.ratingStars}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Ionicons
          key={star}
          name={
            star <= Math.floor(rating)
              ? "star"
              : star - 0.5 <= rating
                ? "star-half"
                : "star-outline"
          }
          size={size}
          color="#FFD700"
        />
      ))}
      <Text style={[styles.ratingText, { fontSize: size }]}>
        {rating.toFixed(1)}
      </Text>
    </View>
  );
};

// Restaurant Profile Screen Component
export default function RestaurantProfileScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();

  const [restaurant, setRestaurant] = useState<any>(null);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "menu" | "posts" | "info" | "reviews"
  >("menu");
  const [isFavorite, setIsFavorite] = useState(false);
  const [showFullMenu, setShowFullMenu] = useState(false);
  const [showFullPosts, setShowFullPosts] = useState(false);
  const [cartItemCount, setCartItemCount] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewText, setReviewText] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [orderMethod, setOrderMethod] = useState<"delivery" | "pickup">(
    "delivery",
  );

  // Inside component
  const { checkGuestAction, isGuest } = useGuestAction();

  // 🔴 NEW: Schedule order state
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleType, setScheduleType] = useState<
    "today" | "tomorrow" | "week" | "recurring"
  >("today");
  const [selectedTime, setSelectedTime] = useState<Date | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [recurringDays, setRecurringDays] = useState<string[]>([]);
  const [scheduleNotes, setScheduleNotes] = useState("");

  // 🔴 NEW: Price comparison state
  const [showPriceComparison, setShowPriceComparison] = useState(false);
  const [comparisonItems, setComparisonItems] = useState<any[]>([]);
  const [loadingComparison, setLoadingComparison] = useState(false);

  // Fetch restaurant data
  useEffect(() => {
    if (id) {
      fetchRestaurantData();
      checkIfFavorite();
      fetchCartCount();
    }
  }, [id]);

  const fetchRestaurantData = async () => {
    try {
      setLoading(true);

      const { data: restaurantData, error: restaurantError } = await supabase
        .from("restaurants")
        .select(
          `
          *,
          users (
            full_name,
            profile_image_url,
            phone,
            email
          )
        `,
        )
        .eq("id", id)
        .single();

      if (restaurantError) throw restaurantError;
      setRestaurant(restaurantData);

      const { data: menuItemsData } = await supabase
        .from("menu_items")
        .select("*")
        .eq("restaurant_id", id)
        .eq("is_available", true)
        .order("created_at", { ascending: false });

      setMenuItems(menuItemsData || []);

      const { data: postsData } = await supabase
        .from("posts")
        .select("*")
        .eq("restaurant_id", id)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(10);

      setPosts(postsData || []);

      const { data: reviewsData } = await supabase
        .from("reviews")
        .select(
          `
          *,
          users:users!reviews_customer_id_fkey (
            full_name,
            profile_image_url
          )
        `,
        )
        .eq("restaurant_id", id)
        .order("created_at", { ascending: false })
        .limit(20);

      setReviews(reviewsData || []);
    } catch (error) {
      console.error("Error fetching restaurant data:", error);
      Alert.alert("Error", "Failed to load restaurant profile");
    } finally {
      setLoading(false);
    }
  };

  const checkIfFavorite = async () => {
    if (!user?.id) return;

    try {
      const { data } = await supabase
        .from("favorites")
        .select("id")
        .eq("user_id", user.id)
        .eq("restaurant_id", id)
        .maybeSingle();

      setIsFavorite(!!data);
    } catch (error) {
      console.error("Error checking favorite:", error);
    }
  };

  const fetchCartCount = async () => {
    if (!user?.id) return;

    try {
      const { data: cart } = await supabase
        .from("carts")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();

      if (cart) {
        const { count } = await supabase
          .from("cart_items")
          .select("*", { count: "exact", head: true })
          .eq("cart_id", cart.id);

        setCartItemCount(count || 0);
      }
    } catch (error) {
      console.error("Error fetching cart count:", error);
    }
  };

  const toggleFavorite = async () => {
    checkGuestAction("save favorites", async () => {
      if (!user?.id) {
        router.push("/(auth)/signin");
        return;
      }

      try {
        if (isFavorite) {
          await supabase
            .from("favorites")
            .delete()
            .eq("user_id", user.id)
            .eq("restaurant_id", id);
          setIsFavorite(false);
        } else {
          await supabase.from("favorites").insert({
            user_id: user.id,
            restaurant_id: id,
          });
          setIsFavorite(true);
        }
      } catch (error) {
        console.error("Error toggling favorite:", error);
        Alert.alert("Error", "Failed to update favorite");
      }
    });
  };

  const handleAddToCart = async (menuItem: any) => {
    checkGuestAction("add items to cart", async () => {
      if (!user?.id) {
        router.push("/(auth)/signin");
        return;
      }

      try {
        const { data: existingCart } = await supabase
          .from("carts")
          .select("id, restaurant_id")
          .eq("user_id", user.id)
          .eq("status", "active")
          .maybeSingle();

        let cartId = existingCart?.id;
        let cartRestaurantId = existingCart?.restaurant_id;

        if (cartId && cartRestaurantId && cartRestaurantId !== id) {
          Alert.alert(
            "Different Restaurant",
            "Your cart contains items from a different restaurant. Would you like to clear your cart and add this item?",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Clear & Add",
                onPress: async () => {
                  await supabase
                    .from("cart_items")
                    .delete()
                    .eq("cart_id", cartId);

                  await supabase
                    .from("carts")
                    .update({ restaurant_id: id })
                    .eq("id", cartId);

                  await addItemToCart(cartId, menuItem);
                },
              },
            ],
          );
          return;
        }

        if (!cartId) {
          const { data: newCart } = await supabase
            .from("carts")
            .insert({
              user_id: user.id,
              restaurant_id: id,
              status: "active",
            })
            .select("id")
            .single();

          cartId = newCart?.id;
        }

        if (!cartId) throw new Error("Failed to get cart ID");

        await addItemToCart(cartId, menuItem);
      } catch (error) {
        console.error("Error adding to cart:", error);
        Alert.alert("Error", "Failed to add item to cart");
      }
    });
  };

  const addItemToCart = async (cartId: string, menuItem: any) => {
    const { data: existingItem } = await supabase
      .from("cart_items")
      .select("id, quantity")
      .eq("cart_id", cartId)
      .eq("menu_item_id", menuItem.id)
      .maybeSingle();

    if (existingItem) {
      await supabase
        .from("cart_items")
        .update({
          quantity: existingItem.quantity + 1,
          total_price: menuItem.price * (existingItem.quantity + 1),
        })
        .eq("id", existingItem.id);
    } else {
      await supabase.from("cart_items").insert({
        cart_id: cartId,
        menu_item_id: menuItem.id,
        quantity: 1,
        unit_price: menuItem.price,
        total_price: menuItem.price,
      });
    }

    setCartItemCount((prev) => prev + 1);
    Alert.alert(
      "Added to Cart",
      `${menuItem.name} has been added to your cart`,
    );
  };

  // 🔴 NEW: Find similar items for price comparison
  const findSimilarItems = async (item: any) => {
    setLoadingComparison(true);
    setShowPriceComparison(true);

    try {
      const { data } = await supabase
        .from("menu_items")
        .select(
          `
          id,
          name,
          description,
          price,
          image_url,
          restaurants!inner (
            restaurant_name,
            restaurant_rating,
            delivery_fee
          )
        `,
        )
        .eq("is_available", true)
        .neq("restaurant_id", id)
        .ilike("name", `%${item.name.split(" ")[0]}%`)
        .limit(5);

      setComparisonItems(data || []);
    } catch (error) {
      console.error("Error finding similar items:", error);
      setComparisonItems([]);
    } finally {
      setLoadingComparison(false);
    }
  };

  // 🔴 NEW: Handle schedule order
  const handleScheduleOrder = async () => {
    if (!user?.id) {
      Alert.alert("Login Required", "Please login to schedule an order");
      router.push("/(auth)/signin");
      return;
    }

    try {
      let scheduledFor = new Date();

      if (scheduleType === "today" && selectedTime) {
        scheduledFor.setHours(
          selectedTime.getHours(),
          selectedTime.getMinutes(),
          0,
          0,
        );
      } else if (scheduleType === "tomorrow" && selectedTime) {
        scheduledFor.setDate(scheduledFor.getDate() + 1);
        scheduledFor.setHours(
          selectedTime.getHours(),
          selectedTime.getMinutes(),
          0,
          0,
        );
      } else if (scheduleType === "week" && selectedDate && selectedTime) {
        scheduledFor = selectedDate;
        scheduledFor.setHours(
          selectedTime.getHours(),
          selectedTime.getMinutes(),
          0,
          0,
        );
      }

      Alert.alert(
        "Order Scheduled!",
        `Your order has been scheduled for ${scheduledFor.toLocaleDateString()} at ${scheduledFor.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
        [{ text: "OK" }],
      );

      setShowScheduleModal(false);
      resetScheduleState();
    } catch (error) {
      console.error("Error scheduling order:", error);
      Alert.alert("Error", "Failed to schedule order");
    }
  };

  const resetScheduleState = () => {
    setScheduleType("today");
    setSelectedTime(null);
    setSelectedDate(null);
    setRecurringDays([]);
    setScheduleNotes("");
  };

  const toggleRecurringDay = (day: string) => {
    if (recurringDays.includes(day)) {
      setRecurringDays(recurringDays.filter((d) => d !== day));
    } else {
      setRecurringDays([...recurringDays, day]);
    }
  };

  const handleSubmitReview = async () => {
    checkGuestAction("write reviews", async () => {
      if (!user?.id) {
        router.push("/(auth)/signin");
        return;
      }

      if (!reviewText.trim()) {
        Alert.alert("Error", "Please enter your review");
        return;
      }

      try {
        setSubmittingReview(true);

        await supabase.from("reviews").insert({
          restaurant_id: id,
          customer_id: user.id,
          rating: reviewRating,
          comment: reviewText.trim(),
          order_id: null,
        });

        setReviewText("");
        setReviewRating(5);
        setShowReviewModal(false);

        fetchRestaurantData();

        Alert.alert("Thank You!", "Your review has been submitted");
      } catch (error) {
        console.error("Error submitting review:", error);
        Alert.alert("Error", "Failed to submit review");
      } finally {
        setSubmittingReview(false);
      }
    });
  };

  const formatTime = (timeString: string) => {
    if (!timeString) return "";
    return timeString.replace(/:00$/, "");
  };

  const parseOpeningHours = (hours: string) => {
    if (!hours) return null;

    try {
      const parsed = JSON.parse(hours);
      return parsed;
    } catch {
      if (hours.includes(":")) {
        const days = [
          "monday",
          "tuesday",
          "wednesday",
          "thursday",
          "friday",
          "saturday",
          "sunday",
        ];
        const result: any = {};

        days.forEach((day) => {
          result[day] = {
            open: hours.split("-")[0]?.trim(),
            close: hours.split("-")[1]?.trim(),
          };
        });

        return result;
      }
      return null;
    }
  };

  const getOpeningHoursForToday = () => {
    if (!restaurant?.opening_hours) return "Check opening hours";

    const hours = parseOpeningHours(restaurant.opening_hours);
    if (!hours) {
      return restaurant.opening_hours;
    }

    const days = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ];
    const today = days[new Date().getDay()];

    if (hours[today]?.open && hours[today]?.close) {
      return `${hours[today].open} - ${hours[today].close}`;
    }

    return "Check opening hours";
  };

  const getCategories = () => {
    const categories = menuItems.map((item) => item.category).filter(Boolean);
    return ["All", ...Array.from(new Set(categories))];
  };

  const startConversation = async () => {
    checkGuestAction("message restaurants", async () => {
      if (!user?.id) {
        router.push("/(auth)/signin");
        return;
      }

      try {
        const { data: existing } = await supabase
          .from("conversations")
          .select("id")
          .eq("customer_id", user.id)
          .eq("restaurant_id", id)
          .eq("is_active", true)
          .maybeSingle();

        if (existing) {
          router.push(`/(tabs)/messages/${existing.id}`);
          return;
        }

        const { data: newConversation, error } = await supabase
          .from("conversations")
          .insert({
            customer_id: user.id,
            restaurant_id: id,
            last_message: "Conversation started",
          })
          .select("id")
          .single();

        if (error) throw error;
        router.push(`/(tabs)/messages/${newConversation.id}`);
      } catch (error) {
        console.error("Error starting conversation:", error);
        Alert.alert("Error", "Failed to start conversation");
      }
    });
  };

  const filteredMenuItems =
    selectedCategory === "All" || !selectedCategory
      ? menuItems
      : menuItems.filter((item) => item.category === selectedCategory);

  const displayedMenuItems = showFullMenu
    ? filteredMenuItems
    : filteredMenuItems.slice(0, 6);
  const displayedPosts = showFullPosts ? posts : posts.slice(0, 3);

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={styles.loadingText}>Loading restaurant...</Text>
      </SafeAreaView>
    );
  }

  if (!restaurant) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <View style={styles.errorContent}>
          <Ionicons name="restaurant-outline" size={48} color="#EF4444" />
          <Text style={styles.errorTitle}>Restaurant Not Found</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header with Back Button */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButtonHeader}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cartButtonHeader}
          onPress={() => router.push("/cart")}
        >
          <Ionicons name="cart-outline" size={22} color="#fff" />
          {cartItemCount > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{cartItemCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Hero Section with Restaurant Image */}
        <View style={styles.heroSection}>
          <Image
            source={{
              uri:
                restaurant.image_url ||
                "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&h=600&fit=crop",
            }}
            style={styles.heroImage}
          />

          <View style={styles.heroOverlay}>
            <View style={styles.restaurantNameContainer}>
              <Text style={styles.restaurantName}>
                {restaurant.restaurant_name}
              </Text>
              <View style={styles.restaurantRatingContainer}>
                <RatingStars
                  rating={restaurant.restaurant_rating || 0}
                  size={14}
                />
                <Text style={styles.reviewCount}>
                  ({reviews.length} reviews)
                </Text>
              </View>
            </View>
          </View>

          {/* Favorite Button */}
          <TouchableOpacity
            style={styles.favoriteButton}
            onPress={toggleFavorite}
          >
            <Ionicons
              name={isFavorite ? "heart" : "heart-outline"}
              size={24}
              color={isFavorite ? "#EF4444" : "#fff"}
            />
          </TouchableOpacity>
        </View>

        {/* Quick Info Bar */}
        <View style={styles.quickInfoBar}>
          <View style={styles.quickInfoItem}>
            <Ionicons name="time-outline" size={16} color="#4B5565" />
            <Text style={styles.quickInfoText}>
              {getOpeningHoursForToday()}
            </Text>
          </View>

          {restaurant.has_delivery && (
            <View style={styles.quickInfoItem}>
              <Ionicons name="bicycle" size={16} color="#4B5565" />
              <Text style={styles.quickInfoText}>
                {restaurant.delivery_fee > 0
                  ? `AED ${restaurant.delivery_fee} delivery`
                  : "Free delivery"}
              </Text>
            </View>
          )}

          {restaurant.has_pickup && (
            <View style={styles.quickInfoItem}>
              <Ionicons name="walk-outline" size={16} color="#4B5565" />
              <Text style={styles.quickInfoText}>Pickup available</Text>
            </View>
          )}

          <View style={styles.statItem}>
            <Ionicons name="receipt-outline" size={15} color="#FF6B35" />
            <Text style={styles.statNumber}>
              {restaurant.total_orders || 0}
            </Text>
            <Text style={styles.statLabel}>Orders</Text>
          </View>
        </View>

        {/* Order Method Toggle */}
        <View style={styles.orderMethodContainer}>
          <TouchableOpacity
            style={[
              styles.orderMethodButton,
              orderMethod === "delivery" && styles.orderMethodButtonActive,
            ]}
            onPress={() => setOrderMethod("delivery")}
          >
            <Ionicons
              name="bicycle"
              size={16}
              color={orderMethod === "delivery" ? "#fff" : "#4B5565"}
            />
            <Text
              style={[
                styles.orderMethodText,
                orderMethod === "delivery" && styles.orderMethodTextActive,
              ]}
            >
              Delivery
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.orderMethodButton,
              orderMethod === "pickup" && styles.orderMethodButtonActive,
            ]}
            onPress={() => setOrderMethod("pickup")}
          >
            <Ionicons
              name="walk-outline"
              size={16}
              color={orderMethod === "pickup" ? "#fff" : "#4B5565"}
            />
            <Text
              style={[
                styles.orderMethodText,
                orderMethod === "pickup" && styles.orderMethodTextActive,
              ]}
            >
              Pickup
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          {(["menu", "posts", "info", "reviews"] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[
                styles.tabButton,
                activeTab === tab && styles.tabButtonActive,
              ]}
              onPress={() => setActiveTab(tab)}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === tab && styles.tabTextActive,
                ]}
              >
                {tab === "menu" && "Menu"}
                {tab === "posts" && "Posts"}
                {tab === "info" && "Info"}
                {tab === "reviews" && "Reviews"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Content based on active tab */}
        {activeTab === "menu" && (
          <View style={styles.tabContent}>
            {/* Menu Categories Filter */}
            {getCategories().length > 0 && (
              <View style={styles.categoryFilter}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.categoryFilterScroll}
                >
                  {getCategories().map((category) => (
                    <TouchableOpacity
                      key={category}
                      style={[
                        styles.categoryButton,
                        selectedCategory === category &&
                          styles.categoryButtonActive,
                      ]}
                      onPress={() => setSelectedCategory(category)}
                    >
                      <Text
                        style={[
                          styles.categoryButtonText,
                          selectedCategory === category &&
                            styles.categoryButtonTextActive,
                        ]}
                      >
                        {category}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Menu Items Grid */}
            {displayedMenuItems.length > 0 ? (
              <View style={styles.menuGrid}>
                {displayedMenuItems.map((item) => (
                  <View key={item.id} style={styles.menuItemCard}>
                    <Image
                      source={{
                        uri:
                          item.image_url || "https://via.placeholder.com/150",
                      }}
                      style={styles.menuItemImage}
                    />
                    <View style={styles.menuItemInfo}>
                      <Text style={styles.menuItemName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text
                        style={styles.menuItemDescription}
                        numberOfLines={2}
                      >
                        {item.description || "Delicious item"}
                      </Text>
                      <View style={styles.menuItemFooter}>
                        <Text style={styles.menuItemPrice}>
                          AED {item.price.toFixed(2)}
                        </Text>
                        <View style={styles.menuItemActions}>
                          {/* 🔴 NEW: Compare Button */}
                          <TouchableOpacity
                            style={styles.compareButton}
                            onPress={() => findSimilarItems(item)}
                          >
                            <Ionicons
                              name="git-compare"
                              size={14}
                              color="#3B82F6"
                            />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.addToCartButtonSmall}
                            onPress={() => handleAddToCart(item)}
                          >
                            <Ionicons name="add" size={16} color="#fff" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="fast-food-outline" size={48} color="#D1D5DB" />
                <Text style={styles.emptyStateTitle}>
                  No menu items available
                </Text>
                <Text style={styles.emptyStateText}>Check back later</Text>
              </View>
            )}

            {/* Show More/Less Button */}
            {menuItems.length > 6 && (
              <TouchableOpacity
                style={styles.showMoreButton}
                onPress={() => setShowFullMenu(!showFullMenu)}
              >
                <Text style={styles.showMoreText}>
                  {showFullMenu
                    ? "Show Less"
                    : `Show All ${menuItems.length} Items`}
                </Text>
                <Ionicons
                  name={showFullMenu ? "chevron-up" : "chevron-down"}
                  size={16}
                  color="#FF6B35"
                />
              </TouchableOpacity>
            )}
          </View>
        )}

        {activeTab === "posts" && (
          <View style={styles.tabContent}>
            {displayedPosts.length > 0 ? (
              <>
                {displayedPosts.map((post) => (
                  <TouchableOpacity
                    key={post.id}
                    style={styles.postCard}
                    onPress={() => router.push(`/post/${post.id}`)}
                  >
                    <Image
                      source={{
                        uri:
                          post.image_url ||
                          "https://via.placeholder.com/400x200",
                      }}
                      style={styles.postImage}
                    />
                    <View style={styles.postInfo}>
                      <View style={styles.postHeader}>
                        <View
                          style={[
                            styles.postTypeBadge,
                            {
                              backgroundColor:
                                post.post_type === "promotion"
                                  ? "#FF6B35"
                                  : "#3B82F6",
                            },
                          ]}
                        >
                          <Text style={styles.postTypeText}>
                            {post.post_type?.toUpperCase()}
                          </Text>
                        </View>
                        {post.discount_percentage && (
                          <View style={styles.discountBadge}>
                            <Text style={styles.discountText}>
                              {post.discount_percentage}% OFF
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.postTitle}>{post.title}</Text>
                      <Text style={styles.postDescription} numberOfLines={2}>
                        {post.description}
                      </Text>
                      <View style={styles.postFooter}>
                        <View style={styles.postStats}>
                          <View style={styles.postStat}>
                            <Ionicons
                              name="heart-outline"
                              size={14}
                              color="#4B5565"
                            />
                            <Text style={styles.postStatText}>
                              {post.likes_count || 0}
                            </Text>
                          </View>
                          <View style={styles.postStat}>
                            <Ionicons
                              name="chatbubble-outline"
                              size={14}
                              color="#4B5565"
                            />
                            <Text style={styles.postStatText}>
                              {post.comments_count || 0}
                            </Text>
                          </View>
                        </View>
                        {post.discounted_price && (
                          <Text style={styles.postPrice}>
                            AED {post.discounted_price.toFixed(2)}
                          </Text>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}

                {posts.length > 3 && (
                  <TouchableOpacity
                    style={styles.showMoreButton}
                    onPress={() => setShowFullPosts(!showFullPosts)}
                  >
                    <Text style={styles.showMoreText}>
                      {showFullPosts
                        ? "Show Less"
                        : `Show All ${posts.length} Posts`}
                    </Text>
                    <Ionicons
                      name={showFullPosts ? "chevron-up" : "chevron-down"}
                      size={16}
                      color="#FF6B35"
                    />
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="newspaper-outline" size={48} color="#D1D5DB" />
                <Text style={styles.emptyStateTitle}>No posts yet</Text>
                <Text style={styles.emptyStateText}>
                  Check back for updates
                </Text>
              </View>
            )}
          </View>
        )}

        {activeTab === "info" && (
          <View style={styles.tabContent}>
            {restaurant.description && (
              <View style={styles.infoSection}>
                <Text style={styles.sectionTitle}>About</Text>
                <Text style={styles.descriptionText}>
                  {restaurant.description}
                </Text>
              </View>
            )}

            <View style={styles.infoSection}>
              <Text style={styles.sectionTitle}>Cuisine & Features</Text>
              <View style={styles.featuresGrid}>
                {restaurant.cuisine_type && (
                  <View style={styles.featureTag}>
                    <Ionicons name="restaurant" size={14} color="#4B5565" />
                    <Text style={styles.featureText}>
                      {restaurant.cuisine_type}
                    </Text>
                  </View>
                )}
                {restaurant.is_halal && (
                  <View style={styles.featureTag}>
                    <Ionicons
                      name="checkmark-circle"
                      size={14}
                      color="#10B981"
                    />
                    <Text style={styles.featureText}>Halal</Text>
                  </View>
                )}
                {restaurant.has_dine_in && (
                  <View style={styles.featureTag}>
                    <MaterialCommunityIcons
                      name="food"
                      size={14}
                      color="#4B5565"
                    />
                    <Text style={styles.featureText}>Dine-in</Text>
                  </View>
                )}
                {restaurant.has_outdoor && (
                  <View style={styles.featureTag}>
                    <Ionicons name="sunny-outline" size={14} color="#4B5565" />
                    <Text style={styles.featureText}>Outdoor</Text>
                  </View>
                )}
                {restaurant.has_wifi && (
                  <View style={styles.featureTag}>
                    <Ionicons name="wifi" size={14} color="#4B5565" />
                    <Text style={styles.featureText}>WiFi</Text>
                  </View>
                )}
                {restaurant.has_parking && (
                  <View style={styles.featureTag}>
                    <Ionicons name="car-sport" size={14} color="#4B5565" />
                    <Text style={styles.featureText}>Parking</Text>
                  </View>
                )}
              </View>
            </View>

            <View style={styles.infoSection}>
              <Text style={styles.sectionTitle}>Contact</Text>
              <View style={styles.contactInfo}>
                {restaurant.users?.phone && (
                  <TouchableOpacity style={styles.contactItem}>
                    <Ionicons name="call-outline" size={16} color="#4B5565" />
                    <Text style={styles.contactText}>
                      {restaurant.users.phone}
                    </Text>
                  </TouchableOpacity>
                )}
                {restaurant.users?.email && (
                  <TouchableOpacity style={styles.contactItem}>
                    <Ionicons name="mail-outline" size={16} color="#4B5565" />
                    <Text style={styles.contactText}>
                      {restaurant.users.email}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {restaurant.latitude && restaurant.longitude && (
              <View style={styles.infoSection}>
                <Text style={styles.sectionTitle}>Location</Text>
                <View style={styles.mapContainer}>
                  <MapView
                    style={styles.map}
                    provider={PROVIDER_GOOGLE}
                    initialRegion={{
                      latitude: parseFloat(restaurant.latitude),
                      longitude: parseFloat(restaurant.longitude),
                      latitudeDelta: 0.01,
                      longitudeDelta: 0.01,
                    }}
                    scrollEnabled={false}
                    zoomEnabled={false}
                  >
                    <Marker
                      coordinate={{
                        latitude: parseFloat(restaurant.latitude),
                        longitude: parseFloat(restaurant.longitude),
                      }}
                    >
                      <View style={styles.mapMarker}>
                        <Ionicons name="restaurant" size={20} color="#FF6B35" />
                      </View>
                    </Marker>
                  </MapView>
                  <Text style={styles.addressText} numberOfLines={2}>
                    {restaurant.address}
                  </Text>
                </View>
              </View>
            )}

            {restaurant.opening_hours && (
              <View style={styles.infoSection}>
                <Text style={styles.sectionTitle}>Opening Hours</Text>
                {(() => {
                  const hours = parseOpeningHours(restaurant.opening_hours);
                  if (!hours) return null;

                  const days = [
                    { key: "monday", label: "Monday" },
                    { key: "tuesday", label: "Tuesday" },
                    { key: "wednesday", label: "Wednesday" },
                    { key: "thursday", label: "Thursday" },
                    { key: "friday", label: "Friday" },
                    { key: "saturday", label: "Saturday" },
                    { key: "sunday", label: "Sunday" },
                  ];

                  return (
                    <View style={styles.openingHours}>
                      {days.map((day) => (
                        <View key={day.key} style={styles.hoursRow}>
                          <Text style={styles.dayText}>{day.label}</Text>
                          {hours[day.key]?.open && hours[day.key]?.close ? (
                            <Text style={styles.timeText}>
                              {formatTime(hours[day.key].open)} -{" "}
                              {formatTime(hours[day.key].close)}
                            </Text>
                          ) : (
                            <Text style={[styles.timeText, styles.closedText]}>
                              Closed
                            </Text>
                          )}
                        </View>
                      ))}
                    </View>
                  );
                })()}
              </View>
            )}
          </View>
        )}

        {activeTab === "reviews" && (
          <View style={styles.tabContent}>
            {/* Review Summary */}
            <View style={styles.reviewSummary}>
              <View style={styles.averageRating}>
                <Text style={styles.averageRatingNumber}>
                  {restaurant.restaurant_rating?.toFixed(1) || "0.0"}
                </Text>
                <RatingStars
                  rating={restaurant.restaurant_rating || 0}
                  size={16}
                />
                <Text style={styles.totalReviews}>
                  {reviews.length} reviews
                </Text>
              </View>
              <TouchableOpacity
                style={styles.writeReviewButton}
                onPress={() => setShowReviewModal(true)}
              >
                <Ionicons name="create-outline" size={16} color="#FF6B35" />
                <Text style={styles.writeReviewText}>Write Review</Text>
              </TouchableOpacity>
            </View>

            {/* Reviews List */}
            {reviews.length > 0 ? (
              <View style={styles.reviewsList}>
                {reviews.map((review) => (
                  <View key={review.id} style={styles.reviewCard}>
                    <View style={styles.reviewHeader}>
                      <View style={styles.reviewerInfo}>
                        {review.users?.profile_image_url ? (
                          <Image
                            source={{ uri: review.users.profile_image_url }}
                            style={styles.reviewerAvatar}
                          />
                        ) : (
                          <View style={styles.reviewerAvatarDefault}>
                            <Text style={styles.reviewerInitials}>
                              {review.users?.full_name?.charAt(0) || "U"}
                            </Text>
                          </View>
                        )}
                        <View>
                          <Text style={styles.reviewerName}>
                            {review.users?.full_name || "Anonymous"}
                          </Text>
                          <RatingStars rating={review.rating} size={12} />
                        </View>
                      </View>
                      <Text style={styles.reviewDate}>
                        {new Date(review.created_at).toLocaleDateString()}
                      </Text>
                    </View>
                    <Text style={styles.reviewComment}>{review.comment}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="chatbubble-outline" size={48} color="#D1D5DB" />
                <Text style={styles.emptyStateTitle}>No reviews yet</Text>
                <Text style={styles.emptyStateText}>
                  Be the first to review!
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.orderButton}
            onPress={() => {
              setActiveTab("menu");
            }}
          >
            <Text style={styles.orderButtonText}>
              {orderMethod === "delivery" ? "Order Delivery" : "Order Pickup"}
            </Text>
          </TouchableOpacity>

          {/* 🔴 NEW: Schedule Button
          <TouchableOpacity
            style={styles.scheduleButton}
            onPress={() => setShowScheduleModal(true)}
          >
            <Ionicons name="calendar-outline" size={18} color="#FF6B35" />
            <Text style={styles.scheduleButtonText}>Schedule</Text>
          </TouchableOpacity> */}

          {!isGuest && (
            <TouchableOpacity
              style={styles.messageButton}
              onPress={startConversation}
            >
              <Ionicons name="chatbubble-outline" size={18} color="#FF6B35" />
              <Text style={styles.messageButtonText}>Message</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Review Modal */}
      <Modal
        visible={showReviewModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowReviewModal(false)}
      >
        <BlurView intensity={50} tint="dark" style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Write a Review</Text>
              <TouchableOpacity onPress={() => setShowReviewModal(false)}>
                <Ionicons name="close" size={24} color="#374151" />
              </TouchableOpacity>
            </View>

            <View style={styles.ratingSelector}>
              <Text style={styles.ratingLabel}>Your Rating</Text>
              <View style={styles.starsSelector}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity
                    key={star}
                    onPress={() => setReviewRating(star)}
                  >
                    <Ionicons
                      name={star <= reviewRating ? "star" : "star-outline"}
                      size={32}
                      color="#FFD700"
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TextInput
              style={styles.reviewInput}
              placeholder="Share your experience..."
              value={reviewText}
              onChangeText={setReviewText}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[
                styles.submitReviewButton,
                submittingReview && styles.submitReviewButtonDisabled,
              ]}
              onPress={handleSubmitReview}
              disabled={submittingReview}
            >
              {submittingReview ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.submitReviewButtonText}>Submit Review</Text>
              )}
            </TouchableOpacity>
          </View>
        </BlurView>
      </Modal>

      {/* 🔴 NEW: Schedule Order Modal 
      <Modal
        visible={showScheduleModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowScheduleModal(false)}
      >
        <BlurView intensity={50} tint="dark" style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Schedule Order</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowScheduleModal(false);
                  resetScheduleState();
                }}
              >
                <Ionicons name="close" size={24} color="#374151" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              / Schedule Type Selection /
              <Text style={styles.scheduleLabel}>When do you want it?</Text>
              <View style={styles.scheduleOptions}>
                <TouchableOpacity
                  style={[
                    styles.scheduleOption,
                    scheduleType === "today" && styles.scheduleOptionActive,
                  ]}
                  onPress={() => setScheduleType("today")}
                >
                  <Ionicons
                    name="today-outline"
                    size={20}
                    color={scheduleType === "today" ? "#FF6B35" : "#6B7280"}
                  />
                  <Text
                    style={[
                      styles.scheduleOptionText,
                      scheduleType === "today" &&
                        styles.scheduleOptionTextActive,
                    ]}
                  >
                    Today
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.scheduleOption,
                    scheduleType === "tomorrow" && styles.scheduleOptionActive,
                  ]}
                  onPress={() => setScheduleType("tomorrow")}
                >
                  <Ionicons
                    name="sunny-outline"
                    size={20}
                    color={scheduleType === "tomorrow" ? "#FF6B35" : "#6B7280"}
                  />
                  <Text
                    style={[
                      styles.scheduleOptionText,
                      scheduleType === "tomorrow" &&
                        styles.scheduleOptionTextActive,
                    ]}
                  >
                    Tomorrow
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.scheduleOption,
                    scheduleType === "week" && styles.scheduleOptionActive,
                  ]}
                  onPress={() => setScheduleType("week")}
                >
                  <Ionicons
                    name="calendar-outline"
                    size={20}
                    color={scheduleType === "week" ? "#FF6B35" : "#6B7280"}
                  />
                  <Text
                    style={[
                      styles.scheduleOptionText,
                      scheduleType === "week" &&
                        styles.scheduleOptionTextActive,
                    ]}
                  >
                    This Week
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.scheduleOption,
                    scheduleType === "recurring" && styles.scheduleOptionActive,
                  ]}
                  onPress={() => setScheduleType("recurring")}
                >
                  <Ionicons
                    name="repeat-outline"
                    size={20}
                    color={scheduleType === "recurring" ? "#FF6B35" : "#6B7280"}
                  />
                  <Text
                    style={[
                      styles.scheduleOptionText,
                      scheduleType === "recurring" &&
                        styles.scheduleOptionTextActive,
                    ]}
                  >
                    Weekly
                  </Text>
                </TouchableOpacity>
              </View>

              /* Time Selection *
              <Text style={styles.scheduleLabel}>Select Time</Text>
              <TouchableOpacity
                style={styles.timeSelector}
                onPress={() => setShowTimePicker(true)}
              >
                <Ionicons name="time-outline" size={20} color="#6B7280" />
                <Text style={styles.timeSelectorText}>
                  {selectedTime
                    ? selectedTime.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "Choose time"}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#6B7280" />
              </TouchableOpacity>

              /* Date Selection for "This Week" *
              {scheduleType === "week" && (
                <>
                  <Text style={styles.scheduleLabel}>Select Date</Text>
                  <TouchableOpacity
                    style={styles.timeSelector}
                    onPress={() => setShowDatePicker(true)}
                  >
                    <Ionicons
                      name="calendar-outline"
                      size={20}
                      color="#6B7280"
                    />
                    <Text style={styles.timeSelectorText}>
                      {selectedDate
                        ? selectedDate.toLocaleDateString()
                        : "Choose date"}
                    </Text>
                    <Ionicons name="chevron-down" size={20} color="#6B7280" />
                  </TouchableOpacity>
                </>
              )}

              /* Recurring Days Selection *
              {scheduleType === "recurring" && (
                <>
                  <Text style={styles.scheduleLabel}>Repeat on</Text>
                  <View style={styles.recurringDays}>
                    {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
                      (day) => (
                        <TouchableOpacity
                          key={day}
                          style={[
                            styles.recurringDayButton,
                            recurringDays.includes(day) &&
                              styles.recurringDayButtonActive,
                          ]}
                          onPress={() => toggleRecurringDay(day)}
                        >
                          <Text
                            style={[
                              styles.recurringDayText,
                              recurringDays.includes(day) &&
                                styles.recurringDayTextActive,
                            ]}
                          >
                            {day}
                          </Text>
                        </TouchableOpacity>
                      ),
                    )}
                  </View>
                </>
              )}

              /* Special Notes *
              <Text style={styles.scheduleLabel}>Special Notes (Optional)</Text>
              <TextInput
                style={styles.notesInput}
                placeholder="Add any special requests..."
                value={scheduleNotes}
                onChangeText={setScheduleNotes}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />

              /* Action Buttons *
              <View style={styles.scheduleActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    setShowScheduleModal(false);
                    resetScheduleState();
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.confirmButton}
                  onPress={handleScheduleOrder}
                >
                  <Text style={styles.confirmButtonText}>Confirm Schedule</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            /* Time Picker Modal *
            {showTimePicker && (
              <DateTimePicker
                value={selectedTime || new Date()}
                mode="time"
                display="spinner"
                onChange={(event, date) => {
                  setShowTimePicker(false);
                  if (date) setSelectedTime(date);
                }}
              />
            )}

            {/* Date Picker Modal *
            {showDatePicker && (
              <DateTimePicker
                value={selectedDate || new Date()}
                mode="date"
                display="spinner"
                minimumDate={new Date()}
                onChange={(event, date) => {
                  setShowDatePicker(false);
                  if (date) setSelectedDate(date);
                }}
              />
            )}
          </View>
        </BlurView>
      </Modal>
      */}

      {/* 🔴 NEW: Price Comparison Modal */}
      <Modal
        visible={showPriceComparison}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPriceComparison(false)}
      >
        <BlurView intensity={50} tint="dark" style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Compare Prices</Text>
              <TouchableOpacity onPress={() => setShowPriceComparison(false)}>
                <Ionicons name="close" size={24} color="#374151" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {loadingComparison ? (
                <View style={styles.loadingComparison}>
                  <ActivityIndicator size="large" color="#FF6B35" />
                  <Text style={styles.loadingComparisonText}>
                    Finding similar items...
                  </Text>
                </View>
              ) : comparisonItems.length > 0 ? (
                comparisonItems.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.comparisonItem}
                    onPress={() => {
                      setShowPriceComparison(false);
                      router.push(`/restaurant/${item.restaurant_id}`);
                    }}
                  >
                    <Image
                      source={{
                        uri: item.image_url || "https://via.placeholder.com/60",
                      }}
                      style={styles.comparisonItemImage}
                    />
                    <View style={styles.comparisonItemInfo}>
                      <Text style={styles.comparisonItemName}>{item.name}</Text>
                      <Text style={styles.comparisonItemRestaurant}>
                        {item.restaurants?.restaurant_name}
                      </Text>
                      <View style={styles.comparisonItemRating}>
                        <Ionicons name="star" size={12} color="#FFD700" />
                        <Text style={styles.comparisonItemRatingText}>
                          {item.restaurants?.restaurant_rating?.toFixed(1) ||
                            "4.0"}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.comparisonItemPrice}>
                      <Text style={styles.comparisonItemPriceText}>
                        AED {item.price.toFixed(2)}
                      </Text>
                      {item.restaurants?.delivery_fee === 0 ? (
                        <Text style={styles.comparisonItemFreeDelivery}>
                          Free Delivery
                        </Text>
                      ) : (
                        <Text style={styles.comparisonItemDeliveryFee}>
                          +AED {item.restaurants?.delivery_fee || 5}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.emptyComparison}>
                  <Ionicons name="search-outline" size={48} color="#D1D5DB" />
                  <Text style={styles.emptyComparisonTitle}>
                    No similar items found
                  </Text>
                  <Text style={styles.emptyComparisonText}>
                    Try checking other restaurants
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </BlurView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
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
    color: "#4B5565",
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
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    marginTop: 16,
    marginBottom: 8,
  },
  backButton: {
    backgroundColor: "#FF6B35",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 20,
  },
  backButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 50,
    paddingHorizontal: 16,
  },
  backButtonHeader: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  cartButtonHeader: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  cartBadge: {
    position: "absolute",
    top: -5,
    right: -5,
    backgroundColor: "#EF4444",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  cartBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "600",
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  heroSection: {
    height: 250,
    position: "relative",
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  heroOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 16,
  },
  restaurantNameContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  restaurantName: {
    fontSize: 24,
    fontWeight: "700",
    color: "#fff",
    flex: 1,
  },
  restaurantRatingContainer: {
    alignItems: "flex-end",
  },
  reviewCount: {
    fontSize: 12,
    color: "#D1D5DB",
    marginTop: 4,
  },
  favoriteButton: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  quickInfoBar: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  quickInfoItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 16,
    marginBottom: 4,
  },
  quickInfoText: {
    fontSize: 12,
    color: "#4B5565",
    marginLeft: 4,
  },
  orderMethodContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingBottom: 2,
    backgroundColor: "#fff",
    paddingTop: 2,
  },
  orderMethodButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    marginRight: 12,
    borderWidth: 0.3,
    borderColor: "#999",
  },
  orderMethodButtonActive: {
    backgroundColor: "#FF6B35",
    borderColor: "#FF6B35",
  },
  orderMethodText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4B5565",
    marginLeft: 6,
  },
  orderMethodTextActive: {
    color: "#fff",
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  tabButton: {
    flex: 1,
    paddingVertical: 16,
    alignItems: "center",
  },
  tabButtonActive: {
    borderBottomWidth: 2,
    borderBottomColor: "#FF6B35",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4B5565",
  },
  tabTextActive: {
    color: "#FF6B35",
  },
  tabContent: {
    padding: 16,
  },
  categoryFilter: {
    marginBottom: 16,
  },
  categoryFilterScroll: {
    paddingRight: 16,
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    marginRight: 8,
  },
  categoryButtonActive: {
    backgroundColor: "#FF6B35",
  },
  categoryButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#4B5565",
  },
  categoryButtonTextActive: {
    color: "#fff",
  },
  menuGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -8,
  },
  menuItemCard: {
    width: (SCREEN_WIDTH - 48) / 2,
    backgroundColor: "#fff",
    borderRadius: 5,
    borderWidth: 0.4,
    borderColor: "#E5E7EB",
    margin: 8,
    overflow: "hidden",
  },
  menuItemImage: {
    width: "100%",
    height: 120,
  },
  menuItemInfo: {
    padding: 12,
  },
  menuItemName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 4,
  },
  menuItemDescription: {
    fontSize: 12,
    color: "#4B5565",
    marginBottom: 8,
    lineHeight: 16,
  },
  menuItemFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  menuItemPrice: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FF6B35",
  },
  menuItemActions: {
    flexDirection: "row",
    gap: 6,
  },
  compareButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#3B82F610",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#3B82F630",
  },
  addToCartButtonSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#10B981",
    justifyContent: "center",
    alignItems: "center",
  },
  postCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 16,
    overflow: "hidden",
  },
  postImage: {
    width: "100%",
    height: 160,
  },
  postInfo: {
    padding: 16,
  },
  postHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  postTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 8,
  },
  postTypeText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#fff",
  },
  discountBadge: {
    backgroundColor: "#10B981",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  discountText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#fff",
  },
  postTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  postDescription: {
    fontSize: 13,
    color: "#4B5565",
    marginBottom: 12,
    lineHeight: 18,
  },
  postFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  postStats: {
    flexDirection: "row",
    gap: 12,
  },
  postStat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  postStatText: {
    fontSize: 12,
    color: "#4B5565",
  },
  postPrice: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FF6B35",
  },
  infoSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
  },
  descriptionText: {
    fontSize: 14,
    color: "#4B5565",
    lineHeight: 20,
  },
  featuresGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -4,
    marginVertical: -4,
  },
  featureTag: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#F3F4F6",
    borderRadius: 16,
    margin: 4,
  },
  featureText: {
    fontSize: 12,
    color: "#4B5565",
    marginLeft: 4,
  },
  contactInfo: {
    gap: 8,
  },
  contactItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  contactText: {
    fontSize: 14,
    color: "#374151",
  },
  mapContainer: {
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  map: {
    height: 150,
  },
  mapMarker: {
    backgroundColor: "#fff",
    padding: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#FF6B35",
  },
  addressText: {
    padding: 12,
    fontSize: 14,
    color: "#374151",
  },
  openingHours: {
    gap: 8,
  },
  hoursRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  dayText: {
    fontSize: 14,
    color: "#374151",
  },
  timeText: {
    fontSize: 14,
    color: "#10B981",
    fontWeight: "600",
  },
  closedText: {
    color: "#EF4444",
  },
  reviewSummary: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  averageRating: {
    alignItems: "center",
  },
  averageRatingNumber: {
    fontSize: 32,
    fontWeight: "700",
    color: "#111827",
  },
  totalReviews: {
    fontSize: 12,
    color: "#4B5565",
    marginTop: 4,
  },
  writeReviewButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#FF6B3510",
    borderRadius: 8,
    gap: 6,
  },
  writeReviewText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FF6B35",
  },
  reviewsList: {
    gap: 16,
  },
  reviewCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 16,
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
    gap: 8,
  },
  reviewerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  reviewerAvatarDefault: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FF6B35",
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
  reviewDate: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  reviewComment: {
    fontSize: 14,
    color: "#374151",
    lineHeight: 20,
  },
  ratingStars: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#4B5565",
    marginLeft: 4,
  },
  emptyState: {
    padding: 40,
    alignItems: "center",
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
    marginTop: 12,
    marginBottom: 4,
  },
  emptyStateText: {
    fontSize: 14,
    color: "#9CA3AF",
    textAlign: "center",
  },
  showMoreButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    gap: 8,
  },
  showMoreText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FF6B35",
  },
  actionButtons: {
    flexDirection: "row",
    padding: 15,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    gap: 8,
  },
  orderButton: {
    flex: 2,
    backgroundColor: "#FF6B35",
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: "center",
  },
  orderButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  scheduleButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FF6B35",
    gap: 6,
  },
  scheduleButtonText: {
    color: "#FF6B35",
    fontSize: 14,
    fontWeight: "600",
  },
  messageButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FF6B35",
    gap: 6,
  },
  messageButtonText: {
    color: "#FF6B35",
    fontSize: 14,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  ratingSelector: {
    alignItems: "center",
    marginBottom: 20,
  },
  ratingLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 12,
  },
  starsSelector: {
    flexDirection: "row",
    gap: 8,
  },
  reviewInput: {
    borderWidth: 0.3,
    borderColor: "#4B5565",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: "#374151",
    minHeight: 120,
    marginBottom: 20,
  },
  submitReviewButton: {
    backgroundColor: "#FF6B35",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  submitReviewButtonDisabled: {
    opacity: 0.5,
  },
  submitReviewButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  statItem: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  statNumber: {
    fontSize: 13,
    fontWeight: "700",
    color: "#444",
    marginTop: 0,
  },
  statLabel: {
    fontSize: 12,
    color: "#4B5565",
    marginTop: 0,
  },

  // 🔴 NEW: Schedule Modal Styles
  scheduleLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 12,
    marginTop: 16,
  },
  scheduleOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  scheduleOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 8,
    minWidth: (SCREEN_WIDTH - 80) / 4,
  },
  scheduleOptionActive: {
    backgroundColor: "#FF6B3510",
    borderColor: "#FF6B35",
  },
  scheduleOptionText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6B7280",
  },
  scheduleOptionTextActive: {
    color: "#FF6B35",
  },
  timeSelector: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 8,
    marginBottom: 8,
  },
  timeSelectorText: {
    flex: 1,
    fontSize: 14,
    color: "#374151",
  },
  recurringDays: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  recurringDayButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F9FAFB",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  recurringDayButtonActive: {
    backgroundColor: "#FF6B35",
    borderColor: "#FF6B35",
  },
  recurringDayText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6B7280",
  },
  recurringDayTextActive: {
    color: "#FFFFFF",
  },
  notesInput: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 16,
    fontSize: 14,
    color: "#374151",
    backgroundColor: "#F9FAFB",
    minHeight: 80,
    marginBottom: 20,
  },
  scheduleActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
    marginBottom: 20,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
  },
  confirmButton: {
    flex: 2,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: "#FF6B35",
    alignItems: "center",
  },
  confirmButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },

  // 🔴 NEW: Price Comparison Styles
  loadingComparison: {
    padding: 40,
    alignItems: "center",
  },
  loadingComparisonText: {
    marginTop: 12,
    fontSize: 14,
    color: "#6B7280",
  },
  comparisonItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
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
    fontSize: 14,
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
    fontSize: 16,
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
  emptyComparisonTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
    marginTop: 12,
    marginBottom: 4,
  },
  emptyComparisonText: {
    fontSize: 14,
    color: "#9CA3AF",
    textAlign: "center",
  },
});
