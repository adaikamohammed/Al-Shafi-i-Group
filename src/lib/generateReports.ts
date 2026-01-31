import { DailySession, Student } from './types';
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { ar } from 'date-fns/locale';

export interface WeeklyReportData {
    sheikhId: string;
    sheikhName: string;
    groupName: string;
    dateRange: string;
    sessionCount: number;
    attendanceRate: string;
    activeStudents: number;
    averageVerses: number;
    topStudents: Array<{
        name: string;
        attendance: number;
        verses: number;
    }>;
    needsAttention: Array<{
        name: string;
        reason: string;
    }>;
}

export interface MonthlyReportData extends WeeklyReportData {
    month: string;
    year: number;
    totalSessions: number;
    comparisonData: {
        attendanceChange: number;
        memorizationChange: number;
    };
    suggestions: string[];
}

/**
 * Generate weekly report data for a sheikh
 */
export async function generateWeeklyReportData(
    sheikhId: string,
    students: Student[],
    sessions: Record<string, DailySession[]>,
    startDate?: Date,
    endDate?: Date
): Promise<WeeklyReportData> {
    // Default to current week
    const start = startDate || startOfWeek(new Date(), { weekStartsOn: 6 }); // Saturday
    const end = endDate || endOfWeek(new Date(), { weekStartsOn: 6 });

    const dateRange = `${format(start, 'yyyy/MM/dd', { locale: ar })} - ${format(end, 'yyyy/MM/dd', { locale: ar })}`;

    // Filter sessions for the date range
    const weekSessions: DailySession[] = [];
    const currentDate = new Date(start);

    while (currentDate <= end) {
        const dateKey = format(currentDate, 'yyyy-MM-dd');
        if (sessions[dateKey]) {
            weekSessions.push(...sessions[dateKey]);
        }
        currentDate.setDate(currentDate.getDate() + 1);
    }

    // Filter for sheikh's students
    const sheikhStudents = students.filter(s => s.ownerId === sheikhId);
    const sheikhName = sheikhStudents[0]?.groupName || 'الشيخ';
    const groupName = sheikhStudents[0]?.groupName || 'الفوج';

    // Calculate statistics
    const sessionCount = weekSessions.length;
    const studentAttendance: Record<string, { present: number; total: number; verses: number }> = {};

    weekSessions.forEach(session => {
        session.records?.forEach(record => {
            if (!studentAttendance[record.studentId]) {
                studentAttendance[record.studentId] = { present: 0, total: 0, verses: 0 };
            }
            studentAttendance[record.studentId].total++;
            if (record.attendance === 'حاضر' || record.attendance === 'تعويض') {
                studentAttendance[record.studentId].present++;
            }
            // Calculate verses
            if (record.fromVerse && record.toVerse) {
                studentAttendance[record.studentId].verses += (record.toVerse - record.fromVerse + 1);
            }
        });
    });

    // Calculate overall attendance rate
    const totalAttendances = Object.values(studentAttendance).reduce(
        (sum, stat) => sum + stat.total,
        0
    );
    const totalPresent = Object.values(studentAttendance).reduce(
        (sum, stat) => sum + stat.present,
        0
    );
    const attendanceRate = totalAttendances > 0
        ? ((totalPresent / totalAttendances) * 100).toFixed(1)
        : '0';

    // Active students (those who attended at least once)
    const activeStudents = Object.keys(studentAttendance).length;

    // Average verses
    const totalVerses = Object.values(studentAttendance).reduce(
        (sum, stat) => sum + stat.verses,
        0
    );
    const averageVerses = activeStudents > 0 ? Math.round(totalVerses / activeStudents) : 0;

    // Top students (attendance >= 80% and verses > average)
    const topStudents = sheikhStudents
        .map(student => {
            const stats = studentAttendance[student.id];
            if (!stats) return null;
            const attendancePercent = (stats.present / stats.total) * 100;
            return {
                name: student.fullName,
                attendance: Math.round(attendancePercent),
                verses: stats.verses,
            };
        })
        .filter(s => s && s.attendance >= 80 && s.verses >= averageVerses)
        .sort((a, b) => (b?.verses || 0) - (a?.verses || 0))
        .slice(0, 3) as Array<{ name: string; attendance: number; verses: number }>;

    // Students needing attention (attendance < 60% or no memorization)
    const needsAttention = sheikhStudents
        .map(student => {
            const stats = studentAttendance[student.id];
            if (!stats) return null;
            const attendancePercent = (stats.present / stats.total) * 100;

            let reason = '';
            if (attendancePercent < 60) {
                reason = `حضور ضعيف ${Math.round(attendancePercent)}%`;
            } else if (stats.verses === 0) {
                reason = 'لم يحفظ هذا الأسبوع';
            }

            return reason ? { name: student.fullName, reason } : null;
        })
        .filter(Boolean) as Array<{ name: string; reason: string }>;

    return {
        sheikhId,
        sheikhName,
        groupName,
        dateRange,
        sessionCount,
        attendanceRate,
        activeStudents,
        averageVerses,
        topStudents,
        needsAttention,
    };
}

/**
 * Generate monthly report data for a sheikh
 */
export async function generateMonthlyReportData(
    sheikhId: string,
    students: Student[],
    sessions: Record<string, DailySession[]>,
    month: number,
    year: number
): Promise<MonthlyReportData> {
    const startDate = startOfMonth(new Date(year, month - 1, 1));
    const endDate = endOfMonth(new Date(year, month - 1, 1));

    // Get weekly data
    const weeklyData = await generateWeeklyReportData(
        sheikhId,
        students,
        sessions,
        startDate,
        endDate
    );

    // Get previous month data for comparison
    const prevStartDate = startOfMonth(subDays(startDate, 1));
    const prevEndDate = endOfMonth(subDays(startDate, 1));
    const prevMonthData = await generateWeeklyReportData(
        sheikhId,
        students,
        sessions,
        prevStartDate,
        prevEndDate
    );

    const monthName = format(startDate, 'MMMM', { locale: ar });

    // Calculate changes
    const attendanceChange = parseFloat(weeklyData.attendanceRate) - parseFloat(prevMonthData.attendanceRate);
    const memorizationChange = weeklyData.averageVerses - prevMonthData.averageVerses;

    // Generate suggestions
    const suggestions = [];
    if (attendanceChange < 0) {
        suggestions.push('التركيز على الطلاب ذوي الحضور الضعيف');
    }
    if (memorizationChange < 0) {
        suggestions.push('زيادة وتيرة المراجعة');
    }
    if (weeklyData.needsAttention.length > 3) {
        suggestions.push('تنظيم مسابقة تحفيزية');
    }

    return {
        ...weeklyData,
        month: monthName,
        year,
        totalSessions: weeklyData.sessionCount,
        comparisonData: {
            attendanceChange: Math.round(attendanceChange * 10) / 10,
            memorizationChange,
        },
        suggestions,
    };
}
