// Safe console wrappers to avoid LogBox / Fabric errors when logging complex objects
const _origConsole = { ...console };
const safeSerialize = (v) => {
  try {
    if (v && typeof v === 'object') {
      if (v.$$typeof) return '[ReactElement]';
      return JSON.stringify(v);
    }
    if (typeof v === 'function') return '[Function]';
    return String(v);
  } catch (e) {
    try { return String(v); } catch { return '[Unserializable]'; }
  }
};
['log','info','warn','error','debug'].forEach((m) => {
  console[m] = (...args) => {
    try {
      const safeArgs = args.map((a) => safeSerialize(a));
      _origConsole[m](...safeArgs);
    } catch (e) {
      _origConsole[m]('Console wrapper error:', e);
    }
  };
});

import { Provider } from 'react-redux';
import { StatusBar } from 'expo-status-bar';
import {
  initialWindowMetrics,
  SafeAreaProvider,
} from 'react-native-safe-area-context';

import { RootNavigator } from './src/navigation/RootNavigator';
import { store } from './src/redux/store';
import { initCustomAlert } from './src/utils/CustomAlertService';
import CustomAlertModal from './src/components/CustomAlertModal';

// Initialize the global custom Alert modal override
initCustomAlert();

export default function App() {
  return (
    <Provider store={store}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <StatusBar style="dark" />
        <RootNavigator />
        <CustomAlertModal />
      </SafeAreaProvider>
    </Provider>
  );
}
