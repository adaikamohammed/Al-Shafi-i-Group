"use client";

import { useState, useMemo } from "react";
import { surahs } from "@/lib/surahs";
import { ChevronDown, ChevronUp, Pencil } from "lucide-react";

// ─── واجهة المكوّن ─────────────────────────────────────────

interface SmartSurahPickerProps {
  /** آخر سجل للطالب (من آخر حصة حضرها) */
  lastSurahId?: number;
  lastToVerse?: number;
  /** مقدار الورد اليومي المعتاد (بالآيات) */
  dailyAmount?: number;
  /** القيمة الحالية */
  currentSurahId?: number;
  currentFromVerse?: number;
  currentToVerse?: number;
  /** عند التغيير */
  onChange: (patch: { surahId?: number; fromVerse?: number; toVerse?: number; review?: boolean; memorization?: any }) => void;
  /** هل السورة مقيّدة على مستوى الحصة (لا يظهر المكون) */
  sessionSurahId?: number;
  studentId?: string;
  isReviewing?: boolean;
  onToggleReviewMode?: (active: boolean) => void | Promise<void>;
}

// ─── حساب الورد اليومي من مقدار الحفظ ────────────────────

function parseDailyAmount(amount?: string): number {
  if (!amount) return 10;
  // ثمن ≈ 5 آيات، ربع ≈ 10، نصف ≈ 20، صفحة ≈ 15، أكثر ≈ 30
  switch (amount) {
    case "ثمن":   return 5;
    case "ربع":   return 10;
    case "نصف":   return 20;
    case "صفحة":  return 15;
    case "أكثر":  return 30;
    default:      return 10;
  }
}

// ─── المكوّن الرئيسي ──────────────────────────────────────

