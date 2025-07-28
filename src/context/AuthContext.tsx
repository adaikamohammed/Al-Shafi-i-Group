
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

// Define the shape of the user's document in Firestore
export interface AppUser {
    uid: string;
    name: string;
    email: string | null;
    photoURL?: string | null;
    createdAt: any;
    role: 'شيخ' | 'إدارة';
}

interface AuthContextType {
  user: User | null;
  appUser: AppUser | null; // Add appUser to the context
  loading: boolean;
  signUpWithEmail: (email: string, password: string, displayName: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);


export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
          // Fetch the user's custom data (including role) from Firestore
          const userRef = doc(db, "users", currentUser.uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
              setAppUser(userSnap.data() as AppUser);
          }
      } else {
          setAppUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signUpWithEmail = async (email: string, password: string, displayName: string) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const newUser = userCredential.user;
    
    // Update profile and save to Firestore with a default role
    await updateProfile(newUser, { displayName });
    const userRef = doc(db, "users", newUser.uid);
    const newAppUser: AppUser = {
        uid: newUser.uid,
        name: displayName,
        email: newUser.email,
        photoURL: newUser.photoURL,
        createdAt: serverTimestamp(),
        role: 'شيخ' // Default role for new sign-ups
    };
    await setDoc(userRef, newAppUser);
    
    // Manually set user and appUser to trigger context update
    setUser(newUser);
    setAppUser(newAppUser);
  };
  
  const signInWithEmail = async (email: string, password: string) => {
     await signInWithEmailAndPassword(auth, email, password);
     // onAuthStateChanged will handle fetching the user data
  }

  const logout = async () => {
    await signOut(auth);
    // User state will be cleared by onAuthStateChanged
  };

  return (
    <AuthContext.Provider value={{ user, appUser, loading, signUpWithEmail, signInWithEmail, logout }}>
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
