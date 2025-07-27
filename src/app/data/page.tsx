"use client";

import React, { useRef } from 'react';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, Download, FileText, FileSpreadsheet, History } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { Student, SessionRecord } from '@/lib/types';
import { useStudentContext } from '@/context/StudentContext';
import { format, parse } from 'date-fns';
import { ar } from 'date-fns/locale';
import { surahs } from '@/lib/surahs';

export default function DataExchangePage() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sessionFileInputRef = useRef<HTMLInputElement>(null);
  const { students, addStudent, addMultipleDailyRecords } = useStudentContext();
  const activeStudents = students.filter(s => s.status === 'نشط');

  const handleStudentFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json<any>(worksheet);
        
        const newStudents: Student[] = json.map((row, index) => {
           const parseDate = (dateInput: any): Date | null => {
                if (!dateInput) return null;
                if (dateInput instanceof Date) return dateInput;
                if (typeof dateInput === 'string') {
                    if (dateInput.includes('/')) {
                        const parts = dateInput.split('/');
                        return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
                    }
                    return new Date(dateInput); 
                }
                if (typeof dateInput === 'number') return XLSX.SSF.parse_date_code(dateInput);
                return null;
           }

           const birthDate = parseDate(row['تاريخ الميلاد']);
           const registrationDate = parseDate(row['تاريخ التسجيل']);

           if (!birthDate || !registrationDate) {
             throw new Error(`التواريخ غير صالحة في الصف رقم ${index + 2} للطالب: ${row['الاسم الكامل'] || 'غير معروف'}`);
           }
           
           return {
              id: `imported-${Date.now()}-${index}`,
              fullName: row['الاسم الكامل'] || 'N/A',
              guardianName: row['اسم الولي'] || 'N/A',
              phone1: row['رقم الهاتف']?.toString() || 'N/A',
              birthDate: birthDate,
              registrationDate: registrationDate,
              status: 'نشط',
              memorizedSurahsCount: 0,
              dailyMemorizationAmount: 'صفحة',
              notes: row['ملاحظات'] || '',
              updatedAt: new Date()
           }
        });

        newStudents.forEach(student => addStudent(student));
        
        toast({
          title: "نجاح ✅",
          description: `تم استيراد ${newStudents.length} طالبًا بنجاح.`,
        });

      } catch (error) {
        console.error("Error parsing Excel file:", error);
        const errorMessage = error instanceof Error ? error.message : "حدث خطأ أثناء قراءة الملف. يرجى التأكد من أن الملف بالصيغة الصحيحة.";
        toast({
          title: "خطأ في الاستيراد ❌",
          description: errorMessage,
          variant: 'destructive',
        });
      }
    };
    reader.readAsArrayBuffer(file);
    if(fileInputRef.current) fileInputRef.current.value = '';
  };
  
   const handleSessionFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json<any>(worksheet);
        
        const newRecords: SessionRecord[] = json.map((row, index) => {
           const studentName = row['اسم الطالب'];
           const student = students.find(s => s.fullName === studentName);
           if (!student) {
             console.warn(`لم يتم العثور على الطالب: ${studentName} في الصف ${index + 2}. سيتم تجاهل هذا السجل.`);
             return null;
           }
           
           const date = parse(row['التاريخ'], 'dd/MM/yyyy', new Date());
           const surah = surahs.find(s => s.name === row['السورة']);

           return {
             date: format(date, 'yyyy-MM-dd'),
             studentId: student.id,
             sessionType: 'حصة أساسية', // Default for now
             attendance: row['الحضور'],
             behavior: row['السلوك'],
             memorization: row['التقييم'],
             review: row['مراجعة'] === 'نعم',
             surahId: surah?.id,
             fromVerse: row['من آية'],
             toVerse: row['إلى آية'],
             notes: row['ملاحظات'],
           };
        }).filter((r): r is SessionRecord => r !== null);
        
        addMultipleDailyRecords(newRecords);

        toast({
          title: "نجاح ✅",
          description: `تم استيراد ${newRecords.length} سجل حصة بنجاح.`,
        });

      } catch (error) {
        console.error("Error parsing session file:", error);
        toast({
          title: "خطأ في استيراد سجل الحصة ❌",
          description: "حدث خطأ أثناء قراءة الملف. تأكد من تطابق أسماء الطلبة وصيغة التاريخ.",
          variant: 'destructive',
        });
      }
    };
    reader.readAsArrayBuffer(file);
    if (sessionFileInputRef.current) sessionFileInputRef.current.value = '';
  };

  const handleDownloadStudentTemplate = () => {
    const headers = ["الاسم الكامل", "اسم الولي", "رقم الهاتف", "تاريخ الميلاد", "تاريخ التسجيل", "ملاحظات"];
    const exampleRow = {
      "الاسم الكامل": "عبدالله بن محمد", "اسم الولي": "محمد الأحمد", "رقم الهاتف": "0501234567",
      "تاريخ الميلاد": "15/01/2012", "تاريخ التسجيل": "01/09/2023", "ملاحظات": "طالب مستجد"
    };
    const ws = XLSX.utils.json_to_sheet([exampleRow], { header: headers });
    ws['!cols'] = [ { wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 30 }];
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
      'اسم الطالب': student.fullName,
      'الحضور': '', 'التقييم': '', 'السلوك': '',
      'السورة': '', 'من آية': '', 'إلى آية': '',
      'مراجعة': 'لا', 'ملاحظات': ''
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [
      { wch: 12 }, { wch: 10 }, { wch: 20 }, { wch: 12 }, { wch: 12 },
      { wch: 12 }, { wch: 15 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 30 }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `سجل حصة ${format(today, 'yyyy-MM-dd')}`);
    XLSX.writeFile(wb, `نموذج_حصة_${format(today, 'yyyy-MM-dd')}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <input type="file" ref={fileInputRef} onChange={handleStudentFileUpload} accept=".xlsx, .xls" className="hidden" />
      <input type="file" ref={sessionFileInputRef} onChange={handleSessionFileUpload} accept=".xlsx, .xls" className="hidden" />
      
      <h1 className="text-3xl font-headline font-bold">استيراد وتصدير البيانات</h1>
      
      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>📥 بيانات الطلبة</CardTitle>
            <CardDescription>
              رفع ملف Excel يحتوي على بيانات الطلبة لبدء العام الدراسي أو إضافة طلبة جدد.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              قم بتحميل النموذج، واملأه ببيانات الطلبة، ثم ارفعه هنا. سيتم تعيين حالتهم إلى "نشط" تلقائيًا.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button className="flex-grow" onClick={() => fileInputRef.current?.click()}>
                <Upload className="ml-2 h-4 w-4" /> رفع ملف الطلبة
              </Button>
               <Button variant="outline" onClick={handleDownloadStudentTemplate}>
                <Download className="ml-2 h-4 w-4" /> تحميل نموذج الطلبة
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>📤 تقارير وتصدير</CardTitle>
            <CardDescription>
              تصدير تقارير شاملة للفوج أو تقارير فردية للطلبة بصيغ مختلفة.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button variant="secondary" disabled>
                <FileSpreadsheet className="ml-2 h-4 w-4" /> تصدير ملخص الفوج (Excel)
              </Button>
              <Button variant="secondary" disabled>
                <FileText className="ml-2 h-4 w-4" /> تصدير تقارير (PDF)
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

       <Card className="col-span-1 lg:col-span-2">
          <CardHeader>
            <CardTitle>🔄 بيانات الحصص اليومية</CardTitle>
            <CardDescription>
              تنزيل نموذج حصة يومية بأسماء الطلبة النشطين، وتعبئته، ثم رفعه لتسجيل الحصة دفعة واحدة.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
             <p className="text-sm text-muted-foreground">
              هذه الميزة مفيدة لتسجيل بيانات الحصص بشكل غير متصل بالإنترنت. تأكد من أن تاريخ اليوم وأسماء الطلبة صحيحة في الملف قبل رفعه.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
               <Button className="flex-grow" onClick={() => sessionFileInputRef.current?.click()}>
                <History className="ml-2 h-4 w-4" /> رفع سجل حصة
              </Button>
              <Button variant="outline" onClick={handleDownloadSessionTemplate} disabled={activeStudents.length === 0}>
                <Download className="ml-2 h-4 w-4" /> تحميل نموذج حصة اليوم
              </Button>
            </div>
             {activeStudents.length === 0 && <p className="text-xs text-destructive text-center mt-2">يجب إضافة طلبة نشطين أولاً لتتمكن من تحميل النموذج.</p>}
          </CardContent>
        </Card>

    </div>
  );
}
