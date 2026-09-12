"use client";
import { Modal, fileSize, pickAttachment } from "@/components/shared/ui";
import { useApp } from "@/stores/use-app";
import type { Attachment } from "@/types";
import { Download, FileText, LoaderCircle, Paperclip, RotateCcw } from "lucide-react";
import { useRef, useState } from "react";
export function FilePicker({
  onSelect,
  onError,
  mediaOnly = false,
  disabled = false,
}: {
  onSelect: (file: Attachment) => void;
  onError: (error: string) => void;
  mediaOnly?: boolean;
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        type="button"
        className="icon-button"
        aria-label={mediaOnly ? "Add photo or video" : "Attach file"}
        disabled={disabled}
        onClick={() => input.current?.click()}
      >
        <Paperclip size={21} />
      </button>
      <input
        ref={input}
        type="file"
        hidden
        accept={
          mediaOnly
            ? "image/*,video/*"
            : "image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
        }
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          try {
            if (mediaOnly && !/^(image|video)\//.test(file.type))
              throw new Error("Choose a photo or video.");
            onSelect(pickAttachment(file));
            onError("");
          } catch (error) {
            onError((error as Error).message);
          }
        }}
      />
    </>
  );
}
export function AttachmentContent({
  attachment,
  preview = false,
}: {
  attachment: Attachment;
  preview?: boolean;
}) {
  const { services } = useApp();
  const [view, setView] = useState(false);
  const [error, setError] = useState(false);
  const [retried, setRetried] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [url, setUrl] = useState(attachment.url);
  async function handleError() {
    if (retried) {
      setError(true);
      return;
    }
    setRetried(true);
    try {
      const newUrl = await services.getAccessUrl(attachment.id);
      setUrl(newUrl);
      setError(false);
    } catch {
      setError(true);
    }
  }
  async function retryAccess() {
    if (refreshing) return;
    setRefreshing(true);
    setError(false);
    try {
      const newUrl = await services.getAccessUrl(attachment.id);
      setUrl(newUrl);
      setRetried(false);
    } catch {
      setError(true);
    } finally {
      setRefreshing(false);
    }
  }
  return (
    <div className="attachment-content">
      {attachment.type === "image" ? (
        <button
          type="button"
          className="image-message"
          aria-label={`View ${attachment.name}`}
          onClick={() => setView(true)}
        >
          <img
            src={url}
            alt={attachment.name}
            loading="lazy"
            onError={handleError}
          />
        </button>
      ) : attachment.type === "video" ? (
        <video
          className="video-message"
          src={url}
          controls
          playsInline
          preload="metadata"
          aria-label={attachment.name}
          onError={handleError}
        />
      ) : (
        <div className="document-message">
          <FileText size={29} />
          <span>
            <strong>{attachment.name}</strong>
            <small>
              {attachment.name.split(".").at(-1)?.toUpperCase()} ·{" "}
              {fileSize(attachment.size)}
            </small>
          </span>
          <button
            type="button"
            className="icon-button"
            aria-label={`Open ${attachment.name}`}
            onClick={() => setView(true)}
          >
            <FileText size={18} />
          </button>
          <a
            className="icon-button"
            href={url}
            download={attachment.name}
            aria-label={`Download ${attachment.name}`}
          >
            <Download size={18} />
          </a>
        </div>
      )}
      {error && (
        <div role="alert" className="media-error"><span>This media could not be displayed.</span><button type="button" className="button secondary small" disabled={refreshing} onClick={() => void retryAccess()}>{refreshing ? <LoaderCircle className="spin" size={15}/> : <RotateCcw size={15}/>} {refreshing ? 'Refreshing…' : 'Try again'}</button></div>
      )}
      {preview && (
        <p className="file-caption">
          {attachment.name} · {fileSize(attachment.size)}
        </p>
      )}
      {view && (
        <Modal
          title={attachment.name}
          wide
          className="media-viewer-dialog"
          onClose={() => setView(false)}
        >
          {attachment.type === "image" ? (
            <img className="media-viewer" src={url} alt={attachment.name} onError={handleError} />
          ) : attachment.mime === "application/pdf" ? (
            <iframe className="pdf-viewer" title={attachment.name} src={url} onError={handleError} />
          ) : (
            <p className="modal-copy">
              Download this document to open it in a compatible application.
            </p>
          )}
          <div className="modal-actions">
            <a
              className="button secondary"
              href={url}
              download={attachment.name}
            >
              <Download size={17} /> Download
            </a>
          </div>
        </Modal>
      )}
    </div>
  );
}
