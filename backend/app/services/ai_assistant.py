import asyncio
import json
import re
import urllib.error
import urllib.request
import uuid
from typing import Any
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.config.settings import get_settings
from app.models.entities import Friendship, FriendshipStatus, User


TEMPLATES = [
    {
        "id": "status-update",
        "category": "Updates",
        "title": "Project Status Update",
        "description": "Share progress, milestones achieved, and current blockers clearly.",
        "template": "Hi {name},\n\nHere is a quick update on {topic}:\n- What's completed: {points}\n- Next steps: In progress, targeting completion by {deadline}.\n- Blockers: None at the moment / Need your input on {blocker}.\n\nLet me know if you'd like to adjust any priorities.",
        "prompt_starter": "Give my manager a concise status update on our project",
    },
    {
        "id": "meeting-reschedule",
        "category": "Meetings",
        "title": "Reschedule Meeting",
        "description": "Politely propose a new time slot without inconveniencing the attendee.",
        "template": "Hi {name},\n\nI hope you're having a good week. Due to an unexpected conflict, I will need to reschedule our upcoming meeting on {topic}.\n\nWould any of these alternative times work for you?\n- {alt1}\n- {alt2}\n\nApologies for any inconvenience, and thank you for your flexibility.",
        "prompt_starter": "Ask to reschedule our meeting to tomorrow afternoon politely",
    },
    {
        "id": "gentle-followup",
        "category": "Follow-ups",
        "title": "Gentle Follow-up",
        "description": "Polite reminder on a pending review, document, or unanswered message.",
        "template": "Hi {name},\n\nJust following up on my previous note regarding {topic}. When you have a moment, please let me know your thoughts so we can keep things moving forward.\n\nNo immediate rush—thanks for your time!",
        "prompt_starter": "Follow up gently on the proposal I sent last week",
    },
    {
        "id": "leave-request",
        "category": "Workplace",
        "title": "Time Off / Leave Notice",
        "description": "Formal or casual notification for planned PTO, sick leave, or emergency time off.",
        "template": "Hi {name},\n\nI am writing to let you know that I will be taking leave on {dates} for {reason}. Before heading out, I will ensure {coverage_plan}.\n\nI will have limited access to messages but will respond to urgent matters if needed. Thank you for understanding.",
        "prompt_starter": "Draft a sick leave notice for today to my team lead",
    },
    {
        "id": "networking-intro",
        "category": "Networking",
        "title": "Warm Introduction / Outreach",
        "description": "Introduce yourself to a recruiter, colleague, or professional contact.",
        "template": "Hi {name},\n\nI came across your profile and was really impressed by your work on {topic}. I'm currently working on {my_work} and would love to connect and learn more about your experience.\n\nLooking forward to staying in touch!",
        "prompt_starter": "Introduce myself to a senior engineer for a quick connection",
    },
    {
        "id": "apology-delay",
        "category": "Professional",
        "title": "Deliverable Delay Apology",
        "description": "Professional acknowledgment of delay with updated delivery commitment.",
        "template": "Hi {name},\n\nI wanted to share an update on {topic}. We encountered a minor issue that requires a bit more time to resolve properly, so the revised delivery is now {new_time}.\n\nI apologize for the delay and appreciate your patience as we finalize this.",
        "prompt_starter": "Apologize for the delay in sending the report and promise it by 4 PM",
    },
    {
        "id": "salary-negotiation",
        "category": "Career",
        "title": "Compensation / Review Discussion",
        "description": "Tactful request to schedule a compensation or role advancement conversation.",
        "template": "Hi {name},\n\nGiven the recent milestones we achieved on {topic} and the expansion of my responsibilities, I would appreciate the opportunity to discuss my compensation and career progression.\n\nCould we set aside 20 minutes sometime next week for a conversation? I look forward to your thoughts.",
        "prompt_starter": "Request a 1-on-1 meeting to discuss compensation review",
    },
]


