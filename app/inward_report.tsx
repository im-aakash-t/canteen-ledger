import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useFocusEffect } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
// @ts-ignore
import { formatDate, getDisplayDate, handlePrintRange } from '../utils/actions';

export default function InwardReportScreen() {
  const db = useSQLiteContext();
  const [fromDate, setFromDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [toDate, setToDate] = useState(new Date());
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);

  const [data, setData] = useState<any[]>([]);
  const [catTotals, setCatTotals] = useState<Record<string, any>>({});
  const [grandTotals, setGrandTotals] = useState({ cash: 0, gpay: 0, bank: 0 });
  const [dashboardStatsRaw, setDashboardStatsRaw] = useState<Record<string, any>>({});

  const loadReport = useCallback(async () => {
    const fromStr = formatDate(fromDate);
    const toStr = formatDate(toDate);
    
    const rawResults = await db.getAllAsync<any>(
      'SELECT date, category, cash, gpay, bank_withdrawn FROM income WHERE date >= ? AND date <= ? ORDER BY date ASC',
      fromStr || '', toStr || '' 
    );

    const datesMap: Record<string, any> = {};
    const summary: Record<string, any> = { 
      Bakery: {cash:0, gpay:0, bank:0, items:[]}, 
      Stationery: {cash:0, gpay:0, bank:0, items:[]}, 
      Counter: {cash:0, gpay:0, bank:0, items:[]},
      'Counter 2': {cash:0, gpay:0, bank:0, items:[]},
      'Counter 3': {cash:0, gpay:0, bank:0, items:[]}
    };
    let gC = 0, gG = 0, gB = 0;

    rawResults.forEach(row => {
      if (!datesMap[row.date]) {
        datesMap[row.date] = { 
          Bakery: {c:0, g:0, b:0}, 
          Stationery: {c:0, g:0, b:0}, 
          Counter: {c:0, g:0, b:0},
          'Counter 2': {c:0, g:0, b:0},
          'Counter 3': {c:0, g:0, b:0}
        };
      }
      if (summary[row.category]) {
        datesMap[row.date][row.category] = { c: row.cash, g: row.gpay, b: row.bank_withdrawn };
        summary[row.category].cash += row.cash;
        summary[row.category].gpay += row.gpay;
        summary[row.category].bank += row.bank_withdrawn;
        summary[row.category].items.push({ date: row.date, cash: row.cash, gpay: row.gpay, bank: row.bank_withdrawn });
        gC += row.cash; gG += row.gpay; gB += row.bank_withdrawn;
      }
    });

    setData(Object.keys(datesMap).sort().map(d => ({ date: d, vals: datesMap[d] })));
    setCatTotals(summary);
    setDashboardStatsRaw(summary);
    setGrandTotals({ cash: gC, gpay: gG, bank: gB });
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
          onPress={() => handlePrintRange('income', formatDate(fromDate), formatDate(toDate), dashboardStatsRaw, grandTotals)}
        >
          <Ionicons name="print-outline" size={24} color="#4dabf7" />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setShowToPicker(true)} style={styles.dateBtn}>
          <Text style={styles.dateLabel}>To: {getDisplayDate(formatDate(toDate))}</Text>
        </TouchableOpacity>
      </View>

      {showFromPicker && <DateTimePicker value={fromDate} onChange={(e: any, d?: Date) => {setShowFromPicker(false); if(d) setFromDate(d);}} />}
      {showToPicker && <DateTimePicker value={toDate} onChange={(e: any, d?: Date) => {setShowToPicker(false); if(d) setToDate(d);}} />}

      <ScrollView horizontal>
        <ScrollView style={{ flex: 1 }}>
          <View style={styles.tableRow}>
            <View style={[styles.cell, styles.headerCell, {width: 90}]}><Text style={styles.headerText}>Date</Text></View>
            {['Bakery', 'Stationery', 'Counter', 'Counter 2', 'Counter 3'].map(c => (
              <View key={c} style={[styles.cell, styles.headerCell, {width: 180, backgroundColor: '#e2e3e5'}]}>
                <Text style={styles.headerText}>{c}</Text>
              </View>
            ))}
          </View>
          <View style={styles.tableRow}>
            <View style={[styles.cell, {width: 90, borderBottomWidth: 2}]} />
            {[1,2,3,4,5].map(i => (
              <React.Fragment key={i}>
                <View style={[styles.cell, {width: 45, borderBottomWidth: 2}]}><Text style={styles.subHeaderText}>Cash</Text></View>
                <View style={[styles.cell, {width: 45, borderBottomWidth: 2}]}><Text style={styles.subHeaderText}>GPay</Text></View>
                <View style={[styles.cell, {width: 45, borderBottomWidth: 2}]}><Text style={styles.subHeaderText}>Bank</Text></View>
                <View style={[styles.cell, {width: 45, borderBottomWidth: 2}]}><Text style={styles.subHeaderText}>Bal</Text></View>
              </React.Fragment>
            ))}
          </View>

          {data.map((item, idx) => {
            let dayTotalCash = 0;
            let dayTotalGpay = 0;
            let dayTotalBank = 0;
            
            ['Bakery', 'Stationery', 'Counter', 'Counter 2', 'Counter 3'].forEach(c => {
               dayTotalCash += item.vals[c].c;
               dayTotalGpay += item.vals[c].g;
               dayTotalBank += item.vals[c].b;
            });

            return (
              <React.Fragment key={idx}>
                <View style={styles.tableRow}>
                  <View style={[styles.cell, {width: 90}]}><Text style={styles.cellText}>{getDisplayDate(item.date)}</Text></View>
                  {['Bakery', 'Stationery', 'Counter', 'Counter 2', 'Counter 3'].map(c => (
                    <React.Fragment key={c}>
                      <View style={[styles.cell, {width: 45}]}><Text style={styles.cellText}>{item.vals[c].c}</Text></View>
                      <View style={[styles.cell, {width: 45}]}><Text style={styles.cellText}>{item.vals[c].g}</Text></View>
                      <View style={[styles.cell, {width: 45}]}><Text style={styles.cellText}>{item.vals[c].b}</Text></View>
                      <View style={[styles.cell, {width: 45}]}><Text style={[styles.cellText, {color: '#17a2b8', fontWeight: 'bold'}]}>{item.vals[c].g - item.vals[c].b}</Text></View>
                    </React.Fragment>
                  ))}
                </View>
                <View style={[styles.tableRow, { backgroundColor: '#fff5f5' }]}>
                  <View style={[styles.cell, {width: 90}]}><Text style={[styles.cellText, {fontWeight: 'bold', color: '#dc3545'}]}>Day Total</Text></View>
                  <View style={[styles.cell, {width: 900, flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 5}]}>
                    <Text style={[styles.cellText, {fontWeight: 'bold', color: '#dc3545', fontSize: 11.5}]}>Cash: ₹{dayTotalCash}</Text>
                    <Text style={[styles.cellText, {fontWeight: 'bold', color: '#dc3545', fontSize: 11.5}]}>GPay: ₹{dayTotalGpay}</Text>
                    <Text style={[styles.cellText, {fontWeight: 'bold', color: '#dc3545', fontSize: 11.5}]}>Bank: ₹{dayTotalBank}</Text>
                    <Text style={[styles.cellText, {fontWeight: 'bold', color: '#17a2b8', fontSize: 11.5}]}>Bal: ₹{dayTotalGpay - dayTotalBank}</Text>
                  </View>
                </View>
              </React.Fragment>
            );
          })}

          <View style={styles.reportFooter}>
            <Text style={styles.summaryTitle}>Category Summaries & Grand Totals</Text>
            <View style={styles.catGrid}>
              {['Bakery', 'Stationery', 'Counter', 'Counter 2', 'Counter 3'].map(c => (
                <View key={c} style={styles.catCard}>
                  <Text style={styles.catName}>{c}</Text>
                  <Text style={styles.catText}>Cash: ₹{catTotals[c]?.cash || 0}</Text>
                  <Text style={styles.catText}>GPay: ₹{catTotals[c]?.gpay || 0}</Text>
                  <Text style={styles.catText}>Bank: ₹{catTotals[c]?.bank || 0}</Text>
                  <Text style={[styles.catText, {color: '#17a2b8', marginTop: 3, borderTopWidth: 0.5, borderColor: '#eee'}]}>Bal: ₹{(catTotals[c]?.gpay || 0) - (catTotals[c]?.bank || 0)}</Text>
                </View>
              ))}

              {/* 🛡️ THE FIX: Moved inside the catGrid row wrapper to form a clean 3x2 uniform block layout */}
              <View style={styles.grandTotalsCard}>
                <Text style={styles.gtTitle}>Overall Grand Totals</Text>
                <View style={styles.gtRow}><Text style={styles.gtLabel}>Total Cash:</Text><Text style={styles.gtValue}>₹{grandTotals.cash}</Text></View>
                <View style={styles.gtRow}><Text style={styles.gtLabel}>Total GPay:</Text><Text style={styles.gtValue}>₹{grandTotals.gpay}</Text></View>
                <View style={styles.gtRow}><Text style={styles.gtLabel}>Total Bank:</Text><Text style={styles.gtValue}>₹{grandTotals.bank}</Text></View>
                <View style={styles.gtBalanceRow}>
                  <Text style={styles.gtBalanceLabel}>Bank Balance:</Text>
                  <Text style={styles.gtBalanceValue}>₹{grandTotals.gpay - grandTotals.bank}</Text>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 10 },
  filterBar: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15, alignItems: 'center' },
  dateBtn: { backgroundColor: '#343a40', padding: 10, borderRadius: 5, flex: 0.42, alignItems: 'center' },
  dateLabel: { color: '#fff', fontWeight: 'bold', fontSize: 11 },
  printBtn: { padding: 5, justifyContent: 'center', alignItems: 'center' },
  tableRow: { flexDirection: 'row' },
  cell: { borderWidth: 0.5, borderColor: '#ccc', padding: 4, justifyContent: 'center', alignItems: 'center' },
  headerCell: { backgroundColor: '#f8f9fa' },
  headerText: { fontWeight: 'bold', fontSize: 13 },
  subHeaderText: { fontSize: 10, fontWeight: 'bold', color: '#666' },
  cellText: { fontSize: 10.5 },
  reportFooter: { marginTop: 20, padding: 15, backgroundColor: '#f8f9fa', borderRadius: 10, width: 980 }, 
  summaryTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 15, textAlign: 'center', color: '#333' },
  // 🛡️ Changed system to a clean row wrap configuration using exactly 32% width blocks to create 3 perfect columns
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  catCard: { width: '32%', marginBottom: 12, padding: 10, backgroundColor: '#fff', borderRadius: 6, borderWidth: 1, borderColor: '#ddd' }, 
  catName: { fontWeight: 'bold', fontSize: 13, color: '#28a745', borderBottomWidth: 1, borderColor: '#eee', marginBottom: 5 },
  catText: { fontSize: 11.5, fontWeight: 'bold', marginVertical: 2 },
  
  // 🛡️ Added specific styling to matching uniform proportions for Grand Totals Card
  grandTotalsCard: { width: '32%', marginBottom: 12, padding: 10, backgroundColor: '#fff', borderRadius: 6, borderWidth: 2, borderColor: '#333' },
  gtTitle: { fontSize: 13, fontWeight: 'bold', borderBottomWidth: 1, borderColor: '#333', paddingBottom: 5, marginBottom: 5, textAlign: 'center', color: '#333' },
  gtRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  gtLabel: { fontSize: 11.5, color: '#555', fontWeight: '500' },
  gtValue: { fontSize: 11.5, fontWeight: 'bold' },
  gtBalanceRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#333', marginTop: 4, paddingTop: 4 },
  gtBalanceLabel: { fontSize: 12, fontWeight: 'bold', color: '#17a2b8' },
  gtBalanceValue: { fontSize: 12, fontWeight: 'bold', color: '#17a2b8' }
});