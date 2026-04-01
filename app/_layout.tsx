import { Tabs } from 'expo-router';
import { Alert, TouchableOpacity } from 'react-native';
import * as SQLite from 'expo-sqlite'; // 🛡️ Added this import
import { SQLiteProvider } from 'expo-sqlite';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';

const initializeDatabase = async (db) => {
  try {
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS income (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT, category TEXT, cash REAL, gpay REAL, bank_withdrawn REAL
      );
      CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT, category TEXT, item_name TEXT, amount REAL
      );
    `);
  } catch (error) {
    console.error("Database Init Error: ", error);
  }
};

export default function RootLayout() {
  
  const exportDb = async () => {
    try {
      // 🛡️ FIX 1: Force the database to flush all recent changes into the main .db file
      const db = await SQLite.openDatabaseAsync('canteen.db');
      await db.execAsync('PRAGMA wal_checkpoint(FULL);');

      const dbFilePath = `${FileSystem.documentDirectory}SQLite/canteen.db`;
      const dbInfo = await FileSystem.getInfoAsync(dbFilePath);
      
      if (dbInfo.exists) {
        await Sharing.shareAsync(dbFilePath, { dialogTitle: 'Export Canteen Database' });
      } else {
        Alert.alert("Error", "Database file not found.");
      }
    } catch (err) {
      Alert.alert("Export Error", String(err));
    }
  };

  const importDb = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const dbFilePath = `${FileSystem.documentDirectory}SQLite/canteen.db`;
        const walFilePath = `${FileSystem.documentDirectory}SQLite/canteen.db-wal`;
        const shmFilePath = `${FileSystem.documentDirectory}SQLite/canteen.db-shm`;
        const sqliteDir = `${FileSystem.documentDirectory}SQLite`;

        if (!(await FileSystem.getInfoAsync(sqliteDir)).exists) {
          await FileSystem.makeDirectoryAsync(sqliteDir);
        }

        // 🛡️ FIX 2: Delete the old DB and its "ghost" WAL files so they don't corrupt the import
        if ((await FileSystem.getInfoAsync(dbFilePath)).exists) await FileSystem.deleteAsync(dbFilePath);
        if ((await FileSystem.getInfoAsync(walFilePath)).exists) await FileSystem.deleteAsync(walFilePath);
        if ((await FileSystem.getInfoAsync(shmFilePath)).exists) await FileSystem.deleteAsync(shmFilePath);

        // Copy the new DB file
        await FileSystem.copyAsync({ from: result.assets[0].uri, to: dbFilePath });
        
        Alert.alert(
          "Success! 🎉", 
          "Database imported successfully.\n\n⚠️ IMPORTANT: You MUST completely close (swipe away) the app and reopen it to load the new data.",
          [{ text: "Got it!" }]
        );
      }
    } catch (error) {
      Alert.alert("Import Error", String(error));
    }
  };

  const showBackupOptions = () => {
    Alert.alert(
      "Database Backup",
      "Would you like to Export (Save to phone) or Import (Restore from phone)?",
      [
        { text: "Import", onPress: importDb, style: "destructive" }, 
        { text: "Export", onPress: exportDb }                        
      ],
      { cancelable: true }
    );
  };

  return (
    <SQLiteProvider databaseName="canteen.db" onInit={initializeDatabase}>
      <Tabs screenOptions={{ 
        headerStyle: { backgroundColor: '#f8f9fa' },
        headerTitleStyle: { fontWeight: 'bold', fontSize: 20 },
        tabBarActiveTintColor: '#28a745',
        tabBarInactiveTintColor: 'gray',
        headerRight: () => (
          <TouchableOpacity onPress={showBackupOptions} style={{ marginRight: 15, padding: 5 }}>
            <Ionicons name="server-outline" size={24} color="#333" />
          </TouchableOpacity>
        )
      }}>
        <Tabs.Screen 
          name="index" 
          options={{ 
            title: 'Inward', 
            tabBarLabel: 'Inward',
            tabBarIcon: ({ color, size }) => <Ionicons name="download-outline" size={size} color={color} />
          }} 
        />
        <Tabs.Screen 
          name="outgoing" 
          options={{ 
            title: 'Outward', 
            tabBarLabel: 'Outward',
            tabBarIcon: ({ color, size }) => <Ionicons name="upload-outline" size={size} color={color} />
          }} 
        />
        <Tabs.Screen
          name="inward_report" 
          options={{ 
            title: 'Inward Report', 
            tabBarLabel: 'Inward Rep',
            tabBarIcon: ({ color, size }) => <Ionicons name="bar-chart-outline" size={size} color={color} />
          }} 
        />
        <Tabs.Screen 
          name="outward_report" 
          options={{ 
            title: 'Outward Report', 
            tabBarLabel: 'Outward Rep',
            tabBarIcon: ({ color, size }) => <Ionicons name="receipt-outline" size={size} color={color} />
          }} 
        />
      </Tabs>
    </SQLiteProvider>
  );
}