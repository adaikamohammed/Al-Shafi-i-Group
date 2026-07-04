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
import { auth, db, storage } from '@/lib/firebase';
import type { AppUser } from '@/lib/types';
import { ref, set, get, update } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';

const sheikhInitialData: { [email: string]: { name: string; group: string; role: 'sheikh' | 'super_admin' | 'management' } } = {
  "admin0@gmail.com": { name: "المدير العام", group: "كل الأفواج", role: "super_admin" },
  "admin00@gmail.com": { name: "الإدارة", group: "كل الأفواج", role: "management" },
  "admin1@gmail.com": { name: "الشيخ زياد درويش", group: "فوج 1", role: "sheikh" },
  "admin2@gmail.com": { name: "الشيخ عبد الحميد", group: "فوج 2", role: "sheikh" },
  "admin3@gmail.com": { name: "الشيخ فؤاد بن عمر", group: "فوج 3", role: "sheikh" },
  "admin4@gmail.com": { name: "الشيخ أحمد بن عمر", group: "فوج 4", role: "sheikh" },
  "admin5@gmail.com": { name: "الشيخ إبراهيم مراد", group: "فوج 5", role: "sheikh" },
  "admin6@gmail.com": { name: "الشيخ سفيان نصيرة", group: "فوج 6", role: "sheikh" },
  "admin7@gmail.com": { name: "الشيخ محمد منصور", group: "فوج 7", role: "sheikh" },
  "admin8@gmail.com": { name: "الشيخ عبد الحق نصيرة", group: "فوج 8", role: "sheikh" },
  "admin9@gmail.com": { name: "الشيخ صهيب نصيب", group: "فوج 9", role: "sheikh" },
  "admin10@gmail.com": { name: "الأستاذة سعيدة", group: "فوج 10", role: "sheikh" },
  "admin11@gmail.com": { name: "الأستاذة سميرة", group: "فوج 11", role: "sheikh" },
  "admin12@gmail.com": { name: "الأستاذة رقية", group: "فوج 12", role: "sheikh" },
  "admin13@gmail.com": { name: "الأستاذة ثريا", group: "فوج 13", role: "sheikh" },
  "admin14@gmail.com": { name: "الأستاذة أميرة", group: "فوج 14", role: "sheikh" },
  "admin15@gmail.com": { name: "الأستاذة زينب", group: "فوج 15", role: "sheikh" },
  "admin16@gmail.com": { name: "الأستاذة جهاد", group: "فوج 16", role: "sheikh" },
  "admin17@gmail.com": { name: "الأستاذة ميمونه", group: "فوج 17", role: "sheikh" },
  "admin18@gmail.com": { name: "الأستاذة حياة", group: "فوج 18", role: "sheikh" },
  "admin19@gmail.com": { name: "فوج 1 إبتدائي", group: "فوج 19", role: "sheikh" },
  "admin20@gmail.com": { name: "الشيخ عبد الكريم ترممو", group: "فوج 20", role: "sheikh" },
  "admin21@gmail.com": { name: "الشيخ كنيوة عرفات", group: "فوج 21", role: "sheikh" },
  "admin22@gmail.com": { name: "الشيخ عبد الرحمان كنيوة", group: "فوج 22", role: "sheikh" },
};

const sheikhDemoKeys: { [email: string]: string } = {
  "admin1@gmail.com": "demo_sheikh_1",
  "admin2@gmail.com": "demo_sheikh_2",
  "admin3@gmail.com": "demo_sheikh_3",
  "admin4@gmail.com": "demo_sheikh_4",
  "admin5@gmail.com": "demo_sheikh_5",
  "admin6@gmail.com": "demo_sheikh_6",
  "admin7@gmail.com": "demo_sheikh_7",
  "admin8@gmail.com": "demo_sheikh_8",
  "admin9@gmail.com": "demo_sheikh_9",
  "admin10@gmail.com": "demo_sheikh_10",
  "admin11@gmail.com": "demo_sheikh_11",
  "admin12@gmail.com": "demo_sheikh_12",
  "admin13@gmail.com": "demo_sheikh_13",
  "admin14@gmail.com": "demo_sheikh_14",
  "admin15@gmail.com": "demo_sheikh_15",
  "admin16@gmail.com": "demo_sheikh_16",
  "admin17@gmail.com": "demo_sheikh_17",
  "admin18@gmail.com": "demo_sheikh_18",
  "admin19@gmail.com": "demo_sheikh_19",
  "admin20@gmail.com": "demo_sheikh_20",
  "admin21@gmail.com": "demo_sheikh_21",
  "admin22@gmail.com": "demo_sheikh_22",
};

