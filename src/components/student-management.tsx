

"use client";

import React, { useState, useMemo } from 'react';
import { PlusCircle, MoreHorizontal, FilePen, Trash2, UserX, Loader2, Download, Search, ShieldAlert, User as UserIcon, Calendar as CalendarIcon, Phone, GraduationCap, Award, FolderKanban, UserRound, Filter, ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger, DropdownMenuCheckboxItem } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { Student, StudentStatus, MemorizationAmount, SubscriptionTier, Covenant, CovenantCard, CovenantStatus, CovenantType, DailySession } from '@/lib/types';
import { useStudentContext } from '@/context/StudentContext';
import { useAuth } from '@/context/AuthContext';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format, parseISO, getMonth, getYear, startOfMonth, endOfMonth, isAfter } from 'date-fns';
import { ar } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import { v4 as uuidv4 } from 'uuid';
import { DailyInspiration } from '@/components/ui/DailyInspiration';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';


const educationalLevels = ["روضة", "تحضيري", "1 ابتدائي", "2 ابتدائي", "3 ابتدائي", "4 ابتدائي", "5 ابتدائي", "1 متوسط", "2 متوسط", "3 متوسط", "4 متوسط", "1 ثانوي", "2 ثانوي", "3 ثانوي", "بكالوريا", "جامعي", "متوقف عن الدراسة"];

const statusVariant: { [key in StudentStatus]: "default" | "destructive" | "secondary" | "outline" } = {
  "نشط": "default",
  "مطرود": "destructive",
  "غائب طويل": "secondary",
  "محذوف": "outline"
};


const calculateAge = (birthDate?: Date) => {
  if (!birthDate) return 'N/A';
  const ageDifMs = Date.now() - new Date(birthDate).getTime();
  const ageDate = new Date(ageDifMs);
  return Math.abs(ageDate.getUTCFullYear() - 1970);
};

