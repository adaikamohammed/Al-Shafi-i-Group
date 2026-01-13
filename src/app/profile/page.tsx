
"use client";

import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Mail, Users, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ProfilePage() {
    const { user, loading, logout } = useAuth();

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

    return (
        <div className="space-y-6">
             <Card className="w-full max-w-2xl mx-auto">
                <CardHeader className="text-center items-center">
                    <Avatar className="w-24 h-24 mb-4">
                        <AvatarImage src={user.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${user.displayName}`} />
                        <AvatarFallback>{user.displayName?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <CardTitle className="text-2xl font-bold">{user.displayName}</CardTitle>
                    <CardDescription>{user.role === 'super_admin' ? 'مدير عام' : 'شيخ فوج'}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center gap-4 p-3 bg-muted rounded-md">
                        <Mail className="h-5 w-5 text-muted-foreground" />
                        <span className="text-sm">{user.email}</span>
                    </div>
                     <div className="flex items-center gap-4 p-3 bg-muted rounded-md">
                        <Users className="h-5 w-5 text-muted-foreground" />
                        <span className="text-sm">{user.group}</span>
                    </div>
                     <div className="flex items-center gap-4 p-3 bg-muted rounded-md">
                        <Shield className="h-5 w-5 text-muted-foreground" />
                        <span className="text-sm">{user.role === 'super_admin' ? 'صلاحيات كاملة' : 'صلاحيات إدارة فوج'}</span>
                    </div>

                    <div className="flex justify-center pt-4">
                        <Button onClick={logout} variant="outline">تسجيل الخروج</Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
