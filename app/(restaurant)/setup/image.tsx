import { supabase } from "@/backend/supabase";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const SAMPLE_IMAGES = [
  {
    id: 1,
    uri: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&h=600&fit=crop",
    label: "Restaurant Interior",
  },
  {
    id: 2,
    uri: "https://images.unsplash.com/photo-1559925393-8be0ec4767c8?w=800&h=600&fit=crop",
    label: "Food Display",
  },
  {
    id: 3,
    uri: "https://images.unsplash.com/photo-1559329007-40df8a9345d8?w=800&h=600&fit=crop",
    label: "Exterior View",
  },
  {
    id: 4,
    uri: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&h=600&fit=crop",
    label: "Kitchen",
  },
];

export default function RestaurantImageScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const userId = params.userId as string;
  const restaurantData = params.restaurantData
    ? JSON.parse(params.restaurantData as string)
    : null;

  const [selectedImage, setSelectedImage] = useState(
    restaurantData?.image_url || "",
  );
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const pickImage = async () => {
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
    });

    if (!result.canceled) {
      setUploadedImage(result.assets[0].uri);
      setSelectedImage(result.assets[0].uri);
    }
  };

  const uploadImage = async (uri: string): Promise<string> => {
    // In a real app, you would upload to Supabase Storage
    // For now, we'll just return the local URI
    return uri;
  };

  const handleSave = async () => {
    if (!selectedImage) {
      Alert.alert("Error", "Please select an image");
      return;
    }

    setLoading(true);
    try {
      let imageUrl = selectedImage;

      // If it's a local image (not from Unsplash), we need to upload it
      if (uploadedImage && !selectedImage.includes("unsplash")) {
        imageUrl = await uploadImage(uploadedImage);
      }

      const updates = {
        image_url: imageUrl,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("restaurants")
        .update(updates)
        .eq("id", userId);

      if (error) throw error;

      Alert.alert("Success", "Restaurant image saved successfully", [
        {
          text: "Continue",
          onPress: () => router.back(),
        },
      ]);
    } catch (error: any) {
      console.error("Error saving image:", error);
      Alert.alert("Error", error.message || "Failed to save image");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Restaurant Image</Text>
          <View style={{ width: 22 }} />
        </View>

        <View style={styles.form}>
          <Text style={styles.sectionDescription}>
            Upload a photo of your restaurant
          </Text>

          {/* Main Image Display */}
          <TouchableOpacity
            style={styles.mainImageContainer}
            onPress={pickImage}
            activeOpacity={0.9}
          >
            {selectedImage ? (
              <Image
                source={{ uri: selectedImage }}
                style={styles.mainImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.uploadPlaceholder}>
                <Ionicons name="camera" size={48} color="#9CA3AF" />
                <Text style={styles.uploadPlaceholderText}>
                  Tap to upload photo
                </Text>
              </View>
            )}
            <View style={styles.uploadOverlay}>
              <Ionicons name="camera" size={24} color="#fff" />
              <Text style={styles.uploadOverlayText}>Change Photo</Text>
            </View>
          </TouchableOpacity>

          {/* Image Guidelines */}
          <View style={styles.guidelinesCard}>
            <Text style={styles.guidelinesTitle}>Image Guidelines</Text>
            <View style={styles.guidelineItem}>
              <Ionicons name="checkmark-circle" size={16} color="#10B981" />
              <Text style={styles.guidelineText}>
                High-quality photos (min 800x600 pixels)
              </Text>
            </View>
            <View style={styles.guidelineItem}>
              <Ionicons name="checkmark-circle" size={16} color="#10B981" />
              <Text style={styles.guidelineText}>
                Well-lit and clear images
              </Text>
            </View>
            <View style={styles.guidelineItem}>
              <Ionicons name="checkmark-circle" size={16} color="#10B981" />
              <Text style={styles.guidelineText}>
                Restaurant interior or exterior
              </Text>
            </View>
            <View style={styles.guidelineItem}>
              <Ionicons name="checkmark-circle" size={16} color="#10B981" />
              <Text style={styles.guidelineText}>No watermarks or logos</Text>
            </View>
          </View>

          {/* Sample Images */}
          <View style={styles.samplesSection}>
            <Text style={styles.samplesTitle}>Or choose a sample image</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.samplesScroll}
            >
              {SAMPLE_IMAGES.map((image) => (
                <TouchableOpacity
                  key={image.id}
                  style={[
                    styles.sampleImageContainer,
                    selectedImage === image.uri &&
                      styles.sampleImageContainerSelected,
                  ]}
                  onPress={() => {
                    setSelectedImage(image.uri);
                    setUploadedImage(null);
                  }}
                >
                  <Image
                    source={{ uri: image.uri }}
                    style={styles.sampleImage}
                    resizeMode="cover"
                  />
                  <Text style={styles.sampleImageLabel}>{image.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={[styles.saveButton, loading && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={loading}
          >
            {loading ? (
              <Text style={styles.saveButtonText}>Saving...</Text>
            ) : (
              <>
                <Ionicons name="image-outline" size={20} color="#fff" />
                <Text style={styles.saveButtonText}>Save & Complete</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.skipButton}
            onPress={() => router.back()}
          >
            <Text style={styles.skipButtonText}>Skip for now</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    marginBottom: -22,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  form: {
    padding: 20,
  },
  sectionDescription: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 12,
    textAlign: "center",
  },
  mainImageContainer: {
    height: 200,
    borderRadius: 8,
    overflow: "hidden",
    marginBottom: 20,
    position: "relative",
    backgroundColor: "#F3F4F6",
  },
  mainImage: {
    width: "100%",
    height: "100%",
  },
  uploadPlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  uploadPlaceholderText: {
    fontSize: 14,
    color: "#9CA3AF",
    marginTop: 8,
  },
  uploadOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.7)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
    gap: 8,
  },
  uploadOverlayText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  guidelinesCard: {
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 8,
    borderWidth: 0.1,
    borderColor: "#6B7280",
    marginBottom: 20,
  },
  guidelinesTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 10,
  },
  guidelineItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 10,
    gap: 8,
  },
  guidelineText: {
    flex: 1,
    fontSize: 12,
    color: "#4B5563",
    lineHeight: 20,
  },
  samplesSection: {
    marginBottom: 20,
  },
  samplesTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 12,
  },
  samplesScroll: {
    flexDirection: "row",
    gap: 12,
  },
  sampleImageContainer: {
    width: 120,
    marginRight: 12,
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "transparent",
  },
  sampleImageContainerSelected: {
    borderColor: "#F97316",
  },
  sampleImage: {
    width: "100%",
    height: 80,
  },
  sampleImageLabel: {
    fontSize: 12,
    color: "#374151",
    padding: 8,
    backgroundColor: "#FFFFFF",
    textAlign: "center",
    fontWeight: "500",
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FF6B35",
    paddingVertical: 16,
    borderRadius: 12,
    gap: 10,
    marginTop: 20,
  },
  saveButtonDisabled: {
    backgroundColor: "#E5E7EB",
  },
  saveButtonIcon: {
    width: 20,
    height: 20,
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  skipButton: {
    alignItems: "center",
    paddingVertical: 16,
  },
  skipButtonText: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "500",
  },
});
