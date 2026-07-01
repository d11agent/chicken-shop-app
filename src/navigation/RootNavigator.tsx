import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import HomeScreen from '../screens/HomeScreen';
import MenuScreen from '../screens/MenuScreen';
import BillingScreen from '../screens/BillingScreen';
import BillsScreen from '../screens/BillsScreen';
import BillDetailScreen from '../screens/BillDetailScreen';

export type RootStackParamList = {
  Home: undefined;
  Menu: undefined;
  Billing: { draftBillId?: string } | undefined;
  Bills: undefined;
  BillDetail: { billId: string };
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
      </Stack.Navigator>
    </NavigationContainer>
  );
}
