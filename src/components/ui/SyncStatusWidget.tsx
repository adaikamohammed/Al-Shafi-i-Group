"use client";

import React, { useEffect, useState } from 'react';
import {
  subscribeToSyncStatus,
  syncPendingMutations,
  SyncStatus,
  initOfflineSyncEngine,
  isForceOfflineMode,
  setForceOfflineMode,
} from '@/lib/offlineSyncEngine';
import {
  Cloud,
  RefreshCw,
  AlertCircle,
  HardDrive,
  Zap,
  CheckCircle2,
  ShieldCheck,
  WifiOff,
  Radio
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

export function SyncStatusWidget({ className }: { className?: string }) {
  const [status, setStatus] = useState<SyncStatus>('synced');
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [isForcedOffline, setIsForcedOffline] = useState<boolean>(false);
  const [isManualSyncing, setIsManualSyncing] = useState<boolean>(false);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const { toast } = useToast();

  useEffect(() => {
    // تهيئة محرك المزامنة التلقائي الصامت
    initOfflineSyncEngine((syncedCount) => {
      toast({
        title: "☁️ تم التحديث السحابي",
        description: `تم رفع وتوحيد ${syncedCount} عملية مع السحابة بنجاح!`,
        duration: 3000,
      });
    });

    setIsForcedOffline(isForceOfflineMode());

    const unsubscribe = subscribeToSyncStatus((payload) => {
      if (!payload) return;
      if (payload.status) setStatus(payload.status);
      if (typeof payload.pendingCount === 'number') setPendingCount(payload.pendingCount);
      if (payload.lastSyncTime !== undefined) setLastSyncTime(payload.lastSyncTime);
      if (typeof payload.isForcedOffline === 'boolean') setIsForcedOffline(payload.isForcedOffline);
    });

    return () => unsubscribe();
  }, [toast]);

  const handleToggleForceOffline = (checked: boolean) => {
    setForceOfflineMode(checked);
    setIsForcedOffline(checked);

    if (checked) {
      toast({
        title: "⚡ تم تفعيل الوضع المحلي السريع",
        description: "ستتم كل عمليات التسجيل والحفظ فورياً محلياً بدون انتظار الإنترنت. يمكنك المزامنة لاحقاً في أي وقت.",
      });
    } else {
      toast({
        title: "🌐 تم إيقاف الوضع المحلي",
        description: "جاري المزامنة مع السحابة والتحقق من التحديثات...",
      });
    }
  };

  const handleManualSync = async () => {
    if (status === 'syncing' || isManualSyncing) return;

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      toast({
        title: "📡 لا يوجد اتصال بالإنترنت",
        description: `البيانات محفوظة بأمان محلياً بتشفير AES-256 (${pendingCount} عملية معلقة).`,
        variant: "default",
      });
      return;
    }

    setIsManualSyncing(true);
    toast({
      title: "🔄 جاري فحص ومزامنة البيانات...",
      description: "جاري الاتصال بقاعدة البيانات السحابية لتوحيد السجلات.",
      duration: 2000,
    });

    try {
      const res = await syncPendingMutations({ allowForcedOffline: true });
      if (res.success) {
        toast({
          title: "✅ تمت المزامنة بنجاح",
          description: res.syncedCount > 0
            ? `تم رفع وتحديث ${res.syncedCount} عملية مع السحاب.`
            : "جميع البيانات متطابقة ومتزامنة مع السحاب بالفعل.",
          duration: 3000,
        });
      } else {
        toast({
          title: "⚠️ تنبيه المزامنة",
          description: res.error || `يوجد ${res.remainingCount} عمليات بانتظار استقرار الشبكة.`,
          variant: "destructive",
        });
      }
    } finally {
      setIsManualSyncing(false);
    }
  };

  const isSpinning = status === 'syncing' || isManualSyncing;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="حالة المزامنة والاتصال - انقر للخيارات والتحكم"
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all select-none border backdrop-blur-sm cursor-pointer shadow-xs active:scale-95",
            isForcedOffline && "bg-amber-50 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-700",
            !isForcedOffline && status === 'synced' && !isSpinning && "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
            !isForcedOffline && isSpinning && "bg-blue-50 text-blue-800 border-blue-200 animate-pulse dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800",
            !isForcedOffline && status === 'offline' && !isSpinning && "bg-orange-50 text-orange-800 border-orange-200 hover:bg-orange-100 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800",
            !isForcedOffline && status === 'error' && !isSpinning && "bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800",
            className
          )}
        >
          {isForcedOffline ? (
            <>
              <Zap className="w-3.5 h-3.5 text-amber-600 fill-amber-500 shrink-0" />
              <span className="font-bold text-[11px]">
                سريع محلي{pendingCount > 0 ? ` (${pendingCount})` : ''}
              </span>
            </>
          ) : isSpinning ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600 shrink-0" />
              <span className="font-bold text-[11px]">
                جاري الرفع{pendingCount > 0 ? ` (${pendingCount})` : '...'}
              </span>
            </>
          ) : status === 'synced' ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <Cloud className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="hidden sm:inline font-bold text-[11px]">مـتـزامـن</span>
            </>
          ) : status === 'offline' ? (
            <>
              <HardDrive className="w-3.5 h-3.5 text-orange-600 shrink-0" />
              <span className="font-bold text-[11px]">
                أوفلاين{pendingCount > 0 ? ` (${pendingCount})` : ''}
              </span>
            </>
          ) : (
            <>
              <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
              <span className="font-bold text-[11px]">إعادة المحاولة</span>
            </>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-84 p-4 text-right rtl shadow-xl rounded-2xl border bg-card backdrop-blur-md"
      >
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between border-b pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <h4 className="font-bold text-sm">نظام المزامنة والحفظ المحلي</h4>
            </div>
            <span className={cn(
              "text-[10px] font-bold px-2 py-0.5 rounded-full",
              isForcedOffline ? "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200" :
              status === 'synced' ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200" :
              status === 'offline' ? "bg-orange-100 text-orange-800 dark:bg-orange-900/60 dark:text-orange-200" :
              "bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200"
            )}>
              {isForcedOffline ? "الوضع السريع" :
               status === 'synced' ? "متصل وسليم" :
               status === 'offline' ? "بدون اتصال" : "جاري المزامنة"}
            </span>
          </div>

          {/* Quick Offline Mode Toggle */}
          <div className="flex items-center justify-between gap-3 bg-muted/40 p-3 rounded-xl border border-border/50">
            <div className="space-y-0.5 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-foreground">
                <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
                <span>الوضع المحلي فائق السرعة</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                مفيد عند بطء الشبكة: يسجل فورياً دون انتظار السحابة، وتُرفع التحديثات لاحقاً.
              </p>
            </div>
            <Switch
              checked={isForcedOffline}
              onCheckedChange={handleToggleForceOffline}
            />
          </div>

          {/* Pending items and sync button */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs px-1">
              <span className="text-muted-foreground">العمليات المحلية المعلقة:</span>
              <span className="font-bold font-mono text-sm px-2 py-0.5 rounded bg-muted">
                {pendingCount}
              </span>
            </div>

            {lastSyncTime && (
              <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
                <span>آخر مزامنة ناجحة:</span>
                <span dir="ltr">
                  {new Date(lastSyncTime).toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            )}

            <Button
              onClick={handleManualSync}
              disabled={isSpinning}
              className="w-full mt-2 h-9 text-xs font-bold gap-2 rounded-xl"
              variant={isForcedOffline ? "secondary" : "default"}
            >
              {isSpinning ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>جاري المزامنة مع السحابة...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>مزامنة ورفع التحديثات الآن 🚀</span>
                </>
              )}
            </Button>
          </div>

          {/* Footer reassurance */}
          <div className="border-t pt-2.5 flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground/80">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>حفظ محلي مشفر ومحمي بمعيار AES-256-GCM</span>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
