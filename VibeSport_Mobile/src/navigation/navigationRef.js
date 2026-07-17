import { createRef } from 'react';

export const navigationRef = createRef();

/**
 * Navigate to a screen from outside component tree.
 * @param {string} name - Screen name
 * @param {object} params - Navigation params
 */
export function navigate(name, params) {
  navigationRef.current?.navigate(name, params);
}

/**
 * Go back one screen, only if the current route is 'Call'.
 * Safe to call from socket handlers — avoids accidentally
 * popping non-call screens if user already navigated away.
 */
export function safeGoBackFromCall() {
  const state = navigationRef.current?.getRootState();
  if (!state) return;
  const route = state.routes[state.index];
  if (route?.name === 'Call') {
    navigationRef.current?.goBack();
  }
}
