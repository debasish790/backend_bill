import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, ScrollView, TouchableOpacity, Image, TextInput } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';

const API_BASE_URL = 'http://192.168.1.5:5000';

export default function VendorSection() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [logo, setLogo] = useState(null);
  const [editField, setEditField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchUserDetails();
  }, []);

  const fetchUserDetails = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const userId = await AsyncStorage.getItem('userId');
      if (!token || !userId) throw new Error('Authentication required');

      const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error fetching user details (raw):', errorText);
        throw new Error(errorText || 'Failed to fetch user details');
      }

      const data = await response.json();
      setUser(data);
      if (data.logo) setLogo(`${API_BASE_URL}/${data.logo}`);
    } catch (error: any) {
      console.error('Error fetching user details:', error);
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const pickLogo = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    if (!result.canceled) {
      setLogo(result.assets[0].uri);
      await handleUpdateLogo(result.assets[0].uri);
    }
  };

  const handleUpdateLogo = async (logoUri: string) => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const userId = await AsyncStorage.getItem('userId');
      if (!token || !userId) throw new Error('Authentication required');
      const formData = new FormData();
      formData.append('logo', {
        uri: logoUri,
        name: 'logo.jpg',
        type: 'image/jpeg',
      });
      const res = await fetch(`${API_BASE_URL}/users/${userId}/logo`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to update logo');
      }
      Alert.alert('Success', 'Logo updated!');
      fetchUserDetails();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const handleSaveField = async (key: string) => {
    if (!user) return;
    setSaving(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      const userId = await AsyncStorage.getItem('userId');
      if (!token || !userId) throw new Error('Authentication required');
      const res = await fetch(`${API_BASE_URL}/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ [key]: editValue }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to update profile');
      }
      setEditField(null);
      setEditValue('');
      await fetchUserDetails();
      Alert.alert('Success', 'Profile updated!');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSaving(false);
    }
  };

  // Helper: check if location is coordinates or name
  const parseLocation = (loc: any) => {
    if (!loc) return { type: 'none', value: '' };
    if (typeof loc === 'string') {
      // Try to parse as JSON (for {"lat":..., "lng":...})
      try {
        const parsed = JSON.parse(loc);
        if (parsed && typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
          return { type: 'coords', value: parsed };
        }
      } catch {}
      // Otherwise, treat as name
      return { type: 'name', value: loc };
    }
    if (typeof loc === 'object' && loc.lat && loc.lng) {
      return { type: 'coords', value: loc };
    }
    return { type: 'name', value: String(loc) };
  };

  // Reverse geocode coordinates to address string
  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
        { headers: { 'User-Agent': 'expo-app' } }
      );
      const data = await response.json();
      return data.display_name || `${lat},${lng}`;
    } catch {
      return `${lat},${lng}`;
    }
  };

  // Handle change address
  const handleChangeAddress = async () => {
    Alert.alert(
      'Change Address',
      'Do you really want to change the location?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes',
          style: 'destructive',
          onPress: async () => {
            try {
              setSaving(true);
              let { status } = await Location.requestForegroundPermissionsAsync();
              if (status !== 'granted') {
                Alert.alert('Permission denied', 'Location permission is required.');
                setSaving(false);
                return;
              }
              const loc = await Location.getCurrentPositionAsync({});
              const lat = loc.coords.latitude;
              const lng = loc.coords.longitude;
              const address = await reverseGeocode(lat, lng);

              // Save to backend
              const token = await AsyncStorage.getItem('authToken');
              const userId = await AsyncStorage.getItem('userId');
              if (!token || !userId) throw new Error('Authentication required');
              const res = await fetch(`${API_BASE_URL}/users/${userId}`, {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ location: address }),
              });
              if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.message || 'Failed to update location');
              }
              await fetchUserDetails();
              Alert.alert('Success', 'Location updated!');
            } catch (err: any) {
              Alert.alert('Error', err.message);
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  const renderLoading = () => (
    <View style={styles.center}>
      <LinearGradient
        colors={['#6e45e2', '#88d3ce']}
        style={styles.loadingContainer}
      >
        <ActivityIndicator size="large" color="#ffffff" />
        <Text style={styles.loadingText}>Loading Vendor Details...</Text>
      </LinearGradient>
    </View>
  );

  const renderNoUser = () => (
    <View style={styles.center}>
      <LinearGradient
        colors={['#ff758c', '#ff7eb3']}
        style={styles.errorContainer}
      >
        <MaterialIcons name="error-outline" size={48} color="white" />
        <Text style={styles.errorText}>No vendor data found</Text>
      </LinearGradient>
    </View>
  );

  const renderUserDetails = () => {
    const { password, otp, ...userDetails } = user;

    const fieldsToShow = [
      { key: 'store_name', label: 'Name', editable: false },
      { key: 'store_address', label: 'Address', editable: true },
      { key: 'contact', label: 'Contact', editable: true },
      { key: 'gstin', label: 'GSTIN', editable: false },
      { key: 'desc', label: 'Desc', editable: true },
      { key: 'location', label: 'Location', editable: false },
      { key: 'prefix', label: 'Prefix', editable: true },
      { key: 'email', label: 'Email', editable: true },
      { key: 'createdAt', label: 'Created At', editable: false },
    ];

    const locationInfo = parseLocation(userDetails.location);

    return (
      <LinearGradient
        colors={['#f5f7fa', '#c3cfe2']}
        style={styles.gradientBackground}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.card}>
            <View style={styles.header}>
              <TouchableOpacity onPress={pickLogo} style={{ marginRight: 16 }}>
                {logo ? (
                  <Image source={{ uri: logo }} style={{ width: 60, height: 60, borderRadius: 30 }} />
                ) : (
                  <MaterialIcons name="account-circle" size={60} color="#4a4a4a" />
                )}
                <Text style={{ color: '#2980b9', fontSize: 12, textAlign: 'center' }}>Change Logo</Text>
              </TouchableOpacity>
              <Text style={styles.title}>Profile</Text>
            </View>
            
            <View style={styles.detailsContainer}>
              {fieldsToShow.map(({ key, label, editable }) => {
                let value = userDetails[key];
                if (key === 'createdAt' && value) {
                  value = new Date(value).toLocaleString();
                }
                if (typeof value === 'undefined' || value === null) return null;

                // Special handling for location field
                if (key === 'location') {
                  return (
                    <View key={key} style={styles.detailRow}>
                      <View style={styles.labelContainer}>
                        <MaterialIcons name="chevron-right" size={16} color="#6e45e2" />
                        <Text style={styles.label}>{label}</Text>
                      </View>
                      <View style={{ flex: 1, flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'flex-end' }}>
                        <ScrollView
                          horizontal={true}
                          showsHorizontalScrollIndicator={true}
                          style={{ maxWidth: '100%', marginBottom: 4 }}
                          contentContainerStyle={{ flexGrow: 1 }}
                        >
                          <Text
                            style={[styles.value, { fontSize: 18, color: '#222', fontWeight: 'bold', textAlign: 'right', flexShrink: 1 }]}
                            selectable
                          >
                            {locationInfo.type === 'name' ? locationInfo.value : ''}
                          </Text>
                        </ScrollView>
                        <TouchableOpacity
                          onPress={handleChangeAddress}
                          disabled={saving}
                          style={{
                            marginTop: 2,
                            backgroundColor: '#2980b9',
                            paddingHorizontal: 8,
                            paddingVertical: 3,
                            borderRadius: 5,
                            alignSelf: 'flex-end',
                            minWidth: 0,
                          }}
                        >
                          <Text style={{ color: 'white', fontWeight: '600', fontSize: 12 }}>Change</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                }

                if (editField === key) {
                  return (
                    <View key={key} style={styles.detailRow}>
                      <View style={styles.labelContainer}>
                        <MaterialIcons name="chevron-right" size={16} color="#6e45e2" />
                        <Text style={styles.label}>{label}</Text>
                      </View>
                      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' }}>
                        <TextInput
                          style={[styles.value, styles.editInput]}
                          value={editValue}
                          onChangeText={setEditValue}
                          editable={!saving}
                          autoFocus
                        />
                        <TouchableOpacity
                          onPress={() => handleSaveField(key)}
                          disabled={saving}
                          style={{ marginLeft: 8 }}
                        >
                          <MaterialIcons name="check" size={22} color="#27ae60" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => { setEditField(null); setEditValue(''); }}
                          disabled={saving}
                          style={{ marginLeft: 4 }}
                        >
                          <MaterialIcons name="close" size={22} color="#e74c3c" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                }

                return (
                  <View key={key} style={styles.detailRow}>
                    <View style={styles.labelContainer}>
                      <MaterialIcons name="chevron-right" size={16} color="#6e45e2" />
                      <Text style={styles.label}>{label}</Text>
                    </View>
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' }}>
                      <Text style={styles.value} numberOfLines={2} ellipsizeMode="tail">
                        {String(value)}
                      </Text>
                      {editable && (
                        <TouchableOpacity
                          onPress={() => { setEditField(key); setEditValue(String(userDetails[key] ?? '')); }}
                          style={{ marginLeft: 8 }}
                        >
                          <MaterialIcons name="edit" size={20} color="#2980b9" />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        </ScrollView>
      </LinearGradient>
    );
  };

  if (loading) return renderLoading();
  if (!user) return renderNoUser();
  return renderUserDetails();
}

const styles = StyleSheet.create({
  gradientBackground: {
    flex: 1,
  },
  scrollContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    padding: 30,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    width: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
  },
  loadingText: {
    color: 'white',
    fontSize: 18,
    marginTop: 15,
    fontWeight: '500',
  },
  errorContainer: {
    padding: 30,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    width: '80%',
  },
  errorText: {
    color: 'white',
    fontSize: 18,
    marginTop: 15,
    fontWeight: '500',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 25,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 25,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingBottom: 15,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginLeft: 10,
  },
  detailsContainer: {
    width: '100%',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  label: {
    fontWeight: '600',
    color: '#555',
    marginLeft: 8,
    fontSize: 16,
  },
  value: {
    flex: 1,
    textAlign: 'right',
    color: '#333',
    fontSize: 16,
    paddingLeft: 10,
  },
  editInput: {
    borderBottomWidth: 1,
    borderColor: '#b2bec3',
    minWidth: 80,
    padding: 0,
    margin: 0,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#f8f9fa',
  },
});