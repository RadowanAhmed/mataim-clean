// app/(restaurant)/posts/create.tsx
import { useAuth } from "@/backend/AuthContext";
import { supabase } from "@/backend/supabase";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { MotiText, MotiView } from "moti";
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

import { useRestaurantSetupCheck } from "@/backend/helper/useRestaurantSetupCheck";

// Configure Cloudinary
const CLOUDINARY_CLOUD_NAME = "dz1arsa91";
const CLOUDINARY_UPLOAD_PRESET = "mataim_profile_preset";

// Premium Unsplash images with better quality
const PREMIUM_IMAGES = [
  {
    id: 1,
    uri: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&h=600&fit=crop",
    label: "Pizza",
    category: "food",
  },
  {
    id: 2,
    uri: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&h=600&fit=crop",
    label: "Burger",
    category: "food",
  },
  {
    id: 3,
    uri: "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=800&h=600&fit=crop",
    label: "Mexican",
    category: "food",
  },
  {
    id: 4,
    uri: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&h=600&fit=crop",
    label: "BBQ",
    category: "food",
  },
  {
    id: 5,
    uri: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&h=600&fit=crop",
    label: "Healthy",
    category: "food",
  },
  {
    id: 6,
    uri: "https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?w=800&h=600&fit=crop",
    label: "Event",
    category: "event",
  },
];

// Enhanced tags with emojis
const ENHANCED_TAGS = {
  food: [
    { name: "🍃 Vegan", value: "Vegan" },
    { name: "🌾 Gluten-Free", value: "Gluten-Free" },
    { name: "🌶️ Spicy", value: "Spicy" },
    { name: "🌿 Vegetarian", value: "Vegetarian" },
    { name: "🦴 Halal", value: "Halal" },
    { name: "🥛 Dairy-Free", value: "Dairy-Free" },
    { name: "🥜 Nut-Free", value: "Nut-Free" },
    { name: "🔥 Hot Deal", value: "Hot Deal" },
  ],
  promotion: [
    { name: "⏰ Limited Time", value: "Limited Time" },
    { name: "🎁 Special Offer", value: "Special Offer" },
    { name: "🍻 Happy Hour", value: "Happy Hour" },
    { name: "👥 BOGO", value: "Buy One Get One" },
    { name: "💰 Discount", value: "Discount" },
    { name: "🎟️ Early Bird", value: "Early Bird" },
    { name: "💳 Card Discount", value: "Card Discount" },
    { name: "🏷️ Flash Sale", value: "Flash Sale" },
  ],
  announcement: [
    { name: "📢 New Menu", value: "New Menu" },
    { name: "🏗️ Renovation", value: "Renovation" },
    { name: "👨‍🍳 New Chef", value: "New Chef" },
    { name: "🎉 Grand Opening", value: "Grand Opening" },
    { name: "🕒 Holiday Hours", value: "Holiday Hours" },
    { name: "📝 Hiring", value: "Hiring" },
    { name: "⭐ Michelin", value: "Michelin Award" },
  ],
  event: [
    { name: "🎵 Live Music", value: "Live Music" },
    { name: "🎭 Trivia Night", value: "Trivia Night" },
    { name: "👨‍🍳 Cooking Class", value: "Cooking Class" },
    { name: "🎂 Birthday", value: "Birthday Party" },
    { name: "💃 Dance Night", value: "Dance Night" },
    { name: "🎤 Karaoke", value: "Karaoke" },
    { name: "🎪 Festival", value: "Festival" },
  ],
};

const TAG_CATEGORIES = [
  { id: "popular", name: "🔥 Popular" },
  { id: "dietary", name: "🥗 Dietary" },
  { id: "timing", name: "⏰ Timing" },
  { id: "special", name: "⭐ Special" },
];

