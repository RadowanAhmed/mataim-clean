// app/(tabs)/orders/rate/[orderId].tsx
import { useAuth } from "@/backend/AuthContext";
import { supabase } from "@/backend/supabase";
import animations from "@/constent/animations";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import LottieView from "lottie-react-native";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface OrderDetails {
  id: string;
  order_number: string;
  restaurant_id: string;
  restaurant_name: string;
  restaurant_image: string;
  driver_id?: string;
  driver_name?: string;
  driver_image?: string;
  items: {
    id: string;
    name: string;
    quantity: number;
    price: number;
    image?: string;
  }[];
  total_amount: number;
  created_at: string;
}

interface ExistingReview {
  id: string;
  type: "restaurant" | "driver";
  rating: number;
  comment: string;
}

export default function RateOrderScreen() {
  const { orderId } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [order, setOrder] = useState<OrderDetails | null>(null);

  // Restaurant review states
  const [restaurantRating, setRestaurantRating] = useState(0);
  const [restaurantReview, setRestaurantReview] = useState("");
  const [existingRestaurantReview, setExistingRestaurantReview] =
    useState<ExistingReview | null>(null);

  // Driver review states
  const [driverRating, setDriverRating] = useState(0);
  const [driverReview, setDriverReview] = useState("");
  const [existingDriverReview, setExistingDriverReview] =
    useState<ExistingReview | null>(null);

  useEffect(() => {
    if (orderId) {
      fetchOrderDetails();
    }
  }, [orderId]);

  const fetchOrderDetails = async () => {
    try {
      setLoading(true);

      // First, fetch order details without the nested users relationship
      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .select(
          `
          id,
          order_number,
          restaurant_id,
          driver_id,
          total_amount,
          created_at
        `,
        )
        .eq("id", orderId)
        .single();

      if (orderError) throw orderError;

      // Fetch restaurant details separately
      const { data: restaurantData, error: restaurantError } = await supabase
        .from("restaurants")
        .select(
          `
          restaurant_name,
          image_url
        `,
        )
        .eq("id", orderData.restaurant_id)
        .single();

      if (restaurantError) throw restaurantError;

      // Fetch driver details if driver exists
      let driverName = null;
      let driverImage = null;

      if (orderData.driver_id) {
        // First get the delivery user record
        const { data: deliveryUserData, error: deliveryError } = await supabase
          .from("delivery_users")
          .select("id")
          .eq("id", orderData.driver_id)
          .single();

        if (!deliveryError && deliveryUserData) {
          // Then get the user details from users table
          const { data: userData, error: userError } = await supabase
            .from("users")
            .select("full_name, profile_image_url")
            .eq("id", orderData.driver_id) // delivery_users.id references users.id
            .single();

          if (!userError && userData) {
            driverName = userData.full_name;
            driverImage = userData.profile_image_url;
          }
        }
      }

      // Fetch order items
      const { data: itemsData, error: itemsError } = await supabase
        .from("order_items")
        .select(
          `
          id,
          quantity,
          unit_price,
          post_id,
          menu_item_id
        `,
        )
        .eq("order_id", orderId);

      if (itemsError) throw itemsError;

      // Process items and fetch their details
      const items = await Promise.all(
        itemsData.map(async (item: any) => {
          let itemName = "Item";
          let itemImage = null;

          if (item.post_id) {
            // Fetch from posts
            const { data: postData } = await supabase
              .from("posts")
              .select("title, image_url")
              .eq("id", item.post_id)
              .single();

            if (postData) {
              itemName = postData.title;
              itemImage = postData.image_url;
            }
          } else if (item.menu_item_id) {
            // Fetch from menu_items
            const { data: menuData } = await supabase
              .from("menu_items")
              .select("name, image_url")
              .eq("id", item.menu_item_id)
              .single();

            if (menuData) {
              itemName = menuData.name;
              itemImage = menuData.image_url;
            }
          }

          return {
            id: item.id,
            name: itemName,
            quantity: item.quantity || 1,
            price: parseFloat(item.unit_price) || 0,
            image: itemImage,
          };
        }),
      );

      // Check for existing reviews
      const { data: reviewsData, error: reviewsError } = await supabase
        .from("reviews")
        .select("id, type, rating, comment")
        .eq("order_id", orderId)
        .eq("customer_id", user?.id);

      if (!reviewsError && reviewsData) {
        reviewsData.forEach((review: any) => {
          if (review.type === "restaurant") {
            setExistingRestaurantReview(review);
            setRestaurantRating(review.rating);
            setRestaurantReview(review.comment || "");
          } else if (review.type === "driver") {
            setExistingDriverReview(review);
            setDriverRating(review.rating);
            setDriverReview(review.comment || "");
          }
        });
      }

      setOrder({
        id: orderData.id,
        order_number: orderData.order_number,
        restaurant_id: orderData.restaurant_id,
        restaurant_name: restaurantData?.restaurant_name || "Restaurant",
        restaurant_image: restaurantData?.image_url,
        driver_id: orderData.driver_id,
        driver_name: driverName,
        driver_image: driverImage,
        items,
        total_amount: parseFloat(orderData.total_amount) || 0,
        created_at: orderData.created_at,
      });
    } catch (error) {
      console.error("Error fetching order details:", error);
      Alert.alert("Error", "Failed to load order details");
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const submitReview = async (
    type: "restaurant" | "driver",
    rating: number,
    comment: string,
  ) => {
    if (rating === 0) {
      Alert.alert("Rating Required", `Please rate the ${type} to continue`);
      return null;
    }

    try {
      const reviewData = {
        order_id: orderId,
        customer_id: user?.id,
        restaurant_id: type === "restaurant" ? order?.restaurant_id : null,
        driver_id: type === "driver" ? order?.driver_id : null,
        rating,
        comment: comment.trim() || null,
        type,
      };

      console.log("Submitting review:", reviewData);

      // Check if review already exists
      const existingReview =
        type === "restaurant" ? existingRestaurantReview : existingDriverReview;

      if (existingReview) {
        // Update existing review
        const { error } = await supabase
          .from("reviews")
          .update({
            rating,
            comment: comment.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingReview.id);

        if (error) throw error;
        console.log("Review updated");
      } else {
        // Insert new review
        const { data, error } = await supabase
          .from("reviews")
          .insert(reviewData)
          .select();

        if (error) throw error;
        console.log("Review inserted:", data);

        // If this is a restaurant review, increment the restaurant's total_reviews
        if (type === "restaurant" && order?.restaurant_id) {
          console.log(
            "Incrementing reviews for restaurant:",
            order.restaurant_id,
          );

          const { data: rpcData, error: rpcError } = await supabase.rpc(
            "increment_restaurant_reviews",
            {
              restaurant_id_param: order.restaurant_id,
            },
          );

          if (rpcError) {
            console.error("RPC Error:", rpcError);
          } else {
            console.log("RPC Success:", rpcData);
          }
        }
      }

      return true;
    } catch (error) {
      console.error(`Error submitting ${type} review:`, error);
      Alert.alert("Error", `Failed to submit ${type} review`);
      return null;
    }
  };

  const handleSubmitAll = async () => {
    setSubmitting(true);

    // Submit restaurant review
    if (restaurantRating > 0) {
      await submitReview("restaurant", restaurantRating, restaurantReview);
    }

    // Submit driver review if driver exists
    if (order?.driver_id && driverRating > 0) {
      await submitReview("driver", driverRating, driverReview);
    }

    setSubmitting(false);

    // Show success message and navigate back
    Alert.alert(
      "Thank You!",
      "Your reviews have been submitted successfully.",
      [{ text: "OK", onPress: () => router.back() }],
    );
  };

  const handleSkip = () => {
    Alert.alert(
      "Skip Review",
      "Are you sure you want to skip? You can always rate this order later from your order history.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Skip", onPress: () => router.back() },
      ],
    );
  };

  const RatingStars = ({
    rating,
    setRating,
    size = 32,
    readonly = false,
  }: any) => {
    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            onPress={() => !readonly && setRating(star)}
            disabled={readonly}
            activeOpacity={0.7}
          >
            <Ionicons
              name={star <= rating ? "star" : "star-outline"}
              size={size}
              color={star <= rating ? "#FFD700" : "#D1D5DB"}
              style={styles.starIcon}
            />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const ReviewSection = ({
    title,
    subtitle,
    image,
    rating,
    setRating,
    review,
    setReview,
    existingReview,
    isDriver = false,
  }: any) => {
    if (isDriver && !order?.driver_id) return null;

    return (
      <View style={styles.reviewSection}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleContainer}>
            <Ionicons
              name={isDriver ? "bicycle" : "restaurant"}
              size={20}
              color="#FF6B35"
            />
            <Text style={styles.sectionTitle}>{title}</Text>
          </View>
          {existingReview && (
            <View style={styles.editBadge}>
              <Ionicons name="create-outline" size={14} color="#FF6B35" />
              <Text style={styles.editBadgeText}>Edit Review</Text>
            </View>
          )}
        </View>

        {/* Profile Info */}
        <View style={styles.profileContainer}>
          {image ? (
            <Image source={{ uri: image }} style={styles.profileImage} />
          ) : (
            <View style={[styles.profileImage, styles.profilePlaceholder]}>
              <Ionicons
                name={isDriver ? "person" : "restaurant-outline"}
                size={24}
                color="#9CA3AF"
              />
            </View>
          )}
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{subtitle}</Text>
            <Text style={styles.profileSubtext}>
              {isDriver ? "Your delivery partner" : "How was your food?"}
            </Text>
          </View>
        </View>

        {/* Rating Stars */}
        <View style={styles.ratingContainer}>
          <Text style={styles.ratingLabel}>Your Rating</Text>
          <RatingStars rating={rating} setRating={setRating} size={36} />
          <Text style={styles.ratingHint}>
            {rating === 0 && "Tap to rate"}
            {rating === 1 && "Poor"}
            {rating === 2 && "Fair"}
            {rating === 3 && "Good"}
            {rating === 4 && "Very Good"}
            {rating === 5 && "Excellent!"}
          </Text>
        </View>

        {/* Review Input */}
        <View style={styles.reviewInputContainer}>
          <Text style={styles.inputLabel}>Write a Review (Optional)</Text>
          <TextInput
            style={styles.reviewInput}
            placeholder={`Share your experience with this ${isDriver ? "driver" : "restaurant"}...`}
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={4}
            value={review}
            onChangeText={setReview}
            textAlignVertical="top"
          />
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <LottieView
          source={animations.loading || animations.restaurant_cafe}
          style={styles.loadingAnimation}
          autoPlay
          loop
        />
        <Text style={styles.loadingText}>Loading order details...</Text>
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <LottieView
          source={animations.empty_box || animations.restaurant_cafe}
          style={styles.errorAnimation}
          autoPlay
          loop
        />
        <Text style={styles.errorTitle}>Order Not Found</Text>
        <Text style={styles.errorText}>
          We couldn't find the order you're looking for.
        </Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backIcon}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Rate Your Order</Text>
        <TouchableOpacity onPress={handleSkip}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.contentContainer}
        >
          {/* Order Summary Card */}
          <View style={styles.orderSummary}>
            <View style={styles.orderHeader}>
              <View style={styles.orderIconContainer}>
                <Ionicons name="receipt-outline" size={20} color="#FF6B35" />
              </View>
              <View style={styles.orderInfo}>
                <Text style={styles.orderNumber}>
                  Order #{order.order_number}
                </Text>
                <Text style={styles.orderDate}>
                  {new Date(order.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </Text>
              </View>
              <View style={styles.orderTotal}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalAmount}>
                  AED {order.total_amount.toFixed(2)}
                </Text>
              </View>
            </View>

            {/* Order Items Preview */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.itemsPreview}
            >
              {order.items.map((item, index) => (
                <View key={item.id} style={styles.previewItem}>
                  {item.image ? (
                    <Image
                      source={{ uri: item.image }}
                      style={styles.previewImage}
                    />
                  ) : (
                    <View
                      style={[styles.previewImage, styles.previewPlaceholder]}
                    >
                      <Ionicons
                        name="fast-food-outline"
                        size={20}
                        color="#9CA3AF"
                      />
                    </View>
                  )}
                  <Text style={styles.previewItemName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.previewItemQty}>x{item.quantity}</Text>
                </View>
              ))}
            </ScrollView>
          </View>

          {/* Restaurant Review Section */}
          <ReviewSection
            title="Rate Restaurant"
            subtitle={order.restaurant_name}
            image={order.restaurant_image}
            rating={restaurantRating}
            setRating={setRestaurantRating}
            review={restaurantReview}
            setReview={setRestaurantReview}
            existingReview={existingRestaurantReview}
          />

          {/* Driver Review Section */}
          {order.driver_id && (
            <ReviewSection
              title="Rate Driver"
              subtitle={order.driver_name || "Delivery Partner"}
              image={order.driver_image}
              rating={driverRating}
              setRating={setDriverRating}
              review={driverReview}
              setReview={setDriverReview}
              existingReview={existingDriverReview}
              isDriver
            />
          )}

          <View style={styles.spacer} />
        </ScrollView>

        {/* Submit Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.submitButton,
              restaurantRating === 0 &&
                !order.driver_id &&
                styles.submitButtonDisabled,
            ]}
            onPress={handleSubmitAll}
            disabled={
              submitting || (restaurantRating === 0 && !order.driver_id)
            }
          >
            {submitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={styles.submitButtonText}>
                  {existingRestaurantReview || existingDriverReview
                    ? "Update Reviews"
                    : "Submit Reviews"}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
    backgroundColor: "#fff",
  },
  loadingAnimation: {
    width: 120,
    height: 120,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#6B7280",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 20,
  },
  errorAnimation: {
    width: 120,
    height: 120,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: "#FF6B35",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  backIcon: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  skipText: {
    fontSize: 14,
    color: "#9CA3AF",
    fontWeight: "500",
    padding: 4,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 15,
    paddingBottom: 32,
  },
  orderSummary: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
    borderWidth: 0.3,
    borderColor: "#F3F4F6",
    elevation: 2,
  },
  orderHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  orderIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FF6B3515",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  orderInfo: {
    flex: 1,
  },
  orderNumber: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 2,
  },
  orderDate: {
    fontSize: 12,
    color: "#6B7280",
  },
  orderTotal: {
    alignItems: "flex-end",
  },
  totalLabel: {
    fontSize: 10,
    color: "#9CA3AF",
    marginBottom: 2,
  },
  totalAmount: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FF6B35",
  },
  itemsPreview: {
    flexDirection: "row",
  },
  previewItem: {
    alignItems: "center",
    marginRight: 16,
    width: 70,
  },
  previewImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 6,
  },
  previewPlaceholder: {
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  previewItemName: {
    fontSize: 10,
    color: "#111827",
    fontWeight: "500",
    textAlign: "center",
    maxWidth: 70,
  },
  previewItemQty: {
    fontSize: 9,
    color: "#9CA3AF",
    marginTop: 2,
  },
  reviewSection: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 0.4,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  editBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FF6B3510",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  editBadgeText: {
    fontSize: 11,
    color: "#FF6B35",
    fontWeight: "500",
  },
  profileContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  profileImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: 16,
  },
  profilePlaceholder: {
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  profileSubtext: {
    fontSize: 12,
    color: "#6B7280",
  },
  ratingContainer: {
    alignItems: "center",
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  ratingLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  starsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 8,
  },
  starIcon: {
    marginHorizontal: 4,
  },
  ratingHint: {
    fontSize: 12,
    color: "#FF6B35",
    fontWeight: "500",
    marginTop: 8,
  },
  reviewInputContainer: {
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 8,
    fontWeight: "500",
  },
  reviewInput: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: "#111827",
    minHeight: 100,
    textAlignVertical: "top",
  },
  spacer: {
    height: 20,
  },
  footer: {
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    padding: 16,
    paddingBottom: Platform.OS === "ios" ? 32 : 16,
  },
  submitButton: {
    backgroundColor: "#FF6B35",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  submitButtonDisabled: {
    backgroundColor: "#F3F4F6",
    opacity: 0.7,
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
