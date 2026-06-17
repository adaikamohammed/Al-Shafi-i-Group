import { NextResponse } from 'next/server';
import { db, auth } from '@/lib/firebase';
import { ref, get, set, push } from 'firebase/database';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { format, subDays, parseISO } from 'date-fns';

const EDUCATIONAL_ADVICES = [
  "«خيركم من تعلم القرآن وعلمه» - احرص على تذكير طلابك بفضل الحفظ وإخلاص النية.",
  "التشجيع والثناء على الطالب المتميز يزيد من همته، والكلمة الطيبة صدقة تؤتي أكلها كل حين.",
  "المراجعة والتكرار هما عماد الحفظ الراسخ، ركز هذا الأسبوع على تثبيت الورد القديم.",
  "اربط الآيات بالقيم والآداب اليومية، فالقرآن خُلق يُترجم في واقع الحياة.",
  "الصبر مع الطالب بطيء الحفظ وبث الأمل في قلبه قد يغير مساره بالكامل.",
  "يسروا ولا تعسروا، واجعلوا جلسة القرآن واحة من المحبة والسكينة والرحمة.",
  "قصص القرآن تشد الانتباه وترسخ المعاني، خصص دقيقة واحدة في نهاية الحصة لقصة قصيرة.",
  "المتابعة المستمرة مع الولي تكمل جهد الشيخ؛ تشاور معهم بانتظام لمصلحة الطالب.",
  "تعاهد الطلاب بالدعاء بظهر الغيب، فإن قلوبهم بين يدي الرحمن يوجهها كيف يشاء.",
  "التركيز على الكيف والترتيل والتجويد مقدم على الكم وسرعة الختم."
];

