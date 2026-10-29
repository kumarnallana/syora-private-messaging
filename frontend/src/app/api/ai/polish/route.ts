import { callGeminiAPI, polishMessageLocally } from "@/services/ai-engine";
import { NextResponse } from "next/server";

const POLISH_SYSTEM_PROMPT =
  "You are Syora Inst AI, an ultra-fast inline writing copilot and spelling corrector. " +
  "Your job is to fix all spelling errors, typos, punctuation, and grammar mistakes, " +
  "and rewrite or craft the message according to the selected mode or user instruction.\n" +
  "CRITICAL OUTPUT RULES:\n" +
  "1. Output ONLY the final ready-to-send message text.\n" +
  "2. NEVER prepend or repeat the user instruction or query (e.g. NEVER output 'instruction: message' or 'Here is the draft:').\n" +
  "3. NEVER wrap the entire message in quotation marks.\n" +
  "4. NEVER include preambles, explanations, or conversational filler.\n" +
  "5. Return clean plain text ready for immediate transmission.";

export async function POST(request: Request) {
  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const draft = (body.draft || "").trim();
  const mode = (body.mode || "polish")
    .toLowerCase()
    .replace("auto_polish", "polish")
    .replace("cta", "action");
  const customInstruction = (body.custom_instruction || "").trim();

  // 1. Check for explicit Gemini key from env or header
  const envKey = process.env.GEMINI_API_KEY || "";
  const headerKey = request.headers.get("x-gemini-key") || "";
  const effectiveKey = headerKey || envKey;

  let prompt = "";
  if (mode === "custom") {
    if (draft && customInstruction) {
      prompt = `Fix all spelling mistakes and typos, and rewrite this draft according to this user instruction: "${customInstruction}".\n\nOriginal Draft: ${draft}`;
    } else if (customInstruction) {
      prompt = `Draft a ready-to-send chat message based on this intent or instruction: "${customInstruction}"`;
    } else {
      prompt = `Fix all spelling mistakes, typos, grammar, and punctuation in this draft:\n\n${draft}`;
    }
  } else if (mode === "polish") {
    prompt = `Fix all spelling mistakes, typos, grammar, and punctuation in this draft, polishing it for natural clarity and elegant phrasing:\n\n${draft}`;
  } else if (mode === "professional") {
    prompt = `Fix all spelling mistakes and typos, and rewrite this draft into an articulate, executive, professional workplace tone:\n\n${draft}`;
  } else if (mode === "concise") {
    prompt = `Fix all spelling mistakes and typos, and rewrite this draft to be ultra-concise, crisp, and direct with zero filler words:\n\n${draft}`;
  } else if (mode === "friendly") {
    prompt = `Fix all spelling mistakes and typos, and rewrite this draft into a warm, polite, collaborative, and friendly tone:\n\n${draft}`;
  } else if (mode === "action") {
    prompt = `Fix all spelling mistakes and typos, and refine this draft to include a clear, direct call-to-action (CTA) with explicit next steps:\n\n${draft}`;
  } else {
    prompt = `Fix all spelling mistakes, typos, and grammar in this draft:\n\n${draft}`;
  }

  if (effectiveKey && effectiveKey.length > 5) {
    const geminiRes = await callGeminiAPI(
      POLISH_SYSTEM_PROMPT,
      prompt,
      effectiveKey,
      "gemini-2.5-flash",
    );
    if (geminiRes && geminiRes.trim()) {
      let cleaned = geminiRes
        .trim()
        .replace(/^["']|["']$/g, "")
        .trim();
      cleaned = cleaned.replace(
        /^(?:Here is(?: the)?(?: rewritten| polished)? message:?|Rewritten message:?|Output:?|Draft:?)\s*/i,
        "",
      );
      if (customInstruction) {
        cleaned = cleaned.replace(
          new RegExp(`^${customInstruction}:?\\s*`, "i"),
          "",
        );
      }
      return NextResponse.json({
        polished_text: cleaned.trim(),
        provider: "Google Gemini (gemini-2.5-flash)",
      });
    }
  }

  // Built-in intelligent fallback backed by SpellCheckTrie & LRUCache
  const localRefined = polishMessageLocally(draft, mode, customInstruction);

  return NextResponse.json({
    polished_text: localRefined || "Hi there, hope everything is going well.",
    provider: "Syora Neural Engine",
  });
}
