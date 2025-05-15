import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Dimensions } from 'react-native';
import { PieChart } from 'react-native-chart-kit';
import AsyncStorage from '@react-native-async-storage/async-storage';

const screenWidth = Dimensions.get('window').width;

interface ReportSectionProps {
    userId: string;
}

interface ReportRow {
    key: string;
    date: string;
    fy: string;
    category: string;
    product: string;
    rate: string;
    qty: number;
    amount: string;
    hsn: string;
    cgst: string;
    sgst: string;
    total: string;
    invoiceTotal: string;
    gstRate: number;
}

interface PieChartData {
    name: string;
    value: number;
    color: string;
    legendFontColor: string;
    legendFontSize: number;
}

const ReportSection = ({ userId }: ReportSectionProps) => {
    const [reportData, setReportData] = useState<ReportRow[]>([]);
    const [pieData, setPieData] = useState<PieChartData[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentFY, setCurrentFY] = useState('');

    const getFinancialYear = (dateString: string | Date) => {
        const date = new Date(dateString);
        const year = date.getFullYear();
        return date.getMonth() + 1 >= 4 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
    };

    const processReportData = (invoices: any[]) => {
        const currentFY = getFinancialYear(new Date());
        setCurrentFY(currentFY);

        const allRows: ReportRow[] = [];
        const categorySales: Record<string, number> = {};

        invoices.forEach(invoice => {
            const invoiceFY = getFinancialYear(invoice.date);

            invoice.rows.forEach(row => {
                const productName = row.productName || 'N/A';
                const categoryName = row.categoryName || 'N/A';
                const hsnCode = row.hsn || 'N/A';
                const gstRate = row.gstRate || 0;

                const quantity = parseFloat(row.quantity) || 0;
                const rate = parseFloat(row.rate) || 0;
                const amount = quantity * rate;

                const cgstPercentage = gstRate / 2;
                const sgstPercentage = gstRate / 2;
                const cgst = amount * (cgstPercentage / 100);
                const sgst = amount * (sgstPercentage / 100);

                const total = amount + cgst + sgst;
                const invoiceTotal = parseFloat(invoice.totalAmount) || 0;

                allRows.push({
                    key: `${invoice._id}-${row._id}`,
                    date: new Date(invoice.date).toLocaleDateString(),
                    fy: invoiceFY,
                    category: categoryName,
                    product: productName,
                    rate: rate.toFixed(2),
                    qty: quantity,
                    amount: amount.toFixed(2),
                    hsn: hsnCode,
                    cgst: cgst.toFixed(2),
                    sgst: sgst.toFixed(2),
                    total: total.toFixed(2),
                    invoiceTotal: invoiceTotal.toFixed(2),
                    gstRate
                });

                if (invoiceFY === currentFY) {
                    categorySales[categoryName] = (categorySales[categoryName] || 0) + total;
                }
            });
        });

        const pieData = Object.entries(categorySales)
            .filter(([_, value]) => !isNaN(value) && value > 0)
            .map(([name, value]) => ({
                name,
                value,
                color: `#${Math.floor(Math.random() * 16777215).toString(16)}`,
                legendFontColor: '#7F7F7F',
                legendFontSize: 15
            }));

        setReportData(allRows);
        setPieData(pieData);
    };

    const fetchReportData = useCallback(async () => {
        try {
            const token = await AsyncStorage.getItem('authToken');
            const response = await fetch(`http://192.168.1.5:5000/invoices?vendor_ID=${userId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            const data = await response.json();
            processReportData(data);
            setLoading(false);
        } catch (error) {
            console.error('Error fetching report data:', error);
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        let ws: WebSocket;

        const setupWebSocket = async () => {
            try {
                const token = await AsyncStorage.getItem('authToken');
                ws = new WebSocket(`ws://192.168.1.5:5000/ws/invoices?token=${token}&vendor_ID=${userId}`);

                ws.onmessage = (event) => {
                    const message = JSON.parse(event.data);
                    if (['invoice-added', 'invoice-updated', 'invoice-deleted'].includes(message.type)) {
                        fetchReportData();
                    }
                };

                ws.onerror = (error) => {
                    console.error('WebSocket error:', error);
                };

                ws.onclose = () => {
                    console.log('WebSocket connection closed');
                };
            } catch (error) {
                console.error('WebSocket setup error:', error);
            }
        };

        fetchReportData();
        setupWebSocket();

        return () => {
            if (ws) {
                ws.close();
            }
        };
    }, [fetchReportData, userId]);

    if (loading) {
        return <ActivityIndicator size="large" style={styles.loader} />;
    }

    return (
        <ScrollView style={styles.container}>
            <Text style={styles.header}>Sales Report ({currentFY})</Text>

            <PieChart
                data={pieData}
                width={screenWidth}
                height={220}
                chartConfig={{
                    backgroundColor: '#ffffff',
                    backgroundGradientFrom: '#ffffff',
                    backgroundGradientTo: '#ffffff',
                    decimalPlaces: 2,
                    color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                    labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                }}
                accessor="value"
                backgroundColor="transparent"
                paddingLeft="15"
                absolute
                style={styles.chart}
            />

            <ScrollView horizontal>
                <View>
                    <View style={styles.tableHeader}>
                        {['S/N', 'Date', 'FY', 'Category', 'Product', 'Rate', 'Qty', 'Amount',
                            'HSN', 'CGST%', 'CGST Amt', 'SGST%', 'SGST Amt', 'Total', 'Invoice Amt']
                            .map((header, idx) => (
                                <Text key={idx} style={styles.headerCell}>{header}</Text>
                            ))}
                    </View>
                    {reportData.map((row, index) => (
                        <View key={row.key} style={styles.tableRow}>
                            <Text style={styles.cell}>{index + 1}</Text>
                            <Text style={styles.cell}>{row.date}</Text>
                            <Text style={styles.cell}>{row.fy}</Text>
                            <Text style={styles.cell}>{row.category}</Text>
                            <Text style={styles.cell}>{row.product}</Text>
                            <Text style={styles.cell}>{row.rate}</Text>
                            <Text style={styles.cell}>{row.qty}</Text>
                            <Text style={styles.cell}>{row.amount}</Text>
                            <Text style={styles.cell}>{row.hsn}</Text>
                            <Text style={styles.cell}>{row.gstRate > 0 ? `${row.gstRate / 2}%` : 'N/A'}</Text>
                            <Text style={styles.cell}>{row.cgst}</Text>
                            <Text style={styles.cell}>{row.gstRate > 0 ? `${row.gstRate / 2}%` : 'N/A'}</Text>
                            <Text style={styles.cell}>{row.sgst}</Text>
                            <Text style={styles.cell}>{row.total}</Text>
                            <Text style={styles.cell}>{row.invoiceTotal}</Text>
                        </View>
                    ))}
                </View>
            </ScrollView>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 15
    },
    loader: {
        marginTop: 50
    },
    header: {
        fontSize: 22,
        fontWeight: 'bold',
        textAlign: 'center',
        marginVertical: 15
    },
    chart: {
        marginVertical: 8,
        borderRadius: 16,
        backgroundColor: '#ffffff',
        padding: 10,
    },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: '#f8f9fa',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderColor: '#dee2e6'
    },
    headerCell: {
        width: 150,
        padding: 8,
        fontWeight: 'bold',
        textAlign: 'center'
    },
    tableRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderColor: '#dee2e6',
        paddingVertical: 8
    },
    cell: {
        width: 150,
        padding: 8,
        textAlign: 'center'
    }
});

export default ReportSection;
