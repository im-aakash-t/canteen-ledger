import { Alert } from 'react-native';
import * as Print from 'expo-print';

export const formatDate = (dateObj: any): string => {
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

export const getDisplayDate = (isoDateString: string): string => {
  if (!isoDateString || typeof isoDateString !== 'string') return '';
  const parts = isoDateString.split('-');
  if (parts.length !== 3) return isoDateString;
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
};

export const handleDeleteRange = (
  db: any, 
  tableName: string, 
  fromDateStr: string, 
  toDateStr: string, 
  onSuccessCallback?: () => void
) => {
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
                      await db.runAsync(
                        `DELETE FROM ${tableName} WHERE date >= ? AND date <= ?`, 
                        fromDateStr || '', 
                        toDateStr || ''
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

export const handlePrintRange = async (
  type: string, 
  fromDateStr: string, 
  toDateStr: string, 
  dashboardStats: Record<string, any>, 
  totals: any
) => {
  try {
    let tableRows = '';
    let tableHeader = '';
    let totalsHtml = '';
    const isIncome = type === 'income';

    if (isIncome) {
      const datesMap: Record<string, any> = {};
      Object.keys(dashboardStats).forEach(cat => {
        dashboardStats[cat].items.forEach((item: any) => {
          if (!datesMap[item.date]) {
            datesMap[item.date] = {
              Bakery: { cash: 0, gpay: 0, bank: 0 },
              Stationery: { cash: 0, gpay: 0, bank: 0 },
              Counter: { cash: 0, gpay: 0, bank: 0 },
              'Counter 2': { cash: 0, gpay: 0, bank: 0 },
              'Counter 3': { cash: 0, gpay: 0, bank: 0 }
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
        const balC2 = d['Counter 2'].gpay - d['Counter 2'].bank;
        const balC3 = d['Counter 3'].gpay - d['Counter 3'].bank;

        let dayTotalCash = 0;
        let dayTotalGpay = 0;
        let dayTotalBank = 0;
        ['Bakery', 'Stationery', 'Counter', 'Counter 2', 'Counter 3'].forEach(c => {
           dayTotalCash += d[c].cash;
           dayTotalGpay += d[c].gpay;
           dayTotalBank += d[c].bank;
        });
        const dayTotalBal = dayTotalGpay - dayTotalBank;

        tableRows += `
          <tr>
            <td style="font-weight:bold;">${getDisplayDate(date)}</td>
            <td>₹${d.Bakery.cash}</td><td>₹${d.Bakery.gpay}</td><td>₹${d.Bakery.bank}</td><td class="bal-col">₹${balB}</td>
            <td>₹${d.Stationery.cash}</td><td>₹${d.Stationery.gpay}</td><td>₹${d.Stationery.bank}</td><td class="bal-col">₹${balS}</td>
            <td>₹${d.Counter.cash}</td><td>₹${d.Counter.gpay}</td><td>₹${d.Counter.bank}</td><td class="bal-col">₹${balC}</td>
            <td>₹${d['Counter 2'].cash}</td><td>₹${d['Counter 2'].gpay}</td><td>₹${d['Counter 2'].bank}</td><td class="bal-col">₹${balC2}</td>
            <td>₹${d['Counter 3'].cash}</td><td>₹${d['Counter 3'].gpay}</td><td>₹${d['Counter 3'].bank}</td><td class="bal-col">₹${balC3}</td>
          </tr>
          <tr style="background-color: #fff5f5; font-weight: bold; border-top: 2px solid #ccc; border-bottom: 2px solid #ccc;">
            <td colspan="5" style="color: #dc3545; text-align: right; padding-right: 15px;">Day Total:</td>
            <td colspan="4" style="color: #dc3545; text-align: center;">Cash: ₹${dayTotalCash}</td>
            <td colspan="4" style="color: #dc3545; text-align: center;">GPay: ₹${dayTotalGpay}</td>
            <td colspan="4" style="color: #dc3545; text-align: center;">Bank: ₹${dayTotalBank}</td>
            <td colspan="4" style="color: #17a2b8; text-align: center;">Bal: ₹${dayTotalBal}</td>
          </tr>
        `;
      });

      if (tableRows === '') tableRows = `<tr><td colspan="21" style="text-align:center; padding: 20px;">No data available for these dates.</td></tr>`;

      tableHeader = `
        <tr>
          <th rowspan="2" style="vertical-align: middle;">Date</th>
          <th colspan="4" style="text-align:center; background-color:#e2e3e5;">Bakery</th>
          <th colspan="4" style="text-align:center; background-color:#e2e3e5;">Stationery</th>
          <th colspan="4" style="text-align:center; background-color:#e2e3e5;">Counter</th>
          <th colspan="4" style="text-align:center; background-color:#e2e3e5;">Counter 2</th>
          <th colspan="4" style="text-align:center; background-color:#e2e3e5;">Counter 3</th>
        </tr>
        <tr>
          <th>Cash</th><th>GPay</th><th>Bank</th><th>Bal</th>
          <th>Cash</th><th>GPay</th><th>Bank</th><th>Bal</th>
          <th>Cash</th><th>GPay</th><th>Bank</th><th>Bal</th>
          <th>Cash</th><th>GPay</th><th>Bank</th><th>Bal</th>
          <th>Cash</th><th>GPay</th><th>Bank</th><th>Bal</th>
        </tr>
      `;

      const getCatSum = (cat: string, fieldType: string) => dashboardStats[cat]?.[fieldType] || 0;
      const getCatBalance = (cat: string) => getCatSum(cat, 'gpay') - getCatSum(cat, 'bank');
      
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
          <div class="cat-card">
            <h4>Counter 2 Totals</h4>
            <p>Cash: <span>₹${getCatSum('Counter 2', 'cash')}</span></p>
            <p>GPay: <span>₹${getCatSum('Counter 2', 'gpay')}</span></p>
            <p>Bank: <span>₹${getCatSum('Counter 2', 'bank')}</span></p>
            <p class="cat-balance">Bank Balance: <span>₹${getCatBalance('Counter 2')}</span></p>
          </div>
          <div class="cat-card">
            <h4>Counter 3 Totals</h4>
            <p>Cash: <span>₹${getCatSum('Counter 3', 'cash')}</span></p>
            <p>GPay: <span>₹${getCatSum('Counter 3', 'gpay')}</span></p>
            <p>Bank: <span>₹${getCatSum('Counter 3', 'bank')}</span></p>
            <p class="cat-balance">Bank Balance: <span>₹${getCatBalance('Counter 3')}</span></p>
          </div>
          
          <div class="totals-box-card">
            <h3>Overall Grand Totals</h3>
            <p>Total Cash: <span class="bold">₹${totals.cash}</span></p>
            <p>Total GPay: <span class="bold">₹${totals.gpay}</span></p>
            <p>Total Bank: <span class="bold">₹${totals.bank}</span></p>
            <p class="grand-balance">Overall Bank Bal: <span class="bold">₹${totals.gpay - totals.bank}</span></p>
          </div>
        </div>
      `;

    } else {
      const expensesByDate: Record<string, any> = {};
      Object.keys(dashboardStats).forEach(cat => {
        dashboardStats[cat].items.forEach((item: any) => {
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
          
          catData.items.forEach((item: any, index: number) => {
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
            @page { size: landscape; margin: 8mm; }
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 5px; color: #333; }
            .header { text-align: center; margin-bottom: 15px; border-bottom: 2px solid #333; padding-bottom: 8px; }
            .header h1 { margin: 0; font-size: 24px; color: ${isIncome ? '#28a745' : '#dc3545'}; }
            .header p { margin: 5px 0 0 0; font-size: 14px; color: #666; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 10px; } 
            th, td { border: 1px solid #aaa; padding: 4px; text-align: center; } 
            th { background-color: #f8f9fa; font-weight: bold; }
            .bal-col { color: #17a2b8; font-weight: bold; }
            
            .category-grid { 
              display: grid; 
              grid-template-columns: repeat(3, 1fr); 
              gap: 12px; 
              margin-bottom: 15px; 
              break-inside: avoid; 
              page-break-inside: avoid; 
            }
            .cat-card { 
              border: 1px solid #ccc; 
              border-radius: 5px; 
              padding: 10px; 
              background-color: #fff; 
              box-sizing: border-box; 
            } 
            .cat-card h4 { margin: 0 0 10px 0; border-bottom: 1px solid #eee; padding-bottom: 5px; color: #28a745; text-align: center; }
            .cat-card p { display: flex; justify-content: space-between; margin: 5px 0; font-size: 13px; font-weight: bold; }
            .cat-balance { color: #17a2b8; border-top: 1px dashed #ccc; padding-top: 5px; margin-top: 5px !important; }
            
            /* Styles for Grand Totals Card inside Grid */
            .totals-box-card {
              border: 2px solid #333;
              border-radius: 5px;
              padding: 10px;
              background-color: #f8f9fa;
              box-sizing: border-box;
            }
            .totals-box-card h3 { margin: 0 0 10px 0; border-bottom: 2px solid #333; padding-bottom: 5px; color: #333; text-align: center; font-size: 14px; }
            .totals-box-card p { display: flex; justify-content: space-between; margin: 5px 0; font-size: 13px; font-weight: bold; }
            .grand-balance { color: #17a2b8; border-top: 1px solid #333; padding-top: 5px; margin-top: 5px !important; }

            /* Styles for Expense Box Banner */
            .totals-box { 
              border: 2px solid #333; 
              padding: 15px; 
              background-color: #f8f9fa; 
              border-radius: 5px; 
              break-inside: avoid; 
              page-break-inside: avoid; 
            }
            .totals-box h3 { margin-top: 0; border-bottom: 2px solid #333; padding-bottom: 5px; font-size: 16px; }
            .total-row { display: flex; justify-content: space-between; font-size: 15px; margin-bottom: 6px; }
            .bold { font-weight: bold; }
            .highlight { color: #17a2b8; font-weight: bold; font-size: 17px; border-top: 1px dashed #ccc; padding-top: 8px; margin-top: 8px; }
            .expense-total { color: #dc3545; font-size: 17px; font-weight: bold; }
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