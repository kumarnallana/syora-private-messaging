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
    description:
      "Clear, structured progress update highlighting milestones, current focus, and blockers.",
    template:
      "Hi [Recipient],\n\nQuick progress update on [Project]:\n• Accomplished: [Milestone 1], [Milestone 2]\n• Current focus: [Task in progress]\n• Blockers: None at this time\n\nPlease let me know if you would like to adjust any priorities.\n\nBest regards,",
    prompt_starter:
      "Draft a status update for my team lead on the project progress",
  },
  {
    id: "tpl-reschedule",
    category: "Meetings",
    title: "Meeting Reschedule",
    description:
      "Courteous note explaining a schedule conflict and proposing 2-3 specific alternative slots.",
    template:
      "Hi [Recipient],\n\nDue to an unavoidable schedule conflict, I need to see if we could move our meeting scheduled for [Time].\n\nWould any of these options work for you instead?\n• Tomorrow at [Time 1]\n• [Day] at [Time 2]\n\nApologies for any inconvenience, and thank you for your flexibility!",
    prompt_starter:
      "Ask to reschedule our meeting tomorrow due to a conflict and propose alternate times",
  },
  {
    id: "tpl-gentle-followup",
    category: "Follow-up",
    title: "Gentle Follow-Up",
    description:
      "Friendly reminder that conveys momentum without being demanding.",
    template:
      "Hi [Recipient],\n\nFollowing up on [Topic] when you have a moment. We're ready for the next phase once we receive your feedback.\n\nNo rush—just wanted to ensure it didn't get buried in your inbox. Thanks!",
    prompt_starter:
      "Follow up gently on the proposal I sent last week without sounding pushy",
  },
  {
    id: "tpl-leave-notice",
    category: "HR & Personal",
    title: "Sick Leave / PTO Notice",
    description:
      "Formal or casual notification for planned PTO, sick leave, or emergency time off.",
    template:
      "Hi [Recipient],\n\nI am unwell today and will need to take sick leave to recover. I will monitor critical messages intermittently if urgent.\n\n[Colleague] is available to assist with immediate operational items. Thank you for understanding.",
    prompt_starter: "Notify my manager that I am taking sick leave today",
  },
  {
    id: "tpl-intro-outreach",
    category: "Networking",
    title: "Warm Introduction / Outreach",
    description:
      "Introduce yourself to a recruiter, colleague, or professional contact.",
    template:
      "Hi [Recipient],\n\nI came across your work in [Field] and wanted to connect. I am currently working on [Project] and would love to exchange perspectives when convenient.\n\nLooking forward to staying in touch!",
    prompt_starter:
      "Write a warm introduction to connect with a senior engineer on LinkedIn",
  },
  {
    id: "tpl-delay-apology",
    category: "Professional",
    title: "Deliverable Delay Apology",
    description:
      "Professional acknowledgment of delay with updated delivery commitment.",
    template:
      "Hi [Recipient],\n\nI am writing to provide an updated timeline for [Deliverable]. To ensure the highest quality, we need an extra [Timeframe] to complete thorough validation.\n\nYou can expect the final version by [Date/Time]. Thank you for your patience and support.",
    prompt_starter:
      "Apologize for a slight delay on the report and provide an updated delivery date",
  },
  {
    id: "tpl-feedback-request",
    category: "Collaboration",
    title: "Feedback Request",
    description:
      "Polite request for review and constructive feedback on a document or project.",
    template:
      "Hi [Recipient],\n\nI've finalized the draft for [Topic] and would value your feedback before we circulate it widely.\n\nCould you review sections [X and Y] by [Date]? Any input is deeply appreciated.\n\nThanks,",
    prompt_starter:
      "Ask my colleague for constructive feedback on the design doc",
  },
];

export function extractRecipientAndChannel(prompt: string): {
  recipient: string | null;
  channel: "syora" | "whatsapp" | "email";
} {
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
      candidate = candidate
        .replace(
          /\b(on|via|through|using|in|for|about|whatsapp|email|syora|chat)\b.*$/i,
          "",
        )
        .trim();
      if (
        candidate &&
        candidate.split(/\s+/).length <= 3 &&
        !["them", "him", "her", "someone", "a", "the", "me"].includes(
          candidate.toLowerCase(),
        )
      ) {
        recipient = candidate;
        break;
      }
    }
  }

  return { recipient, channel };
}

