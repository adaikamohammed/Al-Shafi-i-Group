"use client";

import React, { useState } from 'react';
import { PlusCircle, MoreHorizontal, FilePen, Trash2, UserX } from 'lucide-react';
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
import { students as mockStudents } from '@/lib/data';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

const statusVariant: { [key in StudentStatus]: "default" | "destructive" | "secondary" } = {
  "نشط": "default",
  "مطرود": "destructive",
  "غائب طويل": "secondary",
};

const calculateAge = (birthDate: Date) => {
  const ageDifMs = Date.now() - new Date(birthDate).getTime();
  const ageDate = new Date(ageDifMs);
  return Math.abs(ageDate.getUTCFullYear() - 1970);
};

export default function StudentManagementPage() {
  const [students, setStudents] = useState<Student[]>(mockStudents);
  const [isAddStudentDialogOpen, setAddStudentDialogOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-headline font-bold">إدارة الطلبة</h1>
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

      <Card>
        <CardHeader>
          <CardTitle>قائمة الطلبة</CardTitle>
          <CardDescription>فوج الشيخ أحمد بن عمر</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الاسم الكامل</TableHead>
                <TableHead className="hidden md:table-cell">اسم الولي</TableHead>
                <TableHead className="hidden lg:table-cell">العمر</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead className="hidden md:table-cell">السور المحفوظة</TableHead>
                <TableHead>
                  <span className="sr-only">إجراءات</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((student) => (
                <TableRow key={student.id}>
                  <TableCell className="font-medium">{student.fullName}</TableCell>
                  <TableCell className="hidden md:table-cell">{student.guardianName}</TableCell>
                  <TableCell className="hidden lg:table-cell">{calculateAge(student.birthDate)}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[student.status]}>{student.status}</Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{student.memorizedSurahsCount}</TableCell>
                  <TableCell>
                    <StudentActions student={student} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function StudentActions({ student }: { student: Student }) {
    const [isEditOpen, setEditOpen] = useState(false);

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
                        <DropdownMenuItem className="text-destructive focus:text-destructive">
                            <Trash2 className="ml-2 h-4 w-4" />
                            حذف
                        </DropdownMenuItem>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>هل أنت متأكد تمامًا؟</AlertDialogTitle>
                            <AlertDialogDescription>
                                هذا الإجراء لا يمكن التراجع عنه. سيؤدي هذا إلى حذف بيانات الطالب بشكل دائم من خوادمنا.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>إلغاء</AlertDialogCancel>
                            <AlertDialogAction>متابعة</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
                <AlertDialog>
                     <AlertDialogTrigger asChild>
                         <DropdownMenuItem className="text-destructive focus:text-destructive">
                            <UserX className="ml-2 h-4 w-4" />
                            طرد
                        </DropdownMenuItem>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>طرد الطالب {student.fullName}</AlertDialogTitle>
                            <AlertDialogDescription>
                                الرجاء إدخال سبب الطرد. سيتم تسجيل هذا في سجل الطالب.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <div className="py-4">
                            <Label htmlFor="expel-reason">سبب الطرد</Label>
                            <Textarea id="expel-reason" placeholder="مثال: غياب متكرر بدون عذر..." />
                        </div>
                        <AlertDialogFooter>
                            <AlertDialogCancel>إلغاء</AlertDialogCancel>
                            <AlertDialogAction>تأكيد الطرد</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function StudentForm({ student, onSuccess, onCancel }: { student?: Student, onSuccess: () => void, onCancel: () => void }) {
  const [birthDate, setBirthDate] = useState<Date | undefined>(student?.birthDate);
  const [registrationDate, setRegistrationDate] = useState<Date | undefined>(student?.registrationDate);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Logic to add/update student
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
            <Input id="fullName" defaultValue={student?.fullName} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="guardianName">اسم الولي</Label>
            <Input id="guardianName" defaultValue={student?.guardianName} required />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="phone1">رقم الهاتف 1</Label>
            <Input id="phone1" type="tel" defaultValue={student?.phone1} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone2">رقم الهاتف 2 (اختياري)</Label>
            <Input id="phone2" type="tel" defaultValue={student?.phone2} />
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
                        fromYear={new Date().getFullYear() - 20}
                        toYear={new Date().getFullYear() - 5}
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
                <Select dir="rtl" defaultValue={student?.status}>
                    <SelectTrigger id="status">
                        <SelectValue placeholder="اختر الحالة" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="نشط">✅ نشط</SelectItem>
                        <SelectItem value="مطرود">❌ مطرود</SelectItem>
                        <SelectItem value="غائب طويل">⚠️ غائب طويل</SelectItem>
                    </SelectContent>
                </Select>
            </div>
             <div className="space-y-2">
                <Label htmlFor="memorizationAmount">مقدار الحفظ اليومي</Label>
                <Select dir="rtl" defaultValue={student?.dailyMemorizationAmount}>
                    <SelectTrigger id="memorizationAmount">
                        <SelectValue placeholder="اختر المقدار" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ثمن">ثمن</SelectItem>
                        <SelectItem value="ربع">ربع</SelectItem>
                        <SelectItem value="نصف">نصف</SelectItem>
                        <SelectItem value="صفحة">صفحة</SelectItem>
                        <SelectItem value="أكثر">أكثر</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </div>
        <div className="space-y-2">
            <Label htmlFor="notes">ملاحظات عامة</Label>
            <Textarea id="notes" defaultValue={student?.notes} placeholder="أي ملاحظات إضافية حول الطالب..." />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" type="button" onClick={onCancel}>إلغاء</Button>
        <Button type="submit">{student ? 'حفظ التغييرات' : 'إضافة طالب'}</Button>
      </DialogFooter>
    </form>
  );
}
