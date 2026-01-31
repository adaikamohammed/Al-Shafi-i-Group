import { Resend } from 'resend';
import { EmailNotification } from './types';

// Initialize Resend with API Key from environment variables
const resend = new Resend(process.env.RESEND_API_KEY);

const fromName = process.env.SMTP_FROM_NAME || 'المدرسة القرآنية للإمام الشافعي';
const fromEmail = process.env.SMTP_FROM_EMAIL || 'onboarding@resend.dev';

/**
 * Send an email using Resend
 * @param to - Recipient email address
 * @param subject - Email subject
 * @param html - Email HTML content
 * @returns Result object
 */
export const sendEmail = async (to: string, subject: string, html: string) => {
    try {
        if (!process.env.RESEND_API_KEY) {
            throw new Error('RESEND_API_KEY is missing in environment variables');
        }

        const { data, error } = await resend.emails.send({
            from: `${fromName} <${fromEmail}>`,
            to: [to],
            subject: subject,
            html: html,
        });

        if (error) {
            throw error;
        }

        console.log('Email sent successfully via Resend:', data);
        return { success: true, messageId: data?.id };
    } catch (error) {
        console.error('Error sending email via Resend:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error during email sending',
        };
    }
};

/**
 * Test Resend configuration
 * @returns Result object
 */
export const testEmailConnection = async () => {
    try {
        if (!process.env.RESEND_API_KEY) {
            return { success: false, error: 'RESEND_API_KEY missing' };
        }

        // Send a simple test email
        const result = await sendEmail(
            fromEmail === 'onboarding@resend.dev' ? 'delivered@resend.dev' : fromEmail,
            'اختبار نظام الإشعارات - المدرسة القرآنية',
            '<div style="direction: rtl; font-family: sans-serif;"><h1>✅ تم بنجاح</h1><p>هذا بريد اختباري لتأكيد عمل نظام إشعارات المدرسة بموثوقية.</p></div>'
        );

        return result;
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown test error',
        };
    }
};

/**
 * Send a notification email
 * @param notification - Email notification object
 * @returns Promise with send result
 */
export async function sendNotificationEmail(
    notification: EmailNotification
): Promise<{ success: boolean; messageId?: string; error?: string }> {
    return sendEmail(
        notification.recipientEmail,
        notification.subject,
        notification.body
    );
}

/**
 * Generate email notification type label in Arabic
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
 * Generate email notification status label in Arabic
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