export function refineMessageText(text: string, refinement: string): string {
  const lower = refinement.toLowerCase();

  if (
    lower.includes("concise") ||
    lower.includes("shorter") ||
    lower.includes("brief")
  ) {
    let lines = text.split("\n").filter((l) => {
      const lineLower = l.toLowerCase();
      return (
        !lineLower.includes("i hope this email finds you well") &&
        !lineLower.includes("i hope you're having a wonderful") &&
        !lineLower.includes("just wanted to reach out") &&
        !lineLower.includes("at your earliest convenience")
      );
    });
    return lines
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
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
    if (
      !res.includes("hope you're having") &&
      !res.includes("Hope your week")
    ) {
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
      `$1 $2,\n\nI want to sincerely thank you for your patience regarding this matter.`,
    );
  }

  return text;
}

export function synthesizeProfessionalMessage(
  userPrompt: string,
  recipientName?: string,
  previousDraft?: string,
  refinementInstruction?: string,
  senderName?: string,
): AIEngineResponse {
  const targetName = recipientName || "there";
  const sender = senderName || "Best regards";
  const lowerPrompt = userPrompt.toLowerCase();

  if (
    previousDraft &&
    (refinementInstruction ||
      lowerPrompt.includes("make it") ||
      lowerPrompt.includes("more"))
  ) {
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
    const topic = topicMatch
      ? topicMatch[1].trim()
      : "the current project deliverables";
    const draft = `Hi ${targetName},\n\nHere is a quick status update regarding ${topic}:\n• Accomplished: Core implementation and initial validation are completed.\n• Current focus: Finalizing testing and polishing the deliverables.\n• Blockers: None at this stage.\n\nPlease let me know if you would like me to prioritize any specific aspect.\n\nBest regards,`;
    return {
      reasoning: `I crafted a clear, structured status update addressed to ${targetName}. It emphasizes momentum and highlights next steps.`,
      draft,
      suggested_actions: [
        "Make more concise",
        "More formal",
        "Add specific deadline",
      ],
      provider: "Syora Neural Engine",
    };
  }

  // Scenario: Reschedule or Meeting
  if (
    /reschedule|meeting|sync|catch up|calendar|time slot/i.test(lowerPrompt)
  ) {
    const draft = `Hi ${targetName},\n\nI hope you're having a good week. Due to a schedule conflict, I need to see if we could reschedule our upcoming meeting.\n\nWould any of the following times work for you instead?\n• Tomorrow at 2:00 PM\n• Tomorrow at 4:30 PM\n• Thursday morning between 10:00 AM - 12:00 PM\n\nApologies for any inconvenience, and thank you for your flexibility!\n\nBest regards,`;
    return {
      reasoning: `I drafted a considerate meeting rescheduling note with 3 concrete alternative options so ${targetName} can easily select an alternate slot.`,
      draft,
      suggested_actions: [
        "Make more formal",
        "Friendlier",
        "Specify only one time",
      ],
      provider: "Syora Neural Engine",
    };
  }

  // Scenario: Follow-up / Reminder
  if (
    /follow up|follow-up|reminder|nudge|pending|check in|haven't heard/i.test(
      lowerPrompt,
    )
  ) {
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
  if (
    /leave|sick|pto|vacation|off today|time off|not feeling well/i.test(
      lowerPrompt,
    )
  ) {
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
    const topicMatch = userPrompt.match(
      /(?:on|about|regarding|for)\s+([^.!?]+)/i,
    );
    const topic = topicMatch
      ? topicMatch[1].trim()
      : "the scheduled deliverable";
    const draft = `Hi ${targetName},\n\nI am writing to provide an updated timeline for ${topic}. To ensure the highest standard of quality and thorough testing, we need a brief extension.\n\nYou can expect the final version by tomorrow afternoon. Thank you for your patience and understanding.\n\nBest regards,`;
    return {
      reasoning: `I created a courteous delay apology for ${targetName} taking full ownership and establishing a clear revised delivery date.`,
      draft,
      suggested_actions: ["More formal", "Friendlier", "Add detailed reason"],
      provider: "Syora Neural Engine",
    };
  }

  // General Scenario: Custom synthesis
  const cleanPrompt = userPrompt
    .replace(
      /^(please\s+)?(draft|write|generate|compose|send)\s+(a\s+)?(message\s+)?(to\s+)?/i,
      "",
    )
    .trim();
  const draft = `Hi ${targetName},\n\nI am reaching out regarding ${cleanPrompt}.\n\nPlease let me know your thoughts or if you need any additional details from my end.\n\nBest regards,`;
  return {
    reasoning: `I've prepared a concise, professional message tailored for ${targetName}. Feel free to review or refine it.`,
    draft,
    suggested_actions: [
      "Make more concise",
      "More formal",
      "Friendlier",
      "Add clear CTA",
    ],
    provider: "Syora Neural Engine",
  };
}

