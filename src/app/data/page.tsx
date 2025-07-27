import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, Download, FileText, FileSpreadsheet } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { students } from '@/lib/data';

export default function DataExchangePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-headline font-bold">استيراد وتصدير البيانات</h1>
      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>📥 استيراد البيانات</CardTitle>
            <CardDescription>
              رفع ملف Excel يحتوي على بيانات الطلبة أو سجلات الحصص اليومية.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              يمكنك تحميل نموذج جاهز لتعبئته ثم رفعه. سيتم تحديث البيانات تلقائيًا.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button className="flex-grow">
                <Upload className="ml-2 h-4 w-4" />
                رفع ملف Excel
              </Button>
               <Button variant="outline">
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
                يشمل ملخصًا شاملاً لجميع الطلبة وأدائهم.
              </p>
              <div className="flex gap-2">
                <Button variant="secondary">
                  <FileSpreadsheet className="ml-2 h-4 w-4" />
                  تصدير Excel
                </Button>
                <Button variant="secondary">
                  <FileText className="ml-2 h-4 w-4" />
                  تصدير PDF
                </Button>
              </div>
            </div>

            <div>
              <h3 className="font-medium mb-2">تقرير طالب فردي</h3>
               <p className="text-sm text-muted-foreground mb-3">
                اختر طالبًا لتصدير تقريره المفصل.
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <Select dir="rtl">
                  <SelectTrigger className="flex-grow">
                    <SelectValue placeholder="اختر طالبًا..." />
                  </SelectTrigger>
                  <SelectContent>
                    {students.map(student => (
                      <SelectItem key={student.id} value={student.id}>
                        {student.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="secondary" className="w-full sm:w-auto">
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
