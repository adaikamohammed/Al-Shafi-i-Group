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

                                                        <div className="flex items-center gap-1 bg-muted/30 px-1.5 md:px-2 rounded-md h-8 md:h-9 border cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => onUpdateRecord(student.id, 'review', !record.review)}>
                                                            <Checkbox
                                                                checked={record.review}
                                                                onCheckedChange={(checked) => onUpdateRecord(student.id, 'review', checked)}
                                                                id={`review-${student.id}`}
                                                                className="h-3.5 w-3.5 md:h-4 md:w-4"
                                                            />
                                                            <label htmlFor={`review-${student.id}`} className="text-[10px] md:text-xs font-bold cursor-pointer select-none">مراجعة</label>
                                                        </div>
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

                                            {/* Catch-up Wird Section (Admin5) */}
                                            {isAdmin5 && !isActivitySession && (
                                                <div className="flex flex-col gap-1.5 w-full mt-2 bg-emerald-50/50 p-2 rounded-lg border border-dashed border-emerald-100">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="text-[10px] font-bold text-emerald-700 shrink-0">أوراد فائتة:</span>
                                                        {pastWirds.length > 0 && (
                                                            <DropdownMenu dir="rtl">
                                                                <DropdownMenuTrigger asChild>
                                                                    <Button variant="outline" size="sm" className="h-7 text-[10px] px-2.5 bg-white border-emerald-200 text-emerald-700 hover:bg-emerald-50 active:bg-emerald-100 shrink-0">
                                                                        <Plus className="h-3 w-3 ml-1" /> إضافة
                                                                    </Button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end" className="max-h-72 overflow-y-auto w-64">
                                                                    {pastWirds.map((wird, idx) => {
                                                                        const alreadyMemorized = wird.presentStudentIds.includes(student.id);
                                                                        const alreadyAdded = (record.catchUpRecords || []).some(r => r.date === wird.date && r.sessionNumber === wird.sessionNumber);
                                                                        const isDisabled = alreadyMemorized || alreadyAdded;

                                                                        return (
                                                                            <DropdownMenuItem
                                                                                key={idx}
                                                                                className={cn(
                                                                                    "text-right text-xs py-2.5 px-3",
                                                                                    isDisabled ? "opacity-60 cursor-default" : "cursor-pointer",
                                                                                    alreadyMemorized && "bg-green-50/50",
                                                                                    alreadyAdded && "bg-amber-50/50"
                                                                                )}
                                                                                disabled={isDisabled}
                                                                                onClick={() => {
                                                                                    if (isDisabled) return;
                                                                                    const newEntry: CatchUpEntry = {
                                                                                        date: wird.date,
                                                                                        sessionNumber: wird.sessionNumber,
                                                                                        surahId: wird.surahId,
                                                                                        surahName: wird.surahName,
                                                                                        fromVerse: wird.fromVerse,
                                                                                        toVerse: wird.toVerse,
                                                                                        completed: true
                                                                                    };
                                                                                    onUpdateRecord(student.id, 'catchUpRecords', [...(record.catchUpRecords || []), newEntry]);
                                                                                }}
                                                                            >
                                                                                <div className="flex items-start gap-2 w-full">
                                                                                    <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                                                                                        <span className="font-bold text-[11px]">{wird.surahName} (آية {wird.fromVerse} → {wird.toVerse})</span>
                                                                                        <span className="text-muted-foreground text-[10px]">{wird.dayName} - {wird.date}</span>
                                                                                    </div>
                                                                                    {alreadyMemorized && (
                                                                                        <span className="text-green-600 text-[9px] font-bold bg-green-100 px-1.5 py-0.5 rounded shrink-0">✅ حفظ</span>
                                                                                    )}
                                                                                    {alreadyAdded && (
                                                                                        <span className="text-amber-600 text-[9px] font-bold bg-amber-100 px-1.5 py-0.5 rounded shrink-0">مُضاف</span>
                                                                                    )}
                                                                                </div>
                                                                            </DropdownMenuItem>
                                                                        );
                                                                    })}
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        )}
                                                    </div>
                                                    {(record.catchUpRecords?.length ?? 0) > 0 && (
                                                        <div className="flex flex-wrap gap-1.5 items-center">
                                                            {record.catchUpRecords?.map((catchUp, idx) => (
                                                                <Badge key={idx} variant="secondary" className="bg-white border-emerald-200 text-emerald-700 text-[10px] flex items-center gap-1 hover:bg-red-50 hover:text-red-600 active:bg-red-100 cursor-pointer py-1 px-2"
                                                                    onClick={() => {
                                                                        const newRecords = [...(record.catchUpRecords || [])];
                                                                        newRecords.splice(idx, 1);
                                                                        onUpdateRecord(student.id, 'catchUpRecords', newRecords);
                                                                    }}
                                                                >
                                                                    <span>{catchUp.surahName} ({catchUp.fromVerse}-{catchUp.toVerse})</span>
                                                                    <Trash2 className="h-3 w-3 text-red-400" />
                                                                </Badge>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}

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
