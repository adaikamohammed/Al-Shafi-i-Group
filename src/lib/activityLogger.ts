import { ref, push, serverTimestamp, get } from 'firebase/database';
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
    | 'DELETE_PRE_REGISTRATION';

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

        const logsRef = ref(db, `users/${targetOwnerId}/activity_logs`);

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

        console.log(`[ActivityLogger] Pushing log to users/${targetOwnerId}/activity_logs:`, safeLog);

        await push(logsRef, safeLog);
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
