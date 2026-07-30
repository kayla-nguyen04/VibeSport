import { useEffect } from 'react';
import { View } from 'react-native';

export default function ProfileSetupScreen({ navigation }) {
  useEffect(() => {
    navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
  }, [navigation]);

  return <View style={{ flex: 1, backgroundColor: '#FFFFFF' }} />;
}
