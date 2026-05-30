import { useEffect, useState } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { firebaseConfig } from '../constants/firebaseConfig';
import { loginRequest } from '../services/authApi';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export function useFirebaseLogin() {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Monitor auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
    });
    return unsubscribe;
  }, []);

  const loginWithGoogle = async () => {
    try {
      setIsLoading(true);

      // Sign in with Google
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      // Get ID token
      const idToken = await user.getIdToken();

      // Send to backend to verify and create session
      const response = await loginRequest({
        email: user.email,
        googleId: user.uid,
        name: user.displayName,
        picture: user.photoURL,
        idToken, // Firebase ID token for backend verification
      });

      return response;
    } catch (error) {
      console.error('Firebase login error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await firebaseSignOut(auth);
      setFirebaseUser(null);
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  };

  return {
    loginWithGoogle,
    logout,
    firebaseUser,
    isLoading,
    isAuthenticated: !!firebaseUser,
  };
}