export function SmartSurahPicker({
  lastSurahId,
  lastToVerse,
  dailyAmount = 10,
  currentSurahId,
  currentFromVerse,
  currentToVerse,
  onChange,
  sessionSurahId,
  studentId,
  isReviewing,
  onToggleReviewMode,
}: SmartSurahPickerProps) {
  const [showCustom, setShowCustom] = useState(false);

  // إذا كانت السورة محددة على مستوى الحصة، لا نعرض المكوّن
  if (sessionSurahId) return null;

  const currentSurah = surahs.find((s) => s.id === currentSurahId);
  const lastSurah = surahs.find((s) => s.id === lastSurahId);

  // ─── حساب اقتراح الورد التالي ─────────────────────────

  const nextWird = useMemo(() => {
    if (!lastSurahId) return null;
    const surah = surahs.find((s) => s.id === lastSurahId);
    if (!surah) return null;

    const fromVerse = (lastToVerse || 0) + 1;

    // هل الطالب أنهى السورة؟
    if (fromVerse > surah.verses) {
      const nextSurah = surahs.find((s) => s.id === lastSurahId + 1);
      const prevSurah = surahs.find((s) => s.id === lastSurahId - 1);
      return {
        isCompleted: true,
        currentSurahName: surah.name,
        nextSurah: nextSurah ? { id: nextSurah.id, name: nextSurah.name, verses: nextSurah.verses } : null,
        prevSurah: prevSurah ? { id: prevSurah.id, name: prevSurah.name, verses: prevSurah.verses } : null,
        surahId: undefined,
        surahName: "",
        fromVerse: 0,
        toVerse: 0,
        isNewSurah: false,
      };
    }

    const toVerse = Math.min(fromVerse + dailyAmount - 1, surah.verses);
    return {
      isCompleted: false,
      surahId: surah.id,
      surahName: surah.name,
      fromVerse,
      toVerse,
      isNewSurah: !lastToVerse,
      nextSurah: null,
      prevSurah: null,
      currentSurahName: "",
    };
  }, [lastSurahId, lastToVerse, dailyAmount]);

  // هل الورد الحالي = الورد المقترح؟
  const isAutoApplied =
    nextWird &&
    !nextWird.isCompleted &&
    currentSurahId === nextWird.surahId &&
    currentFromVerse === nextWird.fromVerse;

  // ─── JSX ──────────────────────────────────────────────────

  return (
    <div className="space-y-2" dir="rtl">
      {/* عرض الاقتراح الذكي */}
      {nextWird && !showCustom && (
        <div className="rounded-2xl border border-blue-100 bg-blue-50/50 overflow-hidden">
          {/* آخر نقطة توقف */}
          {lastSurah && lastToVerse && (
            <div className="px-3 pt-2.5 pb-1 flex items-center gap-1.5 text-[10px] font-bold text-blue-500">
              <span className="opacity-60">📍 آخر حصة:</span>
              <span className="text-blue-700">
                {lastSurah.name} آية {lastToVerse}
              </span>
            </div>
          )}

          {/* إذا أكمل الطالب السورة: نقترح الصعود والنزول */}
          {nextWird.isCompleted ? (
            !currentSurahId ? (
              <div className="p-3.5 space-y-3 bg-emerald-50/70 border-t border-emerald-100">
                <div className="text-center space-y-1">
                  <span className="text-xl">🎉</span>
                  <p className="text-xs font-black text-emerald-800">
                    أكمل الطالب سورة {nextWird.currentSurahName}!
                  </p>
                  <p className="text-[10px] font-semibold text-emerald-600">
                    اختر الخطوة التالية:
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {nextWird.nextSurah && (
                    <button
                      type="button"
                      onClick={async () => {
                        if (onToggleReviewMode) {
                          await onToggleReviewMode(false);
                        }
                        onChange({
                          surahId: nextWird.nextSurah!.id,
                          fromVerse: 1,
                          toVerse: Math.min(dailyAmount, nextWird.nextSurah!.verses),
                        });
                      }}
                      className="py-2.5 px-1.5 rounded-xl text-[10px] font-black bg-emerald-600 text-white hover:bg-emerald-700 transition-all text-center leading-tight shadow-sm"
                    >
                      نزولاً (التالية)
                      <span className="block text-[9px] font-semibold opacity-90 mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis">
                        {nextWird.nextSurah!.name} (1–{Math.min(dailyAmount, nextWird.nextSurah!.verses)})
                      </span>
                    </button>
                  )}
                  {nextWird.prevSurah && (
                    <button
                      type="button"
                      onClick={async () => {
                        if (onToggleReviewMode) {
                          await onToggleReviewMode(false);
                        }
                        onChange({
                          surahId: nextWird.prevSurah!.id,
                          fromVerse: 1,
                          toVerse: Math.min(dailyAmount, nextWird.prevSurah!.verses),
                        });
                      }}
                      className="py-2.5 px-1.5 rounded-xl text-[10px] font-black bg-indigo-600 text-white hover:bg-indigo-700 transition-all text-center leading-tight shadow-sm"
                    >
                      صعوداً (السابقة)
                      <span className="block text-[9px] font-semibold opacity-90 mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis">
                        {nextWird.prevSurah!.name} (1–{Math.min(dailyAmount, nextWird.prevSurah!.verses)})
                      </span>
                    </button>
                  )}

                  {onToggleReviewMode && (
                    <button
                      type="button"
                      onClick={async () => {
                        await onToggleReviewMode(true);
                        onChange({ review: true, memorization: "" as any });
                      }}
                      className="col-span-2 py-2 px-2.5 rounded-xl text-[10px] font-black bg-amber-500 text-white hover:bg-amber-600 transition-all text-center leading-tight shadow-sm flex items-center justify-center gap-1"
                    >
                      🔄 بدء أيام مراجعة شاملة للسورة
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300 font-bold text-xs flex flex-col gap-2 border-t border-emerald-100 dark:border-emerald-900/30">
                <div className="flex items-center justify-between">
                  <span>📖 الورد المختار: {currentSurah?.name} ({currentFromVerse ?? 1}–{currentToVerse})</span>
                  <button
                    type="button"
                    onClick={() => {
                      onChange({ surahId: undefined, fromVerse: undefined, toVerse: undefined });
                    }}
                    className="text-[10px] text-red-500 hover:underline"
                  >
                    إعادة تعيين ↺
                  </button>
                </div>
                {/* أزرار تعديل الآيات */}
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      const newTo = Math.max(currentFromVerse ?? 1, (currentToVerse ?? 1) - 5);
                      onChange({ toVerse: newTo });
                    }}
                    className="flex-1 py-1 rounded-lg text-[10px] font-black bg-emerald-100 dark:bg-emerald-900/10 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-200 transition-colors"
                  >
                    ↓ 5 آيات أقل
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const newTo = Math.min((currentToVerse ?? 1) + 5, currentSurah?.verses ?? 999);
                      onChange({ toVerse: newTo });
                    }}
                    className="flex-1 py-1 rounded-lg text-[10px] font-black bg-emerald-100 dark:bg-emerald-900/10 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-200 transition-colors"
                  >
                    ↑ 5 آيات أكثر
                  </button>
                </div>
              </div>
            )
          ) : (
            <>
              {/* اقتراح الورد التالي العادي */}
              <button
                type="button"
                onClick={() => {
                  onChange({
                    surahId: nextWird.surahId,
                    fromVerse: nextWird.fromVerse,
                    toVerse: nextWird.toVerse,
                  });
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 transition-all ${
                  isAutoApplied
                    ? "bg-blue-600 text-white"
                    : "hover:bg-blue-100/60 text-blue-900"
                }`}
              >
                <div className="flex items-center gap-2 text-right">
                  <span className="text-lg">{nextWird.isNewSurah ? "🆕" : "▶"}</span>
                  <div>
                    <p className={`text-xs font-black ${isAutoApplied ? "text-white" : "text-blue-800"}`}>
                      {nextWird.isNewSurah ? "سورة جديدة: " : "تابع: "}
                      {nextWird.surahName} ({nextWird.fromVerse}–{nextWird.toVerse})
                    </p>
                    <p className={`text-[10px] font-bold mt-0.5 ${isAutoApplied ? "text-blue-100" : "text-blue-500"}`}>
                      {nextWird.toVerse - nextWird.fromVerse + 1} آيات
                      {isAutoApplied && " ✓ مُطبَّق"}
                    </p>
                  </div>
                </div>
                {isAutoApplied && (
                  <span className="text-xs font-black text-blue-100 bg-blue-500/50 rounded-lg px-2 py-1">
                    مُحدَّد
                  </span>
                )}
              </button>

              {/* زر التعديل أو تخصيص */}
              {isAutoApplied && (
                <div className="flex gap-2 px-3 pb-2.5 pt-1">
                  {/* ± 5 آيات */}
                  <button
                    type="button"
                    onClick={() => {
                      const newTo = Math.max(nextWird.fromVerse, (currentToVerse ?? nextWird.toVerse) - 5);
                      onChange({ toVerse: newTo });
                    }}
                    className="flex-1 py-1 rounded-lg text-[11px] font-black bg-blue-100/80 text-blue-700 hover:bg-blue-200 transition-colors"
                  >
                    ↓ 5 آيات أقل
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const surah = surahs.find((s) => s.id === currentSurahId);
                      const newTo = Math.min((currentToVerse ?? nextWird.toVerse) + 5, surah?.verses ?? 999);
                      onChange({ toVerse: newTo });
                    }}
                    className="flex-1 py-1 rounded-lg text-[11px] font-black bg-blue-100/80 text-blue-700 hover:bg-blue-200 transition-colors"
                  >
                    ↑ 5 آيات أكثر
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* زر التخصيص اليدوي */}
      <button
        type="button"
        onClick={() => setShowCustom((v) => !v)}
        className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-black text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors border border-dashed border-gray-200"
      >
        <Pencil className="w-3 h-3" />
        {showCustom ? "إخفاء التخصيص" : "تخصيص يدوي (سورة / آيات)"}
        {showCustom ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      {/* قسم التخصيص اليدوي */}
      {showCustom && (
        <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-3 space-y-2 animate-in fade-in duration-150">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">
            اختيار السورة
          </p>
          <select
            value={currentSurahId ?? ""}
            onChange={(e) =>
              onChange({
                surahId: e.target.value ? +e.target.value : undefined,
                fromVerse: undefined,
                toVerse: undefined,
              })
            }
            className="w-full bg-background border border-muted-foreground/15 rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none"
          >
            <option value="">— اختر السورة —</option>
            {surahs.map((s) => (
              <option key={s.id} value={s.id}>
                {s.id}. {s.name} ({s.verses} آية)
              </option>
            ))}
          </select>

          {currentSurahId && (
            <div className="flex gap-2">
              <input
                type="number"
                min={1}
                max={currentSurah?.verses}
                value={currentFromVerse ?? ""}
                onChange={(e) => onChange({ fromVerse: +e.target.value })}
                placeholder="من آية"
                className="w-full bg-background border border-muted-foreground/15 rounded-lg px-2 py-1 text-sm text-center flex-1"
              />
              <span className="text-gray-400 self-center text-sm">→</span>
              <input
                type="number"
                min={1}
                max={currentSurah?.verses}
                value={currentToVerse ?? ""}
                onChange={(e) => onChange({ toVerse: +e.target.value })}
                placeholder="إلى آية"
                className="w-full bg-background border border-muted-foreground/15 rounded-lg px-2 py-1 text-sm text-center flex-1"
              />
              {currentSurah && (
                <span className="text-xs text-gray-400 self-center whitespace-nowrap">
                  / {currentSurah.verses}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* عرض الورد الحالي إذا كان محدداً ولم يكن ورد مقترح */}
      {!nextWird && currentSurahId && !showCustom && (
        <div className="text-xs text-gray-500 font-bold px-2">
          📖 {currentSurah?.name}
          {currentFromVerse && currentToVerse && ` (${currentFromVerse}–${currentToVerse})`}
        </div>
      )}
    </div>
  );
}

export { parseDailyAmount };
