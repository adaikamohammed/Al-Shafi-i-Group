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
