export const GOOGLE_AUTH_CONFIG = {
  androidClientId: 'YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com',
  iosClientId: 'YOUR_IOS_CLIENT_ID.apps.googleusercontent.com',
  webClientId: 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com',
};

export const isGoogleAuthConfigured = Object.values(GOOGLE_AUTH_CONFIG).every(
  (value) => value && !value.startsWith('YOUR_')
);
