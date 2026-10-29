/**
 * Syora AI Engine (Client & Serverless Runtime).
 *
 * Provides:
 * 1. Google Gemini API direct integration (gemini-1.5-flash / gemini-2.0-flash)
 * 2. Deterministic high-quality offline message synthesizer (always-ready zero-dependency fallback)
 * 3. Tone refiner & natural language intent extraction
 * 4. Scenario templates library
 */

export interface AIEngineResponse {
  reasoning: string;
  draft: string;
  suggested_actions: string[];
  provider: string;
}

export const AI_SCENARIO_TEMPLATES = [
  {
    id: "tpl-status-update",
    category: "Workplace",
    title: "Project Status Update",
    description: "Clear, structured progress update highlighting milestones, current focus, and blockers.",
    template: "Hi [Recipient],\n\nQuick progress update on [Project]:\n• Accomplished: [Milestone 1], [Milestone 2]\n• Current focus: [Task in progress]\n• Blockers: None at this time\n\nPlease let me know if you would like to adjust any priorities.\n\nBest regards,",
    prompt_starter: "Draft a status update for my team lead on the project progress",
  },
  {
    id: "tpl-reschedule",
    category: "Meetings",
    title: "Meeting Reschedule",
    description: "Courteous note explaining a schedule conflict and proposing 2-3 specific alternative slots.",
    template: "Hi [Recipient],\n\nDue to an unavoidable schedule conflict, I need to see if we could move our meeting scheduled for [Time].\n\nWould any of these options work for you instead?\n• Tomorrow at [Time 1]\n• [Day] at [Time 2]\n\nApologies for any inconvenience, and thank you for your flexibility!",
    prompt_starter: "Ask to reschedule our meeting tomorrow due to a conflict and propose alternate times",
  },
  {
    id: "tpl-gentle-followup",
    category: "Follow-up",
    title: "Gentle Follow-Up",
    description: "Friendly reminder that conveys momentum without being demanding.",
    template: "Hi [Recipient],\n\nFollowing up on [Topic] when you have a moment. We're ready for the next phase once we receive your feedback.\n\nNo rush—just wanted to ensure it didn't get buried in your inbox. Thanks!",
    prompt_starter: "Follow up gently on the proposal I sent last week without sounding pushy",
  },
  {
    id: "tpl-leave-notice",
    category: "HR & Personal",
    title: "Sick Leave / PTO Notice",
    description: "Formal or casual notification for planned PTO, sick leave, or emergency time off.",
    template: "Hi [Recipient],\n\nI am unwell today and will need to take sick leave to recover. I will monitor critical messages intermittently if urgent.\n\n[Colleague] is available to assist with immediate operational items. Thank you for understanding.",
    prompt_starter: "Notify my manager that I am taking sick leave today",
  },
  {
    id: "tpl-intro-outreach",
    category: "Networking",
    title: "Warm Introduction / Outreach",
    description: "Introduce yourself to a recruiter, colleague, or professional contact.",
    template: "Hi [Recipient],\n\nI came across your work in [Field] and wanted to connect. I am currently working on [Project] and would love to exchange perspectives when convenient.\n\nLooking forward to staying in touch!",
    prompt_starter: "Write a warm introduction to connect with a senior engineer on LinkedIn",
  },
  {
    id: "tpl-delay-apology",
    category: "Professional",
    title: "Deliverable Delay Apology",
    description: "Professional acknowledgment of delay with updated delivery commitment.",
    template: "Hi [Recipient],\n\nI am writing to provide an updated timeline for [Deliverable]. To ensure the highest quality, we need an extra [Timeframe] to complete thorough validation.\n\nYou can expect the final version by [Date/Time]. Thank you for your patience and support.",
    prompt_starter: "Apologize for a slight delay on the report and provide an updated delivery date",
  },
  {
    id: "tpl-feedback-request",
    category: "Collaboration",
    title: "Feedback Request",
    description: "Polite request for review and constructive feedback on a document or project.",
    template: "Hi [Recipient],\n\nI've finalized the draft for [Topic] and would value your feedback before we circulate it widely.\n\nCould you review sections [X and Y] by [Date]? Any input is deeply appreciated.\n\nThanks,",
    prompt_starter: "Ask my colleague for constructive feedback on the design doc",
  },
];