const StudentProfileCard = ({ student, user, rankingData, onEdit, onViewStats }: { student: Student, user: any, rankingData: any, onEdit: () => void, onViewStats: () => void }) => {
    const { students, dailySessions, settings } = useStudentContext();
    
    const medalHistory = useMemo(() => {
        const history: (string | null)[] = Array(12).fill(null);
        let consecutiveGold = 0;
        let grandMaster = false;
        let goldCount = 0;

        const currentYear = getYear(new Date());

        for (let month = 0; month < 12; month++) {
            const monthStartDate = startOfMonth(new Date(currentYear, month));
            const monthEndDate = endOfMonth(new Date(currentYear, month));
            if (isAfter(monthStartDate, new Date())) continue;

            const sessionsInMonth = Object.values(dailySessions ?? {}).flatMap(sessionsOnDate =>
                Object.values(sessionsOnDate).filter(session => {
                    if (!session?.date) return false;
                    try {
                        const sessionDate = parseISO(session.date);
                        return sessionDate >= monthStartDate && sessionDate <= monthEndDate;
                    } catch (e) { return false; }
                })
            );

            const studentScores: any = {};
            (students ?? []).filter(s => s.status === 'نشط').forEach(s => {
                studentScores[s.id] = {
                    id: s.id,
                    points: 0,
                    stats: { absent: 0, makeup: 0, calm: 0, medium: 0, undisciplined: 0 }
                };
            });

            sessionsInMonth.forEach(session => {
                (session.records ?? []).forEach(record => {
                    if (studentScores[record.studentId]) {
                         if (record.attendance) {
                            if (record.attendance === 'غائب') studentScores[record.studentId].stats.absent++;
                            if (record.attendance === 'تعويض') studentScores[record.studentId].stats.makeup++;
                        }
                         if (record.behavior) {
                            if (record.behavior === 'هادئ') studentScores[record.studentId].stats.calm++;
                            if (record.behavior === 'متوسط') studentScores[record.studentId].stats.medium++;
                            if (record.behavior === 'غير منضبط') studentScores[record.studentId].stats.undisciplined++;
                        }
                        // Simplified point calculation for history
                        studentScores[record.studentId].points += (settings.points.attendance[record.attendance as keyof typeof settings.points.attendance] || 0);
                        studentScores[record.studentId].points += (settings.points.evaluation[record.memorization as keyof typeof settings.points.evaluation] || 0);
                        studentScores[record.studentId].points += (settings.points.behavior[record.behavior as keyof typeof settings.points.behavior] || 0);
                    }
                });
            });

            const rankedStudents = Object.values(studentScores).sort((a: any, b: any) => b.points - a.points);
            const studentRankIndex = rankedStudents.findIndex(s => s.id === student.id);

            if (studentRankIndex !== -1 && studentRankIndex < 3) {
                const studentData = rankedStudents[studentRankIndex] as any;
                const uncompensatedAbsences = studentData.stats.absent - studentData.stats.makeup;
                
                let medal: string | null = null;
                if (studentRankIndex === 0 && uncompensatedAbsences <= 0 && studentData.stats.calm > (studentData.stats.medium + studentData.stats.undisciplined)) {
                    medal = "gold";
                    goldCount++;
                    consecutiveGold++;
                } else if (studentRankIndex === 1 && uncompensatedAbsences <= 1) {
                    medal = "silver";
                    consecutiveGold = 0;
                } else if (studentRankIndex === 2 && uncompensatedAbsences <= 2) {
                    medal = "bronze";
                    consecutiveGold = 0;
                } else {
                    consecutiveGold = 0;
                }
                history[month] = medal;
                 if (consecutiveGold >= 3) {
                    grandMaster = true;
                }
            } else {
                consecutiveGold = 0;
            }
        }
        return { history, goldCount, grandMaster };
    }, [student.id, students, dailySessions, settings.points]);


    const { rank, commitmentBalance } = useMemo(() => {
        const studentRankData = rankingData.find((r:any) => r.id === student.id);
        if (!studentRankData) return { rank: 'N/A', commitmentBalance: 0 };
        const rankIndex = rankingData.findIndex((r:any) => r.id === student.id);
        const rankToShow = rankIndex !== -1 ? rankIndex + 1 : 'N/A';
        return {
            rank: rankToShow,
            commitmentBalance: studentRankData.stats.commitmentBalance,
        }
    }, [rankingData, student.id]);
    
    const activeCovenant = (student.covenants || []).find(c => c.status === 'نشط');

    return (
        <DialogContent className="sm:max-w-3xl">
            <DialogHeader>
                <DialogTitle className="sr-only">بطاقة هوية الطالب: {student.fullName}</DialogTitle>
            </DialogHeader>
             <div className="flex flex-col items-center pt-4">
                <Avatar className="w-24 h-24 mb-4 border-4 border-primary">
                    <AvatarImage src={student.photoURL} alt={student.fullName} />
                    <AvatarFallback>{student.fullName.charAt(0)}</AvatarFallback>
                </Avatar>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    {student.fullName}
                    {medalHistory.grandMaster && (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger>
                                    <Award className="h-6 w-6 text-amber-500" />
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>وسام "المتقن الكبير" (3 ميداليات ذهبية متتالية)</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}
                </h2>
                <p className="text-muted-foreground">{student.status}</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 py-4">
                <div className="p-3 bg-muted rounded-lg">
                    <dt className="text-sm font-medium text-muted-foreground">العمر</dt>
                    <dd className="font-semibold">{calculateAge(student.birthDate)} سنة</dd>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                    <dt className="text-sm font-medium text-muted-foreground">تاريخ التسجيل</dt>
                    <dd className="font-semibold">{format(student.registrationDate, 'd MMM yyyy', {locale: ar})}</dd>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                    <dt className="text-sm font-medium text-muted-foreground">هاتف الولي</dt>
                    <dd className="font-semibold">{student.phone1}</dd>
                </div>
                 <div className="p-3 bg-muted rounded-lg">
                    <dt className="text-sm font-medium text-muted-foreground">الفوج</dt>
                    <dd className="font-semibold">{student.groupName || 'غير محدد'}</dd>
                </div>
                 <div className="p-3 bg-muted rounded-lg">
                    <dt className="text-sm font-medium text-muted-foreground">الشيخ المشرف</dt>
                    <dd className="font-semibold">{user?.displayName}</dd>
                </div>
                 <div className="p-3 bg-muted rounded-lg">
                    <dt className="text-sm font-medium text-muted-foreground">المستوى الحالي</dt>
                    <dd className="font-semibold">{student.subscriptionTier}</dd>
                </div>
            </div>
             <Card>
                <CardHeader>
                    <CardTitle>المؤشرات الذكية</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                     <TooltipProvider>
                     <Tooltip>
                        <TooltipTrigger>
                            <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-md">
                                <Award className="h-5 w-5 text-blue-600"/>
                                <div>
                                    <p className="text-xs text-blue-800">الترتيب الشهري الحالي</p>
                                     <p className="font-bold">{rank !== 'N/A' ? `المركز ${rank}`: 'خارج الترتيب'}</p>
                                </div>
                            </div>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>ترتيب مستحق بناءً على محرك النقاط - آخر تحديث: {format(new Date(), 'd MMMM yyyy', { locale: ar })}</p>
                        </TooltipContent>
                    </Tooltip>
                    </TooltipProvider>

                     <div className="flex items-center gap-2 p-2 bg-orange-50 rounded-md">
                        <FolderKanban className="h-5 w-5 text-orange-600"/>
                        <div>
                            <p className="text-xs text-orange-800">ميزان الالتزام</p>
                            <p className="font-bold">{commitmentBalance > 0 ? `مدين بـ ${commitmentBalance} حصص` : "لا يوجد دين"}</p>
                        </div>
                    </div>
                     <div className="flex items-center gap-2 p-2 bg-yellow-50 rounded-md">
                        <ShieldAlert className="h-5 w-5 text-yellow-600"/>
                        <div>
                            <p className="text-xs text-yellow-800">المواثيق النشطة</p>
                            <p className="font-bold">{activeCovenant ? activeCovenant.card : "لا يوجد"}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex justify-between items-center">
                        <span>حصاد الأوسمة السنوي ({getYear(new Date())})</span>
                         <div className="flex items-center gap-2 text-base">
                            <span className="font-bold text-amber-500">{medalHistory.goldCount} 🥇</span>
                        </div>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-12 gap-2 text-center">
                        {medalHistory.history.map((medal, index) => {
                            const monthName = format(new Date(2024, index, 1), 'MMM', {locale: ar});
                            return (
                                <div key={index} className="flex flex-col items-center gap-1">
                                    <span className="text-xs text-muted-foreground">{monthName}</span>
                                    <div className={cn("h-8 w-8 rounded-full flex items-center justify-center text-lg",
                                        medal === 'gold' ? 'bg-medal-gold' :
                                        medal === 'silver' ? 'bg-medal-silver' :
                                        medal === 'bronze' ? 'bg-medal-bronze' :
                                        'bg-gray-200 dark:bg-gray-700'
                                    )}>
                                        {medal === 'gold' ? '🥇' : medal === 'silver' ? '🥈' : medal === 'bronze' ? '🥉' : ''}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </CardContent>
            </Card>
             <DialogFooter>
                <Button variant="secondary" onClick={onViewStats}>عرض الإحصائيات</Button>
                <Button onClick={onEdit}>تعديل البيانات</Button>
            </DialogFooter>
        </DialogContent>
    );
};

export default function StudentManagementPage() {
  const { students, updateStudent, deleteStudent, loading, deleteAllStudents, deleteMultipleStudents, dailySessions, settings } = useStudentContext();
  const { user, isSuperAdmin } = useAuth();
  const [isAddStudentDialogOpen, setAddStudentDialogOpen] = useState(false);
  const [isEditStudentDialogOpen, setEditStudentDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [levelFilter, setLevelFilter] = useState<string[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [sortConfig, setSortConfig] = useState<{ key: keyof Student | 'pageNumber'; direction: 'ascending' | 'descending' }>({ key: 'fullName', direction: 'ascending' });

    const rankingData = useMemo(() => {
        const pointsConfig = settings.points;
        if (!pointsConfig || !students) return [];
        
        const monthStartDate = startOfMonth(new Date());
        const monthEndDate = endOfMonth(new Date());

        const sessionsInMonth = Object.values(dailySessions ?? {}).flatMap(sessionsOnDate => 
            Object.values(sessionsOnDate).filter(session => {
                if(!session?.date) return false;
                try {
                    const sessionDate = parseISO(session.date);
                    return sessionDate >= monthStartDate && sessionDate <= monthEndDate;
                } catch(e) { return false; }
            })
        );

        const studentScores: any = {};
        (students ?? []).forEach(student => {
             studentScores[student.id] = {
                id: student.id,
                points: 0,
                stats: { present: 0, absent: 0, makeup: 0, calm: 0, medium: 0, undisciplined: 0, commitmentBalance: 0 }
            };
        });

        sessionsInMonth.forEach(session => {
            (session.records ?? []).forEach(record => {
                const studentId = record.studentId;
                if (studentScores[studentId]) {
                     if (record.attendance && pointsConfig.attendance) {
                        studentScores[studentId].points += (pointsConfig.attendance[record.attendance as keyof typeof pointsConfig.attendance] || 0);
                        if(record.attendance === 'حاضر') studentScores[studentId].stats.present++;
                        if(record.attendance === 'غائب') studentScores[studentId].stats.absent++;
                        if(record.attendance === 'تعويض') studentScores[studentId].stats.makeup++;
                    }
                    if (record.memorization && pointsConfig.evaluation) {
                        studentScores[studentId].points += (pointsConfig.evaluation[record.memorization as keyof typeof pointsConfig.evaluation] || 0);
                    }
                    if (record.behavior && pointsConfig.behavior) {
                         studentScores[studentId].points += (pointsConfig.behavior[record.behavior as keyof typeof pointsConfig.behavior] || 0);
                         if(record.behavior === 'هادئ') studentScores[studentId].stats.calm++;
                         if(record.behavior === 'متوسط') studentScores[studentId].stats.medium++;
                         if(record.behavior === 'غير منضبط') studentScores[studentId].stats.undisciplined++;
                    }
                }
            });
        });
        
        Object.values(studentScores).forEach((score: any) => {
            score.stats.commitmentBalance = score.stats.absent - score.stats.makeup;
        });

        return Object.values(studentScores).sort((a: any, b: any) => b.points - a.points);
    }, [students, dailySessions, settings.points]);

  const handleStatusChange = (student: Student, status: StudentStatus, reason?: string) => {
    if (status === 'محذوف') {
        deleteStudent(student.id, student.ownerId);
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
    const dataToExport = (students ?? []).map(s => ({
        "الاسم الكامل": s.fullName,
        "الفوج": s.groupName || user?.group || 'غير محدد',
        "اسم الولي": s.guardianName,
        "رقم الهاتف 1": s.phone1,
        "رقم الهاتف 2": s.phone2 || '',
        "تاريخ الميلاد": format(s.birthDate, 'dd/MM/yyyy'),
        "تاريخ التسجيل": format(s.registrationDate, 'dd/MM/yyyy'),
        "الحالة": s.status,
        "فئة الاشتراك": s.subscriptionTier,
        "مقدار الحفظ اليومي": s.dailyMemorizationAmount,
        "السور المحفوظة": s.memorizedSurahsCount,
        "ملاحظات": s.notes || '',
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    ws['!cols'] = [ { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 30 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "قائمة الطلبة");
    XLSX.writeFile(wb, "قائمة_الطلبة_الحالية.xlsx");
  };

  const getMedalStatus = (studentId: string, index: number) => {
      const studentData = rankingData.find((r: any) => r.id === studentId);
      if (!studentData) return 'none';
      
      const uncompensatedAbsences = studentData.stats.absent - studentData.stats.makeup;
      const rank = index + 1;
      
      if (rank === 1) {
          const isExcellentBehavior = studentData.stats.calm > (studentData.stats.medium + studentData.stats.undisciplined);
          if (uncompensatedAbsences <= 0 && isExcellentBehavior) return 'gold';
      }
      if (rank === 2 && uncompensatedAbsences <= 1) return 'silver';
      if (rank === 3 && uncompensatedAbsences <= 2) return 'bronze';
      return 'none';
  };
  
    const requestSort = (key: keyof Student | 'pageNumber') => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    }

  const filteredStudents = useMemo(() => {
    const statusOrder: { [key in StudentStatus]: number } = { "نشط": 1, "غائب طويل": 2, "مطرود": 3, "محذوف": 4, };
    
    let sortableStudents = (students ?? []);

    if (!isSuperAdmin && user?.group) {
        sortableStudents = sortableStudents.filter(student => student.groupName === user.group);
    }
        
    sortableStudents = sortableStudents.filter(student => student.fullName.toLowerCase().includes(searchTerm.toLowerCase()));

    if (statusFilter !== 'all') {
        sortableStudents = sortableStudents.filter(s => s.status === statusFilter);
    }
    if (levelFilter.length > 0) {
        sortableStudents = sortableStudents.filter(s => s.educationalLevel && levelFilter.includes(s.educationalLevel));
    }
        
    sortableStudents.sort((a, b) => {
        if (sortConfig.key === 'pageNumber') {
             const pageNumA = a.pageNumber ? parseInt(a.pageNumber, 10) : Infinity;
             const pageNumB = b.pageNumber ? parseInt(b.pageNumber, 10) : Infinity;
             let comparison = 0;
             if (!isNaN(pageNumA) && !isNaN(pageNumB)) { comparison = pageNumA - pageNumB; } 
             else if (!isNaN(pageNumA)) { comparison = -1; } 
             else if (!isNaN(pageNumB)) { comparison = 1; }
             return sortConfig.direction === 'ascending' ? comparison : -comparison;
        }
        if (a.status !== b.status) {
            return statusOrder[a.status] - statusOrder[b.status];
        }
        if (a[sortConfig.key] < b[sortConfig.key]) {
            return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
            return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
    });

    return sortableStudents;

  }, [students, searchTerm, statusFilter, levelFilter, sortConfig, isSuperAdmin, user]);
  
  const getActiveCovenant = (student: Student): Covenant | null => {
      if (!student.covenants || student.covenants.length === 0) return null;
      return student.covenants.find(c => c.status === 'نشط') || null;
  };


  if (loading) {
    return (
        <div className="flex items-center justify-center h-full">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
    );
  }
  
   if ((students ?? []).length === 0 && !loading) {
      return (
        <div className="flex flex-col items-center justify-center h-full">
            <h1 className="text-2xl font-bold mb-4">لا يوجد طلاب بعد</h1>
            <p className="text-muted-foreground mb-6">ابدأ بإضافة طالب جديد أو استيراد قائمة الطلاب.</p>
            {!isSuperAdmin && <Dialog open={isAddStudentDialogOpen} onOpenChange={setAddStudentDialogOpen}>
            <DialogTrigger asChild>
                <Button>
                <PlusCircle className="ml-2 h-4 w-4" />
                إضافة طالب جديد
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
                <StudentForm 
                onSuccess={() => setAddStudentDialogOpen(false)} 
                onCancel={() => setAddStudentDialogOpen(false)}
                />
            </DialogContent>
            </Dialog>}
        </div>
      )
  }

  return (
    <TooltipProvider>
    <div className="space-y-6">
       <DailyInspiration />
       
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
        <h1 className="text-3xl font-headline font-bold">إدارة الطلبة</h1>
        <div className="flex w-full sm:w-auto items-center gap-2">
         {!isSuperAdmin && <Dialog open={isAddStudentDialogOpen} onOpenChange={setAddStudentDialogOpen}>
          <DialogTrigger asChild>
              <Button className="w-full sm:w-auto">
              <PlusCircle className="ml-2 h-4 w-4" />
              إضافة طالب جديد
              </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
              <StudentForm 
              onSuccess={() => setAddStudentDialogOpen(false)} 
              onCancel={() => setAddStudentDialogOpen(false)}
              />
          </DialogContent>
          </Dialog>}
        </div>
      </div>

       <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
         <div className="flex flex-wrap items-center gap-2">
             <div className="relative flex-grow sm:flex-grow-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                    placeholder="بحث باسم الطالب..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 w-full sm:w-[250px]"
                />
             </div>
             <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline"><Filter className="ml-2 h-4 w-4" />المستوى الدراسي {levelFilter.length > 0 && `(${levelFilter.length})`}</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56">
                    <DropdownMenuLabel>اختر المستويات</DropdownMenuLabel>
                    {educationalLevels.map(level => (
                        <DropdownMenuCheckboxItem
                            key={level}
                            checked={levelFilter.includes(level)}
                            onCheckedChange={(checked) => {
                                if (checked) setLevelFilter(prev => [...prev, level]);
                                else setLevelFilter(prev => prev.filter(l => l !== level));
                            }}
                        >{level}</DropdownMenuCheckboxItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
             <Select dir="rtl" value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full flex-grow sm:w-[180px]">
                    <SelectValue placeholder="الحالة" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">كل الحالات</SelectItem>
                    <SelectItem value="نشط">نشط</SelectItem>
                    <SelectItem value="غائب طويل">غائب طويل</SelectItem>
                    <SelectItem value="مطرود">مطرود</SelectItem>
                </SelectContent>
            </Select>
         </div>
         <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleExportStudents} disabled={(students ?? []).length === 0}>
                <Download className="ml-2 h-4 w-4" />
                تصدير الطلبة (Excel)
            </Button>
            {!isSuperAdmin && <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={(students ?? []).length === 0}>
                        <Trash2 className="ml-2 h-4 w-4" />
                        حذف كل الطلبة
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>هل أنت متأكد تمامًا؟</AlertDialogTitle>
                        <AlertDialogDescription>
                            سيؤدي هذا إلى حذف جميع بيانات الطلبة نهائيًا من هذا الفوج.
                            هذا الإجراء لا يمكن التراجع عنه.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={deleteAllStudents}>نعم، قم بحذف الكل</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>}
         </div>
       </div>

      <Card>
        <CardHeader>
          <CardTitle>قائمة الطلبة ({filteredStudents.length})</CardTitle>
          <CardDescription>{isSuperAdmin ? 'عرض شامل لجميع الطلبة في كل الأفواج' : (user?.group ? `طلبة ${user.group}` : 'فوج غير محدد')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative w-full overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px] px-2">
                    <Checkbox
                        checked={selectedRows.length > 0 && selectedRows.length === filteredStudents.length && filteredStudents.length > 0}
                        onCheckedChange={(checked) => {
                            if (checked) {
                                setSelectedRows(filteredStudents.map(s => s.id));
                            } else {
                                setSelectedRows([]);
                            }
                        }}
                        aria-label="Select all rows"
                    />
                </TableHead>
                <TableHead className="w-[80px] p-2">
                    <Button variant="ghost" onClick={() => requestSort('pageNumber')} className="px-2">
                        الهوية
                        <ArrowUpDown className="mr-2 h-4 w-4" />
                    </Button>
                </TableHead>
                <TableHead>
                    <Button variant="ghost" onClick={() => requestSort('fullName')}>
                        الاسم الكامل
                        <ArrowUpDown className="mr-2 h-4 w-4" />
                    </Button>
                </TableHead>
                {isSuperAdmin && <TableHead className="text-center">الفوج</TableHead>}
                <TableHead className="hidden md:table-cell text-center">المستوى الدراسي</TableHead>
                <TableHead className="hidden lg:table-cell text-center">اسم الولي</TableHead>
                <TableHead className="text-center">الحالة</TableHead>
                <TableHead className="text-center">فئة الاشتراك</TableHead>
                <TableHead className="hidden md:table-cell text-center">السور المحفوظة</TableHead>
                {!isSuperAdmin && <TableHead className="text-center">
                  <span className="sr-only">إجراءات</span>
                </TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
             {filteredStudents.length > 0 ? (
                filteredStudents.map((student, index) => {
                    const activeCovenant = getActiveCovenant(student);
                     const medal = getMedalStatus(student.id, index);
                      const medalClass = {
                          gold: 'bg-medal-gold/30',
                          silver: 'bg-medal-silver/30',
                          bronze: 'bg-medal-bronze/30',
                          none: ''
                      }[medal];
                      
                      let rowClass = medalClass;
                      if (activeCovenant?.card === 'بطاقة حمراء') rowClass = 'bg-red-50 dark:bg-red-900/20';
                      else if (activeCovenant?.card === 'بطاقة صفراء') rowClass = 'bg-yellow-50 dark:bg-yellow-900/20';
                      else if (student.status === 'غائب طويل') rowClass = 'bg-gray-100 dark:bg-gray-800/20 opacity-70';
                      else if (student.status === 'مطرود') rowClass = 'bg-red-100 dark:bg-red-900/30 line-through opacity-60';

                    return (
                        <TableRow 
                            key={student.id} 
                            data-state={selectedRows.includes(student.id) ? "selected" : ""}
                            className={cn('cursor-pointer', rowClass)} 
                            onClick={() => setSelectedStudent(student)}>
                            <TableCell className="px-2" onClick={(e) => e.stopPropagation()}>
                                <Checkbox
                                    checked={selectedRows.includes(student.id)}
                                    onCheckedChange={(checked) => {
                                        setSelectedRows(prev => 
                                            checked ? [...prev, student.id] : prev.filter(id => id !== student.id)
                                        );
                                    }}
                                    aria-label="Select row"
                                />
                            </TableCell>
                            <TableCell className="p-2">
                                <div className="flex flex-col items-center gap-1">
                                    <Avatar className={cn("w-10 h-10 border-2", activeCovenant?.card === 'بطاقة حمراء' ? 'border-red-500' : activeCovenant?.card === 'بطاقة صفراء' ? 'border-yellow-500' : 'border-transparent')}>
                                        <AvatarImage src={student.photoURL} />
                                        <AvatarFallback className={cn(student.gender === 'أنثى' ? 'bg-pink-100 text-pink-600' : 'bg-blue-100 text-blue-600')}>
                                            {student.gender === 'أنثى' ? <UserRound /> : <UserIcon />}
                                        </AvatarFallback>
                                    </Avatar>
                                    {student.pageNumber && <Badge variant="secondary" className="px-1.5 py-0.5 text-xs">{student.pageNumber}</Badge>}
                                </div>
                            </TableCell>
                            <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                     {activeCovenant && (
                                        <Tooltip>
                                            <TooltipTrigger>
                                                <ShieldAlert className={cn("h-5 w-5", activeCovenant.card === 'بطاقة صفراء' ? 'text-yellow-500' : 'text-red-500')} />
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p className="font-bold">الطالب تحت التعهد ({activeCovenant.card}):</p>
                                                <p>{activeCovenant.text}</p>
                                            </TooltipContent>
                                        </Tooltip>
                                     )}
                                     <span>{student.fullName}</span>
                                </div>
                            </TableCell>
                            {isSuperAdmin && <TableCell className="text-center"><Badge variant="outline">{student.groupName || 'غير محدد'}</Badge></TableCell>}
                            <TableCell className="hidden md:table-cell text-center">{student.educationalLevel || 'غير محدد'}</TableCell>
                            <TableCell className="hidden lg:table-cell text-center">{student.guardianName}</TableCell>
                            <TableCell className="text-center">
                                <Badge variant={statusVariant[student.status]}>{student.status}</Badge>
                            </TableCell>
                            <TableCell className="text-center">
                                <Badge variant="outline">{student.subscriptionTier}</Badge>
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-center">{student.memorizedSurahsCount || 0}</TableCell>
                            {!isSuperAdmin && <TableCell className="text-center">
                                <StudentActions student={student} onStatusChange={handleStatusChange} onEdit={() => { setSelectedStudent(student); setEditStudentDialogOpen(true); }}/>
                            </TableCell>}
                        </TableRow>
                    )
                })
             ) : (
                <TableRow>
                    <TableCell colSpan={isSuperAdmin ? 9 : 8} className="h-24 text-center">
                       {searchTerm ? "لم يتم العثور على طلاب مطابقين للبحث." : "لا يوجد طلبة حاليًا. قم بإضافة طالب جديد."}
                    </TableCell>
                </TableRow>
             )}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>
      
       {selectedStudent && (
        <Dialog open={!!selectedStudent && !isEditStudentDialogOpen} onOpenChange={(isOpen) => !isOpen && setSelectedStudent(null)}>
            <StudentProfileCard 
                student={selectedStudent} 
                user={user} 
                rankingData={rankingData}
                onEdit={() => { setEditStudentDialogOpen(true); }}
                onViewStats={() => {
                     // This should navigate to the student report page
                     // For now, we can just log it or close the dialog
                     setSelectedStudent(null);
                }}
            />
        </Dialog>
      )}

      {selectedStudent && isEditStudentDialogOpen && (
          <Dialog open={isEditStudentDialogOpen} onOpenChange={setEditStudentDialogOpen}>
              <DialogContent className="sm:max-w-[600px]">
                  <StudentForm
                      student={selectedStudent}
                      onSuccess={() => {
                          setEditStudentDialogOpen(false);
                          setSelectedStudent(null);
                      }}
                      onCancel={() => {
                          setEditStudentDialogOpen(false);
                          setSelectedStudent(null);
                      }}
                  />
              </DialogContent>
          </Dialog>
      )}
       {selectedRows.length > 0 && !isSuperAdmin && (
            <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-auto p-2 bg-background/95 border-t shadow-lg z-50 rounded-t-lg">
                <div className="container mx-auto flex justify-between items-center gap-4">
                    <p className="font-semibold text-sm">{selectedRows.length} طلاب محددون</p>
                    <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => setSelectedRows([])}>إلغاء التحديد</Button>
                             <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive" size="sm">حذف المحدد</Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            سيؤدي هذا إلى حذف {selectedRows.length} طالب(ة) نهائياً. لا يمكن التراجع عن هذا الإجراء.
                                        </AlertDialogDescription>
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
    </TooltipProvider>
  );
}

function StudentActions({ student, onStatusChange, onEdit }: { student: Student, onStatusChange: (student: Student, status: StudentStatus, reason?: string) => void, onEdit: () => void }) {
  const [actionReason, setActionReason] = useState('');

  return (
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

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={(e) => { e.preventDefault(); setActionReason('') }}>
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
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={(e) => { e.preventDefault(); setActionReason('') }}>
              <UserX className="ml-2 h-4 w-4" />
              طرد
            </DropdownMenuItem>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>طرد الطالب {student.fullName}</AlertDialogTitle>
              <AlertDialogDescription>
                سيؤدي هذا إلى تغيير حالة الطالب إلى "مطرود". الرجاء إدخال سبب الطرد.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4">
              <Label htmlFor="expel-reason">سبب الطرد</Label>
              <Textarea 
                id="expel-reason" 
                placeholder="مثال: غياب متكرر بدون عذر..." 
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setActionReason('')}>إلغاء</AlertDialogCancel>
              <AlertDialogAction onClick={() => onStatusChange(student, 'مطرود', actionReason)}>تأكيد الطرد</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}


function StudentForm({ student, onSuccess, onCancel }: { student?: Student, onSuccess: () => void, onCancel: () => void }) {
  const { addStudent, updateStudent, settings } = useStudentContext();
  const { user, isSuperAdmin } = useAuth();
  const { toast } = useToast();
  const [birthDate, setBirthDate] = useState<Date | undefined>(student?.birthDate ? new Date(student.birthDate) : undefined);
  const [registrationDate, setRegistrationDate] = useState<Date | undefined>(student?.registrationDate ? new Date(student.registrationDate) : new Date());
  const [covenants, setCovenants] = useState<Covenant[]>(student?.covenants || []);
  const [originalCovenants, setOriginalCovenants] = useState<Covenant[]>(student?.covenants || []);
  const [photoPreview, setPhotoPreview] = useState<string | null>(student?.photoURL || null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 500 * 1024) { // 500KB
        toast({ title: 'خطأ', description: 'حجم الصورة كبير جدًا. الحد الأقصى هو 500 كيلوبايت.', variant: 'destructive' });
        return;
    }
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
        toast({ title: 'خطأ', description: 'صيغة الملف غير مدعومة. الرجاء رفع صورة بصيغة JPG أو PNG.', variant: 'destructive' });
        return;
    }
    
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (loadEvent) => {
        setPhotoPreview(loadEvent.target?.result as string);
    };
    reader.readAsDataURL(file);
  };


  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries()) as any;

    if (!birthDate || !registrationDate) {
      toast({ title: 'خطأ', description: 'تاريخ الميلاد وتاريخ التسجيل حقول إلزامية.', variant: 'destructive' });
      return;
    }
    
    // Check for status change from "نشط" to "تم الوفاء به"
    covenants.forEach((newCovenant, index) => {
        const oldCovenant = originalCovenants.find(oc => oc.id === newCovenant.id);
        if (oldCovenant && oldCovenant.status === 'نشط' && newCovenant.status === 'تم الوفاء بها') {
             toast({
                title: `🎉 +${settings.points.covenantCompleted} نقطة`,
                description: `تمت مكافأة الطالب ${student?.fullName} لإنجازه المهمة بنجاح. سيتم تحديث ترتيبه.`,
            });
        }
    });

    const studentData: Partial<Student> & { photoFile?: File | null } = {
        fullName: data.fullName,
        gender: data.gender,
        pageNumber: data.pageNumber,
        educationalLevel: data.educationalLevel,
        groupName: isSuperAdmin ? data.groupName : user?.group,
        guardianName: data.guardianName,
        phone1: data.phone1,
        phone2: data.phone2,
        birthDate: birthDate,
        registrationDate: registrationDate,
        status: data.status,
        subscriptionTier: data.subscriptionTier,
        dailyMemorizationAmount: data.memorizationAmount,
        notes: data.notes,
        covenants: covenants,
        photoFile: photoFile,
    };

    if (student) {
        // Update existing student
        updateStudent(student.id, studentData, student.ownerId);
    } else {
        // Add new student
        addStudent(studentData as Omit<Student, 'id' | 'updatedAt' | 'memorizedSurahsCount' | 'ownerId'> & { photoFile?: File | null });
    }
    
    onSuccess();
  };
  
    const handleAddCovenant = () => {
        const newCovenant: Covenant = {
            id: uuidv4(),
            type: 'تعهد غياب',
            text: 'أتعهد بعدم الغياب دون إذن مسبق.',
            status: 'نشط',
            card: 'بدون',
            date: new Date().toISOString(),
        };
        setCovenants(prev => [...prev, newCovenant]);
    };

    const handleCovenantChange = <K extends keyof Covenant>(index: number, field: K, value: Covenant[K]) => {
        const updatedCovenants = [...covenants];
        updatedCovenants[index] = { ...updatedCovenants[index], [field]: value };
        
        // Auto-fill text based on type
        if (field === 'type') {
            const covenantType = value as CovenantType;
            if (covenantType === 'تعهد غياب') updatedCovenants[index].text = 'أتعهد بعدم الغياب دون إذن مسبق.';
            else if (covenantType === 'ميثاق حفظ') updatedCovenants[index].text = 'أتعهد أمام الله بالالتزام بالحفظ والمراجعة.';
            else if (covenantType === 'التزام سلوكي') updatedCovenants[index].text = 'أتعهد بالالتزام بالسلوك الحسن داخل الحلقة.';
        }
        
        setCovenants(updatedCovenants);
    };

    const handleRemoveCovenant = (index: number) => {
        const updatedCovenants = [...covenants];
        updatedCovenants.splice(index, 1);
        setCovenants(updatedCovenants);
    };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>{student ? `تعديل بيانات: ${student.fullName}` : 'إضافة طالب جديد'}</DialogTitle>
        <DialogDescription>
          {student ? 'قم بتحديث معلومات الطالب هنا.' : 'املأ الحقول أدناه لإضافة طالب جديد إلى الفوج.'}
        </DialogDescription>
      </DialogHeader>
      <div className="max-h-[70vh] overflow-y-auto p-4 space-y-4">
        <div className="flex flex-col items-center gap-4">
            <input type="file" ref={fileInputRef} onChange={handlePhotoChange} accept="image/png, image/jpeg" className="hidden" />
             <Avatar className="w-24 h-24 mb-2 border-4 border-muted">
                <AvatarImage src={photoPreview} />
                <AvatarFallback>{student?.fullName?.charAt(0) || '?'}</AvatarFallback>
            </Avatar>
            <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>تغيير الصورة</Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">الاسم الكامل</Label>
            <Input name="fullName" id="fullName" defaultValue={student?.fullName} required />
          </div>
           <div className="space-y-2">
            <Label htmlFor="gender">الجنس</Label>
             <Select dir="rtl" name="gender" defaultValue={student?.gender || "ذكر"}>
                <SelectTrigger id="gender"><SelectValue /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="ذكر">ذكر</SelectItem>
                    <SelectItem value="أنثى">أنثى</SelectItem>
                </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="guardianName">اسم الولي (اختياري)</Label>
            <Input name="guardianName" id="guardianName" defaultValue={student?.guardianName} />
          </div>
           <div className="space-y-2">
            <Label htmlFor="educationalLevel">المستوى الدراسي</Label>
             <Select dir="rtl" name="educationalLevel" defaultValue={student?.educationalLevel}>
                <SelectTrigger id="educationalLevel"><SelectValue placeholder="اختر المستوى الدراسي" /></SelectTrigger>
                <SelectContent>
                    {educationalLevels.map(level => <SelectItem key={level} value={level}>{level}</SelectItem>)}
                </SelectContent>
            </Select>
          </div>
           <div className="space-y-2">
            <Label htmlFor="pageNumber">رقم الصفحة</Label>
            <Input name="pageNumber" id="pageNumber" defaultValue={student?.pageNumber} />
          </div>
           {isSuperAdmin && (
            <div className="space-y-2">
              <Label htmlFor="groupName">الفوج</Label>
              <Select dir="rtl" name="groupName" defaultValue={student?.groupName || user?.group}>
                <SelectTrigger id="groupName"><SelectValue placeholder="اختر الفوج" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="فوج 1">فوج 1</SelectItem>
                  <SelectItem value="فوج 2">فوج 2</SelectItem>
                  <SelectItem value="فوج 3">فوج 3</SelectItem>
                  <SelectItem value="فوج 4">فوج 4</SelectItem>
                  <SelectItem value="فوج 5">فوج 5</SelectItem>
                  <SelectItem value="فوج 6">فوج 6</SelectItem>
                  <SelectItem value="فوج 7">فوج 7</SelectItem>
                  <SelectItem value="فوج 8">فوج 8</SelectItem>
                  <SelectItem value="فوج 9">فوج 9</SelectItem>
                  <SelectItem value="فوج 10">فوج 10</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="phone1">رقم الهاتف 1 (اختياري)</Label>
            <Input name="phone1" id="phone1" type="tel" defaultValue={student?.phone1} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone2">رقم الهاتف 2 (اختياري)</Label>
            <Input name="phone2" id="phone2" type="tel" defaultValue={student?.phone2} />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
                <Label>تاريخ الميلاد</Label>
                <Popover>
                    <PopoverTrigger asChild>
                    <Button
                        variant={"outline"}
                        className={cn("w-full justify-start text-right font-normal", !birthDate && "text-muted-foreground")}
                    >
                        <CalendarIcon className="ml-2 h-4 w-4" />
                        {birthDate ? format(birthDate, "PPP", { locale: ar }) : <span>اختر تاريخًا</span>}
                    </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                    <Calendar
                        mode="single"
                        selected={birthDate}
                        onSelect={setBirthDate}
                        initialFocus
                        captionLayout="dropdown-buttons"
                        fromYear={1990}
                        toYear={new Date().getFullYear()}
                    />
                    </PopoverContent>
                </Popover>
            </div>
            <div className="space-y-2">
                <Label>تاريخ التسجيل</Label>
                <Popover>
                    <PopoverTrigger asChild>
                    <Button
                        variant={"outline"}
                        className={cn("w-full justify-start text-right font-normal", !registrationDate && "text-muted-foreground")}
                    >
                        <CalendarIcon className="ml-2 h-4 w-4" />
                        {registrationDate ? format(registrationDate, "PPP", { locale: ar }) : <span>اختر تاريخًا</span>}
                    </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                    <Calendar
                        mode="single"
                        selected={registrationDate}
                        onSelect={setRegistrationDate}
                        initialFocus
                    />
                    </PopoverContent>
                </Popover>
            </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
                <Label htmlFor="status">حالة الطالب</Label>
                <Select dir="rtl" name="status" defaultValue={student?.status ?? 'نشط'}>
                    <SelectTrigger id="status">
                        <SelectValue placeholder="اختر الحالة" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="نشط">✅ نشط</SelectItem>
                        <SelectItem value="غائب طويل">⚠️ غائب طويل</SelectItem>
                        <SelectItem value="مطرود">❌ مطرود</SelectItem>
                    </SelectContent>
                </Select>
            </div>
             <div className="space-y-2">
                <Label htmlFor="subscriptionTier">فئة الاشتراك</Label>
                <Select dir="rtl" name="subscriptionTier" defaultValue={student?.subscriptionTier ?? 'فئة الأصاغر'}>
                    <SelectTrigger id="subscriptionTier">
                        <SelectValue placeholder="اختر الفئة" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="فئة الأكابر">فئة الأكابر</SelectItem>
                        <SelectItem value="فئة الأصاغر">فئة الأصاغر</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </div>
         <div className="space-y-2">
            <Label htmlFor="memorizationAmount">مقدار الحفظ اليومي</Label>
            <Select dir="rtl" name="memorizationAmount" defaultValue={student?.dailyMemorizationAmount}>
                <SelectTrigger id="memorizationAmount">
                    <SelectValue placeholder="اختر المقدار" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="نصف صفحة">نصف صفحة</SelectItem>
                    <SelectItem value="صفحة">صفحة</SelectItem>
                    <SelectItem value="ثمن">ثمن</SelectItem>
                    <SelectItem value="ربع">ربع</SelectItem>
                    <SelectItem value="أكثر">أكثر</SelectItem>
                </SelectContent>
            </Select>
        </div>
        <div className="space-y-2">
            <Label htmlFor="notes">ملاحظات عامة</Label>
            <Textarea name="notes" id="notes" defaultValue={student?.notes} placeholder="أي ملاحظات إضافية حول الطالب..." />
        </div>
        
        {/* Covenants Section */}
        <div className="space-y-4 pt-4 border-t">
            <div className="flex justify-between items-center">
                 <h3 className="text-lg font-semibold flex items-center gap-2"><ShieldAlert /> سجل مهام التمكين (المواثيق)</h3>
                 <Button type="button" variant="outline" size="sm" onClick={handleAddCovenant}>
                    <PlusCircle className="ml-2 h-4 w-4" />
                    إضافة مهمة جديدة
                </Button>
            </div>

            {covenants.map((covenant, index) => (
                <Card key={covenant.id} className="p-4 space-y-4 bg-muted/50">
                     <div className="flex justify-between items-start">
                        <div className="space-y-2">
                             <Label>نوع المهمة / الميثاق</Label>
                             <Select dir="rtl" value={covenant.type} onValueChange={(val: CovenantType) => handleCovenantChange(index, 'type', val)}>
                                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ميثاق حفظ">مهمة تمكين (حفظ)</SelectItem>
                                    <SelectItem value="تعهد غياب">تعهد غياب</SelectItem>
                                    <SelectItem value="التزام سلوكي">التزام سلوكي</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                         <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveCovenant(index)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                         </Button>
                    </div>

                     <div className="space-y-2">
                        <Label>نص المهمة / التعهد</Label>
                        <Textarea value={covenant.text} onChange={e => handleCovenantChange(index, 'text', e.target.value)} />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                             <Label>تاريخ التكليف</Label>
                             <Input disabled value={format(parseISO(covenant.date), 'dd MMMM yyyy', {locale: ar})} />
                        </div>
                        <div className="space-y-2">
                             <Label>حالة المهمة</Label>
                             <Select dir="rtl" value={covenant.status} onValueChange={(val: CovenantStatus) => handleCovenantChange(index, 'status', val)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="نشط">نشطة</SelectItem>
                                    <SelectItem value="تم الوفاء بها">تم الوفاء بها</SelectItem>
                                    <SelectItem value="نُقِض">نُقِضت</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                             <Label>البطاقة المرتبطة</Label>
                              <Select dir="rtl" value={covenant.card} onValueChange={(val: CovenantCard) => handleCovenantChange(index, 'card', val)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="بدون">بدون</SelectItem>
                                    <SelectItem value="بطاقة صفراء">🟡 بطاقة صفراء</SelectItem>
                                    <SelectItem value="بطاقة حمراء">🔴 بطاقة حمراء</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </Card>
            ))}
             {covenants.length === 0 && <p className="text-sm text-center text-muted-foreground py-4">لا توجد مهام أو مواثيق مسجلة لهذا الطالب.</p>}
        </div>

      </div>
      <DialogFooter className="border-t pt-4">
        <Button variant="outline" type="button" onClick={onCancel}>إلغاء</Button>
        <Button type="submit">{student ? 'حفظ التغييرات' : 'إضافة طالب'}</Button>
      </DialogFooter>
    </form>
  );
}

    

    

    