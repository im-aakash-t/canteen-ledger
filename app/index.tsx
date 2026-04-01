import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet, TouchableOpacity, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite'; 
import { useFocusEffect } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { formatDate, getDisplayDate, handleDeleteRange, handlePrintRange } from '../utils/actions';

const categories = ['Bakery', 'Stationery', 'Counter'];
const defaultState = {
  Bakery: { cash: '', gpay: '', bank_withdrawn: '' },
  Stationery: { cash: '', gpay: '', bank_withdrawn: '' },
  Counter: { cash: '', gpay: '', bank_withdrawn: '' }
};

export default function IncomingScreen() {
  const db = useSQLiteContext(); 

  const [incomeData, setIncomeData] = useState(defaultState);
  const [fromDate, setFromDate] = useState(new Date());
  const [toDate, setToDate] = useState(new Date());
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);

  const fromDateStr = formatDate(fromDate);
  const toDateStr = formatDate(toDate);
  const isSingleDate = fromDateStr === toDateStr;

  const [expandedCats, setExpandedCats] = useState({ Bakery: false, Stationery: false, Counter: false });
  const toggleExpand = (cat) => setExpandedCats(prev => ({ ...prev, [cat]: !prev[cat] }));

  const [grandTotals, setGrandTotals] = useState({ cash: 0, gpay: 0, bank: 0 });
  const [dashboardStatsRaw, setDashboardStatsRaw] = useState({});

  const loadAllData = useCallback(async () => {
    try {
      // 🛡️ Safe Object Binding
      const rawResults = await db.getAllAsync(
        'SELECT date, category, cash, gpay, bank_withdrawn FROM income WHERE date >= $fromDate AND date <= $toDate ORDER BY date DESC',
        { $fromDate: fromDateStr, $toDate: toDateStr }
      );

      let gCash = 0, gGpay = 0, gBank = 0;
      const summary = {
        Bakery: { cash: 0, gpay: 0, bank: 0, items: [] },
        Stationery: { cash: 0, gpay: 0, bank: 0, items: [] },
        Counter: { cash: 0, gpay: 0, bank: 0, items: [] }
      };

      rawResults.forEach(row => {
        const c = row.cash || 0; const g = row.gpay || 0; const b = row.bank_withdrawn || 0;
        gCash += c; gGpay += g; gBank += b;
        if (summary[row.category]) {
          summary[row.category].cash += c; summary[row.category].gpay += g; summary[row.category].bank += b;
          summary[row.category].items.push({ date: row.date, cash: c, gpay: g, bank: b });
        }
      });

      setGrandTotals({ cash: gCash, gpay: gGpay, bank: gBank });
      setDashboardStatsRaw(summary);

      if (isSingleDate) {
        // 🛡️ Safe Object Binding
        const results = await db.getAllAsync(
          'SELECT category, cash, gpay, bank_withdrawn FROM income WHERE date = $date', 
          { $date: fromDateStr }
        );
        const newIncomeData = JSON.parse(JSON.stringify(defaultState)); 
        results.forEach(row => {
          if (newIncomeData[row.category]) {
            newIncomeData[row.category].cash = row.cash ? row.cash.toString() : '';
            newIncomeData[row.category].gpay = row.gpay ? row.gpay.toString() : '';
            newIncomeData[row.category].bank_withdrawn = row.bank_withdrawn ? row.bank_withdrawn.toString() : '';
          }
        });
        setIncomeData(newIncomeData);
      } else {
        setIncomeData(JSON.parse(JSON.stringify(defaultState)));
      }
    } catch (error) { console.error("Load Data Error: ", error); }
  }, [db, fromDateStr, toDateStr, isSingleDate]);

  useEffect(() => { loadAllData(); }, [loadAllData]);
  useFocusEffect(useCallback(() => { loadAllData(); }, [loadAllData]));

  const handleInputChange = (category, field, value) => setIncomeData(prev => ({ ...prev, [category]: { ...prev[category], [field]: value } }));

  const handleSave = async () => {
    if (!isSingleDate) return;
    try {
      // 🛡️ Safe Object Binding
      await db.runAsync('DELETE FROM income WHERE date = $date', { $date: fromDateStr });
      
      let savedCount = 0;
      for (const cat of categories) {
        const { cash, gpay, bank_withdrawn } = incomeData[cat];
        const c = Number(cash) || 0; const g = Number(gpay) || 0; const b = Number(bank_withdrawn) || 0;
        
        if (c > 0 || g > 0 || b > 0) {
          // 🛡️ Safe Object Binding - Fixes the 5-parameter Crash
          await db.runAsync(
            'INSERT INTO income (date, category, cash, gpay, bank_withdrawn) VALUES ($date, $cat, $cash, $gpay, $bank)', 
            { $date: fromDateStr, $cat: cat, $cash: c, $gpay: g, $bank: b }
          );
          savedCount++;
        }
      }
      Alert.alert("Success! 💰", `Saved data for ${getDisplayDate(fromDateStr)}.`);
      await loadAllData(); 
    } catch (error) { Alert.alert("System Error", String(error.message || error)); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={90}>
      <ScrollView style={styles.container}>
        <View style={styles.dashboard}>
          <View style={styles.dateFilterRow}>
            <TouchableOpacity style={styles.actionBtnLeft} onPress={() => handleDeleteRange(db, 'income', fromDateStr, toDateStr, loadAllData)}>
              <Ionicons name="trash-outline" size={28} color="#ff6b6b" />
            </TouchableOpacity>

            <View style={styles.dateBox}>
              <Text style={styles.dateLabel}>From</Text>
              <TouchableOpacity style={styles.datePickerBtn} onPress={() => setShowFromPicker(true)}><Text style={styles.datePickerText}>{getDisplayDate(fromDateStr)}</Text></TouchableOpacity>
              {showFromPicker && <DateTimePicker value={fromDate} mode="date" display="default" onChange={(e, d) => { setShowFromPicker(false); if (d) setFromDate(d); }} />}
            </View>

            <TouchableOpacity style={styles.printBtn} onPress={() => handlePrintRange('income', fromDateStr, toDateStr, dashboardStatsRaw, grandTotals)}>
              <Ionicons name="print-outline" size={24} color="#4dabf7" />
            </TouchableOpacity>

            <View style={styles.dateBox}>
              <Text style={styles.dateLabel}>To</Text>
              <TouchableOpacity style={styles.datePickerBtn} onPress={() => setShowToPicker(true)}><Text style={styles.datePickerText}>{getDisplayDate(toDateStr)}</Text></TouchableOpacity>
              {showToPicker && <DateTimePicker value={toDate} mode="date" display="default" onChange={(e, d) => { setShowToPicker(false); if (d) setToDate(d); }} />}
            </View>
          </View>

          <View style={styles.statsContainer}>
            {categories.map(cat => (
              <View key={`dash-${cat}`} style={styles.statBlock}>
                <TouchableOpacity activeOpacity={0.7} onPress={() => toggleExpand(cat)} style={styles.statRow}>
                  <View style={styles.statHeaderRow}>
                    <Text style={styles.statCategory}>{cat}</Text>
                    <Text style={styles.dropdownIcon}>{expandedCats[cat] ? '▲' : '▼'}</Text>
                  </View>
                  <View style={styles.statNumbers}>
                    <Text style={styles.statText}>Cash: <Text style={styles.boldText}>₹{dashboardStatsRaw[cat]?.cash || 0}</Text></Text>
                    <Text style={styles.statText}>GPay: <Text style={styles.boldText}>₹{dashboardStatsRaw[cat]?.gpay || 0}</Text></Text>
                    <Text style={styles.statText}>Bank: <Text style={styles.boldText}>₹{dashboardStatsRaw[cat]?.bank || 0}</Text></Text>
                  </View>
                </TouchableOpacity>
                {expandedCats[cat] && (
                  <View style={styles.historyContainer}>
                    {(!dashboardStatsRaw[cat] || dashboardStatsRaw[cat].items.length === 0) ? <Text style={styles.noDataText}>No data for these dates.</Text> : (
                      <>
                        {dashboardStatsRaw[cat].items.map((item, i) => (
                          <View key={i} style={styles.historyRow}>
                            <Text style={styles.historyDate}>{getDisplayDate(item.date)}</Text>
                            <Text style={styles.historyAmt}>C: ₹{item.cash}</Text>
                            <Text style={styles.historyAmt}>G: ₹{item.gpay}</Text>
                            <Text style={styles.historyAmt}>B: ₹{item.bank}</Text>
                          </View>
                        ))}
                        <View style={styles.categoryTotalsFooter}>
                          <Text style={styles.catTotalText}>Total Cash: ₹{dashboardStatsRaw[cat].cash}</Text>
                          <Text style={styles.catTotalText}>Total GPay: ₹{dashboardStatsRaw[cat].gpay}</Text>
                          <Text style={styles.catTotalText}>Total Bank: ₹{dashboardStatsRaw[cat].bank}</Text>
                          <Text style={styles.catBalanceText}>Bank Balance: ₹{dashboardStatsRaw[cat].gpay - dashboardStatsRaw[cat].bank}</Text>
                        </View>
                      </>
                    )}
                  </View>
                )}
              </View>
            ))}
          </View>
        </View>

        {(!isSingleDate || grandTotals.cash > 0 || grandTotals.gpay > 0) && (
          <View style={styles.grandTotalsCard}>
            <Text style={styles.grandTotalsTitle}>Overall Income (Selected Dates)</Text>
            <View style={styles.gtRow}><Text style={styles.gtLabel}>Total Cash:</Text><Text style={styles.gtValue}>₹{grandTotals.cash}</Text></View>
            <View style={styles.gtRow}><Text style={styles.gtLabel}>Total GPay:</Text><Text style={styles.gtValue}>₹{grandTotals.gpay}</Text></View>
            <View style={styles.gtRow}><Text style={styles.gtLabel}>Total Bank Withdrawn:</Text><Text style={styles.gtValue}>₹{grandTotals.bank}</Text></View>
            <View style={styles.gtBalanceRow}><Text style={styles.gtBalanceLabel}>Current Bank Balance:</Text><Text style={styles.gtBalanceValue}>₹{grandTotals.gpay - grandTotals.bank}</Text></View>
          </View>
        )}

        {isSingleDate ? (
          <>
            {categories.map((cat) => (
              <View key={cat} style={styles.card}>
                <Text style={styles.cardTitle}>{cat}</Text>
                {['cash', 'gpay', 'bank_withdrawn'].map((field) => (
                  <View key={field} style={styles.inputRow}>
                    <Text style={styles.label}>{field === 'bank_withdrawn' ? 'Bank Withdrawn' : field.charAt(0).toUpperCase() + field.slice(1)} (₹)</Text>
                    <TextInput 
                      style={styles.input} keyboardType="number-pad" importantForAutofill="no" autoCorrect={false} autoComplete="off" spellCheck={false} placeholder="0" 
                      value={incomeData[cat][field]} onChangeText={(val) => handleInputChange(cat, field, val)} 
                    />
                  </View>
                ))}
              </View>
            ))}
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}><Text style={styles.saveBtnText}>Save</Text></TouchableOpacity>
            <View style={{ height: 40 }} />
          </>
        ) : (
          <View style={styles.readOnlyBox}><Text style={styles.readOnlyText}>Select the same From and To date to add or edit income.</Text></View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f2f5', padding: 15 },
  dashboard: { backgroundColor: '#343a40', padding: 15, borderRadius: 10, marginBottom: 20 },
  dateFilterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 15, alignItems: 'center' },
  dateBox: { flex: 1, marginHorizontal: 5 },
  dateLabel: { color: '#adb5bd', fontSize: 12, marginBottom: 5 },
  datePickerBtn: { backgroundColor: '#495057', borderRadius: 5, padding: 10, alignItems: 'center' },
  datePickerText: { color: 'white', fontWeight: 'bold' },
  actionBtnLeft: { paddingBottom: 5, paddingRight: 5, justifyContent: 'center' },
  printBtn: { padding: 5, justifyContent: 'center', alignItems: 'center' },
  statsContainer: { backgroundColor: '#212529', padding: 10, borderRadius: 8 },
  statBlock: { borderBottomWidth: 1, borderBottomColor: '#495057' },
  statRow: { paddingVertical: 10 },
  statHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  statCategory: { color: '#f8f9fa', fontSize: 16, fontWeight: 'bold' },
  dropdownIcon: { color: '#adb5bd', fontSize: 14, paddingRight: 5 },
  statNumbers: { flexDirection: 'row', justifyContent: 'space-between' },
  statText: { color: '#adb5bd', fontSize: 14 },
  boldText: { color: '#28a745', fontWeight: 'bold' },
  historyContainer: { backgroundColor: '#2c3136', padding: 10, borderRadius: 5, marginBottom: 10 },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: '#495057' },
  historyDate: { color: '#adb5bd', fontSize: 13, flex: 1, fontWeight: 'bold' },
  historyAmt: { color: '#e9ecef', fontSize: 13, flex: 1, textAlign: 'right' },
  noDataText: { color: '#adb5bd', fontStyle: 'italic', textAlign: 'center', paddingVertical: 5, fontSize: 13 },
  categoryTotalsFooter: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#495057' },
  catTotalText: { color: '#adb5bd', fontSize: 13, marginBottom: 2, textAlign: 'right' },
  catBalanceText: { color: '#17a2b8', fontSize: 15, fontWeight: 'bold', marginTop: 4, textAlign: 'right' },
  grandTotalsCard: { backgroundColor: '#212529', padding: 15, borderRadius: 10, marginBottom: 20, borderWidth: 1, borderColor: '#495057' },
  grandTotalsTitle: { color: '#f8f9fa', fontSize: 16, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
  gtRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  gtLabel: { color: '#adb5bd', fontSize: 15 },
  gtValue: { color: '#f8f9fa', fontSize: 16, fontWeight: 'bold' },
  gtBalanceRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#495057' },
  gtBalanceLabel: { color: '#17a2b8', fontSize: 16, fontWeight: 'bold' },
  gtBalanceValue: { color: '#17a2b8', fontSize: 18, fontWeight: 'bold' },
  card: { backgroundColor: 'white', padding: 15, borderRadius: 10, marginBottom: 15, elevation: 2 },
  cardTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 15, color: '#333' },
  inputRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  label: { fontSize: 16, color: '#555', flex: 1 },
  input: { borderBottomWidth: 1, borderColor: '#ccc', width: 100, fontSize: 16, textAlign: 'right', padding: 5, color: '#000' },
  saveBtn: { backgroundColor: '#28a745', padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  saveBtnText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  readOnlyBox: { padding: 20, alignItems: 'center', backgroundColor: '#e9ecef', borderRadius: 10, marginTop: 10 },
  readOnlyText: { color: '#6c757d', fontSize: 14, fontStyle: 'italic', textAlign: 'center' }
});