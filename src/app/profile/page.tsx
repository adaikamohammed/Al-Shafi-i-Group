
"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, User, KeyRound, Edit, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function ProfilePage() {
    const { user, loading: authLoading, isSuperAdmin, updateUserProfile } = useAuth();
    const { toast } = useToast();
    
    const [isSaving, setIsSaving] = useState(false);
    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [formData, setFormData] = useState({
        displayName: '',
        address: '',
        maritalStatus: 'أعزب',
        phone: '',
        secondaryPhone: '',
        certifications: '',
        bio: '',
        joinDate: '',
    });

    useEffect(() => {
        if (user) {
            setFormData({
                displayName: user.displayName || '',
                address: user.address || '',
                maritalStatus: user.maritalStatus || 'أعزب',
                phone: user.phone || '',
                secondaryPhone: user.secondaryPhone || '',
                certifications: user.certifications || '',
                bio: user.bio || '',
                joinDate: user.joinDate || '',
            });
            setPhotoPreview(user.photoURL || null);
        }
    }, [user]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | string, field: keyof typeof formData) => {
        if(typeof e === 'string') {
            setFormData(prev => ({ ...prev, [field]: e }));
        } else {
            const { name, value } = e.target;
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };


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
        if (!user) return;
        setIsSaving(true);
        try {
            await updateUserProfile({ ...formData, photoFile });
            toast({ title: `✅ تم تحديث ملفك بنجاح يا شيخ ${formData.displayName}` });
            setPhotoFile(null); // Reset file input after save
        } catch (error) {
            toast({ title: '❌ خطأ', description: 'فشل تحديث الملف الشخصي.', variant: 'destructive'});
        } finally {
            setIsSaving(false);
        }
    }
    
    if (authLoading || !user) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
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
                            <CardTitle>الهوية البصرية والمعلومات الشخصية</CardTitle>
                             <CardDescription>
                                هذه المعلومات ستظهر للمدير العام وتساعد في تخصيص تجربتك.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex flex-col items-center gap-4">
                                <input type="file" ref={fileInputRef} onChange={handlePhotoChange} accept="image/png, image/jpeg" className="hidden" />
                                 <Avatar className="w-24 h-24 mb-2 border-4 border-muted">
                                    <AvatarImage src={photoPreview || `https://api.dicebear.com/7.x/initials/svg?seed=${user.displayName}`} />
                                    <AvatarFallback>{user.displayName?.charAt(0)}</AvatarFallback>
                                </Avatar>
                                 <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2">
                                    <Edit className="h-4 w-4" />
                                    تغيير الصورة الشخصية
                                </Button>
                            </div>

                            <div className="space-y-4">
                               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                 <div className="space-y-2">
                                     <Label htmlFor="displayName">الإسم الكامل</Label>
                                     <Input id="displayName" name="displayName" value={formData.displayName} onChange={(e) => handleInputChange(e, 'displayName')} />
                                 </div>
                                 <div className="space-y-2">
                                    <Label htmlFor="maritalStatus">الحالة الاجتماعية</Label>
                                     <Select dir="rtl" name="maritalStatus" value={formData.maritalStatus} onValueChange={(value) => handleInputChange(value, 'maritalStatus')}>
                                        <SelectTrigger id="maritalStatus"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="أعزب">أعزب</SelectItem>
                                            <SelectItem value="متزوج">متزوج</SelectItem>
                                        </SelectContent>
                                    </Select>
                                 </div>
                                 <div className="space-y-2">
                                     <Label htmlFor="phone">رقم الهاتف الشخصي</Label>
                                     <Input id="phone" name="phone" type="tel" value={formData.phone} onChange={(e) => handleInputChange(e, 'phone')}/>
                                 </div>
                                  <div className="space-y-2">
                                     <Label htmlFor="secondaryPhone">رقم احتياطي</Label>
                                     <Input id="secondaryPhone" name="secondaryPhone" type="tel" value={formData.secondaryPhone} onChange={(e) => handleInputChange(e, 'secondaryPhone')}/>
                                 </div>
                                 <div className="space-y-2">
                                     <Label htmlFor="address">مقر السكن</Label>
                                     <Input id="address" name="address" value={formData.address} onChange={(e) => handleInputChange(e, 'address')}/>
                                 </div>
                                  <div className="space-y-2">
                                     <Label htmlFor="joinDate">تاريخ الانضمام</Label>
                                     <Input id="joinDate" name="joinDate" value={formData.joinDate} disabled />
                                 </div>
                                <div className="space-y-2 md:col-span-2">
                                    <Label htmlFor="certifications">الإجازات والروايات</Label>
                                    <Textarea id="certifications" name="certifications" placeholder="مثال: إجازة في رواية ورش عن نافع..." value={formData.certifications} onChange={(e) => handleInputChange(e, 'certifications')} />
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <Label htmlFor="bio">نبذة قصيرة</Label>
                                    <Textarea id="bio" name="bio" placeholder="اكتب نبذة تعريفية مختصرة عنك..." value={formData.bio} onChange={(e) => handleInputChange(e, 'bio')} />
                                </div>
                               </div>
                            </div>
                           
                             <div className="flex justify-center pt-4 border-t">
                                <Button onClick={handleSaveChanges} disabled={isSaving} size="lg">
                                    {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : <Save className="ml-2 h-4 w-4" />}
                                    حفظ التعديلات
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="admin">
                     <Card className="flex flex-col items-center justify-center p-8 text-center">
                        <KeyRound className="h-12 w-12 text-destructive mb-4" />
                        <CardTitle>وصول مقيد</CardTitle>
                        <CardDescription className="mb-4">هذا الجزء مخصص للمدير العام فقط.</CardDescription>
                         {isSuperAdmin && (
                            <div className="flex w-full max-w-sm items-center space-x-2 space-x-reverse">
                                <Input 
                                    type="password" 
                                    placeholder="أدخل كود المدير العام"
                                />
                                <Button>دخول</Button>
                            </div>
                         )}
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}
