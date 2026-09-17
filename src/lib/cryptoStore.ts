/**
 * cryptoStore.ts
 * محرك التشفير المحلي بمستوى عسكري AES-256-GCM وقاعدة بيانات IndexedDB
 * يوفر تشفيراً حقيقياً وسريعاً جداً ومقاوم للعبث لبيانات مدرسة الإمام الشافعي القرآنية
 * متوافق ومستوحى من معمارية مشروعي "أبواب الريدو" و"التاجر الذكي"
 */

export interface OfflineMutation {
  id: string;               // معرف فريد للعملية
  type: 'SET' | 'UPDATE' | 'REMOVE';
  path: string;             // مسار Firebase RTDB (مثل: users/{uid}/dailySessions/{date}/{sessionId})
  payload?: any;            // البيانات المرسلة
  timestamp: number;        // وقت الإجراء بالمللي ثانية
  description: string;      // وصف مقروء للمستخدم (مثال: "تسجيل حصة 2026-09-17")
  ownerId: string;          // صاحب البيانات أو الفوج
  authorUid?: string;       // منفذ العملية (الشيخ أو الإداري)
  retryCount?: number;      // عدد محاولات الرفع الفاشلة
}

const DB_NAME = 'ShafiiOfflineDB_v1';
const DB_VERSION = 1;

export const STORES = {
  ENCRYPTED_DATA: 'encrypted_data',
  MUTATION_QUEUE: 'mutation_queue',
  META: 'meta',
} as const;

let dbHandle: IDBDatabase | null = null;
let cachedCryptoKey: CryptoKey | null = null;

/**
 * فتح اتصال قاعدة بيانات IndexedDB
 */
export async function openDB(): Promise<IDBDatabase> {
  if (typeof window === 'undefined') {
    throw new Error('IndexedDB is only available in the browser');
  }

  if (dbHandle) return dbHandle;

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e: any) => {
      const d: IDBDatabase = e.target.result;
      if (!d.objectStoreNames.contains(STORES.ENCRYPTED_DATA)) {
        d.createObjectStore(STORES.ENCRYPTED_DATA, { keyPath: 'key' });
      }
      if (!d.objectStoreNames.contains(STORES.MUTATION_QUEUE)) {
        const queueStore = d.createObjectStore(STORES.MUTATION_QUEUE, { keyPath: 'id' });
        queueStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
      if (!d.objectStoreNames.contains(STORES.META)) {
        d.createObjectStore(STORES.META, { keyPath: 'key' });
      }
    };

    req.onsuccess = (e: any) => {
      dbHandle = e.target.result as IDBDatabase;
      dbHandle.onclose = () => { dbHandle = null; };
      resolve(dbHandle);
    };

    req.onerror = () => reject(req.error);
  });
}

// ─── دوال التعامل المباشر مع IndexedDB ──────────────────────────────────────────

async function idbGet(storeName: string, key: string): Promise<any> {
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(storeName: string, record: any): Promise<void> {
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function idbDelete(storeName: string, key: string): Promise<void> {
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function idbGetAll<T>(storeName: string): Promise<T[]> {
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

// ─── إدارة مفاتيح التشفير AES-256-GCM عبر Web Crypto API ───────────────────────

async function getOrCreateCryptoKey(): Promise<CryptoKey> {
  if (cachedCryptoKey) return cachedCryptoKey;
  await openDB();

  const saved = await idbGet(STORES.META, 'crypto_key_jwk');
  if (saved && saved.value) {
    try {
      cachedCryptoKey = await crypto.subtle.importKey(
        'jwk',
        saved.value,
        { name: 'AES-GCM' },
        false,
        ['encrypt', 'decrypt']
      );
      return cachedCryptoKey;
    } catch (err) {
      console.warn('Failed to import existing crypto key, generating a fresh one:', err);
    }
  }

  // إنشاء مفتاح تشفير 256-bit أصيل
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  const jwk = await crypto.subtle.exportKey('jwk', key);
  await idbSet(STORES.META, { key: 'crypto_key_jwk', value: jwk });

  cachedCryptoKey = key;
  return key;
}

/**
 * تشفير كائن JSON إلى بيانات ثنائية باستخدام AES-GCM
 */
async function encryptData(plainObject: any): Promise<{ iv: ArrayBuffer; ciphertext: ArrayBuffer; version: string }> {
  const key = await getOrCreateCryptoKey();
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit standard IV for AES-GCM
  const encoded = new TextEncoder().encode(JSON.stringify(plainObject));

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  );

  return {
    iv: iv.buffer,
    ciphertext: ciphertext,
    version: '1.0'
  };
}

/**
 * فك تشفير بيانات ثنائية إلى كائن JSON
 */
async function decryptData(encryptedBlob: any): Promise<any> {
  const key = await getOrCreateCryptoKey();
  const iv = new Uint8Array(encryptedBlob.iv);
  const ciphertext = new Uint8Array(encryptedBlob.ciphertext);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );

  const decodedStr = new TextDecoder().decode(decrypted);
  return JSON.parse(decodedStr);
}

// ─── واجهات التخزين المشفر المتاحة للاستخدام الخارجي ─────────────────────────────

/**
 * حفظ مجموعة بيانات مشفرة بالكامل
 */
export async function saveEncrypted<T>(collectionKey: string, data: T): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const encrypted = await encryptData(data);
    await idbSet(STORES.ENCRYPTED_DATA, {
      key: collectionKey,
      value: encrypted,
      updatedAt: Date.now()
    });
  } catch (error) {
    console.error(`خطأ في تشفير وحفظ المجموعة [${collectionKey}]:`, error);
  }
}

