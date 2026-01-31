"use client";

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Lock, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

export default function LoginPage() {
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signInWithEmail } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signInWithEmail(loginEmail, loginPassword);
      router.push('/dashboard');
    } catch (error: any) {
      console.error("Login Error Code:", error.code);
      let description = "فشل تسجيل الدخول. يرجى التأكد من صحة البريد الإلكتروني وكلمة المرور.";
      switch (error.code) {
        case 'auth/user-not-found':
        case 'auth/invalid-credential':
          description = "البريد الإلكتروني أو كلمة المرور غير صحيحة. يرجى المحاولة مرة أخرى.";
          break;
        case 'auth/wrong-password':
          description = "كلمة المرور غير صحيحة. يرجى المحاولة مرة أخرى.";
          break;
        case 'auth/invalid-email':
          description = "صيغة البريد الإلكتروني غير صالحة.";
          break;
        case 'auth/too-many-requests':
          description = "محاولات كثيرة خاطئة. يرجى المحاولة لاحقاً.";
          break;
        default:
          description = `حدث خطأ: ${error.message}`;
      }
      toast({
        title: "خطأ في تسجيل الدخول",
        description: description,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex items-center justify-center min-h-screen overflow-hidden bg-[#0a0a0a]">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#1A5F5E]/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#B4941E]/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03] pointer-events-none" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative z-10 w-full max-w-md px-4"
      >
        {/* Logo/Identity Section */}
        <div className="flex flex-col items-center mb-6 space-y-4 text-center">
          <motion.div
            initial={{ scale: 0, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
            className="relative w-32 h-32 md:w-40 md:h-40"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-[#1A5F5E]/30 to-[#B4941E]/20 blur-2xl rounded-full" />
            <div className="relative flex items-center justify-center w-full h-full p-2 overflow-hidden bg-white shadow-2xl rounded-3xl ring-1 ring-white/20">
              <Image
                src="/logo.jpg"
                alt="شعار المدرسة"
                fill
                className="object-contain p-2"
                priority
              />
            </div>
          </motion.div>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-white md:text-4xl font-headline">
              المدرسة القرآنية
            </h1>
            <p className="text-lg font-medium text-[#B4941E] opacity-90">للإمام الشافعي</p>
          </div>
        </div>

        {/* Login Card with Glassmorphism */}
        <Card className="overflow-hidden border-white/10 bg-white/5 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.8)]">
          <CardHeader className="space-y-1 text-center border-b border-white/5">
            <CardTitle className="text-2xl font-bold text-white">تسجيل الدخول</CardTitle>
            <CardDescription className="text-slate-400">نظام إدارة حلقات تحفيظ القرآن الكريم</CardDescription>
          </CardHeader>
          <CardContent className="pt-8">
            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2 group">
                  <Label htmlFor="login-email" className="text-slate-200 group-focus-within:text-[#1A5F5E] transition-colors">البريد الإلكتروني</Label>
                  <div className="relative">
                    <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-[#1A5F5E] transition-colors" />
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="m@example.com"
                      required
                      autoComplete="email"
                      className="pr-10 bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus:border-[#1A5F5E]/50 focus:ring-[#1A5F5E]/20 h-12 rounded-xl transition-all"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2 group">
                  <Label htmlFor="login-password" className="text-slate-200 group-focus-within:text-[#1A5F5E] transition-colors">كلمة المرور</Label>
                  <div className="relative">
                    <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-[#1A5F5E] transition-colors" />
                    <Input
                      id="login-password"
                      type="password"
                      required
                      autoComplete="current-password"
                      className="pr-10 bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus:border-[#1A5F5E]/50 focus:ring-[#1A5F5E]/20 h-12 rounded-xl transition-all"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-12 text-base font-bold text-white transition-all duration-300 rounded-xl bg-gradient-to-r from-[#1A5F5E] to-[#2d7a78] hover:from-[#2d7a78] hover:to-[#1A5F5E] hover:shadow-lg hover:shadow-[#1A5F5E]/20 active:scale-[0.98]"
                disabled={loading}
              >
                <AnimatePresence mode="wait">
                  {loading ? (
                    <motion.div
                      key="loading"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center justify-center gap-2"
                    >
                      <Loader2 className="w-5 h-5 animate-spin" />
                      جاري التحقق...
                    </motion.div>
                  ) : (
                    <motion.span
                      key="text"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                    >
                      دخول للنظام
                    </motion.span>
                  )}
                </AnimatePresence>
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Footer Note */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="mt-8 text-sm text-center text-slate-500"
        >
          حي تكسبت الغربية / الوادي
        </motion.p>
      </motion.div>
    </div>
  );
}
