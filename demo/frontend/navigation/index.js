import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import LoginForm from '../components/LoginForm';
import RegisterForm from '../components/RegisterForm';

const Stack = createStackNavigator();

export default function AppNavigator() {
  return (
    <Stack.Navigator initialRouteName="Login">
      <Stack.Screen name="Login" component={LoginForm} />
      <Stack.Screen name="Register" component={RegisterForm} />
    </Stack.Navigator>
  );
}
