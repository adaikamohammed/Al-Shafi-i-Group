

"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, Loader2, CalendarIcon, MoreHorizontal, Edit, Trash2, ArrowUpCircle, Search, Filter, View, ArrowUpDown, User as UserIcon, UserRound, Phone, GraduationCap, GripVertical, Settings2, Lock, Unlock, Eye, EyeOff, Printer, ChevronsUpDown, Check, X } from 'lucide-react';
import { format, getYear, setYear, startOfYear, differenceInYears, isValid, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { v4 as uuidv4 } from 'uuid';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useStudentContext } from '@/context/StudentContext';
import { useAuth } from '@/context/AuthContext';
import type { Student, StudentStatus, PreRegistration, PreRegistrationStatus, AppUser } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useRouter } from 'next/navigation';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';


// 1. قائمة المشايخ الرسمية مرتبة (المرجع الأساسي)
const SHEIKHS_LIST = [
  { id: 1, name: "الشيخ زياد درويش", email: "admin1@gmail.com", group: "فوج الشيخ زياد درويش" },
  { id: 2, name: "الشيخ عبد الحميد", email: "admin2@gmail.com", group: "فوج الشيخ عبد الحميد" },
  { id: 3, name: "الشيخ فؤاد بن عمر", email: "admin3@gmail.com", group: "فوج الشيخ فؤاد بن عمر" },
  { id: 4, name: "الشيخ أحمد بن عمر", email: "admin4@gmail.com", group: "فوج الشيخ أحمد بن عمر" },
  { id: 5, name: "الشيخ إبراهيم مراد", email: "admin5@gmail.com", group: "فوج الشيخ إبراهيم مراد" },
  { id: 6, name: "الشيخ سفيان نصيرة", email: "admin6@gmail.com", group: "فوج الشيخ سفيان نصيرة" },
  { id: 7, name: "الشيخ محمد منصور", email: "admin7@gmail.com", group: "فوج الشيخ محمد منصور" },
  { id: 8, name: "الشيخ عبد الحق نصيرة", email: "admin8@gmail.com", group: "فوج الشيخ عبد الحق نصيرة" },
  { id: 9, name: "الشيخ صهيب نصيب", email: "admin9@gmail.com", group: "فوج الشيخ صهيب نصيب" }
];


const statusColors: Record<PreRegistrationStatus, string> = {
    "تم الإنضمام": "bg-green-100 dark:bg-green-900/30",
    "مرفوض": "bg-red-100 dark:bg-red-900/30",
    "مؤجل": "bg-yellow-100 dark:bg-yellow-900/30",
    "إنضم لمدرسة أخرى": "bg-blue-100 dark:bg-blue-900/30",
    "مرشح": "bg-orange-100 dark:bg-orange-900/30",
};

const statusHeaderColors: Record<PreRegistrationStatus, string> = {
    "تم الإنضمام": "bg-green-500",
    "مرفوض": "bg-red-500",
    "مؤجل": "bg-yellow-500",
    "إنضم لمدرسة أخرى": "bg-blue-500",
    "مرشح": "bg-orange-500",
};


const statusBadgeColors: Record<PreRegistrationStatus, string> = {
    "تم الإنضمام": "bg-green-100 text-green-800 border-green-300",
    "مرفوض": "bg-red-100 text-red-800 border-red-300",
    "مؤجل": "bg-yellow-100 text-yellow-800 border-yellow-300",
    "إنضم لمدرسة أخرى": "bg-blue-100 text-blue-800 border-blue-300",
    "مرشح": "bg-orange-100 text-orange-800 border-orange-300",
};

const educationalLevels = {
    "الطور الابتدائي": ["1 ابتدائي", "2 ابتدائي", "3 ابتدائي", "4 ابتدائي", "5 ابتدائي"],
    "الطور المتوسط": ["1 متوسط", "2 متوسط", "3 متوسط", "4 متوسط"],
    "الطور الثانوي": ["1 ثانوي", "2 ثانوي", "3 ثانوي", "بكالوريا"],
    "أخرى": ["روضة", "تحضيري", "جامعي", "متوقف عن الدراسة"]
};
const allEducationalLevels = Object.values(educationalLevels).flat();


const ALL_COLUMNS = {
    fullName: { label: "الإسم الكامل", visible: true, printOrder: 2 },
    gender: { label: "الجنس", visible: false, printOrder: 10 },
    birthDate: { label: "تاريخ الميلاد", visible: true, printOrder: 5 },
    educationalLevel: { label: "المستوى الدراسي", visible: true, printOrder: 4 },
    guardianName: { label: "إسم الولي", visible: false, printOrder: 6 },
    phone1: { label: "رقم الهاتف 1", visible: true, printOrder: 3 },
    phone2: { label: "رقم الهاتف 2", visible: false, printOrder: 7 },
    address: { label: "مقر السكن", visible: false, printOrder: 8 },
    status: { label: "الحالة", visible: true, printOrder: 9 },
    notes: { label: "ملاحظات", visible: true, printOrder: 11 },
    requestedAt: { label: "تاريخ التسجيل", visible: false, printOrder: 12 },
    pageNumber: { label: "رقم الصفحة", visible: true, printOrder: 1 },
    manualActions: { label: "الإجراءات / ملاحظات الإدارة", visible: false, printOrder: 99 },
};

const calculateAge = (birthDate?: Date | string) => {
    if (!birthDate) return 'غير محدد';
    try {
        const date = typeof birthDate === 'string' ? parseISO(birthDate) : birthDate;
        if (!isValid(date)) return 'تاريخ غير صالح';
        return differenceInYears(new Date(), date);
    } catch {
        return 'تاريخ غير صالح';
    }
};

