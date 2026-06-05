"use client";

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useStudentContext } from '@/context/StudentContext';
import { useAuth } from '@/context/AuthContext';
import { Loader2, AlertTriangle, ArrowLeft, ArrowRight, Star, Info } from 'lucide-react';
import { format, startOfWeek, endOfWeek, addDays, subDays, parseISO, getDay } from 'date-fns';
import { ar } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { Student, DailySession, DailyRecord, PerformanceLevel } from '@/lib/types';
import { ProtectedPage } from '@/components/ui/ProtectedPage';





const getAttendanceColor = (status?: string) => {
    switch (status) {
        case 'حاضر': return 'bg-green-300';
        case 'غائب':
        case 'غياب': return 'bg-red-400';
        case 'متأخر': return 'bg-yellow-400';
        case 'تعويض': return 'bg-blue-300';
        case 'عطلة': return 'bg-sky-300 dark:bg-sky-700'; // VERY STRONG Blue - matches calendar
        case 'نشاط': return 'bg-purple-300 dark:bg-purple-700'; // VERY STRONG Purple - matches calendar
        case 'غياب الشيخ': return 'bg-red-300 dark:bg-red-700'; // VERY STRONG Red - matches calendar (no sub)
        case 'غياب الشيخ مع بديل': return 'bg-orange-300 dark:bg-orange-700'; // VERY STRONG Orange - matches calendar (with sub)
        default: return 'bg-gray-100';
    }
};

const getBehaviorClass = (behavior?: string | null) => {
    switch (behavior) {
        case 'هادئ': return 'border-blue-500';
        case 'متوسط': return 'border-yellow-500';
        case 'غير منضبط': return 'border-red-500';
        default: return 'border-transparent';
    }
}

const getEvaluationSymbol = (memorization?: PerformanceLevel | null) => {
    switch (memorization) {
        case 'ممتاز': return '🌟';
        case 'جيد جداً':
        case 'جيد جدا': return '✅';
        case 'جيد': return '👍';
        case 'مقبول':
        case 'متوسط': return '⚠️';
        case 'ضعيف': return '❌';
        case 'لم يحفظ': return '🚫';
        default: return null;
    }
}

const renderRecordDetails = (record: DailyRecord, session?: DailySession) => {
    return (
        <div className="text-xs space-y-1">
            <p><strong>الحضور:</strong> {record.attendance || 'غير مسجل'}</p>
            {session?.sessionType !== 'يوم عطلة' && session?.sessionType !== 'حصة أنشطة' && (
                <>
                    <p><strong>التقييم:</strong> {record.memorization || 'لا يوجد'}</p>
                    <p><strong>مراجعة:</strong> {record.review ? 'نعم' : 'لا'}</p>
                </>
            )}
            <p><strong>السلوك:</strong> {record.behavior || 'غير مسجل'}</p>
            {record.notes && <p><strong>ملاحظات:</strong> {record.notes}</p>}
        </div>
    );
}

