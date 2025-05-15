import React, { createContext, useState, useEffect } from 'react';

export const AuthContext = createContext({ user: null }); // Provide a default value

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Simulate fetching the logged-in user's data
    const fetchUser = async () => {
      console.log('Fetching user data...');
      const loggedInUser = {
        _id: '507f1f77bcf86cd799439011', // Replace with actual user ID
        name: 'John Doe',
        email: 'john.doe@example.com',
      };
      console.log('User fetched:', loggedInUser); // Debug log
      setUser(loggedInUser);
    };
    fetchUser();
  }, []);

  return (
    <AuthContext.Provider value={{ user, setUser }}>
      {children}
    </AuthContext.Provider>
  );
};
