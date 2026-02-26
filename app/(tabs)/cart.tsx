import { useGuestAction } from "@/backend/hooks/useGuestAction";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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

export default function CartScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cart, setCart] = useState<any>(null);
  const subscriptionRef = useRef<any>(null);

  // Inside the component
  const { checkGuestAction, isGuest } = useGuestAction();

  const fetchCart = useCallback(async () => {
    if (!user?.id) {
      setCartItems([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      console.log("1. Starting fetchCart for user:", user.id);

      // First, get or create cart
      const { data: cartData, error: cartError } = await supabase
        .from("carts")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();

      if (cartError) throw cartError;
      console.log("2. Cart data:", cartData);

      let currentCart = cartData;

      // If no cart exists, create one
      if (!currentCart) {
        console.log("3. Creating new cart");
        const { data: newCart, error: createError } = await supabase
          .from("carts")
          .insert({
            user_id: user.id,
            status: "active",
          })
          .select("*")
          .maybeSingle();

        if (createError) throw createError;
        currentCart = newCart;
        console.log("4. New cart created:", newCart);
      }

      setCart(currentCart);

      // First get all cart items WITHOUT any joins
      console.log("5. Fetching cart items for cart:", currentCart.id);
      const { data: itemsData, error: itemsError } = await supabase
        .from("cart_items")
        .select(
          `
        id,
        cart_id,
        post_id,
        menu_item_id,
        quantity,
        unit_price,
        total_price,
        special_instructions,
        created_at
      `,
        )
        .eq("cart_id", currentCart.id)
        .order("created_at", { ascending: true });

      if (itemsError) throw itemsError;
      console.log("6. Cart items count:", itemsData?.length);
      console.log("7. Sample item:", itemsData?.[0]);

      // Then fetch details for each item type separately
      console.log("8. Starting to fetch details for each item");
      const transformedItems = await Promise.all(
        (itemsData || []).map(async (item: any, index: number) => {
          console.log(
            `9. Processing item ${index + 1}:`,
            item.id,
            "post_id:",
            item.post_id,
            "menu_item_id:",
            item.menu_item_id,
          );

          // If it's a post item
          if (item.post_id) {
            console.log(`10. Fetching post details for: ${item.post_id}`);
            const { data: postData, error: postError } = await supabase
              .from("posts")
              .select(
                `
              title,
              image_url,
              discounted_price,
              original_price,
              restaurant_id,
              restaurants!inner (
  restaurant_name,
  restaurant_rating,
  delivery_fee
)
            `,
              )
              .eq("id", item.post_id)
              .maybeSingle();

            if (postError) {
              console.error("11. Post error:", postError);
            }

            if (postData) {
              console.log("12. Post data found:", postData.title);
              return {
                id: item.id,
                post_id: item.post_id,
                name: postData.title || "Item",
                restaurant:
                  postData.restaurants?.restaurant_name || "Restaurant",
                price:
                  postData.discounted_price || postData.original_price || 0,
                quantity: item.quantity,
                image:
                  postData.image_url ||
                  "https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=100&h=100&fit=crop",
                unit_price: item.unit_price,
                total_price: item.total_price,
                restaurant_rating:
                  postData.restaurants?.restaurant_rating || 4.0,
                delivery_fee: postData.restaurants?.delivery_fee || 0,
              };
            }
          }
          // If it's a menu item
          else if (item.menu_item_id) {
            console.log(
              `13. Fetching menu item details for: ${item.menu_item_id}`,
            );
            const { data: menuData, error: menuError } = await supabase
              .from("menu_items")
              .select(
                `
              name,
              image_url,
              price,
              restaurant_id,
              restaurants!inner (
  restaurant_name,
  restaurant_rating,
  delivery_fee
)
            `,
              )
              .eq("id", item.menu_item_id)
              .maybeSingle();

            if (menuError) {
              console.error("14. Menu error:", menuError);
            }

            if (menuData) {
              console.log("15. Menu data found:", menuData.name);
              return {
                id: item.id,
                menu_item_id: item.menu_item_id,
                name: menuData.name || "Item",
                restaurant:
                  menuData.restaurants?.restaurant_name || "Restaurant",
                price: menuData.price || 0,
                quantity: item.quantity,
                image:
                  menuData.image_url ||
                  "https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=100&h=100&fit=crop",
                unit_price: item.unit_price,
                total_price: item.total_price,
                restaurant_rating:
                  menuData.restaurants?.restaurant_rating || 4.0,
                delivery_fee: menuData.restaurants?.delivery_fee || 0,
              };
            }
          }
          console.log("16. No data found for item:", item.id);
          return null;
        }),
      );

      console.log("17. Transformed items count:", transformedItems.length);
      const filteredItems = transformedItems.filter((item) => item !== null);
      console.log("18. Filtered items count:", filteredItems.length);

      setCartItems(filteredItems);
    } catch (error: any) {
      console.error("19. Error in fetchCart:", error);
      console.error("20. Error code:", error.code);
      console.error("21. Error message:", error.message);
      console.error("22. Error details:", error.details);

      if (error.code !== "PGRST116" && !error.message?.includes("cart_items")) {
        Alert.alert("Error", "Failed to load cart items");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      console.log("23. fetchCart completed");
    }
  }, [user?.id]);

  // Setup real-time subscription for cart updates
  const setupRealtimeSubscription = useCallback(() => {
    if (!user?.id || !cart?.id) return;

    // Clean up existing subscription
    if (subscriptionRef.current) {
      supabase.removeChannel(subscriptionRef.current);
    }

    // Subscribe to cart_items changes for this specific cart
    subscriptionRef.current = supabase
      .channel(`cart_changes_${cart.id}`)
      .on(
        "postgres_changes",
        {
          event: "*", // Listen to all events (INSERT, UPDATE, DELETE)
          schema: "public",
          table: "cart_items",
          filter: `cart_id=eq.${cart.id}`,
        },
        (payload) => {
          console.log("Cart change detected:", payload);

          // Refresh cart data when changes occur
          fetchCart();
        },
      )
      .subscribe();

    // Also subscribe to cart updates
    const cartSubscription = supabase
      .channel(`cart_updates_${cart.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "carts",
          filter: `id=eq.${cart.id}`,
        },
        (payload) => {
          console.log("Cart updated:", payload);
          // Update cart data
          if (payload.new) {
            setCart(payload.new);
          }
        },
      )
      .subscribe();

    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
      }
      supabase.removeChannel(cartSubscription);
    };
  }, [user?.id, cart?.id, fetchCart]);

  useEffect(() => {
    if (user?.id) {
      fetchCart();
    } else {
      setCartItems([]);
      setLoading(false);
    }
  }, [user?.id, fetchCart]);

  useEffect(() => {
    const cleanup = setupRealtimeSubscription();
    return cleanup;
  }, [setupRealtimeSubscription]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchCart();
  }, [fetchCart]);

  const updateQuantity = async (itemId: string, newQuantity: number) => {
    if (newQuantity < 1) {
      // Remove item if quantity is 0
      await removeItem(itemId);
      return;
    }

    try {
      // Update quantity in database
      const { error } = await supabase
        .from("cart_items")
        .update({
          quantity: newQuantity,
          total_price:
            cartItems.find((item) => item.id === itemId)?.unit_price *
            newQuantity,
        })
        .eq("id", itemId);

      if (error) throw error;

      // Update local state immediately for better UX
      setCartItems((prevItems) =>
        prevItems.map((item) =>
          item.id === itemId ? { ...item, quantity: newQuantity } : item,
        ),
      );
    } catch (error) {
      console.error("Error updating quantity:", error);
      Alert.alert("Error", "Failed to update quantity");
      // Revert optimistic update
      fetchCart();
    }
  };

  const removeItem = async (itemId: string) => {
    try {
      const { error } = await supabase
        .from("cart_items")
        .delete()
        .eq("id", itemId);

      if (error) throw error;

      // Update local state immediately for better UX
      setCartItems((prevItems) =>
        prevItems.filter((item) => item.id !== itemId),
      );
    } catch (error) {
      console.error("Error removing item:", error);
      Alert.alert("Error", "Failed to remove item");
      // Revert optimistic update
      fetchCart();
    }
  };

  const clearCart = async () => {
    if (!cart?.id) return;

    Alert.alert(
      "Clear Cart",
      "Are you sure you want to clear all items from your cart?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear All",
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await supabase
                .from("cart_items")
                .delete()
                .eq("cart_id", cart.id);

              if (error) throw error;

              setCartItems([]);
              Alert.alert("Success", "Cart cleared successfully");
            } catch (error) {
              console.error("Error clearing cart:", error);
              Alert.alert("Error", "Failed to clear cart");
            }
          },
        },
      ],
    );
  };

  // Calculate totals
  const subtotal = cartItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );

  // Use restaurant delivery fee or default
  const deliveryFee =
    cartItems.length > 0 ? cartItems[0]?.delivery_fee || 5.0 : 5.0;

  const tax = subtotal * 0.05;
  const total = subtotal + deliveryFee + tax;

  // Function to handle adding item from other screens
  const handleAddItemFromOutside = useCallback(() => {
    console.log("Refreshing cart from external source...");
    setRefreshing(true);
    fetchCart();
  }, [fetchCart]);

  // Export function for other screens to call
  useEffect(() => {
    // This makes the refresh function available globally
    // Other screens can call this to refresh the cart
    (global as any).refreshCart = handleAddItemFromOutside;

    return () => {
      delete (global as any).refreshCart;
    };
  }, [handleAddItemFromOutside]);

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={styles.loadingText}>Loading cart...</Text>
      </SafeAreaView>
    );
  }

  // In the return, modify the empty state for guests
  if (!user?.id || isGuest) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <Ionicons name="chevron-back" size={20} color="#111827" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>My Cart</Text>
          </View>
        </View>

        {isGuest ? (
          <>
            <GuestProfileBanner />
            <View style={styles.guestCartContainer}>
              <Ionicons name="cart-outline" size={70} color="#D1D5DB" />
              <Text style={styles.emptyStateTitle}>Guest Cart</Text>
              <Text style={styles.emptyStateText}>
                Sign in to save your cart and checkout
              </Text>
            </View>
          </>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="log-in-outline" size={70} color="#D1D5DB" />
            <Text style={styles.emptyStateTitle}>Please Login</Text>
            <Text style={styles.emptyStateText}>
              You need to login to view your cart
            </Text>
            <TouchableOpacity
              style={styles.shopButton}
              onPress={() => router.push("/(auth)/signin")}
            >
              <Text style={styles.shopButtonText}>Login Now</Text>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={20} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Cart</Text>
        </View>
        {cartItems.length > 0 && (
          <TouchableOpacity style={styles.clearButton} onPress={clearCart}>
            <Text style={styles.clearButtonText}>Clear All</Text>
          </TouchableOpacity>
        )}
      </View>

      {cartItems.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="cart-outline" size={70} color="#D1D5DB" />
          <Text style={styles.emptyStateTitle}>Your cart is empty</Text>
          <Text style={styles.emptyStateText}>
            Add some delicious food from our restaurants
          </Text>
          <TouchableOpacity
            style={styles.shopButton}
            onPress={() => router.push("/(tabs)")}
          >
            <Text style={styles.shopButtonText}>Start Shopping</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#FF6B35"
                colors={["#FF6B35"]}
              />
            }
          >
            {/* Cart Status */}
            <View style={styles.cartStatus}>
              <View style={styles.cartStatusItem}>
                <Ionicons name="cart" size={18} color="#FF6B35" />
                <Text style={styles.cartStatusText}>
                  {cartItems.length} {cartItems.length === 1 ? "item" : "items"}{" "}
                  in cart
                </Text>
              </View>
              <View style={styles.cartStatusItem}>
                <Ionicons name="time" size={18} color="#10B981" />
                <Text style={styles.cartStatusText}>Live updates enabled</Text>
              </View>
            </View>

            {/* Cart Items */}
            <View style={styles.cartItems}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  Your Items ({cartItems.length})
                </Text>
              </View>
              {cartItems.map((item) => (
                <View key={item.id} style={styles.cartItem}>
                  <Image
                    source={{ uri: item.image }}
                    style={styles.itemImage}
                  />
                  <View style={styles.itemDetails}>
                    <Text style={styles.itemName} numberOfLines={2}>
                      {item.name}
                    </Text>
                    <View style={styles.restaurantInfo}>
                      <Text style={styles.itemRestaurant}>
                        {item.restaurant}
                      </Text>
                      <View style={styles.ratingBadge}>
                        <Ionicons name="star" size={10} color="#FFD700" />
                        <Text style={styles.ratingText}>
                          {item.restaurant_rating.toFixed(1)}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.itemPrice}>
                      AED {item.price.toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.itemActions}>
                    <View style={styles.quantityControls}>
                      <TouchableOpacity
                        style={styles.quantityButton}
                        onPress={() =>
                          updateQuantity(item.id, item.quantity - 1)
                        }
                      >
                        <Ionicons name="remove" size={16} color="#6B7280" />
                      </TouchableOpacity>
                      <Text style={styles.quantityText}>{item.quantity}</Text>
                      <TouchableOpacity
                        style={styles.quantityButton}
                        onPress={() =>
                          updateQuantity(item.id, item.quantity + 1)
                        }
                      >
                        <Ionicons name="add" size={16} color="#6B7280" />
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() => removeItem(item.id)}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={18}
                        color="#EF4444"
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>

            {/* Order Summary */}
            <View style={styles.summarySection}>
              <Text style={styles.summaryTitle}>Order Summary</Text>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>
                  Subtotal ({cartItems.length} items)
                </Text>
                <Text style={styles.summaryValue}>
                  AED {subtotal.toFixed(2)}
                </Text>
              </View>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Delivery Fee</Text>
                <Text style={styles.summaryValue}>
                  AED {deliveryFee.toFixed(2)}
                </Text>
              </View>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Tax (5%)</Text>
                <Text style={styles.summaryValue}>AED {tax.toFixed(2)}</Text>
              </View>

              <View style={styles.divider} />

              <View style={[styles.summaryRow, styles.totalRow]}>
                <Text style={styles.totalLabel}>Total Amount</Text>
                <Text style={styles.totalValue}>AED {total.toFixed(2)}</Text>
              </View>
            </View>

            {/* Delivery Info */}
            <View style={styles.infoSection}>
              <View style={styles.infoCard}>
                <View style={styles.infoIconContainer}>
                  <Ionicons name="time-outline" size={19} color="#FF6B35" />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoTitle}>Fast Delivery</Text>
                  <Text style={styles.infoText}>Delivery in 25-35 minutes</Text>
                </View>
              </View>

              <View style={styles.infoCard}>
                <View style={styles.infoIconContainer}>
                  <Ionicons
                    name="shield-checkmark-outline"
                    size={19}
                    color="#10B981"
                  />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoTitle}>Secure Payment</Text>
                  <Text style={styles.infoText}>
                    100% secure payment protection
                  </Text>
                </View>
              </View>
            </View>
          </ScrollView>

          {/* Checkout Button */}
          <View style={styles.checkoutSection}>
            <View style={styles.checkoutTotal}>
              <Text style={styles.checkoutTotalLabel}>Total:</Text>
              <Text style={styles.checkoutTotalValue}>
                AED {total.toFixed(2)}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.checkoutButton}
              onPress={() => {
                checkGuestAction(
                  "proceed to checkout",
                  () => {
                    router.push("/checkout");
                  },
                  "You need to sign in to complete your order",
                );
              }}
            >
              <Text style={styles.checkoutButtonText}>Proceed to Checkout</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    marginBottom: -22,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13, // Increased from 12
    color: "#6B7280",
    fontWeight: "500",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  backButton: {
    paddingRight: 12,
  },
  headerTitle: {
    fontSize: 17, // Increased from 16
    fontWeight: "700",
    color: "#111827",
    letterSpacing: -0.2,
  },
  clearButton: {
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 0.6,
    borderColor: "#FECACA",
  },
  clearButtonText: {
    fontSize: 13, // Increased from 12
    color: "#EF4444",
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  emptyStateTitle: {
    fontSize: 19, // Increased from 18
    fontWeight: "700",
    color: "#111827",
    marginTop: 14,
    marginBottom: 6,
    textAlign: "center",
    letterSpacing: -0.2,
  },
  emptyStateText: {
    fontSize: 14, // Increased from 13
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 20,
    fontWeight: "400",
    lineHeight: 18,
    letterSpacing: -0.2,
  },
  shopButton: {
    backgroundColor: "#FF6B35",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#FF6B35",
  },
  shopButtonText: {
    color: "#fff",
    fontSize: 15, // Increased from 14
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  cartStatus: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
    backgroundColor: "#F9FAFB",
    padding: 12,
    borderRadius: 10,
    borderWidth: 0.2,
    borderColor: "#E5E7EB",
  },
  cartStatusItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  cartStatusText: {
    fontSize: 13, // Increased from 12
    color: "#6B7280",
    fontWeight: "500",
    letterSpacing: -0.2,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15, // Increased from 14
    fontWeight: "700",
    color: "#111827",
    letterSpacing: -0.2,
  },
  cartItems: {
    marginBottom: 20,
  },
  cartItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 0.3,
    borderColor: "#E5E7EB",
  },
  itemImage: {
    width: 70,
    height: 70,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
  },
  itemDetails: {
    flex: 1,
    marginLeft: 12,
    marginRight: 12,
  },
  itemName: {
    fontSize: 13, // Increased from 12
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
    lineHeight: 16,
    letterSpacing: -0.2,
  },
  restaurantInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
    gap: 8,
  },
  itemRestaurant: {
    fontSize: 12, // Increased from 11
    color: "#6B7280",
    fontWeight: "400",
    flex: 1,
    letterSpacing: -0.2,
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFBEB",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 2,
    borderWidth: 1,
    borderColor: "#FEF3C7",
  },
  ratingText: {
    fontSize: 11, // Increased from 10
    color: "#92400E",
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  itemPrice: {
    fontSize: 13, // Increased from 12
    fontWeight: "700",
    color: "#FF6B35",
    letterSpacing: -0.2,
  },
  itemActions: {
    alignItems: "flex-end",
  },
  quantityControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 6,
  },
  quantityButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#F9FAFB",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  quantityText: {
    fontSize: 15, // Increased from 14
    fontWeight: "600",
    color: "#374151",
    minWidth: 20,
    textAlign: "center",
    letterSpacing: -0.2,
  },
  removeButton: {
    padding: 4,
  },
  summarySection: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    borderWidth: 0.2,
    borderColor: "#E5E7EB",
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 16, // Increased from 14
    fontWeight: "700",
    color: "#111827",
    marginBottom: 10,
    letterSpacing: -0.1,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 13, // Increased from 12
    color: "#6B7280",
    fontWeight: "400",
    letterSpacing: -0.2,
  },
  summaryValue: {
    fontSize: 13, // Increased from 12
    color: "#374151",
    fontWeight: "500",
    letterSpacing: -0.1,
  },
  divider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: 12,
  },
  totalRow: {
    marginTop: 4,
  },
  totalLabel: {
    fontSize: 15, // Increased from 14
    fontWeight: "700",
    color: "#111827",
    letterSpacing: -0.1,
  },
  totalValue: {
    fontSize: 16, // Increased from 16
    fontWeight: "800",
    color: "#FF6B35",
    letterSpacing: -0.2,
  },
  infoSection: {
    marginBottom: 32,
    gap: 10,
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 14,
    padding: 12,
    borderWidth: 0.2,
    borderColor: "#E5E7EB",
  },
  infoIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    borderWidth: 0.8,
    borderColor: "#E5E7EB",
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 13, // Increased from 12
    fontWeight: "700",
    color: "#111827",
    marginBottom: 2,
    letterSpacing: -0.2,
  },
  infoText: {
    fontSize: 12, // Increased from 11
    color: "#6B7280",
    fontWeight: "400",
    letterSpacing: -0.2,
    lineHeight: 16,
  },
  refreshButton: {
    padding: 8,
    backgroundColor: "#EFF6FF",
    borderRadius: 8,
  },
  checkoutSection: {
    padding: 16,
    borderTopWidth: 0.8,
    borderTopColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    top: 0,
  },
  checkoutTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  checkoutTotalLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
    letterSpacing: -0.2,
  },
  checkoutTotalValue: {
    fontSize: 16,
    fontWeight: "800",
    color: "#FF6B35",
    letterSpacing: -0.2,
  },
  checkoutButton: {
    backgroundColor: "#FF6B35",
    borderRadius: 10,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 4,
  },
  checkoutButtonText: {
    color: "#fff",
    fontSize: 15, // Increased from 14
    fontWeight: "700",
    letterSpacing: -0.2,
  },

  guestCartContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    marginTop: -50,
  },
});
