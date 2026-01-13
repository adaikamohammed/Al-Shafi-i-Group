
"use client";

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, User, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

export default function ProfilePage() {
    const { user, loading, isSuperAdmin } = useAuth();
    const { toast } = useToast();
    const [adminCode, setAdminCode] = useState('');
    const [isAdministrativeView, setIsAdministrativeView] = useState(false);
    
    const handleAdminAccess = () => {
        if (adminCode === 'admin8888') {
            setIsAdministrativeView(true);
            toast({ title: '✅ تم التحقق', description: 'تم الدخول إلى السجل الإداري بنجاح.' });
        } else {
            toast({ title: '❌ خطأ', description: 'كود المدير العام غير صحيح.', variant: 'destructive' });
        }
    };

    if (loading) {
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
                            <Avatar className="w-24 h-24 mb-4">
                                <AvatarImage src={user.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${user.displayName}`} />
                                <AvatarFallback>{user.displayName?.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <CardTitle className="text-2xl">{user.displayName}</CardTitle>
                            <CardDescription>{isSuperAdmin ? "مدير عام" : "شيخ فوج"}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center gap-4 p-3 bg-muted rounded-md">
                                <strong>البريد الإلكتروني:</strong>
                                <span>{user.email}</span>
                            </div>
                            <div className="flex items-center gap-4 p-3 bg-muted rounded-md">
                                <strong>الفوج:</strong>
                                <span>{user.group}</span>
                            </div>
                             {/* Placeholder for future form fields */}
                             <div className="pt-6 text-center">
                                <p className="text-muted-foreground">سيتم تفعيل إمكانية تعديل البيانات ورفع الصورة قريبًا.</p>
                            </div>
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
