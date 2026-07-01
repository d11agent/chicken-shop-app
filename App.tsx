import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DatabaseProvider } from '@nozbe/watermelondb/react';

import { database } from './src/db';
import RootNavigator from './src/navigation/RootNavigator';

export default function App() {
  return (
    <DatabaseProvider database={database}>
      <SafeAreaProvider>
        <RootNavigator />
      </SafeAreaProvider>
    </DatabaseProvider>
  );
}
