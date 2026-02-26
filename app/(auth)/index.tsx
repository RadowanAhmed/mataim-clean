// app/(auth)/index.tsx
import { useAuth } from "@/backend/AuthContext";
import { images } from "@/constent/images";
import { Ionicons } from "@expo/vector-icons";
import { useFonts } from "expo-font";
import { Redirect, useRouter } from "expo-router";

import { useEffect, useRef, useState } from "react";
import {
  Animated,
  BackHandler,
  Easing,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const carouselImages = [
  images.BurgerImage,
  images.PizzaImage,
  images.SushiImage,
  images.PastaImage,
  images.SaladImage,
  images.DessertImage,
  images.DrinkImage,
  images.BreakfastImage,
];

export default function AuthOptionsScreen() {
  const router = useRouter();
  const { user, isLoading, signInAsGuest } = useAuth(); // Add this line
  // Add redirection logic at the beginning
  // Add proper redirection logic
  if (isLoading) {
    return null; // Show nothing while loading
  }

  if (user) {
    // Redirect based on user type
    console.log("AuthIndex: User found, type:", user.user_type);
    switch (user.user_type) {
      case "restaurant":
        console.log("Redirecting to restaurant dashboard");
        return <Redirect href="/(restaurant)/dashboard" />;
      case "driver":
        console.log("Redirecting to driver dashboard");
        return <Redirect href="/(driver)/dashboard" />;
      case "customer":
      default:
        console.log("Redirecting to customer tabs");
        return <Redirect href="/(tabs)" />;
    }
  }
  const { width, height } = useWindowDimensions();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [isImageReady, setIsImageReady] = useState(false);
  const [showExitMessage, setShowExitMessage] = useState(false);
  const exitMessageOpacity = useRef(new Animated.Value(0)).current;

  // Carousel state
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const slideAnim = useRef(new Animated.Value(0)).current;

  // App name animation
  const appNameAnim = useRef(new Animated.Value(0)).current;
  const letterAnimations = useRef(
    Array(6)
      .fill(0)
      .map(() => ({
        scale: new Animated.Value(0.5),
        opacity: new Animated.Value(0),
        translateY: new Animated.Value(10),
      })),
  ).current;

  // Use ref for back button state to persist across renders
  const backButtonPressed = useRef(0);

  // Load your Google Fonts
  const [fontsLoaded] = useFonts({
    "Caprasimo-Bold": require("../../assets/fonts/Alan_Sans,Caprasimo/Caprasimo/Caprasimo-Regular.ttf"),
    "Poppins-SemiBold": require("../../assets/fonts/Alan_Sans,Caprasimo,Work_Sans/Alan_Sans/static/AlanSans-Medium.ttf"),
  });

  // Inside the component, add this before the return
  const handleGuestContinue = async () => {
    await signInAsGuest();
    // Navigate to customer tabs
    router.replace("/(tabs)");
  };

  // Responsive scaling function
  const responsiveSize = (size: number) => {
    const baseWidth = 375; // iPhone 6/7/8 width
    return (size * width) / baseWidth;
  };

  // Responsive height function
  const responsiveHeight = (size: number) => {
    const baseHeight = 667; // iPhone 6/7/8 height
    return (size * height) / baseHeight;
  };

  // App name text animation
  const startAppNameAnimation = () => {
    // Reset all letter animations
    letterAnimations.forEach((letter) => {
      letter.scale.setValue(0.5);
      letter.opacity.setValue(0);
      letter.translateY.setValue(10);
    });

    // Staggered letter animations
    const letterAnimationsSequence = letterAnimations.map((letter, index) =>
      Animated.sequence([
        Animated.delay(index * 100),
        Animated.parallel([
          Animated.timing(letter.scale, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
            easing: Easing.out(Easing.back(1.2)),
          }),
          Animated.timing(letter.opacity, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
            easing: Easing.out(Easing.cubic),
          }),
          Animated.timing(letter.translateY, {
            toValue: 0,
            duration: 600,
            useNativeDriver: true,
            easing: Easing.out(Easing.cubic),
          }),
        ]),
      ]),
    );

    // Start letter animations
    Animated.stagger(80, letterAnimationsSequence).start(() => {
      // Start continuous pulse animation after letters appear
      Animated.loop(
        Animated.sequence([
          Animated.timing(appNameAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.sin),
          }),
          Animated.timing(appNameAnim, {
            toValue: 0,
            duration: 1500,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.sin),
          }),
        ]),
      ).start();
    });
  };

  // Faster and smoother carousel animation
  const startCarouselAnimation = () => {
    const nextIndex = (currentImageIndex + 1) % carouselImages.length;

    // Quick slide animation
    Animated.sequence([
      // Slide out current image to left quickly
      Animated.timing(slideAnim, {
        toValue: -width * 0.8,
        duration: 400,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      // Reset position and immediately show next image
      Animated.timing(slideAnim, {
        toValue: width * 0.8,
        duration: 0,
        useNativeDriver: true,
      }),
      // Slide in new image from right
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
    ]).start(() => {
      setCurrentImageIndex(nextIndex);
    });
  };

  // Show exit message
  const showExitMessageHandler = () => {
    setShowExitMessage(true);

    // Animate message in and out
    Animated.sequence([
      Animated.timing(exitMessageOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      Animated.delay(800), // Show for shorter time
      Animated.timing(exitMessageOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
        easing: Easing.in(Easing.cubic),
      }),
    ]).start(() => {
      setShowExitMessage(false);
    });

    return true; // Prevent default behavior
  };

  // Handle back button press with double tap to exit - ONLY FOR THIS SCREEN
  const handleBackPress = () => {
    // If we're not on the auth index screen, don't handle the back press
    // Allow normal navigation behavior
    if (router.canGoBack()) {
      return false; // Let Expo Router handle the navigation
    }

    // Only handle double-tap-to-exit when we're at the root of the auth stack
    if (backButtonPressed.current > 0) {
      BackHandler.exitApp(); // Exit app on second press
      return true;
    }

    backButtonPressed.current++;
    showExitMessageHandler();

    // Reset backButtonPressed after 1.5 seconds (faster)
    setTimeout(() => {
      backButtonPressed.current = 0;
    }, 1500);

    return true; // Prevent default behavior (don't navigate back)
  };

  useEffect(() => {
    // Start app name animation
    startAppNameAnimation();

    // Start animations immediately with faster timing
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 1.02,
        duration: 800,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();

    // Faster continuous pulsing animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.03,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ).start();

    // Start carousel animation immediately and faster
    const carouselInterval = setInterval(() => {
      startCarouselAnimation();
    }, 2000); // Change image every 2 seconds (faster)

    // Add back button listener - ONLY FOR THIS SCREEN
    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      handleBackPress,
    );

    // Cleanup the event listener when component unmounts
    return () => {
      backHandler.remove();
      clearInterval(carouselInterval);
      // Reset back button state when leaving this screen
      backButtonPressed.current = 0;
    };
  }, [currentImageIndex]);

  // Combine both scale and pulse animations
  const combinedScale = Animated.multiply(scaleAnim, pulseAnim);

  const text = "Mataim";
  const letters = text.split("");

  // Wait for fonts to load before rendering
  if (!fontsLoaded) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#D62400" />
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { fontSize: responsiveSize(16) }]}>
            Loading...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#D62400" />

      {/* Exit Message */}
      {showExitMessage && (
        <Animated.View
          style={[
            styles.exitMessage,
            {
              opacity: exitMessageOpacity,
              top: responsiveHeight(60),
            },
          ]}
        >
          <View
            style={[
              styles.exitMessageContent,
              {
                paddingHorizontal: responsiveSize(16),
                paddingVertical: responsiveSize(8),
                borderRadius: responsiveSize(20),
              },
            ]}
          >
            <Ionicons
              name="exit-outline"
              size={responsiveSize(20)}
              color="#FFF"
            />
            <Text
              style={[styles.exitMessageText, { fontSize: responsiveSize(14) }]}
            >
              Press back again to exit
            </Text>
          </View>
        </Animated.View>
      )}

      {/* Logo/Header */}
      <View
        style={[
          styles.logoContainer,
          {
            paddingHorizontal: responsiveSize(40),
            paddingTop: responsiveHeight(40),
            paddingBottom: responsiveHeight(10),
          },
        ]}
      >
        <View
          style={[
            styles.logoCircle,
            {
              width: responsiveSize(80),
              height: responsiveSize(80),
              borderRadius: responsiveSize(40),
              marginBottom: responsiveHeight(16),
            },
          ]}
        >
          <Ionicons
            name="fast-food"
            size={responsiveSize(40)}
            color="#D62400"
          />
        </View>

        {/* Animated App Name */}
        <View style={styles.appNameContainer}>
          {letters.map((letter, index) => {
            const { scale, opacity, translateY } = letterAnimations[index];
            return (
              <Animated.Text
                key={index}
                style={[
                  styles.appName,
                  {
                    fontSize: responsiveSize(36),
                    opacity: opacity,
                    transform: [{ scale: scale }, { translateY: translateY }],
                  },
                ]}
              >
                {letter}
              </Animated.Text>
            );
          })}
        </View>

        <Text
          style={[
            styles.tagline,
            {
              fontSize: responsiveSize(16),
              lineHeight: responsiveSize(22),
              marginBottom: responsiveHeight(8),
            },
          ]}
        >
          Delicious Food Delivered Fast
        </Text>
      </View>

      {/* Animated Image Carousel */}
      <View
        style={[
          styles.animationContainer,
          {
            height: responsiveHeight(150),
            marginVertical: responsiveHeight(5),
          },
        ]}
      >
        <Animated.View
          style={[
            styles.carouselItem,
            {
              width: responsiveSize(220),
              height: "100%",
              transform: [{ scale: combinedScale }, { translateX: slideAnim }],
            },
          ]}
        >
          <Animated.Image
            source={carouselImages[currentImageIndex]}
            style={styles.animation}
            resizeMode="contain"
            onLoad={() => setIsImageReady(true)}
            fadeDuration={0}
          />
        </Animated.View>

        {/* Image Indicators */}
        <View
          style={[
            styles.indicators,
            {
              bottom: responsiveHeight(-22),
              gap: responsiveSize(6),
            },
          ]}
        >
          {carouselImages.map((_, index) => (
            <View
              key={index}
              style={[
                styles.indicator,
                {
                  width: responsiveSize(6),
                  height: responsiveSize(6),
                  borderRadius: responsiveSize(3),
                },
                index === currentImageIndex && [
                  styles.indicatorActive,
                  { width: responsiveSize(16) },
                ],
              ]}
            />
          ))}
        </View>
      </View>

      {/* Features */}
      <View
        style={[
          styles.features,
          {
            paddingHorizontal: responsiveSize(32),
            marginBottom: responsiveHeight(20),
            gap: responsiveSize(15),
            marginTop: responsiveHeight(48),
          },
        ]}
      >
        <View style={[styles.featureItem, { gap: responsiveSize(6) }]}>
          <View
            style={[
              styles.featureIcon,
              {
                width: responsiveSize(36),
                height: responsiveSize(36),
                borderRadius: responsiveSize(18),
              },
            ]}
          >
            <Ionicons
              name="restaurant"
              size={responsiveSize(20)}
              color="#FFF"
            />
          </View>
          <Text style={[styles.featureText, { fontSize: responsiveSize(11) }]}>
            100+ Restaurants
          </Text>
        </View>
        <View style={[styles.featureItem, { gap: responsiveSize(6) }]}>
          <View
            style={[
              styles.featureIcon,
              {
                width: responsiveSize(36),
                height: responsiveSize(36),
                borderRadius: responsiveSize(18),
              },
            ]}
          >
            <Ionicons name="bicycle" size={responsiveSize(20)} color="#FFF" />
          </View>
          <Text style={[styles.featureText, { fontSize: responsiveSize(11) }]}>
            Fast Delivery
          </Text>
        </View>
        <View style={[styles.featureItem, { gap: responsiveSize(6) }]}>
          <View
            style={[
              styles.featureIcon,
              {
                width: responsiveSize(36),
                height: responsiveSize(36),
                borderRadius: responsiveSize(18),
              },
            ]}
          >
            <Ionicons
              name="shield-checkmark"
              size={responsiveSize(20)}
              color="#FFF"
            />
          </View>
          <Text style={[styles.featureText, { fontSize: responsiveSize(11) }]}>
            Secure Payment
          </Text>
        </View>
      </View>

      {/* Auth Buttons */}
      <View
        style={[
          styles.authContainer,
          {
            paddingHorizontal: responsiveSize(20),
            gap: responsiveHeight(14),
            marginTop: responsiveHeight(10),
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.signUpButton,
            {
              padding: responsiveSize(16),
              borderRadius: responsiveSize(12),
              gap: responsiveSize(12),
            },
          ]}
          onPress={() => router.push("/(auth)/user-type")}
        >
          <Ionicons
            name="person-add-outline"
            size={responsiveSize(21)}
            color="#D62400"
          />
          <Text
            style={[styles.signUpButtonText, { fontSize: responsiveSize(15) }]}
          >
            Create Account
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.signInButton,
            {
              padding: responsiveSize(15),
              borderRadius: responsiveSize(12),
              gap: responsiveSize(12),
            },
          ]}
          onPress={() => router.push("/(auth)/signin")}
        >
          <Ionicons
            name="log-in-outline"
            size={responsiveSize(21)}
            color="#FFF"
          />
          <Text
            style={[styles.signInButtonText, { fontSize: responsiveSize(15) }]}
          >
            Sign In
          </Text>
        </TouchableOpacity>

        {/* Guest Option */}
        <TouchableOpacity
          style={[
            styles.guestButton,
            {
              marginTop: responsiveHeight(6),
              paddingVertical: responsiveHeight(2),
              gap: responsiveSize(0),
            },
          ]}
          onPress={handleGuestContinue}
        >
          <Text
            style={[styles.guestButtonText, { fontSize: responsiveSize(14) }]}
          >
            Continue as Guest
          </Text>
          <Ionicons
            name="arrow-forward"
            size={responsiveSize(15)}
            left={8}
            color="#FFF"
          />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#D62400",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#FFF",
    fontFamily: "System",
  },
  exitMessage: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 100,
  },
  exitMessageContent: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    width: "auto",
    height: "auto",
  },
  exitMessageText: {
    color: "#FFF",
    fontFamily: "Poppins-SemiBold",
    marginLeft: 8,
    fontSize: 13,
  },
  logoContainer: {
    alignItems: "center",
  },
  logoCircle: {
    backgroundColor: "#FFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  appNameContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  appName: {
    fontFamily: "Caprasimo-Bold",
    color: "#FFF",
    textAlign: "center",
    textShadowColor: "rgba(0, 0, 0, 0.3)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  appNameGlow: {
    position: "absolute",
    fontFamily: "Caprasimo-Bold",
    color: "#FFF",
    textAlign: "center",
    textShadowColor: "rgba(255, 255, 255, 0.8)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  tagline: {
    fontFamily: "Caprasimo-Bold",
    color: "rgba(255, 255, 255, 0.8)",
    textAlign: "center",
  },
  animationContainer: {
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  carouselItem: {
    justifyContent: "center",
    alignItems: "center",
  },
  animation: {
    width: "100%",
    height: "100%",
  },
  indicators: {
    flexDirection: "row",
    position: "absolute",
  },
  indicator: {
    backgroundColor: "rgba(255, 255, 255, 0.4)",
  },
  indicatorActive: {
    backgroundColor: "#FFF",
  },
  features: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  featureItem: {
    alignItems: "center",
  },
  featureIcon: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  featureText: {
    fontFamily: "Poppins-SemiBold",
    color: "#FFF",
    textAlign: "center",
  },
  authContainer: {
    // Styles are applied inline with responsive sizing
  },
  signUpButton: {
    backgroundColor: "#FFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  signUpButtonText: {
    color: "#D62400",
    fontFamily: "Poppins-SemiBold",
  },
  signInButton: {
    backgroundColor: "transparent",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0.5,
    borderColor: "#FFF",
  },
  signInButtonText: {
    color: "#FFF",
    fontFamily: "Poppins-SemiBold",
  },
  guestButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  guestButtonText: {
    color: "#FFF",
    fontFamily: "AlanSans-Medium-static",
    opacity: 0.9,
  },
});
