import { NextResponse } from "next/server";

// In-memory session store for serverless instances
let inMemoryConversations: Array<{
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count?: number;
  last_message?: string;
  last_draft?: string;
  last_recipient?: string;
  last_channel?: string;
}> = [
  {
    id: "conv-initial",
    title: "Professional Messaging",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    message_count: 0,
    last_message: "",
    last_draft: "",
    last_recipient: "",
    last_channel: "",
  },
];

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
