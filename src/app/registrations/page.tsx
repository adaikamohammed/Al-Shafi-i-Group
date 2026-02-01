

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
import {
    Search,
    PlusCircle,
    FileEdit,
    Trash2,
    MoreHorizontal,
    CheckCircle2,
    XCircle,
    Clock,
    AlertCircle,
    Filter,
    ChevronDown,
    Printer,
    Download,
    Settings2,
    Unlock,
    User as UserIcon,
    UserRound,
    Phone,
    Edit,
    Eye,
    EyeOff,
    BarChart3,
    Loader2,
    ArrowUpDown,
    CalendarIcon,
    Lock,
    ChevronsUpDown,
    Check,
    X,
    ArrowRightLeft
} from 'lucide-react';
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
import { RegistrationCard } from '@/components/registrations/RegistrationCard';
import { RegistrationsStats } from '@/components/registrations/RegistrationsStats';
import { RegistrationsCharts } from '@/components/registrations/RegistrationsCharts';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

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
    { id: 9, name: "الشيخ صهيب نصيب", email: "admin9@gmail.com", group: "فوج الشيخ صهيب نصيب" },
    { id: 10, name: "الأستاذة سعيدة", email: "admin10@gmail.com", group: "فوج 10" },
    { id: 11, name: "الأستاذة سميرة", email: "admin11@gmail.com", group: "فوج 11" },
    { id: 12, name: "الأستاذة رقية", email: "admin12@gmail.com", group: "فوج 12" },
    { id: 13, name: "الأستاذة ثريا", email: "admin13@gmail.com", group: "فوج 13" },
    { id: 14, name: "الأستاذة أميرة", email: "admin14@gmail.com", group: "فوج 14" },
    { id: 15, name: "الأستاذة زينب", email: "admin15@gmail.com", group: "فوج 15" },
    { id: 16, name: "الأستاذة جهاد", email: "admin16@gmail.com", group: "فوج 16" }
];



const statusColors: Record<PreRegistrationStatus, string> = {
    "تم الإتصال": "bg-purple-100 dark:bg-purple-900/20",
    "تم الإنضمام": "bg-green-100 dark:bg-green-900/20",
    "مرفوض": "bg-red-100 dark:bg-red-900/20",
    "مؤجل": "bg-yellow-100 dark:bg-yellow-900/20",
    "إنضم لمدرسة أخرى": "bg-blue-100 dark:bg-blue-900/20",
    "مرشح": "bg-orange-100 dark:bg-orange-900/20",
    "مكرر": "bg-gray-100 dark:bg-gray-900/20",
};

const statusHeaderColors: Record<PreRegistrationStatus, string> = {
    "تم الإتصال": "bg-purple-500",
    "تم الإنضمام": "bg-green-500",
    "مرفوض": "bg-red-500",
    "مؤجل": "bg-yellow-500",
    "إنضم لمدرسة أخرى": "bg-blue-500",
    "مرشح": "bg-orange-500",
    "مكرر": "bg-gray-500",
};


const statusBadgeColors: Record<PreRegistrationStatus, string> = {
    "تم الإتصال": "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-800",
    "تم الإنضمام": "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/40 dark:text-green-300 dark:border-green-800",
    "مرفوض": "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800",
    "مؤجل": "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/40 dark:text-yellow-300 dark:border-yellow-800",
    "إنضم لمدرسة أخرى": "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800",
    "مرشح": "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/40 dark:text-orange-300 dark:border-orange-800",
    "مكرر": "bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-900/40 dark:text-gray-300 dark:border-gray-800",
};

const educationalLevels = {
    "الطور الابتدائي": ["1 إبتدائي", "2 إبتدائي", "3 إبتدائي", "4 إبتدائي", "5 إبتدائي"],
    "الطور المتوسط": ["1 متوسط", "2 متوسط", "3 متوسط", "4 متوسط"],
    "الطور الثانوي": ["1 ثانوي", "2 ثانوي", "3 ثانوي", "بكالوريا"],
    "أخرى": ["روضة", "تحضيري", "جامعي", "متوقف عن الدراسة"]
};
const allEducationalLevels = Object.values(educationalLevels).flat();


