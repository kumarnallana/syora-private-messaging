"use client";
import {
  Avatar,
  Button,
  IconButton,
  Loading,
  LogoMark,
  Modal,
} from "@/components/shared/ui";
import { useApp } from "@/stores/use-app";
import { cn } from "@/utils/cn";
import {
  ArrowLeft,
  Bell,
  CheckCheck,
  CircleDot,
  LogOut,
  MessageCircle,
  MessageSquare,
  Settings2,
  Shield,
  ShieldAlert,
  Trash2,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { AdminNotificationEvent } from "@/types";
export function Shell({ children }: { children: React.ReactNode }) {
  const {
    me,
    services,
    preferences,
    sessionReady,
    sessionError,
    connection,
    friendships = [],
    conversations = [],
  } = useApp();
  const pathname = usePathname();
  const router = useRouter();
  const [logout, setLogout] = useState(false);
  const [adminNotification, setAdminNotification] = useState<AdminNotificationEvent>();
  const [isPaused, setIsPaused] = useState(false);
  const [showPushPrompt, setShowPushPrompt] = useState(false);
  const [pushPromptPending, setPushPromptPending] = useState(false);
  const [pushPromptError, setPushPromptError] = useState("");
  const [showAdminDrawer, setShowAdminDrawer] = useState(false);
  const [adminHistory, setAdminHistory] = useState<AdminNotificationEvent[]>([]);
  const [unreadAdminCount, setUnreadAdminCount] = useState(0);

  const loadAdminHistory = useCallback(async () => {
    if (me?.role !== "admin") return;
    try {
      const res = await services.getAdminNotificationHistory();
      setAdminHistory(res.items);
      setUnreadAdminCount(res.unreadCount);
    } catch {
      try {
        const stored: AdminNotificationEvent[] = JSON.parse(
          localStorage.getItem("syora:admin-notifications-history") || "[]",
        );
        setAdminHistory(stored);
        setUnreadAdminCount(stored.filter((item) => !item.read).length);
      } catch {}
    }
  }, [me?.role, services]);

  useEffect(() => {
    if (me?.role !== "admin") return;
    void loadAdminHistory();
    const handleUpdate = () => void loadAdminHistory();
    window.addEventListener("syora:admin-history-updated", handleUpdate);
    return () =>
      window.removeEventListener("syora:admin-history-updated", handleUpdate);
  }, [loadAdminHistory, me?.role]);

  const incomingFriendRequests = friendships.filter(
    (item) => item.to === me?.id && item.status === "pending",
  ).length;

  const unreadChats = conversations.reduce(
    (total, item) => total + (item.unread || 0),
    0,
  );

  const navLinks = [
    { href: "/chats", label: "Chats", icon: MessageCircle, badge: unreadChats },
    { href: "/status", label: "Status", icon: CircleDot },
    {
      href: "/contacts",
      label: "Contacts",
      icon: Users,
      badge: incomingFriendRequests,
    },
    {
      href: "/settings",
      label: "Settings",
      icon: Settings2,
      badge:
        me?.role === "admin" && unreadAdminCount > 0
          ? unreadAdminCount
          : undefined,
    },
  ];
  useEffect(() => {
    window.dispatchEvent(new Event("syora:navigation"));
  }, [pathname]);
  useEffect(() => {
    const receive = (event: Event) => {
      const notification = (event as CustomEvent<AdminNotificationEvent>).detail;
      const activeConversation = pathname === "/chats" ? new URLSearchParams(window.location.search).get("conversation") : null;
      try {
        const stored: AdminNotificationEvent[] = JSON.parse(localStorage.getItem("syora:admin-notifications-history") || "[]");
        const next = [{ ...notification, read: false }, ...stored.filter(item => item.id !== notification.id)].slice(0, 50);
        localStorage.setItem("syora:admin-notifications-history", JSON.stringify(next));
        window.dispatchEvent(new CustomEvent("syora:admin-history-updated"));
      } catch {}

      if (document.visibilityState === "visible" && notification.conversationId === activeConversation) return;
      setAdminNotification(notification);
      setIsPaused(false);
    };
    window.addEventListener("syora:admin-notification", receive);
    return () => window.removeEventListener("syora:admin-notification", receive);
  }, [pathname]);
  useEffect(() => {
    if (!adminNotification || isPaused) return;
    const timer = window.setTimeout(() => setAdminNotification(undefined), 6500);
    return () => window.clearTimeout(timer);
  }, [adminNotification, isPaused]);
  useEffect(() => {
    const viewport = window.visualViewport;
    const update = () => {
      document.documentElement.style.setProperty("--syora-viewport-height", `${Math.round(viewport?.height || window.innerHeight)}px`);
      document.documentElement.style.setProperty("--syora-viewport-top", `${Math.round(viewport?.offsetTop || 0)}px`);
    };
    update();
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      document.documentElement.style.removeProperty("--syora-viewport-height");
      document.documentElement.style.removeProperty("--syora-viewport-top");
    };
  }, []);
  useEffect(() => {
    if (sessionReady && !me) router.replace("/login");
  }, [sessionReady, me, router]);
  useEffect(() => {
    if (me?.role !== "admin" || !("Notification" in window) || Notification.permission !== "default") return;
    if (sessionStorage.getItem("syora:push-prompt-dismissed") === "true") return;
    void services.getAdminNotificationSettings().then(settings => setShowPushPrompt(settings.pushSupported && !settings.pushEnabled)).catch(() => {});
  }, [me?.id, me?.role, services]);
  if (!sessionReady) return <Loading />;
  if (sessionError) return <div className="recovery-state" role="alert"><Shield size={28}/><h1>Your space could not be loaded</h1><p>{sessionError}</p><Button variant="secondary" onClick={() => void services.retryBootstrap()}>Try again</Button></div>;
  if (!me) return <Loading />;
  return (
    <main
      className={cn(
        "app-shell",
        preferences.compact && "is-compact",
      )}
    >
      <aside className="rail">
        <Link href="/chats" aria-label="SYORA home" className="rail__brand">
          <LogoMark />
        </Link>
        <nav className="rail__nav">
          {navLinks.map(({ href, label, icon: Icon, badge }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "rail-link",
                pathname === href && "is-active",
              )}
              title={label}
              aria-label={badge && badge > 0 ? `${label} (${badge} new)` : label}
              aria-current={pathname === href ? "page" : undefined}
            >
              <span className="rail-icon-wrap">
                <Icon size={23} />
                {Boolean(badge && badge > 0) && (
                  <span className="rail-badge" aria-hidden="true">
                    {badge! > 99 ? "99+" : badge}
                  </span>
                )}
              </span>
              <span>{label}</span>
            </Link>
          ))}
        </nav>
        <div className="rail-bottom">
          {me?.role === "admin" && (
            <button
              type="button"
              className={cn("rail-link rail-bell-button", showAdminDrawer && "is-active")}
              title="Admin Notification Center"
              aria-label={`Admin alerts (${unreadAdminCount} unread)`}
              onClick={() => {
                setShowAdminDrawer((prev) => !prev);
                if (!showAdminDrawer && unreadAdminCount > 0) {
                  void services.markAdminNotificationsRead();
                  setUnreadAdminCount(0);
                }
              }}
            >
              <span className="rail-icon-wrap">
                <Bell size={21} />
                {unreadAdminCount > 0 && (
                  <span className="rail-badge rail-badge--alert" aria-hidden="true">
                    {unreadAdminCount > 99 ? "99+" : unreadAdminCount}
                  </span>
                )}
              </span>
              <span>Alerts</span>
            </button>
          )}
          <button
            className="rail-link rail-link--danger"
            title="Log out"
            aria-label="Log out"
            onClick={() => setLogout(true)}
          >
            <LogOut size={21} />
          </button>
          <Link
            href="/profile"
            title="Your profile"
            aria-label="Your profile"
            className={cn(
              "profile-link",
              pathname === "/profile" && "is-active",
            )}
          >
            <Avatar user={me} size="small" />
          </Link>
        </div>
      </aside>
      <div className="app-content">{children}</div>
      {connection === "connecting" && <div className="connection-banner" role="status">Connecting…</div>}
      {connection === "offline" && <div className="connection-banner" role="status">Offline — new activity will reconnect automatically.</div>}
      {showAdminDrawer && (
        <aside className="admin-notifications-drawer" role="dialog" aria-label="Admin Notification Center">
          <header className="admin-drawer-header">
            <div className="admin-drawer-header__title">
              <span className="admin-drawer-pulse" title="Real-time alert channel active" />
              <Bell size={18} />
              <h2>Admin Alerts</h2>
              {adminHistory.length > 0 && (
                <span className="admin-notification-count">{adminHistory.length}</span>
              )}
            </div>
            <div className="admin-drawer-header__actions">
              {unreadAdminCount > 0 && (
                <button
                  type="button"
                  className="button secondary small"
                  title="Mark all as read"
                  onClick={() => {
                    void services.markAdminNotificationsRead();
                    setUnreadAdminCount(0);
                  }}
                >
                  <CheckCheck size={14} /> Read
                </button>
              )}
              {adminHistory.length > 0 && (
                <button
                  type="button"
                  className="button secondary small"
                  title="Clear history"
                  onClick={() => {
                    void services.clearAdminNotificationHistory();
                    setAdminHistory([]);
                    setUnreadAdminCount(0);
                  }}
                >
                  <Trash2 size={13} />
                </button>
              )}
              <button
                type="button"
                className="icon-button"
                title="Close drawer"
                aria-label="Close drawer"
                onClick={() => setShowAdminDrawer(false)}
              >
                <X size={18} />
              </button>
            </div>
          </header>
          <div className="admin-drawer-content">
            {adminHistory.length === 0 ? (
              <div className="admin-drawer-empty">
                <Bell size={32} />
                <p>No admin alerts recorded yet.</p>
                <small>Real-time security alerts and user sign-in events will appear here.</small>
                <button
                  type="button"
                  className="button secondary small"
                  onClick={() => {
                    void services.sendTestAdminNotification("ADMIN_TEST_ALERT");
                  }}
                >
                  Send test alert
                </button>
              </div>
            ) : (
              <div className="admin-drawer-list">
                {adminHistory.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={cn(
                      "admin-drawer-item",
                      !item.read && "is-unread",
                      item.type === "ADMIN_LOGIN_FAILED" && "admin-drawer-item--warning",
                      item.type === "ADMIN_USER_LOGIN" && "admin-drawer-item--login",
                      item.type === "ADMIN_DIRECT_MESSAGE" && "admin-drawer-item--message",
                    )}
                    onClick={() => {
                      setShowAdminDrawer(false);
                      if (item.url) router.push(item.url);
                    }}
                  >
                    <span className="admin-drawer-item__icon">
                      {item.type === "ADMIN_LOGIN_FAILED" ? (
                        <ShieldAlert size={16} />
                      ) : item.type === "ADMIN_USER_LOGIN" ? (
                        <UserCheck size={16} />
                      ) : item.type === "ADMIN_DIRECT_MESSAGE" ? (
                        <MessageSquare size={16} />
                      ) : (
                        <Bell size={16} />
                      )}
                    </span>
                    <div className="admin-drawer-item__body">
                      <div className="admin-drawer-item__top">
                        <span className="admin-notification-badge">
                          {item.type === "ADMIN_LOGIN_FAILED"
                            ? "Security Alert"
                            : item.type === "ADMIN_USER_LOGIN"
                            ? "Sign-in"
                            : item.type === "ADMIN_DIRECT_MESSAGE"
                            ? "Message"
                            : "Test"}
                        </span>
                        <time>{formatNotificationTime(item.timestamp)}</time>
                      </div>
                      <strong>{item.title}</strong>
                      <p>{item.body}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <footer className="admin-drawer-footer">
            <Link
              href="/settings?section=notifications"
              className="button secondary small w-full"
              onClick={() => setShowAdminDrawer(false)}
            >
              Configure admin notifications & push
            </Link>
          </footer>
        </aside>
      )}
      {(showPushPrompt || adminNotification) && (
        <div className="admin-notifications-container" aria-live="polite">
          {showPushPrompt && (
            <aside className="admin-push-prompt" aria-label="Enable administrator notifications">
              <span className="admin-notification-icon"><Bell size={18}/></span>
              <div className="admin-push-prompt__content">
                <strong>Know when someone tries to sign in</strong>
                <small>Allow notifications to receive successful and failed sign-in alerts on this device, even while SYORA is closed.</small>
                {pushPromptError && <small className="inline-error" role="alert">{pushPromptError}</small>}
                <div className="admin-push-prompt__actions">
                  <button type="button" className="button secondary small" onClick={() => { sessionStorage.setItem("syora:push-prompt-dismissed", "true"); setShowPushPrompt(false); }}>Later</button>
                  <button type="button" className="button small" disabled={pushPromptPending} onClick={() => { setPushPromptError(""); setPushPromptPending(true); void services.enableAdminPush().then(() => setShowPushPrompt(false)).catch(cause => setPushPromptError(cause instanceof Error ? cause.message : "Notifications could not be enabled." )).finally(() => setPushPromptPending(false)); }}>Allow notifications</button>
                </div>
              </div>
            </aside>
          )}
          {adminNotification && (
            <aside
              className={cn(
                "admin-notification-toast",
                adminNotification.type === "ADMIN_LOGIN_FAILED" && "admin-notification-toast--warning",
                adminNotification.type === "ADMIN_USER_LOGIN" && "admin-notification-toast--login",
                adminNotification.type === "ADMIN_DIRECT_MESSAGE" && "admin-notification-toast--message",
              )}
              role="alert"
              aria-atomic="true"
              onMouseEnter={() => setIsPaused(true)}
              onMouseLeave={() => setIsPaused(false)}
            >
              <span className="admin-notification-icon">
                {adminNotification.type === "ADMIN_LOGIN_FAILED" ? (
                  <ShieldAlert size={18} />
                ) : adminNotification.type === "ADMIN_USER_LOGIN" ? (
                  <UserCheck size={18} />
                ) : adminNotification.type === "ADMIN_DIRECT_MESSAGE" ? (
                  <MessageSquare size={18} />
                ) : (
                  <Bell size={18} />
                )}
              </span>
              <button
                type="button"
                className="admin-notification-body"
                onClick={() => {
                  router.push(adminNotification.url);
                  setAdminNotification(undefined);
                }}
              >
                <div className="admin-notification-meta">
                  <span className="admin-notification-badge">
                    {adminNotification.type === "ADMIN_LOGIN_FAILED"
                      ? "Security Alert"
                      : adminNotification.type === "ADMIN_USER_LOGIN"
                      ? "User Sign-in"
                      : adminNotification.type === "ADMIN_DIRECT_MESSAGE"
                      ? "Direct Message"
                      : "System Alert"}
                  </span>
                  <small className="admin-notification-time">Just now</small>
                </div>
                <strong>{adminNotification.title}</strong>
                <small>{adminNotification.body}</small>
              </button>
              <div className="admin-toast-actions">
                <button
                  type="button"
                  className="admin-toast-btn"
                  title="Open notification history"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowAdminDrawer(true);
                    setAdminNotification(undefined);
                  }}
                >
                  History
                </button>
                <button
                  type="button"
                  className="admin-notification-close"
                  title="Dismiss notification"
                  aria-label="Dismiss notification"
                  onClick={(e) => {
                    e.stopPropagation();
                    setAdminNotification(undefined);
                  }}
                >
                  <X size={15} />
                </button>
              </div>
              <div className={cn("admin-toast-progress", isPaused && "is-paused")} />
            </aside>
          )}
        </div>
      )}
      {logout && (
        <Modal
          title="Leave your space?"
          className="mobile-sheet logout-dialog"
          onClose={() => setLogout(false)}
        >
          <p className="modal__copy">
            You can sign back in whenever you are ready.
          </p>
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setLogout(false)}>
              Stay here
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                services.logout();
                router.replace("/login");
              }}
            >
              <LogOut size={17} /> Log out
            </Button>
          </div>
        </Modal>
      )}
    </main>
  );
}
export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <h1>
          {title}
        </h1>
        <p>{description}</p>
      </div>
      {action}
    </header>
  );
}
export function MobileScreenHeader({
  title,
  backHref,
  onBack,
  action,
}: {
  title: string;
  backHref?: string;
  onBack?: () => void;
  action?: React.ReactNode;
}) {
  const { me } = useApp();
  return (
    <header className="mobile-header">
      {onBack ? (
        <IconButton label="Go back" onClick={onBack}>
          <ArrowLeft size={21} />
        </IconButton>
      ) : backHref ? (
        <Link
          href={backHref}
          aria-label="Go back"
          className="icon-button"
        >
          <ArrowLeft size={21} />
        </Link>
      ) : (
        <Link href="/profile" aria-label="Open your profile">
          <Avatar user={me!} size="small" />
        </Link>
      )}
      <h1 className="mobile-header__title">{title}</h1>
      <span className="mobile-header__action">{action}</span>
    </header>
  );
}
export function PreviewNote() {
  return (
    <div className="preview-note">
      <Shield size={14} />
      <span>Private by design</span>
    </div>
  );
}

function formatNotificationTime(timestamp?: string) {
  if (!timestamp) return "Just now";
  const diff = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
  if (diff < 30) return "Just now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

