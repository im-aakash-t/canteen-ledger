import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useFocusEffect } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
// @ts-ignore
import { formatDate, getDisplayDate, handlePrintRange } from '../utils/actions';

export default function OutwardReportScreen() {
  const db = useSQLiteContext();
  const [fromDate, setFromDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [toDate, setToDate] = useState(new Date());
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);

  const [reportData, setReportData] = useState<Record<string, any>>({});
  const [catSummaries, setCatSummaries] = useState<Record<string, number>>({});
  const [grandTotal, setGrandTotal] = useState(0);
  const [dashboardStatsRaw, setDashboardStatsRaw] = useState<Record<string, any>>({});

  const loadReport = useCallback(async () => {
    const fromStr = formatDate(fromDate);
    const toStr = formatDate(toDate);
    
    const rawResults = await db.getAllAsync<any>(
      'SELECT date, category, item_name, amount FROM expenses WHERE date >= ? AND date <= ? ORDER BY date ASC, category ASC',
      fromStr || '', toStr || ''
    );

    let total = 0;
    const expensesByDate: Record<string, any> = {};
    const summary: Record<string, number> = {};
    const rawStats: Record<string, any> = {};

    rawResults.forEach(row => {
      total += row.amount;
      if (!expensesByDate[row.date]) expensesByDate[row.date] = { categories: {}, dailyTotal: 0 };
      if (!expensesByDate[row.date].categories[row.category]) expensesByDate[row.date].categories[row.category] = { items: [], catDailyTotal: 0 };
      
      expensesByDate[row.date].categories[row.category].items.push(row);
      expensesByDate[row.date].categories[row.category].catDailyTotal += row.amount;
      expensesByDate[row.date].dailyTotal += row.amount;

      if (!summary[row.category]) summary[row.category] = 0;
      summary[row.category] += row.amount;

      if (!rawStats[row.category]) rawStats[row.category] = { total: 0, items: [] };
      rawStats[row.category].total += row.amount;
      rawStats[row.category].items.push({ date: row.date, name: row.item_name, amount: row.amount });
    });

    setReportData(expensesByDate);
    setCatSummaries(summary);
    setDashboardStatsRaw(rawStats);
    setGrandTotal(total);
  }, [db, fromDate, toDate]);

  useFocusEffect(useCallback(() => { loadReport(); }, [loadReport]));

  return (
    <View style={styles.container}>
      <View style={styles.filterBar}>
        <TouchableOpacity onPress={() => setShowFromPicker(true)} style={styles.dateBtn}>
          <Text style={styles.dateLabel}>From: {getDisplayDate(formatDate(fromDate))}</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.printBtn} 
          onPress={() => handlePrintRange('expenses', formatDate(fromDate), formatDate(toDate), dashboardStatsRaw, grandTotal)}
        >
          <Ionicons name="print-outline" size={24} color="#4dabf7" />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setShowToPicker(true)} style={styles.dateBtn}>
          <Text style={styles.dateLabel}>To: {getDisplayDate(formatDate(toDate))}</Text>
        </TouchableOpacity>
      </View>

      {showFromPicker && <DateTimePicker value={fromDate} onChange={(e: any, d?: Date) => {setShowFromPicker(false); if(d) setFromDate(d);}} />}
      {showToPicker && <DateTimePicker value={toDate} onChange={(e: any, d?: Date) => {setShowToPicker(false); if(d) setToDate(d);}} />}

      <ScrollView>
        <View style={styles.tableHeader}>
          <Text style={[styles.hText, {width: 75}]}>Date</Text>
          <Text style={[styles.hText, {width: 75}]}>Cat</Text>
          <Text style={[styles.hText, {flex: 1}]}>Item</Text>
          <Text style={[styles.hText, {width: 55}]}>Amt</Text>
          <Text style={[styles.hText, {width: 70}]}>Total</Text>
        </View>

        {Object.keys(reportData).sort().map(date => {
          const dayData = reportData[date];
          const sortedCats = Object.keys(dayData.categories).sort();
          return (
            <View key={date} style={styles.dateBlock}>
              <View style={styles.dayWrapper}>
                <View style={styles.dateMergeCell}><Text style={styles.mergeText}>{getDisplayDate(date)}</Text></View>
                <View style={{ flex: 1 }}>
                  {sortedCats.map(cat => {
                    const catData = dayData.categories[cat];
                    return (
                      <View key={cat} style={styles.categoryRowWrapper}>
                        <View style={styles.catMergeCell}><Text style={styles.catMergeText}>{cat}</Text></View>
                        <View style={{ flex: 1 }}>
                          {catData.items.map((item: any, idx: number) => (
                            <View key={idx} style={styles.itemRow}>
                              <Text style={[styles.rText, {flex: 1, textAlign: 'left', paddingLeft: 5}]}>{item.item_name}</Text>
                              <Text style={[styles.rText, {width: 55}]}>₹{item.amount}</Text>
                            </View>
                          ))}
                        </View>
                        <View style={styles.totalMergeCell}><Text style={styles.mergeText}>₹{catData.catDailyTotal}</Text></View>
                      </View>
                    );
                  })}
                </View>
              </View>
              <View style={styles.daySummaryRow}><Text style={styles.dayTotalText}>Day Total: ₹{dayData.dailyTotal}</Text></View>
            </View>
          );
        })}

        <View style={styles.finalSummaryBox}>
          <Text style={styles.summaryTitle}>Expense Summary</Text>
          {Object.keys(catSummaries).map(cat => (
            <View key={cat} style={styles.gtRow}><Text style={styles.gtLabel}>{cat}:</Text><Text style={styles.gtValue}>₹{catSummaries[cat]}</Text></View>
          ))}
          <View style={styles.overallTotalRow}><Text style={styles.overallLabel}>Overall Grand Total:</Text><Text style={styles.overallValue}>₹{grandTotal}</Text></View>
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 10 },
  filterBar: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, alignItems: 'center' },
  dateBtn: { backgroundColor: '#343a40', padding: 10, borderRadius: 5, flex: 0.42, alignItems: 'center' },
  dateLabel: { color: '#fff', fontWeight: 'bold', fontSize: 11 },
  printBtn: { padding: 5, justifyContent: 'center', alignItems: 'center' },
  tableHeader: { flexDirection: 'row', backgroundColor: '#f8f9fa', borderBottomWidth: 2, borderColor: '#333', paddingVertical: 8 },
  hText: { fontWeight: 'bold', fontSize: 12, textAlign: 'center' },
  dateBlock: { marginBottom: 10, borderWidth: 1, borderColor: '#ccc' },
  dayWrapper: { flexDirection: 'row' },
  dateMergeCell: { width: 75, justifyContent: 'center', alignItems: 'center', borderRightWidth: 1, borderColor: '#ccc', backgroundColor: '#fff' },
  categoryRowWrapper: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#eee' },
  catMergeCell: { width: 75, justifyContent: 'center', alignItems: 'center', borderRightWidth: 1, borderColor: '#eee', backgroundColor: '#fff' },
  totalMergeCell: { width: 70, justifyContent: 'center', alignItems: 'center', borderLeftWidth: 1, borderColor: '#eee', backgroundColor: '#f9f9f9' },
  itemRow: { flexDirection: 'row', minHeight: 35, alignItems: 'center', borderBottomWidth: 0.5, borderColor: '#f0f0f0' },
  rText: { fontSize: 10, textAlign: 'center', paddingHorizontal: 2 },
  mergeText: { fontWeight: 'bold', fontSize: 11, textAlign: 'center' },
  catMergeText: { fontSize: 10, textAlign: 'center', fontWeight: '600' },
  daySummaryRow: { padding: 8, backgroundColor: '#fff5f5', alignItems: 'flex-end' },
  dayTotalText: { fontSize: 12, fontWeight: 'bold', color: '#dc3545' },
  finalSummaryBox: { marginTop: 25, padding: 15, backgroundColor: '#f8f9fa', borderRadius: 10, borderWidth: 1.5, borderColor: '#333' },
  summaryTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 10, textAlign: 'center', borderBottomWidth: 1, borderBottomColor: '#ddd', paddingBottom: 5 },
  gtRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  gtLabel: { fontSize: 14, color: '#444' },
  gtValue: { fontSize: 14, fontWeight: 'bold' },
  overallTotalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTopWidth: 2, borderTopColor: '#333' },
  overallLabel: { fontSize: 16, fontWeight: 'bold', color: '#dc3545' },
  overallValue: { fontSize: 18, fontWeight: 'bold', color: '#dc3545' }
});