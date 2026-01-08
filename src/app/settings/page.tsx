
"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useStudentContext } from '@/context/StudentContext';
import { Loader2, Save, WandSparkles, Palette, ShieldCheck, Check, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { AppSettings, PointsConfig, Reward } from '@/lib/types';
import { produce } from 'immer';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

type Category = keyof PointsConfig;
type Key<C extends Category> = keyof PointsConfig[C];

export default function SettingsPage() {
    const { settings, saveSettings, loading: contextLoading } = useStudentContext();
    const { toast } = useToast();
    
    const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
    const [isLoading, setIsLoading] = useState(false);
    
    useEffect(() => {
        if(settings) {
            setLocalSettings(settings);
        }
    }, [settings]);

    const handlePointsChange = <C extends Category>(category: C, key: Key<C>, value: string) => {
        const numericValue = Number(value);
        if (!isNaN(numericValue)) {
            const nextState = produce(localSettings, draft => {
                (draft.points[category] as any)[key] = numericValue;
            });
            setLocalSettings(nextState);
        }
    };
    
    const handleRewardChange = (index: number, field: keyof Reward, value: string | number) => {
         const nextState = produce(localSettings, draft => {
            const reward = draft.rewards[index];
            if(field === 'cost') {
                const numValue = Number(value);
                if(!isNaN(numValue)) reward.cost = numValue;
            } else {
                (reward[field] as any) = value;
            }
        });
        setLocalSettings(nextState);
    }
    
    const handleSaveChanges = async () => {
        setIsLoading(true);
        try {
            await saveSettings(localSettings);
            toast({
                title: "✅ تم الحفظ",
                description: "تم حفظ الإعدادات المخصصة بنجاح."
            });
        } catch (error) {
            toast({
                title: "❌ خطأ",
                description: "فشل حفظ الإعدادات.",
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };
    
    if (contextLoading || !localSettings) {
        return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>
    }

  return (
    <TooltipProvider>
        <div className="space-y-6">
        <h1 className="text-3xl font-headline font-bold">إعدادات النقاط والسياسات</h1>
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
                        label="نقاط التأخر (خصم)" 
                        value={localSettings.points.attendance['متأخر']}
                        onChange={e => handlePointsChange('attendance', 'متأخر', e.target.value)}
                        tooltip="النقاط التي تخصم عند تسجيل الطالب كـ 'متأخر'."
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
                        label="تقييم 'جيد'" 
                        value={localSettings.points.evaluation['جيد']}
                        onChange={e => handlePointsChange('evaluation', 'جيد', e.target.value)}
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
                 <CardTitle className="flex items-center gap-2"><Palette/>إدارة الجوائز</CardTitle>
                 <CardDescription>تحكم في الجوائز المتوفرة في "سوق النقاط" وتكلفتها.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {localSettings.rewards.map((reward, index) => (
                    <div key={reward.id} className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border rounded-lg items-center">
                        <Input value={reward.name} onChange={e => handleRewardChange(index, 'name', e.target.value)} placeholder="اسم الجائزة"/>
                        <Input value={reward.description} onChange={e => handleRewardChange(index, 'description', e.target.value)} placeholder="وصف قصير"/>
                        <div className="space-y-1">
                             <Label>التكلفة (نقاط)</Label>
                             <Input type="number" value={reward.cost} onChange={e => handleRewardChange(index, 'cost', e.target.value)} />
                        </div>
                    </div>
                ))}
                {/* Add new reward functionality can be added here */}
            </CardContent>
        </Card>

        <Card>
             <CardHeader>
                 <CardTitle className="flex items-center gap-2"><ShieldCheck />إدارة الأوسمة التلقائية</CardTitle>
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

        <div className="sticky bottom-0 py-4 bg-background/80 backdrop-blur-sm">
            <Button onClick={handleSaveChanges} disabled={isLoading} size="lg">
                {isLoading ? <Loader2 className="h-4 w-4 ml-2 animate-spin"/> : <Save className="h-4 w-4 ml-2"/>}
                حفظ كل الإعدادات
            </Button>
        </div>
        </div>
    </TooltipProvider>
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
