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
 * 
 * 
 * 
 * @returns {boolean}
 */
export function safeGoBackFromCall() {
  const state = navigationRef.current?.getRootState();
  if (!state) return false;
  const route = state.routes[state.index];
  if (route?.name === 'Call') {
    navigationRef.current?.goBack();
    return true;
  }
  return false;
}
