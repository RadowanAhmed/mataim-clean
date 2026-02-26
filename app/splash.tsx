// app/splash.tsx - Corrected version for your AuthContext
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../backend/AuthContext";
import { useOnboarding } from "../backend/OnboardingContext";

export default function SplashScreen() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth(); // Changed from 'loading' to 'isLoading'
  const { hasCompletedOnboarding } = useOnboarding();

  // Animation values for letters
  const letterAnimations = useRef(
    Array(6)
      .fill(0)
      .map(() => ({
        scale: new Animated.Value(0),
        opacity: new Animated.Value(0),
        translateY: new Animated.Value(10),
      })),
  ).current;

  // Container animations
  const containerScale = useRef(new Animated.Value(0.9)).current;
  const containerOpacity = useRef(new Animated.Value(0)).current;

  // Glow pulse
  const glowPulse = useRef(new Animated.Value(0)).current;

  const isMounted = useRef(true);
  const [navigationAttempted, setNavigationAttempted] = useState(false);

  const startLetterAnimation = () => {
    // Reset animations
    letterAnimations.forEach((letter) => {
      letter.scale.setValue(0);
      letter.opacity.setValue(0);
      letter.translateY.setValue(10);
    });

    // Fast container entrance
    Animated.parallel([
      Animated.timing(containerOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      Animated.timing(containerScale, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
        easing: Easing.out(Easing.back(1)),
      }),
    ]).start();

    // Staggered letter animations
    const letterAnimationsSequence = letterAnimations.map((letter, index) =>
      Animated.sequence([
        Animated.delay(index * 80),
        Animated.parallel([
          Animated.sequence([
            Animated.timing(letter.scale, {
              toValue: 1.2,
              duration: 150,
              useNativeDriver: true,
              easing: Easing.out(Easing.cubic),
            }),
            Animated.timing(letter.scale, {
              toValue: 1,
              duration: 100,
              useNativeDriver: true,
              easing: Easing.out(Easing.cubic),
            }),
          ]),
          Animated.timing(letter.opacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
            easing: Easing.out(Easing.cubic),
          }),
          Animated.timing(letter.translateY, {
            toValue: 0,
            duration: 250,
            useNativeDriver: true,
            easing: Easing.out(Easing.cubic),
          }),
        ]),
      ]),
    );

    Animated.stagger(30, letterAnimationsSequence).start(() => {
      if (isMounted.current) {
        startContinuousAnimations();
      }
    });
  };

  const startContinuousAnimations = () => {
    // Glow pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowPulse, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.sin),
        }),
        Animated.timing(glowPulse, {
          toValue: 0,
          duration: 800,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.sin),
        }),
      ]),
    ).start();

    // Breathing effect for letters
    letterAnimations.forEach((letter, index) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 100),
          Animated.timing(letter.scale, {
            toValue: 1.03,
            duration: 600,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.sin),
          }),
          Animated.timing(letter.scale, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.sin),
          }),
        ]),
      ).start();
    });
  };

  const navigateBasedOnAuth = () => {
    if (navigationAttempted || !isMounted.current) return;

    setNavigationAttempted(true);

    console.log("=== Splash Navigation Debug ===");
    console.log("Auth loading (isLoading):", authLoading);
    console.log("User exists:", !!user);
    console.log("User type:", user?.user_type);
    console.log("Onboarding completed:", hasCompletedOnboarding);

    // If auth is still loading, wait a bit more
    if (authLoading) {
      console.log("Auth still loading (isLoading: true), retrying in 500ms...");
      setTimeout(navigateBasedOnAuth, 500);
      return;
    }

    // Navigation logic
    if (user) {
      // User is logged in - go to appropriate dashboard
      switch (user.user_type) {
        case "restaurant":
          console.log("Navigating to restaurant dashboard");
          router.replace("/(restaurant)/dashboard");
          break;
        case "driver":
          console.log("Navigating to driver dashboard");
          router.replace("/(driver)/dashboard");
          break;
        case "customer":
        default:
          console.log("Navigating to customer tabs");
          router.replace("/(tabs)");
          break;
      }
    } else if (!hasCompletedOnboarding) {
      // No user, but hasn't completed onboarding
      console.log("Navigating to onboarding");
      router.replace("/(onboarding)/welcome1");
    } else {
      // No user, completed onboarding - go to auth
      console.log("Navigating to auth screen");
      router.replace("/(auth)");
    }
  };

  useEffect(() => {
    isMounted.current = true;

    // Start animation immediately
    startLetterAnimation();

    // Start navigation after initial animations
    const navigationTimer = setTimeout(() => {
      navigateBasedOnAuth();
    }, 2500);

    // Backup navigation timeout (in case something goes wrong)
    const backupTimer = setTimeout(() => {
      if (isMounted.current && !navigationAttempted) {
        console.log("Backup navigation triggered - forcing navigation");
        // Force navigation even if auth is still loading
        if (user) {
          router.replace("/(tabs)");
        } else if (!hasCompletedOnboarding) {
          router.replace("/(onboarding)/welcome1");
        } else {
          router.replace("/(auth)");
        }
      }
    }, 5000); // Increased backup timeout

    return () => {
      isMounted.current = false;
      clearTimeout(navigationTimer);
      clearTimeout(backupTimer);

      // Stop all animations
      glowPulse.stopAnimation();
      letterAnimations.forEach((letter) => {
        letter.scale.stopAnimation();
        letter.opacity.stopAnimation();
        letter.translateY.stopAnimation();
      });
    };
  }, [user, hasCompletedOnboarding, authLoading]);

  // Interpolated values
  const glowOpacity = glowPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.1, 0.3],
  });

  const glowScale = glowPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.1],
  });

  const text = "Mataim";
  const letters = text.split("");

  // Optimized particle positions
  const particlePositions = [
    { top: "20%", left: "15%" },
    { top: "15%", right: "20%" },
    { bottom: "25%", left: "25%" },
    { bottom: "20%", right: "15%" },
    { top: "35%", left: "5%" },
    { top: "28%", right: "8%" },
  ];

  return (
    <View style={styles.container}>
      {/* Glow effect */}
      <Animated.View
        style={[
          styles.glowContainer,
          {
            opacity: glowOpacity,
            transform: [{ scale: glowScale }],
          },
        ]}
      />

      {/* Main text container */}
      <Animated.View
        style={[
          styles.textContainer,
          {
            opacity: containerOpacity,
            transform: [{ scale: containerScale }],
          },
        ]}
      >
        {letters.map((letter, index) => {
          const { scale, opacity, translateY } = letterAnimations[index];

          return (
            <Animated.Text
              key={index}
              style={[
                styles.letter,
                {
                  opacity: opacity,
                  transform: [{ scale: scale }, { translateY: translateY }],
                },
              ]}
            >
              {letter}
            </Animated.Text>
          );
        })}
      </Animated.View>

      {/* Loading indicator (shown during auth loading) */}
      {authLoading && (
        <View style={styles.loadingOverlay}>
          <Text style={styles.loadingText}>Loading your session...</Text>
        </View>
      )}

      {/* Optimized particles */}
      <View style={styles.particlesContainer}>
        {particlePositions.map((position, index) => (
          <Animated.View
            key={index}
            style={[
              styles.particle,
              position,
              {
                opacity: glowPulse.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.05, 0.2],
                }),
                transform: [
                  {
                    scale: glowPulse.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.7, 1.1],
                    }),
                  },
                ],
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FF6B35",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  textContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 3,
  },
  letter: {
    fontSize: 44,
    fontWeight: "900",
    color: "#FFFFFF",
    fontFamily: "System",
    textShadowColor: "rgba(0, 0, 0, 0.3)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 6,
    marginHorizontal: 1,
    letterSpacing: 0.5,
  },
  glowContainer: {
    position: "absolute",
    width: 180,
    height: 90,
    backgroundColor: "#FFFFFF",
    borderRadius: 45,
    zIndex: 1,
  },
  particlesContainer: {
    position: "absolute",
    width: "100%",
    height: "100%",
    zIndex: 0,
  },
  particle: {
    position: "absolute",
    width: 50,
    height: 50,
    backgroundColor: "#FFFFFF",
    borderRadius: 25,
  },
  loadingOverlay: {
    position: "absolute",
    bottom: 100,
    alignItems: "center",
    zIndex: 4,
  },
  loadingText: {
    color: "#FFFFFF",
    fontSize: 14,
    opacity: 0.8,
    fontFamily: "System",
  },
});
