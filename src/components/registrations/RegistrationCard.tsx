import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Phone, User, Calendar, MapPin, MoreHorizontal, Edit, Check, X, UserRound, Eye, ArrowRightLeft } from 'lucide-react';
import { PreRegistration, PreRegistrationStatus } from '@/lib/types';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { format, differenceInYears, isValid } from 'date-fns';

interface RegistrationCardProps {
    registration: PreRegistration;
    onEdit: (reg: PreRegistration) => void;
    onStatusChange?: (id: string, status: PreRegistrationStatus) => void;
    onSelect?: (id: string) => void;
    isSelected?: boolean;
    onView?: (reg: PreRegistration) => void;
}

const statusColors: Record<PreRegistrationStatus, string> = {
    "تم الإنضمام": "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-800",
    "تم الإتصال": "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-800",
    "تم إرسال رسالة": "bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-900/40 dark:text-cyan-300 dark:border-cyan-800",
    "لم يرد": "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300 dark:border-indigo-800",
    "مرفوض": "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800",
    "مؤجل": "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/40 dark:text-yellow-300 dark:border-yellow-800",
    "إنضم لمدرسة أخرى": "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800",
    "مرشح": "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/40 dark:text-orange-300 dark:border-orange-800",
    "مكرر": "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/40 dark:text-gray-300 dark:border-gray-800",
};

export const RegistrationCard = ({ registration, onEdit, onStatusChange, onSelect, isSelected, onView }: RegistrationCardProps) => {
    const age = registration.birthDate ? differenceInYears(new Date(), new Date(registration.birthDate)) : 'غير محدد';

    return (
        <Card
            className={cn(
                "overflow-hidden transition-all hover:shadow-md cursor-pointer",
                isSelected && "ring-2 ring-primary border-primary"
            )}
            onClick={() => onView?.(registration)}
        >
            <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                    {/* Checkbox for selection (optional, can be added if needed for bulk actions on mobile) */}
                    {onSelect && (
                        <div onClick={() => onSelect(registration.id)} className={cn("w-5 h-5 rounded-full border cursor-pointer mt-1 flex items-center justify-center transition-colors", isSelected ? "bg-primary border-primary" : "border-muted-foreground/30")}>
                            {isSelected && <Check className="w-3 h-3 text-white" />}
                        </div>
                    )}

                    <div className="flex-1 flex gap-3">
                        <Avatar className="h-12 w-12 border-2 border-white shadow-sm">
                            <AvatarImage src={registration.photoURL} />
                            <AvatarFallback className={cn(registration.gender === 'أنثى' ? 'bg-pink-50 text-pink-600' : 'bg-blue-50 text-blue-600')}>
                                {registration.gender === 'أنثى' ? <UserRound className="h-5 w-5" /> : <User className="h-5 w-5" />}
                            </AvatarFallback>
                        </Avatar>

                        <div className="space-y-1">
                            <h3 className="font-bold text-base leading-none">{registration.fullName}</h3>
                            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                                {age !== 'غير محدد' && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {age} سنة</span>}
                                {registration.educationalLevel && <span className="bg-secondary/50 px-1.5 py-0.5 rounded text-secondary-foreground">{registration.educationalLevel}</span>}
                            </div>
                        </div>
                    </div>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 -mt-1 -ml-2">
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>

                        <DropdownMenuContent align="end" className="w-40" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenuItem onClick={() => onEdit(registration)}>
                                <Edit className="ml-2 h-4 w-4" /> تعديل البيانات
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onView?.(registration)}>
                                <Eye className="ml-2 h-4 w-4" /> عرض كامل
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                <div className="mt-4 flex items-center justify-between gap-2" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className={cn("font-bold px-3 py-1", statusColors[registration.status])}>
                            {registration.status}
                        </Badge>

                        {/* Quick Action Buttons for status change */}
                        {registration.status === 'مرشح' && onStatusChange && (
                            <div className="flex items-center gap-1.5 border-r pr-2 mr-1">
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 px-2 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                                    onClick={() => onStatusChange(registration.id, 'تم الإنضمام')}
                                >
                                    <Check className="h-4 w-4 ml-1" />
                                    قبول
                                </Button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 px-2 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                                    onClick={() => onStatusChange(registration.id, 'مرفوض')}
                                >
                                    <X className="h-4 w-4 ml-1" />
                                    رفض
                                </Button>
                            </div>
                        )}

                        {/* Transfer Button for Joined Students */}
                        {registration.status === 'تم الإنضمام' && onStatusChange && (
                            <div className="flex items-center gap-1.5 border-r pr-2 mr-1">
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 px-2 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                                    title="نقل الطالب إلى فوج آخر"
                                    onClick={() => onStatusChange(registration.id, 'تم الإنضمام')}
                                >
                                    <ArrowRightLeft className="h-4 w-4 ml-1" />
                                    نقل
                                </Button>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <a
                            href={`tel:${registration.phone1}`}
                            className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80"
                            aria-label="اتصال هاتفي"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <Phone className="h-4 w-4" />
                        </a>
                        <a
                            href={`https://wa.me/${registration.phone1.replace(/\s/g, '').replace(/^0/, '213')}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-green-100 text-green-700 hover:bg-green-200"
                            aria-label="مراسلة واتساب"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" /></svg>
                        </a>
                    </div>
                </div>
            </CardContent>
        </Card >
    );
};
