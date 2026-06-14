import { useMemo } from 'react';
import { startOfMonth, endOfMonth, parseISO, getYear, isAfter } from 'date-fns';
import { Student, DailySession, AppSettings } from '@/lib/types';

export const useStudentStats = (students: Student[] | null, dailySessions: Record<string, Record<string, DailySession>> | null, settings: AppSettings) => {
    const rankingData = useMemo(() => {
        const pointsConfig = settings.points;
        if (!pointsConfig || !students) return [];

        const monthStartDate = startOfMonth(new Date());
        const monthEndDate = endOfMonth(new Date());

        const sessionsInMonth = Object.values(dailySessions ?? {}).flatMap(sessionsOnDate =>
            Object.values(sessionsOnDate).filter(session => {
                if (!session?.date) return false;
                try {
                    const sessionDate = parseISO(session.date);
                    return sessionDate >= monthStartDate && sessionDate <= monthEndDate;
                } catch (e) { return false; }
            })
        );

        const studentScores: Record<string, any> = {};
        (students ?? []).filter(s => s.status === 'نشط').forEach(student => {
            studentScores[student.id] = {
                id: student.id,
                points: 0,
                stats: { present: 0, absent: 0, makeup: 0, calm: 0, medium: 0, undisciplined: 0, commitmentBalance: 0 }
            };
        });

        sessionsInMonth.forEach(session => {
            (session.records ?? []).forEach(record => {
                const studentId = record.studentId;
                if (studentScores[studentId]) {
                    let memoLevel = record.memorization;
                    if (memoLevel === 'متوسط') memoLevel = 'مقبول';
                    if (memoLevel === 'جيد جدا') memoLevel = 'جيد جداً';

                    let behaviorLevel = record.behavior;
                    if (behaviorLevel === 'متوسط') behaviorLevel = 'مقبول';
                    if (behaviorLevel === 'غير منضبط') behaviorLevel = 'مشاغب';

                    if (record.attendance && pointsConfig.attendance) {
                        studentScores[studentId].points += (pointsConfig.attendance[record.attendance as keyof typeof pointsConfig.attendance] || 0);
                        if (record.attendance === 'حاضر') studentScores[studentId].stats.present++;
                        if (record.attendance === 'غائب') studentScores[studentId].stats.absent++;
                        if (record.attendance === 'تعويض') studentScores[studentId].stats.makeup++;
                    }
                    if (memoLevel && pointsConfig.evaluation) {
                        studentScores[studentId].points += (pointsConfig.evaluation[memoLevel as keyof typeof pointsConfig.evaluation] || 0);
                    }
                    if (behaviorLevel && pointsConfig.behavior) {
                        studentScores[studentId].points += (pointsConfig.behavior[behaviorLevel as keyof typeof pointsConfig.behavior] || 0);
                        if (behaviorLevel === 'هادئ') studentScores[studentId].stats.calm++;
                        if (behaviorLevel === 'مقبول') studentScores[studentId].stats.medium++;
                        if (behaviorLevel === 'مشاغب') studentScores[studentId].stats.undisciplined++;
                    }
                    if (record.review && pointsConfig.review) {
                        studentScores[studentId].points += (pointsConfig.review.completed || 0);
                    }

                    // Process individual makeup sessions for student points and commitment statistics
                    if (record.makeupSessions && Array.isArray(record.makeupSessions)) {
                        record.makeupSessions.forEach((makeup: any) => {
                            studentScores[studentId].stats.makeup++;

                            const makeupAttPts = pointsConfig.attendance?.['تعويض'] ?? 1.5;
                            studentScores[studentId].points += makeupAttPts;

                            let mkMemoLevel = makeup.memorization;
                            if (mkMemoLevel === 'متوسط') mkMemoLevel = 'مقبول';
                            if (mkMemoLevel === 'جيد جدا') mkMemoLevel = 'جيد جداً';

                            let mkBehaviorLevel = makeup.behavior;
                            if (mkBehaviorLevel === 'متوسط') mkBehaviorLevel = 'مقبول';
                            if (mkBehaviorLevel === 'غير منضبط') mkBehaviorLevel = 'مشاغب';

                            if (mkMemoLevel && pointsConfig.evaluation) {
                                studentScores[studentId].points += (pointsConfig.evaluation[mkMemoLevel as keyof typeof pointsConfig.evaluation] || 0);
                            }
                            if (mkBehaviorLevel && pointsConfig.behavior) {
                                studentScores[studentId].points += (pointsConfig.behavior[mkBehaviorLevel as keyof typeof pointsConfig.behavior] || 0);
                                if (mkBehaviorLevel === 'هادئ') studentScores[studentId].stats.calm++;
                                if (mkBehaviorLevel === 'مقبول') studentScores[studentId].stats.medium++;
                                if (mkBehaviorLevel === 'مشاغب') studentScores[studentId].stats.undisciplined++;
                            }
                            if (makeup.review && pointsConfig.review) {
                                studentScores[studentId].points += (pointsConfig.review.completed || 0);
                            }
                        });
                    }
                }
            });
        });

        Object.values(studentScores).forEach((score: any) => {
            score.stats.commitmentBalance = score.stats.absent - score.stats.makeup;
        });

        return Object.values(studentScores).sort((a: any, b: any) => b.points - a.points);
    }, [students, dailySessions, settings.points]);

    const getStudentMedalHistory = (studentId: string) => {
        const history: (string | null)[] = Array(12).fill(null);
        let consecutiveGold = 0;
        let grandMaster = false;
        let goldCount = 0;

        const currentYear = getYear(new Date());

        for (let month = 0; month < 12; month++) {
            const monthStartDate = startOfMonth(new Date(currentYear, month));
            const monthEndDate = endOfMonth(new Date(currentYear, month));
            if (isAfter(monthStartDate, new Date())) continue;

            const sessionsInMonth = Object.values(dailySessions ?? {}).flatMap(sessionsOnDate =>
                Object.values(sessionsOnDate).filter(session => {
                    if (!session?.date) return false;
                    try {
                        const sessionDate = parseISO(session.date);
                        return sessionDate >= monthStartDate && sessionDate <= monthEndDate;
                    } catch (e) { return false; }
                })
            );

            const studentScoresInMonth: Record<string, any> = {};
            (students ?? []).filter(s => s.status === 'نشط').forEach(s => {
                studentScoresInMonth[s.id] = {
                    id: s.id,
                    points: 0,
                    stats: { absent: 0, makeup: 0, calm: 0, medium: 0, undisciplined: 0 }
                };
            });

            sessionsInMonth.forEach(session => {
                (session.records ?? []).forEach(record => {
                    if (studentScoresInMonth[record.studentId]) {
                        let memoLevel = record.memorization;
                        if (memoLevel === 'متوسط') memoLevel = 'مقبول';
                        if (memoLevel === 'جيد جدا') memoLevel = 'جيد جداً';

                        let behaviorLevel = record.behavior;
                        if (behaviorLevel === 'متوسط') behaviorLevel = 'مقبول';
                        if (behaviorLevel === 'غير منضبط') behaviorLevel = 'مشاغب';

                        if (record.attendance) {
                            if (record.attendance === 'غائب') studentScoresInMonth[record.studentId].stats.absent++;
                            if (record.attendance === 'تعويض') studentScoresInMonth[record.studentId].stats.makeup++;
                        }
                        if (behaviorLevel) {
                            if (behaviorLevel === 'هادئ') studentScoresInMonth[record.studentId].stats.calm++;
                            if (behaviorLevel === 'مقبول') studentScoresInMonth[record.studentId].stats.medium++;
                            if (behaviorLevel === 'مشاغب') studentScoresInMonth[record.studentId].stats.undisciplined++;
                        }
                        if (record.attendance) {
                            studentScoresInMonth[record.studentId].points += (settings.points.attendance[record.attendance as keyof typeof settings.points.attendance] || 0);
                        }
                        if (memoLevel) {
                            studentScoresInMonth[record.studentId].points += (settings.points.evaluation[memoLevel as keyof typeof settings.points.evaluation] || 0);
                        }
                        if (behaviorLevel) {
                            studentScoresInMonth[record.studentId].points += (settings.points.behavior[behaviorLevel as keyof typeof settings.points.behavior] || 0);
                        }
                        if (record.review && settings.points.review) {
                            studentScoresInMonth[record.studentId].points += (settings.points.review.completed || 0);
                        }

                        // Process individual makeup sessions for student medal history points
                        if (record.makeupSessions && Array.isArray(record.makeupSessions)) {
                            record.makeupSessions.forEach((makeup: any) => {
                                studentScoresInMonth[record.studentId].stats.makeup++;

                                const makeupAttPts = settings.points.attendance?.['تعويض'] ?? 1.5;
                                studentScoresInMonth[record.studentId].points += makeupAttPts;

                                let mkMemoLevel = makeup.memorization;
                                if (mkMemoLevel === 'متوسط') mkMemoLevel = 'مقبول';
                                if (mkMemoLevel === 'جيد جدا') mkMemoLevel = 'جيد جداً';

                                let mkBehaviorLevel = makeup.behavior;
                                if (mkBehaviorLevel === 'متوسط') mkBehaviorLevel = 'مقبول';
                                if (mkBehaviorLevel === 'غير منضبط') mkBehaviorLevel = 'مشاغب';

                                if (mkMemoLevel && settings.points.evaluation) {
                                    studentScoresInMonth[record.studentId].points += (settings.points.evaluation[mkMemoLevel as keyof typeof settings.points.evaluation] || 0);
                                }
                                if (mkBehaviorLevel && settings.points.behavior) {
                                    studentScoresInMonth[record.studentId].points += (settings.points.behavior[mkBehaviorLevel as keyof typeof settings.points.behavior] || 0);
                                    if (mkBehaviorLevel === 'هادئ') studentScoresInMonth[record.studentId].stats.calm++;
                                    if (mkBehaviorLevel === 'مقبول') studentScoresInMonth[record.studentId].stats.medium++;
                                    if (mkBehaviorLevel === 'مشاغب') studentScoresInMonth[record.studentId].stats.undisciplined++;
                                }
                                if (makeup.review && settings.points.review) {
                                    studentScoresInMonth[record.studentId].points += (settings.points.review.completed || 0);
                                }
                            });
                        }
                    }
                });
            });

            const rankedStudents = Object.values(studentScoresInMonth).sort((a: any, b: any) => b.points - a.points);
            const studentRankIndex = rankedStudents.findIndex(s => s.id === studentId);

            if (studentRankIndex !== -1 && studentRankIndex < 3) {
                const studentData = rankedStudents[studentRankIndex] as any;
                const uncompensatedAbsences = studentData.stats.absent - studentData.stats.makeup;

                let medal: string | null = null;
                if (studentRankIndex === 0 && uncompensatedAbsences <= 0 && studentData.stats.calm > (studentData.stats.medium + studentData.stats.undisciplined)) {
                    medal = "gold";
                    goldCount++;
                    consecutiveGold++;
                } else if (studentRankIndex === 1 && uncompensatedAbsences <= 1) {
                    medal = "silver";
                    consecutiveGold = 0;
                } else if (studentRankIndex === 2 && uncompensatedAbsences <= 2) {
                    medal = "bronze";
                    consecutiveGold = 0;
                } else {
                    consecutiveGold = 0;
                }
                history[month] = medal;
                if (consecutiveGold >= 3) {
                    grandMaster = true;
                }
            } else {
                consecutiveGold = 0;
            }
        }
        return { history, goldCount, grandMaster };
    };

    return { rankingData, getStudentMedalHistory };
};
