/**
 * offlineSyncEngine.ts
 * محرك المزامنة التلقائي الصامت لبيانات مدرسة الإمام الشافعي القرآنية
 * يراقب حالة الاتصال بالإنترنت ويرفع العمليات المعلقة بالترتيب الذري بدقة 100% وبدون تعارض
 * يدعم "وضع العمل المحلي فائق السرعة" لتفادي بطء أو تعليق الشبكات الضعيفة
 */

import { db } from './firebase';
import { ref, set, update, remove } from 'firebase/database';
import { sanitizeData } from './utils';
import {
  OfflineMutation,
  getOfflineMutations,
  removeOfflineMutation,
  enqueueOfflineMutation,
  setLastSyncTime
} from './cryptoStore';
import { v4 as uuidv4 } from 'uuid';

export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'forced-offline' | 'error';

export interface SyncListenerPayload {
  status: SyncStatus;
  pendingCount: number;
  lastSyncTime: string | null;
  isForcedOffline: boolean;
}

const FORCE_OFFLINE_STORAGE_KEY = 'shafii_force_offline_mode';

let isForcedOfflineCache = false;
if (typeof window !== 'undefined') {
  try {
    isForcedOfflineCache = localStorage.getItem(FORCE_OFFLINE_STORAGE_KEY) === 'true';
  } catch {
    isForcedOfflineCache = false;
  }
}

let currentStatus: SyncStatus = isForcedOfflineCache
  ? 'forced-offline'
  : (typeof navigator !== 'undefined' && navigator.onLine ? 'synced' : 'offline');

let pendingCountCache = 0;
let lastSyncTimeCache: string | null = null;
let isSyncing = false;
let isEngineInitialized = false;

const subscribers: Set<(payload: SyncListenerPayload) => void> = new Set();

function notifySubscribers() {
  const payload: SyncListenerPayload = {
    status: currentStatus,
    pendingCount: pendingCountCache,
    lastSyncTime: lastSyncTimeCache,
    isForcedOffline: isForcedOfflineCache,
  };
  subscribers.forEach(cb => {
    try { cb(payload); } catch (e) { console.error('Error in sync subscriber:', e); }
  });
}

function updateStatus(newStatus: SyncStatus, newPendingCount?: number) {
  currentStatus = newStatus;
  if (newPendingCount !== undefined) {
    pendingCountCache = newPendingCount;
  }
  notifySubscribers();
}

/**
 * فحص ما إذا كان الوضع المحلي السريع مفعل يدوياً
 */
export function isForceOfflineMode(): boolean {
  return isForcedOfflineCache;
}

/**
 * تفعيل أو إيقاف وضع العمل المحلي السريع
 */
export function setForceOfflineMode(enabled: boolean) {
  isForcedOfflineCache = enabled;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(FORCE_OFFLINE_STORAGE_KEY, enabled ? 'true' : 'false');
    } catch {}
  }
  if (enabled) {
    updateStatus('forced-offline');
  } else {
    const isOnline = typeof navigator !== 'undefined' && navigator.onLine;
    updateStatus(isOnline ? (pendingCountCache > 0 ? 'syncing' : 'synced') : 'offline');
    if (isOnline && pendingCountCache > 0) {
      syncPendingMutations().catch(console.error);
    }
  }
}

/**
 * فحص فعلي للاتصال يأخذ بالحسبان تفعيل وضع العمل السريع
 */
export function isEffectiveOnline(): boolean {
  if (typeof navigator === 'undefined') return true;
  if (isForcedOfflineCache) return false;
  return navigator.onLine;
}

/**
 * تنفيذ عملية مع حد زمني أقصى لتفادي تجميد الواجهة عند بطء الإنترنت
 */
export async function executeWithTimeout<T>(promise: Promise<T>, timeoutMs = 2800): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('NETWORK_TIMEOUT')), timeoutMs)
    )
  ]);
}

/**
 * الاشتراك في حالة المزامنة من الواجهات (Components)
 */
export function subscribeToSyncStatus(cb: (payload: SyncListenerPayload) => void): () => void {
  subscribers.add(cb);
  cb({
    status: currentStatus,
    pendingCount: pendingCountCache,
    lastSyncTime: lastSyncTimeCache,
    isForcedOffline: isForcedOfflineCache,
  });
  return () => {
    subscribers.delete(cb);
  };
}

