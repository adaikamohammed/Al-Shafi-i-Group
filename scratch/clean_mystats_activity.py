import re

with open(r"G:\Al-Shafi-i-Group-main\Al-Shafi-i-Group-main\src\app\management\my-stats\page.tsx", "r", encoding="utf-8") as f:
    c = f.read()

# 1. Update calculatePoints signature and points formulas to match SheikhBadges.tsx
# There is only one calculatePoints now (we removed the second in our previous script and made it the same)
old_calc = """        const calculatePoints = (data: {
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

new_calc = """        const calculatePoints = (data: {
            basicSessions: number;
            activitySessions: number;
            avgAttendance: number;
            avgExcellent: number;
            avgGoodPlus: number;
            commitmentRate: number;
            sheikhabsences: number;
            extraSessions: number;
            excCount: number;
        }) => {
            const sessionPoints = (data.basicSessions * weights.sessionWeight) + (data.activitySessions * weights.sessionWeight * 0.5);
            const weightedSessions = data.basicSessions + (data.activitySessions * 0.5);
            const attendancePoints = weightedSessions > 0 ? Math.round((data.avgAttendance / 100) * weights.attendanceWeight * weightedSessions) : 0;
            const extraSessionBonus = data.extraSessions * weights.extraSessionBonus;
            const excellenceBonus = data.excCount > 0 ? Math.round((data.avgExcellent / 100) * weights.excellentBonus * data.basicSessions) : 0;
            const goodPlusBonus = data.excCount > 0 ? Math.round((data.avgGoodPlus / 100) * weights.goodPlusBonus * data.basicSessions) : 0;
            const excellencePoints = excellenceBonus + goodPlusBonus;

            const totalSessions = data.basicSessions + data.activitySessions;
            const commitmentBonus = (data.commitmentRate >= 100 && data.sheikhabsences === 0 && totalSessions > 0) ? weights.commitmentBonus : 0;
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

c = c.replace(old_calc, new_calc)

# 2. Update first rawScores mapping loop to track basicCount and activityCount
old_loop1_header = """        const rawScores = sheikhsList.map(sh => {
            let sessions = 0, extraSessions = 0, highAttDays = 0, totalDays = 0;
            let attTotal = 0, attCount = 0;
            let excTotal = 0, gpTotal = 0, excCount = 0;
            let sheikhabsences = 0, holidays = 0;
allDays.forEach(day => {"""

new_loop1_header = """        const rawScores = sheikhsList.map(sh => {
            let sessions = 0, extraSessions = 0, highAttDays = 0, totalDays = 0;
            let basicCount = 0, activityCount = 0;
            let attTotal = 0, attCount = 0;
            let excTotal = 0, gpTotal = 0, excCount = 0;
            let sheikhabsences = 0, holidays = 0;
            allDays.forEach(day => {"""

c = c.replace(old_loop1_header, new_loop1_header)

old_loop1_body = """                const isReal = stats.type === 'حصة أساسية' || stats.type === 'حصة تعويضية' || stats.type === 'حصة إضافية';
                if (isReal) {
                    sessions++;
                    if (stats.type === 'حصة تعويضية' || stats.type === 'حصة إضافية') {
                        extraSessions++;
                    }
                    if (stats.attendance !== null) {
                        attTotal += stats.attendance;
                        attCount++;
                        if (stats.attendance >= 90) highAttDays++;
                    }
                    if (stats.excellent !== null) {
                        excTotal += stats.excellent;
                        excCount++;
                    }
                    if (stats.goodPlus !== null) gpTotal += stats.goodPlus;

                    
                }"""

new_loop1_body = """                const isReal = stats.type === 'حصة أساسية' || stats.type === 'حصة تعويضية' || stats.type === 'حصة إضافية';
                const isActivity = stats.type === 'حصة أنشطة';
                if (isReal) {
                    sessions++;
                    basicCount++;
                    if (stats.type === 'حصة تعويضية' || stats.type === 'حصة إضافية') {
                        extraSessions++;
                    }
                    if (stats.attendance !== null) {
                        attTotal += stats.attendance;
                        attCount++;
                        if (stats.attendance >= 90) highAttDays++;
                    }
                    if (stats.excellent !== null) {
                        excTotal += stats.excellent;
                        excCount++;
                    }
                    if (stats.goodPlus !== null) gpTotal += stats.goodPlus;
                } else if (isActivity) {
                    sessions += 0.5;
                    activityCount++;
                    if (stats.attendance !== null) {
                        attTotal += stats.attendance;
                        attCount++;
                        if (stats.attendance >= 90) highAttDays++;
                    }
                }"""

c = c.replace(old_loop1_body, new_loop1_body)

# Update first rawScores commitmentRate and calculatePoints call
old_loop1_calc = """            const commitmentRate = workingDays > 0 ? Math.round((sessions / workingDays) * 100) : 0;

            const pts = calculatePoints({
                sessions,
                avgAttendance,
                avgExcellent,
                avgGoodPlus,
                commitmentRate,
                sheikhabsences,
                extraSessions,
                excCount
            });

            const base = {
                group: sh.group,
                displayName: sh.displayName,
                totalPoints: pts.totalPoints,
                sessionPoints: pts.sessionPoints,
                excellencePoints: pts.excellencePoints,
                attendancePoints: pts.attendancePoints,
                commitmentPoints: pts.commitmentPoints,
                extraSessionBonus: pts.extraSessionBonus,
                totalSessions: sessions,
                totalDays,
                avgAttendance,
                avgExcellent,
                avgGoodPlus,
                commitmentRate,
                highAttDays,
                sheikhabsences,
                extraSessionsCount: extraSessions,
            };"""

new_loop1_calc = """            const weightedSessionsCount = basicCount + activityCount * 0.5;
            const commitmentRate = workingDays > 0 ? Math.round((weightedSessionsCount / workingDays) * 100) : 0;

            const pts = calculatePoints({
                basicSessions: basicCount,
                activitySessions: activityCount,
                avgAttendance,
                avgExcellent,
                avgGoodPlus,
                commitmentRate,
                sheikhabsences,
                extraSessions,
                excCount
            });

            const base = {
                group: sh.group,
                displayName: sh.displayName,
                totalPoints: pts.totalPoints,
                sessionPoints: pts.sessionPoints,
                excellencePoints: pts.excellencePoints,
                attendancePoints: pts.attendancePoints,
                commitmentPoints: pts.commitmentPoints,
                extraSessionBonus: pts.extraSessionBonus,
                totalSessions: basicCount + activityCount,
                totalDays,
                avgAttendance,
                avgExcellent,
                avgGoodPlus,
                commitmentRate,
                highAttDays,
                sheikhabsences,
                extraSessionsCount: extraSessions,
            };"""

c = c.replace(old_loop1_calc, new_loop1_calc)


# 3. Update second rawScores mapping loop (yearlyMonthlyStats)
old_loop2_header = """            let sessions = 0, extraSessions = 0, highAttDays = 0, totalDays = 0;
            let attTotal = 0, attCount = 0;
            let excTotal = 0, gpTotal = 0, excCount = 0;
            let sheikhabsences = 0, holidays = 0;
allDays.forEach(day => {"""

new_loop2_header = """            let sessions = 0, extraSessions = 0, highAttDays = 0, totalDays = 0;
            let basicCount = 0, activityCount = 0;
            let attTotal = 0, attCount = 0;
            let excTotal = 0, gpTotal = 0, excCount = 0;
            let sheikhabsences = 0, holidays = 0;
            allDays.forEach(day => {"""

c = c.replace(old_loop2_header, new_loop2_header)

old_loop2_body = """                const isReal = stats.type === 'حصة أساسية' || stats.type === 'حصة تعويضية' || stats.type === 'حصة إضافية';
                if (isReal) {
                    sessions++;
                    if (stats.type === 'حصة تعويضية' || stats.type === 'حصة إضافية') {
                        extraSessions++;
                    }
                    if (stats.attendance !== null) {
                        attTotal += stats.attendance;
                        attCount++;
                        if (stats.attendance >= 90) highAttDays++;
                    }
                    if (stats.excellent !== null) {
                        excTotal += stats.excellent;
                        excCount++;
                    }
                    if (stats.goodPlus !== null) gpTotal += stats.goodPlus;

                    
                }"""

new_loop2_body = """                const isReal = stats.type === 'حصة أساسية' || stats.type === 'حصة تعويضية' || stats.type === 'حصة إضافية';
                const isActivity = stats.type === 'حصة أنشطة';
                if (isReal) {
                    sessions++;
                    basicCount++;
                    if (stats.type === 'حصة تعويضية' || stats.type === 'حصة إضافية') {
                        extraSessions++;
                    }
                    if (stats.attendance !== null) {
                        attTotal += stats.attendance;
                        attCount++;
                        if (stats.attendance >= 90) highAttDays++;
                    }
                    if (stats.excellent !== null) {
                        excTotal += stats.excellent;
                        excCount++;
                    }
                    if (stats.goodPlus !== null) gpTotal += stats.goodPlus;
                } else if (isActivity) {
                    sessions += 0.5;
                    activityCount++;
                    if (stats.attendance !== null) {
                        attTotal += stats.attendance;
                        attCount++;
                        if (stats.attendance >= 90) highAttDays++;
                    }
                }"""

c = c.replace(old_loop2_body, new_loop2_body)

# Update second rawScores commitmentRate and calculatePoints call
old_loop2_calc = """            const commitmentRate = workingDays > 0 ? Math.round((sessions / workingDays) * 100) : 0;

            const hasData = sessions > 0;

            const pts = calculatePoints({
                sessions,
                avgAttendance,
                avgExcellent,
                avgGoodPlus,
                commitmentRate,
                sheikhabsences,
                extraSessions,
                excCount
            });

            const base = {
                monthIndex: m,
                monthName: ARABIC_MONTHS[m],
                monthKey: format(monthDate, 'yyyy-MM'),
                totalPoints: pts.totalPoints,
                sessionPoints: pts.sessionPoints,
                excellencePoints: pts.excellencePoints,
                attendancePoints: pts.attendancePoints,
                commitmentPoints: pts.commitmentPoints,
                extraSessionBonus: pts.extraSessionBonus,
                totalSessions: sessions,
                totalDays,
                avgAttendance,
                avgExcellent,
                avgGoodPlus,
                commitmentRate,
                highAttDays,
                sheikhabsences,
                extraSessionsCount: extraSessions,
                hasData
            };"""

new_loop2_calc = """            const weightedSessionsCount = basicCount + activityCount * 0.5;
            const commitmentRate = workingDays > 0 ? Math.round((weightedSessionsCount / workingDays) * 100) : 0;

            const hasData = (basicCount + activityCount) > 0;

            const pts = calculatePoints({
                basicSessions: basicCount,
                activitySessions: activityCount,
                avgAttendance,
                avgExcellent,
                avgGoodPlus,
                commitmentRate,
                sheikhabsences,
                extraSessions,
                excCount
            });

            const base = {
                monthIndex: m,
                monthName: ARABIC_MONTHS[m],
                monthKey: format(monthDate, 'yyyy-MM'),
                totalPoints: pts.totalPoints,
                sessionPoints: pts.sessionPoints,
                excellencePoints: pts.excellencePoints,
                attendancePoints: pts.attendancePoints,
                commitmentPoints: pts.commitmentPoints,
                extraSessionBonus: pts.extraSessionBonus,
                totalSessions: basicCount + activityCount,
                totalDays,
                avgAttendance,
                avgExcellent,
                avgGoodPlus,
                commitmentRate,
                highAttDays,
                sheikhabsences,
                extraSessionsCount: extraSessions,
                hasData
            };"""

c = c.replace(old_loop2_calc, new_loop2_calc)

with open(r"G:\Al-Shafi-i-Group-main\Al-Shafi-i-Group-main\src\app\management\my-stats\page.tsx", "w", encoding="utf-8") as f:
    f.write(c)

print("Finished my-stats activity scoring update")
