
"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useStudentContext } from '@/context/StudentContext';
import { Loader2, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const TIER_PRICES = {
    initial: { 'فئة أ': 2500, 'فئة ب': 2000 },
    subsequent: { 'فئة أ': 2000, 'فئة ب': 1500 },
};

export default function SettingsPage() {
    const { settings, setSettings, loading: contextLoading } = useStudentContext();
    const { toast } = useToast();
    
    const [prices, setPrices] = useState(settings?.prices || TIER_PRICES);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (settings?.prices) {
            setPrices(settings.prices);
        }
    }, [settings]);

    const handlePriceChange = (period: 'initial' | 'subsequent', tier: 'فئة أ' | 'فئة ب', value: string) => {
        const numericValue = Number(value);
        if (!isNaN(numericValue)) {
            setPrices(prev => ({
                ...prev,
                [period]: {
                    ...prev[period],
                    [tier]: numericValue
                }
            }));
        }
    };

    const handleSaveChanges = async () => {
        setIsLoading(true);
        try {
            await setSettings({ prices });
            toast({
                title: "✅ تم الحفظ",
                description: "تم حفظ إعدادات الأسعار بنجاح."
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
    
    if (contextLoading) {
        return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>
    }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-headline font-bold">الإعدادات</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>إدارة أسعار الاشتراكات</CardTitle>
          <CardDescription>
            هنا يمكنك تعديل أسعار الاشتراكات للفئات المختلفة. ستنعكس هذه التغييرات تلقائيًا في صفحة المستحقات.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="space-y-4 p-4 border rounded-lg">
                 <h4 className="font-semibold text-lg">الفترة الأولى (أول 3 أشهر)</h4>
                 <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="initial-tier-a">سعر الفئة أ (د.ج)</Label>
                        <Input 
                            id="initial-tier-a"
                            type="number"
                            value={prices.initial['فئة أ']}
                            onChange={(e) => handlePriceChange('initial', 'فئة أ', e.target.value)}
                        />
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="initial-tier-b">سعر الفئة ب (د.ج)</Label>
                        <Input 
                            id="initial-tier-b"
                            type="number"
                            value={prices.initial['فئة ب']}
                            onChange={(e) => handlePriceChange('initial', 'فئة ب', e.target.value)}
                        />
                    </div>
                 </div>
            </div>

            <div className="space-y-4 p-4 border rounded-lg">
                 <h4 className="font-semibold text-lg">الفترات اللاحقة</h4>
                 <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="subsequent-tier-a">سعر الفئة أ (د.ج)</Label>
                        <Input 
                            id="subsequent-tier-a"
                            type="number"
                            value={prices.subsequent['فئة أ']}
                            onChange={(e) => handlePriceChange('subsequent', 'فئة أ', e.target.value)}
                        />
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="subsequent-tier-b">سعر الفئة ب (د.ج)</Label>
                        <Input 
                            id="subsequent-tier-b"
                            type="number"
                            value={prices.subsequent['فئة ب']}
                            onChange={(e) => handlePriceChange('subsequent', 'فئة ب', e.target.value)}
                        />
                    </div>
                 </div>
            </div>
            
            <Button onClick={handleSaveChanges} disabled={isLoading}>
                {isLoading ? <Loader2 className="h-4 w-4 ml-2 animate-spin"/> : <Save className="h-4 w-4 ml-2"/>}
                حفظ التغييرات
            </Button>
        </CardContent>
      </Card>
    </div>
  );
}
