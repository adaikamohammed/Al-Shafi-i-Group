
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
  getAuth, 
  onAuthStateChanged, 
  User, 
  signOut, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

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
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signUpWithEmail = async (email: string, password: string, displayName: string) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const newUser = userCredential.user;
    
    // Update profile and save to Firestore
    await updateProfile(newUser, { displayName });
    const userRef = doc(db, "users", newUser.uid);
    await setDoc(userRef, {
        uid: newUser.uid,
        name: displayName,
        email: newUser.email,
        photoURL: newUser.photoURL,
        createdAt: serverTimestamp(),
    });
    
    // Manually set user to trigger context update
    setUser(newUser);
  };
  
  const signInWithEmail = async (email: string, password: string) => {
     await signInWithEmailAndPassword(auth, email, password);
  }

  const logout = async () => {
    await signOut(auth);
    // User state will be updated by onAuthStateChanged
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
