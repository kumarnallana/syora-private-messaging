import { NextResponse } from "next/server";

// In-memory messages store keyed by conversation id
const inMemoryMessages = new Map<string, any[]>();

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const messages = inMemoryMessages.get(id) || [];
  return NextResponse.json({
    id,
    title: "Assistant Chat",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
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
  inMemoryMessages.delete(id);
  return NextResponse.json({ deleted: true });
}
