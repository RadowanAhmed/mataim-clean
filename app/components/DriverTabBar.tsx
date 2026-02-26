// app/components/DriverTabBar.tsx
import {
  Ionicons,
  MaterialCommunityIcons,
  MaterialIcons,
} from "@expo/vector-icons";
import React, { memo, useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, View } from "react-native";
import { useAuth } from "../../backend/AuthContext";

const AnimatedTabButton = memo(
  ({ onPress, isFocused, label, iconName, colors }: any) => {
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const opacityAnim = useRef(new Animated.Value(isFocused ? 1 : 0.7)).current;

    useEffect(() => {
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: isFocused ? 1.15 : 1,
          duration: 120,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: isFocused ? 1 : 0.7,
          duration: 120,
          useNativeDriver: true,
        }),
      ]).start();
    }, [isFocused]);

    const handlePress = () => {
      onPress();
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 0.92,
          duration: 60,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: isFocused ? 1.15 : 1,
          duration: 120,
          useNativeDriver: true,
        }),
      ]).start();
    };

    const iconColor = isFocused ? colors.primary : colors.inactive;
    const iconSize = 22;

    const renderIcon = () => {
      switch (iconName) {
        case "dashboard":
          return (
            <MaterialCommunityIcons
              name={isFocused ? "view-dashboard" : "view-dashboard-outline"}
              size={iconSize}
              color={iconColor}
            />
          );
        case "orders":
          return (
            <MaterialIcons
              name={isFocused ? "receipt" : "receipt-long"}
              size={iconSize}
              color={iconColor}
            />
          );
        case "earnings":
          return (
            <Ionicons
              name={isFocused ? "cash" : "cash-outline"}
              size={iconSize}
              color={iconColor}
            />
          );
        case "history":
          return (
            <MaterialCommunityIcons
              name={isFocused ? "history" : "history"}
              size={iconSize}
              color={iconColor}
            />
          );
        case "person":
          return (
            <Ionicons
              name={isFocused ? "person" : "person-outline"}
              size={iconSize}
              color={iconColor}
            />
          );
        default:
          return null;
      }
    };

    return (
      <Pressable onPress={handlePress} style={styles.tabItem}>
        <Animated.View
          style={{
            alignItems: "center",
            transform: [{ scale: scaleAnim }],
            opacity: opacityAnim,
          }}
        >
          {renderIcon()}
          <Animated.Text
            style={[
              styles.label,
              {
                color: iconColor,
                opacity: opacityAnim,
              },
              isFocused && styles.labelActive,
            ]}
          >
            {label}
          </Animated.Text>
        </Animated.View>
      </Pressable>
    );
  },
);

export const DriverTabBar = ({ state, descriptors, navigation }: any) => {
  const { user } = useAuth();
  const [layouts, setLayouts] = useState<any>({});
  const sliderAnim = useRef(new Animated.Value(0)).current;
  const sliderWidth = 44;

  const tabs = [
    { name: "dashboard", label: "Dashboard", icon: "dashboard" },
    { name: "orders", label: "Orders", icon: "orders" },
    { name: "earnings", label: "Earnings", icon: "earnings" },
    { name: "history", label: "History", icon: "history" },
    { name: "profile", label: "Profile", icon: "person" },
  ];

  const handleLayout = (e: any, name: string) => {
    const { x, width } = e.nativeEvent.layout;
    setLayouts((prev: any) => ({ ...prev, [name]: { x, width } }));
  };

  useEffect(() => {
    const route = state.routes[state.index];
    const layout = layouts[route.name];

    if (layout) {
      const centerX = layout.x + layout.width / 2 - sliderWidth / 2;

      Animated.timing(sliderAnim, {
        toValue: centerX,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    }
  }, [state.index, layouts]);

  return (
    <View style={styles.tabBar}>
      {/* Slider */}
      <Animated.View
        style={[
          styles.slider,
          {
            width: sliderWidth,
            transform: [{ translateX: sliderAnim }],
          },
        ]}
      />

      {tabs.map((tab, index) => {
        const route = state.routes.find((r: any) => r.name === tab.name);
        if (!route) return null;

        const isFocused = state.index === index;

        const onPress = () => {
          if (!isFocused) {
            navigation.navigate(tab.name);
          }
        };

        return (
          <View
            key={tab.name}
            style={styles.tabWrapper}
            onLayout={(e) => handleLayout(e, tab.name)}
          >
            <AnimatedTabButton
              onPress={onPress}
              isFocused={isFocused}
              label={tab.label}
              iconName={tab.icon}
              colors={{
                primary: "#FF6B35",
                inactive: "#041533",
              }}
            />

            {tab.name === "orders" && user?.hasNewOrders && (
              <View style={styles.notification}>
                <View style={styles.dot} />
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
};

export default DriverTabBar; // Add this line

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: "row",
    height: 72,
    paddingTop: 2,
    paddingBottom: 12,
    backgroundColor: "#fff",
    elevation: 12,
  },
  slider: {
    position: "absolute",
    top: 0,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#FF6B35",
  },
  tabWrapper: {
    flex: 1,
  },
  tabItem: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  label: {
    fontSize: 10,
    marginTop: 4,
    fontWeight: "600",
    lineHeight: 12,
    letterSpacing: -0.2,
  },
  labelActive: {
    fontWeight: "700",
    fontSize: 9,
  },
  notification: {
    position: "absolute",
    top: 8,
    right: "35%",
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#FF6B35",
  },
});