export async function GET(request: Request) {
  // Bypass database writes during Next.js build-time prerendering phase
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return NextResponse.json({
      success: true,
      message: 'Static export build bypass'
    });
  }

  try {
    // 1. Authenticate server-side as super admin to satisfy security rules
    if (!auth.currentUser) {
      await signInWithEmailAndPassword(auth, 'admin00@gmail.com', '123456');
    }

    // 2. Fetch all users
    const usersSnapshot = await get(ref(db, 'users'));
    if (!usersSnapshot.exists()) {
      return NextResponse.json({ error: 'No users found in database' }, { status: 404 });
    }
    const usersData = usersSnapshot.val();

    // 3. Define the weekly range (last 7 days)
    const today = new Date();
    const lastWeekDate = subDays(today, 7);
    const formatYYYYMMDD = (d: Date) => format(d, 'yyyy-MM-dd');
    
    const lastWeekStr = formatYYYYMMDD(lastWeekDate);
    const todayStr = formatYYYYMMDD(today);

    // 4. Identify sheikhs and their students
    const sheikhs: any[] = [];
    const superAdmins: string[] = [];

    for (const uid in usersData) {
      const profile = usersData[uid]?.profile;
      if (profile) {
        if (profile.role === 'sheikh' && profile.group) {
          sheikhs.push({
            uid,
            displayName: profile.displayName || 'شيخ غير مسمى',
            group: profile.group,
            userData: usersData[uid]
          });
        } else if (profile.role === 'super_admin' || profile.role === 'management' || profile.email === 'admin00@gmail.com') {
          superAdmins.push(uid);
        }
      }
    }

    const weeklySummaryReport: string[] = [];
    const systemSenderId = 'system_weekly_cron';

    // 5. Compute weekly stats for each sheikh
    for (const sheikh of sheikhs) {
      const userData = sheikh.userData;
      const activeStudents = userData.students 
        ? Object.entries(userData.students)
            .map(([id, s]: [string, any]) => ({ ...s, id }))
            .filter((s: any) => s.status === 'نشط')
        : [];

      if (activeStudents.length === 0) {
        continue;
      }

      // Collect sessions logged in the last week
      const weeklySessions: any[] = [];
      if (userData.dailySessions) {
        for (const date in userData.dailySessions) {
          if (date >= lastWeekStr && date < todayStr) {
            const dayVal = userData.dailySessions[date];
            if (dayVal && typeof dayVal === 'object') {
              if ('date' in dayVal && ('records' in dayVal || 'sessionType' in dayVal)) {
                weeklySessions.push({ ...dayVal, dateStr: date });
              } else {
                Object.entries(dayVal).forEach(([sessId, sessionObj]: [string, any]) => {
                  weeklySessions.push({ ...sessionObj, dateStr: date, id: sessId });
                });
              }
            }
          }
        }
      }

      // If no sessions held, notify sheikh to log sessions
      if (weeklySessions.length === 0) {
        const title = "📋 التقرير الأسبوعي لفوجك";
        const message = `السلام عليكم يا شيخ ${sheikh.displayName}، لم نجد أي جلسات أو حلقات مسجلة لفوجك (${sheikh.group}) خلال الأسبوع الماضي من ${lastWeekStr} إلى ${todayStr}. يرجى الحرص على توثيق الحصص بانتظام لمتابعة مستوى الطلاب.`;
        
        const notificationRef = ref(db, `users/${sheikh.uid}/notifications`);
        await set(push(notificationRef), {
          title,
          message,
          type: 'alert',
          senderId: systemSenderId,
          timestamp: new Date().toISOString(),
          read: false
        });
        
        weeklySummaryReport.push(`- **فوج ${sheikh.group} (الشيخ: ${sheikh.displayName}):** لم تسجل أي جلسات هذا الأسبوع.`);
        continue;
      }

      // Initialize weekly stats per student
      const studentStats: Record<string, {
        name: string;
        presentCount: number;
        absentCount: number;
        excellentCount: number;
        sessionsCount: number;
      }> = {};

      activeStudents.forEach((student: any) => {
        studentStats[student.id] = {
          name: student.fullName,
          presentCount: 0,
          absentCount: 0,
          excellentCount: 0,
          sessionsCount: 0
        };
      });

      let totalPresent = 0;
      let totalAbsent = 0;

      weeklySessions.forEach((session: any) => {
        const isRealSession = session.sessionType === 'حصة أساسية' || session.sessionType === 'حصة تعويضية' || session.sessionType === 'حصة إضافية';
        if (!isRealSession) return;

        (session.records ?? []).forEach((record: any) => {
          const sId = record.studentId;
          if (studentStats[sId]) {
            studentStats[sId].sessionsCount++;
            if (record.attendance === 'حاضر' || record.attendance === 'متأخر' || record.attendance === 'تعويض') {
              studentStats[sId].presentCount++;
              totalPresent++;
            } else if (record.attendance === 'غياب' || record.attendance === 'غائب') {
              studentStats[sId].absentCount++;
              totalAbsent++;
            }

            if (!record.review && (record.memorization === 'ممتاز')) {
              studentStats[sId].excellentCount++;
            }
          }
        });
      });

      // Find Best Student and Most Absent Student
      let bestStudentName = 'لا يوجد';
      let maxExcellent = 0;
      let mostAbsentName = 'لا يوجد';
      let maxAbsences = 0;

      Object.values(studentStats).forEach((stats) => {
        if (stats.excellentCount > maxExcellent && stats.presentCount > 0) {
          maxExcellent = stats.excellentCount;
          bestStudentName = stats.name;
        }
        if (stats.absentCount > maxAbsences) {
          maxAbsences = stats.absentCount;
          mostAbsentName = stats.name;
        }
      });

      const totalRecords = totalPresent + totalAbsent;
      const attendanceRate = totalRecords > 0 ? Math.round((totalPresent / totalRecords) * 100) : 0;

      // Select random advice
      const adviceIndex = Math.floor(Math.random() * EDUCATIONAL_ADVICES.length);
      const weeklyAdvice = EDUCATIONAL_ADVICES[adviceIndex];

      // Generate Sheikh Notification Markdown Content
      const title = `📊 التقرير الأسبوعي لفوجك: ${sheikh.group}`;
      const message = `السلام عليكم ورحمة الله وبركاته يا شيخ **${sheikh.displayName}**، إليك ملخص أداء فوجك للفترة من **${lastWeekStr}** إلى **${todayStr}**:

### 📈 الإحصاءات العامة
* **عدد الحصص المسجلة:** ${weeklySessions.length} حصة.
* **نسبة الحضور للفوج:** ${attendanceRate}%.

### 🌟 تميز الطلاب
* **نجم الأسبوع (الأكثر تميزاً في الحفظ):** ${bestStudentName} ${maxExcellent > 0 ? `(بعدد ${maxExcellent} تقييمات ممتاز)` : ''}.
* **أكثر طالب غياباً:** ${mostAbsentName} ${maxAbsences > 0 ? `(غاب ${maxAbsences} حصص)` : ''}.

### 💡 توجيه الأسبوع التربوي
* ${weeklyAdvice}

بارك الله في جهودكم وكتب أجركم.`;

      // Save notification to sheikh's database
      const notificationRef = ref(db, `users/${sheikh.uid}/notifications`);
      await set(push(notificationRef), {
        title,
        message,
        type: 'report',
        senderId: systemSenderId,
        timestamp: new Date().toISOString(),
        read: false
      });

      weeklySummaryReport.push(`- **فوج ${sheikh.group} (الشيخ: ${sheikh.displayName}):** الحضور: ${attendanceRate}%، نجم الأسبوع: ${bestStudentName}، الغيابات: ${mostAbsentName} (${maxAbsences} غياب).`);
    }

    // 6. Notify Super Admins with a general summary
    if (superAdmins.length > 0) {
      const adminTitle = "📋 ملخص التقارير الأسبوعية للمدرسة";
      const adminMessage = `السلام عليكم ورحمة الله وبركاته، إليكم ملخص تقارير أفواج المدرسة القرآنية للأسبوع الماضي من **${lastWeekStr}** إلى **${todayStr}**:

${weeklySummaryReport.length > 0 ? weeklySummaryReport.join('\n') : 'لا توجد بيانات مسجلة للأسبوع.'}

تم إرسال التقارير الفردية التفصيلية إلى لوحة إشعارات كل شيخ بنجاح.`;

      for (const adminUid of superAdmins) {
        const adminNotificationRef = ref(db, `users/${adminUid}/notifications`);
        await set(push(adminNotificationRef), {
          title: adminTitle,
          message: adminMessage,
          type: 'report',
          senderId: systemSenderId,
          timestamp: new Date().toISOString(),
          read: false
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Weekly report cron job executed successfully.',
      sheikhsNotified: sheikhs.length,
      superAdminsNotified: superAdmins.length
    });

  } catch (error: any) {
    console.error('Error executing weekly report cron job:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error during weekly report execution.'
    }, { status: 500 });
  }
}