export function extractRecipientAndChannel(prompt: string): { recipient: string | null; channel: "syora" | "whatsapp" | "email" } {
  const lower = prompt.toLowerCase();
  let channel: "syora" | "whatsapp" | "email" = "syora";
  if (lower.includes("whatsapp") || lower.includes("wa.me")) {
    channel = "whatsapp";
  } else if (lower.includes("email") || lower.includes("mail")) {
    channel = "email";
  }

  const patterns = [
    /(?:send|deliver|forward|message)\s+(?:this\s+)?(?:message\s+)?to\s+([A-Za-z0-9_.\s]+?)(?:\s+(?:on|via|through|using|in)\s+(?:whatsapp|email|syora|chat)|\s+(?:for|about)\b|\s*$)/i,
    /(?:ask|tell|write to|remind|ping)\s+([A-Za-z0-9_.\s]+?)(?:\s+(?:on|via|through|in)\s+(?:whatsapp|email|syora|chat)|\s+(?:for|about|that|if|to)\b|\s*$)/i,
  ];

  let recipient: string | null = null;
  for (const pat of patterns) {
    const match = prompt.match(pat);
    if (match && match[1]) {
      let candidate = match[1].trim();
      candidate = candidate.replace(/\b(on|via|through|using|in|for|about|whatsapp|email|syora|chat)\b.*$/i, "").trim();
      if (candidate && candidate.split(/\s+/).length <= 3 && !["them", "him", "her", "someone", "a", "the", "me"].includes(candidate.toLowerCase())) {
        recipient = candidate;
        break;
      }
    }
  }

  return { recipient, channel };
}

