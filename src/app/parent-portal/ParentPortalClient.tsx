"use client";

import React, { useMemo, useState, useEffect } from 'react';
import { useStudentContext } from '@/context/StudentContext';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, AlertTriangle, Star, Award, ShieldAlert, BookOpen, UserCheck, Wallet, ChevronsUpDown, Check, Users, Lock, KeyRound, ArrowRightLeft } from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, getYear, getMonth } from 'date-fns';
import { ar } from 'date-fns/locale';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend } from 'recharts';
import type { Student } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { surahs as allSurahs } from '@/lib/surahs';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/lib/firebase';
import { ref, get } from 'firebase/database';
import { isValid } from 'date-fns';


const calculateAge = (birthDate?: Date) => {
    if (!birthDate) return 'N/A';
    const ageDifMs = Date.now() - new Date(birthDate).getTime();
    const ageDate = new Date(ageDifMs);
    return Math.abs(ageDate.getUTCFullYear() - 1970);
};

const ParentPortalContent = ({ 
    student, 
    students,
    dailySessions,
    surahProgress,
    settings,
    loading,
    onVerificationSuccess 
}: { 
    student: Student | null, 
    students: Student[],
    dailySessions: any,
    surahProgress: any,
    settings: any,
    loading: boolean,
    onVerificationSuccess?: () => void 
}) => {
    const { user: authUser } = useAuth();
    const { toast } = useToast();
    const [phoneInput, setPhoneInput] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);
    const [isVerified, setIsVerified] = useState(!!authUser); // Sheikh is always verified
    const verificationKey = student ? `parent-portal-verified-${student.id}` : '';

    useEffect(() => {
        if (!student || authUser) return; // Skip if Sheikh is logged in
        const storedVerification = localStorage.getItem(verificationKey);
        if (storedVerification) {
            const { timestamp } = JSON.parse(storedVerification);
            const isStillValid = (new Date().getTime() - timestamp) < (30 * 24 * 60 * 60 * 1000); // 30 days
            if (isStillValid) {
                setIsVerified(true);
                if (onVerificationSuccess) onVerificationSuccess();
            } else {
                localStorage.removeItem(verificationKey);
            }
        }
    }, [student, verificationKey, onVerificationSuccess, authUser]);


    const handleVerification = () => {
        setIsVerifying(true);
        if (!student || !phoneInput) {
            toast({ title: "خطأ", description: "الرجاء إدخال رقم الهاتف.", variant: "destructive" });
            setIsVerifying(false);
            return;
        }

        const formattedInput = phoneInput.replace(/\s+/g, '');
        const phone1 = student.phone1?.replace(/\s+/g, '');
        const phone2 = student.phone2?.replace(/\s+/g, '');

        if (!phone1 && !phone2) {
            toast({ title: "رقم الهاتف غير مسجل", description: "لا يوجد رقم هاتف مسجل لولي الأمر في سجلات الطالب. يرجى الاتصال بالإدارة.", variant: "destructive" });
            setIsVerifying(false);
            return;
        }

        if ((phone1 && formattedInput === phone1) || (phone2 && formattedInput === phone2)) {
            localStorage.setItem(verificationKey, JSON.stringify({ verified: true, timestamp: new Date().getTime() }));
            setIsVerified(true);
            if (onVerificationSuccess) onVerificationSuccess();
            toast({ title: "✅ تم التحقق بنجاح", description: "أهلاً بك ولي أمر الطالب." });
        } else {
            toast({ title: "رقم هاتف غير صحيح", description: "الرقم المدخل لا يتطابق مع سجلاتنا. يرجى المحاولة مرة أخرى.", variant: "destructive" });
        }
        setIsVerifying(false);
    };

    const studentData = useMemo(() => {
        if (loading || !student) return null;

        if ((student as any).isPublicReport) {
            const radarData = [
                { subject: 'الحاضر', score: parseFloat(((student as any).attendanceRate || 0).toFixed(1)), fullMark: 10 },
                { subject: 'الحفظ', score: parseFloat(((student as any).memorizationScore || 0).toFixed(1)), fullMark: 10 },
                { subject: 'الانضباط', score: parseFloat(((student as any).disciplineScore || 0).toFixed(1)), fullMark: 10 },
            ];

            return {
                rank: (student as any).rank || null,
                medal: (student as any).medal || null,
                radarData,
                uncompensatedAbsences: (student as any).uncompensatedAbsences || 0,
                activeCovenant: (student as any).activeCovenant || null,
                currentPoints: (student as any).currentPoints || 0,
                latestBadge: (student as any).latestBadge || null
            };
        }

        const pointsConfig = settings.points;
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();

        const monthStartDate = startOfMonth(new Date());
        const monthEndDate = endOfMonth(new Date());

        const sessionsInMonth = Object.values(dailySessions as Record<string, any> ?? {}).flatMap((sessionsOnDate: any) =>
            Object.values(sessionsOnDate || {}).filter((session: any) => {
                if (!session?.date) return false;
                try {
                    const sessionDate = parseISO(session.date);
                    return sessionDate >= monthStartDate && sessionDate <= monthEndDate;
                } catch (e) { return false; }
            })
        );

        const studentScores: Record<string, any> = {};
        (students ?? []).filter(s => s.status === 'نشط').forEach(s => {
            studentScores[s.id] = { id: s.id, points: 0, stats: { absent: 0, makeup: 0, calm: 0, medium: 0, undisciplined: 0 } };
        });

        sessionsInMonth.forEach((session: any) => {
            (session.records ?? []).forEach((record: any) => {
                if (studentScores[record.studentId]) {
                    studentScores[record.studentId].points += (pointsConfig.attendance[record.attendance as keyof typeof pointsConfig.attendance] || 0);
                    studentScores[record.studentId].points += (pointsConfig.evaluation[record.memorization as keyof typeof pointsConfig.evaluation] || 0);
                    studentScores[record.studentId].points += (pointsConfig.behavior[record.behavior as keyof typeof pointsConfig.behavior] || 0);
                    if (record.review && pointsConfig.review?.completed) {
                        studentScores[record.studentId].points += pointsConfig.review.completed;
                    }
                    if (record.bonus) {
                        const BONUS_POINTS: Record<string, number> = {
                            'مشاركة مميزة': 1,
                            'تفاعل إيجابي': 1.5,
                            'انضباط متميز': 2,
                            'حفظ زائد': 3,
                            'لا يوجد': 0,
                            '': 0
                        };
                        studentScores[record.studentId].points += BONUS_POINTS[record.bonus] ?? 0;
                    }
                    if (record.attendance === 'غائب') studentScores[record.studentId].stats.absent++;
                    if (record.attendance === 'تعويض') studentScores[record.studentId].stats.makeup++;
                    if (record.behavior === 'هادئ') studentScores[record.studentId].stats.calm++;
                    if (record.behavior === 'متوسط' || record.behavior === 'مقبول') studentScores[record.studentId].stats.medium++;
                    if (record.behavior === 'غير منضبط' || record.behavior === 'مشاغب') studentScores[record.studentId].stats.undisciplined++;
                }
            });
        });

        const rankedStudents = Object.values(studentScores).sort((a: any, b: any) => b.points - a.points);
        const rankIndex = rankedStudents.findIndex(s => s.id === student.id);
        const rank = rankIndex !== -1 ? rankIndex + 1 : null;

        const currentPoints = studentScores[student.id]?.points || 0;
        const studentStats = studentScores[student.id]?.stats || { absent: 0, makeup: 0, calm: 0, medium: 0, undisciplined: 0 };
        const uncompensatedAbsences = studentStats.absent - studentStats.makeup;

        let medal: 'gold' | 'silver' | 'bronze' | null = null;
        if (rank === 1 && uncompensatedAbsences <= 0 && studentStats.calm > (studentStats.medium + studentStats.undisciplined)) {
            medal = 'gold';
        } else if (rank === 2 && uncompensatedAbsences <= 1) {
            medal = 'silver';
        } else if (rank === 3 && uncompensatedAbsences <= 2) {
            medal = 'bronze';
        }

        const studentMastery = surahProgress[student.id] || {};
        const masteredCount = Object.values(studentMastery as Record<string, any>).filter((s: any) => s.status === 2).length;

        const studentRecordsInMonth = sessionsInMonth.flatMap((s: any) => s.records ?? []).filter((r: any) => r.studentId === student.id);
        const attendanceScore = studentRecordsInMonth.length > 0 ? ((studentRecordsInMonth.filter((r: any) => r.attendance === 'حاضر' || r.attendance === 'متأخر').length) / studentRecordsInMonth.length) * 10 : 0;
        const disciplineScore = studentRecordsInMonth.length > 0 ? ((studentRecordsInMonth.filter((r: any) => r.behavior === 'هادئ').length * 2 + studentRecordsInMonth.filter((r: any) => r.behavior === 'متوسط' || r.behavior === 'مقبول').length * 1) / (studentRecordsInMonth.length * 2)) * 10 : 0;
        const memorizationScore = (masteredCount / allSurahs.length) * 10;

        const radarData = [
            { subject: 'الحاضر', score: parseFloat(attendanceScore.toFixed(1)), fullMark: 10 },
            { subject: 'الحفظ', score: parseFloat(memorizationScore.toFixed(1)), fullMark: 10 },
            { subject: 'الانضباط', score: parseFloat(disciplineScore.toFixed(1)), fullMark: 10 },
        ];

        const activeCovenant = (student.covenants || []).find(c => c.status === 'نشط' && c.card !== 'بدون');
        const latestBadge = settings.badges?.find((b: any) => b.id === 'mastery_king' && currentPoints >= b.threshold);

        return { rank, medal, radarData, uncompensatedAbsences, activeCovenant, currentPoints, latestBadge };

    }, [student, students, dailySessions, surahProgress, settings, loading]);

    if (!student) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[300px] bg-gray-50 text-center p-4 rounded-lg border-2 border-dashed">
                <Users className="h-16 w-16 text-muted-foreground mb-4" />
                <h1 className="text-2xl font-bold">بوابة ولي الأمر</h1>
                <p className="text-muted-foreground mt-2">الرجاء اختيار اسم ابنك من القائمة أعلاه لعرض بياناته.</p>
            </div>
        )
    }

    if (!isVerified) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[300px] bg-gray-100 p-4 rounded-lg">
                <Card className="w-full max-w-md">
                    <CardHeader className="text-center">
                        <div className="mx-auto bg-primary text-primary-foreground rounded-full p-3 w-fit mb-4">
                            <KeyRound className="h-8 w-8" />
                        </div>
                        <CardTitle>بوابة التحقق لولي الأمر</CardTitle>
                        <CardDescription>
                            للوصول إلى بيانات الطالب <span className="font-bold">{student.fullName}</span>، يرجى إدخال أحد أرقام هواتف ولي الأمر المسجلة لدينا.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="phone-input">رقم هاتف ولي الأمر</Label>
                            <Input
                                id="phone-input"
                                type="tel"
                                dir="ltr"
                                placeholder="05XXXXXXXX"
                                value={phoneInput}
                                onChange={(e) => setPhoneInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleVerification()}
                            />
                        </div>
                        <Button onClick={handleVerification} disabled={isVerifying} className="w-full">
                            {isVerifying && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                            تحقق من الهوية والمتابعة
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <Loader2 className="h-16 w-16 animate-spin text-primary" />
            </div>
        );
    }

    if (!studentData) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 text-center p-4">
                <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
                <h1 className="text-3xl font-bold text-destructive">عذراً، حدث خطأ</h1>
                <p className="text-muted-foreground mt-2">لا يمكن تحميل بيانات الطالب. الرجاء المحاولة مرة أخرى.</p>
            </div>
        )
    }

    const { rank, medal, radarData, uncompensatedAbsences, activeCovenant, currentPoints, latestBadge } = studentData;
    const medalClasses = {
        gold: 'border-yellow-400',
        silver: 'border-gray-400',
        bronze: 'border-orange-400',
    };

    return (
        <div className="min-h-screen bg-gray-50 p-4 md:p-8">
            <div className="max-w-4xl mx-auto">
                <header className="flex flex-col md:flex-row items-center gap-6 p-6 bg-white rounded-xl shadow-lg border-b-4 border-primary mb-8">
                    <Avatar className={cn("w-28 h-28 border-4", medal ? (medalClasses as any)[medal] : 'border-muted')}>
                        <AvatarImage src={student.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${student.fullName}`} alt={student.fullName} />
                        <AvatarFallback>{student.fullName.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="text-center md:text-right">
                        <h1 className="text-3xl font-bold text-primary">{student.fullName}</h1>
                        <p className="text-muted-foreground">{calculateAge(student.birthDate)} سنة</p>
                        <div className="flex items-center justify-center md:justify-start gap-4 mt-2">
                            {medal && rank && (
                                <Badge variant="default" className="text-lg bg-gradient-to-r from-yellow-400 to-amber-500 text-white">
                                    {rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉'} المركز {rank} (شهرياً)
                                </Badge>
                            )}
                            {latestBadge && (
                                <Badge variant="secondary" className="text-md">
                                    <Award className="ml-1 h-4 w-4" /> {latestBadge.name}
                                </Badge>
                            )}
                        </div>
                    </div>
                </header>

                <main className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <Card className="lg:col-span-2">
                        <CardHeader>
                            <CardTitle>🎯 رادار المهارات</CardTitle>
                        </CardHeader>
                        <CardContent className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                                    <PolarGrid />
                                    <PolarAngleAxis dataKey="subject" />
                                    <PolarRadiusAxis angle={30} domain={[0, 10]} />
                                    <Radar name="التقييم" dataKey="score" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.6} />
                                    <Legend />
                                </RadarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>

                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2"><UserCheck className="text-blue-500" /> ميزان الالتزام</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {uncompensatedAbsences > 0 ? (
                                    <>
                                        <p className="text-2xl font-bold text-destructive">{uncompensatedAbsences}</p>
                                        <p className="text-sm text-muted-foreground">حصص غياب غير معوضة.</p>
                                    </>
                                ) : (
                                    <p className="font-semibold text-green-600">لا يوجد غياب مستحق للتعويض. أحسنت!</p>
                                )}
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2"><Wallet className="text-green-500" /> محفظة النقاط</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-3xl font-bold text-green-600">{currentPoints.toFixed(0)}</p>
                                <p className="text-sm text-muted-foreground">نقطة مكتسبة هذا الشهر.</p>
                            </CardContent>
                        </Card>
                    </div>

                    {activeCovenant && (
                        <Card className="md:col-span-2 lg:col-span-3 border-2 border-red-400 bg-red-50/50">
                            <CardHeader>
                                <CardTitle className="text-red-700 flex items-center gap-2">
                                    <ShieldAlert /> تنبيه: وثيقة ميثاق نشطة
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                <p><span className="font-semibold">نوع الميثاق:</span> {activeCovenant.type} ({activeCovenant.card})</p>
                                <blockquote className="p-3 bg-red-100 border-r-4 border-red-300 italic">
                                    "{activeCovenant.text}"
                                </blockquote>
                                <p className="text-sm text-muted-foreground pt-2">
                                    هذه الوثيقة تهدف إلى مساعدة الطالب على تحسين جانب معين. نرجو منكم المتابعة والتشجيع.
                                </p>
                            </CardContent>
                        </Card>
                    )}

                    {student.transferHistory && student.transferHistory.length > 0 && (
                        <Card className="md:col-span-2 lg:col-span-3">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <ArrowRightLeft className="text-blue-500" /> سجل التنقلات
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {[...student.transferHistory].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((record, index) => (
                                        <div key={index} className="flex flex-col border-b last:border-0 pb-3 last:pb-0">
                                            <div className="flex items-center justify-between">
                                                <p className="text-sm font-medium">
                                                    تم نقله من <span className="font-bold text-primary">{record.fromSheikhName || 'غير معروف'}</span> <span className="text-xs text-muted-foreground">({record.fromGroupName || 'غير محدد'})</span> إلى <span className="font-bold text-primary">{record.toSheikhName || 'غير معروف'}</span> <span className="text-xs text-muted-foreground">({record.toGroupName || 'غير محدد'})</span>
                                                </p>
                                                <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded-full">
                                                    {format(parseISO(record.date), 'dd/MM/yyyy')}
                                                </span>
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-1 text-right">
                                                <span className="font-semibold">السبب:</span> {record.reason}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </main>
                <footer className="text-center text-xs text-muted-foreground mt-12">
                    <p>هذه الصفحة هي بوابة لمتابعة الأداء اللحظي للطالب.</p>
                    <p>تم إنشاؤها بواسطة نظام إدارة مدرسة الإمام الشافعي - {format(new Date(), 'yyyy')}</p>
                </footer>
            </div>
        </div>
    );
};


export default function ParentPortalStudentPage() {
    const { 
        students: contextStudents, 
        dailySessions: contextSessions, 
        surahProgress: contextProgress, 
        settings: contextSettings, 
        loading: contextLoading 
    } = useStudentContext();
    const { user: authUser } = useAuth();
    const params = useParams();
    const searchParams = useSearchParams();

    const [portalData, setPortalData] = useState<{
        student: Student | null;
        dailySessions: any;
        surahProgress: any;
        settings: any;
        students: Student[];
        loading: boolean;
    }>({
        student: null,
        dailySessions: {},
        surahProgress: {},
        settings: {},
        students: [],
        loading: true,
    });

    const studentID = useMemo(() => {
        const pId = params?.studentID as string;
        const qId = searchParams.get('id');
        if (pId && pId !== '1') return pId;
        return qId;
    }, [params, searchParams]);

    // Scenario A: Sheikh/Admin is logged in
    useEffect(() => {
        if (authUser && !contextLoading) {
            const student = contextStudents.find(s => s.id === studentID) || null;
            setPortalData({
                student,
                dailySessions: contextSessions,
                surahProgress: contextProgress,
                settings: contextSettings,
                students: contextStudents,
                loading: false
            });
        }
    }, [authUser, contextLoading, contextStudents, contextSessions, contextProgress, contextSettings, studentID]);

    // Scenario B: Visitor is a parent (anonymous)
    useEffect(() => {
        if (!authUser) {
            if (!studentID) {
                setPortalData(prev => ({ ...prev, loading: false }));
                return;
            }

            setPortalData(prev => ({ ...prev, loading: true }));
            const reportRef = ref(db, `public_student_reports/${studentID}`);
            get(reportRef).then((snapshot: any) => {
                const reportData = snapshot.val();
                if (!reportData) {
                    setPortalData(prev => ({ ...prev, loading: false }));
                    return;
                }

                const s = reportData.student;
                if (!s) {
                    setPortalData(prev => ({ ...prev, loading: false }));
                    return;
                }

                const parsedStudent: Student = {
                    ...s,
                    birthDate: s.birthDate ? parseISO(s.birthDate) : new Date(),
                    registrationDate: s.registrationDate ? parseISO(s.registrationDate) : new Date(),
                    updatedAt: s.updatedAt ? parseISO(s.updatedAt) : new Date(),
                    covenants: s.covenants ? Object.values(s.covenants) : [],
                };

                setPortalData({
                    student: parsedStudent,
                    dailySessions: reportData.studentData || {},
                    surahProgress: {},
                    settings: contextSettings,
                    students: [], // Not needed on client since isPublicReport is true
                    loading: false
                });
            }).catch((err: any) => {
                console.error("Error fetching student publicly:", err);
                setPortalData(prev => ({ ...prev, loading: false }));
            });
        }
    }, [authUser, studentID, contextSettings]);

    const isLoading = authUser ? contextLoading : portalData.loading;

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <Loader2 className="h-16 w-16 animate-spin text-primary" />
            </div>
        );
    }

    if (!portalData.student && !isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center p-4">
                <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
                <h1 className="text-3xl font-bold text-destructive">الطالب غير موجود</h1>
                <p className="text-muted-foreground mt-2">لا يمكن العثور على الطالب المطلوب. قد يكون الرابط غير صحيح.</p>
                <Link href="/league">
                    <Button variant="outline" className="mt-4">العودة إلى دوري التميز</Button>
                </Link>
            </div>
        );
    }

    return (
        <ParentPortalContent 
            student={portalData.student} 
            students={portalData.students}
            dailySessions={portalData.dailySessions}
            surahProgress={portalData.surahProgress}
            settings={portalData.settings}
            loading={isLoading}
        />
    );
}
