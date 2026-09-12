"use client";
import type { Attachment, User } from "@/types";
import { motion, useReducedMotion } from "framer-motion";
import { Heart, LoaderCircle, Sparkles, X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
export function LogoMark() {
  return (
    <span className="brand-symbol" aria-hidden="true">
      <Heart size={21} strokeWidth={2.25} fill="currentColor" />
    </span>
  );
}
export function Brand() {
  return (
    <span className="brand">
      <LogoMark />
      <span>
        SYORA<span className="brand-dot">.</span>
      </span>
    </span>
  );
}
export function Avatar({
  user,
  size = "normal",
}: {
  user: User;
  size?: "small" | "normal" | "large";
}) {
  return (
    <span className={`avatar ${user.color} ${size}`}>
      {user.avatar ? (
        <img src={user.avatar} alt={user.name} />
      ) : (
        user.name
          .split(" ")
          .map((n) => n[0])
          .slice(0, 2)
          .join("")
      )}
      {user.online && <span className="presence-dot" />}
    </span>
  );
}
export function IconButton({
  label,
  children,
  onClick,
  className = "",
  disabled = false,
}: {
  label: string;
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={`icon-button ${className}`}
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
  className = "",
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const reduced = useReducedMotion();
  useEffect(() => {
    const active = document.activeElement as HTMLElement;
    ref.current?.showModal();
    return () => active?.focus();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "wide" : ""} ${className}`}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const r = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            onClose();
        }
      }}
      aria-label={title}
    >
      <motion.div
        initial={reduced ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.16 }}
      >
        <header className="modal-header">
          <h2>{title}</h2>
          <IconButton label="Close dialog" onClick={onClose}>
            <X size={20} />
          </IconButton>
        </header>
        {children}
      </motion.div>
    </dialog>
  );
}
export function Empty({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Sparkles size={28} />
      </span>
      <h2>{title}</h2>
      <p>{description}</p>
      {children}
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" /> Loading your space…
    </div>
  );
}
export function time(value: string) {
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}
export function relative(value: string) {
  const mins = Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / 60000),
  );
  return mins < 1
    ? "Just now"
    : mins < 60
      ? `${mins} min ago`
      : mins < 1440
        ? `${Math.floor(mins / 60)}h ago`
        : "Yesterday";
}
export function fileSize(size: number) {
  return size < 1024
    ? `${size} B`
    : size < 1048576
      ? `${Math.round(size / 1024)} KB`
      : `${(size / 1048576).toFixed(1)} MB`;
}
export function pickAttachment(file: File): Attachment {
  const ext = file.name.split(".").pop()?.toLowerCase();
  const type = file.type.startsWith("image/")
    ? "image"
    : file.type.startsWith("video/")
      ? "video"
      : "document";
  if (
    type === "document" &&
    ![
      "pdf",
      "doc",
      "docx",
      "xls",
      "xlsx",
      "ppt",
      "pptx",
      "txt",
      "csv",
    ].includes(ext || "")
  )
    throw new Error("Choose an image, video, PDF, or Office document.");
  if (file.size > 50 * 1024 * 1024)
    throw new Error("Choose a file smaller than 50 MB.");
  return {
    id: crypto.randomUUID(),
    name: file.name,
    type,
    mime: file.type,
    size: file.size,
    url: URL.createObjectURL(file),
  };
}