export default function CreatePostScreen() {
  const router = useRouter();
  const { user } = useAuth();
  useRestaurantSetupCheck("posts");

  const [activeStep, setActiveStep] = useState(1);
  const totalSteps = 4;

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    post_type: "food",
    original_price: "",
    discount_percentage: "",
    available_until: "",
    tags: "",
  });

  const [selectedImage, setSelectedImage] = useState(PREMIUM_IMAGES[0].uri);
  const [customImage, setCustomImage] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [loading, setLoading] = useState(false);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [fetchingRestaurant, setFetchingRestaurant] = useState(true);
  const [isRestaurantUser, setIsRestaurantUser] = useState(false);
  const [showTagsModal, setShowTagsModal] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [activeTagCategory, setActiveTagCategory] = useState("popular");
  const [charCount, setCharCount] = useState(0);
  const [showImageFilter, setShowImageFilter] = useState(false);
  const [imageFilter, setImageFilter] = useState("all");
  const fadeAnim = useRef(new Animated.Value(0)).current;

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
        const { data: restaurant } = await supabase
          .from("restaurants")
          .select("setup_completed")
          .eq("id", user.id)
          .single();

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
      }
    };

    checkSetupComplete();
  }, [user]);

  useEffect(() => {
    const fetchRestaurantId = async () => {
      if (!user?.id) {
        setFetchingRestaurant(false);
        return;
      }

      try {
        // Check if user is a restaurant
        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("user_type")
          .eq("id", user.id)
          .single();

        if (userError || userData?.user_type !== "restaurant") {
          setIsRestaurantUser(false);
          setFetchingRestaurant(false);
          Alert.alert(
            "Access Denied",
            "Only restaurant accounts can create posts.",
            [
              {
                text: "OK",
                onPress: () => {
                  Haptics.notificationAsync(
                    Haptics.NotificationFeedbackType.Error,
                  );
                  router.back();
                },
              },
            ],
          );
          return;
        }

        setIsRestaurantUser(true);

        // Check if restaurant setup is complete
        const { data: restaurantData, error: restaurantError } = await supabase
          .from("restaurants")
          .select("id, setup_completed, restaurant_name")
          .eq("id", user.id)
          .single();

        if (restaurantError) {
          console.error("Error fetching restaurant:", restaurantError);
          Alert.alert(
            "Restaurant Profile Required",
            "Please complete your restaurant profile setup before creating posts.",
            [
              {
                text: "Complete Profile",
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
          setFetchingRestaurant(false);
          return;
        }

        // Check if setup is completed
        if (!restaurantData?.setup_completed) {
          Alert.alert(
            "Setup Required",
            "Please complete your restaurant profile setup to create posts.",
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
          setFetchingRestaurant(false);
          return;
        }

        // Setup is complete, set restaurant ID
        setRestaurantId(restaurantData.id);
        setFetchingRestaurant(false);
      } catch (error: any) {
        console.error("Unexpected error:", error);
        Alert.alert(
          "Error",
          "Unable to verify restaurant account. Please try again.",
        );
        setFetchingRestaurant(false);
      }
    };

    fetchRestaurantId();
  }, [user?.id]);

  const uploadImageToCloudinary = async (asset: any) => {
    if (!user?.id) return null;

    try {
      setUploadingImage(true);

      const formData = new FormData();
      formData.append("file", {
        uri: asset.uri,
        type: "image/jpeg",
        name: `post-${user.id}-${Date.now()}.jpg`,
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
      aspect: [16, 9],
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
      aspect: [16, 9],
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
    Alert.alert("Add Post Photo", "Choose an option", [
      { text: "Take Photo", onPress: takePhoto },
      { text: "Choose from Library", onPress: pickImage },
      { text: "Use Premium Image", onPress: () => setShowImageFilter(true) },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const parseTagsString = (tagsString: string): string[] => {
    return tagsString
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);
  };

  const updateTags = (tagsString: string) => {
    setFormData({ ...formData, tags: tagsString });
    const parsedTags = parseTagsString(tagsString);
    setSelectedTags(parsedTags);
  };

  const addTag = (tag: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const currentTags = parseTagsString(formData.tags);
    if (!currentTags.includes(tag)) {
      const newTags = [...currentTags, tag];
      const newTagsString = newTags.join(", ");
      updateTags(newTagsString);
    }
  };

  const removeTag = (tagToRemove: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const currentTags = parseTagsString(formData.tags);
    const newTags = currentTags.filter((tag) => tag !== tagToRemove);
    const newTagsString = newTags.join(", ");
    updateTags(newTagsString);
  };

  const handleDateChange = (event: any, date?: Date) => {
    setShowDatePicker(false);
    if (date) {
      setSelectedDate(date);
      const formattedDate = date.toISOString().split("T")[0];
      setFormData({ ...formData, available_until: formattedDate });
    }
  };

  const calculateDiscountedPrice = () => {
    if (!formData.original_price || !formData.discount_percentage) return null;
    const original = parseFloat(formData.original_price);
    const discount = parseFloat(formData.discount_percentage);
    if (isNaN(original) || isNaN(discount)) return null;
    return original * (1 - discount / 100);
  };

  const getTagSuggestions = () => {
    const allTags = [
      ...ENHANCED_TAGS[formData.post_type as keyof typeof ENHANCED_TAGS],
      ...ENHANCED_TAGS.food,
      ...ENHANCED_TAGS.promotion,
    ];

    const uniqueTags = Array.from(
      new Map(allTags.map((tag) => [tag.value, tag])).values(),
    );

    return uniqueTags.filter((tag) => !selectedTags.includes(tag.value));
  };

  const filteredImages =
    imageFilter === "all"
      ? PREMIUM_IMAGES
      : PREMIUM_IMAGES.filter((img) => img.category === imageFilter);

  const handleNextStep = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (activeStep < totalSteps) {
      setActiveStep(activeStep + 1);
    }
  };

  const handlePrevStep = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (activeStep > 1) {
      setActiveStep(activeStep - 1);
    }
  };

  const handleSubmit = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (!formData.title.trim()) {
      Alert.alert("Error", "Please enter a title");
      return;
    }

    if (!restaurantId) {
      Alert.alert(
        "Error",
        "Please complete your restaurant profile before creating posts.",
      );
      return;
    }

    // Double-check setup completion before creating post
    try {
      const { data: restaurantCheck } = await supabase
        .from("restaurants")
        .select("setup_completed")
        .eq("id", restaurantId)
        .single();

      if (!restaurantCheck?.setup_completed) {
        Alert.alert(
          "Setup Required",
          "Please complete your restaurant profile setup to create posts.",
          [
            {
              text: "Complete Setup",
              onPress: () =>
                router.replace({
                  pathname: "/(restaurant)/setup",
                  params: { userId: user?.id },
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

      const discountedPrice = calculateDiscountedPrice();
      const tagsArray = parseTagsString(formData.tags);

      const postData = {
        restaurant_id: restaurantId,
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        image_url: selectedImage,
        post_type: formData.post_type,
        discount_percentage: formData.discount_percentage
          ? parseFloat(formData.discount_percentage)
          : null,
        original_price: formData.original_price
          ? parseFloat(formData.original_price)
          : null,
        discounted_price: discountedPrice,
        available_until: formData.available_until || null,
        tags: tagsArray,
        is_active: true,
      };

      Object.keys(postData).forEach((key) => {
        if (postData[key] === null) {
          delete postData[key];
        }
      });

      const { data, error } = await supabase
        .from("posts")
        .insert([postData])
        .select("post_number")
        .single();

      if (error) throw error;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      Alert.alert(
        "🎉 Success!",
        `Post #${data.post_number} created successfully`,
        [
          {
            text: "View Posts",
            onPress: () => router.push("/(restaurant)/posts"),
          },
          {
            text: "Create Another",
            style: "default",
            onPress: () => {
              // Reset form
              setFormData({
                title: "",
                description: "",
                post_type: "food",
                original_price: "",
                discount_percentage: "",
                available_until: "",
                tags: "",
              });
              setSelectedTags([]);
              setSelectedImage(PREMIUM_IMAGES[0].uri);
              setCustomImage(null);
              setActiveStep(1);
            },
          },
        ],
      );
    } catch (error: any) {
      console.error("Error creating post:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      let errorMessage = "Failed to create post";
      if (error.message.includes("duplicate key")) {
        errorMessage = "A post with similar details already exists";
      } else if (error.code === "23503") {
        errorMessage = "Please complete your restaurant profile first";
      }

      Alert.alert("Error", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const renderStepIndicator = () => (
    <View>
      <View style={styles.stepContainer}>
        {[...Array(totalSteps)].map((_, index) => (
          <View key={index} style={styles.stepRow}>
            <View
              style={[
                styles.stepCircle,
                activeStep > index + 1 && styles.stepCircleCompleted,
                activeStep === index + 1 && styles.stepCircleActive,
              ]}
            >
              {activeStep > index + 1 ? (
                <Ionicons name="checkmark" size={14} color="#fff" />
              ) : (
                <Text
                  style={[
                    styles.stepNumber,
                    activeStep === index + 1 && styles.stepNumberActive,
                  ]}
                >
                  {index + 1}
                </Text>
              )}
            </View>
            {index < totalSteps - 1 && (
              <View
                style={[
                  styles.stepLine,
                  activeStep > index + 1 && styles.stepLineCompleted,
                ]}
              />
            )}
          </View>
        ))}
      </View>
      <View style={styles.stepLabels}>
        <Text style={styles.stepLabel}>Basic</Text>
        <Text style={styles.stepLabel}>Details</Text>
        <Text style={styles.stepLabel}>Pricing</Text>
        <Text style={styles.stepLabel}>Finalize</Text>
      </View>
    </View>
  );

  const renderStepContent = () => {
    switch (activeStep) {
      case 1:
        return (
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: "timing", duration: 300 }}
          >
            <View style={styles.section}>
              <Text style={styles.label}>
                <Ionicons name="images" size={16} color="#FF6B35" /> Choose
                Image
              </Text>

              {/* Main Image Display */}
              <TouchableOpacity
                style={styles.mainImageContainer}
                onPress={showImageOptions}
                activeOpacity={0.9}
                disabled={uploadingImage}
              >
                {uploadingImage ? (
                  <View style={styles.uploadingContainer}>
                    <ActivityIndicator size="large" color="#FF6B35" />
                    <Text style={styles.uploadingText}>Uploading image...</Text>
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
                      <Ionicons name="star" size={14} color="#FFD700" /> Premium
                      Images
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
                          {["food", "event"].map((filter) => (
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
                                {filter.charAt(0).toUpperCase() +
                                  filter.slice(1)}
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

            {/* Post Type */}
            <View style={styles.section}>
              <Text style={styles.label}>
                <Ionicons name="pricetag" size={16} color="#FF6B35" /> Post Type
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.typeScroll}
              >
                {[
                  { key: "food", icon: "restaurant", label: "Food" },
                  { key: "promotion", icon: "flash", label: "Promotion" },
                  { key: "announcement", icon: "megaphone", label: "News" },
                  { key: "event", icon: "calendar", label: "Event" },
                ].map((type) => (
                  <TouchableOpacity
                    key={type.key}
                    style={[
                      styles.typeCard,
                      formData.post_type === type.key && styles.typeCardActive,
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setFormData({ ...formData, post_type: type.key });
                    }}
                  >
                    <LinearGradient
                      colors={
                        formData.post_type === type.key
                          ? ["#FF6B35", "#FF8B35"]
                          : ["#F3F4F6", "#F3F4F6"]
                      }
                      style={styles.typeIconContainer}
                    >
                      <Ionicons
                        name={type.icon}
                        size={20}
                        color={
                          formData.post_type === type.key ? "#fff" : "#6B7280"
                        }
                      />
                    </LinearGradient>
                    <Text
                      style={[
                        styles.typeCardLabel,
                        formData.post_type === type.key &&
                          styles.typeCardLabelActive,
                      ]}
                    >
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </MotiView>
        );

      case 2:
        return (
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: "timing", duration: 300 }}
          >
            {/* Title */}
            <View style={styles.inputGroup}>
              <View style={styles.inputHeader}>
                <Text style={styles.label}>
                  <Ionicons name="text" size={16} color="#FF6B35" /> Title *
                </Text>
                <Text style={styles.charCount}>{charCount}/200</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder="Enter a catchy title..."
                value={formData.title}
                onChangeText={(text) => {
                  setFormData({ ...formData, title: text });
                  setCharCount(text.length);
                }}
                maxLength={200}
              />
            </View>

            {/* Description */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                <Ionicons name="document-text" size={16} color="#FF6B35" />{" "}
                Description
              </Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Describe your post in detail..."
                value={formData.description}
                onChangeText={(text) =>
                  setFormData({ ...formData, description: text })
                }
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
              <Text style={styles.helperText}>
                Share details, ingredients, or special notes
              </Text>
            </View>
          </MotiView>
        );

      case 3:
        return (
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: "timing", duration: 300 }}
          >
            {(formData.post_type === "food" ||
              formData.post_type === "promotion") && (
              <>
                <View style={styles.pricingContainer}>
                  <Text style={styles.label}>
                    <Ionicons name="cash" size={16} color="#FF6B35" /> Pricing
                  </Text>

                  <View style={styles.priceInputRow}>
                    <View style={styles.priceInputGroup}>
                      <Text style={styles.priceLabel}>Original Price</Text>
                      <View style={styles.currencyInput}>
                        <Text style={styles.currencySymbol}>AED</Text>
                        <TextInput
                          style={styles.priceInput}
                          placeholder="0.00"
                          value={formData.original_price}
                          onChangeText={(text) =>
                            setFormData({ ...formData, original_price: text })
                          }
                          keyboardType="decimal-pad"
                        />
                      </View>
                    </View>

                    <View style={styles.priceInputGroup}>
                      <Text style={styles.priceLabel}>Discount</Text>
                      <View style={styles.currencyInput}>
                        <TextInput
                          style={styles.priceInput}
                          placeholder="0"
                          value={formData.discount_percentage}
                          onChangeText={(text) =>
                            setFormData({
                              ...formData,
                              discount_percentage: text,
                            })
                          }
                          keyboardType="decimal-pad"
                          maxLength={3}
                        />
                        <Text style={styles.currencySymbol}>%</Text>
                      </View>
                    </View>
                  </View>

                  {formData.original_price && formData.discount_percentage && (
                    <View style={styles.priceResult}>
                      <Text style={styles.priceResultLabel}>Final Price:</Text>
                      <View style={styles.priceResultValue}>
                        <Text style={styles.finalPrice}>
                          AED {calculateDiscountedPrice()?.toFixed(2) || "0.00"}
                        </Text>
                        <View style={styles.savingsBadge}>
                          <Text style={styles.savingsText}>
                            Save {formData.discount_percentage}%
                          </Text>
                        </View>
                      </View>
                    </View>
                  )}
                </View>
              </>
            )}

            {/* Available Until */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                <Ionicons name="calendar" size={16} color="#FF6B35" /> Available
                Until
              </Text>
              <TouchableOpacity
                style={styles.datePickerButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowDatePicker(true);
                }}
              >
                <Ionicons name="calendar-outline" size={18} color="#6B7280" />
                <Text style={styles.dateText}>
                  {selectedDate
                    ? selectedDate.toLocaleDateString()
                    : "Select end date"}
                </Text>
                <Ionicons name="chevron-down" size={18} color="#6B7280" />
              </TouchableOpacity>
              <Text style={styles.helperText}>
                Leave empty for no expiration date
              </Text>
            </View>
          </MotiView>
        );

      case 4:
        return (
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: "timing", duration: 300 }}
          >
            {/* Tags */}
            <View style={styles.inputGroup}>
              <View style={styles.tagsHeader}>
                <Text style={styles.label}>
                  <Ionicons name="pricetags" size={16} color="#FF6B35" /> Tags
                  (Optional)
                </Text>
                <TouchableOpacity
                  style={styles.browseTagsButton}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setShowTagsModal(true);
                  }}
                >
                  <Ionicons name="add-circle" size={16} color="#FF6B35" />
                  <Text style={styles.browseTagsText}>Add Tags</Text>
                </TouchableOpacity>
              </View>

              {selectedTags.length > 0 && (
                <View style={styles.selectedTagsContainer}>
                  {selectedTags.map((tag, index) => (
                    <MotiView
                      key={index}
                      from={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: index * 50 }}
                    >
                      <View style={styles.selectedTag}>
                        <Text style={styles.selectedTagText}>{tag}</Text>
                        <TouchableOpacity
                          onPress={() => removeTag(tag)}
                          style={styles.removeTagButton}
                        >
                          <Ionicons name="close" size={14} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    </MotiView>
                  ))}
                </View>
              )}

              <Text style={styles.helperText}>
                Tags help customers discover your post
              </Text>
            </View>

            {/* Preview Card */}
            <View style={styles.previewSection}>
              <Text style={styles.label}>
                <Ionicons name="eye" size={16} color="#FF6B35" /> Preview
              </Text>
              <View style={styles.previewCard}>
                <Image
                  source={{ uri: selectedImage }}
                  style={styles.previewImage}
                />
                <View style={styles.previewContent}>
                  <View style={styles.previewHeader}>
                    <View style={styles.previewTypeBadge}>
                      <Text style={styles.previewTypeText}>
                        {formData.post_type.toUpperCase()}
                      </Text>
                    </View>
                    {formData.discount_percentage && (
                      <View style={styles.previewDiscountBadge}>
                        <Text style={styles.previewDiscountText}>
                          {formData.discount_percentage}% OFF
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.previewTitle} numberOfLines={2}>
                    {formData.title || "Your post title will appear here"}
                  </Text>
                  {formData.description && (
                    <Text style={styles.previewDescription} numberOfLines={2}>
                      {formData.description}
                    </Text>
                  )}
                  {(formData.original_price ||
                    formData.discount_percentage) && (
                    <View style={styles.previewPricing}>
                      {formData.original_price && (
                        <Text style={styles.previewOriginalPrice}>
                          AED {formData.original_price}
                        </Text>
                      )}
                      {calculateDiscountedPrice() && (
                        <Text style={styles.previewDiscountedPrice}>
                          AED {calculateDiscountedPrice()?.toFixed(2)}
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              </View>
            </View>
          </MotiView>
        );
    }
  };

  if (fetchingRestaurant) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
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
            Loading restaurant profile...
          </MotiText>
        </View>
      </SafeAreaView>
    );
  }

  if (!isRestaurantUser) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="restaurant-outline" size={64} color="#FF6B35" />
          <Text style={styles.errorTitle}>Access Restricted</Text>
          <Text style={styles.errorText}>
            Only restaurant accounts can create posts
          </Text>
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
                <Text style={styles.headerTitle}>Create Post</Text>
                <Text style={styles.headerSubtitle}>
                  Step {activeStep} of {totalSteps}
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
            {renderStepIndicator()}
          </BlurView>

          {/* Content */}
          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {renderStepContent()}
          </ScrollView>

          {/* Navigation Buttons */}
          <View style={styles.navigationContainer}>
            {activeStep > 1 && (
              <TouchableOpacity
                style={styles.prevButton}
                onPress={handlePrevStep}
              >
                <Ionicons name="arrow-back" size={18} color="#374151" />
                <Text style={styles.prevButtonText}>Back</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[
                styles.nextButton,
                (loading || uploadingImage) && styles.nextButtonDisabled,
              ]}
              onPress={
                activeStep === totalSteps ? handleSubmit : handleNextStep
              }
              disabled={loading || uploadingImage}
            >
              <LinearGradient
                colors={["#FF6B35", "#FF8B35"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.nextButtonGradient}
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
                    <Text style={styles.nextButtonText}>Creating...</Text>
                  </>
                ) : uploadingImage ? (
                  <>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={styles.nextButtonText}>Uploading...</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.nextButtonText}>
                      {activeStep === totalSteps ? "Publish Post" : "Continue"}
                    </Text>
                    <Ionicons name="arrow-forward" size={18} color="#fff" />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Date Picker Modal */}
        {showDatePicker && (
          <DateTimePicker
            value={selectedDate || new Date()}
            mode="date"
            display="spinner"
            onChange={handleDateChange}
            minimumDate={new Date()}
          />
        )}

        {/* Enhanced Tags Modal */}
        <Modal
          visible={showTagsModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowTagsModal(false)}
        >
          <BlurView intensity={50} tint="dark" style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>Add Tags</Text>
                  <Text style={styles.modalSubtitle}>
                    Select relevant tags for your post
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setShowTagsModal(false)}
                  style={styles.closeButtonCircle}
                >
                  <Ionicons name="close" size={20} color="#374151" />
                </TouchableOpacity>
              </View>

              {/* Tag Categories */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.tagCategories}
              >
                {TAG_CATEGORIES.map((category) => (
                  <TouchableOpacity
                    key={category.id}
                    style={[
                      styles.tagCategoryButton,
                      activeTagCategory === category.id &&
                        styles.tagCategoryButtonActive,
                    ]}
                    onPress={() => setActiveTagCategory(category.id)}
                  >
                    <Text
                      style={[
                        styles.tagCategoryText,
                        activeTagCategory === category.id &&
                          styles.tagCategoryTextActive,
                      ]}
                    >
                      {category.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Tags Grid */}
              <ScrollView
                style={styles.modalTagsContainer}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.modalTagsGrid}>
                  {getTagSuggestions().map((tag, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.modalTagButton}
                      onPress={() => addTag(tag.value)}
                    >
                      <Text style={styles.modalTagText}>{tag.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              {/* Done Button */}
              <TouchableOpacity
                style={styles.modalDoneButton}
                onPress={() => setShowTagsModal(false)}
              >
                <LinearGradient
                  colors={["#FF6B35", "#FF8B35"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.modalDoneButtonGradient}
                >
                  <Text style={styles.modalDoneButtonText}>Done</Text>
                </LinearGradient>
              </TouchableOpacity>
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
    marginBottom: -22,
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
  stepContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    alignItems: "center",
    flexDirection: "row",
    gap: 32,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#E5E7EB",
    justifyContent: "center",
    alignItems: "center",
  },
  stepCircleActive: {
    backgroundColor: "#FF6B35",
  },
  stepCircleCompleted: {
    backgroundColor: "#10B981",
  },
  stepNumber: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
  },
  stepNumberActive: {
    color: "#FFFFFF",
  },
  stepLine: {
    width: 50,
    height: 2,
    backgroundColor: "#E5E7EB",
  },
  stepLineCompleted: {
    backgroundColor: "#10B981",
  },
  stepLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginTop: 0,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  stepLabel: {
    fontSize: 10,
    color: "#6B7280",
    fontWeight: "500",
    width: 50,
    textAlign: "center",
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  mainImageContainer: {
    height: 200,
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 12,
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
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
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
    color: "#FF6B35",
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
    backgroundColor: "#FF6B35",
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
    marginRight: 10,
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
  },
  imageOptionSelected: {
    borderWidth: 3,
    borderColor: "#FF6B35",
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
    color: "#fff",
    fontSize: 10,
    fontWeight: "600",
  },
  typeScroll: {
    flexDirection: "row",
  },
  typeCard: {
    width: 80,
    alignItems: "center",
    marginRight: 12,
    marginTop: 8,
  },
  typeCardActive: {
    transform: [{ scale: 1.05 }],
  },
  typeIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  typeCardLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },
  typeCardLabelActive: {
    color: "#FF6B35",
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  charCount: {
    fontSize: 11,
    color: "#9CA3AF",
    fontWeight: "500",
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 0.4,
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
  helperText: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 6,
    fontWeight: "400",
  },
  pricingContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 0.2,
    borderColor: "#6B7280",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  priceInputRow: {
    flexDirection: "row",
    gap: 12,
  },
  priceInputGroup: {
    flex: 1,
  },
  priceLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 6,
  },
  currencyInput: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    overflow: "hidden",
  },
  currencySymbol: {
    paddingHorizontal: 12,
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
    backgroundColor: "#F3F4F6",
    height: "100%",
    textAlignVertical: "center",
  },
  priceInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 14,
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  priceResult: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  priceResultLabel: {
    fontSize: 13,
    color: "#6B7280",
    fontWeight: "500",
    marginBottom: 4,
  },
  priceResultValue: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  finalPrice: {
    fontSize: 20,
    fontWeight: "800",
    color: "#FF6B35",
  },
  savingsBadge: {
    backgroundColor: "#10B98115",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#10B98130",
  },
  savingsText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#10B981",
  },
  datePickerButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 0.4,
    borderColor: "#6B7280",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
  },
  dateText: {
    flex: 1,
    fontSize: 15,
    color: "#111827",
    fontWeight: "400",
  },
  tagsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  browseTagsButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#FF6B3510",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#FF6B3520",
  },
  browseTagsText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FF6B35",
  },
  selectedTagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  selectedTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FF6B35",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  selectedTagText: {
    fontSize: 12,
    color: "#FFFFFF",
    fontWeight: "600",
  },
  removeTagButton: {
    padding: 2,
  },
  previewSection: {
    marginTop: 8,
  },
  previewCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  previewImage: {
    width: "100%",
    height: 150,
  },
  previewContent: {
    padding: 16,
  },
  previewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  previewTypeBadge: {
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  previewTypeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#6B7280",
  },
  previewDiscountBadge: {
    backgroundColor: "#FF6B3515",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FF6B3530",
  },
  previewDiscountText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#FF6B35",
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 6,
  },
  previewDescription: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 12,
    lineHeight: 18,
  },
  previewPricing: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  previewOriginalPrice: {
    fontSize: 14,
    color: "#9CA3AF",
    textDecorationLine: "line-through",
    fontWeight: "500",
  },
  previewDiscountedPrice: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FF6B35",
  },
  navigationContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  prevButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
  },
  prevButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  nextButton: {
    flex: 1,
    marginLeft: 12,
    borderRadius: 12,
    overflow: "hidden",
    elevation: 4,
    shadowColor: "#FF6B35",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  nextButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    gap: 8,
  },
  nextButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  nextButtonDisabled: {
    opacity: 0.7,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "500",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorTitle: {
    fontSize: 20,
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
    lineHeight: 20,
  },
  backButton: {
    backgroundColor: "#FF6B35",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  backButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "80%",
    paddingBottom: Platform.OS === "ios" ? 40 : 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
    letterSpacing: -0.5,
  },
  modalSubtitle: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 4,
  },
  closeButtonCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  tagCategories: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  tagCategoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    marginRight: 8,
  },
  tagCategoryButtonActive: {
    backgroundColor: "#FF6B35",
  },
  tagCategoryText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6B7280",
  },
  tagCategoryTextActive: {
    color: "#FFFFFF",
  },
  modalTagsContainer: {
    maxHeight: 300,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  modalTagsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  modalTagButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  modalTagText: {
    fontSize: 14,
    color: "#374151",
    fontWeight: "500",
  },
  modalDoneButton: {
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
    overflow: "hidden",
  },
  modalDoneButtonGradient: {
    paddingVertical: 16,
    alignItems: "center",
  },
  modalDoneButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});
