
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getAuth, onAuthStateChanged, User, GoogleAuthProvider, signInWithRedirect, signOut, getRedirectResult } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthorized: boolean | null;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const allowedEmails = [
    "sheikh1@gmail.com", 
    "sheikh2@gmail.com", 
    "sheikh3@gmail.com"
];

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      if (currentUser) {
        await handleAuthUser(currentUser);
      } else {
        // Handle the redirect result when the user comes back
        try {
          const result = await getRedirectResult(auth);
          if (result && result.user) {
            await handleAuthUser(result.user);
          } else {
            setUser(null);
            setIsAuthorized(null);
            setLoading(false);
          }
        } catch (error) {
            console.error("Error getting redirect result:", error);
            setUser(null);
            setIsAuthorized(null);
            setLoading(false);
        }
      }
    });

    return () => unsubscribe();
  }, [toast]);

  const handleAuthUser = async (authUser: User) => {
      if (allowedEmails.includes(authUser.email || '')) {
        setUser(authUser);
        setIsAuthorized(true);
        const userRef = doc(db, "users", authUser.uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
          await setDoc(userRef, {
            uid: authUser.uid,
            name: authUser.displayName,
            email: authUser.email,
            photo: authUser.photoURL,
            createdAt: serverTimestamp(),
          });
        }
      } else {
        setUser(null);
        setIsAuthorized(false);
        toast({
          title: "🚫 حساب غير مصرح به",
          description: "هذا الحساب غير مخول للدخول. سيتم تسجيل خروجك.",
          variant: 'destructive',
        });
        await signOut(auth);
      }
      setLoading(false);
  }

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    setLoading(true);
    await signInWithRedirect(auth, provider);
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
    setIsAuthorized(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, isAuthorized, signInWithGoogle, logout }}>
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
