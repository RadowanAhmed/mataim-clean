// orders/create.tsx - Save address only when order is completed
import { useAuth } from "@/backend/AuthContext";
import { NotificationService } from "@/backend/services/notificationService";
import { supabase } from "@/backend/supabase";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function CreateOrderScreen() {
  const router = useRouter();
  const { restaurantId, postId, addressData } = useLocalSearchParams();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [restaurant, setRestaurant] = useState<any>(null);
  const [post, setPost] = useState<any>(null);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<any>(null);
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [orderType, setOrderType] = useState("delivery");

  // Order summary
  const [orderSummary, setOrderSummary] = useState({
    subtotal: 0,
    deliveryFee: 0,
    tax: 0,
    discount: 0,
    total: 0,
  });

  // Parse address data from params
  useEffect(() => {
    if (addressData) {
      try {
        const parsedAddress = JSON.parse(addressData as string);
        setSelectedAddress(parsedAddress);
      } catch (error) {
        console.error("Error parsing address data:", error);
      }
    }

    fetchInitialData();
  }, [restaurantId, postId, addressData]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);

      // Fetch restaurant data
      const { data: restaurantData } = await supabase
        .from("restaurants")
        .select("*")
        .eq("id", restaurantId)
        .single();

      if (restaurantData) {
        setRestaurant(restaurantData);
        setOrderSummary((prev) => ({
          ...prev,
          deliveryFee: restaurantData.delivery_fee || 5,
        }));
      }

      // Fetch post data if available
      if (postId) {
        const { data: postData } = await supabase
          .from("posts")
          .select("*")
          .eq("id", postId)
          .single();

        if (postData) {
          setPost(postData);
          // Add post to cart automatically
          addPostToCart(postData);
        }
      }

      // Fetch menu items
      const { data: menuData } = await supabase
        .from("menu_items")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .eq("is_available", true)
        .order("category");

      if (menuData) {
        setMenuItems(menuData);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      Alert.alert("Error", "Failed to load restaurant data");
    } finally {
      setLoading(false);
    }
  };

  const addPostToCart = (postData: any) => {
    const cartItem = {
      id: postData.id,
      name: postData.title,
      description: postData.description,
      price: postData.discounted_price || postData.original_price,
      original_price: postData.original_price,
      discount_percentage: postData.discount_percentage,
      image_url: postData.image_url,
      type: "post",
      quantity: 1,
    };

    setCartItems([cartItem]);
    calculateOrderSummary([cartItem]);
  };

  const addMenuItemToCart = (item: any) => {
    const existingItemIndex = cartItems.findIndex(
      (cartItem) => cartItem.id === item.id && cartItem.type === "menu",
    );

    let newCartItems;
    if (existingItemIndex > -1) {
      newCartItems = [...cartItems];
      newCartItems[existingItemIndex].quantity += 1;
    } else {
      const cartItem = {
        id: item.id,
        name: item.name,
        description: item.description,
        price: item.price,
        image_url: item.image_url,
        type: "menu",
        quantity: 1,
      };
      newCartItems = [...cartItems, cartItem];
    }

    setCartItems(newCartItems);
    calculateOrderSummary(newCartItems);
  };

  const updateCartItemQuantity = (
    itemId: string,
    type: string,
    change: number,
  ) => {
    const newCartItems = cartItems
      .map((item) => {
        if (item.id === itemId && item.type === type) {
          const newQuantity = Math.max(1, item.quantity + change);
          return { ...item, quantity: newQuantity };
        }
        return item;
      })
      .filter((item) => item.quantity > 0);

    setCartItems(newCartItems);
    calculateOrderSummary(newCartItems);
  };

  const removeCartItem = (itemId: string, type: string) => {
    const newCartItems = cartItems.filter(
      (item) => !(item.id === itemId && item.type === type),
    );
    setCartItems(newCartItems);
    calculateOrderSummary(newCartItems);
  };

  const calculateOrderSummary = (items: any[]) => {
    const subtotal = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
    const deliveryFee =
      orderType === "delivery" ? restaurant?.delivery_fee || 5 : 0;
    const tax = subtotal * 0.05; // 5% VAT
    const discount = 0; // Could be calculated from promotions
    const total = subtotal + deliveryFee + tax - discount;

    setOrderSummary({
      subtotal,
      deliveryFee,
      tax,
      discount,
      total,
    });
  };

  // Function to save address to addresses table
  const saveAddressToDatabase = async (addressData: any) => {
    try {
      const addressToSave = {
        user_id: user?.id,
        label: addressData.label || "Delivery Address",
        address_line1: addressData.address_line1,
        address_line2: addressData.address_line2 || "",
        city: addressData.city,
        state: addressData.state || "",
        country: addressData.country || "UAE",
        postal_code: addressData.postal_code || "",
        latitude: addressData.latitude,
        longitude: addressData.longitude,
        is_default: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("addresses")
        .insert([addressToSave])
        .select()
        .single();

      if (error) throw error;
      return data.id; // Return the saved address ID
    } catch (error) {
      console.error("Error saving address:", error);
      return null;
    }
  };

  const handlePlaceOrder = async () => {
    if (!user?.id) {
      Alert.alert("Login Required", "Please login to place an order");
      router.push("/(auth)/signin");
      return;
    }

    if (cartItems.length === 0) {
      Alert.alert("Empty Cart", "Please add items to your cart");
      return;
    }

    if (orderType === "delivery" && !selectedAddress) {
      Alert.alert("Address Required", "Please select a delivery address");
      return;
    }

    try {
      setSubmitting(true);

      // Save address to addresses table (only for delivery orders)
      let savedAddressId = null;
      if (orderType === "delivery" && selectedAddress) {
        savedAddressId = await saveAddressToDatabase(selectedAddress);
        if (!savedAddressId) {
          console.warn("Could not save address, but order will proceed");
        }
      }

      // Create the order
      const orderData = {
        customer_id: user.id,
        restaurant_id: restaurantId,
        post_id: postId || null,
        status: "pending",
        total_amount: orderSummary.subtotal,
        delivery_fee: orderSummary.deliveryFee,
        tax_amount: orderSummary.tax,
        discount_amount: orderSummary.discount,
        final_amount: orderSummary.total,
        payment_method: paymentMethod,
        payment_status: paymentMethod === "cash" ? "pending" : "completed",
        delivery_address:
          orderType === "delivery"
            ? JSON.stringify({
                ...selectedAddress,
                saved_address_id: savedAddressId,
              })
            : null,
        special_instructions: specialInstructions,
        estimated_delivery_time: new Date(
          Date.now() + 45 * 60000,
        ).toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Create the order
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert([orderData])
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items
      const orderItems = cartItems.map((item) => ({
        order_id: order.id,
        menu_item_id: item.type === "menu" ? item.id : null,
        post_id: item.type === "post" ? item.id : null,
        quantity: item.quantity,
        unit_price: item.price,
        special_instructions: "",
      }));

      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(orderItems);

      if (itemsError) throw itemsError;

      const postData = {
        id: post?.id,
        title: post?.title,
        image_url: post?.image_url,
        restaurant_name: restaurant?.restaurant_name,
      };

      // Send notifications
      await NotificationService.sendOrderNotification(
        order.id,
        "pending",
        postData,
      );

      // Send welcome message to new customers (optional)
      if (
        user?.created_at &&
        new Date(user.created_at).getTime() > Date.now() - 86400000
      ) {
        await NotificationService.sendWelcomeNotification(
          user.id,
          user.full_name || "User",
          user.user_type || "customer",
        );
      }

      // Show success message
      Alert.alert(
        "Order Placed Successfully!",
        `Your order #${order.order_number} has been placed.`,
        [
          {
            text: "Track Order",
            onPress: () => router.push(`/(tabs)/orders/track${order.id}`),
          },
          {
            text: "Continue",
            onPress: () => router.push("/(tabs)/orders"),
          },
        ],
      );

      // Clear cart
      setCartItems([]);
    } catch (error: any) {
      console.error("Error placing order:", error);
      Alert.alert(
        "Error",
        error.message || "Failed to place order. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const renderMenuItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.menuItem}
      onPress={() => addMenuItemToCart(item)}
    >
      <Image
        source={{
          uri: item.image_url || "https://via.placeholder.com/100",
        }}
        style={styles.menuItemImage}
      />
      <View style={styles.menuItemInfo}>
        <Text style={styles.menuItemName}>{item.name}</Text>
        <Text style={styles.menuItemDescription} numberOfLines={2}>
          {item.description}
        </Text>
        <View style={styles.menuItemFooter}>
          <Text style={styles.menuItemPrice}>AED {item.price.toFixed(2)}</Text>
          <Text style={styles.menuItemTime}>
            {item.preparation_time || "15"} min
          </Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => addMenuItemToCart(item)}
      >
        <Ionicons name="add" size={20} color="#fff" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderCartItem = ({ item }: { item: any }) => (
    <View style={styles.cartItem}>
      <Image
        source={{
          uri: item.image_url || "https://via.placeholder.com/60",
        }}
        style={styles.cartItemImage}
      />
      <View style={styles.cartItemInfo}>
        <Text style={styles.cartItemName}>{item.name}</Text>
        <Text style={styles.cartItemDescription} numberOfLines={1}>
          {item.description}
        </Text>
        <Text style={styles.cartItemPrice}>AED {item.price.toFixed(2)}</Text>
      </View>
      <View style={styles.cartItemControls}>
        <TouchableOpacity
          style={styles.quantityButton}
          onPress={() => updateCartItemQuantity(item.id, item.type, -1)}
        >
          <Ionicons name="remove" size={16} color="#FF6B35" />
        </TouchableOpacity>
        <Text style={styles.quantityText}>{item.quantity}</Text>
        <TouchableOpacity
          style={styles.quantityButton}
          onPress={() => updateCartItemQuantity(item.id, item.type, 1)}
        >
          <Ionicons name="add" size={16} color="#FF6B35" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => removeCartItem(item.id, item.type)}
        >
          <Ionicons name="trash-outline" size={16} color="#EF4444" />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={styles.loadingText}>Loading order details...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Complete Your Order</Text>
        <View style={{ width: 22 }} />
      </View>

      {/* Main Content */}
      <FlatList
        data={[1]}
        renderItem={() => (
          <View style={styles.content}>
            {/* Address Display */}
            {selectedAddress && orderType === "delivery" && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Delivery Address</Text>
                <View style={styles.addressDisplay}>
                  <View style={styles.addressIconLabel}>
                    <Ionicons name="location" size={20} color="#FF6B35" />
                    <Text style={styles.addressLabel}>
                      {selectedAddress.label}
                    </Text>
                  </View>
                  <View style={styles.addressInfo}>
                    <Text style={styles.addressText}>
                      {selectedAddress.address_line1}
                    </Text>
                    <Text style={styles.addressCity}>
                      {selectedAddress.city}, {selectedAddress.country || "UAE"}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Order Type Selection */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Order Type</Text>
              <View style={styles.orderTypeOptions}>
                <TouchableOpacity
                  style={[
                    styles.orderTypeButton,
                    orderType === "delivery" && styles.orderTypeButtonActive,
                  ]}
                  onPress={() => setOrderType("delivery")}
                >
                  <Ionicons
                    name="bicycle"
                    size={20}
                    color={orderType === "delivery" ? "#FF6B35" : "#6B7280"}
                  />
                  <Text
                    style={[
                      styles.orderTypeText,
                      orderType === "delivery" && styles.orderTypeTextActive,
                    ]}
                  >
                    Delivery
                  </Text>
                  <Text style={styles.deliveryFee}>
                    {restaurant?.delivery_fee > 0
                      ? `AED ${restaurant.delivery_fee}`
                      : "Free"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.orderTypeButton,
                    orderType === "pickup" && styles.orderTypeButtonActive,
                  ]}
                  onPress={() => setOrderType("pickup")}
                >
                  <Ionicons
                    name="walk"
                    size={20}
                    color={orderType === "pickup" ? "#FF6B35" : "#6B7280"}
                  />
                  <Text
                    style={[
                      styles.orderTypeText,
                      orderType === "pickup" && styles.orderTypeTextActive,
                    ]}
                  >
                    Pickup
                  </Text>
                  <Text style={styles.freeText}>Free</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Cart Items */}
            {cartItems.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Your Order</Text>
                <FlatList
                  data={cartItems}
                  renderItem={renderCartItem}
                  keyExtractor={(item) => `${item.type}-${item.id}`}
                  scrollEnabled={false}
                />
              </View>
            )}

            {/* Menu Items */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Add More Items</Text>
              <FlatList
                data={menuItems.slice(0, 4)} // Only show first 4 items
                renderItem={renderMenuItem}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
              />
            </View>

            {/* Special Instructions */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Special Instructions</Text>
              <TextInput
                style={styles.instructionsInput}
                placeholder="Any special requests or instructions..."
                placeholderTextColor="#9CA3AF"
                value={specialInstructions}
                onChangeText={setSpecialInstructions}
                multiline
                numberOfLines={3}
                maxLength={500}
              />
            </View>

            {/* Payment Method */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Payment Method</Text>
              <View style={styles.paymentOptions}>
                <TouchableOpacity
                  style={[
                    styles.paymentOption,
                    paymentMethod === "cash" && styles.paymentOptionActive,
                  ]}
                  onPress={() => setPaymentMethod("cash")}
                >
                  <Ionicons
                    name="cash"
                    size={20}
                    color={paymentMethod === "cash" ? "#FF6B35" : "#6B7280"}
                  />
                  <Text
                    style={[
                      styles.paymentOptionText,
                      paymentMethod === "cash" &&
                        styles.paymentOptionTextActive,
                    ]}
                  >
                    Cash on Delivery
                  </Text>
                  {paymentMethod === "cash" && (
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color="#FF6B35"
                    />
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.paymentOption,
                    paymentMethod === "card" && styles.paymentOptionActive,
                  ]}
                  onPress={() => setPaymentMethod("card")}
                >
                  <Ionicons
                    name="card"
                    size={20}
                    color={paymentMethod === "card" ? "#FF6B35" : "#6B7280"}
                  />
                  <Text
                    style={[
                      styles.paymentOptionText,
                      paymentMethod === "card" &&
                        styles.paymentOptionTextActive,
                    ]}
                  >
                    Credit/Debit Card
                  </Text>
                  {paymentMethod === "card" && (
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color="#FF6B35"
                    />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.spacer} />
          </View>
        )}
        showsVerticalScrollIndicator={false}
      />

      {/* Fixed Order Summary & Place Order Button */}
      <View style={styles.footer}>
        <View style={styles.orderSummary}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>
              AED {orderSummary.subtotal.toFixed(2)}
            </Text>
          </View>
          {orderSummary.deliveryFee > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Delivery Fee</Text>
              <Text style={styles.summaryValue}>
                AED {orderSummary.deliveryFee.toFixed(2)}
              </Text>
            </View>
          )}
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Tax (5% VAT)</Text>
            <Text style={styles.summaryValue}>
              AED {orderSummary.tax.toFixed(2)}
            </Text>
          </View>
          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>
              AED {orderSummary.total.toFixed(2)}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.placeOrderButton,
            (cartItems.length === 0 || submitting) &&
              styles.placeOrderButtonDisabled,
          ]}
          onPress={handlePlaceOrder}
          disabled={cartItems.length === 0 || submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Text style={styles.placeOrderButtonText}>
                Place Order • AED {orderSummary.total.toFixed(2)}
              </Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
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
    color: "#6B7280",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
  },
  content: {
    padding: 16,
    paddingBottom: 100,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
    lineHeight: 20,
    letterSpacing: 0.3, // Add this line
  },
  orderTypeOptions: {
    flexDirection: "row",
    gap: 12,
  },
  orderTypeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderWidth: 0.5,
    borderColor: "#6B7280",
    borderRadius: 12,
    gap: 6, // Add this line
  },
  orderTypeButtonActive: {
    backgroundColor: "#FF6B3510",
    borderColor: "#FF6B35",
  },
  orderTypeText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
    letterSpacing: 0.2, // Add this line
  },
  orderTypeTextActive: {
    color: "#FF6B35",
  },
  deliveryFee: {
    fontSize: 12,
    color: "#6B7280",
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  addressIconLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  addressDisplay: {
    gap: 6,
  },
  addressIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#FF6B35",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  addressSubLabel: {
    fontSize: 12,
    color: "#6B7280",
    letterSpacing: 0.2,
    lineHeight: 16,
  },
  addressCardButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
  },
  addressCardButtonActive: {
    backgroundColor: "#FF6B3510",
    borderColor: "#FF6B35",
  },
  addressCardButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
  },
  addressCardButtonTextActive: {
    color: "#FF6B35",
  },

  freeText: {
    fontSize: 12,
    color: "#10B981",
    backgroundColor: "#10B98110",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  addressCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  addressInfo: {
    flex: 1,
    flexDirection: "row",
    gap: 8,
  },
  addressLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 4,
  },
  defaultBadge: {
    color: "#FF6B35",
    fontSize: 12,
  },
  addressText: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 2,
  },
  addressCity: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  addAddressButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 20,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#E5E7EB",
    borderStyle: "dashed",
    borderRadius: 12,
  },
  addAddressText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FF6B35",
  },
  menuItem: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 0.1,
    borderColor: "#6B7280",
  },
  menuItemImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
  },
  menuItemInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: "space-between",
  },
  menuItemName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
    lineHeight: 18,
    letterSpacing: 0.2, // Add this line
  },
  menuItemDescription: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 8,
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
  menuItemTime: {
    fontSize: 12,
    color: "#6B7280",
  },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FF6B35",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 12,
    alignSelf: "center",
  },
  cartItem: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 0.2,
    borderColor: "#6B7280",
  },
  cartItemImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
  },
  cartItemInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: "center",
  },
  cartItemName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 2,
  },
  cartItemDescription: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 4,
  },
  cartItemPrice: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FF6B35",
  },
  cartItemControls: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 12,
    gap: 8,
  },
  quantityButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#FF6B3510",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#FF6B35",
  },
  quantityText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    minWidth: 28,
    textAlign: "center",
  },
  removeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#EF444410",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 4,
  },
  instructionsInput: {
    backgroundColor: "#fff",
    borderWidth: 0.3,
    borderColor: "#6B7280",
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: "#111827",
    textAlignVertical: "top",
    minHeight: 100,
  },
  paymentOptions: {
    gap: 8,
  },
  paymentOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
  },
  paymentOptionActive: {
    backgroundColor: "#FF6B3510",
    borderColor: "#FF6B35",
  },
  paymentOptionText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
  },
  paymentOptionTextActive: {
    color: "#FF6B35",
  },
  addText: {
    fontSize: 14,
    color: "#FF6B35",
    fontWeight: "600",
  },
  spacer: {
    height: 140,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    padding: 16,
    paddingBottom: 24,
  },
  orderSummary: {
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 13,
    color: "#6B7280",
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#111827",
  },
  discountText: {
    color: "#10B981",
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingTop: 8,
    marginTop: 4,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  totalValue: {
    fontSize: 16,
    fontWeight: "800",
    color: "#FF6B35",
  },
  placeOrderButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#FF6B35",
    paddingVertical: 16,
    borderRadius: 8,
  },
  placeOrderButtonDisabled: {
    backgroundColor: "#FF6B3580",
  },
  placeOrderButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.5,
    lineHeight: 24,
  },
});
