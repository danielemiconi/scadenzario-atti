import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase/config';
import { type User, type AuthContextType, type UserRole } from '../types';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        try {
          // Get custom claims (used by Firestore rules)
          const tokenResult = await firebaseUser.getIdTokenResult();
          const customClaims = tokenResult.claims;
          
          console.log('Firebase Auth custom claims:', customClaims);
          
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data() as User;
            // Use role from custom claims if available, fallback to Firestore
            const roleFromClaims = (customClaims.role as UserRole) || userData.role;
            setUser({ ...userData, uid: firebaseUser.uid, role: roleFromClaims });
            
            console.log('User loaded with role:', roleFromClaims);
          } else {
            // If user document doesn't exist, create a basic one
            const newUser: User = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              name: firebaseUser.displayName || '',
              initials: '',
              role: 'standard',
              createdAt: serverTimestamp() as any,
              updatedAt: serverTimestamp() as any,
            };
            await setDoc(doc(db, 'users', firebaseUser.uid), newUser);
            setUser(newUser);
          }
        } catch (err) {
          console.error('Error fetching user data:', err);
          setError(err as Error);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signIn = async (email: string, password: string) => {
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const signUp = async (email: string, password: string, userData: Partial<User>) => {
    setError(null);
    try {
      const { user: firebaseUser } = await createUserWithEmailAndPassword(auth, email, password);
      
      const newUser: User = {
        uid: firebaseUser.uid,
        email: firebaseUser.email || email,
        name: userData.name || '',
        initials: userData.initials || '',
        role: userData.role || 'standard',
        createdAt: serverTimestamp() as any,
        updatedAt: serverTimestamp() as any,
      };
      
      await setDoc(doc(db, 'users', firebaseUser.uid), newUser);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const signOut = async () => {
    setError(null);
    try {
      await firebaseSignOut(auth);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const updateProfile = async (userData: Partial<User>) => {
    setError(null);
    if (!user?.uid) {
      throw new Error('No user logged in');
    }
    
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        ...userData,
        updatedAt: serverTimestamp(),
      });
      
      const updatedDoc = await getDoc(doc(db, 'users', user.uid));
      if (updatedDoc.exists()) {
        setUser({ ...updatedDoc.data() as User, uid: user.uid });
      }
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    error,
    signIn,
    signUp,
    signOut,
    updateProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};