import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet, TouchableOpacity, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite'; 
import { useFocusEffect } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
// @ts-ignore
import { formatDate, getDisplayDate, handleDeleteRange, handlePrintRange } from '../utils/actions';

const initialCategories = ['Juice', 'Staff', 'Bakery', 'Stationery', 'Kitchen', 'Puffs', 'Others'];

export default function OutgoingScreen() {
  const db = useSQLiteContext(); 

  const [categories, setCategories] = useState<string[]>(initialCategories);
  const [newCategoryName, setNewCategoryName] = useState('');
  const defaultExpenses = initialCategories.reduce((acc, cat) => ({ ...acc, [cat]: [] }), {});
  const [expenses, setExpenses] = useState<Record<string, any[]>>(defaultExpenses);

  const [fromDate, setFromDate] = useState(new Date());
  const [toDate, setToDate] = useState(new Date());
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);

  const fromDateStr = formatDate(fromDate);
  const toDateStr = formatDate(toDate);
  const isSingleDate = fromDateStr === toDateStr;
  
  const [dashboardStats, setDashboardStats] = useState<Record<string, any>>({});
  const [totalSpent, setTotalSpent] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);

  const loadAllData = useCallback(async () => {
    try {
      const rawResults = await db.getAllAsync<any>(
        'SELECT date, category, item_name, amount FROM expenses WHERE date >= ? AND date <= ? ORDER BY date DESC', 
        fromDateStr || '', toDateStr || ''
      );

      let grandTotal = 0;
      const groupedData: Record<string, any> = {};

      rawResults.forEach(row => {
        grandTotal += row.amount;
        if (!groupedData[row.category]) groupedData[row.category] = { total: 0, items: [] };
        groupedData[row.category].total += row.amount;
        groupedData[row.category].items.push({ name: row.item_name, amount: row.amount, date: row.date });
      });

      setDashboardStats(groupedData);
      setTotalSpent(grandTotal);

      if (isSingleDate) {
        const results = await db.getAllAsync<any>(
          'SELECT category, item_name, amount FROM expenses WHERE date = ?', 
          fromDateStr || ''
        );
        const loadedExpenses: Record<string, any[]> = initialCategories.reduce((acc, cat) => ({ ...acc, [cat]: [] }), {});
        const loadedCategories = [...initialCategories];

        results.forEach(row => {
          if (!loadedExpenses[row.category]) {
            loadedExpenses[row.category] = [];
            if (!loadedCategories.includes(row.category)) loadedCategories.push(row.category);
          }
          loadedExpenses[row.category].push({ name: row.item_name, amount: row.amount.toString() });
        });
        setCategories(loadedCategories); setExpenses(loadedExpenses);
      } else {
        setExpenses(prev => Object.keys(prev).reduce((acc, cat) => ({ ...acc, [cat]: [] }), {}));
      }
    } catch (error) { console.error("Load Data Error:", error); }
  }, [db, fromDateStr, toDateStr, isSingleDate]);

  useEffect(() => { loadAllData(); }, [loadAllData]);
  useFocusEffect(useCallback(() => { loadAllData(); }, [loadAllData]));

  const handleAddItem = (category: string) => setExpenses(prev => ({ ...prev, [category]: [...prev[category], { name: '', amount: '' }] }));
  
  const handleUpdateItem = (category: string, index: number, field: string, value: string) => {
    const updated = [...expenses[category]];
    updated[index][field] = value;
    setExpenses(prev => ({ ...prev, [category]: updated }));
  };
  
  const handleAddCategory = () => {
    if (newCategoryName.trim() !== '') {
      setCategories([...categories, newCategoryName]); 
      setExpenses(prev => ({ ...prev, [newCategoryName]: [] })); 
      setNewCategoryName('');
    }
  };

  const handleSave = async () => {
    if (!isSingleDate) return; 
    try {
      await db.runAsync('DELETE FROM expenses WHERE date = ?', fromDateStr || '');
      
      let itemsSaved = 0;
      for (const cat of categories) {
        if (!expenses[cat]) continue;
        for (const item of expenses[cat]) {
          const amount = Number(item.amount) || 0;
          const name = item.name || '';
          if (name && amount > 0) {
            await db.runAsync(
              'INSERT INTO expenses (date, category, item_name, amount) VALUES (?, ?, ?, ?)', 
              fromDateStr || '', cat || '', name || '', amount
            );
            itemsSaved++;
          }
        }
      }
      Alert.alert("Success! 💸", `Saved ${itemsSaved} items for ${getDisplayDate(fromDateStr)}.`);
      await loadAllData(); 
    } catch (error: any) { Alert.alert("System Error", String(error?.message || error)); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={90}>
      <ScrollView style={styles.container}>
        <View style={styles.dashboard}>
          <View style={styles.dateFilterRow}>
            <TouchableOpacity style={styles.actionBtnLeft} onPress={() => handleDeleteRange(db, 'expenses', fromDateStr, toDateStr, loadAllData)}>
              <Ionicons name="trash-outline" size={28} color="#ff6b6b" />
            </TouchableOpacity>

            <View style={styles.dateBox}>
              <Text style={styles.dateLabel}>From</Text>
              <TouchableOpacity style={styles.datePickerBtn} onPress={() => setShowFromPicker(true)}><Text style={styles.datePickerText}>{getDisplayDate(fromDateStr)}</Text></TouchableOpacity>
              {showFromPicker && <DateTimePicker value={fromDate} mode="date" display="default" onChange={(e: any, d?: Date) => { setShowFromPicker(false); if (d) setFromDate(d); }} />}
            </View>

            <TouchableOpacity style={styles.printBtn} onPress={() => handlePrintRange('expenses', fromDateStr, toDateStr, dashboardStats, totalSpent)}>
              <Ionicons name="print-outline" size={24} color="#4dabf7" />
            </TouchableOpacity>

            <View style={styles.dateBox}>
              <Text style={styles.dateLabel}>To</Text>
              <TouchableOpacity style={styles.datePickerBtn} onPress={() => setShowToPicker(true)}><Text style={styles.datePickerText}>{getDisplayDate(toDateStr)}</Text></TouchableOpacity>
              {showToPicker && <DateTimePicker value={toDate} mode="date" display="default" onChange={(e: any, d?: Date) => { setShowToPicker(false); if (d) setToDate(d); }} />}
            </View>
          </View>

          <TouchableOpacity style={styles.totalBox} activeOpacity={0.7} onPress={() => setIsExpanded(!isExpanded)}>
            <Text style={styles.totalLabel}>Total Outgoing (Selected Dates)</Text>
            <View style={styles.totalAmountRow}><Text style={styles.totalValue}>₹{totalSpent}</Text><Text style={styles.dropdownIcon}>{isExpanded ? '▲' : '▼'}</Text></View>
          </TouchableOpacity>

          {isExpanded && (
            <View style={styles.expandedContainer}>
              {Object.keys(dashboardStats).length === 0 ? <Text style={styles.noDataText}>No expenses logged for these dates.</Text> : (
                Object.keys(dashboardStats).map((cat, index) => (
                  <View key={index} style={styles.expandedCategoryBlock}>
                    <View style={styles.expandedCategoryHeader}><Text style={styles.statCategory}>{cat}</Text><Text style={styles.statAmount}>₹{dashboardStats[cat].total}</Text></View>
                    {dashboardStats[cat].items.map((item: any, i: number) => (
                      <View key={i} style={styles.expandedItemRow}>
                        <Text style={styles.expandedItemName}>• {item.name} {(!isSingleDate) && <Text style={styles.dateTag}> ({getDisplayDate(item.date)})</Text>}</Text>
                        <Text style={styles.expandedItemAmount}>₹{item.amount}</Text>
                      </View>
                    ))}
                  </View>
                ))
              )}
            </View>
          )}
        </View>

        {isSingleDate ? (
          <>
            {categories.map((cat) => (
              <View key={cat} style={styles.card}>
                <Text style={styles.cardTitle}>{cat}</Text>
                {expenses[cat] && expenses[cat].map((item, index) => (
                  <View key={index} style={styles.itemRow}>
                    <TextInput 
                      style={[styles.input, { flex: 2, marginRight: 10, textAlign: 'left' }]} placeholder="Item Name" 
                      value={item.name} autoCorrect={false} autoComplete="off" spellCheck={false} onChangeText={(val) => handleUpdateItem(cat, index, 'name', val)} 
                    />
                    <TextInput 
                      style={[styles.input, { flex: 1 }]} keyboardType="number-pad" importantForAutofill="no" autoCorrect={false} autoComplete="off" spellCheck={false} placeholder="₹ Amount" 
                      value={item.amount} onChangeText={(val) => handleUpdateItem(cat, index, 'amount', val)} 
                    />
                  </View>
                ))}
                <TouchableOpacity style={styles.addItemBtn} onPress={() => handleAddItem(cat)}><Text style={styles.addItemText}>+ Add Line Item</Text></TouchableOpacity>
              </View>
            ))}

            <View style={styles.newCategoryCard}>
              <Text style={styles.cardTitle}>Need a new category?</Text>
              <View style={styles.itemRow}>
                <TextInput 
                  style={[styles.input, { flex: 2, marginRight: 10, textAlign: 'left' }]} placeholder="New Category Name" 
                  value={newCategoryName} autoCorrect={false} autoComplete="off" spellCheck={false} onChangeText={setNewCategoryName} 
                />
                <TouchableOpacity style={styles.addCategoryBtn} onPress={handleAddCategory}><Text style={styles.addCategoryText}>+ Add</Text></TouchableOpacity>
              </View>
            </View>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}><Text style={styles.saveBtnText}>Save</Text></TouchableOpacity>
            <View style={{ height: 40 }} />
          </>
        ) : (
          <View style={styles.readOnlyBox}><Text style={styles.readOnlyText}>Select the same From and To date to add or edit expenses.</Text></View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f2f5', padding: 15 },
  dashboard: { backgroundColor: '#343a40', padding: 15, borderRadius: 10, marginBottom: 20 },
  dateFilterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10, alignItems: 'center' as any },
  dateBox: { flex: 1, marginHorizontal: 5 },
  dateLabel: { color: '#adb5bd', fontSize: 12, marginBottom: 5 },
  datePickerBtn: { backgroundColor: '#495057', borderRadius: 5, padding: 10, alignItems: 'center' },
  datePickerText: { color: 'white', fontWeight: 'bold' },
  actionBtnLeft: { paddingBottom: 5, paddingRight: 5, justifyContent: 'center' },
  printBtn: { padding: 5, justifyContent: 'center', alignItems: 'center' },
  totalBox: { alignItems: 'center', marginBottom: 5, paddingBottom: 10 },
  totalLabel: { color: '#adb5bd', fontSize: 14, marginBottom: 5 },
  totalAmountRow: { flexDirection: 'row', alignItems: 'center' },
  totalValue: { color: '#ff6b6b', fontSize: 28, fontWeight: 'bold' },
  dropdownIcon: { color: '#adb5bd', fontSize: 18, marginLeft: 10, paddingTop: 5 },
  expandedContainer: { backgroundColor: '#212529', padding: 10, borderRadius: 8, marginTop: 10 },
  noDataText: { color: '#adb5bd', textAlign: 'center', fontStyle: 'italic', paddingVertical: 10 },
  expandedCategoryBlock: { marginBottom: 15 },
  expandedCategoryHeader: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#495057', paddingBottom: 5, marginBottom: 5 },
  statCategory: { color: '#f8f9fa', fontSize: 16, fontWeight: 'bold' },
  statAmount: { color: '#ff6b6b', fontSize: 16, fontWeight: 'bold' },
  expandedItemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingLeft: 10, marginVertical: 2 },
  expandedItemName: { color: '#adb5bd', fontSize: 14 },
  dateTag: { color: '#6c757d', fontSize: 12, fontStyle: 'italic' },
  expandedItemAmount: { color: '#adb5bd', fontSize: 14 },
  card: { backgroundColor: 'white', padding: 15, borderRadius: 10, marginBottom: 15, elevation: 2 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10, color: '#333' },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  input: { borderBottomWidth: 1, borderColor: '#ccc', fontSize: 16, padding: 5, textAlign: 'right', color: '#000' },
  addItemBtn: { alignSelf: 'flex-start', marginTop: 10 },
  addItemText: { color: '#007bff', fontSize: 16, fontWeight: '600' },
  newCategoryCard: { backgroundColor: '#e9ecef', padding: 15, borderRadius: 10, marginBottom: 15, borderStyle: 'dashed', borderWidth: 1, borderColor: '#aaa' },
  addCategoryBtn: { backgroundColor: '#28a745', paddingHorizontal: 15, justifyContent: 'center', borderRadius: 5 },
  addCategoryText: { color: 'white', fontWeight: 'bold' },
  saveBtn: { backgroundColor: '#dc3545', padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  saveBtnText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  readOnlyBox: { padding: 20, alignItems: 'center', backgroundColor: '#e9ecef', borderRadius: 10, marginTop: 10 },
  readOnlyText: { color: '#6c757d', fontSize: 14, fontStyle: 'italic', textAlign: 'center' }
});