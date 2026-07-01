import { DatabaseProvider } from '@nozbe/watermelondb/react';

import { database } from './src/db';
import HomeScreen from './src/screens/HomeScreen';

export default function App() {
  return (
    <DatabaseProvider database={database}>
      <HomeScreen />
    </DatabaseProvider>
  );
}