const StudentProfileCard = ({ student, onEdit, isLocked }: { student: PreRegistration, onEdit: () => void, isLocked: boolean }) => {
    const headerColor = statusHeaderColors[student.status] || 'bg-gray-500';

    return (
        <DialogContent className="sm:max-w-2xl p-0">
             <DialogHeader className="p-6 pb-0">
                <DialogTitle className="sr-only">بطاقة الطالب: {student.fullName}</DialogTitle>
                <DialogDescription className="sr-only">عرض تفصيلي لبيانات الطالب.</DialogDescription>
            </DialogHeader>
            <div className={cn("p-6 rounded-t-lg text-white", headerColor)}>
                <div className="flex items-center gap-4">
                     <Avatar className="w-20 h-20 border-4 border-white/50">
                        <AvatarImage src={student.photoURL} />
                        <AvatarFallback className={cn((student as any).gender === 'أنثى' ? 'bg-pink-100 text-pink-600' : 'bg-blue-100 text-blue-600')}>
                            {(student as any).gender === 'أنثى' ? <UserRound /> : <UserIcon />}
                        </AvatarFallback>
                    </Avatar>
                    <div>
                        <h2 className="text-2xl font-bold">{student.fullName}</h2>
                        <div className="flex items-center gap-4 text-sm opacity-90">
                           <span>رقم الصفحة: {student.pageNumber || 'N/A'}</span>
                            <Badge variant="secondary">{student.status}</Badge>
                        </div>
                    </div>
                </div>
            </div>
             <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <h3 className="font-semibold mb-2 border-b pb-1">المعلومات الشخصية والتعليمية</h3>
                    <div className="space-y-2 text-sm">
                        <p><strong className="min-w-[100px] inline-block">تاريخ الميلاد:</strong> {student.birthDate instanceof Date && isValid(student.birthDate) ? format(student.birthDate, 'yyyy/MM/dd') : (student.birthDate ? student.birthDate.toString() : 'غير محدد')}</p>
                        <p><strong className="min-w-[100px] inline-block">العمر:</strong> {calculateAge(student.birthDate)} سنة</p>
                        <p><strong className="min-w-[100px] inline-block">الجنس:</strong> {student.gender || 'غير محدد'}</p>
                        <p><strong className="min-w-[100px] inline-block">المستوى الدراسي:</strong> {student.educationalLevel || 'غير محدد'}</p>
                    </div>
                </div>
                <div>
                     <h3 className="font-semibold mb-2 border-b pb-1">معلومات الاتصال</h3>
                    <div className="space-y-2 text-sm">
                         <p><strong className="min-w-[100px] inline-block">اسم الولي:</strong> {student.guardianName || 'غير محدد'}</p>
                         <p><strong className="min-w-[100px] inline-block">رقم الهاتف 1:</strong> {student.phone1}</p>
                         <p><strong className="min-w-[100px] inline-block">رقم الهاتف 2:</strong> {student.phone2 || 'لا يوجد'}</p>
                         <p><strong className="min-w-[100px] inline-block">مقر السكن:</strong> {student.address || 'غير محدد'}</p>
                    </div>
                </div>
                {(student.status === 'مرفوض' || student.status === 'مؤجل' || student.notes) && (
                    <div className="md:col-span-2">
                        <h3 className="font-semibold mb-2 border-b pb-1">{student.status === 'مرفوض' ? 'سبب الرفض' : student.status === 'مؤجل' ? 'سبب التأجيل' : 'ملاحظات'}</h3>
                        <div className="p-3 bg-muted rounded-md text-sm">
                            <p>{student.notes || 'لا توجد ملاحظات مسجلة.'}</p>
                        </div>
                    </div>
                )}
            </div>
             <DialogFooter>
                <Button variant="secondary" onClick={onEdit} disabled={isLocked}>تعديل</Button>
            </DialogFooter>
        </DialogContent>
    );
};

