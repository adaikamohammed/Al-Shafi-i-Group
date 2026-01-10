
"use client";

import React, { useMemo, useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useStudentContext } from '@/context/StudentContext';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, AlertTriangle, Star, Award, ShieldAlert, BookOpen, UserCheck, Wallet, ChevronsUpDown, Check, Users, Lock, KeyRound } from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, getYear, getMonth } from 'date-fns';
import { ar } from 'date-fns/locale';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend } from 'recharts';
import type { Student, DailySession } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { surahs as allSurahs } from '@/lib/surahs';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';


const calculateAge = (birthDate?: Date) => {
  if (!birthDate) return 'N/A';
  const ageDifMs = Date.now() - new Date(birthDate).getTime();
  const ageDate = new Date(ageDifMs);
  return Math.abs(ageDate.getUTCFullYear() - 1970);
};

const ParentPortalContent = ({ studentID, onVerificationSuccess }: { studentID: string, onVerificationSuccess?: () => void }) => {
    const { students, dailySessions, surahProgress, settings, loading } = useStudentContext();
    const { toast } = useToast();
    const [phoneInput, setPhoneInput] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);
    const [isVerified, setIsVerified] = useState(false);
    const verificationKey = `parent-portal-verified-${studentID}`;

    const student = useMemo(() => students.find(s => s.id === studentID), [students, studentID]);

    useEffect(() => {
        const storedVerification = localStorage.getItem(verificationKey);
        if(storedVerification) {
            const { timestamp } = JSON.parse(storedVerification);
            const isStillValid = (new Date().getTime() - timestamp) < (30 * 24 * 60 * 60 * 1000); // 30 days
            if(isStillValid) {
                setIsVerified(true);
                 if(onVerificationSuccess) onVerificationSuccess();
            } else {
                localStorage.removeItem(verificationKey);
            }
        }
    }, [studentID, verificationKey, onVerificationSuccess]);


    const handleVerification = () => {
        setIsVerifying(true);
        if (!student || !phoneInput) {
            toast({ title: "خطأ", description: "الرجاء إدخال رقم الهاتف.", variant: "destructive"});
            setIsVerifying(false);
            return;
        }

        const formattedInput = phoneInput.replace(/\s+/g, '');
        const phone1 = student.phone1?.replace(/\s+/g, '');
        const phone2 = student.phone2?.replace(/\s+/g, '');

        if (formattedInput === phone1 || formattedInput === phone2) {
            localStorage.setItem(verificationKey, JSON.stringify({ verified: true, timestamp: new Date().getTime() }));
            setIsVerified(true);
            if(onVerificationSuccess) onVerificationSuccess();
            toast({ title: "✅ تم التحقق بنجاح", description: "أهلاً بك ولي أمر الطالب."});
        } else {
            toast({ title: "رقم هاتف غير صحيح", description: "الرقم المدخل لا يتطابق مع سجلاتنا. يرجى المحاولة مرة أخرى.", variant: "destructive"});
        }
        setIsVerifying(false);
    };

    const studentData = useMemo(() => {
        if (loading || !studentID || !student) return null;
        
        const pointsConfig = settings.points;
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();

        const monthStartDate = startOfMonth(new Date());
        const monthEndDate = endOfMonth(new Date());

        const sessionsInMonth = Object.values(dailySessions ?? {}).flatMap(sessionsOnDate => 
            Object.values(sessionsOnDate).filter(session => {
                if(!session?.date) return false;
                try {
                    const sessionDate = parseISO(session.date);
                    return sessionDate >= monthStartDate && sessionDate <= monthEndDate;
                } catch(e) { return false; }
            })
        );
        
        const studentScores: Record<string, any> = {};
        students.filter(s => s.status === 'نشط').forEach(s => {
            studentScores[s.id] = { id: s.id, points: 0, stats: { absent: 0, makeup: 0, calm: 0, medium: 0, undisciplined: 0 } };
        });

        sessionsInMonth.forEach(session => {
            (session.records ?? []).forEach(record => {
                if (studentScores[record.studentId]) {
                    studentScores[record.studentId].points += (pointsConfig.attendance[record.attendance as keyof typeof pointsConfig.attendance] || 0);
                    studentScores[record.studentId].points += (pointsConfig.evaluation[record.memorization as keyof typeof pointsConfig.evaluation] || 0);
                    studentScores[record.studentId].points += (pointsConfig.behavior[record.behavior as keyof typeof pointsConfig.behavior] || 0);
                    if (record.attendance === 'غائب') studentScores[record.studentId].stats.absent++;
                    if (record.attendance === 'تعويض') studentScores[record.studentId].stats.makeup++;
                    if (record.behavior === 'هادئ') studentScores[record.studentId].stats.calm++;
                    if (record.behavior === 'متوسط') studentScores[record.studentId].stats.medium++;
                    if (record.behavior === 'غير منضبط') studentScores[record.studentId].stats.undisciplined++;
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
        const masteredCount = Object.values(studentMastery).filter(s => s === 2).length;
        
        const studentRecordsInMonth = sessionsInMonth.flatMap(s => s.records ?? []).filter(r => r.studentId === studentID);
        const attendanceScore = studentRecordsInMonth.length > 0 ? ((studentRecordsInMonth.filter(r => r.attendance === 'حاضر' || r.attendance === 'متأخر').length) / studentRecordsInMonth.length) * 10 : 0;
        const disciplineScore = studentRecordsInMonth.length > 0 ? ((studentRecordsInMonth.filter(r => r.behavior === 'هادئ').length * 2 + studentRecordsInMonth.filter(r => r.behavior === 'متوسط').length * 1) / (studentRecordsInMonth.length * 2)) * 10 : 0;
        const memorizationScore = (masteredCount / allSurahs.length) * 10;
        
        const radarData = [
            { subject: 'الحضور', score: parseFloat(attendanceScore.toFixed(1)), fullMark: 10 },
            { subject: 'الحفظ', score: parseFloat(memorizationScore.toFixed(1)), fullMark: 10 },
            { subject: 'الانضباط', score: parseFloat(disciplineScore.toFixed(1)), fullMark: 10 },
        ];
        
        const activeCovenant = (student.covenants || []).find(c => c.status === 'نشط' && c.card !== 'بدون');
        const latestBadge = settings.badges.find(b => b.id === 'mastery_king' && currentPoints >= b.threshold);

        return { student, rank, medal, radarData, uncompensatedAbsences, activeCovenant, currentPoints, latestBadge };

    }, [studentID, students, dailySessions, surahProgress, settings, loading, student]);

    if (loading || !student) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <Loader2 className="h-16 w-16 animate-spin text-primary" />
            </div>
        );
    }
    
    if(!isVerified) {
        return (
             <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
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
    
    if (!studentData?.student) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 text-center p-4">
                 <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
                <h1 className="text-3xl font-bold text-destructive">عذراً، هذا الرابط غير صحيح</h1>
                <p className="text-muted-foreground mt-2">لا يمكن العثور على بيانات الطالب. الرجاء التأكد من صحة الرابط الذي تلقيته من الإدارة.</p>
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
                     <Avatar className={cn("w-28 h-28 border-4", medal ? medalClasses[medal] : 'border-muted')}>
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
                                    <PolarRadiusAxis angle={30} domain={[0, 10]}/>
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
                </main>
                 <footer className="text-center text-xs text-muted-foreground mt-12">
                    <p>هذه الصفحة هي بوابة لمتابعة الأداء اللحظي للطالب.</p>
                    <p>تم إنشاؤها بواسطة نظام إدارة مدرسة الإمام الشافعي - {format(new Date(), 'yyyy')}</p>
                </footer>
            </div>
        </div>
    );
};

export default function ParentPortalPreviewPage() {
    const params = useParams();
    const router = useRouter();
    const { students, loading: contextLoading } = useStudentContext();
    const { user, loading: authLoading } = useAuth();
    
    const [open, setOpen] = useState(false);
    // studentID from URL can be 'all' or a specific ID
    const studentIDFromUrl = params.studentID as string;
    const [selectedStudentId, setSelectedStudentId] = useState(studentIDFromUrl);
    const [showVerificationGate, setShowVerificationGate] = useState(false);

    const isLoading = authLoading || contextLoading;

    useEffect(() => {
        if (!isLoading && !user) {
            // This is a public user (parent)
            setShowVerificationGate(true);
        } else {
            setShowVerificationGate(false);
        }
    }, [isLoading, user]);

    
    const activeStudents = useMemo(() => (students ?? []).filter(s => s.status === 'نشط'), [students]);
    
    // For Sheikh: auto-select first student if none is selected
    useEffect(() => {
        if (!isLoading && user && activeStudents.length > 0 && (!selectedStudentId || selectedStudentId === 'all')) {
            setSelectedStudentId(activeStudents[0].id);
        }
    }, [activeStudents, selectedStudentId, isLoading, user]);

    const handleStudentSelect = (studentId: string) => {
        setSelectedStudentId(studentId);
        setOpen(false);
        // Optional: Update URL without reloading, for shareable links. Only for Sheikh.
        if(user) {
            router.push(`/parent-portal/${studentId}`, { scroll: false });
        }
    };

    const selectedStudent = useMemo(() => students.find(s => s.id === selectedStudentId), [students, selectedStudentId]);

    if (isLoading) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-16 w-16 animate-spin text-primary" />
        </div>
      );
    }
    
    if (showVerificationGate) {
        if (!selectedStudentId || selectedStudentId === 'all') {
            return (
                 <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 text-center p-4">
                    <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
                    <h1 className="text-3xl font-bold text-destructive">رابط غير صحيح</h1>
                    <p className="text-muted-foreground mt-2">هذا الرابط لا يشير إلى طالب معين.</p>
                </div>
            )
        }
        return <ParentPortalContent studentID={selectedStudentId} />;
    }

    // Sheikh's View
    return (
        <div className="p-4 md:p-8">
            <Card className="mb-8">
                <CardHeader>
                    <CardTitle>معاينة بوابة ولي الأمر</CardTitle>
                    <CardDescription>اختر طالبًا من القائمة أدناه لعرض صفحته كما ستظهر لولي الأمر.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Popover open={open} onOpenChange={setOpen}>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={open}
                                className="w-full md:w-[300px] justify-between"
                            >
                                {selectedStudent
                                    ? selectedStudent.fullName
                                    : "اختر طالبًا..."}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[300px] p-0">
                            <Command>
                                <CommandInput placeholder="ابحث عن طالب..." />
                                <CommandEmpty>لا يوجد طلاب بهذا الاسم.</CommandEmpty>
                                <CommandGroup>
                                    {activeStudents.map((student) => (
                                        <CommandItem
                                            key={student.id}
                                            value={student.fullName}
                                            onSelect={() => handleStudentSelect(student.id)}
                                        >
                                            <Check
                                                className={cn(
                                                    "mr-2 h-4 w-4",
                                                    selectedStudentId === student.id ? "opacity-100" : "opacity-0"
                                                )}
                                            />
                                            {student.fullName}
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            </Command>
                        </PopoverContent>
                    </Popover>
                </CardContent>
            </Card>

            {selectedStudentId && selectedStudentId !== 'all' ? (
                <ParentPortalContent studentID={selectedStudentId} />
            ) : (
                <div className="flex flex-col items-center justify-center text-center p-8 border-2 border-dashed rounded-lg">
                    <Users className="h-12 w-12 text-muted-foreground mb-4" />
                    <h2 className="text-xl font-bold">الرجاء اختيار طالب</h2>
                    <p className="text-muted-foreground">اختر طالبًا من القائمة أعلاه لبدء المعاينة.</p>
                </div>
            )}
        </div>
    )
}
