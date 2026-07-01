import re

with open(r"G:\Al-Shafi-i-Group-main\Al-Shafi-i-Group-main\src\app\management\my-stats\page.tsx", "r", encoding="utf-8") as f:
    c = f.read()

# 1. Remove punctualityBonus: number; from ScoringWeights interface
c = c.replace("    punctualityBonus: number;\n", "")

# 2. Remove punctualityBonus: 5 from DEFAULT_WEIGHTS
c = c.replace("    punctualityBonus: 5\n};", "};")
c = c.replace("    punctualityBonus: 5,\n", "")

# 3. Remove isSessionPunctual function definition
is_punctual_fn = """const isSessionPunctual = (session: any): boolean => {
    if (!session || !session.createdAt || !session.date) return true;
    try {
        const created = new Date(session.createdAt);
        const scheduled = new Date(session.date);
        scheduled.setHours(12, 0, 0, 0); // standard baseline
        const diffMs = created.getTime() - scheduled.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);
        return diffHours <= 36; // 36 hours limit
    } catch {
        return true;
    }
};"""
c = c.replace(is_punctual_fn, "")

# 4. Remove punctualityBonus firebase restoration fallback
c = c.replace("                    punctualityBonus: typeof val.punctualityBonus === 'number' ? val.punctualityBonus : DEFAULT_WEIGHTS.punctualityBonus,\n", "")

# 5. Clean up first calculatePoints definition (historic)
old_calc1 = """        const calculatePoints = (data: {
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
        };"""

new_calc = """        const calculatePoints = (data: {
            sessions: number;
            avgAttendance: number;
            avgExcellent: number;
            avgGoodPlus: number;
            commitmentRate: number;
            sheikhabsences: number;
            extraSessions: number;
            excCount: number;
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

            const totalPoints = sessionPoints + attendancePoints + extraSessionBonus + excellencePoints + commitmentPoints;

            return {
                totalPoints,
                sessionPoints,
                attendancePoints,
                extraSessionBonus,
                excellencePoints,
                commitmentPoints
            };
        };"""

c = c.replace(old_calc1, new_calc)

# 6. Clean up first rawScores loop (remove punctualSessions logic)
c = c.replace("            let punctualSessions = 0;\n\n            allDays.forEach", "allDays.forEach")
c = c.replace("            let punctualSessions = 0;\n            allDays.forEach", "allDays.forEach")

c = re.sub(r'if\s*\(\s*isSessionPunctual\(stats\.session\)\s*\)\s*\{\s*punctualSessions\+\+;\s*\}', '', c)

c = c.replace("""            const pts = calculatePoints({
                sessions,
                avgAttendance,
                avgExcellent,
                avgGoodPlus,
                commitmentRate,
                sheikhabsences,
                extraSessions,
                excCount,
                punctualSessions
            });""", """            const pts = calculatePoints({
                sessions,
                avgAttendance,
                avgExcellent,
                avgGoodPlus,
                commitmentRate,
                sheikhabsences,
                extraSessions,
                excCount
            });""")

c = c.replace("                punctualityBonus: pts.punctualityBonus,\n", "")
c = c.replace("                punctualSessionsCount: punctualSessions\n", "")
c = c.replace("                punctualSessionsCount: punctualSessions,\n", "")

# 7. Clean up second calculatePoints definition (current/previous month)
old_calc2 = """        const calculatePoints = (data: {
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
        };"""
c = c.replace(old_calc2, new_calc)

# 8. Clean up second rawScores loop (active/selected sheikh score calculation)
c = c.replace("""            const pts = calculatePoints({
                sessions,
                avgAttendance,
                avgExcellent,
                avgGoodPlus,
                commitmentRate,
                sheikhabsences,
                extraSessions,
                excCount,
                punctualSessions
            });""", """            const pts = calculatePoints({
                sessions,
                avgAttendance,
                avgExcellent,
                avgGoodPlus,
                commitmentRate,
                sheikhabsences,
                extraSessions,
                excCount
            });""")

# 9. Remove card UI for punctuality
punctuality_card = """                                                { label: 'بونص التوثيق السريع', val: mySheikhScore.punctualityBonus, max: 120, sub: `${mySheikhScore.punctualSessionsCount} حصة موثقة سريعاً`, icon: '⚡', desc: `توثيق الحصة خلال 36 ساعة من موعدها` },"""
c = c.replace(punctuality_card, "")

# 10. Remove speed tips recommendation
tips_block = """                                                                        {bestMonthOverall.totalPoints > currentMonthStats.totalPoints && 
                                                                         bestMonthOverall.totalSessions <= currentMonthStats.totalSessions && 
                                                                         bestMonthOverall.avgAttendance <= currentMonthStats.avgAttendance && (
                                                                            <li>
                                                                                زيادة سرعة توثيق الحصص خلال 36 ساعة لكسب "بونص التوثيق السريع" (+{weights.punctualityBonus} نقاط لكل حصة)، والحد من الغيابات الطارئة للشيخ.
                                                                            </li>
                                                                        )}"""
c = c.replace(tips_block, "")

with open(r"G:\Al-Shafi-i-Group-main\Al-Shafi-i-Group-main\src\app\management\my-stats\page.tsx", "w", encoding="utf-8") as f:
    f.write(c)

print("Finished precise cleaning of my-stats file")
