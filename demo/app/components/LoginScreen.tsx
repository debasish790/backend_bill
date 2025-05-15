const handleLogin = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Login error:', data);
      throw new Error(data.message || 'Error logging in');
    }

    console.log('Login successful:', data);
    // Save token and user info (e.g., AsyncStorage or Context API)
  } catch (err) {
    console.error('Login error:', err);
    Alert.alert('Error', err.message);
  }
};
