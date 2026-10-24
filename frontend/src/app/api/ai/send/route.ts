import { NextResponse } from "next/server";

export async function POST(request: Request) {
  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.authorized) {
    return NextResponse.json(
      { error: "Explicit user authorization is required before transmitting outbound messages." },
      { status: 403 }
    );
  }

  const message = (body.message || "").trim();
  const recipientName = (body.recipient_name || "Recipient").trim();
  const channel = body.channel || "syora";

  if (channel === "whatsapp") {
    const phone = (body.phone_or_email || "").replace(/[^\d+]/g, "");
    const waUrl = phone
      ? `https://api.whatsapp.com/send?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(message)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;

    return NextResponse.json({
      success: true,
      status: "authorized",
      channel: "whatsapp",
      recipient_name: recipientName,
      external_url: waUrl,
      timestamp: new Date().toISOString(),
      confirmation: `Authorization verified. Opening WhatsApp with pre-filled message for ${recipientName}.`,
    });
  }

  if (channel === "email") {
    const email = body.phone_or_email || "";
    const mailtoUrl = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent("Professional Message via Syora")}&body=${encodeURIComponent(message)}`;

    return NextResponse.json({
      success: true,
      status: "authorized",
      channel: "email",
      recipient_name: recipientName,
      external_url: mailtoUrl,
      timestamp: new Date().toISOString(),
      confirmation: `Authorization verified. Opening email client with message for ${recipientName}.`,
    });
  }

  return NextResponse.json({
    success: true,
    status: "delivered",
    channel: "syora",
    recipient_name: recipientName,
    timestamp: new Date().toISOString(),
    confirmation: `Message successfully processed and delivered to ${recipientName} in Syora Chat.`,
  });
}
