"use client";

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useStudentContext } from '@/context/StudentContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
    Calendar,
    Plus,
    Users,
    Utensils,
    MessageSquare,
    Save,
    Trash2,
    CheckCircle2,
    Clock,
    ChevronRight,
    UserCircle2,
    Send,
    Edit3,
    Eye,
    Settings2
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

export default function MeetingsPage() {
    const { meetings, saveMeeting, deleteMeeting, addMeetingSuggestion, deleteMeetingSuggestion, loading } = useStudentContext();
    const { user, isSuperAdmin, isManagement } = useAuth();
    const { toast } = useToast();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingMeeting, setEditingMeeting] = useState<any>(null);
    const [suggestionText, setSuggestionText] = useState("");

    const [form, setForm] = useState({
        title: '',
        date: '',
        foodProvided: false,
        foodDetails: '',
        status: 'upcoming' as 'upcoming' | 'completed'
    });

    const isAdmin = isSuperAdmin || isManagement;

    const upcomingMeeting = useMemo(() => {
        return meetings.find(m => m.status === 'upcoming');
    }, [meetings]);

    const handleOpenCreate = () => {
        setEditingMeeting(null);
        setForm({ title: '', date: '', foodProvided: false, foodDetails: '', status: 'upcoming' });
        setIsModalOpen(true);
    };

    const handleOpenEdit = (meeting: any) => {
        setEditingMeeting(meeting);
        setForm({
            title: meeting.title,
            date: meeting.date,
            foodProvided: meeting.foodProvided,
            foodDetails: meeting.foodDetails || '',
            status: meeting.status as any
        });
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!form.title || !form.date) {
            toast({ title: "خطأ", description: "يرجى إكمال البيانات الأساسية", variant: "destructive" });
            return;
        }
        await saveMeeting(form, editingMeeting?.id);
        setIsModalOpen(false);
    };

    const handleDelete = async (id: string) => {
        if (confirm("هل أنت متأكد من حذف هذا الاجتماع نهائياً؟")) {
            await deleteMeeting(id);
        }
    };

    const handleAddSuggestion = async () => {
        if (!upcomingMeeting || !suggestionText.trim()) return;
        await addMeetingSuggestion(upcomingMeeting.id, {
            authorName: user?.displayName || "مجهول",
            authorId: user?.uid || "",
            text: suggestionText
        });
        setSuggestionText("");
    };

    const handleDeleteSuggestion = async (suggestionId: string) => {
        if (upcomingMeeting) {
            await deleteMeetingSuggestion(upcomingMeeting.id, suggestionId);
        }
    };

    if (loading) return <div className="p-8 text-center">جاري التحميل...</div>;

    return (
        <div className="container mx-auto p-4 lg:p-8 space-y-8 animate-in fade-in duration-500">
            {/* Header section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-4xl font-black text-primary font-headline tracking-tight">إدارة الاجتماعات</h1>
                    <p className="text-muted-foreground mt-1">تخطيط المواعيد، تدوين محاضر الجلسات، واسترجاع السجلات</p>
                </div>
                {isAdmin && (
                    <Button
                        onClick={handleOpenCreate}
                        className="rounded-full shadow-lg hover:shadow-primary/20 transition-all gap-2 h-12 px-6 bg-primary text-primary-foreground"
                    >
                        <Plus className="h-5 w-5" /> جدولة اجتماع جديد
                    </Button>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Right Column: List of Meetings */}
                <div className="lg:col-span-2 space-y-6">
                    <Tabs defaultValue="upcoming" className="w-full" dir="rtl">
                        <TabsList className="grid w-full grid-cols-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl h-14">
                            <TabsTrigger value="upcoming" className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm text-lg font-bold">اجتماعات قادمة</TabsTrigger>
                            <TabsTrigger value="past" className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm text-lg font-bold">سجل الاجتماعات</TabsTrigger>
                        </TabsList>

                        <TabsContent value="upcoming" className="mt-6 space-y-4">
                            {meetings.filter(m => m.status === 'upcoming').length === 0 ? (
                                <Card className="border-dashed border-2 bg-slate-50/50 dark:bg-slate-900/50">
                                    <CardContent className="p-12 text-center text-muted-foreground">
                                        <Calendar className="h-12 w-12 mx-auto mb-4 opacity-20" />
                                        <p className="text-lg">لا توجد اجتماعات قادمة حالياً</p>
                                    </CardContent>
                                </Card>
                            ) : (
                                meetings.filter(m => m.status === 'upcoming').map(meeting => (
                                    <MeetingCard
                                        key={meeting.id}
                                        meeting={meeting}
                                        isAdmin={isAdmin}
                                        onEdit={() => handleOpenEdit(meeting)}
                                        onDelete={() => handleDelete(meeting.id)}
                                    />
                                ))
                            )}
                        </TabsContent>

                        <TabsContent value="past" className="mt-6 space-y-4">
                            {meetings.filter(m => m.status === 'completed').length === 0 ? (
                                <div className="p-12 text-center text-muted-foreground text-lg border-2 border-dashed rounded-3xl">لا توجد سجلات سابقة</div>
                            ) : (
                                [...meetings]
                                    .filter(m => m.status === 'completed')
                                    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
                                    .map(meeting => (
                                        <MeetingCard
                                            key={meeting.id}
                                            meeting={meeting}
                                            isAdmin={isAdmin}
                                            onEdit={() => handleOpenEdit(meeting)}
                                            onDelete={() => handleDelete(meeting.id)}
                                        />
                                    ))
                            )}
                        </TabsContent>
                    </Tabs>
                </div>

                {/* Left Column: Contextual Area (Suggestions/Quick Info) */}
                <div className="space-y-6">
                    {upcomingMeeting && (
                        <Card className="border-primary/20 shadow-xl overflow-hidden bg-gradient-to-br from-primary/5 to-transparent border-t-4 border-t-primary">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-primary">
                                    <MessageSquare className="h-5 w-5" /> مقترحات وجدول أعمال
                                </CardTitle>
                                <CardDescription>مقترحات المشايخ للنقاش في الاجتماع القادم</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="max-h-[300px] overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                                    {upcomingMeeting.suggestions?.map((s: any) => (
                                        <div key={s.id} className="group bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-100 shadow-xs relative">
                                            <div className="flex justify-between items-start mb-1">
                                                <span className="text-xs font-bold text-primary">{s.authorName}</span>
                                                <div className="flex items-center gap-1">
                                                    <span className="text-[10px] text-muted-foreground">{format(parseISO(s.timestamp), 'HH:mm')}</span>
                                                    {isAdmin && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                                            onClick={() => handleDeleteSuggestion(s.id)}
                                                        >
                                                            <Trash2 className="h-3 w-3" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                            <p className="text-sm">{s.text}</p>
                                        </div>
                                    ))}
                                    {(!upcomingMeeting.suggestions || upcomingMeeting.suggestions.length === 0) && (
                                        <p className="text-center text-xs text-muted-foreground py-4 italic">لا توجد مقترحات بعد</p>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="اكتب اقتراحك هنا..."
                                        value={suggestionText}
                                        onChange={(e) => setSuggestionText(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleAddSuggestion()}
                                        className="rounded-full bg-white"
                                    />
                                    <Button onClick={handleAddSuggestion} size="icon" className="rounded-full shrink-0">
                                        <Send className="h-4 w-4" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    <Card className="bg-slate-900 border-none text-white shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <Settings2 className="h-24 w-24" />
                        </div>
                        <CardHeader>
                            <CardTitle className="text-lg">إحصائيات الاجتماعات</CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-white/10 rounded-2xl text-center backdrop-blur-sm">
                                <p className="text-3xl font-black">{meetings.length}</p>
                                <p className="text-[10px] uppercase opacity-60">الإجمالي</p>
                            </div>
                            <div className="p-4 bg-white/10 rounded-2xl text-center backdrop-blur-sm">
                                <p className="text-3xl font-black">{meetings.filter(m => m.status === 'completed').length}</p>
                                <p className="text-[10px] uppercase opacity-60">المنجزة</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Create/Edit Modal Implementation */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <Card className="w-full max-w-lg animate-in zoom-in-95 duration-200 shadow-2xl overflow-hidden border-none text-right" dir="rtl">
                        <CardHeader className="bg-primary/5">
                            <CardTitle>{editingMeeting ? 'تعديل بيانات الاجتماع' : 'جدولة اجتماع جديد'}</CardTitle>
                            <CardDescription>أدخل تفاصيل موعد الاجتماع ليتمكن الجميع من رؤيته</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-5 p-6">
                            <div className="space-y-2">
                                <Label>عنوان الاجتماع</Label>
                                <Input
                                    placeholder="مثل: اجتماع تقييم السداسي الأول"
                                    value={form.title}
                                    onChange={e => setForm({ ...form, title: e.target.value })}
                                    className="rounded-xl"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>التاريخ والوقت (نصي)</Label>
                                <Input
                                    placeholder="الأربعاء 28 جانفي - بعد العشاء"
                                    value={form.date}
                                    onChange={e => setForm({ ...form, date: e.target.value })}
                                    className="rounded-xl"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>حالة الاجتماع</Label>
                                    <Select
                                        value={form.status}
                                        onValueChange={(val: any) => setForm({ ...form, status: val })}
                                    >
                                        <SelectTrigger className="rounded-xl">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="upcoming">🗓️ قادم (للمقترحات)</SelectItem>
                                            <SelectItem value="completed">✅ مكتمل (أرشيف)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>الإطعام</Label>
                                    <div className="flex items-center gap-2 h-10 px-3 bg-slate-50 dark:bg-slate-900 rounded-xl border">
                                        <input
                                            type="checkbox"
                                            id="food-toggle"
                                            checked={form.foodProvided}
                                            onChange={e => setForm({ ...form, foodProvided: e.target.checked })}
                                        />
                                        <Label htmlFor="food-toggle" className="text-xs">توفير عشاء/إفطار</Label>
                                    </div>
                                </div>
                            </div>

                            {form.foodProvided && (
                                <div className="space-y-2 animate-in slide-in-from-top-2">
                                    <Label>تفاصيل الإطعام</Label>
                                    <Input
                                        placeholder="نوع الإطعام..."
                                        value={form.foodDetails}
                                        onChange={e => setForm({ ...form, foodDetails: e.target.value })}
                                        className="rounded-xl"
                                    />
                                </div>
                            )}
                        </CardContent>
                        <CardFooter className="flex justify-end gap-2 bg-slate-50 p-4">
                            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>إلغاء</Button>
                            <Button onClick={handleSave} className="rounded-xl px-8">
                                {editingMeeting ? 'تحديث البيانات' : 'تأكيد الجدولة'}
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
            )}
        </div>
    );
}

