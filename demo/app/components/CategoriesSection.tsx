import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  TextInput, 
  Button, 
  StyleSheet, 
  Alert, 
  ActivityIndicator,
  TouchableOpacity 
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons } from '@expo/vector-icons';
import { eventEmitter } from './eventEmitter';

export default function CategoriesSection({ userId }) {
  const [categories, setCategories] = useState([]);
  const [categoryName, setCategoryName] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [products, setProducts] = useState([]);
  const [editCategoryId, setEditCategoryId] = useState(null);
  const [editCategoryName, setEditCategoryName] = useState('');

  const fetchProducts = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) throw new Error('Authentication token is missing');
      const response = await fetch(
        `http://192.168.1.5:5000/products?vendor_ID=${userId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!response.ok) throw new Error('Failed to fetch products');
      const data = await response.json();
      setProducts(data);
    } catch (error) {
      // Optionally handle error
    }
  };

  const fetchCategories = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) throw new Error('Authentication token is missing');

      const response = await fetch(
        `http://192.168.1.5:5000/categories?vendor_ID=${userId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!response.ok) throw new Error('Failed to fetch categories');
      const data = await response.json();
      setCategories(data);
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to fetch categories');
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    fetchCategories();
    fetchProducts();
  }, [userId]);

  useEffect(() => {
    const refreshData = () => {
      fetchCategories();
      fetchProducts();
    };

    eventEmitter.addListener('productAdded', refreshData);
    eventEmitter.addListener('categoryAdded', refreshData); // <-- listen for categoryAdded

    return () => {
      eventEmitter.removeListener('productAdded', refreshData);
      eventEmitter.removeListener('categoryAdded', refreshData); // <-- cleanup
    };
  }, []);

  const addCategory = async () => {
    if (!categoryName.trim()) {
      Alert.alert('Error', 'Category Name is required.');
      return;
    }

    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      const response = await fetch('http://192.168.1.5:5000/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          category_name: categoryName.trim(),
          vendor_ID: userId,
        }),
      });

      if (!response.ok) throw new Error('Failed to add category');
      
      await fetchCategories();
      await fetchProducts(); // <-- ensure products are up-to-date
      setCategoryName('');
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to add category');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (categoryId) => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) throw new Error('Authentication token is missing');

      const response = await fetch(`http://192.168.1.5:5000/categories/${categoryId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to delete category');
      
      setCategories(prev => prev.filter(cat => cat._id !== categoryId));
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to delete category');
    }
  };

  const isCategoryUsed = (categoryId) =>
    products.some(prod => prod.category_ID === categoryId);

  const startEdit = (cat) => {
    setEditCategoryId(cat._id);
    setEditCategoryName(cat.category_name);
  };

  const saveEdit = async () => {
    if (!editCategoryName.trim()) {
      Alert.alert('Error', 'Category Name is required.');
      return;
    }
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      const response = await fetch(`http://192.168.1.5:5000/categories/${editCategoryId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          category_name: editCategoryName.trim(),
        }),
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to update category. (Is the backend PUT /categories/:id implemented?)');
      }
      await fetchCategories();
      await fetchProducts();
      setEditCategoryId(null);
      setEditCategoryName('');
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to update category');
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }) => {
    const used = isCategoryUsed(item._id);
    return (
      <View style={styles.item}>
        {editCategoryId === item._id ? (
          <>
            <TextInput
              style={styles.input}
              value={editCategoryName}
              onChangeText={setEditCategoryName}
              editable={!used}
            />
            <Button
              title="Save"
              onPress={saveEdit}
              disabled={used || loading}
            />
            <Button
              title="Cancel"
              onPress={() => { setEditCategoryId(null); setEditCategoryName(''); }}
              disabled={loading}
            />
          </>
        ) : (
          <>
            <Text style={styles.itemText}>{item.category_name}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity
                onPress={() => {
                  if (used) {
                    Alert.alert('Not allowed', 'This category is used in a product and cannot be edited.');
                  } else {
                    startEdit(item);
                  }
                }}
                style={[styles.editButton, used && { opacity: 0.5 }]}
                disabled={used}
              >
                <MaterialIcons name="edit" size={22} color={used ? "#ccc" : "#2980b9"} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  if (used) {
                    Alert.alert('Not allowed', 'This category is used in a product and cannot be deleted.');
                  } else {
                    Alert.alert(
                      'Delete Category',
                      'Are you sure you want to delete this category?',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Delete', onPress: () => handleDelete(item._id) },
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
          </>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Categories</Text>
      {fetching ? (
        <ActivityIndicator size="large" color="#0000ff" />
      ) : (
        <FlatList
          data={categories}
          keyExtractor={item => item._id}
          renderItem={renderItem}
          ListEmptyComponent={<Text style={styles.emptyText}>No categories found.</Text>}
        />
      )}
      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Category Name"
          value={categoryName}
          onChangeText={setCategoryName}
        />
        <Button 
          title={loading ? 'Adding...' : 'Add Category'} 
          onPress={addCategory} 
          disabled={loading} 
        />
      </View>
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
  item: { 
    padding: 16,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: '#3498db',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemText: { 
    fontSize: 18, 
    fontWeight: '500',
    color: '#2d3748',
    flex: 1,
  },
  deleteButton: {
    padding: 8,
    marginLeft: 16,
  },
  editButton: {
    padding: 8,
    marginLeft: 8,
  },
  form: { 
    marginTop: 24,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3
  },
  input: { 
    borderWidth: 1, 
    borderColor: '#e2e8f0', 
    borderRadius: 8, 
    padding: 14, 
    marginBottom: 16,
    backgroundColor: '#ffffff',
    fontSize: 16,
    color: '#2d3748'
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 24,
    color: '#a0aec0',
    fontSize: 16
  }
});