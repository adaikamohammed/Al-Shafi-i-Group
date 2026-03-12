
import { 
    startOfWeek, endOfWeek, 
    startOfMonth, endOfMonth, 
    startOfQuarter, endOfQuarter, 
    startOfYear, endOfYear, 
    isWithinInterval, parseISO 
} from 'date-fns';

addEventListener('message', (event) => {
    const { dailySessions, allUsers, timeframe, isSheikh, user } = event.data;

    if (!dailySessions) {
        postMessage([]);
        return;
    }

    let start: Date;
    let end: Date;
    const now = new Date();

    switch (timeframe) {
        case 'monthly':
            start = startOfMonth(now); end = endOfMonth(now); break;
        case 'seasonal':
            start = startOfQuarter(now); end = endOfQuarter(now); break;
        case 'yearly':
            start = startOfYear(now); end = endOfYear(now); break;
        case 'weekly':
        default:
            start = startOfWeek(now, { weekStartsOn: 6 });
            end = endOfWeek(now, { weekStartsOn: 6 }); break;
    }

    const sheikhUsers = allUsers.length > 0
        ? allUsers.filter((u: any) => u.role === 'sheikh' && u.group)
        : (isSheikh && user ? [{ ...user }] : []);

    const uniqueGroups = Array.from(new Set(sheikhUsers.map((u: any) => u.group)));

    const result = uniqueGroups.map(groupName => {
        let totalSessions = 0;
        let totalAttendance = 0;
        let totalRecords = 0;
        let totalReview = 0;
        let totalEvaluationPoints = 0;
        let totalBehaviorPoints = 0;

        Object.entries(dailySessions).forEach(([date, sessionsOnDay]: [string, any]) => {
            const sessionDate = parseISO(date);
            if (isWithinInterval(sessionDate, { start, end })) {
                Object.values(sessionsOnDay).forEach((session: any) => {
                    const sheikh = allUsers.find((u: any) => u.uid === session.ownerId) || (isSheikh && session.ownerId === user?.uid ? user : null);
                    if (sheikh?.group === groupName) {
                        totalSessions++;
                        (session.records || []).forEach((record: any) => {
                            totalRecords++;
                            if (record.attendance === 'حاضر' || record.attendance === 'متأخر') totalAttendance++;
                            if (record.review) totalReview++;
                            const evalMap: Record<string, number> = { 'ممتاز': 100, 'جيد جداً': 80, 'جيد': 60, 'متوسط': 40, 'ضعيف': 20 };
                            totalEvaluationPoints += evalMap[record.memorization || ''] || 0;
                            const behavMap: Record<string, number> = { 'هادئ': 100, 'متوسط': 60, 'غير منضبط': 20 };
                            totalBehaviorPoints += behavMap[record.behavior || ''] || 0;
                        });
                    }
                });
            }
        });

        const countRecords = totalRecords || 1;
        return {
            groupName,
            attendanceRate: Math.round((totalAttendance / countRecords) * 100),
            reviewRate: Math.round((totalReview / countRecords) * 100),
            evaluationScore: Math.round(totalEvaluationPoints / countRecords),
            behaviorScore: Math.round(totalBehaviorPoints / countRecords)
        };
    }).sort((a: any, b: any) => {
        const groupA = parseInt((a.groupName || '').replace(/[^0-9]/g, '')) || 999;
        const groupB = parseInt((b.groupName || '').replace(/[^0-9]/g, '')) || 999;
        return groupA - groupB;
    });

    postMessage(result);
});
