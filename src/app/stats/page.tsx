
"use client";

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useStudentContext } from '@/context/StudentContext';
import { Loader2, AlertTriangle, ArrowLeft, ArrowRight, Star } from 'lucide-react';
import { format, startOfWeek, endOfWeek, addDays, subDays, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { Student, DailySession, DailyRecord, PerformanceLevel } from '@/lib/types';


const getAttendanceColor = (status?: string) => {
  switch (status) {
    case "حاضر": return "bg-green-300 dark:bg-green-800";
    case "غائب": return "bg-red-400 dark:bg-red-800";
    case "متأخر": return "bg-yellow-400 dark:bg-yellow-700";
    case "تعويض": return "bg-blue-300 dark:bg-blue-700";
    case "عطلة": return "bg-gray-300 dark:bg-gray-600";
    default: return "bg-gray-100 dark:bg-gray-700/50";
  }
};

const getBehaviorClass = (behavior?: string | null) => {
    switch(behavior) {
        case 'هادئ': return 'border-blue-500';
        case 'متوسط': return 'border-yellow-500';
        case 'غير منضبط': return 'border-red-500';
        default: return 'border-transparent';
    }
}

const getEvaluationIcon = (evaluation?: PerformanceLevel | null) => {
    switch(evaluation) {
        case 'ممتاز': return <Star className="h-3 w-3 text-green-500 fill-green-500" />;
        case 'جيد': return <Star className="h-3 w-3 text-blue-500 fill-blue-500" />;
        case 'متوسط': return <Star className="h-3 w-3 text-orange-500 fill-orange-500" />;
        case 'ضعيف': return <Star className="h-3 w-3 text-red-500 fill-red-500" />;
        default: return null;
    }
}


const DayCell = ({ sessions, student, date }: { sessions?: DailySession[], student: Student, date: Date }) => {
    const session1 = sessions?.find(s => s.sessionNumber === 1);
    const session2 = sessions?.find(s => s.sessionNumber === 2);
    
    const record1 = session1?.records?.find(r => r.studentId === student.id);
    const record2 = session2?.records?.find(r => r.studentId === student.id);

    const isHoliday = session1?.sessionType === 'يوم عطلة' || session2?.sessionType === 'يوم عطلة';
    
    let primaryStatus = isHoliday ? 'عطلة' : record1?.attendance || record2?.attendance;
    
    const attendanceColor = getAttendanceColor(primaryStatus);

    let behaviorClass = 'border-transparent';
    let evaluationIcon = null;

    if (primaryStatus && ['حاضر', 'متأخر', 'تعويض'].includes(primaryStatus)) {
        // Prioritize session 1 for display, fallback to session 2
        const primaryRecord = record1 || record2;
        if(primaryRecord){
            behaviorClass = getBehaviorClass(primaryRecord.behavior);
            evaluationIcon = getEvaluationIcon(primaryRecord.memorization);
        }
    }
    
    const renderRecordDetails = (record: DailyRecord, session?: DailySession) => (
        <div className="text-right">
            <p className="font-semibold">الحصة {session?.sessionNumber} ({session?.sessionType})</p>
            <p className="text-xs"><span className="font-bold">الحضور:</span> {record.attendance || 'لم يسجل'}</p>
            <p className="text-xs"><span className="font-bold">السلوك:</span> {record.behavior || 'لم يسجل'}</p>
            <p className="text-xs"><span className="font-bold">التقييم:</span> {record.memorization || 'لم يقيم'}</p>
        </div>
    );

    let tooltipContent;
    if (isHoliday) {
        tooltipContent = <p>يوم عطلة</p>;
    } else if (record1 || record2) {
        tooltipContent = (
            <div className="space-y-2">
                 <p className="font-bold border-b pb-1 mb-1">{format(date, 'd MMMM yyyy', { locale: ar })}</p>
                 {record1 ? renderRecordDetails(record1, session1) : <p className="text-xs text-muted-foreground">الحصة 1 لم تسجل.</p>}
                 {record2 && <hr className="my-1"/>}
                 {record2 && renderRecordDetails(record2, session2)}
            </div>
        );
    } else {
        tooltipContent = (
             <div className="text-right">
                <p><span className="font-bold">التاريخ:</span> {format(date, 'd MMMM yyyy', { locale: ar })}</p>
                <p>لا يوجد تسجيل لهذا اليوم.</p>
            </div>
        );
    }

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <div className={cn("h-16 w-full rounded-md p-1 border-2 transition-all relative flex items-center justify-center text-xs font-bold", attendanceColor, behaviorClass)}>
                    {primaryStatus || 'لم يسجل'}
                    {record2 && <div className="absolute top-1 right-1 h-2 w-2 bg-slate-800 rounded-full" title="توجد حصة ثانية"></div>}
                    {evaluationIcon && <div className="absolute bottom-1 right-1" title="مستوى التقييم">{evaluationIcon}</div>}
                </div>
            </TooltipTrigger>
            <TooltipContent>
                {tooltipContent}
            </TooltipContent>
        </Tooltip>
    );
};

