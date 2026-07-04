import { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';

import { hydrateSession } from '../redux/authSlice';
import { usePresenceHeartbeat } from '../hooks/usePresenceHeartbeat';
import { useSocket } from '../hooks/useSocket';
import { AuthNavigator } from './AuthNavigator';
import { MainNavigator, LoadingScreen, linking } from './MainNavigator';

export function RootNavigator() {
  const dispatch = useDispatch();
  const { isAuthenticated, isHydrating, user } = useSelector((state) => state.auth);

  const isProfileComplete = Boolean(user?.favoriteSport && user?.position && user?.area);

  usePresenceHeartbeat();
  useSocket();

  useEffect(() => {
    dispatch(hydrateSession());
  }, [dispatch]);

  if (isHydrating) {
    return <LoadingScreen />;
  }

  const navigatorKey = isAuthenticated
    ? isProfileComplete
      ? 'authenticated-complete'
      : 'authenticated-incomplete'
    : 'guest';

  const initialRouteName = isAuthenticated
    ? isProfileComplete
      ? 'Home'
      : 'CompleteProfile'
    : 'Auth';

  return (
    <NavigationContainer key={navigatorKey} linking={linking}>
      {isAuthenticated ? (
        <MainNavigator initialRouteName={initialRouteName} />
      ) : (
        <AuthNavigator />
      )}
    </NavigationContainer>
  );
}
