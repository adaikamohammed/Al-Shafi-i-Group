
"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, Home, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class GlobalErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
                    <div className="max-w-md w-full text-center space-y-6 p-8 bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800">
                        <div className="w-20 h-20 bg-rose-100 dark:bg-rose-900/30 rounded-full flex items-center justify-center mx-auto">
                            <AlertTriangle className="h-10 w-10 text-rose-600 dark:text-rose-400" />
                        </div>

                        <div className="space-y-2">
                            <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-headline">عذراً، حدث خطأ غير متوقع</h1>
                            <p className="text-slate-500 dark:text-slate-400">
                                واجه النظام مشكلة بسيطة في تحميل هذا الجزء. لا تقلق، بياناتك آمنة.
                            </p>
                        </div>

                        <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-xl text-left dir-ltr overflow-auto max-h-32 text-xs font-mono text-slate-600 dark:text-slate-400">
                            {this.state.error?.message}
                        </div>

                        <div className="flex flex-col gap-3">
                            <Button
                                onClick={() => window.location.reload()}
                                className="w-full h-12 text-lg font-bold gap-2"
                            >
                                <RefreshCw className="h-5 w-5" />
                                تحديث الصفحة
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => window.location.href = '/'}
                                className="w-full h-12 text-lg font-bold gap-2"
                            >
                                <Home className="h-5 w-5" />
                                العودة للرئيسية
                            </Button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
