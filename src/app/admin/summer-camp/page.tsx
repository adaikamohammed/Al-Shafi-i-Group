"use client";

import React, { useState, useMemo } from 'react';
import { useAdmin } from '@/context/AdminContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Check, Edit, Loader2, Package, Plus, Trash2, User, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

const CATEGORIES = [
    { id: 'drinks', label: 'مشروبات', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
    { id: 'food', label: 'أغذية', color: 'bg-orange-500/10 text-orange-500 border-orange-500/20' },
    { id: 'utensils', label: 'أواني', color: 'bg-slate-500/10 text-slate-500 border-slate-500/20' },
    { id: 'games', label: 'ألعاب', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
    { id: 'office', label: 'تجهيزات مكتبية', color: 'bg-purple-500/10 text-purple-500 border-purple-500/20' },
    { id: 'cleaning', label: 'نظافة', color: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20' },
    { id: 'other', label: 'أخرى', color: 'bg-pink-500/10 text-pink-500 border-pink-500/20' },
];

export default function SummerCampPage() {
    const { summerCampItems, addSummerCampItem, updateSummerCampItem, deleteSummerCampItem, toggleItemProvided, loading } = useAdmin();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<any>(null);

    // Form State
    const [name, setName] = useState('');
    const [category, setCategory] = useState('drinks');
    const [quantity, setQuantity] = useState('');
    const [provider, setProvider] = useState('');
    const [notes, setNotes] = useState('');

    const resetForm = () => {
        setName('');
        setCategory('drinks');
        setQuantity('');
        setProvider('');
        setNotes('');
        setEditingItem(null);
    };

    const handleOpenDialog = (item?: any) => {
        if (item) {
            setEditingItem(item);
            setName(item.name);
            setCategory(item.category);
            setQuantity(item.quantity);
            setProvider(item.provider);
            setNotes(item.notes || '');
        } else {
            resetForm();
        }
        setIsDialogOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !provider) return;

        try {
            const itemData = {
                name,
                category,
                quantity,
                provider,
                notes,
                isProvided: editingItem ? editingItem.isProvided : false
            };

            if (editingItem) {
                await updateSummerCampItem(editingItem.id, itemData);
            } else {
                await addSummerCampItem(itemData);
            }
            setIsDialogOpen(false);
            resetForm();
        } catch (error) {
            console.error(error);
        }
    };

    const groupedItems = useMemo(() => {
        const grouped: Record<string, typeof summerCampItems> = {};
        CATEGORIES.forEach(cat => grouped[cat.id] = []);
        summerCampItems.forEach(item => {
            if (!grouped[item.category]) grouped[item.category] = [];
            grouped[item.category].push(item);
        });
        return grouped;
    }, [summerCampItems]);

    const totalItems = summerCampItems.length;
    const providedItems = summerCampItems.filter(i => i.isProvided).length;
    const progress = totalItems === 0 ? 0 : Math.round((providedItems / totalItems) * 100);

    if (loading) return <div className="flex justify-center items-center min-h-[500px]"><Loader2 className="h-8 w-8 animate-spin" /></div>;

    return (
        <div className="max-w-7xl mx-auto space-y-8 pb-20 p-4 md:p-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black tracking-tight font-headline flex items-center gap-3">
                        <span className="p-3 rounded-2xl bg-orange-500/20 text-orange-500 md:bg-transparent md:text-inherit md:p-0">⛺</span>
                        مستلزمات المخيم الصيفي
                    </h1>
                    <p className="text-muted-foreground font-medium mt-2">تتبع وتجهيز كافة احتياجات المخيم بدقة ونظام</p>
                </div>

                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button onClick={() => handleOpenDialog()} className="h-12 px-8 rounded-xl font-bold gap-2 shadow-lg hover:shadow-primary/20 transition-all hover:scale-105 active:scale-95 bg-primary hover:bg-primary/90">
                            <Plus className="h-5 w-5" />
                            إضافة صنف جديد
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md bg-slate-900/95 border-white/10 backdrop-blur-xl text-white">
                        <DialogHeader>
                            <DialogTitle className="font-headline text-xl">{editingItem ? 'تعديل الصنف' : 'إضافة صنف جديد'}</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                            <div className="space-y-2">
                                <Label>التصنيف</Label>
                                <Select value={category} onValueChange={setCategory}>
                                    <SelectTrigger className="bg-white/5 border-white/10">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {CATEGORIES.map(cat => (
                                            <SelectItem key={cat.id} value={cat.id}>{cat.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>اسم الصنف</Label>
                                    <Input value={name} onChange={e => setName(e.target.value)} className="bg-white/5 border-white/10" placeholder="مثال: عصير برتقال" required />
                                </div>
                                <div className="space-y-2">
                                    <Label>الكمية</Label>
                                    <Input value={quantity} onChange={e => setQuantity(e.target.value)} className="bg-white/5 border-white/10" placeholder="مثال: 50 علبة" required />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>المتكفل بالتوفير</Label>
                                <Input value={provider} onChange={e => setProvider(e.target.value)} className="bg-white/5 border-white/10" placeholder="اسم الشيخ أو الشخص" required />
                            </div>
                            <div className="space-y-2">
                                <Label>ملاحظات (اختياري)</Label>
                                <Input value={notes} onChange={e => setNotes(e.target.value)} className="bg-white/5 border-white/10" />
                            </div>
                            <DialogFooter className="gap-2 pt-4">
                                <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)}>إلغاء</Button>
                                <Button type="submit" className="font-bold">{editingItem ? 'حفظ التعديلات' : 'إضافة'}</Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Progress Bar */}
            <Card className="border-none bg-gradient-to-r from-blue-900/20 to-purple-900/20 relative overflow-hidden">
                <div className="absolute inset-0 bg-white/5 backdrop-blur-sm" />
                <CardContent className="relative p-6 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className="h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center border-4 border-primary/10">
                            <Package className="h-8 w-8 text-primary" />
                        </div>
                        <div>
                            <div className="text-2xl font-black">{providedItems} <span className="text-muted-foreground text-lg">/ {totalItems}</span></div>
                            <div className="text-sm font-medium text-muted-foreground">تم توفيرها حتى الآن</div>
                        </div>
                    </div>
                    <div className="flex-1 w-full md:max-w-md">
                        <div className="flex justify-between text-xs font-bold mb-2">
                            <span>نسبة الإنجاز</span>
                            <span>{progress}%</span>
                        </div>
                        <div className="h-4 w-full bg-black/20 rounded-full overflow-hidden">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${progress}%` }}
                                className="h-full bg-gradient-to-r from-primary to-blue-500 rounded-full"
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Categories Grid */}
            <div className="space-y-8">
                {CATEGORIES.map(cat => {
                    const items = groupedItems[cat.id];
                    if (items.length === 0) return null;

                    return (
                        <div key={cat.id} className="space-y-4">
                            <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-sm font-bold ${cat.color}`}>
                                {cat.label}
                                <Badge variant="secondary" className="h-5 px-1.5 text-[10px] min-w-[20px] justify-center bg-black/10 text-inherit">{items.length}</Badge>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {items.map(item => (
                                    <motion.div
                                        key={item.id}
                                        layout
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className={`group relative rounded-2xl border transition-all duration-300 overflow-hidden
                      ${item.isProvided
                                                ? 'bg-emerald-500/5 border-emerald-500/20 shadow-lg shadow-emerald-500/5'
                                                : 'bg-white/5 border-white/5 hover:border-white/10 hover:bg-white/10'
                                            }`}
                                    >
                                        <div className="p-5 space-y-4">
                                            <div className="flex items-start justify-between gap-3">
                                                <h3 className={`font-bold text-lg leading-tight ${item.isProvided ? 'text-emerald-400 line-through decoration-emerald-500/50' : ''}`}>
                                                    {item.name}
                                                </h3>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => toggleItemProvided(item.id, item.isProvided)}
                                                    className={`shrink-0 rounded-full h-8 w-8 transition-colors ${item.isProvided ? 'bg-emerald-500 text-white hover:bg-emerald-600' : 'bg-white/5 hover:bg-emerald-500/20 hover:text-emerald-400'}`}
                                                >
                                                    {item.isProvided ? <Check className="h-4 w-4" /> : <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />}
                                                </Button>
                                            </div>

                                            <div className="space-y-2 text-sm">
                                                <div className="flex items-center justify-between text-muted-foreground">
                                                    <span className="flex items-center gap-1.5"><Package className="h-3.5 w-3.5 opacity-50" /> الكمية:</span>
                                                    <span className="font-bold text-foreground">{item.quantity}</span>
                                                </div>
                                                <div className="flex items-center justify-between text-muted-foreground">
                                                    <span className="flex items-center gap-1.5"><User className="h-3.5 w-3.5 opacity-50" /> المتكفل:</span>
                                                    <span className="font-bold text-foreground">{item.provider}</span>
                                                </div>
                                            </div>

                                            {item.notes && (
                                                <div className="pt-3 border-t border-white/5 text-xs text-muted-foreground italic">
                                                    "{item.notes}"
                                                </div>
                                            )}

                                            {item.isProvided && item.providedAt && (
                                                <div className="text-[10px] text-emerald-500/70 font-medium text-center pt-2">
                                                    تم التوفير: {format(new Date(item.providedAt), 'yyyy/MM/dd HH:mm')}
                                                </div>
                                            )}
                                        </div>

                                        {/* Quick Actions Overlay */}
                                        <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                            <Button onClick={() => handleOpenDialog(item)} variant="secondary" size="icon" className="h-7 w-7 rounded-lg shadow-sm">
                                                <Edit className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button
                                                onClick={() => {
                                                    if (confirm('هل أنت متأكد من حذف هذا العنصر؟')) deleteSummerCampItem(item.id);
                                                }}
                                                variant="destructive" size="icon" className="h-7 w-7 rounded-lg shadow-sm"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    );
                })}

                {summerCampItems.length === 0 && (
                    <div className="text-center py-20 text-muted-foreground">
                        <Package className="h-16 w-16 mx-auto mb-4 opacity-20" />
                        <p className="text-lg font-medium">القائمة فارغة، ابدأ بإضافة المستلزمات!</p>
                    </div>
                )}
            </div>
        </div>
    );
}
