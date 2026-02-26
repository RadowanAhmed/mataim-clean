// app/(restaurant)/menu
import { useAuth } from "@/backend/AuthContext";
import { supabase } from "@/backend/supabase";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { MotiText, MotiView } from "moti";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import {
  GestureHandlerRootView,
  Swipeable,
} from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";

const { width } = Dimensions.get("window");

export default function RestaurantMenuScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("name"); // 'name', 'price', 'popularity'
  const [showSortModal, setShowSortModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filterAvailability, setFilterAvailability] = useState("all"); // 'all', 'available', 'unavailable'
  const swipeRefs = useRef(new Map());

  useEffect(() => {
    fetchMenuData();
  }, [user]);

  const fetchMenuData = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);

      // Fetch menu items
      const { data: itemsData, error: itemsError } = await supabase
        .from("menu_items")
        .select("*")
        .eq("restaurant_id", user.id)
        .order("category")
        .order("name");

      if (itemsError) throw itemsError;

      // Apply sorting
      const sortedItems = sortMenuItems(itemsData || []);
      setMenuItems(sortedItems);

      // Extract unique categories
      const uniqueCategories = [
        ...new Set(itemsData?.map((item) => item.category).filter(Boolean)),
      ];
      setCategories(["All", ...uniqueCategories.sort()]);
    } catch (error) {
      console.error("Error fetching menu data:", error);
      Alert.alert("Error", "Failed to load menu items");
    } finally {
      setLoading(false);
    }
  };

  const sortMenuItems = (items) => {
    const itemsCopy = [...items];
    switch (sortBy) {
      case "price":
        return itemsCopy.sort((a, b) => a.price - b.price);
      case "popularity":
        return itemsCopy.sort((a, b) => {
          const aPop = POPULARITY_ORDER[a.popularity] || 0;
          const bPop = POPULARITY_ORDER[b.popularity] || 0;
          return bPop - aPop;
        });
      case "name":
      default:
        return itemsCopy.sort((a, b) => a.name.localeCompare(b.name));
    }
  };

  const POPULARITY_ORDER = {
    signature: 4,
    bestseller: 3,
    popular: 2,
    regular: 1,
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchMenuData();
    setRefreshing(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const deleteMenuItem = async (itemId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    Alert.alert(
      "Delete Item",
      "Are you sure you want to delete this menu item?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await supabase
                .from("menu_items")
                .delete()
                .eq("id", itemId)
                .eq("restaurant_id", user.id);

              if (error) throw error;

              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Warning,
              );
              Alert.alert("Success", "Menu item deleted successfully");
              fetchMenuData();
            } catch (error) {
              console.error("Error deleting menu item:", error);
              Alert.alert("Error", "Failed to delete menu item");
            }
          },
        },
      ],
    );
  };

  const toggleAvailability = async (itemId: string, currentStatus: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const { error } = await supabase
        .from("menu_items")
        .update({ is_available: !currentStatus })
        .eq("id", itemId)
        .eq("restaurant_id", user.id);

      if (error) throw error;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      fetchMenuData();
    } catch (error) {
      console.error("Error updating menu item:", error);
      Alert.alert("Error", "Failed to update menu item");
    }
  };

  const getPopularityColor = (popularity) => {
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

  const getPopularityIcon = (popularity) => {
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

  const renderRightActions = (progress, dragX, item) => {
    const trans = dragX.interpolate({
      inputRange: [-100, 0],
      outputRange: [0, 60],
      extrapolate: "clamp",
    });

    return (
      <Animated.View
        style={[styles.swipeActions, { transform: [{ translateX: trans }] }]}
      >
        <TouchableOpacity
          style={[
            styles.swipeButton,
            { backgroundColor: item.is_available ? "#FF6B35" : "#10B981" },
          ]}
          onPress={() => toggleAvailability(item.id, item.is_available)}
        >
          <Ionicons
            name={item.is_available ? "eye-off" : "eye"}
            size={18}
            color="#fff"
          />
          <Text style={styles.swipeButtonText}>
            {item.is_available ? "Hide" : "Show"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.swipeButton, { backgroundColor: "#3B82F6" }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push(`/(restaurant)/menu/edit?id=${item.id}`);
          }}
        >
          <Ionicons name="pencil" size={18} color="#fff" />
          <Text style={styles.swipeButtonText}>Edit</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.swipeButton, { backgroundColor: "#EF4444" }]}
          onPress={() => deleteMenuItem(item.id)}
        >
          <Ionicons name="trash" size={18} color="#fff" />
          <Text style={styles.swipeButtonText}>Delete</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderMenuItem = ({ item, index }) => {
    const filteredItems = getFilteredItems();
    const isEven = index % 2 === 0;

    return (
      <MotiView
        from={{ opacity: 0, translateY: 20 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ delay: index * 100 }}
        style={styles.menuItemContainer}
      >
        <Swipeable
          ref={(ref) => swipeRefs.current.set(item.id, ref)}
          renderRightActions={(progress, dragX) =>
            renderRightActions(progress, dragX, item)
          }
          friction={2}
          rightThreshold={40}
          onSwipeableWillOpen={() => {
            // Close other swipes
            swipeRefs.current.forEach((ref, key) => {
              if (key !== item.id && ref) ref.close();
            });
          }}
        >
          <TouchableOpacity
            style={[
              styles.menuItemCard,
              !item.is_available && styles.menuItemCardDisabled,
            ]}
            activeOpacity={0.9}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              // Show item details or edit
              router.push(`/(restaurant)/menu/edit?id=${item.id}`);
            }}
          >
            {/* Image with gradient overlay */}
            <View style={styles.imageContainer}>
              <Image
                source={{
                  uri:
                    item.image_url ||
                    "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=300&h=200&fit=crop",
                }}
                style={styles.menuItemImage}
              />
              <LinearGradient
                colors={["transparent", "rgba(0,0,0,0.3)"]}
                style={styles.imageGradient}
              />

              {/* Popularity Badge */}
              {item.popularity && item.popularity !== "regular" && (
                <View
                  style={[
                    styles.popularityBadge,
                    { backgroundColor: getPopularityColor(item.popularity) },
                  ]}
                >
                  <Ionicons
                    name={getPopularityIcon(item.popularity)}
                    size={12}
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
            </View>

            {/* Content */}
            <View style={styles.menuItemContent}>
              <View style={styles.menuItemHeader}>
                <View style={styles.menuItemInfo}>
                  <View style={styles.nameRow}>
                    <Text style={styles.menuItemName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    {item.spice_level > 0 && (
                      <View style={styles.spiceIndicator}>
                        {Array(item.spice_level)
                          .fill(0)
                          .map((_, i) => (
                            <Ionicons
                              key={i}
                              name="flame"
                              size={10}
                              color="#FF6B35"
                            />
                          ))}
                      </View>
                    )}
                  </View>

                  {item.category && (
                    <View style={styles.categoryChip}>
                      <Ionicons name="pricetag" size={10} color="#6B7280" />
                      <Text style={styles.menuItemCategory}>
                        {item.category}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.menuItemMeta}>
                  <Text style={styles.menuItemPrice}>
                    AED {item.price.toFixed(2)}
                  </Text>
                  <MotiView
                    animate={{
                      scale: item.is_available ? [1, 1.2, 1] : 1,
                    }}
                    transition={{
                      type: "timing",
                      duration: 2000,
                      loop: item.is_available,
                    }}
                  >
                    <View
                      style={[
                        styles.availabilityIndicator,
                        {
                          backgroundColor: item.is_available
                            ? "#10B981"
                            : "#6B7280",
                        },
                      ]}
                    >
                      <Text style={styles.availabilityIndicatorText}>
                        {item.is_available ? "●" : "○"}
                      </Text>
                    </View>
                  </MotiView>
                </View>
              </View>

              {item.description && (
                <Text style={styles.menuItemDescription} numberOfLines={2}>
                  {item.description}
                </Text>
              )}

              {/* Stats Row */}
              <View style={styles.statsRow}>
                {item.preparation_time && (
                  <View style={styles.stat}>
                    <Ionicons name="time" size={12} color="#6B7280" />
                    <Text style={styles.statText}>
                      {item.preparation_time}m
                    </Text>
                  </View>
                )}

                {item.calories && (
                  <View style={styles.stat}>
                    <Ionicons name="flash" size={12} color="#6B7280" />
                    <Text style={styles.statText}>{item.calories} cal</Text>
                  </View>
                )}

                {item.dietary_tags?.length > 0 && (
                  <View style={styles.dietaryTags}>
                    {item.dietary_tags.slice(0, 2).map((tag, i) => (
                      <View key={i} style={styles.dietaryTag}>
                        <Text style={styles.dietaryTagText}>{tag}</Text>
                      </View>
                    ))}
                    {item.dietary_tags.length > 2 && (
                      <Text style={styles.moreTags}>
                        +{item.dietary_tags.length - 2}
                      </Text>
                    )}
                  </View>
                )}
              </View>

              {/* Quick Actions */}
              <View style={styles.quickActions}>
                <TouchableOpacity
                  style={styles.quickAction}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    // Quick duplicate action
                    Alert.alert(
                      "Duplicate",
                      "Duplicate functionality would go here",
                    );
                  }}
                >
                  <Ionicons name="copy" size={14} color="#6B7280" />
                  <Text style={styles.quickActionText}>Duplicate</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickAction}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    // Analytics action
                    router.push(`/(restaurant)/menu/analytics?id=${item.id}`);
                  }}
                >
                  <Ionicons name="stats-chart" size={14} color="#6B7280" />
                  <Text style={styles.quickActionText}>Analytics</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </Swipeable>
      </MotiView>
    );
  };

  const getFilteredItems = () => {
    let filtered = [...menuItems];

    // Filter by category
    if (selectedCategory !== "All") {
      filtered = filtered.filter((item) => item.category === selectedCategory);
    }

    // Filter by search
    if (searchQuery) {
      filtered = filtered.filter(
        (item) =>
          item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.description?.toLowerCase().includes(searchQuery.toLowerCase()),
      );
    }

    // Filter by availability
    if (filterAvailability === "available") {
      filtered = filtered.filter((item) => item.is_available);
    } else if (filterAvailability === "unavailable") {
      filtered = filtered.filter((item) => !item.is_available);
    }

    return filtered;
  };

  const handleSortSelect = (sortType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSortBy(sortType);
    setShowSortModal(false);
    // Re-sort items
    const sortedItems = sortMenuItems(menuItems);
    setMenuItems(sortedItems);
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <MotiView
          animate={{ rotate: "360deg" }}
          transition={{
            type: "timing",
            duration: 1000,
            loop: true,
          }}
        >
          <Ionicons name="restaurant" size={48} color="#FF6B35" />
        </MotiView>
        <MotiText
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ type: "timing", duration: 1000, loop: true }}
          style={styles.loadingText}
        >
          Loading your menu...
        </MotiText>
      </SafeAreaView>
    );
  }

  const filteredItems = getFilteredItems();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />

        {/* Modern Header */}
        <BlurView intensity={90} tint="light" style={styles.header}>
          <View style={styles.headerContent}>
            <View>
              <Text style={styles.headerTitle}>Menu Management</Text>
              <Text style={styles.headerSubtitle}>
                {filteredItems.length}{" "}
                {filteredItems.length === 1 ? "item" : "items"} total
              </Text>
            </View>

            <TouchableOpacity
              style={styles.createButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push("/(restaurant)/menu/create");
              }}
            >
              <LinearGradient
                colors={["#10B981", "#059669"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.gradientButton}
              >
                <Ionicons name="add" size={18} color="#fff" />
                <Text style={styles.createButtonText}>New Item</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <View style={styles.searchInputContainer}>
              <Ionicons
                name="search"
                size={18}
                color="#6B7280"
                style={styles.searchIcon}
              />
              <TextInput
                style={styles.searchInput}
                placeholder="Search menu items..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                clearButtonMode="while-editing"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery("")}>
                  <Ionicons name="close-circle" size={18} color="#6B7280" />
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              style={styles.filterButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowFilters(!showFilters);
              }}
            >
              <Ionicons name="filter" size={20} color="#6B7280" />
              {(selectedCategory !== "All" || filterAvailability !== "all") && (
                <View style={styles.filterIndicator} />
              )}
            </TouchableOpacity>
          </View>

          {/* Filters Panel */}
          {showFilters && (
            <MotiView
              from={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 80 }}
              transition={{ type: "timing" }}
              style={styles.filtersPanel}
            >
              <View style={styles.filtersRow}>
                <Text style={styles.filterLabel}>Category:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {categories.map((category) => (
                    <TouchableOpacity
                      key={category}
                      style={[
                        styles.filterChip,
                        selectedCategory === category &&
                          styles.filterChipActive,
                      ]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setSelectedCategory(category);
                      }}
                    >
                      <Text
                        style={[
                          styles.filterChipText,
                          selectedCategory === category &&
                            styles.filterChipTextActive,
                        ]}
                      >
                        {category}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.filtersRow}>
                <Text style={styles.filterLabel}>Status:</Text>
                {["all", "available", "unavailable"].map((status) => (
                  <TouchableOpacity
                    key={status}
                    style={[
                      styles.statusChip,
                      filterAvailability === status && styles.statusChipActive,
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setFilterAvailability(status);
                    }}
                  >
                    <View
                      style={[
                        styles.statusDot,
                        status === "available" && styles.statusDotAvailable,
                        status === "unavailable" && styles.statusDotUnavailable,
                      ]}
                    />
                    <Text
                      style={[
                        styles.statusChipText,
                        filterAvailability === status &&
                          styles.statusChipTextActive,
                      ]}
                    >
                      {status === "all"
                        ? "All"
                        : status === "available"
                          ? "Available"
                          : "Unavailable"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </MotiView>
          )}

          {/* Sort & View Controls */}
          <View style={styles.controlsRow}>
            <TouchableOpacity
              style={styles.sortButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowSortModal(true);
              }}
            >
              <Ionicons name="swap-vertical" size={16} color="#6B7280" />
              <Text style={styles.sortButtonText}>
                {sortBy === "name"
                  ? "Name"
                  : sortBy === "price"
                    ? "Price"
                    : "Popularity"}
              </Text>
              <Ionicons name="chevron-down" size={14} color="#6B7280" />
            </TouchableOpacity>
          </View>
        </BlurView>

        {filteredItems.length === 0 ? (
          <MotiView
            from={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            style={styles.emptyState}
          >
            <LinearGradient
              colors={["#F9FAFB", "#F3F4F6"]}
              style={styles.emptyStateGradient}
            >
              <Ionicons name="fast-food" size={64} color="#D1D5DB" />
              <Text style={styles.emptyStateTitle}>No menu items found</Text>
              <Text style={styles.emptyStateText}>
                {searchQuery ||
                selectedCategory !== "All" ||
                filterAvailability !== "all"
                  ? "Try adjusting your filters or search"
                  : "Add your first menu item to start"}
              </Text>
              <TouchableOpacity
                style={styles.emptyStateButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  router.push("/(restaurant)/menu/create");
                }}
              >
                <LinearGradient
                  colors={["#10B981", "#059669"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.emptyStateButtonGradient}
                >
                  <Ionicons name="add" size={16} color="#fff" />
                  <Text style={styles.emptyStateButtonText}>Add Menu Item</Text>
                </LinearGradient>
              </TouchableOpacity>
            </LinearGradient>
          </MotiView>
        ) : (
          <FlatList
            data={filteredItems}
            renderItem={renderMenuItem}
            keyExtractor={(item) => item.id}
            numColumns={2}
            contentContainerStyle={styles.listContent}
            columnWrapperStyle={styles.columnWrapper}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#10B981"
                colors={["#10B981"]}
                progressBackgroundColor="#F3F4F6"
              />
            }
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* Sort Modal */}
        <Modal
          visible={showSortModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowSortModal(false)}
        >
          <BlurView intensity={50} tint="dark" style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Sort By</Text>
                <TouchableOpacity
                  onPress={() => setShowSortModal(false)}
                  style={styles.closeButtonCircle}
                >
                  <Ionicons name="close" size={20} color="#374151" />
                </TouchableOpacity>
              </View>

              {[
                { id: "name", icon: "text", label: "Name (A-Z)" },
                { id: "price", icon: "cash", label: "Price (Low to High)" },
                { id: "popularity", icon: "trending-up", label: "Popularity" },
              ].map((option) => (
                <TouchableOpacity
                  key={option.id}
                  style={[
                    styles.sortOption,
                    sortBy === option.id && styles.sortOptionActive,
                  ]}
                  onPress={() => handleSortSelect(option.id)}
                >
                  <View
                    style={[
                      styles.sortIconContainer,
                      sortBy === option.id && styles.sortIconContainerActive,
                    ]}
                  >
                    <Ionicons
                      name={option.icon}
                      size={16}
                      color={sortBy === option.id ? "#fff" : "#6B7280"}
                    />
                  </View>
                  <Text
                    style={[
                      styles.sortOptionText,
                      sortBy === option.id && styles.sortOptionTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                  {sortBy === option.id && (
                    <Ionicons name="checkmark" size={20} color="#10B981" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </BlurView>
        </Modal>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    marginBottom: Platform.OS === "ios" ? 0 : -22,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "500",
  },
  header: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    paddingTop: Platform.OS === "ios" ? 0 : 12,
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
    fontWeight: "400",
  },
  createButton: {
    borderRadius: 12,
    overflow: "hidden",
    elevation: 3,
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  gradientButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  createButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: -0.25,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 14,
    color: "#111827",
  },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  filterIndicator: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#10B981",
  },
  filtersPanel: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    overflow: "hidden",
  },
  filtersRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 8,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#374151",
    minWidth: 70,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#F3F4F6",
    borderRadius: 16,
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: "#10B981",
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#6B7280",
  },
  filterChipTextActive: {
    color: "#FFFFFF",
  },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#F3F4F6",
    borderRadius: 16,
    marginRight: 8,
    gap: 6,
  },
  statusChipActive: {
    backgroundColor: "#10B98115",
    borderWidth: 1,
    borderColor: "#10B981",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#6B7280",
  },
  statusDotAvailable: {
    backgroundColor: "#10B981",
  },
  statusDotUnavailable: {
    backgroundColor: "#FF6B35",
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#6B7280",
  },
  statusChipTextActive: {
    color: "#10B981",
  },
  controlsRow: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  sortButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  sortButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },
  listContent: {
    padding: 8,
    paddingBottom: 100,
  },
  columnWrapper: {
    justifyContent: "space-between",
    marginBottom: 12,
  },
  menuItemContainer: {
    flex: 1,
    marginHorizontal: 4,
  },
  menuItemCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    overflow: "hidden",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    marginBottom: 8,
  },
  menuItemCardDisabled: {
    opacity: 0.7,
  },
  imageContainer: {
    position: "relative",
    height: 140,
  },
  menuItemImage: {
    width: "100%",
    height: "100%",
  },
  imageGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
  },
  popularityBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  popularityText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#fff",
  },
  menuItemContent: {
    padding: 12,
  },
  menuItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  menuItemInfo: {
    flex: 1,
    marginRight: 8,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  menuItemName: {
    fontSize: 14,
    fontWeight: "800",
    color: "#111827",
    flex: 1,
  },
  spiceIndicator: {
    flexDirection: "row",
    marginLeft: 4,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
    gap: 4,
  },
  menuItemCategory: {
    fontSize: 10,
    fontWeight: "600",
    color: "#6B7280",
  },
  menuItemMeta: {
    alignItems: "flex-end",
  },
  menuItemPrice: {
    fontSize: 14,
    fontWeight: "800",
    color: "#10B981",
    marginBottom: 4,
  },
  availabilityIndicator: {
    width: 12,
    height: 12,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  availabilityIndicatorText: {
    color: "#fff",
    fontSize: 8,
    fontWeight: "bold",
  },
  menuItemDescription: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 8,
    lineHeight: 16,
    fontWeight: "400",
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 8,
  },
  stat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statText: {
    fontSize: 10,
    color: "#6B7280",
    fontWeight: "500",
  },
  dietaryTags: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  dietaryTag: {
    backgroundColor: "#FF6B3515",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  dietaryTagText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#FF6B35",
  },
  moreTags: {
    fontSize: 10,
    color: "#6B7280",
    fontWeight: "500",
  },
  quickActions: {
    flexDirection: "row",
    justifyContent: "space-around",
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    paddingTop: 8,
  },
  quickAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  quickActionText: {
    fontSize: 10,
    color: "#6B7280",
    fontWeight: "500",
  },
  swipeActions: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 8,
  },
  swipeButton: {
    width: 60,
    height: "94%",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
    borderRadius: 12,
    paddingHorizontal: 8,
  },
  swipeButtonText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
    marginTop: 4,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  emptyStateGradient: {
    width: "100%",
    alignItems: "center",
    padding: 32,
    borderRadius: 16,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
    fontWeight: "400",
  },
  emptyStateButton: {
    borderRadius: 12,
    overflow: "hidden",
    elevation: 2,
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  emptyStateButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  emptyStateButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
    letterSpacing: -0.5,
  },
  closeButtonCircle: {
    width: 32,
    height: 32,
    borderRadius: 18,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  sortOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    gap: 12,
  },
  sortOptionActive: {
    backgroundColor: "#10B98105",
  },
  sortIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  sortIconContainerActive: {
    backgroundColor: "#10B981",
  },
  sortOptionText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
  },
  sortOptionTextActive: {
    color: "#10B981",
    fontWeight: "600",
  },
});
