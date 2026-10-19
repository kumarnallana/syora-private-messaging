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
  CircleDot,
  LogOut,
  MessageCircle,
  MessageSquare,
  Settings2,
  Shield,
  ShieldAlert,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
    { href: "/settings", label: "Settings", icon: Settings2 },
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
        const next = [notification, ...stored.filter(item => item.id !== notification.id)].slice(0, 30);
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
    const timer = window.setTimeout(() => setAdminNotification(undefined), 6000);
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
