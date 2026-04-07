"use client";

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { db } from '@/lib/firebase';
import { ref as dbRef, onValue, off, get, update } from 'firebase/database';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useStudentContext } from '@/context/StudentContext';
import { useToast } from '@/hooks/use-toast';
import { getYear, getMonth, format, parse, parseISO, eachDayOfInterval, getDay, startOfMonth, endOfMonth } from 'date-fns';
import { ar } from 'date-fns/locale';
import { v4 as uuidv4 } from 'uuid';
import { Checkbox } from '@/components/ui/checkbox';
import * as XLSX from 'xlsx';
import { cn, arabicCompare } from '@/lib/utils';
import { surahs } from '@/lib/surahs';
import { SessionType } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Star,
  Plus,
  ArrowRight,
  ArrowLeft,
  Filter,
  Search,
  CheckCircle2,
  AlertCircle,
  ThumbsUp,
  Clock,
  Printer,
  ChevronRight,
  ChevronLeft,
  Calendar,
  Calendar as CalendarIcon,
  CalendarDays,
  Settings,
  RefreshCw,
  MoreVertical,
  Edit,
  Trash2,
  FileText,
  Share2,
  UserPlus,
  Circle,
  TrendingUp,
  Award,
  BookOpen,
  LayoutGrid,
  List,
  History,
  Info,
  ChevronDown,
  Layout,
  Table,
  Table as TableIcon,
  Download,
  Share,
  Users,
  MessageSquare,
  X,
  PlusCircle,
  CheckCircle,
  UserMinus,
  AlertTriangle,
  MoveHorizontal,
  ThumbsDown,
  Zap,
  Smile,
  XCircle,
  Minus,
  Trophy,
  Loader2,
  Save,
  Dot,
  Sparkles,
  UserCheck,
  Copy
} from "lucide-react";
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ProtectedPage } from '@/components/ui/ProtectedPage';
import { WeeklyOutcomeModal } from '@/components/admin/WeeklyOutcomeModal';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { startOfWeek, addDays, isSameDay } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';


import { SessionCalendar } from '@/components/sessions/SessionCalendar';
import { AttendanceList, AttendanceRecord } from '@/components/sessions/AttendanceList';
import { WeeklyAttendanceTable } from '@/components/sessions/WeeklyAttendanceTable';
import { SessionStatsWidget } from '@/components/sessions/SessionStatsWidget';
import { Admin5MessagesPanel } from '@/components/sessions/Admin5MessagesPanel';
import { WeeklyStatsRow } from '@/components/sessions/WeeklyStatsRow';
import { ParentsSurahProgressView } from '@/components/sessions/ParentsSurahProgressView';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { PerformanceLevel, WeeklyOutcome } from '@/lib/types';

const PERFORMANCE_MAPPING: Record<string, number> = {
  'ممتاز': 5,
  'جيد جداً': 4,
  'جيد جدا': 4,
  'جيد': 3,
  'حسن': 2,
  'مقبول': 2,
  'متوسط': 1,
  'ضعيف': 1,
  'لم يحفظ': 0,
};

const REVERSE_MAPPING: PerformanceLevel[] = [
  'لم يحفظ', // 0
  'متوسط',   // 1
  'حسن',     // 2
  'جيد',     // 3
  'جيد جداً', // 4
  'ممتاز',   // 5
];

const getDerivedWeeklyEvaluation = (records: any[]): PerformanceLevel => {
  // Keeping this helper as it might be useful, but normalization is key
  const validMemos = records
    .map(r => r?.memorization)
    .filter(m => m && (m === 'ممتاز' || m === 'جيد جداً' || m === 'جيد جدا' || m === 'جيد' || m === 'حسن' || m === 'مقبول' || m === 'متوسط' || m === 'ضعيف' || m === 'لم يحفظ'));
  
  if (validMemos.length === 0) return '';
  return '' as PerformanceLevel; // Logic moved to rendering or removed as per user request
};

const pad = (num: number) => num < 10 ? `0${num}` : num.toString();

const toHijri = (date: Date): string => {
  try {
    const hijriDate = new Date(date);
    hijriDate.setDate(hijriDate.getDate() - 1);
    const fmt = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
    const parts = fmt.formatToParts(hijriDate);
    const day = parts.find(p => p.type === 'day')?.value || '';
    const month = parts.find(p => p.type === 'month')?.value || '';
    const year = parts.find(p => p.type === 'year')?.value || '';
    const toWestern = (s: string) => s.replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
    return `${toWestern(day)} ${month} ${toWestern(year)}`;
  } catch {
    return '';
  }
};

