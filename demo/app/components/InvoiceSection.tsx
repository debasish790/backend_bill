import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Button,
  Alert,
  ActivityIndicator,
  Share,
  ScrollView,
  Modal,
  TouchableWithoutFeedback,
  Keyboard,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { eventEmitter } from "./eventEmitter";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as Print from "expo-print";
import { MaterialIcons } from "@expo/vector-icons";

const API_BASE_URL = "http://192.168.1.5:5000";
const GST_RATE = 18;

function getFinancialYear(dateObj = new Date()) {
  const year = dateObj.getFullYear();
  const month = dateObj.getMonth() + 1;
  return month >= 4 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
}

export default function InvoiceSection({ userId }) {
  const [billType, setBillType] = useState("GST");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [customerMobile, setCustomerMobile] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [rows, setRows] = useState([
    { categoryId: "", productId: "", quantity: "", rate: "" },
  ]);
  const [date] = useState(new Date().toLocaleDateString());
  const [prefix, setPrefix] = useState("");
  const [userSerial, setUserSerial] = useState(1);
  const [invoiceCategories, setInvoiceCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState([]);
  const [vendorName, setVendorName] = useState("Your Business");
  const [vendorDesc, setVendorDesc] = useState("");
  const [vendorLogo, setVendorLogo] = useState("");
  const [productSearch, setProductSearch] = useState({});
  const [categorySearch, setCategorySearch] = useState({});
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [pendingProductRow, setPendingProductRow] = useState(null);
  const [pendingCategoryRow, setPendingCategoryRow] = useState(null);
  const [newProductName, setNewProductName] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [addingProduct, setAddingProduct] = useState(false);
  const [addingCategory, setAddingCategory] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState({});
  const [showProductDropdown, setShowProductDropdown] = useState({});
  const [lastInvoiceUri, setLastInvoiceUri] = useState<string | null>(null);
  const [shareEnabled, setShareEnabled] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [newHsnNumber, setNewHsnNumber] = useState("");
  const [newGstRate, setNewGstRate] = useState("18");
  const [currentFinancialYear, setCurrentFinancialYear] = useState("");
  const [isNewUser, setIsNewUser] = useState(false);
const [isInitialSetupDone, setIsInitialSetupDone] = useState(false);
const [initialSerialInput, setInitialSerialInput] = useState("");

  // Set current financial year
  useEffect(() => {
    const year = getFinancialYear();
    setCurrentFinancialYear(year);
  }, []);

  // Update invoice number when dependencies change
  useEffect(() => {
  if (!currentFinancialYear) return;

  let serialPart;
  if (isNewUser && !isInitialSetupDone) {
    serialPart = initialSerialInput.padStart(3, "0");
  } else {
    serialPart = userSerial.toString().padStart(3, "0");
  }

  setInvoiceNumber(`${prefix}/${currentFinancialYear}/${serialPart}`);
}, [prefix, currentFinancialYear, userSerial, initialSerialInput, isNewUser, isInitialSetupDone]);

  // Fetch user data and vendor-specific data
  const fetchVendorData = useCallback(async () => {
  try {
    setLoading(true);
    const token = await AsyncStorage.getItem("authToken");
    if (!token || !userId) throw new Error("Authentication required");

    // Fetch user data
    const userRes = await fetch(`${API_BASE_URL}/users/${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const userData = await userRes.json();
    setPrefix(userData.prefix || "INV");
    setVendorName(userData.store_name || "Your Business");
    setVendorDesc(userData.desc || "");
    setVendorLogo(userData.logo ? `${API_BASE_URL}/${userData.logo}` : "");

    // Fetch vendor data
    const [categoriesRes, productsRes, invoicesRes] = await Promise.all([
      fetch(`${API_BASE_URL}/categories?vendor_ID=${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      fetch(`${API_BASE_URL}/products?vendor_ID=${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      fetch(`${API_BASE_URL}/invoices?vendor_ID=${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    ]);

    const [categoriesData, productsData, invoicesData] = await Promise.all([
      categoriesRes.json(),
      productsRes.json(),
      invoicesRes.json(),
    ]);

    // Check if user has any existing invoices
    setIsNewUser(invoicesData.length === 0);

    // Calculate serial number
    const currentYearInvoices = invoicesData.filter(invoice => {
      const parts = invoice.invoiceNumber?.split('/') || [];
      return parts[1] === currentFinancialYear;
    });

    const serials = currentYearInvoices.map(invoice => {
      const parts = invoice.invoiceNumber?.split('/') || [];
      return parseInt(parts[2] || '0', 10) || 0;
    });

    const maxSerial = serials.length > 0 ? Math.max(...serials) : 0;
    setUserSerial(maxSerial + 1);

    // Update state
    setInvoiceCategories(categoriesData);
    setProducts(productsData);
    setInvoices(invoicesData);
  } catch (error) {
    Alert.alert("Error", error.message);
  } finally {
    setLoading(false);
  }
}, [userId, currentFinancialYear]);

  useFocusEffect(
    useCallback(() => {
      fetchVendorData();
    }, [fetchVendorData])
  );

  // Helper functions
  const getCategoryName = (id) =>
    invoiceCategories.find((c) => c._id === id)?.category_name || "";

  const getProductName = (id) =>
    products.find((p) => p._id === id)?.product_name || "";

  const getProductHsn = (id) =>
  products.find((p) => p._id === id)?.hsn || "";

  const getFilteredCategories = (idx) => {
    const search = (categorySearch[idx] || "").toLowerCase();
    return invoiceCategories.filter(
      (c) => !search || c.category_name.toLowerCase().includes(search)
    );
  };

  const getFilteredProducts = (idx, categoryId) => {
    const search = (productSearch[idx] || "").toLowerCase();
    return products.filter(
      (p) =>
        p.category_ID === categoryId &&
        (!search || p.product_name.toLowerCase().includes(search))
    );
  };

  // Calculation functions
  const calculateTotals = useCallback(() => {
  let subtotal = 0;
  let totalCgst = 0;
  let totalSgst = 0;
  
  const calculatedRows = rows.map((row) => {
    const product = products.find(p => p._id === row.productId);
    const gstRate = product?.gstRate || 0;
    const quantity = parseFloat(row.quantity) || 0;
    const rate = parseFloat(row.rate) || 0;
    const taxableValue = quantity * rate;
    const cgst = taxableValue * (gstRate / 200);
    const sgst = taxableValue * (gstRate / 200);
    
    subtotal += taxableValue;
    totalCgst += cgst;
    totalSgst += sgst;

    return { 
      ...row, 
      taxableValue,
      cgst,
      sgst,
      gstRate,
      total: taxableValue + cgst + sgst,
      hsn: product?.hsn || ''
    };
  });

  return {
    rows: calculatedRows,
    subtotal,
    cgstAmount: totalCgst,
    sgstAmount: totalSgst,
    totalAmount: subtotal + totalCgst + totalSgst,
  };
}, [rows, products]);

const renderPreviewTable = () => {
  const { rows: calculatedRows, subtotal, cgstAmount, sgstAmount, totalAmount } = calculateTotals();

  return (
    <View style={styles.invoiceTable}>
      <View style={styles.tableHeader}>
        <Text style={[styles.th, { flex: 0.5 }]}>#</Text>
        <Text style={[styles.th, { flex: 2 }]}>Item</Text>
        <Text style={styles.th}>HSN</Text>
        <Text style={styles.th}>GST%</Text>
        <Text style={styles.th}>Taxable</Text>
        <Text style={styles.th}>CGST</Text>
        <Text style={styles.th}>SGST</Text>
        <Text style={styles.th}>Total</Text>
      </View>

      {calculatedRows.map((row, idx) => (
        <View style={styles.tableRow} key={idx}>
          <Text style={[styles.td, { flex: 0.5 }]}>{idx + 1}</Text>
          <Text style={[styles.td, { flex: 2 }]}>{getProductName(row.productId)}</Text>
          <Text style={styles.td}>{row.hsn}</Text>
          <Text style={styles.td}>{row.gstRate}%</Text>
          <Text style={styles.td}>₹{row.taxableValue.toFixed(2)}</Text>
          <Text style={styles.td}>₹{row.cgst.toFixed(2)}</Text>
          <Text style={styles.td}>₹{row.sgst.toFixed(2)}</Text>
          <Text style={styles.td}>₹{row.total.toFixed(2)}</Text>
        </View>
      ))}

      <View style={styles.totalsContainer}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Taxable Amount:</Text>
          <Text style={styles.totalValue}>₹{subtotal.toFixed(2)}</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total CGST:</Text>
          <Text style={styles.totalValue}>₹{cgstAmount.toFixed(2)}</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total SGST:</Text>
          <Text style={styles.totalValue}>₹{sgstAmount.toFixed(2)}</Text>
        </View>
        <View style={[styles.totalRow, { borderTopWidth: 1, paddingTop: 4 }]}>
          <Text style={[styles.totalLabel, { fontWeight: 'bold' }]}>Grand Total:</Text>
          <Text style={[styles.totalValue, { fontWeight: 'bold' }]}>₹{totalAmount.toFixed(2)}</Text>
        </View>
      </View>
    </View>
  );
};

  const { subtotal, gstAmount, cgstAmount, sgstAmount, totalAmount } = useMemo(
    () => calculateTotals(),
    [calculateTotals]
  );

  // Row management
  const handleRowChange = (idx, key, value) => {
  const updated = [...rows];
  updated[idx][key] = value;
  
  if (key === "categoryId") {
    updated[idx].productId = "";
    updated[idx].rate = "";
    updated[idx].hsn = "";
    updated[idx].gstRate = null;
  }
  
  if (key === "productId") {
    const prod = products.find((p) => p._id === value);
    if (prod) {
      updated[idx].rate = String(prod.price);
      updated[idx].gstRate = prod.gstRate || null;
      updated[idx].hsn = prod.hsn || '';
    }
  }
  
  setRows(updated);
};
  const addRow = () =>
    setRows([
      ...rows,
      { categoryId: "", productId: "", quantity: "", rate: "" },
    ]);
  const removeRow = (idx) =>
    rows.length > 1 && setRows(rows.filter((_, i) => i !== idx));

  // Add product from invoice form
const handleAddProductFromPicker = async (rowIdx, categoryId, productName) => {
  setAddingProduct(true);
  try {
    const token = await AsyncStorage.getItem("authToken");
    if (!token) throw new Error("Authentication required");

    // Require GST when HSN is provided
    if (newHsnNumber && (!newGstRate || isNaN(parseFloat(newGstRate)))) {
      Alert.alert("Error", "GST Rate is required when HSN is provided");
      return;
    }

    // Validate GST Rate
    const gstRate = parseFloat(newGstRate);
    if (newGstRate && isNaN(gstRate)) {
      throw new Error("Invalid GST Rate");
    }

    const formData = new FormData();
    formData.append("product_name", productName);
    formData.append("category_ID", categoryId);
    formData.append("price", rows[rowIdx]?.rate || "0");
    formData.append("hsn", newHsnNumber);
    formData.append("gstRate", newGstRate); // Add GST Rate

    const res = await fetch(`${API_BASE_URL}/products`, {
      method: "POST",
      headers: {
        "Content-Type": "multipart/form-data",
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.message || "Failed to add product");
    }

    const newProd = await res.json();
    await fetchVendorData(); // Refresh products

    // Update the row with the new product's price
    const updatedRows = [...rows];
    updatedRows[rowIdx] = {
      ...updatedRows[rowIdx],
      productId: newProd._id,
      rate: newProd.price.toString(),
    };
    setRows(updatedRows);

    setShowAddProductModal(false);
    setNewProductName("");
    setNewHsnNumber(""); // Reset HSN field
    setPendingProductRow(null);
    eventEmitter.emit("productAdded");
  } catch (err) {
    Alert.alert("Error", err.message);
  } finally {
    setAddingProduct(false);
    setNewGstRate(""); // Reset GST Rate field
  }
};



  // Add category from invoice form
  const handleAddCategoryFromPicker = async (rowIdx, categoryName) => {
    setAddingCategory(true);
    try {
      const token = await AsyncStorage.getItem("authToken");
      if (!token) throw new Error("Authentication required");
      const res = await fetch(`${API_BASE_URL}/categories`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          category_name: categoryName,
          vendor_ID: userId,
        }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to add category");
      }
      const newCat = await res.json();
      await fetchVendorData();
      handleRowChange(rowIdx, "categoryId", newCat._id);
      setShowAddCategoryModal(false);
      setNewCategoryName("");
      setPendingCategoryRow(null);
      eventEmitter.emit("categoryAdded");
      eventEmitter.emit("productAdded");
    } catch (err) {
      Alert.alert("Error", err.message);
    } finally {
      setAddingCategory(false);
    }
  };

  // Generate PDF and share (for submit)
  const handleSubmitInvoice = async () => {
  try {
    // Validate rows
    const invalidRows = rows.some(
      row =>
        !row.categoryId ||
        !row.productId ||
        !row.quantity ||
        !row.rate ||
        isNaN(parseFloat(row.quantity)) ||
        isNaN(parseFloat(row.rate))
    );

    if (invalidRows) {
      Alert.alert("Error", "Please fill all item fields with valid values");
      return;
    }

    // Validate initial serial input for new users
    if (isNewUser && !isInitialSetupDone) {
      if (!initialSerialInput || isNaN(parseInt(initialSerialInput, 10))) {
        Alert.alert("Error", "Please enter a valid starting serial number");
        return;
      }
    }

    const token = await AsyncStorage.getItem("authToken");
    if (!token) throw new Error("Authentication required");

    // Determine the serial number to use
    let currentSerial;
    if (isNewUser && !isInitialSetupDone) {
      currentSerial = parseInt(initialSerialInput, 10);
    } else {
      currentSerial = userSerial;
    }

    // Generate invoice number
    const invoiceNumber = `${prefix}/${currentFinancialYear}/${currentSerial.toString().padStart(3, "0")}`;

    // Prepare payload
    const payload = {
      vendor_ID: userId,
      customer_name: customerName,
      customer_mobile: customerMobile,
      rows: rows.map(row => ({
        categoryId: row.categoryId,
        productId: row.productId,
        quantity: parseFloat(row.quantity),
        rate: parseFloat(row.rate),
      })),
      totalAmount: calculateTotals().totalAmount,
      invoiceNumber,
      date: new Date().toISOString(),
    };

    // Save to database
    const invoiceResponse = await fetch(`${API_BASE_URL}/invoices`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!invoiceResponse.ok) {
      const errorData = await invoiceResponse.json().catch(() => ({}));
      throw new Error(errorData.message || "Failed to save invoice");
    }

    // Update state for new users
    if (isNewUser) {
      setIsInitialSetupDone(true);
      setIsNewUser(false);
    }

    // Refresh data
    await fetchVendorData();

    // Reset form
    setCustomerMobile("");
    setCustomerName("");
    setRows([{ categoryId: "", productId: "", quantity: "", rate: "" }]);

    // Generate PDF
    const { uri } = await generateInvoicePDF();
    setLastInvoiceUri(uri);
    setShareEnabled(true);

    Alert.alert("Success", "Invoice saved and PDF generated!");
  } catch (error) {
    Alert.alert("Error", `Invoice submission failed: ${error.message}`);
    console.error("Submission error:", error);
  }
};


const generateInvoicePDF = async () => {
  const { rows: calculatedRows, subtotal, cgstAmount, sgstAmount, totalAmount } = calculateTotals();

  const html = `
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
        <style>
          @page {
            margin: 0;
            size: 100mm auto;  // Increased from 80mm
            padding: 1mm;
          }
          body {
            width: 94mm !important;  // Increased from 72mm
            margin: 0 auto;
            padding: 2mm;
            font-family: 'Courier New', monospace;
            font-size: 9pt;  // Reduced from 10pt
            line-height: 1.0;
            box-sizing: border-box;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          .line {
            border-top: 1px dashed #000;
            margin: 2px 0;
          }
          .item-block {
            margin: 3px 0;
            page-break-inside: avoid;
          }
          .row {
            display: flex;
            justify-content: space-between;
            margin: 1px 0;
          }
          h2 {
            font-size: 11pt;  // Reduced header size
            margin: 1px 0;
          }
          .item-block div {
            font-size: 8.5pt;  // Smaller font for details
            margin: 1px 0;
          }
          .footer {
            margin-top: 3px;
          }
          // Add word-break for long texts
          .break-word {
            word-break: break-word;
            hyphens: auto;
          }
        </style>
      </head>
      
      <body>
        <!-- Header Section -->
        <div style="text-align: center;">
          <h2>${vendorName}</h2>
          ${vendorDesc ? `<p style="margin: 1px 0; font-size: 8pt;">${vendorDesc}</p>` : ''}
        </div>
        <div class="line"></div>

        <!-- Simplified Invoice Info -->
        <div class="item-block" style="font-size: 8.5pt;">
          <div><strong>INV#:</strong> ${invoiceNumber}</div>
          <div><strong>DATE:</strong> ${date}</div>
          <div><strong>CUSTOMER:</strong> ${customerName || "Walk-in"}</div>
          <div><strong>MOBILE:</strong> ${customerMobile || ""}</div>
        </div>
        <div class="line"></div>

        <!-- Items List with Compact Layout -->
        ${calculatedRows.map(row => `
          <div class="item-block">
            <div class="break-word">${getProductName(row.productId)}</div>
            <div style="font-size: 8pt;">HSN: ${row.hsn || ''}</div>
            <div class="row">
              <span>Qty: ${row.quantity}x₹${parseFloat(row.rate).toFixed(2)}</span>
              <span>₹${parseFloat(row.taxableValue).toFixed(2)}</span>
            </div>
            <div class="row" style="font-size: 8pt;">
              <span>GST ${row.gstRate}%: ₹${(row.cgst + row.sgst).toFixed(2)}</span>
              <span>Total: ₹${row.total.toFixed(2)}</span>
            </div>
          </div>
        `).join('')}

        <!-- Totals Section -->
        <div class="line"></div>
        <div class="item-block" style="font-size: 9pt;">
          <div class="row">
            <span>Subtotal:</span>
            <span>₹${subtotal.toFixed(2)}</span>
          </div>
          <div class="row">
            <span>CGST:</span>
            <span>₹${cgstAmount.toFixed(2)}</span>
          </div>
          <div class="row">
            <span>SGST:</span>
            <span>₹${sgstAmount.toFixed(2)}</span>
          </div>
          <div class="line" style="margin: 3px 0;"></div>
          <div class="row" style="font-weight: bold;">
            <span>GRAND TOTAL:</span>
            <span>₹${totalAmount.toFixed(2)}</span>
          </div>
        </div>

        <!-- Compact Footer -->
        <div class="line footer"></div>
        <div style="text-align: center; font-size: 8pt; margin-top: 3px;">
          Thank you for your business!
        </div>
      </body>
    </html>
  `;

  return await Print.printToFileAsync({
    html,
    width: 100,  // Match the @page size
    margins: { left: 2, right: 2, top: 2, bottom: 2 },
    orientation: 'portrait'
  });
};

  // Share last invoice PDF
  const handleShareInvoice = async () => {
    if (!lastInvoiceUri) return;

    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert("Sharing not available on this device");
        return;
      }

      await Sharing.shareAsync(lastInvoiceUri, {
        mimeType: "application/pdf",
        dialogTitle: "Share Invoice",
        UTI: "com.adobe.pdf",
      });
    } catch (error) {
      Alert.alert("Error", "Failed to share invoice");
      console.error("Sharing error:", error);
    }
  };

  // Print invoice to Bluetooth POS printer
 const handlePrintInvoice = async () => {
  setPrinting(true);
  try {
    const { rows: calculatedRows, subtotal, cgstAmount, sgstAmount, totalAmount } = calculateTotals();

    // Printer setup
    await BluetoothEscposPrinter.printerAlign(BluetoothEscposPrinter.ALIGN.CENTER);
    await BluetoothEscposPrinter.setFontSize(2);
    await BluetoothEscposPrinter.printText(`${vendorName}\n\n`);
    await BluetoothEscposPrinter.setFontSize(1);
    
    if (vendorDesc) {
      await BluetoothEscposPrinter.printText(`${vendorDesc}\n`);
    }
    
    await BluetoothEscposPrinter.printText("------------------------------\n");
    await BluetoothEscposPrinter.printerAlign(BluetoothEscposPrinter.ALIGN.LEFT);
    
    // Invoice Info
    await BluetoothEscposPrinter.printText(`Invoice#: ${invoiceNumber}\n`);
    await BluetoothEscposPrinter.printText(`Date: ${date}\n`);
    await BluetoothEscposPrinter.printText(`Customer: ${customerName || "Walk-in"}\n`);
    await BluetoothEscposPrinter.printText(`Mobile: ${customerMobile || ""}\n`);
    await BluetoothEscposPrinter.printText("------------------------------\n");
    
    // Items
    for (const row of calculatedRows) {
      await BluetoothEscposPrinter.printText(`${getProductName(row.productId)}\n`);
      await BluetoothEscposPrinter.printText(`HSN: ${row.hsn}\n`);
      await BluetoothEscposPrinter.printText(
        `Qty: ${row.quantity} x ₹${row.rate}\n` +
        `Taxable: ₹${row.taxableValue.toFixed(2)}\n` +
        `GST ${row.gstRate}%: ₹${(row.cgst + row.sgst).toFixed(2)}\n` +
        `Total: ₹${row.total.toFixed(2)}\n\n`
      );
    }

    // Totals
    await BluetoothEscposPrinter.printText("------------------------------\n");
    await BluetoothEscposPrinter.printColumns(
      ["Subtotal", `₹${subtotal.toFixed(2)}`],
      [12, 12],
      [BluetoothEscposPrinter.ALIGN.LEFT, BluetoothEscposPrinter.ALIGN.RIGHT]
    );
    await BluetoothEscposPrinter.printColumns(
      ["CGST", `₹${cgstAmount.toFixed(2)}`],
      [12, 12],
      [BluetoothEscposPrinter.ALIGN.LEFT, BluetoothEscposPrinter.ALIGN.RIGHT]
    );
    await BluetoothEscposPrinter.printColumns(
      ["SGST", `₹${sgstAmount.toFixed(2)}`],
      [12, 12],
      [BluetoothEscposPrinter.ALIGN.LEFT, BluetoothEscposPrinter.ALIGN.RIGHT]
    );
    await BluetoothEscposPrinter.printText("------------------------------\n");
    await BluetoothEscposPrinter.printColumns(
      ["GRAND TOTAL", `₹${totalAmount.toFixed(2)}`],
      [12, 12],
      [BluetoothEscposPrinter.ALIGN.LEFT, BluetoothEscposPrinter.ALIGN.RIGHT]
    );
    
    // Footer
    await BluetoothEscposPrinter.printerAlign(BluetoothEscposPrinter.ALIGN.CENTER);
    await BluetoothEscposPrinter.printText("\nThank you for your purchase!\n");
    await BluetoothEscposPrinter.printText("\n\n\n"); // Feed paper

  } catch (error) {
    Alert.alert("Print Error", error.message || "Failed to print invoice");
  } finally {
    setPrinting(false);
  }
};


  // UI Components
  const RadioButton = ({ value, selected, onPress, label }) => (
    <TouchableOpacity style={styles.radioBtn} onPress={() => onPress(value)}>
      <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
        {selected && <View style={styles.radioInner} />}
      </View>
      <Text style={styles.radioLabel}>{label}</Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.invoiceContainer}>
          {/* Invoice Preview Section */}
          <View style={styles.invoiceHeader}>
            <Text style={styles.invoiceTitle}>{vendorName}</Text>
            {vendorDesc ? (
              <Text
                style={{
                  textAlign: "center",
                  color: "#7f8c8d",
                  marginBottom: 4,
                }}
              >
                {vendorDesc}
              </Text>
            ) : null}
            <View style={styles.invoiceHeaderRow}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text>Invoice Number: {invoiceNumber}</Text>
              </View>
              <Text>Date: {date}</Text>
            </View>
            <View style={styles.customerInfo}>
              <Text>Customer: {customerName || "Walk-in Customer"}</Text>
              <Text>Mobile: {customerMobile || ""}</Text>
            </View>
          </View>

          {/* Invoice Items Table */}
          <View style={styles.invoiceTable}>
            <View style={styles.tableHeader}>
              <Text style={styles.th}>#</Text>
              <Text style={styles.th}>Item</Text>
              <Text style={styles.th}>Price</Text>
              <Text style={styles.th}>Qty</Text>
              <Text style={styles.th}>Total</Text>
            </View>

            {rows.map((row, idx) => (
              <View style={styles.tableRow} key={idx}>
                <Text style={styles.td}>{idx + 1}</Text>
                <Text style={styles.td}>{getProductName(row.productId)}</Text>
                <Text style={styles.td}>
                  {row.rate && !isNaN(Number(row.rate))
                    ? `₹${parseFloat(row.rate).toFixed(2)}`
                    : ""}
                </Text>
                <Text style={styles.td}>
                  {row.quantity && !isNaN(Number(row.quantity))
                    ? row.quantity
                    : ""}
                </Text>
                <Text style={styles.td}>
                  {row.quantity &&
                  row.rate &&
                  !isNaN(Number(row.quantity)) &&
                  !isNaN(Number(row.rate))
                    ? `₹${(Number(row.quantity) * Number(row.rate)).toFixed(2)}`
                    : ""}
                </Text>
              </View>
            ))}

            {/* Totals Section */}
            <View style={styles.totalsContainer}>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Subtotal:</Text>
                <Text style={styles.totalValue}>₹{subtotal.toFixed(2)}</Text>
              </View>
              {billType === "GST" && (
                <>
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>
                      CGST:
                    </Text>
                    <Text style={styles.totalValue}>
                      ₹{cgstAmount.toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>
                      SGST:
                    </Text>
                    <Text style={styles.totalValue}>
                      ₹{sgstAmount.toFixed(2)}
                    </Text>
                  </View>
                </>
              )}
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Grand Total:</Text>
                <Text style={styles.totalValue}>₹{totalAmount.toFixed(2)}</Text>
              </View>
            </View>
          </View>

          {/* Form Section */}
          <View style={styles.formContainer}>
            <View style={styles.radioGroup}>
              <RadioButton
                value="GST"
                selected={billType === "GST"}
                onPress={setBillType}
                label="GST"
              />
              <RadioButton
                value="Non-GST"
                selected={billType === "Non-GST"}
                onPress={setBillType}
                label="Non-GST"
              />
            </View>

            {isNewUser && !isInitialSetupDone && (
  <View style={styles.serialInputContainer}>
    <Text style={styles.serialInputLabel}>
      Enter Starting Serial Number for {currentFinancialYear}
    </Text>
    <TextInput
      style={styles.serialInput}
      value={initialSerialInput}
      onChangeText={(text) => {
        const numericValue = text.replace(/[^0-9]/g, "");
        setInitialSerialInput(numericValue);
      }}
      keyboardType="numeric"
      placeholder="001"
      maxLength={3}
    />
    <Text style={styles.serialHelpText}>
      This will be your first invoice number for this financial year
    </Text>
  </View>
)}

            <TextInput
              style={styles.input}
              placeholder="Customer Mobile"
              value={customerMobile}
              onChangeText={setCustomerMobile}
              keyboardType="phone-pad"
            />

            <TextInput
              style={styles.input}
              placeholder="Customer Name"
              value={customerName}
              onChangeText={setCustomerName}
            />

            {rows.map((row, idx) => (
              <View key={idx} style={{ marginBottom: 12 }}>
  {/* First line: Category and Product */}
  <View style={[styles.rowContainer, { marginBottom: 4 }]}>
    {/* Category Input with dropdown */}
    <View style={{ flex: 1 }}>
      <TextInput
        style={[styles.input, { marginBottom: 0, padding: 8, fontSize: 15 }]}
        placeholder="Search or Add Category"
        value={categorySearch[idx] ?? ""}
        onChangeText={(txt) => {
          setCategorySearch((cs) => ({ ...cs, [idx]: txt }));
          setShowCategoryDropdown((sd) => ({ ...sd, [idx]: true }));
        }}
        onFocus={() => setShowCategoryDropdown((sd) => ({ ...sd, [idx]: true }))}
        onBlur={() =>
          setTimeout(() => setShowCategoryDropdown((sd) => ({ ...sd, [idx]: false })), 200)
        }
      />
      {/* Updated Category Dropdown */}
      {showCategoryDropdown[idx] && (
        <View style={styles.dropdown}>
          {getFilteredCategories(idx).length > 0 &&
            getFilteredCategories(idx).map((item) => (
              <TouchableOpacity
                key={item._id}
                onPress={() => {
                  handleRowChange(idx, "categoryId", item._id);
                  setCategorySearch((cs) => ({ ...cs, [idx]: item.category_name }));
                  setShowCategoryDropdown((sd) => ({ ...sd, [idx]: false }));
                  setProductSearch((ps) => ({ ...ps, [idx]: "" }));
                }}
                style={styles.dropdownItem}
              >
                <Text>{item.category_name}</Text>
              </TouchableOpacity>
            ))}

          {/* Show Add Category only if no exact match */}
          {categorySearch[idx] &&
            !invoiceCategories.some(
              (c) =>
                c.category_name.toLowerCase().trim() ===
                categorySearch[idx].toLowerCase().trim()
            ) && (
              <TouchableOpacity
                onPress={() => {
                  setPendingCategoryRow(idx);
                  setNewCategoryName(categorySearch[idx]);
                  setShowAddCategoryModal(true);
                  setShowCategoryDropdown((sd) => ({ ...sd, [idx]: false }));
                }}
                style={styles.dropdownItem}
              >
                <Text style={{ color: "#3498db" }}>
                  + Add "{categorySearch[idx]}"
                </Text>
              </TouchableOpacity>
            )}
        </View>
      )}
    </View>

    {/* Product Input with dropdown */}
    <View style={{ flex: 1 }}>
      <TextInput
        style={[styles.input, { marginBottom: 0, padding: 8, fontSize: 15 }]}
        placeholder="Search or Add Product"
        value={productSearch[idx] ?? ""}
        onChangeText={(txt) => {
          setProductSearch((ps) => ({ ...ps, [idx]: txt }));
          setShowProductDropdown((sd) => ({ ...sd, [idx]: true }));
        }}
        editable={!!row.categoryId}
        onFocus={() => setShowProductDropdown((sd) => ({ ...sd, [idx]: true }))}
        onBlur={() =>
          setTimeout(() => setShowProductDropdown((sd) => ({ ...sd, [idx]: false })), 200)
        }
      />
      {/* Updated Product Dropdown */}
      {showProductDropdown[idx] && row.categoryId && (
        <View style={styles.dropdown}>
          {getFilteredProducts(idx, row.categoryId).length > 0 &&
            getFilteredProducts(idx, row.categoryId).map((item) => (
              <TouchableOpacity
                key={item._id}
                onPress={() => {
                  handleRowChange(idx, "productId", item._id);
                  setProductSearch((ps) => ({ ...ps, [idx]: item.product_name }));
                  setShowProductDropdown((sd) => ({ ...sd, [idx]: false }));
                }}
                style={styles.dropdownItem}
              >
                <Text>{item.product_name}</Text>
              </TouchableOpacity>
            ))}

          {/* Show Add Product only if no exact match in selected category */}
          {productSearch[idx] &&
            !products.some(
              (p) =>
                p.category_ID === row.categoryId &&
                p.product_name.toLowerCase().trim() ===
                  productSearch[idx].toLowerCase().trim()
            ) && (
              <TouchableOpacity
                onPress={() => {
                  setPendingProductRow(idx);
                  setNewProductName(productSearch[idx]);
                  setShowAddProductModal(true);
                  setShowProductDropdown((sd) => ({ ...sd, [idx]: false }));
                }}
                style={styles.dropdownItem}
              >
                <Text style={{ color: "#3498db" }}>
                  + Add "{productSearch[idx]}"
                </Text>
              </TouchableOpacity>
            )}
        </View>
      )}
    </View>
  </View>

  {/* Second line: Qty, Price, Remove */}
  <View style={[styles.rowContainer, { marginBottom: 0 }]}>
    <TextInput
      style={styles.numberInput}
      placeholder="Qty"
      value={row.quantity}
      onChangeText={(v) =>
        handleRowChange(idx, "quantity", v.replace(/[^0-9]/g, ""))
      }
      keyboardType="numeric"
    />

    <TextInput
      style={styles.numberInput}
      placeholder="Price"
      value={row.rate}
      onChangeText={(v) =>
        handleRowChange(idx, "rate", v.replace(/[^0-9.]/g, ""))
      }
      keyboardType="decimal-pad"
    />

    <TouchableOpacity onPress={() => removeRow(idx)} style={styles.removeButton}>
      <Text style={styles.buttonText}>−</Text>
    </TouchableOpacity>
  </View>
</View>

            ))}

            <TouchableOpacity onPress={addRow} style={styles.addButton}>
              <Text style={styles.buttonText}>+ Add Item</Text>
            </TouchableOpacity>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                marginBottom: 12,
              }}
            >

               <Button
                title="Submit"
                onPress={handleSubmitInvoice}
                
              />
              
              <TouchableOpacity
                onPress={handleShareInvoice}
                disabled={!shareEnabled}
                style={{
                  opacity: shareEnabled ? 1 : 0.4,
                  backgroundColor: "#3498db",
                  borderRadius: 6,
                  padding: 10,
                  marginLeft: 4,
                }}
              >
                <MaterialIcons name="share" size={24} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handlePrintInvoice}
                disabled={printing}
                style={{
                  opacity: printing ? 0.4 : 1,
                  backgroundColor: "#27ae60",
                  borderRadius: 6,
                  padding: 10,
                  marginLeft: 4,
                }}
              >
                <MaterialIcons name="print" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Add Category Modal */}
            <Modal
              visible={showAddCategoryModal}
              transparent
              animationType="slide"
              onRequestClose={() => setShowAddCategoryModal(false)}
            >
              <View
                style={{
                  flex: 1,
                  backgroundColor: "rgba(0,0,0,0.3)",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <View
                  style={{
                    backgroundColor: "#fff",
                    padding: 24,
                    borderRadius: 12,
                    width: "80%",
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 18,
                      fontWeight: "bold",
                      marginBottom: 12,
                    }}
                  >
                    Add New Category
                  </Text>
                  <Text style={{ marginBottom: 8 }}>
                    Name:{" "}
                    <Text style={{ fontWeight: "bold" }}>
                      {newCategoryName}
                    </Text>
                  </Text>
                  <Button
                    title={addingCategory ? "Adding..." : "Add Category"}
                    onPress={() =>
                      handleAddCategoryFromPicker(
                        pendingCategoryRow,
                        newCategoryName
                      )
                    }
                    disabled={addingCategory}
                  />
                  <Button
                    title="Cancel"
                    onPress={() => setShowAddCategoryModal(false)}
                    color="#888"
                  />
                </View>
              </View>
            </Modal>

            {/* Add Product Modal */}
          <Modal
  visible={showAddProductModal}
  transparent
  animationType="slide"
  onRequestClose={() => setShowAddProductModal(false)}
>
  <View style={{ 
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
  }}>
    <View style={{ 
  backgroundColor: "#fff",
  padding: 24,
  borderRadius: 12,
  width: "80%",
  alignItems: "center",
}}>
  <Text style={{ 
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
  }}>
    Add New Product
  </Text>
  <TextInput
  style={[styles.input, { width: "100%", marginBottom: 12 }]}
  placeholder="Product Name *"
  value={newProductName}
  onChangeText={setNewProductName}
/>

<TextInput
  style={[styles.input, { width: "100%", marginBottom: 12 }]}
  placeholder="HSN Number (optional)"
  value={newHsnNumber}
  onChangeText={(text) => {
    setNewHsnNumber(text);
    if (!text) setNewGstRate(''); // clear GST rate if HSN is removed
  }}
  keyboardType="number-pad"
  maxLength={8}
/>

{/* Conditionally show GST Rate if HSN is entered */}
{newHsnNumber && (
  <>
    <TextInput
      style={[styles.input, { width: "100%", marginBottom: 4 }]}
      placeholder="GST Rate (%)"
      value={newGstRate}
      onChangeText={(text) => setNewGstRate(text.replace(/[^0-9]/g, ""))}
      keyboardType="numeric"
      maxLength={3}
    />
    {newGstRate ? (
      <Text style={{ fontSize: 12, color: '#666', marginBottom: 12 }}>
        GST {newGstRate}% = CGST {(newGstRate / 2).toFixed(1)}% + SGST {(newGstRate / 2).toFixed(1)}%
      </Text>
    ) : null}
  </>
)}

<TextInput
  style={[styles.input, { width: "100%", marginBottom: 12 }]}
  placeholder="Price *"
  value={rows[pendingProductRow]?.rate || ""}
  onChangeText={(value) => {
    const updatedRows = [...rows];
    updatedRows[pendingProductRow].rate = value.replace(/[^0-9.]/g, "");
    setRows(updatedRows);
  }}
  keyboardType="decimal-pad"
/>


  <Button
    title={addingProduct ? "Adding..." : "Add Product"}
    onPress={() => {
      // Validate only if HSN is provided
      if (newHsnNumber) {
        if (!newHsnNumber.match(/^\d{6,8}$/)) {
          Alert.alert("Error", "HSN must be 6-8 digits");
          return;
        }
        if (!newGstRate || isNaN(parseFloat(newGstRate))) {
          Alert.alert("Error", "Please enter valid GST Rate when providing HSN");
          return;
        }
        const gstRate = parseFloat(newGstRate);
        if (gstRate < 0 || gstRate > 100) {
          Alert.alert("Error", "GST Rate must be between 0 and 100");
          return;
        }
      }

      handleAddProductFromPicker(
        pendingProductRow,
        rows[pendingProductRow]?.categoryId,
        newProductName
      );
    }}
    disabled={addingProduct || !newProductName}
  />
  
  <Button
    title="Cancel"
    onPress={() => setShowAddProductModal(false)}
    color="#888"
  />
</View>
  </View>
</Modal>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
   serialInputContainer: {
    marginBottom: 20,
    backgroundColor: "#f8f9fa",
    padding: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#3498db",
  },
  serialInputLabel: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 10,
    color: "#2c3e50",
  },
  serialInput: {
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  serialHelpText: {
    fontSize: 12,
    color: "#7f8c8d",
  },
  scrollContainer: {
    flexGrow: 1,
    padding: 16,
    backgroundColor: "#f8f9fa",
  },
  invoiceContainer: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  invoiceHeader: {
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    paddingBottom: 16,
    marginBottom: 16,
  },
  invoiceTitle: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    color: "#2c3e50",
    marginBottom: 8,
  },
  invoiceHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  customerInfo: {
    marginTop: 12,
    padding: 8,
    backgroundColor: "#f8f9fa",
    borderRadius: 8,
  },
  invoiceTable: {
    marginVertical: 16,
  },
  tableHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#3498db",
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  th: {
    color: "#ffffff",
    fontWeight: "bold",
    flex: 1,
    textAlign: "center",
  },
  tableRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  td: {
    flex: 1,
    textAlign: "center",
    color: "#2c3e50",
  },
  totalsContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: "#f8f9fa",
    borderRadius: 8,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 4,
  },
  totalLabel: {
    color: "#7f8c8d",
  },
  totalValue: {
    color: "#2c3e50",
    fontWeight: "500",
  },
  formContainer: {
    marginTop: 24,
  },
  radioGroup: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 16,
    gap: 20,
  },
  radioBtn: {
    flexDirection: "row",
    alignItems: "center",
  },
  radioOuter: {
    height: 20,
    width: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#95a5a6",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  radioOuterSelected: {
    borderColor: "#3498db",
  },
  radioInner: {
    height: 12,
    width: 12,
    borderRadius: 6,
    backgroundColor: "#3498db",
  },
  input: {
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    backgroundColor: "#ffffff",
  },
  rowContainer: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
    alignItems: "center",
  },
  picker: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 8,
    backgroundColor: "#ffffff",
  },
  numberInput: {
    width: 60,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 8,
    padding: 8,
    textAlign: "center",
    backgroundColor: "#ffffff",
  },
  removeButton: {
    backgroundColor: "#e74c3c",
    borderRadius: 6,
    padding: 8,
    minWidth: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  addButton: {
    backgroundColor: "#2ecc71",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
    marginVertical: 16,
  },
  buttonText: {
    color: "#ffffff",
    fontWeight: "bold",
  },
  dropdown: {
    position: "absolute",
    top: 48,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 8,
    zIndex: 100,
    maxHeight: 180,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 4,
  },
  dropdownItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
   tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  th: {
    flex: 1,
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
    paddingHorizontal: 2,
  },
  td: {
    flex: 1,
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
  totalsContainer: {
    marginTop: 10,
    padding: 8,
    backgroundColor: '#f8f8f8',
    borderRadius: 4,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 2,
  }
});
