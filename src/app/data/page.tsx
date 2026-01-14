
"use client";

import React, { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, Download, History, Loader2, CalendarClock, UserPlus, Trash2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { Student, DailyRecord, SessionType, DailySession, PreRegistration, PreRegistrationStatus, MemorizationAmount, SubscriptionTier, StudentStatus } from '@/lib/types';
import { useStudentContext } from '@/context/StudentContext';
import { format, parse, startOfMonth, endOfMonth, parseISO, getDaysInMonth, isValid, startOfYear, setYear, differenceInYears } from 'date-fns';
import { ar } from 'date-fns/locale';
import { v4 as uuidv4 } from 'uuid';
import { useRouter } from 'next/navigation';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Separator } from '@/components/ui/separator';


export default function DataExchangePage() {
  const { toast } = useToast();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sessionFileInputRef = useRef<HTMLInputElement>(null);
  const monthlySessionFileInputRef = useRef<HTMLInputElement>(null);
  const preRegFileInputRef = useRef<HTMLInputElement>(null);


  const { students, addDailySession, getRecordsForDateRange, importStudents, importPreRegistrations, preRegistrations, deleteAllPreRegistrations } = useStudentContext();
  const activeStudents = (students ?? []).filter(s => s.status === 'نشط');

  // State for monthly export
  const [exportMonth, setExportMonth] = useState(new Date().getMonth());
  const [exportYear, setExportYear] = useState(new Date().getFullYear());
  
  // State for monthly import
  const [importMonth, setImportMonth] = useState(new Date().getMonth());
  const [importYear, setImportYear] = useState(new Date().getFullYear());


  const [isImportingStudents, setIsImportingStudents] = useState(false);
  const [isImportingSessions, setIsImportingSessions] = useState(false);
  const [isImportingMonthly, setIsImportingMonthly] = useState(false);
  const [isImportingPreRegs, setIsImportingPreRegs] = useState(false);


 const parseDate = (dateInput: any, age?: number): Date | string | null => {
    if (dateInput) {
        if (dateInput instanceof Date && isValid(dateInput)) return dateInput;
        if (typeof dateInput === 'string') {
            const parts = dateInput.split(/[/.-]/);
            if (parts.length === 3) {
                const day = parseInt(parts[0], 10);
                const month = parseInt(parts[1], 10) - 1;
                let year = parseInt(parts[2], 10);
                if(year < 100) year += 2000;
                const newDate = new Date(year, month, day);
                if (isValid(newDate)) return newDate;
            }
             if(parts.length === 1 && /^\d{4}$/.test(parts[0])) {
                 return dateInput;
             }
        }
        if (typeof dateInput === 'number') {
            const parsedFromExcel = XLSX.SSF.parse_date_code(dateInput);
            if(parsedFromExcel) return new Date(parsedFromExcel.y, parsedFromExcel.m - 1, parsedFromExcel.d);
        }
        try {
            const parsed = parseISO(dateInput);
            if(isValid(parsed)) return parsed;
        } catch(e) { /* ignore parse error */ }
    }
    
    // Fallback to age if birthdate is invalid or missing
    if (age && !isNaN(age)) {
        const birthYear = getYear(new Date()) - age;
        return startOfYear(setYear(new Date(), birthYear));
    }
    
    return dateInput ? dateInput.toString() : null; // Return raw string or null if parsing fails
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
        const requiredHeaders = ["الاسم الكامل"];
        const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
        if(missingHeaders.length > 0) {
            throw new Error(`ملف غير متوافق. العمود المطلوب مفقود: ${missingHeaders.join(', ')}. الرجاء استخدام النموذج الرسمي.`);
        }

        const json = XLSX.utils.sheet_to_json<any>(worksheet, { raw: false, defval: null });

        const existingStudentNames = new Set((students ?? []).map(s => s.fullName.trim().toLowerCase()));
        const newStudents: Omit<Student, 'id' | 'updatedAt' | 'memorizedSurahsCount'>[] = [];
        let skippedCount = 0;
        let invalidDateCount = 0;

        json.forEach((row, index) => {
           const fullName = (row['الاسم الكامل'] || '').trim();
           if (!fullName) return; // Skip empty rows
           
           if (existingStudentNames.has(fullName.toLowerCase())) {
               skippedCount++;
               return; // Skip duplicate student
           }
           
           let birthDate = parseDate(row['تاريخ الميلاد'], row['العمر']);
           let registrationDate = parseDate(row['تاريخ التسجيل']);

           if (!birthDate || typeof birthDate === 'string' || !isValid(birthDate as Date)) {
                birthDate = new Date(); // Default to today if both are invalid
                invalidDateCount++;
           }
           if (!registrationDate || typeof registrationDate === 'string' || !isValid(registrationDate as Date)) {
                registrationDate = new Date();
           }

           const status = row['حالة الطالب'] || 'نشط';
           if (!["نشط", "غائب طويل", "مطرود"].includes(status)) {
             throw new Error(`حالة الطالب "${status}" في الصف ${index + 2} غير صالحة. يجب أن تكون واحدة من: نشط، غائب طويل، مطرود.`);
           }

           const subscriptionTier = row['فئة الاشتراك'] || 'فئة الأصاغر';
           if (!['فئة الأصاغر', 'فئة الأكابر'].includes(subscriptionTier)) {
               throw new Error(`فئة الاشتراك "${subscriptionTier}" في الصف ${index+2} غير صالحة.`);
           }

           const dailyMemorizationAmount = row['مقدار الحفظ اليومي'] || 'صفحة';
            if (!['نصف صفحة', 'صفحة', 'ثمن', 'ربع', 'أكثر'].includes(dailyMemorizationAmount)) {
                 throw new Error(`مقدار الحفظ "${dailyMemorizationAmount}" في الصف ${index+2} غير صالح.`);
            }

           
           const studentData: Omit<Student, 'id' | 'updatedAt' | 'memorizedSurahsCount'> = {
              fullName: fullName,
              gender: row['الجنس'] || 'ذكر',
              guardianName: row['اسم الولي'] || 'N/A',
              educationalLevel: row['المستوى الدراسي'] || 'غير محدد',
              pageNumber: row['رقم الصفحة']?.toString() || '',
              phone1: row['رقم الهاتف 1']?.toString() || 'N/A',
              phone2: row['رقم الهاتف 2']?.toString() || '',
              birthDate: birthDate as Date,
              registrationDate: registrationDate as Date,
              status: status as StudentStatus,
              subscriptionTier: subscriptionTier as SubscriptionTier,
              dailyMemorizationAmount: dailyMemorizationAmount as MemorizationAmount,
              notes: row['ملاحظات عامة'] || '',
           };
           
           newStudents.push(studentData);
           existingStudentNames.add(fullName.toLowerCase());
        });
        
        if (newStudents.length > 0) {
            importStudents(newStudents);
        }
        
        let description = `تم استيراد ${newStudents.length} طالبًا جديدًا بنجاح. وتم تخطي ${skippedCount} طالبًا لوجودهم مسبقًا.`;
        if (invalidDateCount > 0) {
            description += ` تم العثور على ${invalidDateCount} تواريخ ميلاد غير صالحة وتم تعيينها إلى تاريخ اليوم مؤقتًا.`
        }

        toast({
          title: "✅ اكتمل استيراد الطلاب",
          description: description,
        });

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

  const handlePreRegFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsImportingPreRegs(true);
    
    const reader = new FileReader();
    reader.onload = (e) => {
        let newRegsCount = 0;
        let skippedCount = 0;
        try {
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array', cellDates: true });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const json = XLSX.utils.sheet_to_json<any>(worksheet, { raw: false, defval: "" });

            const newPreRegs: Omit<PreRegistration, 'id'>[] = [];

            json.forEach((row) => {
                const fullName = (row['الإسم الكامل'] || '').trim();
                 if (!fullName) return; // Skip empty rows
                
                const birthDateValue = parseDate(row['تاريخ الميلاد']);
                let finalBirthDate: Date | string = new Date(); // Default if invalid

                if (birthDateValue instanceof Date && isValid(birthDateValue)) {
                    finalBirthDate = birthDateValue;
                } else if (typeof birthDateValue === 'string') {
                    finalBirthDate = birthDateValue;
                } else if (!birthDateValue) {
                    finalBirthDate = ''; // Store as empty if null
                }
                
                const requestedAtValue = parseDate(row['تاريخ التسجيل']);
                let finalRequestedAt: Date | string = '';
                if(requestedAtValue instanceof Date && isValid(requestedAtValue)) {
                    finalRequestedAt = requestedAtValue;
                } else if (typeof requestedAtValue === 'string') {
                    finalRequestedAt = requestedAtValue;
                }

                const preRegData: Omit<PreRegistration, 'id'> = {
                    requestedAt: finalRequestedAt,
                    fullName: fullName,
                    gender: row['الجنس'] || 'ذكر',
                    birthDate: finalBirthDate,
                    educationalLevel: row['المستوى الدراسي'] || '',
                    guardianName: row['إسم الولي'] || '',
                    phone1: (row['رقم الهاتف 1']?.toString() || ''),
                    phone2: (row['رقم الهاتف 2']?.toString() || ''),
                    address: (row['مقر السكن'] || ''),
                    status: (row['الحالة'] || 'مرشح') as PreRegistrationStatus,
                    pageNumber: (row['رقم الصفحة']?.toString() || ''),
                    notes: (row['ملاحظات'] || ''),
                };
                newPreRegs.push(preRegData);
            });

            if (newPreRegs.length > 0) {
                importPreRegistrations(newPreRegs);
                newRegsCount = newPreRegs.length;
            }
            
            toast({
              title: "✅ اكتمل رفع التسجيلات",
              description: `تم رفع ${newRegsCount} سجل جديد بنجاح.`,
              action: <Button onClick={() => router.push('/registrations')}>الانتقال للقائمة</Button>
            });
            
        } catch (error) {
            console.error("Error parsing pre-registration file:", error);
            const errorMessage = error instanceof Error ? error.message : "حدث خطأ أثناء قراءة الملف. يرجى التأكد من أن الملف بالصيغة الصحيحة.";
            toast({
                title: "خطأ في استيراد التسجيلات ❌",
                description: errorMessage,
                variant: 'destructive',
            });
        } finally {
            setIsImportingPreRegs(false);
            if (preRegFileInputRef.current) preRegFileInputRef.current.value = '';
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
        let sessionNumber: 1 | 2 = 1;
        const recordsToSave: Omit<DailyRecord, 'sessionId'>[] = [];

        json.forEach((row, index) => {
            const currentSessionType = row['نوع الحصة'] as SessionType;
            const currentStudentName = row['اسم الطالب'];
            const currentDateStr = row['التاريخ'];
            const currentSessionNumber = row['رقم الحصة'] || 1;

             if (!currentDateStr) {
                errors.push(`❌ الصف رقم ${index + 2}: عمود التاريخ فارغ.`);
                return;
            }

            if (!sessionDateStr) {
                sessionDateStr = format(parse(currentDateStr, 'dd/MM/yyyy', new Date()), 'yyyy-MM-dd');
            }
            if(index === 0) sessionNumber = currentSessionNumber;

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
            
            const student = (students ?? []).find(s => s.fullName === currentStudentName);
            if (!student) {
                errors.push(`⚠️ الصف رقم ${index + 2}: لم يتم العثور على الطالب "${currentStudentName}".`);
                return;
            }
            
            recordsToSave.push({
                studentId: student.id,
                attendance: row['الحاضر'],
                behavior: row['السلوك'],
                memorization: row['التقييم'],
                review: row['مراجعة'] === 'نعم',
                notes: row['ملاحظات'],
            });
        });

        if (errors.length > 0) {
            throw new Error(errors.join('\n'));
        }
        
        const sessionId = `${sessionDateStr}-${sessionNumber}`;
        const finalRecords: DailyRecord[] = recordsToSave.map(r => ({ ...r, sessionId }));

        if (sessionDateStr && sessionType) {
             const session: DailySession = { id: sessionId, date: sessionDateStr, sessionType, sessionNumber, records: finalRecords };
             addDailySession(session);
             toast({
                title: "نجاح ✅",
                description: `تم استيراد وحفظ ${finalRecords.length} سجل حصة بنجاح للحصة رقم ${sessionNumber} ليوم ${sessionDateStr}.`,
            });
        } else if (finalRecords.length === 0 && sessionType === 'يوم عطلة' && sessionDateStr) {
             const session: DailySession = { id: sessionId, date: sessionDateStr, sessionType: 'يوم عطلة', sessionNumber, records: [] };
             addDailySession(session);
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
            
            workbook.SheetNames.forEach(sheetName => {
                // Sheet names could be '2024-05-20-1' or '2024-05-20' for backward compatibility
                const parts = sheetName.split('-');
                if (parts.length < 3) return; // Ignore invalid sheet names

                const dateStr = parts.slice(0, 3).join('-');
                const sessionNumber = parts.length > 3 ? parseInt(parts[3], 10) as 1 | 2 : 1;
                
                const worksheet = workbook.Sheets[sheetName];
                const json = XLSX.utils.sheet_to_json<any>(worksheet);

                if (json.length === 0) return;

                let sessionType: SessionType | null = null;
                const recordsToSave: Omit<DailyRecord, 'sessionId'>[] = [];

                json.forEach((row, index) => {
                   const currentSessionType = row['نوع الحصة'] as SessionType;
                   if(index === 0) sessionType = currentSessionType;
                   if (currentSessionType === 'يوم عطلة') return;

                   const studentName = row['اسم الطالب']?.trim();
                   if (!studentName) return;

                   const student = (students ?? []).find(s => s.fullName === studentName);
                   if (!student) {
                       errors.push(`لم يتم العثور على الطالب "${studentName}" في ورقة ${sheetName}`);
                       return;
                   }
                   recordsToSave.push({
                       studentId: student.id,
                       attendance: row['الحاضر'], behavior: row['السلوك'],
                       memorization: row['التقييم'], review: row['مراجعة'] === 'نعم',
                       notes: row['ملاحظات'],
                   });
                });
                
                if(sessionType) {
                    const sessionId = `${dateStr}-${sessionNumber}`;
                    const finalRecords = recordsToSave.map(r => ({...r, sessionId}));
                    const session: DailySession = { id: sessionId, date: dateStr, sessionType, sessionNumber, records: finalRecords };
                    addDailySession(session);
                    successCount++;
                }
            });


            if (errors.length > 0) {
                throw new Error(errors.join('\n'));
            }

            toast({
                title: "اكتمل الاستيراد الشهري ✅",
                description: `تم استيراد ${successCount} حصة بنجاح.`,
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
    const headers = [
        "الاسم الكامل", "الجنس", "اسم الولي", "المستوى الدراسي", "رقم الصفحة", 
        "رقم الهاتف 1", "رقم الهاتف 2", "العمر", "تاريخ الميلاد", "تاريخ التسجيل", 
        "حالة الطالب", "فئة الاشتراك", "مقدار الحفظ اليومي", "ملاحظات عامة"
    ];
    
    // Create an empty worksheet
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    
    // Set column widths
    ws['!cols'] = [ 
        { wch: 20 }, { wch: 10 }, { wch: 20 }, { wch: 15 }, { wch: 10 }, 
        { wch: 15 }, { wch: 15 }, { wch: 8 }, { wch: 15 }, { wch: 15 }, 
        { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 30 }
    ];

    // Add Data Validation for dropdowns
    ws['!dataValidation'] = [
        { sqref: 'B2:B999', type: 'list', formula1: '"ذكر,أنثى"' },
        { sqref: 'K2:K999', type: 'list', formula1: '"نشط,غائب طويل,مطرود"' },
        { sqref: 'L2:L999', type: 'list', formula1: '"فئة الأصاغر,فئة الأكابر"' },
        { sqref: 'M2:M999', type: 'list', formula1: '"نصف صفحة,صفحة,ثمن,ربع,أكثر"' },
    ];
    
    // Add example row
     const exampleRow = {
      "الاسم الكامل": "عبدالله بن محمد", "الجنس": "ذكر", "اسم الولي": "محمد الأحمد",
      "المستوى الدراسي": "3 ابتدائي", "رقم الصفحة": "15", "رقم الهاتف 1": "0501234567",
      "رقم الهاتف 2": "", "العمر": 9, "تاريخ الميلاد": "15/01/2015",
      "تاريخ التسجيل": "01/09/2023", "حالة الطالب": "نشط", "فئة الاشتراك": "فئة الأصاغر",
      "مقدار الحفظ اليومي": "صفحة", "ملاحظات عامة": "طالب مستجد"
    };
    XLSX.utils.sheet_add_json(ws, [exampleRow], { skipHeader: true, origin: 'A2' });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "نموذج الطلبة");
    XLSX.writeFile(wb, "نموذج_استيراد_الطلبة_الذكي.xlsx");
  };

  const handleDownloadPreRegTemplate = () => {
    const headers = ["تاريخ التسجيل", "الإسم الكامل", "الجنس", "تاريخ الميلاد", "المستوى الدراسي", "إسم الولي", "رقم الهاتف 1", "رقم الهاتف 2", "مقر السكن", "الحالة", "رقم الصفحة", "ملاحظات"];
    const exampleRow = {
        "تاريخ التسجيل": format(new Date(), 'dd/MM/yyyy'),
        "الإسم الكامل": "مثال ابن مثال",
        "الجنس": "ذكر",
        "تاريخ الميلاد": "01/01/2015",
        "المستوى الدراسي": "3 ابتدائي",
        "إسم الولي": "فلان الفلاني",
        "رقم الهاتف 1": "0501234567",
        "رقم الهاتف 2": "",
        "مقر السكن": "حي النور",
        "الحالة": "مرشح",
        "رقم الصفحة": "",
        "ملاحظات": "طالب جديد"
    };
    const ws = XLSX.utils.json_to_sheet([exampleRow], { header: headers });
    ws['!cols'] = headers.map(h => ({ wch: 20 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "نموذج التسجيلات");
    XLSX.writeFile(wb, "نموذج_التسجيلات_الأولية.xlsx");
  }

  const handleDownloadSessionTemplate = () => {
    const today = new Date();
    const formattedDate = format(today, 'dd/MM/yyyy');
    const dayName = format(today, 'EEEE', { locale: ar });

    const data = activeStudents.map(student => ({
      'التاريخ': formattedDate,
      'اليوم': dayName,
      'رقم الحصة': 1,
      'نوع الحصة': 'حصة أساسية',
      'اسم الطالب': student.fullName,
      'الحاضر': '', 'التقييم': '', 'السلوك': '',
      'مراجعة': 'لا', 'ملاحظات': ''
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [
      { wch: 12 }, { wch: 10 }, {wch: 10}, { wch: 15 }, { wch: 20 }, { wch: 12 }, { wch: 12 },
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

        Object.entries(monthRecords).sort(([dateA], [dateB]) => dateA.localeCompare(dateB)).forEach(([date, sessions]) => {
            sessions.forEach(session => {
                const sheetName = `${date}-${session.sessionNumber}`;
                let dataForSheet;

                 if (session.sessionType === 'يوم عطلة') {
                    dataForSheet = [{
                        'التاريخ': format(parseISO(date), 'dd/MM/yyyy'),
                        'اليوم': format(parseISO(date), 'EEEE', { locale: ar }),
                        'رقم الحصة': session.sessionNumber,
                        'نوع الحصة': 'يوم عطلة',
                    }];
                } else {
                    dataForSheet = (session.records ?? []).map(record => {
                        const student = (students ?? []).find(s => s.id === record.studentId);
                        return {
                            'التاريخ': format(parseISO(date), 'dd/MM/yyyy'),
                            'اليوم': format(parseISO(date), 'EEEE', { locale: ar }),
                            'رقم الحصة': session.sessionNumber,
                            'نوع الحصة': session.sessionType,
                            'اسم الطالب': student?.fullName || 'غير معروف',
                            'الحاضر': record.attendance || '',
                            'التقييم': record.memorization || '',
                            'السلوك': record.behavior || '',
                            'مراجعة': record.review ? 'نعم' : 'لا',
                            'ملاحظات': record.notes || '',
                        }
                    });
                }
                
                const ws = XLSX.utils.json_to_sheet(dataForSheet);
                ws['!cols'] = [
                    { wch: 12 }, { wch: 10 }, {wch: 10}, { wch: 15 }, { wch: 20 }, { wch: 12 }, { wch: 12 },
                    { wch: 12 }, { wch: 10 }, { wch: 30 }
                ];
                XLSX.utils.book_append_sheet(workbook, ws, sheetName);
            });
        });

        XLSX.writeFile(workbook, `تقرير_حصص_شهر_${format(startDate, 'yyyy-MM')}.xlsx`);
  }

  return (
    <div className="space-y-6">
      <input type="file" ref={fileInputRef} onChange={handleStudentFileUpload} accept=".xlsx, .xls" className="hidden" disabled={isImportingStudents}/>
      <input type="file" ref={sessionFileInputRef} onChange={handleSessionFileUpload} accept=".xlsx, .xls" className="hidden" disabled={isImportingSessions}/>
      <input type="file" ref={monthlySessionFileInputRef} onChange={handleMonthlySessionUpload} accept=".xlsx, .xls" className="hidden" disabled={isImportingMonthly}/>
      <input type="file" ref={preRegFileInputRef} onChange={handlePreRegFileUpload} accept=".xlsx, .xls" className="hidden" disabled={isImportingPreRegs}/>

      
      <h1 className="text-3xl font-headline font-bold">استيراد وتصدير البيانات</h1>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>📥 بيانات الطلبة</CardTitle>
            <CardDescription>
              رفع ملف Excel يحتوي على بيانات الطلبة لبدء العام الدراسي أو إضافة طلبة جدد إلى فوجك الرسمي.
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
            <CardTitle>📥 استيراد التسجيلات الأولية</CardTitle>
            <CardDescription>
              رفع ملف Excel يحتوي على طلبات التسجيل الجديدة لتظهر في صفحة "التسجيلات الجديدة" لمراجعتها.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
             <p className="text-sm text-muted-foreground">
              سيتم رفع كل الصفوف في الملف إلى قائمة التسجيلات الأولية المشتركة بين جميع المشايخ.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button className="flex-grow" onClick={() => preRegFileInputRef.current?.click()} disabled={isImportingPreRegs}>
                {isImportingPreRegs ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <UserPlus className="ml-2 h-4 w-4" />}
                {isImportingPreRegs ? 'جاري الاستيراد...' : 'رفع ملف التسجيلات'}
              </Button>
               <Button variant="outline" onClick={handleDownloadPreRegTemplate}>
                <Download className="ml-2 h-4 w-4" /> تحميل نموذج التسجيلات
              </Button>
            </div>
             <Separator className="my-4" />
                <div className="space-y-2 p-4 border-l-4 border-destructive rounded-r-lg bg-destructive/10">
                    <h4 className="font-bold text-destructive">منطقة الخطر</h4>
                    <div className="flex justify-between items-center">
                        <p className="text-sm text-destructive/80">
                            سيؤدي هذا إلى حذف جميع التسجيلات الأولية نهائياً.
                        </p>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="sm">
                                    <Trash2 className="ml-2 h-4 w-4" />
                                    مسح كل التسجيلات
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>هل أنت متأكد تمامًا؟</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        سيتم حذف جميع طلبات التسجيل الأولية نهائياً. هذا الإجراء لا يمكن التراجع عنه.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                    <AlertDialogAction onClick={deleteAllPreRegistrations}>تأكيد الحذف</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                </div>
          </CardContent>
        </Card>
      </div>

       <Card className="col-span-1 md:col-span-2 lg:col-span-3">
          <CardHeader>
            <CardTitle>🗓️ بيانات الحصص</CardTitle>
            <CardDescription>
              استيراد أو تصدير بيانات الحصص ليوم واحد أو لشهر كامل.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-4 md:col-span-1">
                 <h4 className="font-semibold">بيانات حصة اليوم</h4>
                 <p className="text-sm text-muted-foreground">
                    تنزيل نموذج ليوم واحد أو رفع سجل حصة ليوم واحد تم تعبئته مسبقًا.
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                   <Button className="flex-grow" onClick={() => sessionFileInputRef.current?.click()} disabled={isImportingSessions}>
                    {isImportingSessions ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <History className="ml-2 h-4 w-4" />}
                    {isImportingSessions ? 'جاري الاستيراد...' : 'رفع سجل اليوم'}
                  </Button>
                  <Button variant="outline" onClick={handleDownloadSessionTemplate} disabled={activeStudents.length === 0}>
                    <Download className="ml-2 h-4 w-4" /> تحميل نموذج اليوم
                  </Button>
                </div>
                 {activeStudents.length === 0 && <p className="text-xs text-destructive text-center mt-2">يجب إضافة طلبة نشطين أولاً.</p>}
            </div>

            <div className="space-y-4 md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
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
            </div>
          </CardContent>
        </Card>
    </div>
  );
}

  

    


