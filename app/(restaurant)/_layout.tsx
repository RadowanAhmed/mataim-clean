// app/(restaurant)/_layout.tsx
import { RestaurantTabBar } from "@/app/components/RestaurantTabBar";
import { Tabs } from "expo-router";
import { useWindowDimensions } from "react-native";

export default function RestaurantLayout() {
  const { width } = useWindowDimensions();

  const getResponsiveSizes = () => {
    if (width < 375) {
      return {
        tabBarHeight: 62,
        borderRadius: 16,
      };
    } else if (width > 414) {
      return {
        tabBarHeight: 76,
        borderRadius: 24,
      };
    } else {
      return {
        tabBarHeight: 70,
        borderRadius: 20,
      };
    }
  };

  const responsiveSizes = getResponsiveSizes();

  return (
    <Tabs
      tabBar={(props) => <RestaurantTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#fff",
          height: responsiveSizes.tabBarHeight,
          borderTopWidth: 0,
          borderTopLeftRadius: responsiveSizes.borderRadius,
          borderTopRightRadius: responsiveSizes.borderRadius,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.1,
          shadowRadius: 6,
          elevation: 10,
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Dashboard",
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: "Orders",
        }}
      />
      <Tabs.Screen
        name="menu"
        options={{
          title: "Menu",
        }}
      />
      <Tabs.Screen
        name="posts"
        options={{
          title: "Posts",
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
        }}
      />
      <Tabs.Screen name="setup" />
    </Tabs>
  );
}
