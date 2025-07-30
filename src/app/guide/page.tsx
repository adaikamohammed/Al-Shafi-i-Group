import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, ClipboardList, BarChart3, ArrowRightLeft, Settings, Menu, LogOut, Loader2, Calendar, Award, Gavel, Edit, BookCheck, FileText, Smartphone, Lock } from 'lucide-react';


const GuideStep = ({ icon, title, description, points }: { icon: React.ReactNode, title: string, description: string, points?: string[] }) => (
    <Card className="shadow-md">
        <CardHeader className="flex flex-row items-center gap-4">
            <div className="bg-primary text-primary-foreground p-3 rounded-full">
                {icon}
            </div>
            <div>
                <CardTitle className="font-headline text-xl">{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </div>
        </CardHeader>
        {points && (
            <CardContent>
                <ul className="space-y-2 list-disc pr-6 text-muted-foreground">
                    {points.map((point, index) => <li key={index}>{point}</li>)}
                </ul>
            </CardContent>
        )}
    </Card>
);

export default function GuidePage() {
    const guideSteps = [
        {
            icon: <Lock className="h-6 w-6" />,
            title: "1. تسجيل الدخول",
            description: "اكتب بريدك وكلمة السر، ثم اضغط \"تسجيل الدخول\". إذا نسيت كلمة السر، يمكنك طلب إعادة تعيينها.",
        },
        {
            icon: <Users className="h-6 w-6" />,
            title: "2. إضافة الطلبة",
            description: "من القائمة الجانبية اختر \"إدارة الطلبة\" ثم اضغط \"➕ إضافة طالب جديد\".",
            points: [
                "املأ الاسم والعمر والتقدير التقريبي للحفظ.",
                "لا تقلق، كل الحقول سهلة ويمكن تعديلها لاحقًا.",
                "يمكنك ترك رقم الهاتف أو اسم الولي فارغًا إذا لم يتوفر."
            ]
        },
        {
            icon: <ClipboardList className="h-6 w-6" />,
            title: "3. تسجيل حصة يومية",
            description: "اذهب إلى \"الحصص اليومية\"، اختر اليوم، وسجل الحضور والتقييم لكل طالب.",
            points: [
                "اختر نوع الحصة (أساسية، أنشطة، عطلة...).",
                "سجل حضور الطالب وتقييمه وسلوكه.",
                "أضف ملاحظات خاصة إذا لزم الأمر، ثم اضغط \"حفظ بيانات اليوم\"."
            ]
        },
        {
            icon: <BookCheck className="h-6 w-6" />,
            title: "4. تسجيل حفظ السور",
            description: "من صفحة \"متابعة الحفظ\"، اختر الطالب، ثم انقر على السور التي أتم حفظها لتحديث تقدمه.",
        },
        {
            icon: <FileText className="h-6 w-6" />,
            title: "5. استخراج تقرير شامل",
            description: "من صفحة \"تقرير الطالب\"، اختر الطالب، ثم اختر الفترة:",
            points: [
                "تقرير شهري، أو موسمي، أو سنوي.",
                "يمكنك تحميل التقرير كـ Word أو PDF.",
            ]
        },
        {
            icon: <BarChart3 className="h-6 w-6" />,
            title: "6. تقييم الأداء الذكي",
            description: "يمكنك معرفة تقييم شامل لأداء فوجك من \"الإحصائيات الشهرية\"، مع اقتراحات لتحسينه.",
        },
    ];

    return (
        <div className="space-y-8">
            <Card className="bg-primary/5 border-primary">
                <CardHeader>
                    <CardTitle className="text-3xl font-headline font-bold text-primary">📘 إرشادات الشيخ: دليلك المبسّط لاستخدام الموقع</CardTitle>
                    <CardDescription className="text-lg">
                        أهلًا بك شيخنا الكريم. أنشأنا هذه الصفحة خصيصًا لتكون مرشدك خطوة بخطوة في استخدام الموقع بسهولة تامة. كل شيء هنا بسيط ولا يحتاج أي خبرة مسبقة 👨‍🏫.
                    </CardDescription>
                </CardHeader>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {guideSteps.map((step, index) => (
                    <GuideStep key={index} {...step} />
                ))}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="font-headline">💡 ملاحظات إضافية ونصيحة ختامية</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary"><Smartphone className="ml-1 h-4 w-4" /> يعمل على الهاتف بسهولة</Badge>
                        <Badge variant="secondary"><Edit className="ml-1 h-4 w-4" /> يمكنك تعديل أو حذف أي شيء</Badge>
                        <Badge variant="secondary"><Lock className="ml-1 h-4 w-4" /> كل بياناتك محفوظة وآمنة</Badge>
                    </div>
                    <div className="p-4 bg-green-50 text-green-800 rounded-lg border-r-4 border-green-500">
                        <p className="font-bold">لا تقلق من استخدام الموقع! فقط جرّب، وإذا أخطأت يمكنك التعديل بسهولة. نحن هنا لمساعدتك في كل خطوة.</p>
                        <p className="mt-2">📞 للاستفسار، تواصل مع الإدارة.</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
