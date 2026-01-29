"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useStudentContext } from '@/context/StudentContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
    ChevronRight,
    Users,
    Utensils,
    CheckCircle2,
    MessageCircle,
    Plus,
    Trash2,
    Save,
    XCircle,
    ArrowRight,
    Check,
    Star,
    ArrowUp,
    ArrowDown,
    Pin,
    Smartphone,
    Share2,
    Calendar,
    Crown,
    Award
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { v4 as uuidv4 } from 'uuid';

export default function MeetingDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const meetingId = params.id as string;
    const { meetings, saveMeeting, allUsers } = useStudentContext();
    const { isSuperAdmin, isManagement } = useAuth();
    const { toast } = useToast();

    const isAdmin = isSuperAdmin || isManagement;
    const meeting = useMemo(() => meetings.find(m => m.id === meetingId), [meetings, meetingId]);

    // Internal states for editing
    const [localMeeting, setLocalMeeting] = useState<any>(null);
    const [newTopic, setNewTopic] = useState({ topic: '', speaker: '', solutions: '', isFeatured: false });
    const [manualName, setManualName] = useState("");

    useEffect(() => {
        if (meeting) {
            setLocalMeeting(JSON.parse(JSON.stringify(meeting)));
        }
    }, [meeting]);

    if (!meeting || !localMeeting) return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
            <div className="flex flex-col items-center gap-4">
                <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="font-bold text-slate-400">جاري تحميل البيانات...</p>
            </div>
        </div>
    );

    const handleSave = async () => {
        await saveMeeting(localMeeting, meetingId);
    };

    const handleToggleStatus = async () => {
        const newStatus = localMeeting.status === 'upcoming' ? 'completed' : 'upcoming';
        const updated = { ...localMeeting, status: newStatus };
        setLocalMeeting(updated);
        await saveMeeting(updated, meetingId);
        toast({ title: "تم تحديث الحالة", description: `الاجتماع الآن ${newStatus === 'upcoming' ? 'قيد التخطيط' : 'مكتمل ومؤرشف'}` });
    };

    const toggleAttendance = (userId: string, userName: string, status: 'present' | 'absent' | 'excused') => {
        if (!isAdmin) return;
        const newAttendance = { ...localMeeting.attendance };
        newAttendance[userId] = { name: userName, status };
        setLocalMeeting({ ...localMeeting, attendance: newAttendance });
    };

    const removeAttendance = (userId: string) => {
        if (!isAdmin) return;
        const newAttendance = { ...localMeeting.attendance };
        delete newAttendance[userId];
        setLocalMeeting({ ...localMeeting, attendance: newAttendance });
    };

    const addManualAttendee = () => {
        if (!manualName.trim()) return;
        const id = `manual_${uuidv4()}`;
        const newAttendance = { ...localMeeting.attendance };
        newAttendance[id] = { name: manualName.trim(), status: 'present' };
        setLocalMeeting({ ...localMeeting, attendance: newAttendance });
        setManualName("");
    };

    const addTopic = () => {
        if (!newTopic.topic) return;
        setLocalMeeting({
            ...localMeeting,
            topics: [...(localMeeting.topics || []), newTopic]
        });
        setNewTopic({ topic: '', speaker: '', solutions: '', isFeatured: false });
    };

    const removeTopic = (index: number) => {
        const newTopics = [...localMeeting.topics];
        newTopics.splice(index, 1);
        setLocalMeeting({ ...localMeeting, topics: newTopics });
    };

    // Reordering Topics
    const moveTopic = (index: number, direction: 'up' | 'down') => {
        if (!isAdmin) return;
        const newTopics = [...localMeeting.topics];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= newTopics.length) return;

        [newTopics[index], newTopics[targetIndex]] = [newTopics[targetIndex], newTopics[index]];
        setLocalMeeting({ ...localMeeting, topics: newTopics });
    };

    // Toggle Featured Topic (Best Point)
    const toggleFeaturedTopic = (index: number) => {
        if (!isAdmin) return;
        const newTopics = [...localMeeting.topics];
        // Only one can be featured, or multiple? User said "the most important point" (singular implied)
        // Let's allow only one for maximum impact, or multiple if we want.
        // Let's go with one featured at a time for "the best point"
        newTopics.forEach((t, i) => {
            if (i === index) t.isFeatured = !t.isFeatured;
            else t.isFeatured = false;
        });
        setLocalMeeting({ ...localMeeting, topics: newTopics });
    };

    const convertSuggestionToTopic = (suggestion: any) => {
        setLocalMeeting({
            ...localMeeting,
            topics: [...(localMeeting.topics || []), {
                topic: suggestion.text,
                speaker: suggestion.authorName,
                solutions: '',
                isFeatured: false
            }]
        });
        toast({ title: "تم تحويل المقترح", description: "أصبح المقترح الآن بنداً ضمن محضر الاجتماع" });
    };

    return (
        <div className="min-h-screen bg-[#fcfdfe] dark:bg-[#020617] pb-20" dir="rtl">
            {/* Professional Header */}
            <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm sticky top-0 z-50">
                <div className="container mx-auto px-4 h-20 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => router.push('/meetings')}
                            className="rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                            <ArrowRight className="h-6 w-6" />
                        </Button>
                        <div>
                            <h1 className="text-xl md:text-2xl font-black text-slate-800 dark:text-white truncate max-w-[200px] md:max-w-md">
                                {localMeeting.title}
                            </h1>
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <Calendar className="h-3 w-3" />
                                <span className="text-[10px] font-bold">{localMeeting.date}</span>
                            </div>
                        </div>
                    </div>
                    {isAdmin && (
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                className="rounded-xl h-11 hidden md:flex items-center gap-2 font-black border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm"
                                onClick={handleToggleStatus}
                            >
                                {localMeeting.status === 'upcoming' ? '✅ إكمال الاجتماع' : '🗓️ إرجاع كقادم'}
                            </Button>
                            <Button
                                className="rounded-xl h-11 px-6 font-black gap-2 shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
                                onClick={handleSave}
                            >
                                <Save className="h-4 w-4" />
                                <span className="hidden sm:inline">حفظ التغييرات</span>
                                <span className="sm:hidden">حفظ</span>
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            <div className="container mx-auto px-4 py-8 lg:py-10">
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">

                    {/* Right Column: Attendance & Info */}
                    <div className="xl:col-span-4 space-y-6">
                        <Card className="rounded-[2.5rem] shadow-xl shadow-slate-200/50 dark:shadow-none border-none border-t-4 border-t-primary overflow-hidden">
                            <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 p-6">
                                <CardTitle className="flex items-center gap-2 text-lg font-black">
                                    <Users className="h-5 w-5 text-primary" /> كشف الحضور
                                </CardTitle>
                                <CardDescription className="text-xs">سجل أسماء الحاضرين في الجلسة</CardDescription>
                            </CardHeader>
                            <CardContent className="p-6 space-y-5">
                                {isAdmin && (
                                    <div className="flex gap-2 p-2 bg-slate-50 dark:bg-slate-800/80 rounded-[1.5rem] ring-1 ring-slate-100 dark:ring-slate-700 shadow-inner">
                                        <Input
                                            placeholder="إضافة حاضر يدوياً..."
                                            className="bg-transparent rounded-xl h-10 border-none shadow-none focus-visible:ring-0 text-sm"
                                            value={manualName}
                                            onChange={e => setManualName(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && addManualAttendee()}
                                        />
                                        <Button size="icon" className="rounded-xl h-10 w-10 shrink-0 shadow-lg shadow-primary/20" onClick={addManualAttendee}>
                                            <Plus className="h-4 w-4" />
                                        </Button>
                                    </div>
                                )}

                                <div className="space-y-3 max-h-[400px] overflow-y-auto px-1 custom-scrollbar">
                                    {Object.entries(localMeeting.attendance || {}).map(([id, att]: [string, any]) => (
                                        <div key={id} className="group flex justify-between items-center p-3.5 rounded-2xl bg-white dark:bg-slate-800/50 border border-slate-50 dark:border-slate-800 shadow-sm hover:border-primary/20 transition-all">
                                            <div className="flex items-center gap-3">
                                                <div className={cn(
                                                    "h-2.5 w-2.5 rounded-full ring-4 shadow-sm",
                                                    att.status === 'present' ? "bg-emerald-500 ring-emerald-500/10" : att.status === 'absent' ? "bg-rose-500 ring-rose-500/10" : "bg-slate-300 ring-slate-300/10"
                                                )} />
                                                <span className="font-bold text-sm text-slate-700 dark:text-slate-200">{att.name}</span>
                                            </div>
                                            {isAdmin && (
                                                <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Button
                                                        size="sm"
                                                        variant={att.status === 'present' ? 'default' : 'outline'}
                                                        className={cn("h-8 w-8 p-0 rounded-lg", att.status === 'present' ? "bg-emerald-500 hover:bg-emerald-600" : "")}
                                                        onClick={() => toggleAttendance(id, att.name, 'present')}
                                                    >
                                                        <Check className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant={att.status === 'absent' ? 'destructive' : 'outline'}
                                                        className="h-8 w-8 p-0 rounded-lg"
                                                        onClick={() => toggleAttendance(id, att.name, 'absent')}
                                                    >
                                                        <XCircle className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-8 w-8 p-0 rounded-lg text-slate-300 hover:text-rose-500"
                                                        onClick={() => removeAttendance(id)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    ))}

                                    {(!localMeeting.attendance || Object.keys(localMeeting.attendance).length === 0) && (
                                        <div className="py-12 text-center opacity-30 italic">
                                            <Users className="h-8 w-8 mx-auto mb-2" />
                                            <p className="text-xs">لم يتم تسجيل أي حضور بعد</p>
                                        </div>
                                    )}
                                </div>

                                {isAdmin && (
                                    <div className="pt-4 border-t border-dashed border-slate-200 dark:border-slate-700">
                                        <h4 className="text-[10px] uppercase font-black tracking-widest text-muted-foreground/60 mb-3 pr-2">أضف من مشايخ المدرسة:</h4>
                                        <div className="flex flex-wrap gap-2">
                                            {allUsers.filter(u => u.role === 'sheikh' && !localMeeting.attendance?.[u.uid]).map(sheikh => (
                                                <button
                                                    key={sheikh.uid}
                                                    className="px-3 py-1.5 rounded-xl border border-slate-100 dark:border-slate-800 text-[10px] font-bold bg-white dark:bg-slate-900 hover:bg-primary hover:text-white hover:border-primary transition-all shadow-xs"
                                                    onClick={() => toggleAttendance(sheikh.uid, sheikh.displayName || '', 'present')}
                                                >
                                                    {sheikh.displayName}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card className="rounded-[2rem] border-none shadow-xl bg-slate-900 text-white overflow-hidden relative">
                            <div className="absolute bottom-0 left-0 p-6 opacity-5 pointer-events-none">
                                <Utensils className="h-24 w-24 -rotate-12" />
                            </div>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-black flex items-center gap-2">
                                    <Utensils className="h-4 w-4 text-primary" /> وضـع الإطـعـام
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center gap-3 h-12 px-4 bg-white/5 rounded-2xl border border-white/10">
                                    <input
                                        type="checkbox"
                                        id="food-detail"
                                        checked={localMeeting.foodProvided}
                                        onChange={e => setLocalMeeting({ ...localMeeting, foodProvided: e.target.checked })}
                                        disabled={!isAdmin}
                                        className="w-4 h-4 rounded text-primary border-slate-300"
                                    />
                                    <Label htmlFor="food-detail" className="text-xs font-bold leading-none cursor-pointer">يوجد وجبة إطعام في الجلسة</Label>
                                </div>
                                {localMeeting.foodProvided && (
                                    <Input
                                        placeholder="ماذا سيقدم؟ (مثل: عشاء شواء)"
                                        value={localMeeting.foodDetails || ''}
                                        onChange={e => setLocalMeeting({ ...localMeeting, foodDetails: e.target.value })}
                                        disabled={!isAdmin}
                                        className="rounded-2xl h-11 bg-white/5 border-white/10 ring-0 focus-visible:ring-1 focus-visible:ring-primary text-sm font-bold"
                                    />
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Left Column: Topics & Discussions */}
                    <div className="xl:col-span-8 space-y-8">
                        {/* Summary Header for Content */}
                        <div className="flex items-center justify-between mb-2 px-2">
                            <h2 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                                <MessageCircle className="h-6 w-6 text-primary" /> مـحـضـر الـجـلـسـة
                            </h2>
                            <Badge variant="outline" className="rounded-xl px-4 py-1.5 font-bold border-slate-200">
                                {localMeeting.topics?.length || 0} نـقـاط مـسـجـلـة
                            </Badge>
                        </div>

                        {/* Topics Area */}
                        <div className="space-y-6">
                            {localMeeting.topics?.map((topic: any, idx: number) => (
                                <div
                                    key={idx}
                                    className={cn(
                                        "group relative bg-white dark:bg-slate-900/50 p-6 md:p-8 rounded-[2.5rem] border-2 transition-all hover:shadow-2xl hover:shadow-slate-200/50 dark:hover:shadow-none animate-in slide-in-from-right-4 duration-300",
                                        topic.isFeatured
                                            ? "border-amber-400 bg-amber-50/20 shadow-xl shadow-amber-200/20"
                                            : "border-slate-50 dark:border-slate-800"
                                    )}
                                >
                                    {/* Topic Top Bar */}
                                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                                        <div className="flex items-center gap-3">
                                            <div className={cn(
                                                "w-10 h-10 rounded-2xl flex items-center justify-center text-lg font-black shrink-0",
                                                topic.isFeatured
                                                    ? "bg-amber-400 text-white shadow-lg shadow-amber-400/30"
                                                    : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                                            )}>
                                                {idx + 1}
                                            </div>
                                            <div className="space-y-1">
                                                <Input
                                                    value={topic.topic}
                                                    onChange={e => {
                                                        const copy = [...localMeeting.topics];
                                                        copy[idx].topic = e.target.value;
                                                        setLocalMeeting({ ...localMeeting, topics: copy });
                                                    }}
                                                    disabled={!isAdmin}
                                                    placeholder="عنوان النقطة..."
                                                    className="font-black text-xl bg-transparent border-none shadow-none focus-visible:ring-0 p-0 h-auto"
                                                />
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest italic">المتحدث:</span>
                                                    <Input
                                                        value={topic.speaker}
                                                        onChange={e => {
                                                            const copy = [...localMeeting.topics];
                                                            copy[idx].speaker = e.target.value;
                                                            setLocalMeeting({ ...localMeeting, topics: copy });
                                                        }}
                                                        disabled={!isAdmin}
                                                        placeholder="اسم المتحدث..."
                                                        className="bg-transparent border-none shadow-none focus-visible:ring-0 p-0 h-auto text-xs font-bold w-[120px]"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {isAdmin && (
                                            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 p-1.5 rounded-2xl ring-1 ring-slate-100 dark:ring-slate-700">
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className={cn("h-9 w-9 rounded-xl", topic.isFeatured ? "text-amber-500 bg-amber-500/10" : "text-slate-400")}
                                                    onClick={() => toggleFeaturedTopic(idx)}
                                                    title="الميزة الأهم"
                                                >
                                                    <Crown className={cn("h-5 w-5", topic.isFeatured ? "fill-amber-500" : "")} />
                                                </Button>
                                                <Separator orientation="vertical" className="h-6 mx-1" />
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-9 w-9 rounded-xl text-slate-500 hover:bg-slate-200"
                                                    onClick={() => moveTopic(idx, 'up')}
                                                    disabled={idx === 0}
                                                >
                                                    <ArrowUp className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-9 w-9 rounded-xl text-slate-500 hover:bg-slate-200"
                                                    onClick={() => moveTopic(idx, 'down')}
                                                    disabled={idx === localMeeting.topics?.length - 1}
                                                >
                                                    <ArrowDown className="h-4 w-4" />
                                                </Button>
                                                <Separator orientation="vertical" className="h-6 mx-1" />
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-9 w-9 rounded-xl text-rose-500 hover:bg-rose-50"
                                                    onClick={() => removeTopic(idx)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Topic Solution Section */}
                                    <div className="bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-[2rem] space-y-3">
                                        <Label className="text-emerald-600 dark:text-emerald-400 font-black text-xs flex items-center gap-2">
                                            <CheckCircle2 className="h-4 w-4" /> الـمـقـررات والـحـلـول
                                        </Label>
                                        <Textarea
                                            value={topic.solutions}
                                            onChange={e => {
                                                const copy = [...localMeeting.topics];
                                                copy[idx].solutions = e.target.value;
                                                setLocalMeeting({ ...localMeeting, topics: copy });
                                            }}
                                            placeholder="ما تم التوصل إليه..."
                                            disabled={!isAdmin}
                                            className="bg-white dark:bg-slate-800 rounded-2xl resize-none border-none shadow-sm min-h-[100px] text-sm leading-relaxed"
                                        />
                                    </div>

                                    {topic.isFeatured && (
                                        <div className="absolute -top-3 right-8 bg-amber-400 text-white px-4 py-1 rounded-full text-[10px] font-black shadow-lg shadow-amber-400/30 flex items-center gap-2 animate-bounce">
                                            <Award className="h-3 w-3" /> أهـم نـقـطـة فـي الـجـلـسـة
                                        </div>
                                    )}
                                </div>
                            ))}

                            {/* Addition Form - Styled */}
                            {isAdmin && (
                                <Card className="bg-primary/5 dark:bg-primary/10 border-2 border-dashed border-primary/20 rounded-[2.5rem] p-6 md:p-8 space-y-6">
                                    <h4 className="text-xl font-black text-primary flex items-center gap-3">
                                        <Plus className="h-7 w-7 bg-primary text-white rounded-2xl p-1 shadow-lg shadow-primary/30" />
                                        إضافة بند جديد للمحضر
                                    </h4>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <Label className="mr-3 text-xs font-black opacity-40">الموضوع / البند</Label>
                                            <Input
                                                placeholder="مثلاً: آلية تقييم المردود الأسبوعي"
                                                value={newTopic.topic}
                                                onChange={e => setNewTopic({ ...newTopic, topic: e.target.value })}
                                                className="rounded-2xl h-12 bg-white dark:bg-slate-950 border-none shadow-sm focus-visible:ring-primary font-bold"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="mr-3 text-xs font-black opacity-40">المتحدث الرئيسي</Label>
                                            <Input
                                                placeholder="من سيقترح أو يعرض النقطة؟"
                                                value={newTopic.speaker}
                                                onChange={e => setNewTopic({ ...newTopic, speaker: e.target.value })}
                                                className="rounded-2xl h-12 bg-white dark:bg-slate-950 border-none shadow-sm font-bold"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="mr-3 text-xs font-black opacity-40">ملخص النقاش الأولي أو الحلول</Label>
                                        <Textarea
                                            placeholder="اكتب التوصيات والمقررات المتفق عليها..."
                                            value={newTopic.solutions}
                                            onChange={e => setNewTopic({ ...newTopic, solutions: e.target.value })}
                                            className="rounded-[2rem] bg-white dark:bg-slate-950 border-none shadow-sm min-h-[120px] p-5 leading-relaxed"
                                        />
                                    </div>

                                    <Button
                                        className="w-full h-14 rounded-2xl text-lg font-black shadow-xl shadow-primary/20 hover:scale-[1.01] transition-all"
                                        onClick={addTopic}
                                        disabled={!newTopic.topic}
                                    >
                                        <Save className="h-5 w-5 mr-3" /> تسـجـيـل الـبـنـد فـي الـمـحـضـر
                                    </Button>
                                </Card>
                            )}

                            {/* Uncovered Suggestions */}
                            {isAdmin && (localMeeting.suggestions?.length > 0) && (
                                <div className="space-y-4 pt-4 border-t-2 border-slate-50 dark:border-slate-800">
                                    <h3 className="font-black text-slate-800 dark:text-white flex items-center gap-2 text-lg">
                                        <Pin className="h-5 w-5 text-primary rotate-45" /> مقترحات لم تُدرج بعد
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {localMeeting.suggestions.map((s: any) => (
                                            <div key={s.id} className="bg-white dark:bg-slate-900/50 p-5 rounded-3xl border border-slate-100 flex items-center justify-between gap-4 shadow-sm hover:border-primary/40 transition-colors group">
                                                <div className="flex-1">
                                                    <p className="text-[10px] font-black text-primary mb-1 uppercase tracking-wider">{s.authorName}</p>
                                                    <p className="text-sm font-medium leading-relaxed">{s.text}</p>
                                                </div>
                                                <Button
                                                    size="icon"
                                                    variant="secondary"
                                                    className="rounded-2xl h-12 w-12 shrink-0 bg-primary/5 hover:bg-primary hover:text-white transition-all shadow-sm"
                                                    onClick={() => convertSuggestionToTopic(s)}
                                                    title="إضافة للمحضر"
                                                >
                                                    <Plus className="h-6 w-6" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Global Smooth Scroller Style */}
            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar {
                  width: 5px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                  background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                  background: #e2e8f0;
                  border-radius: 10px;
                }
                .dark .custom-scrollbar::-webkit-scrollbar-thumb {
                  background: #1e293b;
                }
            `}</style>
        </div>
    );
}
