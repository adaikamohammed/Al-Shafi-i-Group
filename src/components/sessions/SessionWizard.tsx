"use client";

import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AttendanceList, AttendanceRecord } from './AttendanceList';
import { Student } from '@/lib/types';
import { Loader2, Save, ArrowRight, ArrowLeft, CheckCircle2, Users, Star, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';

interface SessionWizardProps {
    isOpen: boolean;
    onClose: () => void;
    sessionNumber: 1 | 2;
    sessionDate: Date;
    students: Student[];
    initialRecords: Record<string, AttendanceRecord>;
    onSave: (records: Record<string, AttendanceRecord>) => Promise<void>;
}

export const SessionWizard = ({ isOpen, onClose, sessionNumber, sessionDate, students, initialRecords, onSave }: SessionWizardProps) => {
    const [step, setStep] = useState(1);
    const [records, setRecords] = useState(initialRecords);
    const [isSaving, setIsSaving] = useState(false);

    const handleUpdateRecord = (studentId: string, field: keyof AttendanceRecord, value: any) => {
        setRecords(prev => ({
            ...prev,
            [studentId]: {
                ...prev[studentId],
                studentId,
                attendance: field === 'attendance' ? value : (prev[studentId]?.attendance || 'حاضر'),
                [field]: value
            }
        }));
    };

    const nextStep = () => setStep(p => Math.min(p + 1, 3));
    const prevStep = () => setStep(p => Math.max(p - 1, 1));

    // Derived Data
    const presentStudents = useMemo(() => students.filter(s => {
        const rec = records[s.id];
        return rec?.attendance === 'حاضر' || rec?.attendance === 'متأخر';
    }), [students, records]);

    const stats = useMemo(() => {
        const total = students.length;
        const present = Object.values(records).filter(r => r.attendance === 'حاضر' || r.attendance === 'متأخر').length;
        const absent = Object.values(records).filter(r => r.attendance === 'غياب').length;
        const memorized = Object.values(records).filter(r => r.memorization === 'ممتاز' || r.memorization === 'جيد جدا').length;
        return { total, present, absent, memorized };
    }, [records, students]);

    const handleFinish = async () => {
        setIsSaving(true);
        await onSave(records);
        setIsSaving(false);
        // onClose handled by parent usually, but we called it in logic
    };

    const renderStepContent = () => {
        switch (step) {
            case 1: // Attendance
                return (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex justify-between items-center">
                            <div>
                                <h3 className="font-bold text-blue-900">الخطوة 1: تفقد الحضور</h3>
                                <p className="text-xs text-blue-700">حدد الطلاب الغائبين والمتأخرين.</p>
                            </div>
                            <div className="text-2xl font-bold text-blue-600">
                                {stats.present} <span className="text-sm font-normal text-muted-foreground">/ {stats.total}</span>
                            </div>
                        </div>
                        <AttendanceList
                            students={students}
                            records={records}
                            onUpdateRecord={handleUpdateRecord}
                            viewMode="attendance"
                        />
                    </div>
                );
            case 2: // Evaluation
                return (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 flex justify-between items-center">
                            <div>
                                <h3 className="font-bold text-purple-900">الخطوة 2: التقييم والملاحظات</h3>
                                <p className="text-xs text-purple-700">قم بتقييم حفظ وسلوك الطلاب الحاضرين فقط.</p>
                            </div>
                        </div>

                        {presentStudents.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">
                                <AlertTriangle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                                <p>لا يوجد طلاب حاضرين للتقييم.</p>
                            </div>
                        ) : (
                            <AttendanceList
                                students={presentStudents}
                                records={records}
                                onUpdateRecord={handleUpdateRecord}
                                viewMode="evaluation"
                            />
                        )}
                    </div>
                );
            case 3: // Summary
                return (
                    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300 py-4">
                        <div className="text-center space-y-2">
                            <div className="inline-flex items-center justify-center p-3 bg-green-100 rounded-full mb-2">
                                <CheckCircle2 className="h-8 w-8 text-green-600" />
                            </div>
                            <h2 className="text-2xl font-bold font-headline">ملخص الحصة</h2>
                            <p className="text-muted-foreground">راجع الإحصائيات قبل الحفظ النهائي.</p>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <Card className="bg-card border-none shadow-sm">
                                <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                                    <Users className="h-6 w-6 text-primary mb-2" />
                                    <span className="text-3xl font-bold">{stats.present}</span>
                                    <span className="text-xs text-muted-foreground">حاضر</span>
                                </CardContent>
                            </Card>
                            <Card className="bg-card border-none shadow-sm">
                                <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                                    <AlertTriangle className="h-6 w-6 text-red-500 mb-2" />
                                    <span className="text-3xl font-bold text-red-600">{stats.absent}</span>
                                    <span className="text-xs text-muted-foreground">غائب</span>
                                </CardContent>
                            </Card>
                            <Card className="bg-card border-none shadow-sm">
                                <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                                    <Star className="h-6 w-6 text-yellow-500 mb-2" />
                                    <span className="text-3xl font-bold text-yellow-600">{stats.memorized}</span>
                                    <span className="text-xs text-muted-foreground">تسميع ممتاز/جيد جداً</span>
                                </CardContent>
                            </Card>
                            <Card className="bg-card border-none shadow-sm">
                                <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                                    <div className="radial-progress text-primary text-xs font-bold" style={{ "--value": Math.round((stats.present / stats.total) * 100) } as any}>
                                        {Math.round((stats.present / stats.total) * 100)}%
                                    </div>
                                    <span className="text-xs text-muted-foreground mt-2">نسبة الحضور</span>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                );
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 gap-0 overflow-hidden border-none rounded-[2rem]">
                <DialogHeader className="p-6 pb-2 bg-muted/20 border-b">
                    <div className="flex justify-between items-center">
                        <div>
                            <DialogTitle className="text-xl font-headline font-bold">تسجيل الحصة {sessionNumber}</DialogTitle>
                            <DialogDescription>
                                {step === 1 && "الخطوة 1 من 3: الحضور والغياب"}
                                {step === 2 && "الخطوة 2 من 3: التقييم"}
                                {step === 3 && "الخطوة 3 من 3: المراجعة والحفظ"}
                            </DialogDescription>
                        </div>
                        <div className="w-1/3 max-w-[200px]">
                            <Progress value={(step / 3) * 100} className="h-2" />
                        </div>
                    </div>
                </DialogHeader>

                <ScrollArea className="flex-1 bg-muted/5 p-6">
                    {renderStepContent()}
                </ScrollArea>

                <DialogFooter className="p-6 bg-background border-t flex justify-between items-center sm:justify-between">
                    <Button
                        variant="outline"
                        onClick={step === 1 ? onClose : prevStep}
                        className="min-w-[100px]"
                    >
                        {step === 1 ? 'إلغاء' :
                            <span className="flex items-center gap-2"><ArrowRight className="h-4 w-4" /> السابق</span>}
                    </Button>

                    {step < 3 ? (
                        <Button onClick={nextStep} className="min-w-[120px]">
                            التالي <ArrowLeft className="h-4 w-4 mr-2" />
                        </Button>
                    ) : (
                        <Button onClick={handleFinish} disabled={isSaving} className="min-w-[150px] bg-green-600 hover:bg-green-700 text-white">
                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                            حفظ وإنهاء
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
