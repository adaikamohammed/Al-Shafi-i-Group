

"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, Loader2, CalendarIcon, MoreHorizontal, Edit, Trash2, ArrowUpCircle, Search, Filter, View, ArrowUpDown, User as UserIcon, UserRound, Phone, GraduationCap, GripVertical, Settings2, Lock, Unlock, Eye, EyeOff } from 'lucide-react';
import { format, getYear, setYear, startOfYear, differenceInYears, isValid, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { v4 as uuidv4 } from 'uuid';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuCheckboxItem, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useStudentContext } from '@/context/StudentContext';
import { useAuth } from '@/context/AuthContext';
import type { Student, StudentStatus, PreRegistration, PreRegistrationStatus } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useRouter } from 'next/navigation';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';


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

const educationalLevels = ["روضة", "تحضيري", "1 ابتدائي", "2 ابتدائي", "3 ابتدائي", "4 ابتدائي", "5 ابتدائي", "1 متوسط", "2 متوسط", "3 متوسط", "4 متوسط", "1 ثانوي", "2 ثانوي", "3 ثانوي", "بكالوريا", "جامعي", "متوقف عن الدراسة"];

const ALL_COLUMNS = {
    fullName: { label: "الإسم الكامل", visible: true },
    gender: { label: "الجنس", visible: false },
    birthDate: { label: "تاريخ الميلاد", visible: true },
    educationalLevel: { label: "المستوى الدراسي", visible: true },
    guardianName: { label: "إسم الولي", visible: false },
    phone1: { label: "رقم الهاتف 1", visible: true },
    phone2: { label: "رقم الهاتف 2", visible: false },
    address: { label: "مقر السكن", visible: false },
    status: { label: "الحالة", visible: true },
    notes: { label: "ملاحظات", visible: true },
    requestedAt: { label: "تاريخ التسجيل", visible: false },
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

const StudentProfileCard = ({ student, onPromote, onEdit, isLocked }: { student: PreRegistration, onPromote: () => void, onEdit: () => void, isLocked: boolean }) => {
    const headerColor = statusHeaderColors[student.status] || 'bg-gray-500';

    return (
        <DialogContent className="sm:max-w-2xl p-0">
             <DialogHeader>
                <DialogTitle className="sr-only">بطاقة الطالب: {student.fullName}</DialogTitle>
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
                <Button onClick={onPromote} disabled={student.status === 'تم الإنضمام' || isLocked}>نقل إلى فوج</Button>
            </DialogFooter>
        </DialogContent>
    );
};


const RegistrationForm = ({ onSave, onCancel, existingRegistration }: { onSave: (data: Partial<PreRegistration> & { photoFile?: File | null }) => void, onCancel: () => void, existingRegistration?: PreRegistration | null }) => {
    const [birthDate, setBirthDate] = useState<Date | undefined>(existingRegistration?.birthDate && isValid(new Date(existingRegistration.birthDate)) ? new Date(existingRegistration.birthDate) : undefined);
    const [age, setAge] = useState<number | string>(existingRegistration && existingRegistration.birthDate && isValid(new Date(existingRegistration.birthDate)) ? differenceInYears(new Date(), new Date(existingRegistration.birthDate)) : '');
    const [status, setStatus] = useState<PreRegistrationStatus>(existingRegistration?.status || 'مرشح');
    const [notes, setNotes] = useState(existingRegistration?.notes || '');
    const [photoPreview, setPhotoPreview] = useState<string | null>(existingRegistration?.photoURL || null);
    const [photoFile, setPhotoFile] = useState<File | null>(null);
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
        onSave({ ...data, birthDate, id: existingRegistration?.id, notes, photoFile });
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
                    {existingRegistration ? 'قم بتحديث بيانات الطالب هنا.' : 'املأ بيانات الطالب الجديد. الحقول المعلمة بـ * إلزامية.'}
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
                    <div className="space-y-2">
                        <Label>تاريخ الميلاد *</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !birthDate && "text-muted-foreground")}>
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
                    <div className="space-y-2">
                        <Label htmlFor="educationalLevel">المستوى الدراسي</Label>
                         <Select dir="rtl" name="educationalLevel" defaultValue={existingRegistration?.educationalLevel}>
                            <SelectTrigger id="educationalLevel"><SelectValue placeholder="اختر المستوى الدراسي" /></SelectTrigger>
                            <SelectContent>
                                {educationalLevels.map(level => <SelectItem key={level} value={level}>{level}</SelectItem>)}
                            </SelectContent>
                        </Select>
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
                        <Label htmlFor="notes">ملاحظات عامة</Label>
                        <Textarea name="notes" defaultValue={existingRegistration?.notes} />
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
                             <Label htmlFor="level-select" className={cn(!fieldsToUpdate.educationalLevel && "text-muted-foreground")}>المستوى الدراسي</Label>
                             <Select dir="rtl" name="educationalLevel" disabled={!fieldsToUpdate.educationalLevel} onValueChange={(val) => handleInputChange('educationalLevel', val)}>
                                <SelectTrigger id="level-select"><SelectValue placeholder="اختر المستوى الجديد" /></SelectTrigger>
                                <SelectContent>
                                    {educationalLevels.map(level => <SelectItem key={level} value={level}>{level}</SelectItem>)}
                                </SelectContent>
                            </Select>
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
    const { addStudent, preRegistrations, loading, updatePreRegistration, deleteMultiplePreRegistrations, bulkUpdatePreRegistrations } = useStudentContext();
    const [isFormOpen, setFormOpen] = useState(false);
    const [editingRegistration, setEditingRegistration] = useState<PreRegistration | null>(null);
    const [selectedStudent, setSelectedStudent] = useState<PreRegistration | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [levelFilter, setLevelFilter] = useState<string[]>([]);
    const [statusFilter, setStatusFilter] = useState('all');
    const [genderFilter, setGenderFilter] = useState('all');
    const [selectedRows, setSelectedRows] = useState<string[]>([]);
    const [isBulkEditOpen, setBulkEditOpen] = useState(false);
    const router = useRouter();

    const [isLocked, setIsLocked] = useState(true);
    const [isUnlockModalOpen, setUnlockModalOpen] = useState(false);
    const [adminCode, setAdminCode] = useState('');

    const [isDataVisible, setIsDataVisible] = useState(false);
    const [isVisibilityModalOpen, setIsVisibilityModalOpen] = useState(false);
    const [visibilityCode, setVisibilityCode] = useState('');
    
    const [sortConfig, setSortConfig] = useState<{ key: keyof PreRegistration; direction: 'ascending' | 'descending' }>({ key: 'pageNumber', direction: 'ascending' });
    
    const [pendingDeletion, setPendingDeletion] = useState<string[]>([]);
    const undoTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const [columnVisibility, setColumnVisibility] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('preRegColumnVisibility');
            return saved ? JSON.parse(saved) : ALL_COLUMNS;
        }
        return ALL_COLUMNS;
    });

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

    const handleUnlock = () => {
        if (adminCode === 'admin8888') {
            setIsLocked(false);
            setUnlockModalOpen(false);
            setAdminCode('');
            toast({ title: '✅ تم فتح وضع التعديل', description: 'يمكنك الآن إجراء التعديلات.' });
        } else {
            toast({ title: '❌ خطأ', description: 'كود الإدارة غير صحيح.', variant: 'destructive' });
        }
    };
    
    const handleVisibilityToggle = () => {
        if (visibilityCode === 'adaika8888') {
            setIsDataVisible(true);
            setIsVisibilityModalOpen(false);
            setVisibilityCode('');
            toast({ title: '✅ تم عرض البيانات', description: 'البيانات الآن ظاهرة. وضع التعديل لا يزال مقفلاً.' });
        } else if (visibilityCode === 'admin8888') {
            setIsDataVisible(true);
            setIsLocked(false);
            setIsVisibilityModalOpen(false);
            setVisibilityCode('');
            toast({ title: '✅ تم الدخول بصلاحيات المدير', description: 'تم عرض البيانات وفتح وضع التعديل.' });
        } else {
            toast({ title: '❌ خطأ', description: 'كود الوصول غير صحيح.', variant: 'destructive' });
        }
    }

    const toggleColumn = (key: keyof typeof ALL_COLUMNS) => {
        setColumnVisibility((prev: any) => ({
            ...prev,
            [key]: { ...prev[key], visible: !prev[key].visible }
        }));
    };

    const setQuickView = () => {
        const quickViewCols: (keyof typeof ALL_COLUMNS)[] = ['fullName', 'educationalLevel', 'status'];
        const newVisibility = { ...columnVisibility };
        Object.keys(newVisibility).forEach(key => {
            newVisibility[key as keyof typeof ALL_COLUMNS].visible = quickViewCols.includes(key as keyof typeof ALL_COLUMNS);
        });
        setColumnVisibility(newVisibility);
    };

    const setAllView = () => {
        const newVisibility = { ...columnVisibility };
        Object.keys(newVisibility).forEach(key => {
            newVisibility[key as keyof typeof ALL_COLUMNS].visible = true;
        });
        setColumnVisibility(newVisibility);
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
                const statusMatch = statusFilter === 'all' || reg.status === statusFilter;
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
            
            return sortConfig.direction === 'ascending' ? dateB - dateA : dateA - b;
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
        if (!data.fullName || !data.birthDate || !data.phone1) {
            toast({ title: "خطأ", description: "الرجاء ملء جميع الحقول الإلزامية.", variant: "destructive" });
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

    const handlePromoteStudent = (reg: PreRegistration, ownerId: string, groupName: string) => {
        if (!reg.birthDate || !(reg.birthDate instanceof Date) || !isValid(reg.birthDate)) {
             toast({
                title: 'خطأ في تاريخ الميلاد',
                description: 'الرجاء تصحيح تاريخ ميلاد الطالب قبل نقله إلى فوج.',
                variant: 'destructive',
            });
            handleEdit(reg);
            return;
        }
        
        const newStudentData: Omit<Student, 'id' | 'updatedAt' | 'memorizedSurahsCount'> & {ownerId: string, groupName: string} = {
            ownerId,
            groupName,
            fullName: reg.fullName,
            gender: reg.gender,
            pageNumber: reg.pageNumber,
            guardianName: reg.guardianName || 'غير محدد',
            educationalLevel: reg.educationalLevel || 'غير محدد',
            phone1: reg.phone1,
            phone2: reg.phone2,
            birthDate: new Date(reg.birthDate),
            registrationDate: new Date(),
            status: 'نشط' as StudentStatus,
            subscriptionTier: 'فئة الأصاغر',
            dailyMemorizationAmount: 'صفحة',
            notes: reg.notes,
            photoURL: reg.photoURL
        };

        addStudent(newStudentData);

        updatePreRegistration(reg.id, { status: 'تم الإنضمام', ownerId }, true);

        toast({
            title: '✅ تم النقل بنجاح!',
            description: `تم نقل الطالب ${reg.fullName} إلى فوج الشيخ ${groupName}.`,
        });
        setSelectedStudent(null);
        router.push('/');
    };
    
    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
             <Card className={cn("sticky top-0 z-40 transition-colors", isDataVisible ? (isLocked ? "bg-yellow-100 border-yellow-300" : "bg-green-100 border-green-300") : "bg-gray-100 border-gray-300")}>
                <CardContent className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => setIsVisibilityModalOpen(true)}>
                           {isDataVisible ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </Button>

                         <div className="flex items-center gap-2 font-semibold">
                            {isLocked ? (
                                <>
                                    <Lock className="h-5 w-5 text-yellow-700"/>
                                    <span className="text-yellow-800 hidden sm:inline">⚠️ الصفحة مقفلة - لا يمكن التعديل.</span>
                                </>
                            ) : (
                                 <>
                                    <Unlock className="h-5 w-5 text-green-700"/>
                                    <span className="text-green-800 hidden sm:inline">تم فتح وضع التعديل.</span>
                                </>
                            )}
                        </div>
                    </div>
                    {isLocked ? (
                        <Button onClick={() => setUnlockModalOpen(true)}>فتح التعديل</Button>
                    ) : (
                        <Button variant="secondary" onClick={() => setIsLocked(true)}>إعادة قفل الصفحة</Button>
                    )}
                </CardContent>
            </Card>
            
             <Dialog open={isVisibilityModalOpen} onOpenChange={setIsVisibilityModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>إظهار البيانات</DialogTitle>
                        <DialogDescription>
                            البيانات محمية. يرجى إدخال كود الوصول لعرضها.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2 py-4">
                        <Label htmlFor="visibility-code">كود الوصول</Label>
                        <Input 
                            id="visibility-code" 
                            type="password"
                            value={visibilityCode}
                            onChange={(e) => setVisibilityCode(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleVisibilityToggle()}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsVisibilityModalOpen(false)}>إلغاء</Button>
                        <Button onClick={handleVisibilityToggle}>تأكيد</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>


            <Dialog open={isUnlockModalOpen} onOpenChange={setUnlockModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>فتح وضع التعديل</DialogTitle>
                        <DialogDescription>
                            لإجراء أي تعديلات على هذه الصفحة، يرجى إدخال كود الإدارة.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2 py-4">
                        <Label htmlFor="admin-code">كود الإدارة</Label>
                        <Input 
                            id="admin-code" 
                            type="password"
                            value={adminCode}
                            onChange={(e) => setAdminCode(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setUnlockModalOpen(false)}>إلغاء</Button>
                        <Button onClick={handleUnlock}>تأكيد</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Card>
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
                        onPromote={() => { /* This is now handled by the Dropdown in the row */ }}
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

            {isDataVisible ? (
                <>
                    <Card>
                        <CardContent className="p-4 space-y-4">
                            <div className="flex flex-wrap items-center gap-2">
                                {Object.entries(statusBadgeColors).map(([status, className]) => (
                                    <Badge key={status} className={cn("border cursor-pointer", className, statusFilter === status && "ring-2 ring-ring")} onClick={() => setStatusFilter(prev => prev === status ? 'all' : status as PreRegistrationStatus)}>{status}</Badge>
                                ))}
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
                                        {educationalLevels.map(level => (
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
                                    </DropdownMenuContent>
                                </DropdownMenu>

                                <Select dir="rtl" value={statusFilter} onValueChange={setStatusFilter}>
                                    <SelectTrigger className="w-full flex-grow sm:w-[180px]">
                                        <SelectValue placeholder="الحالة" />
                                    </SelectTrigger>
                                    <SelectContent>
                                    <SelectItem value="all">كل الحالات</SelectItem>
                                    <SelectItem value="مرشح">مرشح</SelectItem>
                                    <SelectItem value="تم الإنضمام">تم الإنضمام</SelectItem>
                                    <SelectItem value="مرفوض">مرفوض</SelectItem>
                                    <SelectItem value="مؤجل">مؤجل</SelectItem>
                                    <SelectItem value="إنضم لمدرسة أخرى">إنضم لمدرسة أخرى</SelectItem>
                                    </SelectContent>
                                </Select>
                                
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
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline"><View className="ml-2 h-4 w-4"/> عرض الأعمدة</Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent className="w-56">
                                        <DropdownMenuLabel>اختر الأعمدة للعرض</DropdownMenuLabel>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onSelect={setQuickView}>عرض سريع</DropdownMenuItem>
                                        <DropdownMenuItem onSelect={setAllView}>عرض الكل</DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        {Object.entries(columnVisibility).map(([key, value]) => (
                                            <DropdownMenuCheckboxItem
                                                key={key}
                                                checked={value.visible}
                                                onCheckedChange={() => toggleColumn(key as keyof typeof ALL_COLUMNS)}
                                            >
                                                {value.label}
                                            </DropdownMenuCheckboxItem>
                                        ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className={cn('transition-all', !isLocked && 'border-green-500 ring-2 ring-green-500/20')}>
                        <CardHeader>
                            <CardTitle>قائمة طلبات التسجيل ({filteredRegistrations.length})</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="relative w-full overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[50px] px-2">
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
                                            <TableHead className="w-[80px]">
                                                <Button variant="ghost" onClick={() => requestSort('pageNumber')} className="px-2">
                                                    الهوية
                                                    <ArrowUpDown className="mr-2 h-4 w-4" />
                                                </Button>
                                            </TableHead>
                                            {columnVisibility.fullName.visible && <TableHead className="flex-1 text-center">الإسم الكامل</TableHead>}
                                            {columnVisibility.gender.visible && <TableHead className="text-center">الجنس</TableHead>}
                                            {columnVisibility.birthDate.visible && <TableHead className="text-center">تاريخ الميلاد</TableHead>}
                                            {columnVisibility.educationalLevel.visible && <TableHead className="text-center">المستوى الدراسي</TableHead>}
                                            {columnVisibility.guardianName.visible && <TableHead className="text-center">إسم الولي</TableHead>}
                                            {columnVisibility.phone1.visible && <TableHead className="text-center">رقم الهاتف 1</TableHead>}
                                            {columnVisibility.phone2.visible && <TableHead className="text-center">رقم الهاتف 2</TableHead>}
                                            {columnVisibility.address.visible && <TableHead className="text-center">مقر السكن</TableHead>}
                                            {columnVisibility.status.visible && <TableHead className="text-center">الحالة</TableHead>}
                                            {columnVisibility.notes.visible && <TableHead className="text-center">ملاحظات</TableHead>}
                                            {columnVisibility.requestedAt.visible && <TableHead className="text-center">تاريخ التسجيل</TableHead>}
                                            <TableHead className="text-center">إجراءات</TableHead>
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
                                                <TableCell className="px-2" onClick={(e) => e.stopPropagation()}>
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
                                                <TableCell>
                                                    <div className="flex flex-col items-center gap-1">
                                                        <Avatar className="w-10 h-10">
                                                            <AvatarImage src={reg.photoURL} />
                                                            <AvatarFallback className={cn(reg.gender === 'أنثى' ? 'bg-pink-100 text-pink-600' : 'bg-blue-100 text-blue-600')}>
                                                                {reg.gender === 'أنثى' ? <UserRound /> : <UserIcon />}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <Badge variant="secondary" className="px-1.5 py-0.5 text-xs">{reg.pageNumber || 'N/A'}</Badge>
                                                    </div>
                                                </TableCell>
                                                {columnVisibility.fullName.visible && <TableCell className="font-medium text-center">{reg.fullName}</TableCell>}
                                                {columnVisibility.gender.visible && <TableCell className="text-center">{reg.gender}</TableCell>}
                                                {columnVisibility.birthDate.visible && <TableCell className="text-center">{reg.birthDate instanceof Date && isValid(reg.birthDate) ? format(reg.birthDate, 'yyyy/MM/dd') : (reg.birthDate ? reg.birthDate.toString() : 'غير محدد')}</TableCell>}
                                                {columnVisibility.educationalLevel.visible && <TableCell className="text-center">{reg.educationalLevel}</TableCell>}
                                                {columnVisibility.guardianName.visible && <TableCell className="text-center">{reg.guardianName}</TableCell>}
                                                {columnVisibility.phone1.visible && <TableCell className="text-center">{reg.phone1}</TableCell>}
                                                {columnVisibility.phone2.visible && <TableCell className="text-center">{reg.phone2}</TableCell>}
                                                {columnVisibility.address.visible && <TableCell className="text-center">{reg.address}</TableCell>}
                                                {columnVisibility.status.visible && <TableCell className="text-center">
                                                    <Badge variant="outline" className={cn("border", statusBadgeColors[reg.status])}>
                                                        {reg.status}
                                                    </Badge>
                                                </TableCell>}
                                                {columnVisibility.notes.visible && <TableCell className="max-w-[200px] truncate text-center">{reg.notes}</TableCell>}
                                                {columnVisibility.requestedAt.visible && <TableCell className="text-center">{reg.requestedAt instanceof Date && isValid(reg.requestedAt) ? format(reg.requestedAt, 'yyyy/MM/dd') : (reg.requestedAt ? reg.requestedAt.toString() : '-')}</TableCell>}
                                                <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
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
                                                <TableCell colSpan={Object.values(columnVisibility).filter(c => c.visible).length + 3} className="text-center h-24">
                                                    {searchTerm || levelFilter.length > 0 || statusFilter !== 'all' || genderFilter !== 'all'
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
                <Card className="flex flex-col items-center justify-center min-h-[300px] border-dashed">
                    <CardHeader className="text-center">
                        <EyeOff className="mx-auto h-12 w-12 text-muted-foreground" />
                        <CardTitle>البيانات مخفية</CardTitle>
                        <CardDescription>لدواعي الخصوصية، يرجى إدخال كود الوصول لعرض البيانات.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button onClick={() => setIsVisibilityModalOpen(true)}>
                            <Eye className="ml-2 h-4 w-4" />
                            إظهار البيانات
                        </Button>
                    </CardContent>
                </Card>
            )}
            
            {isDataVisible && selectedRows.length > 0 && (
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 border-t shadow-lg z-50">
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
        </div>
    );
}

    

    

    

    


