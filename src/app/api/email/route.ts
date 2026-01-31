import { NextRequest, NextResponse } from 'next/server';

// Lazy load email service only when needed
async function getEmailService() {
    const { sendEmail, testEmailConnection } = await import('@/lib/emailService');
    return { sendEmail, testEmailConnection };
}

export async function POST(request: NextRequest) {
    try {
        const { action, to, subject, html } = await request.json();
        const { sendEmail, testEmailConnection } = await getEmailService();

        if (action === 'test') {
            // Test SMTP connection and send test email
            const result = await testEmailConnection();
            return NextResponse.json(result);
        }

        if (action === 'send') {
            // Send email
            if (!to || !subject || !html) {
                return NextResponse.json(
                    { success: false, error: 'Missing required fields' },
                    { status: 400 }
                );
            }

            const result = await sendEmail(to, subject, html);
            return NextResponse.json(result);
        }

        return NextResponse.json(
            { success: false, error: 'Invalid action' },
            { status: 400 }
        );
    } catch (error) {
        console.error('Email API error:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}