const ALL_COLUMNS = {
    pageNumber: { label: "رقم الصفحة", visible: true, printOrder: 1 },
    fullName: { label: "الإسم الكامل", visible: true, printOrder: 2 },
    phone1: { label: "رقم الهاتف 1", visible: true, printOrder: 3 },
    educationalLevel: { label: "المستوى الدراسي", visible: true, printOrder: 4 },
    birthDate: { label: "تاريخ الميلاد", visible: false, printOrder: 5 },
    guardianName: { label: "إسم الولي", visible: false, printOrder: 6 },
    phone2: { label: "رقم الهاتف 2", visible: false, printOrder: 7 },
    address: { label: "مقر السكن", visible: false, printOrder: 8 },
    status: { label: "الحالة", visible: true, printOrder: 9 },
    gender: { label: "الجنس", visible: false, printOrder: 10 },
    notes: { label: "ملاحظات", visible: false, printOrder: 11 },
    requestedAt: { label: "تاريخ التسجيل", visible: false, printOrder: 12 },
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

const StudentProfileCard = ({ student, onEdit, isLocked, onStatusChange }: { student: PreRegistration, onEdit: () => void, isLocked: boolean, onStatusChange?: (id: string, status: PreRegistrationStatus) => void }) => {
    const headerColor = statusHeaderColors[student.status] || 'bg-gray-500';
    const { toast } = useToast();

    const generateWhatsAppMessage = () => {
        return `السلام عليكم ورحمة الله وبركاته

معك إدارة المدرسة القرآنية للإمام الشافعي بحي تكسبت/الوادي

نرسل لكم هذه الرسالة لأنكم سجلتم ابنكم/ابنتكم *${student.fullName}* في المدرسة وقد حان دوره في القائمة.

قمنا بالاتصال بكم على الرقم ${student.phone1} ولم نتمكن من الوصول إليكم.

إذا كنتم مهتمين بإلحاق ابنكم/ابنتكم بالمدرسة، نرجو منكم التكرم بالحضور إلى الإدارة بين صلاتي المغرب والعشاء لاستكمال إجراءات التسجيل.

نسأل الله أن يبارك في أبنائكم ويجعلهم من حفظة كتابه الكريم.

والسلام عليكم ورحمة الله وبركاته
إدارة المدرسة القرآنية للإمام الشافعي`;
    };

    const copyWhatsAppMessage = () => {
        const message = generateWhatsAppMessage();
        navigator.clipboard.writeText(message).then(() => {
            toast({
                title: "✅ تم النسخ",
                description: "تم نسخ رسالة واتساب جاهزة للإرسال",
            });
        }).catch(() => {
            toast({
                title: "❌ خطأ",
                description: "فشل نسخ الرسالة",
                variant: "destructive"
            });
        });
    };

    const sendWhatsAppMessage = () => {
        const message = generateWhatsAppMessage();
        const phoneNumber = student.phone1.replace(/\s/g, '').replace(/^0/, '213');
        const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');
    };

    return (
        <DialogContent className="max-w-full h-full md:max-w-2xl md:h-auto p-0 gap-0">
            <DialogHeader className="p-4 md:p-6 pb-0">
                <DialogTitle className="sr-only">بطاقة الطالب: {student.fullName}</DialogTitle>
                <DialogDescription className="sr-only">عرض تفصيلي لبيانات الطالب.</DialogDescription>
            </DialogHeader>
            <div className={cn("p-4 md:p-6 text-white", headerColor)}>
                <div className="flex items-center gap-3 md:gap-4">
                    <Avatar className="w-16 h-16 md:w-20 md:h-20 border-4 border-white/50">
                        <AvatarImage src={student.photoURL} />
                        <AvatarFallback className={cn((student as any).gender === 'أنثى' ? 'bg-pink-100 text-pink-600' : 'bg-blue-100 text-blue-600')}>
                            {(student as any).gender === 'أنثى' ? <UserRound /> : <UserIcon />}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                        <h2 className="text-xl md:text-2xl font-bold">{student.fullName}</h2>
                        <div className="flex flex-wrap items-center gap-2 md:gap-4 text-xs md:text-sm opacity-90 mt-1">
                            <span>رقم الصفحة: {student.pageNumber || 'N/A'}</span>
                            <Badge variant="secondary" className="text-xs">{student.status}</Badge>
                        </div>
                    </div>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 md:p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                    <div>
                        <h3 className="font-semibold mb-2 border-b pb-1 text-sm md:text-base">المعلومات الشخصية والتعليمية</h3>
                        <div className="space-y-2 text-xs md:text-sm">
                            <p><strong className="min-w-[100px] inline-block">تاريخ الميلاد:</strong> {student.birthDate instanceof Date && isValid(student.birthDate) ? format(student.birthDate, 'yyyy/MM/dd') : (student.birthDate ? student.birthDate.toString() : 'غير محدد')}</p>
                            <p><strong className="min-w-[100px] inline-block">العمر:</strong> {calculateAge(student.birthDate)} سنة</p>
                            <p><strong className="min-w-[100px] inline-block">الجنس:</strong> {student.gender || 'غير محدد'}</p>
                            <p><strong className="min-w-[100px] inline-block">المستوى الدراسي:</strong> {student.educationalLevel || 'غير محدد'}</p>
                        </div>
                    </div>
                    <div>
                        <h3 className="font-semibold mb-2 border-b pb-1 text-sm md:text-base">معلومات الاتصال</h3>
                        <div className="space-y-2 text-xs md:text-sm">
                            <p><strong className="min-w-[100px] inline-block">اسم الولي:</strong> {student.guardianName || 'غير محدد'}</p>
                            <p><strong className="min-w-[100px] inline-block">رقم الهاتف 1:</strong> {student.phone1}</p>
                            <p><strong className="min-w-[100px] inline-block">رقم الهاتف 2:</strong> {student.phone2 || 'لا يوجد'}</p>
                            <p><strong className="min-w-[100px] inline-block">مقر السكن:</strong> {student.address || 'غير محدد'}</p>
                        </div>
                    </div>
                    {(student.status === 'مرفوض' || student.status === 'مؤجل' || student.notes) && (
                        <div className="md:col-span-2">
                            <h3 className="font-semibold mb-2 border-b pb-1 text-sm md:text-base">{student.status === 'مرفوض' ? 'سبب الرفض' : student.status === 'مؤجل' ? 'سبب التأجيل' : 'ملاحظات'}</h3>
                            <div className="p-3 bg-muted rounded-md text-xs md:text-sm">
                                <p>{student.notes || 'لا توجد ملاحظات مسجلة.'}</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            <DialogFooter className="flex-col gap-3 border-t p-4 md:p-6">
                <div className="flex flex-col-reverse sm:flex-row gap-2 w-full justify-between items-center sm:items-stretch">
                    {/* Left Side: Actions */}
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <Button variant="secondary" className="flex-1 sm:flex-none text-xs md:text-sm" onClick={onEdit} disabled={isLocked}>تعديل البيانات</Button>

                        {student.status === 'مرشح' && onStatusChange && (
                            <>
                                <Button
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex-1 sm:flex-none text-xs md:text-sm"
                                    onClick={() => onStatusChange(student.id, 'تم الإنضمام')}
                                >
                                    <Check className="ml-2 h-4 w-4" />
                                    قبول
                                </Button>
                                <Button
                                    variant="destructive"
                                    className="flex-1 sm:flex-none text-xs md:text-sm"
                                    onClick={() => onStatusChange(student.id, 'مرفوض')}
                                >
                                    <X className="ml-2 h-4 w-4" />
                                    رفض
                                </Button>
                            </>
                        )}

                        {student.status === 'تم الإنضمام' && onStatusChange && (
                            <Button
                                className="bg-blue-600 hover:bg-blue-700 text-white font-bold flex-1 sm:flex-none text-xs md:text-sm"
                                onClick={() => onStatusChange(student.id, 'تم الإنضمام')}
                            >
                                <ArrowRightLeft className="ml-2 h-4 w-4" />
                                نقل للفوج
                            </Button>
                        )}
                    </div>

                    {/* Right Side: Communication */}
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <div className="flex gap-1 w-full sm:w-auto bg-muted/50 p-1 rounded-md">
                            <Button variant="ghost" size="sm" className="flex-1 sm:flex-none text-xs" onClick={copyWhatsAppMessage}>
                                <FileEdit className="ml-1 h-3 w-3" /> النسخ
                            </Button>
                            <Separator orientation="vertical" className="h-6" />
                            <Button variant="ghost" size="sm" className="flex-1 sm:flex-none text-xs text-green-600 hover:text-green-700 hover:bg-green-50" onClick={sendWhatsAppMessage}>
                                <Phone className="ml-1 h-3 w-3" /> واتساب
                            </Button>
                        </div>
                    </div>
                </div>
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
    const { toast } = useToast();

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

    const showReasonField = status === 'مرفوض' || status === 'مؤجل' || status === 'مرشح' || status === 'مكرر';
    let reasonLabel = "ملاحظات";
    if (status === 'مرفوض') reasonLabel = "سبب الرفض";
    if (status === 'مؤجل') reasonLabel = "سبب التأجيل";
    if (status === 'مرشح') reasonLabel = "سبب الترشيح / تفاصيل إضافية";
    if (status === 'مكرر') reasonLabel = "ملاحظات التكرار (مثال: مكرر مع الطالب فلان)";

    return (
        <form onSubmit={handleSubmit}>
            <DialogHeader>
                <DialogTitle>{existingRegistration ? `تعديل طلب: ${existingRegistration.fullName}` : 'استمارة تسجيل أولي جديدة'}</DialogTitle>
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
                        <Input id="pageNumber" name="pageNumber" defaultValue={existingRegistration?.pageNumber} />
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
                            <Input id="age-input" type="number" value={age} onChange={handleAgeChange} placeholder="مثال: 12" />
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
                                <SelectItem value="تم الإتصال">تم الإتصال</SelectItem>
                                <SelectItem value="تم الإنضمام">تم الإنضمام</SelectItem>
                                <SelectItem value="مرفوض">مرفوض</SelectItem>
                                <SelectItem value="مؤجل">مؤجل</SelectItem>
                                <SelectItem value="إنضم لمدرسة أخرى">إنضم لمدرسة أخرى</SelectItem>
                                <SelectItem value="مكرر">مكرر</SelectItem>
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
                        <Input id="guardianName" name="guardianName" defaultValue={existingRegistration?.guardianName} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="phone1">رقم الهاتف 1 *</Label>
                        <Input id="phone1" name="phone1" type="tel" required defaultValue={existingRegistration?.phone1} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="phone2">رقم الهاتف 2</Label>
                        <Input id="phone2" name="phone2" type="tel" defaultValue={existingRegistration?.phone2} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="address">مقر السكن</Label>
                        <Input id="address" name="address" defaultValue={existingRegistration?.address} />
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
                                    <SelectItem value="تم الإتصال">تم الإتصال</SelectItem>
                                    <SelectItem value="تم الإنضمام">تم الإنضمام</SelectItem>
                                    <SelectItem value="مرفوض">مرفوض</SelectItem>
                                    <SelectItem value="مؤجل">مؤجل</SelectItem>
                                    <SelectItem value="إنضم لمدرسة أخرى">إنضم لمدرسة أخرى</SelectItem>
                                    <SelectItem value="مكرر">مكرر</SelectItem>
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
    const { user } = useAuth();
    const { addStudent, preRegistrations, loading, updatePreRegistration, deleteMultiplePreRegistrations, bulkUpdatePreRegistrations, allUsers } = useStudentContext();
    const [isFormOpen, setFormOpen] = useState(false);
    const [editingRegistration, setEditingRegistration] = useState<PreRegistration | null>(null);
    const [selectedStudent, setSelectedStudent] = useState<PreRegistration | null>(null);
    // State
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string[]>([]);
    const [levelFilter, setLevelFilter] = useState<string[]>([]);
    const [genderFilter, setGenderFilter] = useState<string>('all');

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 10;

    // Analytics State
    const [showAnalytics, setShowAnalytics] = useState(false);
    const [selectedRows, setSelectedRows] = useState<string[]>([]);
    const [isBulkEditOpen, setBulkEditOpen] = useState(false);

    const [accessLevel, setAccessLevel] = useState<'hidden' | 'view_only' | 'unlocked'>('hidden');
    const [isAccessModalOpen, setIsAccessModalOpen] = useState(false);
    const [accessCode, setAccessCode] = useState('');

    const [sortConfig, setSortConfig] = useState<{ key: keyof PreRegistration; direction: 'ascending' | 'descending' }>({ key: 'pageNumber', direction: 'ascending' });

    const [pendingDeletion, setPendingDeletion] = useState<string[]>([]);
    const undoTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const [isPrintModalOpen, setPrintModalOpen] = useState(false);
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

    const [columnsToPrint, setColumnsToPrint] = useState(columnVisibility);
    const originalColumnVisibilityRef = useRef(columnVisibility);


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

    useEffect(() => {
        const handleAfterPrint = () => {
            setColumnVisibility(originalColumnVisibilityRef.current);
        };

        window.addEventListener('afterprint', handleAfterPrint);
        return () => {
            window.removeEventListener('afterprint', handleAfterPrint);
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
        setColumnVisibility(prev => {
            const newState = { ...prev };
            newState[key] = { ...newState[key], visible: !newState[key].visible };
            return newState;
        });
    };

    const handleConfirmPrint = () => {
        originalColumnVisibilityRef.current = columnVisibility;
        setColumnVisibility(columnsToPrint);
        setPrintModalOpen(false);

        setTimeout(() => {
            window.print();
        }, 100);
    };

    const filteredRegistrations = useMemo(() => {
        const lowercasedFilter = searchTerm.toLowerCase();
        const registrations = (preRegistrations ?? []).filter(reg => !pendingDeletion.includes(reg.id));

        const filtered = registrations.filter(reg => {
            const matchesSearch =
                (reg.fullName && reg.fullName.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (reg.phone1 && reg.phone1.includes(searchTerm)) ||
                (reg.notes && reg.notes.toLowerCase().includes(searchTerm.toLowerCase()));

            const matchesStatus = statusFilter.length === 0 || statusFilter.includes(reg.status);

            // Fixed Level Logic (Hamza agnostic)
            const matchesLevel = levelFilter.length === 0 || levelFilter.some(filterLevel => {
                // Normalize both filter and data value to compare without Hamza if needed,
                // but since we updated constants to match data, direct comparison should work if data is consistent.
                // For safety:
                return reg.educationalLevel === filterLevel;
            });

            const matchesGender = genderFilter === 'all' || reg.gender === genderFilter;

            return matchesSearch && matchesStatus && matchesLevel && matchesGender;
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

            if (isNaN(dateA) || isNaN(dateB)) return 0;

            return sortConfig.direction === 'ascending' ? dateB - dateA : dateA - dateB;
        });

    }, [preRegistrations, searchTerm, levelFilter, statusFilter, genderFilter, sortConfig, pendingDeletion]);

    // Pagination Logic
    const totalPages = Math.ceil(filteredRegistrations.length / ITEMS_PER_PAGE);
    const paginatedRegistrations = filteredRegistrations.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

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

    // --- Sheikh Selection Logic & Student Transfer ---
    const [isJoinDialogOpen, setJoinDialogOpen] = useState(false);
    const [registrationToJoin, setRegistrationToJoin] = useState<PreRegistration | null>(null);
    const [selectedSheikhId, setSelectedSheikhId] = useState<string>("");

    const handleStatusChange = (id: string, newStatus: PreRegistrationStatus) => {
        // Robust check for "Joined" status (handling potential Hamza differences)
        if (newStatus === 'تم الإنضمام' || newStatus === 'تم الانضمام' as any) {
            const reg = preRegistrations.find(r => r.id === id);
            if (reg) {
                setRegistrationToJoin(reg);
                setJoinDialogOpen(true);
            }
        } else {
            const reg = preRegistrations.find(r => r.id === id);
            updatePreRegistration(id, { status: newStatus, fullName: reg?.fullName || 'الطالب' }, true);

            // Only update local state if we aren't relying on the context update to reflect immediately
            // (Though context update usually triggers re-render)
            if (selectedStudent && selectedStudent.id === id) {
                setSelectedStudent(prev => prev ? { ...prev, status: newStatus } : null);
            }
        }
    };

    const handleConfirmJoin = async () => {
        if (!registrationToJoin || !selectedSheikhId) return;

        let selectedSheikh: AppUser | typeof SHEIKHS_LIST[0] | undefined = allUsers.find(u => u.uid === selectedSheikhId);

        if (!selectedSheikh) {
            selectedSheikh = SHEIKHS_LIST.find(s => s.id.toString() === selectedSheikhId);
        }

        if (!selectedSheikh) {
            toast({ title: "❌ خطأ", description: "الشيخ المختار غير موجود", variant: "destructive" });
            return;
        }

        let targetOwnerId = "";
        let targetGroupName = "";

        if ('uid' in selectedSheikh && selectedSheikh.uid) {
            targetOwnerId = selectedSheikh.uid;
            targetGroupName = selectedSheikh.group || "فوج غير محدد";
        } else if ('email' in selectedSheikh) {
            targetGroupName = selectedSheikh.group;
            const realUser = allUsers.find(u => u.email === selectedSheikh.email);
            if (realUser) { targetOwnerId = realUser.uid; }
            else {
                toast({ title: "خطأ", description: `لم يتم العثور على حساب المستخدم لهذا الفوج (${(selectedSheikh as any).email})`, variant: "destructive" });
                return;
            }
        }

        try {
            // 1. Create Data
            const newStudentData = {
                fullName: registrationToJoin.fullName,
                birthDate: registrationToJoin.birthDate,
                educationalLevel: registrationToJoin.educationalLevel || "غير محدد",
                photoURL: registrationToJoin.photoURL,
                gender: registrationToJoin.gender,
                guardianName: registrationToJoin.guardianName,
                phone1: registrationToJoin.phone1,
                phone2: registrationToJoin.phone2,
                address: registrationToJoin.address,
                notes: registrationToJoin.notes,
                status: 'نشط',
                groupName: targetGroupName,
                ownerId: targetOwnerId, // Vital for assigning to specific sheikh
                pageNumber: registrationToJoin.pageNumber || '',
                registrationDate: new Date().toISOString(),
                memorizedSurahs: [],
                memorizedSurahsCount: 0,
                completedHizbsCount: 0,
                dailyMemorizationAmount: "غير محدد",
                joiningDate: new Date().toISOString(),
            };

            // 2. Add to StudentContext
            // Note: We use 'any' to bypass strict type check on addStudent if it misses ownerId in signature, 
            // but internally it should handle it if using firebase push spread.
            await addStudent(newStudentData as any, null);

            // 3. Update Registration Status
            await updatePreRegistration(registrationToJoin.id, { status: 'تم الإنضمام' });

            // 4. Cleanup
            setJoinDialogOpen(false);
            setRegistrationToJoin(null);
            setSelectedSheikhId("");

            if (selectedStudent && selectedStudent.id === registrationToJoin.id) {
                setSelectedStudent(prev => prev ? { ...prev, status: 'تم الإنضمام' } : null);
            }

            toast({
                title: "✅ تم النقل بنجاح",
                description: `تم نقل الطالب ${registrationToJoin.fullName} إلى ${targetGroupName}`
            });

        } catch (error) {
            console.error("Error transferring student:", error);
            toast({ title: "❌ خطأ", description: "حدث خطأ أثناء نقل الطالب", variant: "destructive" });
        }
    };

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
            action: <Button variant="secondary" onClick={() => {
                setPendingDeletion(prev => prev.filter(id => !itemsToDelete.includes(id)));
                if (undoTimeoutRef.current) {
                    clearTimeout(undoTimeoutRef.current);
                    undoTimeoutRef.current = null;
                }
                toast({ title: '✅ تم التراجع عن الحذف' });
            }}>
                تراجع
            </Button>,
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
        return Object.entries(columnVisibility)
            .filter(([, { visible }]) => visible)
            .sort(([, a], [, b]) => (a.printOrder || 99) - (b.printOrder || 99));
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
            icon: <Lock className="h-5 w-5 text-yellow-700" />,
            text: "الصفحة مقفلة - عرض فقط"
        },
        unlocked: {
            color: "bg-green-100 border-green-300",
            icon: <Unlock className="h-5 w-5 text-green-700" />,
            text: "تم فتح وضع التعديل"
        }
    }
    const currentAccess = accessLevelConfig[accessLevel];

    const statusOptions: PreRegistrationStatus[] = ["مرشح", "تم الإتصال", "تم الإنضمام", "مرفوض", "مؤجل", "إنضم لمدرسة أخرى", "مكرر"];

    return (
        <div className="space-y-6">
            <Card className={cn("sticky top-0 z-40 transition-colors no-print", currentAccess.color)}>
                <CardContent className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => setIsAccessModalOpen(true)}>
                            {currentAccess.icon}
                        </Button>
                        <div className="font-semibold hidden sm:inline">{currentAccess.text}</div>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={isJoinDialogOpen} onOpenChange={setJoinDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>نقل الطالب إلى فوج</DialogTitle>
                        <DialogDescription>
                            يرجى اختيار الشيخ الذي سينضم إليه الطالب <strong>{registrationToJoin?.fullName}</strong>.
                            سيتم نقل بيانات الطالب تلقائيًا إلى حساب الشيخ المختار.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-4">
                        <Label className="mb-2 block">اختر الفوج / الشيخ:</Label>
                        <Select dir="rtl" value={selectedSheikhId} onValueChange={setSelectedSheikhId}>
                            <SelectTrigger>
                                <SelectValue placeholder="اختر الشيخ..." />
                            </SelectTrigger>
                            <SelectContent className="z-[9999] max-h-[200px] overflow-y-auto bg-white dark:bg-slate-900 border shadow-lg">
                                {SHEIKHS_LIST.map(sheikh => (
                                    <SelectItem key={sheikh.id} value={sheikh.id.toString()} className="text-right cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800">
                                        {sheikh.group}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setJoinDialogOpen(false)}>إلغاء</Button>
                        <Button onClick={handleConfirmJoin} disabled={!selectedSheikhId}>تأكيد ونقل الطالب</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isAccessModalOpen} onOpenChange={setIsAccessModalOpen} className="no-print">
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

            <Card className="no-print">
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
            }} className="no-print">
                <DialogContent className="sm:max-w-2xl">
                    <RegistrationForm onSave={handleSaveRegistration} onCancel={() => setFormOpen(false)} existingRegistration={editingRegistration} />
                </DialogContent>
            </Dialog>

            {selectedStudent && (
                <Dialog open={!!selectedStudent} onOpenChange={(isOpen) => !isOpen && setSelectedStudent(null)} className="no-print">
                    <StudentProfileCard
                        student={selectedStudent}
                        onEdit={() => handleEdit(selectedStudent)}
                        isLocked={isLocked}
                        onStatusChange={(id, status) => {
                            updatePreRegistration(id, { status }, true);
                            setSelectedStudent(null);
                        }}
                    />
                </Dialog>
            )}

            <BulkEditModal
                open={isBulkEditOpen}
                onOpenChange={setBulkEditOpen}
                selectedCount={selectedRows.length}
                onSave={handleBulkEditSave}
            />

            <Dialog open={isPrintModalOpen} onOpenChange={setPrintModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>تخصيص الطباعة</DialogTitle>
                        <DialogDescription>
                            اختر الأعمدة التي ترغب في طباعتها في التقرير.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-4 py-4">
                        {Object.keys(ALL_COLUMNS).map((key) => {
                            const col = ALL_COLUMNS[key as keyof typeof ALL_COLUMNS];
                            return (
                                <div key={key} className="flex items-center space-x-2 space-x-reverse">
                                    <Checkbox
                                        id={`print-col-${key}`}
                                        checked={columnsToPrint[key as keyof typeof columnsToPrint]?.visible ?? false}
                                        onCheckedChange={(checked) => {
                                            setColumnsToPrint(prev => ({
                                                ...prev,
                                                [key]: { ...prev[key as keyof typeof prev], visible: !!checked }
                                            }));
                                        }}
                                    />
                                    <label htmlFor={`print-col-${key}`} className="text-sm font-medium leading-none">
                                        {col.label}
                                    </label>
                                </div>
                            )
                        })}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setPrintModalOpen(false)}>إلغاء</Button>
                        <Button onClick={handleConfirmPrint}>تأكيد الطباعة</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {accessLevel !== 'hidden' ? (
                <div className="printable-section">
                    <div className="hidden print:block mb-4 text-black">
                        <div className="flex justify-between items-center">
                            <h2 className="font-bold">مدير مدرسة الشافعي</h2>
                            <h1 className="text-xl font-bold">قائمة طلبات التسجيل ({filteredRegistrations.length})</h1>
                            <h3 className="text-sm">{format(new Date(), 'd MMMM yyyy, h:mm a', { locale: ar })}</h3>
                        </div>
                    </div>
                    {/* Stats Dashboard */}
                    <div className="no-print">
                        <RegistrationsStats registrations={filteredRegistrations} />

                        <Collapsible open={showAnalytics} onOpenChange={setShowAnalytics}>
                            <CollapsibleContent className="space-y-4 transition-all data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
                                <RegistrationsCharts registrations={filteredRegistrations} levelFilter={levelFilter} />
                            </CollapsibleContent>
                        </Collapsible>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Filter className="h-5 w-5 text-primary" />
                                    أدوات الفلترة والبحث
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 space-y-4">
                                {/* Top Row: Status Filters & Search */}
                                <div className="flex flex-col lg:flex-row gap-4 justify-between items-start">
                                    <div className="flex flex-wrap items-center gap-2 flex-1">
                                        <div className="text-xs font-semibold text-muted-foreground ml-2">الحالة:</div>
                                        {statusOptions.map(status => (
                                            <Button key={status} size="sm" variant={statusFilter.includes(status) ? 'default' : 'outline'} className={cn("rounded-full h-7 text-xs", statusFilter.includes(status) && statusBadgeColors[status])} onClick={() => {
                                                setStatusFilter(prev => prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status])
                                            }}>{status}</Button>
                                        ))}
                                        {statusFilter.length > 0 && <Button variant="ghost" size="sm" onClick={() => setStatusFilter([])} className="h-7 text-xs text-muted-foreground hover:text-destructive">إلغاء <X className="h-3 w-3 mr-1" /></Button>}
                                    </div>

                                    <div className="w-full lg:w-auto flex gap-2">
                                        <div className="relative w-full lg:w-[200px]">
                                            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                placeholder="بحث بالاسم..."
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                className="pr-9 pl-3 h-9"
                                            />
                                        </div>
                                        <Button
                                            variant={showAnalytics ? "secondary" : "outline"}
                                            size="sm"
                                            onClick={() => setShowAnalytics(!showAnalytics)}
                                            className="h-9 px-3"
                                            title="عرض/إخفاء الرسوم البيانية"
                                        >
                                            <BarChart3 className="h-4 w-4" />
                                        </Button>
                                        <Button variant="outline" size="sm" className="h-9" onClick={() => { setColumnsToPrint(columnVisibility); setPrintModalOpen(true); }}>
                                            <Printer className="ml-2 h-4 w-4" /> طباعة
                                        </Button>
                                    </div>
                                </div>

                                <div className="space-y-3 pt-2 border-t">
                                    {/* Level Filters - Horizontal Scrollable Chips */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div className="text-xs font-semibold text-muted-foreground">المستوى الدراسي:</div>
                                            {levelFilter.length > 0 && <Button variant="link" size="sm" onClick={() => setLevelFilter([])} className="h-auto p-0 text-xs text-destructive">إلغاء التصفية ({levelFilter.length})</Button>}
                                        </div>
                                        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
                                            {Object.entries(educationalLevels).map(([group, levels]) => (
                                                <div key={group} className="flex items-center gap-1 p-1 bg-secondary/30 rounded-lg shrink-0">
                                                    <span className="text-[10px] font-bold text-muted-foreground px-2">{group}</span>
                                                    {levels.map(level => (
                                                        <Button
                                                            key={level}
                                                            size="sm"
                                                            variant={levelFilter.includes(level) ? 'secondary' : 'ghost'}
                                                            className={cn("h-6 text-xs whitespace-nowrap", levelFilter.includes(level) && "bg-primary text-primary-foreground hover:bg-primary/90")}
                                                            onClick={() => {
                                                                setLevelFilter(prev => prev.includes(level) ? prev.filter(l => l !== level) : [...prev, level])
                                                            }}
                                                        >
                                                            {level}
                                                        </Button>
                                                    ))}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Gender Filters */}
                                    <div className="flex items-center gap-4">
                                        <div className="text-xs font-semibold text-muted-foreground">الجنس:</div>
                                        <div className="flex items-center gap-1 bg-secondary/20 p-1 rounded-md">
                                            <Button
                                                size="sm"
                                                variant={genderFilter === 'all' ? 'secondary' : 'ghost'}
                                                className={cn("h-7 text-xs", genderFilter === 'all' && "bg-white shadow-sm")}
                                                onClick={() => setGenderFilter('all')}
                                            >
                                                الكل
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant={genderFilter === 'ذكر' ? 'secondary' : 'ghost'}
                                                className={cn("h-7 text-xs text-blue-700", genderFilter === 'ذكر' && "bg-blue-100")}
                                                onClick={() => setGenderFilter('ذكر')}
                                            >
                                                ذكر
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant={genderFilter === 'أنثى' ? 'secondary' : 'ghost'}
                                                className={cn("h-7 text-xs text-pink-700", genderFilter === 'أنثى' && "bg-pink-100")}
                                                onClick={() => setGenderFilter('أنثى')}
                                            >
                                                أنثى
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
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
                    </div>

                    <Card className={cn('transition-all print:shadow-none', !isLocked && 'border-green-500 ring-2 ring-green-500/20')}>
                        <CardHeader className="no-print">
                            <CardTitle>قائمة طلبات التسجيل ({filteredRegistrations.length})</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 md:p-6 print:p-0">
                            {/* Mobile View: Cards */}
                            <div className="grid grid-cols-1 gap-4 md:hidden">
                                {paginatedRegistrations.length > 0 ? (
                                    paginatedRegistrations.map(reg => (
                                        <RegistrationCard
                                            key={reg.id}
                                            registration={reg}
                                            onEdit={() => handleEdit(reg)}
                                            onSelect={(id) => {
                                                if (selectedRows.includes(id)) {
                                                    setSelectedRows(prev => prev.filter(rowId => rowId !== id));
                                                } else {
                                                    setSelectedRows(prev => [...prev, id]);
                                                }
                                            }}
                                            isSelected={selectedRows.includes(reg.id)}
                                            onView={(reg) => setSelectedStudent(reg)}
                                            onStatusChange={(id, status) => updatePreRegistration(id, { status }, true)}
                                        />
                                    ))
                                ) : (
                                    <div className="text-center py-12 text-muted-foreground bg-muted/20 rounded-lg border-2 border-dashed">
                                        <p>لا توجد طلبات تسجيل جديدة.</p>
                                    </div>
                                )}
                            </div>

                            <div className="hidden md:block relative w-full overflow-x-auto print:overflow-visible">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="print-header-table">
                                            <TableHead className="w-[50px] px-2 no-print">
                                                <Checkbox
                                                    checked={selectedRows.length > 0 && selectedRows.length === paginatedRegistrations.length && paginatedRegistrations.length > 0}
                                                    onCheckedChange={(checked) => {
                                                        if (checked) {
                                                            setSelectedRows(paginatedRegistrations.map(r => r.id));
                                                        } else {
                                                            setSelectedRows([]);
                                                        }
                                                    }}
                                                    aria-label="Select all"
                                                    disabled={isLocked}
                                                />
                                            </TableHead>
                                            <TableHead className="w-[80px] p-2">
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
                                            <TableHead className="text-center no-print">إجراءات</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {paginatedRegistrations.length > 0 ? paginatedRegistrations.map(reg => (
                                            <TableRow
                                                key={reg.id}
                                                className={cn("cursor-pointer transition-colors", statusColors[reg.status])}
                                                onClick={() => setSelectedStudent(reg)}
                                                data-state={selectedRows.includes(reg.id) && "selected"}
                                            >
                                                <TableCell className="px-2 no-print" onClick={(e) => e.stopPropagation()}>
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
                                                <TableCell className="p-2">
                                                    <div className="flex flex-col items-center gap-1">
                                                        <Avatar className="w-10 h-10 border border-black/10">
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
                                                        content = <Badge variant="outline" className={cn("border font-normal whitespace-nowrap", statusBadgeColors[value as PreRegistrationStatus])}>{value as string}</Badge>;
                                                    } else if (key === 'birthDate' || key === 'requestedAt') {
                                                        content = value instanceof Date && isValid(value) ? format(value, 'yyyy/MM/dd') : (value ? value.toString() : 'غير محدد');
                                                    } else if (key === 'fullName') {
                                                        content = <span className="font-medium">{value as string}</span>;
                                                    } else if (key === 'notes' || key === 'address') {
                                                        content = <span className="max-w-[150px] truncate block text-xs text-muted-foreground">{value as string}</span>;
                                                    }
                                                    return <TableCell key={key} className="text-center p-2">{content}</TableCell>;
                                                })}
                                                <TableCell className="text-center no-print" onClick={(e) => e.stopPropagation()}>
                                                    <div className="flex items-center justify-center gap-2">
                                                        {reg.phone1 && (
                                                            <a
                                                                href={`https://wa.me/${reg.phone1.replace(/\s/g, '').replace(/^0/, '213')}`}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-green-50 text-green-600 hover:bg-green-100 hover:text-green-700 transition-colors"
                                                                title="تواصل عبر واتساب"
                                                                onClick={(e) => e.stopPropagation()}
                                                            >
                                                                <Phone className="h-4 w-4" />
                                                            </a>
                                                        )}
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="ghost" size="icon" disabled={isLocked}><MoreHorizontal className="h-4 w-4" /></Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end">
                                                                <DropdownMenuItem onClick={() => handleEdit(reg)}>
                                                                    <Edit className="ml-2 h-4 w-4" /> تعديل / تفاصيل
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )) : (
                                            <TableRow>
                                                <TableCell colSpan={columnsToRender.length + 3} className="text-center h-24 text-muted-foreground">
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

                            {/* Pagination Controls */}
                            {totalPages > 1 && (
                                <div className="mt-4 flex items-center justify-between border-t pt-4 no-print">
                                    <div className="text-sm text-muted-foreground">
                                        عرض {(currentPage - 1) * ITEMS_PER_PAGE + 1} إلى {Math.min(currentPage * ITEMS_PER_PAGE, filteredRegistrations.length)} من أصل {filteredRegistrations.length} طالب
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                            disabled={currentPage === 1}
                                        >
                                            السابق
                                        </Button>
                                        <div className="text-sm font-medium">
                                            صفحة {currentPage} من {totalPages}
                                        </div>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                            disabled={currentPage === totalPages}
                                        >
                                            التالي
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            ) : (
                <Card className="flex flex-col items-center justify-center min-h-[300px] border-dashed no-print">
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
            )
            }

            {
                accessLevel === 'unlocked' && selectedRows.length > 0 && (
                    <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 border-t shadow-lg z-50 no-print">
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
                )
            }
        </div >
    );
}