def extract_recipient_and_channel(prompt: str) -> tuple[str | None, str | None]:
    """Extract recipient name and channel (syora, whatsapp, email) from prompt text."""
    lower = prompt.lower()
    channel = None
    if "whatsapp" in lower or "wa.me" in lower:
        channel = "whatsapp"
    elif "email" in lower or "mail" in lower:
        channel = "email"
    elif "syora" in lower or "chat" in lower or "in-app" in lower:
        channel = "syora"

    patterns = [
        r"(?:send|deliver|forward|message)\s+(?:this\s+)?(?:message\s+)?to\s+([A-Za-z0-9_.\s]+?)(?:\s+(?:on|via|through|using|in)\s+(?:whatsapp|email|syora|chat)|\s*$)",
        r"(?:ask|tell|write to)\s+([A-Za-z0-9_.\s]+?)(?:\s+(?:on|via|through|in)\s+(?:whatsapp|email|syora|chat)|\s+that|\s+if|\s+to|\s*$)",
    ]
    recipient = None
    for pattern in patterns:
        m = re.search(pattern, prompt, re.IGNORECASE)
        if m:
            candidate = m.group(1).strip()
            # Clean candidate
            candidate = re.sub(r"\b(on|via|through|using|in|whatsapp|email|syora|chat)\b.*$", "", candidate, flags=re.IGNORECASE).strip()
            if candidate and len(candidate.split()) <= 3 and candidate.lower() not in {"them", "him", "her", "someone", "a", "the", "me"}:
                recipient = candidate
                break

    return recipient, channel


async def match_user_contact(db: AsyncSession, current_user_id: uuid.UUID, recipient_name: str | None) -> dict[str, Any] | None:
    if not recipient_name:
        return None

    clean_name = recipient_name.strip().lower()

    # Query user's accepted friendships
    stmt = (
        select(User)
        .join(
            Friendship,
            or_(
                (Friendship.requester_id == current_user_id) & (Friendship.addressee_id == User.id),
                (Friendship.addressee_id == current_user_id) & (Friendship.requester_id == User.id),
            ),
        )
        .where(Friendship.status == FriendshipStatus.ACCEPTED)
    )
    result = await db.scalars(stmt)
    contacts = list(result.all())

    # Check exact match on display name or username
    for c in contacts:
        if c.display_name.lower() == clean_name or c.username.lower() == clean_name:
            return {"id": str(c.id), "name": c.display_name, "username": c.username, "email": c.email, "role": c.role}

    # Check prefix or partial match
    for c in contacts:
        first_name = c.display_name.split()[0].lower() if c.display_name else ""
        if first_name == clean_name or clean_name in c.display_name.lower() or clean_name in c.username.lower():
            return {"id": str(c.id), "name": c.display_name, "username": c.username, "email": c.email, "role": c.role}

    return {"id": None, "name": recipient_name, "username": recipient_name.lower().replace(" ", "_"), "email": None}


def refine_message_text(text: str, refinement: str) -> str:
    """Apply rule-based tone transformations and refinements."""
    lower_ref = refinement.lower()

    if "short" in lower_ref or "concise" in lower_ref or "brief" in lower_ref:
        lines = [line.strip() for line in text.split("\n") if line.strip()]
        # Remove opening pleasantries if long
        condensed = []
        for line in lines:
            if re.match(r"^I hope (you're|you are|this email|this message)", line, re.I):
                continue
            condensed.append(line)
        return "\n\n".join(condensed) if condensed else text

    if "formal" in lower_ref:
        res = text
        res = re.sub(r"\bHey\b", "Dear", res)
        res = re.sub(r"\bHi\b", "Hello", res)
        res = re.sub(r"\bcan't\b", "cannot", res)
        res = re.sub(r"\bwon't\b", "will not", res)
        res = re.sub(r"\bdon't\b", "do not", res)
        res = re.sub(r"\bThanks!?(\s|$)", r"Thank you for your time and consideration.\1", res)
        if not re.search(r"Sincerely|Best regards|Kind regards", res):
            res = res.strip() + "\n\nKind regards,"
        return res

    if "friendly" in lower_ref or "warm" in lower_ref:
        res = text
        if not re.search(r"hope you're having|hope all is well", res, re.I):
            lines = res.split("\n")
            if lines:
                lines.insert(1, "Hope you're having a wonderful week!")
                res = "\n".join(lines)
        res = re.sub(r"Kind regards,|Sincerely,", "Warmly,\nBest,", res)
        return res

    if "persuasive" in lower_ref or "assertive" in lower_ref or "cta" in lower_ref:
        res = text.strip()
        if not re.search(r"next steps|call to action|please confirm", res, re.I):
            res += "\n\nPlease let me know your thoughts by end of day so we can finalize the next steps."
        return res

    return text


