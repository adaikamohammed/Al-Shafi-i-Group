"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { ref, onValue, push, set, remove, update } from 'firebase/database';
import { SiteUpdate, SiteUpdateType } from '@/lib/types';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import {
    Sparkles,
    Plus,
    Edit2,
    Trash2,
    Calendar,
    User,
    Tag,
    ChevronLeft,
    Loader2,
    CheckCircle2,
    Zap,
    Bug,
    Info,
    MoreHorizontal
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ProtectedPage } from '@/components/ui/ProtectedPage';
import { cn } from '@/lib/utils';

export default function SiteUpdatesPage() {
    const { user, isManagement, isSuperAdmin } = useAuth();
    const { toast } = useToast();
    const [updates, setUpdates] = useState<SiteUpdate[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingUpdate, setEditingUpdate] = useState<SiteUpdate | null>(null);
    const [formData, setFormData] = useState<Partial<SiteUpdate>>({
        title: '',
        description: '',
        type: 'ميزة جديدة',
        version: ''
    });

    const isEditor = isManagement || isSuperAdmin;

    useEffect(() => {
        const updatesRef = ref(db, 'site_updates');
        const unsubscribe = onValue(updatesRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                const updatesList = Object.entries(data).map(([id, val]: [string, any]) => ({
                    id,
                    ...val
                })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                setUpdates(updatesList);
            } else {
                setUpdates([]);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleSave = async () => {
        if (!formData.title || !formData.description) {
            toast({
                title: "بيانات ناقصة",
                description: "يرجى إكمال العنوان والشرح.",
                variant: "destructive"
            });
            return;
        }

        try {
            if (editingUpdate) {
                const updateRef = ref(db, `site_updates/${editingUpdate.id}`);
                await update(updateRef, {
                    ...formData,
                    date: new Date().toISOString(), // Keep it updated to recent or keep original? Let's use current.
                });
                toast({ title: "تم التحديث", description: "تم تعديل التحديث بنجاح." });
            } else {
                const updatesRef = ref(db, 'site_updates');
                const newUpdateRef = push(updatesRef);
                await set(newUpdateRef, {
                    ...formData,
                    id: newUpdateRef.key,
                    date: new Date().toISOString(),
                    authorId: user?.uid,
                    authorName: user?.displayName || 'الإدارة'
                });
                toast({ title: "تمت الإضافة", description: "تم نشر التحديث الجديد بنجاح." });
            }
            setIsDialogOpen(false);
            setEditingUpdate(null);
            setFormData({ title: '', description: '', type: 'ميزة جديدة', version: '' });
        } catch (error) {
            console.error("Error saving update:", error);
            toast({ title: "خطأ", description: "فشل حفظ التحديث.", variant: "destructive" });
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("هل أنت متأكد من حذف هذا التحديث؟")) return;

        try {
            await remove(ref(db, `site_updates/${id}`));
            toast({ title: "تم الحذف", description: "تم حذف التحديث بنجاح." });
        } catch (error) {
            console.error("Error deleting update:", error);
            toast({ title: "خطأ", description: "فشل حذف التحديث.", variant: "destructive" });
        }
    };

    const openEditDialog = (update: SiteUpdate) => {
        setEditingUpdate(update);
        setFormData({
            title: update.title,
            description: update.description,
            type: update.type,
            version: update.version || ''
        });
        setIsDialogOpen(true);
    };

    const getTypeIcon = (type: SiteUpdateType) => {
        switch (type) {
            case 'ميزة جديدة': return <Zap className="h-4 w-4 text-amber-500" />;
            case 'تحسين': return <Sparkles className="h-4 w-4 text-emerald-500" />;
            case 'إصلاح خطأ': return <Bug className="h-4 w-4 text-rose-500" />;
            case 'تنبيه غداري': return <Info className="h-4 w-4 text-blue-500" />;
            default: return <Tag className="h-4 w-4 text-gray-500" />;
        }
    };

    const getTypeColor = (type: SiteUpdateType) => {
        switch (type) {
            case 'ميزة جديدة': return "bg-amber-50 text-amber-700 border-amber-100";
            case 'تحسين': return "bg-emerald-50 text-emerald-700 border-emerald-100";
            case 'إصلاح خطأ': return "bg-rose-50 text-rose-700 border-rose-100";
            case 'تنبيه غداري': return "bg-blue-50 text-blue-700 border-blue-100";
            default: return "bg-gray-50 text-gray-700 border-gray-100";
        }
    };

    return (
        <ProtectedPage>
            <div className="container mx-auto p-4 max-w-5xl space-y-8 pb-32 rtl" dir="rtl">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-gradient-to-br from-emerald-600 to-emerald-800 p-8 rounded-[2rem] shadow-xl text-white relative overflow-hidden">
                    <div className="relative z-10 space-y-2">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl">
                                <Sparkles className="h-8 w-8 text-white animate-pulse" />
                            </div>
                            <h1 className="text-3xl md:text-4xl font-headline font-bold">تحديثات الموقع</h1>
                        </div>
                        <p className="text-emerald-50/80 font-body text-lg mr-2">تابع آخر المميزات والتحسينات التي تمت إضافتها للمنصة.</p>
                    </div>

                    {isEditor && (
                        <Button
                            onClick={() => { setEditingUpdate(null); setFormData({ title: '', description: '', type: 'ميزة جديدة', version: '' }); setIsDialogOpen(true); }}
                            className="relative z-10 bg-white text-emerald-800 hover:bg-emerald-50 font-bold px-6 py-6 rounded-2xl shadow-lg transition-all hover:scale-105 group"
                        >
                            <Plus className="ml-2 h-5 w-5 group-hover:rotate-90 transition-transform" />
                            إضافة تحديث جديد
                        </Button>
                    )}

                    {/* Decorative Elements */}
                    <div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-emerald-400/20 rounded-full blur-3xl" />
                    <div className="absolute bottom-[-20%] left-[-10%] w-48 h-48 bg-white/10 rounded-full blur-2xl" />
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-24 space-y-4">
                        <Loader2 className="h-12 w-12 animate-spin text-emerald-600" />
                        <p className="text-muted-foreground font-body">جاري تحميل السجل...</p>
                    </div>
                ) : updates.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 text-center space-y-6 bg-card border-2 border-dashed rounded-[2rem]">
                        <div className="p-6 bg-emerald-50 rounded-full">
                            <Info className="h-12 w-12 text-emerald-400" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-xl font-headline font-bold">لا توجد تحديثات مسجلة</h3>
                            <p className="text-muted-foreground font-body max-w-sm">سجل التحديثات فارغ حالياً. سيقوم فريق الإدارة بنشر التحديثات هنا فور توفرها.</p>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-6">
                        {updates.map((update, index) => (
                            <Card key={update.id} className="group border-none shadow-sm hover:shadow-md transition-all duration-300 rounded-[1.5rem] overflow-hidden bg-white/50 backdrop-blur-sm border border-emerald-50">
                                <div className="flex flex-col md:flex-row">
                                    {/* Date Column */}
                                    <div className="md:w-48 bg-emerald-50/30 p-6 flex flex-col items-center justify-center border-l border-emerald-50 text-center gap-1 group-hover:bg-emerald-50/50 transition-colors">
                                        <span className="text-3xl font-headline font-black text-emerald-700">
                                            {format(new Date(update.date), 'dd')}
                                        </span>
                                        <span className="text-sm font-body text-emerald-600 font-bold">
                                            {format(new Date(update.date), 'MMMM yyyy', { locale: ar })}
                                        </span>
                                        <Badge variant="outline" className="mt-2 font-mono text-[10px] bg-white text-emerald-800 border-emerald-200">
                                            {update.version || 'v1.0'}
                                        </Badge>
                                    </div>

                                    {/* Content Column */}
                                    <CardHeader className="flex-1 p-6">
                                        <div className="flex justify-between items-start gap-4">
                                            <div className="space-y-2 text-right">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <Badge className={cn("px-3 py-1 rounded-full flex items-center gap-2 border shadow-none", getTypeColor(update.type))}>
                                                        {getTypeIcon(update.type)}
                                                        <span className="font-headline font-bold text-xs">{update.type}</span>
                                                    </Badge>
                                                </div>
                                                <CardTitle className="text-2xl font-headline font-bold text-gray-800 leading-tight">
                                                    {update.title}
                                                </CardTitle>
                                            </div>

                                            {isEditor && (
                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(update)} className="h-9 w-9 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl">
                                                        <Edit2 className="h-4 w-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" onClick={() => handleDelete(update.id)} className="h-9 w-9 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl">
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                        <CardContent className="p-0 mt-4">
                                            <p className="text-gray-600 font-body leading-relaxed whitespace-pre-wrap text-right">
                                                {update.description}
                                            </p>
                                        </CardContent>
                                        <CardFooter className="p-0 mt-6 flex items-center justify-end gap-3 text-[11px] text-muted-foreground font-body bg-gray-50/50 px-4 py-2 rounded-xl border border-gray-100/50 w-fit mr-auto">
                                            <div className="flex items-center gap-1">
                                                <Calendar className="h-3 w-3" />
                                                <span>نُشر في {format(new Date(update.date), 'p', { locale: ar })}</span>
                                            </div>
                                            <div className="w-1 h-1 bg-gray-300 rounded-full" />
                                            <div className="flex items-center gap-1">
                                                <User className="h-3 w-3" />
                                                <span>بواسطة: {update.authorName}</span>
                                            </div>
                                        </CardFooter>
                                    </CardHeader>
                                </div>
                            </Card>
                        ))}
                    </div>
                )}

                {/* Create/Edit Dialog */}
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogContent className="sm:max-w-[600px] rtl" dir="rtl">
                        <DialogHeader>
                            <DialogTitle className="text-2xl font-headline font-bold">
                                {editingUpdate ? 'تعديل التحديث' : 'إضافة تحديث جديد'}
                            </DialogTitle>
                            <DialogDescription className="font-body">
                                أدخل تفاصيل التحديث الجديد ليظهر لجميع المستخدمين في المنصة.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-6 py-4 text-right">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="title" className="font-bold">عنوان التحديث</Label>
                                    <Input
                                        id="title"
                                        value={formData.title}
                                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                        placeholder="مثال: إضافة نظام نقاط جديد"
                                        className="h-12 rounded-xl text-right"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="version" className="font-bold">رقم الإصدار (اختياري)</Label>
                                    <Input
                                        id="version"
                                        value={formData.version}
                                        onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                                        placeholder="مثال: v2.4.0"
                                        className="h-12 rounded-xl font-mono text-left"
                                        dir="ltr"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="type" className="font-bold">نوع التحديث</Label>
                                <Select value={formData.type} onValueChange={(val) => setFormData({ ...formData, type: val as SiteUpdateType })}>
                                    <SelectTrigger id="type" className="h-12 rounded-xl text-right">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ميزة جديدة">ميزة جديدة 🚀</SelectItem>
                                        <SelectItem value="تحسين">تحسين ✨</SelectItem>
                                        <SelectItem value="إصلاح خطأ">إصلاح خطأ 🐛</SelectItem>
                                        <SelectItem value="تنبيه إداري">تنبيه إداري 🔔</SelectItem>
                                        <SelectItem value="أخرى">أخرى 📝</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="description" className="font-bold">شرح مفصل</Label>
                                <Textarea
                                    id="description"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="اشرح ما تم تحديثه وكيفية استخدامه..."
                                    className="min-h-[150px] rounded-xl text-right leading-relaxed"
                                />
                            </div>
                        </div>

                        <DialogFooter className="gap-2 sm:gap-0 mt-4">
                            <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="rounded-xl h-12 flex-1">إلغاء</Button>
                            <Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl h-12 flex-[2]">
                                <CheckCircle2 className="ml-2 h-5 w-5" />
                                {editingUpdate ? 'حفظ التعديلات' : 'نشر التحديث'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </ProtectedPage>
    );
}
