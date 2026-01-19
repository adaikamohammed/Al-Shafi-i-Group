
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Archive, Shield, FileText, BarChart3, Printer, Award, Tv } from 'lucide-react';


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
            icon: <Archive className="h-6 w-6" />,
            title: "1. إدارة الطلبة والسجل التأديبي الجديد",
            description: "تم تحويل ملف الطالب إلى سجل تاريخي شامل يوثق رحلته بالكامل.",
            points: [
                "عند إضافة \"مهمة تمكين\" أو \"ميثاق حفظ\"، يتم تسجيلها تلقائياً في السجل التأديبي للطالب.",
                "القوائم المنسدلة في النظام مرتبة أبجدياً لتجد الطالب فوراً دون عناء البحث.",
                "افتح ملف أي طالب من صفحة \"إدارة الطلبة\" لمشاهدة سجله التاريخي."
            ]
        },
        {
            icon: <Shield className="h-6 w-6" />,
            title: "2. دوري التميز وسوق الانتقالات",
            description: "نظام تنافسي أسبوعي وشهري لإشعال روح الحماس بين الطلاب.",
            points: [
                "النظام يختار تلقائياً \"نجم الشهر\" ويصمم له بطاقة ذهبية خاصة.",
                "راقب \"سوق الانتقالات\" (الأسهم) بجانب أسماء الطلاب لمعرفة من يتقدم ومن يتراجع.",
                "ترقب \"مباراة القمة\" كل يوم أربعاء، حيث يعلن النظام عن مواجهة حاسمة."
            ]
        },
        {
            icon: <FileText className="h-6 w-6" />,
            title: "3. منظومة التقارير الرسمية والواتساب",
            description: "أداة احترافية لإعداد وإرسال تقارير الأداء لأولياء الأمور بسهولة.",
            points: [
                "تم تحديث المهارات لتشمل \"المراجعة\" كعلامة من 10، وتوحيد مسمى \"السلوك\".",
                "بضغطة زر، يمكنك إرسال رسالة رسمية عبر واتساب لولي الأمر.",
                "الرسالة تحتوي على نص رسمي جاهز وطلب لتوقيع التقرير المرفق (PDF)."
            ]
        },
        {
            icon: <BarChart3 className="h-6 w-6" />,
            title: "4. رادار الأداء السنوي (المتطور)",
            description: "نظرة تحليلية على أداء الفوج ككتلة واحدة لمراقبة الحالة المعنوية.",
            points: [
                "يمكنك فلترة الرادار لرؤية منحنى (الحضور)، (السلوك)، (المراجعة)، أو (الحفظ).",
                "استخدم الفلترة الزمنية (أسبوعي/شهري/موسمي) لمراقبة تطور مستوى الالتزام.",
                "راقب \"مؤشر الالتزام المدمج\" لتقييم الحالة العامة للفوج بنظرة واحدة."
            ]
        },
    ];

    return (
        <div className="space-y-8">
            <Card className="bg-primary/5 border-primary">
                <CardHeader>
                    <CardTitle className="text-3xl font-headline font-bold text-primary">📘 إرشادات الشيخ: دليلك المحدث لاستخدام الموقع</CardTitle>
                    <CardDescription className="text-lg">
                        أهلاً بك شيخنا الكريم. لقد صممنا هذه الصفحة لتكون مرجعك السريع لكل الميزات الجديدة التي تجعل إدارتك للفوج أكثر ذكاءً وإثارة.
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
                    <CardTitle className="font-headline">💡 ملاحظات تقنية هامة ونصائح ختامية</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary"><Printer className="ml-1 h-4 w-4" /> نوصي باستخدام تقارير PDF الموحدة لطباعة احترافية.</Badge>
                        <Badge variant="secondary"><Award className="ml-1 h-4 w-4" /> تابع لوحة "الأرقام القياسية" في البوابة الرئيسية لتكريم المتميزين.</Badge>
                        <Badge variant="secondary"><Tv className="ml-1 h-4 w-4" /> يمكنك دائماً تغيير هوية البوابة البصرية من الزر المخصص.</Badge>
                    </div>
                    <div className="p-4 bg-green-50 text-green-800 rounded-lg border-r-4 border-green-500">
                        <p className="font-bold">نصيحة الشيخ: تذكر أن هدف هذا الموقع هو تحويل "الأرقام" إلى "أثر تربوي"؛ فالسهم الأحمر للطالب هو فرصة لتشجيعه، والبطاقة الذهبية هي وسيلة لتعزيز ثقته بنفسه.</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
