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
    UserPlus,
    XCircle,
    HelpCircle,
    Calendar,
    ArrowRight,
    UserCircle2,
    Check
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { v4 as uuidv4 } from 'uuid';

export default function MeetingDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const meetingId = params.id as string;
    const { meetings, saveMeeting, allUsers } = useStudentContext();
    const { isSuperAdmin, isManagement, user } = useAuth();
    const { toast } = useToast();

    const isAdmin = isSuperAdmin || isManagement;
    const meeting = useMemo(() => meetings.find(m => m.id === meetingId), [meetings, meetingId]);

    // Internal states for editing
    const [localMeeting, setLocalMeeting] = useState<any>(null);
    const [newTopic, setNewTopic] = useState({ topic: '', speaker: '', solutions: '' });
    const [manualName, setManualName] = useState("");

    useEffect(() => {
        if (meeting) {
            setLocalMeeting(JSON.parse(JSON.stringify(meeting)));
        }
    }, [meeting]);

    if (!meeting || !localMeeting) return <div className="p-8 text-center font-bold">جاري تحميل تفاصيل الاجتماع...</div>;

    const handleSave = async () => {
        await saveMeeting(localMeeting, meetingId);
    };

    const handleToggleStatus = async () => {
        const newStatus = localMeeting.status === 'upcoming' ? 'completed' : 'upcoming';
        const updated = { ...localMeeting, status: newStatus };
        setLocalMeeting(updated);
        await saveMeeting(updated, meetingId);
        toast({ title: `تم تغيير حالة الاجتماع إلى: ${newStatus === 'upcoming' ? 'قادم' : 'مكتمل'}` });
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
        setNewTopic({ topic: '', speaker: '', solutions: '' });
    };

    const removeTopic = (index: number) => {
        const newTopics = [...localMeeting.topics];
        newTopics.splice(index, 1);
        setLocalMeeting({ ...localMeeting, topics: newTopics });
    };

    const convertSuggestionToTopic = (suggestion: any) => {
        setLocalMeeting({
            ...localMeeting,
            topics: [...(localMeeting.topics || []), {
                topic: suggestion.text,
                speaker: suggestion.authorName,
                solutions: ''
            }]
        });
        toast({ title: "تم تحويل المقترح إلى بند نقاش" });
    };

    return (
        <div className="container mx-auto p-4 lg:p-8 space-y-6 max-w-6xl animate-in slide-in-from-bottom-4 duration-500" dir="rtl">
            {/* Header / Nav */}
            <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-4">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.push('/meetings')} className="rounded-full">
                        <ArrowRight className="h-6 w-6" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-black">{localMeeting.title}</h1>
                        <p className="text-muted-foreground">{localMeeting.date}</p>
                    </div>
                </div>
                {isAdmin && (
                    <div className="flex gap-2 w-full md:w-auto">
                        <Button variant="outline" className="flex-1 md:flex-none rounded-xl gap-2 font-bold" onClick={handleToggleStatus}>
                            {localMeeting.status === 'upcoming' ? '✅ وضع كمكتمل' : '🗓️ إرجاع كقادم'}
                        </Button>
                        <Button className="flex-1 md:flex-none rounded-xl gap-2 font-bold bg-primary text-primary-foreground" onClick={handleSave}>
                            <Save className="h-4 w-4" /> حفظ كافة التغييرات
                        </Button>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Right Column: Attendance */}
                <div className="space-y-6">
                    <Card className="shadow-lg border-none bg-white/80 backdrop-blur-md overflow-hidden">
                        <CardHeader className="bg-slate-50 dark:bg-slate-900/50">
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <Users className="h-5 w-5 text-primary" /> قائمة الحضور
                            </CardTitle>
                            <CardDescription>المشايخ والضيوف الحاضرين في الجلسة</CardDescription>
                        </CardHeader>
                        <CardContent className="p-4 space-y-4">
                            {isAdmin && (
                                <div className="flex gap-2 p-2 bg-slate-100 dark:bg-slate-800 rounded-2xl mb-4">
                                    <Input
                                        placeholder="إضافة اسم حاضر..."
                                        className="bg-white rounded-xl h-10 border-none"
                                        value={manualName}
                                        onChange={e => setManualName(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && addManualAttendee()}
                                    />
                                    <Button size="icon" className="rounded-xl h-10 w-10" onClick={addManualAttendee}>
                                        <Plus className="h-4 w-4" />
                                    </Button>
                                </div>
                            )}

                            <div className="grid gap-2 max-h-[500px] overflow-y-auto px-1 custom-scrollbar">
                                {/* Current Attendance List */}
                                {Object.entries(localMeeting.attendance || {}).map(([id, att]: [string, any]) => (
                                    <div key={id} className="flex justify-between items-center p-3 rounded-2xl border border-slate-100 dark:border-slate-800 bg-white shadow-sm animate-in fade-in duration-300">
                                        <div className="flex items-center gap-2">
                                            <div className={cn(
                                                "h-2 w-2 rounded-full",
                                                att.status === 'present' ? "bg-green-500" : att.status === 'absent' ? "bg-red-500" : "bg-slate-400"
                                            )} />
                                            <span className="font-bold text-sm">{att.name}</span>
                                        </div>
                                        {isAdmin && (
                                            <div className="flex gap-1">
                                                <Button
                                                    size="sm"
                                                    variant={att.status === 'present' ? 'default' : 'outline'}
                                                    className="h-8 w-8 p-0 rounded-lg"
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
                                                    className="h-8 w-8 p-0 rounded-lg text-slate-300 hover:text-destructive"
                                                    onClick={() => removeAttendance(id)}
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {(!localMeeting.attendance || Object.keys(localMeeting.attendance).length === 0) && (
                                    <p className="text-center text-muted-foreground py-8 italic text-sm">لم يتم تسجيل حضور بعد</p>
                                )}
                            </div>

                            {/* Quick Add from Registered Users */}
                            {isAdmin && (
                                <div className="mt-8 pt-4 border-t border-dashed">
                                    <h4 className="text-xs font-bold text-muted-foreground mb-3 px-2">إضافة سريعة لمشايخ المدرسة:</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {allUsers.filter(u => u.role === 'sheikh' && !localMeeting.attendance?.[u.uid]).map(sheikh => (
                                            <Button
                                                key={sheikh.uid}
                                                variant="secondary"
                                                size="sm"
                                                className="text-[10px] h-7 rounded-full bg-slate-100 hover:bg-primary/10 hover:text-primary transition-colors"
                                                onClick={() => toggleAttendance(sheikh.uid, sheikh.displayName || '', 'present')}
                                            >
                                                + {sheikh.displayName}
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="bg-primary/5 border-primary/20 shadow-xl overflow-hidden rounded-3xl">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2"><Utensils className="h-5 w-5" /> الإطعام</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="food-toggle-detail"
                                    checked={localMeeting.foodProvided}
                                    onChange={e => setLocalMeeting({ ...localMeeting, foodProvided: e.target.checked })}
                                    disabled={!isAdmin}
                                />
                                <Label htmlFor="food-toggle-detail">توفر إطعام في هذه الجلسة</Label>
                            </div>
                            {localMeeting.foodProvided && (
                                <Input
                                    placeholder="مثل: عشاء شواء، فواكه..."
                                    value={localMeeting.foodDetails || ''}
                                    onChange={e => setLocalMeeting({ ...localMeeting, foodDetails: e.target.value })}
                                    disabled={!isAdmin}
                                    className="rounded-xl"
                                />
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Left Column: Topics & Discussions */}
                <div className="lg:col-span-2 space-y-6">
                    <Card className="shadow-2xl border-none p-2 rounded-3xl overflow-hidden">
                        <CardHeader className="border-b pb-6 px-6">
                            <CardTitle className="text-2xl font-black">محضر الاجتماع والنقاط المثارة</CardTitle>
                            <CardDescription>توثيق مجريات الجلسة والقرارات المتخذة</CardDescription>
                        </CardHeader>
                        <CardContent className="p-6 space-y-8">
                            {/* Suggestions List */}
                            {isAdmin && (localMeeting.suggestions?.length > 0) && (
                                <div className="space-y-4 bg-primary/5 p-6 rounded-3xl border-2 border-dashed border-primary/20">
                                    <h3 className="font-bold text-primary flex items-center gap-2">
                                        <MessageCircle className="h-5 w-5" /> مقترحات المشايخ المستلمة
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {localMeeting.suggestions.map((s: any) => (
                                            <div key={s.id} className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm flex items-center justify-between gap-3 border border-slate-100">
                                                <div className="flex-1">
                                                    <p className="text-[10px] font-bold text-primary mb-1">{s.authorName}</p>
                                                    <p className="text-sm leading-relaxed">{s.text}</p>
                                                </div>
                                                <Button size="icon" variant="ghost" className="rounded-full hover:bg-primary/10 h-10 w-10 shrink-0" onClick={() => convertSuggestionToTopic(s)}>
                                                    <Plus className="h-5 w-5 text-primary" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Main Topics Area */}
                            <div className="space-y-6">
                                {localMeeting.topics?.map((topic: any, idx: number) => (
                                    <div key={idx} className="group relative bg-slate-50 dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-300 shadow-xs hover:shadow-md transition-shadow">
                                        <div className="space-y-4">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label className="text-primary font-bold">الموضوع / النقطة</Label>
                                                    <Input
                                                        value={topic.topic}
                                                        onChange={e => {
                                                            const copy = [...localMeeting.topics];
                                                            copy[idx].topic = e.target.value;
                                                            setLocalMeeting({ ...localMeeting, topics: copy });
                                                        }}
                                                        disabled={!isAdmin}
                                                        className="font-bold text-lg bg-transparent border-none shadow-none focus-visible:ring-0 p-0 h-auto"
                                                    />
                                                </div>
                                                <div className="space-y-2 text-left md:text-right">
                                                    <Label className="opacity-60 text-xs">المتحدث / صاحب النقطة</Label>
                                                    <Input
                                                        value={topic.speaker}
                                                        onChange={e => {
                                                            const copy = [...localMeeting.topics];
                                                            copy[idx].speaker = e.target.value;
                                                            setLocalMeeting({ ...localMeeting, topics: copy });
                                                        }}
                                                        disabled={!isAdmin}
                                                        className="bg-transparent border-none shadow-none focus-visible:ring-0 p-0 h-auto"
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-2 pt-4 border-t border-slate-200 dark:border-slate-700">
                                                <Label className="text-green-600 font-bold flex items-center gap-1">
                                                    <CheckCircle2 className="h-4 w-4" /> الحل المقترح / القرار المتخذ
                                                </Label>
                                                <Textarea
                                                    value={topic.solutions}
                                                    onChange={e => {
                                                        const copy = [...localMeeting.topics];
                                                        copy[idx].solutions = e.target.value;
                                                        setLocalMeeting({ ...localMeeting, topics: copy });
                                                    }}
                                                    placeholder="اكتب هنا القرارات أو الخلاصات التي تم التوصل إليها..."
                                                    disabled={!isAdmin}
                                                    className="bg-white dark:bg-black rounded-2xl resize-none border-none shadow-sm h-24"
                                                />
                                            </div>
                                        </div>
                                        {isAdmin && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="absolute -top-2 -left-2 rounded-full bg-white dark:bg-slate-800 shadow-md text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                                onClick={() => removeTopic(idx)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                ))}

                                {isAdmin && (
                                    <div className="bg-slate-100/50 dark:bg-slate-900/50 p-6 rounded-3xl border-2 border-dotted border-slate-300 dark:border-slate-700 space-y-4">
                                        <h4 className="font-bold flex items-center gap-2"><Plus className="h-5 w-5" /> إضافة بند جديد للمحضر</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <Label className="text-xs mr-2">موضوع النقاش</Label>
                                                <Input
                                                    placeholder="مثال: مشكلة الغياب المتكرر"
                                                    value={newTopic.topic}
                                                    onChange={e => setNewTopic({ ...newTopic, topic: e.target.value })}
                                                    className="rounded-xl border-none shadow-sm"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs mr-2">صاحب المداخلة</Label>
                                                <Input
                                                    placeholder="اسم الشيخ أو عضو الإدارة..."
                                                    value={newTopic.speaker}
                                                    onChange={e => setNewTopic({ ...newTopic, speaker: e.target.value })}
                                                    className="rounded-xl border-none shadow-sm"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs mr-2">ملخص النقاش أو القرار</Label>
                                            <Textarea
                                                placeholder="اكتب الخلاصات المتفق عليها..."
                                                value={newTopic.solutions}
                                                onChange={e => setNewTopic({ ...newTopic, solutions: e.target.value })}
                                                rows={2}
                                                className="rounded-2xl border-none shadow-sm"
                                            />
                                        </div>
                                        <Button className="w-full rounded-2xl gap-2 font-black h-12" onClick={addTopic}>
                                            <Plus className="h-5 w-5" /> تسجيل البند في المحضر
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
