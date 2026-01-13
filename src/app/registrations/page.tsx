
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
import { PlusCircle, Loader2, CalendarIcon, MoreHorizontal, Edit, Trash2, ArrowUpCircle, Search, Filter } from 'lucide-react';
import { format, getYear, setYear, startOfYear, differenceInYears, isValid, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { v4 as uuidv4 } from 'uuid';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuCheckboxItem, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useStudentContext } from '@/context/StudentContext';
import type { Student, StudentStatus, PreRegistration } from '@/lib/types';


type PreRegistrationStatus = "مؤجل" | "تم الإنضمام" | "مرفوض" | "إنضم لمدرسة أخرى" | "قيد الانتظار";

const statusColors: Record<PreRegistrationStatus, string> = {
    "تم الإنضمام": "bg-green-100 text-green-800 border-green-300",
    "مرفوض": "bg-red-100 text-red-800 border-red-300",
    "مؤجل": "bg-yellow-100 text-yellow-800 border-yellow-300",
    "إنضم لمدرسة أخرى": "bg-gray-100 text-gray-800 border-gray-300",
    "قيد الانتظار": "bg-blue-100 text-blue-800 border-blue-300",
};

const educationalLevels = ["روضة", "تحضيري", "1 ابتدائي", "2 ابتدائي", "3 ابتدائي", "4 ابتدائي", "5 ابتدائي", "1 متوسط", "2 متوسط", "3 متوسط", "4 متوسط", "1 ثانوي", "2 ثانوي", "3 ثانوي", "بكالوريا", "جامعي", "متوقف عن الدراسة"];


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
                    <Select dir="rtl" name="status" defaultValue={existingRegistration?.status || "قيد الانتظار"}>
                        <SelectTrigger id="status"><SelectValue /></SelectTrigger>
                        <SelectContent>
                           <SelectItem value="قيد الانتظار">قيد الانتظار</SelectItem>
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
    const [registrations, setRegistrations] = useState<PreRegistration[]>([]);
    const [isFormOpen, setFormOpen] = useState(false);
    const [editingRegistration, setEditingRegistration] = useState<PreRegistration | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [levelFilter, setLevelFilter] = useState<string[]>([]);
    const [statusFilter, setStatusFilter] = useState('all');
    const [genderFilter, setGenderFilter] = useState('all');

    useEffect(() => {
        if (preRegistrations) {
            setRegistrations(preRegistrations);
        }
    }, [preRegistrations]);

    const filteredRegistrations = useMemo(() => {
        const lowercasedFilter = searchTerm.toLowerCase();

        return registrations
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
            })
            .sort((a, b) => {
                const pageNumA = a.pageNumber ? parseInt(a.pageNumber, 10) : Infinity;
                const pageNumB = b.pageNumber ? parseInt(b.pageNumber, 10) : Infinity;
                
                if (!isNaN(pageNumA) && !isNaN(pageNumB)) {
                    if (pageNumA !== pageNumB) return pageNumA - pageNumB;
                } else if (!isNaN(pageNumA)) {
                    return -1;
                } else if (!isNaN(pageNumB)) {
                    return 1;
                }
                
                const dateA = a.requestedAt instanceof Date ? a.requestedAt.getTime() : 0;
                const dateB = b.requestedAt instanceof Date ? b.requestedAt.getTime() : 0;
                return dateB - dateA; // Secondary sort by date
            });
    }, [registrations, searchTerm, levelFilter, statusFilter, genderFilter]);

    const handleSaveRegistration = (data: Partial<PreRegistration>) => {
        if (!data.fullName || !data.birthDate || !data.phone1) {
            toast({ title: "خطأ", description: "الرجاء ملء جميع الحقول الإلزامية.", variant: "destructive" });
            return;
        }

        let updatedRegs: PreRegistration[];
        if (data.id) { // Editing existing
            updatedRegs = registrations.map(r => r.id === data.id ? { ...r, ...data } as PreRegistration : r);
            toast({ title: '✅ تم التحديث', description: `تم تحديث بيانات ${data.fullName}.` });
        } else { // Adding new
            const newReg: PreRegistration = {
                id: uuidv4(),
                requestedAt: new Date(),
                status: 'قيد الانتظار',
                ...data
            } as PreRegistration;
            updatedRegs = [newReg, ...registrations];
            toast({ title: '✅ تم التسجيل', description: `تم استلام طلب تسجيل ${data.fullName} بنجاح.` });
        }
        
        importPreRegistrations(updatedRegs.map(({id, ...rest}) => rest));
        setRegistrations(updatedRegs);
        setFormOpen(false);
        setEditingRegistration(null);
    }
    
    const handleEdit = (reg: PreRegistration) => {
        setEditingRegistration(reg);
        setFormOpen(true);
    }
    
    const handleDelete = (id: string) => {
        const updatedRegs = registrations.filter(r => r.id !== id);
        importPreRegistrations(updatedRegs.map(({id, ...rest}) => rest));
        setRegistrations(updatedRegs);
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

        const updatedRegs = registrations.map(r => r.id === reg.id ? { ...r, status: 'تم الإنضمام' } as PreRegistration : r);
        importPreRegistrations(updatedRegs.map(({id, ...rest}) => rest));
        setRegistrations(updatedRegs);

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
                      <div className="relative w-full md:max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="بحث شامل بالاسم، الولي، الهاتف، أو الملاحظات..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                </CardContent>
            </Card>

             <Card>
                <CardHeader>
                    <CardTitle>أدوات البحث المتقدم</CardTitle>
                </CardHeader>
                 <CardContent className="flex flex-wrap items-center gap-2">
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
                           <SelectItem value="قيد الانتظار">قيد الانتظار</SelectItem>
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
                                <TableHead>رقم الصفحة</TableHead>
                                <TableHead>تاريخ التسجيل</TableHead>
                                <TableHead>الإسم الكامل</TableHead>
                                <TableHead>الجنس</TableHead>
                                <TableHead>تاريخ الميلاد</TableHead>
                                <TableHead>المستوى الدراسي</TableHead>
                                <TableHead>إسم الولي</TableHead>
                                <TableHead>رقم الهاتف 1</TableHead>
                                <TableHead>الحالة</TableHead>
                                <TableHead>ملاحظات</TableHead>
                                <TableHead>إجراءات</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredRegistrations.length > 0 ? filteredRegistrations.map(reg => (
                                <TableRow key={reg.id}>
                                    <TableCell>{reg.pageNumber}</TableCell>
                                    <TableCell>{reg.requestedAt instanceof Date && isValid(reg.requestedAt) ? format(reg.requestedAt, 'yyyy/MM/dd') : reg.requestedAt.toString()}</TableCell>
                                    <TableCell className="font-medium">{reg.fullName}</TableCell>
                                    <TableCell>{reg.gender}</TableCell>
                                    <TableCell>{reg.birthDate instanceof Date && isValid(reg.birthDate) ? format(reg.birthDate, 'yyyy/MM/dd') : reg.birthDate.toString()}</TableCell>
                                    <TableCell>{reg.educationalLevel}</TableCell>
                                    <TableCell>{reg.guardianName}</TableCell>
                                    <TableCell>{reg.phone1}</TableCell>
                                    <TableCell>
                                         <Badge variant="outline" className={cn("border", statusColors[reg.status])}>
                                            {reg.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="max-w-[200px] truncate">{reg.notes}</TableCell>
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
                                    <TableCell colSpan={13} className="text-center h-24">
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
