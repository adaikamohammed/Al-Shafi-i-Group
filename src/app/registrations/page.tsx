
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, Loader2, CalendarIcon, MoreHorizontal, Edit, Trash2, ArrowUpCircle, Search, Filter, View, ArrowUpDown, User, UserRound } from 'lucide-react';
import { format, getYear, setYear, startOfYear, differenceInYears, isValid, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { v4 as uuidv4 } from 'uuid';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuCheckboxItem, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useStudentContext } from '@/context/StudentContext';
import type { Student, StudentStatus, PreRegistration, PreRegistrationStatus } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';


const statusColors: Record<PreRegistrationStatus, string> = {
    "تم الإنضمام": "bg-green-100 dark:bg-green-900/30",
    "مرفوض": "bg-red-100 dark:bg-red-900/30",
    "مؤجل": "bg-yellow-100 dark:bg-yellow-900/30",
    "إنضم لمدرسة أخرى": "bg-blue-100 dark:bg-blue-900/30",
    "مرشح": "bg-orange-100 dark:bg-orange-900/30",
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
    requestedAt: { label: "تاريخ التسجيل", visible: true },
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
};


const RegistrationForm = ({ onSave, onCancel, existingRegistration }: { onSave: (data: Partial<PreRegistration>) => void, onCancel: () => void, existingRegistration?: PreRegistration | null }) => {
    const [birthDate, setBirthDate] = useState<Date | undefined>(existingRegistration?.birthDate && isValid(new Date(existingRegistration.birthDate)) ? new Date(existingRegistration.birthDate) : undefined);
    const [age, setAge] = useState<number | string>(existingRegistration && existingRegistration.birthDate && isValid(new Date(existingRegistration.birthDate)) ? differenceInYears(new Date(), new Date(existingRegistration.birthDate)) : '');

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
        onSave({ ...data, birthDate, id: existingRegistration?.id });
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="fullName">الاسم الكامل *</Label>
                    <Input id="fullName" name="fullName" required defaultValue={existingRegistration?.fullName} />
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
            </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <div className="space-y-2">
                    <Label htmlFor="age">أو أدخل العمر</Label>
                    <Input id="age" name="age" type="number" value={age} onChange={handleAgeChange} placeholder="مثال: 10" />
                </div>
            </div>
             <div className="space-y-2">
                <Label htmlFor="educationalLevel">المستوى الدراسي</Label>
                 <Select dir="rtl" name="educationalLevel" defaultValue={existingRegistration?.educationalLevel}>
                    <SelectTrigger id="educationalLevel"><SelectValue placeholder="اختر المستوى الدراسي" /></SelectTrigger>
                    <SelectContent>
                        {educationalLevels.map(level => <SelectItem key={level} value={level}>{level}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="guardianName">اسم الولي</Label>
                    <Input id="guardianName" name="guardianName" defaultValue={existingRegistration?.guardianName}/>
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="phone1">رقم الهاتف 1 *</Label>
                    <Input id="phone1" name="phone1" type="tel" required defaultValue={existingRegistration?.phone1}/>
                </div>
            </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="phone2">رقم الهاتف 2</Label>
                    <Input id="phone2" name="phone2" type="tel" defaultValue={existingRegistration?.phone2}/>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="address">مقر السكن</Label>
                    <Input id="address" name="address" defaultValue={existingRegistration?.address}/>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="pageNumber">رقم الصفحة</Label>
                    <Input id="pageNumber" name="pageNumber" defaultValue={existingRegistration?.pageNumber}/>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="status">الحالة</Label>
                    <Select dir="rtl" name="status" defaultValue={existingRegistration?.status || "مرشح"}>
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
            </div>
             <div className="space-y-2">
                <Label htmlFor="notes">ملاحظات</Label>
                <Textarea id="notes" name="notes" placeholder="أي تفاصيل إضافية..." defaultValue={existingRegistration?.notes}/>
            </div>
            <DialogFooter>
                <Button type="button" variant="outline" onClick={onCancel}>إلغاء</Button>
                <Button type="submit">
                    {false ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <PlusCircle className="ml-2 h-4 w-4" />}
                    {existingRegistration ? 'حفظ التعديلات' : 'إضافة طلب تسجيل'}
                </Button>
            </DialogFooter>
        </form>
    );
}

export default function PreRegistrationPage() {
    const { toast } = useToast();
    const { addStudent, preRegistrations, loading, importPreRegistrations } = useStudentContext();
    const [isFormOpen, setFormOpen] = useState(false);
    const [editingRegistration, setEditingRegistration] = useState<PreRegistration | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [levelFilter, setLevelFilter] = useState<string[]>([]);
    const [statusFilter, setStatusFilter] = useState('all');
    const [genderFilter, setGenderFilter] = useState('all');
    
    const [sortConfig, setSortConfig] = useState<{ key: keyof PreRegistration; direction: 'ascending' | 'descending' }>({ key: 'pageNumber', direction: 'ascending' });

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
            
            return sortConfig.direction === 'ascending' ? dateB - dateA : dateA - dateB;
        });

    }, [preRegistrations, searchTerm, levelFilter, statusFilter, genderFilter, sortConfig]);
    
    const requestSort = (key: keyof PreRegistration) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    }

    const handleSaveRegistration = (data: Partial<PreRegistration>) => {
        if (!data.fullName || !data.birthDate || !data.phone1) {
            toast({ title: "خطأ", description: "الرجاء ملء جميع الحقول الإلزامية.", variant: "destructive" });
            return;
        }

        let updatedRegs: PreRegistration[];
        if (data.id) { // Editing existing
            updatedRegs = preRegistrations.map(r => r.id === data.id ? { ...r, ...data } as PreRegistration : r);
            toast({ title: '✅ تم التحديث', description: `تم تحديث بيانات ${data.fullName}.` });
        } else { // Adding new
            const newReg: PreRegistration = {
                id: uuidv4(),
                requestedAt: new Date(),
                status: 'مرشح',
                ...data
            } as PreRegistration;
            updatedRegs = [newReg, ...preRegistrations];
            toast({ title: '✅ تم التسجيل', description: `تم استلام طلب تسجيل ${data.fullName} بنجاح.` });
        }
        
        importPreRegistrations(updatedRegs.map(({id, ...rest}) => rest));
        setFormOpen(false);
        setEditingRegistration(null);
    }
    
    const handleEdit = (reg: PreRegistration) => {
        setEditingRegistration(reg);
        setFormOpen(true);
    }
    
    const handleDelete = (id: string) => {
        const updatedRegs = preRegistrations.filter(r => r.id !== id);
        importPreRegistrations(updatedRegs.map(({id, ...rest}) => rest));
        toast({ title: '🗑️ تم الحذف', description: `تم حذف طلب التسجيل.`, variant: 'destructive'});
    }

    const handlePromoteStudent = (reg: PreRegistration) => {
        const newStudentData: Omit<Student, 'id' | 'updatedAt' | 'memorizedSurahsCount' | 'ownerId'> = {
            fullName: reg.fullName,
            guardianName: reg.guardianName || 'غير محدد',
            phone1: reg.phone1,
            phone2: reg.phone2,
            birthDate: new Date(reg.birthDate),
            registrationDate: new Date(),
            status: 'نشط' as StudentStatus,
            subscriptionTier: 'فئة الأصاغر',
            dailyMemorizationAmount: 'صفحة',
            notes: reg.notes,
        };

        addStudent(newStudentData);

        const updatedRegs = preRegistrations.map(r => r.id === reg.id ? { ...r, status: 'تم الإنضمام' } as PreRegistration : r);
        importPreRegistrations(updatedRegs.map(({id, ...rest}) => rest));

        toast({
            title: '✅ تم النقل بنجاح!',
            description: `تم نقل الطالب ${reg.fullName} إلى فوجك الرسمي.`,
        });
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
            <Card>
                <CardHeader>
                    <CardTitle className="text-3xl font-headline font-bold">إدارة التسجيلات الجديدة</CardTitle>
                    <CardDescription>
                        استقبل طلبات التسجيل الجديدة، قم بفلترتها، ومعالجتها. يمكنك الموافقة على الطلب ونقله إلى فوج، أو رفضه.
                    </CardDescription>
                </CardHeader>
                 <CardContent className="flex flex-col md:flex-row gap-4">
                     <Button onClick={() => { setEditingRegistration(null); setFormOpen(true); }}>
                        <PlusCircle className="ml-2 h-4 w-4" /> إضافة طلب تسجيل يدوي
                     </Button>
                </CardContent>
            </Card>

             <Card>
                <CardHeader>
                    <CardTitle>أدوات البحث المتقدم والفلترة</CardTitle>
                    <CardContent className="pt-4 flex flex-wrap gap-2">
                        {Object.entries(statusBadgeColors).map(([status, className]) => (
                             <Badge key={status} className={cn("border cursor-pointer", className)} onClick={() => setStatusFilter(status as PreRegistrationStatus)}>{status}</Badge>
                        ))}
                    </CardContent>
                </CardHeader>
                 <CardContent className="flex flex-wrap items-center gap-2">
                    <div className="relative w-full sm:max-w-xs">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="بحث شامل..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline"><Filter className="ml-2 h-4 w-4"/>المستوى الدراسي {levelFilter.length > 0 && `(${levelFilter.length})`}</Button>
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
                        <SelectTrigger className="w-full md:w-[180px]">
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
                        <SelectTrigger className="w-full md:w-[150px]">
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
                 </CardContent>
            </Card>

            <Dialog open={isFormOpen} onOpenChange={(open) => {
                setFormOpen(open);
                if (!open) setEditingRegistration(null);
            }}>
                <DialogContent className="sm:max-w-2xl">
                     <DialogHeader>
                        <DialogTitle>{editingRegistration ? `تعديل طلب: ${editingRegistration.fullName}`: 'استمارة تسجيل أولي جديدة'}</DialogTitle>
                        <DialogDescription>
                            املأ بيانات الطالب الجديد. الحقول المعلمة بـ * إلزامية.
                        </DialogDescription>
                    </DialogHeader>
                    <RegistrationForm onSave={handleSaveRegistration} onCancel={() => setFormOpen(false)} existingRegistration={editingRegistration}/>
                </DialogContent>
            </Dialog>

            <Card>
                <CardHeader>
                    <CardTitle>قائمة طلبات التسجيل ({filteredRegistrations.length})</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[80px]">
                                    <Button variant="ghost" onClick={() => requestSort('pageNumber')} className="px-2">
                                        الهوية
                                        <ArrowUpDown className="mr-2 h-4 w-4" />
                                    </Button>
                                </TableHead>
                                {columnVisibility.requestedAt.visible && <TableHead>تاريخ التسجيل</TableHead>}
                                {columnVisibility.fullName.visible && <TableHead>الإسم الكامل</TableHead>}
                                {columnVisibility.gender.visible && <TableHead>الجنس</TableHead>}
                                {columnVisibility.birthDate.visible && <TableHead>تاريخ الميلاد</TableHead>}
                                {columnVisibility.educationalLevel.visible && <TableHead>المستوى الدراسي</TableHead>}
                                {columnVisibility.guardianName.visible && <TableHead>إسم الولي</TableHead>}
                                {columnVisibility.phone1.visible && <TableHead>رقم الهاتف 1</TableHead>}
                                {columnVisibility.phone2.visible && <TableHead>رقم الهاتف 2</TableHead>}
                                {columnVisibility.address.visible && <TableHead>مقر السكن</TableHead>}
                                {columnVisibility.status.visible && <TableHead>الحالة</TableHead>}
                                {columnVisibility.notes.visible && <TableHead>ملاحظات</TableHead>}
                                <TableHead>إجراءات</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredRegistrations.length > 0 ? filteredRegistrations.map(reg => (
                                <TableRow key={reg.id} className={statusColors[reg.status]}>
                                    <TableCell>
                                        <div className="flex flex-col items-center gap-1">
                                            <Avatar className="w-10 h-10">
                                                <AvatarFallback className={cn(reg.gender === 'أنثى' ? 'bg-pink-100 text-pink-600' : 'bg-blue-100 text-blue-600')}>
                                                    {reg.gender === 'أنثى' ? <UserRound /> : <User />}
                                                </AvatarFallback>
                                            </Avatar>
                                            <Badge variant="secondary" className="px-1.5 py-0.5 text-xs">{reg.pageNumber || 'N/A'}</Badge>
                                        </div>
                                    </TableCell>
                                    {columnVisibility.requestedAt.visible && <TableCell>{reg.requestedAt instanceof Date && isValid(reg.requestedAt) ? format(reg.requestedAt, 'yyyy/MM/dd') : (reg.requestedAt || '-')}</TableCell>}
                                    {columnVisibility.fullName.visible && <TableCell className="font-medium">{reg.fullName}</TableCell>}
                                    {columnVisibility.gender.visible && <TableCell>{reg.gender}</TableCell>}
                                    {columnVisibility.birthDate.visible && <TableCell>{reg.birthDate instanceof Date && isValid(reg.birthDate) ? format(reg.birthDate, 'yyyy/MM/dd') : reg.birthDate.toString()}</TableCell>}
                                    {columnVisibility.educationalLevel.visible && <TableCell>{reg.educationalLevel}</TableCell>}
                                    {columnVisibility.guardianName.visible && <TableCell>{reg.guardianName}</TableCell>}
                                    {columnVisibility.phone1.visible && <TableCell>{reg.phone1}</TableCell>}
                                    {columnVisibility.phone2.visible && <TableCell>{reg.phone2}</TableCell>}
                                    {columnVisibility.address.visible && <TableCell>{reg.address}</TableCell>}
                                    {columnVisibility.status.visible && <TableCell>
                                         <Badge variant="outline" className={cn("border", statusBadgeColors[reg.status])}>
                                            {reg.status}
                                        </Badge>
                                    </TableCell>}
                                    {columnVisibility.notes.visible && <TableCell className="max-w-[200px] truncate">{reg.notes}</TableCell>}
                                     <TableCell>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <DropdownMenuItem onSelect={(e) => e.preventDefault()} disabled={reg.status === 'تم الإنضمام'}>
                                                            <ArrowUpCircle className="ml-2 h-4 w-4" /> نقل إلى فوج
                                                        </DropdownMenuItem>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>تأكيد النقل</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                هل أنت متأكد من نقل الطالب "{reg.fullName}" إلى فوجك الرسمي؟ سيتم إنشاء سجل طالب جديد له.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => handlePromoteStudent(reg)}>تأكيد النقل</AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem onClick={() => handleEdit(reg)}>
                                                    <Edit className="ml-2 h-4 w-4" /> تعديل
                                                </DropdownMenuItem>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive">
                                                            <Trash2 className="ml-2 h-4 w-4" /> حذف
                                                        </DropdownMenuItem>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                سيتم حذف طلب التسجيل هذا نهائياً.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => handleDelete(reg.id)}>تأكيد الحذف</AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={Object.values(columnVisibility).filter(c => c.visible).length + 2} className="text-center h-24">
                                        {searchTerm || levelFilter.length > 0 || statusFilter !== 'all' || genderFilter !== 'all'
                                            ? 'لم يتم العثور على نتائج مطابقة للبحث.'
                                            : 'لا توجد طلبات تسجيل جديدة في الوقت الحالي.'
                                        }
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

    



