import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, X, CheckCircle, AlertTriangle, Clock, FileText, MessageSquare, ChevronRight, Trash2, Inbox } from 'lucide-react';
import { socket } from '../../services/socket';
import { userAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { showInfo, showError } from '../../utils/toast';
import clsx from 'clsx';

const TYPE_META = {
 DEADLINE:   { icon: Clock,          chip: 'bg-yellow-100 text-yellow-700', iconWrap: 'bg-yellow-100 text-yellow-700' },
 PAYMENT:    { icon: CheckCircle,    chip: 'bg-green-100 text-green-700',   iconWrap: 'bg-green-100 text-green-700' },
 INSPECTION: { icon: AlertTriangle,  chip: 'bg-blue-100 text-blue-700',     iconWrap: 'bg-blue-100 text-blue-700' },
 APPROVAL:   { icon: CheckCircle,    chip: 'bg-green-100 text-green-700',   iconWrap: 'bg-green-100 text-green-700' },
 REJECTION:  { icon: AlertTriangle,  chip: 'bg-red-100 text-red-700',       iconWrap: 'bg-red-100 text-red-700' },
 SYSTEM:     { icon: MessageSquare,  chip: 'bg-hoverbg text-muted',         iconWrap: 'bg-hoverbg text-muted' },
 SUBMISSION: { icon: FileText,       chip: 'bg-purple-100 text-purple-700', iconWrap: 'bg-purple-100 text-purple-700' },
 GENERAL:    { icon: MessageSquare,  chip: 'bg-hoverbg text-muted',         iconWrap: 'bg-hoverbg text-muted' },
};

const metaFor = (type) => TYPE_META[type] || TYPE_META.GENERAL;

const isEphemeral = (id) => typeof id === 'string' && !/^[0-9a-f-]{36}$/i.test(id);

// Where a notification deep-links to, based on its data payload and viewer role
const linkFor = (notification, role) => {
 const data = notification.data;
 if (!data || typeof data !== 'object') return null;
 if (data.projectId) return `/projects/${data.projectId}`;
 if (data.submissionId) {
   return role === 'CONTRACTOR' ? '/contractor/dashboard' : '/me/dashboard';
 }
 return null;
};

const socketNotification = (prefix, type, title, message, data) => ({
 id: `${prefix}-${Date.now()}`,
 type,
 title,
 message,
 createdAt: new Date().toISOString(),
 isRead: false,
 isUrgent: type === 'REJECTION',
 data,
});

const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); };

const groupLabel = (timestamp) => {
 const today = startOfDay(new Date());
 const day = startOfDay(new Date(timestamp));
 const diffDays = Math.round((today - day) / 86400000);
 if (diffDays <= 0) return 'Today';
 if (diffDays === 1) return 'Yesterday';
 if (diffDays < 7) return 'This week';
 return 'Earlier';
};

const GROUP_ORDER = ['Today', 'Yesterday', 'This week', 'Earlier'];

