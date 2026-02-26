// app/(auth)/signup.tsx
import {
  Ionicons,
  MaterialCommunityIcons,
  MaterialIcons,
} from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useFonts } from "expo-font";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import LottieView from "lottie-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { useAuth } from "../../backend/AuthContext";
import { NotificationService } from "../../backend/services/notificationService";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Options for dropdowns
// Options for dropdowns with icons
const GENDER_OPTIONS = [
  { value: "Male", label: "Male", icon: "♂️", color: "#3498db" },
  { value: "Female", label: "Female", icon: "♀️", color: "#e84393" },
  { value: "Other", label: "Other", icon: "⚧️", color: "#9b59b6" },
  {
    value: "Prefer not to say",
    label: "Prefer not to say",
    icon: "🙅",
    color: "#95a5a6",
  },
];

const VEHICLE_OPTIONS = [
  { value: "Car", label: "Car", icon: "🚗", color: "#FF6B35" },
  { value: "Motorcycle", label: "Motorcycle", icon: "🏍️", color: "#2E86DE" },
  { value: "Bicycle", label: "Bicycle", icon: "🚲", color: "#10AC84" },
  { value: "Scooter", label: "Scooter", icon: "🛵", color: "#FF9500" },
  { value: "Truck", label: "Truck", icon: "🚚", color: "#8E44AD" },
];

const AVAILABILITY_OPTIONS = [
  { value: "Full-time", label: "Full-time", icon: "⏰", color: "#2ECC71" },
  { value: "Part-time", label: "Part-time", icon: "🕐", color: "#F39C12" },
  { value: "Flexible", label: "Flexible", icon: "🔄", color: "#3498DB" },
  {
    value: "Weekends only",
    label: "Weekends only",
    icon: "🗓️",
    color: "#9B59B6",
  },
];

const CUISINE_OPTIONS = [
  { value: "Arabic", label: "Arabic", icon: "🥙", color: "#FF6B35" },
  { value: "Indian", label: "Indian", icon: "🍛", color: "#FF9F43" },
  { value: "Chinese", label: "Chinese", icon: "🥡", color: "#10AC84" },
  { value: "Italian", label: "Italian", icon: "🍝", color: "#EE5A24" },
  { value: "American", label: "American", icon: "🍔", color: "#D980FA" },
  { value: "Mexican", label: "Mexican", icon: "🌮", color: "#00D2D3" },
  { value: "Japanese", label: "Japanese", icon: "🍣", color: "#2E86DE" },
  { value: "Thai", label: "Thai", icon: "🍲", color: "#FF9FF3" },
  {
    value: "Mediterranean",
    label: "Mediterranean",
    icon: "🥗",
    color: "#A3CB38",
  },
  { value: "Fast Food", label: "Fast Food", icon: "🍟", color: "#ED4C67" },
];

const PAYMENT_OPTIONS = [
  { value: "Cash", label: "Cash", icon: "💵", color: "#27AE60" },
  { value: "Credit Card", label: "Credit Card", icon: "💳", color: "#3498DB" },
  { value: "Debit Card", label: "Debit Card", icon: "💰", color: "#2980B9" },
  {
    value: "Digital Wallet",
    label: "Digital Wallet",
    icon: "📱",
    color: "#8E44AD",
  },
  {
    value: "Bank Transfer",
    label: "Bank Transfer",
    icon: "🏦",
    color: "#16A085",
  },
];

// Opening hours options with icons
const OPENING_HOURS_OPTIONS = [
  {
    value: "6:00 AM - 10:00 PM",
    label: "6:00 AM - 10:00 PM",
    icon: "🌅",
    color: "#FF6B35",
  },
  {
    value: "7:00 AM - 11:00 PM",
    label: "7:00 AM - 11:00 PM",
    icon: "☀️",
    color: "#FF9500",
  },
  {
    value: "8:00 AM - 12:00 AM",
    label: "8:00 AM - 12:00 AM",
    icon: "🕗",
    color: "#3498DB",
  },
  {
    value: "9:00 AM - 10:00 PM",
    label: "9:00 AM - 10:00 PM",
    icon: "🕘",
    color: "#2ECC71",
  },
  {
    value: "10:00 AM - 11:00 PM",
    label: "10:00 AM - 11:00 PM",
    icon: "🕙",
    color: "#F39C12",
  },
  {
    value: "11:00 AM - 12:00 AM",
    label: "11:00 AM - 12:00 AM",
    icon: "🕚",
    color: "#9B59B6",
  },
  { value: "24 Hours", label: "24 Hours", icon: "⏳", color: "#E74C3C" },
  {
    value: "6:00 AM - 2:00 AM",
    label: "6:00 AM - 2:00 AM",
    icon: "🌙",
    color: "#34495E",
  },
  {
    value: "8:00 AM - 2:00 AM",
    label: "8:00 AM - 2:00 AM",
    icon: "🌃",
    color: "#16A085",
  },
  {
    value: "Custom Hours",
    label: "Custom Hours",
    icon: "⚙️",
    color: "#7F8C8D",
  },
];

// Country codes with flags - Only UAE and Uganda
const COUNTRY_CODES = [
  { code: "+971", flag: "🇦🇪", name: "UAE", currency: "AED" },
  { code: "+256", flag: "🇺🇬", name: "Uganda", currency: "UGX" },
];

