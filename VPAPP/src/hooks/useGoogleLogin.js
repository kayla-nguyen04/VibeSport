import { useEffect } from 'react';

import * as AuthSession from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';

import { GOOGLE_AUTH_CONFIG, isGoogleAuthConfigured } from '../components/constants/googleAuth';

WebBrowser.maybeCompleteAuthSession();

export function useGoogleLogin({ onError, onSuccess }) {
  const redirectUri = AuthSession.makeRedirectUri({
    scheme: 'vpapp',
    path: 'oauthredirect',
  });

  const [request, response, promptAsync] = Google.useAuthRequest({
    ...GOOGLE_AUTH_CONFIG,
    redirectUri,
    scopes: ['openid', 'profile', 'email'],
    selectAccount: true,
  });

  useEffect(() => {
    async function handleResponse() {
      if (!response) {
        return;
      }

      if (response.type !== 'success') {
        if (response.type !== 'dismiss') {
          onError?.('Đăng nhập Google đã bị hủy hoặc thất bại.');
        }
        return;
      }

      const accessToken = response.authentication?.accessToken || response.params?.access_token;

      if (!accessToken) {
        onError?.('Không lấy được access token từ Google.');
        return;
      }

      try {
        const profile = await AuthSession.fetchUserInfoAsync({ accessToken }, Google.discovery);

        onSuccess?.({
          email: profile.email,
          googleId: profile.sub,
          name: profile.name,
          picture: profile.picture,
        });
      } catch (error) {
        onError?.(error.message || 'Không lấy được thông tin Google.');
      }
    }

    handleResponse();
  }, [onError, onSuccess, response]);

  async function signInWithGoogle() {
    if (!isGoogleAuthConfigured) {
      onError?.('Chưa cấu hình Google client ID. Hãy sửa file src/constants/googleAuth.js trước.');
      return;
    }

    if (!request) {
      onError?.('Google Auth Request chưa sẵn sàng.');
      return;
    }

    await promptAsync();
  }

  return {
    googleReady: Boolean(request) && isGoogleAuthConfigured,
    signInWithGoogle,
  };
}
