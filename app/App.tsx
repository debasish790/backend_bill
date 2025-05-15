import React from 'react';
import ProductSection from './components/ProductSection';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function App() {
  const [userId, setUserId] = React.useState(null);

  React.useEffect(() => {
    const fetchUserId = async () => {
      const token = await AsyncStorage.getItem('token'); // Retrieve token from storage
      if (token) {
        const decoded = JSON.parse(atob(token.split('.')[1])); // Decode JWT payload
        setUserId(decoded.id); // Extract userId from token
      }
    };
    fetchUserId();
  }, []);

  if (!userId) {
    return <Text>Loading...</Text>; // Show a loading state until userId is available
  }

  return <ProductSection userId={userId} />; // Pass userId as a prop
}
