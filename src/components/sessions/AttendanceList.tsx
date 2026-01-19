"use client";

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Check, X, Clock, Star, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Student } from '@/lib/types';
import { Checkbox } from '@/components/ui/checkbox';

export interface AttendanceRecord {
    studentId: string;
    attendance: 'حاضر' | 'غياب' | 'متأخر' | '';
    memorization: string;
    behavior: string;
    notes: string;
    review: boolean;
}

interface AttendanceListProps {
    students: Student[];
    records: Record<string, AttendanceRecord>;
    onUpdateRecord: (studentId: string, field: keyof AttendanceRecord, value: any) => void;
    viewMode?: 'full' | 'attendance' | 'evaluation';
    sessionType?: string;
}

export const AttendanceList = ({ students, records, onUpdateRecord, viewMode = 'full', sessionType }: AttendanceListProps) => {

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

                return (
                    <Card key={student.id} className={cn(
                        "transition-all duration-300 overflow-hidden border shadow-sm hover:shadow-md",
                        record.attendance === 'غياب' ? 'opacity-80 bg-red-50/30' : 'bg-card'
                    )}>
                        <CardContent className="p-4">
                            <div className="flex flex-col gap-4">
                                {/* Header: Avatar & Name */}
                                <div className="flex items-center gap-3">
                                    <Avatar className="h-12 w-12 border-2 border-background shadow-sm shrink-0">
                                        <AvatarImage src={student.photoURL} className="object-cover" />
                                        <AvatarFallback className="bg-primary/10 text-primary font-bold">{student.fullName.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-sm md:text-base truncate">{student.fullName}</h3>
                                        <div className="flex gap-2 text-xs text-muted-foreground items-center">
                                            {!isActivitySession && <span>{student.dailyMemorizationAmount}</span>}
                                            {record.attendance && (
                                                <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", getStatusColor(record.attendance))}>
                                                    {record.attendance}
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Actions Row */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Attendance Buttons - Show in 'attendance' or 'full' mode */}
                                    {(viewMode === 'full' || viewMode === 'attendance') && (
                                        <div className="flex gap-2 h-9">
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant={record.attendance === 'حاضر' ? 'default' : 'outline'}
                                                className={cn("flex-1 text-xs font-bold", record.attendance === 'حاضر' && "bg-emerald-600 hover:bg-emerald-700")}
                                                onClick={() => onUpdateRecord(student.id, 'attendance', 'حاضر')}
                                            >
                                                <Check className="h-3 w-3 ml-1" /> حاضر
                                            </Button>
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant={record.attendance === 'متأخر' ? 'default' : 'outline'}
                                                className={cn("flex-1 text-xs font-bold", record.attendance === 'متأخر' && "bg-amber-500 hover:bg-amber-600")}
                                                onClick={() => onUpdateRecord(student.id, 'attendance', 'متأخر')}
                                            >
                                                <Clock className="h-3 w-3 ml-1" /> متأخر
                                            </Button>
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant={record.attendance === 'غياب' ? 'destructive' : 'outline'}
                                                className="flex-1 text-xs font-bold"
                                                onClick={() => onUpdateRecord(student.id, 'attendance', 'غياب')}
                                            >
                                                <X className="h-3 w-3 ml-1" /> غائب
                                            </Button>
                                        </div>
                                    )}

                                    {/* Evaluation (Only if Present/Late) - Show in 'evaluation' or 'full' mode */}
                                    {(record.attendance === 'حاضر' || record.attendance === 'متأخر') && (viewMode === 'full' || viewMode === 'evaluation') && (
                                        <div className={cn("space-y-3", (viewMode === 'evaluation' || !isActivitySession) ? "col-span-2 md:col-span-1" : "")}>
                                            <div className="flex gap-2 items-center">
                                                {!isActivitySession && (
                                                    <>
                                                        <Select value={record.memorization} onValueChange={(val) => onUpdateRecord(student.id, 'memorization', val)} dir="rtl">
                                                            <SelectTrigger className="h-9 text-xs font-bold w-[120px]">
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

                                                        <div className="flex items-center gap-1 bg-muted/30 px-2 rounded-md h-9 border cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => onUpdateRecord(student.id, 'review', !record.review)}>
                                                            <Checkbox
                                                                checked={record.review}
                                                                onCheckedChange={(checked) => onUpdateRecord(student.id, 'review', checked)}
                                                                id={`review-${student.id}`}
                                                                className="h-4 w-4"
                                                            />
                                                            <label htmlFor={`review-${student.id}`} className="text-xs font-bold cursor-pointer select-none">مراجعة</label>
                                                        </div>
                                                    </>
                                                )}

                                                <Select value={record.behavior} onValueChange={(val) => onUpdateRecord(student.id, 'behavior', val)} dir="rtl">
                                                    <SelectTrigger className="h-9 text-xs font-bold w-full md:w-auto min-w-[100px]">
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
                                                    className="h-9 text-xs bg-muted/20"
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