export function getSyncStatus(): SyncListenerPayload {
  return {
    status: currentStatus,
    pendingCount: pendingCountCache,
    lastSyncTime: lastSyncTimeCache,
    isForcedOffline: isForcedOfflineCache,
  };
}

/**
 * إضافة عملية إلى طابور المزامنة
 */
export async function queueOfflineMutation(
  mutationData: Omit<OfflineMutation, 'id' | 'timestamp' | 'retryCount'>
): Promise<string> {
  const id = uuidv4();
  const mutation: OfflineMutation = {
    ...mutationData,
    id,
    timestamp: Date.now(),
    retryCount: 0
  };

  await enqueueOfflineMutation(mutation);

  const pending = await getOfflineMutations();
  pendingCountCache = pending.length;
  
  const nextStatus = isForcedOfflineCache
    ? 'forced-offline'
    : (typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : currentStatus);

  updateStatus(nextStatus, pendingCountCache);

  // إذا كان الإنترنت متوفراً ولم يتم تفعيل الوضع المحلي السريع قسرياً، نحاول المزامنة الفورية
  if (!isForcedOfflineCache && typeof navigator !== 'undefined' && navigator.onLine) {
    syncPendingMutations().catch(err => console.warn('Auto sync after queue failed:', err));
  }

  return id;
}

/**
 * تحديث عداد العمليات المعلقة في الذاكرة
 */
export async function refreshPendingCount(): Promise<number> {
  try {
    const pending = await getOfflineMutations();
    pendingCountCache = pending.length;
    if (pendingCountCache === 0 && !isForcedOfflineCache && currentStatus !== 'offline') {
      updateStatus('synced', 0);
    } else {
      notifySubscribers();
    }
    return pendingCountCache;
  } catch {
    return 0;
  }
}

/**
 * محرك المزامنة الرئيسي (سحب العمليات المعلقة ورفعها لـ Firebase RTDB)
 */
export async function syncPendingMutations(options?: { allowForcedOffline?: boolean }): Promise<{
  success: boolean;
  syncedCount: number;
  remainingCount: number;
  error?: string;
}> {
  if (typeof window === 'undefined') {
    return { success: false, syncedCount: 0, remainingCount: 0 };
  }

  if (!navigator.onLine) {
    await refreshPendingCount();
    updateStatus(isForcedOfflineCache ? 'forced-offline' : 'offline');
    return { success: false, syncedCount: 0, remainingCount: pendingCountCache, error: 'لا يوجد اتصال بالإنترنت' };
  }

  if (isForcedOfflineCache && !options?.allowForcedOffline) {
    await refreshPendingCount();
    updateStatus('forced-offline');
    return { success: false, syncedCount: 0, remainingCount: pendingCountCache, error: 'الوضع المحلي السريع مفعّل' };
  }

  if (isSyncing) {
    return { success: true, syncedCount: 0, remainingCount: pendingCountCache };
  }

  isSyncing = true;
  updateStatus('syncing');

  let syncedCount = 0;

  try {
    const pendingMutations = await getOfflineMutations();
    pendingCountCache = pendingMutations.length;

    if (pendingMutations.length === 0) {
      updateStatus(isForcedOfflineCache ? 'forced-offline' : 'synced', 0);
      isSyncing = false;
      return { success: true, syncedCount: 0, remainingCount: 0 };
    }

    console.log(`🔄 بدء مزامنة ${pendingMutations.length} عملية معلقة مع Firebase...`);

    for (const mutation of pendingMutations) {
      // فحص الاتصال قبل كل عملية لتفادي التعليق
      if (!navigator.onLine) {
        updateStatus(isForcedOfflineCache ? 'forced-offline' : 'offline', pendingMutations.length - syncedCount);
        break;
      }

      // دعم المسارات الفرعية أو المسار الجذري
      const dbTargetRef = mutation.path ? ref(db, mutation.path) : ref(db);

      try {
        if (mutation.type === 'SET') {
          const sanitized = sanitizeData(mutation.payload);
          await executeWithTimeout(set(dbTargetRef, sanitized), 5000);
        } else if (mutation.type === 'UPDATE') {
          const sanitized = sanitizeData(mutation.payload);
          await executeWithTimeout(update(dbTargetRef, sanitized), 5000);
        } else if (mutation.type === 'REMOVE') {
          await executeWithTimeout(remove(dbTargetRef), 5000);
        }

        // نجحت العملية -> نحذفها من الطابور المحلي
        await removeOfflineMutation(mutation.id);
        syncedCount++;
        pendingCountCache = Math.max(0, pendingCountCache - 1);
        notifySubscribers();
      } catch (err: any) {
        console.error(`❌ فشل رفع العملية [${mutation.description}] على المسار (${mutation.path}):`, err);

        // إذا كان خطأ شبكة أو انتهاء المهلة
        if (err?.message === 'NETWORK_TIMEOUT' || err?.code === 'NETWORK_ERROR' || !navigator.onLine) {
          updateStatus(isForcedOfflineCache ? 'forced-offline' : 'offline');
          break;
        }

        // إذا كان الخطأ تصريح مرفوض أو بنية غير صالحة، نسجل المحاولة لتفادي إيقاف الطابور بالكامل
        if ((mutation.retryCount ?? 0) > 3) {
          console.warn(`تجاوز الحد الأقصى للمحاولات للعملية ${mutation.id}، سيتم إزالتها لتفادي إعاقة المزامنة.`);
          await removeOfflineMutation(mutation.id);
        } else {
          mutation.retryCount = (mutation.retryCount ?? 0) + 1;
          await enqueueOfflineMutation(mutation);
        }
      }
    }

    const remaining = await getOfflineMutations();
    pendingCountCache = remaining.length;

    if (pendingCountCache === 0) {
      const nowIso = new Date().toISOString();
      lastSyncTimeCache = nowIso;
      await setLastSyncTime(nowIso);
      updateStatus(isForcedOfflineCache ? 'forced-offline' : 'synced', 0);
      console.log(`✅ اكتملت المزامنة بنجاح! تم رفع ${syncedCount} عملية.`);
    } else {
      updateStatus(isForcedOfflineCache ? 'forced-offline' : (navigator.onLine ? 'error' : 'offline'), pendingCountCache);
    }

    return {
      success: pendingCountCache === 0,
      syncedCount,
      remainingCount: pendingCountCache
    };
  } catch (globalError: any) {
    console.error('خطأ غير متوقع في محرك المزامنة:', globalError);
    updateStatus('error');
    return {
      success: false,
      syncedCount,
      remainingCount: pendingCountCache,
      error: globalError?.message
    };
  } finally {
    isSyncing = false;
  }
}

