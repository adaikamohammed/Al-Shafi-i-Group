
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
import { auth, db } from '@/lib/firebase';
import type { AppUser } from '@/lib/types';
import { ref, set, get } from 'firebase/database';

const sheikhInitialData: { [email: string]: { name: string; group: string } } = {
  "admin1@gmail.com": { name: "الشيخ صهيب نصيب", group: "فوج 1" },
  "admin2@gmail.com": { name: "الشيخ زياد درويش", group: "فوج 2" },
  "admin3@gmail.com": { name: "الشيخ فؤاد بن عمر", group: "فوج 3" },
  "admin4@gmail.com": { name: "الشيخ أحمد بن عمر", group: "فوج 4" },
  "admin5@gmail.com": { name: "الشيخ إبراهيم مراد", group: "فوج 5" },
  "admin6@gmail.com": { name: "الشيخ عبد الحميد", group: "فوج 6" },
  "admin7@gmail.com": { name: "الشيخ سفيان نصيرة", group: "فوج 7" },
  "admin8@gmail.com": { name: "الشيخ عبد الحق نصيرة", group: "فوج 8" },
  "admin9@gmail.com": { name: "الشيخ عبد القادر", group: "فوج 9" },
  "admin10@gmail.com": { name: "الشيخ محمد منصور", group: "فوج 10" },
  "admin@gmail.com": { name: "الإدارة العامة", group: "كل الأفواج" }
};

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  isAdmin: boolean;
  signUpWithEmail: (email: string, password: string, displayName: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      if (currentUser) {
        const userRef = ref(db, `users/${currentUser.uid}/profile`);
        const snapshot = await get(userRef);
        
        let appUser: AppUser;
        if (snapshot.exists()) {
            appUser = { uid: currentUser.uid, ...snapshot.val() };
        } else {
             const sheikhInfo = sheikhInitialData[currentUser.email || ''] || { name: currentUser.displayName || 'مستخدم جديد', group: 'فوج غير محدد' };
             appUser = {
                uid: currentUser.uid,
                email: currentUser.email,
                displayName: sheikhInfo.name,
                photoURL: currentUser.photoURL,
                group: sheikhInfo.group
            };
            if(currentUser.email && !snapshot.exists()) {
                 const newProfileRef = ref(db, `users/${currentUser.uid}/profile`);
                 await set(newProfileRef, appUser);
            }
        }
        setUser(appUser);
        setIsAdmin(appUser.email === 'admin@gmail.com');
      } else {
        setUser(null);
        setIsAdmin(false);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const signUpWithEmail = async (email: string, password: string, displayName: string) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const newUser = userCredential.user;
    
    const sheikhInfo = sheikhInitialData[email] || { name: displayName, group: 'فوج غير محدد' };
    
    await updateProfile(newUser, { displayName: sheikhInfo.name });

    const profileData: AppUser = {
        uid: newUser.uid,
        email: newUser.email,
        displayName: sheikhInfo.name,
        group: sheikhInfo.group,
    };
    const userRef = ref(db, `users/${newUser.uid}/profile`);
    await set(userRef, profileData);
  };
  
  const signInWithEmail = async (email: string, password: string) => {
    if (!email || !password) {
      throw new FirebaseError("auth/invalid-argument", "Email and password must not be empty.");
    }
    await signInWithEmailAndPassword(auth, email, password);
  }

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin, signUpWithEmail, signInWithEmail, logout }}>
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
