// app/(auth)/signin.tsx
import { useAuth } from "@/backend/AuthContext";
import { GoogleSignInService } from "@/backend/services/GoogleSignInService";
import { supabase } from "@/backend/supabase";
import { animations } from "@/constent/animations";
import { icons } from "@/constent/icons";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFonts } from "expo-font";
import { useLocalSearchParams, useRouter } from "expo-router";
import LottieView from "lottie-react-native";
import { useEffect, useState } from "react";
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

function SignInScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({
    email: "",
    password: "",
    general: "",
  });

  const [fontsLoaded] = useFonts({
    "Caprasimo-Bold": require("../../assets/fonts/Alan_Sans,Caprasimo/Caprasimo/Caprasimo-Regular.ttf"),
    "Poppins-SemiBold": require("../../assets/fonts/Alan_Sans,Caprasimo,Work_Sans/Alan_Sans/static/AlanSans-Medium.ttf"),
  });

  const params = useLocalSearchParams();
  const [resetSuccess, setResetSuccess] = useState(false);
  const router = useRouter();
  const { signIn } = useAuth();

  useEffect(() => {
    const clearResetSessions = async () => {
      await AsyncStorage.setItem("is_password_reset_session", "false");
    };
    clearResetSessions();
  }, []);

  useEffect(() => {
    if (params.resetSuccess === "true") {
      setResetSuccess(true);
    }
  }, [params]);

  const validateEmail = (email: string) => {
    return /\S+@\S+\.\S+/.test(email);
  };

  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }
    if (!validateEmail(email)) {
      Alert.alert("Error", "Please enter a valid email");
      return;
    }

    setIsLoading(true);
    try {
      const { error, data } = await signIn(email, password);

      if (error) {
        Alert.alert("Error", error.message);
      } else {
        // Get user type from database
        const { data: userData } = await supabase
          .from("users")
          .select("user_type")
          .eq("email", email.toLowerCase())
          .single();

        if (userData?.user_type === "restaurant") {
          router.replace("/(restaurant)/dashboard");
        } else if (userData?.user_type === "driver") {
          router.replace("/(driver)/dashboard");
        } else {
          router.replace("/(tabs)");
        }
      }
    } catch (error) {
      Alert.alert("Error", "An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    Alert.alert(
      "Select Account Type",
      "What type of account would you like to use?",
      [
        { text: "Customer", onPress: () => startGoogleSignIn("customer") },
        { text: "Restaurant", onPress: () => startGoogleSignIn("restaurant") },
        { text: "Driver", onPress: () => startGoogleSignIn("driver") },
        { text: "Cancel", style: "cancel" },
      ],
    );
  };

  const startGoogleSignIn = async (
    type: "customer" | "restaurant" | "driver",
  ) => {
    setGoogleLoading(true);
    try {
      const result = await GoogleSignInService.signInWithGoogle(type);

      if (result.success) {
        if (result.isNewUser) {
          Alert.alert(
            "Welcome! 🎉",
            "Your account has been created successfully.",
          );
        }

        switch (type) {
          case "restaurant":
            router.replace("/(restaurant)/dashboard");
            break;
          case "driver":
            router.replace("/(driver)/dashboard");
            break;
          default:
            router.replace("/(tabs)");
            break;
        }
      } else {
        Alert.alert("Error", result.error || "Failed to sign in with Google");
      }
    } catch (error) {
      Alert.alert("Error", "Google sign-in failed");
    } finally {
      setGoogleLoading(false);
    }
  };

  if (!fontsLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B35" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Animation */}
          <View style={styles.animationContainer}>
            <LottieView
              source={animations.discover_anmazing_food}
              autoPlay
              loop
              style={styles.animation}
            />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Welcome to Mataim</Text>
            <Text style={styles.subtitle}>Sign in to continue</Text>
          </View>

          {/* Reset Success */}
          {resetSuccess && (
            <View style={styles.successContainer}>
              <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
              <Text style={styles.successText}>
                Password reset successful! Please sign in.
              </Text>
            </View>
          )}

          {/* Form */}
          <View style={styles.form}>
            {/* Email */}
            <Text style={styles.label}>Email</Text>
            <View style={styles.inputContainer}>
              <Ionicons
                name="mail-outline"
                size={20}
                color="#666"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Enter your email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            {/* Password */}
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputContainer}>
              <Ionicons
                name="lock-closed-outline"
                size={20}
                color="#666"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Enter your password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color="#666"
                />
              </TouchableOpacity>
            </View>

            {/* Forgot Password */}
            <TouchableOpacity
              style={styles.forgotPassword}
              onPress={() => router.push("/(auth)/forgot-password")}
            >
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>

            {/* Sign In Button */}
            <TouchableOpacity
              style={styles.signInButton}
              onPress={handleSignIn}
              disabled={isLoading || googleLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.signInButtonText}>Sign In</Text>
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Google Button */}
            <TouchableOpacity
              style={styles.googleButton}
              onPress={handleGoogleSignIn}
              disabled={isLoading || googleLoading}
            >
              {googleLoading ? (
                <ActivityIndicator color="#FF6B35" />
              ) : (
                <>
                  <Image source={icons.google} style={styles.googleIcon} />
                  <Text style={styles.googleButtonText}>
                    Continue with Google
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {/* Sign Up Link */}
            <View style={styles.signUpContainer}>
              <Text style={styles.signUpText}>Don't have an account? </Text>
              <TouchableOpacity
                onPress={() => router.push("/(auth)/user-type")}
              >
                <Text style={styles.signUpLink}>Sign Up</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  scrollContainer: { flexGrow: 1, paddingBottom: 20 },
  animationContainer: { height: 200, marginTop: 30, alignItems: "center" },
  animation: { width: "100%", height: "100%" },
  header: { alignItems: "center", marginBottom: 30 },
  title: {
    fontSize: 24,
    fontFamily: "Caprasimo-Bold",
    color: "#333",
    marginBottom: 8,
  },
  subtitle: { fontSize: 14, fontFamily: "Poppins-SemiBold", color: "#666" },
  successContainer: {
    flexDirection: "row",
    backgroundColor: "#E8F5E8",
    borderWidth: 1,
    borderColor: "#4CAF50",
    borderRadius: 8,
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  successText: { flex: 1, color: "#2E7D32", fontSize: 14, marginLeft: 8 },
  form: { paddingHorizontal: 16 },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
    marginLeft: 4,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8f8f8",
    borderWidth: 1,
    borderColor: "#e1e1e1",
    borderRadius: 8,
    marginBottom: 16,
    paddingHorizontal: 12,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, paddingVertical: 14, fontSize: 16, color: "#333" },
  forgotPassword: { alignSelf: "flex-end", marginBottom: 24 },
  forgotPasswordText: { color: "#FF6B35", fontSize: 14, fontWeight: "600" },
  signInButton: {
    backgroundColor: "#FF6B35",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    marginBottom: 20,
  },
  signInButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#e1e1e1" },
  dividerText: { color: "#666", paddingHorizontal: 16 },
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e1e1e1",
    borderRadius: 8,
    padding: 14,
    marginBottom: 20,
  },
  googleIcon: { width: 20, height: 20, marginRight: 8 },
  googleButtonText: { color: "#333", fontSize: 16, fontWeight: "500" },
  signUpContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 20,
  },
  signUpText: { color: "#666" },
  signUpLink: { color: "#FF6B35", fontWeight: "600" },
});

// IMPORTANT: Make sure this is at the bottom
export default SignInScreen;