/**
 * استرجاع وفك تشفير مجموعة بيانات
 */
export async function loadEncrypted<T>(collectionKey: string, defaultValue: T = null as unknown as T): Promise<T> {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const record = await idbGet(STORES.ENCRYPTED_DATA, collectionKey);
    if (!record || !record.value) return defaultValue;
    const decrypted = await decryptData(record.value);
    return decrypted ?? defaultValue;
  } catch (error) {
    console.warn(`تعذر فك تشفير المجموعة [${collectionKey}] أو لا توجد بعد، استخدام القيمة الافتراضية:`, error);
    return defaultValue;
  }
}

/**
 * حذف مجموعة مشفرة
 */
export async function deleteEncrypted(collectionKey: string): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    await idbDelete(STORES.ENCRYPTED_DATA, collectionKey);
  } catch (error) {
    console.error(`خطأ في حذف المجموعة المشفرة [${collectionKey}]:`, error);
  }
}

// ─── إدارة طابور العمليات المعلقة للمزامنة (Mutation Queue) ─────────────────────

/**
 * إدراج عملية جديدة في طابور المزامنة
 */
export async function enqueueOfflineMutation(mutation: OfflineMutation): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const item: OfflineMutation = {
      ...mutation,
      retryCount: mutation.retryCount ?? 0,
      timestamp: mutation.timestamp || Date.now()
    };
    await idbSet(STORES.MUTATION_QUEUE, item);
  } catch (error) {
    console.error('خطأ في إدراج العملية في طابور المزامنة:', error);
  }
}

/**
 * جلب جميع العمليات المعلقة مرتبة تصاعدياً حسب وقت الإنشاء (FIFO)
 */
export async function getOfflineMutations(): Promise<OfflineMutation[]> {
  if (typeof window === 'undefined') return [];
  try {
    const mutations = await idbGetAll<OfflineMutation>(STORES.MUTATION_QUEUE);
    return mutations.sort((a, b) => a.timestamp - b.timestamp);
  } catch (error) {
    console.error('خطأ في قراءة طابور العمليات المعلقة:', error);
    return [];
  }
}

/**
 * حذف عملية تمت مزامنتها بنجاح
 */
export async function removeOfflineMutation(id: string): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    await idbDelete(STORES.MUTATION_QUEUE, id);
  } catch (error) {
    console.error(`خطأ في إزالة العملية [${id}] من طابور المزامنة:`, error);
  }
}

/**
 * إفراغ كامل طابور العمليات
 */
export async function clearOfflineMutations(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const d = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = d.transaction(STORES.MUTATION_QUEUE, 'readwrite');
      const req = tx.objectStore(STORES.MUTATION_QUEUE).clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (error) {
    console.error('خطأ في إفراغ طابور المزامنة:', error);
  }
}

// ─── طابع وتاريخ آخر مزامنة ────────────────────────────────────────────────────

export async function getLastSyncTime(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  try {
    const record = await idbGet(STORES.META, 'last_sync_time');
    return record ? record.value : null;
  } catch {
    return null;
  }
}

export async function setLastSyncTime(timeIso: string): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    await idbSet(STORES.META, { key: 'last_sync_time', value: timeIso });
  } catch (error) {
    console.error('خطأ في حفظ وقت آخر مزامنة:', error);
  }
}

// ─── تصدير واستيراد نسخة احتياطية محلية مشفرة ───────────────────────────────────

export async function exportEncryptedBackup(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const allRecords = await idbGetAll<{ key: string; value: any }>(STORES.ENCRYPTED_DATA);
    const backupPayload: Record<string, any> = {};

    for (const record of allRecords) {
      backupPayload[record.key] = record.value;
    }

    const blob = new Blob([JSON.stringify({
      app: 'Al-Shafi-i-Quran-School',
      version: '1.0',
      exportDate: new Date().toISOString(),
      data: backupPayload
    }, null, 2)], { type: 'application/json' });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shafii_school_backup_${new Date().toISOString().slice(0, 10)}.encrypted.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('فشل في تصدير النسخة الاحتياطية المشفرة:', error);
    throw error;
  }
}
