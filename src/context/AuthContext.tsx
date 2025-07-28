
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
  User, 
  signOut, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  updateProfile,
  onAuthStateChanged
} from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import type { AppUser } from '@/lib/types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signUpWithEmail: (email: string, password: string, displayName: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const signUpWithEmail = async (email: string, password: string, displayName: string) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const newUser = userCredential.user;
    
    // Update the user's profile in Firebase Auth
    await updateProfile(newUser, { displayName });

    // Create the user document in Firestore
    const userRef = doc(db, "users", newUser.uid);
    const newAppUser: Omit<AppUser, 'uid'> = {
        name: displayName,
        email: newUser.email,
        photoURL: newUser.photoURL,
        createdAt: serverTimestamp(),
        role: 'شيخ' // Default role for new sign-ups
    };
    await setDoc(userRef, newAppUser);
    
    // Manually update the user state to reflect the new profile information immediately
    setUser({ ...newUser, displayName });
  };
  
  const signInWithEmail = async (email: string, password: string) => {
     await signInWithEmailAndPassword(auth, email, password);
     // onAuthStateChanged will handle setting the user state
  }

  const logout = async () => {
    await signOut(auth);
    // User state will be cleared by onAuthStateChanged
  };

  return (
    <AuthContext.Provider value={{ user, loading, signUpWithEmail, signInWithEmail, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
