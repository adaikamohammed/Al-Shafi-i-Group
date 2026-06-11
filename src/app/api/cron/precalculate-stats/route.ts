import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { ref, get, set } from 'firebase/database';
import {
    format,
    startOfMonth,
    endOfMonth,
    eachDayOfInterval,
    parseISO,
    getDay,
    addDays,
    isValid,
    getMonth,
    getYear
} from 'date-fns';

// Default points configurations (in case database values aren't loaded)
const DEFAULT_POINTS_CONFIG = {
    attendance: { 'حاضر': 5, 'متأخر': 2, 'تعويض': 1.5, 'غائب': -10 },
    evaluation: { 'ممتاز': 10, 'جيد جداً': 7, 'جيد': 5, 'حسن': 3, 'مقبول': 2, 'ضعيف': 1, 'لم يحفظ': 0 },
    behavior: { 'هادئ': 3, 'مقبول': 1, 'مشاغب': 0 },
    review: { 'completed': 5 },
    surah: { 'memorized': 20, 'mastered': 50 },
    covenantCompleted: 15,
};

const DEFAULT_WEIGHTS = {
    sessionWeight: 15,
    attendanceWeight: 12,
    extraSessionBonus: 5,
    excellentBonus: 3,
    goodPlusBonus: 1.5,
    commitmentBonus: 40,
    commitmentBase: 30,
    absencePenalty: 20,
    punctualityBonus: 5
};

const DEFAULT_GOALS = {
    attendanceTarget: 85,
    excellentTarget: 25,
    commitmentTarget: 90
};

// Check if sheikh document is punctual (documented within 36 hours of the session)
function isSessionPunctual(session: any): boolean {
    if (!session || !session.createdAt || !session.date) return false;
    try {
        const created = new Date(session.createdAt);
        const scheduled = new Date(session.date);
        const diffHours = (created.getTime() - scheduled.getTime()) / (1000 * 60 * 60);
        return diffHours >= 0 && diffHours <= 36;
    } catch (e) {
        return false;
    }
}

export const dynamic = 'force-static';

