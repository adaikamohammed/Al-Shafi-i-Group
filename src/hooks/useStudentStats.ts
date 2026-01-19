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
                    if (record.attendance && pointsConfig.attendance) {
                        studentScores[studentId].points += (pointsConfig.attendance[record.attendance as keyof typeof pointsConfig.attendance] || 0);
                        if (record.attendance === 'حاضر') studentScores[studentId].stats.present++;
                        if (record.attendance === 'غائب') studentScores[studentId].stats.absent++;
                        if (record.attendance === 'تعويض') studentScores[studentId].stats.makeup++;
                    }
                    if (record.memorization && pointsConfig.evaluation) {
                        studentScores[studentId].points += (pointsConfig.evaluation[record.memorization as keyof typeof pointsConfig.evaluation] || 0);
                    }
                    if (record.behavior && pointsConfig.behavior) {
                        studentScores[studentId].points += (pointsConfig.behavior[record.behavior as keyof typeof pointsConfig.behavior] || 0);
                        if (record.behavior === 'هادئ') studentScores[studentId].stats.calm++;
                        if (record.behavior === 'متوسط') studentScores[studentId].stats.medium++;
                        if (record.behavior === 'غير منضبط') studentScores[studentId].stats.undisciplined++;
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
                        if (record.attendance) {
                            if (record.attendance === 'غائب') studentScoresInMonth[record.studentId].stats.absent++;
                            if (record.attendance === 'تعويض') studentScoresInMonth[record.studentId].stats.makeup++;
                        }
                        if (record.behavior) {
                            if (record.behavior === 'هادئ') studentScoresInMonth[record.studentId].stats.calm++;
                            if (record.behavior === 'متوسط') studentScoresInMonth[record.studentId].stats.medium++;
                            if (record.behavior === 'غير منضبط') studentScoresInMonth[record.studentId].stats.undisciplined++;
                        }
                        studentScoresInMonth[record.studentId].points += (settings.points.attendance[record.attendance as keyof typeof settings.points.attendance] || 0);
                        studentScoresInMonth[record.studentId].points += (settings.points.evaluation[record.memorization as keyof typeof settings.points.evaluation] || 0);
                        studentScoresInMonth[record.studentId].points += (settings.points.behavior[record.behavior as keyof typeof settings.points.behavior] || 0);
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
