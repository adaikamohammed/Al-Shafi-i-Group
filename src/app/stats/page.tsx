

"use client";

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useStudentContext } from '@/context/StudentContext';
import { Loader2, AlertTriangle, ArrowLeft, ArrowRight } from 'lucide-react';
import { format, startOfWeek, endOfWeek, addDays, subDays, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { Student, DailySession, SessionRecord } from '@/lib/types';


const getAttendanceColor = (status?: string) => {
  switch (status) {
    case "حاضر": return "bg-green-300";
    case "غائب": return "bg-red-400";
    case "متأخر": return "bg-yellow-400";
    case "تعويض": return "bg-blue-300";
    default: return "bg-gray-100";
  }
};

const getBehaviorClass = (behavior?: string) => {
    switch(behavior) {
        case 'هادئ': return 'border-blue-500';
        case 'متوسط': return 'border-yellow-500';
        case 'غير منضبط': return 'border-red-500';
        default: return 'border-transparent';
    }
}

const DayCell = ({ session, record, date }: { session?: DailySession, record?: SessionRecord, date: Date }) => {
    const status = session?.sessionType === 'يوم عطلة' ? 'عطلة' : record?.attendance;
    const behavior = record?.behavior;
    const sessionType = session?.sessionType;
    
    const attendanceColor = getAttendanceColor(status);
    const behaviorClass = getBehaviorClass(behavior);

    let content;
    if (session?.sessionType === 'يوم عطلة') {
        content = (
            <div className="flex items-center justify-center h-full">
                <span className="text-xs text-gray-500">عطلة</span>
            </div>
        );
    } else if (record) {
        content = (
             <div className="text-center">
                 <span className="text-xs font-bold">{status}</span>
             </div>
        );
    } else {
         content = <div className="h-full"></div>;
    }

    const tooltipContent = (
         <div className="text-right">
            <p><span className="font-bold">التاريخ:</span> {format(date, 'd MMMM yyyy', { locale: ar })}</p>
            <p><span className="font-bold">نوع الحصة:</span> {sessionType || 'غير مسجلة'}</p>
            {session?.sessionType !== 'يوم عطلة' && record && (
                <>
                    <p><span className="font-bold">الحضور:</span> {record.attendance}</p>
                    <p><span className="font-bold">السلوك:</span> {record.behavior}</p>
                    <p><span className="font-bold">التقييم:</span> {record.memorization || 'لم يقيم'}</p>
                    <p><span className="font-bold">المراجعة:</span> {record.review ? 'نعم ✅' : 'لا ❌'}</p>
                    {record.notes && <p><span className="font-bold">ملاحظات:</span> {record.notes}</p>}
                </>
            )}
        </div>
    );

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <div className={cn("h-16 w-full rounded-md p-1 border-2 transition-all", attendanceColor, behaviorClass)}>
                    {content}
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
        return filtered;
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
                                         const session = dailySessions ? dailySessions[dateString] : undefined;
                                         const record = session?.records?.find(r => r.studentId === student.id);
                                         return (
                                            <DayCell key={date.toISOString()} session={session} record={record} date={date}/>
                                         )
                                    })}
                                 </React.Fragment>
                             ))}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle>مفتاح الدلالات</CardTitle></CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                            <h4 className="font-semibold mb-2">🟩 الحضور (لون الخلفية)</h4>
                            <ul className="space-y-1 text-sm">
                                <li className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-green-300"></div> حاضر</li>
                                <li className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-red-400"></div> غائب</li>
                                <li className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-yellow-400"></div> متأخر</li>
                                <li className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-blue-300"></div> تعويض</li>
                                <li className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-gray-100"></div> يوم عطلة / لم يسجل</li>
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
                            <h4 className="font-semibold mb-2">🏷️ نوع الحصة</h4>
                             <ul className="space-y-1 text-sm">
                                <li>حصة أساسية</li>
                                <li>حصة أنشطة</li>
                                <li>حصة تعويضية</li>
                                <li>يوم عطلة</li>
                            </ul>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </TooltipProvider>
    );
}