export async function callGeminiAPI(
  systemInstruction: string,
  userPrompt: string,
  apiKey?: string,
  modelName = "gemini-2.5-flash",
): Promise<string | null> {
  const cleanKey = (
    apiKey ||
    process.env.GEMINI_API_KEY ||
    process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
    ""
  ).trim();
  if (!cleanKey || cleanKey.length < 8) return null;

  const modelsToTry = [
    modelName,
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-1.5-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.8-flash",
    "gemini-flash-latest",
  ];
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


class TrieNode {
  children = new Map<string, TrieNode>();
  isWord = false;
  correction?: string;
}

export class SpellCheckTrie {
  root = new TrieNode();

  insert(word: string, correction?: string): void {
    const w = word.toLowerCase();
    let node = this.root;
    for (const ch of w) {
      if (!node.children.has(ch)) {
        node.children.set(ch, new TrieNode());
      }
      node = node.children.get(ch)!;
    }
    node.isWord = true;
    node.correction = correction || word;
  }

  search(word: string): string | undefined {
    const w = word.toLowerCase();
    let node = this.root;
    for (const ch of w) {
      if (!node.children.has(ch)) return undefined;
      node = node.children.get(ch)!;
    }
    return node.isWord ? node.correction : undefined;
  }

  getClosestMatch(word: string, maxDist = 2): string | undefined {
    const exact = this.search(word);
    if (exact !== undefined) return exact;
    const w = word.toLowerCase();
    if (w.length <= 2) return undefined;

    const currentRow: number[] = [];
    for (let i = 0; i <= w.length; i++) currentRow.push(i);

    const results: { dist: number; correction: string }[] = [];

    const searchNode = (node: TrieNode, letter: string, prevRow: number[]) => {
      const columns = w.length + 1;
      const newRow: number[] = [prevRow[0] + 1];

      for (let c = 1; c < columns; c++) {
        const insertCost = newRow[c - 1] + 1;
        const deleteCost = prevRow[c] + 1;
        const replaceCost =
          w[c - 1] === letter ? prevRow[c - 1] : prevRow[c - 1] + 1;
        newRow.push(Math.min(insertCost, deleteCost, replaceCost));
      }

      if (newRow[newRow.length - 1] <= maxDist && node.isWord && node.correction) {
        results.push({ dist: newRow[newRow.length - 1], correction: node.correction });
      }

      if (Math.min(...newRow) <= maxDist) {
        for (const [nextLetter, nextNode] of node.children.entries()) {
          searchNode(nextNode, nextLetter, newRow);
        }
      }
    };

    for (const [letter, childNode] of this.root.children.entries()) {
      searchNode(childNode, letter, currentRow);
    }

    if (results.length > 0) {
      results.sort((a, b) => a.dist - b.dist || a.correction.length - b.correction.length);
      return results[0].correction;
    }
    return undefined;
  }
}

class LRUNode<K, V> {
  key: K;
  value: V;
  prev: LRUNode<K, V> | null = null;
  next: LRUNode<K, V> | null = null;
  constructor(key: K, value: V) {
    this.key = key;
    this.value = value;
  }
}

export class LRUCache<K, V> {
  private capacity: number;
  private map = new Map<K, LRUNode<K, V>>();
  private head: LRUNode<K, V>;
  private tail: LRUNode<K, V>;

  constructor(capacity = 512) {
    this.capacity = capacity;
    this.head = new LRUNode<K, V>(null as any, null as any);
    this.tail = new LRUNode<K, V>(null as any, null as any);
    this.head.next = this.tail;
    this.tail.prev = this.head;
  }

  get(key: K): V | undefined {
    const node = this.map.get(key);
    if (!node) return undefined;
    this.remove(node);
    this.addFirst(node);
    return node.value;
  }

  put(key: K, value: V): void {
    const existing = this.map.get(key);
    if (existing) {
      this.remove(existing);
    }
    const node = new LRUNode(key, value);
    this.addFirst(node);
    this.map.set(key, node);
    if (this.map.size > this.capacity) {
      const last = this.tail.prev!;
      this.remove(last);
      this.map.delete(last.key);
    }
  }

  private remove(node: LRUNode<K, V>) {
    if (node.prev) node.prev.next = node.next;
    if (node.next) node.next.prev = node.prev;
  }

  private addFirst(node: LRUNode<K, V>) {
    node.next = this.head.next;
    node.prev = this.head;
    if (this.head.next) this.head.next.prev = node;
    this.head.next = node;
  }
}

export const COMMON_TYPOS: Record<string, string> = {
  everythi: "everything",
  everyhing: "everything",
  everyting: "everything",
  everyhting: "everything",
  somethin: "something",
  nothin: "nothing",
  pls: "please",
  plz: "please",
  thx: "thanks",
  u: "you",
  ur: "your",
  r: "are",
  im: "I'm",
  dont: "don't",
  cant: "can't",
  wont: "won't",
  idk: "I don't know",
  gonna: "going to",
  wanna: "want to",
  gotta: "got to",
  teh: "the",
  recieve: "receive",
  seperate: "separate",
  tommorow: "tomorrow",
  thier: "their",
  beleive: "believe",
  untill: "until",
  definately: "definitely",
  occurr: "occur",
  freind: "friend",
  thougt: "thought",
  thougts: "thoughts",
  realy: "really",
};

const BASE_WORDS = [
  "everything", "something", "nothing", "please", "thanks", "tomorrow", "receive",
  "separate", "friend", "meeting", "proposal", "schedule", "convenient", "thoughts",
  "message", "update", "status", "progress", "review", "discuss", "appreciate",
  "wonderful", "question", "project", "follow", "regarding", "available", "working",
  "today", "yesterday", "tonight", "weekend", "morning", "afternoon", "evening",
  "important", "urgent", "timeline", "deliverable", "collaborate", "assistance",
];

export const globalSpellTrie = new SpellCheckTrie();
for (const [typo, fix] of Object.entries(COMMON_TYPOS)) {
  globalSpellTrie.insert(typo, fix);
}
for (const w of BASE_WORDS) {
  globalSpellTrie.insert(w, w);
}

export const globalPolishCache = new LRUCache<string, string>(512);

export function formatConversationalFlow(text: string): string {
  const s = text.trim();
  if (!s) return "";

  const greetingMatch = s.match(/^(hi|hello|hey|dear)\s+/i);
  let greeting = "";
  let rest = s;
  if (greetingMatch) {
    greeting = greetingMatch[1].charAt(0).toUpperCase() + greetingMatch[1].slice(1).toLowerCase() + ", ";
    rest = s.slice(greetingMatch[0].length);
  }

  const clauses: [RegExp, string][] = [
    [/\bhow are you\b/gi, "how are you?"],
    [/\bwhat are you doing\b/gi, "What are you doing?"],
    [/\bhow is it going\b/gi, "How is it going?"],
    [/\bis everything going well\b/gi, "Is everything going well?"],
    [/\bis everything ok\b/gi, "Is everything okay?"],
    [/\bhope all is well\b/gi, "Hope all is well."],
    [/\bhope you are doing well\b/gi, "Hope you are doing well."],
  ];

  let formatted = rest;
  for (const [pattern, replacement] of clauses) {
    formatted = formatted.replace(pattern, replacement);
  }

  formatted = formatted.replace(/([.?!])\s*[.?!]+/g, "$1");
  formatted = formatted.replace(/([.?!])\s*([a-zA-Z])/g, (_, p1, p2) => `${p1} ${p2.toUpperCase()}`);

  let result = greeting + formatted;
  result = result.replace(/^(Hi|Hello|Hey),\s+([A-Z])/, (_, p1, p2) => (p2 !== "I" ? `${p1}, ${p2.toLowerCase()}` : `${p1}, I`));

  if (result && !/[.!?]$/.test(result)) {
    result += ".";
  }
  return result;
}

export function polishMessageLocally(
  draft: string,
  mode: string,
  customInstruction?: string
): string {
  const cacheKey = `${mode}:${customInstruction || ""}:${draft.trim()}`;
  const cached = globalPolishCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const normMode = (mode || "polish")
    .toLowerCase()
    .replace("auto_polish", "polish")
    .replace("cta", "action");

  const words = draft.trim().split(/\s+/);
  const correctedWords = words.map((w: string) => {
    let core = w.replace(/[.,!?;:]+$/, "");
    const punct = w.slice(core.length);
    let leadPunct = "";
    while (core && /^[.,!?;:'"]/.test(core)) {
      leadPunct += core[0];
      core = core.slice(1);
    }
    const lower = core.toLowerCase();
    const fix = globalSpellTrie.getClosestMatch(lower, 1);
    let replacement = fix || core;
    if (core.toUpperCase() === core && core.length > 1) {
      replacement = replacement.toUpperCase();
    } else if (core.length > 0 && core[0].toUpperCase() === core[0]) {
      replacement = replacement.charAt(0).toUpperCase() + replacement.slice(1);
    }
    return leadPunct + replacement + punct;
  });

  const corrected = correctedWords.join(" ").trim();
  const flowCorrected = corrected ? formatConversationalFlow(corrected) : "";

  let result = "";
  if (normMode === "custom" && customInstruction) {
    const cLow = customInstruction.toLowerCase();
    if (
      cLow.includes("love") ||
      cLow.includes("friend") ||
      cLow.includes("best friend") ||
      cLow.includes("appreciate") ||
      cLow.includes("warm")
    ) {
      result =
        "Hey! Just wanted to take a moment to say how much I truly appreciate our friendship. You mean the world to me, and I'm so grateful to have you in my life! Hope you're having a wonderful day.";
    } else if (cLow.includes("urgent") || cLow.includes("asap") || cLow.includes("priority")) {
      result = `Hi! Urgent update regarding our discussion: ${flowCorrected || "Please review as soon as possible."}`;
    } else if (cLow.includes("concise") || cLow.includes("bullet") || cLow.includes("short")) {
      result = `Hi! Quick summary:\n• ${flowCorrected || "Status on track."}`;
    } else if (!flowCorrected) {
      result = `Hi! Reaching out regarding: ${customInstruction.trim()}.`;
    } else {
      result = flowCorrected;
    }
  } else if (normMode === "polish") {
    result = flowCorrected || "Hi there, hope everything is going well.";
  } else if (normMode === "professional") {
    if (!flowCorrected) {
      result = "Good day. I am writing to provide an update regarding our recent discussion.";
    } else {
      result = flowCorrected
        .replace(/\bHey\b/gi, "Hello")
        .replace(/^Hi\b/i, "Dear colleague")
        .replace(/\bcan't\b/gi, "cannot")
        .replace(/\bwon't\b/gi, "will not")
        .replace(/\bdon't\b/gi, "do not");
    }
  } else if (normMode === "concise") {
    if (!flowCorrected) {
      result = "Status update: on track.";
    } else {
      let trimmed = flowCorrected
        .replace(/^(Hi|Hello|Hey)(?:,?\s*how are you(?:\?|\.|\s*what are you doing\??)?)?/i, "")
        .replace(/^[,\s.-]+/, "")
        .trim();
      if (trimmed) {
        trimmed = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
      }
      result = trimmed || flowCorrected;
    }
  } else if (normMode === "friendly") {
    if (!flowCorrected) {
      result = "Hi! Hope you're having a wonderful day! Let me know if you need anything.";
    } else if (!/^(Hi|Hello|Hey)\b/i.test(flowCorrected)) {
      result = `Hi! ${flowCorrected}`;
    } else {
      result = flowCorrected;
    }
  } else if (normMode === "action") {
    if (!flowCorrected) {
      result = "Please review the details and let me know your thoughts when convenient.";
    } else if (!/please\s+let\s+me\s+know|looking\s+forward/i.test(flowCorrected)) {
      result = `${flowCorrected} Please let me know your thoughts when convenient.`;
    } else {
      result = flowCorrected;
    }
  } else {
    result = flowCorrected || "Hi!";
  }

  globalPolishCache.put(cacheKey, result);
  return result;
}
