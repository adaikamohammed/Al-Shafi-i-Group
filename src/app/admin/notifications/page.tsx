"use client";

import React, { useState, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useStudentContext } from '@/context/StudentContext';
import { ProtectedPage } from '@/components/ui/ProtectedPage';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
    Mail,
    Send,
    Clock,
    CheckCircle,
    XCircle,
    Eye,
    Edit,
    Trash2,
    Calendar,
    Filter,
    Search,
    Settings,
    MailCheck
} from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { EmailNotification, EmailNotificationType } from '@/lib/types';
import { getNotificationTypeLabel, getNotificationStatusLabel, testEmailAPI, sendEmailAPI } from '@/lib/emailHelpers';

export default function NotificationsManagementPage() {
    const { user, isSuperAdmin, isManagement } = useAuth();
    const { allUsers, addInternalNotification } = useStudentContext();
    const { toast } = useToast();

    // Sample notifications (will be replaced with Firebase data)
    const [notifications, setNotifications] = useState<EmailNotification[]>([]);
    const [selectedNotification, setSelectedNotification] = useState<EmailNotification | null>(null);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [filterType, setFilterType] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');

    // Create Email Dialog State
    const [isCreateEmailOpen, setIsCreateEmailOpen] = useState(false);
    const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
    const [emailSubject, setEmailSubject] = useState('');
    const [emailBody, setEmailBody] = useState('');

    // Get all sheikhs with their emails
    const allSheikhs = useMemo(() => {
        if (!allUsers || !Array.isArray(allUsers)) return [];
        return allUsers
            .map((userData: any) => ({
                id: userData.uid || userData.id,
                name: userData.displayName || userData.email || 'مستخدم',
                email: userData.notificationEmail || userData.email || '',
                groupName: userData.group || userData.groupName || 'غير محدد',
                role: userData.role
            }))
            .filter(u => u.role !== 'super_admin' && u.email) // Only non-admin users with emails
            .sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    }, [allUsers]);

    // Filtered notifications
    const filteredNotifications = useMemo(() => {
        return notifications.filter(n => {
            const matchesStatus = filterStatus === 'all' || n.status === filterStatus;
            const matchesType = filterType === 'all' || n.type === filterType;
            const matchesSearch = n.recipientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                n.subject.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesStatus && matchesType && matchesSearch;
        });
    }, [notifications, filterStatus, filterType, searchQuery]);

    // Grouped by status
    const pendingNotifications = filteredNotifications.filter(n => n.status === 'pending' || n.status === 'reviewed');
    const scheduledNotifications = filteredNotifications.filter(n => n.status === 'scheduled');
    const sentNotifications = filteredNotifications.filter(n => n.status === 'sent');
    const failedNotifications = filteredNotifications.filter(n => n.status === 'failed');

    const handlePreview = (notification: EmailNotification) => {
        setSelectedNotification(notification);
        setIsEditMode(false);
        setIsPreviewOpen(true);
    };

    const handleEdit = (notification: EmailNotification) => {
        setSelectedNotification(notification);
        setIsEditMode(true);
        setIsPreviewOpen(true);
    };

    const handleSendNow = async (notification: EmailNotification) => {
        const emailResult = await sendEmailAPI(
            notification.recipientEmail,
            notification.subject,
            notification.body
        );

        // Send Internal Notification as well
        const sheikh = allUsers.find(u => u.email === notification.recipientEmail);
        if (sheikh) {
            try {
                await addInternalNotification(
                    sheikh.id,
                    notification.subject,
                    notification.body,
                    notification.type as any
                );
            } catch (err) {
                console.error("Failed to send internal notification:", err);
            }
        }

        if (emailResult.success) {
            toast({
                title: "تم الإرسال",
                description: `تم إرسال ${getNotificationTypeLabel(notification.type)} إلى ${notification.recipientName} (إيميل + إشعار داخلي)`,
            });
        } else {
            toast({
                title: "فشل إرسال الإيميل",
                description: emailResult.error || "حدث خطأ أثناء إرسال البريد، ولكن تم إرسال الإشعار الداخلي إذا كان المستخدم مسجلاً.",
                variant: "destructive",
            });
        }
    };

    const handleDelete = (notificationId: string) => {
        // TODO: Implement delete logic
        setNotifications(prev => prev.filter(n => n.id !== notificationId));
        toast({
            title: "تم الحذف",
            description: "تم حذف الإشعار بنجاح",
        });
    };

    const handleTestEmail = async () => {
        toast({
            title: "جاري الإرسال",
            description: "يتم إرسال بريد اختباري...",
        });

        const result = await testEmailAPI();

        if (result.success) {
            toast({
                title: "✅ نجح الإرسال",
                description: "تم إرسال البريد الاختباري بنجاح. تحقق من صندوق الوارد.",
            });
        } else {
            toast({
                title: "❌ فشل الإرسال",
                description: result.error || "حدث خطأ أثناء الإرسال",
                variant: "destructive",
            });
        }
    };

    const handleSendBulkEmail = async () => {
        if (selectedRecipients.length === 0 || !emailSubject || !emailBody) return;

        const sheikhsToSend = allSheikhs.filter(s => selectedRecipients.includes(s.id));
        let successCount = 0;
        let failCount = 0;

        toast({
            title: "جاري الإرسال",
            description: `يتم إرسال ${sheikhsToSend.length} رسالة...`,
        });

        for (const sheikh of sheikhsToSend) {
            // Send External Email
            const emailResult = await sendEmailAPI(
                sheikh.email,
                emailSubject,
                emailBody
            );

            // Send Internal Notification
            try {
                await addInternalNotification(
                    sheikh.id,
                    emailSubject,
                    emailBody,
                    'admin_broadcast'
                );
            } catch (err) {
                console.error(`Failed to send internal notification to ${sheikh.name}:`, err);
            }

            if (emailResult.success) {
                successCount++;
            } else {
                failCount++;
            }
        }

        // Reset form
        setSelectedRecipients([]);
        setEmailSubject('');
        setEmailBody('');
        setIsCreateEmailOpen(false);

        toast({
            title: successCount > 0 ? "✅ نجح الإرسال" : "❌ فشل الإرسال",
            description: `تم إرسال ${successCount} رسالة بنجاح${failCount > 0 ? `. فشل ${failCount}` : ''}`,
            variant: failCount > 0 ? "destructive" : "default",
        });
    };

    const getStatusBadge = (status: EmailNotification['status']) => {
        const variants: Record<EmailNotification['status'], { variant: any; icon: any }> = {
            pending: { variant: 'secondary', icon: Clock },
            reviewed: { variant: 'default', icon: Eye },
            scheduled: { variant: 'outline', icon: Calendar },
            sent: { variant: 'default', icon: CheckCircle },
            failed: { variant: 'destructive', icon: XCircle },
        };

        const { variant, icon: Icon } = variants[status];
        return (
            <Badge variant={variant as any} className="gap-1">
                <Icon className="h-3 w-3" />
                {getNotificationStatusLabel(status)}
            </Badge>
        );
    };

    return (
        <ProtectedPage>
            <div className="container mx-auto p-6 max-w-7xl">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-3xl font-bold mb-2">📧 إدارة الإشعارات البريدية</h1>
                    <p className="text-muted-foreground">
                        إدارة ومراجعة الرسائل البريدية قبل إرسالها للمشايخ
                    </p>
                </div>

                {/* Settings Card */}
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Settings className="h-5 w-5" />
                            إعدادات البريد الإلكتروني
                        </CardTitle>
                        <CardDescription>
                            الإعدادات الحالية للبريد الإلكتروني
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label className="text-sm text-muted-foreground">البريد المرسل</Label>
                                <p className="font-medium">alshafiischool39@gmail.com</p>
                            </div>
                            <div>
                                <Label className="text-sm text-muted-foreground">اسم المرسل</Label>
                                <p className="font-medium">المدرسة القرآنية للإمام الشافعي</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button onClick={handleTestEmail} variant="outline" size="sm">
                                <MailCheck className="h-4 w-4 mr-2" />
                                إرسال بريد اختباري
                            </Button>
                            <Button onClick={() => setIsCreateEmailOpen(true)} size="sm">
                                <Mail className="h-4 w-4 mr-2" />
                                إنشاء رسالة جديدة
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Create Email Dialog */}
                <Dialog open={isCreateEmailOpen} onOpenChange={setIsCreateEmailOpen}>
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>إنشاء رسالة بريدية جديدة</DialogTitle>
                            <DialogDescription>
                                اختر المستلمين واكتب محتوى الرسالة
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-6">
                            {/* Recipient Selection */}
                            <div className="space-y-3">
                                <Label className="text-base font-semibold">المستلمون</Label>

                                {/* Quick Actions */}
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            const allIds = allSheikhs.map(s => s.id);
                                            setSelectedRecipients(allIds);
                                        }}
                                    >
                                        تحديد الكل ({allSheikhs.length})
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setSelectedRecipients([])}
                                    >
                                        إلغاء التحديد
                                    </Button>
                                </div>

                                {/* Sheikh List with Checkboxes */}
                                <div className="border rounded-lg p-4 max-h-64 overflow-y-auto space-y-2">
                                    {allSheikhs.length === 0 ? (
                                        <p className="text-sm text-muted-foreground text-center py-4">
                                            لا توجد حسابات مشايخ مسجلة
                                        </p>
                                    ) : (
                                        allSheikhs.map((sheikh) => (
                                            <div
                                                key={sheikh.id}
                                                className="flex items-center gap-3 p-2 hover:bg-muted/50 rounded"
                                            >
                                                <input
                                                    type="checkbox"
                                                    id={`sheikh-${sheikh.id}`}
                                                    checked={selectedRecipients.includes(sheikh.id)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setSelectedRecipients([...selectedRecipients, sheikh.id]);
                                                        } else {
                                                            setSelectedRecipients(selectedRecipients.filter(id => id !== sheikh.id));
                                                        }
                                                    }}
                                                    className="h-4 w-4"
                                                />
                                                <label
                                                    htmlFor={`sheikh-${sheikh.id}`}
                                                    className="flex-1 cursor-pointer"
                                                >
                                                    <p className="font-medium">{sheikh.name}</p>
                                                    <p className="text-sm text-muted-foreground">{sheikh.email}</p>
                                                    <p className="text-xs text-muted-foreground">{sheikh.groupName}</p>
                                                </label>
                                            </div>
                                        ))
                                    )}
                                </div>

                                <div className="text-sm text-muted-foreground">
                                    تم تحديد {selectedRecipients.length} من أصل {allSheikhs.length}
                                </div>
                            </div>

                            {/* Email Subject */}
                            <div className="space-y-2">
                                <Label>موضوع الرسالة</Label>
                                <Input
                                    value={emailSubject}
                                    onChange={(e) => setEmailSubject(e.target.value)}
                                    placeholder="مثال: التقرير الأسبوعي للفوج الأول"
                                />
                            </div>

                            {/* Email Body */}
                            <div className="space-y-2">
                                <Label>محتوى الرسالة</Label>
                                <Textarea
                                    value={emailBody}
                                    onChange={(e) => setEmailBody(e.target.value)}
                                    placeholder="اكتب محتوى الرسالة هنا..."
                                    rows={10}
                                    className="font-mono"
                                />
                                <p className="text-xs text-muted-foreground">
                                    يمكنك استخدام HTML للتنسيق
                                </p>
                            </div>
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsCreateEmailOpen(false)}>
                                إلغاء
                            </Button>
                            <Button
                                onClick={handleSendBulkEmail}
                                disabled={selectedRecipients.length === 0 || !emailSubject || !emailBody}
                            >
                                <Send className="h-4 w-4 mr-2" />
                                إرسال ({selectedRecipients.length})
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Filters */}
                <Card className="mb-6">
                    <CardContent className="pt-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <Label>البحث</Label>
                                <div className="relative">
                                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="ابحث عن مستلم أو موضوع..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pr-10"
                                    />
                                </div>
                            </div>
                            <div>
                                <Label>نوع الرسالة</Label>
                                <Select value={filterType} onValueChange={setFilterType}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">جميع الأنواع</SelectItem>
                                        <SelectItem value="weekly_report">التقرير الأسبوعي</SelectItem>
                                        <SelectItem value="monthly_report">التقرير الشهري</SelectItem>
                                        <SelectItem value="absence_alert">تنبيه الغياب</SelectItem>
                                        <SelectItem value="achievement_newsletter">نشرة الإنجازات</SelectItem>
                                        <SelectItem value="payment_reminder">تذكير بالدفعات</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>الحالة</Label>
                                <Select value={filterStatus} onValueChange={setFilterStatus}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">جميع الحالات</SelectItem>
                                        <SelectItem value="pending">معلق</SelectItem>
                                        <SelectItem value="reviewed">تمت المراجعة</SelectItem>
                                        <SelectItem value="scheduled">مجدول</SelectItem>
                                        <SelectItem value="sent">تم الإرسال</SelectItem>
                                        <SelectItem value="failed">فشل</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Notifications Tabs */}
                <Tabs defaultValue="pending" className="space-y-4">
                    <TabsList className="grid w-full grid-cols-4">
                        <TabsTrigger value="pending">
                            معلقة ({pendingNotifications.length})
                        </TabsTrigger>
                        <TabsTrigger value="scheduled">
                            مجدولة ({scheduledNotifications.length})
                        </TabsTrigger>
                        <TabsTrigger value="sent">
                            مرسلة ({sentNotifications.length})
                        </TabsTrigger>
                        <TabsTrigger value="failed">
                            فشلت ({failedNotifications.length})
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="pending" className="space-y-4">
                        <NotificationTable
                            notifications={pendingNotifications}
                            onPreview={handlePreview}
                            onEdit={handleEdit}
                            onSend={handleSendNow}
                            onDelete={handleDelete}
                            getStatusBadge={getStatusBadge}
                        />
                    </TabsContent>

                    <TabsContent value="scheduled">
                        <NotificationTable
                            notifications={scheduledNotifications}
                            onPreview={handlePreview}
                            onEdit={handleEdit}
                            onSend={handleSendNow}
                            onDelete={handleDelete}
                            getStatusBadge={getStatusBadge}
                        />
                    </TabsContent>

                    <TabsContent value="sent">
                        <NotificationTable
                            notifications={sentNotifications}
                            onPreview={handlePreview}
                            getStatusBadge={getStatusBadge}
                            readOnly
                        />
                    </TabsContent>

                    <TabsContent value="failed">
                        <NotificationTable
                            notifications={failedNotifications}
                            onPreview={handlePreview}
                            onSend={handleSendNow}
                            onDelete={handleDelete}
                            getStatusBadge={getStatusBadge}
                        />
                    </TabsContent>
                </Tabs>

                {/* Preview/Edit Dialog */}
                <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
                    <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>
                                {isEditMode ? 'تعديل الرسالة' : 'معاينة الرسالة'}
                            </DialogTitle>
                            <DialogDescription>
                                {selectedNotification && getNotificationTypeLabel(selectedNotification.type)}
                            </DialogDescription>
                        </DialogHeader>

                        {selectedNotification && (
                            <div className="space-y-4">
                                <div>
                                    <Label>المستلم</Label>
                                    <Input value={selectedNotification.recipientName} disabled />
                                </div>

                                <div>
                                    <Label>البريد الإلكتروني</Label>
                                    <Input value={selectedNotification.recipientEmail} disabled />
                                </div>

                                <div>
                                    <Label>الموضوع</Label>
                                    {isEditMode ? (
                                        <Input
                                            value={selectedNotification.subject}
                                            onChange={(e) => setSelectedNotification({
                                                ...selectedNotification,
                                                subject: e.target.value
                                            })}
                                        />
                                    ) : (
                                        <Input value={selectedNotification.subject} disabled />
                                    )}
                                </div>

                                <div>
                                    <Label>محتوى الرسالة</Label>
                                    {isEditMode ? (
                                        <Textarea
                                            value={selectedNotification.body}
                                            onChange={(e) => setSelectedNotification({
                                                ...selectedNotification,
                                                body: e.target.value
                                            })}
                                            rows={10}
                                            className="font-mono text-sm"
                                        />
                                    ) : (
                                        <div
                                            className="border rounded-md p-4 bg-muted/50 max-h-96 overflow-y-auto"
                                            dangerouslySetInnerHTML={{ __html: selectedNotification.body }}
                                        />
                                    )}
                                </div>
                            </div>
                        )}

                        <DialogFooter>
                            {isEditMode ? (
                                <>
                                    <Button variant="outline" onClick={() => setIsEditMode(false)}>
                                        إلغاء
                                    </Button>
                                    <Button onClick={() => {
                                        // TODO: Save changes
                                        toast({ title: "تم الحفظ", description: "تم حفظ التعديلات بنجاح" });
                                        setIsEditMode(false);
                                    }}>
                                        حفظ التعديلات
                                    </Button>
                                </>
                            ) : (
                                <>
                                    <Button variant="outline" onClick={() => setIsPreviewOpen(false)}>
                                        إغلاق
                                    </Button>
                                    <Button variant="outline" onClick={() => setIsEditMode(true)}>
                                        <Edit className="h-4 w-4 mr-2" />
                                        تعديل
                                    </Button>
                                    {selectedNotification && selectedNotification.status !== 'sent' && (
                                        <Button onClick={() => {
                                            handleSendNow(selectedNotification);
                                            setIsPreviewOpen(false);
                                        }}>
                                            <Send className="h-4 w-4 mr-2" />
                                            إرسال الآن
                                        </Button>
                                    )}
                                </>
                            )}
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </ProtectedPage>
    );
}

