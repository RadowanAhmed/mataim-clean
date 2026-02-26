// app/(restaurant)/menu/create
import { useAuth } from "@/backend/AuthContext";
import { supabase } from "@/backend/supabase";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { MotiView } from "moti";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Configure Cloudinary
const CLOUDINARY_CLOUD_NAME = "dz1arsa91";
const CLOUDINARY_UPLOAD_PRESET = "mataim_profile_preset"; // Using the same preset

// Premium Unsplash food images
const PREMIUM_FOOD_IMAGES = [
  {
    id: 1,
    uri: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&h=600&fit=crop",
    label: "Pizza",
    category: "Main Course",
  },
  {
    id: 2,
    uri: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&h=600&fit=crop",
    label: "Burger",
    category: "Main Course",
  },
  {
    id: 3,
    uri: "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=800&h=600&fit=crop",
    label: "Tacos",
    category: "Appetizers",
  },
  {
    id: 4,
    uri: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&h=600&fit=crop",
    label: "BBQ Ribs",
    category: "Main Course",
  },
  {
    id: 5,
    uri: "https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=800&h=600&fit=crop",
    label: "Sushi",
    category: "Main Course",
  },
  {
    id: 6,
    uri: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&h=600&fit=crop",
    label: "Curry",
    category: "Main Course",
  },
  {
    id: 7,
    uri: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&h=600&fit=crop",
    label: "Healthy Bowl",
    category: "Specials",
  },
  {
    id: 8,
    uri: "https://images.unsplash.com/photo-1559314809-2b99056a8c4a?w=800&h=600&fit=crop",
    label: "Thai Noodles",
    category: "Main Course",
  },
  {
    id: 9,
    uri: "https://images.unsplash.com/photo-1550617931-e17a7b70dce2?w=800&h=600&fit=crop",
    label: "Salad",
    category: "Appetizers",
  },
  {
    id: 10,
    uri: "https://images.unsplash.com/photo-1532634922-8fe0b757fb13?w=800&h=600&fit=crop",
    label: "Steak",
    category: "Main Course",
  },
  {
    id: 11,
    uri: "https://images.unsplash.com/photo-1484723091739-30a097e8f929?w=800&h=600&fit=crop",
    label: "French Toast",
    category: "Breakfast",
  },
  {
    id: 12,
    uri: "https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=800&h=600&fit=crop",
    label: "Smoothie",
    category: "Beverages",
  },
];

// Enhanced categories with icons
const ENHANCED_CATEGORIES = [
  { id: "appetizers", name: "🥗 Appetizers", color: "#10B981" },
  { id: "main", name: "🍽️ Main Course", color: "#3B82F6" },
  { id: "desserts", name: "🍰 Desserts", color: "#8B5CF6" },
  { id: "beverages", name: "🥤 Beverages", color: "#06B6D4" },
  { id: "sides", name: "🍟 Sides", color: "#F59E0B" },
  { id: "specials", name: "⭐ Specials", color: "#EC4899" },
  { id: "breakfast", name: "☕ Breakfast", color: "#6366F1" },
  { id: "lunch", name: "🥪 Lunch", color: "#14B8A6" },
  { id: "dinner", name: "🍷 Dinner", color: "#8B5CF6" },
];

// Dietary tags with icons
const ENHANCED_DIETARY_TAGS = [
  { id: "vegetarian", name: "🥬 Vegetarian", emoji: "🥬", color: "#10B981" },
  { id: "vegan", name: "🌱 Vegan", emoji: "🌱", color: "#059669" },
  { id: "gluten", name: "🌾 Gluten-Free", emoji: "🌾", color: "#D97706" },
  { id: "dairy", name: "🥛 Dairy-Free", emoji: "🥛", color: "#0EA5E9" },
  { id: "spicy", name: "🌶️ Spicy", emoji: "🌶️", color: "#DC2626" },
  { id: "halal", name: "🕌 Halal", emoji: "🕌", color: "#7C3AED" },
  { id: "lowcarb", name: "🥦 Low-Carb", emoji: "🥦", color: "#059669" },
  { id: "organic", name: "🍃 Organic", emoji: "🍃", color: "#65A30D" },
  { id: "keto", name: "🥑 Keto", emoji: "🥑", color: "#CA8A04" },
  { id: "pescatarian", name: "🐟 Pescatarian", emoji: "🐟", color: "#0891B2" },
  { id: "nutfree", name: "🥜 Nut-Free", emoji: "🥜", color: "#B45309" },
  { id: "sugarfree", name: "🚫 Sugar-Free", emoji: "🚫", color: "#BE123C" },
];

// Popularity levels
const POPULARITY_LEVELS = [
  { id: "regular", name: "Regular", color: "#6B7280" },
  { id: "popular", name: "🔥 Popular", color: "#F59E0B" },
  { id: "bestseller", name: "⭐ Best Seller", color: "#FF6B35" },
  { id: "signature", name: "👑 Signature", color: "#8B5CF6" },
];

