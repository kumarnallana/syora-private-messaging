"use client";

import { Avatar, Modal } from "@/components/shared/ui";
import { MobileScreenHeader, PageHeader } from "@/components/shell";
import { useApp } from "@/stores/use-app";
import type {
  AdminMetrics,
  AdminNotificationEvent,
  AdminNotificationSettings,
  Preferences,
} from "@/types";
import {
  clearChatWallpaper,
  getChatWallpaper,
  readChatWallpaper,
  saveChatWallpaper,
} from "@/utils/chat-wallpaper";
import { cn } from "@/utils/cn";
import { usernameLabel } from "@/utils/presentation";
import {
  Activity,
  AlertCircle,
  Bell,
  CheckCheck,
  CheckCircle2,
  ChevronRight,
  ImageIcon,
  LoaderCircle,
  Lock,
  LogOut,
  Monitor,
  Moon,
  RefreshCw,
  RotateCcw,
  Shield,
  ShieldAlert,
  Sun,
  Trash2,
  Upload,
  UserCheck,
  UserRound,
  UsersRound,
  UserX,
  X,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type Subsection = "privacy" | "notifications" | "appearance" | "blocked";

export function Settings() {
  const { me, users, services, preferences } = useApp();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [logout, setLogout] = useState(false);
  const [notice, setNotice] = useState<{
    kind: "error" | "success";
    text: string;
  }>();
  const requestedSection = searchParams.get("section");
  const section: Subsection | undefined =
    requestedSection === "privacy" ||
    requestedSection === "notifications" ||
    requestedSection === "appearance" ||
    requestedSection === "blocked"
      ? requestedSection
      : undefined;
  const [pending, setPending] = useState<keyof Preferences>();
  const [blockingId, setBlockingId] = useState<string>();
  const [adminMetrics, setAdminMetrics] = useState<AdminMetrics>();
  const [adminMetricsLoading, setAdminMetricsLoading] = useState(false);
  const [adminMetricsError, setAdminMetricsError] = useState("");
  const [adminNotifications, setAdminNotifications] =
    useState<AdminNotificationSettings>();
  const [adminNotificationPending, setAdminNotificationPending] =
    useState(false);
  const [testingAlert, setTestingAlert] = useState<string>();
  const [notificationHistory, setNotificationHistory] = useState<
    AdminNotificationEvent[]
  >([]);
  const [revokingUserId, setRevokingUserId] = useState<string>();
  const [browserPermission, setBrowserPermission] = useState<
    NotificationPermission | "unsupported"
  >("default");

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setBrowserPermission(Notification.permission);
    } else {
      setBrowserPermission("unsupported");
    }
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(undefined), 3800);
    return () => window.clearTimeout(timer);
  }, [notice]);

  async function requestBrowserPermission() {
    if (typeof window !== "undefined" && "Notification" in window) {
      try {
        const res = await Notification.requestPermission();
        setBrowserPermission(res);
        if (res === "granted") {
          setNotice({
            kind: "success",
            text: "Browser desktop notifications enabled on this device.",
          });
        } else if (res === "denied") {
          setNotice({
            kind: "error",
            text: "Browser notifications were denied in your browser settings.",
          });
        }
      } catch {}
    }
  }

  const loadHistory = useCallback(async () => {
    if (me?.role !== "admin") return;
    try {
      const res = await services.getAdminNotificationHistory();
      setNotificationHistory(res.items);
    } catch {
      try {
        const stored = localStorage.getItem(
          "syora:admin-notifications-history",
        );
        if (stored) setNotificationHistory(JSON.parse(stored));
      } catch {}
    }
  }, [me?.role, services]);

  useEffect(() => {
    if (me?.role !== "admin") return;
    void loadHistory();
    window.addEventListener("syora:admin-history-updated", loadHistory);
    return () =>
      window.removeEventListener("syora:admin-history-updated", loadHistory);
  }, [loadHistory, me?.role]);

  async function sendTestAlert(
    type: AdminNotificationEvent["type"] = "ADMIN_TEST_ALERT",
  ) {
    if (testingAlert) return;
    setTestingAlert(type);
    setNotice(undefined);
    try {
      const event = await services.sendTestAdminNotification(type);
      setNotice({
        kind: "success",
        text: `Test alert (${event.title}) delivered with audio chime & toast.`,
      });
      await loadHistory();
    } catch (cause) {
      setNotice({
        kind: "error",
        text:
          cause instanceof Error
            ? cause.message
            : "Test alert could not be sent.",
      });
    } finally {
      setTestingAlert(undefined);
    }
  }

  async function clearNotificationHistory() {
    try {
      await services.clearAdminNotificationHistory();
    } catch {}
    setNotificationHistory([]);
    setNotice({ kind: "success", text: "Admin notification history cleared." });
  }

  async function markAllNotificationsRead() {
    try {
      await services.markAdminNotificationsRead();
      setNotificationHistory((prev) =>
        prev.map((item) => ({ ...item, read: true })),
      );
      setNotice({ kind: "success", text: "All admin alerts marked as read." });
    } catch {}
  }

  const loadAdminMetrics = useCallback(async () => {
    if (me?.role !== "admin") return;
    setAdminMetricsLoading(true);
    setAdminMetricsError("");
    try {
      setAdminMetrics(await services.getAdminMetrics());
    } catch (cause) {
      setAdminMetricsError(
        cause instanceof Error
          ? cause.message
          : "The signed-in count could not be loaded.",
      );
    } finally {
      setAdminMetricsLoading(false);
    }
  }, [me?.role, services]);

  useEffect(() => {
    if (me?.role !== "admin") return;
    void loadAdminMetrics();
    const timer = window.setInterval(() => void loadAdminMetrics(), 30_000);
    return () => window.clearInterval(timer);
  }, [loadAdminMetrics, me?.role]);

  useEffect(() => {
    if (me?.role !== "admin") return;
    void services
      .getAdminNotificationSettings()
      .then(setAdminNotifications)
      .catch((cause) =>
        setNotice({
          kind: "error",
          text:
            cause instanceof Error
              ? cause.message
              : "Admin notification settings could not be loaded.",
        }),
      );
  }, [me?.role, services]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(
      () => setNotice(undefined),
      notice.kind === "success" ? 2400 : 4200,
    );
    return () => window.clearTimeout(timer);
  }, [notice]);

  async function update(key: keyof Preferences, value: unknown) {
    if (pending) return;
    if (
      key === "notifications" &&
      value === true &&
      typeof Notification !== "undefined" &&
      Notification.permission === "default"
    ) {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setNotice({
          kind: "error",
          text: "Allow browser notifications to turn on message alerts.",
        });
        return;
      }
    }
    setPending(key);
    setNotice(undefined);
    try {
      await services.updatePreferences({ [key]: value });
      setNotice({ kind: "success", text: "Settings updated." });
    } catch (cause) {
      setNotice({
        kind: "error",
        text:
          cause instanceof Error
            ? cause.message
            : "This setting could not be updated.",
      });
    } finally {
      setPending(undefined);
    }
  }

  async function unblock(id: string, name: string) {
    if (blockingId) return;
    setBlockingId(id);
    setNotice(undefined);
    try {
      await services.block(id);
      setNotice({ kind: "success", text: `${name} is unblocked.` });
    } catch (cause) {
      setNotice({
        kind: "error",
        text:
          cause instanceof Error
            ? cause.message
            : "This person could not be unblocked.",
      });
    } finally {
      setBlockingId(undefined);
    }
  }

  async function updateAdminNotifications(
    values: Partial<
      Pick<
        AdminNotificationSettings,
        "loginAlerts" | "messageAlerts" | "messagePreview" | "soundAlerts"
      >
    >,
  ) {
    if (adminNotificationPending) return;
    setAdminNotificationPending(true);
    setNotice(undefined);
    try {
      setAdminNotifications(
        await services.updateAdminNotificationSettings(values),
      );
      setNotice({ kind: "success", text: "Admin notifications updated." });
    } catch (cause) {
      setNotice({
        kind: "error",
        text:
          cause instanceof Error
            ? cause.message
            : "Admin notifications could not be updated.",
      });
    } finally {
      setAdminNotificationPending(false);
    }
  }

  async function toggleAdminPush() {
    if (adminNotificationPending || !adminNotifications) return;
    setAdminNotificationPending(true);
    setNotice(undefined);
    try {
      setAdminNotifications(
        await (adminNotifications.pushEnabled
          ? services.disableAdminPush()
          : services.enableAdminPush()),
      );
      setNotice({
        kind: "success",
        text: adminNotifications.pushEnabled
          ? "Push notifications disabled on this device."
          : "Push notifications enabled on this device.",
      });
    } catch (cause) {
      setNotice({
        kind: "error",
        text:
          cause instanceof Error
            ? cause.message
            : "Push notifications could not be changed.",
      });
    } finally {
      setAdminNotificationPending(false);
    }
  }

  async function revokeSessions(userId: string, displayName: string) {
    if (revokingUserId) return;
    setRevokingUserId(userId);
    setNotice(undefined);
    try {
      await services.revokeAdminSessions(userId);
      await loadAdminMetrics();
      setNotice({
        kind: "success",
        text: `${displayName} was logged out from every device.`,
      });
    } catch (cause) {
      setNotice({
        kind: "error",
        text:
          cause instanceof Error
            ? cause.message
            : "These sessions could not be ended.",
      });
    } finally {
      setRevokingUserId(undefined);
    }
  }

  const privacy = (
    <>
      <Choice
        disabled={Boolean(pending)}
        label="Last seen"
        value={preferences.lastSeen}
        options={["Everyone", "Friends", "Nobody"]}
        onChange={(value) => void update("lastSeen", value)}
      />
      <Choice
        disabled={Boolean(pending)}
        label="Profile photo"
        value={preferences.photo}
        options={["Everyone", "Friends", "Nobody"]}
        onChange={(value) => void update("photo", value)}
      />
      <Choice
        disabled={Boolean(pending)}
        label="Status visibility"
        value={preferences.status}
        options={["Friends", "Nobody"]}
        onChange={(value) => void update("status", value)}
      />
      <Toggle
        disabled={Boolean(pending)}
        label="Read receipts"
        description="Let friends know when you have read a message."
        value={preferences.receipts}
        onChange={(value) => void update("receipts", value)}
      />
    </>
  );
  const notifications = (
    <>
      <Toggle
        disabled={Boolean(pending)}
        label="Message notifications"
        description="Show an alert when a message arrives while SYORA is in the background."
        value={preferences.notifications}
        onChange={(value) => void update("notifications", value)}
      />
      <Toggle
        disabled={Boolean(pending)}
        label="Conversation sounds"
        description="Play a quiet sound for incoming messages."
        value={preferences.sound}
        onChange={(value) => void update("sound", value)}
      />
      {me?.role === "admin" && (
        <section
          className="admin-notification-settings"
          aria-label="Admin notifications"
        >
          <header>
            <div className="admin-notification-header-row">
              <div className="admin-notification-header-title">
                <Bell />
                <span>
                  <strong>Admin notifications</strong>
                  <small>
                    Alerts and security monitoring reserved for the
                    authenticated SYORA administrator.
                  </small>
                </span>
              </div>
              <span className="admin-live-chip">
                <span className="admin-drawer-pulse" />
                Live monitoring active
              </span>
            </div>
          </header>
          {adminNotifications ? (
            <>
              <div className="admin-status-card">
                <div className="admin-status-card__copy">
                  <strong>Desktop browser alerts</strong>
                  <small>
                    {browserPermission === "granted"
                      ? "Browser notifications are enabled. System popups will appear even when SYORA is in the background."
                      : browserPermission === "denied"
                        ? "Browser popups are currently blocked in browser site permissions."
                        : "Allow browser notifications on this device to see system popups when alerts arrive."}
                  </small>
                </div>
                {browserPermission === "default" && (
                  <button
                    type="button"
                    className="button small"
                    onClick={() => void requestBrowserPermission()}
                  >
                    Enable desktop alerts
                  </button>
                )}
                {browserPermission === "granted" && (
                  <span className="admin-permission-active">
                    <CheckCircle2 size={14} /> Active
                  </span>
                )}
              </div>
              <Toggle
                disabled={adminNotificationPending}
                label="Sign-in activity alerts"
                description="Notify me when a member signs in successfully or a sign-in attempt fails."
                value={adminNotifications.loginAlerts}
                onChange={(value) =>
                  void updateAdminNotifications({ loginAlerts: value })
                }
              />
              <Toggle
                disabled={adminNotificationPending}
                label="Admin alert chimes"
                description="Play distinct audible tones for security alerts, member sign-ins, and live test alerts."
                value={adminNotifications.soundAlerts !== false}
                onChange={(value) =>
                  void updateAdminNotifications({ soundAlerts: value })
                }
              />
              <Toggle
                disabled={adminNotificationPending}
                label="Messages to me"
                description="Notify me only when a direct message is addressed to my admin account."
                value={adminNotifications.messageAlerts}
                onChange={(value) =>
                  void updateAdminNotifications({ messageAlerts: value })
                }
              />
              <Toggle
                disabled={adminNotificationPending}
                label="Message preview"
                description="Include message text in notifications that may appear on a lock screen."
                value={adminNotifications.messagePreview}
                onChange={(value) =>
                  void updateAdminNotifications({ messagePreview: value })
                }
              />
              <div className="admin-push-control">
                <span>
                  <strong>Push notifications on this device</strong>
                  <small>
                    {adminNotifications.pushSupported
                      ? adminNotifications.pushEnabled
                        ? "This device will keep receiving admin alerts in the background."
                        : "Allow notifications to receive successful and failed sign-in alerts, even while SYORA is closed."
                      : "Mobile push is unavailable until VAPID keys are configured on the SYORA server."}
                  </small>
                </span>
                <button
                  type="button"
                  className={`button small ${adminNotifications.pushEnabled ? "secondary" : ""}`}
                  disabled={
                    adminNotificationPending ||
                    !adminNotifications.pushSupported
                  }
                  onClick={() => void toggleAdminPush()}
                >
                  {adminNotificationPending && (
                    <LoaderCircle className="spin" />
                  )}
                  {adminNotifications.pushEnabled
                    ? "Disable"
                    : "Allow notifications"}
                </button>
              </div>
              <div className="admin-test-control">
                <div className="admin-test-control__copy">
                  <strong>Test notification delivery</strong>
                  <small>
                    Trigger live alerts to confirm your toast, audio chime, and
                    push notifications are working.
                  </small>
                </div>
                <div className="admin-test-control__actions">
                  <button
                    type="button"
                    className="button secondary small"
                    disabled={Boolean(testingAlert)}
                    onClick={() => void sendTestAlert("ADMIN_TEST_ALERT")}
                  >
                    {testingAlert === "ADMIN_TEST_ALERT" ? (
                      <LoaderCircle className="spin" size={14} />
                    ) : (
                      <Bell size={14} />
                    )}
                    Standard test
                  </button>
                  <button
                    type="button"
                    className="button secondary small"
                    disabled={Boolean(testingAlert)}
                    onClick={() => void sendTestAlert("ADMIN_LOGIN_FAILED")}
                  >
                    {testingAlert === "ADMIN_LOGIN_FAILED" ? (
                      <LoaderCircle className="spin" size={14} />
                    ) : (
                      <ShieldAlert size={14} />
                    )}
                    Security alert
                  </button>
                  <button
                    type="button"
                    className="button secondary small"
                    disabled={Boolean(testingAlert)}
                    onClick={() => void sendTestAlert("ADMIN_USER_LOGIN")}
                  >
                    {testingAlert === "ADMIN_USER_LOGIN" ? (
                      <LoaderCircle className="spin" size={14} />
                    ) : (
                      <UserCheck size={14} />
                    )}
                    Sign-in alert
                  </button>
                </div>
              </div>
              <div
                className="admin-notification-history"
                aria-label="Recent admin alerts"
              >
                <div className="admin-notification-history__header">
                  <div className="admin-notification-history__title">
                    <Activity size={16} />
                    <strong>Recent alert activity</strong>
                    {notificationHistory.length > 0 && (
                      <span className="admin-notification-count">
                        {notificationHistory.length}
                      </span>
                    )}
                  </div>
                  <div className="admin-notification-history__actions">
                    {notificationHistory.some((i) => !i.read) && (
                      <button
                        type="button"
                        className="button secondary small"
                        onClick={() => void markAllNotificationsRead()}
                      >
                        <CheckCheck size={13} /> Mark read
                      </button>
                    )}
                    {notificationHistory.length > 0 && (
                      <button
                        type="button"
                        className="button secondary small"
                        onClick={() => void clearNotificationHistory()}
                      >
                        <Trash2 size={13} /> Clear log
                      </button>
                    )}
                  </div>
                </div>
                {notificationHistory.length > 0 ? (
                  <div className="admin-notification-history__list">
                    {notificationHistory.map((item) => (
                      <div
                        className={cn(
                          "admin-notification-history__item",
                          !item.read && "is-unread",
                        )}
                        key={item.id}
                      >
                        <div className="admin-notification-history__left">
                          <span
                            className={cn(
                              "admin-notification-badge",
                              item.type === "ADMIN_LOGIN_FAILED" &&
                                "admin-notification-badge--warning",
                              item.type === "ADMIN_USER_LOGIN" &&
                                "admin-notification-badge--login",
                              item.type === "ADMIN_DIRECT_MESSAGE" &&
                                "admin-notification-badge--message",
                            )}
                          >
                            {item.type === "ADMIN_LOGIN_FAILED"
                              ? "Security"
                              : item.type === "ADMIN_USER_LOGIN"
                                ? "Sign-in"
                                : item.type === "ADMIN_DIRECT_MESSAGE"
                                  ? "Message"
                                  : "Test"}
                          </span>
                          <div className="admin-notification-history__details">
                            <strong>{item.title}</strong>
                            <p>{item.body}</p>
                            <small>
                              {new Date(item.timestamp).toLocaleString([], {
                                dateStyle: "short",
                                timeStyle: "short",
                              })}
                            </small>
                          </div>
                        </div>
                        {item.url && (
                          <button
                            type="button"
                            className="button secondary small"
                            onClick={() => router.push(item.url)}
                          >
                            Open
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="muted-copy admin-notification-history__empty">
                    No admin notifications recorded yet. Alerts will appear here
                    in real time.
                  </p>
                )}
              </div>
            </>
          ) : (
            <p className="muted-copy">Loading admin notification settings…</p>
          )}
        </section>
      )}
    </>
  );
  const appearance = (
    <>
      <div className="theme-options" role="radiogroup" aria-label="Appearance">
        {(
          [
            ["dark", Moon, "Dark"],
            ["light", Sun, "Light"],
            ["system", Monitor, "System"],
          ] as const
        ).map(([value, Icon, label]) => (
          <button
            key={value}
            disabled={Boolean(pending)}
            role="radio"
            aria-checked={preferences.appearance === value}
            className={preferences.appearance === value ? "is-active" : ""}
            onClick={() => void update("appearance", value)}
          >
            <Icon size={18} /> {label}
          </button>
        ))}
      </div>
      <ChatWallpaperSetting />
      <Toggle
        disabled={Boolean(pending)}
        label="Compact conversations"
        description="Reduce spacing in conversation lists and messages."
        value={preferences.compact}
        onChange={(value) => void update("compact", value)}
      />
    </>
  );
  const blocked = preferences.blocked.length ? (
    preferences.blocked.map((id) => {
      const user = users.find((item) => item.id === id);
      return (
        user && (
          <div className="blocked-row" key={id}>
            <Avatar user={user} size="small" />
            <span>{user.name}</span>
            <button
              className="button secondary small"
              disabled={Boolean(blockingId)}
              onClick={() => void unblock(id, user.name)}
            >
              {blockingId === id && <LoaderCircle className="spin" size={15} />}{" "}
              Unblock
            </button>
          </div>
        )
      );
    })
  ) : (
    <p className="muted-copy">You have not blocked anyone.</p>
  );
  const subsectionContent =
    section === "privacy"
      ? privacy
      : section === "notifications"
        ? notifications
        : section === "appearance"
          ? appearance
          : blocked;
  const subsectionTitle = section
    ? section[0].toUpperCase() + section.slice(1)
    : "";
  const adminOverview =
    me!.role === "admin" ? (
      <AdminSessionCount
        metrics={adminMetrics}
        loading={adminMetricsLoading}
        error={adminMetricsError}
        revokingUserId={revokingUserId}
        onRefresh={() => void loadAdminMetrics()}
        onRevoke={(userId, name) => void revokeSessions(userId, name)}
      />
    ) : null;

  const openSection = (value: Subsection) =>
    router.push(`/settings?section=${value}`);
  return (
    <div className="page-view settings-page">
      <MobileScreenHeader
        title={subsectionTitle || "Settings"}
        onBack={section ? () => router.back() : undefined}
      />
      <PageHeader
        title="Settings"
        description="Privacy, notifications, and appearance."
      />
      {pending && (
        <div className="settings-toast is-loading" role="status">
          <span className="settings-toast__icon">
            <LoaderCircle size={14} className="spin" />
          </span>
          <span className="settings-toast__text">Saving setting…</span>
        </div>
      )}
      {notice && (
        <div
          className={`settings-toast is-${notice.kind}`}
          role={notice.kind === "error" ? "alert" : "status"}
        >
          <span className="settings-toast__icon">
            {notice.kind === "success" ? (
              <CheckCircle2 size={15} />
            ) : (
              <AlertCircle size={15} />
            )}
          </span>
          <span className="settings-toast__text">{notice.text}</span>
          <button
            type="button"
            className="settings-toast__close"
            onClick={() => setNotice(undefined)}
            aria-label="Dismiss notice"
          >
            <X size={14} />
          </button>
        </div>
      )}
      <div className="settings-mobile-main" hidden={Boolean(section)}>
        <button
          className="mobile-account-row"
          onClick={() => router.push("/profile")}
        >
          <Avatar user={me!} />
          <span className="account-copy">
            <strong>{me!.name}</strong>
            <small>{usernameLabel(me!.username)}</small>
          </span>
          <ChevronRight size={20} />
        </button>
        {adminOverview}
        <nav className="settings-menu" aria-label="Settings sections">
          <SettingsLink
            icon={<UserRound />}
            label="Account"
            onClick={() => router.push("/profile")}
          />
          <SettingsLink
            icon={<Lock />}
            label="Privacy"
            onClick={() => openSection("privacy")}
          />
          <SettingsLink
            icon={<Bell />}
            label="Notifications"
            onClick={() => openSection("notifications")}
          />
          <SettingsLink
            icon={<Moon />}
            label="Appearance"
            onClick={() => openSection("appearance")}
          />
          <SettingsLink
            icon={<UserX />}
            label={`Blocked users (${preferences.blocked.length})`}
            onClick={() => openSection("blocked")}
          />
        </nav>
        <button
          className="settings-menu-row danger-text"
          onClick={() => setLogout(true)}
        >
          <LogOut />
          <span>Log out</span>
          <ChevronRight />
        </button>
      </div>
      {section && (
        <div className="settings-mobile-subscreen">{subsectionContent}</div>
      )}
      <div className="settings-desktop-content">
        <SettingsSection icon={<Shield />} title="Account">
          <div className="account-summary">
            <Avatar user={me!} />
            <span className="account-copy">
              <strong>{me!.name}</strong>
              <small>{usernameLabel(me!.username)}</small>
            </span>
            <button
              className="button secondary small"
              onClick={() => router.push("/profile")}
            >
              Edit profile
            </button>
          </div>
        </SettingsSection>
        {adminOverview}
        <SettingsSection icon={<Lock />} title="Privacy">
          {privacy}
        </SettingsSection>
        <SettingsSection icon={<Bell />} title="Notifications">
          {notifications}
        </SettingsSection>
        <SettingsSection icon={<Moon />} title="Appearance">
          {appearance}
        </SettingsSection>
        <SettingsSection
          icon={<UserX />}
          title={`Blocked users (${preferences.blocked.length})`}
        >
          {blocked}
        </SettingsSection>
        <button
          className="button danger logout-setting"
          onClick={() => setLogout(true)}
        >
          <LogOut size={18} /> Log out
        </button>
      </div>
      {logout && (
        <Modal
          title="Log out of SYORA?"
          className="mobile-sheet logout-dialog"
          onClose={() => setLogout(false)}
        >
          <p className="modal-copy">
            You will need to sign in again to access your conversations.
          </p>
          <div className="modal-actions">
            <button
              className="button secondary"
              onClick={() => setLogout(false)}
            >
              Cancel
            </button>
            <button
              className="button danger"
              onClick={() => {
                services.logout();
                router.replace("/login");
              }}
            >
              <LogOut size={17} /> Log out
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function AdminSessionCount({
  metrics,
  loading,
  error,
  revokingUserId,
  onRefresh,
  onRevoke,
}: {
  metrics?: AdminMetrics;
  loading: boolean;
  error: string;
  revokingUserId?: string;
  onRefresh: () => void;
  onRevoke: (userId: string, displayName: string) => void;
}) {
  return (
    <section
      className="admin-session-count"
      aria-label="Administrator overview"
    >
      <div className="admin-session-summary">
        <div className="admin-session-copy">
          <UsersRound />
          <span>
            <strong>Session activity</strong>
            <small>Current access and retained sign-in history.</small>
          </span>
        </div>
        <button
          type="button"
          className="icon-button"
          aria-label="Refresh session activity"
          disabled={loading}
          onClick={onRefresh}
        >
          {loading ? <LoaderCircle className="spin" /> : <RefreshCw />}
        </button>
      </div>
      <div className="admin-session-totals">
        <span>
          <small>Active now</small>
          <strong
            aria-label={
              metrics
                ? `${metrics.signedInUsers} active people`
                : "Active count unavailable"
            }
          >
            {metrics?.signedInUsers ?? "—"}
          </strong>
        </span>
        <span>
          <small>Previously signed in</small>
          <strong
            aria-label={
              metrics
                ? `${metrics.previouslySignedInUsers} previously signed-in people`
                : "Previous count unavailable"
            }
          >
            {metrics?.previouslySignedInUsers ?? "—"}
          </strong>
        </span>
      </div>
      {metrics?.people?.length ? (
        <div
          className="admin-session-list"
          aria-label="Current and previous accounts"
        >
          {metrics.people.map((person) => {
            const active = person.activeSessionCount > 0;
            const timestamp = active
              ? person.lastActiveAt
              : person.lastSignedInAt;
            return (
              <div className="admin-session-person" key={person.userId}>
                <span>
                  <strong>
                    {person.displayName}
                    {person.isCurrentUser && <em>You</em>}
                    <em className={active ? "is-active" : "is-previous"}>
                      {active ? "Active" : "Signed out"}
                    </em>
                  </strong>
                  <small>
                    {usernameLabel(person.username)} ·{" "}
                    {active
                      ? `${person.activeSessionCount} active ${person.activeSessionCount === 1 ? "session" : "sessions"}`
                      : `${person.totalSessionCount} recorded ${person.totalSessionCount === 1 ? "sign-in" : "sign-ins"}`}{" "}
                    · {active ? "active" : "last signed in"}{" "}
                    {new Date(timestamp).toLocaleString([], {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </small>
                </span>
                {person.canRevoke && (
                  <button
                    type="button"
                    className="button danger small"
                    disabled={Boolean(revokingUserId)}
                    onClick={() => onRevoke(person.userId, person.displayName)}
                  >
                    {revokingUserId === person.userId && (
                      <LoaderCircle className="spin" />
                    )}
                    <LogOut /> Log out
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        !loading &&
        !error && (
          <p className="muted-copy admin-session-empty">
            No sign-in history is available yet.
          </p>
        )
      )}
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
function ChatWallpaperSetting() {
  const input = useRef<HTMLInputElement>(null);
  const [wallpaper, setWallpaper] = useState("");
  const [error, setError] = useState("");
  useEffect(() => setWallpaper(getChatWallpaper()), []);
  async function choose(file?: File) {
    if (!file) return;
    setError("");
    try {
      const value = await readChatWallpaper(file);
      saveChatWallpaper(value);
      setWallpaper(value);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "This background could not be saved.",
      );
    }
  }
  function reset() {
    clearChatWallpaper();
    setWallpaper("");
    setError("");
  }
  return (
    <div className="chat-wallpaper-setting">
      <div className="chat-wallpaper-copy">
        <span>
          <ImageIcon />
          <strong>Chat background</strong>
        </span>
        <small>
          SYORA uses a quiet dark pattern by default. Your custom image stays in
          this browser.
        </small>
      </div>
      <div
        className={`chat-wallpaper-preview ${wallpaper ? "has-custom-wallpaper" : ""}`}
        style={
          wallpaper
            ? {
                backgroundImage: `linear-gradient(#090a0f99, #090a0f99), url("${wallpaper}")`,
              }
            : undefined
        }
        aria-label={
          wallpaper
            ? "Custom chat background preview"
            : "Default chat background preview"
        }
      />
      <input
        ref={input}
        hidden
        type="file"
        accept="image/*"
        aria-label="Choose chat background image"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          void choose(file);
        }}
      />
      <div className="chat-wallpaper-actions">
        <button
          type="button"
          className="button secondary small"
          onClick={() => input.current?.click()}
        >
          <Upload /> Choose image
        </button>
        {wallpaper && (
          <button
            type="button"
            className="button secondary small"
            onClick={reset}
          >
            <RotateCcw /> Use default
          </button>
        )}
      </div>
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
function SettingsLink({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button className="settings-menu-row" onClick={onClick}>
      {icon}
      <span>{label}</span>
      <ChevronRight />
    </button>
  );
}
function SettingsSection({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="settings-section">
      <header>
        {icon}
        <h2>{title}</h2>
      </header>
      <div>{children}</div>
    </section>
  );
}
function Toggle({
  label,
  description,
  value,
  onChange,
  disabled,
}: {
  label: string;
  description: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="setting-row">
      <span>
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
      <button
        disabled={disabled}
        className={`switch ${value ? "is-on" : ""}`}
        role="switch"
        aria-checked={value}
        aria-label={label}
        onClick={() => onChange(!value)}
      >
        <span />
      </button>
    </div>
  );
}
function Choice({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="setting-row choice-row">
      <span>
        <strong>{label}</strong>
      </span>
      <div className="choice-options" role="radiogroup" aria-label={label}>
        {options.map((option) => (
          <button
            type="button"
            key={option}
            role="radio"
            aria-checked={value === option}
            className={value === option ? "is-active" : ""}
            disabled={disabled}
            onClick={() => onChange(option)}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}