export interface UpdateProfileData extends Partial<AppUser> {
  photoFile?: File | Blob | null;
  backgroundFile?: File | Blob | null;
}

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  isSuperAdmin: boolean;
  isManagement: boolean;
  role: 'sheikh' | 'super_admin' | 'management' | null;
  signUpWithEmail: (email: string, password: string, displayName: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  updateUserProfile: (data: UpdateProfileData) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const role = user?.role || null;
  const isSuperAdmin = role === 'super_admin';
  const isManagement = role === 'management';

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      if (currentUser) {
        const userRef = ref(db, `users/${currentUser.uid}/profile`);
        let snapshot = await get(userRef);

        // Auto-migrate/Initialize user profile and dummy students if they don't exist yet
        if (!snapshot.exists()) {
          try {
            const emailKey = currentUser.email?.toLowerCase().trim() || '';
            const sheikhInfo = sheikhInitialData[emailKey] || { name: currentUser.displayName || 'مستخدم جديد', group: 'فوج غير محدد', role: 'sheikh' };
            const displayName = sheikhInfo.name || currentUser.displayName || 'مستخدم جديد';

            // 1. Write profile
            const profileData = {
              email: currentUser.email,
              displayName: displayName,
              group: sheikhInfo.group,
              role: sheikhInfo.role,
              joinDate: format(new Date(), 'yyyy-MM-dd'),
              isDemo: false
            };
            await set(ref(db, `users/${currentUser.uid}/profile`), profileData);

            // 2. Generate 3 dummy students to avoid an empty dashboard
            const studentsRef = ref(db, `users/${currentUser.uid}/students`);
            const initialStudents: any = {};
            for (let i = 1; i <= 3; i++) {
              const studentId = `student_${currentUser.uid}_${i}`; // Predictable student ID
              initialStudents[studentId] = {
                id: studentId,
                fullName: `طالب ${i} - ${sheikhInfo.group}`,
                birthDate: new Date(2010, 0, 1).toISOString(),
                registrationDate: new Date().toISOString(),
                status: 'نشط',
                educationalLevel: 'متوسط',
                subscriptionTier: 'فئة الأصاغر',
                ownerId: currentUser.uid,
                groupName: sheikhInfo.group,
                memorizedSurahsCount: Math.floor(Math.random() * 10),
                updatedAt: new Date().toISOString(),
                photoURL: ''
              };
            }
            await set(studentsRef, initialStudents);

            // Re-fetch profile snapshot
            snapshot = await get(userRef);
          } catch (e) {
            console.error("Initialization error:", e);
          }
        }

        let appUser: AppUser;
        if (snapshot.exists()) {
          let profileData = snapshot.val();

          // Sync logic for accounts with default values
          const email = currentUser.email || '';
          if (sheikhInitialData[email] && (profileData.group === 'فوج غير محدد' || !profileData.group || profileData.displayName === 'مستخدم جديد')) {
            const info = sheikhInitialData[email];
            const updates = {
              displayName: info.name,
              group: info.group,
              role: info.role
            };
            await update(ref(db, `users/${currentUser.uid}/profile`), updates);
            profileData = { ...profileData, ...updates };
            if (currentUser.displayName !== info.name) {
              await updateProfile(currentUser, { displayName: info.name });
            }
          }

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
            joinDate: format(new Date(), 'yyyy-MM-dd'),
          };
          const newProfileRef = ref(db, `users/${currentUser.uid}/profile`);
          await set(newProfileRef, {
            email: appUser.email,
            displayName: appUser.displayName,
            group: appUser.group,
            role: appUser.role,
            joinDate: appUser.joinDate,
          });
          if (currentUser.displayName !== appUser.displayName) {
            await updateProfile(currentUser, { displayName: appUser.displayName });
          }
        }
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

    const sheikhInfo = sheikhInitialData[email] || { name: displayName, group: 'فوج غير محدد', role: 'sheikh' };

    await updateProfile(newUser, { displayName: sheikhInfo.name });

    const profileData: Omit<AppUser, 'uid' | 'photoURL' | 'adminNotes' | 'adminAwards'> = {
      email: newUser.email,
      displayName: sheikhInfo.name,
      group: sheikhInfo.group,
      role: sheikhInfo.role,
      joinDate: format(new Date(), 'yyyy-MM-dd'),
    };
    const userRef = ref(db, `users/${newUser.uid}/profile`);
    await set(userRef, profileData);
  };

  const signInWithEmail = async (email: string, password: string) => {
    if (!email || !password) {
      throw new Error("Email and password must not be empty.");
    }
    const formattedEmail = email.toLowerCase().trim();
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      const isSheikhAccount = sheikhInitialData[formattedEmail];
      if ((error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found') &&
          isSheikhAccount &&
          password === '123456') {
        try {
          console.log("Auto-registering sheikh:", email);
          await createUserWithEmailAndPassword(auth, email, password);
          return;
        } catch (signUpError: any) {
          console.error("Auto-signup failed:", signUpError);
          throw error;
        }
      }
      throw error;
    }
  }

  const updateUserProfile = async (data: UpdateProfileData) => {
    if (!auth.currentUser) throw new Error("User not authenticated.");

    try {
      const { photoFile, backgroundFile, ...profileData } = data;
      let newPhotoURL = user?.photoURL || null;
      let newBackgroundURL = user?.backgroundURL || null;
      let wasPhotoUploaded = false;
      let wasBackgroundUploaded = false;

      if (photoFile) {
        const imageRef = storageRef(storage, `user_photos/${auth.currentUser.uid}`);
        await uploadBytes(imageRef, photoFile);
        newPhotoURL = await getDownloadURL(imageRef);
        wasPhotoUploaded = true;
      }

      if (backgroundFile) {
        const imageRef = storageRef(storage, `user_backgrounds/${auth.currentUser.uid}`);
        await uploadBytes(imageRef, backgroundFile);
        newBackgroundURL = await getDownloadURL(imageRef);
        wasBackgroundUploaded = true;
      }

      const dbUpdates: { [key: string]: any } = {};
      const authUpdates: { displayName?: string; photoURL?: string } = {};

      // Prepare updates for all provided data for RTDB
      for (const key in profileData) {
        if (Object.prototype.hasOwnProperty.call(profileData, key)) {
          dbUpdates[`users/${auth.currentUser.uid}/profile/${key}`] = (profileData as any)[key];
        }
      }

      if (newPhotoURL && newPhotoURL !== user?.photoURL) {
        dbUpdates[`users/${auth.currentUser.uid}/profile/photoURL`] = newPhotoURL;
        authUpdates.photoURL = newPhotoURL;
      }

      if (newBackgroundURL && newBackgroundURL !== user?.backgroundURL) {
        dbUpdates[`users/${auth.currentUser.uid}/profile/backgroundURL`] = newBackgroundURL;
      }

      if (profileData.displayName && profileData.displayName !== user?.displayName) {
        authUpdates.displayName = profileData.displayName;
      }

      if (Object.keys(dbUpdates).length > 0) {
        await update(ref(db), dbUpdates);
      }

      if (Object.keys(authUpdates).length > 0) {
        await updateProfile(auth.currentUser, authUpdates);
      }

      setUser(prevUser => {
        if (!prevUser) return null;
        const updatedUser = { ...prevUser, ...profileData };
        if (newPhotoURL) {
          updatedUser.photoURL = newPhotoURL;
        }
        if (newBackgroundURL) {
          updatedUser.backgroundURL = newBackgroundURL;
        }
        return updatedUser;
      });

      if (wasPhotoUploaded || wasBackgroundUploaded) {
        const userName = profileData.displayName || user?.displayName || "";
        const prefix = userName.includes("الأستاذة") ? "يا أستاذة" : "يا شيخ";
        toast({
          title: `✅ تم تحديث الصور`,
          description: `تم تحديث ملفك بنجاح ${prefix} ${userName}.`,
        });
      }

    } catch (error) {
      console.error("Error updating profile:", error);
      toast({
        title: '❌ خطأ في التحديث',
        description: 'فشل حفظ التغييرات. يرجى التأكد من اتصالك بالإنترنت والمحاولة مرة أخرى.',
        variant: 'destructive',
      });
      throw error; // Re-throw error to be caught by the calling component
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, isSuperAdmin, isManagement, role, signUpWithEmail, signInWithEmail, updateUserProfile, logout }}>
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