const QuickEduLevelSelector = ({ value, onChange }: { value: string, onChange: (value: string) => void }) => {
  return (
    <div className="space-y-3 rounded-lg border p-3">
      {Object.entries(educationalLevels).map(([phase, levels]) => (
        <div key={phase}>
          <Label className="text-xs font-semibold text-muted-foreground">{phase}</Label>
          <div className="flex flex-wrap gap-2 pt-1">
            {levels.map((level) => (
              <Button
                key={level}
                type="button"
                variant={value === level ? "default" : "outline"}
                size="sm"
                onClick={() => onChange(level)}
                className="flex-grow"
              >
                {level}
              </Button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};


function RegistrationForm({ onSave, onCancel, existingRegistration }: { onSave: (data: Partial<PreRegistration> & { photoFile?: File | null }) => void, onCancel: () => void, existingRegistration?: PreRegistration | null }) {
    const [birthDate, setBirthDate] = useState<Date | undefined>(existingRegistration?.birthDate && isValid(new Date(existingRegistration.birthDate)) ? new Date(existingRegistration.birthDate) : undefined);
    const [age, setAge] = useState<number | string>(existingRegistration && existingRegistration.birthDate && isValid(new Date(existingRegistration.birthDate)) ? differenceInYears(new Date(), new Date(existingRegistration.birthDate)) : '');
    const [status, setStatus] = useState<PreRegistrationStatus>(existingRegistration?.status || 'مرشح');
    const [notes, setNotes] = useState(existingRegistration?.notes || '');
    const [photoPreview, setPhotoPreview] = useState<string | null>(existingRegistration?.photoURL || null);
    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const [eduLevel, setEduLevel] = useState(existingRegistration?.educationalLevel || "");
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const {toast} = useToast();

    useEffect(() => {
        if (birthDate) {
            setAge(differenceInYears(new Date(), birthDate));
        }
    }, [birthDate]);

    const handleAgeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newAge = e.target.value;
        setAge(newAge);
        if (newAge && !isNaN(Number(newAge))) {
            const birthYear = getYear(new Date()) - Number(newAge);
            setBirthDate(startOfYear(setYear(new Date(), birthYear)));
        }
    };
    
    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const data = Object.fromEntries(formData.entries());
        onSave({ ...data, educationalLevel: eduLevel, birthDate, id: existingRegistration?.id, notes, photoFile });
    }
    
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

    const showReasonField = status === 'مرفوض' || status === 'مؤجل' || status === 'مرشح';
    let reasonLabel = "ملاحظات";
    if (status === 'مرفوض') reasonLabel = "سبب الرفض";
    if (status === 'مؤجل') reasonLabel = "سبب التأجيل";
    if (status === 'مرشح') reasonLabel = "سبب الترشيح / تفاصيل إضافية";

    return (
        <form onSubmit={handleSubmit}>
             <DialogHeader>
                <DialogTitle>{existingRegistration ? `تعديل طلب: ${existingRegistration.fullName}`: 'استمارة تسجيل أولي جديدة'}</DialogTitle>
                <DialogDescription>
                    {existingRegistration ? 'قم بتحديث بيانات الطالب هنا.' : 'املأ بيانات الطالب الجديد. حقل رقم الهاتف إلزامي.'}
                </DialogDescription>
            </DialogHeader>
            <div className="max-h-[60vh] overflow-y-auto p-4 space-y-4">
                 <div className="flex flex-col items-center gap-4">
                    <input type="file" ref={fileInputRef} onChange={handlePhotoChange} accept="image/png, image/jpeg" className="hidden" />
                     <Avatar className="w-24 h-24 mb-2 border-4 border-muted">
                        <AvatarImage src={photoPreview} />
                        <AvatarFallback className={cn(existingRegistration?.gender === 'أنثى' ? 'bg-pink-100 text-pink-600' : 'bg-blue-100 text-blue-600')}>
                             {(existingRegistration as any)?.gender === 'أنثى' ? <UserRound /> : <UserIcon />}
                        </AvatarFallback>
                    </Avatar>
                    <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>تغيير الصورة</Button>
                </div>
                
                <h4 className="font-semibold text-lg border-b pb-2">الأساسيات</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="fullName">الاسم الكامل *</Label>
                        <Input id="fullName" name="fullName" required defaultValue={existingRegistration?.fullName} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="pageNumber">رقم الصفحة</Label>
                        <Input id="pageNumber" name="pageNumber" defaultValue={existingRegistration?.pageNumber}/>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="gender">الجنس</Label>
                         <Select dir="rtl" name="gender" defaultValue={existingRegistration?.gender || "ذكر"}>
                            <SelectTrigger id="gender"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ذكر">ذكر</SelectItem>
                                <SelectItem value="أنثى">أنثى</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-2">
                            <Label htmlFor="age-input">العمر (اختياري)</Label>
                            <Input id="age-input" type="number" value={age} onChange={handleAgeChange} placeholder="مثال: 12"/>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="birthDate-popover">تاريخ الميلاد (اختياري)</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" id="birthDate-popover" className={cn("w-full justify-start text-left font-normal", !birthDate && "text-muted-foreground")}>
                                        <CalendarIcon className="ml-2 h-4 w-4" />
                                        {birthDate ? format(birthDate, "PPP", { locale: ar }) : <span>اختر تاريخًا</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar mode="single" selected={birthDate} onSelect={setBirthDate} captionLayout="dropdown-buttons" fromYear={1990} toYear={new Date().getFullYear()} initialFocus />
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>
                </div>

                <h4 className="font-semibold text-lg border-b pb-2 pt-4">الحالة والقرار</h4>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div className="space-y-2">
                        <Label htmlFor="status">الحالة</Label>
                        <Select dir="rtl" name="status" value={status} onValueChange={(value) => setStatus(value as PreRegistrationStatus)}>
                            <SelectTrigger id="status"><SelectValue /></SelectTrigger>
                            <SelectContent>
                               <SelectItem value="مرشح">مرشح</SelectItem>
                               <SelectItem value="تم الإنضمام">تم الإنضمام</SelectItem>
                               <SelectItem value="مرفوض">مرفوض</SelectItem>
                               <SelectItem value="مؤجل">مؤجل</SelectItem>
                               <SelectItem value="إنضم لمدرسة أخرى">إنضم لمدرسة أخرى</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    {showReasonField && (
                         <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="notes">{reasonLabel}</Label>
                            <Textarea id="notes" name="notes" placeholder="اكتب السبب هنا..." value={notes} onChange={(e) => setNotes(e.target.value)} />
                        </div>
                     )}
                 </div>

                <h4 className="font-semibold text-lg border-b pb-2 pt-4">التواصل والدراسة</h4>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div className="space-y-2 md:col-span-2">
                         <Label htmlFor="educationalLevel">المستوى الدراسي</Label>
                         <QuickEduLevelSelector value={eduLevel} onChange={setEduLevel} />
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="guardianName">اسم الولي</Label>
                        <Input id="guardianName" name="guardianName" defaultValue={existingRegistration?.guardianName}/>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="phone1">رقم الهاتف 1 *</Label>
                        <Input id="phone1" name="phone1" type="tel" required defaultValue={existingRegistration?.phone1}/>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="phone2">رقم الهاتف 2</Label>
                        <Input id="phone2" name="phone2" type="tel" defaultValue={existingRegistration?.phone2}/>
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="address">مقر السكن</Label>
                        <Input id="address" name="address" defaultValue={existingRegistration?.address}/>
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="notes-general">ملاحظات عامة</Label>
                        <Textarea id="notes-general" name="notes" defaultValue={existingRegistration?.notes} />
                    </div>
                 </div>

            </div>
            <DialogFooter className="pt-4 border-t">
                <Button type="button" variant="outline" onClick={onCancel}>إلغاء</Button>
                <Button type="submit">
                    {false ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <PlusCircle className="ml-2 h-4 w-4" />}
                    {existingRegistration ? 'حفظ التعديلات' : 'إضافة طلب تسجيل'}
                </Button>
            </DialogFooter>
        </form>
    );
}

const BulkEditModal = ({ open, onOpenChange, selectedCount, onSave }: { open: boolean, onOpenChange: (open: boolean) => void, selectedCount: number, onSave: (updateData: Partial<PreRegistration>) => void }) => {
    const [fieldsToUpdate, setFieldsToUpdate] = useState<Record<string, boolean>>({});
    const [updateData, setUpdateData] = useState<Partial<PreRegistration>>({});

    const handleFieldToggle = (field: keyof PreRegistration) => {
        setFieldsToUpdate(prev => ({ ...prev, [field]: !prev[field] }));
    };

    const handleInputChange = (field: keyof PreRegistration, value: any) => {
        setUpdateData(prev => ({ ...prev, [field]: value }));
    };
    
    const handleSave = () => {
        const finalUpdateData: Partial<PreRegistration> = {};
        for (const field in fieldsToUpdate) {
            if (fieldsToUpdate[field as keyof typeof fieldsToUpdate] && updateData[field as keyof PreRegistration] !== undefined) {
                finalUpdateData[field as keyof PreRegistration] = updateData[field as keyof PreRegistration];
            }
        }
        if (Object.keys(finalUpdateData).length > 0) {
            onSave(finalUpdateData);
        }
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>تعديل جماعي لـ {selectedCount} طلاب</DialogTitle>
                    <DialogDescription>
                        حدد الحقول التي تريد تحديثها وأدخل القيمة الجديدة. سيتم تطبيق التغييرات على جميع الطلاب المحددين.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="flex items-center gap-4">
                        <Checkbox id="update-status" checked={!!fieldsToUpdate.status} onCheckedChange={() => handleFieldToggle('status')} />
                        <div className="grid gap-1.5 leading-none w-full">
                            <Label htmlFor="status-select" className={cn(!fieldsToUpdate.status && "text-muted-foreground")}>الحالة</Label>
                            <Select dir="rtl" name="status" disabled={!fieldsToUpdate.status} onValueChange={(val) => handleInputChange('status', val)}>
                                <SelectTrigger id="status-select"><SelectValue placeholder="اختر الحالة الجديدة" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="مرشح">مرشح</SelectItem>
                                    <SelectItem value="مرفوض">مرفوض</SelectItem>
                                    <SelectItem value="مؤجل">مؤجل</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <Checkbox id="update-level" checked={!!fieldsToUpdate.educationalLevel} onCheckedChange={() => handleFieldToggle('educationalLevel')} />
                         <div className="grid gap-1.5 leading-none w-full">
                            <Label htmlFor="edu-level-combobox" className={cn(!fieldsToUpdate.educationalLevel && "text-muted-foreground")}>المستوى الدراسي</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                <Button variant="outline" role="combobox" className="w-full justify-between" disabled={!fieldsToUpdate.educationalLevel}>
                                    {updateData.educationalLevel ? allEducationalLevels.find(level => level === updateData.educationalLevel) : "اختر المستوى..."}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                <Command>
                                    <CommandInput placeholder="ابحث عن مستوى..." />
                                    <CommandEmpty>لم يتم العثور على مستوى.</CommandEmpty>
                                    <CommandList>
                                        {Object.entries(educationalLevels).map(([group, levels]) => (
                                             <CommandGroup key={group} heading={group}>
                                                {levels.map(level => (
                                                    <CommandItem
                                                    key={level}
                                                    value={level}
                                                    onSelect={(currentValue) => {
                                                        handleInputChange('educationalLevel', currentValue === updateData.educationalLevel ? "" : currentValue);
                                                    }}
                                                    >
                                                    <Check className={cn("mr-2 h-4 w-4", updateData.educationalLevel === level ? "opacity-100" : "opacity-0")} />
                                                    {level}
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        ))}
                                    </CommandList>
                                </Command>
                                </PopoverContent>
                            </Popover>
                         </div>
                    </div>
                     <div className="flex items-center gap-4">
                        <Checkbox id="update-notes" checked={!!fieldsToUpdate.notes} onCheckedChange={() => handleFieldToggle('notes')} />
                        <div className="grid gap-1.5 leading-none w-full">
                             <Label htmlFor="notes-input" className={cn(!fieldsToUpdate.notes && "text-muted-foreground")}>سبب/ملاحظات</Label>
                            <Input id="notes-input" disabled={!fieldsToUpdate.notes} onChange={(e) => handleInputChange('notes', e.target.value)} placeholder="سبب الرفض أو التأجيل..." />
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
                    <Button onClick={handleSave}>تطبيق التغييرات</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};


export default function PreRegistrationPage() {
    const { toast } = useToast();
    const { addStudent, preRegistrations, loading, updatePreRegistration, deleteMultiplePreRegistrations, bulkUpdatePreRegistrations, allUsers } = useStudentContext();
    const [isFormOpen, setFormOpen] = useState(false);
    const [editingRegistration, setEditingRegistration] = useState<PreRegistration | null>(null);
    const [selectedStudent, setSelectedStudent] = useState<PreRegistration | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [levelFilter, setLevelFilter] = useState<string[]>([]);
    const [statusFilter, setStatusFilter] = useState<string[]>([]);
    const [genderFilter, setGenderFilter] = useState('all');
    const [selectedRows, setSelectedRows] = useState<string[]>([]);
    const [isBulkEditOpen, setBulkEditOpen] = useState(false);
    const [isPrintModalOpen, setPrintModalOpen] = useState(false);
    
    const [accessLevel, setAccessLevel] = useState<'hidden' | 'view_only' | 'unlocked'>('hidden');
    const [isAccessModalOpen, setIsAccessModalOpen] = useState(false);
    const [accessCode, setAccessCode] = useState('');
    
    const [sortConfig, setSortConfig] = useState<{ key: keyof PreRegistration; direction: 'ascending' | 'descending' }>({ key: 'pageNumber', direction: 'ascending' });
    
    const [pendingDeletion, setPendingDeletion] = useState<string[]>([]);
    const undoTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const [columnVisibility, setColumnVisibility] = useState(() => {
        const saved = typeof window !== 'undefined' ? localStorage.getItem('preRegColumnVisibility') : null;
        let initialVisibility = { ...ALL_COLUMNS };
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                 Object.keys(initialVisibility).forEach(key => {
                    const savedColumn = parsed[key as keyof typeof ALL_COLUMNS];
                    if (savedColumn && typeof savedColumn.visible === 'boolean') {
                        (initialVisibility[key as keyof typeof ALL_COLUMNS] as any).visible = savedColumn.visible;
                    }
                });
            } catch (e) {
                console.error("Failed to parse column visibility from localStorage", e);
            }
        }
        return initialVisibility;
    });

    const isLocked = accessLevel !== 'unlocked';
    
    const sheikhs = useMemo(() => allUsers.filter(u => u.role === 'sheikh'), [allUsers]);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('preRegColumnVisibility', JSON.stringify(columnVisibility));
        }
    }, [columnVisibility]);

    useEffect(() => {
        return () => {
            if (undoTimeoutRef.current) {
                clearTimeout(undoTimeoutRef.current);
            }
        };
    }, []);

    const handleAccessCodeSubmit = () => {
        if (accessCode === 'admin8888') {
            setAccessLevel('unlocked');
            toast({ title: '✅ تم الدخول بصلاحيات المدير', description: 'تم عرض البيانات وفتح وضع التعديل.' });
        } else if (accessCode === 'adaika8888') {
            setAccessLevel('view_only');
            toast({ title: '✅ تم عرض البيانات', description: 'البيانات الآن ظاهرة. وضع التعديل مقفل.' });
        } else {
            toast({ title: '❌ خطأ', description: 'كود الوصول غير صحيح.', variant: 'destructive' });
        }
        setIsAccessModalOpen(false);
        setAccessCode('');
    };

    const toggleColumn = (key: keyof typeof ALL_COLUMNS) => {
        setColumnVisibility((prev) => {
            const newVisibility = { ...prev };
            const currentColumn = newVisibility[key as keyof typeof newVisibility];
            if(currentColumn) {
                currentColumn.visible = !currentColumn.visible;
            }
            return newVisibility;
        });
    };
    
    const handlePrint = () => {
        const originalTitle = document.title;
        document.title = "التسجيلات الأولية - " + new Date().toLocaleString('ar-DZ', {year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hour12: false}).replace(',', '');
        
        const onAfterPrint = () => {
            document.title = originalTitle;
            window.removeEventListener('afterprint', onAfterPrint);
        };
        window.addEventListener('afterprint', onAfterPrint);

        setTimeout(() => window.print(), 100);
    };

    const filteredRegistrations = useMemo(() => {
        const lowercasedFilter = searchTerm.toLowerCase();

        const filtered = (preRegistrations ?? [])
            .filter(reg => !pendingDeletion.includes(reg.id)) // Filter out pending deletions
            .filter(reg => {
                const searchMatch = !searchTerm || (
                    reg.fullName?.toLowerCase().includes(lowercasedFilter) ||
                    reg.guardianName?.toLowerCase().includes(lowercasedFilter) ||
                    reg.phone1?.toLowerCase().includes(lowercasedFilter) ||
                    reg.phone2?.toLowerCase().includes(lowercasedFilter) ||
                    reg.notes?.toLowerCase().includes(lowercasedFilter)
                );
                const levelMatch = levelFilter.length === 0 || (reg.educationalLevel && levelFilter.includes(reg.educationalLevel));
                const statusMatch = statusFilter.length === 0 || statusFilter.includes(reg.status);
                const genderMatch = genderFilter === 'all' || reg.gender === genderFilter;

                return searchMatch && levelMatch && statusMatch && genderMatch;
            });
            
        return filtered.sort((a, b) => {
            if (sortConfig.key === 'pageNumber') {
                 const pageNumA = a.pageNumber ? parseInt(a.pageNumber, 10) : Infinity;
                 const pageNumB = b.pageNumber ? parseInt(b.pageNumber, 10) : Infinity;
                 
                 let comparison = 0;
                 if (!isNaN(pageNumA) && !isNaN(pageNumB)) {
                    comparison = pageNumA - pageNumB;
                 } else if (!isNaN(pageNumA)) {
                    comparison = -1;
                 } else if (!isNaN(pageNumB)) {
                    comparison = 1;
                 }
                 
                 return sortConfig.direction === 'ascending' ? comparison : -comparison;
            }
             
            const dateA = a.requestedAt instanceof Date ? a.requestedAt.getTime() : (typeof a.requestedAt === 'string' ? parseISO(a.requestedAt).getTime() : 0);
            const dateB = b.requestedAt instanceof Date ? b.requestedAt.getTime() : (typeof b.requestedAt === 'string' ? parseISO(b.requestedAt).getTime() : 0);
            
            if(isNaN(dateA) || isNaN(dateB)) return 0;
            
            return sortConfig.direction === 'ascending' ? dateB - dateA : dateA - dateB;
        });

    }, [preRegistrations, searchTerm, levelFilter, statusFilter, genderFilter, sortConfig, pendingDeletion]);
    
    const requestSort = (key: keyof PreRegistration) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    }

    const handleSaveRegistration = (data: Partial<PreRegistration> & { photoFile?: File | null }) => {
        if (!data.fullName || !data.phone1) {
            toast({ title: "خطأ", description: "الرجاء ملء جميع الحقول الإلزامية (الاسم الكامل والهاتف).", variant: "destructive" });
            return;
        }

        updatePreRegistration(data.id || uuidv4(), data, !!data.id);
        
        setFormOpen(false);
        setEditingRegistration(null);
    }
    
    const handleEdit = (reg: PreRegistration) => {
        setSelectedStudent(null);
        setEditingRegistration(reg);
        setFormOpen(true);
    }
    
    const handleInitiateBulkDelete = () => {
        if (undoTimeoutRef.current) {
            clearTimeout(undoTimeoutRef.current);
        }

        const itemsToDelete = [...selectedRows];
        setPendingDeletion(prev => [...prev, ...itemsToDelete]);
        setSelectedRows([]);

        toast({
            title: `تم حذف ${itemsToDelete.length} تسجيل مؤقتاً`,
            description: "سيتم الحذف النهائي بعد 10 ثواني.",
            action: (
                <Button variant="secondary" onClick={() => {
                    setPendingDeletion(prev => prev.filter(id => !itemsToDelete.includes(id)));
                    if (undoTimeoutRef.current) {
                        clearTimeout(undoTimeoutRef.current);
                        undoTimeoutRef.current = null;
                    }
                    toast({title: '✅ تم التراجع عن الحذف'});
                }}>
                    تراجع
                </Button>
            ),
            duration: 10000,
        });

        undoTimeoutRef.current = setTimeout(() => {
            setPendingDeletion(prev => {
                const finalToDelete = prev.filter(id => itemsToDelete.includes(id));
                if (finalToDelete.length > 0) {
                    deleteMultiplePreRegistrations(finalToDelete);
                }
                return prev.filter(id => !itemsToDelete.includes(id));
            });
            undoTimeoutRef.current = null;
        }, 10000);
    };
    
    const handleBulkEditSave = (updateData: Partial<PreRegistration>) => {
        bulkUpdatePreRegistrations(selectedRows, updateData);
        setSelectedRows([]);
    };
    
    const columnsToRender = useMemo(() => {
        const forcedOrder = ['pageNumber', 'fullName'];
        const manualActionsKey = 'manualActions';

        // Filter visible columns and separate forced, manual, and others
        const visibleEntries = Object.entries(columnVisibility).filter(([, { visible }]) => visible);

        const forced = forcedOrder.map(key => visibleEntries.find(([k]) => k === key)).filter(Boolean) as [string, { label: string; visible: boolean; printOrder: number }][];
        const manualActions = visibleEntries.find(([k]) => k === manualActionsKey);
        const others = visibleEntries
            .filter(([k]) => !forcedOrder.includes(k) && k !== manualActionsKey)
            .sort(([, a], [, b]) => (a.printOrder || 99) - (b.printOrder || 99));

        let finalOrder = [...forced, ...others];
        if (manualActions) {
            finalOrder.push(manualActions);
        }
        
        return finalOrder;
    }, [columnVisibility]);

    
    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }

    const accessLevelConfig = {
        hidden: {
            color: "bg-gray-100 border-gray-300",
            icon: <EyeOff className="h-5 w-5" />,
            text: ""
        },
        view_only: {
            color: "bg-yellow-100 border-yellow-300",
            icon: <Lock className="h-5 w-5 text-yellow-700"/>,
            text: "الصفحة مقفلة - عرض فقط"
        },
        unlocked: {
            color: "bg-green-100 border-green-300",
            icon: <Unlock className="h-5 w-5 text-green-700"/>,
            text: "تم فتح وضع التعديل"
        }
    }
    const currentAccess = accessLevelConfig[accessLevel];
    
    const statusOptions: PreRegistrationStatus[] = ["مرشح", "تم الإنضمام", "مرفوض", "مؤجل", "إنضم لمدرسة أخرى"];

    return (
        <div className="space-y-6">
             <Card className={cn("sticky top-0 z-40 transition-colors print-hidden", currentAccess.color)}>
                <CardContent className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => setIsAccessModalOpen(true)}>
                           {currentAccess.icon}
                        </Button>
                        <div className="font-semibold hidden sm:inline">{currentAccess.text}</div>
                    </div>
                    {accessLevel === 'unlocked' ? (
                        <Button variant="secondary" onClick={() => setAccessLevel('view_only')}>إعادة قفل التعديل</Button>
                    ) : (
                        <Button onClick={() => setIsAccessModalOpen(true)}>فتح الصلاحيات</Button>
                    )}
                </CardContent>
            </Card>
            
             <Dialog open={isAccessModalOpen} onOpenChange={setIsAccessModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>الوصول إلى البيانات</DialogTitle>
                        <DialogDescription>
                            البيانات محمية. يرجى إدخال كود الوصول المناسب.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2 py-4">
                        <Label htmlFor="access-code">كود الوصول</Label>
                        <Input 
                            id="access-code" 
                            type="password"
                            value={accessCode}
                            onChange={(e) => setAccessCode(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAccessCodeSubmit()}
                        />
                         <p className="text-xs text-muted-foreground pt-2">
                            استخدم كود العرض لإظهار البيانات، أو كود الإدارة للوصول الكامل.
                        </p>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAccessModalOpen(false)}>إلغاء</Button>
                        <Button onClick={handleAccessCodeSubmit}>تأكيد</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Card className="print-hidden">
                <CardHeader>
                    <CardTitle className="text-3xl font-headline font-bold">إدارة التسجيلات الجديدة</CardTitle>
                    <CardDescription>
                        استقبل طلبات التسجيل الجديدة، قم بفلترتها، ومعالجتها. يمكنك الموافقة على الطلب ونقله إلى فوج، أو رفضه.
                    </CardDescription>
                </CardHeader>
                 <CardContent>
                     <Button onClick={() => { setEditingRegistration(null); setFormOpen(true); }} disabled={isLocked}>
                        <PlusCircle className="ml-2 h-4 w-4" /> إضافة طلب تسجيل يدوي
                     </Button>
                </CardContent>
            </Card>

            <Dialog open={isFormOpen} onOpenChange={(open) => {
                setFormOpen(open);
                if (!open) setEditingRegistration(null);
            }}>
                <DialogContent className="sm:max-w-2xl">
                    <RegistrationForm onSave={handleSaveRegistration} onCancel={() => setFormOpen(false)} existingRegistration={editingRegistration}/>
                </DialogContent>
            </Dialog>
            
            {selectedStudent && (
                 <Dialog open={!!selectedStudent} onOpenChange={(isOpen) => !isOpen && setSelectedStudent(null)}>
                    <StudentProfileCard 
                        student={selectedStudent} 
                        onEdit={() => handleEdit(selectedStudent)}
                        isLocked={isLocked}
                    />
                </Dialog>
            )}
            
            <BulkEditModal 
                open={isBulkEditOpen}
                onOpenChange={setBulkEditOpen}
                selectedCount={selectedRows.length}
                onSave={handleBulkEditSave}
            />

            {accessLevel !== 'hidden' ? (
                <>
                    <Card className="print-hidden">
                        <CardHeader>
                            <CardTitle>أدوات الفلترة والبحث</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 space-y-4">
                             <div className="flex flex-wrap items-center gap-2">
                                {statusOptions.map(status => (
                                    <Button key={status} variant={statusFilter.includes(status) ? 'default' : 'outline'} className={cn(statusFilter.includes(status) && statusBadgeColors[status])} onClick={() => {
                                        setStatusFilter(prev => prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status])
                                    }}>{status}</Button>
                                ))}
                                {statusFilter.length > 0 && <Button variant="ghost" size="sm" onClick={() => setStatusFilter([])}>إلغاء الكل <X className="h-4 w-4 mr-1"/></Button>}
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <div className="relative flex-grow sm:flex-grow-0">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="بحث شامل..."
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
                                        <DropdownMenuSeparator />
                                        {Object.entries(educationalLevels).map(([group, levels]) => (
                                            <React.Fragment key={group}>
                                                <DropdownMenuLabel className="px-1 text-xs font-bold text-muted-foreground">{group}</DropdownMenuLabel>
                                                {levels.map(level => (
                                                    <DropdownMenuCheckboxItem
                                                        key={level}
                                                        checked={levelFilter.includes(level)}
                                                        onCheckedChange={(checked) => {
                                                            if (checked) {
                                                                setLevelFilter(prev => [...prev, level]);
                                                            } else {
                                                                setLevelFilter(prev => prev.filter(l => l !== level));
                                                            }
                                                        }}
                                                    >
                                                        {level}
                                                    </DropdownMenuCheckboxItem>
                                                ))}
                                            </React.Fragment>
                                        ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                                
                                <Select dir="rtl" value={genderFilter} onValueChange={setGenderFilter}>
                                    <SelectTrigger className="w-full flex-grow sm:w-[150px]">
                                        <SelectValue placeholder="الجنس" />
                                    </SelectTrigger>
                                    <SelectContent>
                                    <SelectItem value="all">الكل</SelectItem>
                                    <SelectItem value="ذكر">ذكر</SelectItem>
                                    <SelectItem value="أنثى">أنثى</SelectItem>
                                    </SelectContent>
                                </Select>
                                 <Button variant="outline" onClick={() => setPrintModalOpen(true)}>
                                    <Printer className="ml-2 h-4 w-4" /> طباعة التقرير المفلتر
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                    
                    <Card className="print-hidden">
                        <CardHeader>
                            <CardTitle>عرض الأعمدة</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                                {Object.keys(ALL_COLUMNS).map((key) => {
                                     const col = ALL_COLUMNS[key as keyof typeof ALL_COLUMNS];
                                     if (!col) return null;
                                     return (
                                        <div key={key} className="flex items-center space-x-2 space-x-reverse">
                                            <Checkbox
                                                id={`col-${key}`}
                                                checked={columnVisibility[key as keyof typeof columnVisibility]?.visible ?? false}
                                                onCheckedChange={() => toggleColumn(key as keyof typeof ALL_COLUMNS)}
                                            />
                                            <label
                                                htmlFor={`col-${key}`}
                                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                            >
                                                {col.label}
                                            </label>
                                        </div>
                                    )
                                })}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className={cn('transition-all print-container', !isLocked && 'border-green-500 ring-2 ring-green-500/20')}>
                        <CardHeader className="print-header">
                            <CardTitle>قائمة طلبات التسجيل ({filteredRegistrations.length})</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="relative w-full overflow-x-auto">
                                <Table id="print-table">
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[50px] px-2 print-hidden">
                                                <Checkbox
                                                    checked={selectedRows.length > 0 && selectedRows.length === filteredRegistrations.length && filteredRegistrations.length > 0}
                                                    onCheckedChange={(checked) => {
                                                        if (checked) {
                                                            setSelectedRows(filteredRegistrations.map(r => r.id));
                                                        } else {
                                                            setSelectedRows([]);
                                                        }
                                                    }}
                                                    aria-label="Select all"
                                                    disabled={isLocked}
                                                />
                                            </TableHead>
                                            <TableHead className="w-[80px] p-2 print-hidden">
                                                <Button variant="ghost" onClick={() => requestSort('pageNumber')} className="px-2">
                                                    الهوية
                                                    <ArrowUpDown className="mr-2 h-4 w-4" />
                                                </Button>
                                            </TableHead>
                                            {columnsToRender.map(([key, { label }]) => (
                                                <TableHead key={key} className="text-center p-2">
                                                    <Button variant="ghost" onClick={() => requestSort(key as keyof PreRegistration)}>
                                                        {label}
                                                        <ArrowUpDown className="mr-2 h-4 w-4" />
                                                    </Button>
                                                </TableHead>
                                            ))}
                                            <TableHead className="text-center print-hidden">إجراءات</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredRegistrations.length > 0 ? filteredRegistrations.map(reg => (
                                            <TableRow 
                                                key={reg.id} 
                                                className={cn("cursor-pointer", statusColors[reg.status])} 
                                                onClick={() => setSelectedStudent(reg)}
                                                data-state={selectedRows.includes(reg.id) && "selected"}
                                            >
                                                <TableCell className="px-2 print-hidden" onClick={(e) => e.stopPropagation()}>
                                                    <Checkbox
                                                        checked={selectedRows.includes(reg.id)}
                                                        onCheckedChange={(checked) => {
                                                            if (checked) {
                                                                setSelectedRows(prev => [...prev, reg.id]);
                                                            } else {
                                                                setSelectedRows(prev => prev.filter(id => id !== reg.id));
                                                            }
                                                        }}
                                                        aria-label="Select row"
                                                        disabled={isLocked}
                                                    />
                                                </TableCell>
                                                <TableCell className="p-2 print-hidden">
                                                    <div className="flex flex-col items-center gap-1">
                                                        <Avatar className="w-10 h-10">
                                                            <AvatarImage src={reg.photoURL} />
                                                            <AvatarFallback className={cn(reg.gender === 'أنثى' ? 'bg-pink-100 text-pink-600' : 'bg-blue-100 text-blue-600')}>
                                                                {reg.gender === 'أنثى' ? <UserRound /> : <UserIcon />}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        
                                                    </div>
                                                </TableCell>
                                                {columnsToRender.map(([key]) => {
                                                    const value = reg[key as keyof PreRegistration];
                                                    let content: React.ReactNode = value as string;
                                                    if (key === 'status') {
                                                        content = <Badge variant="outline" className={cn("border", statusBadgeColors[value as PreRegistrationStatus])}>{value as string}</Badge>;
                                                    } else if (key === 'birthDate' || key === 'requestedAt') {
                                                        content = value instanceof Date && isValid(value) ? format(value, 'yyyy/MM/dd') : (value ? value.toString() : 'غير محدد');
                                                    } else if (key === 'fullName') {
                                                        content = <span className="font-medium">{value as string}</span>;
                                                    } else if (key === 'notes') {
                                                        content = <span className="max-w-[200px] truncate block">{value as string}</span>;
                                                    } else if (key === 'manualActions') {
                                                        content = <div className="print-only-td"></div>
                                                    }
                                                    return <TableCell key={key} className="text-center p-2">{content}</TableCell>;
                                                })}
                                                <TableCell className="text-center print-hidden" onClick={(e) => e.stopPropagation()}>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon" disabled={isLocked}><MoreHorizontal className="h-4 w-4" /></Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent>
                                                            <DropdownMenuItem onClick={() => handleEdit(reg)}>
                                                                <Edit className="ml-2 h-4 w-4" /> تعديل
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            </TableRow>
                                        )) : (
                                            <TableRow>
                                                <TableCell colSpan={columnsToRender.length + 3} className="text-center h-24">
                                                    {searchTerm || levelFilter.length > 0 || statusFilter.length > 0 || genderFilter !== 'all'
                                                        ? 'لم يتم العثور على نتائج مطابقة للبحث.'
                                                        : 'لا توجد طلبات تسجيل جديدة في الوقت الحالي.'
                                                    }
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </>
            ) : (
                <Card className="flex flex-col items-center justify-center min-h-[300px] border-dashed print-hidden">
                    <CardHeader className="text-center">
                        <EyeOff className="mx-auto h-12 w-12 text-muted-foreground" />
                        <CardTitle>البيانات مخفية</CardTitle>
                        <CardDescription>لدواعي الخصوصية، يرجى إدخال كود الوصول لعرض البيانات.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button onClick={() => setIsAccessModalOpen(true)}>
                            <Eye className="ml-2 h-4 w-4" />
                            إظهار البيانات
                        </Button>
                    </CardContent>
                </Card>
            )}
            
            {accessLevel === 'unlocked' && selectedRows.length > 0 && (
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 border-t shadow-lg z-50 print-hidden">
                    <div className="container mx-auto flex justify-between items-center">
                        <p className="font-semibold">{selectedRows.length} طلاب محددون</p>
                        <div className="flex gap-2">
                             <Button variant="outline" onClick={() => setSelectedRows([])} disabled={isLocked}>إلغاء التحديد</Button>
                             <Button onClick={() => setBulkEditOpen(true)} disabled={isLocked}><Settings2 className="ml-2 h-4 w-4" /> تعديل جماعي</Button>
                             <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive" disabled={isLocked}><Trash2 className="ml-2 h-4 w-4" /> حذف المحدد</Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            سيؤدي هذا إلى حذف {selectedRows.length} تسجيل(ات) نهائياً.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleInitiateBulkDelete}>تأكيد الحذف</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    </div>
                </div>
            )}
            
             {/* Print Modal */}
            <Dialog open={isPrintModalOpen} onOpenChange={setPrintModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>إعدادات طباعة التقرير</DialogTitle>
                        <DialogDescription>
                            اختر الأعمدة التي ترغب في تضمينها في التقرير المطبوع. سيتم طباعة الصفوف المفلترة حاليًا فقط.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-4 py-4">
                        {Object.entries(ALL_COLUMNS).map(([key, {label}]) => {
                             if (!label) return null;
                             return (
                                <div key={key} className="flex items-center space-x-2 space-x-reverse">
                                    <Checkbox
                                        id={`print-col-${key}`}
                                        checked={(columnVisibility as any)[key]?.visible ?? false}
                                        onCheckedChange={(checked) => {
                                            setColumnVisibility(prev => ({...prev, [key]: {...(prev as any)[key], visible: !!checked}}));
                                        }}
                                    />
                                    <label
                                        htmlFor={`print-col-${key}`}
                                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                    >
                                        {label}
                                    </label>
                                </div>
                            )
                        })}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setPrintModalOpen(false)}>إلغاء</Button>
                        <Button onClick={() => { handlePrint(); setPrintModalOpen(false); }}>
                            <Printer className="ml-2 h-4 w-4" />
                            اطبع الآن
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Print Styles */}
            <style jsx global>{`
                @page {
                    size: A4 landscape;
                    margin: 1cm;
                }
                @media print {
                    body {
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    .print-container {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        border: none !important;
                        box-shadow: none !important;
                        ring-width: 0 !important;
                    }
                    .print-header {
                        display: block !important;
                        text-align: center;
                        margin-bottom: 1rem;
                    }
                    .print-hidden {
                        display: none !important;
                    }
                     .print-only-td {
                        display: table-cell !important;
                        width: 3cm !important;
                        min-width: 3cm !important;
                    }
                    #print-table {
                        width: 100% !important;
                        table-layout: auto !important;
                        border-collapse: collapse;
                        background-color: white !important;
                    }
                    #print-table th, #print-table td {
                        border: 0.5pt solid black !important;
                        padding: 4px 6px !important;
                        background-color: white !important;
                        color: black !important;
                        box-shadow: none !important;
                    }
                    #print-table thead {
                        display: table-header-group !important;
                    }
                     #print-table tbody {
                        display: table-row-group !important;
                    }
                    #print-table tr {
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                    }
                    #print-table th {
                        font-weight: bold;
                        background-color: #f2f2f2 !important;
                    }
                }
            `}</style>
        </div>
    );
}







