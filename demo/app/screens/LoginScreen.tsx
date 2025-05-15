import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function LoginScreen({ navigation }) {
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!mobile || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    
    try {
      const response = await fetch('http://192.168.1.5:5000/auth/login', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ mobile, password }),
      });

      const data = await response.json();
      console.log('Login response:', data); // Debugging: Log the response

      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }

      if (!data.user || !data.user.id) {
        throw new Error('User ID is missing in the response');
      }

      // Save the token and userId in AsyncStorage
      await AsyncStorage.setItem('authToken', data.token);
      await AsyncStorage.setItem('userId', data.user.id); // Correctly extract userId

      Alert.alert('Success', 'Login successful!');
      
      navigation.replace('Home');
      
    } catch (error) {
      console.error('Login error:', error);
      Alert.alert('Error', error.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Login</Text>
      
      <TextInput
        style={styles.input}
        placeholder="Mobile Number"
        value={mobile}
        onChangeText={setMobile}
        keyboardType="phone-pad"
        autoCapitalize="none"
      />
      
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      
      {loading ? (
        <ActivityIndicator size="large" color="#0000ff" />
      ) : (
        <Button title="Login" onPress={handleLogin} />
      )}
      
      <View style={styles.registerLink}>
        <Text>Don't have an account? </Text>
        <Button 
          title="Register" 
          onPress={() => navigation.navigate('Register')} 
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    marginBottom: 20,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 15,
    marginBottom: 15,
    borderRadius: 5,
    fontSize: 16,
  },
  registerLink: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    justifyContent: 'center',
  },
});