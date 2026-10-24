import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const geminiEnv = process.env.GEMINI_API_KEY || "";
  const headerKey = request.headers.get("x-gemini-key") || "";
  const effectiveKey = headerKey || geminiEnv;
  const hasGemini = Boolean(effectiveKey && effectiveKey.length > 5);

  return NextResponse.json({
    active_provider: hasGemini ? "gemini" : "builtin",
    active_label: hasGemini ? "Google Gemini (gemini-3.8-flash)" : "Syora Neural Engine (Built-in)",
    provider_name: hasGemini ? "Google Gemini (gemini-3.8-flash)" : "Syora Neural Engine (Built-in)",
    is_external_configured: hasGemini,
    notes: hasGemini
      ? "Connected to Google Gemini API (gemini-3.8-flash)."
      : "Syora Neural Engine active. Deterministic offline synthesizer with zero external dependencies.",
    gemini: {
      configured: hasGemini,
      model: "gemini-3.8-flash",
    },
    ollama: {
      configured: false,
      running: false,
      healthy: false,
      base_url: "http://localhost:11434",
      model: "llama3.2",
      installed_models: [],
    },
    openai: {
      configured: false,
      model: "gpt-4o-mini",
    },
    builtin: {
      available: true,
      always_ready: true,
    },
  });
}
