import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useSelector } from 'react-redux';
import { updatePresenceRequest } from '../services/userApi';

const HEARTBEAT_MS = 2 * 60 * 1000;

export function usePresenceHeartbeat() {
  const token = useSelector((state) => state.auth.token);
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated || !token) return undefined;

    const ping = () => {
      updatePresenceRequest(token).catch(() => {});
    };

    const start = () => {
      ping();
      if (!intervalRef.current) {
        intervalRef.current = setInterval(ping, HEARTBEAT_MS);
      }
    };

    const stop = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        start();
      } else {
        stop();
      }
    });

    if (AppState.currentState === 'active') {
      start();
    }

    return () => {
      subscription.remove();
      stop();
    };
  }, [isAuthenticated, token]);
}
