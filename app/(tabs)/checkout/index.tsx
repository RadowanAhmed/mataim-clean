// app/checkout/index.tsx
import { useAuth } from "@/backend/AuthContext";
import { NotificationService } from "@/backend/services/notificationService";
import { supabase } from "@/backend/supabase";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function CheckoutScreen() {
  const router = useRouter();
  const { user } = useAuth();

  // State
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Cart data
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [cart, setCart] = useState<any>(null);

  // Order data
  const [selectedAddress, setSelectedAddress] = useState<any>(null);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [orderType, setOrderType] = useState("delivery");
  const [showAddressForm, setShowAddressForm] = useState(false);

  // New address form
  const [newAddress, setNewAddress] = useState({
    label: "Home",
    address_line1: "",
    address_line2: "",
    city: "Dubai",
    country: "UAE",
    postal_code: "",
  });

  // Order summary
  const [orderSummary, setOrderSummary] = useState({
    subtotal: 0,
    deliveryFee: 5,
    tax: 0,
    total: 0,
  });

  // Fetch cart data and addresses
  useEffect(() => {
    if (user?.id) {
      fetchCartData();
      fetchAddresses();
    }
  }, [user?.id]);

  const fetchCartData = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);

      // Get active cart
      const { data: cartData, error: cartError } = await supabase
        .from("carts")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();

      if (cartError) throw cartError;

      if (!cartData) {
        setCartItems([]);
        setLoading(false);
        return;
      }

      setCart(cartData);

      // Fetch cart items with details
      const { data: itemsData, error: itemsError } = await supabase
        .from("cart_items")
        .select(
          `
          *,
          posts!inner (
            id,
            title,
            description,
            image_url,
            restaurant_id,
            discounted_price,
            original_price,
            restaurants!inner (
              restaurant_name,
              restaurant_rating,
              delivery_fee,
              min_order_amount
            )
          )
        `,
        )
        .eq("cart_id", cartData.id)
        .order("created_at", { ascending: true });

      if (itemsError) throw itemsError;

      const transformedItems = (itemsData || []).map((item) => ({
        id: item.id,
        post_id: item.post_id,
        name: item.posts?.title || "Item",
        restaurant: item.posts?.restaurants?.restaurant_name || "Restaurant",
        restaurant_id: item.posts?.restaurant_id,
        price: item.posts?.discounted_price || item.posts?.original_price || 0,
        quantity: item.quantity,
        image:
          item.posts?.image_url ||
          "https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=100&h=100&fit=crop",
        unit_price: item.unit_price,
        total_price: item.total_price,
        delivery_fee: item.posts?.restaurants?.delivery_fee || 5,
      }));

      setCartItems(transformedItems);

      // Update order summary
      if (transformedItems.length > 0) {
        const subtotal = transformedItems.reduce(
          (sum, item) => sum + item.price * item.quantity,
          0,
        );
        const deliveryFee = transformedItems[0]?.delivery_fee || 5;
        const tax = subtotal * 0.05;
        const total = subtotal + deliveryFee + tax;

        setOrderSummary({
          subtotal,
          deliveryFee,
          tax,
          total,
        });
      }
    } catch (error) {
      console.error("Error fetching cart:", error);
      Alert.alert("Error", "Failed to load cart items");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchAddresses = async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from("addresses")
        .select("*")
        .eq("user_id", user.id)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;

      setAddresses(data || []);

      // Set default address if exists
      const defaultAddress = data?.find((addr) => addr.is_default);
      if (defaultAddress) {
        setSelectedAddress(defaultAddress);
      }
    } catch (error) {
      console.error("Error fetching addresses:", error);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    Promise.all([fetchCartData(), fetchAddresses()]);
  };

  const saveNewAddress = async () => {
    if (!newAddress.address_line1.trim()) {
      Alert.alert("Error", "Please enter address line 1");
      return;
    }

    try {
      const addressToSave = {
        user_id: user?.id,
        label: newAddress.label,
        address_line1: newAddress.address_line1,
        address_line2: newAddress.address_line2,
        city: newAddress.city,
        country: newAddress.country,
        postal_code: newAddress.postal_code,
        is_default: addresses.length === 0, // First address is default
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("addresses")
        .insert([addressToSave])
        .select()
        .single();

      if (error) throw error;

      setAddresses([data, ...addresses]);
      setSelectedAddress(data);
      setShowAddressForm(false);
      setNewAddress({
        label: "Home",
        address_line1: "",
        address_line2: "",
        city: "Dubai",
        country: "UAE",
        postal_code: "",
      });

      Alert.alert("Success", "Address saved successfully");
    } catch (error) {
      console.error("Error saving address:", error);
      Alert.alert("Error", "Failed to save address");
    }
  };

  const handlePlaceOrder = async () => {
    if (!user?.id) {
      Alert.alert("Login Required", "Please login to place an order");
      router.push("/(auth)/signin");
      return;
    }

    if (cartItems.length === 0) {
      Alert.alert("Empty Cart", "Your cart is empty");
      return;
    }

    if (orderType === "delivery" && !selectedAddress) {
      Alert.alert("Address Required", "Please select a delivery address");
      return;
    }

    try {
      setSubmitting(true);

      // Get unique restaurant from cart items (assuming all items from same restaurant)
      const restaurantId = cartItems[0]?.restaurant_id;

      if (!restaurantId) {
        throw new Error("Restaurant information missing");
      }

      // Create the order
      const orderData = {
        customer_id: user.id,
        restaurant_id: restaurantId,
        status: "pending",
        total_amount: orderSummary.subtotal,
        delivery_fee: orderType === "delivery" ? orderSummary.deliveryFee : 0,
        tax_amount: orderSummary.tax,
        discount_amount: 0,
        final_amount: orderSummary.total,
        payment_method: paymentMethod,
        payment_status: paymentMethod === "cash" ? "pending" : "completed",
        delivery_address:
          orderType === "delivery" ? JSON.stringify(selectedAddress) : null,
        special_instructions: specialInstructions,
        estimated_delivery_time: new Date(
          Date.now() + 45 * 60000,
        ).toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert([orderData])
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items
      const orderItems = cartItems.map((item) => ({
        order_id: order.id,
        post_id: item.post_id,
        quantity: item.quantity,
        unit_price: item.price,
        special_instructions: "",
      }));

      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(orderItems);

      if (itemsError) throw itemsError;

      // Clear cart
      await supabase.from("cart_items").delete().eq("cart_id", cart.id);

      await supabase
        .from("carts")
        .update({ status: "completed" })
        .eq("id", cart.id);

      // Send notification
      await NotificationService.sendOrderNotification(order.id, "pending", {
        title: cartItems[0]?.name,
        image_url: cartItems[0]?.image,
        restaurant_name: cartItems[0]?.restaurant,
      });

      // Show success
      Alert.alert(
        "Order Placed Successfully!",
        `Your order #${order.order_number || order.id.slice(0, 8)} has been placed.`,
        [
          {
            text: "Track Order",
            onPress: () => router.push(`/orders/${order.id}`),
          },
          {
            text: "Continue Shopping",
            onPress: () => router.push("/(tabs)"),
          },
        ],
      );
    } catch (error: any) {
      console.error("Error placing order:", error);
      Alert.alert("Error", error.message || "Failed to place order");
    } finally {
      setSubmitting(false);
    }
  };

  const updateQuantity = async (itemId: string, newQuantity: number) => {
    if (newQuantity < 1) return;

    try {
      const { error } = await supabase
        .from("cart_items")
        .update({
          quantity: newQuantity,
          total_price:
            cartItems.find((item) => item.id === itemId)?.price * newQuantity,
        })
        .eq("id", itemId);

      if (error) throw error;

      // Update local state
      const updatedItems = cartItems.map((item) =>
        item.id === itemId ? { ...item, quantity: newQuantity } : item,
      );
      setCartItems(updatedItems);

      // Recalculate summary
      const subtotal = updatedItems.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0,
      );
      const deliveryFee = updatedItems[0]?.delivery_fee || 5;
      const tax = subtotal * 0.05;
      const total = subtotal + deliveryFee + tax;

      setOrderSummary({ subtotal, deliveryFee, tax, total });
    } catch (error) {
      console.error("Error updating quantity:", error);
    }
  };

  const removeItem = async (itemId: string) => {
    try {
      const { error } = await supabase
        .from("cart_items")
        .delete()
        .eq("id", itemId);

      if (error) throw error;

      const updatedItems = cartItems.filter((item) => item.id !== itemId);
      setCartItems(updatedItems);

      if (updatedItems.length === 0) {
        // Cart is empty
        setOrderSummary({ subtotal: 0, deliveryFee: 0, tax: 0, total: 0 });
      } else {
        // Recalculate summary
        const subtotal = updatedItems.reduce(
          (sum, item) => sum + item.price * item.quantity,
          0,
        );
        const deliveryFee = updatedItems[0]?.delivery_fee || 5;
        const tax = subtotal * 0.05;
        const total = subtotal + deliveryFee + tax;

        setOrderSummary({ subtotal, deliveryFee, tax, total });
      }
    } catch (error) {
      console.error("Error removing item:", error);
    }
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={styles.loadingText}>Loading checkout...</Text>
      </SafeAreaView>
    );
  }

  if (cartItems.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Checkout</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.emptyState}>
          <Ionicons name="cart-outline" size={70} color="#D1D5DB" />
          <Text style={styles.emptyStateTitle}>Your cart is empty</Text>
          <Text style={styles.emptyStateText}>
            Add items to your cart before checkout
          </Text>
          <TouchableOpacity
            style={styles.shopButton}
            onPress={() => router.push("/(tabs)")}
          >
            <Text style={styles.shopButtonText}>Browse Restaurants</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Checkout</Text>
        <TouchableOpacity onPress={onRefresh}>
          <Ionicons
            name="refresh"
            size={22}
            color="#FF6B35"
            style={refreshing ? styles.refreshRotating : undefined}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Restaurant Info */}
        <View style={styles.restaurantCard}>
          <Image
            source={{ uri: cartItems[0]?.image }}
            style={styles.restaurantImage}
          />
          <View style={styles.restaurantInfo}>
            <Text style={styles.restaurantName}>
              {cartItems[0]?.restaurant}
            </Text>
            <View style={styles.ratingContainer}>
              <Ionicons name="star" size={14} color="#FFD700" />
              <Text style={styles.ratingText}>4.5</Text>
              <Text style={styles.dot}>•</Text>
              <Text style={styles.minOrder}>
                Min AED {cartItems[0]?.min_order || 25}
              </Text>
            </View>
          </View>
        </View>

        {/* Order Type */}
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
              <Text style={styles.deliveryFeeBadge}>
                AED {orderSummary.deliveryFee}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.orderTypeButton,
                orderType === "pickup" && styles.orderTypeButtonActive,
              ]}
              onPress={() => {
                setOrderType("pickup");
                setOrderSummary((prev) => ({
                  ...prev,
                  deliveryFee: 0,
                  total: prev.subtotal + prev.tax,
                }));
              }}
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
              <Text style={styles.freeBadge}>Free</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Delivery Address */}
        {orderType === "delivery" && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Delivery Address</Text>
              <TouchableOpacity
                onPress={() => setShowAddressForm(!showAddressForm)}
              >
                <Text style={styles.addText}>
                  {showAddressForm ? "Cancel" : "+ Add New"}
                </Text>
              </TouchableOpacity>
            </View>

            {showAddressForm ? (
              <View style={styles.addressForm}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Label</Text>
                  <View style={styles.labelOptions}>
                    {["Home", "Work", "Other"].map((label) => (
                      <TouchableOpacity
                        key={label}
                        style={[
                          styles.labelOption,
                          newAddress.label === label &&
                            styles.labelOptionActive,
                        ]}
                        onPress={() => setNewAddress({ ...newAddress, label })}
                      >
                        <Text
                          style={[
                            styles.labelOptionText,
                            newAddress.label === label &&
                              styles.labelOptionTextActive,
                          ]}
                        >
                          {label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Address Line 1</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Building, street, area"
                    placeholderTextColor="#9CA3AF"
                    value={newAddress.address_line1}
                    onChangeText={(text) =>
                      setNewAddress({ ...newAddress, address_line1: text })
                    }
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>
                    Address Line 2 (Optional)
                  </Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Apartment, suite, unit"
                    placeholderTextColor="#9CA3AF"
                    value={newAddress.address_line2}
                    onChangeText={(text) =>
                      setNewAddress({ ...newAddress, address_line2: text })
                    }
                  />
                </View>

                <View style={styles.row}>
                  <View
                    style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}
                  >
                    <Text style={styles.inputLabel}>City</Text>
                    <TextInput
                      style={styles.input}
                      value={newAddress.city}
                      onChangeText={(text) =>
                        setNewAddress({ ...newAddress, city: text })
                      }
                    />
                  </View>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.inputLabel}>Postal Code</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Optional"
                      placeholderTextColor="#9CA3AF"
                      value={newAddress.postal_code}
                      onChangeText={(text) =>
                        setNewAddress({ ...newAddress, postal_code: text })
                      }
                    />
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.saveAddressButton}
                  onPress={saveNewAddress}
                >
                  <Text style={styles.saveAddressButtonText}>Save Address</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {addresses.length > 0 ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.addressesContainer}
                  >
                    {addresses.map((address) => (
                      <TouchableOpacity
                        key={address.id}
                        style={[
                          styles.addressCard,
                          selectedAddress?.id === address.id &&
                            styles.addressCardActive,
                        ]}
                        onPress={() => setSelectedAddress(address)}
                      >
                        <View style={styles.addressHeader}>
                          <Text style={styles.addressLabel}>
                            {address.label}
                          </Text>
                          {address.is_default && (
                            <View style={styles.defaultBadge}>
                              <Text style={styles.defaultBadgeText}>
                                Default
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.addressLine1} numberOfLines={1}>
                          {address.address_line1}
                        </Text>
                        {address.address_line2 ? (
                          <Text style={styles.addressLine2} numberOfLines={1}>
                            {address.address_line2}
                          </Text>
                        ) : null}
                        <Text style={styles.addressCity}>
                          {address.city}, {address.country}
                        </Text>
                        {selectedAddress?.id === address.id && (
                          <View style={styles.selectedIndicator}>
                            <Ionicons
                              name="checkmark-circle"
                              size={20}
                              color="#FF6B35"
                            />
                          </View>
                        )}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                ) : (
                  <TouchableOpacity
                    style={styles.noAddressCard}
                    onPress={() => setShowAddressForm(true)}
                  >
                    <Ionicons
                      name="add-circle-outline"
                      size={40}
                      color="#D1D5DB"
                    />
                    <Text style={styles.noAddressText}>
                      Add a delivery address
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        )}

        {/* Order Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Order Items ({cartItems.length})
          </Text>
          {cartItems.map((item) => (
            <View key={item.id} style={styles.orderItem}>
              <Image source={{ uri: item.image }} style={styles.itemImage} />
              <View style={styles.itemDetails}>
                <Text style={styles.itemName} numberOfLines={2}>
                  {item.name}
                </Text>
                <Text style={styles.itemPrice}>
                  AED {item.price.toFixed(2)}
                </Text>
              </View>
              <View style={styles.itemControls}>
                <TouchableOpacity
                  style={styles.quantityButton}
                  onPress={() => updateQuantity(item.id, item.quantity - 1)}
                >
                  <Ionicons name="remove" size={16} color="#6B7280" />
                </TouchableOpacity>
                <Text style={styles.quantityText}>{item.quantity}</Text>
                <TouchableOpacity
                  style={styles.quantityButton}
                  onPress={() => updateQuantity(item.id, item.quantity + 1)}
                >
                  <Ionicons name="add" size={16} color="#6B7280" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => removeItem(item.id)}
                >
                  <Ionicons name="trash-outline" size={16} color="#EF4444" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        {/* Special Instructions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Special Instructions</Text>
          <TextInput
            style={styles.instructionsInput}
            placeholder="Add any special requests or instructions..."
            placeholderTextColor="#9CA3AF"
            value={specialInstructions}
            onChangeText={setSpecialInstructions}
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Payment Method */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Method</Text>
          <TouchableOpacity
            style={[
              styles.paymentOption,
              paymentMethod === "cash" && styles.paymentOptionActive,
            ]}
            onPress={() => setPaymentMethod("cash")}
          >
            <View style={styles.paymentOptionLeft}>
              <Ionicons
                name="cash-outline"
                size={22}
                color={paymentMethod === "cash" ? "#FF6B35" : "#6B7280"}
              />
              <Text
                style={[
                  styles.paymentOptionText,
                  paymentMethod === "cash" && styles.paymentOptionTextActive,
                ]}
              >
                Cash on Delivery
              </Text>
            </View>
            {paymentMethod === "cash" && (
              <Ionicons name="checkmark-circle" size={22} color="#FF6B35" />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.paymentOption,
              paymentMethod === "card" && styles.paymentOptionActive,
            ]}
            onPress={() => setPaymentMethod("card")}
          >
            <View style={styles.paymentOptionLeft}>
              <Ionicons
                name="card-outline"
                size={22}
                color={paymentMethod === "card" ? "#FF6B35" : "#6B7280"}
              />
              <Text
                style={[
                  styles.paymentOptionText,
                  paymentMethod === "card" && styles.paymentOptionTextActive,
                ]}
              >
                Credit / Debit Card
              </Text>
            </View>
            {paymentMethod === "card" && (
              <Ionicons name="checkmark-circle" size={22} color="#FF6B35" />
            )}
          </TouchableOpacity>
        </View>

        {/* Order Summary */}
        <View style={styles.summarySection}>
          <Text style={styles.summaryTitle}>Order Summary</Text>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>
              AED {orderSummary.subtotal.toFixed(2)}
            </Text>
          </View>

          {orderType === "delivery" && (
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

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Place Order Button */}
      <View style={styles.footer}>
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
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  refreshRotating: {
    transform: [{ rotate: "180deg" }],
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
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 24,
  },
  shopButton: {
    backgroundColor: "#FF6B35",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  shopButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  restaurantCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  restaurantImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
  },
  restaurantInfo: {
    flex: 1,
    marginLeft: 12,
  },
  restaurantName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  ratingText: {
    fontSize: 13,
    color: "#374151",
    marginLeft: 4,
  },
  dot: {
    fontSize: 13,
    color: "#9CA3AF",
    marginHorizontal: 4,
  },
  minOrder: {
    fontSize: 13,
    color: "#6B7280",
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
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
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
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    paddingVertical: 12,
    gap: 6,
  },
  orderTypeButtonActive: {
    backgroundColor: "#FF6B3510",
    borderColor: "#FF6B35",
  },
  orderTypeText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
  },
  orderTypeTextActive: {
    color: "#FF6B35",
  },
  deliveryFeeBadge: {
    fontSize: 12,
    color: "#6B7280",
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  freeBadge: {
    fontSize: 12,
    color: "#10B981",
    backgroundColor: "#10B98110",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  addressesContainer: {
    paddingRight: 16,
  },
  addressCard: {
    width: 200,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    padding: 12,
    marginRight: 12,
  },
  addressCardActive: {
    borderColor: "#FF6B35",
    backgroundColor: "#FF6B3510",
  },
  addressHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  addressLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#111827",
  },
  defaultBadge: {
    backgroundColor: "#E5E7EB",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  defaultBadgeText: {
    fontSize: 10,
    color: "#6B7280",
  },
  addressLine1: {
    fontSize: 13,
    color: "#374151",
    marginBottom: 2,
  },
  addressLine2: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 2,
  },
  addressCity: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  selectedIndicator: {
    position: "absolute",
    top: 8,
    right: 8,
  },
  noAddressCard: {
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    borderWidth: 2,
    borderColor: "#E5E7EB",
    borderStyle: "dashed",
    borderRadius: 8,
  },
  noAddressText: {
    marginTop: 8,
    fontSize: 14,
    color: "#6B7280",
  },
  addressForm: {
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    padding: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 6,
  },
  labelOptions: {
    flexDirection: "row",
    gap: 8,
  },
  labelOption: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 6,
  },
  labelOptionActive: {
    backgroundColor: "#FF6B35",
    borderColor: "#FF6B35",
  },
  labelOptionText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#6B7280",
  },
  labelOptionTextActive: {
    color: "#FFFFFF",
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#111827",
  },
  row: {
    flexDirection: "row",
    marginBottom: 16,
  },
  saveAddressButton: {
    backgroundColor: "#FF6B35",
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: "center",
  },
  saveAddressButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  orderItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  itemImage: {
    width: 50,
    height: 50,
    borderRadius: 6,
    backgroundColor: "#F3F4F6",
  },
  itemDetails: {
    flex: 1,
    marginLeft: 12,
  },
  itemName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FF6B35",
  },
  itemControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  quantityButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  quantityText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    minWidth: 24,
    textAlign: "center",
  },
  removeButton: {
    padding: 6,
  },
  instructionsInput: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: "#111827",
    textAlignVertical: "top",
    minHeight: 80,
  },
  paymentOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  paymentOptionActive: {
    backgroundColor: "#FF6B3510",
    borderColor: "#FF6B35",
  },
  paymentOptionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  paymentOptionText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
  },
  paymentOptionTextActive: {
    color: "#FF6B35",
  },
  summarySection: {
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
  },
  summaryTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: "#6B7280",
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingTop: 12,
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
  bottomSpacer: {
    height: 100,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    padding: 16,
  },
  placeOrderButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FF6B35",
    borderRadius: 8,
    paddingVertical: 16,
    gap: 8,
  },
  placeOrderButtonDisabled: {
    backgroundColor: "#FF6B3580",
  },
  placeOrderButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  addText: {
    fontSize: 14,
    color: "#FF6B35",
    fontWeight: "600",
  },
});
