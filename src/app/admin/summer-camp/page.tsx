"use client";

import React, { useState, useMemo, useRef } from 'react';
import { useAdmin } from '@/context/AdminContext';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Check, Edit, Loader2, Package, Plus, Trash2, User, X, Download, Upload, Truck, Search, Filter, Printer, Settings } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { SummerCampReport } from '@/components/reports/SummerCampReport';
import { Checkbox } from '@/components/ui/checkbox';
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
    const { summerCampItems, addSummerCampItem, addMultipleSummerCampItems, updateSummerCampItem, deleteSummerCampItem, toggleItemProvided, toggleItemReturned, bulkUpdateItems, loading } = useAdmin();
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<any>(null);

    // Filters State
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [providerFilter, setProviderFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [returnFilter, setReturnFilter] = useState('all');
    const [printShowCategory, setPrintShowCategory] = useState(true);
    const [printShowNotes, setPrintShowNotes] = useState(true);
    const [selectedItems, setSelectedItems] = useState<string[]>([]);

    React.useEffect(() => {
        setSelectedItems([]);
    }, [searchTerm, categoryFilter, providerFilter, statusFilter, returnFilter]);

    React.useEffect(() => {
        if (categoryFilter !== 'all') {
            setPrintShowCategory(false);
        } else {
            setPrintShowCategory(true);
        }
    }, [categoryFilter]);

    // Form State
    const [category, setCategory] = useState('drinks');
    const [itemsList, setItemsList] = useState([{ name: '', quantity: '', provider: '', notes: '' }]);

    const resetForm = () => {
        setCategory('drinks');
        setItemsList([{ name: '', quantity: '', provider: '', notes: '' }]);
        setEditingItem(null);
    };

    const handleOpenDialog = (item?: any) => {
        if (item) {
            setEditingItem(item);
            setCategory(item.category);
            setItemsList([{ name: item.name, quantity: item.quantity, provider: item.provider, notes: item.notes || '' }]);
        } else {
            resetForm();
        }
        setIsDialogOpen(true);
    };

    const updateItem = (index: number, field: string, value: string) => {
        const newItems = [...itemsList];
        newItems[index] = { ...newItems[index], [field]: value };
        setItemsList(newItems);
    };

    const addRow = () => {
        setItemsList([...itemsList, { name: '', quantity: '', provider: '', notes: '' }]);
    };

    const removeRow = (index: number) => {
        if (itemsList.length > 1) {
            const newItems = [...itemsList];
            newItems.splice(index, 1);
            setItemsList(newItems);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const validItems = itemsList.filter(item => item.name.trim() !== '' && item.provider.trim() !== '');
        
        if (validItems.length === 0) return;

        try {
            if (editingItem) {
                const itemData = {
                    name: validItems[0].name,
                    category,
                    quantity: validItems[0].quantity,
                    provider: validItems[0].provider,
                    notes: validItems[0].notes,
                    isProvided: editingItem.isProvided
                };
                await updateSummerCampItem(editingItem.id, itemData);
            } else {
                const bulkItems = validItems.map(item => ({
                    ...item,
                    category,
                    isProvided: false
                }));
                if (bulkItems.length === 1) {
                    await addSummerCampItem(bulkItems[0]);
                } else {
                    await addMultipleSummerCampItems(bulkItems);
                }
            }
            setIsDialogOpen(false);
            resetForm();
        } catch (error) {
            console.error(error);
        }
    };

    const handleDownloadTemplate = () => {
        const ws = XLSX.utils.aoa_to_sheet([
            ['اسم الصنف', 'الكمية', 'المتكفل', 'ملاحظات'],
            ['عصير برتقال', '50 علبة', 'شيخ فلان', 'عصير بدون سكر'],
            ['ماء معدني', '200 قارورة', 'تطوع من الأولياء', ''],
            ['أكواب بلاستيكية', '300 حبة', 'الإدارة', 'مهمة للرحلة']
        ]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "المستلزمات");
        XLSX.writeFile(wb, "نموذج_إضافة_مستلزمات.xlsx");
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = new Uint8Array(event.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json<any>(worksheet);

                // Map Excel data to our format
                const parsedItems = jsonData.map(row => ({
                    name: String(row['اسم الصنف'] || row['الاسم'] || row['Name'] || '').trim(),
                    quantity: String(row['الكمية'] || row['العدد'] || row['Quantity'] || '').trim(),
                    provider: String(row['المتكفل'] || row['المتبرع'] || row['Provider'] || '').trim(),
                    notes: String(row['ملاحظات'] || row['Notes'] || '').trim(),
                })).filter(item => item.name); // only keep rows that have a name

                if (parsedItems.length > 0) {
                    setItemsList(parsedItems);
                    toast({ title: "✅ نجاح", description: `تم استيراد ${parsedItems.length} أسطر بنجاح، يرجى المراجعة والحفظ.` });
                } else {
                    toast({ title: "⚠️ تنبيه", description: "لم يتم العثور على بيانات صحيحة في الملف. تأكد من تطابق أسماء الأعمدة مع القالب.", variant: "destructive" });
                }
            } catch (err) {
                console.error(err);
                toast({ title: "❌ خطأ", description: "تعذر قراءة ملف الإكسل. يرجى المحاولة بصيغة صحيحة.", variant: "destructive" });
            }
        };
        reader.readAsArrayBuffer(file);
        
        // Reset input so it can trigger onChange again for the same file if needed
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const uniqueProviders = useMemo(() => {
        const providers = new Set<string>();
        summerCampItems.forEach(item => {
            if (item.provider) providers.add(item.provider.trim());
        });
        return Array.from(providers).sort();
    }, [summerCampItems]);

    const filteredItems = useMemo(() => {
        return summerCampItems.filter(item => {
            // Search
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                if (!item.name.toLowerCase().includes(term) && !item.provider.toLowerCase().includes(term)) return false;
            }
            // Category
            if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
            // Provider
            if (providerFilter !== 'all' && item.provider !== providerFilter) return false;
            // Setup Status (isProvided)
            if (statusFilter === 'provided' && !item.isProvided) return false;
            if (statusFilter === 'pending' && item.isProvided) return false;
            // Return Status (isReturned)
            if (returnFilter === 'returned' && !item.isReturned) return false;
            if (returnFilter === 'pending' && item.isReturned) return false;

            return true;
        });
    }, [summerCampItems, searchTerm, categoryFilter, providerFilter, statusFilter, returnFilter]);

    // Global Progress Stats
    const totalItems = summerCampItems.length;
    const providedItems = summerCampItems.filter(i => i.isProvided).length;
    
    // Consumable Logic
    const returnableItems = summerCampItems.filter(i => !['drinks', 'food', 'cleaning'].includes(i.category));
    const totalReturnableItems = returnableItems.length;
    const returnedItems = returnableItems.filter(i => i.isReturned).length;
    
    // Percentages
    const prepProgress = totalItems === 0 ? 0 : Math.round((providedItems / totalItems) * 100);
    const returnProgress = totalReturnableItems === 0 ? (totalItems === 0 ? 0 : 100) : Math.round((returnedItems / totalReturnableItems) * 100);

    const handlePrint = () => {
        window.print();
    };

    const isAllSelected = filteredItems.length > 0 && selectedItems.length === filteredItems.length;

    const handleSelectAll = (checked: boolean) => {
        if (checked) setSelectedItems(filteredItems.map(i => i.id));
        else setSelectedItems([]);
    };

    const handleSelectItem = (id: string, checked: boolean) => {
        if (checked) setSelectedItems(prev => [...prev, id]);
        else setSelectedItems(prev => prev.filter(i => i !== id));
    };

    if (loading) return <div className="flex justify-center items-center min-h-[500px]"><Loader2 className="h-8 w-8 animate-spin" /></div>;

    return (
        <div className="max-w-7xl mx-auto pb-20 p-4 md:p-8">
          <div className="space-y-8 print:hidden">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black tracking-tight font-headline flex items-center gap-3">
                        <span className="p-3 rounded-2xl bg-orange-500/20 text-orange-500 md:bg-transparent md:text-inherit md:p-0">⛺</span>
                        مستلزمات المخيم الصيفي
                    </h1>
                    <p className="text-muted-foreground font-medium mt-2">تتبع وتجهيز كافة احتياجات المخيم بدقة ونظام</p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 print:hidden bg-white border border-slate-200 rounded-xl p-1">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-10 w-10 rounded-lg text-slate-500 hover:text-slate-800" title="خيارات الطباعة">
                                    <Settings className="h-5 w-5" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56 text-right font-medium">
                                <div className="p-2 text-xs text-muted-foreground border-b mb-1">خيارات الطباعة (اخفِ لتوفير المساحة)</div>
                                <DropdownMenuCheckboxItem checked={printShowCategory} onCheckedChange={setPrintShowCategory} className="justify-end flex-row-reverse text-right gap-2 cursor-pointer">
                                    أظهر عمود التصنيف
                                </DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem checked={printShowNotes} onCheckedChange={setPrintShowNotes} className="justify-end flex-row-reverse text-right gap-2 cursor-pointer">
                                    أظهر عمود الملاحظات
                                </DropdownMenuCheckboxItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <Button variant="ghost" onClick={handlePrint} className="h-10 px-4 rounded-lg font-bold gap-2 hover:bg-slate-100 text-slate-700">
                            <Printer className="h-4 w-4" />
                            طباعة الجدول
                        </Button>
                    </div>
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                        <Button onClick={() => handleOpenDialog()} className="h-12 px-8 rounded-xl font-bold gap-2 shadow-lg hover:shadow-primary/20 transition-all hover:scale-105 active:scale-95 bg-primary hover:bg-primary/90">
                            <Plus className="h-5 w-5" />
                            إضافة صنف جديد
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-4xl max-h-[90vh] bg-slate-900/95 border-white/10 backdrop-blur-xl text-white flex flex-col">
                        <DialogHeader className="shrink-0 mb-4">
                            <DialogTitle className="font-headline text-2xl">{editingItem ? 'تعديل الصنف' : 'إضافة أصناف جديدة (إضافة سريعة للجداول)'}</DialogTitle>
                            <DialogDescription className="text-slate-400">يمكنك ملء مجموعة كاملة من المستلزمات لمرة واحدة بدلاً من إضافتها عنصراً تلو الآخر.</DialogDescription>
                        </DialogHeader>
                        
                        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden relative">
                            {/* Category Selector and Excel Actions */}
                            <div className="shrink-0 pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-white/10 mb-4">
                                <div className="flex-1">
                                    <Label className="text-sm font-bold text-white mb-2 block">اختر تصنيف المجموعة</Label>
                                    <Select value={category} onValueChange={setCategory}>
                                        <SelectTrigger className="bg-white/5 border-white/10 w-full sm:max-w-xs h-11 text-md">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {CATEGORIES.map(cat => (
                                                <SelectItem key={cat.id} value={cat.id} className="text-right flex-row-reverse" dir="rtl">{cat.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                {!editingItem && (
                                    <div className="flex items-center gap-2">
                                        <input type="file" ref={fileInputRef} accept=".xlsx, .xls" className="hidden" onChange={handleFileUpload} />
                                        <Button type="button" variant="outline" onClick={handleDownloadTemplate} className="h-11 bg-white/5 border-white/10 hover:bg-white/10 gap-2 font-bold text-slate-300">
                                            <Download className="h-4 w-4" />
                                            تحميل القالب
                                        </Button>
                                        <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()} className="h-11 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30 gap-2 font-bold">
                                            <Upload className="h-4 w-4" />
                                            استيراد إكسل
                                        </Button>
                                    </div>
                                )}
                            </div>

                            {/* Scrollable Items Table */}
                            <div className="flex-1 overflow-y-auto px-1 space-y-3 pb-2 custom-scrollbar">
                                {itemsList.map((item, index) => (
                                    <div key={index} className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-3 items-end bg-white/5 p-3 rounded-xl border border-white/5 relative group transition-all focus-within:border-primary/50">
                                        <div className="space-y-1.5 flex flex-col">
                                            {index === 0 && <Label className="text-xs text-slate-400">اسم الصنف</Label>}
                                            <Input value={item.name} onChange={e => updateItem(index, 'name', e.target.value)} className="bg-slate-950/50 border-white/10 h-11" placeholder="مثال: عصير برتقال" required={itemsList.length === 1 || !!item.provider} />
                                        </div>
                                        <div className="space-y-1.5 flex flex-col">
                                            {index === 0 && <Label className="text-xs text-slate-400">الكمية</Label>}
                                            <Input value={item.quantity} onChange={e => updateItem(index, 'quantity', e.target.value)} className="bg-slate-950/50 border-white/10 h-11" placeholder="مثال: 50 علبة" required={!!item.name} />
                                        </div>
                                        <div className="space-y-1.5 flex flex-col">
                                            {index === 0 && <Label className="text-xs text-slate-400">المتكفل</Label>}
                                            <Input value={item.provider} onChange={e => updateItem(index, 'provider', e.target.value)} className="bg-slate-950/50 border-white/10 h-11" placeholder="اسم المتكفل" required={!!item.name} />
                                        </div>
                                        <div className="space-y-1.5 flex flex-col">
                                            {index === 0 && <Label className="text-xs text-slate-400">ملاحظات</Label>}
                                            <Input value={item.notes} onChange={e => updateItem(index, 'notes', e.target.value)} className="bg-slate-950/50 border-white/10 h-11" placeholder="ملاحظات إضافية" />
                                        </div>
                                        <div className={`flex items-center justify-center pb-1 ${index === 0 ? 'pt-6' : ''}`}>
                                            {!editingItem && itemsList.length > 1 && (
                                                <Button type="button" variant="ghost" size="icon" onClick={() => removeRow(index)} className="h-11 w-11 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg">
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                ))}

                                {!editingItem && (
                                    <Button type="button" variant="outline" onClick={addRow} className="w-full border-dashed border-white/20 bg-transparent hover:bg-white/5 h-12 rounded-xl gap-2 text-slate-300 font-bold mt-2">
                                        <Plus className="h-5 w-5" />
                                        إضافة سطر جديد
                                    </Button>
                                )}
                            </div>

                            {/* Footer Actions */}
                            <div className="shrink-0 pt-4 mt-2 border-t border-white/10 flex justify-end gap-3 pb-2">
                                <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)} className="h-11 px-6">إلغاء</Button>
                                <Button type="submit" className="h-11 px-8 font-bold shadow-lg shadow-primary/20 text-md">
                                    {editingItem ? 'حفظ التعديلات' : `حفظ البيانات (${itemsList.filter(i => i.name && i.provider).length})`}
                                </Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
                </div>
            </div>

            {/* Progress Dashboards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="border-none bg-gradient-to-br from-emerald-500/10 to-teal-500/10 relative overflow-hidden shadow-sm">
                    <CardContent className="p-6">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="h-14 w-14 rounded-full bg-emerald-500/20 flex items-center justify-center border-4 border-white/50 shadow-sm">
                                <Package className="h-6 w-6 text-emerald-600" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 text-lg">تجهيز المخيم (الذهاب)</h3>
                                <div className="text-sm font-medium text-slate-500">تم تجهيز {providedItems} من أصل {totalItems} صنف</div>
                            </div>
                        </div>
                        <div className="flex justify-between text-xs font-bold mb-2 text-emerald-700">
                            <span>نسبة التجهيز</span>
                            <span>{prepProgress}%</span>
                        </div>
                        <div className="h-3 w-full bg-emerald-900/10 rounded-full overflow-hidden">
                            <motion.div initial={{ width: 0 }} animate={{ width: `${prepProgress}%` }} className="h-full bg-emerald-500 rounded-full shadow-sm" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none bg-gradient-to-br from-orange-500/10 to-rose-500/10 relative overflow-hidden shadow-sm">
                    <CardContent className="p-6">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="h-14 w-14 rounded-full bg-orange-500/20 flex items-center justify-center border-4 border-white/50 shadow-sm">
                                <Truck className="h-6 w-6 text-orange-600" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 text-lg">إرجاع الممتلكات (العودة)</h3>
                                <div className="text-sm font-medium text-slate-500">تم إرجاع {returnedItems} من أصل {totalReturnableItems} صنف (باستثناء الاستهلاكية)</div>
                            </div>
                        </div>
                        <div className="flex justify-between text-xs font-bold mb-2 text-orange-700">
                            <span>نسبة الاسترجاع</span>
                            <span>{returnProgress}%</span>
                        </div>
                        <div className="h-3 w-full bg-orange-900/10 rounded-full overflow-hidden">
                            <motion.div initial={{ width: 0 }} animate={{ width: `${returnProgress}%` }} className="h-full bg-orange-500 rounded-full shadow-sm" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Mini Category Progress */}
            <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
                {CATEGORIES.map(cat => {
                    const catItems = summerCampItems.filter(i => i.category === cat.id);
                    if (catItems.length === 0) return null;
                    const catProvided = catItems.filter(i => i.isProvided).length;
                    const catProgress = Math.round((catProvided / catItems.length) * 100);

                    return (
                        <div key={cat.id} className="min-w-[140px] bg-white border border-slate-200 rounded-2xl p-4 shadow-sm shrink-0">
                            <div className="flex items-center justify-between mb-2">
                                <span className={`text-xs font-bold px-2 py-1 rounded-full ${cat.color}`}>{cat.label}</span>
                                <span className="text-[10px] font-bold text-slate-400">{catItems.length} صنف</span>
                            </div>
                            <div className="text-xl font-black text-slate-800 mb-1">{catProgress}%</div>
                            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                <motion.div initial={{ width: 0 }} animate={{ width: `${catProgress}%` }} className={`h-full ${catProgress === 100 ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Smart Filters Bar */}
            <Card className="bg-white border-slate-200 shadow-sm rounded-2xl overflow-hidden">
                <div className="p-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-slate-500 text-sm font-bold px-4">
                    <div className="flex items-center gap-2">
                        <Filter className="h-4 w-4" />
                        الفلترة الذكية
                    </div>
                    {(searchTerm !== '' || categoryFilter !== 'all' || providerFilter !== 'all' || statusFilter !== 'all' || returnFilter !== 'all') && (
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => {
                                setSearchTerm('');
                                setCategoryFilter('all');
                                setProviderFilter('all');
                                setStatusFilter('all');
                                setReturnFilter('all');
                            }}
                            className="h-7 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 focus:ring-0 px-2 rounded-md"
                        >
                            مسح الفلاتر
                        </Button>
                    )}
                </div>
                <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
                    {/* Search */}
                    <div className="relative col-span-1 sm:col-span-2 md:col-span-1">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input 
                            placeholder="بحث بالاسم أو المتكفل..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-3 pr-9 h-10 w-full"
                        />
                    </div>
                    {/* Category Filter */}
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                        <SelectTrigger className="h-10"><SelectValue placeholder="كل التصنيفات" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">كل التصنيفات</SelectItem>
                            {CATEGORIES.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.label}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    {/* Provider Filter */}
                    <Select value={providerFilter} onValueChange={setProviderFilter}>
                        <SelectTrigger className="h-10"><SelectValue placeholder="كل المتكفلين" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">كل المتكفلين</SelectItem>
                            {uniqueProviders.map(provider => <SelectItem key={provider} value={provider}>{provider}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    {/* Status Filter */}
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="h-10"><SelectValue placeholder="حالة التجهيز" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">الكل (التجهيز)</SelectItem>
                            <SelectItem value="provided">تم التجهيز</SelectItem>
                            <SelectItem value="pending">في الانتظار</SelectItem>
                        </SelectContent>
                    </Select>
                    {/* Return Filter */}
                    <Select value={returnFilter} onValueChange={setReturnFilter}>
                        <SelectTrigger className="h-10"><SelectValue placeholder="حالة الإرجاع" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">الكل (الإرجاع)</SelectItem>
                            <SelectItem value="returned">عادت للشاحنة</SelectItem>
                            <SelectItem value="pending">لم ترجع بعد</SelectItem>
                        </SelectContent>
                    </Select>
                </CardContent>
            </Card>

            {/* Unified Table */}
            <div className="overflow-auto max-h-[70vh] rounded-3xl border border-slate-200/60 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] custom-scrollbar">
                <table className="w-full text-right text-sm">
                    <thead className="bg-slate-50/95 backdrop-blur-md text-slate-500 border-b border-slate-200 sticky top-0 z-20 shadow-sm">
                        <tr>
                            <th className="px-4 py-5 w-12 text-center align-middle">
                                <Checkbox 
                                    checked={isAllSelected} 
                                    onCheckedChange={handleSelectAll} 
                                    className="border-slate-300 data-[state=checked]:bg-primary h-5 w-5"
                                />
                            </th>
                            <th className="px-6 py-5 font-bold w-16 text-center text-[12px]">التجهيز</th>
                            <th className="px-6 py-5 font-bold w-16 text-center text-[12px]">الإرجاع</th>
                            <th className="px-6 py-5 font-bold text-[13px]">التصنيف / الاسم</th>
                            <th className="px-6 py-5 font-bold text-[13px]">الكمية / المتكفل</th>
                            <th className="px-6 py-5 font-bold text-[13px]">ملاحظات</th>
                            <th className="px-6 py-5 font-bold w-28 text-center text-[13px]">إجراءات</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        <AnimatePresence>
                            {filteredItems.map(item => {
                                const catDetails = CATEGORIES.find(c => c.id === item.category);
                                return (
                                    <motion.tr
                                        key={item.id}
                                        layout
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        className={`group transition-all duration-300 hover:bg-slate-50/80 ${selectedItems.includes(item.id) ? 'bg-primary/5 shadow-[inset_4px_0_0_0_hsl(var(--primary))]' : item.isReturned ? 'bg-orange-50/30' : (item.isProvided ? 'bg-emerald-50/30' : 'bg-white')}`}
                                    >
                                        <td className="px-4 py-4 text-center align-middle border-l border-slate-50 rtl:border-l-0 rtl:border-r">
                                            <Checkbox 
                                                checked={selectedItems.includes(item.id)} 
                                                onCheckedChange={(checked) => handleSelectItem(item.id, checked as boolean)} 
                                                className="border-slate-300 data-[state=checked]:bg-primary h-5 w-5 mx-auto"
                                            />
                                        </td>
                                        <td className="px-6 py-4 text-center align-middle border-l border-slate-50">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => toggleItemProvided(item.id, item.isProvided)}
                                                className={`h-11 w-11 rounded-full transition-all mx-auto ${item.isProvided ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20 hover:bg-emerald-600 hover:-translate-y-0.5' : 'bg-slate-50 border border-slate-200 text-slate-400 hover:bg-emerald-50 hover:text-emerald-500 hover:border-emerald-200 hover:-translate-y-0.5'}`}
                                                title="حالة التجهيز"
                                            >
                                                {item.isProvided ? <Check className="h-5 w-5" /> : <div className="h-5 w-5 rounded-full border-2 border-slate-300 group-hover:border-emerald-400/50" />}
                                            </Button>
                                        </td>
                                        <td className="px-6 py-4 text-center align-middle border-l border-slate-50">
                                            {['drinks', 'food', 'cleaning'].includes(item.category) ? (
                                                <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100 shadow-sm inline-flex justify-center items-center">استهلاكي</span>
                                            ) : (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => toggleItemReturned(item.id, Boolean(item.isReturned))}
                                                    className={`h-11 w-11 rounded-full transition-all mx-auto ${item.isReturned ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20 hover:bg-orange-600 hover:-translate-y-0.5' : 'bg-slate-50 border border-slate-200 text-slate-400 hover:bg-orange-50 hover:text-orange-500 hover:border-orange-200 hover:-translate-y-0.5'}`}
                                                    title="حالة الإرجاع للشاحنة"
                                                >
                                                    {item.isReturned ? <Truck className="h-5 w-5" /> : <Truck className="h-5 w-5 opacity-50" />}
                                                    {item.isReturned && <Check className="h-3 w-3 absolute -bottom-1 -right-1 bg-white text-orange-600 rounded-full border border-orange-200" />}
                                                </Button>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 align-middle">
                                            <div className="flex flex-col gap-1.5">
                                                {catDetails && <span className={`text-[10px] px-2 py-0.5 rounded-md w-fit font-bold ${catDetails.color}`}>{catDetails.label}</span>}
                                                <span className={`font-bold text-base transition-colors ${item.isReturned ? 'text-orange-700' : (item.isProvided ? 'text-emerald-700' : 'text-slate-800 group-hover:text-primary')}`}>
                                                    {item.name}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 font-medium text-slate-600 align-middle">
                                            <div className="flex flex-col gap-2">
                                                <div className="flex items-center gap-2">
                                                    <div className="p-1 bg-slate-100 rounded text-slate-400"><Package className="h-3.5 w-3.5" /></div>
                                                    <span className="text-sm">{item.quantity}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="p-1 bg-slate-100 rounded text-slate-400"><User className="h-3.5 w-3.5" /></div>
                                                    <span className="text-xs text-slate-500">{item.provider}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 align-middle">
                                            <div className="flex flex-col gap-2">
                                                {item.notes ? (
                                                    <div className="text-[12px] text-slate-500 outline-dashed outline-1 outline-slate-200 p-2 rounded bg-slate-50/50 w-full line-clamp-2">
                                                        {item.notes}
                                                    </div>
                                                ) : <span className="text-slate-300 text-xs">-</span>}
                                                
                                                <div className="flex gap-2 text-[10px] font-bold">
                                                    {item.isProvided && item.providedAt && (
                                                        <span className="text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                                                            تجهيز: {format(new Date(item.providedAt), 'MM/dd HH:mm')}
                                                        </span>
                                                    )}
                                                    {item.isReturned && item.returnedAt && (
                                                        <span className="text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-100">
                                                            إرجاع: {format(new Date(item.returnedAt), 'MM/dd HH:mm')}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center align-middle">
                                            <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0">
                                                <Button onClick={() => handleOpenDialog(item)} variant="outline" size="icon" className="h-9 w-9 rounded-xl shadow-sm border-slate-200 text-slate-600 hover:text-primary hover:border-primary/30 hover:bg-primary/5">
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    onClick={() => {
                                                        if (confirm('هل أنت متأكد من حذف هذا الصنف نهائياً؟')) deleteSummerCampItem(item.id);
                                                    }}
                                                    variant="outline" size="icon" className="h-9 w-9 rounded-xl shadow-sm border-slate-200 text-slate-600 hover:text-red-600 hover:border-red-200 hover:bg-red-50"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </td>
                                    </motion.tr>
                                );
                            })}
                        </AnimatePresence>
                    </tbody>
                </table>
                {filteredItems.length === 0 && (
                    <div className="text-center py-20 text-slate-400">
                        <Search className="h-12 w-12 mx-auto mb-4 opacity-20" />
                        <p className="text-lg font-medium">لا توجد أصناف تطابق الفلتر الحالي!</p>
                    </div>
                )}
            </div>

            {/* Bulk Action Bar */}
            <AnimatePresence>
                {selectedItems.length > 0 && (
                    <motion.div 
                        initial={{ opacity: 0, y: 50, x: '-50%' }}
                        animate={{ opacity: 1, y: 0, x: '-50%' }}
                        exit={{ opacity: 0, y: 50, x: '-50%' }}
                        className="fixed bottom-6 left-1/2 bg-slate-900 border border-slate-700/50 shadow-2xl shadow-slate-900/50 text-white px-2 py-2 sm:px-6 sm:py-3 rounded-full flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-4 z-50 w-[95%] sm:w-auto"
                    >
                        <div className="font-bold flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-full text-sm shrink-0">
                            <span className="text-primary font-black bg-white h-6 w-6 rounded-full flex items-center justify-center text-xs">{selectedItems.length}</span>
                            محدد
                        </div>
                        <div className="hidden sm:block h-6 w-px bg-white/20 mx-1"></div>
                        <div className="flex flex-wrap sm:flex-nowrap justify-center gap-2 flex-1">
                            <Button size="sm" onClick={() => { bulkUpdateItems(selectedItems, { isProvided: true, providedAt: new Date().toISOString() }); setSelectedItems([]); }} className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-full h-9 text-xs sm:text-sm">
                                تم تجهيز
                            </Button>
                            <Button size="sm" onClick={() => { bulkUpdateItems(selectedItems, { isProvided: false, providedAt: null }); setSelectedItems([]); }} variant="ghost" className="hover:bg-white/10 rounded-full h-9 text-xs sm:text-sm text-slate-300">
                                إلغاء التجهيز
                            </Button>
                            <div className="hidden sm:block h-6 w-px bg-white/20 mx-1 self-center"></div>
                            <Button size="sm" onClick={() => { bulkUpdateItems(selectedItems, { isReturned: true, returnedAt: new Date().toISOString() }); setSelectedItems([]); }} className="bg-orange-500 hover:bg-orange-600 text-white rounded-full h-9 text-xs sm:text-sm">
                                تم الإرجاع
                            </Button>
                            <Button size="sm" onClick={() => { bulkUpdateItems(selectedItems, { isReturned: false, returnedAt: null }); setSelectedItems([]); }} variant="ghost" className="hover:bg-white/10 rounded-full h-9 text-xs sm:text-sm text-slate-300 hover:text-white">
                                إلغاء الإرجاع
                            </Button>
                            <div className="hidden sm:block h-6 w-px bg-white/20 mx-1 self-center"></div>
                            <Button size="sm" onClick={() => { 
                                if(confirm('هل أنت متأكد من حذف هذه الأصناف المحددة؟ لا يمكن التراجع عن هذا الإجراء!')) {
                                    selectedItems.forEach(id => deleteSummerCampItem(id));
                                    setSelectedItems([]);
                                }
                            }} variant="ghost" className="hover:bg-red-500/20 hover:text-red-400 text-slate-400 rounded-full h-9 text-xs sm:text-sm transition-colors">
                                <Trash2 className="h-4 w-4 ml-1" /> حذف
                            </Button>
                        </div>
                        
                        <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-white/10 rounded-full shrink-0 mr-1 sm:mr-2 sm:ml-0 m-auto sm:m-0" onClick={() => setSelectedItems([])}>
                            <X className="h-4 w-4" />
                        </Button>
                    </motion.div>
                )}
            </AnimatePresence>

          </div>

          {/* Hidden Report Component - Visible on Print */}
          <div className="hidden print:block summercamp-report-print">
              <SummerCampReport
                  items={filteredItems}
                  categoryFilter={categoryFilter}
                  providerFilter={providerFilter}
                  date={new Date()}
                  showCategory={printShowCategory}
                  showNotes={printShowNotes}
              />
          </div>
        </div>
    );
}
