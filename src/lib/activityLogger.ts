import { ref, push, serverTimestamp, get, update } from 'firebase/database';
import { db } from './firebase';
import { toast } from '@/hooks/use-toast';

export type ActivityAction =
    | 'ADD_STUDENT'
    | 'UPDATE_STUDENT'
    | 'DELETE_STUDENT'
    | 'ADD_SESSION'
    | 'DELETE_SESSION'
    | 'SAVE_REPORT'
    | 'DELETE_REPORT'
    | 'UPDATE_SURAH_PROGRESS'
    | 'UPDATE_PRE_REGISTRATION'
    | 'DELETE_PRE_REGISTRATION'
    | 'MOVE_SESSION';

interface LogEntry {
    action: ActivityAction;
    actorId: string;
    actorName: string;
    targetId?: string;
    targetName?: string;
    details?: string;
    timestamp: object; // ServerTimestamp
    groupName?: string;
}

export const logActivity = async (
    action: ActivityAction,
    actorId: string,
    details: string,
    targetId: string,
    targetName: string,
    actorName: string = 'Unknown',
    groupName: string = '',
    ownerId?: string // User specific logging
) => {
    try {
        const targetOwnerId = ownerId || actorId;
        if (!targetOwnerId) return;

        // Generate a new key for the activity
        const newLogId = push(ref(db, 'activity_logs')).key;
        if (!newLogId) return;

        // Sanitize data to ensure no undefined values
        const safeLog: LogEntry = {
            action,
            actorId: actorId || 'unknown_actor',
            actorName: actorName || 'Unknown',
            targetId: targetId || '',
            targetName: targetName || '',
            details: details || '',
            timestamp: serverTimestamp(),
            groupName: groupName || ''
        };

        const updates: any = {};
        // 1. Log to the common global path (visible to Management)
        updates[`activity_logs/${newLogId}`] = safeLog;

        // 2. Log to the user's private path (visible to the specific Sheikh)
        updates[`users/${targetOwnerId}/activity_logs/${newLogId}`] = safeLog;

        console.log(`[ActivityLogger] Atomic log aggregation to global and user path:`, updates);

        await update(ref(db), updates);
    } catch (error: any) {
        console.error('Error logging activity:', error);
        if (error.code === 'PERMISSION_DENIED' || error.message?.includes('permission_denied')) {
            toast({
                title: "فشل تسجيل النشاطات",
                description: "ليس لديك صلاحية لتسجيل هذا النشاط. يرجى مراجعة القواعد (Database Rules).",
                variant: "destructive"
            });
        }
    }
};
