import { Provider } from 'react-redux';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { RootNavigator } from './src/navigation/RootNavigator';
import { store } from './src/redux/store';
import { initCustomAlert } from './src/utils/CustomAlertService';
import CustomAlertModal from './src/components/CustomAlertModal';

// Initialize the global custom Alert modal override
initCustomAlert();

export default function App() {
  return (
    <Provider store={store}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <RootNavigator />
        <CustomAlertModal />
      </SafeAreaProvider>
    </Provider>
  );
}
