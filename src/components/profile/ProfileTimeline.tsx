"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, Calendar, GraduationCap, School } from 'lucide-react';
import { EducationEvent } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';
import { motion, AnimatePresence } from 'framer-motion';

interface ProfileTimelineProps {
    educationTimeline: EducationEvent[];
    onChange: (timeline: EducationEvent[]) => void;
    birthDate: string;
    onBirthDateChange: (date: string) => void;
    quranCompletedDate: string;
    onQuranCompletedDateChange: (date: string) => void;
    editable: boolean;
}

export function ProfileTimeline({
    educationTimeline,
    onChange,
    birthDate,
    onBirthDateChange,
    quranCompletedDate,
    onQuranCompletedDateChange,
    editable
}: ProfileTimelineProps) {

    const handleAddEvent = () => {
        const newEvent: EducationEvent = {
            id: uuidv4(),
            sheikhName: '',
            institution: '',
            startDate: '',
            endDate: '',
            notes: ''
        };
        onChange([...educationTimeline, newEvent]);
    };

    const handleUpdateEvent = (id: string, field: keyof EducationEvent, value: string) => {
        const updatedTimeline = educationTimeline.map(event =>
            event.id === id ? { ...event, [field]: value } : event
        );
        onChange(updatedTimeline);
    };

    const handleRemoveEvent = (id: string) => {
        onChange(educationTimeline.filter(event => event.id !== id));
    };

    // Sort events by start date (descending)
    const sortedEvents = [...educationTimeline].sort((a, b) =>
        new Date(b.startDate || '1900').getTime() - new Date(a.startDate || '1900').getTime()
    );

    return (
        <div className="space-y-8">
            <Card className="rounded-[1.5rem] border-none shadow-sm overflow-hidden">
                <CardHeader className="bg-primary/5 border-b border-primary/10">
                    <CardTitle className="text-xl font-headline flex items-center gap-2">
                        <GraduationCap className="h-5 w-5 text-primary" /> المسيرة التعليمية
                    </CardTitle>
                    <CardDescription>
                        سجّل محطاتك العلمية، المشايخ الذين درست عليهم، وتواريخ الإنجاز.
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                    {/* Key Dates */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label className="font-bold flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-muted-foreground" /> تاريخ الميلاد
                            </Label>
                            <Input
                                type="date"
                                value={birthDate}
                                onChange={(e) => onBirthDateChange(e.target.value)}
                                disabled={!editable}
                                className="rounded-xl bg-muted/20"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="font-bold flex items-center gap-2 text-emerald-700">
                                <GraduationCap className="h-4 w-4" /> تاريخ ختم القرآن كاملاً
                            </Label>
                            <Input
                                type="date"
                                value={quranCompletedDate}
                                onChange={(e) => onQuranCompletedDateChange(e.target.value)}
                                disabled={!editable}
                                className="rounded-xl bg-emerald-50/50 border-emerald-100"
                            />
                        </div>
                    </div>

                    <div className="relative border-r-2 border-primary/20 mr-3 space-y-8 pr-8 py-2">
                        <div className="absolute -right-1.5 top-0 w-3 h-3 rounded-full bg-primary/20" />

                        <AnimatePresence>
                            {sortedEvents.map((event, index) => (
                                <motion.div
                                    key={event.id}
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="relative group"
                                >
                                    {/* Dot */}
                                    <div className="absolute -right-[39px] top-6 w-5 h-5 rounded-full border-4 border-background bg-primary shadow-sm group-hover:scale-125 transition-transform" />

                                    <Card className="rounded-xl border hover:border-primary/30 transition-colors">
                                        <CardContent className="p-4 grid gap-4">
                                            {editable ? (
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <Label className="text-xs">الشيخ / المعلم</Label>
                                                        <Input
                                                            value={event.sheikhName}
                                                            onChange={(e) => handleUpdateEvent(event.id, 'sheikhName', e.target.value)}
                                                            placeholder="اسم الشيخ..."
                                                            className="h-9"
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label className="text-xs">المكان / المدرسة</Label>
                                                        <Input
                                                            value={event.institution}
                                                            onChange={(e) => handleUpdateEvent(event.id, 'institution', e.target.value)}
                                                            placeholder="المكان..."
                                                            className="h-9"
                                                        />
                                                    </div>
                                                    <div className="flex gap-2 text-sm">
                                                        <div className="flex-1 space-y-1">
                                                            <Label className="text-xs">من</Label>
                                                            <Input
                                                                type="date"
                                                                value={event.startDate}
                                                                onChange={(e) => handleUpdateEvent(event.id, 'startDate', e.target.value)}
                                                                className="h-9"
                                                            />
                                                        </div>
                                                        <div className="flex-1 space-y-1">
                                                            <Label className="text-xs">إلى</Label>
                                                            <Input
                                                                type="date"
                                                                value={event.endDate}
                                                                onChange={(e) => handleUpdateEvent(event.id, 'endDate', e.target.value)}
                                                                className="h-9"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className=" md:col-span-2 flex items-center gap-2">
                                                        <Textarea
                                                            value={event.notes}
                                                            onChange={(e) => handleUpdateEvent(event.id, 'notes', e.target.value)}
                                                            placeholder="ملاحظات أو إجازات تم تحصيلها..."
                                                            className="min-h-[60px] text-sm"
                                                        />
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="text-destructive hover:bg-destructive/10"
                                                            onClick={() => handleRemoveEvent(event.id)}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <h3 className="font-bold text-lg">{event.sheikhName}</h3>
                                                        <div className="text-sm text-muted-foreground flex items-center gap-2">
                                                            <School className="h-3 w-3" /> {event.institution}
                                                        </div>
                                                        <div className="text-xs text-muted-foreground mt-1 bg-muted px-2 py-1 rounded-md inline-block">
                                                            {event.startDate} - {event.endDate || 'الآن'}
                                                        </div>
                                                        {event.notes && (
                                                            <p className="mt-2 text-sm text-gray-700 bg-gray-50 p-2 rounded-lg border border-gray-100">
                                                                {event.notes}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            ))}
                        </AnimatePresence>

                        {editable && (
                            <Button
                                variant="outline"
                                onClick={handleAddEvent}
                                className="w-full border-dashed border-2 py-6 text-muted-foreground hover:bg-muted hover:text-primary"
                            >
                                <Plus className="ml-2 h-4 w-4" /> إضافة محطة تعليمية جديدة
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
