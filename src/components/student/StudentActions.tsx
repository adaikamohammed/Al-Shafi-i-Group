"use client";

import React, { useState } from 'react';
import { MoreHorizontal, FilePen, Trash2, UserX, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Student, StudentStatus } from '@/lib/types';
import { ExpulsionDialog } from './ExpulsionDialog';
import { TransferDialog } from './TransferDialog';
import { ArrowRightLeft } from 'lucide-react';

interface StudentActionsProps {
    student: Student;
    onStatusChange: (student: Student, status: StudentStatus, reason?: string) => void;
    onEdit: () => void;
    isSuperAdmin?: boolean;
    isManagement?: boolean;
}

export const StudentActions = ({ student, onStatusChange, onEdit, isSuperAdmin, isManagement }: StudentActionsProps) => {
    const [isExpelDialogOpen, setExpelDialogOpen] = useState(false);
    const [isTransferDialogOpen, setTransferDialogOpen] = useState(false);

    const handleExpulsion = (reason: string, notes: string) => {
        const fullReason = `${reason}: ${notes}`;
        onStatusChange(student, 'مطرود', fullReason);
        setExpelDialogOpen(false);
    };

    const handleReactivate = () => {
        onStatusChange(student, 'نشط', student.actionReason);
    };

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button aria-haspopup="true" size="icon" variant="ghost" onClick={(e) => e.stopPropagation()}>
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">قائمة الإجراءات</span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenuLabel>إجراءات الطالب</DropdownMenuLabel>
                    <DropdownMenuItem onSelect={onEdit}>
                        <FilePen className="ml-2 h-4 w-4" />
                        تعديل
                    </DropdownMenuItem>

                    {!isSuperAdmin && (
                        <>
                            {student.status === 'نشط' ? (
                                <>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={(e) => e.preventDefault()}>
                                                <Trash2 className="ml-2 h-4 w-4" />
                                                حذف
                                            </DropdownMenuItem>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>هل أنت متأكد من حذف الطالب {student.fullName}؟</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    سيؤدي هذا إلى حذف بيانات الطالب نهائيًا. هذا الإجراء لا يمكن التراجع عنه.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => onStatusChange(student, 'محذوف')}>تأكيد الحذف</AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                    <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={(e) => { e.preventDefault(); setExpelDialogOpen(true) }}>
                                        <UserX className="ml-2 h-4 w-4" />
                                        طرد
                                    </DropdownMenuItem>
                                    {(isSuperAdmin || isManagement) ? (
                                        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setTransferDialogOpen(true) }}>
                                            <ArrowRightLeft className="ml-2 h-4 w-4" />
                                            نقل إلى فوج آخر
                                        </DropdownMenuItem>
                                    ) : (
                                        <DropdownMenuItem disabled className="opacity-50 cursor-not-allowed">
                                            <ArrowRightLeft className="ml-2 h-4 w-4" />
                                            نقل الطالب (خاص بالإدارة)
                                        </DropdownMenuItem>
                                    )}
                                </>
                            ) : (
                                <DropdownMenuItem onSelect={handleReactivate}>
                                    <History className="ml-2 h-4 w-4" />
                                    إعادة تفعيل
                                </DropdownMenuItem>
                            )}
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
            <ExpulsionDialog student={student} open={isExpelDialogOpen} onOpenChange={setExpelDialogOpen} onConfirm={handleExpulsion} />
            <TransferDialog student={student} open={isTransferDialogOpen} onOpenChange={setTransferDialogOpen} />
        </>
    );
};
