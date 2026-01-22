"use client";

import React from 'react';

interface Props {
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

interface State {
    hasError: boolean;
    error?: Error;
}

export class ErrorBoundary extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('Error caught by boundary:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return this.props.fallback || (
                <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background">
                    <div className="text-center max-w-md">
                        <div className="text-6xl mb-4">⚠️</div>
                        <h2 className="text-xl font-bold mb-4 text-foreground">حدث خطأ في التحميل</h2>
                        <p className="text-muted-foreground mb-6">
                            عذراً، حدث خطأ غير متوقع. يرجى تحديث الصفحة للمتابعة.
                        </p>
                        {this.state.error && (
                            <details className="mb-6 text-right">
                                <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                                    تفاصيل الخطأ
                                </summary>
                                <pre className="mt-2 p-3 bg-muted rounded-lg text-xs overflow-auto max-h-32 text-left">
                                    {this.state.error.message}
                                </pre>
                            </details>
                        )}
                        <button
                            onClick={() => window.location.reload()}
                            className="px-6 py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-colors"
                        >
                            تحديث الصفحة
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
