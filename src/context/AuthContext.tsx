
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

const sheikhInitialData: { [email: string]: { name: string; group: string; role: 'sheikh' | 'super_admin' } } = {
  "admin0@gmail.com": { name: "المدير العام", group: "كل الأفواج", role: "super_admin" },
  "admin1@gmail.com": { name: "الشيخ زياد درويش", group: "فوج 1", role: "sheikh" },
  "admin2@gmail.com": { name: "الشيخ عبد الحميد", group: "فوج 2", role: "sheikh" },
  "admin3@gmail.com": { name: "الشيخ فؤاد بن عمر", group: "فوج 3", role: "sheikh" },
  "admin4@gmail.com": { name: "الشيخ أحمد بن عمر", group: "فوج 4", role: "sheikh" },
  "admin5@gmail.com": { name: "الشيخ إبراهيم مراد", group: "فوج 5", role: "sheikh" },
  "admin6@gmail.com": { name: "الشيخ سفيان نصيرة", group: "فوج 6", role: "sheikh" },
  "admin8@gmail.com": { name: "الشيخ عبد الحق نصيرة", group: "فوج 8", role: "sheikh" },
  "admin9@gmail.com": { name: "الشيخ صهيب نصيب", group: "فوج 9", role: "sheikh" },
  "admin10@gmail.com": { name: "الشيخ محمد منصور", group: "فوج 10", role: "sheikh" },
};

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  isSuperAdmin: boolean;
  role: 'sheikh' | 'super_admin' | null;
  signUpWithEmail: (email: string, password: string, displayName: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<'sheikh' | 'super_admin' | null>(null);
  const isSuperAdmin = role === 'super_admin';

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      if (currentUser) {
        const userRef = ref(db, `users/${currentUser.uid}/profile`);
        const snapshot = await get(userRef);
        
        let appUser: AppUser;
        if (snapshot.exists()) {
            const profileData = snapshot.val();
            appUser = { 
                uid: currentUser.uid,
                email: currentUser.email,
                displayName: profileData.displayName,
                photoURL: currentUser.photoURL,
                group: profileData.group,
                role: profileData.role 
            };
        } else {
             const sheikhInfo = sheikhInitialData[currentUser.email || ''] || { name: currentUser.displayName || 'مستخدم جديد', group: 'فوج غير محدد', role: 'sheikh' };
             
             // Ensure displayName from initial data is used if available
             const displayName = sheikhInfo.name || currentUser.displayName || 'مستخدم جديد';

             appUser = {
                uid: currentUser.uid,
                email: currentUser.email,
                displayName: displayName,
                photoURL: currentUser.photoURL,
                group: sheikhInfo.group,
                role: sheikhInfo.role,
            };
            // If profile doesn't exist, create it. This is crucial for new sign-ups or first logins.
            const newProfileRef = ref(db, `users/${currentUser.uid}/profile`);
            await set(newProfileRef, { 
                email: appUser.email, 
                displayName: appUser.displayName,
                group: appUser.group,
                role: appUser.role,
            });
            // Also update the auth profile display name if it's different
            if (currentUser.displayName !== appUser.displayName) {
                await updateProfile(currentUser, { displayName: appUser.displayName });
            }
        }
        setUser(appUser);
        setRole(appUser.role || 'sheikh');
      } else {
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const signUpWithEmail = async (email: string, password: string, displayName: string) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const newUser = userCredential.user;
    
    const sheikhInfo = sheikhInitialData[email] || { name: displayName, group: 'فوج غير محدد', role: 'sheikh' };
    
    await updateProfile(newUser, { displayName: sheikhInfo.name });

    const profileData: Omit<AppUser, 'uid' | 'photoURL'> = {
        email: newUser.email,
        displayName: sheikhInfo.name,
        group: sheikhInfo.group,
        role: sheikhInfo.role,
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
    <AuthContext.Provider value={{ user, loading, isSuperAdmin, role, signUpWithEmail, signInWithEmail, logout }}>
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
