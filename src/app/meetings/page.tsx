"use client";

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useStudentContext } from '@/context/StudentContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
    Calendar,
    Plus,
    Users,
    Utensils,
    CheckCircle2,
    MessageSquare,
    Trash2,
    Clock,
    Send,
    Edit3,
    Eye,
    TrendingUp,
    Award,
    BarChart3,
    Smartphone,
    X
} from 'lucide-react';
import { format, parseISO, startOfYear, endOfYear, isWithinInterval } from 'date-fns';
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

    // Advanced Statistics memo
    const stats = useMemo(() => {
        const now = new Date();
        const yearStart = startOfYear(now);
        const yearEnd = endOfYear(now);

        const thisYearMeetings = meetings.filter(m => {
            try {
                const mDate = parseISO(m.timestamp);
                return isWithinInterval(mDate, { start: yearStart, end: yearEnd });
            } catch { return false; }
        });

        // Calculate top attendees
        const attendanceCount: Record<string, { name: string, count: number }> = {};
        meetings.forEach(m => {
            Object.values(m.attendance || {}).forEach((att: any) => {
                if (att.status === 'present') {
                    if (!attendanceCount[att.name]) attendanceCount[att.name] = { name: att.name, count: 0 };
                    attendanceCount[att.name].count += 1;
                }
            });
        });

        const topAttendees = Object.values(attendanceCount)
            .sort((a, b) => b.count - a.count)
            .slice(0, 3);

        return {
            total: meetings.length,
            completed: meetings.filter(m => m.status === 'completed').length,
            thisYear: thisYearMeetings.length,
            topAttendees
        };
    }, [meetings]);

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

    const handleDeleteSuggestion = async (suggestionId: string, authorId: string) => {
        // Only admin or owner can delete
        if (isAdmin || user?.uid === authorId) {
            if (upcomingMeeting) {
                await deleteMeetingSuggestion(upcomingMeeting.id, suggestionId);
            }
        } else {
            toast({ title: "عذراً", description: "لا يمكنك حذف مقترحات الآخرين", variant: "destructive" });
        }
    };

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="font-bold text-primary animate-pulse">جاري تحميل سجل الاجتماعات...</p>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#f8fafc] dark:bg-[#020617] pb-20">
            {/* Professional Header */}
            <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm sticky top-0 z-50">
                <div className="container mx-auto px-4 h-20 flex justify-between items-center" dir="rtl">
                    <div className="flex items-center gap-3">
                        <div className="bg-primary/10 p-2.5 rounded-2xl">
                            <Calendar className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-xl md:text-2xl font-black text-slate-800 dark:text-white leading-none">إدارة الاجتماعات</h1>
                            <p className="text-xs text-muted-foreground mt-1 hidden md:block">التخطيط، التوثيق، وتحليل النتائج</p>
                        </div>
                    </div>
                    {isAdmin && (
                        <Button
                            onClick={handleOpenCreate}
                            className="rounded-xl shadow-lg shadow-primary/20 hover:scale-105 transition-all gap-2 h-11 px-5"
                        >
                            <Plus className="h-5 w-5" />
                            <span className="hidden sm:inline">جدولة اجتماع</span>
                        </Button>
                    )}
                </div>
            </div>

            <div className="container mx-auto px-4 py-8 lg:py-10" dir="rtl">
                {/* Stats Row */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-10 overflow-x-auto pb-4 custom-scrollbar">
                    <StatCard label="إجمالي الاجتماعات" value={stats.total} icon={BarChart3} color="primary" />
                    <StatCard label="اجتماعات السنة" value={stats.thisYear} icon={TrendingUp} color="blue" />
                    <StatCard label="الأكثر حضوراً" value={stats.topAttendees[0]?.name || '-'} icon={Award} color="amber" isName />
                    <StatCard label="نسبة الإنجاز" value={`${Math.round((stats.completed / (stats.total || 1)) * 100)}%`} icon={CheckCircle2} color="emerald" />
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
                    {/* Main Content Area */}
                    <div className="xl:col-span-8 space-y-8 order-2 xl:order-1">
                        <Tabs defaultValue="upcoming" className="w-full">
                            <div className="flex items-center justify-between mb-6 bg-white dark:bg-slate-900 p-2 rounded-2xl border border-slate-200 dark:border-slate-800">
                                <TabsList className="bg-transparent h-10 w-full md:w-auto grid grid-cols-2 md:inline-flex">
                                    <TabsTrigger value="upcoming" className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white font-bold px-8">القادمة</TabsTrigger>
                                    <TabsTrigger value="past" className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white font-bold px-8">الأرشيف</TabsTrigger>
                                </TabsList>
                            </div>

                            <TabsContent value="upcoming" className="space-y-6 focus-visible:ring-0">
                                {meetings.filter(m => m.status === 'upcoming').length === 0 ? (
                                    <div className="p-16 text-center bg-white dark:bg-slate-900 rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-slate-800">
                                        <div className="bg-slate-50 dark:bg-slate-800 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                                            <Calendar className="h-10 w-10 text-slate-300" />
                                        </div>
                                        <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">لا توجد اجتماعات مجدولة</h3>
                                        <p className="text-sm text-muted-foreground">عند جدولة اجتماع جديد سيظهر هنا مع إمكانية إضافة مقترحات</p>
                                    </div>
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

                            <TabsContent value="past" className="space-y-6 focus-visible:ring-0">
                                {meetings.filter(m => m.status === 'completed').length === 0 ? (
                                    <div className="p-16 text-center bg-white dark:bg-slate-900 rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-slate-800">
                                        <p className="text-slate-400">سجل الاجتماعات فارغ حالياً</p>
                                    </div>
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

                    {/* Sidebar Area */}
                    <div className="xl:col-span-4 space-y-6 order-1 xl:order-2">
                        {/* Suggestions Card */}
                        <Card className="rounded-[2rem] shadow-xl shadow-slate-200/50 dark:shadow-none border-none overflow-hidden h-full flex flex-col">
                            <div className="bg-gradient-to-br from-primary to-primary-focus p-6 text-white relative">
                                <MessageSquare className="absolute top-4 left-4 h-16 w-16 opacity-10 -rotate-12" />
                                <CardTitle className="flex items-center gap-2 mb-1">مقترحات الجلسة القادمة</CardTitle>
                                <CardDescription className="text-white/70 text-xs">شارك أفكارك لجدول أعمال الاجتماع القادم</CardDescription>
                            </div>

                            <CardContent className="p-6 flex-grow flex flex-col space-y-4">
                                {!upcomingMeeting ? (
                                    <div className="flex-grow flex flex-center items-center justify-center p-12 text-center opacity-50 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border-2 border-dotted">
                                        <p className="text-xs">يرجى جدولة اجتماع قادم لتفعيل المقترحات</p>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex-grow space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                            {upcomingMeeting.suggestions?.map((s: any) => (
                                                <div key={s.id} className="group bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 relative hover:shadow-md transition-shadow">
                                                    <div className="flex justify-between items-center mb-2">
                                                        <div className="flex items-center gap-2">
                                                            <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                                                                {s.authorName?.charAt(0)}
                                                            </div>
                                                            <span className="text-xs font-bold">{s.authorName}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10px] opacity-40">{format(parseISO(s.timestamp), 'HH:mm')}</span>
                                                            {(isAdmin || user?.uid === s.authorId) && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-7 w-7 text-destructive/50 hover:text-destructive hover:bg-destructive/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                                                    onClick={() => handleDeleteSuggestion(s.id, s.authorId)}
                                                                >
                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300 pr-2">{s.text}</p>
                                                </div>
                                            ))}
                                            {(!upcomingMeeting.suggestions || upcomingMeeting.suggestions.length === 0) && (
                                                <div className="py-10 text-center space-y-2 opacity-50 italic">
                                                    <p className="text-sm">لا توجد مقترحات مسجلة لهذا الموعد</p>
                                                    <p className="text-[10px]">كن أول من يضيف نقطة للنقاش!</p>
                                                </div>
                                            )}
                                        </div>

                                        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 mt-auto">
                                            <div className="relative">
                                                <Input
                                                    placeholder="اكتب فكرتك أو مقترحك هنا..."
                                                    value={suggestionText}
                                                    onChange={(e) => setSuggestionText(e.target.value)}
                                                    onKeyDown={(e) => e.key === 'Enter' && handleAddSuggestion()}
                                                    className="rounded-xl h-12 pr-4 pl-12 bg-slate-50 dark:bg-slate-900 border-none shadow-inner focus-visible:ring-primary"
                                                />
                                                <Button
                                                    onClick={handleAddSuggestion}
                                                    size="icon"
                                                    className="absolute left-1 top-1 h-10 w-10 rounded-lg shadow-md"
                                                    disabled={!suggestionText.trim()}
                                                >
                                                    <Send className="h-4 w-4 rotate-180" />
                                                </Button>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>

            {/* Modal - Modern Look */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-md animate-in fade-in duration-300">
                    <Card className="w-full max-w-lg rounded-[2.5rem] border-none shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200" dir="rtl">
                        <div className="bg-primary p-6 md:p-8 text-white relative">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setIsModalOpen(false)}
                                className="absolute left-4 top-4 text-white/50 hover:text-white hover:bg-white/10"
                            >
                                <X className="h-5 w-5" />
                            </Button>
                            <h2 className="text-2xl font-black mb-1">{editingMeeting ? 'تعديل الاجتماع' : 'جدولة اجتماع جديد'}</h2>
                            <p className="text-white/70 text-sm">أدخل تفاصيل وموعد الجلسة الإدارية</p>
                        </div>

                        <CardContent className="p-6 md:p-8 space-y-6">
                            <div className="space-y-2">
                                <Label className="mr-2 font-bold opacity-60">عنوان الاجتماع</Label>
                                <Input
                                    placeholder="مثلاً: اجتماع مراجعة نتائج السداسي"
                                    value={form.title}
                                    onChange={e => setForm({ ...form, title: e.target.value })}
                                    className="rounded-2xl h-12 bg-slate-50 dark:bg-slate-900 border-none shadow-sm focus-visible:ring-primary"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label className="mr-2 font-bold opacity-60">وصف التاريخ والوقت</Label>
                                <Input
                                    placeholder="مثلاً: السبت القادم - بعد صلاة العشاء"
                                    value={form.date}
                                    onChange={e => setForm({ ...form, date: e.target.value })}
                                    className="rounded-2xl h-12 bg-slate-50 dark:bg-slate-900 border-none shadow-sm"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="mr-2 font-bold opacity-60">الحالة</Label>
                                    <Select
                                        value={form.status}
                                        onValueChange={(val: any) => setForm({ ...form, status: val })}
                                    >
                                        <SelectTrigger className="rounded-2xl h-12 bg-slate-50 dark:bg-slate-900 border-none shadow-sm">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-2xl">
                                            <SelectItem value="upcoming" className="rounded-xl">🗓️ اجتماع قادم</SelectItem>
                                            <SelectItem value="completed" className="rounded-xl">✅ تم الانتهاء</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="mr-2 font-bold opacity-60">الإطعام</Label>
                                    <div className="flex items-center gap-2 h-12 px-4 bg-slate-50 dark:bg-slate-900 rounded-2xl shadow-sm">
                                        <input
                                            type="checkbox"
                                            id="food-check"
                                            checked={form.foodProvided}
                                            onChange={e => setForm({ ...form, foodProvided: e.target.checked })}
                                            className="w-4 h-4 rounded text-primary border-slate-300"
                                        />
                                        <Label htmlFor="food-check" className="text-sm font-medium">توفير إطعام</Label>
                                    </div>
                                </div>
                            </div>

                            {form.foodProvided && (
                                <div className="space-y-2 animate-in slide-in-from-top-4 duration-300">
                                    <Label className="mr-2 font-bold opacity-60">نوع الإطعام/التفاصيل</Label>
                                    <Input
                                        placeholder="مثلاً: وجبة خفيفة / عشاء شواء..."
                                        value={form.foodDetails}
                                        onChange={e => setForm({ ...form, foodDetails: e.target.value })}
                                        className="rounded-2xl h-12 bg-slate-50 dark:bg-slate-900 border-none shadow-sm"
                                    />
                                </div>
                            )}
                        </CardContent>

                        <CardFooter className="p-6 md:p-8 pt-0 flex flex-col gap-2">
                            <Button
                                onClick={handleSave}
                                className="w-full h-14 rounded-2xl font-black text-lg shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
                            >
                                {editingMeeting ? 'حفظ التعديلات' : 'تأكيد الجدولة'}
                            </Button>
                            <Button
                                variant="ghost"
                                onClick={() => setIsModalOpen(false)}
                                className="w-full h-12 rounded-2xl text-muted-foreground"
                            >
                                إلغاء
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
            )}
        </div>
    );
}

function StatCard({ label, value, icon: Icon, color, isName }: { label: string, value: any, icon: any, color: string, isName?: boolean }) {
    const colorClasses: any = {
        primary: "text-primary b-primary/10",
        blue: "text-blue-500 bg-blue-50 dark:bg-blue-900/20",
        emerald: "text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20",
        amber: "text-amber-500 bg-amber-50 dark:bg-amber-900/20",
    };

    return (
        <Card className="rounded-3xl border-none shadow-lg shadow-slate-200/50 dark:shadow-none bg-white dark:bg-slate-900 group hover:scale-[1.02] transition-all min-w-[160px]">
            <CardContent className="p-5 flex flex-col gap-4">
                <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center", colorClasses[color])}>
                    <Icon className="h-5 w-5" />
                </div>
                <div>
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">{label}</h4>
                    <p className={cn(
                        "font-black text-slate-800 dark:text-white truncate",
                        isName ? "text-sm" : "text-2xl"
                    )}>{value}</p>
                </div>
            </CardContent>
        </Card>
    );
}

function MeetingCard({ meeting, isAdmin, onEdit, onDelete }: { meeting: any, isAdmin: boolean, onEdit: () => void, onDelete: () => void }) {
    const presentersCount = Object.values(meeting.attendance || {}).filter((a: any) => a.status === 'present').length;

    return (
        <Card className={cn(
            "transition-all border-none shadow-xl shadow-slate-200/50 dark:shadow-none overflow-hidden group rounded-[2rem] bg-white dark:bg-slate-900",
            meeting.status === 'upcoming' ? "ring-2 ring-primary ring-offset-4 dark:ring-offset-slate-950" : ""
        )}>
            <CardContent className="p-0">
                <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x md:divide-x-reverse divide-slate-100 dark:divide-slate-800">
                    {/* Visual Tab */}
                    <div className={cn(
                        "w-full md:w-3 flex md:block shrink-0",
                        meeting.status === 'upcoming' ? "bg-primary" : "bg-slate-300 dark:bg-slate-700"
                    )} />

                    {/* Main Content */}
                    <div className="flex-1 p-6 md:p-8 flex flex-col justify-center">
                        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                            <Badge className={cn(
                                "rounded-xl px-4 py-1 font-bold text-xs border-none",
                                meeting.status === 'upcoming' ? "bg-primary text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                            )}>
                                {meeting.status === 'upcoming' ? '🗓️ قـادم' : '✅ مـكـتـمـل'}
                            </Badge>
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <Clock className="h-4 w-4" />
                                <span className="text-xs font-bold">{meeting.date}</span>
                            </div>
                        </div>

                        <h3 className="text-2xl font-black text-slate-800 dark:text-white group-hover:text-primary transition-colors cursor-pointer mb-6" onClick={() => window.location.href = `/meetings/detail?id=${meeting.id}`}>
                            {meeting.title}
                        </h3>

                        <div className="flex flex-wrap gap-4 mt-auto">
                            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50 px-4 py-2 rounded-2xl border border-slate-100 dark:border-slate-800">
                                <Users className="h-4 w-4 text-primary" />
                                <span className="text-xs font-bold text-slate-600 dark:text-slate-400">الحضور: {presentersCount}</span>
                            </div>
                            {meeting.foodProvided && (
                                <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 px-4 py-2 rounded-2xl border border-amber-100 dark:border-amber-900/40">
                                    <Utensils className="h-4 w-4 text-amber-500" />
                                    <span className="text-xs font-bold text-amber-600 dark:text-amber-400">{meeting.foodDetails}</span>
                                </div>
                            )}
                            {meeting.topics?.length > 0 && (
                                <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 px-4 py-2 rounded-2xl border border-blue-100 dark:border-blue-900/40">
                                    <MessageSquare className="h-4 w-4 text-blue-500" />
                                    <span className="text-xs font-bold text-blue-600 dark:text-blue-400">{meeting.topics.length} بنود</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Actions Panel */}
                    <div className="bg-slate-50/50 dark:bg-slate-800/20 p-6 md:p-8 flex flex-row md:flex-col items-center justify-center gap-4 min-w-[160px]">
                        <Button
                            variant="default"
                            className="flex-1 md:w-full rounded-2xl font-black gap-2 h-12 shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
                            asChild
                        >
                            <a href={`/meetings/detail?id=${meeting.id}`}>
                                <Eye className="h-5 w-5" />
                                <span className="text-sm">التفاصيل</span>
                            </a>
                        </Button>

                        {isAdmin && (
                            <div className="flex gap-2 w-auto md:w-full">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="flex-1 rounded-2xl h-12 w-12 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:text-blue-600 hover:border-blue-200 group/edit"
                                    onClick={onEdit}
                                >
                                    <Edit3 className="h-5 w-5 group-hover/edit:scale-110 transition-transform" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="flex-1 rounded-2xl h-12 w-12 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:text-destructive hover:border-destructive/20 group/del"
                                    onClick={onDelete}
                                >
                                    <Trash2 className="h-5 w-5 group-hover/del:scale-110 transition-transform" />
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

// Global styles for custom scrollbar
const styles = `
.custom-scrollbar::-webkit-scrollbar {
  width: 5px;
  height: 5px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #e2e8f0;
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #cbd5e1;
}
.dark .custom-scrollbar::-webkit-scrollbar-thumb {
  background: #1e293b;
}
`;

if (typeof document !== 'undefined') {
    const styleSheet = document.createElement("style");
    styleSheet.innerText = styles;
    document.head.appendChild(styleSheet);
}
