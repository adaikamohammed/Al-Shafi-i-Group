
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
  User, 
  signOut, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  updateProfile,
  onAuthStateChanged,
  FirebaseError
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import type { AppUser } from '@/lib/types';

const sheikhData: { [email: string]: { name: string; group: string } } = {
  "admin1@gmail.com": { name: "الشيخ صهيب نصيب", group: "فوج 1" },
  "admin2@gmail.com": { name: "الشيخ زياد درويش", group: "فوج 2" },
  "admin3@gmail.com": { name: "الشيخ فؤاد بن عمر", group: "فوج 3" },
  "admin4@gmail.com": { name: "الشيخ أحمد بن عمر", group: "فوج 4" },
  "admin5@gmail.com": { name: "الشيخ إبراهيم مراد", group: "فوج 5" },
  "admin6@gmail.com": { name: "الشيخ عبد الحميد", group: "فوج 6" },
  "admin7@gmail.com": { name: "الشيخ سفيان نصيرة", group: "فوج 7" },
  "admin8@gmail.com": { name: "الشيخ عبد الحق نصيرة", group: "فوج 8" },
  "admin9@gmail.com": { name: "الشيخ عبد القادر", group: "فوج 9" },
  "admin10@gmail.com": { name: "الشيخ محمد منصور", group: "فوج 10" }
};

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  signUpWithEmail: (email: string, password: string, displayName: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        const sheikhInfo = sheikhData[currentUser.email || ''];
        const appUser: AppUser = {
          uid: currentUser.uid,
          email: currentUser.email,
          displayName: sheikhInfo?.name || currentUser.displayName,
          photoURL: currentUser.photoURL,
          group: sheikhInfo?.group
        };
        setUser(appUser);
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const signUpWithEmail = async (email: string, password: string, displayName: string) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const newUser = userCredential.user;
    await updateProfile(newUser, { displayName });
    
    const sheikhInfo = sheikhData[newUser.email || ''];
    // Set user in state to trigger updates
    setUser({
        uid: newUser.uid,
        email: newUser.email,
        displayName: sheikhInfo?.name || displayName,
        photoURL: newUser.photoURL,
        group: sheikhInfo?.group
    });
  };
  
  const signInWithEmail = async (email: string, password: string) => {
    if (!email || !password) {
      throw new FirebaseError("auth/invalid-argument", "Email and password must not be empty.");
    }
    try {
       await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        if (error instanceof FirebaseError) {
             console.error("Firebase Login Error:", error.code, error.message);
        } else {
            console.error("An unexpected error occurred during login:", error);
        }
        // Re-throw the error to be caught by the UI component
        throw error;
    }
  }

  const logout = async () => {
    await signOut(auth);
    setUser(null);
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
