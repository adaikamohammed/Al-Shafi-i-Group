"use client";

import React, { useRef } from 'react';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, Download, FileText, FileSpreadsheet } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { students as mockStudents } from '@/lib/data'; // Will be empty now
import { useToast } from '@/hooks/use-toast';
import type { Student } from '@/lib/types';


export default function DataExchangePage() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json<any>(worksheet);
        
        // This is where you would typically send the data to your backend/DB
        // For now, we'll just log it and show a success message.
        console.log("Parsed Students:", json);
        
        const newStudents: Student[] = json.map((row, index) => ({
          id: `imported-${Date.now()}-${index}`,
          fullName: row['الاسم الكامل'] || 'N/A',
          guardianName: row['اسم الولي'] || 'N/A',
          phone1: row['رقم الهاتف']?.toString() || 'N/A',
          birthDate: row['تاريخ الميلاد'] instanceof Date ? row['تاريخ الميلاد'] : new Date(),
          registrationDate: row['تاريخ التسجيل'] instanceof Date ? row['تاريخ التسجيل'] : new Date(),
          status: 'نشط', // All imported students are active
          memorizedSurahsCount: 0, // Default value
          dailyMemorizationAmount: 'صفحة', // Default value
          notes: row['ملاحظات'] || '',
        }));

        // Here you would typically update your global state or database
        console.log("Formatted new students:", newStudents);
        
        toast({
          title: "نجاح ✅",
          description: `تم استيراد ${newStudents.length} طالبًا بنجاح.`,
        });

      } catch (error) {
        console.error("Error parsing Excel file:", error);
        toast({
          title: "خطأ في الاستيراد ❌",
          description: "حدث خطأ أثناء قراءة الملف. يرجى التأكد من أن الملف بالصيغة الصحيحة.",
          variant: 'destructive',
        });
      }
    };
    reader.readAsArrayBuffer(file);
    
    // Reset file input
    if(fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };

  const handleDownloadTemplate = () => {
    const headers = [
      "الاسم الكامل", "اسم الولي", "رقم الهاتف", 
      "تاريخ الميلاد", "تاريخ التسجيل", "ملاحظات"
    ];
    // Example row to guide the user
    const exampleRow = {
      "الاسم الكامل": "عبدالله بن محمد",
      "اسم الولي": "محمد الأحمد",
      "رقم الهاتف": "0501234567",
      "تاريخ الميلاد": "2012-01-15",
      "تاريخ التسجيل": "2023-09-01",
      "ملاحظات": "طالب مستجد"
    };

    const ws = XLSX.utils.json_to_sheet([exampleRow], { header: headers });
    
    // Set column widths for better readability
    ws['!cols'] = [
        { wch: 20 }, { wch: 20 }, { wch: 15 },
        { wch: 15 }, { wch: 15 }, { wch: 30 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "نموذج الطلبة");
    XLSX.writeFile(wb, "نموذج_استيراد_الطلبة.xlsx");
  };

  return (
    <div className="space-y-6">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".xlsx, .xls"
        className="hidden"
      />
      <h1 className="text-3xl font-headline font-bold">استيراد وتصدير البيانات</h1>
      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>📥 استيراد البيانات</CardTitle>
            <CardDescription>
              رفع ملف Excel يحتوي على بيانات الطلبة لبدء العام الدراسي.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              قم بتحميل النموذج الفارغ، واملأه ببيانات الطلبة الجدد، ثم ارفعه هنا. سيتم تعيين حالتهم إلى "نشط" تلقائيًا.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button className="flex-grow" onClick={() => fileInputRef.current?.click()}>
                <Upload className="ml-2 h-4 w-4" />
                رفع ملف Excel
              </Button>
               <Button variant="outline" onClick={handleDownloadTemplate}>
                <Download className="ml-2 h-4 w-4" />
                تحميل النموذج
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>📤 تصدير البيانات</CardTitle>
            <CardDescription>
              تصدير تقارير شاملة للفوج أو تقارير فردية للطلبة بصيغ مختلفة.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="font-medium mb-2">تقرير الفوج الكامل</h3>
              <p className="text-sm text-muted-foreground mb-3">
                يشمل ملخصًا شاملاً لجميع الطلبة وأدائهم. (قيد التطوير)
              </p>
              <div className="flex gap-2">
                <Button variant="secondary" disabled>
                  <FileSpreadsheet className="ml-2 h-4 w-4" />
                  تصدير Excel
                </Button>
                <Button variant="secondary" disabled>
                  <FileText className="ml-2 h-4 w-4" />
                  تصدير PDF
                </Button>
              </div>
            </div>

            <div>
              <h3 className="font-medium mb-2">تقرير طالب فردي</h3>
               <p className="text-sm text-muted-foreground mb-3">
                اختر طالبًا لتصدير تقريره المفصل. (قيد التطوير)
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <Select dir="rtl" disabled>
                  <SelectTrigger className="flex-grow">
                    <SelectValue placeholder="اختر طالبًا..." />
                  </SelectTrigger>
                  <SelectContent>
                    {mockStudents.map(student => (
                      <SelectItem key={student.id} value={student.id}>
                        {student.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="secondary" className="w-full sm:w-auto" disabled>
                   <Download className="ml-2 h-4 w-4" />
                   تصدير تقرير الطالب
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
