import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import AppNavigator from './navigation/AppNavigator';
import { UserProvider } from './context/UserContext'; // Import UserProvider

export default function App() {
  return (
      <NavigationContainer>
        <AppNavigator />
      </NavigationContainer>
  );
}