def synthesize_professional_message(
    user_prompt: str,
    recipient_name: str | None = None,
    previous_draft: str | None = None,
    refinement_instruction: str | None = None,
    sender_name: str = "Me",
) -> tuple[str, str, list[str]]:
    """Synthesize a high-quality professional message draft with conversational reasoning."""
    target_name = recipient_name or "there"
    lower_prompt = user_prompt.lower()

    # If it's a refinement of an existing draft
    if previous_draft and (refinement_instruction or any(w in lower_prompt for w in ["shorter", "formal", "friendly", "persuasive", "cta", "change", "edit", "make it"])):
        ref_rule = refinement_instruction or user_prompt
        refined = refine_message_text(previous_draft, ref_rule)
        reasoning = f"I've refined your message to be {ref_rule.lower()}. The core details and tone have been preserved."
        actions = ["Make more concise", "More formal", "Friendlier", "Add clear CTA"]
        return reasoning, refined, actions

    # Scenario 1: Status update
    if any(k in lower_prompt for k in ["status", "update", "progress", "blocker", "done", "completed"]):
        topic_match = re.search(r"(?:on|about|regarding)\s+([^.!?]+)", user_prompt, re.I)
        topic = topic_match.group(1).strip() if topic_match else "the current sprint tasks"
        draft = (
            f"Hi {target_name},\n\n"
            f"Here is a quick status update regarding {topic}:\n"
            f"• Milestones reached: Core implementation and initial reviews are completed.\n"
            f"• Current focus: Finalizing testing and polishing the deliverables.\n"
            f"• Blockers: None at this stage.\n\n"
            f"Please let me know if you would like me to prioritize any specific aspect."
        )
        reasoning = f"I generated a structured project status update addressed to {target_name}. It highlights accomplishments, current focus, and invites feedback without being overwhelming."
        actions = ["Make more concise", "More formal", "Add specific deadline"]
        return reasoning, draft, actions

    # Scenario 2: Reschedule or Meeting
    if any(k in lower_prompt for k in ["reschedule", "meeting", "sync", "catch up", "calendar", "time slot"]):
        draft = (
            f"Hi {target_name},\n\n"
            f"I hope you're having a good week. Due to a schedule conflict, I need to see if we could reschedule our upcoming meeting.\n\n"
            f"Would any of the following times work for you instead?\n"
            f"• Tomorrow at 2:00 PM\n"
            f"• Tomorrow at 4:30 PM\n"
            f"• Thursday morning between 10:00 AM - 12:00 PM\n\n"
            f"Apologies for any inconvenience, and thank you for your flexibility!"
        )
        reasoning = f"I drafted a considerate meeting rescheduling note with 3 concrete alternative options so {target_name} can pick what works best."
        actions = ["Make more formal", "Friendlier", "Specify only one time"]
        return reasoning, draft, actions

    # Scenario 3: Follow-up / Reminder
    if any(k in lower_prompt for k in ["follow up", "follow-up", "reminder", "nudge", "haven't heard", "pending"]):
        topic_match = re.search(r"(?:on|about|regarding)\s+([^.!?]+)", user_prompt, re.I)
        topic = topic_match.group(1).strip() if topic_match else "our previous discussion"
        draft = (
            f"Hi {target_name},\n\n"
            f"I'm following up on {topic} when you have a moment. We're ready to proceed to the next phase once we receive your feedback.\n\n"
            f"No urgent rush—just wanted to make sure it didn't get buried in your inbox. Thanks!"
        )
        reasoning = f"Here is a gentle, professional follow-up that conveys momentum without sounding demanding."
        actions = ["Make more urgent", "More formal", "Shorter"]
        return reasoning, draft, actions

    # Scenario 4: Leave / Sick / PTO
    if any(k in lower_prompt for k in ["leave", "sick", "pto", "vacation", "off today", "time off", "not feeling well"]):
        draft = (
            f"Hi {target_name},\n\n"
            f"I wanted to let you know that I am unwell today and will need to take sick leave to recover.\n\n"
            f"I will check in on urgent items if possible, and will provide an update regarding tomorrow as soon as I can. Thank you for your understanding."
        )
        reasoning = "Here is a clean, respectful leave notification that sets expectations appropriately."
        actions = ["Include coverage contact", "More formal", "Shorter"]
        return reasoning, draft, actions

    # Scenario 5: Apology / Delay
    if any(k in lower_prompt for k in ["apologize", "apology", "sorry", "delay", "late", "missed"]):
        draft = (
            f"Hi {target_name},\n\n"
            f"I wanted to apologize for the delay in getting this across to you. We ran into an unexpected issue that took extra time to address with the quality it warrants.\n\n"
            f"I am finalizing the details now and will have it delivered shortly. Thank you very much for your patience."
        )
        reasoning = "Here is an accountable, proactive apology that explains the reason constructively."
        actions = ["Specify exact time", "More concise", "More formal"]
        return reasoning, draft, actions

    # Default general professional synthesis
    cleaned_intent = re.sub(r"^(please\s+|can you\s+|write\s+a\s+message\s+to\s+|tell\s+|ask\s+)", "", user_prompt, flags=re.I).strip()
    draft = (
        f"Hi {target_name},\n\n"
        f"I am reaching out regarding {cleaned_intent}.\n\n"
        f"Please let me know if this aligns with your expectations, or if you would prefer to discuss this briefly on a quick call.\n\n"
        f"Thank you,\n{sender_name}"
    )
    reasoning = f"Here is a polished professional draft tailored for {target_name}. You can review it below, make any tweaks, or choose a tone refinement."
    actions = ["Make more concise", "More formal", "Friendlier", "Add call to action"]
    return reasoning, draft, actions


