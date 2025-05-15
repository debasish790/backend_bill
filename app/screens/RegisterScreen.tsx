import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, ActivityIndicator, ScrollView, Modal, TouchableOpacity, Image } from 'react-native';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';

export default function RegisterScreen({ navigation }) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [contact, setContact] = useState('');
  const [gstin, setGstin] = useState('');
  const [desc, setDesc] = useState('');
  const [location, setLocation] = useState('');
  const [prefix, setPrefix] = useState('');
  const [otp, setOtp] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPrefixInfo, setShowPrefixInfo] = useState(false);
  const [logo, setLogo] = useState(null);

  // Fetch location automatically on mount
  useEffect(() => {
    const fetchLocation = async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLocation('');
          return;
        }
        let loc = await Location.getCurrentPositionAsync({});
        setLocation(`${loc.coords.latitude},${loc.coords.longitude}`);
      } catch (error) {
        setLocation('');
      }
    };
    fetchLocation();
  }, []);

  // Add logo picker handler
  const pickLogo = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    if (!result.canceled) {
      setLogo(result.assets[0].uri);
    }
  };

  const handleRegister = async () => {
    // Basic validation
    if (!name || !address || !contact || !gstin || !prefix || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    if (prefix.length > 4) {
      Alert.alert('Error', 'Prefix must be at most 4 characters');
      return;
    }

    setLoading(true);

    try {
      let body;
      let headers;
      if (logo) {
        // Use FormData if logo is present
        body = new FormData();
        body.append('store_name', name);
        body.append('store_address', address);
        body.append('contact', contact);
        body.append('gstin', gstin);
        body.append('desc', desc);
        body.append('location', location);
        body.append('prefix', prefix);
        body.append('otp', otp);
        if (email) body.append('email', email); // Only append if provided
        body.append('password', password);
        body.append('logo', {
          uri: logo,
          name: 'logo.jpg',
          type: 'image/jpeg'
        });
        headers = {
          'Content-Type': 'multipart/form-data',
          'Accept': 'application/json'
        };
      } else {
        // Use JSON if no logo
        const userData: any = { 
          store_name: name, 
          store_address: address, 
          contact, 
          gstin, 
          desc, 
          location, 
          prefix, 
          otp, 
          password 
        };
        if (email) userData.email = email; // Only include if provided
        body = JSON.stringify(userData);
        headers = {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        };
      }

      const response = await fetch('http://192.168.1.5:5000/auth/register', {
        method: 'POST',
        headers,
        body,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Registration failed');
      }

      Alert.alert('Success', 'Registration successful!');
      navigation.navigate('Login');

    } catch (error) {
      console.error('Registration error:', error);
      Alert.alert('Error', error.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
      <View style={styles.container}>
        <Text style={styles.title}>Register</Text>
        <Text style={{ color: 'red', marginBottom: 10 }}>* Required fields are marked as important</Text>
        <TextInput style={styles.input} placeholder="Shop Name *" value={name} onChangeText={setName} />
        <TextInput style={styles.input} placeholder="Shop Address *" value={address} onChangeText={setAddress} />
        <TextInput style={styles.input} placeholder="Tagline (DESC)" value={desc} onChangeText={setDesc} />
        <TextInput style={styles.input} placeholder="Contact *" value={contact} onChangeText={setContact} keyboardType="phone-pad" />
        <TextInput style={styles.input} placeholder="GSTIN *" value={gstin} onChangeText={setGstin} />
        {/* <TextInput
          style={styles.input}
          placeholder="Location (auto)"
          value={location}
          editable={false}
        /> */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15 }}>
          <TextInput
            style={[styles.input, { flex: 1, marginBottom: 0 }]}
            placeholder="Prefix (max 4 chars)"
            value={prefix}
            onChangeText={text => setPrefix(text.slice(0, 4))}
            maxLength={4}
          />
          <TouchableOpacity onPress={() => setShowPrefixInfo(true)} style={styles.prefixInfoBtn}>
            <Text style={styles.prefixInfoText}>?</Text>
          </TouchableOpacity>
        </View>
        <Modal
          visible={showPrefixInfo}
          transparent
          animationType="fade"
          onRequestClose={() => setShowPrefixInfo(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>What is Prefix?</Text>
              <Text style={styles.modalDesc}>
                The prefix is used in the Invoice Number on the invoice page. For example, if your prefix is "SHOP", your invoice number will look like "SHOP/2024-2025/001".
              </Text>
              <Button title="Close" onPress={() => setShowPrefixInfo(false)} />
            </View>
          </View>
        </Modal>
        <TextInput style={styles.input} placeholder="OTP" value={otp} onChangeText={setOtp} keyboardType="numeric" />
        <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
        <TextInput style={styles.input} placeholder="Password (min 6 characters) *" secureTextEntry value={password} onChangeText={setPassword} />
        <TextInput style={styles.input} placeholder="Confirm Password *" secureTextEntry value={confirmPassword} onChangeText={setConfirmPassword} />
        {/* Logo Picker */}
        <View style={{ alignItems: 'center', marginBottom: 16 }}>
          <TouchableOpacity onPress={pickLogo} style={{
            width: 100, height: 100, borderRadius: 50, backgroundColor: '#f1f1f1',
            justifyContent: 'center', alignItems: 'center', overflow: 'hidden'
          }}>
            {logo ? (
              <Image source={{ uri: logo }} style={{ width: 100, height: 100, borderRadius: 50 }} />
            ) : (
              <Text style={{ color: '#888' }}>+ Logo (optional)</Text>
            )}
          </TouchableOpacity>
          {logo && (
            <TouchableOpacity onPress={() => setLogo(null)} style={{ marginTop: 6 }}>
              <Text style={{ color: '#e74c3c', fontSize: 13 }}>Remove Logo</Text>
            </TouchableOpacity>
          )}
        </View>
        {loading ? (
          <ActivityIndicator size="large" color="#0000ff" />
        ) : (
          <Button title="Register" onPress={handleRegister} />
        )}
        <View style={styles.loginLink}>
          <Text>Already have an account? </Text>
          <Button title="Login" onPress={() => navigation.navigate('Login')} />
        </View>
      </View>
    </ScrollView>
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
  loginLink: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    justifyContent: 'center',
  },
  prefixInfoBtn: {
    marginLeft: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prefixInfoText: {
    fontWeight: 'bold',
    fontSize: 16,
    color: '#555',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 12,
    width: '80%',
    alignItems: 'center',
    elevation: 6,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#2c3e50',
  },
  modalDesc: {
    fontSize: 16,
    color: '#444',
    marginBottom: 20,
    textAlign: 'center',
  },
});