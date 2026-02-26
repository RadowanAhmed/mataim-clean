// app/components/GuestProfileBanner.tsx
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface GuestProfileBannerProps {
  onSignIn?: () => void;
  onSignUp?: () => void;
}

export const GuestProfileBanner = ({
  onSignIn,
  onSignUp,
}: GuestProfileBannerProps) => {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Ionicons name="person-circle-outline" size={48} color="#FF6B35" />
      </View>
      <Text style={styles.title}>You're browsing as a guest</Text>
      <Text style={styles.subtitle}>
        Sign in to access your orders, save favorites, and more
      </Text>
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.signInButton}
          onPress={() => router.push("/(auth)/signin")}
        >
          <Text style={styles.signInButtonText}>Sign In</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.signUpButton}
          onPress={() => router.push("/(auth)/user-type")}
        >
          <Text style={styles.signUpButtonText}>Create Account</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#F9FAFB",
    padding: 20,
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    alignItems: "center",
    borderWidth: 0.6,
    borderColor: "#E5E7EB",
  },
  iconContainer: {
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 16,
  },
  buttonContainer: {
    flexDirection: "row",
    gap: 12,
  },
  signInButton: {
    backgroundColor: "#FF6B35",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  signInButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  signUpButton: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  signUpButtonText: {
    color: "#374151",
    fontSize: 14,
    fontWeight: "600",
  },
});
