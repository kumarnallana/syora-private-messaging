import { NextResponse } from "next/server";
import {
  callGeminiAPI,
  extractRecipientAndChannel,
  synthesizeProfessionalMessage,
} from "@/services/ai-engine";
import {
  addMessageToStore,
  inMemoryConversations,
  updateConversationInStore,
} from "../../store";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: conversationId } = await params;
  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const prompt = (body.prompt || "").trim();
  if (!prompt) {
    return NextResponse.json({ error: "Prompt cannot be empty" }, { status: 422 });
  }

  // 1. Check for explicit Gemini key from env or header
  const envKey = process.env.GEMINI_API_KEY || "";
  const headerKey = request.headers.get("x-gemini-key") || "";
  const effectiveKey = headerKey || envKey;

  const { recipient, channel } = extractRecipientAndChannel(prompt);
  const targetRecipient = body.recipient_name || recipient;
  const targetChannel = body.channel || channel;

  // Check if send command
  const isSendCommand = /^(?:please\s+)?(?:send|deliver|forward)\s+(?:this\s+)?(?:message\s+)?(?:to\s+|now|via|on)/i.test(prompt) ||
    ["send", "send it", "send message", "send this", "approve and send"].includes(prompt.toLowerCase().trim());

  if (isSendCommand && (body.previous_draft || targetRecipient)) {
    const draftToSend = body.previous_draft || "Please review this message.";
    const asstText = `I have prepared the message to be sent to **${targetRecipient || "your recipient"}**${targetChannel ? ` via **${targetChannel}**` : ""}. To protect your privacy and ensure accuracy, Syora requires your explicit authorization before transmitting.`;

    return NextResponse.json({
      message_id: "msg-" + Date.now(),
      role: "assistant",
      content: asstText,
      draft_message: draftToSend,
      recipient: targetRecipient ? { name: targetRecipient } : null,
      channel: targetChannel || "syora",
      is_send_command: true,
      requires_authorization: true,
      suggested_actions: ["Authorize & Send", "Edit Draft", "Change Channel"],
    });
  }

  // Generate with Gemini if key available
  let llmDraft: string | null = null;
  let providerLabel = "Syora Neural Engine";

  if (effectiveKey && effectiveKey.length > 5) {
    const systemPrompt =
      "You are Syora AI, a world-class professional messaging assistant. " +
      "Write concise, polished, professional messages for real-world workplace and networking scenarios. " +
      "Return the message draft directly without markdown wrapping unless requested.";
    llmDraft = await callGeminiAPI(systemPrompt, prompt, effectiveKey, "gemini-3.8-flash");
    if (llmDraft) {
      providerLabel = "Google Gemini (gemini-3.8-flash)";
    }
  }

  // Save user message
  const userMsgRecord = {
    id: "user-" + Date.now(),
    role: "user",
    content: prompt,
    created_at: new Date().toISOString(),
  };
  addMessageToStore(conversationId, userMsgRecord);

  let responsePayload: any;

  if (llmDraft) {
    responsePayload = {
      message_id: "msg-" + Date.now(),
      role: "assistant",
      content: `I've tailored a professional draft for ${targetRecipient || "your recipient"} using ${providerLabel}. You can review, edit, or approve it below.`,
      draft_message: llmDraft.trim(),
      provider: providerLabel,
      recipient: targetRecipient ? { name: targetRecipient } : null,
      channel: targetChannel,
      is_send_command: false,
      requires_authorization: false,
      suggested_actions: ["Make more concise", "More formal", "Friendlier", "Add clear CTA"],
    };
  } else {
    // Fallback: Syora Neural Engine
    const synthesis = synthesizeProfessionalMessage(
      prompt,
      targetRecipient || undefined,
      body.previous_draft,
      body.refinement
    );

    responsePayload = {
      message_id: "msg-" + Date.now(),
      role: "assistant",
      content: synthesis.reasoning,
      draft_message: synthesis.draft,
      provider: synthesis.provider,
      recipient: targetRecipient ? { name: targetRecipient } : null,
      channel: targetChannel,
      is_send_command: false,
      requires_authorization: false,
      suggested_actions: synthesis.suggested_actions,
    };
  }

  // Save assistant message and update conversation summary
  const asstMsgRecord = {
    id: responsePayload.message_id,
    role: "assistant",
    content: responsePayload.content,
    draft_message: responsePayload.draft_message,
    recipient_name: targetRecipient,
    channel: targetChannel,
    created_at: new Date().toISOString(),
  };
  addMessageToStore(conversationId, asstMsgRecord);

  const existingConv = inMemoryConversations.find((c) => c.id === conversationId);
  const promptTitle = prompt.slice(0, 36) + (prompt.length > 36 ? "…" : "");
  updateConversationInStore(conversationId, {
    title: existingConv?.title === "New Assistant Chat" ? promptTitle : (existingConv?.title || promptTitle),
    last_message: prompt.slice(0, 90),
    last_draft: responsePayload.draft_message?.slice(0, 90) || "",
    last_recipient: targetRecipient || "",
    last_channel: targetChannel || "",
    message_count: ((existingConv?.message_count || 0) + 2),
  });

  return NextResponse.json(responsePayload);
}
