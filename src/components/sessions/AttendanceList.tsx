import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Check, X, Clock, Star, MessageSquare, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Student, AttendanceStatus, PerformanceLevel, BehaviorLevel } from '@/lib/types';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/context/AuthContext';
import { surahs } from '@/lib/surahs';
import { CatchUpEntry } from '@/lib/types';
import { Plus, Trash2, Rewind } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface AttendanceRecord {
    studentId: string;
    attendance: AttendanceStatus;
    memorization: PerformanceLevel;
    behavior: BehaviorLevel;
    notes: string;
    review: boolean;
    surahId?: number;
    fromVerse?: number;
    toVerse?: number;
    catchUpRecords?: CatchUpEntry[];
}

interface AttendanceListProps {
    students: Student[];
    records: Record<string, AttendanceRecord>;
    onUpdateRecord: (studentId: string, field: keyof AttendanceRecord, value: any) => void;
    viewMode?: 'full' | 'attendance' | 'evaluation';
    sessionType?: string;
    pastWirds?: { date: string, dayName: string, sessionNumber: number, surahId: number, surahName: string, fromVerse: number, toVerse: number, presentStudentIds: string[] }[];
}

export const AttendanceList = ({ students, records, onUpdateRecord, viewMode = 'full', sessionType, pastWirds = [] }: AttendanceListProps) => {
    const { user } = useAuth();
    const isAdmin5 = user?.email === 'admin5@gmail.com';
    const isActivitySession = sessionType === 'حصة أنشطة';

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'حاضر': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
            case 'غياب': return 'bg-red-100 text-red-700 border-red-200';
            case 'متأخر': return 'bg-amber-100 text-amber-700 border-amber-200';
            default: return 'bg-gray-100 text-gray-500 border-gray-200';
        }
    };

    return (
        <div className="space-y-4" dir="rtl">
            {/* Bulk Actions */}
            {(viewMode === 'full' || viewMode === 'attendance') && (
                <div className="flex flex-wrap gap-2 items-center bg-muted/30 p-2 rounded-xl border border-dashed border-muted-foreground/20">
                    <span className="text-[10px] md:text-xs font-bold text-muted-foreground ml-2">تحديد سريع:</span>
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 md:h-8 text-[10px] md:text-xs gap-1 border-emerald-200 hover:bg-emerald-50 text-emerald-700 font-bold"
                        onClick={() => students.forEach(s => onUpdateRecord(s.id, 'attendance', 'حاضر'))}
                    >
                        <CheckCircle2 className="h-3 w-3" />
                        الكل حاضر
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 md:h-8 text-[10px] md:text-xs gap-1 border-red-200 hover:bg-red-50 text-red-700 font-bold"
                        onClick={() => students.forEach(s => onUpdateRecord(s.id, 'attendance', 'غياب'))}
                    >
                        <XCircle className="h-3 w-3" />
                        الكل غائب
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 md:h-8 text-[10px] md:text-xs gap-1 text-muted-foreground"
                        onClick={() => students.forEach(s => onUpdateRecord(s.id, 'attendance', ''))}
                    >
                        مسح الكل
                    </Button>
                </div>
            )}
            {students.map((student) => {
                const record = records[student.id] || { attendance: '', memorization: '', behavior: '', notes: '', review: false };
                const selectedSurah = surahs.find(s => s.id === record.surahId);

                return (
                    <Card key={student.id} className={cn(
                        "transition-all duration-300 overflow-hidden border shadow-sm hover:shadow-md",
                        record.attendance === 'غياب' ? 'opacity-80 bg-red-50/30' : 'bg-card'
                    )}>
                        <CardContent className="p-2 md:p-4">
                            <div className="flex flex-col gap-2 md:gap-4">
                                {/* Header: Avatar & Name */}
                                <div className="flex items-center gap-2 md:gap-3">
                                    <Avatar className="h-8 w-8 md:h-12 md:w-12 border-2 border-background shadow-sm shrink-0">
                                        <AvatarImage src={student.photoURL} className="object-cover" />
                                        <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">{student.fullName.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-xs md:text-base truncate leading-tight">{student.fullName}</h3>
                                        <div className="flex gap-2 text-[10px] md:text-xs text-muted-foreground items-center">
                                            {!isActivitySession && <span className="truncate">{student.dailyMemorizationAmount}</span>}
                                            {record.attendance && (
                                                <Badge variant="outline" className={cn("text-[9px] md:text-[10px] px-1 py-0", getStatusColor(record.attendance))}>
                                                    {record.attendance}
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Actions Row */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-4">
                                    {/* Attendance Buttons - Show in 'attendance' or 'full' mode */}
                                    {(viewMode === 'full' || viewMode === 'attendance') && (
                                        <div className="flex gap-1 md:gap-2 h-8 md:h-9">
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant={record.attendance === 'حاضر' ? 'default' : 'outline'}
                                                className={cn("flex-1 text-[10px] md:text-xs font-bold px-1", record.attendance === 'حاضر' && "bg-emerald-600 hover:bg-emerald-700")}
                                                onClick={() => onUpdateRecord(student.id, 'attendance', record.attendance === 'حاضر' ? '' : 'حاضر')}
                                            >
                                                <Check className="h-3 w-3 ml-1" /> حاضر
                                            </Button>
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant={record.attendance === 'متأخر' ? 'default' : 'outline'}
                                                className={cn("flex-1 text-[10px] md:text-xs font-bold px-1", record.attendance === 'متأخر' && "bg-amber-500 hover:bg-amber-600")}
                                                onClick={() => onUpdateRecord(student.id, 'attendance', record.attendance === 'متأخر' ? '' : 'متأخر')}
                                            >
                                                <Clock className="h-3 w-3 ml-1" /> متأخر
                                            </Button>
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant={record.attendance === 'غياب' ? 'destructive' : 'outline'}
                                                className="flex-1 text-[10px] md:text-xs font-bold px-1"
                                                onClick={() => onUpdateRecord(student.id, 'attendance', record.attendance === 'غياب' ? '' : 'غياب')}
                                            >
                                                <X className="h-3 w-3 ml-1" /> غائب
                                            </Button>
                                        </div>
                                    )}

                                    {/* Evaluation (Only if Present/Late) - Show in 'evaluation' or 'full' mode */}
                                    {(record.attendance === 'حاضر' || record.attendance === 'متأخر') && (viewMode === 'full' || viewMode === 'evaluation') && (
                                        <div className={cn("space-y-2 md:space-y-3", (viewMode === 'evaluation' || !isActivitySession) ? "col-span-1 md:col-span-1" : "")}>
                                            <div className="flex flex-wrap gap-1 md:gap-2 items-center">
                                                {!isActivitySession && (
                                                    <>
                                                        {/* Per-student Review Toggle - prominent button */}
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const newReview = !record.review;
                                                                onUpdateRecord(student.id, 'review', newReview);
                                                                // Clear memorization when review mode is turned on
                                                                if (newReview) onUpdateRecord(student.id, 'memorization', '');
                                                            }}
                                                            className={cn(
                                                                "flex items-center gap-1 h-8 md:h-9 px-2 md:px-3 rounded-lg border-2 font-bold text-[10px] md:text-xs transition-all",
                                                                record.review
                                                                    ? "bg-blue-100 border-blue-400 text-blue-800 shadow-sm"
                                                                    : "bg-muted/30 border-muted-foreground/20 text-muted-foreground hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700"
                                                            )}
                                                        >
                                                            <BookOpen className="h-3 w-3 md:h-4 md:w-4" />
                                                            مراجعة
                                                        </button>

                                                        {/* Memorization dropdown — hidden when review mode is active */}
                                                        {!record.review ? (
                                                            <Select value={record.memorization} onValueChange={(val) => onUpdateRecord(student.id, 'memorization', val)} dir="rtl">
                                                                <SelectTrigger className="h-8 md:h-9 text-[10px] md:text-xs font-bold w-[90px] md:w-[110px]">
                                                                    <SelectValue placeholder="الحفظ" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="ممتاز">🌟 ممتاز</SelectItem>
                                                                    <SelectItem value="جيد جدا">✅ جيد جداً</SelectItem>
                                                                    <SelectItem value="جيد">👍 جيد</SelectItem>
                                                                    <SelectItem value="مقبول">⚠️ مقبول</SelectItem>
                                                                    <SelectItem value="ضعيف">❌ ضعيف</SelectItem>
                                                                    <SelectItem value="لم يحفظ">🚫 لم يحفظ</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 h-8 md:h-9 px-2 md:px-3 rounded-lg bg-blue-50 border border-blue-300 text-blue-700 font-bold text-[10px] md:text-xs">
                                                                <BookOpen className="h-3 w-3" /> وضع مراجعة
                                                            </span>
                                                        )}
                                                    </>
                                                )}

                                                <Select value={record.behavior} onValueChange={(val) => onUpdateRecord(student.id, 'behavior', val)} dir="rtl">
                                                    <SelectTrigger className="h-8 md:h-9 text-[10px] md:text-xs font-bold w-[80px] md:w-[100px]">
                                                        <SelectValue placeholder="السلوك" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="هادئ">هادئ</SelectItem>
                                                        <SelectItem value="مقبول">مقبول</SelectItem>
                                                        <SelectItem value="مشاغب">مشاغب</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div className="flex gap-2">
                                                <Input
                                                    className="h-8 md:h-9 text-[10px] md:text-xs bg-muted/20"
                                                    placeholder="ملاحظات..."
                                                    value={record.notes}
                                                    onChange={(e) => onUpdateRecord(student.id, 'notes', e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
};
