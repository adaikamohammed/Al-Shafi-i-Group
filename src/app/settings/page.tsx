

"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useStudentContext } from '@/context/StudentContext';
import { Loader2, Save, WandSparkles, ShieldCheck, Info, Trash2, PlusCircle, History, SlidersHorizontal, Goal } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { AppSettings, PointsConfig, Reward, BadgeConfig } from '@/lib/types';
import { produce } from 'immer';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { db } from '@/lib/firebase';
import { ref, set, onValue } from 'firebase/database';
import { useAuth } from '@/context/AuthContext';
import { ScoringWeights, DEFAULT_WEIGHTS } from '@/components/management/SheikhBadges';
import { ProtectedPage } from '@/components/ui/ProtectedPage';


type Category = keyof PointsConfig;
type Key<C extends Category> = keyof PointsConfig[C];

export default function SettingsPage() {
    const { settings, saveSettings, loading: contextLoading } = useStudentContext();
    const { toast } = useToast();

    const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
    const [isLoading, setIsLoading] = useState(false);

    const { user } = useAuth();
    const [sheikhWeights, setSheikhWeights] = useState<ScoringWeights>(DEFAULT_WEIGHTS);
    const [sheikhGoals, setSheikhGoals] = useState({ attendanceTarget: 85, excellentTarget: 25, commitmentTarget: 90 });
    const [goalsMonth, setGoalsMonth] = useState(format(new Date(), 'yyyy-MM'));

    useEffect(() => {
        if (settings) {
            setLocalSettings(settings);
        }
    }, [settings]);

    useEffect(() => {
        const weightsRef = ref(db, 'settings/sheikh_scoring_weights');
        const unsubWeights = onValue(weightsRef, (snapshot: any) => {
            if (snapshot.exists()) {
                setSheikhWeights(snapshot.val());
            }
        });

        return () => {
            unsubWeights();
        };
    }, []);

    useEffect(() => {
        const goalsRef = ref(db, `settings/sheikh_goals/${goalsMonth}`);
        const unsubGoals = onValue(goalsRef, (snapshot: any) => {
            if (snapshot.exists()) {
                const val = snapshot.val();
                setSheikhGoals({
                    attendanceTarget: val.attendanceTarget ?? 85,
                    excellentTarget: val.excellentTarget ?? 25,
                    commitmentTarget: val.commitmentTarget ?? 90,
                });
            } else {
                setSheikhGoals({ attendanceTarget: 85, excellentTarget: 25, commitmentTarget: 90 });
            }
        });

        return () => {
            unsubGoals();
        };
    }, [goalsMonth]);

    const handleSheikhWeightChange = (key: keyof ScoringWeights, value: string) => {
        const numVal = Number(value);
        if (!isNaN(numVal)) {
            setSheikhWeights(prev => ({
                ...prev,
                [key]: numVal
            }));
        }
    };

    const handleGoalChange = (key: 'attendanceTarget' | 'excellentTarget' | 'commitmentTarget', value: string) => {
        const numVal = Number(value);
        if (!isNaN(numVal)) {
            setSheikhGoals(prev => ({
                ...prev,
                [key]: numVal
            }));
        }
    };

    const handlePointsChange = <C extends Category>(category: C, key: Key<C>, value: string) => {
        const numericValue = Number(value);
        if (!isNaN(numericValue)) {
            const nextState = produce(localSettings, draft => {
                (draft.points[category] as any)[key] = numericValue;
            });
            setLocalSettings(nextState);
        }
    };

    const handleRewardChange = (index: number, field: keyof Omit<Reward, 'id'>, value: string | number) => {
        const nextState = produce(localSettings, draft => {
            const reward = draft.rewards[index];
            if (field === 'cost') {
                const numValue = Number(value);
                if (!isNaN(numValue)) reward.cost = numValue;
            } else {
                (reward[field] as any) = value;
            }
        });
        setLocalSettings(nextState);
    }

    const handleAddReward = () => {
        const nextState = produce(localSettings, draft => {
            draft.rewards.push({ id: `custom-${Date.now()}`, name: 'جائزة جديدة', description: 'وصف الجائزة', cost: 100, icon: 'Gift' });
        });
        setLocalSettings(nextState);
    }

    const handleRemoveReward = (index: number) => {
        const nextState = produce(localSettings, draft => {
            draft.rewards.splice(index, 1);
        });
        setLocalSettings(nextState);
    }

    const handleEndSeason = async () => {
        setIsLoading(true);
        const nextState = produce(localSettings, draft => {
            draft.seasonStartDate = new Date().toISOString();
        });
        try {
            await saveSettings(nextState);
            setLocalSettings(nextState);
            toast({
                title: "موسم جديد قد بدأ!",
                description: "تمت أرشفة نقاط الموسم السابق وبدء موسم جديد بنقاط صفرية."
            });
        } catch (error) {
            toast({
                title: "خطأ",
                description: "فشل إنهاء الموسم الحالي.",
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    }

    const handleSaveChanges = async () => {
        setIsLoading(true);
        try {
            await saveSettings(localSettings);
            
            // Save sheikh scoring weights
            const weightsRef = ref(db, 'settings/sheikh_scoring_weights');
            await set(weightsRef, sheikhWeights);

            // Save monthly goals
            const goalsRef = ref(db, `settings/sheikh_goals/${goalsMonth}`);
            await set(goalsRef, sheikhGoals);

            toast({
                title: "تم الحفظ",
                description: "تم حفظ كل الإعدادات بنجاح."
            });
        } catch (error) {
            toast({
                title: "خطأ",
                description: "فشل حفظ الإعدادات.",
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };

    if (contextLoading || !localSettings) {
        return (
            <ProtectedPage>
                <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>
            </ProtectedPage>
        )
    }

    return (
        <ProtectedPage>
            <TooltipProvider>
                <div className="space-y-6">
                    <h1 className="text-3xl font-headline font-bold">إعدادات قوانين الفوج</h1>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><History /> إدارة المواسم</CardTitle>
                            <CardDescription>
                                قم بإنهاء الموسم الحالي وأرشفة نقاط الطلبة لبدء موسم جديد بنقاط صفرية. هذا الإجراء نهائي ولا يمكن التراجع عنه.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-col sm:flex-row justify-between items-center p-4 border rounded-lg bg-background">
                                <div>
                                    <p className="font-semibold">تاريخ بدء الموسم الحالي:</p>
                                    <p className="text-muted-foreground">
                                        {localSettings.seasonStartDate
                                            ? format(new Date(localSettings.seasonStartDate), 'd MMMM yyyy', { locale: ar })
                                            : 'لم يحدد بعد (يحسب من بداية التسجيلات)'}
                                    </p>
                                </div>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="destructive">إنهاء الموسم وبدء موسم جديد</Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>هل أنت متأكد تمامًا؟</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                سيؤدي هذا الإجراء إلى تصفير نقاط الموسم الحالي لجميع الطلبة ونقلها إلى أرشيفهم التاريخي. سيبدأ الموسم الجديد من تاريخ اليوم. هذا الإجراء لا يمكن التراجع عنه.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                            <AlertDialogAction onClick={handleEndSeason}>نعم، قم بإنهاء الموسم</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><WandSparkles />محرك النقاط</CardTitle>
                            <CardDescription>
                                هنا يمكنك التحكم الكامل في قيمة كل فعل داخل الفوج. سيتم تطبيق هذه النقاط تلقائياً على كل الطلبة.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">

                            <CategoryCard title="المواظبة" description="نقاط الحضور والغياب.">
                                <PointInput
                                    label="نقاط الحضور"
                                    value={localSettings.points.attendance['حاضر']}
                                    onChange={e => handlePointsChange('attendance', 'حاضر', e.target.value)}
                                    tooltip="النقاط التي يحصل عليها الطالب مقابل كل يوم حضور."
                                />
                                <PointInput
                                    label="نقاط التأخر"
                                    value={localSettings.points.attendance['متأخر']}
                                    onChange={e => handlePointsChange('attendance', 'متأخر', e.target.value)}
                                    tooltip="النقاط التي يحصل عليها عند تسجيل الطالب كـ 'متأخر'."
                                />
                                <PointInput
                                    label="نقاط الغياب (خصم)"
                                    value={localSettings.points.attendance['غائب']}
                                    onChange={e => handlePointsChange('attendance', 'غائب', e.target.value)}
                                    tooltip="النقاط التي تخصم عند تسجيل الطالب كـ 'غائب'."
                                />
                                <PointInput
                                    label="نقاط حصة التعويض"
                                    value={localSettings.points.attendance['تعويض']}
                                    onChange={e => handlePointsChange('attendance', 'تعويض', e.target.value)}
                                    tooltip="النقاط التي تمنح للطالب عند حضوره حصة تعويضية."
                                />
                            </CategoryCard>

                            <CategoryCard title="التعليم والتحصيل" description="نقاط التقييم اليومي وحفظ السور.">
                                <PointInput
                                    label="تقييم 'ممتاز'"
                                    value={localSettings.points.evaluation['ممتاز']}
                                    onChange={e => handlePointsChange('evaluation', 'ممتاز', e.target.value)}
                                />
                                <PointInput
                                    label="تقييم 'جيد جداً'"
                                    value={localSettings.points.evaluation['جيد جداً']}
                                    onChange={e => handlePointsChange('evaluation', 'جيد جداً', e.target.value)}
                                />
                                <PointInput
                                    label="تقييم 'جيد'"
                                    value={localSettings.points.evaluation['جيد']}
                                    onChange={e => handlePointsChange('evaluation', 'جيد', e.target.value)}
                                />
                                <PointInput
                                    label="تقييم 'ضعيف' (خصم)"
                                    value={localSettings.points.evaluation['ضعيف']}
                                    onChange={e => handlePointsChange('evaluation', 'ضعيف', e.target.value)}
                                />
                                <PointInput
                                    label="مراجعة الدرس السابق"
                                    value={localSettings.points.review['completed']}
                                    onChange={e => handlePointsChange('review', 'completed', e.target.value)}
                                />
                                <PointInput
                                    label="حفظ سورة جديدة (أخضر فاتح)"
                                    value={localSettings.points.surah['memorized']}
                                    onChange={e => handlePointsChange('surah', 'memorized', e.target.value)}
                                />
                                <PointInput
                                    label="إتقان سورة (أخضر غامق)"
                                    value={localSettings.points.surah['mastered']}
                                    onChange={e => handlePointsChange('surah', 'mastered', e.target.value)}
                                />
                                <PointInput
                                    label="مكافأة الوفاء بميثاق"
                                    value={localSettings.points.covenantCompleted}
                                    onChange={e => handlePointsChange('covenantCompleted', 'covenantCompleted' as any, e.target.value)}
                                    tooltip="نقاط إضافية تمنح للطالب عند إكماله لمهمة تمكين (ميثاق)."
                                />
                            </CategoryCard>

                            <CategoryCard title="السلوك والانضباط" description="نقاط السلوك داخل الحلقة.">
                                <PointInput
                                    label="سلوك 'هادئ ومنضبط'"
                                    value={localSettings.points.behavior['هادئ']}
                                    onChange={e => handlePointsChange('behavior', 'هادئ', e.target.value)}
                                />
                                <PointInput
                                    label="سلوك 'متوسط'"
                                    value={localSettings.points.behavior['متوسط']}
                                    onChange={e => handlePointsChange('behavior', 'متوسط', e.target.value)}
                                />
                                <PointInput
                                    label="سلوك 'غير منضبط' (خصم)"
                                    value={localSettings.points.behavior['غير منضبط']}
                                    onChange={e => handlePointsChange('behavior', 'غير منضبط', e.target.value)}
                                />
                            </CategoryCard>

                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">إدارة الجوائز</CardTitle>
                            <CardDescription>تحكم في الجوائز المتوفرة في "سوق النقاط" وتكلفتها.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {localSettings.rewards.map((reward, index) => (
                                <div key={reward.id} className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 border rounded-lg items-center">
                                    <Input value={reward.name} onChange={e => handleRewardChange(index, 'name', e.target.value)} placeholder="اسم الجائزة" />
                                    <Input value={reward.description} onChange={e => handleRewardChange(index, 'description', e.target.value)} placeholder="وصف قصير" />
                                    <div className="space-y-1">
                                        <Label>التكلفة (نقاط)</Label>
                                        <Input type="number" value={reward.cost} onChange={e => handleRewardChange(index, 'cost', e.target.value)} />
                                    </div>
                                    <Button variant="ghost" size="icon" onClick={() => handleRemoveReward(index)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                </div>
                            ))}
                            <Button variant="outline" onClick={handleAddReward}><PlusCircle className="ml-2 h-4 w-4" /> إضافة جائزة جديدة</Button>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">إدارة الأوسمة التلقائية</CardTitle>
                            <CardDescription>حدد الشروط لمنح الأوسمة تلقائيًا بناءً على إنجازات الطلبة.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {localSettings.badges.map((badge, index) => (
                                <div key={badge.id} className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-lg items-center">
                                    <p className="font-semibold">{badge.name}</p>
                                    <div className="space-y-1">
                                        <Label>النقاط المطلوبة</Label>
                                        <Input type="number" value={badge.threshold} disabled />
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    {/* أوزان تقييم المشايخ */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><SlidersHorizontal className="h-5 w-5 text-indigo-500" /> أوزان تقييم وأسس نقاط المشايخ</CardTitle>
                            <CardDescription>
                                تحكم في قيم النقاط، المكافآت (البونص)، والخصومات التي يعتمد عليها نظام تقييم المشايخ الشهري.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                <div className="space-y-1">
                                    <Label>نقاط تسجيل الحصة (أساسية)</Label>
                                    <Input type="number" value={sheikhWeights.sessionWeight} onChange={e => handleSheikhWeightChange('sessionWeight', e.target.value)} />
                                </div>
                                <div className="space-y-1">
                                    <Label>الوزن الأقصى لحضور الطلاب</Label>
                                    <Input type="number" value={sheikhWeights.attendanceWeight} onChange={e => handleSheikhWeightChange('attendanceWeight', e.target.value)} />
                                </div>
                                <div className="space-y-1">
                                    <Label>بونص الحصة التعويضية/الإضافية</Label>
                                    <Input type="number" value={sheikhWeights.extraSessionBonus} onChange={e => handleSheikhWeightChange('extraSessionBonus', e.target.value)} />
                                </div>
                                <div className="space-y-1">
                                    <Label>بونص التقييم الممتاز للطلاب</Label>
                                    <Input type="number" value={sheikhWeights.excellentBonus} onChange={e => handleSheikhWeightChange('excellentBonus', e.target.value)} />
                                </div>
                                <div className="space-y-1">
                                    <Label>بونص التقييم جيد جداً للطلاب</Label>
                                    <Input type="number" value={sheikhWeights.goodPlusBonus} onChange={e => handleSheikhWeightChange('goodPlusBonus', e.target.value)} />
                                </div>
                                <div className="space-y-1">
                                    <Label>بونص الالتزام الكامل للشيخ (100%)</Label>
                                    <Input type="number" value={sheikhWeights.commitmentBonus} onChange={e => handleSheikhWeightChange('commitmentBonus', e.target.value)} />
                                </div>
                                <div className="space-y-1">
                                    <Label>نقاط الالتزام النسبي للشيخ</Label>
                                    <Input type="number" value={sheikhWeights.commitmentBase} onChange={e => handleSheikhWeightChange('commitmentBase', e.target.value)} />
                                </div>
                                <div className="space-y-1">
                                    <Label>عقوبة غياب الشيخ (خصم)</Label>
                                    <Input type="number" value={sheikhWeights.absencePenalty} onChange={e => handleSheikhWeightChange('absencePenalty', e.target.value)} />
                                </div>
                                <div className="space-y-1">
                                    <Label>بونص التوثيق السريع (خلال 36 ساعة)</Label>
                                    <Input type="number" value={sheikhWeights.punctualityBonus} onChange={e => handleSheikhWeightChange('punctualityBonus', e.target.value)} />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* المستهدفات الشهرية لمراقبة المشايخ */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Goal className="h-5 w-5 text-emerald-500" /> المستهدفات والأهداف الشهرية للأفواج</CardTitle>
                            <CardDescription>
                                حدد نسب الحضور والحفظ والالتزام المستهدفة لمقارنة أداء الأفواج.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center gap-4 border-b pb-4 mb-4">
                                <div className="space-y-1 max-w-[200px] w-full">
                                    <Label>الشهر المستهدف</Label>
                                    <Input type="month" value={goalsMonth} onChange={e => setGoalsMonth(e.target.value)} />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-1">
                                    <Label>نسبة الحضور المستهدفة لطلاب الفوج (%)</Label>
                                    <Input type="number" value={sheikhGoals.attendanceTarget} onChange={e => handleGoalChange('attendanceTarget', e.target.value)} min={0} max={100} />
                                </div>
                                <div className="space-y-1">
                                    <Label>نسبة تقييم "ممتاز" المستهدفة (%)</Label>
                                    <Input type="number" value={sheikhGoals.excellentTarget} onChange={e => handleGoalChange('excellentTarget', e.target.value)} min={0} max={100} />
                                </div>
                                <div className="space-y-1">
                                    <Label>نسبة التزام الشيخ بتسجيل الحصص (%)</Label>
                                    <Input type="number" value={sheikhGoals.commitmentTarget} onChange={e => handleGoalChange('commitmentTarget', e.target.value)} min={0} max={100} />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="sticky bottom-0 py-4 bg-background/80 backdrop-blur-sm">
                        <Button onClick={handleSaveChanges} disabled={isLoading} size="lg">
                            {isLoading ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Save className="h-4 w-4 ml-2" />}
                            حفظ كل الإعدادات
                        </Button>
                    </div>
                </div>
            </TooltipProvider>
        </ProtectedPage>
    );
}


const CategoryCard = ({ title, description, children }: { title: string, description: string, children: React.ReactNode }) => (
    <div className="p-4 border rounded-lg">
        <h4 className="font-semibold text-lg">{title}</h4>
        <p className="text-sm text-muted-foreground mb-4">{description}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {children}
        </div>
    </div>
)

const PointInput = ({ label, value, onChange, tooltip }: { label: string, value: number, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void, tooltip?: string }) => (
    <div className="space-y-1">
        <div className="flex items-center gap-2">
            <Label>{label}</Label>
            {tooltip && (
                <Tooltip>
                    <TooltipTrigger asChild><Info className="h-4 w-4 text-muted-foreground cursor-pointer" /></TooltipTrigger>
                    <TooltipContent><p>{tooltip}</p></TooltipContent>
                </Tooltip>
            )}
        </div>
        <Input type="number" value={value} onChange={onChange} />
    </div>
);
