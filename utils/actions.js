import { Alert } from 'react-native';
import * as Print from 'expo-print';

// 1. Shared Date Formatters
export const formatDate = (dateObj) => {
  try {
    const d = new Date(dateObj);
    if (isNaN(d.getTime())) return new Date().toISOString().split('T')[0];
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  } catch(e) {
    return new Date().toISOString().split('T')[0];
  }
};

export const getDisplayDate = (isoDateString) => {
  if (!isoDateString || typeof isoDateString !== 'string') return '';
  const parts = isoDateString.split('-');
  if (parts.length !== 3) return isoDateString;
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
};

// 2. Shared Delete Logic (🛡️ UPDATED WITH OBJECT BINDING)
export const handleDeleteRange = (db, tableName, fromDateStr, toDateStr, onSuccessCallback) => {
  Alert.alert(
    "⚠️ Delete Data",
    `Are you sure you want to delete ALL data from ${getDisplayDate(fromDateStr)} to ${getDisplayDate(toDateStr)}?\n\nThis cannot be undone!`,
    [
      { text: "Cancel", style: "cancel" },
      { 
        text: "Delete", 
        style: "destructive", 
        onPress: () => {
          setTimeout(() => {
            Alert.alert(
              "🚨 FINAL WARNING",
              "You are about to permanently erase this data. Are you absolutely certain?",
              [
                { text: "No, Keep It", style: "cancel" },
                { 
                  text: "Yes, Erase Everything", 
                  style: "destructive", 
                  onPress: async () => {
                    try {
                      // 🛡️ Safe Object Binding
                      await db.runAsync(
                        `DELETE FROM ${tableName} WHERE date >= $fromDate AND date <= $toDate`, 
                        { $fromDate: fromDateStr, $toDate: toDateStr }
                      );
                      Alert.alert("Deleted 🗑️", "Data cleared successfully.");
                      if (onSuccessCallback) onSuccessCallback(); 
                    } catch (error) {
                      Alert.alert("Error", String(error));
                    }
                  }
                }
              ]
            );
          }, 100);
        }
      }
    ]
  );
};

