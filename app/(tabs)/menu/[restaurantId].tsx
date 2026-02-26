// app/menu/[restaurantId].tsx
import { useAuth } from "@/backend/AuthContext";
import { supabase } from "@/backend/supabase";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
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

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function MenuScreen() {
  const router = useRouter();
  const { restaurantId, highlightedItemId } = useLocalSearchParams();
  const { user } = useAuth();

  // State
  const [loading, setLoading] = useState(true);
  const [restaurant, setRestaurant] = useState<any>(null);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [cart, setCart] = useState<any>(null);
  const [addingToCart, setAddingToCart] = useState<string | null>(null);
  const [highlightedItem, setHighlightedItem] = useState<string | null>(
    (highlightedItemId as string) || null,
  );

  // Refs
  const scrollY = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef<FlatList>(null);
  const categoryScrollRef = useRef<FlatList>(null);

  // Fetch restaurant and menu data
  useEffect(() => {
    if (restaurantId) {
      fetchRestaurantData();
      fetchCart();
    }
  }, [restaurantId]);

  // Highlight item if provided
  useEffect(() => {
    if (highlightedItem && menuItems.length > 0) {
      // Find the index of the highlighted item
      const index = menuItems.findIndex((item) => item.id === highlightedItem);
      if (index !== -1) {
        setTimeout(() => {
          flatListRef.current?.scrollToIndex({
            index,
            animated: true,
            viewPosition: 0.3,
          });
        }, 500);
      }
    }
  }, [highlightedItem, menuItems]);

  const fetchRestaurantData = async () => {
    try {
      setLoading(true);

      // Fetch restaurant details
      const { data: restaurantData, error: restaurantError } = await supabase
        .from("restaurants")
        .select("*")
        .eq("id", restaurantId)
        .single();

      if (restaurantError) throw restaurantError;
      setRestaurant(restaurantData);

      // Fetch menu items for this restaurant
      const { data: menuData, error: menuError } = await supabase
        .from("menu_items")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .eq("is_available", true)
        .order("category", { ascending: true })
        .order("popularity", { ascending: false })
        .order("name", { ascending: true });

      if (menuError) throw menuError;

      // Process menu items
      const processedItems = (menuData || []).map((item) => ({
        ...item,
        formattedPrice: `AED ${item.price?.toFixed(2) || "0.00"}`,
        dietaryTags: item.dietary_tags || [],
        displayCategory: item.category || "Other",
      }));

      setMenuItems(processedItems);

      // Extract unique categories
      const uniqueCategories = Array.from(
        new Set(processedItems.map((item) => item.displayCategory)),
      ).sort();
      setCategories(["all", ...uniqueCategories]);
    } catch (error) {
      console.error("Error fetching menu:", error);
      Alert.alert("Error", "Failed to load menu");
    } finally {
      setLoading(false);
    }
  };

  const fetchCart = async () => {
    if (!user?.id) return;

    try {
      const { data: cartData } = await supabase
        .from("carts")
        .select(
          `
        *,
        cart_items (
          id,
          menu_item_id,
          quantity,
          unit_price,
          total_price
        )
      `,
        )
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();

      if (cartData) {
        setCart(cartData);
        setCartItems(cartData.cart_items || []);
      }
    } catch (error) {
      console.error("Error fetching cart:", error);
    }
  };

  const handleAddToCart = async (item: any) => {
    if (!user?.id) {
      Alert.alert("Login Required", "Please login to add items to cart");
      router.push("/(auth)/signin");
      return;
    }

    try {
      setAddingToCart(item.id);

      let currentCart = cart;

      // Check if cart exists and belongs to same restaurant
      if (currentCart && currentCart.restaurant_id !== restaurantId) {
        Alert.alert(
          "Different Restaurant",
          "Your cart contains items from a different restaurant. Would you like to clear your cart and add this item?",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Clear & Add",
              onPress: async () => {
                await clearCartAndAdd(item);
              },
            },
          ],
        );
        return;
      }

      if (!currentCart) {
        // Check if there's an existing cart in database
        const { data: existingCart } = await supabase
          .from("carts")
          .select("*")
          .eq("user_id", user.id)
          .eq("restaurant_id", restaurantId)
          .eq("status", "active")
          .maybeSingle();

        if (existingCart) {
          currentCart = existingCart;
          setCart(existingCart);
        } else {
          // Create new cart only if none exists
          // Create new cart only if none exists
          const { data: newCart, error: createError } = await supabase
            .from("carts")
            .insert({
              user_id: user.id,
              restaurant_id: restaurantId,
              status: "active",
            })
            .select()
            .maybeSingle(); // <-- Change to maybeSingle()

          if (createError) throw createError;
          currentCart = newCart;
          setCart(newCart);
        }
      }

      // Check if item already in cart (using menu_item_id)
      const existingItem = cartItems.find(
        (cartItem) => cartItem.menu_item_id === item.id,
      );

      if (existingItem) {
        // Update quantity
        const newQuantity = existingItem.quantity + 1;
        const { error } = await supabase
          .from("cart_items")
          .update({
            quantity: newQuantity,
            total_price: item.price * newQuantity,
          })
          .eq("id", existingItem.id);

        if (error) throw error;

        setCartItems((prev) =>
          prev.map((cartItem) =>
            cartItem.id === existingItem.id
              ? { ...cartItem, quantity: newQuantity }
              : cartItem,
          ),
        );
      } else {
        // Add new item - THIS IS CORRECT - using menu_item_id
        const { data: newItem, error } = await supabase
          .from("cart_items")
          .insert({
            cart_id: currentCart.id,
            menu_item_id: item.id, // ✅ This is correct for menu items
            quantity: 1,
            unit_price: item.price,
            total_price: item.price,
          })
          .select()
          .maybeSingle(); // <-- CHANGE TO maybeSingle()

        if (error) throw error;

        setCartItems((prev) => [...prev, newItem]);
      }

      Alert.alert("Added to Cart", `${item.name} added to your cart`, [
        { text: "OK", style: "cancel" },
        { text: "View Cart", onPress: () => router.push("/cart") },
      ]);
    } catch (error) {
      console.error("Error adding to cart:", error);
      Alert.alert("Error", "Failed to add item to cart");
    } finally {
      setAddingToCart(null);
    }
  };
  // Filter menu items based on category and search
  const filteredMenuItems = useMemo(() => {
    let filtered = menuItems;

    if (selectedCategory !== "all") {
      filtered = filtered.filter(
        (item) => item.displayCategory === selectedCategory,
      );
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (item) =>
          item.name.toLowerCase().includes(query) ||
          item.description?.toLowerCase().includes(query) ||
          item.category?.toLowerCase().includes(query),
      );
    }

    return filtered;
  }, [menuItems, selectedCategory, searchQuery]);

  // Group items by category for display
  const groupedItems = useMemo(() => {
    if (selectedCategory !== "all") {
      return [{ title: selectedCategory, data: filteredMenuItems }];
    }

    const groups: { [key: string]: any[] } = {};
    filteredMenuItems.forEach((item) => {
      const category = item.displayCategory;
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(item);
    });

    return Object.keys(groups)
      .sort()
      .map((category) => ({
        title: category,
        data: groups[category],
      }));
  }, [filteredMenuItems, selectedCategory]);

  // Get item quantity in cart
  const getItemQuantity = (itemId: string) => {
    const cartItem = cartItems.find((item) => item.menu_item_id === itemId);
    return cartItem?.quantity || 0;
  };

  const clearCartAndAdd = async (item: any) => {
    try {
      // Delete all cart items
      await supabase.from("cart_items").delete().eq("cart_id", cart.id);

      // Update cart with new restaurant
      await supabase
        .from("carts")
        .update({ restaurant_id: restaurantId })
        .eq("id", cart.id);

      // Add new item
      const { error } = await supabase.from("cart_items").insert({
        cart_id: cart.id,
        menu_item_id: item.id,
        quantity: 1,
        unit_price: item.price,
        total_price: item.price,
      });

      if (error) throw error;

      // Refresh cart
      await fetchCart();

      Alert.alert("Success", `${item.name} added to your cart`);
    } catch (error) {
      console.error("Error clearing cart:", error);
    }
  };

  // Update quantity
  const updateQuantity = async (itemId: string, newQuantity: number) => {
    if (newQuantity < 1) {
      // Remove item
      try {
        await supabase
          .from("cart_items")
          .delete()
          .eq("menu_item_id", itemId)
          .eq("cart_id", cart.id);

        setCartItems((prev) =>
          prev.filter((item) => item.menu_item_id !== itemId),
        );
      } catch (error) {
        console.error("Error removing item:", error);
      }
      return;
    }

    try {
      const cartItem = cartItems.find((item) => item.menu_item_id === itemId);
      if (!cartItem) return;

      const { error } = await supabase
        .from("cart_items")
        .update({
          quantity: newQuantity,
          total_price: cartItem.unit_price * newQuantity,
        })
        .eq("id", cartItem.id);

      if (error) throw error;

      setCartItems((prev) =>
        prev.map((item) =>
          item.menu_item_id === itemId
            ? { ...item, quantity: newQuantity }
            : item,
        ),
      );
    } catch (error) {
      console.error("Error updating quantity:", error);
    }
  };

  // Get popularity badge color
  const getPopularityColor = (popularity: string) => {
    switch (popularity?.toLowerCase()) {
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
    switch (popularity?.toLowerCase()) {
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

  // Render category header
  const renderCategoryHeader = ({ section: { title } }: any) => (
    <View style={styles.categoryHeader}>
      <Text style={styles.categoryTitle}>{title}</Text>
      <View style={styles.categoryDivider} />
    </View>
  );

  // Render menu item
  const renderMenuItem = ({ item }: { item: any }) => {
    const quantity = getItemQuantity(item.id);
    const isAdding = addingToCart === item.id;
    const isHighlighted = highlightedItem === item.id;

    return (
      <View style={[styles.menuItem, isHighlighted && styles.highlightedItem]}>
        <TouchableOpacity
          style={styles.menuItemContent}
          onPress={() => {
            // Navigate to item detail or show options
            Alert.alert(item.name, item.description || "No description", [
              { text: "Cancel", style: "cancel" },
              { text: "Add to Cart", onPress: () => handleAddToCart(item) },
            ]);
          }}
          activeOpacity={0.7}
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
                  styles.popularityBadge,
                  { backgroundColor: getPopularityColor(item.popularity) },
                ]}
              >
                <Ionicons
                  name={getPopularityIcon(item.popularity)}
                  size={10}
                  color="#fff"
                />
                <Text style={styles.popularityText}>
                  {item.popularity === "signature"
                    ? "Signature"
                    : item.popularity === "bestseller"
                      ? "Best Seller"
                      : "Popular"}
                </Text>
              </View>
            )}
            {item.spice_level > 0 && (
              <View style={styles.spiceBadge}>
                <Ionicons name="flame" size={10} color="#FF6B35" />
                <Text style={styles.spiceText}>Level {item.spice_level}</Text>
              </View>
            )}
          </View>

          <View style={styles.menuItemDetails}>
            <View style={styles.menuItemHeader}>
              <Text style={styles.menuItemName} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.menuItemPrice}>{item.formattedPrice}</Text>
            </View>

            {item.description && (
              <Text style={styles.menuItemDescription} numberOfLines={2}>
                {item.description}
              </Text>
            )}

            {item.calories && (
              <Text style={styles.menuItemCalories}>{item.calories} cal</Text>
            )}

            {item.dietaryTags && item.dietaryTags.length > 0 && (
              <View style={styles.dietaryTags}>
                {item.dietaryTags.map((tag: string, index: number) => (
                  <View key={index} style={styles.dietaryTag}>
                    <Text style={styles.dietaryTagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            )}

            {item.preparation_time && (
              <View style={styles.prepTime}>
                <Ionicons name="time-outline" size={10} color="#6B7280" />
                <Text style={styles.prepTimeText}>
                  {item.preparation_time} min
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>

        {quantity > 0 ? (
          <View style={styles.quantityControls}>
            <TouchableOpacity
              style={styles.quantityButton}
              onPress={() => updateQuantity(item.id, quantity - 1)}
            >
              <Ionicons name="remove" size={14} color="#FF6B35" />
            </TouchableOpacity>
            <Text style={styles.quantityText}>{quantity}</Text>
            <TouchableOpacity
              style={styles.quantityButton}
              onPress={() => updateQuantity(item.id, quantity + 1)}
            >
              <Ionicons name="add" size={14} color="#FF6B35" />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => handleAddToCart(item)}
            disabled={isAdding}
          >
            {isAdding ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="add" size={18} color="#fff" />
                <Text style={styles.addButtonText}>Add</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // Render category tabs
  const renderCategoryTab = ({ item }: { item: string }) => (
    <TouchableOpacity
      style={[
        styles.categoryTab,
        selectedCategory === item && styles.categoryTabActive,
      ]}
      onPress={() => {
        setSelectedCategory(item);
        // Scroll to top when changing category
        flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
      }}
    >
      <Text
        style={[
          styles.categoryTabText,
          selectedCategory === item && styles.categoryTabTextActive,
        ]}
        numberOfLines={1}
      >
        {item === "all" ? "All Items" : item}
      </Text>
    </TouchableOpacity>
  );

  // Calculate cart total
  const cartTotal = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + item.total_price, 0);
  }, [cartItems]);

  const cartItemCount = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + item.quantity, 0);
  }, [cartItems]);

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={styles.loadingText}>Loading menu...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={22} color="#111827" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {restaurant?.restaurant_name || "Menu"}
          </Text>
          {restaurant?.cuisine_type && (
            <Text style={styles.headerSubtitle}>{restaurant.cuisine_type}</Text>
          )}
        </View>
        <TouchableOpacity
          style={styles.cartButton}
          onPress={() => router.push("/cart")}
        >
          <Ionicons name="cart-outline" size={22} color="#111827" />
          {cartItemCount > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>
                {cartItemCount > 9 ? "9+" : cartItemCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={24} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search menu..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Category Tabs */}
      <View>
        {categories.length > 0 && (
          <FlatList
            ref={categoryScrollRef}
            data={categories}
            renderItem={renderCategoryTab}
            keyExtractor={(item) => item}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryTabsContainer}
          />
        )}
      </View>

      {/* Menu Items */}
      <FlatList
        ref={flatListRef}
        data={groupedItems}
        renderItem={({ item }) => (
          <View>
            <View style={styles.categoryHeader}>
              <Text style={styles.categoryTitle}>{item.title}</Text>
              <View style={styles.categoryDivider} />
            </View>
            <FlatList
              data={item.data}
              renderItem={renderMenuItem}
              keyExtractor={(menuItem) => menuItem.id}
              scrollEnabled={false}
            />
          </View>
        )}
        keyExtractor={(item) => item.title}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.menuList}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false },
        )}
        scrollEventThrottle={16}
      />

      {/* Cart Summary (if items in cart) */}
      {cartItemCount > 0 && (
        <TouchableOpacity
          style={styles.cartSummary}
          onPress={() => router.push("/cart")}
          activeOpacity={0.9}
        >
          <View style={styles.cartSummaryLeft}>
            <View style={styles.cartSummaryIcon}>
              <Ionicons name="cart" size={20} color="#fff" />
            </View>
            <View>
              <Text style={styles.cartSummaryTitle}>
                {cartItemCount} {cartItemCount === 1 ? "item" : "items"}
              </Text>
              <Text style={styles.cartSummaryRestaurant}>
                {restaurant?.restaurant_name}
              </Text>
            </View>
          </View>
          <View style={styles.cartSummaryRight}>
            <Text style={styles.cartSummaryTotal}>
              AED {cartTotal.toFixed(2)}
            </Text>
            <Ionicons name="chevron-forward" size={16} color="#fff" />
          </View>
        </TouchableOpacity>
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
    marginTop: 12,
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "500",
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
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  cartButton: {
    padding: 4,
    position: "relative",
  },
  cartBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    backgroundColor: "#FF6B35",
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  cartBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#FFFFFF",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#111827",
    padding: 0,
  },
  categoryTabsContainer: {
    paddingHorizontal: 16,
    gap: 8,
    paddingBottom: 12,
  },
  categoryTab: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#F3F4F6",
    borderRadius: 20,
    marginRight: 6,
  },
  categoryTabActive: {
    backgroundColor: "#FF6B35",
  },
  categoryTabText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6B7280",
  },
  categoryTabTextActive: {
    color: "#FFFFFF",
  },
  menuList: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  categoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    marginBottom: 12,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginRight: 12,
  },
  categoryDivider: {
    flex: 1,
    height: 1,
    backgroundColor: "#F3F4F6",
  },
  menuItem: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 0.5,
    borderColor: "#F3F4F6",
    flexDirection: "row",
    alignItems: "center",
  },
  highlightedItem: {
    borderWidth: 1.2,
    borderColor: "#FF6B35",
    backgroundColor: "#FFF9F7",
  },
  menuItemContent: {
    flex: 1,
    flexDirection: "row",
    marginRight: 12,
  },
  menuItemImageContainer: {
    position: "relative",
    width: 70,
    height: 70,
    borderRadius: 8,
    overflow: "hidden",
  },
  menuItemImage: {
    width: "100%",
    height: "100%",
  },
  popularityBadge: {
    position: "absolute",
    top: 4,
    left: 4,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 2,
  },
  popularityText: {
    fontSize: 8,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  spiceBadge: {
    position: "absolute",
    bottom: 4,
    left: 4,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.9)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 2,
  },
  spiceText: {
    fontSize: 8,
    fontWeight: "600",
    color: "#FF6B35",
  },
  menuItemDetails: {
    flex: 1,
    marginLeft: 12,
  },
  menuItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  menuItemName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
    flex: 1,
    marginRight: 8,
  },
  menuItemPrice: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FF6B35",
  },
  menuItemDescription: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 4,
    lineHeight: 16,
  },
  menuItemCalories: {
    fontSize: 11,
    color: "#9CA3AF",
    marginBottom: 4,
  },
  dietaryTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginBottom: 4,
  },
  dietaryTag: {
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  dietaryTagText: {
    fontSize: 9,
    color: "#6B7280",
    fontWeight: "500",
  },
  prepTime: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  prepTimeText: {
    fontSize: 11,
    color: "#6B7280",
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FF6B35",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    gap: 4,
    minWidth: 60,
    justifyContent: "center",
  },
  addButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  quantityControls: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF9F7",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#FF6B35",
  },
  quantityButton: {
    width: 28,
    height: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  quantityText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FF6B35",
    minWidth: 24,
    textAlign: "center",
  },
  cartSummary: {
    position: "absolute",
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: "#FF6B35",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  cartSummaryLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  cartSummaryIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  cartSummaryTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  cartSummaryRestaurant: {
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
  },
  cartSummaryRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cartSummaryTotal: {
    fontSize: 16,
    fontWeight: "800",
    color: "#FFFFFF",
  },
});
