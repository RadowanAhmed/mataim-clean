// app/(tabs)/orders/report-issue.tsx
import { useAuth } from "@/backend/AuthContext";
import { supabase } from "@/backend/supabase";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
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

// Issue categories with icons and descriptions
const ISSUE_CATEGORIES = [
  {
    id: "missing_items",
    label: "Missing Items",
    icon: "fast-food-outline",
    description: "Items not included in delivery",
    color: "#FF6B35",
    bgColor: "#FF6B3510",
  },
  {
    id: "wrong_items",
    label: "Wrong Items",
    icon: "swap-horizontal-outline",
    description: "Received different items than ordered",
    color: "#F59E0B",
    bgColor: "#F59E0B10",
  },
  {
    id: "quality_issue",
    label: "Quality Issue",
    icon: "nutrition-outline",
    description: "Food quality not satisfactory",
    color: "#EF4444",
    bgColor: "#EF444410",
  },
  {
    id: "late_delivery",
    label: "Late Delivery",
    icon: "time-outline",
    description: "Order took too long to arrive",
    color: "#3B82F6",
    bgColor: "#3B82F610",
  },
  {
    id: "damaged_packaging",
    label: "Damaged Packaging",
    icon: "cube-outline",
    description: "Package was damaged on arrival",
    color: "#8B5CF6",
    bgColor: "#8B5CF610",
  },
  {
    id: "incorrect_charges",
    label: "Incorrect Charges",
    icon: "cash-outline",
    description: "Wrong amount charged",
    color: "#10B981",
    bgColor: "#10B98110",
  },
  {
    id: "driver_issue",
    label: "Driver Issue",
    icon: "bicycle-outline",
    description: "Issue with delivery partner",
    color: "#EC4899",
    bgColor: "#EC489910",
  },
  {
    id: "other",
    label: "Other",
    icon: "help-circle-outline",
    description: "Something else",
    color: "#6B7280",
    bgColor: "#6B728010",
  },
];

// Resolution options
const RESOLUTION_OPTIONS = [
  {
    id: "refund",
    label: "Full Refund",
    icon: "cash-outline",
    description: "Get your money back",
    color: "#10B981",
    bgColor: "#10B98110",
  },
  {
    id: "partial_refund",
    label: "Partial Refund",
    icon: "cash-outline",
    description: "Partial refund for affected items",
    color: "#F59E0B",
    bgColor: "#F59E0B10",
  },
  {
    id: "reorder",
    label: "Replacement Order",
    icon: "repeat-outline",
    description: "Get a new order",
    color: "#3B82F6",
    bgColor: "#3B82F610",
  },
  {
    id: "credit",
    label: "Store Credit",
    icon: "card-outline",
    description: "Credit for future orders",
    color: "#8B5CF6",
    bgColor: "#8B5CF610",
  },
];

