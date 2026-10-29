import unittest
from app.services.ai_assistant import (
    TEMPLATES,
    extract_recipient_and_channel,
    refine_message_text,
    synthesize_professional_message,
)


class TestAIAssistant(unittest.TestCase):
    def test_templates_exist(self):
        self.assertGreater(len(TEMPLATES), 4)
        for t in TEMPLATES:
            self.assertIn("title", t)
            self.assertIn("category", t)
            self.assertIn("template", t)

    def test_extract_recipient_and_channel_whatsapp(self):
        prompt = "Send this message to Rahul on WhatsApp"
        recipient, channel = extract_recipient_and_channel(prompt)
        self.assertEqual(recipient, "Rahul")
        self.assertEqual(channel, "whatsapp")

    def test_extract_recipient_and_channel_email(self):
        prompt = "Forward this to Dr. Smith via email"
        recipient, channel = extract_recipient_and_channel(prompt)
        self.assertEqual(recipient, "Dr. Smith")
        self.assertEqual(channel, "email")

    def test_extract_recipient_and_channel_syora(self):
        prompt = "Send this to Priya in chat"
        recipient, channel = extract_recipient_and_channel(prompt)
        self.assertEqual(recipient, "Priya")
        self.assertEqual(channel, "syora")

    def test_synthesize_status_update(self):
        prompt = "Give my lead a status update on confidential web backend"
        reasoning, draft, actions = synthesize_professional_message(
            user_prompt=prompt,
            recipient_name="Lead",
            sender_name="Kumar",
        )
        self.assertIn("status update", draft.lower())
        self.assertIn("Milestones", draft)
        self.assertTrue(len(actions) > 0)

    def test_synthesize_reschedule(self):
        prompt = "Need to reschedule our meeting tomorrow"
        reasoning, draft, actions = synthesize_professional_message(
            user_prompt=prompt,
            recipient_name="Alex",
            sender_name="Kumar",
        )
        self.assertIn("reschedule", draft.lower())
        self.assertIn("tomorrow", draft.lower())

    def test_refine_tone_formal(self):
        initial = "Hey Alex, can't make it today. Thanks!"
        refined = refine_message_text(initial, "make it formal")
        self.assertIn("cannot", refined)
        self.assertIn("Dear", refined)
        self.assertIn("Thank you", refined)

    def test_refine_tone_concise(self):
        initial = "Hi Alex,\n\nI hope you are having a wonderful week.\n\nHere is the report.\n\nLet me know."
        refined = refine_message_text(initial, "make it concise")
        self.assertNotIn("I hope you are having a wonderful week", refined)
        self.assertIn("Here is the report", refined)

    def test_refine_tone_friendly(self):
        initial = "Hi Alex,\n\nPlease review the attached file.\n\nSincerely,\nKumar"
        refined = refine_message_text(initial, "make it friendly and warm")
        self.assertIn("Hope you're having", refined)

    def test_diagnostics(self):
        import asyncio
        from app.config.settings import Settings
        from app.services.ai_assistant import get_ai_diagnostics
        settings = Settings(
            DATABASE_URL="postgresql+asyncpg://user:pass@localhost:5432/test",
            JWT_ACCESS_SECRET="12345678901234567890123456789012",
            JWT_REFRESH_SECRET="12345678901234567890123456789012",
            CLIENT_ORIGINS=["http://localhost:3000"],
            GEMINI_API_KEY="",
            OLLAMA_ENABLED=False,
        )
        diag = asyncio.run(get_ai_diagnostics(settings))
        self.assertIn("active_provider", diag)
        self.assertIn("provider_name", diag)
        self.assertIn("is_external_configured", diag)
        self.assertFalse(diag["is_external_configured"])
        self.assertEqual(diag["active_provider"], "builtin")
        self.assertIn("gemini", diag)
        self.assertIn("ollama", diag)
        self.assertIn("builtin", diag)

    def test_external_llm_fallback(self):
        import asyncio
        from app.config.settings import Settings
        from app.services.ai_assistant import call_external_llm_if_available
        settings = Settings(
            DATABASE_URL="postgresql+asyncpg://user:pass@localhost:5432/test",
            JWT_ACCESS_SECRET="12345678901234567890123456789012",
            JWT_REFRESH_SECRET="12345678901234567890123456789012",
            CLIENT_ORIGINS=["http://localhost:3000"],
            GEMINI_API_KEY="",
            OLLAMA_ENABLED=False,
            ai_preferred_provider="auto",
        )
        # With no keys, should gracefully return (None, 'Built-in Neural Engine')
        text, label = asyncio.run(call_external_llm_if_available("sys", "prompt", settings))
        self.assertIsNone(text)
        self.assertEqual(label, "Built-in Neural Engine")

    def test_polish_message_typo_correction(self):
        import asyncio
        from app.config.settings import Settings
        from app.services.ai_assistant import polish_message_with_ai
        settings = Settings(
            DATABASE_URL="postgresql+asyncpg://user:pass@localhost:5432/test",
            JWT_ACCESS_SECRET="12345678901234567890123456789012",
            JWT_REFRESH_SECRET="12345678901234567890123456789012",
            CLIENT_ORIGINS=["http://localhost:3000"],
            GEMINI_API_KEY="",
            OLLAMA_ENABLED=False,
        )
        draft = "hi how are you is everythi going well"
        polished, provider = asyncio.run(polish_message_with_ai(draft, "polish", None, settings))
        self.assertIn("everything", polished)
        self.assertNotIn("everythi ", polished)
        self.assertTrue(polished.endswith("."))

    def test_polish_message_custom_never_prepends_instruction(self):
        import asyncio
        from app.config.settings import Settings
        from app.services.ai_assistant import polish_message_with_ai
        settings = Settings(
            DATABASE_URL="postgresql+asyncpg://user:pass@localhost:5432/test",
            JWT_ACCESS_SECRET="12345678901234567890123456789012",
            JWT_REFRESH_SECRET="12345678901234567890123456789012",
            CLIENT_ORIGINS=["http://localhost:3000"],
            GEMINI_API_KEY="",
            OLLAMA_ENABLED=False,
        )
        instruction = "i just want to share my love thought best friend"
        draft = "hi how are you"
        polished, provider = asyncio.run(polish_message_with_ai(draft, "custom", instruction, settings))
        self.assertFalse(polished.startswith("i just want to share my love thought best friend:"))
        self.assertNotIn("i just want to share my love thought best friend:", polished)
        self.assertTrue(len(polished) > 5)


if __name__ == "__main__":
    unittest.main()