export default function CreateMenuItemScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [activeTab, setActiveTab] = useState("basic"); // 'basic', 'details', 'extras'

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    category: "",
    preparation_time: "",
    calories: "",
    dietary_tags: [] as string[],
    popularity: "regular",
    ingredients: "",
    allergens: [] as string[],
    spice_level: 0,
  });

  const [selectedImage, setSelectedImage] = useState(
    PREMIUM_FOOD_IMAGES[0].uri,
  );
  const [customImage, setCustomImage] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showImageFilter, setShowImageFilter] = useState(false);
  const [imageFilter, setImageFilter] = useState("all"); // 'all', 'main', 'appetizers', etc.
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showIngredientsModal, setShowIngredientsModal] = useState(false);
  const [charCount, setCharCount] = useState(0);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    const checkSetupComplete = async () => {
      if (user?.user_type === "restaurant") {
        try {
          const { data: restaurant, error } = await supabase
            .from("restaurants")
            .select("setup_completed, restaurant_name")
            .eq("id", user.id)
            .single();

          if (error) {
            console.error("Error checking restaurant setup:", error);
            Alert.alert(
              "Error",
              "Unable to verify restaurant setup. Please try again.",
              [
                {
                  text: "OK",
                  onPress: () => router.back(),
                },
              ],
            );
            return;
          }

          if (!restaurant?.setup_completed) {
            Alert.alert(
              "Setup Required",
              "Please complete your restaurant profile setup to create menu items.",
              [
                {
                  text: "Complete Setup",
                  onPress: () =>
                    router.replace({
                      pathname: "/(restaurant)/setup",
                      params: { userId: user.id },
                    }),
                },
                {
                  text: "Cancel",
                  style: "cancel",
                  onPress: () => router.back(),
                },
              ],
            );
          }
        } catch (error) {
          console.error("Unexpected error:", error);
          Alert.alert(
            "Error",
            "Unable to verify restaurant setup. Please try again.",
            [
              {
                text: "OK",
                onPress: () => router.back(),
              },
            ],
          );
        }
      }
    };

    checkSetupComplete();
  }, [user]);

  const uploadImageToCloudinary = async (asset: any) => {
    if (!user?.id) return null;

    try {
      setUploadingImage(true);

      const formData = new FormData();
      formData.append("file", {
        uri: asset.uri,
        type: "image/jpeg",
        name: `menu-${user.id}-${Date.now()}.jpg`,
      } as any);
      formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
        {
          method: "POST",
          body: formData,
        },
      );

      const data = await response.json();

      if (!response.ok) {
        console.error("Cloudinary error:", data);
        throw new Error(data.error?.message || "Upload failed");
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return data.secure_url;
    } catch (error) {
      console.error("Upload error:", error);
      Alert.alert("Error", "Failed to upload image. Please try again.");
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  const pickImage = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permissionResult.granted === false) {
      Alert.alert("Permission required", "Please allow access to your photos.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      const imageUrl = await uploadImageToCloudinary(result.assets[0]);
      if (imageUrl) {
        setCustomImage(imageUrl);
        setSelectedImage(imageUrl);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    }
  };

  const takePhoto = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const { status } = await ImagePicker.requestCameraPermissionsAsync();

    if (status !== "granted") {
      Alert.alert(
        "Permission required",
        "Please grant camera permissions to take a photo.",
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      const imageUrl = await uploadImageToCloudinary(result.assets[0]);
      if (imageUrl) {
        setCustomImage(imageUrl);
        setSelectedImage(imageUrl);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    }
  };

  const showImageOptions = () => {
    Alert.alert("Add Dish Photo", "Choose an option", [
      { text: "Take Photo", onPress: takePhoto },
      { text: "Choose from Library", onPress: pickImage },
      { text: "Use Premium Image", onPress: () => setShowImageFilter(true) },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const toggleDietaryTag = (tag: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFormData((prev) => ({
      ...prev,
      dietary_tags: prev.dietary_tags.includes(tag)
        ? prev.dietary_tags.filter((t) => t !== tag)
        : [...prev.dietary_tags, tag],
    }));
  };

  const toggleAllergen = (allergen: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFormData((prev) => ({
      ...prev,
      allergens: prev.allergens.includes(allergen)
        ? prev.allergens.filter((a) => a !== allergen)
        : [...prev.allergens, allergen],
    }));
  };

  const handleSubmit = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (!formData.name.trim()) {
      Alert.alert("Error", "Please enter item name");
      return;
    }

    if (!formData.price.trim()) {
      Alert.alert("Error", "Please enter price");
      return;
    }

    if (!user?.id) {
      Alert.alert("Error", "User not found");
      return;
    }

    // Double-check setup completion
    try {
      const { data: restaurantCheck } = await supabase
        .from("restaurants")
        .select("setup_completed")
        .eq("id", user.id)
        .single();

      if (!restaurantCheck?.setup_completed) {
        Alert.alert(
          "Setup Required",
          "Please complete your restaurant profile setup to create menu items.",
          [
            {
              text: "Complete Setup",
              onPress: () =>
                router.replace({
                  pathname: "/(restaurant)/setup",
                  params: { userId: user.id },
                }),
            },
            {
              text: "Cancel",
              style: "cancel",
            },
          ],
        );
        return;
      }
    } catch (error) {
      console.error("Error checking setup status:", error);
      Alert.alert("Error", "Unable to verify restaurant setup status.");
      return;
    }

    try {
      setLoading(true);

      // Get the next menu item number for this restaurant
      const { count, error: countError } = await supabase
        .from("menu_items")
        .select("*", { count: "exact", head: true })
        .eq("restaurant_id", user.id);

      if (countError) throw countError;

      const nextMenuItemNumber = (count || 0) + 1;

      // Prepare menu item data
      const menuItemData = {
        restaurant_id: user.id,
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        price: parseFloat(formData.price),
        category: formData.category || null,
        image_url: selectedImage,
        is_available: true,
        preparation_time: formData.preparation_time
          ? parseInt(formData.preparation_time)
          : null,
        calories: formData.calories ? parseInt(formData.calories) : null,
        dietary_tags: formData.dietary_tags,
        popularity: formData.popularity,
        ingredients: formData.ingredients || null,
        allergens: formData.allergens.length > 0 ? formData.allergens : null,
        spice_level: formData.spice_level > 0 ? formData.spice_level : null,
        menu_item_number: nextMenuItemNumber,
      };

      // Remove null values
      Object.keys(menuItemData).forEach((key) => {
        if (menuItemData[key] === null) {
          delete menuItemData[key];
        }
      });

      // Insert menu item
      const { data, error } = await supabase
        .from("menu_items")
        .insert([menuItemData])
        .select("menu_item_number, name")
        .single();

      if (error) throw error;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      Alert.alert("🎉 Success!", `${data.name} created successfully`, [
        {
          text: "View Menu",
          onPress: () => router.push("/(restaurant)/menu"),
        },
        {
          text: "Add Another",
          style: "default",
          onPress: () => {
            // Reset form
            setFormData({
              name: "",
              description: "",
              price: "",
              category: "",
              preparation_time: "",
              calories: "",
              dietary_tags: [],
              popularity: "regular",
              ingredients: "",
              allergens: [],
              spice_level: 0,
            });
            setSelectedImage(PREMIUM_FOOD_IMAGES[0].uri);
            setCustomImage(null);
            setActiveTab("basic");
          },
        },
      ]);
    } catch (error: any) {
      console.error("Error creating menu item:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      let errorMessage = "Failed to create menu item";
      if (error.message.includes("duplicate key")) {
        errorMessage = "An item with similar details already exists";
      }

      Alert.alert("Error", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const filteredImages =
    imageFilter === "all"
      ? PREMIUM_FOOD_IMAGES
      : PREMIUM_FOOD_IMAGES.filter((img) => img.category === imageFilter);

  const renderSpiceLevel = () => {
    return (
      <View style={styles.spiceLevelContainer}>
        <Text style={styles.label}>
          <Ionicons name="flame" size={16} color="#FF6B35" /> Spice Level
        </Text>
        <View style={styles.spiceLevelSelector}>
          {[0, 1, 2, 3, 4, 5].map((level) => (
            <TouchableOpacity
              key={level}
              style={[
                styles.spiceLevelOption,
                formData.spice_level === level && styles.spiceLevelOptionActive,
                level === 0 && styles.noSpiceOption,
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setFormData({ ...formData, spice_level: level });
              }}
            >
              {level === 0 ? (
                <Ionicons name="leaf" size={20} color="#10B981" />
              ) : (
                Array(level)
                  .fill(0)
                  .map((_, i) => (
                    <Ionicons key={i} name="flame" size={16} color="#FF6B35" />
                  ))
              )}
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.spiceLevelLabels}>
          <Text style={styles.spiceLabel}>Mild</Text>
          <Text style={styles.spiceLabel}>Medium</Text>
          <Text style={styles.spiceLabel}>Hot</Text>
          <Text style={styles.spiceLabel}>Extra Hot</Text>
        </View>
      </View>
    );
  };

  const renderAllergens = () => {
    const commonAllergens = [
      "Peanuts",
      "Tree Nuts",
      "Milk",
      "Eggs",
      "Fish",
      "Shellfish",
      "Soy",
      "Wheat",
      "Sesame",
      "Mustard",
    ];

    return (
      <View style={styles.allergensContainer}>
        <Text style={styles.label}>
          <Ionicons name="warning" size={16} color="#EF4444" /> Allergens
        </Text>
        <View style={styles.allergensGrid}>
          {commonAllergens.map((allergen) => (
            <TouchableOpacity
              key={allergen}
              style={[
                styles.allergenOption,
                formData.allergens.includes(allergen) &&
                  styles.allergenOptionSelected,
              ]}
              onPress={() => toggleAllergen(allergen)}
            >
              <Ionicons
                name={
                  formData.allergens.includes(allergen)
                    ? "checkbox"
                    : "square-outline"
                }
                size={16}
                color={
                  formData.allergens.includes(allergen) ? "#EF4444" : "#6B7280"
                }
              />
              <Text
                style={[
                  styles.allergenText,
                  formData.allergens.includes(allergen) &&
                    styles.allergenTextSelected,
                ]}
              >
                {allergen}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <SafeAreaView style={styles.container}>
        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
          {/* Header */}
          <BlurView intensity={90} tint="light" style={styles.header}>
            <View style={styles.headerContent}>
              <TouchableOpacity
                onPress={() => router.back()}
                style={styles.backButtonCircle}
              >
                <Ionicons name="arrow-back" size={20} color="#111827" />
              </TouchableOpacity>
              <View style={styles.headerTitleContainer}>
                <Text style={styles.headerTitle}>Create Menu Item</Text>
                <Text style={styles.headerSubtitle}>
                  Add new dish to your menu
                </Text>
              </View>
              <TouchableOpacity style={styles.helpButton}>
                <Ionicons
                  name="help-circle-outline"
                  size={22}
                  color="#6B7280"
                />
              </TouchableOpacity>
            </View>

            {/* Tab Navigation */}
            <View style={styles.tabContainer}>
              {["basic", "details", "extras"].map((tab) => (
                <TouchableOpacity
                  key={tab}
                  style={[
                    styles.tabButton,
                    activeTab === tab && styles.tabButtonActive,
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setActiveTab(tab);
                  }}
                >
                  <Text
                    style={[
                      styles.tabText,
                      activeTab === tab && styles.tabTextActive,
                    ]}
                  >
                    {tab === "basic" && "Basic Info"}
                    {tab === "details" && "Details"}
                    {tab === "extras" && "Extras"}
                  </Text>
                  {activeTab === tab && (
                    <MotiView
                      from={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      style={styles.tabIndicator}
                    />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </BlurView>

          {/* Content */}
          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {activeTab === "basic" && (
              <MotiView
                from={{ opacity: 0, translateY: 20 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: "timing", duration: 300 }}
              >
                {/* Main Image */}
                <View style={styles.section}>
                  <Text style={styles.label}>
                    <Ionicons name="image" size={16} color="#FF6B35" /> Dish
                    Image
                  </Text>

                  <TouchableOpacity
                    style={styles.mainImageContainer}
                    onPress={showImageOptions}
                    activeOpacity={0.9}
                    disabled={uploadingImage}
                  >
                    {uploadingImage ? (
                      <View style={styles.uploadingContainer}>
                        <ActivityIndicator size="large" color="#10B981" />
                        <Text style={styles.uploadingText}>
                          Uploading image...
                        </Text>
                      </View>
                    ) : (
                      <>
                        <Image
                          source={{ uri: selectedImage }}
                          style={styles.mainImage}
                          resizeMode="cover"
                        />
                        <LinearGradient
                          colors={["transparent", "rgba(0,0,0,0.7)"]}
                          style={styles.imageOverlay}
                        >
                          <View style={styles.imageOverlayContent}>
                            <Ionicons name="camera" size={24} color="#fff" />
                            <Text style={styles.uploadText}>
                              Tap to change photo
                            </Text>
                          </View>
                        </LinearGradient>
                      </>
                    )}
                  </TouchableOpacity>

                  {/* Premium Images Section */}
                  {!uploadingImage && (
                    <>
                      <View style={styles.imageFilterHeader}>
                        <Text style={styles.premiumLabel}>
                          <Ionicons name="star" size={14} color="#FFD700" />{" "}
                          Premium Images
                        </Text>
                        <TouchableOpacity
                          onPress={() => setShowImageFilter(!showImageFilter)}
                        >
                          <Text style={styles.seeAllText}>
                            {showImageFilter ? "Hide" : "See All"}
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {showImageFilter && (
                        <>
                          {/* Image Filter */}
                          <View style={styles.imageFilterContainer}>
                            <ScrollView
                              horizontal
                              showsHorizontalScrollIndicator={false}
                              style={styles.imageFilterScroll}
                            >
                              <TouchableOpacity
                                style={[
                                  styles.imageFilterButton,
                                  imageFilter === "all" &&
                                    styles.imageFilterButtonActive,
                                ]}
                                onPress={() => setImageFilter("all")}
                              >
                                <Text
                                  style={[
                                    styles.imageFilterText,
                                    imageFilter === "all" &&
                                      styles.imageFilterTextActive,
                                  ]}
                                >
                                  All
                                </Text>
                              </TouchableOpacity>
                              {[
                                "Main Course",
                                "Appetizers",
                                "Beverages",
                                "Breakfast",
                              ].map((filter) => (
                                <TouchableOpacity
                                  key={filter}
                                  style={[
                                    styles.imageFilterButton,
                                    imageFilter === filter &&
                                      styles.imageFilterButtonActive,
                                  ]}
                                  onPress={() => setImageFilter(filter)}
                                >
                                  <Text
                                    style={[
                                      styles.imageFilterText,
                                      imageFilter === filter &&
                                        styles.imageFilterTextActive,
                                    ]}
                                  >
                                    {filter}
                                  </Text>
                                </TouchableOpacity>
                              ))}
                            </ScrollView>
                          </View>

                          {/* Image Grid */}
                          <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            style={styles.imageGrid}
                          >
                            {filteredImages.map((image) => (
                              <TouchableOpacity
                                key={image.id}
                                style={[
                                  styles.imageOption,
                                  selectedImage === image.uri &&
                                    !customImage &&
                                    styles.imageOptionSelected,
                                ]}
                                onPress={() => {
                                  Haptics.impactAsync(
                                    Haptics.ImpactFeedbackStyle.Light,
                                  );
                                  setSelectedImage(image.uri);
                                  setCustomImage(null);
                                }}
                              >
                                <Image
                                  source={{ uri: image.uri }}
                                  style={styles.imageOptionImage}
                                />
                                <LinearGradient
                                  colors={["transparent", "rgba(0,0,0,0.6)"]}
                                  style={styles.imageOptionLabel}
                                >
                                  <Text style={styles.imageOptionLabelText}>
                                    {image.label}
                                  </Text>
                                </LinearGradient>
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        </>
                      )}
                    </>
                  )}
                </View>

                {/* Basic Info */}
                <View style={styles.section}>
                  <Text style={styles.label}>
                    <Ionicons name="restaurant" size={16} color="#FF6B35" />{" "}
                    Basic Information
                  </Text>

                  <View style={styles.inputGroup}>
                    <View style={styles.inputHeader}>
                      <Text style={styles.inputLabel}>Dish Name *</Text>
                      <Text style={styles.charCount}>{charCount}/100</Text>
                    </View>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter dish name (e.g., Margherita Pizza)"
                      value={formData.name}
                      onChangeText={(text) => {
                        setFormData({ ...formData, name: text });
                        setCharCount(text.length);
                      }}
                      maxLength={100}
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Category</Text>
                    <TouchableOpacity
                      style={styles.categoryPickerButton}
                      onPress={() => setShowCategoryModal(true)}
                    >
                      <Ionicons name="pricetag" size={18} color="#6B7280" />
                      <Text style={styles.categoryPickerText}>
                        {formData?.category || "Select category"}
                      </Text>
                      <Ionicons name="chevron-down" size={18} color="#6B7280" />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Description</Text>
                    <TextInput
                      style={[styles.input, styles.textArea]}
                      placeholder="Describe your dish, ingredients, and special features..."
                      value={formData.description}
                      onChangeText={(text) =>
                        setFormData({ ...formData, description: text })
                      }
                      multiline
                      numberOfLines={3}
                      textAlignVertical="top"
                    />
                  </View>
                </View>
              </MotiView>
            )}

            {activeTab === "details" && (
              <MotiView
                from={{ opacity: 0, translateY: 20 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: "timing", duration: 300 }}
              >
                {/* Pricing */}
                <View style={styles.section}>
                  <Text style={styles.label}>
                    <Ionicons name="cash" size={16} color="#FF6B35" /> Pricing &
                    Details
                  </Text>

                  <View style={styles.pricingContainer}>
                    <Text style={styles.inputLabel}>Price (AED) *</Text>
                    <View style={styles.currencyInput}>
                      <Text style={styles.currencySymbol}>AED</Text>
                      <TextInput
                        style={styles.priceInput}
                        placeholder="0.00"
                        value={formData.price}
                        onChangeText={(text) =>
                          setFormData({ ...formData, price: text })
                        }
                        keyboardType="decimal-pad"
                      />
                    </View>
                  </View>

                  <View style={styles.detailsRow}>
                    <View style={styles.detailInput}>
                      <Text style={styles.inputLabel}>Prep Time</Text>
                      <View style={styles.unitInput}>
                        <TextInput
                          style={styles.unitInputField}
                          placeholder="15"
                          value={formData.preparation_time}
                          onChangeText={(text) =>
                            setFormData({ ...formData, preparation_time: text })
                          }
                          keyboardType="number-pad"
                        />
                        <Text style={styles.unitLabel}>mins</Text>
                      </View>
                    </View>

                    <View style={styles.detailInput}>
                      <Text style={styles.inputLabel}>Calories</Text>
                      <View style={styles.unitInput}>
                        <TextInput
                          style={styles.unitInputField}
                          placeholder="450"
                          value={formData.calories}
                          onChangeText={(text) =>
                            setFormData({ ...formData, calories: text })
                          }
                          keyboardType="number-pad"
                        />
                        <Text style={styles.unitLabel}>cal</Text>
                      </View>
                    </View>
                  </View>
                </View>

                {/* Popularity */}
                <View style={styles.section}>
                  <Text style={styles.label}>
                    <Ionicons name="trending-up" size={16} color="#FF6B35" />{" "}
                    Popularity Level
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.popularityScroll}
                  >
                    {POPULARITY_LEVELS.map((level) => (
                      <TouchableOpacity
                        key={level.id}
                        style={[
                          styles.popularityOption,
                          formData.popularity === level.id &&
                            styles.popularityOptionActive,
                        ]}
                        onPress={() => {
                          Haptics.impactAsync(
                            Haptics.ImpactFeedbackStyle.Light,
                          );
                          setFormData({ ...formData, popularity: level.id });
                        }}
                      >
                        <LinearGradient
                          colors={
                            formData.popularity === level.id
                              ? [level.color, `${level.color}80`]
                              : ["#F3F4F6", "#F3F4F6"]
                          }
                          style={styles.popularityGradient}
                        >
                          <Text
                            style={[
                              styles.popularityText,
                              formData.popularity === level.id &&
                                styles.popularityTextActive,
                            ]}
                          >
                            {level.name}
                          </Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                {renderSpiceLevel()}
              </MotiView>
            )}

            {activeTab === "extras" && (
              <MotiView
                from={{ opacity: 0, translateY: 20 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: "timing", duration: 300 }}
              >
                {/* Dietary Tags */}
                <View style={styles.section}>
                  <Text style={styles.label}>
                    <Ionicons name="nutrition" size={16} color="#FF6B35" />{" "}
                    Dietary Information
                  </Text>
                  <View style={styles.tagsContainer}>
                    {ENHANCED_DIETARY_TAGS.map((tag) => (
                      <TouchableOpacity
                        key={tag.id}
                        style={[
                          styles.tagOption,
                          formData.dietary_tags.includes(tag.id) &&
                            styles.tagOptionSelected,
                        ]}
                        onPress={() => toggleDietaryTag(tag.id)}
                      >
                        <LinearGradient
                          colors={
                            formData.dietary_tags.includes(tag.id)
                              ? [tag.color, `${tag.color}80`]
                              : ["#F3F4F6", "#F3F4F6"]
                          }
                          style={styles.tagGradient}
                        >
                          <Text style={styles.tagEmoji}>{tag.emoji}</Text>
                          <Text
                            style={[
                              styles.tagOptionText,
                              formData.dietary_tags.includes(tag.id) &&
                                styles.tagOptionTextSelected,
                            ]}
                          >
                            {tag.name.split(" ")[1]}
                          </Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Allergens */}
                {renderAllergens()}

                {/* Ingredients */}
                <View style={styles.section}>
                  <View style={styles.inputHeader}>
                    <Text style={styles.label}>
                      <Ionicons name="list" size={16} color="#FF6B35" /> Key
                      Ingredients
                    </Text>
                    <TouchableOpacity
                      style={styles.ingredientsButton}
                      onPress={() => setShowIngredientsModal(true)}
                    >
                      <Ionicons name="add-circle" size={16} color="#FF6B35" />
                      <Text style={styles.ingredientsButtonText}>
                        Add Ingredients
                      </Text>
                    </TouchableOpacity>
                  </View>
                  {formData.ingredients ? (
                    <View style={styles.ingredientsPreview}>
                      <Text
                        style={styles.ingredientsPreviewText}
                        numberOfLines={2}
                      >
                        {formData.ingredients}
                      </Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.ingredientsPlaceholder}
                      onPress={() => setShowIngredientsModal(true)}
                    >
                      <Ionicons
                        name="add-circle-outline"
                        size={24}
                        color="#D1D5DB"
                      />
                      <Text style={styles.ingredientsPlaceholderText}>
                        Add key ingredients
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </MotiView>
            )}

            {/* Submit Button (shown on all tabs) */}
            <TouchableOpacity
              style={[
                styles.submitButton,
                (loading || uploadingImage) && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={loading || uploadingImage}
            >
              <LinearGradient
                colors={["#10B981", "#059669"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.submitButtonGradient}
              >
                {loading ? (
                  <>
                    <MotiView
                      animate={{ rotate: "360deg" }}
                      transition={{
                        type: "timing",
                        duration: 1000,
                        loop: true,
                      }}
                    >
                      <Ionicons name="refresh" size={18} color="#fff" />
                    </MotiView>
                    <Text style={styles.submitButtonText}>Creating...</Text>
                  </>
                ) : uploadingImage ? (
                  <>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={styles.submitButtonText}>Uploading...</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="restaurant" size={18} color="#fff" />
                    <Text style={styles.submitButtonText}>Add to Menu</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        </Animated.View>

        {/* Category Modal */}
        <Modal
          visible={showCategoryModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowCategoryModal(false)}
        >
          <BlurView intensity={50} tint="dark" style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Category</Text>
                <TouchableOpacity
                  onPress={() => setShowCategoryModal(false)}
                  style={styles.closeButtonCircle}
                >
                  <Ionicons name="close" size={20} color="#374151" />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.modalScroll}>
                {ENHANCED_CATEGORIES.map((category) => (
                  <TouchableOpacity
                    key={category.id}
                    style={[
                      styles.modalCategoryOption,
                      formData.category === category.name &&
                        styles.modalCategoryOptionSelected,
                    ]}
                    onPress={() => {
                      setFormData({ ...formData, category: category.name });
                      setShowCategoryModal(false);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                  >
                    <View
                      style={[
                        styles.categoryIcon,
                        { backgroundColor: `${category.color}20` },
                      ]}
                    >
                      <Text style={styles.categoryIconText}>
                        {category.name.split(" ")[0]}
                      </Text>
                    </View>
                    <Text style={styles.modalCategoryText}>
                      {category.name}
                    </Text>
                    {formData.category === category.name && (
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color={category.color}
                      />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </BlurView>
        </Modal>

        {/* Ingredients Modal */}
        <Modal
          visible={showIngredientsModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowIngredientsModal(false)}
        >
          <BlurView intensity={50} tint="dark" style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add Ingredients</Text>
                <TouchableOpacity
                  onPress={() => setShowIngredientsModal(false)}
                  style={styles.closeButtonCircle}
                >
                  <Ionicons name="close" size={20} color="#374151" />
                </TouchableOpacity>
              </View>
              <View style={styles.ingredientsModalContent}>
                <Text style={styles.modalSubtitle}>
                  Separate ingredients with commas
                </Text>
                <TextInput
                  style={styles.ingredientsInput}
                  placeholder="e.g., Tomato, Mozzarella, Basil, Olive Oil..."
                  value={formData.ingredients}
                  onChangeText={(text) =>
                    setFormData({ ...formData, ingredients: text })
                  }
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
                <View style={styles.ingredientsExamples}>
                  <Text style={styles.examplesTitle}>Common Ingredients:</Text>
                  <View style={styles.examplesTags}>
                    {[
                      "Tomato",
                      "Cheese",
                      "Chicken",
                      "Rice",
                      "Pasta",
                      "Garlic",
                      "Onion",
                    ].map((ing) => (
                      <TouchableOpacity
                        key={ing}
                        style={styles.exampleTag}
                        onPress={() => {
                          const current = formData.ingredients
                            ? `${formData.ingredients}, ${ing}`
                            : ing;
                          setFormData({ ...formData, ingredients: current });
                        }}
                      >
                        <Text style={styles.exampleTagText}>{ing}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.ingredientsDoneButton}
                  onPress={() => {
                    setShowIngredientsModal(false);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                >
                  <LinearGradient
                    colors={["#10B981", "#059669"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.ingredientsDoneButtonGradient}
                  >
                    <Text style={styles.ingredientsDoneButtonText}>
                      Save Ingredients
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </BlurView>
        </Modal>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    marginBottom: Platform.OS === "ios" ? 0 : -22,
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
  backButtonCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitleContainer: {
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
    fontWeight: "500",
  },
  helpButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  tabContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    position: "relative",
  },
  tabButtonActive: {
    borderBottomWidth: 3,
    borderBottomColor: "#10B981",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
  },
  tabTextActive: {
    color: "#10B981",
  },
  tabIndicator: {
    position: "absolute",
    bottom: -3,
    width: "100%",
    height: 3,
    backgroundColor: "#10B981",
    borderRadius: 2,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 4,
  },
  charCount: {
    fontSize: 12,
    color: "#9CA3AF",
    fontWeight: "500",
  },
  mainImageContainer: {
    height: 200,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 16,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  mainImage: {
    width: "100%",
    height: "100%",
  },
  imageOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    justifyContent: "center",
    alignItems: "center",
  },
  imageOverlayContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  uploadText: {
    color: "#E5E7EB",
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 18,
    letterSpacing: 0.2,
  },
  uploadingContainer: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
  },
  uploadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "500",
  },
  imageFilterHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  premiumLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  seeAllText: {
    fontSize: 12,
    color: "#10B981",
    fontWeight: "600",
  },
  imageFilterContainer: {
    marginBottom: 16,
  },
  imageFilterScroll: {
    flexDirection: "row",
  },
  imageFilterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    marginRight: 10,
  },
  imageFilterButtonActive: {
    backgroundColor: "#10B981",
  },
  imageFilterText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#6B7280",
  },
  imageFilterTextActive: {
    color: "#FFFFFF",
  },
  imageGrid: {
    flexDirection: "row",
  },
  imageOption: {
    width: 100,
    height: 80,
    marginRight: 12,
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
  },
  imageOptionSelected: {
    borderWidth: 2,
    borderColor: "#10B981",
  },
  imageOptionImage: {
    width: "100%",
    height: "100%",
  },
  imageOptionLabel: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  imageOptionLabelText: {
    color: "#E5E7EB",
    fontSize: 12,
    fontWeight: "600",
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 0.3,
    borderColor: "#6B7280",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: "#111827",
    fontWeight: "400",
  },
  textArea: {
    minHeight: 100,
    paddingTop: 14,
    lineHeight: 20,
  },
  categoryPickerButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
  },
  categoryPickerText: {
    flex: 1,
    fontSize: 15,
    color: "#111827",
    fontWeight: "400",
  },
  pricingContainer: {
    marginBottom: 24,
  },
  currencyInput: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    borderWidth: 0.4,
    borderColor: "#6B7280",
    overflow: "hidden",
  },
  currencySymbol: {
    paddingHorizontal: 16,
    fontSize: 16,
    fontWeight: "600",
    color: "#6B7280",
    backgroundColor: "#F3F4F6",
    height: "100%",
    textAlignVertical: "center",
  },
  priceInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  detailsRow: {
    flexDirection: "row",
    gap: 16,
  },
  detailInput: {
    flex: 1,
  },
  unitInput: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    borderWidth: 0.3,
    borderColor: "#6B7280",
    overflow: "hidden",
  },
  unitInputField: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  unitLabel: {
    paddingHorizontal: 16,
    fontSize: 14,
    fontWeight: "500",
    color: "#6B7280",
    backgroundColor: "#F3F4F6",
  },
  popularityScroll: {
    flexDirection: "row",
  },
  popularityOption: {
    marginRight: 12,
    borderRadius: 12,
    overflow: "hidden",
    minWidth: 100,
  },
  popularityOptionActive: {
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  popularityGradient: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  popularityText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
  },
  popularityTextActive: {
    color: "#FFFFFF",
  },
  spiceLevelContainer: {
    marginBottom: 24,
  },
  spiceLevelSelector: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  spiceLevelOption: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: 2,
  },
  spiceLevelOptionActive: {
    backgroundColor: "#FF6B3515",
    borderWidth: 2,
    borderColor: "#FF6B35",
  },
  noSpiceOption: {
    backgroundColor: "#10B98115",
  },
  spiceLevelLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 8,
  },
  spiceLabel: {
    fontSize: 10,
    color: "#6B7280",
    fontWeight: "500",
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tagOption: {
    borderRadius: 20,
    overflow: "hidden",
  },
  tagOptionSelected: {
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  tagGradient: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  tagEmoji: {
    fontSize: 14,
  },
  tagOptionText: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "500",
  },
  tagOptionTextSelected: {
    color: "#FFFFFF",
  },
  allergensContainer: {
    marginBottom: 24,
  },
  allergensGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  allergenOption: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  allergenOptionSelected: {
    backgroundColor: "#EF444415",
    borderColor: "#EF4444",
  },
  allergenText: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "500",
  },
  allergenTextSelected: {
    color: "#EF4444",
  },
  ingredientsButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#10B98110",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#10B98130",
  },
  ingredientsButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#10B981",
  },
  ingredientsPreview: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
  },
  ingredientsPreviewText: {
    fontSize: 14,
    color: "#374151",
    lineHeight: 20,
  },
  ingredientsPlaceholder: {
    backgroundColor: "#F9FAFB",
    borderWidth: 2,
    borderColor: "#E5E7EB",
    borderStyle: "dashed",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
  },
  ingredientsPlaceholderText: {
    fontSize: 14,
    color: "#9CA3AF",
    marginTop: 8,
    fontWeight: "500",
  },
  submitButton: {
    borderRadius: 12,
    overflow: "hidden",
    elevation: 4,
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    marginTop: 8,
    marginBottom: 16,
  },
  submitButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 10,
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    maxHeight: "80%",
    paddingBottom: Platform.OS === "ios" ? 40 : 20,
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
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
    letterSpacing: -0.01,
  },
  closeButtonCircle: {
    width: 32,
    height: 32,
    borderRadius: 18,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  modalScroll: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  modalCategoryOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    gap: 12,
  },
  modalCategoryOptionSelected: {
    backgroundColor: "#10B98105",
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  categoryIconText: {
    fontSize: 20,
  },
  modalCategoryText: {
    flex: 1,
    fontSize: 16,
    fontWeight: "500",
    color: "#374151",
  },
  ingredientsModalContent: {
    padding: 20,
  },
  modalSubtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 12,
  },
  ingredientsInput: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    color: "#111827",
    minHeight: 100,
    marginBottom: 12,
    textAlignVertical: "top",
  },
  ingredientsExamples: {
    marginBottom: 24,
  },
  examplesTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 8,
  },
  examplesTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  exampleTag: {
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  exampleTagText: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "500",
  },
  ingredientsDoneButton: {
    borderRadius: 12,
    overflow: "hidden",
  },
  ingredientsDoneButtonGradient: {
    paddingVertical: 16,
    alignItems: "center",
  },
  ingredientsDoneButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});
