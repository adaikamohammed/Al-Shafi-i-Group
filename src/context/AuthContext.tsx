
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
import { auth, db, storage } from '@/lib/firebase';
import type { AppUser } from '@/lib/types';
import { ref, set, get, update } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { useToast } from '@/hooks/use-toast';

const sheikhInitialData: { [email: string]: { name: string; group: string; role: 'sheikh' | 'super_admin' } } = {
  "admin0@gmail.com": { name: "المدير العام", group: "كل الأفواج", role: "super_admin" },
  "admin1@gmail.com": { name: "الشيخ زياد درويش", group: "فوج الشيخ زياد درويش", role: "sheikh" },
  "admin2@gmail.com": { name: "الشيخ عبد الحميد", group: "فوج الشيخ عبد الحميد", role: "sheikh" },
  "admin3@gmail.com": { name: "الشيخ فؤاد بن عمر", group: "فوج الشيخ فؤاد بن عمر", role: "sheikh" },
  "admin4@gmail.com": { name: "الشيخ أحمد بن عمر", group: "فوج الشيخ أحمد بن عمر", role: "sheikh" },
  "admin5@gmail.com": { name: "الشيخ إبراهيم مراد", group: "فوج الشيخ إبراهيم مراد", role: "sheikh" },
  "admin6@gmail.com": { name: "الشيخ سفيان نصيرة", group: "فوج الشيخ سفيان نصيرة", role: "sheikh" },
  "admin7@gmail.com": { name: "الشيخ محمد منصور", group: "فوج الشيخ محمد منصور", role: "sheikh" },
  "admin8@gmail.com": { name: "الشيخ عبد الحق نصيرة", group: "فوج الشيخ عبد الحق نصيرة", role: "sheikh" },
  "admin9@gmail.com": { name: "الشيخ صهيب نصيب", group: "فوج الشيخ صهيب نصيب", role: "sheikh" },
};


interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  isSuperAdmin: boolean;
  role: 'sheikh' | 'super_admin' | null;
  signUpWithEmail: (email: string, password: string, displayName: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  updateUserProfile: (data: Partial<AppUser> & { photoFile?: File | null }) => Promise<void>;
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
                ...profileData
            };
        } else {
             const sheikhInfo = sheikhInitialData[currentUser.email || ''] || { name: currentUser.displayName || 'مستخدم جديد', group: 'فوج غير محدد', role: 'sheikh' };
             
             const displayName = sheikhInfo.name || currentUser.displayName || 'مستخدم جديد';

             appUser = {
                uid: currentUser.uid,
                email: currentUser.email,
                displayName: displayName,
                group: sheikhInfo.group,
                role: sheikhInfo.role,
            };
            const newProfileRef = ref(db, `users/${currentUser.uid}/profile`);
            await set(newProfileRef, { 
                email: appUser.email, 
                displayName: appUser.displayName,
                group: appUser.group,
                role: appUser.role,
            });
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

  const updateUserProfile = async (data: Partial<AppUser> & { photoFile?: File | null }) => {
    if (!auth.currentUser) throw new Error("User not authenticated.");

    const { photoFile, ...profileData } = data;
    const updates: any = {};
    let newPhotoURL = user?.photoURL || null;

    if (photoFile) {
        const imageRef = storageRef(storage, `sheikh_profiles/${auth.currentUser.uid}`);
        await uploadBytes(imageRef, photoFile);
        newPhotoURL = await getDownloadURL(imageRef);
        updates[`/users/${auth.currentUser.uid}/profile/photoURL`] = newPhotoURL;
    }

    if (profileData.displayName && profileData.displayName !== user?.displayName) {
        updates[`/users/${auth.currentUser.uid}/profile/displayName`] = profileData.displayName;
    }

    // Add other fields to updates object
    Object.keys(profileData).forEach(key => {
        if (key !== 'displayName' && key !== 'photoURL') {
             updates[`/users/${auth.currentUser.uid}/profile/${key}`] = (profileData as any)[key];
        }
    });

    if (Object.keys(updates).length > 0) {
        await update(ref(db), updates);
        
        // Update Firebase Auth profile if displayName changed
        if (profileData.displayName && profileData.displayName !== auth.currentUser.displayName) {
            await updateProfile(auth.currentUser, { displayName: profileData.displayName });
        }
        
        setUser(prevUser => prevUser ? { ...prevUser, ...profileData, photoURL: newPhotoURL } : null);
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, isSuperAdmin, role, signUpWithEmail, signInWithEmail, updateUserProfile, logout }}>
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
