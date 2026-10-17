import { useState, useEffect } from 'react';
import { Bell, X, CheckCircle, AlertTriangle, Clock, FileText, MessageSquare } from 'lucide-react';
import { socket } from '../../services/socket';
import { userAPI } from '../../services/api';
import { showInfo } from '../../utils/toast';
import clsx from 'clsx';

const notificationIcons = {
 DEADLINE: Clock,
 PAYMENT: CheckCircle,
 INSPECTION: AlertTriangle,
 APPROVAL: CheckCircle,
 REJECTION: AlertTriangle,
 SYSTEM: MessageSquare,
 SUBMISSION: FileText,
 GENERAL: MessageSquare,
};

const notificationColors = {
 DEADLINE: 'bg-yellow-50 border-yellow-200 text-yellow-800',
 PAYMENT: 'bg-green-50 border-green-200 text-green-800',
 INSPECTION: 'bg-blue-50 border-blue-200 text-blue-800',
 APPROVAL: 'bg-green-50 border-green-200 text-green-800',
 REJECTION: 'bg-red-50 border-red-200 text-red-800',
 SYSTEM: 'bg-bg border-border text-ink',
 SUBMISSION: 'bg-purple-50 border-purple-200 text-purple-800',
 GENERAL: 'bg-bg border-border text-ink',
};

const isAuthenticated = () => Boolean(localStorage.getItem('gpt_auth'));

// Normalize a socket payload into a client notification record
const socketNotification = (prefix, type, title, message, data) => ({
 id: `${prefix}-${Date.now()}`,
 type,
 title,
 message,
 createdAt: new Date().toISOString(),
 isRead: false,
 data,
});

