
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
import { format, getYear, setYear, startOfYear, differenceInYears } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { v4 as uuidv4 } from 'uuid';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

// Define types for pre-registration
type PreRegistrationStatus = "pending" | "approved" | "rejected";

interface PreRegistration {
    id: string;
    fullName: string;
    guardianName: string;
    phone1: string;
    birthDate: Date;
    status: PreRegistrationStatus;
    requestedAt: Date;
    notes?: string;
}

const RegistrationForm = ({ onSave, existingRegistration }: { onSave: (data: any) => void, existingRegistration?: PreRegistration | null }) => {
    const [birthDate, setBirthDate] = useState<Date | undefined>(existingRegistration?.birthDate);
    const [age, setAge] = useState<number | string>('');

    useEffect(() => {
        if (existingRegistration?.birthDate) {
            setAge(differenceInYears(new Date(), existingRegistration.birthDate));
        }
    }, [existingRegistration]);
    
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
        e.currentTarget.reset();
        setBirthDate(undefined);
        setAge('');
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
                     <Select dir="rtl" name="gender" defaultValue="ذكر">
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
                                <CalendarIcon className="mr-2 h-4 w-4" />
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
                 <Select dir="rtl" name="educationalLevel">
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
                    <Label htmlFor="phone1">رقم الهاتف *</Label>
                    <Input id="phone1" name="phone1" type="tel" required defaultValue={existingRegistration?.phone1}/>
                </div>
            </div>
             <div className="space-y-2">
                <Label htmlFor="address">مقر السكن</Label>
                <Input id="address" name="address" />
            </div>
             <div className="space-y-2">
                <Label htmlFor="notes">ملاحظات</Label>
                <Textarea id="notes" name="notes" placeholder="أي تفاصيل إضافية..." defaultValue={existingRegistration?.notes}/>
            </div>

            <Button type="submit" disabled={false}>
                {false ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <PlusCircle className="ml-2 h-4 w-4" />}
                {existingRegistration ? 'حفظ التعديلات' : 'إضافة طلب تسجيل'}
            </Button>
        </form>
    );
}

export default function PreRegistrationPage() {
    const { toast } = useToast();
    // This will be replaced with context logic later
    const [registrations, setRegistrations] = useState<PreRegistration[]>([]);
    const [isFormOpen, setFormOpen] = useState(false);
    const [editingRegistration, setEditingRegistration] = useState<PreRegistration | null>(null);

    const handleSaveRegistration = (data: any) => {
        console.log("Saving data:", data);
        if (data.id) { // Editing existing
            setRegistrations(regs => regs.map(r => r.id === data.id ? { ...r, ...data } : r));
            toast({ title: '✅ تم التحديث', description: `تم تحديث بيانات ${data.fullName}.` });
        } else { // Adding new
            const newReg: PreRegistration = {
                id: uuidv4(),
                fullName: data.fullName,
                guardianName: data.guardianName,
                phone1: data.phone1,
                birthDate: data.birthDate,
                status: 'pending',
                requestedAt: new Date(),
                notes: data.notes
            };
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
                    <AlertDialog open={isFormOpen} onOpenChange={(open) => {
                        setFormOpen(open);
                        if (!open) setEditingRegistration(null);
                    }}>
                        <AlertDialogTrigger asChild>
                            <Button><PlusCircle className="ml-2 h-4 w-4" /> إضافة طلب تسجيل يدوي</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="sm:max-w-2xl">
                             <AlertDialogHeader>
                                <AlertDialogTitle>{editingRegistration ? `تعديل طلب: ${editingRegistration.fullName}`: 'استمارة تسجيل أولي جديدة'}</AlertDialogTitle>
                                <AlertDialogDescription>
                                    املأ بيانات الطالب الجديد. الحقول المعلمة بـ * إلزامية.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <RegistrationForm onSave={handleSaveRegistration} existingRegistration={editingRegistration}/>
                        </AlertDialogContent>
                    </AlertDialog>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>قائمة طلبات التسجيل المعلقة</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>الاسم الكامل</TableHead>
                                <TableHead>العمر</TableHead>
                                <TableHead>رقم الهاتف</TableHead>
                                <TableHead>تاريخ الطلب</TableHead>
                                <TableHead>الحالة</TableHead>
                                <TableHead>إجراءات</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {registrations.length > 0 ? registrations.map(reg => (
                                <TableRow key={reg.id}>
                                    <TableCell className="font-medium">{reg.fullName}</TableCell>
                                    <TableCell>{differenceInYears(new Date(), reg.birthDate)} سنة</TableCell>
                                    <TableCell>{reg.phone1}</TableCell>
                                    <TableCell>{format(reg.requestedAt, 'd MMMM yyyy', { locale: ar })}</TableCell>
                                    <TableCell>
                                         <Select dir="rtl" value={reg.status}>
                                            <SelectTrigger className="w-[120px]">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="pending">قيد الانتظار</SelectItem>
                                                <SelectItem value="approved">مقبول</SelectItem>
                                                <SelectItem value="rejected">مرفوض</SelectItem>
                                            </SelectContent>
                                        </Select>
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
                                    <TableCell colSpan={6} className="text-center h-24">
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