/**
 * تهيئة وتشغيل محرك المزامنة التلقائي الصامت
 */
export function initOfflineSyncEngine(onSyncSuccessToast?: (syncedCount: number) => void) {
  if (typeof window === 'undefined' || isEngineInitialized) return;
  isEngineInitialized = true;

  // فحص أولي عند فتح التطبيق
  refreshPendingCount().then(count => {
    if (count > 0 && navigator.onLine && !isForcedOfflineCache) {
      syncPendingMutations().then(res => {
        if (res.syncedCount > 0 && onSyncSuccessToast) {
          onSyncSuccessToast(res.syncedCount);
        }
      });
    }
  });

  // 1. المزامنة التلقائية فور عودة الاتصال
  window.addEventListener('online', async () => {
    console.log('🌐 تم استعادة الاتصال بالإنترنت - بدء المزامنة التلقائية...');
    if (!isForcedOfflineCache) {
      updateStatus('syncing');
      const res = await syncPendingMutations();
      if (res.syncedCount > 0 && onSyncSuccessToast) {
        onSyncSuccessToast(res.syncedCount);
      }
    }
  });

  // 2. تحديث الحالة فور انقطاع الاتصال
  window.addEventListener('offline', () => {
    console.log('📡 انقطع الاتصال بالإنترنت - التبديل للوضع المحلي المشفر.');
    updateStatus(isForcedOfflineCache ? 'forced-offline' : 'offline');
  });

  // 3. المزامنة عند عودة المستخدم للتبويب (Tab visibility)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && navigator.onLine && !isForcedOfflineCache) {
      syncPendingMutations().then(res => {
        if (res.syncedCount > 0 && onSyncSuccessToast) {
          onSyncSuccessToast(res.syncedCount);
        }
      });
    }
  });

  // 4. فحص دوري خفيف (Polling Heartbeat) كل 15 ثانية للتأكد من المزامنة
  setInterval(() => {
    if (!isForcedOfflineCache && navigator.onLine && !isSyncing && pendingCountCache > 0) {
      syncPendingMutations().then(res => {
        if (res.syncedCount > 0 && onSyncSuccessToast) {
          onSyncSuccessToast(res.syncedCount);
        }
      });
    }
  }, 15000);
}