export default function DailySessionsPage() {
  const { user, isSuperAdmin } = useAuth();
  const { allUsers, students, dailySessions, loading, getSessionsForDay, addDailySession, deleteDailySession, getSessionById, moveDailySession, weeklyOutcomes } = useStudentContext();

  const { toast } = useToast();
  const router = useRouter();
  const isAdmin5 = user?.email === 'admin5@gmail.com';
  const isManagement = user?.role === 'management';
  const isAdmin00 = user?.email === 'admin00@gmail.com' || user?.email === 'abdallah.shafii@gmail.com';
  const isAdminUser = isSuperAdmin || isAdmin5 || isManagement || isAdmin00;

  // State
  const [currentDate, setCurrentDate] = useState(new Date());
  const [outcomeWeekStart, setOutcomeWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 6 }));
  const [isAddExtraDialogOpen, setIsAddExtraDialogOpen] = useState(false);
  const [extraSessionDate, setExtraSessionDate] = useState('');
  const [extraSessionType, setExtraSessionType] = useState<SessionType>('حصة أساسية');
  const [extraSessionNumber, setExtraSessionNumber] = useState<1 | 2>(1);
  const [selectedSheikhId, setSelectedSheikhId] = useState<string>('');
  const [sessionChoiceData, setSessionChoiceData] = useState<{ day: number, dateStr: string, sessions: any[] } | null>(null);
  const [moveSessionData, setMoveSessionData] = useState<{ sessionId: string, date: string, currentOwnerId: string } | null>(null);
  const [targetSheikhForMove, setTargetSheikhForMove] = useState<string>('');
  const [viewMode, setViewMode] = useState<'calendar' | 'table' | 'parents'>('calendar');
  const [outcomeModalStudent, setOutcomeModalStudent] = useState<any | null>(null);

  // Bulk Holiday State
  const [isBulkHolidayDialogOpen, setIsBulkHolidayDialogOpen] = useState(false);
  const [bulkHolidayStartDate, setBulkHolidayStartDate] = useState('');
  const [bulkHolidayEndDate, setBulkHolidayEndDate] = useState('');
  const [bulkHolidayDays, setBulkHolidayDays] = useState<number[]>([]);
  const [bulkHolidaySheikhs, setBulkHolidaySheikhs] = useState<string[]>([]);
  const [isSubmittingBulk, setIsSubmittingBulk] = useState(false);
  const [isCleaningDB, setIsCleaningDB] = useState(false);

  // State for selected sheikh's sessions loaded directly from Firebase
  const [sheikhSessions, setSheikhSessions] = useState<Record<string, Record<string, any>>>({});
  const [sheikhSessionsLoading, setSheikhSessionsLoading] = useState(false);

  // Load sessions for the selected sheikh directly from Firebase (bypasses context)
  useEffect(() => {
    if (!selectedSheikhId) {
      setSheikhSessions({});
      return;
    }

    // Try to load from cache first for better UX in offline/slow network
    const cachedData = localStorage.getItem(`sessions_cache_${selectedSheikhId}`);
    if (cachedData) {
      try {
        setSheikhSessions(JSON.parse(cachedData));
      } catch (e) {
        console.error("Failed to parse cached sessions", e);
      }
    }

    // If it's the current user, use context sessions directly (no re-fetch needed)
    if (selectedSheikhId === user?.uid && !isAdmin5) {
      setSheikhSessions(dailySessions || {});
      return;
    }

    setSheikhSessionsLoading(true);
    const sessionsRef = dbRef(db, `users/${selectedSheikhId}/dailySessions`);
    const unsubscribe = onValue(sessionsRef, (snapshot) => {
      const data = snapshot.val() || {};
      // Inject ownerId into each session so filters work correctly
      const normalized: Record<string, Record<string, any>> = {};
      Object.entries(data).forEach(([date, sessions]) => {
        normalized[date] = {};
        Object.entries(sessions as Record<string, any>).forEach(([sessionId, session]) => {
          normalized[date][sessionId] = { ...session, ownerId: selectedSheikhId };
        });
      });
      
      setSheikhSessions(normalized);
      // Persist to local cache
      localStorage.setItem(`sessions_cache_${selectedSheikhId}`, JSON.stringify(normalized));
      setSheikhSessionsLoading(false);
    }, () => {
      setSheikhSessionsLoading(false);
    });

    return () => off(sessionsRef, 'value', unsubscribe);
  }, [selectedSheikhId, user?.uid, dailySessions, isAdmin5]);

  // Calculate week dates for Weekly Outcome (Sat-Wed) based on outcomeWeekStart
  const weekDates = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(outcomeWeekStart, i));
  }, [outcomeWeekStart]);

  // Keep outcome week in sync if user navigates large month jumps, but allow independent week tweaking
  React.useEffect(() => {
    if (getMonth(outcomeWeekStart) !== getMonth(currentDate)) {
      setOutcomeWeekStart(startOfWeek(currentDate, { weekStartsOn: 6 }));
    }
  }, [currentDate]);

  const handleOpenBulkHoliday = () => {
    const today = currentDate || new Date();
    setBulkHolidayStartDate(format(startOfMonth(today), 'yyyy-MM-dd'));
    setBulkHolidayEndDate(format(endOfMonth(today), 'yyyy-MM-dd'));
    setBulkHolidayDays([]);
    setBulkHolidaySheikhs([]);
    setIsBulkHolidayDialogOpen(true);
  };

  const handleBulkHolidaySubmit = async () => {
    if (!bulkHolidayStartDate || !bulkHolidayEndDate) {
      toast({ title: "خطأ", description: "يرجى تحديد فترة العطلة", variant: "destructive" });
      return;
    }
    if (bulkHolidayDays.length === 0) {
      toast({ title: "خطأ", description: "يرجى تحديد أيام العطلة", variant: "destructive" });
      return;
    }
    if (bulkHolidaySheikhs.length === 0) {
      toast({ title: "خطأ", description: "يرجى تحديد الأفواج/المشايخ", variant: "destructive" });
      return;
    }

    setIsSubmittingBulk(true);
    try {
      const start = parse(bulkHolidayStartDate, 'yyyy-MM-dd', new Date());
      const end = parse(bulkHolidayEndDate, 'yyyy-MM-dd', new Date());

      const allDays = eachDayOfInterval({ start, end });
      const holidayDates = allDays.filter(d => bulkHolidayDays.includes(getDay(d))).map(d => format(d, 'yyyy-MM-dd'));

      let addedCount = 0;
      for (const targetOwnerId of bulkHolidaySheikhs) {
        for (const dateStr of holidayDates) {
          const sessionsForDate = getSessionsForDay(dateStr);
          const existingSessions = sessionsForDate.filter((s: any) => s.ownerId === targetOwnerId);

          if (existingSessions.some((s: any) => s.sessionType === 'يوم عطلة')) {
            continue;
          }

          const sessionNumber = existingSessions.length > 0 ? (existingSessions.some((s: any) => s.sessionNumber === 1) ? 2 : 1) : 1;

          if (existingSessions.length < 2) {
            await addDailySession({
              id: uuidv4(),
              date: dateStr,
              sessionType: 'يوم عطلة',
              sessionNumber: sessionNumber as 1 | 2,
              ownerId: targetOwnerId,
              teacherAbsenceReason: '',
              substituteTeacher: false,
              records: []
            }, targetOwnerId);
            addedCount++;
          }
        }
      }
      toast({ title: "تم بنجاح", description: `تم تعيين ${addedCount} يوم عطلة للمشايخ المحددين بنجاح.` });
      setIsBulkHolidayDialogOpen(false);
    } catch (error) {
      console.error(error);
      toast({ title: "خطأ", description: "حدث خطأ أثناء تعيين العطل", variant: "destructive" });
    } finally {
      setIsSubmittingBulk(false);
    }
  };

  const handleCleanAbsentRecords = async () => {
    if (!confirm('هل أنت متأكد من تنظيف السجلات القديمة؟ هذا الإجراء سيقوم بحذف بيانات المراجعة والسلوك للطلاب الغائبين في جميع الحصص.')) return;
    setIsCleaningDB(true);
    try {
      const usersRef = dbRef(db, 'users');
      const snapshot = await get(usersRef);
      if (!snapshot.exists()) {
        toast({ title: "تنبيه", description: "لا توجد بيانات." });
        return;
      }

      const updates: any = {};
      let changedRecords = 0;

      const usersData = snapshot.val();
      Object.entries(usersData).forEach(([uid, userData]: [string, any]) => {
        if (userData.dailySessions) {
          Object.entries(userData.dailySessions).forEach(([date, dateSessions]: [string, any]) => {
            Object.entries(dateSessions).forEach(([sessionId, session]: [string, any]) => {
              // Handle records if it's an array
              if (session.records && Array.isArray(session.records)) {
                let sessionModified = false;
                const newRecords = session.records.map((r: any) => {
                  if (r.attendance === 'غائب' || r.attendance === 'غياب') {
                    if (r.review !== false || r.behavior) {
                      sessionModified = true;
                      return { ...r, review: false, behavior: '' };
                    }
                  }
                  return r;
                });

                if (sessionModified) {
                  updates[`users/${uid}/dailySessions/${date}/${sessionId}/records`] = newRecords;
                  changedRecords++;
                }
              }
              // Handle records if it's an object instead of array (sometimes firebase converts arrays to objects if indices are missing)
              else if (session.records && typeof session.records === 'object') {
                let sessionModified = false;
                const newRecords = { ...session.records };
                Object.entries(newRecords).forEach(([idx, r]: [string, any]) => {
                  if (r && (r.attendance === 'غائب' || r.attendance === 'غياب')) {
                    if (r.review !== false || r.behavior) {
                      sessionModified = true;
                      newRecords[idx as keyof typeof newRecords] = { ...r, review: false, behavior: '' };
                    }
                  }
                });
                if (sessionModified) {
                  updates[`users/${uid}/dailySessions/${date}/${sessionId}/records`] = Object.values(newRecords);
                  changedRecords++;
                }
              }
            });
          });
        }
      });

      if (Object.keys(updates).length > 0) {
        await update(dbRef(db), updates);
        toast({ title: "تم بنجاح", description: `تم تصحيح ${changedRecords} حصة.` });
      } else {
        toast({ title: "لا يوجد تغيير", description: "جميع السجلات السابقة صحيحة." });
      }
    } catch (error) {
      console.error(error);
      toast({ title: "خطأ", description: "حدث خطأ أثناء التنظيف", variant: "destructive" });
    } finally {
      setIsCleaningDB(false);
    }
  };

  // Get the selected sheikh's group name for filtering
  const selectedGroupName = useMemo(() => {
    return allUsers?.find(u => u.uid === selectedSheikhId)?.group || '';
  }, [allUsers, selectedSheikhId]);

  // Filtered students for the table view (by selected sheikh's group)
  const filteredStudentsForTable = useMemo(() => {
    if (!students) return [];
    // For superAdmin/management, use selectedGroupName from allUsers
    // For admin5 or regular sheikhs, use user?.group as fallback
    const groupToMatch = selectedGroupName || user?.group || '';
    if (!groupToMatch) return [];
    // Students may have `group` or `groupName` depending on data source
    return students.filter(s => s.status === 'نشط' && ((s as any).group === groupToMatch || s.groupName === groupToMatch))
      .sort((a, b) => arabicCompare(a.fullName, b.fullName));
  }, [students, selectedGroupName, user?.group]);

  const activeStudentsForWeeklyOutcome = useMemo(() => {
    if (!students) return [];
    return filteredStudentsForTable;
  }, [filteredStudentsForTable, students]);

  // Handler for table cell click → navigate to register page
  const handleTableDayClick = (dateStr: string, sessionNumber: number) => {
    const queryParams = new URLSearchParams();
    queryParams.set('date', dateStr);
    queryParams.set('session', sessionNumber.toString());
    if (selectedSheikhId) {
      queryParams.set('ownerId', selectedSheikhId);
    }
    router.push(`/sessions/register?${queryParams.toString()}`);
  };

  // Get all sheikh IDs that belong to the selected group
  const groupSheikhIds = useMemo(() => {
    if (!selectedGroupName || !allUsers) return [];
    return allUsers.filter(u => u.role === 'sheikh' && u.group === selectedGroupName).map(u => u.uid);
  }, [allUsers, selectedGroupName]);

  // Effect to default to first sheikh if none selected and we are admin
  React.useEffect(() => {
    if (isAdminUser && !selectedSheikhId) {
      if (allUsers && allUsers.length > 0) {
        const sheikhs = allUsers.filter(u => u.role === 'sheikh');
        if (sheikhs.length > 0) {
          // Preference: if user is themselves a sheikh (like admin5), default to self
          const self = sheikhs.find(s => s.uid === user?.uid);
          setSelectedSheikhId(self ? self.uid : sheikhs[0].uid);
        }
      } else if (isAdmin5 && user?.uid) {
        // Special case: if admin5 but allUsers isn't aggregated (sheikh role), default to self
        setSelectedSheikhId(user.uid);
      }
    } else if (!isAdminUser && user?.uid && !selectedSheikhId) {
      // For regular sheikhs, always default to self
      setSelectedSheikhId(user.uid);
    }
  }, [isAdminUser, selectedSheikhId, allUsers, user?.uid, isAdmin5]);

  const globalProgress = useMemo(() => {
    if (!isAdminUser || !dailySessions || !selectedSheikhId) return null;

    // Filter sessions strictly by the selected sheikh
    // List and normalize sessions with fallback ownerId
    const allSessions = Object.values(dailySessions).flatMap(day => Object.values(day as Record<string, any>))
      .map(s => ({
        ...s,
        ownerId: s.ownerId || (isManagement || isSuperAdmin ? undefined : user?.uid)
      }));

    const sortedSessions = allSessions
      .filter(s => s.ownerId === selectedSheikhId && s.sessionType === 'حصة أساسية' && s.surahId)
      .sort((a, b) => b.date.localeCompare(a.date));

    const latest = sortedSessions[0];
    if (!latest) return { surahId: 26, fromVerse: 1, toVerse: 1, surahName: 'الشعراء', totalVerses: 227 };

    const surah = surahs.find(s => s.id === latest.surahId);
    return {
      surahId: latest.surahId,
      fromVerse: latest.fromVerse,
      toVerse: latest.toVerse,
      surahName: surah?.name || '',
      totalVerses: surah?.verses || 100
    };
  }, [dailySessions, isAdminUser, selectedSheikhId]);

  // Filter sessions based on selected Group (for Admins) - uses sheikhSessions for admin5
  const filteredGetSessionsForDay = (date: string) => {
    // For admin5 viewing a specific sheikh, use our directly-loaded sessions
    if (isAdmin5 && selectedSheikhId) {
      const daySessions = sheikhSessions[date] ? Object.values(sheikhSessions[date]) : [];
      return daySessions.filter((s: any) => s.ownerId === selectedSheikhId);
    }

    const sessions = getSessionsForDay(date);

    // If a group/sheikh is selected, filter strictly by that group
    if (isAdminUser && groupSheikhIds.length > 0) {
      return sessions.filter(s => s.ownerId && groupSheikhIds.includes(s.ownerId));
    }

    // Strict mode ONLY for full aggregators (management/superAdmin) who haven't selected anything
    if ((isSuperAdmin || isManagement) && !selectedSheikhId) {
      return [];
    }

    // Default: return everything we have (regular sheikhs see their own data only)
    return sessions;
  };

  const selectedSheikhName = useMemo(() => {
    return allUsers?.find(u => u.uid === selectedSheikhId)?.displayName || 'غير محدد';
  }, [allUsers, selectedSheikhId]);

  const handleDayClick = (day: number, sessionNumber?: 1 | 2) => {
    // Safe Date Construction: Set to NOON (12:00) to avoid timezone shifts at midnight
    const newSelectedDay = new Date(getYear(currentDate), getMonth(currentDate), day, 12, 0, 0);
    const dateStr = format(newSelectedDay, 'yyyy-MM-dd');
    const daySessions = filteredGetSessionsForDay(dateStr);

    // Construct URL with ownerId if selected
    const queryParams = new URLSearchParams();
    queryParams.set('date', dateStr);
    if (selectedSheikhId) {
      queryParams.set('ownerId', selectedSheikhId);
    }

    // إذا تم تحديد رقم الحصة مسبقاً (عبر النقر المباشر على ماركة الحصة)
    if (sessionNumber) {
      // التحقق من وجود الحصة الأولى قبل فتح الحصة الثانية
      if (sessionNumber === 2) {
        const session1 = daySessions.find(s => s.sessionNumber === 1);
        if (!session1) {
          toast({
            title: "تنبيه",
            description: "يجب تسجيل الحصة الأولى (الأساسية) قبل فتح الحصة الثانية (الإضافية).",
            variant: "destructive",
          });
          return;
        }
      }
      queryParams.set('session', sessionNumber.toString());
      router.push(`/sessions/register?${queryParams.toString()}`);
      return;
    }

    // إذا لم يتم تحديد رقم الحصة (النقر على الخلية نفسها)
    // نتحقق من عدد الحصص الموجودة
    if (daySessions.length >= 2) {
      setSessionChoiceData({ day, dateStr, sessions: daySessions });
    } else if (daySessions.length === 1) {
      // إذا كانت هناك حصة واحدة فقط، نفتحها مباشرة
      const existingSession = daySessions[0].sessionNumber;
      queryParams.set('session', existingSession.toString());
      router.push(`/sessions/register?${queryParams.toString()}`);
    } else {
      // لا توجد حصص -> نفتح الحصة 1 افتراضياً
      queryParams.set('session', '1');
      router.push(`/sessions/register?${queryParams.toString()}`);
    }
  };

  const handleDeleteSession = (e: React.MouseEvent, sessionId: string, date: string, ownerId?: string) => {
    e.stopPropagation();
    if (confirm("هل أنت متأكد من حذف هذه الحصة نهائياً؟")) {
      deleteDailySession(sessionId, date, ownerId);
      toast({ title: "تم الحذف", description: `تم حذف بيانات الحصة بنجاح.` });
    }
  }

  const handleMoveSession = (e: React.MouseEvent, sessionId: string, date: string, currentOwnerId: string) => {
    e.stopPropagation();
    setMoveSessionData({ sessionId, date, currentOwnerId });
    setTargetSheikhForMove(''); // Reset selection
  };

  const confirmMoveSession = async () => {
    if (!moveSessionData || !targetSheikhForMove) return;

    try {
      await moveDailySession(moveSessionData.sessionId, moveSessionData.date, moveSessionData.currentOwnerId, targetSheikhForMove);
      setMoveSessionData(null);
    } catch (error) {
      console.error(error);
    }
  };

  const handleAddExtraSession = () => {
    if (!extraSessionDate) {
      toast({ title: "خطأ", description: "يرجى اختيار التاريخ", variant: "destructive" });
      return;
    }

    const daySessions = filteredGetSessionsForDay(extraSessionDate);

    // التحقق من عدد الحصص
    if (daySessions.length >= 2) {
      toast({
        title: "تنبيه",
        description: "لا يمكن إضافة أكثر من حصتين في اليوم الواحد.",
        variant: "destructive",
      });
      return;
    }

    // تحديد رقم الحصة المفقودة تلقائياً
    const existingSession1 = daySessions.find(s => s.sessionNumber === 1);
    const sessionNumToOpen = existingSession1 ? 2 : 1;

    // التحقق من وجود الحصة الأولى إذا كان المستخدم يريد إضافة الحصة الثانية
    if (sessionNumToOpen === 2 && !existingSession1) {
      toast({
        title: "تنبيه",
        description: "يجب تسجيل الحصة الأولى (الأساسية) قبل إضافة الحصة الثانية (الإضافية).",
        variant: "destructive",
      });
      return;
    }

    // الانتقال إلى صفحة تسجيل الحصة
    const queryParams = new URLSearchParams();
    queryParams.set('date', extraSessionDate);
    queryParams.set('session', sessionNumToOpen.toString());
    if (selectedSheikhId) {
      queryParams.set('ownerId', selectedSheikhId);
    }
    router.push(`/sessions/register?${queryParams.toString()}`);
    setIsAddExtraDialogOpen(false);
  };

  const handleExportSession = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation(); // Prevent navigation
    const session = getSessionById(sessionId);

    if (!session) {
      toast({ title: "لا توجد بيانات", description: "لا توجد سجلات لهذه الحصة لتصديرها.", variant: "destructive" });
      return;
    }

    const date = parse(session.date, 'yyyy-MM-dd', new Date());
    const dayName = format(date, 'EEEE', { locale: ar });
    const readableDate = format(date, 'dd/MM/yyyy');

    let dataForSheet;

    if (session.sessionType === 'يوم عطلة' || (session.sessionType === 'غياب الشيخ' && !session.substituteTeacher)) {
      dataForSheet = [{
        'التاريخ': readableDate, 'اليوم': dayName,
        'رقم الحصة': session.sessionNumber, 'نوع الحصة': session.sessionType,
        'ملاحظات': session.sessionType === 'غياب الشيخ' ? `سبب الغياب: ${session.teacherAbsenceReason || 'غير محدد'}` : 'يوم عطلة',
      }];
    } else {
      dataForSheet = (session.records ?? []).map((record: any) => {
        const student = (students ?? []).find(s => s.id === record.studentId);
        const isActivity = session.sessionType === 'حصة أنشطة';
        const isAbsent = record.attendance === 'غائب' || record.attendance === 'غياب';
        const baseInfo = {
          'التاريخ': readableDate, 'اليوم': dayName,
          'رقم الحصة': session.sessionNumber, 'نوع الحصة': session.sessionType,
          'اسم الطالب': student?.fullName || 'غير معروف', 'الحاضر': record.attendance || '',
          'السلوك': isAbsent ? '' : (record.behavior || ''),
          'ملاحظات': record.notes || '',
        };

        if (isActivity) {
          return { ...baseInfo, 'نوع النشاط': session.activityType, 'وصف النشاط': session.activityDescription };
        } else {
          const surah = (session.surahId)
            ? surahs.find(s => s.id === session.surahId)
            : (record.surahId ? surahs.find(s => s.id === record.surahId) : null);
          return {
            ...baseInfo,
            'التقييم': record.memorization || '',
            'مراجعة': (!isAbsent && record.review) ? 'نعم' : 'لا',
            'السورة': surah ? surah.name : '',
            'من آية': (session.fromVerse || record.fromVerse) || '',
            'إلى آية': (session.toVerse || record.toVerse) || ''
          };
        }
      });
    }

    const ws = XLSX.utils.json_to_sheet(dataForSheet);
    ws['!cols'] = [
      { wch: 12 }, { wch: 10 }, { wch: 8 }, { wch: 15 }, { wch: 20 }, { wch: 12 }, { wch: 12 },
      { wch: 12 }, { wch: 10 }, { wch: 30 }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `سجل حصة ${session.id}`);
    XLSX.writeFile(wb, `سجل_حصة_${session.id}.xlsx`);
  }

  const handleQuickWhatsApp = () => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const daySessions = filteredGetSessionsForDay(todayStr);
    const session = daySessions.find(s => s.sessionNumber === 1) || daySessions[0];

    if (!session || !session.records || session.records.length === 0) {
      toast({ title: "لا يوجد تقرير", description: "لم يتم تسجيل بيانات لحصة اليوم بعد.", variant: "destructive" });
      return;
    }

    const dayName = format(new Date(), 'EEEE', { locale: ar });
    const gregorianStr = format(new Date(), 'dd-MM-yyyy');
    const hijriStr = toHijri(new Date());

    let message = `السلام عليكم ورحمة الله وبركاته\n`;
    message += hijriStr ? `اليوم ${dayName} ${hijriStr} الموافق لـ : ${gregorianStr}\n` : `اليوم ${dayName} ${gregorianStr}\n`;

    const isCounterStopped = session.isCounterStopped;
    const tasmieSurah = surahs.find(s => s.id === session.tasmieSurahId);
    
    if (isCounterStopped) {
      message += `(العداد موقوف لهذا اليوم)\n`;
    } else if (tasmieSurah) {
      message += `قائمة الطلبة الذين استظهروا ورد التسميع من الآية(${pad(session.tasmieFromVerse || 1)}) إلى الآية(${pad(session.tasmieToVerse || 1)}) من سورة ${tasmieSurah.name} :\n`;
    } else {
      message += 'قائمة الطلبة الذين استظهروا الورد اليومي :\n';
    }

    const sortedActiveStudents = [...students].sort((a, b) => arabicCompare(a.fullName, b.fullName));
    const recited = sortedActiveStudents.filter(s => {
      const rec = session.records.find((r: any) => r.studentId === s.id);
      return rec && (rec.attendance === 'حاضر' || rec.attendance === 'متأخر') && rec.memorization && rec.memorization !== 'لا يوجد';
    });

    if (recited.length > 0) {
      message += recited.map(s => {
        const rec = session.records.find((r: any) => r.studentId === s.id);
        return `*${s.fullName}* : ${rec.memorization}`;
      }).join('\n');
    } else {
      message += 'لا يوجد';
    }

    const late = sortedActiveStudents.filter(s => session.records.find((r: any) => r.studentId === s.id)?.attendance === 'متأخر');
    if (late.length > 0) {
      message += `\n-------------\nقائمة الطلبة المتأخرين:\n${late.map(s => `*${s.fullName}*`).join('\n')}`;
    }

    const absent = sortedActiveStudents.filter(s => {
      const rec = session.records.find((r: any) => r.studentId === s.id);
      return rec?.attendance === 'غياب' || rec?.attendance === 'غائب';
    });
    if (absent.length > 0) {
      message += `\n-------------\nقائمة الطلبة الغائبين:\n${absent.map(s => `*${s.fullName}*`).join('\n')}`;
    }

    navigator.clipboard.writeText(message);
    toast({ title: "تم النسخ", description: "تم نسخ تقرير اليوم بصيغة WhatsApp بنجاح." });
  };


  return (
    <ProtectedPage>
      <ErrorBoundary fallback={<div className="container mx-auto p-12 text-center h-screen flex flex-col items-center justify-center gap-4">
        <AlertTriangle className="h-16 w-16 text-amber-500" />
        <h2 className="text-2xl font-bold">حدث خطأ غير متوقع في صفحة السجلات</h2>
        <p className="text-muted-foreground">يرجى المحاولة مرة أخرى أو التواصل مع الإدارة إذا استمرت المشكلة.</p>
        <Button onClick={() => window.location.reload()}>تحديث الصفحة</Button>
      </div>}>
        <div className="container mx-auto p-4 space-y-8 pb-32 max-w-7xl animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-headline font-bold text-gray-900">سجل الحصص اليومية</h1>
            <p className="text-muted-foreground font-body text-sm sm:text-base hidden sm:block">إدارة الحضور، التقييم، ومتابعة أداء الفوج.</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center w-full sm:w-auto">
            {/* Quick Actions Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-9 gap-2 border-primary/20 bg-primary/5 hover:bg-primary/10 text-primary font-bold transition-all shadow-sm">
                  <Zap className="h-4 w-4 fill-primary" />
                  <span className="hidden sm:inline">إجراءات سريعة</span>
                  <span className="sm:hidden">إجراءات</span>
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 p-1">
                <DropdownMenuItem onClick={handleQuickWhatsApp} className="gap-2 cursor-pointer py-2.5">
                  <MessageSquare className="h-4 w-4 text-green-600" />
                  نسخ تقرير اليوم (WhatsApp)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  const todayStr = format(new Date(), 'yyyy-MM-dd');
                  const daySessions = filteredGetSessionsForDay(todayStr);
                  const session = daySessions.find(s => s.sessionNumber === 1) || daySessions[0];
                  if (session) handleExportSession({ stopPropagation: () => { } } as any, session.id);
                  else toast({ title: "لا يوجد تقرير", description: "لم يتم تسجيل بيانات لحصة اليوم بعد.", variant: "destructive" });
                }} className="gap-2 cursor-pointer py-2.5">
                  <Download className="h-4 w-4 text-blue-600" />
                  تصدير تقرير اليوم (Excel)
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setViewMode(viewMode === 'calendar' ? 'table' : 'calendar')} className="gap-2 cursor-pointer py-2.5">
                  {viewMode === 'calendar' ? <Table className="h-4 w-4 text-purple-600" /> : <LayoutGrid className="h-4 w-4 text-purple-600" />}
                  تبديل طريقة العرض
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {(isSuperAdmin || isManagement || isAdmin00) && (
              <div className="w-full sm:w-56">
                <Select value={selectedSheikhId} onValueChange={setSelectedSheikhId}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="اختر الشيخ" />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Deduplicated and sorted by group number (فوج 1 to فوج 18) */}
                    {allUsers?.filter(u => u.role === 'sheikh')
                      .reduce((acc: any[], sheikh) => {
                        // Deduplicate by group - keep only one sheikh per group
                        const existingGroup = acc.find(s => s.group === sheikh.group);
                        if (!existingGroup) {
                          acc.push(sheikh);
                        }
                        return acc;
                      }, [])
                      .sort((a, b) => {
                        // Extract group number from group name like "فوج 1", "فوج 2", etc.
                        const getGroupNum = (group: string | undefined) => {
                          if (!group) return 999;
                          const match = group.match(/\d+/);
                          return match ? parseInt(match[0], 10) : 999;
                        };
                        return getGroupNum(a.group) - getGroupNum(b.group);
                      })
                      .map(sheikh => (
                        <SelectItem key={sheikh.uid} value={sheikh.uid}>
                          {sheikh.displayName || 'شيخ مجهول'} ({sheikh.group || 'بدون فوج'})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {isAdmin00 && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleOpenBulkHoliday}
                  className="h-9 gap-1.5 text-xs rounded-lg border-sky-200 hover:bg-sky-50 text-sky-700 font-bold"
                >
                  <CalendarDays className="h-4 w-4" />
                  <span className="hidden sm:inline">تعيين عطل جماعية</span>
                </Button>
              </div>
            )}

            {isAdminUser && (
              <div className="flex gap-2">
                {isSuperAdmin && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCleanAbsentRecords}
                    disabled={isCleaningDB}
                    className="h-9 gap-1.5 text-xs rounded-lg border-emerald-200 hover:bg-emerald-50 text-emerald-700 font-bold"
                  >
                    {isCleaningDB ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    <span className="hidden sm:inline">تصحيح الغياب</span>
                  </Button>
                )}
              </div>
            )}

            <div className="hidden sm:flex items-center gap-2 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100">
              <Trophy className="h-4 w-4 text-emerald-600" />
              <span className="font-bold text-emerald-800 font-headline text-sm">الدوري نشط</span>
            </div>

            {/* View Toggle */}
            <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-xl border">
              <Button
                variant={viewMode === 'calendar' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('calendar')}
                className={cn("h-8 gap-1.5 text-xs rounded-lg", viewMode === 'calendar' && "bg-primary text-white shadow-sm")}>
                <CalendarDays className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">تقويم</span>
              </Button>
              <Button
                variant={viewMode === 'table' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('table')}
                className={cn("h-8 gap-1.5 text-xs rounded-lg", viewMode === 'table' && "bg-primary text-white shadow-sm")}>
                <Table className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">جدول</span>
              </Button>
              {isAdmin5 && (
                <Button
                  variant={viewMode === 'parents' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('parents')}
                  className={cn("h-8 gap-1.5 text-xs rounded-lg text-emerald-700", viewMode === 'parents' && "bg-emerald-600 text-white shadow-sm hover:!bg-emerald-700 hover:!text-white")}>
                  <BookOpen className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">متابعة السورة</span>
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Progress Widget - Only for admin5 */}
        {isAdmin5 && selectedSheikhId && globalProgress && viewMode !== 'parents' && (
          <div className="bg-card p-6 rounded-2xl shadow-sm border space-y-4 animate-in fade-in slide-in-from-top-4 duration-1000">
            {/* ... existing progress code ... */}
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-100 rounded-xl text-emerald-700">
                  <BookOpen className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-xl font-headline font-bold">التقدم الحالي في السورة</h2>
                  <p className="text-muted-foreground text-sm font-body">متابعة الحفظ الجماعي للفوج</p>
                </div>
              </div>
              <div className="text-left">
                <span className="text-2xl font-bold text-emerald-600 font-headline">{globalProgress.surahName}</span>
                <p className="text-xs text-muted-foreground">الآية {globalProgress.toVerse} من {globalProgress.totalVerses}</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold text-muted-foreground px-1">
                <span>0%</span>
                <span>{Math.round((globalProgress.toVerse / globalProgress.totalVerses) * 100)}%</span>
                <span>100%</span>
              </div>
              <Progress value={(globalProgress.toVerse / globalProgress.totalVerses) * 100} className="h-3 bg-emerald-50" />
            </div>
          </div>
        )}

        {/* Tab Content Rendering */}
        {viewMode === 'parents' && isAdmin5 && (
          <ParentsSurahProgressView
            dailySessions={isAdmin5 ? sheikhSessions : dailySessions}
            students={activeStudentsForWeeklyOutcome}
            globalProgress={globalProgress}
          />
        )}

        {viewMode === 'calendar' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            <SessionCalendar
              currentDate={currentDate}
              onDateChange={setCurrentDate}
              onDayClick={handleDayClick}
              getSessionsForDay={filteredGetSessionsForDay}
              isSuperAdmin={isSuperAdmin}
              onDeleteSession={handleDeleteSession}
              onExportSession={handleExportSession}
              onMoveSession={handleMoveSession}
            />
          </div>
        )}

        {viewMode === 'table' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {filteredStudentsForTable.length > 0 ? (
              <>
                <WeeklyAttendanceTable
                  students={filteredStudentsForTable}
                  getSessionsForDay={filteredGetSessionsForDay}
                  onDayClick={handleTableDayClick}
                  isAdmin5={isAdmin5}
                  initialDate={currentDate}
                />

                <WeeklyStatsRow
                  students={filteredStudentsForTable}
                  getSessionsForDay={filteredGetSessionsForDay}
                  initialDate={currentDate}
                />

                {isAdmin5 && (
                  <Admin5MessagesPanel
                    students={activeStudentsForWeeklyOutcome}
                    weekDates={weekDates}
                    dailySessions={isAdmin5 ? sheikhSessions : dailySessions}
                    weeklyOutcomes={weeklyOutcomes}
                  />
                )}
              </>
            ) : (
              <div className="text-center py-12 text-slate-400 bg-slate-50 rounded-2xl border-2 border-dashed font-bold">
                <Table className="h-10 w-10 mx-auto mb-2 text-slate-300" />
                <p>لا يوجد طلاب לעرض الجدول، يرجى اختيار الفوج.</p>
              </div>
            )}
          </div>
        )}

        {/* Session Choice Dialog */}
        <Dialog open={!!sessionChoiceData} onOpenChange={() => setSessionChoiceData(null)}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle className="text-xl font-headline">اختر الحصة</DialogTitle>
              <DialogDescription className="font-body">
                هذا اليوم يحتوي على أكثر من حصة مسجلة. اختر الحصة التي تريد تعديلها:
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 gap-3 py-4">
              {sessionChoiceData?.sessions.sort((a, b) => a.sessionNumber - b.sessionNumber).map((session) => (
                <Button
                  key={session.id}
                  variant="outline"
                  className="h-16 rounded-xl flex items-center justify-between px-6 hover:bg-emerald-50 hover:border-emerald-200 transition-all group"
                  onClick={() => {
                    const queryParams = new URLSearchParams();
                    queryParams.set('date', sessionChoiceData.dateStr);
                    queryParams.set('session', session.sessionNumber.toString());
                    if (selectedSheikhId) {
                      queryParams.set('ownerId', selectedSheikhId);
                    }
                    router.push(`/sessions/register?${queryParams.toString()}`);
                    setSessionChoiceData(null);
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-100 rounded-lg text-emerald-700 group-hover:scale-110 transition-transform">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-lg">حصة {session.sessionNumber === 1 ? 'أساسية' : 'إضافية'}</div>
                      <div className="text-xs text-muted-foreground">{session.sessionType}</div>
                    </div>
                  </div>
                  <ChevronLeft className="h-5 w-5 text-muted-foreground group-hover:translate-x-[-4px] transition-transform" />
                </Button>
              ))}
            </div>
          </DialogContent>
        </Dialog>

        {/* Floating Action Button */}
        {(!isAdminUser || selectedSheikhId) && (
          <Button
            onClick={() => setIsAddExtraDialogOpen(true)}
            className="fixed bottom-8 left-8 h-16 w-16 rounded-full shadow-2xl z-50 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 transition-all duration-300 hover:scale-110"
            size="icon"
          >
            <Plus className="h-8 w-8" />
          </Button>
        )}

        {/* Add Extra Session Dialog */}
        <Dialog open={isAddExtraDialogOpen} onOpenChange={setIsAddExtraDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="text-2xl font-headline">إضافة حصة إضافية</DialogTitle>
              <DialogDescription className="font-body">
                اختر التاريخ ونوع الحصة ورقم الحصة لإضافة حصة جديدة للفوج.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Date Selection */}
              <div className="space-y-2">
                <Label htmlFor="extra-date" className="text-base font-semibold flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  التاريخ
                </Label>
                <Input
                  id="extra-date"
                  type="date"
                  value={extraSessionDate}
                  onChange={(e) => setExtraSessionDate(e.target.value)}
                  className="text-right"
                />
              </div>

              {/* Session Type Selection */}
              <div className="space-y-2">
                <Label htmlFor="extra-type" className="text-base font-semibold">نوع الحصة</Label>
                <Select value={extraSessionType} onValueChange={(value) => setExtraSessionType(value as SessionType)}>
                  <SelectTrigger id="extra-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="حصة أساسية">حصة أساسية</SelectItem>
                    <SelectItem value="حصة أنشطة">حصة أنشطة</SelectItem>
                    <SelectItem value="حصة إضافية">حصة إضافية</SelectItem>
                    <SelectItem value="غياب الشيخ">غياب الشيخ</SelectItem>
                    <SelectItem value="يوم عطلة">يوم عطلة</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Session Number Auto Selection Info */}
              <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-emerald-600 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-emerald-900 text-sm">التحديد التلقائي لرقم الحصة</p>
                  <p className="text-xs text-emerald-700 leading-relaxed font-body">
                    سيقوم النظام تلقائياً بفتح "الحصة الثانية" إذا كانت الحصة الأساسية مسجلة مسبقاً، أو "الحصة الأولى" إذا لم يتم تسجيل أي حصة بعد.
                  </p>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddExtraDialogOpen(false)}>
                إلغاء
              </Button>
              <Button onClick={handleAddExtraSession} className="bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600">
                <Plus className="ml-2 h-4 w-4" />
                إضافة الحصة
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Bulk Holiday Dialog */}
        <Dialog open={isBulkHolidayDialogOpen} onOpenChange={setIsBulkHolidayDialogOpen}>
          <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl font-headline text-sky-700 flex items-center gap-2">
                <CalendarDays className="h-6 w-6" />
                تعيين عطل جماعية
              </DialogTitle>
              <DialogDescription className="font-body">
                قم بتحديد المشايخ وأيام الأسبوع لتسجيلها كأيام عطلة بشكل تلقائي خلال الفترة المحددة.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>من تاريخ</Label>
                  <Input type="date" value={bulkHolidayStartDate} onChange={e => setBulkHolidayStartDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>إلى تاريخ</Label>
                  <Input type="date" value={bulkHolidayEndDate} onChange={e => setBulkHolidayEndDate(e.target.value)} />
                </div>
              </div>

              <div className="space-y-3">
                <Label>أيام العطلة المستهدفة</Label>
                <div className="flex flex-wrap gap-2">
                  {[{ id: 6, label: 'السبت' }, { id: 0, label: 'الأحد' }, { id: 1, label: 'الاثنين' }, { id: 2, label: 'الثلاثاء' }, { id: 3, label: 'الأربعاء' }, { id: 4, label: 'الخميس' }, { id: 5, label: 'الجمعة' }].map(day => (
                    <Button
                      key={day.id}
                      type="button"
                      variant={bulkHolidayDays.includes(day.id) ? "default" : "outline"}
                      className={cn("h-8 rounded-full px-4 text-xs font-bold", bulkHolidayDays.includes(day.id) && "bg-sky-600 text-white hover:bg-sky-700")}
                      onClick={() => setBulkHolidayDays(prev => prev.includes(day.id) ? prev.filter(d => d !== day.id) : [...prev, day.id])}
                    >
                      {day.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Label>المشايخ / الأفواج المعنية</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-sky-600 font-bold"
                    onClick={() => {
                      const visibleSheikhIds = allUsers?.filter(u => u.role === 'sheikh')
                        .reduce((acc: any[], sheikh) => {
                          if (!acc.find(s => s.group === sheikh.group)) acc.push(sheikh);
                          return acc;
                        }, [])
                        .map(u => u.uid) || [];
                      setBulkHolidaySheikhs(bulkHolidaySheikhs.length === visibleSheikhIds.length ? [] : visibleSheikhIds);
                    }}
                  >
                    تحديد الكل / إلغاء
                  </Button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 bg-slate-50 rounded-xl border p-2 max-h-[220px] overflow-y-auto">
                  {allUsers?.filter(u => u.role === 'sheikh')
                    .reduce((acc: any[], sheikh) => {
                      // Deduplicate by group - keep only one sheikh per group as requested
                      const existingGroup = acc.find(s => s.group === sheikh.group);
                      if (!existingGroup) {
                        acc.push(sheikh);
                      }
                      return acc;
                    }, [])
                    .sort((a, b) => {
                      // Extract group number from group name like "فوج 1", "فوج 2", etc.
                      const getGroupNum = (group: string | undefined) => {
                        if (!group) return 999;
                        const match = group.match(/\d+/);
                        return match ? parseInt(match[0], 10) : 999;
                      };
                      return getGroupNum(a.group) - getGroupNum(b.group);
                    })
                    .map((sheikh: any) => (
                      <div
                        key={sheikh.uid}
                        className={cn(
                          "flex items-center space-x-2 space-x-reverse bg-white p-2 rounded-lg border shadow-sm cursor-pointer hover:border-sky-300 transition-colors",
                          bulkHolidaySheikhs.includes(sheikh.uid) && "border-sky-500 bg-sky-50"
                        )}
                        onClick={() => setBulkHolidaySheikhs(prev => prev.includes(sheikh.uid) ? prev.filter(id => id !== sheikh.uid) : [...prev, sheikh.uid])}
                      >
                        <Checkbox
                          id={`sh-${sheikh.uid}`}
                          checked={bulkHolidaySheikhs.includes(sheikh.uid)}
                          onCheckedChange={(checked) => {
                            if (checked) setBulkHolidaySheikhs(prev => [...prev, sheikh.uid]);
                            else setBulkHolidaySheikhs(prev => prev.filter(id => id !== sheikh.uid));
                          }}
                        />
                        <label htmlFor={`sh-${sheikh.uid}`} className="text-xs font-bold cursor-pointer flex-1 truncate">{sheikh.group || 'بدون فوج'}</label>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsBulkHolidayDialogOpen(false)}>إلغاء</Button>
              <Button onClick={handleBulkHolidaySubmit} disabled={isSubmittingBulk} className="bg-sky-600 hover:bg-sky-700 text-white flex items-center gap-2">
                {isSubmittingBulk ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {isSubmittingBulk ? "جاري التعيين..." : "تأكيد وتعيين العطل"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Move Session Dialog */}
        <Dialog open={!!moveSessionData} onOpenChange={(open) => !open && setMoveSessionData(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>نقل الحصة إلى شيخ آخر</DialogTitle>
              <DialogDescription>
                اختر الشيخ الذي تريد نقل هذه الحصة إلى سجله. سيتم حذف الحصة من السجل الحالي وإضافتها للسجل الجديد.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>اختر الشيخ المستهدف</Label>
                <Select value={targetSheikhForMove} onValueChange={setTargetSheikhForMove}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر الشيخ..." />
                  </SelectTrigger>
                  <SelectContent>
                    {allUsers?.filter(u => u.role === 'sheikh').map(sheikh => (
                      <SelectItem key={sheikh.uid} value={sheikh.uid}>
                        {sheikh.displayName} ({sheikh.group})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setMoveSessionData(null)}>إلغاء</Button>
              <Button onClick={confirmMoveSession} disabled={!targetSheikhForMove} className="bg-blue-600 hover:bg-blue-700 text-white">
                تأكيد النقل
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Weekly Outcome Table - Admin5 Only */}
      {isAdmin5 && (
        <div className="container mx-auto p-4 max-w-7xl">
          <Card className="border-2 border-purple-200 shadow-lg mt-8">
            <CardHeader className="bg-purple-50/50 flex flex-row items-center justify-between pb-4">
              <CardTitle className="text-purple-800 flex items-center gap-2">
                <Star className="h-5 w-5 fill-purple-600 text-purple-600" />
                جدول الحصيلة الأسبوعية
              </CardTitle>
              <div className="flex items-center gap-2" dir="ltr">
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setOutcomeWeekStart(prev => addDays(prev, 7))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <div className="text-sm font-bold text-purple-900 bg-white px-3 py-1 rounded-md border min-w-[120px] text-center shadow-sm">
                  {format(weekDates[0], 'dd MMM', { locale: ar })} - {format(weekDates[6], 'dd MMM', { locale: ar })}
                </div>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setOutcomeWeekStart(prev => addDays(prev, -7))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="rounded-md border m-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                      <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground w-[30%]">الطالب</th>
                      <th className="h-12 px-4 text-center align-middle font-medium text-muted-foreground w-[30%]">التفقد اليومي (السبت - الجمعة)</th>
                      <th className="h-12 px-4 text-center align-middle font-medium text-muted-foreground w-[20%]">التقييم الأسبوعي</th>
                      <th className="h-12 px-4 text-center align-middle font-medium text-muted-foreground w-[20%]">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeStudentsForWeeklyOutcome.map((student) => {
                      const weekStartStr = format(weekDates[0], 'yyyy-MM-dd');
                      const outcomeId = `${student.id}_${weekStartStr}`;
                      const outcome = weeklyOutcomes[outcomeId];

                      // Calculate daily status dots
                      const days = weekDates.slice(0, 7); // Sat to Fri

                      return (
                        <tr key={student.id} className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                          <td className="p-4 align-middle font-medium">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-9 w-9 border">
                                <AvatarImage src={student.photoUrl} alt={student.fullName} />
                                <AvatarFallback>{student.fullName.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}</AvatarFallback>
                              </Avatar>
                              <div className="flex flex-col">
                                <span>{student.fullName}</span>
                                <span className="text-xs text-muted-foreground">{student.groupName}</span>
                              </div>
                            </div>
                          </td>
                          <td className="p-4 align-middle">
                            <div className="flex gap-1 justify-center flex-wrap">
                              {days.map((day) => {
                                const dateStr = format(day, 'yyyy-MM-dd');
                                const daySessions = isAdmin5 ? (sheikhSessions[dateStr] ? Object.values(sheikhSessions[dateStr]) : []) : (dailySessions[dateStr] ? Object.values(dailySessions[dateStr] as Record<string, any>) : []);
                                const session1 = (daySessions as any[]).find((s: any) => s.sessionNumber === 1);
                                const record = session1?.records?.find((r: any) => r.studentId === student.id);
                                const attendance = record?.attendance;
                                const dotColor = attendance === 'حاضر' ? 'bg-emerald-500' : attendance === 'غائب' || attendance === 'غياب' ? 'bg-red-400' : attendance === 'متأخر' ? 'bg-amber-400' : session1?.sessionType === 'يوم عطلة' ? 'bg-sky-300' : 'bg-gray-200';
                                return (
                                  <TooltipProvider key={dateStr}>
                                    <Tooltip>
                                      <TooltipTrigger>
                                        <div className={`h-3 w-3 rounded-full ${dotColor}`} />
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p className="text-xs font-bold">{format(day, 'EEE dd/MM', { locale: ar })}</p>
                                        <p className="text-[10px]">{attendance || (session1?.sessionType === 'يوم عطلة' ? 'عطلة' : 'لم يسجل')}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                );
                              })}
                            </div>
                          </td>
                          <td className="p-4 align-middle text-center">
                            {outcome && outcome.evaluation ? (
                              <div className={cn(
                                "flex items-center justify-center gap-2 rounded-full py-1 px-3 w-fit mx-auto border shadow-sm transition-all",
                                outcome.evaluation === 'ممتاز' ? "bg-green-100 text-green-700 border-green-200" :
                                  (outcome.evaluation === 'جيد جداً' || outcome.evaluation === 'جيد جدا') ? "bg-blue-100 text-blue-700 border-blue-200" :
                                    outcome.evaluation === 'جيد' ? "bg-cyan-100 text-cyan-700 border-cyan-200" :
                                      outcome.evaluation === 'حسن' ? "bg-yellow-100 text-yellow-700 border-yellow-200" :
                                        "bg-red-100 text-red-700 border-red-200"
                              )}>
                                <span className="text-lg">
                                  {outcome.evaluation === 'ممتاز' ? '🌟' :
                                    (outcome.evaluation === 'جيد جداً' || outcome.evaluation === 'جيد جدا') ? '⭐' :
                                      outcome.evaluation === 'جيد' ? '👍' :
                                        outcome.evaluation === 'حسن' ? '👌' :
                                          outcome.evaluation === 'متوسط' ? '⚠️' : '❌'}
                                </span>
                                <div className="flex flex-col items-start leading-none">
                                  <span className="font-bold text-xs">{outcome.evaluation}</span>
                                </div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-xs italic">لم يقيم بعد</span>
                            )}
                          </td>
                          <td className="p-4 align-middle text-center">
                            <Button
                              size="sm"
                              variant={outcome && outcome.evaluation ? "ghost" : "default"}
                              onClick={() => setOutcomeModalStudent(student)}
                              className={cn("gap-2 text-xs", !(outcome && outcome.evaluation) && "bg-purple-600 hover:bg-purple-700 shadow-md")}
                            >
                              <Star className="h-3 w-3" />
                              {outcome && outcome.evaluation ? 'تعديل' : 'تقييم'}
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Admin5 WhatsApp Messages Panel */}
          {isAdmin5 && selectedSheikhId && (
            <Admin5MessagesPanel
              dailySessions={sheikhSessions}
              students={activeStudentsForWeeklyOutcome}
              weekDates={weekDates}
              weeklyOutcomes={weeklyOutcomes}
            />
          )}
        </div>
      )}

      {outcomeModalStudent && (
        <WeeklyOutcomeModal
          isOpen={!!outcomeModalStudent}
          onClose={() => setOutcomeModalStudent(null)}
          student={outcomeModalStudent}
          weekStartDate={weekDates[0]}
          currentOutcome={weeklyOutcomes[`${outcomeModalStudent.id}_${format(weekDates[0], 'yyyy-MM-dd')}`]}
        />
      )}
  </ErrorBoundary>
</ProtectedPage >
  );
}
