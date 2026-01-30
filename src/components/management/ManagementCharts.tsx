"use client";

import React from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, LabelList,
    PieChart, Pie, Cell, Legend
} from 'recharts';
import { Shield, UserCheck } from 'lucide-react';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#6366f1'];

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-white/95 backdrop-blur-xl p-4 rounded-xl shadow-2xl border border-slate-100 text-right min-w-[200px]">
                <div className="flex items-center gap-2 mb-2 border-b pb-2">
                    <div className="p-1.5 bg-indigo-50 rounded-lg">
                        <Shield className="h-4 w-4 text-indigo-600" />
                    </div>
                    <p className="font-bold text-slate-800">{data.name}</p>
                </div>
                <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg">
                        <span className="text-slate-500 flex items-center gap-1"><UserCheck className="h-3 w-3" /> الشيخ:</span>
                        <span className="font-semibold text-slate-800 dir-rtl">{data.sheikhName}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-slate-500">إجمالي الطلبة:</span>
                        <span className="font-bold text-slate-800">{data.students}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-slate-500">الطلبة النشطون:</span>
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-emerald-600">{data.active}</span>
                            <span className="text-xs text-slate-400">({Math.round((data.active / data.students) * 100)}%)</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
    return null;
};

export const InteractiveGrowthChart = ({ data }: { data: any[] }) => {
    return (
        <ResponsiveContainer width="100%" height="100%">
            <BarChart
                data={data}
                margin={{ top: 20, right: 30, left: 20, bottom: 40 }}
                barSize={40}
            >
                <defs>
                    <linearGradient id="activeGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity={1} />
                        <stop offset="100%" stopColor="#4f46e5" stopOpacity={0.8} />
                    </linearGradient>
                    <linearGradient id="inactiveGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#e2e8f0" stopOpacity={1} />
                        <stop offset="100%" stopColor="#cbd5e1" stopOpacity={0.5} />
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 'bold' }}
                    dy={10}
                    interval={0}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                />
                <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                />
                <RechartsTooltip cursor={{ fill: 'transparent' }} content={<CustomTooltip />} />
                <Bar dataKey="active" stackId="a" fill="url(#activeGradient)" radius={[0, 0, 4, 4]}>
                    <LabelList dataKey="active" position="center" style={{ fill: 'white', fontWeight: 'bold', fontSize: '10px' }} />
                </Bar>
                <Bar dataKey="inactive" stackId="a" fill="url(#inactiveGradient)" radius={[4, 4, 0, 0]} />
            </BarChart>
        </ResponsiveContainer>
    );
};

export const LevelDistributionChart = ({ data }: { data: any[] }) => {
    return (
        <div className="flex flex-col md:flex-row items-center h-full w-full gap-8">
            <div className="flex-1 h-full min-h-[300px] w-full min-w-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            innerRadius={80}
                            outerRadius={110}
                            paddingAngle={2}
                            dataKey="value"
                        >
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                            ))}
                        </Pie>
                        <RechartsTooltip contentStyle={{ borderRadius: '8px', direction: 'rtl' }} />
                    </PieChart>
                </ResponsiveContainer>
            </div>
            {/* Custom Legend */}
            <div className="w-full md:w-64 h-full max-h-[350px] overflow-y-auto custom-scrollbar pr-2 space-y-2 flex flex-col justify-center">
                {data.map((entry, index) => (
                    <div key={index} className="flex items-center justify-between text-sm p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 transition-colors border border-transparent hover:border-slate-100 dark:hover:border-white/10">
                        <div className="flex items-center gap-3">
                            <span className="w-3 h-3 rounded-full flex-shrink-0 shadow-sm" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                            <span className="font-medium text-slate-700 dark:text-slate-200 truncate max-w-[140px]" title={entry.name}>
                                {entry.name}
                            </span>
                        </div>
                        <span className="font-bold text-slate-600 dark:text-slate-400 font-mono bg-slate-100 dark:bg-white/10 px-2 py-0.5 rounded-md min-w-[30px] text-center">
                            {entry.value}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};