export function refineMessageText(text: string, refinement: string): string {
  const lower = refinement.toLowerCase();

  if (lower.includes("concise") || lower.includes("shorter") || lower.includes("brief")) {
    let lines = text.split("\n").filter((l) => {
      const lineLower = l.toLowerCase();
      return (
        !lineLower.includes("i hope this email finds you well") &&
        !lineLower.includes("i hope you're having a wonderful") &&
        !lineLower.includes("just wanted to reach out") &&
        !lineLower.includes("at your earliest convenience")
      );
    });
    return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  }

  if (lower.includes("formal") || lower.includes("corporate")) {
    let res = text
      .replace(/^Hey\b/gim, "Dear")
      .replace(/^Hi\b/gim, "Dear")
      .replace(/\bcan't\b/gi, "cannot")
      .replace(/\bwon't\b/gi, "will not")
      .replace(/\bdon't\b/gi, "do not")
      .replace(/\bthanks\b/gi, "Thank you")
      .replace(/\bcheers\b/gi, "Sincerely");
    if (!res.includes("Sincerely") && !res.includes("Best regards")) {
      res += "\n\nSincerely,";
    }
    return res;
  }

  if (lower.includes("friendly") || lower.includes("warm")) {
    let res = text.replace(/^Dear\b/gim, "Hi");
    if (!res.includes("hope you're having") && !res.includes("Hope your week")) {
      const parts = res.split("\n\n");
      if (parts.length > 1) {
        parts.splice(1, 0, "Hope you're having a great week so far!");
        res = parts.join("\n\n");
      }
    }
    return res;
  }

  if (lower.includes("urgent") || lower.includes("action")) {
    return `${text}\n\n• Action Required: Please confirm your review by end of day today so we can proceed without delay.`;
  }

  if (lower.includes("diplomatic") || lower.includes("apologetic")) {
    return text.replace(
      /^(Hi|Hello|Dear)\s+([^,\n]+),?/im,
      `$1 $2,\n\nI want to sincerely thank you for your patience regarding this matter.`
    );
  }

  return text;
}

export function synthesizeProfessionalMessage(
  userPrompt: string,
  recipientName?: string,
  previousDraft?: string,
  refinementInstruction?: string,
  senderName?: string
): AIEngineResponse {
  const targetName = recipientName || "there";
  const sender = senderName || "Best regards";
  const lowerPrompt = userPrompt.toLowerCase();

  if (previousDraft && (refinementInstruction || lowerPrompt.includes("make it") || lowerPrompt.includes("more"))) {
    const rule = refinementInstruction || userPrompt;
    const refined = refineMessageText(previousDraft, rule);
    return {
      reasoning: `I updated the draft to make it ${rule}. You can review the updated text below.`,
      draft: refined,
      suggested_actions: ["Make more concise", "More formal", "Add clear CTA"],
      provider: "Syora Neural Engine",
    };
  }

  // Scenario: Status Update
  if (/status|update|progress|blocker|done|completed/i.test(lowerPrompt)) {
    const topicMatch = userPrompt.match(/(?:on|about|regarding)\s+([^.!?]+)/i);
    const topic = topicMatch ? topicMatch[1].trim() : "the current project deliverables";
    const draft = `Hi ${targetName},\n\nHere is a quick status update regarding ${topic}:\n• Accomplished: Core implementation and initial validation are completed.\n• Current focus: Finalizing testing and polishing the deliverables.\n• Blockers: None at this stage.\n\nPlease let me know if you would like me to prioritize any specific aspect.\n\nBest regards,`;
    return {
      reasoning: `I crafted a clear, structured status update addressed to ${targetName}. It emphasizes momentum and highlights next steps.`,
      draft,
      suggested_actions: ["Make more concise", "More formal", "Add specific deadline"],
      provider: "Syora Neural Engine",
    };
  }

  // Scenario: Reschedule or Meeting
  if (/reschedule|meeting|sync|catch up|calendar|time slot/i.test(lowerPrompt)) {
    const draft = `Hi ${targetName},\n\nI hope you're having a good week. Due to a schedule conflict, I need to see if we could reschedule our upcoming meeting.\n\nWould any of the following times work for you instead?\n• Tomorrow at 2:00 PM\n• Tomorrow at 4:30 PM\n• Thursday morning between 10:00 AM - 12:00 PM\n\nApologies for any inconvenience, and thank you for your flexibility!\n\nBest regards,`;
    return {
      reasoning: `I drafted a considerate meeting rescheduling note with 3 concrete alternative options so ${targetName} can easily select an alternate slot.`,
      draft,
      suggested_actions: ["Make more formal", "Friendlier", "Specify only one time"],
      provider: "Syora Neural Engine",
    };
  }

  // Scenario: Follow-up / Reminder
  if (/follow up|follow-up|reminder|nudge|pending|check in|haven't heard/i.test(lowerPrompt)) {
    const topicMatch = userPrompt.match(/(?:on|about|regarding)\s+([^.!?]+)/i);
    const topic = topicMatch ? topicMatch[1].trim() : "our previous discussion";
    const draft = `Hi ${targetName},\n\nI'm following up on ${topic} when you have a moment. We're ready to proceed to the next phase once we receive your feedback.\n\nNo urgent rush—just wanted to make sure it didn't get buried in your inbox. Thanks!\n\nBest regards,`;
    return {
      reasoning: `Here is a gentle, professional follow-up for ${targetName} that conveys momentum without being demanding.`,
      draft,
      suggested_actions: ["Make more urgent", "More formal", "Shorter"],
      provider: "Syora Neural Engine",
    };
  }

  // Scenario: Sick Leave / PTO
  if (/leave|sick|pto|vacation|off today|time off|not feeling well/i.test(lowerPrompt)) {
    const draft = `Hi ${targetName},\n\nI wanted to let you know that I am unwell today and will need to take sick leave to recover.\n\nI will monitor critical messages intermittently if urgent, and my teammates can assist with any immediate operational items.\n\nThank you for understanding,\n\nBest regards,`;
    return {
      reasoning: `I prepared a standard professional sick leave notice addressed to ${targetName}.`,
      draft,
      suggested_actions: ["Add coverage contact", "More concise"],
      provider: "Syora Neural Engine",
    };
  }

  // Scenario: Deliverable Delay Apology
  if (/delay|late|missed|apolog|sorry/i.test(lowerPrompt)) {
    const topicMatch = userPrompt.match(/(?:on|about|regarding|for)\s+([^.!?]+)/i);
    const topic = topicMatch ? topicMatch[1].trim() : "the scheduled deliverable";
    const draft = `Hi ${targetName},\n\nI am writing to provide an updated timeline for ${topic}. To ensure the highest standard of quality and thorough testing, we need a brief extension.\n\nYou can expect the final version by tomorrow afternoon. Thank you for your patience and understanding.\n\nBest regards,`;
    return {
      reasoning: `I created a courteous delay apology for ${targetName} taking full ownership and establishing a clear revised delivery date.`,
      draft,
      suggested_actions: ["More formal", "Friendlier", "Add detailed reason"],
      provider: "Syora Neural Engine",
    };
  }

  // General Scenario: Custom synthesis
  const cleanPrompt = userPrompt.replace(/^(please\s+)?(draft|write|generate|compose|send)\s+(a\s+)?(message\s+)?(to\s+)?/i, "").trim();
  const draft = `Hi ${targetName},\n\nI am reaching out regarding ${cleanPrompt}.\n\nPlease let me know your thoughts or if you need any additional details from my end.\n\nBest regards,`;
  return {
    reasoning: `I've prepared a concise, professional message tailored for ${targetName}. Feel free to review or refine it.`,
    draft,
    suggested_actions: ["Make more concise", "More formal", "Friendlier", "Add clear CTA"],
    provider: "Syora Neural Engine",
  };
}

export async function callGeminiAPI(
  systemInstruction: string,
  userPrompt: string,
  apiKey?: string,
  modelName = "gemini-2.5-flash"
): Promise<string | null> {
  const cleanKey = (apiKey || process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || "").trim();
  if (!cleanKey || cleanKey.length < 8) return null;

  const modelsToTry = [modelName, "gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-1.5-flash", "gemini-3.5-flash-lite", "gemini-3.8-flash", "gemini-flash-latest"];
  const uniqueModels = Array.from(new Set(modelsToTry));

  const combinedPrompt = systemInstruction
    ? `${systemInstruction}\n\nTask: ${userPrompt}\n\nProvide a ready-to-send professional message draft:`
    : userPrompt;

  const payload = {
    contents: [
      {
        role: "user",
        parts: [{ text: combinedPrompt }],
      },
    ],
    generationConfig: {
      temperature: 0.65,
      maxOutputTokens: 900,
    },
  };

  for (const model of uniqueModels) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(cleanKey)}`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": cleanKey,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        continue;
      }

      const data = await res.json();
      const candidate = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (candidate && candidate.trim()) {
        return candidate.trim();
      }
    } catch {
      // try next model
    }
  }

  return null;
}
