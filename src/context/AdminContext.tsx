"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { db, storage } from '@/lib/firebase';
import { ref, set, push, onValue, off, remove, update } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { useToast } from '@/hooks/use-toast';
import { SummerCampItem, AdminDocument } from '@/lib/types';
import { useAuth } from './AuthContext';
import { v4 as uuidv4 } from 'uuid';

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
        };

        const handleDocs = (snapshot: any) => {
            const data = snapshot.val();
            const docs = data ? Object.entries(data).map(([id, doc]) => ({ id, ...(doc as any) })) : [];
            // Sort by newest first
            docs.sort((a: AdminDocument, b: AdminDocument) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
            setAdminDocuments(docs);
            setLoading(false);
        };

        const unsubscribeItems = onValue(itemsRef, handleItems);
        const unsubscribeDocs = onValue(docsRef, handleDocs);

        return () => {
            unsubscribeItems();
            unsubscribeDocs();
        };
    }, [user]);

    const addSummerCampItem = async (item: Omit<SummerCampItem, 'id'>) => {
        try {
            const newItemRef = push(ref(db, 'summer_camp_items'));
            await set(newItemRef, {
                ...item,
                addedBy: user?.uid || 'unknown'
            });
            toast({ title: "✅ تم الإضافة", description: "تمت إضافة العنصر بنجاح" });
        } catch (error) {
            console.error(error);
            toast({ title: "❌ خطأ", description: "حدث خطأ أثناء الإضافة", variant: "destructive" });
        }
    };

    const addMultipleSummerCampItems = async (items: Omit<SummerCampItem, 'id'>[]) => {
        try {
            const updates: Record<string, any> = {};
            items.forEach(item => {
                const newItemRef = push(ref(db, 'summer_camp_items'));
                updates[`summer_camp_items/${newItemRef.key}`] = {
                    ...item,
                    addedBy: user?.uid || 'unknown'
                };
            });
            await update(ref(db), updates);
            toast({ title: "✅ تم الإضافة", description: `تمت إضافة ${items.length} عناصر بنجاح` });
        } catch (error) {
            console.error(error);
            toast({ title: "❌ خطأ", description: "حدث خطأ أثناء إضافة مجموعة العناصر", variant: "destructive" });
        }
    };

    const updateSummerCampItem = async (id: string, updates: Partial<SummerCampItem>) => {
        try {
            await update(ref(db, `summer_camp_items/${id}`), updates);
            toast({ title: "✅ تم التحديث", description: "تم تحديث العنصر بنجاح" });
        } catch (error) {
            console.error(error);
            toast({ title: "❌ خطأ", description: "حدث خطأ أثناء التحديث", variant: "destructive" });
        }
    };

    const deleteSummerCampItem = async (id: string) => {
        try {
            await remove(ref(db, `summer_camp_items/${id}`));
            toast({ title: "🗑️ تم الحذف", description: "تم حذف العنصر بنجاح" });
        } catch (error) {
            console.error(error);
            toast({ title: "❌ خطأ", description: "حدث خطأ أثناء الحذف", variant: "destructive" });
        }
    };

    const toggleItemProvided = async (id: string, currentStatus: boolean) => {
        try {
            await update(ref(db, `summer_camp_items/${id}`), {
                isProvided: !currentStatus,
                providedAt: !currentStatus ? new Date().toISOString() : null
            });
        } catch (error) {
            console.error(error);
            toast({ title: "❌ خطأ", description: "تعذر تغيير الحالة", variant: "destructive" });
        }
    };

    const toggleItemReturned = async (id: string, currentStatus: boolean) => {
        try {
            await update(ref(db, `summer_camp_items/${id}`), {
                isReturned: !currentStatus,
                returnedAt: !currentStatus ? new Date().toISOString() : null
            });
        } catch (error) {
            console.error(error);
            toast({ title: "❌ خطأ", description: "تعذر تغيير حالة الإرجاع", variant: "destructive" });
        }
    };

    const bulkUpdateItems = async (ids: string[], updates: Partial<SummerCampItem>) => {
        try {
            const dbUpdates: Record<string, any> = {};
            ids.forEach(id => {
                // Fetch the existing item to only update specified fields
                // Firebase generic update at root works magically like this:
                // path: `summer_camp_items/123/isProvided` : true
                Object.entries(updates).forEach(([key, value]) => {
                    dbUpdates[`summer_camp_items/${id}/${key}`] = value;
                });
            });
            await update(ref(db), dbUpdates);
            toast({ title: "✅ تم التحديث الجماعي", description: `تم تحديث ${ids.length} عناصر بنجاح` });
        } catch (error) {
            console.error(error);
            toast({ title: "❌ خطأ", description: "حدث خطأ أثناء التحديث الجماعي", variant: "destructive" });
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

            const newDoc: Omit<AdminDocument, 'id'> = {
                title,
                url,
                storagePath,
                type,
                notes,
                uploadedAt: new Date().toISOString(),
                uploadedBy: user?.uid,
                size: file.size
            };

            await set(ref(db, `admin_documents/${docId}`), newDoc);
            toast({ title: "✅ تم الرفع", description: "تم رفع الوثيقة بنجاح" });
        } catch (error) {
            console.error(error);
            toast({ title: "❌ خطأ", description: "حدث خطأ أثناء الرفع", variant: "destructive" });
            throw error;
        }
    };

    const deleteAdminDocument = async (doc: AdminDocument) => {
        try {
            // 1. Delete from Storage
            const fileRef = storageRef(storage, doc.storagePath);
            await deleteObject(fileRef);

            // 2. Delete from Database
            await remove(ref(db, `admin_documents/${doc.id}`));

            toast({ title: "🗑️ تم الحذف", description: "تم حذف الوثيقة بنجاح" });
        } catch (error) {
            console.error(error);
            toast({ title: "❌ خطأ", description: "حدث خطأ أثناء الحذف", variant: "destructive" });
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
    if (context === undefined) {
        throw new Error('useAdmin must be used within an AdminProvider');
    }
    return context;
};
