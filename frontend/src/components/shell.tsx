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
  const { me, services, preferences, sessionReady } = useApp();
  const pathname = usePathname();
  const router = useRouter();
  const [logout, setLogout] = useState(false);
  useEffect(() => {
    if (sessionReady && !me) router.replace("/login");
  }, [sessionReady, me, router]);
  useEffect(() => {
    document.documentElement.dataset.theme = preferences.appearance;
    return () => {
      delete document.documentElement.dataset.theme;
    };
  }, [preferences.appearance]);
  if (!sessionReady || !me) return <Loading />;
  return (
    <main
      className={cn(
        "flex h-[100dvh] flex-col overflow-hidden pb-[65px] md:flex-row md:pb-0",
        preferences.compact && "compact",
      )}
    >
      <aside className="fixed bottom-0 left-0 z-[100] flex h-[65px] w-full flex-row items-center border-t border-border bg-[#15161c] px-[10px] md:static md:h-auto md:w-[64px] md:flex-col md:gap-9 md:border-r md:border-t-0 md:bg-[#181922] md:p-[25px_9px_18px] lg:w-[76px]">
        <Link href="/chats" aria-label="SYORA home" className="hidden md:block">
          <LogoMark />
        </Link>
        <nav className="flex w-full justify-around md:block md:w-full">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center justify-center gap-[5px] rounded-[9px] py-2 text-muted transition-colors md:h-[52px] md:w-full md:p-0",
                pathname === href
                  ? "bg-[#302a42] text-accent"
                  : "hover:bg-surface md:hover:bg-transparent",
              )}
              title={label}
              aria-label={label}
              aria-current={pathname === href ? "page" : undefined}
            >
              <Icon size={23} />
              <span className="text-[12px]">{label}</span>
            </Link>
          ))}
        </nav>
        <div className="hidden md:mt-auto md:flex md:w-full md:flex-col md:items-center md:gap-[14px]">
          <button
            className="flex flex-col items-center justify-center gap-[5px] rounded-[9px] text-muted transition-colors hover:text-danger md:h-[52px] md:w-full"
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
              "grid place-items-center rounded-full transition-transform hover:scale-105",
              pathname === "/profile" &&
                "ring-2 ring-accent ring-offset-2 ring-offset-[#181922]",
            )}
          >
            <Avatar user={me} size="small" />
          </Link>
        </div>
      </aside>
      <div className="flex-1 min-w-0 h-full overflow-hidden">{children}</div>
      {logout && (
        <Modal
          title="Leave your space?"
          className="mobile-sheet"
          onClose={() => setLogout(false)}
        >
          <p className="mb-6 text-[14px] leading-[1.7] text-muted">
            You can sign back in whenever you are ready.
          </p>
          <div className="flex flex-wrap justify-end gap-2.5">
            <Button variant="secondary" onClick={() => setLogout(false)}>
              Stay here
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                services.logout();
                router.push("/login");
              }}
            >
              Log out
            </Button>
          </div>
        </Modal>
      )}
    </main>
  );
}
export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="flex items-center justify-between gap-[15px] border-b border-border bg-panel p-[30px_40px]">
      <div>
        <span className="text-[12px] font-medium tracking-[1.8px] text-accent uppercase">
          {eyebrow}
        </span>
        <h1 className="mb-1.5 mt-2 text-[26px] font-medium tracking-[-0.5px]">
          {title}
        </h1>
        <p className="text-[14px] text-muted">{description}</p>
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
    <header className="flex h-[60px] items-center gap-[15px] border-b border-border bg-panel px-[15px] md:hidden">
      {onBack ? (
        <IconButton label="Go back" onClick={onBack}>
          <ArrowLeft size={21} />
        </IconButton>
      ) : backHref ? (
        <Link
          href={backHref}
          aria-label="Go back"
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-[9px] text-muted transition-colors hover:bg-surface"
        >
          <ArrowLeft size={21} />
        </Link>
      ) : (
        <Link href="/profile" aria-label="Open your profile">
          <Avatar user={me!} size="small" />
        </Link>
      )}
      <h1 className="text-[17px] font-medium">{title}</h1>
      <span className="ml-auto">{action}</span>
    </header>
  );
}
export function PreviewNote() {
  return (
    <div className="flex items-center justify-center gap-[7px] p-4 text-[12px] text-muted">
      <Shield size={14} />
      <span>Private by design</span>
    </div>
  );
}
