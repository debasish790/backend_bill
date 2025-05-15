import React, { useState, useEffect } from 'react';
import { 
  View, Text, TextInput, Button, StyleSheet, Alert, 
  ActivityIndicator, FlatList, Image, TouchableOpacity 
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused } from '@react-navigation/native'; // Import useIsFocused
import { MaterialIcons } from '@expo/vector-icons';
import { eventEmitter } from './eventEmitter';

const API_BASE_URL = 'http://192.168.1.5:5000';

export default function ProductSection({ userId }) {
  const [productName, setProductName] = useState('');
  const [price, setPrice] = useState('');
  const [categoryID, setCategoryID] = useState('');
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [image, setImage] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [editingProductId, setEditingProductId] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editUsedProduct, setEditUsedProduct] = useState(false);
  const isFocused = useIsFocused(); 
const [hsn, setHsn] = useState('');
const [gstRate, setGstRate] = useState('');


  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const fetchProducts = async () => {
    try {
      setFetching(true);
      const token = await AsyncStorage.getItem('authToken');
      if (!token) throw new Error('Authentication required');

      const res = await fetch(`${API_BASE_URL}/products`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const errorText = await res.text(); 
        console.error('Error fetching products:', errorText);
        throw new Error('Failed to fetch products');
      }

      const data = await res.json();
      setProducts(Array.isArray(data) ? data : []); 
    } catch (err) {
      console.error('Error fetching products:', err.message);
      Alert.alert('Error', err.message);
    } finally {
      setFetching(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) throw new Error('Authentication required');

      const res = await fetch(`${API_BASE_URL}/categories`, {
        headers: { 
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error('Failed to fetch categories');
      const data = await res.json();
      setCategories(data);
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  const fetchInvoices = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) throw new Error('Authentication required');
      const res = await fetch(`${API_BASE_URL}/invoices`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch invoices');
      const data = await res.json();
      setInvoices(Array.isArray(data) ? data : []);
    } catch (err) {
      // Optionally handle error
    }
  };

  useEffect(() => {
    const loadData = async () => {
      await fetchCategories();
      await fetchProducts();
      await fetchInvoices();
    };
    loadData();
  }, [userId]); // <-- add userId as dependency to ensure reload on user change

  useEffect(() => {
    if (isFocused) {
      fetchCategories();
      fetchProducts();
      fetchInvoices(); // <-- ensure all data is refreshed when focused
    }
  }, [isFocused]);

  useEffect(() => {
    const refreshOnInvoice = async () => {
      await fetchInvoices();
      await fetchProducts();
    };
    eventEmitter.addListener('invoiceChanged', refreshOnInvoice);

    // Listen for category/product added events from InvoiceSection
    const refreshOnCategoryOrProduct = async () => {
      await fetchCategories();
      await fetchProducts();
    };
    eventEmitter.addListener('categoryAdded', refreshOnCategoryOrProduct);
    eventEmitter.addListener('productAdded', refreshOnCategoryOrProduct);

    return () => {
      eventEmitter.removeListener('invoiceChanged', refreshOnInvoice);
      eventEmitter.removeListener('categoryAdded', refreshOnCategoryOrProduct);
      eventEmitter.removeListener('productAdded', refreshOnCategoryOrProduct);
    };
  }, []);

  const handleAddProduct = async () => {
  // Required field validation
  if (!productName || !categoryID || !price) {
    Alert.alert('Error', 'Please fill all required fields');
    return;
  }

  // Validate HSN if provided
  if (hsn) {
    if (!/^\d{6,8}$/.test(hsn)) {
      Alert.alert('Error', 'HSN must be 6-8 digits');
      return;
    }

    if (!gstRate || parseFloat(gstRate) < 0 || parseFloat(gstRate) > 100) {
      Alert.alert('Error', 'Valid GST Rate (0-100) is required when providing HSN');
      return;
    }
  }

  setLoading(true);
  try {
    const token = await AsyncStorage.getItem('authToken');
    if (!token) throw new Error('Authentication required');

    const formData = new FormData();
    formData.append('product_name', productName);
    formData.append('category_ID', categoryID);
    formData.append('price', price);
    if (hsn) {
      formData.append('hsn', hsn);
      formData.append('gstRate', gstRate);
    }

    if (image) {
      formData.append('image', {
        uri: image,
        name: 'product.jpg',
        type: 'image/jpeg'
      });
    }

    const res = await fetch(`${API_BASE_URL}/products`, {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'multipart/form-data',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.message || 'Failed to add product');
    }

    await fetchProducts(); // Refresh the product list
    fetchCategories(); // Refresh categories after adding a product
    eventEmitter.emit('productAdded'); // Emit event here

    // Reset form
    setProductName('');
    setPrice('');
    setCategoryID('');
    setImage(null);
    setHsn('');
    setGstRate('');

    Alert.alert('Success', 'Product added successfully!');
  } catch (err) {
    Alert.alert('Error', err.message);
  } finally {
    setLoading(false);
  }
};

  const deleteProduct = async (productId) => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) throw new Error('Authentication required');
      const res = await fetch(`${API_BASE_URL}/products/${productId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error('Failed to delete product');
      await fetchProducts();
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  const handleEditProduct = (product) => {
    setProductName(product.product_name);
    setPrice(String(product.price));
    setCategoryID(product.category_ID);
    setHsn(product.hsn);
     setGstRate(product.gstRate?.toString() || '');
    setImage(product.image ? `${API_BASE_URL}/${product.image}` : null);
    setEditingProductId(product._id);
    const used = isProductUsed(product._id);
    setEditUsedProduct(used);
    setEditMode(true);
  };

  const handleUpdateProduct = async () => {
  if (editUsedProduct) {
      // Only allow image update
      if (!image || image.startsWith(API_BASE_URL)) {
        Alert.alert('Error', 'Please select a new image to update.');
        return;
      }
    } else {
    if (!productName || !categoryID || !price || !hsn) {
      Alert.alert('Error', 'Please fill all required fields');
      return;
    }
  }
  setLoading(true);
try {
  const token = await AsyncStorage.getItem('authToken');
  if (!token) throw new Error('Authentication required');

  const formData = new FormData();

  // Modify validation in handleUpdateProduct
  if (!editUsedProduct) {
    if (!productName || !categoryID || !price) {
      Alert.alert('Error', 'Please fill all required fields');
      return;
    }
    if (hsn) {
      if (!gstRate || parseInt(gstRate) < 0 || parseInt(gstRate) > 100) {
        Alert.alert('Error', 'Valid GST Rate (0-100) is required when providing HSN');
        return;
      }
    }

    formData.append('product_name', productName);
    formData.append('category_ID', categoryID);
    formData.append('price', price);
    formData.append('hsn', hsn);

    // Add GST rate to formData if HSN exists
    if (hsn) {
      formData.append('gstRate', gstRate);
    }
  }

  // Always allow image update if new image is picked
  if (image && !image.startsWith(API_BASE_URL)) {
    formData.append('image', {
      uri: image,
      name: 'product.jpg',
      type: 'image/jpeg'
    });
  }

  const res = await fetch(`${API_BASE_URL}/products/${editingProductId}`, {
    method: 'PUT',
    body: formData,
    headers: {
      'Content-Type': 'multipart/form-data',
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.message || 'Failed to update product');
  }

  await fetchProducts();
  fetchCategories();
  setProductName('');
  setPrice('');
  setCategoryID('');
  setImage(null);
  setEditingProductId(null);
  setEditUsedProduct(false);
  setEditMode(false);
  Alert.alert('Success', 'Product updated successfully!');
} catch (err) {
  Alert.alert('Error', err.message);
} finally {
  setLoading(false);
}
  };

  const handleCancelEdit = () => {
    setProductName('');
    setPrice('');
    setCategoryID('');
    setImage(null);
    setEditingProductId(null);
    setEditUsedProduct(false);
    setEditMode(false);
  };

  const getCategoryName = (categoryId) => {
    return categories.find(cat => cat._id === categoryId)?.category_name || 'Unknown';
  };

  const isProductUsed = (productId) => {
    // Defensive: check for both string and object id match
    return invoices.some(inv =>
      Array.isArray(inv.rows) &&
      inv.rows.some(row =>
        row.productId === productId ||
        row.productId?._id === productId ||
        row.productId === String(productId)
      )
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Add Product</Text>
      
      <View style={styles.formContainer}>
        <View style={styles.imageContainer}>
          <TouchableOpacity onPress={pickImage} style={styles.imageUpload}>
            {image ? (
              <Image source={{ uri: image }} style={styles.imagePreview} />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Text style={styles.uploadText}>+ Upload Image</Text>
                <Text style={styles.uploadHint}>Recommended size: 500x500</Text>
              </View>
            )}
          </TouchableOpacity>
          {image && (
            <TouchableOpacity
              onPress={() => setImage(null)}
              style={{ marginTop: 8, alignSelf: 'center' }}
            >
              <Text style={{ color: '#e74c3c', fontSize: 14 }}>Remove Image</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.formFields}>
          <TextInput
            style={[styles.input, editUsedProduct && { backgroundColor: '#f0f0f0' }]}
            placeholder="Product Name*"
            value={productName}
            onChangeText={setProductName}
            editable={!editUsedProduct}
          />
         <TextInput
  style={[styles.input, editUsedProduct && { backgroundColor: '#f0f0f0' }]}
  placeholder="HSN Number (optional)"
  value={hsn}
  onChangeText={(text) => {
    setHsn(text);
    if (!text) setGstRate(''); // Clear GST rate when HSN is cleared
  }}
  keyboardType="numeric"
  editable={!editUsedProduct}
  maxLength={8}
/>

{hsn && (
  <>
    <TextInput
      style={[styles.input, editUsedProduct && { backgroundColor: '#f0f0f0' }]}
      placeholder="GST Rate (%)"
      value={gstRate}
      onChangeText={(text) => setGstRate(text.replace(/[^0-9]/g, ''))}
      keyboardType="numeric"
      editable={!editUsedProduct}
      maxLength={3}
    />
    {gstRate !== '' && (
      <Text style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
         GST {gstRate}% = CGST {(gstRate / 2).toFixed(1)}% + SGST {(gstRate / 2).toFixed(1)}%
      </Text>
    )}
  </>
)}

          <TextInput
            style={[styles.input, editUsedProduct && { backgroundColor: '#f0f0f0' }]}
            placeholder="Price*"
            value={price}
            onChangeText={setPrice}
            keyboardType="numeric"
            editable={!editUsedProduct}
          />
          <Picker
            selectedValue={categoryID}
            onValueChange={setCategoryID}
            style={styles.picker}
            enabled={!editUsedProduct}
          >
            <Picker.Item label="Select Category*" value="" />
            {categories.map((cat) => (
              <Picker.Item
                key={cat._id}
                label={cat.category_name}
                value={cat._id}
              />
            ))}
          </Picker>
          {editingProductId ? (
            <>
              <Button
                title={loading ? 'Updating...' : 'Update Product'}
                onPress={handleUpdateProduct}
                disabled={loading}
              />
              <Button
                title="Cancel Edit"
                onPress={handleCancelEdit}
                color="#888"
              />
            </>
          ) : (
            <Button
              title={loading ? 'Adding...' : 'Add Product'}
              onPress={handleAddProduct}
              disabled={loading}
            />
          )}
          {editUsedProduct && (
            <Text style={{ color: '#e67e22', marginTop: 8, fontSize: 13 }}>
              Only image can be changed for products used in invoices.
            </Text>
          )}
        </View>
      </View>

      <Text style={styles.subtitle}>Products List</Text>
      {fetching ? (
        <ActivityIndicator size="large" color="#0000ff" />
      ) : (
        <FlatList
  data={products}
  keyExtractor={item => item._id}
  renderItem={({ item }) => {
  const used = isProductUsed(item._id);
  return (
    <View style={styles.productItem}>
        {item.image && (
          <Image 
            source={{ uri: `${API_BASE_URL}/${item.image}` }} 
            style={styles.listImage} 
          />
        )}
      <View style={styles.productInfo}>
  <Text style={styles.productName}>{item.product_name}</Text>
  <Text>Price: ₹{parseFloat(item.price).toFixed(2)}</Text>
  {item.hsn && (
    <>
      <Text>HSN: {item.hsn}</Text>
      <Text>GST: {item.gstRate}% (CGST: {item.gstRate/2}%, SGST: {item.gstRate/2}%)</Text>
    </>
  )}
  <Text>Category: {getCategoryName(item.category_ID)}</Text>
</View>
        <TouchableOpacity
          onPress={() => {
            handleEditProduct(item);
          }}
          style={[styles.deleteButton, used && { opacity: 0.5 }]}
        >
          <MaterialIcons name="edit" size={24} color="#2980b9" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            if (used) {
              Alert.alert('Not allowed', 'This product is used in an invoice and cannot be deleted.');
            } else {
              Alert.alert(
                'Delete Product',
                'Are you sure you want to delete this product?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', onPress: () => deleteProduct(item._id) },
                ]
              );
            }
          }}
          style={[styles.deleteButton, used && { opacity: 0.5 }]}
          disabled={used}
        >
          <MaterialIcons name="delete-outline" size={24} color={used ? "#ccc" : "#e74c3c"} />
        </TouchableOpacity>
      </View>
    );
  }}
  ListEmptyComponent={<Text style={styles.emptyText}>No products found</Text>}
/>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    padding: 24,
    backgroundColor: '#f8f9fa'
  },
  title: { 
    fontSize: 28, 
    fontWeight: 'bold', 
    marginBottom: 24,
    color: '#2c3e50',
    textAlign: 'center'
  },
  subtitle: { 
    fontSize: 20, 
    fontWeight: '600', 
    marginVertical: 16,
    color: '#34495e',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0'
  },
  formContainer: { 
    flexDirection: 'row', 
    marginBottom: 24,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3
  },
  imageContainer: { 
    flex: 1, 
    marginRight: 16 
  },
  formFields: { 
    flex: 2 
  },
  imageUpload: {
    aspectRatio: 1,
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed'
  },
  imagePreview: { 
    width: '100%', 
    height: '100%',
    resizeMode: 'cover'
  },
  imagePlaceholder: { 
    alignItems: 'center',
    padding: 16
  },
  uploadText: { 
    fontSize: 16, 
    color: '#4a5568',
    fontWeight: '500',
    marginBottom: 4
  },
  uploadHint: { 
    fontSize: 12, 
    color: '#718096',
    textAlign: 'center'
  },
  input: { 
    borderWidth: 1, 
    borderColor: '#e2e8f0', 
    padding: 14, 
    borderRadius: 8, 
    marginBottom: 16,
    backgroundColor: '#ffffff',
    fontSize: 16,
    color: '#2d3748'
  },
  picker: { 
    borderWidth: 1, 
    borderColor: '#e2e8f0', 
    marginBottom: 16,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    height: 50
  },
  button: {
    backgroundColor: '#3498db',
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 8
  },
  buttonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 16
  },
  productItem: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    marginBottom: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2
  },
  listImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 16,
    backgroundColor: '#f1f5f9'
  },
  productInfo: { 
    flex: 1,
     marginRight: 8
  },
  productName: { 
    fontSize: 16, 
    fontWeight: '600',
    color: '#2d3748',
    marginBottom: 4
  },
  productPrice: {
    fontSize: 14,
    color: '#4a5568',
    marginBottom: 4
  },
  productCategory: {
    fontSize: 14,
    color: '#718096'
  },
  emptyText: { 
    textAlign: 'center', 
    marginTop: 24, 
    color: '#a0aec0',
    fontSize: 16
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  deleteButton: {
    padding: 8,
    marginLeft: 16,
  },
});