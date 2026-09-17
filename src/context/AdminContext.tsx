"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { db, storage } from '@/lib/firebase';
import { ref, set, push, onValue, off, remove, update } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { useToast } from '@/hooks/use-toast';
import { SummerCampItem, AdminDocument } from '@/lib/types';
import { useAuth } from './AuthContext';
import { v4 as uuidv4 } from 'uuid';
import { saveEncrypted, loadEncrypted } from '@/lib/cryptoStore';
import { isEffectiveOnline, executeWithTimeout, queueOfflineMutation } from '@/lib/offlineSyncEngine';
import { sanitizeData } from '@/lib/utils';

interface AdminContextType {
    summerCampItems: SummerCampItem[];
    adminDocuments: AdminDocument[];
    loading: boolean;
    addSummerCampItem: (item: Omit<SummerCampItem, 'id'>) => Promise<void>;
    addMultipleSummerCampItems: (items: Omit<SummerCampItem, 'id'>[]) => Promise<void>;
    updateSummerCampItem: (id: string, updates: Partial<SummerCampItem>) => Promise<void>;
    deleteSummerCampItem: (id: string) => Promise<void>;
    toggleItemProvided: (id: string, currentStatus: boolean) => Promise<void>;
    toggleItemReturned: (id: string, currentStatus: boolean) => Promise<void>;
    bulkUpdateItems: (ids: string[], updates: Partial<SummerCampItem>) => Promise<void>;
    uploadAdminDocument: (file: File, title: string, notes: string, type: string) => Promise<void>;
    deleteAdminDocument: (doc: AdminDocument) => Promise<void>;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export const AdminProvider = ({ children }: { children: ReactNode }) => {
    const { user } = useAuth();
    const { toast } = useToast();
    const [summerCampItems, setSummerCampItems] = useState<SummerCampItem[]>([]);
    const [adminDocuments, setAdminDocuments] = useState<AdminDocument[]>([]);
    const [loading, setLoading] = useState(true);

    // 1. استرجاع فوري من الكاش المشفر محلياً (Cache-First Hydration)
    useEffect(() => {
        let isMounted = true;
        async function hydrateFromLocalDB() {
            try {
                const [cachedItems, cachedDocs] = await Promise.all([
                    loadEncrypted<SummerCampItem[]>('summerCampItems', []),
                    loadEncrypted<AdminDocument[]>('adminDocuments', []),
                ]);
                if (!isMounted) return;
                if (cachedItems && cachedItems.length > 0) {
                    setSummerCampItems(cachedItems);
                }
                if (cachedDocs && cachedDocs.length > 0) {
                    setAdminDocuments(cachedDocs);
                }
            } catch (err) {
                console.warn('Local AdminContext hydration error:', err);
            }
        }
        hydrateFromLocalDB();
        return () => { isMounted = false; };
    }, []);

    // 2. مستمعات Firebase Realtime Database مع الحفظ المشفر التلقائي
    useEffect(() => {
        if (!user) {
            setSummerCampItems([]);
            setAdminDocuments([]);
            setLoading(false);
            return;
        }

        const itemsRef = ref(db, 'summer_camp_items');
        const docsRef = ref(db, 'admin_documents');

        const handleItems = (snapshot: any) => {
            const data = snapshot.val();
            const items = data ? Object.entries(data).map(([id, item]) => ({ id, ...(item as any) })) : [];
            setSummerCampItems(items);
            saveEncrypted('summerCampItems', items);
        };

        const handleDocs = (snapshot: any) => {
            const data = snapshot.val();
            const docs = data ? Object.entries(data).map(([id, doc]) => ({ id, ...(doc as any) })) : [];
            // Sort by newest first
            docs.sort((a: AdminDocument, b: AdminDocument) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
            setAdminDocuments(docs);
            saveEncrypted('adminDocuments', docs);
            setLoading(false);
        };

        const unsubscribeItems = onValue(itemsRef, handleItems, (err: any) => {
            console.warn('Items listener offline/error:', err);
            setLoading(false);
        });

        const unsubscribeDocs = onValue(docsRef, handleDocs, (err: any) => {
            console.warn('Docs listener offline/error:', err);
            setLoading(false);
        });

        return () => {
            unsubscribeItems();
            unsubscribeDocs();
        };
    }, [user]);

    const addSummerCampItem = async (item: Omit<SummerCampItem, 'id'>) => {
        const id = push(ref(db, 'summer_camp_items')).key || uuidv4();
        const newItem: SummerCampItem = {
            ...item,
            id,
            addedBy: user?.uid || 'unknown'
        };

        // 1. التحديث الفوري للحالة المحلية
        setSummerCampItems(prev => {
            const next = [...prev, newItem];
            saveEncrypted('summerCampItems', next);
            return next;
        });

        const isOnline = isEffectiveOnline();
        const path = `summer_camp_items/${id}`;
        const sanitized = sanitizeData(newItem);

        if (isOnline) {
            try {
                await executeWithTimeout(set(ref(db, path), sanitized), 2500);
                toast({ title: "✅ تم الإضافة", description: "تمت إضافة العنصر بنجاح" });
            } catch (error) {
                await queueOfflineMutation({
                    type: 'SET',
                    path,
                    payload: sanitized,
                    description: `إضافة عتاد: ${item.name}`,
                    ownerId: user?.uid || 'admin',
                    authorUid: user?.uid || 'admin'
                });
                toast({ title: "💾 تم الحفظ محلياً", description: "تم حفظ العنصر محلياً وسيتم رفعه تلقائياً." });
            }
        } else {
            await queueOfflineMutation({
                type: 'SET',
                path,
                payload: sanitized,
                description: `إضافة عتاد: ${item.name}`,
                ownerId: user?.uid || 'admin',
                authorUid: user?.uid || 'admin'
            });
            toast({ title: "💾 تم الحفظ أوفلاين", description: "تم حفظ العنصر محلياً وسيتم رفعه عند الاتصال بالإنترنت." });
        }
    };

    const addMultipleSummerCampItems = async (items: Omit<SummerCampItem, 'id'>[]) => {
        const updates: Record<string, any> = {};
        const createdItems: SummerCampItem[] = [];

        items.forEach(item => {
            const id = push(ref(db, 'summer_camp_items')).key || uuidv4();
            const newItem: SummerCampItem = {
                ...item,
                id,
                addedBy: user?.uid || 'unknown'
            };
            createdItems.push(newItem);
            updates[`summer_camp_items/${id}`] = newItem;
        });

        // 1. التحديث الفوري للحالة المحلية
        setSummerCampItems(prev => {
            const next = [...prev, ...createdItems];
            saveEncrypted('summerCampItems', next);
            return next;
        });

        const isOnline = isEffectiveOnline();
        const sanitized = sanitizeData(updates);

        if (isOnline) {
            try {
                await executeWithTimeout(update(ref(db), sanitized), 2500);
                toast({ title: "✅ تم الإضافة", description: `تمت إضافة ${items.length} عناصر بنجاح` });
            } catch (error) {
                await queueOfflineMutation({
                    type: 'UPDATE',
                    path: '',
                    payload: sanitized,
                    description: `إضافة مجموعة عتاد (${items.length} عنصر)`,
                    ownerId: user?.uid || 'admin',
                    authorUid: user?.uid || 'admin'
                });
                toast({ title: "💾 تم الحفظ محلياً", description: "تم حفظ العناصر محلياً وسيتم رفعها تلقائياً." });
            }
        } else {
            await queueOfflineMutation({
                type: 'UPDATE',
                path: '',
                payload: sanitized,
                description: `إضافة مجموعة عتاد (${items.length} عنصر)`,
                ownerId: user?.uid || 'admin',
                authorUid: user?.uid || 'admin'
            });
            toast({ title: "💾 تم الحفظ أوفلاين", description: "تم حفظ العناصر محلياً وسيتم الرفع فور توفر الإنترنت." });
        }
    };

    const updateSummerCampItem = async (id: string, updates: Partial<SummerCampItem>) => {
        // 1. التحديث الفوري للحالة المحلية
        setSummerCampItems(prev => {
            const next = prev.map(item => item.id === id ? { ...item, ...updates } : item);
            saveEncrypted('summerCampItems', next);
            return next;
        });

        const isOnline = isEffectiveOnline();
        const path = `summer_camp_items/${id}`;
        const sanitized = sanitizeData(updates);

        if (isOnline) {
            try {
                await executeWithTimeout(update(ref(db, path), sanitized), 2500);
                toast({ title: "✅ تم التحديث", description: "تم تحديث العنصر بنجاح" });
            } catch (error) {
                await queueOfflineMutation({
                    type: 'UPDATE',
                    path,
                    payload: sanitized,
                    description: `تحديث عتاد: ${id}`,
                    ownerId: user?.uid || 'admin',
                    authorUid: user?.uid || 'admin'
                });
            }
        } else {
            await queueOfflineMutation({
                type: 'UPDATE',
                path,
                payload: sanitized,
                description: `تحديث عتاد: ${id}`,
                ownerId: user?.uid || 'admin',
                authorUid: user?.uid || 'admin'
            });
        }
    };

    const deleteSummerCampItem = async (id: string) => {
        // 1. التحديث الفوري للحالة المحلية
        setSummerCampItems(prev => {
            const next = prev.filter(item => item.id !== id);
            saveEncrypted('summerCampItems', next);
            return next;
        });

        const isOnline = isEffectiveOnline();
        const path = `summer_camp_items/${id}`;

        if (isOnline) {
            try {
                await executeWithTimeout(remove(ref(db, path)), 2500);
                toast({ title: "🗑️ تم الحذف", description: "تم حذف العنصر بنجاح" });
            } catch (error) {
                await queueOfflineMutation({
                    type: 'REMOVE',
                    path,
                    description: `حذف عتاد: ${id}`,
                    ownerId: user?.uid || 'admin',
                    authorUid: user?.uid || 'admin'
                });
            }
        } else {
            await queueOfflineMutation({
                type: 'REMOVE',
                path,
                description: `حذف عتاد: ${id}`,
                ownerId: user?.uid || 'admin',
                authorUid: user?.uid || 'admin'
            });
            toast({ title: "🗑️ تم الحذف محلياً", description: "تم حذف العنصر وسيتم تطبيق الحذف سحابياً لاحقاً." });
        }
    };

    const toggleItemProvided = async (id: string, currentStatus: boolean) => {
        await updateSummerCampItem(id, {
            isProvided: !currentStatus,
            providedAt: !currentStatus ? new Date().toISOString() : null
        });
    };

    const toggleItemReturned = async (id: string, currentStatus: boolean) => {
        await updateSummerCampItem(id, {
            isReturned: !currentStatus,
            returnedAt: !currentStatus ? new Date().toISOString() : null
        });
    };

    const bulkUpdateItems = async (ids: string[], updates: Partial<SummerCampItem>) => {
        // 1. التحديث الفوري للحالة المحلية
        setSummerCampItems(prev => {
            const next = prev.map(item => ids.includes(item.id) ? { ...item, ...updates } : item);
            saveEncrypted('summerCampItems', next);
            return next;
        });

        const dbUpdates: Record<string, any> = {};
        ids.forEach(id => {
            Object.entries(updates).forEach(([key, value]) => {
                dbUpdates[`summer_camp_items/${id}/${key}`] = value;
            });
        });

        const isOnline = isEffectiveOnline();
        const sanitized = sanitizeData(dbUpdates);

        if (isOnline) {
            try {
                await executeWithTimeout(update(ref(db), sanitized), 2500);
                toast({ title: "✅ تم التحديث الجماعي", description: `تم تحديث ${ids.length} عناصر بنجاح` });
            } catch (error) {
                await queueOfflineMutation({
                    type: 'UPDATE',
                    path: '',
                    payload: sanitized,
                    description: `تحديث جماعي لـ ${ids.length} عناصر`,
                    ownerId: user?.uid || 'admin',
                    authorUid: user?.uid || 'admin'
                });
            }
        } else {
            await queueOfflineMutation({
                type: 'UPDATE',
                path: '',
                payload: sanitized,
                description: `تحديث جماعي لـ ${ids.length} عناصر`,
                ownerId: user?.uid || 'admin',
                authorUid: user?.uid || 'admin'
            });
            toast({ title: "💾 تم التحديث محلياً", description: "تم الحفظ محلياً وسيتم التحديث السحابي فور توفر الإنترنت." });
        }
    };

    const uploadAdminDocument = async (file: File, title: string, notes: string, type: string) => {
        try {
            const docId = uuidv4();
            const fileExt = file.name.split('.').pop();
            const storagePath = `admin_docs/${docId}.${fileExt}`;
            const fileRef = storageRef(storage, storagePath);

            await uploadBytes(fileRef, file);
            const url = await getDownloadURL(fileRef);

            const newDoc: AdminDocument = {
                id: docId,
                title,
                url,
                storagePath,
                type,
                notes,
                uploadedAt: new Date().toISOString(),
                uploadedBy: user?.uid || 'unknown',
                size: file.size
            };

            // 1. التحديث الفوري للحالة المحلية
            setAdminDocuments(prev => {
                const next = [newDoc, ...prev];
                saveEncrypted('adminDocuments', next);
                return next;
            });

            await set(ref(db, `admin_documents/${docId}`), sanitizeData(newDoc));
            toast({ title: "✅ تم الرفع", description: "تم رفع الوثيقة بنجاح" });
        } catch (error) {
            console.error(error);
            toast({ title: "❌ خطأ", description: "حدث خطأ أثناء الرفع", variant: "destructive" });
            throw error;
        }
    };

    const deleteAdminDocument = async (doc: AdminDocument) => {
        // 1. التحديث الفوري للحالة المحلية
        setAdminDocuments(prev => {
            const next = prev.filter(d => d.id !== doc.id);
            saveEncrypted('adminDocuments', next);
            return next;
        });

        const isOnline = isEffectiveOnline();
        const path = `admin_documents/${doc.id}`;

        if (isOnline) {
            try {
                if (doc.storagePath) {
                    try {
                        const fileRef = storageRef(storage, doc.storagePath);
                        await deleteObject(fileRef);
                    } catch {}
                }
                await executeWithTimeout(remove(ref(db, path)), 2500);
                toast({ title: "🗑️ تم الحذف", description: "تم حذف الوثيقة بنجاح" });
            } catch (error) {
                await queueOfflineMutation({
                    type: 'REMOVE',
                    path,
                    description: `حذف وثيقة: ${doc.title}`,
                    ownerId: user?.uid || 'admin',
                    authorUid: user?.uid || 'admin'
                });
            }
        } else {
            await queueOfflineMutation({
                type: 'REMOVE',
                path,
                description: `حذف وثيقة: ${doc.title}`,
                ownerId: user?.uid || 'admin',
                authorUid: user?.uid || 'admin'
            });
            toast({ title: "🗑️ تم الحذف محلياً", description: "تم حذف الوثيقة محلياً وسيتم تطبيق الحذف سحابياً لاحقاً." });
        }
    };

    return (
        <AdminContext.Provider value={{
            summerCampItems,
            adminDocuments,
            loading,
            addSummerCampItem,
            addMultipleSummerCampItems,
            updateSummerCampItem,
            deleteSummerCampItem,
            toggleItemProvided,
            toggleItemReturned,
            bulkUpdateItems,
            uploadAdminDocument,
            deleteAdminDocument
        }}>
            {children}
        </AdminContext.Provider>
    );
};

export const useAdmin = () => {
    const context = useContext(AdminContext);
    if (!context) {
        throw new Error('useAdmin must be used within an AdminProvider');
    }
    return context;
};