const formatTime = (timestamp) => {
 const date = new Date(timestamp);
 const diff = Date.now() - date.getTime();
 const minutes = Math.floor(diff / 60000);
 const hours = Math.floor(diff / 3600000);
 if (minutes < 1) return 'Just now';
 if (minutes < 60) return `${minutes}m ago`;
 if (hours < 24) {
   return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
 }
 return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

export default function NotificationCenter() {
 const [notifications, setNotifications] = useState([]);
 const [isOpen, setIsOpen] = useState(false);
 const [loading, setLoading] = useState(true);
 const [unreadCount, setUnreadCount] = useState(0);
 const navigate = useNavigate();
 const { user } = useAuth();

 const addNotification = useCallback((notification) => {
   setNotifications((prev) => {
     // Drop an identical socket event that fired twice in the same tick
     if (prev.some((n) => n.type === notification.type && n.message === notification.message && Math.abs(new Date(n.createdAt) - new Date(notification.createdAt)) < 5000)) {
       return prev;
     }
     return [notification, ...prev].slice(0, 50);
   });
   setUnreadCount((prev) => prev + 1);
   (notification.isUrgent ? showError : showInfo)(`${notification.title} — ${notification.message}`);
 }, []);

 useEffect(() => {
   setLoading(true);
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
     .catch((err) => console.error('Failed to load notifications:', err))
     .finally(() => setLoading(false));

   if (!socket) return;

   const handleNewSubmission = (data) => {
     addNotification(socketNotification(
       'submission', 'SUBMISSION', 'New submission received',
       `${data.contractorName || 'A contractor'} submitted an update for ${data.projectName || 'a project'}`,
       data
     ));
   };
   const handleSubmissionReviewed = (data) => {
     const approved = data.status === 'APPROVED';
     addNotification(socketNotification(
       'review', approved ? 'APPROVAL' : 'REJECTION',
       approved ? 'Submission approved' : 'Submission needs attention',
       approved
         ? `Your submission for ${data.projectName || 'the project'} was approved`
         : `Your submission for ${data.projectName || 'the project'} was ${(data.status || 'sent back').toString().toLowerCase().replace(/_/g, ' ')}`,
       data
     ));
   };
   const handleProjectUpdated = (data) => {
     addNotification(socketNotification(
       'project', 'SYSTEM', 'Project updated',
       `"${data.projectName || 'A project'}" has been updated`,
       data
     ));
   };
   const handleDeadlineReminder = (data) => {
     addNotification(socketNotification(
       'deadline', 'DEADLINE', 'Deadline reminder',
       data.message || 'A project deadline is approaching',
       data
     ));
   };

   socket.on('new-submission', handleNewSubmission);
   socket.on('submission-reviewed', handleSubmissionReviewed);
   socket.on('project-updated', handleProjectUpdated);
   socket.on('deadline-reminder', handleDeadlineReminder);
   return () => {
     socket.off('new-submission', handleNewSubmission);
     socket.off('submission-reviewed', handleSubmissionReviewed);
     socket.off('project-updated', handleProjectUpdated);
     socket.off('deadline-reminder', handleDeadlineReminder);
   };
 }, [addNotification]);

 // Close on Escape while the panel is open
 useEffect(() => {
   if (!isOpen) return;
   const onKey = (e) => { if (e.key === 'Escape') setIsOpen(false); };
   document.addEventListener('keydown', onKey);
   return () => document.removeEventListener('keydown', onKey);
 }, [isOpen]);

 const markAsRead = (notification) => {
   if (notification.isRead) return;
   setNotifications((prev) => prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n)));
   setUnreadCount((prev) => Math.max(0, prev - 1));
   if (!isEphemeral(notification.id)) {
     userAPI.markNotificationRead(notification.id).catch(() => {});
   }
 };

 const removeNotification = (notification) => {
   setNotifications((prev) => {
     const target = prev.find((n) => n.id === notification.id);
     if (target && !target.isRead) setUnreadCount((c) => Math.max(0, c - 1));
     return prev.filter((n) => n.id !== notification.id);
   });
   if (!isEphemeral(notification.id)) {
     userAPI.deleteNotification(notification.id).catch(() => {});
   }
 };

 const markAllAsRead = () => {
   setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
   setUnreadCount(0);
   userAPI.markAllNotificationsRead().catch(() => {});
 };

 const clearAll = () => {
   setNotifications([]);
   setUnreadCount(0);
   userAPI.deleteAllNotifications().catch(() => {});
 };

 const open = (notification) => {
   markAsRead(notification);
   const to = linkFor(notification, user?.role);
   if (to) {
     setIsOpen(false);
     navigate(to);
   }
 };

 const groups = useMemo(() => {
   const sorted = [...notifications].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
   const map = new Map();
   for (const n of sorted) {
     const label = groupLabel(n.createdAt);
     if (!map.has(label)) map.set(label, []);
     map.get(label).push(n);
   }
   return GROUP_ORDER.filter((g) => map.has(g)).map((g) => ({ label: g, items: map.get(g) }));
 }, [notifications]);

 return (
   <div className="relative">
     <button
       onClick={() => setIsOpen(!isOpen)}
       aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
       aria-expanded={isOpen}
       aria-haspopup="dialog"
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
         <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
         <div
           role="dialog"
           aria-modal="true"
           aria-label="Notifications"
           className="absolute right-0 mt-2 w-[min(24rem,calc(100vw-1.5rem))] bg-surface rounded-xl shadow-xl border border-border z-50 max-h-[min(36rem,calc(100vh-6rem))] flex flex-col"
         >
           {/* Header */}
           <div className="px-4 py-3 border-b border-border flex items-center justify-between flex-none">
             <h3 className="text-base font-semibold text-ink">Notifications</h3>
             <div className="flex items-center gap-1">
               {unreadCount > 0 && (
                 <button onClick={markAllAsRead} className="text-xs text-primary-600 hover:text-primary-700 font-medium px-2 py-1 rounded-lg hover:bg-hoverbg">
                   Mark all read
                 </button>
               )}
               <button onClick={() => setIsOpen(false)} aria-label="Close notifications" className="w-8 h-8 rounded-lg text-muted hover:bg-hoverbg flex items-center justify-center">
                 <X className="h-4 w-4" />
               </button>
             </div>
           </div>

           {/* List */}
           <div className="flex-1 overflow-y-auto">
             {loading ? (
               <div className="p-4 space-y-3" aria-label="Loading notifications">
                 {[0, 1, 2].map((i) => (
                   <div key={i} className="flex gap-3 animate-pulse">
                     <div className="w-9 h-9 rounded-lg bg-hoverbg flex-none" />
                     <div className="flex-1 space-y-2">
                       <div className="h-3 w-2/3 rounded bg-hoverbg" />
                       <div className="h-3 w-full rounded bg-hoverbg" />
                     </div>
                   </div>
                 ))}
               </div>
             ) : notifications.length === 0 ? (
               <div className="p-10 text-center text-muted">
                 <Inbox className="h-10 w-10 mx-auto mb-3 opacity-30" />
                 <p className="text-sm font-medium text-ink">You're all caught up</p>
                 <p className="text-xs mt-1">New submissions, reviews and deadlines will appear here.</p>
               </div>
             ) : (
               groups.map((group) => (
                 <section key={group.label}>
                   <h4 className="sticky top-0 z-10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted bg-surface/95 backdrop-blur border-b border-border">
                     {group.label}
                   </h4>
                   <ul className="divide-y divide-border">
                     {group.items.map((notification) => {
                       const meta = metaFor(notification.type);
                       const Icon = meta.icon;
                       const to = linkFor(notification, user?.role);
                       return (
                         <li
                           key={notification.id}
                           onClick={() => open(notification)}
                           onKeyDown={(e) => { if (e.key === 'Enter') open(notification); }}
                           role="button"
                           tabIndex={0}
                           className={clsx(
                             'group relative px-4 py-3 cursor-pointer transition-colors hover:bg-hoverbg focus:outline-none focus-visible:bg-hoverbg',
                             !notification.isRead && 'bg-soft',
                             notification.isUrgent && !notification.isRead && 'border-l-2 border-l-red-500'
                           )}
                         >
                           <div className="flex items-start gap-3">
                             <div className={clsx('p-2 rounded-lg flex-none', meta.iconWrap)}>
                               <Icon className="h-4 w-4" />
                             </div>
                             <div className="flex-1 min-w-0">
                               <div className="flex items-center gap-2">
                                 <p className={clsx('text-sm truncate', notification.isRead ? 'font-medium text-muted' : 'font-semibold text-ink')}>
                                   {notification.title}
                                 </p>
                                 {notification.isUrgent && (
                                   <span className="flex-none text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-red-100 text-red-700">Urgent</span>
                                 )}
                               </div>
                               <p className={clsx('text-sm mt-0.5 line-clamp-2', notification.isRead ? 'text-muted' : 'text-soft-fg')}>
                                 {notification.message}
                               </p>
                               <p className="text-xs text-muted mt-1.5 flex items-center gap-1">
                                 {formatTime(notification.createdAt)}
                                 {to && (
                                   <>
                                     <span aria-hidden="true">·</span>
                                     <span className="inline-flex items-center gap-0.5 text-primary-600 font-medium">
                                       View <ChevronRight className="h-3 w-3" />
                                     </span>
                                   </>
                                 )}
                               </p>
                             </div>
                             <div className="flex flex-col items-center gap-2 flex-none">
                               {!notification.isRead && <span className="h-2 w-2 bg-primary-600 rounded-full mt-1.5" aria-label="Unread" />}
                               <button
                                 onClick={(e) => { e.stopPropagation(); removeNotification(notification); }}
                                 aria-label="Delete notification"
                                 className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 w-7 h-7 rounded-lg text-muted hover:text-red-600 hover:bg-red-50 flex items-center justify-center transition-opacity"
                               >
                                 <Trash2 className="h-3.5 w-3.5" />
                               </button>
                             </div>
                           </div>
                         </li>
                       );
                     })}
                   </ul>
                 </section>
               ))
             )}
           </div>

           {/* Footer */}
           {notifications.length > 0 && (
             <div className="p-2 border-t border-border flex-none">
               <button onClick={clearAll} className="w-full text-xs text-muted hover:text-ink text-center py-2 rounded-lg hover:bg-hoverbg">
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