def _sync_http_post(url: str, headers: dict[str, str], payload: dict[str, Any]) -> dict[str, Any] | None:
    try:
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(url, data=data, headers=headers, method="POST")
        with urllib.request.urlopen(req, timeout=10.0) as resp:
            if resp.status == 200:
                return json.loads(resp.read().decode("utf-8"))
    except Exception:
        return None
    return None


async def call_external_llm_if_available(
    system_prompt: str,
    user_prompt: str,
    settings: Any,
) -> str | None:
    """Optionally query OpenAI or Gemini if an API key is configured."""
    if settings.openai_api_key:
        try:
            res = await asyncio.to_thread(
                _sync_http_post,
                "https://api.openai.com/v1/chat/completions",
                {"Authorization": f"Bearer {settings.openai_api_key}", "Content-Type": "application/json"},
                {
                    "model": "gpt-4o-mini",
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    "temperature": 0.6,
                },
            )
            if res and "choices" in res and res["choices"]:
                return res["choices"][0]["message"]["content"]
        except Exception:
            pass

    if settings.gemini_api_key:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={settings.gemini_api_key}"
            res = await asyncio.to_thread(
                _sync_http_post,
                url,
                {"Content-Type": "application/json"},
                {
                    "contents": [
                        {"role": "user", "parts": [{"text": f"{system_prompt}\n\nUser request: {user_prompt}"}]}
                    ],
                },
            )
            if res and "candidates" in res and res["candidates"]:
                parts = res["candidates"][0].get("content", {}).get("parts", [])
                if parts:
                    return parts[0].get("text")
        except Exception:
            pass

    return None