const DayCell = ({ sessions, student, date }: { sessions?: DailySession[], student: Student, date: Date }) => {
    // Higher-level session filtering: show all sessions where this student has a record
    const studentSessions = useMemo(() => {
        if (!sessions || !student) return [];
        return sessions.filter((s: DailySession) => s.records?.some((r: DailyRecord) => r.studentId === student.id));
    }, [sessions, student]);

    // Find both session 1 and session 2 if they exist for this week/day
    const session1 = studentSessions.find((s: DailySession) => s.sessionNumber === 1);
    const session2 = studentSessions.find((s: DailySession) => s.sessionNumber === 2);

    const record1 = session1?.records?.find((r: DailyRecord) => r.studentId === student.id);
    const record2 = session2?.records?.find((r: DailyRecord) => r.studentId === student.id);

    // Check if Thursday or Friday - automatic weekend day (if no sessions exist)
    const dayOfWeek = getDay(date);
    const isWeekendDay = (dayOfWeek === 4 || dayOfWeek === 5) && studentSessions.length === 0;

    const isHoliday = session1?.sessionType === 'يوم عطلة' || session2?.sessionType === 'يوم عطلة' || isWeekendDay;
    const isActivity = session1?.sessionType === 'حصة أنشطة' || session2?.sessionType === 'حصة أنشطة';
    const isTeacherAbsence = session1?.sessionType === 'غياب الشيخ' || session2?.sessionType === 'غياب الشيخ';

    const primaryRecord = record1 || record2;
    let primaryStatus: string | undefined = primaryRecord?.attendance;

    if (isHoliday) primaryStatus = 'عطلة';
    else if (isTeacherAbsence) {
        const hasSub = (session1?.sessionType === 'غياب الشيخ' && session1.substituteTeacher) ||
            (session2?.sessionType === 'غياب الشيخ' && session2.substituteTeacher);
        primaryStatus = hasSub ? 'غياب الشيخ مع بديل' : 'غياب الشيخ';
    }
    else if (isActivity) primaryStatus = 'نشاط';

    // Check if student is absent: غائب or غياب
    const isAbsent = primaryStatus === 'غائب' || primaryStatus === 'غياب';

    const attendanceColor = getAttendanceColor(primaryStatus);

    let behaviorClass = 'border-transparent';
    let evaluationSymbol = null;

    if (primaryRecord && !isAbsent && !isHoliday) {
        behaviorClass = getBehaviorClass(primaryRecord.behavior);
        evaluationSymbol = getEvaluationSymbol(primaryRecord.memorization);
    }

    const hasSecondSession = !!record2;

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <div className={cn("h-16 w-full rounded-md p-1 border-2 transition-all relative flex items-center justify-center text-lg font-bold", attendanceColor, isAbsent ? 'border-transparent' : behaviorClass)}>
                    {evaluationSymbol}
                    {hasSecondSession && <div className="absolute top-1 right-1 h-2 w-2 bg-slate-800 rounded-full" title="توجد حصة ثانية"></div>}
                </div>
            </TooltipTrigger>
            <TooltipContent>
                {isHoliday ? (
                    <p>يوم عطلة</p>
                ) : (record1 || record2) ? (
                    <>
                        {record1 ? renderRecordDetails(record1, session1) : <p className="text-xs text-muted-foreground">الحصة 1 لم تسجل.</p>}
                        {record2 && <hr className="my-1" />}
                        {record2 && renderRecordDetails(record2, session2)}
                    </>
                ) : (
                    <p>لا يوجد تسجيل لهذا اليوم.</p>
                )}
            </TooltipContent>
        </Tooltip>
    );
};

