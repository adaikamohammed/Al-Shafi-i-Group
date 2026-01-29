"use client";

import { useAuth } from '@/context/AuthContext';
import { useStudentContext } from '@/context/StudentContext';
import { useEffect } from 'react';

export default function DebugPage() {
    const { user, role, isSuperAdmin, isManagement } = useAuth();
    const { students, loading } = useStudentContext();

    useEffect(() => {
        console.log('=== DEBUG PAGE ===');
        console.log('User:', user);
        console.log('Role:', role);
        console.log('isSuperAdmin:', isSuperAdmin);
        console.log('isManagement:', isManagement);
        console.log('Students count:', students.length);
        console.log('Loading:', loading);
    }, [user, role, isSuperAdmin, isManagement, students, loading]);

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold mb-6">صفحة التشخيص</h1>

            <div className="space-y-4">
                <div className="bg-white p-4 rounded-lg shadow">
                    <h2 className="text-xl font-bold mb-2">معلومات المستخدم</h2>
                    <div className="space-y-2">
                        <p><strong>البريد الإلكتروني:</strong> {user?.email || 'غير متصل'}</p>
                        <p><strong>الاسم:</strong> {user?.displayName || 'غير محدد'}</p>
                        <p><strong>المجموعة:</strong> {user?.group || 'غير محدد'}</p>
                        <p><strong>الدور:</strong> {role || 'غير محدد'}</p>
                        <p><strong>مدير عام:</strong> {isSuperAdmin ? 'نعم ✅' : 'لا ❌'}</p>
                        <p><strong>إدارة:</strong> {isManagement ? 'نعم ✅' : 'لا ❌'}</p>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-lg shadow">
                    <h2 className="text-xl font-bold mb-2">معلومات البيانات</h2>
                    <div className="space-y-2">
                        <p><strong>حالة التحميل:</strong> {loading ? 'جاري التحميل... ⏳' : 'تم التحميل ✅'}</p>
                        <p><strong>عدد الطلاب:</strong> {students.length}</p>
                    </div>
                </div>

                {students.length > 0 && (
                    <div className="bg-white p-4 rounded-lg shadow">
                        <h2 className="text-xl font-bold mb-2">قائمة الطلاب</h2>
                        <div className="space-y-2">
                            {students.slice(0, 10).map((student) => (
                                <div key={student.id} className="border-b pb-2">
                                    <p><strong>{student.fullName}</strong></p>
                                    <p className="text-sm text-gray-600">المجموعة: {student.groupName}</p>
                                    <p className="text-sm text-gray-600">المالك: {student.ownerId}</p>
                                </div>
                            ))}
                            {students.length > 10 && (
                                <p className="text-sm text-gray-500">... و {students.length - 10} طالب آخر</p>
                            )}
                        </div>
                    </div>
                )}

                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                    <h2 className="text-xl font-bold mb-2">تعليمات</h2>
                    <ol className="list-decimal list-inside space-y-2">
                        <li>افتح Console في المتصفح (اضغط F12)</li>
                        <li>ابحث عن الرسائل التي تبدأ بـ 🔄 أو 👑 أو 📚</li>
                        <li>تحقق من عدد المستخدمين الذين تم العثور عليهم</li>
                        <li>تحقق من عدد الطلاب لكل مستخدم</li>
                        <li>إذا رأيت خطأ PERMISSION_DENIED، فالمشكلة في قواعد Firebase</li>
                    </ol>
                </div>
            </div>
        </div>
    );
}
