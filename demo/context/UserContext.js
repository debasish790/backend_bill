// context/UserContext.js
import React, { createContext, useState } from 'react';

const UserContext = createContext(); // Create the context

export const UserProvider = ({ children }) => {
  const [vendorID, setVendorID] = useState(null); // State to store vendorID

  return (
    <UserContext.Provider value={{ vendorID, setVendorID }}>
      {children}
    </UserContext.Provider>
  );
};

export default UserContext; // Export the context
