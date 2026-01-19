"use client";

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Student } from '@/lib/types';

interface ExpulsionDialogProps {
    student: Student;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: (reason: string, notes: string) => void;
}

export const ExpulsionDialog = ({ student, open, onOpenChange, onConfirm }: ExpulsionDialogProps) => {
    const [reason, setReason] = useState("سلوك");
    const [notes, setNotes] = useState("");

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>طرد الطالب: {student.fullName}</DialogTitle>
                    <DialogDescription>
                        يرجى تحديد سبب الطرد. سيتم تسجيل هذا السبب في سجل الطالب.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="expel-reason-select">السبب الرئيسي</Label>
                        <Select dir="rtl" value={reason} onValueChange={setReason}>
                            <SelectTrigger id="expel-reason-select">
                                <SelectValue placeholder="اختر سببًا..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="سلوك">سلوك غير لائق</SelectItem>
                                <SelectItem value="غيابات">غيابات متكررة</SelectItem>
                                <SelectItem value="عدم حفظ">عدم الالتزام بالحفظ</SelectItem>
                                <SelectItem value="أخرى">أخرى (يرجى التوضيح)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="expel-notes">ملاحظات إضافية</Label>
                        <Textarea id="expel-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="أضف تفاصيل إضافية حول سبب الطرد..." />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
                    <Button variant="destructive" onClick={() => { onConfirm(reason, notes); onOpenChange(false); }}>تأكيد الطرد</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