function MeetingCard({ meeting, isAdmin, onEdit, onDelete }: { meeting: any, isAdmin: boolean, onEdit: () => void, onDelete: () => void }) {
    return (
        <Card className={cn(
            "transition-all hover:border-primary/40 overflow-hidden group border-r-4 shadow-sm",
            meeting.status === 'upcoming' ? "border-r-primary hover:shadow-lg" : "border-r-slate-300 opacity-90"
        )}>
            <CardContent className="p-0">
                <div className="flex flex-col md:flex-row">
                    {/* Content Section */}
                    <div className="flex-1 p-5">
                        <div className="flex justify-between items-start mb-3">
                            <div>
                                <h3 className="text-xl font-bold group-hover:text-primary transition-colors">{meeting.title}</h3>
                                <div className="flex items-center gap-2 text-muted-foreground text-sm mt-1">
                                    <Clock className="h-4 w-4" />
                                    <span>{meeting.date}</span>
                                </div>
                            </div>
                            <Badge variant={meeting.status === 'upcoming' ? 'default' : 'secondary'} className="rounded-full px-3">
                                {meeting.status === 'upcoming' ? '🗓️ قادم' : '✅ تم الإنتهاء'}
                            </Badge>
                        </div>

                        <div className="flex flex-wrap gap-4 mt-4 py-3 border-t border-t-slate-100 dark:border-t-slate-800">
                            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 px-3 py-1 rounded-lg">
                                <Users className="h-4 w-4 text-primary" />
                                <span className="text-xs font-bold">الحضور: {Object.keys(meeting.attendance || {}).filter(k => meeting.attendance[k].status === 'present').length}</span>
                            </div>
                            {meeting.foodProvided && (
                                <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/30 px-3 py-1 rounded-lg">
                                    <Utensils className="h-4 w-4" />
                                    <span className="text-xs font-bold">{meeting.foodDetails}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Actions Section */}
                    <div className="bg-slate-50/50 dark:bg-slate-900/50 p-4 flex md:flex-col justify-center items-center gap-3 border-t md:border-t-0 md:border-r border-slate-100 dark:border-slate-800 min-w-[120px]">
                        <Button
                            variant="default"
                            size="sm"
                            className="w-full rounded-xl font-bold gap-2"
                            asChild
                        >
                            <a href={`/meetings/${meeting.id}`}>
                                <Eye className="h-4 w-4" /> التفاصيل
                            </a>
                        </Button>

                        {isAdmin && (
                            <div className="flex gap-2 w-full">
                                <Button variant="outline" size="icon" className="flex-1 rounded-xl h-9" onClick={onEdit}>
                                    <Edit3 className="h-4 w-4 text-blue-600" />
                                </Button>
                                <Button variant="outline" size="icon" className="flex-1 rounded-xl h-9 hover:bg-destructive/10" onClick={onDelete}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
