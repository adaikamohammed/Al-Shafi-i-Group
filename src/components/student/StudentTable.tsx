"use client";

import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowUpDown, ShieldAlert, User as UserIcon, UserRound } from 'lucide-react';
import { Student, StudentStatus } from '@/lib/types';
import { cn } from '@/lib/utils';
import { format, parseISO, formatDistanceToNowStrict } from 'date-fns';
import { ar } from 'date-fns/locale';
import { StudentActions } from './StudentActions';

const statusVariant: Record<string, "default" | "destructive" | "secondary" | "outline"> = {
    "نشط": "default",
    "مطرود": "destructive",
    "محذوف": "outline"
};

interface StudentTableProps {
    students: Student[];
    selectedRows: string[];
    onSelectedRowsChange: (rows: string[]) => void;
    sortConfig: { key: keyof Student | 'pageNumber'; direction: 'ascending' | 'descending' };
    onRequestSort: (key: keyof Student | 'pageNumber') => void;
    isSuperAdmin?: boolean;
    onStudentClick: (student: Student) => void;
    onStatusChange: (student: Student, status: StudentStatus, reason?: string) => void;
    onEdit: (student: Student) => void;
    searchTerm: string;
}

export const StudentTable = React.memo(({
    students,
    selectedRows,
    onSelectedRowsChange,
    sortConfig,
    onRequestSort,
    isSuperAdmin,
    onStudentClick,
    onStatusChange,
    onEdit,
    searchTerm
}: StudentTableProps) => {

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            onSelectedRowsChange(students.map(s => s.id));
        } else {
            onSelectedRowsChange([]);
        }
    };

    const handleSelectRow = (studentId: string, checked: boolean) => {
        if (checked) {
            onSelectedRowsChange([...selectedRows, studentId]);
        } else {
            onSelectedRowsChange(selectedRows.filter(id => id !== studentId));
        }
    };

    return (
        <div className="w-full">
            {/* Desktop View Table */}
            <div className="hidden md:block relative w-full overflow-x-auto rounded-xl border border-border/50 shadow-sm">
                <Table>
                    <TableHeader className="bg-muted/50 font-headline">
                        <TableRow>
                            <TableHead className="w-[50px] px-4">
                                <Checkbox
                                    checked={selectedRows.length > 0 && selectedRows.length === students.length && students.length > 0}
                                    onCheckedChange={handleSelectAll}
                                    aria-label="Select all rows"
                                />
                            </TableHead>
                            <TableHead className="w-[80px] p-2">
                                <Button variant="ghost" onClick={() => onRequestSort('pageNumber')} className="px-2 font-bold hover:bg-primary/10">
                                    الهوية
                                    <ArrowUpDown className="mr-2 h-4 w-4" />
                                </Button>
                            </TableHead>
                            <TableHead>
                                <Button variant="ghost" onClick={() => onRequestSort('fullName')} className="font-bold hover:bg-primary/10">
                                    الاسم الكامل
                                    <ArrowUpDown className="mr-2 h-4 w-4" />
                                </Button>
                            </TableHead>
                            {isSuperAdmin && <TableHead className="text-center font-bold">الفوج</TableHead>}
                            <TableHead className="hidden md:table-cell text-center font-bold">المستوى الدراسي</TableHead>
                            <TableHead className="hidden lg:table-cell text-center font-bold">اسم الولي</TableHead>
                            <TableHead className="text-center font-bold">الحالة</TableHead>
                            <TableHead className="text-center font-bold">فئة الاشتراك</TableHead>
                            <TableHead className="hidden md:table-cell text-center font-bold">السور المحفوظة</TableHead>
                            <TableHead className="text-center font-bold">
                                <span className="sr-only">إجراءات</span>
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {students.length > 0 ? (
                            students.map((student) => {
                                const activeCovenant = (student.covenants || []).find(c => c.status === 'نشط');

                                let rowClass = 'hover:bg-muted/30 transition-colors';
                                if (student.status === 'مطرود') {
                                    rowClass = 'bg-red-50/50 dark:bg-red-900/10 opacity-70 line-through grayscale-[0.5]';
                                } else if (activeCovenant?.card === 'بطاقة حمراء') {
                                    rowClass = 'bg-red-50/30 dark:bg-red-900/5 hover:bg-red-50/50';
                                } else if (activeCovenant?.card === 'بطاقة صفراء') {
                                    rowClass = 'bg-yellow-50/30 dark:bg-yellow-900/5 hover:bg-yellow-50/50';
                                }

                                return (
                                    <TableRow
                                        key={student.id}
                                        data-state={selectedRows.includes(student.id) ? "selected" : ""}
                                        className={cn('cursor-pointer border-b border-border/40', rowClass)}
                                        onClick={() => onStudentClick(student)}>
                                        <TableCell className="px-4" onClick={(e) => e.stopPropagation()}>
                                            <Checkbox
                                                checked={selectedRows.includes(student.id)}
                                                onCheckedChange={(checked) => handleSelectRow(student.id, !!checked)}
                                                aria-label="Select row"
                                            />
                                        </TableCell>
                                        <TableCell className="p-2">
                                            <div className="flex flex-col items-center gap-1">
                                                <Avatar className={cn("w-10 h-10 border-2 shadow-sm transition-transform hover:scale-105",
                                                    activeCovenant?.card === 'بطاقة حمراء' ? 'border-red-500' :
                                                        activeCovenant?.card === 'بطاقة صفراء' ? 'border-yellow-500' :
                                                            'border-background/50')}>
                                                    <AvatarImage src={student.photoURL} />
                                                    <AvatarFallback className={cn(student.gender === 'أنثى' ? 'bg-pink-100 text-pink-600' : 'bg-blue-100 text-blue-600')}>
                                                        {student.gender === 'أنثى' ? <UserRound className="h-5 w-5" /> : <UserIcon className="h-5 w-5" />}
                                                    </AvatarFallback>
                                                </Avatar>
                                                {student.pageNumber && <Badge variant="secondary" className="px-1.5 py-0.5 text-[10px] font-bold">{student.pageNumber}</Badge>}
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-medium">
                                            <div className="flex items-center gap-3">
                                                <Tooltip>
                                                    <TooltipTrigger>
                                                        {student.status === 'مطرود' ? <div className="w-5 h-5 flex items-center justify-center text-lg">🚫</div>
                                                            : activeCovenant ? <ShieldAlert className={cn("h-5 w-5", activeCovenant.card === 'بطاقة صفراء' ? 'text-yellow-500 animate-pulse' : 'text-red-500 animate-bounce')} />
                                                                : <div className="w-5 h-5"></div>
                                                        }
                                                    </TooltipTrigger>
                                                    <TooltipContent className="glass shadow-xl border-border">
                                                        {student.status === 'مطرود' ? (
                                                            <div className="p-2">
                                                                <p className="font-bold text-red-600">طرد بتاريخ: {student.expulsionDate ? format(parseISO(student.expulsionDate), 'd MMM yyyy', { locale: ar }) : 'غير محدد'}</p>
                                                                <p className="text-xs">السبب: {student.expulsionReason || 'لم يحدد'}</p>
                                                            </div>
                                                        ) : activeCovenant ? (
                                                            <div className="p-2">
                                                                <p className="font-bold">الطالب تحت "{activeCovenant.type}" ({activeCovenant.card}):</p>
                                                                <p className="text-xs">{activeCovenant.text}</p>
                                                            </div>
                                                        ) : null}
                                                    </TooltipContent>
                                                </Tooltip>
                                                <span className="font-body text-base">{student.fullName}</span>
                                            </div>
                                        </TableCell>
                                        {isSuperAdmin && <TableCell className="text-center"><Badge variant="outline" className="font-bold">{student.groupName || 'غير محدد'}</Badge></TableCell>}
                                        <TableCell className="hidden md:table-cell text-center font-body">{student.educationalLevel || 'غير محدد'}</TableCell>
                                        <TableCell className="hidden lg:table-cell text-center font-body">{student.guardianName}</TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant={statusVariant[student.status] || "secondary"} className="font-bold">{student.status}</Badge>
                                            {student.status === 'مطرود' && student.expulsionDate &&
                                                <p className="text-[10px] text-muted-foreground mt-1">({formatDistanceToNowStrict(parseISO(student.expulsionDate), { locale: ar, addSuffix: true })})</p>
                                            }
                                        </TableCell>
                                        <TableCell className="text-center font-body">
                                            <Badge variant="outline" className="border-primary/30 text-primary font-bold">{student.subscriptionTier}</Badge>
                                        </TableCell>
                                        <TableCell className="hidden md:table-cell text-center font-bold text-lg text-primary">{student.memorizedSurahsCount || 0}</TableCell>
                                        <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                                            <StudentActions student={student} onStatusChange={onStatusChange} onEdit={() => onEdit(student)} isSuperAdmin={isSuperAdmin} />
                                        </TableCell>
                                    </TableRow>
                                )
                            })
                        ) : (
                            <TableRow>
                                <TableCell colSpan={isSuperAdmin ? 10 : 9} className="h-32 text-center text-muted-foreground font-body">
                                    {searchTerm ? "لم يتم العثور على طلاب مطابقين للبحث." : "لا يوجد طلبة حاليًا. قم بإضافة طالب جديد."}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Mobile View Card List */}
            <div className="md:hidden space-y-4">
                {students.length > 0 ? (
                    students.map((student) => {
                        const activeCovenant = (student.covenants || []).find(c => c.status === 'نشط');
                        return (
                            <Card
                                key={student.id}
                                className={cn(
                                    "overflow-hidden transition-all active:scale-[0.98] border-border/50 shadow-sm",
                                    student.status === 'مطرود' ? 'bg-red-50/30 line-through opacity-80' :
                                        activeCovenant?.card === 'بطاقة حمراء' ? 'border-red-500/30' :
                                            activeCovenant?.card === 'بطاقة صفراء' ? 'border-yellow-500/30' : ''
                                )}
                                onClick={() => onStudentClick(student)}
                            >
                                <CardContent className="p-4 flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-3">
                                        <div className="relative">
                                            <Avatar className={cn("w-14 h-14 border-2 shadow-sm",
                                                activeCovenant?.card === 'بطاقة حمراء' ? 'border-red-500' :
                                                    activeCovenant?.card === 'بطاقة صفراء' ? 'border-yellow-500' :
                                                        'border-background/80')}>
                                                <AvatarImage src={student.photoURL} />
                                                <AvatarFallback className={student.gender === 'أنثى' ? 'bg-pink-100 text-pink-600' : 'bg-blue-100 text-blue-600'}>
                                                    {student.gender === 'أنثى' ? <UserRound className="h-6 w-6" /> : <UserIcon className="h-6 w-6" />}
                                                </AvatarFallback>
                                            </Avatar>
                                            {student.pageNumber && (
                                                <Badge className="absolute -bottom-2 -left-2 px-1.5 py-0.5 text-[10px] font-bold shadow-md">
                                                    {student.pageNumber}
                                                </Badge>
                                            )}
                                        </div>
                                        <div>
                                            <h3 className="font-headline font-bold text-lg leading-tight flex items-center gap-2">
                                                {student.fullName}
                                                {activeCovenant && <ShieldAlert className={cn("h-4 w-4", activeCovenant.card === 'بطاقة صفراء' ? 'text-yellow-500' : 'text-red-500')} />}
                                            </h3>
                                            <div className="flex flex-wrap gap-2 mt-1">
                                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{student.educationalLevel || 'بدون مستوى'}</Badge>
                                                <Badge variant={statusVariant[student.status] || "secondary"} className="text-[10px] px-1.5 py-0">{student.status}</Badge>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-2 shrink-0">
                                        <StudentActions
                                            student={student}
                                            onStatusChange={onStatusChange}
                                            onEdit={() => onEdit(student)}
                                            isSuperAdmin={isSuperAdmin}
                                        />
                                        <div className="text-center bg-primary/5 rounded-lg px-2 py-1 border border-primary/10">
                                            <p className="text-[10px] text-muted-foreground">سور</p>
                                            <p className="font-bold text-primary">{student.memorizedSurahsCount || 0}</p>
                                        </div>
                                    </div>
                                </CardContent>
                                {activeCovenant && (
                                    <div className={cn("px-4 py-2 text-[11px] font-medium border-t flex items-center gap-2",
                                        activeCovenant.card === 'بطاقة صفراء' ? 'bg-yellow-50/50 text-yellow-800 border-yellow-100' : 'bg-red-50/50 text-red-800 border-red-100')}>
                                        <ShieldAlert className="h-3 w-3" />
                                        <span>{activeCovenant.type}: {activeCovenant.text}</span>
                                    </div>
                                )}
                            </Card>
                        )
                    })
                ) : (
                    <div className="p-12 text-center text-muted-foreground font-body bg-muted/20 rounded-xl border border-dashed border-border">
                        {searchTerm ? "لم يتم العثور على طلاب مطابقين للبحث." : "لا يوجد طلبة حاليًا."}
                    </div>
                )}
            </div>
        </div>
    );
});
