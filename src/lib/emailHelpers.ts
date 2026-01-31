import { EmailNotification } from './types';

/**
 * Generate email notification type label in Arabic (client-safe version)
 * @param type - Notification type
 * @returns Arabic label
 */
export function getNotificationTypeLabel(type: EmailNotification['type']): string {
    const labels = {
        weekly_report: 'التقرير الأسبوعي',
        monthly_report: 'التقرير الشهري',
        absence_alert: 'تنبيه الغياب',
        achievement_newsletter: 'نشرة الإنجازات',
        payment_reminder: 'تذكير بالدفعات',
    };
    return labels[type] || type;
}

/**
 * Generate email notification status label in Arabic (client-safe version)
 * @param status - Notification status
 * @returns Arabic label
 */
export function getNotificationStatusLabel(status: EmailNotification['status']): string {
    const labels = {
        pending: 'معلق',
        reviewed: 'تمت المراجعة',
        scheduled: 'مجدول',
        sent: 'تم الإرسال',
        failed: 'فشل',
    };
    return labels[status] || status;
}

/**
 * Send a test email via API
 */
export async function testEmailAPI(): Promise<{ success: boolean; error?: string }> {
    try {
        const response = await fetch('/api/email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'test' }),
        });
        return await response.json();
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

/**
 * Send an email via API
 */
export async function sendEmailAPI(
    to: string,
    subject: string,
    html: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
        const response = await fetch('/api/email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'send', to, subject, html }),
        });
        return await response.json();
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}
