
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
import { useStudentContext } from '@/context/StudentContext';
import { useAuth } from '@/context/AuthContext';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, Loader2, CalendarIcon, MoreHorizontal, Edit, Trash2 } from 'lucide-react';
import { format, getYear, setYear, startOfYear, differenceInYears, isValid, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { v4 as uuidv4 } from 'uuid';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';


type PreRegistrationStatus = "مؤجل" | "تم الإنضمام" | "مرفوض" | "إنضم لمدرسة أخرى" | "قيد الانتظار";

interface PreRegistration {
    id: string;
    fullName: string;
    gender?: "ذكر" | "أنثى";
    guardianName?: string;
    phone1: string;
    phone2?: string;
    birthDate: Date;
    educationalLevel?: string;
    address?: string;
    status: PreRegistrationStatus;
    requestedAt: Date;
    notes?: string;
    pageNumber?: string;
}

const statusColors: Record<PreRegistrationStatus, string> = {
    "تم الإنضمام": "bg-green-100 text-green-800 border-green-300",
    "مرفوض": "bg-red-100 text-red-800 border-red-300",
    "مؤجل": "bg-yellow-100 text-yellow-800 border-yellow-300",
    "إنضم لمدرسة أخرى": "bg-gray-100 text-gray-800 border-gray-300",
    "قيد الانتظار": "bg-blue-100 text-blue-800 border-blue-300",
};


const RegistrationForm = ({ onSave, onCancel, existingRegistration }: { onSave: (data: Partial<PreRegistration>) => void, onCancel: () => void, existingRegistration?: PreRegistration | null }) => {
    const [birthDate, setBirthDate] = useState<Date | undefined>(existingRegistration?.birthDate);
    const [age, setAge] = useState<number | string>(existingRegistration ? differenceInYears(new Date(), existingRegistration.birthDate) : '');

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

    const educationalLevels = ["روضة", "تحضيري", "1 ابتدائي", "2 ابتدائي", "3 ابتدائي", "4 ابتدائي", "5 ابتدائي", "1 متوسط", "2 متوسط", "3 متوسط", "4 متوسط", "1 ثانوي", "2 ثانوي", "3 ثانوي", "بكالوريا", "جامعي", "متوقف عن الدراسة"];

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
    const [registrations, setRegistrations] = useState<PreRegistration[]>([]);
    const [isFormOpen, setFormOpen] = useState(false);
    const [editingRegistration, setEditingRegistration] = useState<PreRegistration | null>(null);

    const handleSaveRegistration = (data: Partial<PreRegistration>) => {
        if (!data.fullName || !data.birthDate || !data.phone1) {
            toast({ title: "خطأ", description: "الرجاء ملء جميع الحقول الإلزامية.", variant: "destructive" });
            return;
        }

        if (data.id) { // Editing existing
            setRegistrations(regs => regs.map(r => r.id === data.id ? { ...r, ...data } as PreRegistration : r));
            toast({ title: '✅ تم التحديث', description: `تم تحديث بيانات ${data.fullName}.` });
        } else { // Adding new
            const newReg: PreRegistration = {
                id: uuidv4(),
                requestedAt: new Date(),
                status: 'قيد الانتظار',
                ...data
            } as PreRegistration;
            setRegistrations(prev => [newReg, ...prev]);
            toast({ title: '✅ تم التسجيل', description: `تم استلام طلب تسجيل ${data.fullName} بنجاح.` });
        }
        setFormOpen(false);
        setEditingRegistration(null);
    }
    
    const handleEdit = (reg: PreRegistration) => {
        setEditingRegistration(reg);
        setFormOpen(true);
    }
    
    const handleDelete = (id: string) => {
        setRegistrations(regs => regs.filter(r => r.id !== id));
        toast({ title: '🗑️ تم الحذف', description: `تم حذف طلب التسجيل.`, variant: 'destructive'});
    }

    const handleStatusChange = (id: string, newStatus: PreRegistrationStatus) => {
        setRegistrations(regs => regs.map(r => r.id === id ? {...r, status: newStatus} : r));
    }


    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="text-3xl font-headline font-bold">إدارة التسجيلات الجديدة</CardTitle>
                    <CardDescription>
                        استقبل طلبات التسجيل الجديدة وقم بمعالجتها. يمكنك الموافقة على الطلب ونقله إلى فوج، أو رفضه.
                    </CardDescription>
                </CardHeader>
                 <CardContent>
                     <Button onClick={() => { setEditingRegistration(null); setFormOpen(true); }}>
                        <PlusCircle className="ml-2 h-4 w-4" /> إضافة طلب تسجيل يدوي
                     </Button>
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
                    <CardTitle>قائمة طلبات التسجيل</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>الاسم الكامل</TableHead>
                                <TableHead>الجنس</TableHead>
                                <TableHead>تاريخ الميلاد</TableHead>
                                <TableHead>المستوى الدراسي</TableHead>
                                <TableHead>اسم الولي</TableHead>
                                <TableHead>رقم الهاتف</TableHead>
                                <TableHead>الحالة</TableHead>
                                <TableHead>إجراءات</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {registrations.length > 0 ? registrations.map(reg => (
                                <TableRow key={reg.id}>
                                    <TableCell className="font-medium">{reg.fullName}</TableCell>
                                    <TableCell>{reg.gender}</TableCell>
                                    <TableCell>{isValid(reg.birthDate) ? format(reg.birthDate, 'yyyy/MM/dd') : 'غير صالح'}</TableCell>
                                    <TableCell>{reg.educationalLevel}</TableCell>
                                    <TableCell>{reg.guardianName}</TableCell>
                                    <TableCell>{reg.phone1}</TableCell>
                                    <TableCell>
                                         <Badge variant="outline" className={cn("border", statusColors[reg.status])}>
                                            {reg.status}
                                        </Badge>
                                    </TableCell>
                                     <TableCell>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent>
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
                                    <TableCell colSpan={8} className="text-center h-24">
                                        لا توجد طلبات تسجيل جديدة في الوقت الحالي.
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

    