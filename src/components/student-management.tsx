"use client";

import React, { useState, useMemo } from 'react';
import { PlusCircle, Search, Filter, Download, Trash2, Loader2, Users, UserCheck, UserMinus, Star, X, ArrowRightLeft, Edit, BellRing, ShieldAlert, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuTrigger, DropdownMenuCheckboxItem } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { useStudentContext } from '@/context/StudentContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { DailyInspiration } from '@/components/ui/DailyInspiration';
import { useRouter } from 'next/navigation';
import { Student, StudentStatus } from '@/lib/types';
import { arabicCompare, isStudentInMenSheikhs, isStudentInWomenUstadhats } from '@/lib/utils';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';

// Refactored Components
import { StudentTable } from './student/StudentTable';
import { StudentForm } from './student/StudentForm';
import { StudentProfileCard } from './student/StudentProfileCard';
import { BulkStudentEditView } from './student/BulkStudentEditView';
import { GroupSelector } from './management/GroupSelector';

// Refactored Hooks
import { useStudentStats } from '@/hooks/useStudentStats';

const educationalLevels = ["روضة", "تحضيري", "1 ابتدائي", "2 ابتدائي", "3 ابتدائي", "4 ابتدائي", "5 ابتدائي", "1 متوسط", "2 متوسط", "3 متوسط", "4 متوسط", "1 ثانوي", "2 ثانوي", "3 ثانوي", "بكالوريا", "جامعي", "متوقف عن الدراسة"];

