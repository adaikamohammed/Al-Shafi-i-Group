"use client";

import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useStudentContext } from '@/context/StudentContext';
import { Student } from '@/lib/types';
import { AlertCircle, ArrowRightLeft, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { SearchableSelect, SearchableSelectOption } from '@/components/ui/SearchableSelect';

interface TransferDialogProps {
    student: Student;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export const TransferDialog = ({ student, open, onOpenChange }: TransferDialogProps) => {
    const { allUsers, transferStudent } = useStudentContext();
    const [targetSheikhId, setTargetSheikhId] = useState<string>('');
    const [reason, setReason] = useState<string>('');
    const [isTransferring, setIsTransferring] = useState(false);

    const sheikhOptions: SearchableSelectOption[] = useMemo(() => {
        const uniqueGroups = new Map();

        allUsers.forEach(u => {
            if (u.group && u.uid !== student.ownerId) {
                const groupKey = u.group.trim();
                const existing = uniqueGroups.get(groupKey);

                const isNewAdmin = u.uid.toLowerCase().includes('admin');
                const isExistingAdmin = existing?.uid.toLowerCase().includes('admin');

                if (!existing || (isNewAdmin && !isExistingAdmin)) {
                    uniqueGroups.set(groupKey, u);
                }
            }
        });

        return Array.from(uniqueGroups.values())
            .sort((a, b) => {
                const groupA = parseInt((a.group || '').replace(/[^0-9]/g, '')) || 999;
                const groupB = parseInt((b.group || '').replace(/[^0-9]/g, '')) || 999;
                return groupA - groupB;
            })
            .map(s => ({
                value: s.uid,
                label: `${s.group || 'بدون فوج'} - ${s.displayName || s.email}`
            }));
    }, [allUsers, student.ownerId]);

    const handleTransfer = async () => {
        if (!targetSheikhId || !reason) return;

        setIsTransferring(true);
        try {
            await transferStudent(student.id, student.ownerId, targetSheikhId, reason);
            onOpenChange(false);
        } catch (error) {
            console.error("Transfer failed:", error);
        } finally {
            setIsTransferring(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px] font-body">
                <DialogHeader>
                    <DialogTitle className="font-headline text-xl flex items-center gap-2">
                        <ArrowRightLeft className="h-6 w-6 text-primary" />
                        نقل الطالب: {student.fullName}
                    </DialogTitle>
                    <DialogDescription>
                        يمكنك نقل الطالب إلى فوج أستاذ(ة) أو شيخ آخر. سيتم نقل كافة بيانات الطالب وسجلاته بشكل تلقائي.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <Alert variant="destructive" className="bg-amber-50 border-amber-200 text-amber-800">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle className="font-bold">تنبيه هام</AlertTitle>
                        <AlertDescription className="text-xs">
                            هذا الإجراء سيقوم بتغيير مسؤولية الطالب ونقله فوراً إلى حساب الشيخ المختار.
                        </AlertDescription>
                    </Alert>

                    <div className="space-y-2">
                        <Label htmlFor="targetSheikh" className="font-bold">اختر الفوج / الشيخ المستهدف</Label>
                        <SearchableSelect
                            options={sheikhOptions}
                            value={targetSheikhId}
                            onValueChange={setTargetSheikhId}
                            placeholder="اختر الشيخ المستهدف"
                            searchPlaceholder="ابحث باسم الشيخ أو الفوج..."
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="reason" className="font-bold">سبب النقل</Label>
                        <Textarea
                            id="reason"
                            placeholder="اكتب سبب نقل الطالب هنا..."
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            className="resize-none h-24"
                        />
                    </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isTransferring}>
                        إلغاء
                    </Button>
                    <Button
                        onClick={handleTransfer}
                        disabled={!targetSheikhId || !reason || isTransferring}
                        className="bg-primary hover:bg-primary/90"
                    >
                        {isTransferring ? (
                            <>
                                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                                جاري النقل...
                            </>
                        ) : (
                            "تأكيد النقل"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
