"use client";

import React, { useState, useEffect, useRef } from 'react';
import { PlusCircle, Trash2, ShieldAlert, Calendar as CalendarIcon, User as UserIcon, Phone, Award, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { DialogFooter } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { format, parseISO, getYear, setYear, startOfYear, differenceInYears } from 'date-fns';
import { ar } from 'date-fns/locale';
import { v4 as uuidv4 } from 'uuid';
import { Student, Covenant, CovenantType, CovenantStatus, CovenantCard } from '@/lib/types';
import { useStudentContext } from '@/context/StudentContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { SearchableSelect, SearchableSelectOption } from '@/components/ui/SearchableSelect';

const educationalLevels = ["روضة", "تحضيري", "1 ابتدائي", "2 ابتدائي", "3 ابتدائي", "4 ابتدائي", "5 ابتدائي", "1 متوسط", "2 متوسط", "3 متوسط", "4 متوسط", "1 ثانوي", "2 ثانوي", "3 ثانوي", "بكالوريا", "جامعي", "متوقف عن الدراسة"];
const educationalLevelOptions: SearchableSelectOption[] = educationalLevels.map(level => ({ value: level, label: level }));

interface StudentFormProps {
    student?: Student;
    onSuccess: () => void;
    onCancel: () => void;
    addStudent: (data: any) => void;
    updateStudent?: (id: string, data: any, ownerId: string) => void;
}

const PRESET_AVATARS = [
    { id: 'smart', path: '/avatars/smart.png', label: 'طالب ذكي' },
    { id: 'excited', path: '/avatars/excited.png', label: 'طالب متحمس' },
    { id: 'playful', path: '/avatars/playful.png', label: 'طالب مشاغب' },
    { id: 'studious', path: '/avatars/studious.png', label: 'طالب مجتهد' },
    { id: 'creative', path: '/avatars/creative.png', label: 'طالب مبدع' },
    { id: 'athletic', path: '/avatars/athletic.png', label: 'طالب رياضي' },
];

export const StudentForm = ({ student, onSuccess, onCancel, addStudent, updateStudent }: StudentFormProps) => {
    const { settings } = useStudentContext();
    const { user, isSuperAdmin } = useAuth();
    const { toast } = useToast();
    const [birthDate, setBirthDate] = useState<Date | undefined>(student?.birthDate ? new Date(student.birthDate) : undefined);
    const [age, setAge] = useState<number | string>(student && student.birthDate ? differenceInYears(new Date(), student.birthDate) : '');
    const [registrationDate, setRegistrationDate] = useState<Date | undefined>(student?.registrationDate ? new Date(student.registrationDate) : new Date());
    const [covenants, setCovenants] = useState<Covenant[]>(student?.covenants || []);
    const [originalCovenants, setOriginalCovenants] = useState<Covenant[]>(student?.covenants || []);
    const [photoPreview, setPhotoPreview] = useState<string | null>(student?.photoURL || null);
    const [selectedAvatarId, setSelectedAvatarId] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [educationalLevel, setEducationalLevel] = useState<string>(student?.educationalLevel || "");
    const [groupName, setGroupName] = useState<string>(student?.groupName || user?.group || "");

    const groupOptions: SearchableSelectOption[] = [
        { value: "فوج الشيخ زياد درويش", label: "فوج الشيخ زياد درويش" },
        { value: "فوج الشيخ عبد الحميد", label: "فوج الشيخ عبد الحميد" },
        { value: "فوج الشيخ فؤاد بن عمر", label: "فوج الشيخ فؤاد بن عمر" },
        { value: "فوج الشيخ أحمد بن عمر", label: "فوج الشيخ أحمد بن عمر" },
        { value: "فوج الشيخ إبراهيم مراد", label: "فوج الشيخ إبراهيم مراد" },
        { value: "فوج الشيخ سفيان نصيرة", label: "فوج الشيخ سفيان نصيرة" },
        { value: "فوج الشيخ محمد منصور", label: "فوج الشيخ محمد منصور" },
        { value: "فوج الشيخ عبد الحق نصيرة", label: "فوج الشيخ عبد الحق نصيرة" },
        { value: "فوج الشيخ صهيب نصيب", label: "فوج الشيخ صهيب نصيب" },
    ];

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



    const handleSelectPresetAvatar = (avatar: typeof PRESET_AVATARS[0]) => {
        setSelectedAvatarId(avatar.id);
        setPhotoPreview(avatar.path);
    };


    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const formData = new FormData(e.currentTarget);
            const data = Object.fromEntries(formData.entries()) as any;

            // Check for status change from "نشط" to "تم الوفاء به"
            covenants.forEach((newCovenant, index) => {
                const oldCovenant = originalCovenants.find(oc => oc.id === newCovenant.id);
                if (oldCovenant && oldCovenant.status === 'نشط' && newCovenant.status === 'تم الوفاء بها') {
                    toast({
                        title: `+${settings.points.covenantCompleted} نقطة`,
                        description: `تمت مكافأة الطالب ${student?.fullName} لإنجازه المهمة بنجاح. سيتم تحديث ترتيبه.`,
                    });
                }
            });

            const studentData: Partial<Student> = {
                fullName: data.fullName,
                gender: data.gender,
                pageNumber: data.pageNumber,
                educationalLevel: data.educationalLevel,
                groupName: isSuperAdmin ? data.groupName : (student?.groupName || user?.group),
                guardianName: data.guardianName,
                phone1: data.phone1,
                phone2: data.phone2,
                birthDate: birthDate,
                registrationDate: registrationDate || new Date(),
                status: data.status,
                subscriptionTier: data.subscriptionTier,
                dailyMemorizationAmount: data.memorizationAmount,
                notes: data.notes,
                covenants: covenants,
                photoURL: selectedAvatarId ? photoPreview : (student?.photoURL || null),
                ownerId: student?.ownerId || user?.uid || ''
            };

            if (student && updateStudent) {
                await updateStudent(student.id, studentData, studentData.ownerId!);
            } else if (addStudent) {
                await addStudent({ ...studentData, ownerId: studentData.ownerId!, groupName: studentData.groupName || 'غير محدد' } as any);
            }
            onSuccess();
        } catch (error) {
            console.error("Error saving student:", error);
            toast({ title: 'خطأ', description: 'حدث خطأ أثناء حفظ البيانات. يرجى المحاولة مرة أخرى.', variant: 'destructive' });
        } finally {
            setIsSubmitting(false);
        }
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
        <form onSubmit={handleSubmit} className="flex flex-col h-full overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
                <div className="flex flex-col items-center gap-6 py-6 bg-primary/5 rounded-2xl border border-primary/10 transition-all hover:bg-primary/10 relative overflow-hidden group">
                    <div className="relative group">
                        <Avatar className="w-28 h-28 border-4 border-background shadow-xl ring-2 ring-primary/20 transition-transform">
                            <AvatarImage src={photoPreview || undefined} />
                            <AvatarFallback className="bg-primary/5 text-primary text-3xl font-headline font-bold">
                                {student?.fullName?.charAt(0) || '?'}
                            </AvatarFallback>
                        </Avatar>
                    </div>

                    <div className="w-full px-6 space-y-4">
                        <div className="text-center">
                            <Label className="font-headline font-bold text-primary mb-2 block">اختر صورة رمزية سريعة</Label>
                            <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
                                {PRESET_AVATARS.map((avatar) => (
                                    <button
                                        key={avatar.id}
                                        type="button"
                                        onClick={() => handleSelectPresetAvatar(avatar)}
                                        className={cn(
                                            "relative w-14 h-14 rounded-full border-2 transition-all hover:scale-110",
                                            selectedAvatarId === avatar.id ? "border-primary ring-2 ring-primary/20 scale-110" : "border-transparent opacity-70 hover:opacity-100"
                                        )}
                                        title={avatar.label}
                                    >
                                        <img src={avatar.path} alt={avatar.label} className="w-full h-full rounded-full object-cover" />
                                        {selectedAvatarId === avatar.id && (
                                            <div className="absolute -top-1 -right-1 bg-primary text-white rounded-full p-0.5">
                                                <PlusCircle className="w-3 h-3 fill-current" />
                                            </div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Primary Data Section */}
                <div className="space-y-4">
                    <h3 className="text-lg font-headline font-bold text-primary flex items-center gap-2 border-b pb-2">
                        <UserIcon className="h-5 w-5" /> المعلومات الأساسية
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label htmlFor="fullName" className="font-headline font-bold">الاسم الكامل للطالب <span className="text-red-500">*</span></Label>
                            <Input name="fullName" id="fullName" defaultValue={student?.fullName} required className="font-body focus-visible:ring-primary shadow-sm" placeholder="مثال: محمد أحمد" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="gender" className="font-headline font-bold">الجنس</Label>
                            <Select dir="rtl" name="gender" defaultValue={student?.gender || "ذكر"}>
                                <SelectTrigger id="gender" className="font-body shadow-sm"><SelectValue /></SelectTrigger>
                                <SelectContent className="font-body">
                                    <SelectItem value="ذكر">ذكر</SelectItem>
                                    <SelectItem value="أنثى">أنثى</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="guardianName" className="font-headline font-bold">اسم الولي</Label>
                            <Input name="guardianName" id="guardianName" defaultValue={student?.guardianName} className="font-body shadow-sm" placeholder="مثال: أحمد محمود" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="educationalLevel" className="font-headline font-bold">المستوى الدراسي</Label>
                            <SearchableSelect
                                name="educationalLevel"
                                options={educationalLevelOptions}
                                value={educationalLevel}
                                onValueChange={setEducationalLevel}
                                placeholder="اختر المستوى"
                                searchPlaceholder="ابحث عن مستوى..."
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="pageNumber" className="font-headline font-bold">رقم الهوية / الصفحة</Label>
                            <Input name="pageNumber" id="pageNumber" defaultValue={student?.pageNumber} className="font-body shadow-sm" placeholder="مثال: 125" />
                        </div>
                        {isSuperAdmin && (
                            <div className="space-y-2">
                                <Label htmlFor="groupName" className="font-headline font-bold text-accent">تخصيص الفوج (سوبر أدمن)</Label>
                                <SearchableSelect
                                    name="groupName"
                                    options={groupOptions}
                                    value={groupName}
                                    onValueChange={setGroupName}
                                    placeholder="اختر الفوج"
                                    searchPlaceholder="ابحث عن فوج..."
                                />
                            </div>
                        )}
                    </div>
                </div>

                {/* Contact & Bio Section */}
                <div className="space-y-4 pt-4">
                    <h3 className="text-lg font-headline font-bold text-primary flex items-center gap-2 border-b pb-2">
                        <Phone className="h-5 w-5" /> بيانات التواصل والعمر
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label htmlFor="phone1" className="font-headline font-bold">رقم هاتف الولي 1</Label>
                            <Input name="phone1" id="phone1" type="tel" defaultValue={student?.phone1} className="font-body shadow-sm dir-ltr text-right" placeholder="0XXXXXXXXX" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="phone2" className="font-headline font-bold">رقم هاتف الولي 2 (اختياري)</Label>
                            <Input name="phone2" id="phone2" type="tel" defaultValue={student?.phone2} className="font-body shadow-sm dir-ltr text-right" placeholder="0XXXXXXXXX" />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                        <div className="space-y-2">
                            <Label htmlFor="age-input" className="font-headline font-bold">العمر التقريبي</Label>
                            <Input id="age-input" type="number" value={age} onChange={handleAgeChange} className="font-body shadow-sm" placeholder="12" />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="birthDate-popover" className="font-headline font-bold">تاريخ الميلاد (دقيق)</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant={"outline"}
                                        id="birthDate-popover"
                                        className={cn("w-full justify-start text-right font-body shadow-sm", !birthDate && "text-muted-foreground")}
                                    >
                                        <CalendarIcon className="ml-2 h-4 w-4" />
                                        {birthDate ? format(birthDate, "d MMMM yyyy", { locale: ar }) : <span>اختر تاريخًا</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0 shadow-2xl border-primary/20" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={birthDate}
                                        onSelect={setBirthDate}
                                        initialFocus
                                        captionLayout="dropdown-buttons"
                                        fromYear={1990}
                                        toYear={new Date().getFullYear()}
                                        className="font-body"
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>
                </div>

                {/* Subscripion Section */}
                <div className="space-y-4 pt-4">
                    <h3 className="text-lg font-headline font-bold text-primary flex items-center gap-2 border-b pb-2">
                        <Award className="h-5 w-5" /> تفاصيل الانتساب والاشتراك
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label className="font-headline font-bold">تاريخ التسجيل الرسمي</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant={"outline"}
                                        className={cn("w-full justify-start text-right font-body shadow-sm", !registrationDate && "text-muted-foreground")}
                                    >
                                        <CalendarIcon className="ml-2 h-4 w-4" />
                                        {registrationDate ? format(registrationDate, "d MMMM yyyy", { locale: ar }) : <span>اختر تاريخًا</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0 shadow-2xl border-primary/20" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={registrationDate}
                                        onSelect={setRegistrationDate}
                                        initialFocus
                                        className="font-body"
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="status" className="font-headline font-bold">حالة الانتساب</Label>
                            <Select dir="rtl" name="status" defaultValue={student?.status ?? 'نشط'}>
                                <SelectTrigger id="status" className="font-body shadow-sm"><SelectValue /></SelectTrigger>
                                <SelectContent className="font-body">
                                    <SelectItem value="نشط">نشط (حضور منتظم)</SelectItem>
                                    <SelectItem value="مطرود">مطرود (بقرار تأديبي)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label htmlFor="subscriptionTier" className="font-headline font-bold">فئة الاشتراك الشهرية</Label>
                            <Select dir="rtl" name="subscriptionTier" defaultValue={student?.subscriptionTier ?? 'فئة الأصاغر'}>
                                <SelectTrigger id="subscriptionTier" className="font-body shadow-sm"><SelectValue /></SelectTrigger>
                                <SelectContent className="font-body">
                                    <SelectItem value="فئة الأكابر">فئة الأكابر</SelectItem>
                                    <SelectItem value="فئة الأصاغر">فئة الأصاغر</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="memorizationAmount" className="font-headline font-bold">خطة الحفظ اليومية</Label>
                            <Select dir="rtl" name="memorizationAmount" defaultValue={student?.dailyMemorizationAmount}>
                                <SelectTrigger id="memorizationAmount" className="font-body shadow-sm"><SelectValue placeholder="اختر المقدار" /></SelectTrigger>
                                <SelectContent className="font-body">
                                    <SelectItem value="نصف صفحة">نصف صفحة</SelectItem>
                                    <SelectItem value="صفحة">صفحة</SelectItem>
                                    <SelectItem value="ثمن">ثمن</SelectItem>
                                    <SelectItem value="ربع">ربع</SelectItem>
                                    <SelectItem value="أكثر">أكثر</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>

                <div className="space-y-2 pt-4">
                    <Label htmlFor="notes" className="font-headline font-bold">ملاحظات المسير الإضافية</Label>
                    <Textarea name="notes" id="notes" defaultValue={student?.notes} placeholder="سلوك الطالب، تنبيهات خاصة، إنجازات مميزة..." className="font-body shadow-sm min-h-[100px] focus-visible:ring-primary" />
                </div>

                {/* Covenants Section */}
                <div className="space-y-4 pt-8">
                    <div className="flex justify-between items-center border-b pb-2">
                        <h3 className="text-lg font-headline font-bold text-primary flex items-center gap-2">
                            <ShieldAlert className="h-5 w-5" /> مهام التمكين والمواثيق التأديبية
                        </h3>
                        <Button type="button" variant="primary" size="sm" onClick={handleAddCovenant} className="font-headline font-bold shadow-md">
                            <PlusCircle className="ml-2 h-4 w-4" /> إضافة ميثاق
                        </Button>
                    </div>

                    <div className="space-y-4">
                        {covenants.map((covenant, index) => (
                            <Card key={covenant.id} className="p-5 space-y-5 bg-muted/30 border-primary/10 shadow-sm relative animate-in-up" style={{ animationDelay: `${index * 50}ms` }}>
                                <div className="absolute top-2 left-2">
                                    <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveCovenant(index)} className="hover:bg-red-50 hover:text-red-600">
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label className="font-headline font-bold">نوع الالتزام</Label>
                                        <Select dir="rtl" value={covenant.type} onValueChange={(val: CovenantType) => handleCovenantChange(index, 'type', val)}>
                                            <SelectTrigger className="font-body bg-background shadow-sm"><SelectValue /></SelectTrigger>
                                            <SelectContent className="font-body">
                                                <SelectItem value="ميثاق حفظ">مهمة تمكين دقيقة</SelectItem>
                                                <SelectItem value="تعهد غياب">تعهد عدم الغياب</SelectItem>
                                                <SelectItem value="التزام سلوكي">ميثاق التزام سلوكي</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="font-headline font-bold">تاريخ التحرير</Label>
                                        <Input disabled value={format(parseISO(covenant.date), 'dd MMMM yyyy', { locale: ar })} className="font-body bg-muted/50" />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label className="font-headline font-bold">نص الميثاق أو التعهد</Label>
                                    <Textarea value={covenant.text} onChange={e => handleCovenantChange(index, 'text', e.target.value)} className="font-body shadow-sm bg-background min-h-[80px]" />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label className="font-headline font-bold">حالة التنفيذ</Label>
                                        <Select dir="rtl" value={covenant.status} onValueChange={(val: CovenantStatus) => handleCovenantChange(index, 'status', val)}>
                                            <SelectTrigger className={cn("font-body bg-background shadow-sm",
                                                covenant.status === 'تم الوفاء بها' ? 'text-green-600 border-green-200' :
                                                    covenant.status === 'نُقِض' ? 'text-red-600 border-red-200' : 'text-blue-600'
                                            )}>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="font-body">
                                                <SelectItem value="نشط">نشط (قيد المراقبة)</SelectItem>
                                                <SelectItem value="تم الوفاء بها">تم الوفاء بالالتزام ✅</SelectItem>
                                                <SelectItem value="نُقِض">تـم النقض (فاشل) ❌</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="font-headline font-bold">نوع العقوبة / البطاقة</Label>
                                        <Select dir="rtl" value={covenant.card} onValueChange={(val: CovenantCard) => handleCovenantChange(index, 'card', val)}>
                                            <SelectTrigger className={cn("font-body bg-background shadow-sm",
                                                covenant.card === 'بطاقة صفراء' ? 'text-yellow-600 border-yellow-300' :
                                                    covenant.card === 'بطاقة حمراء' ? 'text-red-600 border-red-300' : ''
                                            )}>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="font-body">
                                                <SelectItem value="بدون">بدون بطاقة</SelectItem>
                                                <SelectItem value="بطاقة صفراء">🟡 بطاقة صفراء (إنذار)</SelectItem>
                                                <SelectItem value="بطاقة حمراء">🔴 بطاقة حمراء (نهائي)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </Card>
                        ))}
                        {covenants.length === 0 && (
                            <div className="py-8 text-center bg-muted/10 rounded-xl border border-dashed font-body text-muted-foreground">
                                لا توجد مهام أو مواثيق مسجلة لهذا الطالب حالياً.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <DialogFooter className="border-t p-6 gap-3 bg-muted/5 flex-col sm:flex-row glass">
                <Button variant="outline" type="button" onClick={onCancel} className="flex-1 font-headline font-bold shadow-sm" disabled={isSubmitting}>إلغاء الأمر</Button>
                <Button type="submit" className="flex-1 font-headline font-bold shadow-lg shadow-primary/20" disabled={isSubmitting}>
                    {isSubmitting ? (
                        <>
                            <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                            جاري الحفظ...
                        </>
                    ) : (
                        student ? 'حفظ التعديلات الجارية' : 'إتمام إضافة الطالب الجديد'
                    )}
                </Button>
            </DialogFooter>
        </form>
    );
};
