// app/profile/edit.tsx
import { useAuth } from "@/backend/AuthContext";
import { useGuestAction } from "@/backend/hooks/useGuestAction";
import { supabase } from "@/backend/supabase";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
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

// Configure Cloudinary
const CLOUDINARY_CLOUD_NAME = "dz1arsa91";
const CLOUDINARY_UPLOAD_PRESET = "mataim_profile_preset"; // ← Your new preset name

export default function EditProfileScreen() {
  const router = useRouter();
  const { user, profile, refreshUserData } = useAuth();
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);

  // Inside component
  const { checkGuestAction, isGuest } = useGuestAction();

  // Add this at the beginning of the component
  useEffect(() => {
    if (isGuest) {
      Alert.alert(
        "Guest Mode",
        "Guests cannot edit profiles. Please sign in to edit your profile.",
        [
          { text: "Cancel", onPress: () => router.back() },
          { text: "Sign In", onPress: () => router.push("/(auth)/signin") },
        ],
      );
    }
  }, [isGuest]);

  // Form fields based on user type
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    country_code: "+971",

    // Customer specific
    bio: "",
    preferences: {},

    // Restaurant specific
    restaurant_name: "",
    cuisine_type: "",
    description: "",
    address: "",
    min_order_amount: "",
    delivery_fee: "",
    delivery_radius: "",
    capacity: "",
    is_halal: false,
    has_delivery: true,
    has_pickup: false,
    has_dine_in: false,
    has_outdoor: false,
    has_wifi: false,
    has_parking: false,
    is_family: false,

    // Driver specific
    vehicle_type: "",
    license_number: "",
    vehicle_plate: "",
    years_of_experience: "",
    address_driver: "",
    availability: "available",
  });

  useEffect(() => {
    // Debug Supabase connection
    const checkSupabase = async () => {
      try {
        console.log("Supabase URL:", supabase.supabaseUrl);
        console.log("User:", user?.id);

        // Test simple query
        const { data, error } = await supabase
          .from("users")
          .select("count")
          .limit(1);
        console.log("DB Connection:", error ? "Failed" : "OK");

        // Test storage
        const { data: buckets } = await supabase.storage.listBuckets();
        console.log(
          "Available buckets:",
          buckets?.map((b) => b.name),
        );
      } catch (e) {
        console.error("Supabase connection failed:", e);
      }
    };

    checkSupabase();
  }, []);

  useEffect(() => {
    loadUserData();
  }, [user, profile]);

  const loadUserData = async () => {
    if (!user) return;

    // Set basic user info
    setFormData((prev) => ({
      ...prev,
      full_name: user.full_name || "",
      email: user.email || "",
      phone: user.phone || "",
      country_code: user.country_code || "+971",
    }));

    setProfileImage(user.profile_image_url || null);

    // Load role-specific data
    if (user.user_type === "customer") {
      const { data: customerData } = await supabase
        .from("user_profiles")
        .select("bio, preferences")
        .eq("user_id", user.id)
        .single();

      if (customerData) {
        setFormData((prev) => ({
          ...prev,
          bio: customerData.bio || "",
          preferences: customerData.preferences || {},
        }));
      }
    }

    if (user.user_type === "restaurant") {
      const { data: restaurantData } = await supabase
        .from("restaurants")
        .select("*")
        .eq("id", user.id)
        .single();

      if (restaurantData) {
        setFormData((prev) => ({
          ...prev,
          restaurant_name: restaurantData.restaurant_name || "",
          cuisine_type: restaurantData.cuisine_type || "",
          description: restaurantData.description || "",
          address: restaurantData.address || "",
          min_order_amount: restaurantData.min_order_amount?.toString() || "0",
          delivery_fee: restaurantData.delivery_fee?.toString() || "0",
          delivery_radius: restaurantData.delivery_radius?.toString() || "0",
          capacity: restaurantData.capacity?.toString() || "0",
          is_halal: restaurantData.is_halal || false,
          has_delivery: restaurantData.has_delivery || true,
          has_pickup: restaurantData.has_pickup || false,
          has_dine_in: restaurantData.has_dine_in || false,
          has_outdoor: restaurantData.has_outdoor || false,
          has_wifi: restaurantData.has_wifi || false,
          has_parking: restaurantData.has_parking || false,
          is_family: restaurantData.is_family || false,
        }));
      }
    }

    if (user.user_type === "driver") {
      const { data: driverData } = await supabase
        .from("delivery_users")
        .select("*")
        .eq("id", user.id)
        .single();

      if (driverData) {
        setFormData((prev) => ({
          ...prev,
          vehicle_type: driverData.vehicle_type || "",
          license_number: driverData.license_number || "",
          vehicle_plate: driverData.vehicle_plate || "",
          years_of_experience: driverData.years_of_experience?.toString() || "",
          address_driver: driverData.address || "",
          availability: driverData.availability || "available",
        }));
      }
    }
  };

  const pickImage = async () => {
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== "granted") {
        Alert.alert(
          "Permission needed",
          "Please grant camera roll permissions to upload profile image.",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"], // New syntax
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadProfileImage(result.assets[0]);
      }
    } catch (error) {
      console.error("Error picking image:", error);
      Alert.alert("Error", "Failed to pick image. Please try again.");
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();

      if (status !== "granted") {
        Alert.alert(
          "Permission needed",
          "Please grant camera permissions to take a photo.",
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"], // New syntax
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadProfileImage(result.assets[0]);
      }
    } catch (error) {
      console.error("Error taking photo:", error);
      Alert.alert("Error", "Failed to take photo. Please try again.");
    }
  };

  const uploadProfileImage = async (asset: any) => {
    if (!user?.id) return;

    try {
      setUploadingImage(true);

      const formData = new FormData();
      formData.append("file", {
        uri: asset.uri,
        type: "image/jpeg",
        name: `${user.id}-${Date.now()}.jpg`,
      } as any);
      formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET); // ← Use preset

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

      const imageUrl = data.secure_url;

      // Store in Supabase
      const { error: updateError } = await supabase
        .from("users")
        .update({
          profile_image_url: imageUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (updateError) throw updateError;

      setProfileImage(imageUrl);
      Alert.alert("Success", "Profile image updated!");
      await refreshUserData();
    } catch (error) {
      console.error("Upload error:", error);
      Alert.alert("Error", error.message || "Failed to upload image.");
    } finally {
      setUploadingImage(false);
    }
  };
  const showImageOptions = () => {
    Alert.alert("Change Profile Photo", "Choose an option", [
      { text: "Take Photo", onPress: takePhoto },
      { text: "Choose from Library", onPress: pickImage },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      // Update users table
      const { error: userError } = await supabase
        .from("users")
        .update({
          full_name: formData.full_name,
          phone: formData.phone,
          country_code: formData.country_code,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (userError) throw userError;

      // Update role-specific tables
      if (user.user_type === "customer") {
        // ✅ FIX: Use .update() instead of .upsert()
        const { error: profileError } = await supabase
          .from("user_profiles")
          .update({
            bio: formData.bio,
            preferences: formData.preferences,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", user.id); // ← This is the key

        if (profileError) throw profileError;
      }

      if (user.user_type === "restaurant") {
        const { error: restaurantError } = await supabase
          .from("restaurants")
          .update({
            restaurant_name: formData.restaurant_name,
            cuisine_type: formData.cuisine_type,
            description: formData.description,
            address: formData.address,
            min_order_amount: parseFloat(formData.min_order_amount) || 0,
            delivery_fee: parseFloat(formData.delivery_fee) || 0,
            delivery_radius: parseInt(formData.delivery_radius) || 0,
            capacity: parseInt(formData.capacity) || 0,
            is_halal: formData.is_halal,
            has_delivery: formData.has_delivery,
            has_pickup: formData.has_pickup,
            has_dine_in: formData.has_dine_in,
            has_outdoor: formData.has_outdoor,
            has_wifi: formData.has_wifi,
            has_parking: formData.has_parking,
            is_family: formData.is_family,
            updated_at: new Date().toISOString(),
          })
          .eq("id", user.id);

        if (restaurantError) throw restaurantError;
      }

      if (user.user_type === "driver") {
        const { error: driverError } = await supabase
          .from("delivery_users")
          .update({
            vehicle_type: formData.vehicle_type,
            license_number: formData.license_number,
            vehicle_plate: formData.vehicle_plate,
            years_of_experience: parseInt(formData.years_of_experience) || 0,
            address: formData.address_driver,
            availability: formData.availability,
            updated_at: new Date().toISOString(),
          })
          .eq("id", user.id);

        if (driverError) throw driverError;
      }

      await refreshUserData();
      Alert.alert("Success", "Profile updated successfully!");
      router.back();
    } catch (error) {
      console.error("Error updating profile:", error);
      Alert.alert("Error", "Failed to update profile. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const getUserTypeColor = () => {
    switch (user?.user_type) {
      case "customer":
        return "#FF6B35";
      case "restaurant":
        return "#10B981";
      case "driver":
        return "#3B82F6";
      default:
        return "#FF6B35";
    }
  };

  const getInitials = (name: string) => {
    return (
      name
        ?.split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase() || "U"
    );
  };

  const renderCustomerFields = () => (
    <>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Personal Information</Text>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Bio</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={formData.bio}
            onChangeText={(text) => handleInputChange("bio", text)}
            placeholder="Tell us about yourself..."
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>
      </View>
    </>
  );

  const renderRestaurantFields = () => (
    <>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Restaurant Information</Text>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Restaurant Name *</Text>
          <TextInput
            style={styles.input}
            value={formData.restaurant_name}
            onChangeText={(text) => handleInputChange("restaurant_name", text)}
            placeholder="Enter restaurant name"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Cuisine Type</Text>
          <TextInput
            style={styles.input}
            value={formData.cuisine_type}
            onChangeText={(text) => handleInputChange("cuisine_type", text)}
            placeholder="e.g., Italian, Chinese, Indian"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={formData.description}
            onChangeText={(text) => handleInputChange("description", text)}
            placeholder="Describe your restaurant..."
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Address *</Text>
          <TextInput
            style={styles.input}
            value={formData.address}
            onChangeText={(text) => handleInputChange("address", text)}
            placeholder="Enter restaurant address"
          />
        </View>

        <View style={styles.row}>
          <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
            <Text style={styles.label}>Min Order Amount (AED)</Text>
            <TextInput
              style={styles.input}
              value={formData.min_order_amount}
              onChangeText={(text) =>
                handleInputChange("min_order_amount", text)
              }
              placeholder="0.00"
              keyboardType="numeric"
            />
          </View>
          <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
            <Text style={styles.label}>Delivery Fee (AED)</Text>
            <TextInput
              style={styles.input}
              value={formData.delivery_fee}
              onChangeText={(text) => handleInputChange("delivery_fee", text)}
              placeholder="0.00"
              keyboardType="numeric"
            />
          </View>
        </View>

        <View style={styles.row}>
          <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
            <Text style={styles.label}>Delivery Radius (km)</Text>
            <TextInput
              style={styles.input}
              value={formData.delivery_radius}
              onChangeText={(text) =>
                handleInputChange("delivery_radius", text)
              }
              placeholder="0"
              keyboardType="numeric"
            />
          </View>
          <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
            <Text style={styles.label}>Seating Capacity</Text>
            <TextInput
              style={styles.input}
              value={formData.capacity}
              onChangeText={(text) => handleInputChange("capacity", text)}
              placeholder="0"
              keyboardType="numeric"
            />
          </View>
        </View>

        <View style={styles.checkboxGroup}>
          <Text style={styles.label}>Features & Services</Text>

          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => handleInputChange("is_halal", !formData.is_halal)}
          >
            <View
              style={[
                styles.checkbox,
                formData.is_halal && styles.checkboxChecked,
              ]}
            >
              {formData.is_halal && (
                <Ionicons name="checkmark" size={16} color="#FFFFFF" />
              )}
            </View>
            <Text style={styles.checkboxLabel}>Halal Certified</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() =>
              handleInputChange("has_delivery", !formData.has_delivery)
            }
          >
            <View
              style={[
                styles.checkbox,
                formData.has_delivery && styles.checkboxChecked,
              ]}
            >
              {formData.has_delivery && (
                <Ionicons name="checkmark" size={16} color="#FFFFFF" />
              )}
            </View>
            <Text style={styles.checkboxLabel}>Offers Delivery</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() =>
              handleInputChange("has_pickup", !formData.has_pickup)
            }
          >
            <View
              style={[
                styles.checkbox,
                formData.has_pickup && styles.checkboxChecked,
              ]}
            >
              {formData.has_pickup && (
                <Ionicons name="checkmark" size={16} color="#FFFFFF" />
              )}
            </View>
            <Text style={styles.checkboxLabel}>Offers Pickup</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() =>
              handleInputChange("has_dine_in", !formData.has_dine_in)
            }
          >
            <View
              style={[
                styles.checkbox,
                formData.has_dine_in && styles.checkboxChecked,
              ]}
            >
              {formData.has_dine_in && (
                <Ionicons name="checkmark" size={16} color="#FFFFFF" />
              )}
            </View>
            <Text style={styles.checkboxLabel}>Dine-in Available</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() =>
              handleInputChange("has_outdoor", !formData.has_outdoor)
            }
          >
            <View
              style={[
                styles.checkbox,
                formData.has_outdoor && styles.checkboxChecked,
              ]}
            >
              {formData.has_outdoor && (
                <Ionicons name="checkmark" size={16} color="#FFFFFF" />
              )}
            </View>
            <Text style={styles.checkboxLabel}>Outdoor Seating</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => handleInputChange("has_wifi", !formData.has_wifi)}
          >
            <View
              style={[
                styles.checkbox,
                formData.has_wifi && styles.checkboxChecked,
              ]}
            >
              {formData.has_wifi && (
                <Ionicons name="checkmark" size={16} color="#FFFFFF" />
              )}
            </View>
            <Text style={styles.checkboxLabel}>Free WiFi</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() =>
              handleInputChange("has_parking", !formData.has_parking)
            }
          >
            <View
              style={[
                styles.checkbox,
                formData.has_parking && styles.checkboxChecked,
              ]}
            >
              {formData.has_parking && (
                <Ionicons name="checkmark" size={16} color="#FFFFFF" />
              )}
            </View>
            <Text style={styles.checkboxLabel}>Parking Available</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => handleInputChange("is_family", !formData.is_family)}
          >
            <View
              style={[
                styles.checkbox,
                formData.is_family && styles.checkboxChecked,
              ]}
            >
              {formData.is_family && (
                <Ionicons name="checkmark" size={16} color="#FFFFFF" />
              )}
            </View>
            <Text style={styles.checkboxLabel}>Family Friendly</Text>
          </TouchableOpacity>
        </View>
      </View>
    </>
  );

  const renderDriverFields = () => (
    <>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Driver Information</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Vehicle Type *</Text>
          <TextInput
            style={styles.input}
            value={formData.vehicle_type}
            onChangeText={(text) => handleInputChange("vehicle_type", text)}
            placeholder="e.g., Car, Motorcycle, Scooter"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>License Number *</Text>
          <TextInput
            style={styles.input}
            value={formData.license_number}
            onChangeText={(text) => handleInputChange("license_number", text)}
            placeholder="Enter driving license number"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Vehicle Plate Number *</Text>
          <TextInput
            style={styles.input}
            value={formData.vehicle_plate}
            onChangeText={(text) => handleInputChange("vehicle_plate", text)}
            placeholder="Enter vehicle plate number"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Years of Experience</Text>
          <TextInput
            style={styles.input}
            value={formData.years_of_experience}
            onChangeText={(text) =>
              handleInputChange("years_of_experience", text)
            }
            placeholder="0"
            keyboardType="numeric"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Address</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={formData.address_driver}
            onChangeText={(text) => handleInputChange("address_driver", text)}
            placeholder="Enter your address"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>
      </View>
    </>
  );

  const primaryColor = getUserTypeColor();

  // If guest, show restricted view
  if (isGuest) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Profile</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.guestContainer}>
          <Ionicons name="person-circle-outline" size={80} color="#D1D5DB" />
          <Text style={styles.guestTitle}>Guest Mode</Text>
          <Text style={styles.guestText}>
            Sign in to create and edit your profile
          </Text>
          <TouchableOpacity
            style={styles.guestSignInButton}
            onPress={() => router.push("/(auth)/signin")}
          >
            <Text style={styles.guestSignInButtonText}>Sign In</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.guestBackButton}
            onPress={() => router.back()}
          >
            <Text style={styles.guestBackButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Profile</Text>
          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: primaryColor }]}
            onPress={handleSave}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.saveButtonText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Profile Image Section */}
          <View style={styles.imageSection}>
            <View style={styles.avatarContainer}>
              {uploadingImage ? (
                <View
                  style={[styles.avatarLoading, { borderColor: primaryColor }]}
                >
                  <ActivityIndicator size="large" color={primaryColor} />
                </View>
              ) : profileImage ? (
                <Image
                  source={{ uri: profileImage }}
                  style={styles.avatarImage}
                />
              ) : (
                <View
                  style={[
                    styles.avatarPlaceholder,
                    { backgroundColor: primaryColor },
                  ]}
                >
                  <Text style={styles.avatarInitials}>
                    {getInitials(formData.full_name || user?.full_name || "U")}
                  </Text>
                </View>
              )}
              <TouchableOpacity
                style={[
                  styles.editImageButton,
                  { backgroundColor: primaryColor },
                ]}
                onPress={showImageOptions}
                disabled={uploadingImage}
              >
                <Ionicons name="camera" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <Text style={styles.imageHint}>
              Tap the camera icon to change your profile photo
            </Text>
          </View>

          {/* Basic Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Basic Information</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Full Name *</Text>
              <TextInput
                style={styles.input}
                value={formData.full_name}
                onChangeText={(text) => handleInputChange("full_name", text)}
                placeholder="Enter your full name"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={[styles.input, styles.disabledInput]}
                value={formData.email}
                editable={false}
              />
              <Text style={styles.inputHint}>Email cannot be changed</Text>
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, { width: 100, marginRight: 8 }]}>
                <Text style={styles.label}>Country Code</Text>
                <TextInput
                  style={styles.input}
                  value={formData.country_code}
                  onChangeText={(text) =>
                    handleInputChange("country_code", text)
                  }
                  placeholder="+971"
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>Phone Number</Text>
                <TextInput
                  style={styles.input}
                  value={formData.phone}
                  onChangeText={(text) => handleInputChange("phone", text)}
                  placeholder="Enter phone number"
                  keyboardType="phone-pad"
                />
              </View>
            </View>
          </View>

          {/* Role-specific fields */}
          {user?.user_type === "customer" && renderCustomerFields()}
          {user?.user_type === "restaurant" && renderRestaurantFields()}
          {user?.user_type === "driver" && renderDriverFields()}

          {/* Delete Account Section */}
          <View style={styles.deleteSection}>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => {
                Alert.alert(
                  "Delete Account",
                  "Are you sure you want to delete your account? This action cannot be undone.",
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Delete",
                      style: "destructive",
                      onPress: () => {
                        // Handle account deletion
                      },
                    },
                  ],
                );
              }}
            >
              <Ionicons name="trash-outline" size={20} color="#EF4444" />
              <Text style={styles.deleteText}>Delete Account</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  keyboardView: {
    flex: 1,
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
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    minWidth: 70,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  imageSection: {
    alignItems: "center",
    paddingVertical: 24,
    backgroundColor: "#FFFFFF",
    marginBottom: 8,
  },
  avatarContainer: {
    position: "relative",
    marginBottom: 8,
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: "#FFFFFF",
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#FFFFFF",
  },
  avatarLoading: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#FFFFFF",
    backgroundColor: "#F3F4F6",
  },
  avatarInitials: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "700",
  },
  editImageButton: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#FFFFFF",
  },
  imageHint: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 4,
  },
  section: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 20,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#111827",
    backgroundColor: "#F9FAFB",
  },
  disabledInput: {
    backgroundColor: "#F3F4F6",
    color: "#6B7280",
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  inputHint: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 4,
    marginLeft: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  checkboxGroup: {
    marginTop: 8,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#E5E7EB",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  checkboxChecked: {
    backgroundColor: "#10B981",
    borderColor: "#10B981",
  },
  checkboxLabel: {
    fontSize: 14,
    color: "#374151",
  },
  deleteSection: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 20,
    marginTop: 8,
  },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  deleteText: {
    fontSize: 14,
    color: "#EF4444",
    fontWeight: "600",
    marginLeft: 8,
  },

  guestContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  guestTitle: {
    fontSize: 24,
    fontWeight: "600",
    marginBottom: 16,
    color: "#111827",
  },
  guestText: {
    fontSize: 16,
    textAlign: "center",
    color: "#6B7280",
  },
  guestButton: {
    backgroundColor: "#10B981",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 24,
  },
  guestButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },

  guestSignInButton: {
    backgroundColor: "#10B981",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 24,
  },
  guestSignInButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  guestSignInText: {
    fontSize: 16,
    textAlign: "center",
    color: "#6B7280",
  },
  guestBackButton: {
    backgroundColor: "#E5E7EB",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 16,
  },
  guestBackButtonText: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "600",
  },
});
