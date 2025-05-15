import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Button, Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage"; // For token storage
import { createDrawerNavigator } from "@react-navigation/drawer";
import CategoriesSection from "../components/CategoriesSection";
import ProductSection from "../components/ProductSection";
import InvoiceSection from "../components/InvoiceSection";
import VendorSection from "../components/VendorSection";
import ReportSection from "../components/ReportSection";

function HomeContent() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome Home!</Text>
    </View>
  );
}

function VendorScreen() {
  return <VendorSection />;
}

function CategoriesScreen({ userId }) {
  return <CategoriesSection userId={userId} />;
}

function ProductsScreen({ userId }) {
  return <ProductSection userId={userId} />;
}

function InvoiceScreen({ userId }) {
  return <InvoiceSection userId={userId} />;
}

function ReportScreen({ userId }) {
  return <Text>Report Section for User ID: {userId}</Text>;
}

const Drawer = createDrawerNavigator();

export default function HomeScreen({ navigation }) {
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    const fetchUserId = async () => {
      try {
        // Retrieve the logged-in user's ID from AsyncStorage
        const storedUserId = await AsyncStorage.getItem("userId");
        if (storedUserId) {
          setUserId(storedUserId);
        } else {
          // If no user ID is found, show an alert and navigate to the login screen
          Alert.alert("Session Expired", "Please log in again.");
          navigation.replace("Login");
        }
      } catch (error) {
        console.error("Error fetching user ID:", error);
        Alert.alert(
          "Error",
          "Failed to retrieve user information. Please log in again."
        );
        navigation.replace("Login");
      }
    };

    fetchUserId();
  }, [navigation]);

  const handleLogout = async () => {
    try {
      // Clear the token and user ID from AsyncStorage
      await AsyncStorage.multiRemove(["authToken", "userId"]);
      Alert.alert("Success", "You have been logged out.");
      navigation.replace("Login"); // Navigate to the login screen
    } catch (error) {
      console.error("Logout error:", error);
      Alert.alert("Error", "Failed to log out. Please try again.");
    }
  };

  if (!userId) {
    return null; // Render nothing until the user ID is fetched
  }

  return (
    <Drawer.Navigator
      initialRouteName="HomeMain"
      screenOptions={{
        headerRight: () => <Button title="Logout" onPress={handleLogout} />,
      }}
    >
      <Drawer.Screen
        name="HomeMain"
        component={HomeContent}
        options={{ title: "Home" }}
      />
      <Drawer.Screen
        name="Categories"
        children={() => <CategoriesScreen userId={userId} />}
      />
      <Drawer.Screen
        name="Products"
        children={() => <ProductsScreen userId={userId} />}
      />
      <Drawer.Screen
        name="Invoice"
        children={() => <InvoiceScreen userId={userId} />}
      />
      <Drawer.Screen
        name="Report"
        children={() => <ReportSection userId={userId} />}
      />
      <Drawer.Screen name="Profile" component={VendorScreen} />
    </Drawer.Navigator>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 20,
    padding: 20,
  },
  title: {
    fontSize: 30,
    fontWeight: "bold",
    color: "#2c3e50",
    textAlign: "center",
    textShadowColor: "#dcdde1",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 5,
  },
});
