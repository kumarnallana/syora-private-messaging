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
  CircleDot,
  LogOut,
  MessageCircle,
  Settings2,
  Shield,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
const nav = [
  { href: "/chats", label: "Chats", icon: MessageCircle },
  { href: "/status", label: "Status", icon: CircleDot },
  { href: "/contacts", label: "Contacts", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings2 },
];
export function Shell({ children }: { children: React.ReactNode }) {
  const { me, services, preferences, sessionReady, sessionError, connection } = useApp();
  const pathname = usePathname();
  const router = useRouter();
  const [logout, setLogout] = useState(false);
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
          {nav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "rail-link",
                pathname === href && "is-active",
              )}
              title={label}
              aria-label={label}
              aria-current={pathname === href ? "page" : undefined}
            >
              <Icon size={23} />
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
