

"use client";

import React, { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, Download, History, Loader2, CalendarClock } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { Student, SessionRecord, SessionType } from '@/lib/types';
import { useStudentContext } from '@/context/StudentContext';
import { useAuth } from '@/context/AuthContext';
import { format, parse, startOfMonth, endOfMonth, parseISO, getDaysInMonth } from 'date-fns';
import { ar } from 'date-fns/locale';

export default function DataExchangePage() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sessionFileInputRef = useRef<HTMLInputElement>(null);
  const monthlySessionFileInputRef = useRef<HTMLInputElement>(null);

  const { students, addDailySession, getRecordsForDateRange, importStudents } = useStudentContext();
  const { user, isAdmin } = useAuth();
  const activeStudents = students.filter(s => s.status === 'نشط');

  // State for monthly export
  const [exportMonth, setExportMonth] = useState(new Date().getMonth());
  const [exportYear, setExportYear] = useState(new Date().getFullYear());
  
  // State for monthly import
  const [importMonth, setImportMonth] = useState(new Date().getMonth());
  const [importYear, setImportYear] = useState(new Date().getFullYear());


  const [isImportingStudents, setIsImportingStudents] = useState(false);
  const [isImportingSessions, setIsImportingSessions] = useState(false);
  const [isImportingMonthly, setIsImportingMonthly] = useState(false);


 const parseDate = (dateInput: any): Date | null => {
    if (!dateInput) return null;
    if (dateInput instanceof Date) return dateInput;
    if (typeof dateInput === 'string') {
        // Handle DD/MM/YYYY or MM/DD/YYYY
        if (dateInput.includes('/')) {
            const parts = dateInput.split('/');
            if (parts.length === 3) {
                // Assuming DD/MM/YYYY as it's more common in the region
                const day = parseInt(parts[0], 10);
                const month = parseInt(parts[1], 10) - 1;
                let year = parseInt(parts[2], 10);
                if(year < 2000) year += 2000; // Handle YY format
                return new Date(year, month, day);
            }
        }
        // Handle ISO date string
        try {
            const parsed = parseISO(dateInput);
            if(!isNaN(parsed.getTime())) return parsed;
        } catch(e) { /* ignore parse error */ }
    }
    if (typeof dateInput === 'number') {
         // Handle Excel serial date
        return XLSX.SSF.parse_date_code(dateInput);
    }
    return null;
 };


  const handleStudentFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsImportingStudents(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        const headers: string[] = XLSX.utils.sheet_to_json<string[]>(worksheet, { header: 1 })[0] || [];
        const requiredHeaders = ["الاسم الكامل", "تاريخ الميلاد", "تاريخ التسجيل"];
        const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
        if(missingHeaders.length > 0) {
            throw new Error(`ملف غير متوافق. الأعمدة المطلوبة مفقودة: ${missingHeaders.join(', ')}. الرجاء استخدام النموذج الرسمي.`);
        }

        const json = XLSX.utils.sheet_to_json<any>(worksheet, { raw: false });

        const existingStudentNames = new Set(students.map(s => s.fullName.trim().toLowerCase()));
        const newStudents: Omit<Student, 'id' | 'updatedAt' | 'memorizedSurahsCount'>[] = [];
        let skippedCount = 0;

        json.forEach((row, index) => {
           const fullName = (row['الاسم الكامل'] || '').trim();
           if (!fullName) return; // Skip empty rows
           
           if (existingStudentNames.has(fullName.toLowerCase())) {
               skippedCount++;
               return; // Skip duplicate student
           }
           
           const birthDate = parseDate(row['تاريخ الميلاد']);
           const registrationDate = parseDate(row['تاريخ التسجيل']);

           if (!birthDate || !registrationDate || isNaN(birthDate.getTime()) || isNaN(registrationDate.getTime())) {
             throw new Error(`التواريخ غير صالحة في الصف رقم ${index + 2} للطالب ${fullName}. تأكد من أنها بصيغة DD/MM/YYYY.`);
           }

           const status = row['حالة الطالب'] || 'نشط';
           if (!["نشط", "غائب طويل", "مطرود"].includes(status)) {
             throw new Error(`حالة الطالب "${status}" في الصف ${index + 2} غير صالحة. يجب أن تكون واحدة من: نشط، غائب طويل، مطرود.`);
           }
           
           const studentData: Omit<Student, 'id' | 'updatedAt' | 'memorizedSurahsCount'> = {
              fullName: fullName,
              guardianName: row['اسم الولي'] || 'N/A',
              phone1: row['رقم الهاتف']?.toString() || 'N/A',
              birthDate: birthDate,
              registrationDate: registrationDate,
              status: status,
              dailyMemorizationAmount: 'صفحة',
              notes: row['ملاحظات'] || '',
           };
           
           newStudents.push(studentData);
           existingStudentNames.add(fullName.toLowerCase()); // Add to set to prevent duplicates within the same file
        });
        
        if (newStudents.length > 0) {
            importStudents(newStudents);
            toast({
              title: "نجاح ✅",
              description: `تم استيراد ${newStudents.length} طالبًا جديدًا. تم تخطي ${skippedCount} طالبًا لوجودهم مسبقًا.`,
            });
        } else if (skippedCount > 0) {
             toast({
              title: "لم تتم إضافة طلاب جدد",
              description: `تم تخطي ${skippedCount} طالبًا لوجودهم مسبقًا في النظام.`,
            });
        } else {
             toast({
                title: "لم يتم العثور على طلاب",
                description: "الملف فارغ أو لا يحتوي على بيانات طلبة جدد.",
                variant: 'destructive',
            });
        }


      } catch (error) {
        console.error("Error parsing Excel file:", error);
        const errorMessage = error instanceof Error ? error.message : "حدث خطأ أثناء قراءة الملف. يرجى التأكد من أن الملف بالصيغة الصحيحة.";
        toast({
          title: "خطأ في الاستيراد ❌",
          description: errorMessage,
          variant: 'destructive',
        });
      } finally {
        setIsImportingStudents(false);
         if(fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };
  
   const handleSessionFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsImportingSessions(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json<any>(worksheet);

        const errors: string[] = [];
        const validSessionTypes: SessionType[] = ["حصة أساسية", "حصة أنشطة", "يوم عطلة", "حصة تعويضية"];

        let sessionDateStr = '';
        let sessionType: SessionType | null = null;
        const recordsToSave: SessionRecord[] = [];

        json.forEach((row, index) => {
            const currentSessionType = row['نوع الحصة'] as SessionType;
            const currentStudentName = row['اسم الطالب'];
            const currentDateStr = row['التاريخ'];

             if (!currentDateStr) {
                errors.push(`❌ الصف رقم ${index + 2}: عمود التاريخ فارغ.`);
                return;
            }

            if (!sessionDateStr) {
                sessionDateStr = format(parse(currentDateStr, 'dd/MM/yyyy', new Date()), 'yyyy-MM-dd');
            }

            if (!currentSessionType || !validSessionTypes.includes(currentSessionType)) {
                errors.push(`❌ الصف رقم ${index + 2}: نوع الحصة "${currentSessionType}" غير صالح.`);
                return;
            }
            
            if (!sessionType) {
                 sessionType = currentSessionType;
            }

            if (currentSessionType === 'يوم عطلة') {
                return; // Skip holiday rows
            }

            if (!currentStudentName) {
                errors.push(`❌ الصف رقم ${index + 2}: اسم الطالب فارغ.`);
                return;
            }
            
            const student = students.find(s => s.fullName === currentStudentName);
            if (!student) {
                errors.push(`⚠️ الصف رقم ${index + 2}: لم يتم العثور على الطالب "${currentStudentName}".`);
                return;
            }
            
            recordsToSave.push({
                studentId: student.id,
                attendance: row['الحضور'],
                behavior: row['السلوك'],
                memorization: row['التقييم'],
                review: row['مراجعة'] === 'نعم',
                notes: row['ملاحظات'],
            });
        });

        if (errors.length > 0) {
            throw new Error(errors.join('\n'));
        }

        if (sessionDateStr && sessionType) {
             addDailySession({ date: sessionDateStr, sessionType, records: recordsToSave });
             toast({
                title: "نجاح ✅",
                description: `تم استيراد وحفظ ${recordsToSave.length} سجل حصة بنجاح ليوم ${sessionDateStr}.`,
            });
        } else if (recordsToSave.length === 0 && sessionType === 'يوم عطلة' && sessionDateStr) {
             addDailySession({ date: sessionDateStr, sessionType: 'يوم عطلة', records: [] });
             toast({
                title: "نجاح ✅",
                description: `تم تسجيل يوم ${sessionDateStr} كـ "يوم عطلة".`,
            });
        }
         else {
            toast({
                title: "لم يتم الاستيراد",
                description: "لم يتم العثور على بيانات صالحة للحفظ.",
                variant: 'destructive',
            });
        }
        
      } catch (error) {
        console.error("Error parsing session file:", error);
        const errorMessage = error instanceof Error ? error.message : "حدث خطأ أثناء قراءة الملف. تأكد من تطابق أسماء الطلبة وصيغة التاريخ.";
        toast({
          title: "خطأ في استيراد سجل الحصة ❌",
          description: errorMessage,
          variant: 'destructive',
        });
      } finally {
        setIsImportingSessions(false);
         if (sessionFileInputRef.current) sessionFileInputRef.current.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleMonthlySessionUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsImportingMonthly(true);

    const reader = new FileReader();
    reader.onload = (e) => {
        let successCount = 0;
        let errors: string[] = [];
        try {
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array', cellDates: true });
            const daysInSelectedMonth = getDaysInMonth(new Date(importYear, importMonth));
            const monthStr = (importMonth + 1).toString().padStart(2, '0');

            for(let day = 1; day <= daysInSelectedMonth; day++) {
                const dayStr = day.toString().padStart(2, '0');
                const sheetName = `${importYear}-${monthStr}-${dayStr}`;

                if (workbook.SheetNames.includes(sheetName)) {
                    const worksheet = workbook.Sheets[sheetName];
                    const json = XLSX.utils.sheet_to_json<any>(worksheet);

                    if (json.length === 0) continue;

                    let sessionType: SessionType | null = null;
                    const recordsToSave: SessionRecord[] = [];

                    json.forEach((row, index) => {
                       const currentSessionType = row['نوع الحصة'] as SessionType;
                       if(index === 0) sessionType = currentSessionType;
                       if (currentSessionType === 'يوم عطلة') return;

                       const studentName = row['اسم الطالب']?.trim();
                       if (!studentName) return; // Skip if no student name

                       const student = students.find(s => s.fullName === studentName);
                       if (!student) {
                           errors.push(`لم يتم العثور على الطالب "${studentName}" في ورقة ${sheetName}`);
                           return;
                       }
                       recordsToSave.push({
                           studentId: student.id,
                           attendance: row['الحضور'], behavior: row['السلوك'],
                           memorization: row['التقييم'], review: row['مراجعة'] === 'نعم',
                           notes: row['ملاحظات'],
                       });
                    });
                    
                     if(sessionType) {
                        addDailySession({ date: sheetName, sessionType, records: recordsToSave });
                        successCount++;
                     }
                }
            }

            if (errors.length > 0) {
                throw new Error(errors.join('\n'));
            }

            toast({
                title: "اكتمل الاستيراد الشهري ✅",
                description: `تم استيراد ${successCount} يومًا بنجاح.`,
            });

        } catch (error) {
            console.error("Error parsing monthly session file:", error);
            const errorMessage = error instanceof Error ? error.message : "حدث خطأ أثناء قراءة الملف. تأكد من تطابق أسماء الأوراق وأسماء الطلبة.";
            toast({
                title: "خطأ في استيراد الملف الشهري ❌",
                description: errorMessage,
                variant: 'destructive',
            });
        } finally {
            setIsImportingMonthly(false);
            if (monthlySessionFileInputRef.current) monthlySessionFileInputRef.current.value = '';
        }
    };
    reader.readAsArrayBuffer(file);
  }

  const handleDownloadStudentTemplate = () => {
    const headers = ["الاسم الكامل", "اسم الولي", "رقم الهاتف", "تاريخ الميلاد", "تاريخ التسجيل", "حالة الطالب", "ملاحظات"];
    const exampleRow = {
      "الاسم الكامل": "عبدالله بن محمد",
      "اسم الولي": "محمد الأحمد",
      "رقم الهاتف": "0501234567",
      "تاريخ الميلاد": "15/01/2012",
      "تاريخ التسجيل": "01/09/2023",
      "حالة الطالب": "نشط",
      "ملاحظات": "طالب مستجد"
    };
    const ws = XLSX.utils.json_to_sheet([exampleRow], { header: headers });
    ws['!cols'] = [ { wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 30 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "نموذج الطلبة");
    XLSX.writeFile(wb, "نموذج_استيراد_الطلبة.xlsx");
  };

  const handleDownloadSessionTemplate = () => {
    const today = new Date();
    const formattedDate = format(today, 'dd/MM/yyyy');
    const dayName = format(today, 'EEEE', { locale: ar });

    const data = activeStudents.map(student => ({
      'التاريخ': formattedDate,
      'اليوم': dayName,
      'نوع الحصة': 'حصة أساسية',
      'اسم الطالب': student.fullName,
      'الحضور': '', 'التقييم': '', 'السلوك': '',
      'مراجعة': 'لا', 'ملاحظات': ''
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [
      { wch: 12 }, { wch: 10 }, { wch: 15 }, { wch: 20 }, { wch: 12 }, { wch: 12 },
      { wch: 12 }, { wch: 10 }, { wch: 30 }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `سجل حصة ${format(today, 'yyyy-MM-dd')}`);
    XLSX.writeFile(wb, `نموذج_حصة_${format(today, 'yyyy-MM-dd')}.xlsx`);
  };

  const handleExportMonthlyReport = () => {
        const startDate = startOfMonth(new Date(exportYear, exportMonth));
        const endDate = endOfMonth(new Date(exportYear, exportMonth));
        const monthRecords = getRecordsForDateRange(format(startDate, 'yyyy-MM-dd'), format(endDate, 'yyyy-MM-dd'));

        if (Object.keys(monthRecords).length === 0) {
            toast({
                title: "لا توجد بيانات",
                description: `لا توجد سجلات لهذا الشهر (${format(startDate, 'MMMM yyyy', {locale: ar})}).`,
                variant: 'destructive'
            });
            return;
        }

        const workbook = XLSX.utils.book_new();

        Object.entries(monthRecords).sort(([dateA], [dateB]) => dateA.localeCompare(dateB)).forEach(([date, session]) => {
            const formattedDate = format(parseISO(date), 'yyyy-MM-dd');
            let dataForSheet;

            if (session.sessionType === 'يوم عطلة') {
                 dataForSheet = [{
                    'التاريخ': format(parseISO(date), 'dd/MM/yyyy'),
                    'اليوم': format(parseISO(date), 'EEEE', { locale: ar }),
                    'نوع الحصة': 'يوم عطلة',
                }];
            } else {
                 dataForSheet = session.records.map(record => {
                    const student = students.find(s => s.id === record.studentId);
                    return {
                        'التاريخ': format(parseISO(date), 'dd/MM/yyyy'),
                        'اليوم': format(parseISO(date), 'EEEE', { locale: ar }),
                        'نوع الحصة': session.sessionType,
                        'اسم الطالب': student?.fullName || 'غير معروف',
                        'الحضور': record.attendance || '',
                        'التقييم': record.memorization || '',
                        'السلوك': record.behavior || '',
                        'مراجعة': record.review ? 'نعم' : 'لا',
                        'ملاحظات': record.notes || '',
                    }
                });
            }
            
            const ws = XLSX.utils.json_to_sheet(dataForSheet);
             ws['!cols'] = [
                { wch: 12 }, { wch: 10 }, { wch: 15 }, { wch: 20 }, { wch: 12 }, { wch: 12 },
                { wch: 12 }, { wch: 10 }, { wch: 30 }
            ];
            XLSX.utils.book_append_sheet(workbook, ws, formattedDate);
        });

        XLSX.writeFile(workbook, `تقرير_حصص_شهر_${format(startDate, 'yyyy-MM')}.xlsx`);
  }

  return (
    <div className="space-y-6">
      <input type="file" ref={fileInputRef} onChange={handleStudentFileUpload} accept=".xlsx, .xls" className="hidden" disabled={isImportingStudents}/>
      <input type="file" ref={sessionFileInputRef} onChange={handleSessionFileUpload} accept=".xlsx, .xls" className="hidden" disabled={isImportingSessions}/>
      <input type="file" ref={monthlySessionFileInputRef} onChange={handleMonthlySessionUpload} accept=".xlsx, .xls" className="hidden" disabled={isImportingMonthly}/>
      
      <h1 className="text-3xl font-headline font-bold">استيراد وتصدير البيانات</h1>
      
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>📥 بيانات الطلبة</CardTitle>
            <CardDescription>
              رفع ملف Excel يحتوي على بيانات الطلبة لبدء العام الدراسي أو إضافة طلبة جدد.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              لن يتم إضافة طالب إذا كان اسمه الكامل موجودًا بالفعل في النظام. استخدم النموذج الرسمي.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button className="flex-grow" onClick={() => fileInputRef.current?.click()} disabled={isImportingStudents}>
                {isImportingStudents ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Upload className="ml-2 h-4 w-4" />}
                {isImportingStudents ? 'جاري الاستيراد...' : 'رفع ملف الطلبة'}
              </Button>
               <Button variant="outline" onClick={handleDownloadStudentTemplate}>
                <Download className="ml-2 h-4 w-4" /> تحميل نموذج الطلبة
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>🔄 بيانات الحصص اليومية</CardTitle>
            <CardDescription>
              تنزيل نموذج ليوم واحد أو رفع سجل حصة ليوم واحد تم تعبئته مسبقًا.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
             <p className="text-sm text-muted-foreground">
              لتسجيل البيانات بشكل غير متصل. سيتم حفظ البيانات عند الرفع.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
               <Button className="flex-grow" onClick={() => sessionFileInputRef.current?.click()} disabled={isImportingSessions}>
                {isImportingSessions ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <History className="ml-2 h-4 w-4" />}
                {isImportingSessions ? 'جاري الاستيراد...' : 'رفع سجل حصة اليوم'}
              </Button>
              <Button variant="outline" onClick={handleDownloadSessionTemplate} disabled={activeStudents.length === 0}>
                <Download className="ml-2 h-4 w-4" /> تحميل نموذج حصة اليوم
              </Button>
            </div>
             {activeStudents.length === 0 && <p className="text-xs text-destructive text-center mt-2">يجب إضافة طلبة نشطين أولاً.</p>}
          </CardContent>
        </Card>
      </div>

       <Card className="col-span-1 md:col-span-2">
          <CardHeader>
            <CardTitle>🗓️ بيانات شهر كامل</CardTitle>
            <CardDescription>
              استيراد أو تصدير ملف Excel واحد يحتوي على بيانات شهر كامل، حيث تكون كل ورقة (sheet) يومًا منفصلاً.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
                <h4 className="font-semibold">استيراد بيانات شهر كامل</h4>
                 <div className="flex gap-2">
                    <Select dir="rtl" value={importMonth.toString()} onValueChange={(val) => setImportMonth(parseInt(val))}>
                        <SelectTrigger><SelectValue placeholder="اختر الشهر" /></SelectTrigger>
                        <SelectContent>
                            {Array.from({length: 12}, (_, i) => (
                                <SelectItem key={i} value={i.toString()}>{format(new Date(2000, i), 'MMMM', {locale: ar})}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select dir="rtl" value={importYear.toString()} onValueChange={(val) => setImportYear(parseInt(val))}>
                        <SelectTrigger><SelectValue placeholder="اختر السنة" /></SelectTrigger>
                        <SelectContent>
                            {Array.from({length: 5}, (_, i) => new Date().getFullYear() - i).map(year => (
                                <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                 </div>
                 <Button className="w-full" onClick={() => monthlySessionFileInputRef.current?.click()} disabled={isImportingMonthly}>
                    {isImportingMonthly ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <CalendarClock className="ml-2 h-4 w-4" />}
                    {isImportingMonthly ? 'جاري الاستيراد...' : 'رفع ملف الشهر'}
                 </Button>
            </div>
             <div className="space-y-4">
                <h4 className="font-semibold">تصدير بيانات شهر كامل</h4>
                <div className="flex gap-2">
                    <Select dir="rtl" value={exportMonth.toString()} onValueChange={(val) => setExportMonth(parseInt(val))}>
                        <SelectTrigger><SelectValue placeholder="اختر الشهر" /></SelectTrigger>
                        <SelectContent>
                            {Array.from({length: 12}, (_, i) => (
                                <SelectItem key={i} value={i.toString()}>{format(new Date(2000, i), 'MMMM', {locale: ar})}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select dir="rtl" value={exportYear.toString()} onValueChange={(val) => setExportYear(parseInt(val))}>
                        <SelectTrigger><SelectValue placeholder="اختر السنة" /></SelectTrigger>
                        <SelectContent>
                            {Array.from({length: 5}, (_, i) => new Date().getFullYear() - i).map(year => (
                                <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <Button className="w-full" onClick={handleExportMonthlyReport}>
                    <Download className="ml-2 h-4 w-4" />
                    تصدير تقرير الشهر المحدد (Excel)
                </Button>
            </div>
          </CardContent>
        </Card>
    </div>
  );
}
