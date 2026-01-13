

"use client";

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useStudentContext } from '@/context/StudentContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, User, KeyRound, Edit, Save, Users, CheckCircle, BookCopy, BookHeart, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';

export default function ProfilePage() {
    const { user, loading: authLoading, isSuperAdmin, updateUserProfile } = useAuth();
    const { students, dailySessions, surahProgress } = useStudentContext();
    const { toast } = useToast();
    
    const [isSaving, setIsSaving] = useState(false);
    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [isUnlockModalOpen, setUnlockModalOpen] = useState(false);
    const [adminCode, setAdminCode] = useState('');
    const [isAdminViewUnlocked, setIsAdminViewUnlocked] = useState(false);

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
    
    // Admin-specific fields state
    const [adminNotes, setAdminNotes] = useState('');
    const [adminAwards, setAdminAwards] = useState('');


    const performanceStats = useMemo(() => {
        if (!user || !students || !dailySessions) {
            return { studentCount: 0, attendanceRate: 0, khatmeenCount: 0, totalMasteredSurahs: 0 };
        }
        
        const groupName = isSuperAdmin ? undefined : user.group;

        const groupStudents = students.filter(s => {
            if (s.status !== 'نشط') return false;
            return groupName ? s.groupName === groupName : true;
        });
        
        const studentCount = groupStudents.length;

        let totalMasteredSurahs = 0;
        const khatmeenCount = groupStudents.filter(student => {
             const studentProgress = surahProgress ? (surahProgress[student.id] || {}) : {};
             const masteredCount = Object.values(studentProgress).filter(status => status === 2).length;
             totalMasteredSurahs += masteredCount;
             return (student.memorizedSurahsCount || 0) >= 114;
        }).length;

        const currentMonthStart = startOfMonth(new Date());
        const currentMonthEnd = endOfMonth(new Date());

        const sessionsInMonth = Object.values(dailySessions ?? {}).flatMap(day => Object.values(day)).filter(session => {
            if(!session.date) return false;
            const sessionDate = parseISO(session.date);
            return sessionDate >= currentMonthStart && sessionDate <= currentMonthEnd;
        });

        let totalPresent = 0;
        let totalHeld = 0;
        
        const scheduledSessions = sessionsInMonth.filter(s => s.sessionType === 'حصة أساسية' || s.sessionType === 'حصة تعويضية' || (s.sessionType === 'غياب الشيخ' && s.substituteTeacher));
        
        totalHeld = groupStudents.length * scheduledSessions.length;

        groupStudents.forEach(student => {
            scheduledSessions.forEach(session => {
                const record = (session.records ?? []).find(r => r.studentId === student.id);
                if (record && (record.attendance === 'حاضر' || record.attendance === 'متأخر')) {
                    totalPresent++;
                }
            });
        });
        
        const attendanceRate = totalHeld > 0 ? (totalPresent / totalHeld) * 100 : 0;

        return { studentCount, attendanceRate, khatmeenCount, totalMasteredSurahs };

    }, [user, students, dailySessions, isSuperAdmin, surahProgress]);

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
            setAdminNotes(user.adminNotes || '');
            setAdminAwards(user.adminAwards || '');
            setPhotoPreview(user.photoURL || null);
            if(isSuperAdmin) setIsAdminViewUnlocked(true); // Auto-unlock for super admin
        }
    }, [user, isSuperAdmin]);

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
            toast({ title: `✅ تم تحديث ملفك الشخصي بنجاح يا شيخ ${formData.displayName}` });
            setPhotoFile(null); // Reset file input after save
        } catch (error) {
            toast({ title: '❌ خطأ', description: 'فشل تحديث الملف الشخصي.', variant: 'destructive'});
        } finally {
            setIsSaving(false);
        }
    }
    
    const handleSaveAdminChanges = async () => {
        if (!user || !isAdminViewUnlocked) return;
        setIsSaving(true);
        try {
            await updateUserProfile({ joinDate: formData.joinDate, adminNotes, adminAwards });
            toast({ title: `✅ تم تحديث السجل الإداري للشيخ ${formData.displayName}` });
        } catch (error) {
            toast({ title: '❌ خطأ', description: 'فشل تحديث السجل الإداري.', variant: 'destructive'});
        } finally {
            setIsSaving(false);
        }
    }


    const handleUnlock = () => {
        if (adminCode === 'admin8888') {
            setIsAdminViewUnlocked(true);
            setUnlockModalOpen(false);
            setAdminCode('');
            toast({ title: '✅ تم فتح الوصول', description: 'يمكنك الآن عرض وتعديل السجل الإداري.' });
        } else {
            toast({ title: '❌ خطأ', description: 'كود الإدارة غير صحيح.', variant: 'destructive' });
        }
    };
    
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
            
             <Card>
                <CardHeader>
                    <CardTitle>بطاقات إحصائية سريعة</CardTitle>
                    <CardDescription>نظرة عامة على أداء فوجك هذا الشهر.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="flex items-center p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                        <Users className="h-8 w-8 text-blue-500 mr-4" />
                        <div>
                            <p className="text-sm text-blue-700 dark:text-blue-200">عدد الطلبة النشطين</p>
                            <p className="text-2xl font-bold">{performanceStats.studentCount}</p>
                        </div>
                    </div>
                     <div className="flex items-center p-4 bg-green-50 dark:bg-green-900/30 rounded-lg">
                        <CheckCircle className="h-8 w-8 text-green-500 mr-4" />
                        <div>
                            <p className="text-sm text-green-700 dark:text-green-200">معدل الحضور الشهري</p>
                            <p className="text-2xl font-bold">{performanceStats.attendanceRate.toFixed(1)}%</p>
                        </div>
                    </div>
                     <div className="flex items-center p-4 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
                        <BookHeart className="h-8 w-8 text-purple-500 mr-4" />
                        <div>
                            <p className="text-sm text-purple-700 dark:text-purple-200">عدد الخاتمين</p>
                            <p className="text-2xl font-bold">{performanceStats.khatmeenCount}</p>
                        </div>
                    </div>
                     <div className="flex items-center p-4 bg-yellow-50 dark:bg-yellow-900/30 rounded-lg">
                        <BookCopy className="h-8 w-8 text-yellow-500 mr-4" />
                        <div>
                            <p className="text-sm text-yellow-700 dark:text-yellow-200">إجمالي السور المتقنة</p>
                            <p className="text-2xl font-bold">{performanceStats.totalMasteredSurahs}</p>
                        </div>
                    </div>
                </CardContent>
             </Card>

            <Tabs defaultValue="public" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="public">بياناتي العامة</TabsTrigger>
                    <TabsTrigger value="admin" onClick={(e) => {if(!isAdminViewUnlocked){ e.preventDefault(); setUnlockModalOpen(true); }}}>السجل الإداري</TabsTrigger>
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
                                     <Label htmlFor="joinDate">عضو في المدرسة منذ</Label>
                                     <Input id="joinDate" name="joinDate" type="date" value={formData.joinDate} onChange={(e) => handleInputChange(e, 'joinDate')} disabled />
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
                     <Card>
                        <CardHeader>
                            <CardTitle>السجل الإداري</CardTitle>
                             <CardDescription>
                                هذا القسم مخصص للمدير العام فقط، ويحتوي على تقييمات وملاحظات سرية حول أداء الشيخ.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {isAdminViewUnlocked ? (
                                 <div className="w-full space-y-4">
                                   <div className="space-y-2">
                                      <Label htmlFor="admin-joinDate">تعديل تاريخ الانضمام</Label>
                                      <Input id="admin-joinDate" name="joinDate" type="date" value={formData.joinDate} onChange={(e) => handleInputChange(e, 'joinDate')} />
                                   </div>
                                   <div className="space-y-2">
                                      <Label htmlFor="admin-notes">تقييم الإدارة للشيخ</Label>
                                      <Textarea id="admin-notes" value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} placeholder="أداء الشيخ التربوي، التزامه بالمنهجية..."/>
                                   </div>
                                   <div className="space-y-2">
                                      <Label htmlFor="admin-awards">الجوائز والتكريمات</Label>
                                      <Textarea id="admin-awards" value={adminAwards} onChange={(e) => setAdminAwards(e.target.value)} placeholder="سجل هنا أي تكريمات أو جوائز تم منحها للشيخ..."/>
                                   </div>
                                    <Button onClick={handleSaveAdminChanges} disabled={isSaving}>
                                        {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : <Save className="ml-2 h-4 w-4" />}
                                        حفظ السجل الإداري
                                    </Button>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center p-8 text-center bg-muted rounded-lg">
                                    <Lock className="h-12 w-12 text-muted-foreground mb-4" />
                                    <h3 className="text-xl font-bold">قسم خاص بالإدارة</h3>
                                    <p className="text-muted-foreground">هذا القسم مقفل. يرجى إدخال كود الوصول لعرض المحتوى.</p>
                                    <Button className="mt-4" onClick={() => setUnlockModalOpen(true)}>فتح القفل</Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <Dialog open={isUnlockModalOpen} onOpenChange={setUnlockModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>فتح السجل الإداري</DialogTitle>
                        <DialogDescription>
                            للوصول إلى هذا القسم، يرجى إدخال كود الإدارة.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2 py-4">
                        <Label htmlFor="admin-code">كود الإدارة</Label>
                        <Input 
                            id="admin-code" 
                            type="password"
                            value={adminCode}
                            onChange={(e) => setAdminCode(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setUnlockModalOpen(false)}>إلغاء</Button>
                        <Button onClick={handleUnlock}>تأكيد</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
