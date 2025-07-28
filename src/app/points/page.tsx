
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const pointsData = {
    attendance: [
        { state: '✅ حاضر', points: '+3', notes: 'مشاركة كاملة في الحصة' },
        { state: '⏰ متأخر', points: '+1', notes: 'تم الحضور لكن بعد بداية الحصة' },
        { state: '🔄 تعويض', points: '+1.5', notes: 'تعويض غياب سابق' },
        { state: '❌ غائب', points: '-2', notes: 'غياب غير مبرر' },
    ],
    evaluation: [
        { state: 'ممتاز', points: '+3', notes: 'حفظ كامل ومتقن' },
        { state: 'جيد', points: '+2', notes: 'بعض الأخطاء البسيطة' },
        { state: 'متوسط', points: '+1', notes: 'أداء يحتاج تحسين' },
        { state: 'ضعيف', points: '0', notes: 'لم يُتقن الحفظ' },
    ],
    behavior: [
        { state: 'هادئ', points: '+2', notes: 'التزام كامل واحترام' },
        { state: 'متوسط', points: '+1', notes: 'بعض الملاحظات' },
        { state: 'غير منضبط', points: '-1', notes: 'تشويش/عدم التزام' },
    ],
    review: [
        { state: 'تمت المراجعة', points: '+1', notes: 'أكمل مراجعة الجزء المحدد' },
        { state: 'لم تتم', points: '0', notes: 'لم يُراجع المطلوب' },
    ]
};

const PointsCategory = ({ title, data, headers }: { title: string, data: {state: string, points: string, notes: string}[], headers: string[] }) => (
    <div className="space-y-4">
        <h3 className="text-xl font-headline font-bold text-primary border-b-2 border-border pb-2">{title}</h3>
        <Card>
            <CardContent className="p-0">
                <Table>
                    <TableHeader>
                        <TableRow>
                            {headers.map(header => <TableHead key={header} className="text-center">{header}</TableHead>)}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {data.map((row, index) => (
                            <TableRow key={index}>
                                <TableCell className="text-center font-medium">{row.state}</TableCell>
                                <TableCell className="text-center font-bold text-lg">{row.points}</TableCell>
                                <TableCell className="text-center text-muted-foreground">{row.notes}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    </div>
);


export default function PointsSystemPage() {
  return (
    <div className="space-y-8">
      <Card>
          <CardHeader>
              <CardTitle className="text-3xl font-headline font-bold">🎯 نظام النقاط المعتمد لتقييم الطلبة</CardTitle>
              <CardDescription className="text-lg">
                هذه الصفحة توضح بالتفصيل آلية احتساب النقاط لجميع الطلبة، بحيث يمكن لكل شيخ معرفة كيف يتم احتساب أداء الطالب النهائي، والتأثير الفعلي لكل عنصر (الحضور، السلوك، التقييم، المراجعة).
              </CardDescription>
          </CardHeader>
      </Card>

      <PointsCategory title="📅 الحضور والانضباط" data={pointsData.attendance} headers={['الحالة', 'النقاط', 'ملاحظات']} />
      <PointsCategory title="📚 تقييم الحفظ" data={pointsData.evaluation} headers={['التقييم', 'النقاط', 'ملاحظات']} />
      <PointsCategory title="🧘‍♂️ السلوك" data={pointsData.behavior} headers={['السلوك', 'النقاط', 'ملاحظات']} />
      <PointsCategory title="🔁 المراجعة" data={pointsData.review} headers={['الحالة', 'النقاط', 'ملاحظات']} />

       <Card className="border-primary bg-primary/10">
          <CardHeader>
              <CardTitle className="text-primary">💡 خلاصة نظام النقاط</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-primary/90">
             <p>✅ مجموع النقاط اليومية يتغير حسب عدة عوامل لضمان تقييم عادل وشامل.</p>
             <p>✅ كثرة الحضور والمشاركة ترفع النقاط بشكل كبير.</p>
             <p>✅ الغياب غير المبرر يؤثر سلبًا على مجموع الطالب لتحفيزه على الالتزام.</p>
             <p>✅ السلوك المنضبط جزء أساسي من التقييم، حيث يرفع أو يخفض من الأداء.</p>
             <p>✅ التقييم اليومي للحفظ هو المقياس الأساسي للمستوى العلمي للطالب ويعكس جهده المباشر.</p>
          </CardContent>
       </Card>

    </div>
  );
}
