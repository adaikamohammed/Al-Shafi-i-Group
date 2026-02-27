"use client";

import React, { useMemo, useState, useCallback } from 'react';
import { Search, X, Filter, Users, BookOpen, Clock, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SmartSearchProps {
    students: any[];
    sheikhs: { group: string; displayName: string; uids: Set<string> }[];
    onStudentClick?: (id: string, name: string, group: string) => void;
}

interface SmartFilter {
    id: string;
    label: string;
    icon: string;
    filter: (students: any[]) => any[];
}

export function SmartSearch({ students, sheikhs, onStudentClick }: SmartSearchProps) {
    const [query, setQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState<string | null>(null);
    const [isOpen, setIsOpen] = useState(false);

    const activeStudents = useMemo(() =>
        (students || []).filter(s => s.status === 'نشط'),
        [students]);

    // Smart filters
    const smartFilters: SmartFilter[] = useMemo(() => [
        {
            id: 'all',
            label: 'جميع الطلاب',
            icon: '👥',
            filter: (st) => st,
        },
    ], []);

    // Search results
    const results = useMemo(() => {
        let filtered = activeStudents;

        // Apply smart filter
        if (activeFilter) {
            const sf = smartFilters.find(f => f.id === activeFilter);
            if (sf) filtered = sf.filter(filtered);
        }

        // Apply text search
        if (query.trim()) {
            const q = query.trim().toLowerCase();
            filtered = filtered.filter(s =>
                (s.fullName || '').toLowerCase().includes(q) ||
                ((s as any).group || s.groupName || '').toLowerCase().includes(q)
            );
        }

        // Also search sheikhs
        let sheikhResults: typeof sheikhs = [];
        if (query.trim()) {
            const q = query.trim().toLowerCase();
            sheikhResults = sheikhs.filter(sh =>
                sh.displayName.toLowerCase().includes(q) ||
                sh.group.toLowerCase().includes(q)
            );
        }

        return { students: filtered.slice(0, 20), sheikhs: sheikhResults, totalStudents: filtered.length };
    }, [activeStudents, query, activeFilter, smartFilters, sheikhs]);

    return (
        <div className="relative print:hidden">
            {/* Search bar */}
            <div className="flex items-center gap-2 bg-card border rounded-xl px-3 py-2 shadow-sm">
                <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                <input
                    type="text"
                    value={query}
                    onChange={e => { setQuery(e.target.value); setIsOpen(true); }}
                    onFocus={() => setIsOpen(true)}
                    placeholder="ابحث عن طالب أو شيخ..."
                    className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
                    dir="rtl"
                />
                {query && (
                    <button onClick={() => { setQuery(''); setActiveFilter(null); }} className="p-1 hover:bg-muted rounded" title="مسح">
                        <X className="h-3 w-3" />
                    </button>
                )}
            </div>

            {/* Dropdown results */}
            {isOpen && (query || activeFilter) && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                    <div className="absolute top-full mt-1 left-0 right-0 z-50 bg-white border rounded-xl shadow-2xl max-h-80 overflow-y-auto" dir="rtl">
                        {/* Smart filter chips */}
                        <div className="flex flex-wrap gap-1 p-2 border-b bg-slate-50/50">
                            <Filter className="h-3.5 w-3.5 text-muted-foreground self-center ml-1" />
                            {smartFilters.map(f => (
                                <button
                                    key={f.id}
                                    onClick={() => setActiveFilter(activeFilter === f.id ? null : f.id)}
                                    className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all",
                                        activeFilter === f.id ? "bg-primary text-white border-primary" : "bg-white border-border hover:bg-muted"
                                    )}
                                >
                                    {f.icon} {f.label}
                                </button>
                            ))}
                        </div>

                        {/* Sheikh results */}
                        {results.sheikhs.length > 0 && (
                            <div className="border-b">
                                <div className="px-3 py-1.5 bg-slate-50 text-[9px] font-bold text-muted-foreground">المشايخ</div>
                                {results.sheikhs.map(sh => (
                                    <div key={sh.group} className="flex items-center gap-2 px-3 py-2 hover:bg-muted/30 transition-colors">
                                        <Users className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                        <span className="text-xs font-bold">{sh.displayName}</span>
                                        <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold">{sh.group}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Student results */}
                        {results.students.length > 0 && (
                            <div>
                                <div className="px-3 py-1.5 bg-slate-50 text-[9px] font-bold text-muted-foreground flex items-center justify-between">
                                    <span>الطلاب</span>
                                    <span>{results.totalStudents} نتيجة</span>
                                </div>
                                {results.students.map(s => {
                                    const grp = (s as any).group || s.groupName || '';
                                    return (
                                        <button
                                            key={s.id}
                                            onClick={() => { onStudentClick?.(s.id, s.fullName, grp); setIsOpen(false); }}
                                            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/30 transition-colors text-right"
                                        >
                                            <BookOpen className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                                            <span className="text-xs font-bold truncate">{s.fullName}</span>
                                            <span className="text-[10px] bg-muted/40 px-1.5 py-0.5 rounded font-medium mr-auto shrink-0">{grp}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {results.students.length === 0 && results.sheikhs.length === 0 && query && (
                            <div className="p-6 text-center text-xs text-muted-foreground">لا نتائج لـ "{query}"</div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