export default function WeeklyFollowUpPage() {
    const { students, dailySessions, loading, allUsers } = useStudentContext();
    const { user, isSuperAdmin, isManagement } = useAuth();
    const [selectedStudentId, setSelectedStudentId] = useState<string>('all');
    const [selectedGroup, setSelectedGroup] = useState<string>('sheikhs'); // For admin/management filtering
    const [currentDate, setCurrentDate] = useState(new Date());

    const isAdmin5 = user?.email === 'admin5@gmail.com';


    // Filter active students based on selected group (for admin/management) and selected student
    const activeStudents = useMemo(() => {
        let filtered = (students ?? []).filter(s => s.status === 'نشط');

        // If admin/management, filter by selected group (selectedGroup is UID or category)
        if ((isSuperAdmin || isManagement) && selectedGroup !== 'all') {
            if (selectedGroup === 'sheikhs') {
                filtered = filtered.filter(s => {
                    const num = parseInt(s.groupName?.replace(/\D/g, '') || '0');
                    return num >= 1 && num <= 9;
                });
            } else if (selectedGroup === 'ustadhat') {
                filtered = filtered.filter(s => {
                    const num = parseInt(s.groupName?.replace(/\D/g, '') || '0');
                    return num >= 10 && num <= 18;
                });
            } else {
                const sheikh = allUsers.find(u => u.uid === selectedGroup);
                if (sheikh?.group) {
                    // Filter by group name instead of UID to catch students reassigned or with mismatched ownerIds
                    filtered = filtered.filter(s => s.groupName === sheikh.group);
                } else {
                    // Fallback to UID if sheikh group is not found
                    filtered = filtered.filter(s => s.ownerId === selectedGroup);
                }
            }
        }

        // Filter by specific student if selected
        if (selectedStudentId !== 'all') {
            return filtered.filter(s => s.id === selectedStudentId);
        }

        return filtered;
    }, [students, selectedStudentId, selectedGroup, isSuperAdmin, isManagement, allUsers]);

    // Create unique groups list with numerical sorting
    const uniqueGroups = useMemo(() => {
        const groupMap = new Map<string, { uid: string, group: string, displayName: string }>();

        allUsers
            .filter(u => u.role === 'sheikh' && u.group)
            .forEach(sheikh => {
                // Only keep the first sheikh for each group (to avoid duplicates)
                if (!groupMap.has(sheikh.group!)) {
                    groupMap.set(sheikh.group!, {
                        uid: sheikh.uid,
                        group: sheikh.group!,
                        displayName: sheikh.displayName || 'غير محدد'
                    });
                }
            });

        // Convert to array and sort numerically
        return Array.from(groupMap.values()).sort((a, b) => {
            // Extract numbers from group names (e.g., "فوج 1" -> 1)
            const numA = parseInt(a.group.match(/\d+/)?.[0] || '999');
            const numB = parseInt(b.group.match(/\d+/)?.[0] || '999');
            return numA - numB;
        });
    }, [allUsers]);

    const weekDates = useMemo(() => {
        const start = startOfWeek(currentDate, { weekStartsOn: 6 }); // Saturday
        return Array.from({ length: 7 }).map((_, i) => addDays(start, i));
    }, [currentDate]);

    const handlePreviousWeek = () => {
        setCurrentDate(subDays(currentDate, 7));
    };

    const handleNextWeek = () => {
        setCurrentDate(addDays(currentDate, 7));
    };

    if (loading) {
        return (
            <ProtectedPage>
                <div className="flex items-center justify-center h-[calc(100vh-200px)]">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                </div>
            </ProtectedPage>
        );
    }

    if ((students ?? []).filter(s => s.status === 'نشط').length === 0 && !loading) {
        return (
            <ProtectedPage>
                <div className="space-y-6 flex flex-col items-center justify-center h-[calc(100vh-200px)]">
                    <AlertTriangle className="h-16 w-16 text-yellow-400" />
                    <h1 className="text-3xl font-headline font-bold text-center">لا توجد بيانات لعرضها</h1>
                    <p className="text-muted-foreground text-center">
                        يرجى إضافة طلبة نشطين أولاً من صفحة "إدارة الطلبة".
                    </p>
                </div>
            </ProtectedPage>
        );
    }

    return (
        <ProtectedPage>
            <TooltipProvider>
                <div className="container mx-auto p-4 space-y-6 pb-32 max-w-7xl">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                        <h1 className="text-3xl font-headline font-bold">لوحة المتابعة الأسبوعية</h1>
                        <div className="flex gap-2 w-full md:w-auto items-center">
                            <Button variant="outline" size="icon" onClick={handlePreviousWeek}><ArrowRight className="h-4 w-4" /></Button>
                            <span className="font-semibold text-center w-48">
                                {format(weekDates[0], 'd MMM', { locale: ar })} - {format(weekDates[6], 'd MMM yyyy', { locale: ar })}
                            </span>
                            <Button variant="outline" size="icon" onClick={handleNextWeek}><ArrowLeft className="h-4 w-4" /></Button>
                        </div>
                        <div className="flex gap-2 w-full md:w-auto flex-wrap">
                            {/* Admin/Management: Group Filter */}
                            {(isSuperAdmin || isManagement) && (
                                <Select dir="rtl" value={selectedGroup} onValueChange={setSelectedGroup}>
                                    <SelectTrigger className="w-full md:w-[220px]">
                                        <SelectValue placeholder="اختر الفوج" />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-[300px]">
                                        <SelectItem value="sheikhs">أفواج المشايخ</SelectItem>
                                        <SelectItem value="ustadhat">أفواج الأستاذات</SelectItem>
                                        <SelectItem value="all">كل أفواج المدرسة</SelectItem>
                                        {uniqueGroups.map((group) => (
                                            <SelectItem key={group.uid} value={group.uid}>
                                                {group.group} - {group.displayName}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                            {/* Student Filter */}
                            <Select dir="rtl" value={selectedStudentId} onValueChange={setSelectedStudentId}>
                                <SelectTrigger className="w-full md:w-[200px]">
                                    <SelectValue placeholder="اختر طالبًا" />
                                </SelectTrigger>
                                <SelectContent className="max-h-[300px]">
                                    <SelectItem value="all">كل الطلبة النشطين</SelectItem>
                                    {activeStudents.map(student => (
                                        <SelectItem key={student.id} value={student.id}>
                                            {student.fullName}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <Card>
                        <CardContent className="p-4 overflow-x-auto">
                            <div className={`grid gap-2 min-w-[800px] ${isAdmin5 ? 'grid-cols-9' : 'grid-cols-8'}`}>

                                <div className="font-bold text-center self-center">الطالب</div>
                                {weekDates.map(date => (
                                    <div key={date.toISOString()} className="font-bold text-center">
                                        <div>{format(date, 'EEEE', { locale: ar })}</div>
                                        <div className="text-sm text-muted-foreground">{format(date, 'dd/MM')}</div>
                                    </div>
                                ))}

                                {activeStudents.map(student => (
                                    <React.Fragment key={student.id}>
                                        <div className="font-semibold self-center text-center p-2 bg-muted rounded-md">{student.fullName}</div>
                                        {weekDates.map(date => {
                                            const dateString = format(date, 'yyyy-MM-dd');
                                            const sessions = dailySessions[dateString] ? Object.values(dailySessions[dateString]) : undefined;
                                            return (
                                                <DayCell key={date.toISOString()} sessions={sessions} student={student} date={date} />
                                            )
                                        })}
                                    </React.Fragment>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                مفتاح الدلالات
                                <Tooltip>
                                    <TooltipTrigger>
                                        <Info className="h-4 w-4 text-muted-foreground" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>لون الخلفية = حضور | لون الإطار = سلوك | الرمز الداخلي = تقييم</p>
                                    </TooltipContent>
                                </Tooltip>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <div>
                                <h4 className="font-semibold mb-2">الحضور (لون الخلفية)</h4>
                                <ul className="space-y-1 text-sm">
                                    <li className="flex items-center gap-2"><div className="w-4 h-4 rounded-md bg-green-300"></div> حاضر</li>
                                    <li className="flex items-center gap-2"><div className="w-4 h-4 rounded-md bg-red-400"></div> غائب</li>
                                    <li className="flex items-center gap-2"><div className="w-4 h-4 rounded-md bg-yellow-400"></div> متأخر</li>
                                    <li className="flex items-center gap-2"><div className="w-4 h-4 rounded-md bg-blue-300"></div> تعويض</li>
                                    <li className="flex items-center gap-2"><div className="w-4 h-4 rounded-md bg-sky-300 dark:bg-sky-700"></div> يوم عطلة</li>
                                    <li className="flex items-center gap-2"><div className="w-4 h-4 rounded-md bg-purple-300 dark:bg-purple-700"></div> حصة أنشطة</li>
                                    <li className="flex items-center gap-2"><div className="w-4 h-4 rounded-md bg-red-300 dark:bg-red-700"></div> غياب الشيخ</li>
                                    <li className="flex items-center gap-2"><div className="w-4 h-4 rounded-md bg-orange-300 dark:bg-orange-700"></div> غياب الشيخ مع بديل</li>
                                    <li className="flex items-center gap-2"><div className="w-4 h-4 rounded-md bg-gray-100"></div> لم يسجل</li>
                                </ul>
                            </div>
                            <div>
                                <h4 className="font-semibold mb-2">السلوك (لون الإطار)</h4>
                                <ul className="space-y-1 text-sm">
                                    <li className="flex items-center gap-2"><div className="w-4 h-4 rounded-md border-2 border-blue-500"></div> هادئ</li>
                                    <li className="flex items-center gap-2"><div className="w-4 h-4 rounded-md border-2 border-yellow-500"></div> متوسط</li>
                                    <li className="flex items-center gap-2"><div className="w-4 h-4 rounded-md border-2 border-red-500"></div> غير منضبط</li>
                                </ul>
                            </div>
                            <div>
                                <h4 className="font-semibold mb-2">التقييم (الرمز الداخلي)</h4>
                                <ul className="space-y-1 text-sm">
                                    <li className="flex items-center gap-2"><div className="text-lg">🌟</div> ممتاز</li>
                                    <li className="flex items-center gap-2"><div className="text-lg">✅</div> جيد جداً</li>
                                    <li className="flex items-center gap-2"><div className="text-lg">👍</div> جيد</li>
                                    <li className="flex items-center gap-2"><div className="text-lg">⚠️</div> مقبول / متوسط</li>
                                    <li className="flex items-center gap-2"><div className="text-lg">❌</div> ضعيف</li>
                                    <li className="flex items-center gap-2"><div className="text-lg">🚫</div> لم يحفظ</li>
                                </ul>
                            </div>
                            <div>
                                <h4 className="font-semibold mb-2">دلالات أخرى</h4>
                                <ul className="space-y-1 text-sm">
                                    <li className="flex items-center gap-2"><div className="h-2 w-2 bg-slate-800 rounded-full"></div> توجد حصة ثانية مسجلة</li>
                                </ul>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </TooltipProvider>
        </ProtectedPage>
    );
}
