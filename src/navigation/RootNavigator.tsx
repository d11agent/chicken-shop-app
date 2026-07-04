import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import HomeScreen from '../screens/HomeScreen';
import MenuScreen from '../screens/MenuScreen';
import BillingScreen from '../screens/BillingScreen';
import BillsScreen from '../screens/BillsScreen';
import BillDetailScreen from '../screens/BillDetailScreen';
import UdharScreen from '../screens/UdharScreen';
import CustomerLedgerScreen from '../screens/CustomerLedgerScreen';

export type RootStackParamList = {
  Home: undefined;
  Menu: undefined;
  Billing: { draftBillId?: string } | undefined;
  Bills: undefined;
  BillDetail: { billId: string };
  Udhar: undefined;
  CustomerLedger: { customerId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: '#b8320f' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '700' },
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: '🐔 Chicken Shop' }} />
        <Stack.Screen name="Menu" component={MenuScreen} options={{ title: 'Menu & Prices' }} />
        <Stack.Screen name="Billing" component={BillingScreen} options={{ title: 'New Bill' }} />
        <Stack.Screen name="Bills" component={BillsScreen} options={{ title: 'Bills' }} />
        <Stack.Screen name="BillDetail" component={BillDetailScreen} options={{ title: 'Bill' }} />
        <Stack.Screen name="Udhar" component={UdharScreen} options={{ title: 'Udhar' }} />
        <Stack.Screen
          name="CustomerLedger"
          component={CustomerLedgerScreen}
          options={{ title: 'Customer Ledger' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