// 3. Shared PDF Print Logic
export const handlePrintRange = async (type, fromDateStr, toDateStr, dashboardStats, totals) => {
  try {
    let tableRows = '';
    let tableHeader = '';
    let totalsHtml = '';
    const isIncome = type === 'income';

    if (isIncome) {
      const datesMap = {};
      Object.keys(dashboardStats).forEach(cat => {
        dashboardStats[cat].items.forEach(item => {
          if (!datesMap[item.date]) {
            datesMap[item.date] = {
              Bakery: { cash: 0, gpay: 0, bank: 0 },
              Stationery: { cash: 0, gpay: 0, bank: 0 },
              Counter: { cash: 0, gpay: 0, bank: 0 }
            };
          }
          datesMap[item.date][cat].cash += item.cash || 0;
          datesMap[item.date][cat].gpay += item.gpay || 0;
          datesMap[item.date][cat].bank += item.bank || 0;
        });
      });

      const sortedDates = Object.keys(datesMap).sort((a, b) => a.localeCompare(b));

      sortedDates.forEach(date => {
        const d = datesMap[date];
        const balB = d.Bakery.gpay - d.Bakery.bank;
        const balS = d.Stationery.gpay - d.Stationery.bank;
        const balC = d.Counter.gpay - d.Counter.bank;

        tableRows += `
          <tr>
            <td style="font-weight:bold;">${getDisplayDate(date)}</td>
            <td>₹${d.Bakery.cash}</td><td>₹${d.Bakery.gpay}</td><td>₹${d.Bakery.bank}</td><td class="bal-col">₹${balB}</td>
            <td>₹${d.Stationery.cash}</td><td>₹${d.Stationery.gpay}</td><td>₹${d.Stationery.bank}</td><td class="bal-col">₹${balS}</td>
            <td>₹${d.Counter.cash}</td><td>₹${d.Counter.gpay}</td><td>₹${d.Counter.bank}</td><td class="bal-col">₹${balC}</td>
          </tr>
        `;
      });

      if (tableRows === '') tableRows = `<tr><td colspan="13" style="text-align:center; padding: 20px;">No data available for these dates.</td></tr>`;

      tableHeader = `
        <tr>
          <th rowspan="2" style="vertical-align: middle;">Date</th>
          <th colspan="4" style="text-align:center; background-color:#e2e3e5;">Bakery</th>
          <th colspan="4" style="text-align:center; background-color:#e2e3e5;">Stationery</th>
          <th colspan="4" style="text-align:center; background-color:#e2e3e5;">Counter</th>
        </tr>
        <tr>
          <th>Cash</th><th>GPay</th><th>Bank</th><th>Balance</th>
          <th>Cash</th><th>GPay</th><th>Bank</th><th>Balance</th>
          <th>Cash</th><th>GPay</th><th>Bank</th><th>Balance</th>
        </tr>
      `;

      const getCatSum = (cat, type) => dashboardStats[cat]?.[type] || 0;
      const getCatBalance = (cat) => getCatSum(cat, 'gpay') - getCatSum(cat, 'bank');
      
      totalsHtml = `
        <div class="category-grid">
          <div class="cat-card">
            <h4>Bakery Totals</h4>
            <p>Cash: <span>₹${getCatSum('Bakery', 'cash')}</span></p>
            <p>GPay: <span>₹${getCatSum('Bakery', 'gpay')}</span></p>
            <p>Bank: <span>₹${getCatSum('Bakery', 'bank')}</span></p>
            <p class="cat-balance">Bank Balance: <span>₹${getCatBalance('Bakery')}</span></p>
          </div>
          <div class="cat-card">
            <h4>Stationery Totals</h4>
            <p>Cash: <span>₹${getCatSum('Stationery', 'cash')}</span></p>
            <p>GPay: <span>₹${getCatSum('Stationery', 'gpay')}</span></p>
            <p>Bank: <span>₹${getCatSum('Stationery', 'bank')}</span></p>
            <p class="cat-balance">Bank Balance: <span>₹${getCatBalance('Stationery')}</span></p>
          </div>
          <div class="cat-card">
            <h4>Counter Totals</h4>
            <p>Cash: <span>₹${getCatSum('Counter', 'cash')}</span></p>
            <p>GPay: <span>₹${getCatSum('Counter', 'gpay')}</span></p>
            <p>Bank: <span>₹${getCatSum('Counter', 'bank')}</span></p>
            <p class="cat-balance">Bank Balance: <span>₹${getCatBalance('Counter')}</span></p>
          </div>
        </div>
        
        <div class="totals-box">
          <h3>Overall Grand Totals</h3>
          <div class="total-row"><span>Total Cash:</span> <span class="bold">₹${totals.cash}</span></div>
          <div class="total-row"><span>Total GPay:</span> <span class="bold">₹${totals.gpay}</span></div>
          <div class="total-row"><span>Total Bank Withdrawn:</span> <span class="bold">₹${totals.bank}</span></div>
          <div class="total-row highlight"><span>Overall Bank Balance:</span> <span>₹${totals.gpay - totals.bank}</span></div>
        </div>
      `;

    } else {
      const expensesByDate = {};
      Object.keys(dashboardStats).forEach(cat => {
        dashboardStats[cat].items.forEach(item => {
          if (!expensesByDate[item.date]) {
            expensesByDate[item.date] = { categories: {}, dailyTotal: 0, rowCount: 0 };
          }
          if (!expensesByDate[item.date].categories[cat]) {
            expensesByDate[item.date].categories[cat] = { items: [], catDailyTotal: 0 };
          }
          expensesByDate[item.date].categories[cat].items.push(item);
          expensesByDate[item.date].categories[cat].catDailyTotal += Number(item.amount) || 0;
          expensesByDate[item.date].dailyTotal += Number(item.amount) || 0;
          expensesByDate[item.date].rowCount++;
        });
      });

      const sortedDates = Object.keys(expensesByDate).sort((a, b) => a.localeCompare(b));

      sortedDates.forEach(date => {
        const dayData = expensesByDate[date];
        const sortedCats = Object.keys(dayData.categories).sort();
        
        let dateMerged = false;

        sortedCats.forEach(cat => {
          const catData = dayData.categories[cat];
          
          catData.items.forEach((item, index) => {
            const dateCell = !dateMerged 
              ? `<td rowspan="${dayData.rowCount}" style="vertical-align: middle; font-weight: bold; text-align: center;">${getDisplayDate(date)}</td>` 
              : '';
            dateMerged = true;

            const catCell = index === 0 
              ? `<td rowspan="${catData.items.length}" style="vertical-align: middle; font-weight: bold; text-align: center;">${cat}</td>` 
              : '';

            const totalCell = index === 0 
              ? `<td rowspan="${catData.items.length}" style="vertical-align: middle; font-weight: bold; text-align: center; background-color: #f8f9fa;">₹${catData.catDailyTotal}</td>` 
              : '';
              
            tableRows += `
              <tr>
                ${dateCell}
                ${catCell}
                <td>${item.name || item.item_name}</td> 
                <td>₹${item.amount}</td>
                ${totalCell}
              </tr>
            `;
          });
        });
        
        tableRows += `
          <tr style="background-color: #fef0f0; font-weight: bold; border-top: 2px solid #ccc; border-bottom: 2px solid #ccc;">
            <td colspan="4" style="text-align: right; padding-right: 15px;">Total for ${getDisplayDate(date)}:</td>
            <td style="color: #dc3545; text-align: center;">₹${dayData.dailyTotal}</td>
          </tr>
        `;
      });

      if (tableRows === '') tableRows = `<tr><td colspan="5" style="text-align:center; padding: 20px;">No expenses logged for these dates.</td></tr>`;

      tableHeader = `
        <tr>
          <th>Date</th>
          <th>Category</th>
          <th>Item Description</th>
          <th>Amount</th>
          <th>Total Amount</th>
        </tr>
      `;

      let categoryTotalsHtml = '<div style="margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px dashed #ccc;">';
      Object.keys(dashboardStats).forEach(cat => {
        const catTotal = dashboardStats[cat].total || 0;
        if (catTotal > 0) {
          categoryTotalsHtml += `
            <div class="total-row" style="font-size: 15px; font-weight: normal; margin-bottom: 5px;">
              <span>${cat}:</span> <span>₹${catTotal}</span>
            </div>
          `;
        }
      });
      categoryTotalsHtml += '</div>';

      totalsHtml = `
        <div class="totals-box">
          <h3>Expense Summary</h3>
          ${categoryTotalsHtml}
          <div class="total-row expense-total">
            <span>Overall Grand Total:</span> <span>₹${totals}</span>
          </div>
        </div>
      `;
    }

    const html = `
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 15px; color: #333; }
            .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 10px; }
            .header h1 { margin: 0; font-size: 24px; color: ${isIncome ? '#28a745' : '#dc3545'}; }
            .header p { margin: 5px 0 0 0; font-size: 14px; color: #666; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 12px; }
            th, td { border: 1px solid #aaa; padding: 6px; text-align: center; }
            th { background-color: #f8f9fa; font-weight: bold; }
            .bal-col { color: #17a2b8; font-weight: bold; }
            .category-grid { display: flex; justify-content: space-between; margin-bottom: 20px; page-break-inside: avoid; }
            .cat-card { width: 30%; border: 1px solid #ccc; border-radius: 5px; padding: 10px; background-color: #fff; }
            .cat-card h4 { margin: 0 0 10px 0; border-bottom: 1px solid #eee; padding-bottom: 5px; color: #28a745; text-align: center; }
            .cat-card p { display: flex; justify-content: space-between; margin: 5px 0; font-size: 14px; font-weight: bold; }
            .cat-balance { color: #17a2b8; border-top: 1px dashed #ccc; padding-top: 5px; margin-top: 5px !important; }
            .totals-box { border: 2px solid #333; padding: 15px; background-color: #f8f9fa; border-radius: 5px; page-break-inside: avoid; }
            .totals-box h3 { margin-top: 0; border-bottom: 2px solid #333; padding-bottom: 5px; }
            .total-row { display: flex; justify-content: space-between; font-size: 16px; margin-bottom: 8px; }
            .bold { font-weight: bold; }
            .highlight { color: #17a2b8; font-weight: bold; font-size: 18px; border-top: 1px dashed #ccc; padding-top: 8px; margin-top: 8px; }
            .expense-total { color: #dc3545; font-size: 18px; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${isIncome ? 'Inward Report' : 'Expenses Report'}</h1>
            <p>Period: ${getDisplayDate(fromDateStr)} to ${getDisplayDate(toDateStr)}</p>
          </div>
          <table><thead>${tableHeader}</thead><tbody>${tableRows}</tbody></table>
          ${totalsHtml}
        </body>
      </html>
    `;

    await Print.printAsync({ html });
  } catch (error) {
    Alert.alert("Print Error", String(error));
  }
};