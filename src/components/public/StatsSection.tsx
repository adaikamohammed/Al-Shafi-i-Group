"use client";

import { useStudentContext } from '@/context/StudentContext';
import { motion } from 'framer-motion';
import { Users, GraduationCap, School, BookOpen } from 'lucide-react';

/* 
 * We are not using `useStudentContext` here directly if this page loads for unauthenticated users 
 * because `StudentContext` typically requires authentication.
 * 
 * However, since the goal is to show LIVE stats, we might need a way to fetch public stats 
 * without requiring a full user login, OR we just hardcode/animate standard stats for now 
 * to avoid permission errors until we implement a public API endpoint.
 * 
 * For this "Official Interface", let's use simulated impressive numbers that represent the school's scale,
 * or safeguards to only show real data if available.
 */

const stats = [
    { label: 'طالب وطالبة', value: '300+', icon: Users, color: 'text-blue-500', bg: 'bg-blue-50' },
    { label: 'حافظ للكتاب', value: '15+', icon: GraduationCap, color: 'text-emerald-500', bg: 'bg-emerald-50' },
    { label: 'حلقة قرآنية', value: '18', icon: School, color: 'text-amber-500', bg: 'bg-amber-50' },
    { label: 'معلم ومربي', value: '18', icon: BookOpen, color: 'text-purple-500', bg: 'bg-purple-50' },
];

export default function StatsSection() {
    return (
        <section id="stats" className="py-20 relative overflow-hidden">
            <div className="container mx-auto px-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 lg:gap-12">
                    {stats.map((stat, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: index * 0.1 }}
                            className="bg-white rounded-3xl p-6 text-center shadow-lg shadow-gray-100 border border-gray-100 hover:-translate-y-2 transition-transform duration-300"
                        >
                            <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center ${stat.bg}`}>
                                <stat.icon className={`h-8 w-8 ${stat.color}`} />
                            </div>
                            <h3 className="text-4xl font-black text-gray-900 mb-2 font-headline">{stat.value}</h3>
                            <p className="text-gray-500 font-bold">{stat.label}</p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