export default function WeeklyFollowUpPage() {
    const { students, dailySessions, loading } = useStudentContext();
    const [selectedStudentId, setSelectedStudentId] = useState<string>('all');
    const [currentDate, setCurrentDate] = useState(new Date());

    const activeStudents = useMemo(() => {
        const filtered = (students ?? []).filter(s => s.status === 'نشط');
        if (selectedStudentId !== 'all') {
            return filtered.filter(s => s.id === selectedStudentId);
        }
        return filtered.sort((a,b) => a.fullName.localeCompare(b.fullName));
    }, [students, selectedStudentId]);
    
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
            <div className="flex items-center justify-center h-[calc(100vh-200px)]">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }
    
     if ((students ?? []).filter(s => s.status === 'نشط').length === 0 && !loading) {
        return (
            <div className="space-y-6 flex flex-col items-center justify-center h-[calc(100vh-200px)]">
                <AlertTriangle className="h-16 w-16 text-yellow-400" />
                <h1 className="text-3xl font-headline font-bold text-center">لا توجد بيانات لعرضها</h1>
                <p className="text-muted-foreground text-center">
                    يرجى إضافة طلبة نشطين أولاً من صفحة "إدارة الطلبة".
                </p>
            </div>
        );
    }
    
    return (
        <TooltipProvider>
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <h1 className="text-3xl font-headline font-bold">لوحة المتابعة الأسبوعية</h1>
                    <div className="flex gap-2 w-full md:w-auto items-center">
                         <Button variant="outline" size="icon" onClick={handlePreviousWeek}><ArrowRight className="h-4 w-4" /></Button>
                         <span className="font-semibold text-center w-48">
                            {format(weekDates[0], 'd MMM', { locale: ar })} - {format(weekDates[6], 'd MMM yyyy', { locale: ar })}
                         </span>
                         <Button variant="outline" size="icon" onClick={handleNextWeek}><ArrowLeft className="h-4 w-4" /></Button>
                    </div>
                     <div className="flex gap-2 w-full md:w-auto">
                        <Select dir="rtl" value={selectedStudentId} onValueChange={setSelectedStudentId}>
                            <SelectTrigger className="w-full md:w-[200px]">
                                <SelectValue placeholder="اختر طالبًا" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">كل الطلبة النشطين</SelectItem>
                                {(students ?? []).filter(s => s.status === 'نشط').map(student => (
                                    <SelectItem key={student.id} value={student.id}>
                                        {student.fullName}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <Card>
                    <CardContent className="p-4">
                        <div className="grid grid-cols-8 gap-2">
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
                                            <DayCell key={date.toISOString()} sessions={sessions} student={student} date={date}/>
                                         )
                                    })}
                                 </React.Fragment>
                             ))}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle>مفتاح الدلالات</CardTitle></CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div>
                            <h4 className="font-semibold mb-2">🟩 الحضور (لون الخلفية)</h4>
                            <ul className="space-y-1 text-sm">
                                <li className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-green-300"></div> حاضر</li>
                                <li className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-red-400"></div> غائب</li>
                                <li className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-yellow-400"></div> متأخر</li>
                                <li className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-blue-300"></div> تعويض</li>
                                <li className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-gray-300"></div> يوم عطلة</li>
                                <li className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-gray-100"></div> لم يسجل</li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-semibold mb-2">📏 السلوك (لون الإطار)</h4>
                             <ul className="space-y-1 text-sm">
                                <li className="flex items-center gap-2"><div className="w-4 h-4 rounded-md border-2 border-blue-500"></div> هادئ</li>
                                <li className="flex items-center gap-2"><div className="w-4 h-4 rounded-md border-2 border-yellow-500"></div> متوسط</li>
                                <li className="flex items-center gap-2"><div className="w-4 h-4 rounded-md border-2 border-red-500"></div> غير منضبط</li>
                            </ul>
                        </div>
                         <div>
                            <h4 className="font-semibold mb-2">⭐ التقييم (أيقونة النجمة)</h4>
                             <ul className="space-y-1 text-sm">
                                <li className="flex items-center gap-2"><Star className="h-4 w-4 text-green-500 fill-green-500" /> ممتاز</li>
                                <li className="flex items-center gap-2"><Star className="h-4 w-4 text-blue-500 fill-blue-500" /> جيد</li>
                                <li className="flex items-center gap-2"><Star className="h-4 w-4 text-orange-500 fill-orange-500" /> متوسط</li>
                                <li className="flex items-center gap-2"><Star className="h-4 w-4 text-red-500 fill-red-500" /> ضعيف</li>
                                <li className="flex items-center gap-2">لا توجد نجمة: لم يقيم</li>
                            </ul>
                        </div>
                         <div>
                            <h4 className="font-semibold mb-2">🏷️ دلالات أخرى</h4>
                             <ul className="space-y-1 text-sm">
                                <li className="flex items-center gap-2"><div className="h-2 w-2 bg-slate-800 rounded-full"></div> توجد حصة ثانية مسجلة</li>
                            </ul>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </TooltipProvider>
    );
}

    