import { NextResponse } from "next/server";
import {
  clearAllConversationsFromStore,
  inMemoryConversations,
} from "./store";

export async function GET() {
  return NextResponse.json(inMemoryConversations);
}

export async function POST(request: Request) {
  let title = "New Assistant Chat";
  try {
    const body = await request.json();
    if (body?.title) title = body.title.trim();
  } catch {}

  const newItem = {
    id: "conv-" + Date.now() + "-" + Math.random().toString(36).substring(2, 7),
    title,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    message_count: 0,
    last_message: "",
    last_draft: "",
    last_recipient: "",
    last_channel: "",
  };

  inMemoryConversations.unshift(newItem);
  return NextResponse.json(newItem, { status: 201 });
}

export async function DELETE() {
  clearAllConversationsFromStore();
  return NextResponse.json({ cleared: true, count: 0 });
}
