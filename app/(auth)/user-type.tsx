// app/(auth)/user-type.tsx
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useFonts } from "expo-font";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const { width, height } = Dimensions.get("window");

const USER_TYPES = [
  {
    id: "customer",
    title: "Customer",
    description: "Order food from restaurants",
    icon: "restaurant-outline",
    iconFilled: "restaurant",
    color: "#FF6B35",
    gradient: ["#FF6B35", "#FF8E53"],
    lightBg: "#FFF1EB",
    pattern: "🍕",
  },
  {
    id: "restaurant",
    title: "Restaurant",
    description: "Grow your business",
    icon: "storefront-outline",
    iconFilled: "storefront",
    color: "#4CAF50",
    gradient: ["#4CAF50", "#66BB6A"],
    lightBg: "#E8F5E9",
    pattern: "🏪",
  },
  {
    id: "driver",
    title: "Driver",
    description: "Flexible earning opportunities",
    icon: "car-outline",
    iconFilled: "car",
    color: "#2196F3",
    gradient: ["#2196F3", "#42A5F5"],
    lightBg: "#E3F2FD",
    pattern: "🚗",
  },
];

export default function UserTypeScreen() {
  const [selectedType, setSelectedType] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const params = useLocalSearchParams();

  // Reset loading state when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      setIsLoading(false);
    }, []),
  );

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  // Create refs for each card (fixed number of refs)
  const cardScaleAnims = useRef(
    USER_TYPES.map(() => new Animated.Value(1)),
  ).current;

  const [fontsLoaded] = useFonts({
    "Poppins-Regular": require("../../assets/fonts/Alan_Sans,Caprasimo,Work_Sans/Alan_Sans/static/AlanSans-Regular.ttf"),
    "Poppins-Medium": require("../../assets/fonts/Alan_Sans,Caprasimo,Work_Sans/Alan_Sans/static/AlanSans-Medium.ttf"),
    "Poppins-SemiBold": require("../../assets/fonts/Alan_Sans,Caprasimo,Work_Sans/Alan_Sans/static/AlanSans-SemiBold.ttf"),
    "Poppins-Bold": require("../../assets/fonts/Alan_Sans,Caprasimo,Work_Sans/Alan_Sans/static/AlanSans-Bold.ttf"),
  });

  useEffect(() => {
    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();

    // Cleanup function
    return () => {
      setIsLoading(false);
    };
  }, []);

  const handlePressIn = (index: number) => {
    Animated.spring(cardScaleAnims[index], {
      toValue: 0.98,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = (index: number) => {
    Animated.spring(cardScaleAnims[index], {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  const handleContinue = async () => {
    if (selectedType && !isLoading) {
      setIsLoading(true);

      // Navigate after a short delay
      setTimeout(() => {
        router.push({
          pathname: "/(auth)/signup",
          params: { userType: selectedType },
        });
        // Note: We don't set isLoading to false here because we're navigating away
        // The useFocusEffect will reset it when we come back
      }, 500);
    }
  };

  if (!fontsLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <LinearGradient
          colors={["#FF6B35", "#FF8E53"]}
          style={styles.loadingGradient}
        >
          <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <Text style={styles.loadingText}>Mataim UAE</Text>
            <Text style={styles.loadingSubtext}>
              Loading amazing experience...
            </Text>
          </Animated.View>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#FF6B35" />

      {/* Animated Header with Parallax Effect */}
      <View style={styles.headerWrapper}>
        <LinearGradient
          colors={["#FF6B35", "#FF8E53"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          {/* Decorative Circles */}
          <View style={styles.headerDecor1} />
          <View style={styles.headerDecor2} />
          <View style={styles.headerDecor3} />

          <View style={styles.headerContent}>
            <Text style={styles.brandText}>Mataim UAE</Text>
            <View style={styles.headerBadge}>
              <Ionicons name="flash" size={16} color="#FF6B35" />
              <Text style={styles.headerBadgeText}>Join 10,000+ users</Text>
            </View>
          </View>
        </LinearGradient>
      </View>

      {/* Main Content */}
      <View style={styles.mainContent}>
        <View style={styles.titleSection}>
          <Text style={styles.sectionTitle}>Choose your path</Text>
          <Text style={styles.sectionSubtitle}>
            Select how you want to experience Mataim
          </Text>
        </View>

        {/* User Type Cards with Staggered Animation */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.cardsContainer}
          showsVerticalScrollIndicator={false}
          decelerationRate="fast"
        >
          {USER_TYPES.map((type, index) => {
            const isSelected = selectedType === type.id;
            const IconComponent =
              type.id === "restaurant" ? MaterialIcons : Ionicons;

            return (
              <View key={type.id}>
                <TouchableOpacity
                  style={[styles.card, isSelected && styles.selectedCard]}
                  onPress={() => !isLoading && setSelectedType(type.id)}
                  onPressIn={() => !isLoading && handlePressIn(index)}
                  onPressOut={() => !isLoading && handlePressOut(index)}
                  activeOpacity={0.95}
                  disabled={isLoading}
                >
                  <LinearGradient
                    colors={isSelected ? type.gradient : ["#FFFFFF", "#FFFFFF"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.cardGradient}
                  >
                    {/* Pattern Overlay */}
                    {isSelected && (
                      <View style={styles.cardPattern}>
                        <Text style={styles.patternText}>{type.pattern}</Text>
                      </View>
                    )}

                    <View style={styles.cardContent}>
                      <View
                        style={[
                          styles.iconContainer,
                          isSelected && styles.selectedIconContainer,
                        ]}
                      >
                        <IconComponent
                          name={isSelected ? type.iconFilled : type.icon}
                          size={28}
                          color={isSelected ? "#FFF" : type.color}
                        />
                      </View>

                      <View style={styles.textContainer}>
                        <Text
                          style={[
                            styles.cardTitle,
                            isSelected && styles.selectedCardTitle,
                          ]}
                        >
                          {type.title}
                        </Text>
                        <Text
                          style={[
                            styles.cardDescription,
                            isSelected && styles.selectedCardDescription,
                          ]}
                        >
                          {type.description}
                        </Text>

                        {/* Stats Badge */}
                        {isSelected && (
                          <View style={styles.cardStats}>
                            <View style={styles.statItem}>
                              <Ionicons
                                name="people"
                                size={12}
                                color="rgba(255,255,255,0.8)"
                              />
                              <Text style={styles.statText}>2k+ active</Text>
                            </View>
                          </View>
                        )}
                      </View>

                      {/* Radio Button */}
                      <View
                        style={[
                          styles.radioButton,
                          isSelected && styles.selectedRadioButton,
                          { borderColor: isSelected ? "#FFF" : type.color },
                        ]}
                      >
                        {isSelected && (
                          <Animated.View
                            style={[
                              styles.radioInner,
                              { backgroundColor: "#FFF" },
                            ]}
                          />
                        )}
                      </View>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            );
          })}

          {/* Info Card */}
          <View style={styles.infoCard}>
            <LinearGradient
              colors={["#F8F9FA", "#FFFFFF"]}
              style={styles.infoGradient}
            >
              <Ionicons name="information-circle" size={24} color="#FF6B35" />
              <Text style={styles.infoText}>
                Don't worry! You can always switch your account type later or
                create multiple accounts
              </Text>
            </LinearGradient>
          </View>
        </ScrollView>

        {/* Footer with Animated Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.continueButton,
              (!selectedType || isLoading) && styles.continueButtonDisabled,
            ]}
            onPress={handleContinue}
            disabled={!selectedType || isLoading}
          >
            <LinearGradient
              colors={
                selectedType && !isLoading
                  ? USER_TYPES.find((t) => t.id === selectedType)?.gradient || [
                      "#CCC",
                      "#CCC",
                    ]
                  : ["#E0E0E0", "#F5F5F5"]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.continueGradient}
            >
              {isLoading ? (
                <Animated.View style={styles.loadingDots}>
                  <View style={[styles.dot, styles.dot1]} />
                  <View style={[styles.dot, styles.dot2]} />
                  <View style={[styles.dot, styles.dot3]} />
                </Animated.View>
              ) : (
                <>
                  <Text
                    style={[
                      styles.continueButtonText,
                      !selectedType && styles.continueButtonTextDisabled,
                    ]}
                  >
                    {selectedType
                      ? `Continue as ${selectedType}`
                      : "Select your path"}
                  </Text>
                  {selectedType && (
                    <Ionicons
                      name="arrow-forward-circle"
                      size={24}
                      color="#FFF"
                    />
                  )}
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.signInButton}
            onPress={() => !isLoading && router.push("/(auth)/signin")}
            disabled={isLoading}
          >
            <Text style={styles.signInText}>
              Already have an account?{" "}
              <Text style={styles.signInLink}>Sign In</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  loadingContainer: {
    flex: 1,
  },
  loadingGradient: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 32,
    fontFamily: "Poppins-Bold",
    color: "#FFF",
    textAlign: "center",
    marginBottom: 8,
  },
  loadingSubtext: {
    fontSize: 14,
    fontFamily: "Poppins-Regular",
    color: "rgba(255,255,255,0.9)",
    textAlign: "center",
  },
  headerWrapper: {
    height: height * 0.27,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    overflow: "hidden",
    elevation: 5,
    shadowColor: "#FF6B35",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  headerGradient: {
    flex: 1,
    position: "relative",
  },
  headerDecor1: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(255,255,255,0.1)",
    top: -50,
    right: -50,
  },
  headerDecor2: {
    position: "absolute",
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "rgba(255,255,255,0.1)",
    bottom: -40,
    left: -40,
  },
  headerDecor3: {
    position: "absolute",
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(255,255,255,0.1)",
    top: 20,
    left: 20,
  },
  headerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    marginTop: 20,
  },
  welcomeText: {
    fontSize: 16,
    fontFamily: "Poppins-Medium",
    color: "rgba(255,255,255,0.9)",
    marginBottom: 8,
  },
  brandText: {
    fontSize: 34,
    fontFamily: "Poppins-Bold",
    color: "#FFF",
    marginBottom: 12,
    letterSpacing: 1,
  },
  headerBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 8,
  },
  headerBadgeText: {
    fontSize: 12,
    fontFamily: "Poppins-Medium",
    color: "#FF6B35",
    marginLeft: 4,
  },
  mainContent: {
    flex: 1,
    marginTop: 6,
  },
  titleSection: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 26,
    fontFamily: "Poppins-Bold",
    color: "#1A1A1A",
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    fontFamily: "Poppins-Regular",
    color: "#666",
  },
  scrollView: {
    flex: 1,
  },
  cardsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 20,
    marginTop: 6,
  },
  card: {
    borderRadius: 18,
    marginBottom: 16,
    overflow: "hidden",
    elevation: 1.5,
    backgroundColor: "#FFF",
    borderColor: "#EEF0F2",
    borderWidth: 1,

    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  cardGradient: {
    padding: 16,
    position: "relative",
  },
  selectedCard: {
    elevation: 8,
    shadowColor: "#FF6B35",
    shadowOpacity: 0.2,
    shadowRadius: 16,
  },
  cardPattern: {
    position: "absolute",
    right: 0,
    bottom: 0,
    opacity: 0.1,
  },
  patternText: {
    fontSize: 60,
    transform: [{ rotate: "-10deg" }],
  },
  cardContent: {
    flexDirection: "row",
    alignItems: "center",
    zIndex: 2,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
    backgroundColor: "#F5F5F5",
  },
  selectedIconContainer: {
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  textContainer: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontFamily: "Poppins-SemiBold",
    color: "#1A1A1A",
    marginBottom: 4,
  },
  selectedCardTitle: {
    color: "#FFF",
  },
  cardDescription: {
    fontSize: 13,
    fontFamily: "Poppins-Regular",
    color: "#666",
  },
  selectedCardDescription: {
    color: "rgba(255,255,255,0.9)",
  },
  cardStats: {
    flexDirection: "row",
    marginTop: 8,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statText: {
    fontSize: 10,
    fontFamily: "Poppins-Medium",
    color: "rgba(255,255,255,0.9)",
    marginLeft: 4,
  },
  radioButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  selectedRadioButton: {
    borderColor: "#FFF",
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  infoCard: {
    marginTop: 8,
    borderRadius: 16,
    overflow: "hidden",
    elevation: 2,
  },
  infoGradient: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Poppins-Regular",
    color: "#666",
    marginLeft: 12,
    lineHeight: 18,
  },
  footer: {
    padding: 20,
    backgroundColor: "#FFF",
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
  continueButton: {
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 16,
    elevation: 3,
    shadowColor: "#FF6B35",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },
  continueButtonDisabled: {
    opacity: 0.7,
    elevation: 0,
    shadowOpacity: 0,
  },
  continueGradient: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  continueButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontFamily: "Poppins-SemiBold",
    marginRight: 8,
  },
  continueButtonTextDisabled: {
    color: "#999",
  },
  signInButton: {
    alignItems: "center",
  },
  signInText: {
    fontSize: 14,
    color: "#666",
    fontFamily: "Poppins-Regular",
  },
  signInLink: {
    color: "#FF6B35",
    fontFamily: "Poppins-SemiBold",
  },
  loadingDots: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FFF",
    marginHorizontal: 3,
  },
  dot1: {
    opacity: 0.8,
  },
  dot2: {
    opacity: 0.5,
  },
  dot3: {
    opacity: 0.3,
  },
});
