import { NextResponse } from "next/server";
import {
  deleteConversationFromStore,
  inMemoryConversations,
  inMemoryMessages,
} from "../store";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const conv = inMemoryConversations.find((c) => c.id === id);
  const messages = inMemoryMessages.get(id) || [];
  return NextResponse.json({
    id,
    title: conv?.title || "Assistant Chat",
    created_at: conv?.created_at || new Date().toISOString(),
    updated_at: conv?.updated_at || new Date().toISOString(),
    messages,
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let title = "Assistant Chat";
  try {
    const body = await request.json();
    if (body?.title) title = body.title.trim();
  } catch {}

  const conv = inMemoryConversations.find((c) => c.id === id);
  if (conv) {
    conv.title = title;
    conv.updated_at = new Date().toISOString();
  }

  return NextResponse.json({
    id,
    title,
    updated_at: new Date().toISOString(),
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  deleteConversationFromStore(id);
  return NextResponse.json({ deleted: true });
}
