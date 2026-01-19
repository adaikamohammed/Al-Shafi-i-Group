
"use client";

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupName, setSignupName] = useState('');
  const [loading, setLoading] = useState(false);
  const { signUpWithEmail, signInWithEmail } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signInWithEmail(loginEmail, loginPassword);
      router.push('/');
    } catch (error: any) {
      console.error("Login Error Code:", error.code);
      let description = "فشل تسجيل الدخول. يرجى التأكد من صحة البريد الإلكتروني وكلمة المرور.";
      switch (error.code) {
        case 'auth/user-not-found':
        case 'auth/invalid-credential':
          description = "البريد الإلكتروني أو كلمة المرور غير صحيحة. يرجى المحاولة مرة أخرى أو إنشاء حساب جديد.";
          break;
        case 'auth/wrong-password':
          description = "كلمة المرور غير صحيحة. يرجى المحاولة مرة أخرى.";
          break;
        case 'auth/invalid-email':
            description = "صيغة البريد الإلكتروني غير صالحة.";
            break;
        default:
          description = `حدث خطأ غير متوقع: ${error.message}`;
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

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (signupPassword.length < 6) {
        toast({
            title: "كلمة مرور ضعيفة",
            description: "يجب أن تتكون كلمة المرور من 6 أحرف على الأقل.",
            variant: 'destructive',
        });
        return;
    }
    setLoading(true);
    try {
      await signUpWithEmail(signupEmail, signupPassword, signupName);
      router.push('/');
    } catch (error: any) {
        console.error("Signup Error:", error.code, error.message);
        toast({
            title: "خطأ في إنشاء الحساب",
            description: error.code === 'auth/email-already-in-use' ? "هذا البريد الإلكتروني مستخدم بالفعل." : "حدث خطأ غير متوقع.",
            variant: 'destructive',
        });
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Tabs defaultValue="login" className="w-[400px]">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="login">تسجيل الدخول</TabsTrigger>
          <TabsTrigger value="signup">إنشاء حساب</TabsTrigger>
        </TabsList>
        <TabsContent value="login">
          <Card>
            <CardHeader>
              <CardTitle>تسجيل الدخول</CardTitle>
              <CardDescription>أدخل بريدك الإلكتروني وكلمة المرور للوصول إلى حسابك.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin}>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">البريد الإلكتروني</Label>
                    <Input id="login-email" type="email" placeholder="m@example.com" required value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">كلمة المرور</Label>
                    <Input id="login-password" type="password" required value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                    تسجيل الدخول
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="signup">
          <Card>
            <CardHeader>
              <CardTitle>إنشاء حساب</CardTitle>
              <CardDescription>املأ النموذج أدناه لإنشاء حساب معلم جديد.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSignup}>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">الاسم الكامل</Label>
                    <Input id="signup-name" placeholder="مثال: الشيخ أحمد" required value={signupName} onChange={(e) => setSignupName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">البريد الإلكتروني</Label>
                    <Input id="signup-email" type="email" placeholder="m@example.com" required value={signupEmail} onChange={(e) => setSignupEmail(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">كلمة المرور</Label>
                    <Input id="signup-password" type="password" required value={signupPassword} onChange={(e) => setSignupPassword(e.target.value)} />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                    إنشاء الحساب
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