export async function GET(request: Request) {
    // Bypass database calculations and writes during Next.js build-time prerendering phase
    if (process.env.NEXT_PHASE === 'phase-production-build') {
        return NextResponse.json({
            success: true,
            message: 'Static export build bypass'
        });
    }

    const { searchParams } = new URL(request.url);
    const monthQuery = searchParams.get('month'); // Expecting format: yyyy-MM
    
    const now = new Date();
    const monthKey = monthQuery && /^\d{4}-\d{2}$/.test(monthQuery) ? monthQuery : format(now, 'yyyy-MM');

    
    try {
        const [targetYearStr, targetMonthStr] = monthKey.split('-');
        const targetYear = parseInt(targetYearStr);
        const targetMonth = parseInt(targetMonthStr) - 1; // 0-indexed month for date-fns/js Date

        const monthStartDate = startOfMonth(new Date(targetYear, targetMonth));
        const monthEndDate = endOfMonth(new Date(targetYear, targetMonth));
        const monthDays = eachDayOfInterval({ start: monthStartDate, end: monthEndDate });

        // 1. Fetch all users from RTDB
        const usersSnapshot = await get(ref(db, 'users'));
        if (!usersSnapshot.exists()) {
            return NextResponse.json({ error: 'No users found in database' }, { status: 404 });
        }
        const usersData = usersSnapshot.val();

        // 2. Fetch sheikh weights & goals
        const weightsSnapshot = await get(ref(db, 'settings/sheikh_scoring_weights'));
        const weights = weightsSnapshot.exists() ? { ...DEFAULT_WEIGHTS, ...weightsSnapshot.val() } : DEFAULT_WEIGHTS;

        const goalsSnapshot = await get(ref(db, `settings/sheikh_goals/${monthKey}`));
        const goals = goalsSnapshot.exists() ? { ...DEFAULT_GOALS, ...goalsSnapshot.val() } : DEFAULT_GOALS;

        // 3. Look up PointConfig settings from the first user who has them (usually admin00 or super_admin)
        let pointsConfig = DEFAULT_POINTS_CONFIG;
        for (const uid in usersData) {
            if (usersData[uid]?.settings?.points) {
                pointsConfig = { ...DEFAULT_POINTS_CONFIG, ...usersData[uid].settings.points };
                break;
            }
        }

        // 4. Extract all active sheikhs and their info
        const sheikhs: any[] = [];
        for (const uid in usersData) {
            const profile = usersData[uid]?.profile;
            if (profile && profile.role === 'sheikh' && profile.group) {
                sheikhs.push({
                    uid,
                    displayName: profile.displayName || 'شيخ غير مسمى',
                    group: profile.group,
                    uids: new Set([uid])
                });
            }
        }

        // 5. Extract all students and sessions
        const studentsList: any[] = [];
        const dailySessionsList: any[] = [];

        for (const uid in usersData) {
            const userData = usersData[uid];
            
            // Collect students
            if (userData.students) {
                Object.entries(userData.students).forEach(([id, s]: [string, any]) => {
                    studentsList.push({
                        ...s,
                        id,
                        ownerId: uid,
                        groupName: s.groupName || userData.profile?.group || 'غير محدد',
                        birthDate: s.birthDate ? parseISO(s.birthDate) : new Date(),
                        registrationDate: s.registrationDate ? parseISO(s.registrationDate) : new Date(),
                        covenants: s.covenants ? Object.values(s.covenants) : []
                    });
                });
            }

            // Collect sessions
            if (userData.dailySessions) {
                for (const date in userData.dailySessions) {
                    const dayVal = userData.dailySessions[date];
                    if (dayVal && typeof dayVal === 'object') {
                        if ('date' in dayVal && ('records' in dayVal || 'sessionType' in dayVal)) {
                            // Old structure
                            const sessionId = dayVal.id || `${date}-s1`;
                            dailySessionsList.push({
                                ...dayVal,
                                id: sessionId,
                                ownerId: uid,
                                dateStr: date,
                                sessionNumber: dayVal.sessionNumber !== undefined ? Number(dayVal.sessionNumber) : 1
                            });
                        } else {
                            // New structure
                            Object.entries(dayVal).forEach(([sessionId, session]: [string, any]) => {
                                if (session && typeof session === 'object' && 'date' in session) {
                                    dailySessionsList.push({
                                        ...session,
                                        id: session.id || sessionId,
                                        ownerId: uid,
                                        dateStr: date,
                                        sessionNumber: session.sessionNumber !== undefined ? Number(session.sessionNumber) : (sessionId.endsWith('-s2') ? 2 : 1)
                                    });
                                }
                            });
                        }
                    }
                }
            }
        }

        // Index dailySessions by group -> date -> sessions[]
        const groupSessionsIndex = new Map<string, Map<string, any[]>>();
        sheikhs.forEach(sh => groupSessionsIndex.set(sh.group, new Map()));

        dailySessionsList.forEach(session => {
            const owner = sheikhs.find(sh => sh.uid === session.ownerId);
            if (!owner) return;
            const gMap = groupSessionsIndex.get(owner.group);
            if (!gMap) return;

            const arr = gMap.get(session.dateStr) || [];
            if (!arr.some(s => s.sessionNumber === session.sessionNumber)) {
                arr.push(session);
                gMap.set(session.dateStr, arr);
            }
        });

        // Student counts per group name
        const groupStudentCount: Record<string, number> = {};
        sheikhs.forEach(sh => {
            groupStudentCount[sh.group] = studentsList.filter(
                s => s.status === 'نشط' && s.groupName === sh.group
            ).length;
        });

        // getDayStats aggregated stats helper
        const getDayStats = (group: string, dateStr: string) => {
            const sessions = groupSessionsIndex.get(group)?.get(dateStr) || [];
            const session = sessions.find(s => s.sessionNumber === 1) || sessions[0] || null;
            if (!session) return null;

            const records: any[] = session.records || [];
            const total = groupStudentCount[group] || 0;
            if (!records.length || !total) {
                return {
                    session,
                    type: session.sessionType,
                    attendance: null,
                    excellent: null,
                    goodPlus: null,
                    good: null,
                    acceptable: null,
                    weak: null,
                    notMemorized: null
                };
            }

            let present = 0, excellent = 0, goodPlus = 0, good = 0, acceptable = 0, weak = 0, notMem = 0;
            records.forEach(r => {
                if (r.attendance === 'حاضر' || r.attendance === 'متأخر' || r.attendance === 'تعويض') present++;
                if (!r.review) {
                    if (r.memorization === 'ممتاز') excellent++;
                    else if (r.memorization === 'جيد جدا' || r.memorization === 'جيد جداً') goodPlus++;
                    else if (r.memorization === 'جيد') good++;
                    else if (r.memorization === 'مقبول' || r.memorization === 'حسن') acceptable++;
                    else if (r.memorization === 'ضعيف' || r.memorization === 'متوسط') weak++;
                    else if (r.memorization === 'لم يحفظ') notMem++;
                }
            });

            const p = (n: number) => total > 0 ? Math.round((n / total) * 100) : 0;
            return {
                session,
                type: session.sessionType,
                attendance: p(present),
                excellent: p(excellent),
                goodPlus: p(goodPlus),
                good: p(good),
                acceptable: p(acceptable),
                weak: p(weak),
                notMemorized: p(notMem)
            };
        };

        // ─── PART A: Sheikh Scores calculations ───
        const calculateSheikhPoints = (data: {
            sessions: number;
            avgAttendance: number;
            avgExcellent: number;
            avgGoodPlus: number;
            commitmentRate: number;
            sheikhabsences: number;
            extraSessions: number;
            excCount: number;
            punctualSessions: number;
        }) => {
            const sessionPoints = data.sessions * weights.sessionWeight;
            const attendancePoints = data.sessions > 0 ? Math.round((data.avgAttendance / 100) * weights.attendanceWeight * data.sessions) : 0;
            const extraSessionBonus = data.extraSessions * weights.extraSessionBonus;
            const excellenceBonus = data.excCount > 0 ? Math.round((data.avgExcellent / 100) * weights.excellentBonus * data.sessions) : 0;
            const goodPlusBonus = data.excCount > 0 ? Math.round((data.avgGoodPlus / 100) * weights.goodPlusBonus * data.sessions) : 0;
            const excellencePoints = excellenceBonus + goodPlusBonus;
            const commitmentBonus = (data.commitmentRate >= 100 && data.sheikhabsences === 0 && data.sessions > 0) ? weights.commitmentBonus : 0;
            const absencePenalty = data.sheikhabsences * weights.absencePenalty;
            const commitmentBase = Math.round((data.commitmentRate / 100) * weights.commitmentBase);
            const commitmentPoints = Math.max(0, commitmentBase + commitmentBonus - absencePenalty);
            const punctualityBonus = data.punctualSessions * weights.punctualityBonus;
            const totalPoints = sessionPoints + attendancePoints + extraSessionBonus + excellencePoints + commitmentPoints + punctualityBonus;

            return {
                totalPoints,
                sessionPoints,
                attendancePoints,
                extraSessionBonus,
                excellencePoints,
                commitmentPoints,
                punctualityBonus
            };
        };

        // Podium counts across months (need historic podium counts per sheikh group)
        const sheikhPodiumCounts: Record<string, { first: number; second: number; third: number }> = {};
        sheikhs.forEach(sh => {
            sheikhPodiumCounts[sh.group] = { first: 0, second: 0, third: 0 };
        });

        // Compute podium counts historic to populate sheikhPodiumCounts
        const monthsInYear = Array.from({ length: 12 }, (_, i) => i);
        const currentYear = targetYear;
        
        monthsInYear.forEach(m => {
            // Do not compute future months
            if (currentYear === now.getFullYear() && m > now.getMonth()) return;

            const mStart = startOfMonth(new Date(currentYear, m, 1));
            const mEnd = endOfMonth(new Date(currentYear, m, 1));
            const mDays = eachDayOfInterval({ start: mStart, end: mEnd });

            const mScores = sheikhs.map(sh => {
                let sessions = 0, extraSessions = 0;
                let attTotal = 0, attCount = 0;
                let excTotal = 0, gpTotal = 0, excCount = 0;
                let sheikhabsences = 0, holidays = 0;
                let punctualSessions = 0;

                mDays.forEach(day => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const stats = getDayStats(sh.group, dateStr);
                    if (!stats) return;

                    if (stats.type === 'يوم عطلة') { holidays++; return; }
                    if (stats.type === 'غياب الشيخ') { sheikhabsences++; return; }

                    const isReal = stats.type === 'حصة أساسية' || stats.type === 'حصة تعويضية' || stats.type === 'حصة إضافية';
                    if (isReal) {
                        sessions++;
                        if (stats.type === 'حصة تعويضية' || stats.type === 'حصة إضافية') {
                            extraSessions++;
                        }
                        if (stats.attendance !== null) {
                            attTotal += stats.attendance;
                            attCount++;
                        }
                        if (stats.excellent !== null) {
                            excTotal += stats.excellent;
                            excCount++;
                        }
                        if (stats.goodPlus !== null) gpTotal += stats.goodPlus;
                        
                        if (isSessionPunctual(stats.session)) {
                            punctualSessions++;
                        }
                    }
                });

                const workingDays = mDays.length - holidays - sheikhabsences;
                const avgAttendance = attCount > 0 ? Math.round(attTotal / attCount) : 0;
                const avgExcellent = excCount > 0 ? Math.round(excTotal / excCount) : 0;
                const avgGoodPlus = excCount > 0 ? Math.round(gpTotal / excCount) : 0;
                const commitmentRate = workingDays > 0 ? Math.round((sessions / workingDays) * 100) : 0;

                const pointsBreakdown = calculateSheikhPoints({
                    sessions,
                    avgAttendance,
                    avgExcellent,
                    avgGoodPlus,
                    commitmentRate,
                    sheikhabsences,
                    extraSessions,
                    excCount,
                    punctualSessions
                });

                return {
                    group: sh.group,
                    totalPoints: pointsBreakdown.totalPoints,
                    sessions
                };
            });

            const activeSheikhs = mScores.filter(s => s.sessions > 0);
            if (activeSheikhs.length > 0) {
                activeSheikhs.sort((a, b) => b.totalPoints - a.totalPoints);
                activeSheikhs.forEach((s, idx) => {
                    const rank = idx + 1;
                    if (sheikhPodiumCounts[s.group]) {
                        if (rank === 1) sheikhPodiumCounts[s.group].first++;
                        else if (rank === 2) sheikhPodiumCounts[s.group].second++;
                        else if (rank === 3) sheikhPodiumCounts[s.group].third++;
                    }
                });
            }
        });

        // Compute scores for target month
        const rawSheikhScores = sheikhs.map(sh => {
            let sessions = 0, extraSessions = 0;
            let attTotal = 0, attCount = 0;
            let excTotal = 0, gpTotal = 0, excCount = 0;
            let sheikhabsences = 0, holidays = 0;
            let punctualSessions = 0;

            monthDays.forEach(day => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const stats = getDayStats(sh.group, dateStr);
                if (!stats) return;

                if (stats.type === 'يوم عطلة') { holidays++; return; }
                if (stats.type === 'غياب الشيخ') { sheikhabsences++; return; }

                const isReal = stats.type === 'حصة أساسية' || stats.type === 'حصة تعويضية' || stats.type === 'حصة إضافية';
                if (isReal) {
                    sessions++;
                    if (stats.type === 'حصة تعويضية' || stats.type === 'حصة إضافية') {
                        extraSessions++;
                    }
                    if (stats.attendance !== null) {
                        attTotal += stats.attendance;
                        attCount++;
                    }
                    if (stats.excellent !== null) {
                        excTotal += stats.excellent;
                        excCount++;
                    }
                    if (stats.goodPlus !== null) gpTotal += stats.goodPlus;
                    
                    if (isSessionPunctual(stats.session)) {
                        punctualSessions++;
                    }
                }
            });

            const workingDays = monthDays.length - holidays - sheikhabsences;
            const avgAttendance = attCount > 0 ? Math.round(attTotal / attCount) : 0;
            const avgExcellent = excCount > 0 ? Math.round(excTotal / excCount) : 0;
            const avgGoodPlus = excCount > 0 ? Math.round(gpTotal / excCount) : 0;
            const commitmentRate = workingDays > 0 ? Math.round((sessions / workingDays) * 100) : 0;

            const pts = calculateSheikhPoints({
                sessions,
                avgAttendance,
                avgExcellent,
                avgGoodPlus,
                commitmentRate,
                sheikhabsences,
                extraSessions,
                excCount,
                punctualSessions
            });

            // Badges logic
            const badges: any[] = [];
            if (commitmentRate >= 100 && sheikhabsences === 0 && sessions > 0) {
                badges.push({
                    icon: 'ShieldCheck',
                    label: 'الملتزم المتميز',
                    colorClass: 'text-emerald-500 border-emerald-500/30 bg-emerald-500/10',
                    glowClass: 'shadow-emerald-500/20',
                    description: 'تسجيل 100% من حصص الشهر بدون أي غيابات.'
                });
            }
            if (avgAttendance >= goals.attendanceTarget && sessions > 0) {
                badges.push({
                    icon: 'Users',
                    label: 'حارس الانضباط',
                    colorClass: 'text-blue-500 border-blue-500/30 bg-blue-500/10',
                    glowClass: 'shadow-blue-500/20',
                    description: `تحقيق متوسط حضور طلابي يفوق أو يساوي المستهدف (${goals.attendanceTarget}%).`
                });
            }
            if (avgExcellent >= goals.excellentTarget && sessions > 0) {
                badges.push({
                    icon: 'Star',
                    label: 'صانع النخبة',
                    colorClass: 'text-purple-500 border-purple-500/30 bg-purple-500/10',
                    glowClass: 'shadow-purple-500/20',
                    description: `تحقيق نسبة تميز حفظ (ممتاز) تفوق أو تساوي المستهدف (${goals.excellentTarget}%).`
                });
            }

            return {
                group: sh.group,
                displayName: sh.displayName,
                totalPoints: pts.totalPoints,
                sessionPoints: pts.sessionPoints,
                excellencePoints: pts.excellencePoints,
                attendancePoints: pts.attendancePoints,
                commitmentPoints: pts.commitmentPoints,
                extraSessionBonus: pts.extraSessionBonus,
                punctualityBonus: pts.punctualityBonus,
                totalSessions: sessions,
                totalDays: monthDays.length,
                avgAttendance,
                avgExcellent,
                avgGoodPlus,
                commitmentRate,
                highAttDays: punctualSessions, // Stored as highAttDays for schema compatibility
                sheikhabsences,
                extraSessionsCount: extraSessions,
                punctualSessionsCount: punctualSessions,
                badges,
                podiumCounts: sheikhPodiumCounts[sh.group] || { first: 0, second: 0, third: 0 },
                rank: 0
            };
        });

        // Sort and assign ranks
        rawSheikhScores.sort((a, b) => b.totalPoints - a.totalPoints);
        rawSheikhScores.forEach((s, idx) => { s.rank = idx + 1; });

        // Save computed sheikh scores to Firebase RTDB
        await set(ref(db, `sheikh_scores/${monthKey}`), rawSheikhScores);


        // ─── PART B: Student Scores calculations ───
        const studentScores: Record<string, any> = {};

        // Initialize all students
        studentsList.forEach(student => {
            studentScores[student.id] = {
                id: student.id,
                name: student.fullName,
                photoURL: student.photoURL || null,
                status: student.status,
                groupName: student.groupName || 'غير محدد',
                memorizationMultiplier: student.memorizationMultiplier ?? 1.0,
                points: 0,
                pointsBreakdown: { hifz: 0, attendance: 0, behavior: 0 },
                stats: {
                    present: 0,
                    absent: 0,
                    late: 0,
                    makeup: 0,
                    excellent: 0,
                    good: 0,
                    average: 0,
                    calm: 0,
                    medium: 0,
                    undisciplined: 0,
                    reviewed: 0,
                    commitmentBalance: 0
                }
            };
        });

        // Filter sessions that are in the target month
        const sessionsInMonth = dailySessionsList.filter(session => {
            try {
                const sDate = parseISO(session.date);
                return sDate >= monthStartDate && sDate <= monthEndDate;
            } catch (e) {
                return false;
            }
        });

        // Calculate student score parts
        sessionsInMonth.forEach(session => {
            (session.records ?? []).forEach((record: any) => {
                const studentId = record.studentId;
                if (studentScores[studentId] && studentScores[studentId].status === 'نشط') {
                    // Attendance points
                    if (record.attendance && pointsConfig.attendance) {
                        const attendancePoints = (pointsConfig.attendance as any)[record.attendance] ?? 0;
                        studentScores[studentId].pointsBreakdown.attendance += attendancePoints;
                        if (record.attendance === 'حاضر') studentScores[studentId].stats.present++;
                        if (record.attendance === 'غائب') studentScores[studentId].stats.absent++;
                        if (record.attendance === 'متأخر') studentScores[studentId].stats.late++;
                        if (record.attendance === 'تعويض') studentScores[studentId].stats.makeup++;
                    }

                    // Memorization evaluation points and review points
                    let earnedMemoPoints = 0;
                    let hasMemo = false;

                    let memoLevel = record.memorization;
                    if (memoLevel === 'متوسط') memoLevel = 'مقبول';
                    if (memoLevel === 'جيد جدا') memoLevel = 'جيد جداً';

                    let behaviorLevel = record.behavior;
                    if (behaviorLevel === 'متوسط') behaviorLevel = 'مقبول';
                    if (behaviorLevel === 'غير منضبط') behaviorLevel = 'مشاغب';

                    const hasNewMemo = memoLevel && pointsConfig.evaluation;
                    const hasReview = record.review && pointsConfig.review;

                    if (hasNewMemo) {
                        const hifzPoints = (pointsConfig.evaluation as any)[memoLevel] ?? 0;
                        earnedMemoPoints += hifzPoints;
                        hasMemo = true;
                        if (memoLevel === 'ممتاز') studentScores[studentId].stats.excellent++;
                        if (memoLevel === 'جيد') studentScores[studentId].stats.good++;
                        if (memoLevel === 'مقبول') studentScores[studentId].stats.average++;
                    }
                    if (hasReview) {
                        earnedMemoPoints += pointsConfig.review.completed;
                        hasMemo = true;
                        studentScores[studentId].stats.reviewed++;
                    }

                    if (hasMemo) {
                        const isGroup8User = studentScores[studentId].groupName === 'فوج 8' || studentScores[studentId].groupName === 'فوج الشيخ عبد الحق نصيرة' || studentScores[studentId].groupName.includes('عبد الحق');
                        const multiplier = isGroup8User ? (studentScores[studentId].memorizationMultiplier ?? 1.0) : 1.0;
                        const penalty = (hasNewMemo && record.isDelayed) ? 0.8 : 1.0;
                        studentScores[studentId].pointsBreakdown.hifz += earnedMemoPoints * multiplier * penalty;
                    }

                    // Behavior points
                    if (behaviorLevel && pointsConfig.behavior) {
                        const behaviorPoints = (pointsConfig.behavior as any)[behaviorLevel] ?? 0;
                        studentScores[studentId].pointsBreakdown.behavior += behaviorPoints;
                        if (behaviorLevel === 'هادئ') studentScores[studentId].stats.calm++;
                        if (behaviorLevel === 'مقبول') studentScores[studentId].stats.medium++;
                        if (behaviorLevel === 'مشاغب') studentScores[studentId].stats.undisciplined++;
                    }
                }
            });
        });

        // Add completed covenants points
        Object.values(studentScores).forEach(score => {
            if (score.status === 'نشط') {
                const studentObj = studentsList.find(s => s.id === score.id);
                (studentObj?.covenants || []).forEach((covenant: any) => {
                    if (covenant.status === 'تم الوفاء بها' && covenant.date) {
                        try {
                            const covenantDate = parseISO(covenant.date);
                            if (getMonth(covenantDate) === targetMonth && getYear(covenantDate) === targetYear) {
                                score.pointsBreakdown.hifz += pointsConfig.covenantCompleted;
                            }
                        } catch (e) {
                            console.error("Invalid covenant date in precalculate stats:", covenant.date);
                        }
                    }
                });
                score.stats.commitmentBalance = (score.stats.present + score.stats.makeup) - score.stats.absent;
                score.points = score.pointsBreakdown.hifz + score.pointsBreakdown.attendance + score.pointsBreakdown.behavior;
            }
        });

        // Filter active students and sort by points descending to assign rankings
        const sortedStudentScores = Object.values(studentScores)
            .filter((s: any) => s.status === 'نشط')
            .sort((a: any, b: any) => b.points - a.points)
            .map((s: any, idx) => ({
                ...s,
                rank: idx + 1
            }));

        // Save computed student rankings to Firebase RTDB under student_scores/${monthKey}
        await set(ref(db, `student_scores/${monthKey}`), sortedStudentScores);

        return NextResponse.json({
            success: true,
            month: monthKey,
            sheikhsCalculated: rawSheikhScores.length,
            studentsCalculated: sortedStudentScores.length
        });

    } catch (error: any) {
        console.error('Error precalculating stats:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Unknown error occurred during precalculation'
        }, { status: 500 });
    }
}
