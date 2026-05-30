import { Provider } from 'react-redux';
import { StatusBar } from 'expo-status-bar';

import { AuthScreen } from './src/screens/AuthScreen';
import { store } from './src/redux/store';

export default function App() {
  return (
    <Provider store={store}>
      <StatusBar style="dark" />
      <AuthScreen />
    </Provider>
  );
}
