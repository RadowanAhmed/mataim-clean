// app/(restaurant)/setup/index.tsx
import { supabase } from "@/backend/supabase";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Types
interface RestaurantData {
  restaurant_name?: string;
  cuisine_type?: string;
  address?: string;
  phone?: string;
  opening_hours?: any;
  business_license?: string;
  payment_methods?: string[];
  features?: string[];
  delivery_radius?: number;
  delivery_fee?: number;
  image_url?: string;
}

interface SetupStep {
  id: string;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  screen: string;
  required: boolean;
  completed: boolean;
}

export default function RestaurantSetup() {
  const router = useRouter();
  const { userId } = useLocalSearchParams<{ userId: string }>();

  const [isLoading, setIsLoading] = useState(true);
  const [restaurant, setRestaurant] = useState<RestaurantData | null>(null);
  const [steps, setSteps] = useState<SetupStep[]>([
    {
      id: "basic",
      title: "Restaurant Basics",
      description: "Tell us your restaurant name and what you serve",
      icon: "restaurant-outline",
      screen: "/(restaurant)/setup/basic",
      required: true,
      completed: false,
    },
    {
      id: "contact",
      title: "How to Find You",
      description: "Where you're located and how to reach you",
      icon: "location-outline",
      screen: "/(restaurant)/setup/contact",
      required: true,
      completed: false,
    },
    {
      id: "hours",
      title: "When You're Open",
      description: "Your opening hours",
      icon: "time-outline",
      screen: "/(restaurant)/setup/hours",
      required: true,
      completed: false,
    },
    {
      id: "legal",
      title: "Business Details",
      description: "License and registration info",
      icon: "document-text-outline",
      screen: "/(restaurant)/setup/license",
      required: true,
      completed: false,
    },
    {
      id: "payment",
      title: "Payment Options",
      description: "How customers can pay",
      icon: "card-outline",
      screen: "/(restaurant)/setup/features",
      required: false,
      completed: false,
    },
    {
      id: "delivery",
      title: "Delivery Setup",
      description: "Delivery areas and fees (if you deliver)",
      icon: "bicycle-outline",
      screen: "/(restaurant)/setup/delivery",
      required: false,
      completed: false,
    },
    {
      id: "photos",
      title: "Show Off Your Food",
      description: "Upload some tasty photos",
      icon: "camera-outline",
      screen: "/(restaurant)/setup/image",
      required: false,
      completed: false,
    },
  ]);

  // Load restaurant data
  useEffect(() => {
    if (userId) {
      loadRestaurant();
    }
  }, [userId]);

  // app/(restaurant)/setup/index.tsx - Updated loadRestaurant function
  const loadRestaurant = async () => {
    try {
      setIsLoading(true);

      // Get restaurant data
      const { data: restaurantData, error: restaurantError } = await supabase
        .from("restaurants")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (restaurantError) {
        console.warn("Couldn't load restaurant:", restaurantError.message);
      }

      // Get user data for phone number
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("phone, country_code")
        .eq("id", userId)
        .maybeSingle();

      if (userError) {
        console.warn("Couldn't load user data:", userError.message);
      }

      // Combine data
      const combinedData = {
        ...restaurantData,
        phone: userData?.phone || "",
        country_code: userData?.country_code || "+971",
      };

      if (combinedData) {
        setRestaurant(combinedData);
        checkCompletedSteps(combinedData);
      }
    } catch (err) {
      console.error("Something went wrong:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // app/(restaurant)/setup/index.tsx - Updated checkCompletedSteps
  const checkCompletedSteps = (data: RestaurantData) => {
    const updated = steps.map((step) => {
      let done = false;

      switch (step.id) {
        case "basic":
          done = !!(data.restaurant_name && data.cuisine_type);
          break;
        case "contact":
          // Check if address exists in restaurant data AND phone exists in user data
          done = !!(data.address && data.phone);
          break;
        case "hours":
          done = !!data.opening_hours;
          break;
        case "legal":
          done = !!data.business_license;
          break;
        case "payment":
          done = !!(data.payment_methods && data.payment_methods.length > 0);
          break;
        case "delivery":
          done = !!(data.delivery_radius || data.delivery_fee);
          break;
        case "photos":
          done = !!data.image_url;
          break;
      }

      return { ...step, completed: done };
    });

    setSteps(updated);
  };

  const getProgress = () => {
    const required = steps.filter((s) => s.required);
    const done = required.filter((s) => s.completed).length;
    return Math.round((done / required.length) * 100);
  };

  const nextStepToComplete = () => {
    // Find first incomplete required step
    const nextRequired = steps.find((s) => s.required && !s.completed);
    if (nextRequired) return nextRequired;

    // Or first incomplete optional
    return steps.find((s) => !s.completed);
  };

  const handleNext = () => {
    const next = nextStepToComplete();
    if (next) {
      router.push({
        pathname: next.screen,
        params: {
          userId,
          restaurantData: restaurant ? JSON.stringify(restaurant) : undefined,
        },
      });
    } else {
      // All done!
      Alert.alert("Ready to Go!", "Your restaurant profile is all set up.", [
        { text: "Later", style: "cancel" },
        {
          text: "Go to Dashboard",
          onPress: () => router.replace("/(restaurant)/dashboard"),
        },
      ]);
    }
  };

  const handleStepTap = (step: SetupStep) => {
    router.push({
      pathname: step.screen,
      params: {
        userId,
        restaurantData: restaurant ? JSON.stringify(restaurant) : undefined,
      },
    });
  };

  // Loading state
  if (isLoading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color="#FF6347" />
        <Text style={styles.loadingText}>Getting things ready...</Text>
      </View>
    );
  }

  const progress = getProgress();
  const nextStep = nextStepToComplete();
  const allRequiredDone = steps
    .filter((s) => s.required)
    .every((s) => s.completed);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header - simple */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={22} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Setup Your Restaurant</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Progress indicator */}
        <View style={styles.progressBox}>
          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>Profile Progress</Text>
            <Text style={styles.progressPercent}>{progress}%</Text>
          </View>

          <View style={styles.barContainer}>
            <View style={styles.barBackground}>
              <View style={[styles.barFill, { width: `${progress}%` }]} />
            </View>
          </View>

          <Text style={styles.progressHint}>
            {allRequiredDone
              ? "Good job! Add optional info to make your profile even better."
              : `Finish ${steps.filter((s) => s.required && !s.completed).length} more required steps.`}
          </Text>

          {nextStep && (
            <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
              <Text style={styles.nextButtonText}>
                {nextStep.completed ? "Continue" : `Start: ${nextStep.title}`}
              </Text>
              <Ionicons name="arrow-forward" size={16} color="#fff" />
            </TouchableOpacity>
          )}
        </View>

        {/* Steps list */}
        <View style={styles.stepsContainer}>
          <Text style={styles.stepsTitle}>What You Need to Set Up</Text>

          {steps.map((step, idx) => (
            <TouchableOpacity
              key={step.id}
              style={[
                styles.stepItem,
                step.completed && styles.stepDone,
                idx === steps.length - 1 && { borderBottomWidth: 0 },
              ]}
              onPress={() => handleStepTap(step)}
            >
              {/* Left side: icon and text */}
              <View style={styles.stepLeft}>
                <View
                  style={[
                    styles.iconWrap,
                    step.completed && styles.iconWrapDone,
                    !step.required && styles.iconWrapOptional,
                  ]}
                >
                  <Ionicons
                    name={step.icon}
                    size={18}
                    color={
                      step.completed
                        ? "#2E8B57"
                        : step.required
                          ? "#FF6347"
                          : "#666"
                    }
                  />
                </View>

                <View style={styles.stepTextWrap}>
                  <View style={styles.stepTitleRow}>
                    <Text
                      style={[
                        styles.stepTitle,
                        step.completed && styles.stepTitleDone,
                      ]}
                    >
                      {step.title}
                    </Text>
                    {step.required ? (
                      <Text style={styles.requiredTag}>Required</Text>
                    ) : (
                      <Text style={styles.optionalTag}>Optional</Text>
                    )}
                  </View>
                  <Text style={styles.stepDesc}>{step.description}</Text>
                </View>
              </View>

              {/* Right side: status/chevron */}
              <View>
                {step.completed ? (
                  <View style={styles.doneTag}>
                    <Ionicons name="checkmark" size={14} color="#2E8B57" />
                    <Text style={styles.doneText}>Done</Text>
                  </View>
                ) : (
                  <Ionicons name="chevron-forward" size={16} color="#999" />
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Completion message if all required done */}
        {allRequiredDone && (
          <View style={styles.allDoneBox}>
            <Ionicons name="checkmark-circle" size={30} color="#2E8B57" />
            <Text style={styles.allDoneTitle}>Required Info Complete!</Text>
            <Text style={styles.allDoneDesc}>
              You can start using the app now. The optional steps will help you
              get more customers.
            </Text>
            <TouchableOpacity
              style={styles.dashButton}
              onPress={() => router.replace("/(restaurant)/dashboard")}
            >
              <Text style={styles.dashButtonText}>Go to Dashboard</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// Styles - more organic, less perfect
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f8f8",
  },

  loadingWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8f8f8",
  },

  loadingText: {
    marginTop: 12,
    color: "#666",
    fontSize: 14,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },

  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#222",
  },

  scroll: {
    flex: 1,
  },

  scrollContent: {
    paddingBottom: 30,
  },

  progressBox: {
    backgroundColor: "#fff",
    margin: 12,
    padding: 18,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e8e8e8",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },

  progressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },

  progressLabel: {
    fontSize: 14,
    color: "#444",
    fontWeight: "500",
  },

  progressPercent: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FF6347",
  },

  barContainer: {
    marginBottom: 12,
  },

  barBackground: {
    height: 6,
    backgroundColor: "#eee",
    borderRadius: 3,
    overflow: "hidden",
  },

  barFill: {
    height: "100%",
    backgroundColor: "#FF6347",
    borderRadius: 3,
  },

  progressHint: {
    fontSize: 13,
    color: "#666",
    lineHeight: 18,
    marginBottom: 16,
  },

  nextButton: {
    backgroundColor: "#FF6347",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },

  nextButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },

  stepsContainer: {
    backgroundColor: "#fff",
    marginHorizontal: 12,
    marginBottom: 16,
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e8e8e8",
  },

  stepsTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#222",
    marginBottom: 16,
  },

  stepItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },

  stepDone: {
    opacity: 0.8,
  },

  stepLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },

  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255, 99, 71, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },

  iconWrapDone: {
    backgroundColor: "rgba(46, 139, 87, 0.1)",
  },

  iconWrapOptional: {
    backgroundColor: "#f5f5f5",
  },

  stepTextWrap: {
    flex: 1,
  },

  stepTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 3,
    flexWrap: "wrap",
  },

  stepTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#222",
    marginRight: 8,
  },

  stepTitleDone: {
    color: "#2E8B57",
  },

  stepDesc: {
    fontSize: 12,
    color: "#666",
    lineHeight: 16,
  },

  requiredTag: {
    fontSize: 10,
    fontWeight: "600",
    color: "#FF6347",
    backgroundColor: "rgba(255, 99, 71, 0.1)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },

  optionalTag: {
    fontSize: 10,
    fontWeight: "600",
    color: "#666",
    backgroundColor: "#f0f0f0",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },

  doneTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(46, 139, 87, 0.1)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },

  doneText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#2E8B57",
  },

  allDoneBox: {
    backgroundColor: "rgba(46, 139, 87, 0.05)",
    marginHorizontal: 12,
    padding: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(46, 139, 87, 0.2)",
    alignItems: "center",
  },

  allDoneTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2E8B57",
    marginTop: 10,
    marginBottom: 6,
  },

  allDoneDesc: {
    fontSize: 14,
    color: "#3a7d5c",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 16,
  },

  dashButton: {
    backgroundColor: "#2E8B57",
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },

  dashButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});
