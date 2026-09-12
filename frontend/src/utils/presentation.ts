export function normalizeUsername(value = "") {
  return value.trim().replace(/^@+/, "").toLowerCase();
}

export function usernameLabel(value = "") {
  const username = normalizeUsername(value);
  return username ? `@${username}` : "";
}

export function formatLastSeen(value?: string, online = false, now = new Date()) {
  if (online) return "Online";
  if (!value) return null;

  const seen = new Date(value);
  if (Number.isNaN(seen.getTime())) {
    return /^last seen\b/i.test(value) ? value : `Last seen ${value}`;
  }

  const elapsed = Math.max(0, now.getTime() - seen.getTime());
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return "Last seen just now";
  if (minutes < 60) return `Last seen ${minutes} minute${minutes === 1 ? "" : "s"} ago`;

  const clock = seen.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startSeen = new Date(seen.getFullYear(), seen.getMonth(), seen.getDate());
  const days = Math.round((startToday.getTime() - startSeen.getTime()) / 86_400_000);
  if (days === 0) return `Last seen today at ${clock}`;
  if (days === 1) return `Last seen yesterday at ${clock}`;
  const date = seen.toLocaleDateString([], { month: "short", day: "numeric" });
  return `Last seen ${date} at ${clock}`;
}
