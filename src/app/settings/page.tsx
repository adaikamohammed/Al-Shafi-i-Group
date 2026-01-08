
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
    firstPayment: { 'فئة الأكابر': 2500, 'فئة الأصاغر': 2000 },
    renewal: { 'فئة الأكابر': 2000, 'فئة الأصاغر': 1500 },
};

export default function SettingsPage() {
    const { settings, saveSettings, loading: contextLoading } = useStudentContext();
    const { toast } = useToast();
    
    const [prices, setPrices] = useState(settings?.prices || TIER_PRICES);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (settings?.prices) {
            setPrices(settings.prices);
        }
    }, [settings]);

    const handlePriceChange = (period: 'firstPayment' | 'renewal', tier: 'فئة الأكابر' | 'فئة الأصاغر', value: string) => {
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
            await saveSettings({ prices });
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
                 <h4 className="font-semibold text-lg">سعر الدفعة الأولى</h4>
                 <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="first-payment-seniors">سعر فئة الأكابر (د.ج)</Label>
                        <Input 
                            id="first-payment-seniors"
                            type="number"
                            value={prices.firstPayment['فئة الأكابر']}
                            onChange={(e) => handlePriceChange('firstPayment', 'فئة الأكابر', e.target.value)}
                        />
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="first-payment-juniors">سعر فئة الأصاغر (د.ج)</Label>
                        <Input 
                            id="first-payment-juniors"
                            type="number"
                            value={prices.firstPayment['فئة الأصاغر']}
                            onChange={(e) => handlePriceChange('firstPayment', 'فئة الأصاغر', e.target.value)}
                        />
                    </div>
                 </div>
            </div>

            <div className="space-y-4 p-4 border rounded-lg">
                 <h4 className="font-semibold text-lg">سعر التجديد</h4>
                 <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="renewal-seniors">سعر فئة الأكابر (د.ج)</Label>
                        <Input 
                            id="renewal-seniors"
                            type="number"
                            value={prices.renewal['فئة الأكابر']}
                            onChange={(e) => handlePriceChange('renewal', 'فئة الأكابر', e.target.value)}
                        />
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="renewal-juniors">سعر فئة الأصاغر (د.ج)</Label>
                        <Input 
                            id="renewal-juniors"
                            type="number"
                            value={prices.renewal['فئة الأصاغر']}
                            onChange={(e) => handlePriceChange('renewal', 'فئة الأصاغر', e.target.value)}
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