export default function NotificationCenter() {
 const [notifications, setNotifications] = useState([]);
 const [isOpen, setIsOpen] = useState(false);
 const [unreadCount, setUnreadCount] = useState(0);

 const addNotification = (notification) => {
 setNotifications((prev) => [notification, ...prev].slice(0, 50));
 setUnreadCount((prev) => prev + 1);
 showInfo(notification.message);
 };

 useEffect(() => {
 // Load persisted notifications from the API
 if (isAuthenticated()) {
 userAPI.getNotifications()
 .then((res) => {
 const list = res.data?.notifications || [];
 setNotifications(list);
 setUnreadCount(
 typeof res.data?.unreadCount === 'number'
 ? res.data.unreadCount
 : list.filter((n) => !n.isRead).length
 );
 })
 .catch((err) => console.error('Failed to load notifications:', err));
 }

 if (!socket) {
 return;
 }

 // Listen for real-time notifications
 const handleNewSubmission = (data) => {
 addNotification(socketNotification(
 'submission',
 'SUBMISSION',
 'New Submission',
 `New submission received for project: ${data.projectName || 'Unknown'}`,
 data
 ));
 };

 const handleSubmissionReviewed = (data) => {
 const approved = data.status === 'APPROVED';
 addNotification(socketNotification(
 'review',
 approved ? 'APPROVAL' : 'REJECTION',
 approved ? 'Submission Approved' : 'Submission Rejected',
 `Your submission for ${data.projectName || 'project'} has been ${approved ? 'approved' : 'rejected'}`,
 data
 ));
 };

 const handleProjectUpdated = (data) => {
 addNotification(socketNotification(
 'project',
 'SYSTEM',
 'Project Updated',
 `Project "${data.projectName || 'Unknown'}" has been updated`,
 data
 ));
 };

 const handleDeadlineReminder = (data) => {
 addNotification(socketNotification(
 'deadline',
 'DEADLINE',
 'Deadline Reminder',
 `Upcoming deadline: ${data.message || 'A project deadline is approaching'}`,
 data
 ));
 };

 socket.on('new-submission', handleNewSubmission);
 socket.on('submission-reviewed', handleSubmissionReviewed);
 socket.on('project-updated', handleProjectUpdated);
 socket.on('deadline-reminder', handleDeadlineReminder);

 return () => {
 if (socket) {
 socket.off('new-submission', handleNewSubmission);
 socket.off('submission-reviewed', handleSubmissionReviewed);
 socket.off('project-updated', handleProjectUpdated);
 socket.off('deadline-reminder', handleDeadlineReminder);
 }
 };
 }, []);

 const markAsRead = (notification) => {
 if (notification.isRead) return;
 setNotifications((prev) =>
 prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n))
 );
 setUnreadCount((prev) => Math.max(0, prev - 1));
 // Persist server-side for real notifications (socket ones are ephemeral)
 if (isAuthenticated()) {
 userAPI.markNotificationRead(notification.id).catch(() => {});
 }
 };

 const markAllAsRead = () => {
 setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
 setUnreadCount(0);
 if (isAuthenticated()) {
 userAPI.markAllNotificationsRead().catch(() => {});
 }
 };

 const clearAll = () => {
 setNotifications([]);
 setUnreadCount(0);
 };

 const formatTime = (timestamp) => {
 const date = new Date(timestamp);
 const now = new Date();
 const diff = now - date;
 const minutes = Math.floor(diff / 60000);
 const hours = Math.floor(diff / 3600000);
 const days = Math.floor(diff / 86400000);

 if (minutes < 1) return 'Just now';
 if (minutes < 60) return `${minutes}m ago`;
 if (hours < 24) return `${hours}h ago`;
 if (days < 7) return `${days}d ago`;
 return date.toLocaleDateString();
 };

 return (
 <div className="relative">
 <button
 onClick={() => setIsOpen(!isOpen)}
 aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
 className="relative w-11 h-11 border border-border rounded-xl bg-transparent text-ink flex items-center justify-center hover:bg-hoverbg transition-colors"
 >
 <Bell className="h-5 w-5" strokeWidth={1.75} />
 {unreadCount > 0 && (
 <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 bg-red-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
 {unreadCount > 9 ? '9+' : unreadCount}
 </span>
 )}
 </button>

 {isOpen && (
 <>
 <div
 className="fixed inset-0 z-40"
 onClick={() => setIsOpen(false)}
 />
 <div className="absolute right-0 mt-2 w-96 bg-surface rounded-xl shadow-xl border border-border z-50 max-h-[600px] flex flex-col">
 {/* Header */}
 <div className="p-4 border-b border-border flex items-center justify-between">
 <h3 className="text-lg font-semibold text-ink">Notifications</h3>
 <div className="flex items-center space-x-2">
 {unreadCount > 0 && (
 <button
 onClick={markAllAsRead}
 className="text-sm text-primary-600 hover:text-primary-700 font-medium"
 >
 Mark all read
 </button>
 )}
 <button
 onClick={() => setIsOpen(false)}
 className="text-muted hover:text-soft-fg"
 >
 <X className="h-5 w-5" />
 </button>
 </div>
 </div>

 {/* Notifications List */}
 <div className="flex-1 overflow-y-auto">
 {notifications.length === 0 ? (
 <div className="p-8 text-center text-muted">
 <Bell className="h-12 w-12 mx-auto mb-3 opacity-30" />
 <p>No notifications</p>
 </div>
 ) : (
 <div className="divide-y divide-border">
 {notifications.map((notification) => {
 const Icon = notificationIcons[notification.type] || MessageSquare;
 const colorClass = notificationColors[notification.type] || notificationColors.SYSTEM;

 return (
 <div
 key={notification.id}
 onClick={() => markAsRead(notification)}
 className={clsx(
 'p-4 hover:bg-hoverbg cursor-pointer transition-colors',
 !notification.isRead && 'bg-soft'
 )}
 >
 <div className="flex items-start space-x-3">
 <div className={clsx('p-2 rounded-lg', colorClass)}>
 <Icon className="h-4 w-4" />
 </div>
 <div className="flex-1 min-w-0">
 <p className="text-sm font-medium text-ink">
 {notification.title}
 </p>
 <p className="text-sm text-muted mt-1">
 {notification.message}
 </p>
 <p className="text-xs text-muted mt-2">
 {formatTime(notification.createdAt)}
 </p>
 </div>
 {!notification.isRead && (
 <div className="h-2 w-2 bg-primary-600 rounded-full mt-2" />
 )}
 </div>
 </div>
 );
 })}
 </div>
 )}
 </div>

 {/* Footer */}
 {notifications.length > 0 && (
 <div className="p-3 border-t border-border">
 <button
 onClick={clearAll}
 className="w-full text-sm text-muted hover:text-ink text-center py-2"
 >
 Clear all notifications
 </button>
 </div>
 )}
 </div>
 </>
 )}
 </div>
 );
}