// Notification Table Component
function NotificationTable({
    notifications,
    onPreview,
    onEdit,
    onSend,
    onDelete,
    getStatusBadge,
    readOnly = false,
}: {
    notifications: EmailNotification[];
    onPreview?: (n: EmailNotification) => void;
    onEdit?: (n: EmailNotification) => void;
    onSend?: (n: EmailNotification) => void;
    onDelete?: (id: string) => void;
    getStatusBadge: (status: EmailNotification['status']) => React.ReactNode;
    readOnly?: boolean;
}) {
    if (notifications.length === 0) {
        return (
            <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                    لا توجد إشعارات في هذه الفئة
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>النوع</TableHead>
                        <TableHead>المستلم</TableHead>
                        <TableHead>الموضوع</TableHead>
                        <TableHead>الحالة</TableHead>
                        <TableHead>التاريخ</TableHead>
                        <TableHead className="text-left">الإجراءات</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {notifications.map((notification) => (
                        <TableRow key={notification.id}>
                            <TableCell>
                                <Badge variant="outline">
                                    {getNotificationTypeLabel(notification.type)}
                                </Badge>
                            </TableCell>
                            <TableCell className="font-medium">
                                {notification.recipientName}
                            </TableCell>
                            <TableCell className="max-w-xs truncate">
                                {notification.subject}
                            </TableCell>
                            <TableCell>
                                {getStatusBadge(notification.status)}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                                {format(new Date(notification.createdAt), 'yyyy/MM/dd HH:mm', { locale: ar })}
                            </TableCell>
                            <TableCell>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => onPreview?.(notification)}
                                    >
                                        <Eye className="h-4 w-4" />
                                    </Button>
                                    {!readOnly && onEdit && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => onEdit(notification)}
                                        >
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                    )}
                                    {!readOnly && onSend && notification.status !== 'sent' && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => onSend(notification)}
                                        >
                                            <Send className="h-4 w-4" />
                                        </Button>
                                    )}
                                    {!readOnly && onDelete && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => onDelete(notification.id)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </Card>
    );
}