export default function SignUpScreen() {
  const { userType } = useLocalSearchParams();
  const router = useRouter();
  const { signUp } = useAuth();

  // Load your Google Fonts
  const [fontsLoaded] = useFonts({
    "Caprasimo-Bold": require("../../assets/fonts/Alan_Sans,Caprasimo/Caprasimo/Caprasimo-Regular.ttf"),
    "Poppins-SemiBold": require("../../assets/fonts/Alan_Sans,Caprasimo,Work_Sans/Alan_Sans/static/AlanSans-Medium.ttf"),
  });

  const [formData, setFormData] = useState({
    // Basic Info
    fullName: "",
    email: "",
    phone: "",
    countryCode: "+971", // Default to UAE
    password: "",
    confirmPassword: "",

    // Customer Specific
    dateOfBirth: "",
    gender: "",

    // Driver Specific
    vehicleType: "",
    licenseNumber: "",
    vehiclePlate: "",
    yearsOfExperience: "",
    availability: "",
    insuranceNumber: "",

    // Restaurant Specific
    restaurantName: "",
    cuisineType: "",
    businessLicense: "",
    openingHours: "",
    capacity: "",
    deliveryRadius: "",
    paymentMethods: [],

    // Location (common for all)
    address: "",
    latitude: null,
    longitude: null,
    locationCode: "",
  });

  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Modal States
  const [mapModalVisible, setMapModalVisible] = useState(false);
  const [dropdownModal, setDropdownModal] = useState({
    visible: false,
    type: "",
    options: [],
    multiSelect: false,
  });
  const [countryModalVisible, setCountryModalVisible] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Location States
  const [currentLocation, setCurrentLocation] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [locationAccuracy, setLocationAccuracy] = useState(null);

  useEffect(() => {
    if (!userType) {
      router.back();
    }
    getCurrentLocation();
  }, [userType]);

  // Enhanced email validation
  const validateEmail = (email) => {
    const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return re.test(email);
  };

  // Enhanced phone validation for UAE and Uganda
  const validatePhone = (phone, countryCode) => {
    // Remove any non-digit characters
    const cleanPhone = phone.replace(/\D/g, "");

    // Phone validation based on country
    const phoneRules = {
      "+971": {
        // UAE
        length: 9,
        pattern: /^5[0-9]{8}$/, // UAE numbers start with 5
        example: "501234567",
      },
      "+256": {
        // Uganda
        length: 9,
        pattern: /^[0-9]{9}$/,
        example: "712345678",
      },
    };

    const rule = phoneRules[countryCode];
    if (!rule) return false;

    return cleanPhone.length === rule.length && rule.pattern.test(cleanPhone);
  };

  // Format phone number as user types
  const formatPhoneNumber = (text, countryCode) => {
    // Remove all non-digit characters
    const cleanText = text.replace(/\D/g, "");

    // Format based on country code
    let formatted = cleanText;

    if (countryCode === "+971") {
      // UAE format: XX XXX XXXX
      if (cleanText.length > 6) {
        formatted = `${cleanText.slice(0, 2)} ${cleanText.slice(
          2,
          5,
        )} ${cleanText.slice(5, 9)}`;
      } else if (cleanText.length > 2) {
        formatted = `${cleanText.slice(0, 2)} ${cleanText.slice(2)}`;
      }
    } else if (countryCode === "+256") {
      // Uganda format: XXX XXX XXX
      if (cleanText.length > 6) {
        formatted = `${cleanText.slice(0, 3)} ${cleanText.slice(
          3,
          6,
        )} ${cleanText.slice(6, 9)}`;
      } else if (cleanText.length > 3) {
        formatted = `${cleanText.slice(0, 3)} ${cleanText.slice(3)}`;
      }
    }

    return formatted;
  };

  // Handle date selection
  const onDateChange = (event, selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setSelectedDate(selectedDate);
      const formattedDate = selectedDate.toISOString().split("T")[0]; // YYYY-MM-DD
      setFormData({ ...formData, dateOfBirth: formattedDate });
    }
  };

  // Show date picker
  const showDatepicker = () => {
    setShowDatePicker(true);
  };

  // Format date for display
  const formatDisplayDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // Real-time validations
  useEffect(() => {
    const newErrors = { ...errors };

    // Email validation
    if (formData.email.trim() && !validateEmail(formData.email)) {
      newErrors.email =
        "Please enter a valid email address (e.g., name@domain.com)";
    } else if (formData.email.trim()) {
      delete newErrors.email;
    }

    // Password validation
    if (formData.password.trim() && formData.password.length < 8) {
      newErrors.password = "Password must be at least 8 characters";
    } else if (
      formData.password.trim() &&
      !/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)
    ) {
      newErrors.password =
        "Password must contain uppercase, lowercase letters and numbers";
    } else if (formData.password.trim()) {
      delete newErrors.password;
    }

    // Confirm password validation
    if (
      formData.confirmPassword.trim() &&
      formData.password !== formData.confirmPassword
    ) {
      newErrors.confirmPassword = "Passwords do not match";
    } else if (formData.confirmPassword.trim()) {
      delete newErrors.confirmPassword;
    }

    // Phone validation
    if (
      formData.phone.trim() &&
      !validatePhone(formData.phone, formData.countryCode)
    ) {
      const country = COUNTRY_CODES.find(
        (c) => c.code === formData.countryCode,
      );
      const rule =
        country?.code === "+971"
          ? "Phone number must be 9 digits starting with 5 (e.g., 501234567)"
          : "Phone number must be 9 digits (e.g., 712345678)";
      newErrors.phone = rule;
    } else if (formData.phone.trim()) {
      delete newErrors.phone;
    }

    setErrors(newErrors);
  }, [
    formData.email,
    formData.password,
    formData.confirmPassword,
    formData.phone,
    formData.countryCode,
  ]);

  // Handle phone input change with formatting
  const handlePhoneChange = (text) => {
    const formattedPhone = formatPhoneNumber(text, formData.countryCode);
    setFormData({ ...formData, phone: formattedPhone });
  };

  // Handle country code selection
  const handleCountrySelect = (country) => {
    setFormData({
      ...formData,
      countryCode: country.code,
      phone: "", // Clear phone when country changes
    });
    setCountryModalVisible(false);
  };

  // Get current location
  const getCurrentLocation = async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission denied",
          "Location permission is required to select delivery address",
        );
        return;
      }

      let location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        timeout: 15000,
      });

      const { latitude, longitude, accuracy } = location.coords;
      setLocationAccuracy(accuracy);

      setCurrentLocation({
        latitude,
        longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      });
      setSelectedLocation({ latitude, longitude });

      await getAddressFromCoordinates(latitude, longitude);
    } catch (error) {
      console.error("Error getting location:", error);
      Alert.alert(
        "Location Error",
        "Unable to get your current location. Please try again.",
      );
    }
  };

  // Get address from coordinates
  const getAddressFromCoordinates = async (latitude, longitude) => {
    try {
      const [address] = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });

      const formattedAddress = [
        address.name,
        address.street,
        address.streetNumber,
        address.district,
        address.city,
        address.region,
        address.country,
      ]
        .filter(Boolean)
        .join(", ");

      const locationCode = generateLocationCode(latitude, longitude);

      setFormData((prev) => ({
        ...prev,
        address: formattedAddress,
        latitude: latitude,
        longitude: longitude,
        locationCode: locationCode,
      }));
    } catch (error) {
      console.error("Error getting address:", error);
    }
  };

  // Generate unique location code
  const generateLocationCode = (lat, lng) => {
    const latCode = Math.abs(lat).toFixed(6).replace(".", "").substring(0, 6);
    const lngCode = Math.abs(lng).toFixed(6).replace(".", "").substring(0, 6);
    return `LOC-${latCode}-${lngCode}`;
  };

  // Handle map press to select location
  const handleMapPress = (event) => {
    const { coordinate } = event.nativeEvent;
    setSelectedLocation(coordinate);
    getAddressFromCoordinates(coordinate.latitude, coordinate.longitude);
  };

  // Confirm selected location
  const confirmLocation = () => {
    if (selectedLocation) {
      setMapModalVisible(false);
    }
  };

  // Dropdown handlers
  const openDropdown = (type, options, multiSelect = false) => {
    setDropdownModal({ visible: true, type, options, multiSelect });
  };

  const closeDropdown = () => {
    setDropdownModal({
      visible: false,
      type: "",
      options: [],
      multiSelect: false,
    });
  };

  // Format selected options with icons
  const formatSelectedOptions = (options) => {
    if (!options || (Array.isArray(options) && options.length === 0)) return "";

    if (Array.isArray(options)) {
      return options
        .map((option) => {
          const optionObj = findOptionByValue(option);
          return optionObj ? `${optionObj.icon} ${optionObj.label}` : option;
        })
        .join(", ");
    }

    const optionObj = findOptionByValue(options);
    return optionObj
      ? `${optionObj.icon} ${optionObj.label}`
      : options.toString();
  };

  // Helper function to find option by value
  const findOptionByValue = (value) => {
    const allOptions = [
      ...GENDER_OPTIONS,
      ...VEHICLE_OPTIONS,
      ...AVAILABILITY_OPTIONS,
      ...CUISINE_OPTIONS,
      ...PAYMENT_OPTIONS,
      ...OPENING_HOURS_OPTIONS,
    ];
    return allOptions.find((option) => option.value === value);
  };

  // Handle select option with object support
  const handleSelectOption = (option) => {
    const { type, multiSelect } = dropdownModal;

    if (multiSelect) {
      const currentValues = formData[type] || [];
      const optionValue = option.value || option;
      const newValues = currentValues.includes(optionValue)
        ? currentValues.filter((item) => item !== optionValue)
        : [...currentValues, optionValue];

      setFormData((prev) => ({ ...prev, [type]: newValues }));
    } else {
      const optionValue = option.value || option;
      setFormData((prev) => ({ ...prev, [type]: optionValue }));
      setDropdownModal({
        visible: false,
        type: "",
        options: [],
        multiSelect: false,
      });
    }
  };

  const getAnimationSource = () => {
    return require("../../assets/animations/sign up animation.json");
  };

  const getTitle = () => {
    switch (userType) {
      case "customer":
        return "Customer Sign Up";
      case "restaurant":
        return "Restaurant Sign Up";
      case "driver":
        return "Driver Sign Up";
      default:
        return "Sign Up";
    }
  };

  const validateForm = () => {
    let isValid = true;
    const newErrors = {};

    // Basic validations for all users
    if (!formData.fullName.trim()) {
      newErrors.fullName = "Full name is required";
      isValid = false;
    } else if (formData.fullName.trim().length < 2) {
      newErrors.fullName = "Full name must be at least 2 characters";
      isValid = false;
    }

    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
      isValid = false;
    } else if (!validateEmail(formData.email)) {
      newErrors.email =
        "Please enter a valid email address (e.g., name@domain.com)";
      isValid = false;
    }

    if (!formData.phone.trim()) {
      newErrors.phone = "Phone number is required";
      isValid = false;
    } else if (!validatePhone(formData.phone, formData.countryCode)) {
      const country = COUNTRY_CODES.find(
        (c) => c.code === formData.countryCode,
      );
      const rule =
        country?.code === "+971"
          ? "Phone number must be 9 digits starting with 5 (e.g., 501234567)"
          : "Phone number must be 9 digits (e.g., 712345678)";
      newErrors.phone = rule;
      isValid = false;
    }

    if (!formData.password.trim()) {
      newErrors.password = "Password is required";
      isValid = false;
    } else if (formData.password.length < 8) {
      newErrors.password = "Password must be at least 8 characters";
      isValid = false;
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      newErrors.password =
        "Password must contain uppercase, lowercase letters and numbers";
      isValid = false;
    }

    if (!formData.confirmPassword.trim()) {
      newErrors.confirmPassword = "Please confirm your password";
      isValid = false;
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
      isValid = false;
    }

    // Location validation for all users
    if (!formData.address.trim()) {
      newErrors.address = "Please select your location from the map";
      isValid = false;
    }

    // Enhanced type-specific validations
    if (userType === "driver") {
      if (!formData.vehicleType.trim()) {
        newErrors.vehicleType = "Vehicle type is required for drivers";
        isValid = false;
      }
      if (!formData.licenseNumber.trim()) {
        newErrors.licenseNumber = "License number is required for drivers";
        isValid = false;
      } else if (formData.licenseNumber.trim().length < 5) {
        newErrors.licenseNumber = "Please enter a valid license number";
        isValid = false;
      }
      if (!formData.vehiclePlate.trim()) {
        newErrors.vehiclePlate = "Vehicle plate is required for drivers";
        isValid = false;
      }
    }

    if (userType === "restaurant") {
      if (!formData.restaurantName.trim()) {
        newErrors.restaurantName = "Restaurant name is required";
        isValid = false;
      }
      if (!formData.cuisineType.trim()) {
        newErrors.cuisineType = "Cuisine type is required";
        isValid = false;
      }
      if (!formData.businessLicense.trim()) {
        newErrors.businessLicense = "Business license is required";
        isValid = false;
      }
      if (!formData.openingHours.trim()) {
        newErrors.openingHours = "Opening hours are required";
        isValid = false;
      }
    }

    if (userType === "customer") {
      if (!formData.dateOfBirth.trim()) {
        newErrors.dateOfBirth = "Date of birth is required";
        isValid = false;
      } else {
        // Additional date validation
        const birthDate = new Date(formData.dateOfBirth);
        const today = new Date();
        const minAgeDate = new Date();
        minAgeDate.setFullYear(today.getFullYear() - 13); // Minimum 13 years old

        if (birthDate > minAgeDate) {
          newErrors.dateOfBirth = "You must be at least 13 years old";
          isValid = false;
        }
      }
    }

    setErrors(newErrors);

    // Log validation result for debugging
    console.log("Form validation result:", { isValid, errors: newErrors });

    return isValid;
  };

  const handleSignUp = async () => {
    if (!validateForm()) {
      Alert.alert(
        "Validation Error",
        "Please fix the errors in the form before submitting.",
      );
      return;
    }

    setIsLoading(true);
    try {
      const fullPhoneNumber = `${formData.countryCode}${formData.phone.replace(
        /\D/g,
        "",
      )}`;

      const userData = {
        userType: userType,
        fullName: formData.fullName.trim(),
        email: formData.email.trim().toLowerCase(),
        phone: fullPhoneNumber,
        countryCode: formData.countryCode,
        address: formData.address,
        latitude: formData.latitude ? parseFloat(formData.latitude) : null,
        longitude: formData.longitude ? parseFloat(formData.longitude) : null,
        locationCode: formData.locationCode,

        ...(userType === "customer" && {
          dateOfBirth: formData.dateOfBirth.trim(),
          gender: formData.gender,
        }),

        ...(userType === "driver" && {
          vehicleType: formData.vehicleType,
          licenseNumber: formData.licenseNumber.trim(),
          vehiclePlate: formData.vehiclePlate.trim(),
          yearsOfExperience: formData.yearsOfExperience
            ? parseInt(formData.yearsOfExperience)
            : null,
          availability: formData.availability,
          insuranceNumber: formData.insuranceNumber.trim(),
        }),

        ...(userType === "restaurant" && {
          restaurantName: formData.restaurantName.trim(),
          cuisineType: formData.cuisineType,
          businessLicense: formData.businessLicense.trim(),
          openingHours: formData.openingHours.trim(),
          capacity: formData.capacity ? parseInt(formData.capacity) : null,
          deliveryRadius: formData.deliveryRadius
            ? parseInt(formData.deliveryRadius)
            : null,
          paymentMethods: formData.paymentMethods,
        }),
      };

      console.log("🚀 Starting signup process...");
      const { error, data } = await signUp(
        formData.email.trim().toLowerCase(),
        formData.password,
        userData,
      );

      if (error) {
        console.error("❌ Sign up error:", error);
        Alert.alert(
          "Sign Up Error",
          error.message || "Something went wrong. Please try again.",
        );
        return;
      }

      console.log("✅ Auth account created successfully!");

      // Send welcome notification
      try {
        const userId = data?.user?.id;
        if (userId) {
          await NotificationService.sendWelcomeNotification(
            userId,
            formData.fullName,
          );
        }
      } catch (notifError) {
        console.log("Notification error (non-critical):", notifError);
      }

      // Check if user data is complete before navigation
      if (data?.user) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        Alert.alert(
          "Account Created Successfully! 🎉",
          `Welcome to Mataim, ${formData.fullName}! Your account has been created.`,
          [
            {
              text: "Get Started",
              onPress: () => {
                // Redirect based on user type
                switch (userType) {
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
              },
            },
          ],
        );
      } else {
        Alert.alert(
          "Account Created!",
          "Your account has been created. Please sign in to continue.",
          [
            {
              text: "Sign In",
              onPress: () => router.replace("/(auth)/signin"),
            },
          ],
        );
      }
    } catch (error: any) {
      console.error("💥 Unexpected error in handleSignUp:", error);
      Alert.alert(
        "Error",
        error.message || "Something went wrong. Please try again.",
        [{ text: "OK" }],
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Render Select Input Component
  const renderSelectInput = (
    label,
    fieldName,
    options,
    multiSelect = false,
    error = null,
  ) => (
    <>
      <Text style={styles.inputLabel}>{label}</Text>
      <TouchableOpacity
        style={[
          styles.inputContainer,
          styles.selectInput,
          error && styles.inputError,
        ]}
        onPress={() => openDropdown(fieldName, options, multiSelect)}
      >
        <Ionicons
          name="chevron-down-outline"
          size={20}
          color="#666"
          style={styles.inputIcon}
        />
        <Text
          style={[styles.input, !formData[fieldName] && styles.placeholderText]}
        >
          {formatSelectedOptions(formData[fieldName]) ||
            `Select ${label.toLowerCase()}`}
        </Text>
        <Ionicons name="list-outline" size={20} color="#666" />
      </TouchableOpacity>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </>
  );

  // Render Phone Input with Country Selector
  const renderPhoneInput = () => {
    const selectedCountry = COUNTRY_CODES.find(
      (country) => country.code === formData.countryCode,
    );

    return (
      <>
        <Text style={styles.inputLabel}>Phone Number</Text>
        <View
          style={[styles.inputContainer, errors.phone && styles.inputError]}
        >
          <TouchableOpacity
            style={styles.countrySelector}
            onPress={() => setCountryModalVisible(true)}
          >
            <Text style={styles.flagText}>{selectedCountry?.flag}</Text>
            <Ionicons name="chevron-down" size={16} color="#666" />
          </TouchableOpacity>

          <Text style={styles.countryCodeText}>{formData.countryCode}</Text>

          <TextInput
            style={[styles.input, styles.phoneInput]}
            placeholder={
              selectedCountry?.code === "+971" ? "501234567" : "712345678"
            }
            value={formData.phone}
            onChangeText={handlePhoneChange}
            keyboardType="phone-pad"
            placeholderTextColor="#999"
            maxLength={formData.countryCode === "+971" ? 11 : 11} // Including spaces
          />
        </View>
        {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}
        <Text style={styles.phoneHint}>
          {formData.countryCode === "+971"
            ? "Enter 9-digit UAE number starting with 5"
            : "Enter 9-digit Uganda number"}
        </Text>
      </>
    );
  };

  // Render Date of Birth Picker
  const renderDateOfBirth = () => (
    <>
      <Text style={styles.inputLabel}>Date of Birth</Text>
      <TouchableOpacity
        style={[
          styles.inputContainer,
          styles.selectInput,
          errors.dateOfBirth && styles.inputError,
        ]}
        onPress={showDatepicker}
      >
        <Ionicons
          name="calendar-outline"
          size={20}
          color={errors.dateOfBirth ? "#FF3B30" : "#666"}
          style={styles.inputIcon}
        />
        <Text
          style={[
            styles.input,
            !formData.dateOfBirth && styles.placeholderText,
          ]}
        >
          {formData.dateOfBirth
            ? formatDisplayDate(formData.dateOfBirth)
            : "Select your date of birth"}
        </Text>
        <Ionicons name="calendar" size={20} color="#666" />
      </TouchableOpacity>
      {errors.dateOfBirth && (
        <Text style={styles.errorText}>{errors.dateOfBirth}</Text>
      )}

      {showDatePicker && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={onDateChange}
          maximumDate={new Date()}
        />
      )}
    </>
  );

  // Render Opening Hours with Quick Options
  const renderOpeningHours = () => (
    <>
      <Text style={styles.inputLabel}>Opening Hours</Text>
      <TouchableOpacity
        style={[
          styles.inputContainer,
          styles.selectInput,
          errors.openingHours && styles.inputError,
        ]}
        onPress={() => openDropdown("openingHours", OPENING_HOURS_OPTIONS)}
      >
        <Ionicons
          name="time-outline"
          size={20}
          color={errors.openingHours ? "#FF3B30" : "#666"}
          style={styles.inputIcon}
        />
        <Text
          style={[
            styles.input,
            !formData.openingHours && styles.placeholderText,
          ]}
        >
          {formData.openingHours
            ? formatSelectedOptions(formData.openingHours)
            : "Select opening hours"}
        </Text>
        <Ionicons name="chevron-down-outline" size={20} color="#666" />
      </TouchableOpacity>
      {errors.openingHours && (
        <Text style={styles.errorText}>{errors.openingHours}</Text>
      )}

      {/* Quick Options */}
      <Text style={styles.quickOptionsLabel}>Popular Hours:</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.quickOptionsContainer}
      >
        {OPENING_HOURS_OPTIONS.slice(0, 6).map((hours, index) => {
          const isSelected = formData.openingHours === hours.value;
          return (
            <TouchableOpacity
              key={index}
              style={[
                styles.quickOption,
                isSelected && styles.quickOptionSelected,
              ]}
              onPress={() =>
                setFormData({ ...formData, openingHours: hours.value })
              }
            >
              <Text
                style={[
                  styles.quickOptionIcon,
                  isSelected && styles.quickOptionIconSelected,
                ]}
              >
                {hours.icon}
              </Text>
              <Text
                style={[
                  styles.quickOptionText,
                  isSelected && styles.quickOptionTextSelected,
                ]}
              >
                {hours.label.split(" - ")[0]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </>
  );

  const renderCustomerFields = () => (
    <>
      {renderDateOfBirth()}
      {renderSelectInput(
        "Gender",
        "gender",
        GENDER_OPTIONS,
        false,
        errors.gender,
      )}
    </>
  );

  const renderDriverFields = () => (
    <>
      {renderSelectInput(
        "Vehicle Type",
        "vehicleType",
        VEHICLE_OPTIONS,
        false,
        errors.vehicleType,
      )}

      <Text style={styles.inputLabel}>License Number</Text>
      <View
        style={[
          styles.inputContainer,
          errors.licenseNumber && styles.inputError,
        ]}
      >
        <MaterialCommunityIcons
          name="license"
          size={20}
          color={errors.licenseNumber ? "#FF3B30" : "#666"}
          style={styles.inputIcon}
        />
        <TextInput
          style={styles.input}
          placeholder="Your license number"
          value={formData.licenseNumber}
          onChangeText={(text) =>
            setFormData({ ...formData, licenseNumber: text })
          }
          placeholderTextColor="#999"
        />
      </View>
      {errors.licenseNumber && (
        <Text style={styles.errorText}>{errors.licenseNumber}</Text>
      )}

      {renderSelectInput(
        "Vehicle Plate",
        "vehiclePlate",
        [
          {
            value: "Dubai",
            label: "Dubai Plate",
            icon: "🚘",
            color: "#FF6B35",
          },
          {
            value: "Abu Dhabi",
            label: "Abu Dhabi Plate",
            icon: "🚙",
            color: "#2E86DE",
          },
          {
            value: "Sharjah",
            label: "Sharjah Plate",
            icon: "🚗",
            color: "#10AC84",
          },
          {
            value: "Other",
            label: "Other Emirates",
            icon: "🚕",
            color: "#FF9500",
          },
        ],
        false,
        errors.vehiclePlate,
      )}

      <Text style={styles.inputLabel}>Years of Experience</Text>
      <View style={[styles.inputContainer]}>
        <Ionicons
          name="time-outline"
          size={20}
          color="#666"
          style={styles.inputIcon}
        />
        <TextInput
          style={styles.input}
          placeholder="Number of years"
          value={formData.yearsOfExperience}
          onChangeText={(text) =>
            setFormData({ ...formData, yearsOfExperience: text })
          }
          placeholderTextColor="#999"
          keyboardType="numeric"
        />
      </View>

      {renderSelectInput("Availability", "availability", AVAILABILITY_OPTIONS)}

      <Text style={styles.inputLabel}>Insurance Number</Text>
      <View style={[styles.inputContainer]}>
        <MaterialIcons
          name="security"
          size={20}
          color="#666"
          style={styles.inputIcon}
        />
        <TextInput
          style={styles.input}
          placeholder="Insurance policy number"
          value={formData.insuranceNumber}
          onChangeText={(text) =>
            setFormData({ ...formData, insuranceNumber: text })
          }
          placeholderTextColor="#999"
        />
      </View>
    </>
  );

  const renderRestaurantFields = () => (
    <>
      <Text style={styles.inputLabel}>Restaurant Name</Text>
      <View
        style={[
          styles.inputContainer,
          errors.restaurantName && styles.inputError,
        ]}
      >
        <Ionicons
          name="restaurant-outline"
          size={20}
          color={errors.restaurantName ? "#FF3B30" : "#666"}
          style={styles.inputIcon}
        />
        <TextInput
          style={styles.input}
          placeholder="Your restaurant name"
          value={formData.restaurantName}
          onChangeText={(text) =>
            setFormData({ ...formData, restaurantName: text })
          }
          placeholderTextColor="#999"
        />
      </View>
      {errors.restaurantName && (
        <Text style={styles.errorText}>{errors.restaurantName}</Text>
      )}

      {renderSelectInput(
        "Cuisine Type",
        "cuisineType",
        CUISINE_OPTIONS,
        false,
        errors.cuisineType,
      )}

      <Text style={styles.inputLabel}>Business License Number</Text>
      <View
        style={[
          styles.inputContainer,
          errors.businessLicense && styles.inputError,
        ]}
      >
        <MaterialIcons
          name="business-center"
          size={20}
          color={errors.businessLicense ? "#FF3B30" : "#666"}
          style={styles.inputIcon}
        />
        <TextInput
          style={styles.input}
          placeholder="Business license number"
          value={formData.businessLicense}
          onChangeText={(text) =>
            setFormData({ ...formData, businessLicense: text })
          }
          placeholderTextColor="#999"
        />
      </View>
      {errors.businessLicense && (
        <Text style={styles.errorText}>{errors.businessLicense}</Text>
      )}

      {renderOpeningHours()}

      <Text style={styles.inputLabel}>Restaurant Capacity</Text>
      <View style={[styles.inputContainer]}>
        <Ionicons
          name="people-outline"
          size={20}
          color="#666"
          style={styles.inputIcon}
        />
        <TextInput
          style={styles.input}
          placeholder="Number of seats"
          value={formData.capacity}
          onChangeText={(text) => setFormData({ ...formData, capacity: text })}
          placeholderTextColor="#999"
          keyboardType="numeric"
        />
      </View>

      <Text style={styles.inputLabel}>Delivery Radius (km)</Text>
      <View style={[styles.inputContainer]}>
        <Ionicons
          name="navigate-outline"
          size={20}
          color="#666"
          style={styles.inputIcon}
        />
        <TextInput
          style={styles.input}
          placeholder="e.g., 5, 10, 15"
          value={formData.deliveryRadius}
          onChangeText={(text) =>
            setFormData({ ...formData, deliveryRadius: text })
          }
          placeholderTextColor="#999"
          keyboardType="numeric"
        />
      </View>

      {renderSelectInput(
        "Payment Methods",
        "paymentMethods",
        PAYMENT_OPTIONS,
        true,
      )}
    </>
  );

  const renderLocationField = () => (
    <>
      <Text style={styles.inputLabel}>Delivery Location</Text>
      <TouchableOpacity
        style={[
          styles.inputContainer,
          styles.locationInput,
          errors.address && styles.inputError,
        ]}
        onPress={() => setMapModalVisible(true)}
      >
        <Ionicons
          name="location-outline"
          size={20}
          color={errors.address ? "#FF3B30" : "#666"}
          style={styles.inputIcon}
        />
        <View style={styles.locationTextContainer}>
          <Text
            style={[styles.input, !formData.address && styles.placeholderText]}
          >
            {formData.address || "Tap to select location from map"}
          </Text>
          {formData.locationCode && (
            <Text style={styles.locationCode}>
              Code: {formData.locationCode}
            </Text>
          )}
        </View>
        <Ionicons name="map-outline" size={20} color="#666" />
      </TouchableOpacity>
      {errors.address && <Text style={styles.errorText}>{errors.address}</Text>}
      {locationAccuracy && (
        <Text style={styles.accuracyText}>
          Location accuracy: ±{locationAccuracy.toFixed(1)} meters
        </Text>
      )}
    </>
  );

  // Country Modal Component
  const CountryModal = () => (
    <Modal
      visible={countryModalVisible}
      animationType="slide"
      transparent={true}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.countryModalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Country</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setCountryModalVisible(false)}
            >
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.countryList}>
            {COUNTRY_CODES.map((country, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.countryItem,
                  formData.countryCode === country.code &&
                    styles.selectedCountryItem,
                ]}
                onPress={() => handleCountrySelect(country)}
              >
                <Text style={styles.countryFlag}>{country.flag}</Text>
                <View style={styles.countryInfo}>
                  <Text style={styles.countryName}>{country.name}</Text>
                  <Text style={styles.countryDetails}>
                    {country.code} • {country.currency}
                  </Text>
                </View>
                {formData.countryCode === country.code && (
                  <Ionicons name="checkmark" size={20} color="#FF6B35" />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  // Modern Map Modal Component
  const MapModal = () => (
    <Modal
      visible={mapModalVisible}
      animationType="slide"
      transparent={true}
      statusBarTranslucent={true}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Your Location</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setMapModalVisible(false)}
            >
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <View style={styles.mapContainer}>
            {currentLocation && (
              <MapView
                style={styles.map}
                provider={PROVIDER_GOOGLE}
                initialRegion={currentLocation}
                onPress={handleMapPress}
                showsUserLocation={true}
                showsMyLocationButton={true}
                showsCompass={true}
                showsScale={true}
                zoomEnabled={true}
                scrollEnabled={true}
              >
                {selectedLocation && (
                  <Marker
                    coordinate={selectedLocation}
                    title="Selected Location"
                    description={formData.address}
                    pinColor="#FF6B35"
                  >
                    <View style={styles.customMarker}>
                      <Ionicons name="location" size={24} color="#FF6B35" />
                    </View>
                  </Marker>
                )}
              </MapView>
            )}
          </View>

          <View style={styles.locationInfo}>
            <Text style={styles.locationAddress} numberOfLines={2}>
              {formData.address || "No location selected"}
            </Text>
            {formData.locationCode && (
              <Text style={styles.locationCodeText}>
                Location Code: {formData.locationCode}
              </Text>
            )}
            <Text style={styles.coordinatesText}>
              {selectedLocation
                ? `${selectedLocation.latitude.toFixed(
                    6,
                  )}, ${selectedLocation.longitude.toFixed(6)}`
                : "Tap on map to select location"}
            </Text>
          </View>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={styles.myLocationButton}
              onPress={getCurrentLocation}
            >
              <Ionicons name="navigate" size={20} color="#FF6B35" />
              <Text style={styles.myLocationText}>My Location</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.confirmButton,
                !selectedLocation && styles.disabledButton,
              ]}
              onPress={confirmLocation}
              disabled={!selectedLocation}
            >
              <Text style={styles.confirmButtonText}>Confirm Location</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  // Dropdown Modal Component
  const DropdownModal = () => (
    <Modal
      visible={dropdownModal.visible}
      animationType="slide"
      transparent={true}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.dropdownModalContainer}>
          <View style={styles.dropdownHeader}>
            <Text style={styles.dropdownTitle}>
              Select {dropdownModal.type}
              {dropdownModal.multiSelect && " (Multiple)"}
            </Text>
            <TouchableOpacity onPress={closeDropdown}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.dropdownList}>
            {dropdownModal.options.map((option, index) => {
              const optionValue = option.value || option;
              const optionLabel = option.label || option;
              const optionIcon = option.icon || "";
              const optionColor = option.color || "#666";

              const isSelected = dropdownModal.multiSelect
                ? formData[dropdownModal.type]?.includes(optionValue)
                : formData[dropdownModal.type] === optionValue;

              return (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.dropdownItem,
                    isSelected && styles.selectedItem,
                  ]}
                  onPress={() => handleSelectOption(option)}
                >
                  <View style={styles.optionContent}>
                    <Text style={[styles.optionIcon, { color: optionColor }]}>
                      {optionIcon}
                    </Text>
                    <Text
                      style={[
                        styles.dropdownItemText,
                        isSelected && styles.selectedItemText,
                      ]}
                    >
                      {optionLabel}
                    </Text>
                  </View>
                  {isSelected && (
                    <Ionicons
                      name="checkmark-circle"
                      size={22}
                      color="#FF6B35"
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {dropdownModal.multiSelect && (
            <View style={styles.dropdownFooter}>
              <TouchableOpacity
                style={styles.doneButton}
                onPress={closeDropdown}
              >
                <Text style={styles.doneButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );

  // Wait for fonts to load before rendering
  if (!fontsLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Animation */}
        <View style={styles.animationContainer}>
          <LottieView
            source={getAnimationSource()}
            autoPlay
            loop
            style={styles.animation}
          />
        </View>
        {/* <TouchableOpacity
          style={styles.adminButton}
          onPress={() => router.push("/admin/bulk-create-restaurants")}
        >
          <Text style={styles.adminButtonText}>
            Bulk Create Restaurants (Admin)
          </Text>
        </TouchableOpacity>
*/}
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{getTitle()}</Text>
          <Text style={styles.subtitle}>
            Create your {userType} account to get started
          </Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {/* Basic Information */}
          <Text style={styles.sectionTitle}>Basic Information</Text>

          <Text style={styles.inputLabel}>Full Name</Text>
          <View
            style={[
              styles.inputContainer,
              errors.fullName && styles.inputError,
            ]}
          >
            <Ionicons
              name="person-outline"
              size={20}
              color={errors.fullName ? "#FF3B30" : "#666"}
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="Your full name"
              value={formData.fullName}
              onChangeText={(text) =>
                setFormData({ ...formData, fullName: text })
              }
              placeholderTextColor="#999"
              autoCapitalize="words"
            />
          </View>
          {errors.fullName && (
            <Text style={styles.errorText}>{errors.fullName}</Text>
          )}

          <Text style={styles.inputLabel}>Email</Text>
          <View
            style={[styles.inputContainer, errors.email && styles.inputError]}
          >
            <Ionicons
              name="mail-outline"
              size={20}
              color={errors.email ? "#FF3B30" : "#666"}
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="Your email address"
              value={formData.email}
              onChangeText={(text) => setFormData({ ...formData, email: text })}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholderTextColor="#999"
            />
          </View>
          {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}

          {/* Phone Input with Country Code */}
          {renderPhoneInput()}

          <Text style={styles.inputLabel}>Password</Text>
          <View
            style={[
              styles.inputContainer,
              errors.password && styles.inputError,
            ]}
          >
            <Ionicons
              name="lock-closed-outline"
              size={20}
              color={errors.password ? "#FF3B30" : "#666"}
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="Minimum 8 characters with uppercase, lowercase and numbers"
              value={formData.password}
              onChangeText={(text) =>
                setFormData({ ...formData, password: text })
              }
              secureTextEntry={!showPassword}
              placeholderTextColor="#999"
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              style={styles.passwordToggle}
            >
              <Ionicons
                name={showPassword ? "eye-off-outline" : "eye-outline"}
                size={20}
                color={errors.password ? "#FF3B30" : "#666"}
              />
            </TouchableOpacity>
          </View>
          {errors.password && (
            <Text style={styles.errorText}>{errors.password}</Text>
          )}

          <Text style={styles.inputLabel}>Confirm Password</Text>
          <View
            style={[
              styles.inputContainer,
              errors.confirmPassword && styles.inputError,
            ]}
          >
            <Ionicons
              name="lock-closed-outline"
              size={20}
              color={errors.confirmPassword ? "#FF3B30" : "#666"}
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="Confirm your password"
              value={formData.confirmPassword}
              onChangeText={(text) =>
                setFormData({ ...formData, confirmPassword: text })
              }
              secureTextEntry={!showConfirmPassword}
              placeholderTextColor="#999"
            />
            <TouchableOpacity
              onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              style={styles.passwordToggle}
            >
              <Ionicons
                name={showConfirmPassword ? "eye-off-outline" : "eye-outline"}
                size={20}
                color={errors.confirmPassword ? "#FF3B30" : "#666"}
              />
            </TouchableOpacity>
          </View>
          {errors.confirmPassword && (
            <Text style={styles.errorText}>{errors.confirmPassword}</Text>
          )}

          {/* Location Field */}
          {renderLocationField()}

          {/* Type-specific Fields */}
          <Text style={styles.sectionTitle}>
            {userType === "customer"
              ? "Customer Details"
              : userType === "driver"
                ? "Driver Information"
                : "Restaurant Details"}
          </Text>

          {userType === "customer" && renderCustomerFields()}
          {userType === "driver" && renderDriverFields()}
          {userType === "restaurant" && renderRestaurantFields()}

          {/* Sign Up Button */}
          <TouchableOpacity
            style={[styles.signUpButton, isLoading && styles.disabledButton]}
            onPress={handleSignUp}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="person-add-outline" size={20} color="#fff" />
                <Text style={styles.signUpButtonText}>
                  {isLoading
                    ? "Creating Account..."
                    : `Create ${userType} Account`}
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Sign In Link */}
          <View style={styles.signInContainer}>
            <Text style={styles.signInText}>Already have an account? </Text>
            <TouchableOpacity
              onPress={() => router.push("/(auth)/signin")}
              disabled={isLoading}
            >
              <Text style={styles.signInLink}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Modals */}
      <MapModal />
      <DropdownModal />
      <CountryModal />
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
    fontSize: 16,
    color: "#666",
    fontFamily: "System",
  },
  scrollContainer: {
    paddingVertical: 20,
    paddingBottom: 40,
    paddingHorizontal: 0,
  },
  animationContainer: {
    width: "100%",
    height: 180,
    marginBottom: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  animation: {
    width: 150,
    height: 150,
  },
  header: {
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontFamily: "Caprasimo-Bold",
    color: "#333",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
    fontFamily: "Poppins-SemiBold",
  },
  form: {
    paddingHorizontal: 16,
  },
  sectionTitle: {
    color: "#333",
    fontSize: 18,
    fontFamily: "Caprasimo-Bold",
    marginBottom: 16,
    marginTop: 20,
    borderBottomWidth: 2,
    borderBottomColor: "#FF6B35",
    paddingBottom: 8,
  },
  inputLabel: {
    fontSize: 14,
    color: "#333",
    fontFamily: "Poppins-SemiBold",
    marginBottom: 6,
    marginLeft: 4,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8f8f8",
    borderWidth: 1,
    borderColor: "#e1e1e1",
    borderRadius: 8,
    marginBottom: 4,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  selectInput: {
    paddingVertical: 12,
  },
  locationInput: {
    paddingVertical: 14,
  },
  locationTextContainer: {
    flex: 1,
    flexDirection: "column",
  },
  locationCode: {
    fontSize: 12,
    color: "#666",
    fontFamily: "Poppins-SemiBold",
    marginTop: 2,
  },
  inputError: {
    borderColor: "#FF3B30",
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: "#333",
    fontFamily: "Poppins-SemiBold",
  },
  phoneInput: {
    flex: 1,
    fontSize: 16,
    color: "#333",
    fontFamily: "Poppins-SemiBold",
    letterSpacing: 1,
  },
  placeholderText: {
    color: "#999",
  },
  passwordToggle: {
    padding: 4,
  },
  errorText: {
    color: "#FF3B30",
    fontSize: 12,
    fontFamily: "Poppins-SemiBold",
    marginBottom: 12,
    marginLeft: 4,
  },
  accuracyText: {
    fontSize: 12,
    color: "#666",
    fontFamily: "Poppins-SemiBold",
    marginTop: 4,
    marginLeft: 4,
  },
  phoneHint: {
    fontSize: 12,
    color: "#666",
    fontFamily: "Poppins-SemiBold",
    marginBottom: 12,
    marginLeft: 4,
  },
  // Country Selector Styles
  countrySelector: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 8,
  },
  flagText: {
    fontSize: 20,
    marginRight: 4,
  },
  countryCodeText: {
    fontSize: 16,
    color: "#333",
    fontFamily: "Poppins-SemiBold",
    marginRight: 8,
  },
  // Country Modal Styles
  countryModalContainer: {
    backgroundColor: "#fff",
    overflow: "hidden",
    maxHeight: "30%",
    width: "100%",
    borderTopRightRadius: 16,
    borderTopLeftRadius: 16,
    justifyContent: "flex-end",
  },
  countryList: {
    maxHeight: 400,
  },
  countryItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e1e1e1",
  },
  selectedCountryItem: {
    backgroundColor: "#FFF0E6",
  },
  countryFlag: {
    fontSize: 24,
    marginRight: 12,
  },
  countryInfo: {
    flex: 1,
  },
  countryName: {
    fontSize: 16,
    color: "#333",
    fontFamily: "Poppins-SemiBold",
    marginBottom: 4,
  },
  countryDetails: {
    fontSize: 12,
    color: "#666",
    fontFamily: "Poppins-SemiBold",
  },
  // Quick Options Styles
  quickOptionsLabel: {
    fontSize: 14,
    color: "#333",
    fontFamily: "Poppins-SemiBold",
    marginBottom: 8,
    marginLeft: 4,
  },
  quickOptionsContainer: {
    marginBottom: 12,
    marginLeft: 4,
    marginTop: 4,
    maxHeight: 40,
  },
  quickOption: {
    flexDirection: "column",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#e1e1e1",
    borderRadius: 12,
    marginRight: 8,
    minWidth: 70,
  },
  quickOptionSelected: {
    backgroundColor: "#FF6B35",
    borderColor: "#FF6B35",
  },
  quickOptionIcon: {
    fontSize: 16,
    marginTop: -7,
  },
  quickOptionIconSelected: {
    color: "#fff",
  },
  quickOptionText: {
    fontSize: 11,
    color: "#333",
    fontFamily: "Poppins-SemiBold",
    textAlign: "center",
  },
  quickOptionTextSelected: {
    color: "#fff",
  },
  signUpButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FF6B35",
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
    marginTop: 20,
    marginBottom: 14,
  },
  disabledButton: {
    backgroundColor: "#FFA88A",
  },
  signUpButtonText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Poppins-SemiBold",
  },
  signInContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
  },
  signInText: {
    fontSize: 14,
    color: "#333",
    fontFamily: "Poppins-SemiBold",
  },
  signInLink: {
    fontSize: 14,
    color: "#FF6B35",
    fontFamily: "Poppins-SemiBold",
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
    maxHeight: "auto",
    width: "100%",
  },
  modalContainer: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    width: "100%",
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e1e1e1",
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: "Poppins-SemiBold",
    color: "#333",
  },
  closeButton: {
    padding: 4,
  },
  mapContainer: {
    height: 300,
    width: "100%",
    backgroundColor: "#e1e1e1",
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  customMarker: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    padding: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#FF6B35",
  },
  locationInfo: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e1e1e1",
  },
  locationAddress: {
    fontSize: 16,
    color: "#333",
    fontFamily: "Poppins-SemiBold",
    marginBottom: 8,
  },
  locationCodeText: {
    fontSize: 14,
    color: "#666",
    fontFamily: "Poppins-SemiBold",
    marginBottom: 4,
  },
  coordinatesText: {
    fontSize: 12,
    color: "#999",
    fontFamily: "Poppins-SemiBold",
  },
  modalFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
  },
  myLocationButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  myLocationText: {
    fontSize: 14,
    color: "#FF6B35",
    fontFamily: "Poppins-SemiBold",
  },
  confirmButton: {
    backgroundColor: "#FF6B35",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  confirmButtonText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Poppins-SemiBold",
  },
  // Dropdown Modal Styles
  dropdownModalContainer: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "50%",
  },
  dropdownHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e1e1e1",
  },
  dropdownTitle: {
    fontSize: 18,
    fontFamily: "Poppins-SemiBold",
    color: "#333",
  },
  dropdownList: {
    maxHeight: "70%",
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e1e1e1",
  },
  optionContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  optionIcon: {
    fontSize: 20,
    marginRight: 12,
    width: 30,
    textAlign: "center",
  },
  dropdownItemText: {
    fontSize: 16,
    color: "#333",
    fontFamily: "Poppins-SemiBold",
    flex: 1,
  },
  selectedItem: {
    backgroundColor: "#FFF0E6",
  },
  selectedItemText: {
    color: "#FF6B35",
  },
  dropdownFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#e1e1e1",
  },
  doneButton: {
    backgroundColor: "#FF6B35",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  doneButtonText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Poppins-SemiBold",
  },
});
