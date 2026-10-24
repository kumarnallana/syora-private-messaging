import { NextResponse } from "next/server";
import { AI_SCENARIO_TEMPLATES } from "@/services/ai-engine";

export async function GET() {
  return NextResponse.json({ templates: AI_SCENARIO_TEMPLATES });
}
