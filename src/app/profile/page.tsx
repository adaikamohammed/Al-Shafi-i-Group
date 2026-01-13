
"use client";

import React, { useState, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, User, KeyRound, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

export default function ProfilePage() {
    const { user, loading: authLoading, isSuperAdmin, updateUserProfile } = useAuth();
    const { toast } = useToast();
    const [adminCode, setAdminCode] = useState('');
    const [isAdministrativeView, setIsAdministrativeView] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(user?.photoURL || null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 500 * 1024) { // 500KB
            toast({ title: 'خطأ', description: 'حجم الصورة كبير جدًا. الحد الأقصى هو 500 كيلوبايت.', variant: 'destructive' });
            return;
        }
        if (!['image/jpeg', 'image/png'].includes(file.type)) {
            toast({ title: 'خطأ', description: 'صيغة الملف غير مدعومة. الرجاء رفع صورة بصيغة JPG أو PNG.', variant: 'destructive' });
            return;
        }
        
        setPhotoFile(file);
        const reader = new FileReader();
        reader.onload = (loadEvent) => {
            setPhotoPreview(loadEvent.target?.result as string);
        };
        reader.readAsDataURL(file);
    };

    const handleSaveChanges = async () => {
        if (!user || !photoFile) return;
        setIsSaving(true);
        try {
            await updateUserProfile({ photoFile });
            toast({ title: '✅ تم التحديث', description: 'تم تحديث الصورة الشخصية بنجاح.'});
            setPhotoFile(null); // Reset file input after save
        } catch (error) {
            toast({ title: '❌ خطأ', description: 'فشل تحديث الصورة الشخصية.', variant: 'destructive'});
        } finally {
            setIsSaving(false);
        }
    }
    
    const handleAdminAccess = () => {
        if (adminCode === 'admin8888') {
            setIsAdministrativeView(true);
            toast({ title: '✅ تم التحقق', description: 'تم الدخول إلى السجل الإداري بنجاح.' });
        } else {
            toast({ title: '❌ خطأ', description: 'كود المدير العام غير صحيح.', variant: 'destructive' });
        }
    };

    if (authLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }

    if (!user) {
        return (
             <div className="flex items-center justify-center h-full">
                <p>الرجاء تسجيل الدخول لعرض الملف الشخصي.</p>
            </div>
        );
    }
    
    const pageTitle = `الملف الشخصي: ${user.displayName}`;

    return (
        <div className="space-y-6">
             <h1 className="text-3xl font-headline font-bold">{pageTitle}</h1>
            <Tabs defaultValue="public" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="public">بياناتي العامة</TabsTrigger>
                    <TabsTrigger value="admin" disabled={!isSuperAdmin}>السجل الإداري</TabsTrigger>
                </TabsList>
                
                <TabsContent value="public">
                     <Card>
                        <CardHeader className="items-center text-center">
                            <input type="file" ref={fileInputRef} onChange={handlePhotoChange} accept="image/png, image/jpeg" className="hidden" />
                             <Avatar className="w-24 h-24 mb-4 border-4 border-muted">
                                <AvatarImage src={photoPreview || user.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${user.displayName}`} />
                                <AvatarFallback>{user.displayName?.charAt(0)}</AvatarFallback>
                            </Avatar>
                             <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2">
                                <Edit className="h-4 w-4" />
                                تغيير الصورة
                            </Button>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center gap-4 p-3 bg-muted rounded-md">
                                <strong>الاسم الكامل:</strong>
                                <span>{user.displayName}</span>
                            </div>
                            <div className="flex items-center gap-4 p-3 bg-muted rounded-md">
                                <strong>البريد الإلكتروني:</strong>
                                <span>{user.email}</span>
                            </div>
                            <div className="flex items-center gap-4 p-3 bg-muted rounded-md">
                                <strong>الفوج:</strong>
                                <span>{user.group}</span>
                            </div>
                             <div className="flex items-center gap-4 p-3 bg-muted rounded-md">
                                <strong>الدور:</strong>
                                <span>{isSuperAdmin ? "مدير عام" : "شيخ فوج"}</span>
                            </div>

                             {photoFile && <div className="flex justify-center pt-4 border-t">
                                <Button onClick={handleSaveChanges} disabled={isSaving}>
                                    {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : null}
                                    حفظ الصورة الجديدة
                                </Button>
                            </div>}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="admin">
                     {isAdministrativeView ? (
                        <Card>
                            <CardHeader>
                                <CardTitle>السجل الإداري</CardTitle>
                                <CardDescription>عرض الإجراءات الإدارية الخاصة بالشيخ.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p>هنا سيتم عرض السجل الإداري...</p>
                            </CardContent>
                        </Card>
                    ) : (
                         <Card className="flex flex-col items-center justify-center p-8 text-center">
                            <KeyRound className="h-12 w-12 text-destructive mb-4" />
                            <CardTitle>وصول مقيد</CardTitle>
                            <CardDescription className="mb-4">هذا الجزء مخصص للمدير العام فقط.</CardDescription>
                             {isSuperAdmin && (
                                <div className="flex w-full max-w-sm items-center space-x-2 space-x-reverse">
                                    <Input 
                                        type="password" 
                                        placeholder="أدخل كود المدير العام"
                                        value={adminCode}
                                        onChange={(e) => setAdminCode(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleAdminAccess()}
                                    />
                                    <Button onClick={handleAdminAccess}>دخول</Button>
                                </div>
                             )}
                        </Card>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    )
}
