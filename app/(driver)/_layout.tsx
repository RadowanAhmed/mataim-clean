// app/(driver)/_layout.tsx
import { DriverTabBar } from "@/app/components/DriverTabBar";
import { Tabs } from "expo-router";
import { useWindowDimensions } from "react-native";

export default function DriverLayout() {
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
      tabBar={(props) => <DriverTabBar {...props} />}
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
        name="earnings"
        options={{
          title: "Earnings",
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "History",
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
        }}
      />

      {/* Add nested screens that shouldn't show in tab bar */}
      <Tabs.Screen
        name="order-details/[orderId]"
        options={{
          href: null, // This hides it from the tab bar
        }}
      />

      <Tabs.Screen
        name="messages/[id]"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