export default function ReportIssueScreen() {
  const { orderId, orderNumber } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [orderDetails, setOrderDetails] = useState<any>(null);

  // Form states
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedResolution, setSelectedResolution] = useState<string | null>(
    null,
  );
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [affectedItems, setAffectedItems] = useState<string[]>([]);
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");

  useEffect(() => {
    fetchOrderDetails();
  }, []);

  const fetchOrderDetails = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("orders")
        .select(
          `
          *,
          restaurants (
            restaurant_name,
            image_url
          ),
          order_items (
            id,
            quantity,
            unit_price,
            posts (
              title,
              image_url
            ),
            menu_items (
              name,
              image_url
            )
          )
        `,
        )
        .eq("id", orderId)
        .single();

      if (error) throw error;
      setOrderDetails(data);
    } catch (error) {
      console.error("Error fetching order:", error);
      Alert.alert("Error", "Failed to load order details");
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== "granted") {
        Alert.alert(
          "Permission Needed",
          "Please allow access to your photo library",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        const newImage = `data:image/jpeg;base64,${result.assets[0].base64}`;
        setImages([...images, newImage]);
      }
    } catch (error) {
      console.error("Error picking image:", error);
      Alert.alert("Error", "Failed to pick image");
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();

      if (status !== "granted") {
        Alert.alert("Permission Needed", "Please allow access to your camera");
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        const newImage = `data:image/jpeg;base64,${result.assets[0].base64}`;
        setImages([...images, newImage]);
      }
    } catch (error) {
      console.error("Error taking photo:", error);
      Alert.alert("Error", "Failed to take photo");
    }
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const toggleAffectedItem = (itemId: string) => {
    if (affectedItems.includes(itemId)) {
      setAffectedItems(affectedItems.filter((id) => id !== itemId));
    } else {
      setAffectedItems([...affectedItems, itemId]);
    }
  };

  const validateForm = () => {
    if (!selectedCategory) {
      Alert.alert("Error", "Please select an issue category");
      return false;
    }
    if (!description.trim()) {
      Alert.alert("Error", "Please describe the issue");
      return false;
    }
    if (description.length < 10) {
      Alert.alert(
        "Error",
        "Please provide more details (at least 10 characters)",
      );
      return false;
    }
    return true;
  };

  const submitIssue = async () => {
    if (!validateForm() || !user?.id || !orderId) return;

    try {
      setSubmitting(true);

      const issueData = {
        order_id: orderId,
        user_id: user.id,
        issue_type: selectedCategory,
        resolution_requested: selectedResolution,
        description: description.trim(),
        images: images,
        affected_items: affectedItems,
        priority: priority,
        status: "pending",
        created_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("order_issues").insert(issueData);

      if (error) throw error;

      Alert.alert(
        "Issue Reported",
        "Thank you for reporting this issue. Our support team will review it and get back to you within 24 hours.",
        [
          {
            text: "OK",
            onPress: () => router.back(),
          },
        ],
      );
    } catch (error) {
      console.error("Error submitting issue:", error);
      Alert.alert("Error", "Failed to submit issue. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={styles.loadingText}>Loading...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Report an Issue</Text>
          <Text style={styles.headerSubtitle}>
            Order #{orderNumber || orderId?.slice(0, 8)}
          </Text>
        </View>
        <View style={styles.headerRight} />
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.contentContainer}
        >
          {/* Issue Categories */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="alert-circle" size={20} color="#FF6B35" />
              <Text style={styles.sectionTitle}>What's the issue?</Text>
            </View>
            <View style={styles.categoriesGrid}>
              {ISSUE_CATEGORIES.map((category) => {
                const isSelected = selectedCategory === category.id;
                return (
                  <TouchableOpacity
                    key={category.id}
                    style={[
                      styles.categoryCard,
                      isSelected && styles.categoryCardSelected,
                      { borderColor: category.color + "40" },
                      isSelected && { backgroundColor: category.bgColor },
                    ]}
                    onPress={() => setSelectedCategory(category.id)}
                  >
                    <View
                      style={[
                        styles.categoryIcon,
                        { backgroundColor: category.bgColor },
                      ]}
                    >
                      <Ionicons
                        name={category.icon as any}
                        size={24}
                        color={category.color}
                      />
                    </View>
                    <Text style={styles.categoryLabel}>{category.label}</Text>
                    <Text style={styles.categoryDescription}>
                      {category.description}
                    </Text>
                    {isSelected && (
                      <View style={styles.selectedBadge}>
                        <Ionicons
                          name="checkmark-circle"
                          size={20}
                          color="#10B981"
                        />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Affected Items */}
          {orderDetails?.order_items?.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="cube-outline" size={20} color="#FF6B35" />
                <Text style={styles.sectionTitle}>Affected Items</Text>
                <Text style={styles.sectionSubtitle}>(Optional)</Text>
              </View>
              <View style={styles.itemsList}>
                {orderDetails.order_items.map((item: any, index: number) => {
                  const itemName =
                    item.posts?.title ||
                    item.menu_items?.name ||
                    `Item ${index + 1}`;
                  const itemImage =
                    item.posts?.image_url || item.menu_items?.image_url;
                  const isSelected = affectedItems.includes(item.id);

                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[
                        styles.itemCard,
                        isSelected && styles.itemCardSelected,
                      ]}
                      onPress={() => toggleAffectedItem(item.id)}
                    >
                      {itemImage ? (
                        <Image
                          source={{ uri: itemImage }}
                          style={styles.itemImage}
                        />
                      ) : (
                        <View style={styles.itemImagePlaceholder}>
                          <Ionicons
                            name="fast-food"
                            size={20}
                            color="#9CA3AF"
                          />
                        </View>
                      )}
                      <View style={styles.itemInfo}>
                        <Text style={styles.itemName}>{itemName}</Text>
                        <Text style={styles.itemQuantity}>
                          Qty: {item.quantity}
                        </Text>
                      </View>
                      {isSelected && (
                        <Ionicons
                          name="checkmark-circle"
                          size={24}
                          color="#10B981"
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Description */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="document-text" size={20} color="#FF6B35" />
              <Text style={styles.sectionTitle}>Description</Text>
            </View>
            <TextInput
              style={styles.descriptionInput}
              placeholder="Please describe the issue in detail..."
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={5}
              value={description}
              onChangeText={setDescription}
              maxLength={1000}
            />
            <Text style={styles.charCount}>
              {description.length}/1000 characters
            </Text>
          </View>

          {/* Images */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="images-outline" size={20} color="#FF6B35" />
              <Text style={styles.sectionTitle}>Add Photos</Text>
              <Text style={styles.sectionSubtitle}>(Optional)</Text>
            </View>
            <View style={styles.imageActions}>
              <TouchableOpacity style={styles.imageAction} onPress={takePhoto}>
                <View
                  style={[
                    styles.imageActionIcon,
                    { backgroundColor: "#FF6B3510" },
                  ]}
                >
                  <Ionicons name="camera-outline" size={24} color="#FF6B35" />
                </View>
                <Text style={styles.imageActionText}>Take Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.imageAction} onPress={pickImage}>
                <View
                  style={[
                    styles.imageActionIcon,
                    { backgroundColor: "#8B5CF610" },
                  ]}
                >
                  <Ionicons name="image-outline" size={24} color="#8B5CF6" />
                </View>
                <Text style={styles.imageActionText}>Choose from Gallery</Text>
              </TouchableOpacity>
            </View>

            {images.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.imagePreviewList}
              >
                {images.map((image, index) => (
                  <View key={index} style={styles.imagePreviewContainer}>
                    <Image
                      source={{ uri: image }}
                      style={styles.imagePreview}
                    />
                    <TouchableOpacity
                      style={styles.removeImageButton}
                      onPress={() => removeImage(index)}
                    >
                      <Ionicons name="close-circle" size={22} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>

          {/* Resolution Request 
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="swap-vertical" size={20} color="#FF6B35" />
              <Text style={styles.sectionTitle}>Requested Resolution</Text>
              <Text style={styles.sectionSubtitle}>(Optional)</Text>
            </View>
            <View style={styles.resolutionOptions}>
              {RESOLUTION_OPTIONS.map((option) => {
                const isSelected = selectedResolution === option.id;
                return (
                  <TouchableOpacity
                    key={option.id}
                    style={[
                      styles.resolutionCard,
                      isSelected && styles.resolutionCardSelected,
                      isSelected && { backgroundColor: option.bgColor },
                    ]}
                    onPress={() => setSelectedResolution(option.id)}
                  >
                    <View
                      style={[
                        styles.resolutionIcon,
                        { backgroundColor: option.bgColor },
                      ]}
                    >
                      <Ionicons
                        name={option.icon as any}
                        size={20}
                        color={option.color}
                      />
                    </View>
                    <View style={styles.resolutionInfo}>
                      <Text style={styles.resolutionLabel}>{option.label}</Text>
                      <Text style={styles.resolutionDescription}>
                        {option.description}
                      </Text>
                    </View>
                    {isSelected && (
                      <Ionicons
                        name="checkmark-circle"
                        size={24}
                        color="#10B981"
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
          */}

          {/* Priority 
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="flag-outline" size={20} color="#FF6B35" />
              <Text style={styles.sectionTitle}>Priority</Text>
            </View>
            <View style={styles.priorityOptions}>
              <TouchableOpacity
                style={[
                  styles.priorityButton,
                  priority === "low" && styles.priorityButtonActive,
                  priority === "low" && { borderColor: "#10B981" },
                ]}
                onPress={() => setPriority("low")}
              >
                <Ionicons
                  name="flag-outline"
                  size={16}
                  color={priority === "low" ? "#10B981" : "#6B7280"}
                />
                <Text
                  style={[
                    styles.priorityText,
                    priority === "low" && {
                      color: "#10B981",
                      fontWeight: "600",
                    },
                  ]}
                >
                  Low
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.priorityButton,
                  priority === "medium" && styles.priorityButtonActive,
                  priority === "medium" && { borderColor: "#F59E0B" },
                ]}
                onPress={() => setPriority("medium")}
              >
                <Ionicons
                  name="flag-outline"
                  size={16}
                  color={priority === "medium" ? "#F59E0B" : "#6B7280"}
                />
                <Text
                  style={[
                    styles.priorityText,
                    priority === "medium" && {
                      color: "#F59E0B",
                      fontWeight: "600",
                    },
                  ]}
                >
                  Medium
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.priorityButton,
                  priority === "high" && styles.priorityButtonActive,
                  priority === "high" && { borderColor: "#EF4444" },
                ]}
                onPress={() => setPriority("high")}
              >
                <Ionicons
                  name="flag-outline"
                  size={16}
                  color={priority === "high" ? "#EF4444" : "#6B7280"}
                />
                <Text
                  style={[
                    styles.priorityText,
                    priority === "high" && {
                      color: "#EF4444",
                      fontWeight: "600",
                    },
                  ]}
                >
                  High
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          */}

          {/* Disclaimer */}
          <View style={styles.disclaimer}>
            <Ionicons name="information-circle" size={20} color="#6B7280" />
            <Text style={styles.disclaimerText}>
              Our support team will review your issue and respond within 24
              hours. Please provide as much detail as possible to help us
              resolve it quickly.
            </Text>
          </View>

          <View style={styles.spacer} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Submit Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.submitButton,
            submitting && styles.submitButtonDisabled,
          ]}
          onPress={submitIssue}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="send" size={20} color="#fff" />
              <Text style={styles.submitButtonText}>Submit Issue</Text>
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
    color: "#6B7280",
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  backButton: {
    padding: 4,
  },
  headerTitleContainer: {
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  headerRight: {
    width: 32,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 14,
  },
  section: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 0.3,
    borderColor: "#E5E7EB",
    elevation: 1,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    flex: 1,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: "#9CA3AF",
    fontWeight: "400",
  },
  categoriesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  categoryCard: {
    width: "48%",
    padding: 12,
    borderRadius: 12,
    borderWidth: 0.8,
    backgroundColor: "#fff",
    position: "relative",
    marginBottom: 8,
  },
  categoryCardSelected: {
    borderWidth: 2,
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  categoryLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 2,
  },
  categoryDescription: {
    fontSize: 11,
    color: "#6B7280",
    lineHeight: 8,
  },
  selectedBadge: {
    position: "absolute",
    top: 8,
    right: 8,
  },
  itemsList: {
    gap: 8,
  },
  itemCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#F9FAFB",
    borderRadius: 10,
    borderWidth: 0.6,
    borderColor: "#E5E7EB",
  },
  itemCardSelected: {
    borderColor: "#10B981",
    backgroundColor: "#F0FDF4",
  },
  itemImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
  },
  itemImagePlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  itemInfo: {
    flex: 1,
    marginLeft: 12,
  },
  itemName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 2,
  },
  itemQuantity: {
    fontSize: 12,
    color: "#6B7280",
  },
  descriptionInput: {
    backgroundColor: "#F9FAFB",
    borderRadius: 10,
    padding: 15,
    fontSize: 15,
    color: "#111827",
    textAlignVertical: "top",
    minHeight: 120,
    borderWidth: 0.8,
    borderColor: "#E5E7EB",
  },
  charCount: {
    fontSize: 12,
    color: "#9CA3AF",
    textAlign: "right",
    marginTop: 8,
  },
  imageActions: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 14,
  },
  imageAction: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    padding: 15,
    borderRadius: 13,
    borderWidth: 0.8,
    borderColor: "#E5E7EB",
  },
  imageActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  imageActionText: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "500",
  },
  imagePreviewList: {
    flexDirection: "row",
  },
  imagePreviewContainer: {
    position: "relative",
    marginRight: 12,
  },
  imagePreview: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  removeImageButton: {
    position: "absolute",
    top: -8,
    right: -8,
    backgroundColor: "#fff",
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  resolutionOptions: {
    gap: 8,
  },
  resolutionCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  resolutionCardSelected: {
    borderColor: "#10B981",
  },
  resolutionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  resolutionInfo: {
    flex: 1,
  },
  resolutionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 2,
  },
  resolutionDescription: {
    fontSize: 12,
    color: "#6B7280",
  },
  priorityOptions: {
    flexDirection: "row",
    gap: 8,
  },
  priorityButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  priorityButtonActive: {
    backgroundColor: "#fff",
    borderWidth: 2,
  },
  priorityText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6B7280",
  },
  disclaimer: {
    flexDirection: "row",
    backgroundColor: "#F3F4F6",
    padding: 16,
    borderRadius: 12,
    gap: 12,
    marginBottom: 20,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 13,
    color: "#6B7280",
    lineHeight: 12,
  },
  spacer: {
    height: 40,
  },
  footer: {
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    padding: 16,
    paddingBottom: Platform.OS === "ios" ? 24 : 20,
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#FF6B35",
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: "#FF6B35",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
