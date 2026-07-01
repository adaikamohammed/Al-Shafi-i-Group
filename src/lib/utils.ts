import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function sanitizeData(obj: any): any {
  if (obj === undefined) return null;
  if (obj === null) return null;
  
  // Handle numbers: convert NaN/Infinity to null as they are not JSON-safe
  if (typeof obj === 'number') {
    return isFinite(obj) ? obj : null;
  }
  
  // Handle basic types and Dates
  if (typeof obj !== 'object') return obj;
  if (obj instanceof Date) return obj.toISOString(); // Better for Firebase consistency

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeData(item));
  }

  const sanitized: any = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];
      // Skip functions and non-serializable items
      if (typeof value === 'function') continue;
      sanitized[key] = sanitizeData(value);
    }
  }
  return sanitized;
}

// ─── Arabic Alphabetical Sorting ──────────────────────────────────────────────
const ARABIC_ALPHABET = 'ءآأؤإئابتثجحخدذرزسشصضطظعغفقكلمنهوي';
const arabicCharOrder = new Map<string, number>();
for (let i = 0; i < ARABIC_ALPHABET.length; i++) {
  arabicCharOrder.set(ARABIC_ALPHABET[i], i);
}

/** Compare two Arabic strings character by character using explicit alphabet order */
export function arabicCompare(a: string, b: string): number {
  const la = a.length, lb = b.length;
  const len = Math.min(la, lb);
  for (let i = 0; i < len; i++) {
    const ca = a[i], cb = b[i];
    const oa = arabicCharOrder.get(ca), ob = arabicCharOrder.get(cb);
    if (oa !== undefined && ob !== undefined) {
      if (oa !== ob) return oa - ob;
    } else if (oa !== undefined) {
      return -1; // Arabic before non-Arabic
    } else if (ob !== undefined) {
      return 1;
    } else {
      // Both non-Arabic: use codepoint
      if (ca !== cb) return ca < cb ? -1 : 1;
    }
  }
  return la - lb;
}

// ─── Sheikh and Ustadhat classification helpers ──────────────────────────────────────────
export function getAdminNumber(email: string): number | null {
  const match = (email || '').toLowerCase().match(/admin(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

export function getGroupNumber(group: string): number | null {
  const match = (group || '').match(/\d+/);
  return match ? parseInt(match[0], 10) : null;
}

export function isSheikhMenUser(u: any): boolean {
  if (!u) return false;
  const emailNum = getAdminNumber(u.email || '');
  const groupNum = getGroupNumber(u.group || '');
  const displayName = u.displayName || '';
  return (emailNum !== null && ((emailNum >= 1 && emailNum <= 9) || emailNum === 20 || emailNum === 21)) || 
         (groupNum !== null && ((groupNum >= 1 && groupNum <= 9) || groupNum === 20 || groupNum === 21)) ||
         displayName.includes('الشيخ');
}

export function isSheikhWomenUser(u: any): boolean {
  if (!u) return false;
  const emailNum = getAdminNumber(u.email || '');
  const groupNum = getGroupNumber(u.group || '');
  const displayName = u.displayName || '';
  return (emailNum !== null && ((emailNum >= 10 && emailNum <= 18) || emailNum === 19)) || 
         (groupNum !== null && ((groupNum >= 10 && groupNum <= 18) || groupNum === 19)) ||
         displayName.includes('الأستاذة') || displayName.includes('إبتدائي');
}

export function isStudentInMenSheikhs(s: any, allUsers: any[]): boolean {
  const ownerUser = (allUsers || []).find(u => u.uid === s.ownerId);
  if (ownerUser) {
    return isSheikhMenUser(ownerUser);
  }
  const groupNum = getGroupNumber(s.groupName || '');
  return groupNum !== null && ((groupNum >= 1 && groupNum <= 9) || groupNum === 20 || groupNum === 21);
}

export function isStudentInWomenUstadhats(s: any, allUsers: any[]): boolean {
  const ownerUser = (allUsers || []).find(u => u.uid === s.ownerId);
  if (ownerUser) {
    return isSheikhWomenUser(ownerUser);
  }
  const groupNum = getGroupNumber(s.groupName || '');
  return groupNum !== null && ((groupNum >= 10 && groupNum <= 18) || groupNum === 19);
}

export const GROUP_SHEIKH_MAPPING: Record<string, string> = {
  "فوج 1": "الشيخ زياد درويش",
  "فوج 2": "الشيخ عبد الحميد",
  "فوج 3": "الشيخ فؤاد بن عمر",
  "فوج 4": "الشيخ أحمد بن عمر",
  "فوج 5": "الشيخ إبراهيم مراد",
  "فوج 6": "الشيخ سفيان نصيرة",
  "فوج 7": "الشيخ محمد منصور",
  "فوج 8": "الشيخ عبد الحق نصيرة",
  "فوج 9": "الشيخ صهيب نصيب",
  "فوج 10": "الأستاذة سعيدة",
  "فوج 11": "الأستاذة سميرة",
  "فوج 12": "الأستاذة رقية",
  "فوج 13": "الأستاذة ثريا",
  "فوج 14": "الأستاذة أميرة",
  "فوج 15": "الأستاذة زينب",
  "فوج 16": "الأستاذة جهاد",
  "فوج 17": "الأستاذة ميمونه",
  "فوج 18": "الأستاذة حياة",
  "فوج 19": "فوج 1 إبتدائي",
  "فوج 20": "الشيخ عبد الكريم ترممو",
  "فوج 21": "الشيخ كنيوة عرفات",
  "فوج 1 إبتدائي": "",
};

export function getGroupSheikhName(groupName: string, allUsers?: any[]): string {
  if (!groupName) return '';
  const trimmed = groupName.trim();
  
  // Try to find dynamically in allUsers first
  if (allUsers && Array.isArray(allUsers)) {
    const sheikhUser = allUsers.find(u => u.role === 'sheikh' && u.group?.trim() === trimmed);
    if (sheikhUser?.displayName) {
      return sheikhUser.displayName;
    }
  }

  // Fallback to static mapping
  return GROUP_SHEIKH_MAPPING[trimmed] || '';
}

export function formatGroupName(groupName: string, allUsers?: any[]): string {
  if (!groupName) return '';
  const trimmed = groupName.trim();
  if (trimmed === 'كل الأفواج' || trimmed === '—' || trimmed === 'غير محدد') return trimmed;
  
  // If the group name already includes the sheikh's name (e.g. "الشيخ" or "الأستاذة"), return it as is
  if (trimmed.includes('الشيخ') || trimmed.includes('الأستاذة') || trimmed.includes('أستاذة')) {
    return trimmed;
  }
  
  const sheikhName = getGroupSheikhName(trimmed, allUsers);
  if (sheikhName) {
    return `${trimmed} ${sheikhName}`;
  }
  return trimmed;
}