export function StudentManagement() {
    const router = useRouter();
    const { students, updateStudent, deleteStudent, loading, deleteAllStudents, deleteMultipleStudents, dailySessions, settings, addStudent, allUsers, dailyReports, selectedGroup, setSelectedGroup } = useStudentContext();
    const { user, isSuperAdmin, isManagement } = useAuth();
    const [isAddStudentDialogOpen, setAddStudentDialogOpen] = useState(false);
    const [isEditStudentDialogOpen, setEditStudentDialogOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'نشط' | 'مطرود'>('نشط');
    const [levelFilter, setLevelFilter] = useState<string[]>([]);
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
    const [selectedRows, setSelectedRows] = useState<string[]>([]);
    const [sortConfig, setSortConfig] = useState<{ key: keyof Student | 'pageNumber'; direction: 'ascending' | 'descending' }>({ key: 'fullName', direction: 'ascending' });
    const [isBulkEdit, setIsBulkEdit] = useState(false);

    const { rankingData, getStudentMedalHistory } = useStudentStats(students, dailySessions, settings);

    const handleStatusChange = (student: Student, status: StudentStatus, reason?: string) => {
        if (status === 'محذوف') {
            deleteStudent(student.id, student.ownerId);
        } else if (status === 'مطرود') {
            const expulsionData: Partial<Student> = {
                status: 'مطرود',
                expulsionDate: new Date().toISOString(),
                expulsionReason: reason
            };
            updateStudent(student.id, expulsionData, student.ownerId);
        } else if (status === 'نشط' && student.status === 'مطرود') {
            const newHistory = [...(student.expulsionHistory || [])];
            if (student.expulsionDate && student.expulsionReason) {
                newHistory.push({ date: student.expulsionDate, reason: student.expulsionReason });
            }
            const reactivationData: Partial<Student> = {
                status: 'نشط',
                expulsionDate: null,
                expulsionReason: null,
                expulsionHistory: newHistory
            };
            updateStudent(student.id, reactivationData, student.ownerId);
        } else {
            updateStudent(student.id, { status, actionReason: reason }, student.ownerId);
        }
    };

    const handleBulkDelete = () => {
        const studentsToDelete = selectedRows.map(id => (students ?? []).find(s => s.id === id)).filter(Boolean) as Student[];
        deleteMultipleStudents(studentsToDelete.map(s => ({ id: s.id, ownerId: s.ownerId })));
        setSelectedRows([]);
    }

    const handleExportStudents = () => {
        const dataToExport = filteredStudents.map(s => ({
            "الاسم الكامل": s.fullName,
            "الفوج": s.groupName || 'غير محدد',
            "اسم الولي": s.guardianName,
            "رقم الهاتف 1": s.phone1,
            "رقم الهاتف 2": s.phone2 || '',
            "تاريخ الميلاد": s.birthDate ? format(s.birthDate, 'dd/MM/yyyy') : '',
            "تاريخ التسجيل": format(s.registrationDate, 'dd/MM/yyyy'),
            "الحالة": s.status,
            "فئة الاشتراك": s.subscriptionTier,
            "مقدار الحفظ اليومي": s.dailyMemorizationAmount,
            "السور المحفوظة": s.memorizedSurahsCount,
            "ملاحظات": s.notes || '',
        }));

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "قائمة الطلبة");
        XLSX.writeFile(wb, "قائمة_الطلبة_الحالية.xlsx");
    };

    const requestSort = (key: keyof Student | 'pageNumber') => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    }

    const filteredStudents = useMemo(() => {
        let sortableStudents = isSuperAdmin || isManagement ? (students ?? []) : (students ?? []).filter(s => s.ownerId === user?.uid);

        // Management Filter
        if (isManagement && selectedGroup !== 'all') {
            if (selectedGroup === 'sheikhs_all') {
                sortableStudents = sortableStudents.filter(s => isStudentInMenSheikhs(s, allUsers));
            } else if (selectedGroup === 'ustadhats_all') {
                sortableStudents = sortableStudents.filter(s => isStudentInWomenUstadhats(s, allUsers));
            } else {
                const selectedUser = allUsers.find(u => u.uid === selectedGroup);
                if (selectedUser?.group) {
                    sortableStudents = sortableStudents.filter(s => s.groupName?.trim() === selectedUser.group?.trim());
                } else {
                    sortableStudents = sortableStudents.filter(s => s.ownerId === selectedGroup);
                }
            }
        }
        sortableStudents = sortableStudents.filter(student => student.fullName.toLowerCase().includes(searchTerm.toLowerCase()));
        if (statusFilter !== 'all') sortableStudents = sortableStudents.filter(s => s.status === statusFilter);
        if (levelFilter.length > 0) sortableStudents = sortableStudents.filter(s => s.educationalLevel && levelFilter.includes(s.educationalLevel));

        sortableStudents.sort((a, b) => {
            if (sortConfig.key === 'pageNumber') {
                const pageNumA = a.pageNumber ? parseInt(a.pageNumber, 10) : Infinity;
                const pageNumB = b.pageNumber ? parseInt(b.pageNumber, 10) : Infinity;
                let comparison = isNaN(pageNumA) || isNaN(pageNumB) ? (isNaN(pageNumA) ? 1 : -1) : pageNumA - pageNumB;
                return sortConfig.direction === 'ascending' ? comparison : -comparison;
            }
            const valA = a[sortConfig.key as keyof Student];
            const valB = b[sortConfig.key as keyof Student];
            if (valA === undefined || valA === null) return 1;
            if (valB === undefined || valB === null) return -1;
            if (typeof valA === 'string' && typeof valB === 'string') {
                const cmp = arabicCompare(valA, valB);
                return sortConfig.direction === 'ascending' ? cmp : -cmp;
            }
            if (valA < valB) return sortConfig.direction === 'ascending' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'ascending' ? 1 : -1;
            return 0;
        });
        return sortableStudents;
    }, [students, searchTerm, statusFilter, levelFilter, user, isSuperAdmin, isManagement, selectedGroup, sortConfig, allUsers]);

    const unreadManagementMessages = useMemo(() => {
        if (!user || isSuperAdmin) return [];
        return Object.values(dailyReports || {})
            .flatMap(dayReports => Object.values(dayReports || {}))
            .filter(r => r.isManagementMessage && !r.isReadByRecipient && r.authorId !== user.uid);
    }, [dailyReports, user, isSuperAdmin]);

    const allStudents = useMemo(() => {
        let list = isSuperAdmin || isManagement ? (students ?? []) : (students ?? []).filter(s => s.ownerId === user?.uid);
        if (isManagement && selectedGroup !== 'all') {
            if (selectedGroup === 'sheikhs_all') {
                list = list.filter(s => isStudentInMenSheikhs(s, allUsers));
            } else if (selectedGroup === 'ustadhats_all') {
                list = list.filter(s => isStudentInWomenUstadhats(s, allUsers));
            } else {
                const selectedUser = allUsers.find(u => u.uid === selectedGroup);
                if (selectedUser?.group) {
                    list = list.filter(s => s.groupName?.trim() === selectedUser.group?.trim());
                } else {
                    list = list.filter(s => s.ownerId === selectedGroup);
                }
            }
        }
        return list;
    }, [students, user, isSuperAdmin, isManagement, selectedGroup, allUsers]);

    const transferredOutCount = useMemo(() => {
        const currentGroupUid = (isSuperAdmin || isManagement) ? selectedGroup : user?.uid;
        if (currentGroupUid === 'all') {
            // Count all unique students who have been transferred at least once
            return (students ?? []).filter(s => (s.transferHistory?.length || 0) > 0).length;
        }
        // Count students who were transferred FROM this specific group
        return (students ?? []).filter(s =>
            s.transferHistory?.some(h => h.fromSheikhId === currentGroupUid)
        ).length;
    }, [students, selectedGroup, user, isSuperAdmin, isManagement]);

    if (loading) {
        return <div className="flex items-center justify-center h-full"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
    }

    const unreadMessagesAlert = unreadManagementMessages.length > 0 && (
        <Alert className="border-purple-500 bg-purple-50 dark:bg-purple-900/20 border-r-8 border-r-purple-600 shadow-lg animate-bounce-subtle mb-6">
            <ShieldAlert className="h-5 w-5 text-purple-600" />
            <AlertTitle className="text-purple-800 dark:text-purple-300 font-headline font-bold text-lg mr-2">توجيه إداري جديد!</AlertTitle>
            <AlertDescription className="mr-2 mt-1">
                <p className="text-purple-700 dark:text-purple-400 font-medium">
                    لديك ({unreadManagementMessages.length}) رسالة إدارية هامة في صفحة التقرير اليومي. يرجى الاطلاع عليها والرد أو التأكيد.
                </p>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push('/reports/daily')}
                    className="mt-3 border-purple-400 text-purple-700 hover:bg-purple-100 font-bold rounded-lg"
                >
                    <BellRing className="ml-2 h-4 w-4" /> عرض الرسائل الآن
                    <ArrowLeft className="mr-2 h-4 w-4" />
                </Button>
            </AlertDescription>
        </Alert>
    );

    if (allStudents.length === 0 && !loading) {
        return (
            <div className="space-y-6">
                <DailyInspiration />
                {unreadMessagesAlert}
                <div className="flex flex-col items-center justify-center py-20 bg-muted/20 rounded-3xl border-2 border-dashed border-muted">
                    <Users className="h-16 w-16 text-muted-foreground/30 mb-4" />
                    <h1 className="text-2xl font-bold mb-2">لا يوجد طلاب بعد</h1>
                    <p className="text-muted-foreground mb-6">ابدأ بإضافة طالب جديد أو استيراد قائمة الطلاب.</p>
                    {!isSuperAdmin && <Dialog open={isAddStudentDialogOpen} onOpenChange={setAddStudentDialogOpen}>
                        <DialogTrigger asChild><Button><PlusCircle className="ml-2 h-4 w-4" />إضافة طالب جديد</Button></DialogTrigger>
                        <DialogContent className="sm:max-w-[600px]">
                            <DialogHeader>
                                <DialogTitle>إضافة طالب جديد</DialogTitle>
                                <DialogDescription>أدخل معلومات الطالب الجديد هنا لإضافته إلى النظام.</DialogDescription>
                            </DialogHeader>
                            <StudentForm addStudent={addStudent} onSuccess={() => setAddStudentDialogOpen(false)} onCancel={() => setAddStudentDialogOpen(false)} />
                        </DialogContent>
                    </Dialog>}
                </div>
            </div>
        )
    }

    return (
        <TooltipProvider>
            <div className="space-y-6 no-print">
                <DailyInspiration />

                {unreadMessagesAlert}

                {/* Global Dashboard Stats */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <Card className="border-none bg-primary/10 shadow-sm hover:shadow-md transition-all group overflow-hidden relative">
                        <div className="absolute right-0 top-0 p-2 opacity-10 group-hover:scale-110 transition-transform"><Users className="h-16 w-16" /></div>
                        <CardContent className="p-4 relative">
                            <p className="text-xs text-primary font-body font-bold">إجمالي الطلبة</p>
                            <h3 className="text-3xl font-bold font-headline mt-1">{allStudents.length}</h3>
                        </CardContent>
                    </Card>
                    <Card className="border-none bg-emerald-50 shadow-sm hover:shadow-md transition-all group overflow-hidden relative">
                        <div className="absolute right-0 top-0 p-2 opacity-10 group-hover:scale-110 transition-transform"><UserCheck className="h-16 w-16" /></div>
                        <CardContent className="p-4 relative">
                            <p className="text-xs text-emerald-600 font-body font-bold">الطلبة النشطون</p>
                            <h3 className="text-3xl font-bold font-headline mt-1 text-emerald-700">{allStudents.filter(s => s.status === 'نشط').length}</h3>
                        </CardContent>
                    </Card>
                    <Card className="border-none bg-amber-50 shadow-sm hover:shadow-md transition-all group overflow-hidden relative">
                        <div className="absolute right-0 top-0 p-2 opacity-10 group-hover:scale-110 transition-transform"><Star className="h-16 w-16" /></div>
                        <CardContent className="p-4 relative">
                            <p className="text-xs text-amber-600 font-body font-bold">المتفوقون (TOP 3)</p>
                            <h3 className="text-3xl font-bold font-headline mt-1 text-amber-700">{Math.min(filteredStudents.length, 3)}</h3>
                        </CardContent>
                    </Card>
                    <Card className="border-none bg-red-50 shadow-sm hover:shadow-md transition-all group overflow-hidden relative">
                        <div className="absolute right-0 top-0 p-2 opacity-10 group-hover:scale-110 transition-transform"><UserMinus className="h-16 w-16" /></div>
                        <CardContent className="p-4 relative">
                            <p className="text-xs text-red-600 font-body font-bold">المطرودون</p>
                            <h3 className="text-3xl font-bold font-headline mt-1 text-red-700">{allStudents.filter(s => s.status === 'مطرود').length}</h3>
                        </CardContent>
                    </Card>
                    <Card className="border-none bg-blue-50 shadow-sm hover:shadow-md transition-all group overflow-hidden relative">
                        <div className="absolute right-0 top-0 p-2 opacity-10 group-hover:scale-110 transition-transform"><ArrowRightLeft className="h-16 w-16" /></div>
                        <CardContent className="p-4 relative">
                            <p className="text-xs text-blue-600 font-body font-bold">الطلاب المنتقلون</p>
                            <h3 className="text-3xl font-bold font-headline mt-1 text-blue-700">{transferredOutCount}</h3>
                        </CardContent>
                    </Card>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
                    <h1 className="text-3xl font-headline font-bold">إدارة الطلبة</h1>
                    <div className="flex w-full sm:w-auto items-center gap-2">
                        {isManagement && <GroupSelector value={selectedGroup} onChange={setSelectedGroup} className="w-[200px]" />}
                        <div className="flex gap-2 w-full sm:w-auto">
                            <Button
                                variant={isBulkEdit ? "destructive" : "outline"}
                                onClick={() => setIsBulkEdit(!isBulkEdit)}
                                className="flex-1 sm:flex-none font-bold whitespace-nowrap"
                            >
                                {isBulkEdit ? <X className="ml-2 h-4 w-4" /> : <Edit className="ml-2 h-4 w-4 text-primary" />}
                                {isBulkEdit ? "إلغاء الوضع السريع" : "التعديل الجماعي للسجلات"}
                            </Button>
                            {!isBulkEdit && !isSuperAdmin && !isManagement && (
                                <Dialog open={isAddStudentDialogOpen} onOpenChange={setAddStudentDialogOpen}>
                                    <DialogTrigger asChild><Button className="flex-1 sm:flex-none"><PlusCircle className="ml-2 h-4 w-4" />إضافة طالب</Button></DialogTrigger>
                                    <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto p-0 border-none shadow-2xl">
                                        <DialogHeader className="p-6 pb-0">
                                            <DialogTitle>إضافة طالب جديد</DialogTitle>
                                            <DialogDescription>أدخل معلومات الطالب الجديد هنا لإضافته إلى النظام.</DialogDescription>
                                        </DialogHeader>
                                        <StudentForm addStudent={addStudent} onSuccess={() => setAddStudentDialogOpen(false)} onCancel={() => setAddStudentDialogOpen(false)} />
                                    </DialogContent>
                                </Dialog>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-4">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-muted/30 p-4 rounded-xl border border-border/40 transition-all">
                        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                            <div className="relative w-full sm:w-[300px]">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input placeholder="بحث باسم الطالب..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 w-full bg-background" />
                            </div>

                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" className="bg-background">
                                        <Filter className="ml-2 h-4 w-4" />
                                        المستوى الدراسي
                                        {levelFilter.length > 0 && <Badge variant="secondary" className="mr-2 px-1.5 py-0">{levelFilter.length}</Badge>}
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="w-56 max-h-[400px] overflow-y-auto">
                                    <DropdownMenuLabel className="font-headline">اختر المستويات</DropdownMenuLabel>
                                    {educationalLevels.map(level => (
                                        <DropdownMenuCheckboxItem
                                            key={level}
                                            checked={levelFilter.includes(level)}
                                            onCheckedChange={(checked) => checked ? setLevelFilter(prev => [...prev, level]) : setLevelFilter(prev => prev.filter(l => l !== level))}
                                            className="font-body"
                                        >{level}</DropdownMenuCheckboxItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>

                            <div className="flex items-center space-x-1 rounded-lg bg-background p-1 border shadow-sm">
                                <Button variant={statusFilter === 'all' ? 'secondary' : 'ghost'} onClick={() => setStatusFilter('all')} className="h-8 px-3 text-xs font-bold">الكل</Button>
                                <Button variant={statusFilter === 'نشط' ? 'secondary' : 'ghost'} onClick={() => setStatusFilter('نشط')} className="h-8 px-3 text-xs font-bold text-emerald-600">النشطون</Button>
                                <Button variant={statusFilter === 'مطرود' ? 'secondary' : 'ghost'} onClick={() => setStatusFilter('مطرود')} className="h-8 px-3 text-xs font-bold text-red-500">المطرودون</Button>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <Button variant="outline" className="flex-1 sm:flex-none bg-background font-bold" onClick={handleExportStudents} disabled={(students ?? []).length === 0}><Download className="ml-2 h-4 w-4" />تصدير Excel</Button>
                            {isSuperAdmin && <AlertDialog>
                                <AlertDialogTrigger asChild><Button variant="destructive" className="flex-1 sm:flex-none font-bold" disabled={(students ?? []).length === 0}><Trash2 className="ml-2 h-4 w-4" />حذف الكل</Button></AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle className="font-headline">هل أنت متأكد تمامًا؟</AlertDialogTitle>
                                        <AlertDialogDescription className="font-body text-right">سيؤدي هذا إلى حذف جميع بيانات الطلبة نهائيًا في هذا الفوج. هذا الإجراء لا يمكن التراجع عنه.</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter className="gap-2">
                                        <AlertDialogCancel className="font-bold">إلغاء</AlertDialogCancel>
                                        <AlertDialogAction onClick={deleteAllStudents} className="bg-destructive hover:bg-destructive/90 font-bold">نعم، قم بحذف الكل</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>}
                        </div>
                    </div>

                    {levelFilter.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2 p-2 bg-primary/5 rounded-lg border border-primary/10 animate-in fade-in slide-in-from-top-1">
                            <span className="text-xs font-body font-bold text-primary mr-2">الفلترة الحالية:</span>
                            {levelFilter.map(level => (
                                <Badge key={level} variant="secondary" className="gap-1 px-2 py-1 bg-background border shadow-sm">
                                    {level}
                                    <X className="h-3 w-3 cursor-pointer hover:text-destructive" onClick={() => setLevelFilter(prev => prev.filter(l => l !== level))} />
                                </Badge>
                            ))}
                            <Button variant="ghost" size="sm" onClick={() => setLevelFilter([])} className="h-7 text-xs text-muted-foreground hover:text-destructive">مسح الكل</Button>
                        </div>
                    )}
                </div>

                {isBulkEdit ? (
                    <BulkStudentEditView
                        students={allStudents}
                        onClose={() => setIsBulkEdit(false)}
                    />
                ) : (
                    <Card>
                        <CardHeader>
                            <CardTitle>قائمة الطلبة ({filteredStudents.length})</CardTitle>
                            <CardDescription>{isSuperAdmin ? 'عرض شامل لجميع الطلبة في كل الأفواج' : (user?.group || 'فوج غير محدد')}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <StudentTable
                                students={filteredStudents}
                                selectedRows={selectedRows}
                                onSelectedRowsChange={setSelectedRows}
                                sortConfig={sortConfig}
                                onRequestSort={requestSort}
                                isSuperAdmin={isSuperAdmin}
                                isManagement={isManagement}
                                onStudentClick={setSelectedStudent}
                                onStatusChange={handleStatusChange}
                                onEdit={(student) => { setSelectedStudent(student); setEditStudentDialogOpen(true); }}
                                searchTerm={searchTerm}
                            />
                        </CardContent>
                    </Card>
                )}

                {selectedStudent && (
                    <Dialog open={!!selectedStudent && !isEditStudentDialogOpen} onOpenChange={(isOpen) => !isOpen && setSelectedStudent(null)}>
                        <StudentProfileCard
                            student={selectedStudent}
                            user={user}
                            rankingData={rankingData}
                            medalHistory={getStudentMedalHistory(selectedStudent.id)}
                            onEdit={() => setEditStudentDialogOpen(true)}
                            onViewStats={() => router.push(`/student-history?studentId=${selectedStudent.id}`)}
                        />
                    </Dialog>
                )}

                {selectedStudent && isEditStudentDialogOpen && (
                    <Dialog open={isEditStudentDialogOpen} onOpenChange={setEditStudentDialogOpen}>
                        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto p-0 border-none shadow-2xl">
                            <DialogHeader className="p-6 pb-0">
                                <DialogTitle>تعديل بيانات: {selectedStudent.fullName}</DialogTitle>
                                <DialogDescription>قم بتحديث معلومات الطالب هنا.</DialogDescription>
                            </DialogHeader>
                            <StudentForm
                                student={selectedStudent}
                                addStudent={addStudent}
                                updateStudent={updateStudent}
                                onSuccess={() => { setEditStudentDialogOpen(false); setSelectedStudent(null); }}
                                onCancel={() => { setEditStudentDialogOpen(false); setSelectedStudent(null); }}
                            />
                        </DialogContent>
                    </Dialog>
                )}
                {selectedRows.length > 0 && (!isSuperAdmin || isManagement) && (
                    <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-auto p-2 bg-background/95 border-t shadow-lg z-50 rounded-t-lg">
                        <div className="container mx-auto flex justify-between items-center gap-4">
                            <p className="font-semibold text-sm">{selectedRows.length} طلاب محددون</p>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={() => setSelectedRows([])}>إلغاء التحديد</Button>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild><Button variant="destructive" size="sm">حذف المحدد</Button></AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle>
                                            <AlertDialogDescription>سيؤدي هذا إلى حذف {selectedRows.length} طالب(ة) نهائياً. لا يمكن التراجع عن هذا الإجراء.</AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                            <AlertDialogAction onClick={handleBulkDelete}>تأكيد الحذف</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </TooltipProvider >
    );
}
