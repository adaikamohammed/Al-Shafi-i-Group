"use client";

import React, { useState } from 'react';
import { useAdmin } from '@/context/AdminContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { FileText, Upload, Trash2, Download, Search, File, Loader2, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { formatBytes } from '@/lib/utils'; // Assuming this utility exists or I'll implement inline
import { useToast } from '@/hooks/use-toast';

// Simple bytes formatter if utils doesn't have it
const formatFileSize = (bytes?: number) => {
    if (bytes === undefined) return 'N/A';
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export default function DocumentsRepoPage() {
    const { adminDocuments, uploadAdminDocument, deleteAdminDocument, loading } = useAdmin();
    const { toast } = useToast();
    const [isUploading, setIsUploading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Upload State
    const [file, setFile] = useState<File | null>(null);
    const [title, setTitle] = useState('');
    const [notes, setNotes] = useState('');
    const [docType, setDocType] = useState('وثيقة إدارية');
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file || !title) return;

        setIsUploading(true);
        try {
            await uploadAdminDocument(file, title, notes, docType);
            setIsDialogOpen(false);
            setFile(null);
            setTitle('');
            setNotes('');
        } catch (error) {
            console.error(error);
        } finally {
            setIsUploading(false);
        }
    };

    const filteredDocs = adminDocuments.filter(doc =>
        doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (doc.notes && doc.notes.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    if (loading) return <div className="flex justify-center items-center min-h-[500px]"><Loader2 className="h-8 w-8 animate-spin" /></div>;

    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-20 p-4 md:p-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black tracking-tight font-headline">الوثائق الإدارية</h1>
                    <p className="text-muted-foreground font-medium mt-2">مستودع الوثائق والنماذج الرسمية للتحميل والاستخدام</p>
                </div>

                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button className="h-12 px-8 rounded-xl font-bold gap-2 shadow-lg bg-primary hover:bg-primary/90">
                            <Upload className="h-5 w-5" />
                            رفع وثيقة جديدة
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md bg-slate-900/95 border-white/10 backdrop-blur-xl text-white">
                        <DialogHeader>
                            <DialogTitle className="font-headline text-xl">رفع وثيقة جديدة</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleUpload} className="space-y-4 pt-4">
                            <div className="space-y-2">
                                <Label>عنوان الوثيقة</Label>
                                <Input value={title} onChange={e => setTitle(e.target.value)} className="bg-white/5 border-white/10" placeholder="مثال: القانون الداخلي للمخيم" required />
                            </div>
                            <div className="space-y-2">
                                <Label>نوع الوثيقة</Label>
                                <Input value={docType} onChange={e => setDocType(e.target.value)} className="bg-white/5 border-white/10" placeholder="مثال: PDF, Word, صورة" />
                            </div>
                            <div className="space-y-2">
                                <Label>الملف</Label>
                                <div className="border-2 border-dashed border-white/10 rounded-xl p-6 text-center hover:bg-white/5 transition-colors cursor-pointer relative">
                                    <Input type="file" onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer" required />
                                    <div className="flex flex-col items-center gap-2">
                                        <Upload className="h-8 w-8 text-muted-foreground" />
                                        <span className="text-sm font-medium">{file ? file.name : 'انقر لاختيار ملف'}</span>
                                        {file && <span className="text-xs text-muted-foreground">{formatFileSize(file.size)}</span>}
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>ملاحظات (اختياري)</Label>
                                <Input value={notes} onChange={e => setNotes(e.target.value)} className="bg-white/5 border-white/10" />
                            </div>
                            <DialogFooter className="gap-2 pt-4">
                                <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)} disabled={isUploading}>إلغاء</Button>
                                <Button type="submit" className="font-bold" disabled={isUploading}>
                                    {isUploading ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
                                    {isUploading ? 'جاري الرفع...' : 'رفع الملف'}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Search Bar */}
            <div className="relative max-w-md">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="ابحث عن وثيقة..."
                    className="pr-10 h-11 bg-white/5 border-white/10 rounded-xl"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>

            {/* Documents List */}
            <div className="space-y-4">
                <AnimatePresence>
                    {filteredDocs.map((doc, index) => (
                        <motion.div
                            key={doc.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ delay: index * 0.05 }}
                        >
                            <Card className="border-white/5 bg-white/5 hover:bg-white/10 transition-colors group">
                                <CardContent className="p-4 flex items-center gap-4">
                                    <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/10 shrink-0">
                                        <FileText className="h-6 w-6 text-blue-500" />
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-lg truncate">{doc.title}</h3>
                                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                                            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {format(new Date(doc.uploadedAt), 'yyyy/MM/dd')}</span>
                                            <span className="flex items-center gap-1"><File className="h-3 w-3" /> {formatFileSize(doc.size)}</span>
                                            {doc.notes && <span className="truncate hidden md:inline-block max-w-[200px] opacity-70">• {doc.notes}</span>}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <Button variant="secondary" size="sm" className="h-9 gap-2 font-bold hidden md:flex" asChild>
                                            <a href={doc.url} target="_blank" rel="noopener noreferrer" download>
                                                <Download className="h-4 w-4" />
                                                تحميل
                                            </a>
                                        </Button>
                                        <Button variant="secondary" size="icon" className="h-9 w-9 md:hidden" asChild>
                                            <a href={doc.url} target="_blank" rel="noopener noreferrer" download>
                                                <Download className="h-4 w-4" />
                                            </a>
                                        </Button>

                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => {
                                                if (confirm('هل أنت متأكد من حذف هذه الوثيقة نهائياً؟')) deleteAdminDocument(doc);
                                            }}
                                            className="h-9 w-9 text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ))}
                </AnimatePresence>

                {filteredDocs.length === 0 && (
                    <div className="text-center py-20 text-muted-foreground">
                        <FileText className="h-16 w-16 mx-auto mb-4 opacity-20" />
                        <p className="text-lg font-medium">لا توجد وثائق مطابقة</p>
                    </div>
                )}
            </div>
        </div>
    );
}
