// app/(auth)/forgot-password.tsx
import { passwordResetManager } from "@/backend/PasswordResetManager";
import { animations } from "@/constent/animations";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFonts } from "expo-font";
import { useRouter } from "expo-router";
import LottieView from "lottie-react-native";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { supabase } from "../../backend/supabase";


const { width } = Dimensions.get("window");

export default function ForgotPasswordScreen() {
  const [step, setStep] = useState<
    "email" | "code" | "newPassword" | "success"
  >("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [errors, setErrors] = useState({
    email: "",
    code: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [touched, setTouched] = useState({
    email: false,
    code: false,
    newPassword: false,
    confirmPassword: false,
  });

  const codeInputs = useRef<(TextInput | null)[]>([]);
  const fadeAnim = useState(new Animated.Value(0))[0];
  const [isComponentMounted, setIsComponentMounted] = useState(true);

  // Load your Google Fonts
  const [fontsLoaded] = useFonts({
    "Caprasimo-Regular": require("../../assets/fonts/Alan_Sans,Caprasimo/Caprasimo/Caprasimo-Regular.ttf"),
    "AlanSans-Medium": require("../../assets/fonts/Alan_Sans,Caprasimo,Work_Sans/Alan_Sans/static/AlanSans-Medium.ttf"),
  });

  const router = useRouter();

  useEffect(() => {
    setIsComponentMounted(true);
    return () => {
      setIsComponentMounted(false);
    };
  }, []);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, [step]);

  // Countdown timer for resend code
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  // Handle app state changes to cleanup incomplete reset sessions
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: string) => {
      if (nextAppState === "background" || nextAppState === "inactive") {
        // App is going to background, check if we need to clean up
        const hasValidSession = await AsyncStorage.getItem(
          "has_valid_reset_session",
        );
        const isResetInProgress =
          await passwordResetManager.isResetInProgress();

        if (
          (hasValidSession === "true" || isResetInProgress) &&
          step !== "success"
        ) {
          console.log(
            "🚫 App going to background with incomplete reset - cleaning up",
          );
          setTimeout(async () => {
            await supabase.auth.signOut();
            await passwordResetManager.clearSession();
            await AsyncStorage.multiRemove([
              "has_valid_reset_session",
              "recovery_session_active",
            ]);
          }, 1000);
        }
      }
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange,
    );

    return () => {
      subscription.remove();
    };
  }, [step]);

  // Cleanup incomplete reset sessions ONLY when component unmounts (not when step changes)
  useEffect(() => {
    return () => {
      if (!isComponentMounted) {
        const cleanupIncompleteReset = async () => {
          // Check if user left without completing password reset
          const hasValidSession = await AsyncStorage.getItem(
            "has_valid_reset_session",
          );
          const isResetInProgress =
            await passwordResetManager.isResetInProgress();

          if (
            (hasValidSession === "true" || isResetInProgress) &&
            step !== "success"
          ) {
            console.log(
              "🚫 User left without completing password reset - cleaning up session",
            );
            // Sign out the recovery session
            await supabase.auth.signOut();
            await passwordResetManager.clearSession();
            await AsyncStorage.multiRemove([
              "has_valid_reset_session",
              "reset_session_timestamp",
              "reset_email",
              "recovery_session_active",
            ]);
          }
        };

        cleanupIncompleteReset();
      }
    };
  }, [step, isComponentMounted]);

  const validateEmail = (email: string) => {
    const re = /\S+@\S+\.\S+/;
    return re.test(email);
  };

  const validatePassword = (password: string) => {
    return password.length >= 6;
  };

  // Enhanced email validation with better error messages
  const validateEmailRealTime = (email: string) => {
    if (!email.trim()) {
      return { isValid: false, message: "Email address is required" };
    }
    if (!validateEmail(email)) {
      return {
        isValid: false,
        message:
          "Please enter a valid email address (e.g., yourname@example.com)",
      };
    }
    return { isValid: true, message: "" };
  };

  // Enhanced password validation with detailed feedback
  const validatePasswordRealTime = (password: string) => {
    if (!password.trim()) {
      return { isValid: false, message: "Password is required" };
    }
    if (password.length < 6) {
      return {
        isValid: false,
        message: "Password must be at least 6 characters long",
      };
    }
    if (!/(?=.*[a-zA-Z])/.test(password)) {
      return { isValid: false, message: "Include at least one letter" };
    }
    if (!/(?=.*\d)/.test(password)) {
      return { isValid: false, message: "Include at least one number" };
    }
    return { isValid: true, message: "" };
  };

  // Enhanced confirm password validation
  const validateConfirmPassword = (confirm: string, password: string) => {
    if (!confirm.trim()) {
      return { isValid: false, message: "Please confirm your password" };
    }
    if (confirm !== password) {
      return {
        isValid: false,
        message: "Passwords do not match. Please try again.",
      };
    }
    return { isValid: true, message: "" };
  };

  // Real-time validation effects with touch tracking
  useEffect(() => {
    if (touched.email || email) {
      const validation = validateEmailRealTime(email);
      setErrors((prev) => ({ ...prev, email: validation.message }));
    }
  }, [email, touched.email]);

  useEffect(() => {
    if (touched.newPassword || newPassword) {
      const validation = validatePasswordRealTime(newPassword);
      setErrors((prev) => ({ ...prev, newPassword: validation.message }));
    }
  }, [newPassword, touched.newPassword]);

  useEffect(() => {
    if (touched.confirmPassword || confirmPassword) {
      const validation = validateConfirmPassword(confirmPassword, newPassword);
      setErrors((prev) => ({ ...prev, confirmPassword: validation.message }));
    }
  }, [confirmPassword, newPassword, touched.confirmPassword]);

  // Handle field focus/blur for touch tracking
  const handleFieldFocus = (field: keyof typeof touched) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const checkEmailExists = async (email: string) => {
    try {
      const cleanEmail = email.trim().toLowerCase();
      console.log("Checking email:", cleanEmail);

      // Simple database check
      const { data, error } = await supabase
        .from("users")
        .select("id")
        .eq("email", cleanEmail)
        .maybeSingle();

      if (data) {
        console.log("✅ Email found in database");
        return true;
      }

      console.log("❌ Email not found in database");
      return false;
    } catch (error) {
      console.error("Email check error:", error);
      return false;
    }
  };

  // Handle code input change
  const handleCodeChange = (text: string, index: number) => {
    // Only allow numbers
    const numericText = text.replace(/[^0-9]/g, "");

    const newCode = [...code];
    newCode[index] = numericText;
    setCode(newCode);

    // Clear code error when user starts typing
    if (numericText && errors.code) {
      setErrors((prev) => ({ ...prev, code: "" }));
    }

    // Auto-focus next input
    if (numericText && index < 5) {
      codeInputs.current[index + 1]?.focus();
    }
  };

  // Handle backspace in code input
  const handleCodeKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === "Backspace" && !code[index] && index > 0) {
      codeInputs.current[index - 1]?.focus();
    }
  };

  const handleSendCode = async () => {
    setTouched({
      email: true,
      code: false,
      newPassword: false,
      confirmPassword: false,
    });

    const emailValidation = validateEmailRealTime(email);
    if (!emailValidation.isValid) {
      setErrors((prev) => ({ ...prev, email: emailValidation.message }));
      return;
    }

    setIsLoading(true);
    try {
      console.log("Starting password reset process for:", email.trim());

      // FIRST: Check if email actually exists
      const emailExists = await checkEmailExists(email);

      if (!emailExists) {
        setErrors({
          email:
            "No account found with this email address. Please check your spelling or sign up for a new account.",
          code: "",
          newPassword: "",
          confirmPassword: "",
        });
        setIsLoading(false);
        return;
      }

      console.log("Email exists, sending reset code...");

      // SECOND: Send the reset email with OTP (6-digit code) instead of magic link
      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        {
          redirectTo: "mataim://reset-password",
        },
      );

      console.log("Reset password response - Error:", error);
      console.log(
        "Reset password response - Error details:",
        JSON.stringify(error, null, 2),
      );

      // Check if the error is actually a success (Supabase sometimes returns error even when email is sent)
      if (error) {
        // Check if this is actually a success case disguised as error
        const isActuallySuccess =
          error.status === 200 ||
          error.message?.includes("OK") ||
          error.message?.includes("email sent") ||
          (error.message === null && error.status === 200);

        if (isActuallySuccess) {
          console.log("✅ Email sent successfully (despite error object)");
          setStep("code");
          setCountdown(60);
          setTouched((prev) => ({ ...prev, code: false }));
          Alert.alert(
            "Verification Code Sent!",
            `We've sent a 6-digit verification code to ${email}. The code will expire in 1 hour.`,
            [{ text: "OK" }],
          );
          setIsLoading(false);
          return;
        }

        let errorMessage =
          "Failed to send verification code. Please try again.";

        if (
          error.message?.includes("rate limit") ||
          error.message?.includes("too many requests")
        ) {
          errorMessage =
            "Too many attempts. Please wait 5 minutes before trying again.";
        } else if (error.message?.includes("email not confirmed")) {
          errorMessage =
            "Please verify your email address before resetting your password.";
        } else if (error.message?.includes("invalid email")) {
          errorMessage = "Please enter a valid email address.";
        } else if (error.message?.includes("user not found")) {
          errorMessage =
            "No account found with this email address. Please check your spelling or sign up for a new account.";
        }

        setErrors({
          email: errorMessage,
          code: "",
          newPassword: "",
          confirmPassword: "",
        });
      } else {
        // Success case - no error
        console.log("✅ Password reset email sent successfully");
        setStep("code");
        setCountdown(60);
        setTouched((prev) => ({ ...prev, code: false }));
        Alert.alert(
          "Verification Code Sent!",
          `We've sent a 6-digit verification code to ${email}. The code will expire in 1 hour.`,
          [{ text: "OK" }],
        );
      }
    } catch (error: any) {
      console.error("Unexpected error in handleSendCode:", error);
      setErrors({
        email:
          "Unable to connect to our servers. Please check your internet connection and try again.",
        code: "",
        newPassword: "",
        confirmPassword: "",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Verify the token and store session data
  const handleVerifyCode = async () => {
    setTouched((prev) => ({ ...prev, code: true }));

    const fullCode = code.join("");

    if (!fullCode.trim()) {
      setErrors((prev) => ({
        ...prev,
        code: "Please enter the 6-digit verification code sent to your email",
      }));
      return;
    }

    if (fullCode.length < 6) {
      setErrors((prev) => ({
        ...prev,
        code: "Please enter all 6 digits of the verification code",
      }));
      return;
    }

    setIsLoading(true);
    try {
      console.log("Verifying OTP code...");

      // Start reset session BEFORE verification
      await passwordResetManager.startResetSession();

      // Verify OTP and get session
      const { data: verifyData, error: verifyError } =
        await supabase.auth.verifyOtp({
          email: email.trim(),
          token: fullCode.trim(),
          type: "recovery",
        });

      if (verifyError) {
        console.error("OTP verification error:", verifyError);
        await passwordResetManager.endResetSession();

        let errorMessage = "Failed to verify code. Please try again.";

        if (
          verifyError.message?.includes("invalid") ||
          verifyError.message?.includes("expired")
        ) {
          errorMessage =
            "This verification code is invalid or has expired. Please request a new code.";
        } else if (verifyError.message?.includes("rate limit")) {
          errorMessage =
            "Too many incorrect attempts. Please wait 1 minute before trying again.";
        } else if (verifyError.message?.includes("already used")) {
          errorMessage =
            "This code has already been used. Please request a new verification code.";
        }

        setErrors((prev) => ({ ...prev, code: errorMessage }));
        setIsLoading(false);
        return;
      }

      console.log("OTP verified successfully - session created");

      // Store that we have a valid recovery session (this prevents auto-login)
      await AsyncStorage.multiSet([
        ["reset_email", email.trim()],
        ["has_valid_reset_session", "true"],
        ["reset_session_timestamp", Date.now().toString()],
        ["recovery_session_active", "true"], // Mark as recovery session
      ]);

      console.log("Session stored successfully, moving to password step");

      // Move to password step
      setStep("newPassword");
      setTouched((prev) => ({
        ...prev,
        newPassword: false,
        confirmPassword: false,
      }));
    } catch (error: any) {
      console.error("Error in handleVerifyCode:", error);
      await passwordResetManager.endResetSession();
      setErrors((prev) => ({
        ...prev,
        code: "Unable to verify code. Please check your connection and try again.",
      }));
    } finally {
      setIsLoading(false);
    }
  };

  // Step 3: Reset password using the active session
  const handleResetPassword = async () => {
    setTouched({
      email: true,
      code: true,
      newPassword: true,
      confirmPassword: true,
    });

    const passwordValidation = validatePasswordRealTime(newPassword);
    const confirmValidation = validateConfirmPassword(
      confirmPassword,
      newPassword,
    );

    if (!passwordValidation.isValid) {
      setErrors((prev) => ({
        ...prev,
        newPassword: passwordValidation.message,
      }));
      return;
    }

    if (!confirmValidation.isValid) {
      setErrors((prev) => ({
        ...prev,
        confirmPassword: confirmValidation.message,
      }));
      return;
    }

    setIsLoading(true);
    try {
      console.log("Attempting to update password with active session...");

      // Get current session first
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        console.log(
          "No session found, checking if recovery session is blocked...",
        );
        // Check if session exists but is being blocked
        const hasValidSession = await AsyncStorage.getItem(
          "has_valid_reset_session",
        );
        if (hasValidSession === "true") {
          console.log(
            "Recovery session exists but is blocked - trying to use it anyway",
          );
          // Continue with password update - the session might still be valid
        } else {
          throw new Error(
            "Session expired. Please start the password reset process again.",
          );
        }
      } else {
        console.log("Active session found:", session.user.id);
      }

      console.log("Updating password...");
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword.trim(),
      });

      if (updateError) {
        console.error("Password update error:", updateError);

        let errorMessage = "Failed to reset password. ";
        if (updateError.message?.includes("weak")) {
          errorMessage +=
            "Password is too weak. Please use a stronger password.";
        } else if (updateError.message?.includes("session")) {
          errorMessage = "Session expired. Please start the process again.";
        } else {
          errorMessage += "Please try again.";
        }

        throw new Error(errorMessage);
      }

      console.log("Password updated successfully!");

      // SUCCESS - clear everything and navigate
      await handleResetSuccess();
    } catch (error: any) {
      console.error("Unexpected error in handleResetPassword:", error);

      let errorMessage =
        error.message ||
        "We encountered a problem while updating your password. Please start the process again.";

      if (
        error.message?.includes("expired") ||
        error.message?.includes("session")
      ) {
        errorMessage =
          "Your session has expired. Please request a new verification code and start over.";
        setStep("email");
        setCode(["", "", "", "", "", ""]);
        await passwordResetManager.endResetSession();
        await AsyncStorage.multiRemove([
          "has_valid_reset_session",
          "recovery_session_active",
        ]);
      }

      Alert.alert("Reset Failed", errorMessage, [
        {
          text: "OK",
          onPress: () => {
            if (error.message?.includes("expired")) {
              setStep("email");
            }
          },
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function for successful reset
  const handleResetSuccess = async () => {
    console.log(
      "Password reset completed successfully - signing out recovery session",
    );

    // SIGN OUT the recovery session immediately after successful password reset
    await supabase.auth.signOut();

    // Clear all stored data
    await AsyncStorage.multiRemove([
      "reset_email",
      "has_valid_reset_session",
      "reset_session_timestamp",
      "recovery_session_active",
    ]);

    await passwordResetManager.completeResetProcess();

    console.log("All sessions cleared, navigating to sign in...");

    // Reset state
    setEmail("");
    setCode(["", "", "", "", "", ""]);
    setNewPassword("");
    setConfirmPassword("");
    setStep("email");
    setTouched({
      email: false,
      code: false,
      newPassword: false,
      confirmPassword: false,
    });

    // Navigate to sign in
    router.replace("/(auth)/signin");

    // Show success message
    setTimeout(() => {
      Alert.alert(
        "Password Reset Successfully!",
        "Your password has been updated successfully. You can now sign in with your new password.",
      );
    }, 500);
  };

  // Handle back navigation
  const handleBack = async () => {
    if (step === "code" || step === "newPassword") {
      console.log("Cleaning up reset session due to back navigation");
      // Clear sessions when going back
      await supabase.auth.signOut();
      await passwordResetManager.endResetSession();
      await AsyncStorage.multiRemove([
        "reset_email",
        "has_valid_reset_session",
        "reset_session_timestamp",
        "recovery_session_active",
      ]);
    }

    if (step === "code") {
      setStep("email");
    } else if (step === "newPassword") {
      setStep("code");
      setErrors((prev) => ({ ...prev, newPassword: "", confirmPassword: "" }));
    }
  };

  // Handle back to sign in
  const handleBackToSignIn = async () => {
    // Clean up any reset sessions
    await supabase.auth.signOut();
    await passwordResetManager.clearSession();
    await AsyncStorage.multiRemove([
      "has_valid_reset_session",
      "recovery_session_active",
    ]);

    router.replace("/(auth)/signin");
  };

  const handleResendCode = async () => {
    if (countdown > 0) return;

    setIsLoading(true);
    try {
      const emailExists = await checkEmailExists(email);

      if (!emailExists) {
        Alert.alert(
          "Email Not Found",
          "No account found with this email address.",
        );
        setIsLoading(false);
        return;
      }

      // Clear any existing sessions and data
      await supabase.auth.signOut();
      await passwordResetManager.endResetSession();
      await AsyncStorage.multiRemove([
        "has_valid_reset_session",
        "reset_session_timestamp",
        "recovery_session_active",
      ]);

      const { error } = await supabase.auth.resetPasswordForEmail(email.trim());

      if (error) {
        Alert.alert(
          "Resend Failed",
          "Unable to send new code. Please try again in a few moments.",
        );
      } else {
        setCountdown(60);
        // Reset code inputs
        setCode(["", "", "", "", "", ""]);
        Alert.alert(
          "New Code Sent",
          "A new 6-digit verification code has been sent to your email.",
        );
      }
    } catch (error: any) {
      Alert.alert(
        "Network Error",
        "Unable to resend code. Please check your connection.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Check if all 6 digits are entered
  const isCodeComplete = code.every((digit) => digit !== "");

  // Enhanced input status helpers
  const getEmailInputStatus = () => {
    if (errors.email) return "error";
    if (email && validateEmail(email)) return "success";
    return "neutral";
  };

  const getPasswordInputStatus = () => {
    if (errors.newPassword) return "error";
    if (newPassword && validatePasswordRealTime(newPassword).isValid)
      return "success";
    return "neutral";
  };

  const getConfirmPasswordInputStatus = () => {
    if (errors.confirmPassword) return "error";
    if (confirmPassword && confirmPassword === newPassword) return "success";
    return "neutral";
  };

  // Wait for fonts to load before rendering
  if (!fontsLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  const renderStep = () => {
    switch (step) {
      case "email":
        return renderEmailStep();
      case "code":
        return renderCodeStep();
      case "newPassword":
        return renderNewPasswordStep();
      default:
        return null;
    }
  };

  const renderEmailStep = () => (
    <Animated.View style={{ opacity: fadeAnim }}>
      <View style={styles.animationContainer}>
        <LottieView
          source={animations.emailAnimation}
          autoPlay
          loop
          style={styles.animation}
        />
      </View>

      <View style={styles.header}>
        <Text style={styles.title}>Reset Password</Text>
        <Text style={styles.subtitle}>
          Enter your email address and we'll send you a verification code to
          reset your password
        </Text>
      </View>

      <View style={styles.form}>
        <View style={styles.inputWrapper}>
          <Text style={styles.inputLabel}>Email Address</Text>
          <View
            style={[
              styles.inputContainer,
              getEmailInputStatus() === "error"
                ? styles.inputError
                : getEmailInputStatus() === "success"
                  ? styles.inputSuccess
                  : null,
            ]}
          >
            <Ionicons
              name="mail-outline"
              size={20}
              color={
                getEmailInputStatus() === "error"
                  ? "#FF3B30"
                  : getEmailInputStatus() === "success"
                    ? "#4CAF50"
                    : "#8E8E93"
              }
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="your.email@example.com"
              value={email}
              onChangeText={setEmail}
              onFocus={() => handleFieldFocus("email")}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholderTextColor="#8E8E93"
              editable={!isLoading}
            />
            {getEmailInputStatus() === "success" && (
              <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
            )}
            {getEmailInputStatus() === "error" && (
              <Ionicons name="close-circle" size={20} color="#FF3B30" />
            )}
          </View>
          {errors.email ? (
            <View style={styles.errorContainer}>
              <Ionicons name="warning-outline" size={14} color="#FF3B30" />
              <Text style={styles.errorText}>{errors.email}</Text>
            </View>
          ) : getEmailInputStatus() === "success" ? (
            <View style={styles.successContainer}>
              <Ionicons
                name="checkmark-circle-outline"
                size={14}
                color="#4CAF50"
              />
              <Text style={styles.successText}>Valid email address</Text>
            </View>
          ) : (
            <Text style={styles.helperText}>
              We'll send a verification code to this email
            </Text>
          )}
        </View>

        <TouchableOpacity
          style={[
            styles.primaryButton,
            isLoading && styles.disabledButton,
            (!email.trim() || !validateEmail(email)) && styles.disabledButton,
          ]}
          onPress={handleSendCode}
          disabled={isLoading || !email.trim() || !validateEmail(email)}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="send-outline" size={18} color="#fff" />
              <Text style={styles.primaryButtonText}>
                Send Verification Code
              </Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBackToSignIn}
          disabled={isLoading}
        >
          <Ionicons name="arrow-back" size={16} color="#666" />
          <Text style={styles.backButtonText}>Back to Sign In</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  const renderCodeStep = () => (
    <Animated.View style={{ opacity: fadeAnim }}>
      <View style={styles.animationContainer}>
        <LottieView
          source={animations.codeVerificationAnimation}
          autoPlay
          loop
          style={styles.animation}
        />
      </View>

      <View style={styles.header}>
        <Text style={styles.title}>Enter Verification Code</Text>
        <Text style={styles.subtitle}>We sent a 6-digit code to</Text>
        <Text style={styles.emailHighlight}>{email}</Text>
        <Text style={styles.helperText}>The code will expire in 1 hour</Text>
      </View>

      <View style={styles.form}>
        <View style={styles.inputWrapper}>
          <Text style={styles.inputLabel}>Verification Code</Text>
          <View style={styles.codeContainer}>
            {code.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => (codeInputs.current[index] = ref)}
                style={[
                  styles.codeInput,
                  code[index] && styles.codeInputFilled,
                  errors.code && styles.codeInputError,
                  isCodeComplete && !errors.code && styles.codeInputComplete,
                ]}
                value={digit}
                onChangeText={(text) => handleCodeChange(text, index)}
                onKeyPress={(e) => handleCodeKeyPress(e, index)}
                onFocus={() => handleFieldFocus("code")}
                keyboardType="number-pad"
                maxLength={1}
                selectTextOnFocus
                editable={!isLoading}
              />
            ))}
          </View>
          {errors.code ? (
            <View style={styles.errorContainer}>
              <Ionicons name="warning-outline" size={14} color="#FF3B30" />
              <Text style={styles.errorText}>{errors.code}</Text>
            </View>
          ) : isCodeComplete && !errors.code ? (
            <View style={styles.successContainer}>
              <Ionicons
                name="checkmark-circle-outline"
                size={14}
                color="#4CAF50"
              />
              <Text style={styles.successText}>
                All digits entered - ready to verify
              </Text>
            </View>
          ) : (
            <Text style={styles.helperText}>
              Enter all 6 digits from your email
            </Text>
          )}
        </View>

        <TouchableOpacity
          style={[
            styles.primaryButton,
            (isLoading || code.join("").length < 6) && styles.disabledButton,
          ]}
          onPress={handleVerifyCode}
          disabled={isLoading || code.join("").length < 6}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="checkmark" size={18} color="#fff" />
              <Text style={styles.primaryButtonText}>Verify Code</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.resendContainer}>
          <Text style={styles.resendText}>Didn't receive the code? </Text>
          <TouchableOpacity
            onPress={handleResendCode}
            disabled={isLoading || countdown > 0}
          >
            <Text
              style={[
                styles.resendLink,
                (isLoading || countdown > 0) && styles.resendLinkDisabled,
              ]}
            >
              {countdown > 0
                ? `Resend in ${formatCountdown(countdown)}`
                : "Resend Code"}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBack}
          disabled={isLoading}
        >
          <Ionicons name="arrow-back" size={16} color="#666" />
          <Text style={styles.backButtonText}>Back to Email</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  const renderNewPasswordStep = () => (
    <Animated.View style={{ opacity: fadeAnim }}>
      <View style={styles.animationContainer}>
        <LottieView
          source={animations.passwordResetAnimation}
          autoPlay
          loop
          style={styles.animation}
        />
      </View>

      <View style={styles.header}>
        <Text style={styles.title}>Create New Password</Text>
        <Text style={styles.subtitle}>
          Create a strong, secure password for your account
        </Text>
      </View>

      <View style={styles.form}>
        <View style={styles.inputWrapper}>
          <Text style={styles.inputLabel}>New Password</Text>
          <View
            style={[
              styles.inputContainer,
              getPasswordInputStatus() === "error"
                ? styles.inputError
                : getPasswordInputStatus() === "success"
                  ? styles.inputSuccess
                  : null,
            ]}
          >
            <Ionicons
              name="lock-closed-outline"
              size={20}
              color={
                getPasswordInputStatus() === "error"
                  ? "#FF3B30"
                  : getPasswordInputStatus() === "success"
                    ? "#4CAF50"
                    : "#8E8E93"
              }
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="Create a strong password"
              value={newPassword}
              onChangeText={setNewPassword}
              onFocus={() => handleFieldFocus("newPassword")}
              secureTextEntry={!showPassword}
              placeholderTextColor="#8E8E93"
              editable={!isLoading}
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              style={styles.passwordToggle}
            >
              <Ionicons
                name={showPassword ? "eye-off" : "eye"}
                size={20}
                color={
                  getPasswordInputStatus() === "error" ? "#FF3B30" : "#8E8E93"
                }
              />
            </TouchableOpacity>
            {getPasswordInputStatus() === "success" && (
              <Ionicons
                name="checkmark-circle"
                size={20}
                color="#4CAF50"
                style={styles.inputStatusIcon}
              />
            )}
            {getPasswordInputStatus() === "error" && (
              <Ionicons
                name="close-circle"
                size={20}
                color="#FF3B30"
                style={styles.inputStatusIcon}
              />
            )}
          </View>
          {errors.newPassword ? (
            <View style={styles.errorContainer}>
              <Ionicons name="warning-outline" size={14} color="#FF3B30" />
              <Text style={styles.errorText}>{errors.newPassword}</Text>
            </View>
          ) : getPasswordInputStatus() === "success" ? (
            <View style={styles.successContainer}>
              <Ionicons
                name="checkmark-circle-outline"
                size={14}
                color="#4CAF50"
              />
              <Text style={styles.successText}>Strong password</Text>
            </View>
          ) : (
            <Text style={styles.helperText}>
              Use at least 6 characters with letters and numbers
            </Text>
          )}
        </View>

        <View style={styles.inputWrapper}>
          <Text style={styles.inputLabel}>Confirm Password</Text>
          <View
            style={[
              styles.inputContainer,
              getConfirmPasswordInputStatus() === "error"
                ? styles.inputError
                : getConfirmPasswordInputStatus() === "success"
                  ? styles.inputSuccess
                  : null,
            ]}
          >
            <Ionicons
              name="lock-closed-outline"
              size={20}
              color={
                getConfirmPasswordInputStatus() === "error"
                  ? "#FF3B30"
                  : getConfirmPasswordInputStatus() === "success"
                    ? "#4CAF50"
                    : "#8E8E93"
              }
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="Re-enter your password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              onFocus={() => handleFieldFocus("confirmPassword")}
              secureTextEntry={!showConfirmPassword}
              placeholderTextColor="#8E8E93"
              editable={!isLoading}
            />
            <TouchableOpacity
              onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              style={styles.passwordToggle}
            >
              <Ionicons
                name={showConfirmPassword ? "eye-off" : "eye"}
                size={20}
                color={
                  getConfirmPasswordInputStatus() === "error"
                    ? "#FF3B30"
                    : "#8E8E93"
                }
              />
            </TouchableOpacity>
            {getConfirmPasswordInputStatus() === "success" && (
              <Ionicons
                name="checkmark-circle"
                size={20}
                color="#4CAF50"
                style={styles.inputStatusIcon}
              />
            )}
            {getConfirmPasswordInputStatus() === "error" && (
              <Ionicons
                name="close-circle"
                size={20}
                color="#FF3B30"
                style={styles.inputStatusIcon}
              />
            )}
          </View>
          {errors.confirmPassword ? (
            <View style={styles.errorContainer}>
              <Ionicons name="warning-outline" size={14} color="#FF3B30" />
              <Text style={styles.errorText}>{errors.confirmPassword}</Text>
            </View>
          ) : getConfirmPasswordInputStatus() === "success" ? (
            <View style={styles.successContainer}>
              <Ionicons
                name="checkmark-circle-outline"
                size={14}
                color="#4CAF50"
              />
              <Text style={styles.successText}>Passwords match</Text>
            </View>
          ) : (
            <Text style={styles.helperText}>
              Re-enter your password to confirm
            </Text>
          )}
        </View>

        <TouchableOpacity
          style={[
            styles.primaryButton,
            isLoading && styles.disabledButton,
            (!newPassword.trim() ||
              !confirmPassword.trim() ||
              newPassword !== confirmPassword ||
              !validatePasswordRealTime(newPassword).isValid) &&
              styles.disabledButton,
          ]}
          onPress={handleResetPassword}
          disabled={
            isLoading ||
            !newPassword.trim() ||
            !confirmPassword.trim() ||
            newPassword !== confirmPassword ||
            !validatePasswordRealTime(newPassword).isValid
          }
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="refresh" size={18} color="#fff" />
              <Text style={styles.primaryButtonText}>Reset Password</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBack}
          disabled={isLoading}
        >
          <Ionicons name="arrow-back" size={16} color="#666" />
          <Text style={styles.backButtonText}>Back to Code Verification</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {renderStep()}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: "#666",
    fontFamily: "System",
  },
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  animationContainer: {
    height: 200,
    marginTop: 40,
    alignItems: "center",
  },
  animation: {
    width: "100%",
    height: "100%",
  },
  header: {
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontFamily: "Caprasimo-Regular",
    color: "#1A1A1A",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "AlanSans-Medium",
    color: "#666",
    textAlign: "center",
    lineHeight: 22,
  },
  emailHighlight: {
    fontSize: 15,
    fontFamily: "AlanSans-Medium",
    color: "#FF6B35",
    marginTop: 4,
    fontWeight: "600",
  },
  form: {
    paddingHorizontal: 16,
  },
  inputWrapper: {
    marginBottom: 20,
  },
  inputLabel: {
    color: "#1A1A1A",
    fontSize: 14,
    fontFamily: "AlanSans-Medium",
    marginBottom: 8,
    marginLeft: 4,
    fontWeight: "600",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8F8F8",
    borderWidth: 1,
    borderColor: "#E5E5E5",
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 54,
  },
  inputError: {
    borderColor: "#FF3B30",
    backgroundColor: "#FFF5F5",
  },
  inputSuccess: {
    borderColor: "#4CAF50",
    backgroundColor: "#F5FFF5",
  },
  inputIcon: {
    marginRight: 8,
  },
  inputStatusIcon: {
    marginLeft: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: "#1A1A1A",
    fontFamily: "AlanSans-Medium",
    paddingVertical: 0,
  },
  passwordToggle: {
    padding: 4,
    marginLeft: 8,
  },
  codeContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  codeInput: {
    width: (width - 104) / 6,
    height: 56,
    borderWidth: 1,
    borderColor: "#E5E5E5",
    borderRadius: 8,
    backgroundColor: "#F8F8F8",
    textAlign: "center",
    fontSize: 20,
    fontFamily: "AlanSans-Medium",
    color: "#1A1A1A",
    fontWeight: "600",
  },
  codeInputFilled: {
    borderColor: "#FF6B35",
    backgroundColor: "#FFF5F0",
  },
  codeInputError: {
    borderColor: "#FF3B30",
    backgroundColor: "#FFF5F5",
  },
  codeInputComplete: {
    borderColor: "#4CAF50",
    backgroundColor: "#F0F9F0",
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    marginLeft: 4,
  },
  errorText: {
    color: "#FF3B30",
    fontSize: 13,
    fontFamily: "AlanSans-Medium",
    marginLeft: 6,
    flex: 1,
  },
  successContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    marginLeft: 4,
  },
  successText: {
    color: "#4CAF50",
    fontSize: 13,
    fontFamily: "AlanSans-Medium",
    marginLeft: 6,
    fontWeight: "500",
  },
  helperText: {
    color: "#8E8E93",
    fontSize: 12,
    fontFamily: "AlanSans-Medium",
    marginTop: 6,
    marginLeft: 4,
  },
  primaryButton: {
    backgroundColor: "#FF6B35",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
    shadowColor: "#FF6B35",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  disabledButton: {
    opacity: 0.6,
    shadowOpacity: 0.1,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "AlanSans-Medium",
    fontWeight: "600",
  },
  resendContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    flexWrap: "wrap",
  },
  resendText: {
    color: "#666",
    fontSize: 14,
    fontFamily: "AlanSans-Medium",
    textAlign: "center",
  },
  resendLink: {
    color: "#FF6B35",
    fontFamily: "AlanSans-Medium",
    fontSize: 14,
    fontWeight: "600",
  },
  resendLinkDisabled: {
    color: "#999",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    gap: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    backgroundColor: "#FAFAFA",
    marginTop: 8,
  },
  backButtonText: {
    color: "#666",
    fontSize: 14,
    fontFamily: "AlanSans-Medium",
    fontWeight: "500",
  },
});
