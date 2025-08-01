

"use client";

import React, { useState, useMemo } from 'react';
import { PlusCircle, MoreHorizontal, FilePen, Trash2, UserX, Loader2, Download, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { Student, StudentStatus, MemorizationAmount } from '@/lib/types';
import { useStudentContext } from '@/context/StudentContext';
import { useAuth } from '@/context/AuthContext';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import { DailyInspiration } from '@/components/ui/DailyInspiration';


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

export default function StudentManagementPage() {
  const { students, updateStudent, deleteStudent, loading, deleteAllStudents } = useStudentContext();
  const { user } = useAuth();
  const [isAddStudentDialogOpen, setAddStudentDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const handleStatusChange = (student: Student, status: StudentStatus, reason?: string) => {
    if (status === 'محذوف') {
        deleteStudent(student.id, student.ownerId);
    } else {
        updateStudent(student.id, { status, actionReason: reason }, student.ownerId);
    }
  };
  
  const handleExportStudents = () => {
    const dataToExport = (students ?? []).map(s => ({
        "الاسم الكامل": s.fullName,
        "اسم الولي": s.guardianName,
        "رقم الهاتف 1": s.phone1,
        "رقم الهاتف 2": s.phone2 || '',
        "تاريخ الميلاد": format(s.birthDate, 'dd/MM/yyyy'),
        "تاريخ التسجيل": format(s.registrationDate, 'dd/MM/yyyy'),
        "الحالة": s.status,
        "مقدار الحفظ اليومي": s.dailyMemorizationAmount,
        "السور المحفوظة": s.memorizedSurahsCount,
        "ملاحظات": s.notes || '',
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    ws['!cols'] = [ { wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 30 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "قائمة الطلبة");
    XLSX.writeFile(wb, "قائمة_الطلبة_الحالية.xlsx");
  };

  const filteredStudents = useMemo(() => {
    const statusOrder: { [key in StudentStatus]: number } = {
        "نشط": 1,
        "غائب طويل": 2,
        "مطرود": 3,
        "محذوف": 4,
    };

    return (students ?? [])
        .filter(student => student.fullName.toLowerCase().includes(searchTerm.toLowerCase()))
        .sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);
  }, [students, searchTerm]);

  if (loading) {
    return (
        <div className="flex items-center justify-center h-[calc(100vh-200px)]">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
    );
  }
  
   if ((students ?? []).length === 0 && !loading) {
      return (
        <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)]">
            <h1 className="text-2xl font-bold mb-4">لا يوجد طلاب بعد</h1>
            <p className="text-muted-foreground mb-6">ابدأ بإضافة طالب جديد أو استيراد قائمة الطلاب.</p>
            <Dialog open={isAddStudentDialogOpen} onOpenChange={setAddStudentDialogOpen}>
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
            </Dialog>
        </div>
      )
  }

  return (
    <div className="space-y-6">
       <DailyInspiration />
       
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
        <h1 className="text-3xl font-headline font-bold">إدارة الطلبة</h1>
        <div className="flex w-full sm:w-auto items-center gap-2">
          <Dialog open={isAddStudentDialogOpen} onOpenChange={setAddStudentDialogOpen}>
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
          </Dialog>
        </div>
      </div>

       <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
         <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
                placeholder="بحث باسم الطالب..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
            />
         </div>
         <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleExportStudents} disabled={(students ?? []).length === 0}>
                <Download className="ml-2 h-4 w-4" />
                تصدير الطلبة (Excel)
            </Button>
            <AlertDialog>
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
            </AlertDialog>
         </div>
       </div>

      <Card>
        <CardHeader>
          <CardTitle>قائمة الطلبة ({filteredStudents.length})</CardTitle>
          <CardDescription>{user?.group ? `طلبة ${user.group}` : 'فوج غير محدد'}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[25%] text-center">الاسم الكامل</TableHead>
                <TableHead className="hidden md:table-cell w-[25%] text-center">اسم الولي</TableHead>
                <TableHead className="hidden lg:table-cell w-[10%] text-center">العمر</TableHead>
                <TableHead className="w-[15%] text-center">الحالة</TableHead>
                <TableHead className="hidden md:table-cell w-[15%] text-center">السور المحفوظة</TableHead>
                <TableHead className="w-[10%] text-center">
                  <span className="sr-only">إجراءات</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
             {filteredStudents.length > 0 ? (
                filteredStudents.map((student) => (
                    <TableRow key={student.id}>
                    <TableCell className="font-medium text-center">{student.fullName}</TableCell>
                    <TableCell className="hidden md:table-cell text-center">{student.guardianName}</TableCell>
                    <TableCell className="hidden lg:table-cell text-center">{calculateAge(student.birthDate)}</TableCell>
                    <TableCell className="text-center">
                        <Badge variant={statusVariant[student.status]}>{student.status}</Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-center">{student.memorizedSurahsCount || 0}</TableCell>
                    <TableCell className="text-center">
                        <StudentActions student={student} onStatusChange={handleStatusChange} />
                    </TableCell>
                    </TableRow>
                ))
             ) : (
                <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                       {searchTerm ? "لم يتم العثور على طلاب مطابقين للبحث." : "لا يوجد طلبة حاليًا. قم بإضافة طالب جديد."}
                    </TableCell>
                </TableRow>
             )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function StudentActions({ student, onStatusChange }: { student: Student, onStatusChange: (student: Student, status: StudentStatus, reason?: string) => void }) {
    const [isEditOpen, setEditOpen] = useState(false);
    const [actionReason, setActionReason] = useState('');

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button aria-haspopup="true" size="icon" variant="ghost">
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">قائمة الإجراءات</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuLabel>إجراءات</DropdownMenuLabel>
                <Dialog open={isEditOpen} onOpenChange={setEditOpen}>
                    <DialogTrigger asChild>
                         <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                            <FilePen className="ml-2 h-4 w-4" />
                            تعديل
                        </DropdownMenuItem>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[600px]">
                         <StudentForm 
                            student={student} 
                            onSuccess={() => setEditOpen(false)} 
                            onCancel={() => setEditOpen(false)}
                         />
                    </DialogContent>
                </Dialog>
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={(e) => {e.preventDefault(); setActionReason('')}}>
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
                         <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={(e) => {e.preventDefault(); setActionReason('')}}>
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
  const { addStudent, updateStudent } = useStudentContext();
  const [birthDate, setBirthDate] = useState<Date | undefined>(student?.birthDate ? new Date(student.birthDate) : undefined);
  const [registrationDate, setRegistrationDate] = useState<Date | undefined>(student?.registrationDate ? new Date(student.registrationDate) : new Date());

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries()) as any;

    if (!birthDate || !registrationDate) {
      // Handle error - dates are required
      return;
    }

    const studentData: Partial<Student> = {
        fullName: data.fullName,
        guardianName: data.guardianName,
        phone1: data.phone1,
        phone2: data.phone2,
        birthDate: birthDate,
        registrationDate: registrationDate,
        status: data.status,
        dailyMemorizationAmount: data.memorizationAmount,
        notes: data.notes,
    };

    if (student) {
        // Update existing student
        updateStudent(student.id, studentData, student.ownerId);
    } else {
        // Add new student
        addStudent(studentData as Omit<Student, 'id' | 'updatedAt' | 'memorizedSurahsCount' | 'ownerId'>);
    }
    
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>{student ? `تعديل بيانات: ${student.fullName}` : 'إضافة طالب جديد'}</DialogTitle>
        <DialogDescription>
          {student ? 'قم بتحديث معلومات الطالب هنا.' : 'املأ الحقول أدناه لإضافة طالب جديد إلى الفوج.'}
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto px-2">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">الاسم الكامل</Label>
            <Input name="fullName" id="fullName" defaultValue={student?.fullName} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="guardianName">اسم الولي (اختياري)</Label>
            <Input name="guardianName" id="guardianName" defaultValue={student?.guardianName} />
          </div>
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
        </div>
        <div className="space-y-2">
            <Label htmlFor="notes">ملاحظات عامة</Label>
            <Textarea name="notes" id="notes" defaultValue={student?.notes} placeholder="أي ملاحظات إضافية حول الطالب..." />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" type="button" onClick={onCancel}>إلغاء</Button>
        <Button type="submit">{student ? 'حفظ التغييرات' : 'إضافة طالب'}</Button>
      </DialogFooter>
    </form>
  );
}
