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
        self.assertTrue(polished.endswith(".") or polished.endswith("?"))

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

    def test_spell_check_trie_and_lru_cache(self):
        from app.services.ai_assistant import SpellCheckTrie, LRUCache
        trie = SpellCheckTrie()
        trie.insert("everything", "everything")
        trie.insert("everyhing", "everything")
        self.assertEqual(trie.search("everyhing"), "everything")
        self.assertEqual(trie.get_closest_match("everyhting", max_dist=2), "everything")

        cache = LRUCache(capacity=2)
        cache.put("k1", "v1")
        cache.put("k2", "v2")
        self.assertEqual(cache.get("k1"), "v1")
        cache.put("k3", "v3") # should evict k2 since k1 was accessed
        self.assertIsNone(cache.get("k2"))
        self.assertEqual(cache.get("k1"), "v1")
        self.assertEqual(cache.get("k3"), "v3")

    def test_conversational_flow_exact_target(self):
        from app.services.ai_assistant import offline_fallback_polish
        raw = "hi how are you what are you doing is everyhing going well. Please let me know your thoughts when convenient."
        polished = offline_fallback_polish(raw, "polish", None)
        expected = "Hi, how are you? What are you doing? Is everything going well? Please let me know your thoughts when convenient."
        self.assertEqual(polished, expected)

    def test_custom_convert_with_draft_and_empty(self):
        from app.services.ai_assistant import offline_fallback_polish
        # Case 1: Draft exists + custom instruction
        draft = "Hi how are you what are you doing is everyhing going well."
        instruction = "Turn this into a warm, loving message for my best friend."
        res1 = offline_fallback_polish(draft, "custom", instruction)
        self.assertFalse(res1.startswith(instruction))
        self.assertNotIn(instruction, res1)
        self.assertIn("friendship", res1.lower())

        # Case 2: Empty draft + custom instruction
        res2 = offline_fallback_polish("", "custom", "Draft a status update for manager")
        self.assertFalse(res2.startswith("Draft a status update"))
        self.assertTrue(len(res2) > 10)

    def test_all_tone_presets(self):
        from app.services.ai_assistant import offline_fallback_polish
        draft = "hi please review the file"
        # 1. Polish
        p = offline_fallback_polish(draft, "polish")
        self.assertTrue(p.startswith("Hi,"))
        # 2. Professional
        prof = offline_fallback_polish(draft, "professional")
        self.assertTrue("Hello" in prof or "Dear" in prof or "Please review" in prof)
        # 3. Concise
        concise = offline_fallback_polish("hi how are you please review the file", "concise")
        self.assertNotIn("how are you", concise.lower())
        # 4. Friendly
        friendly = offline_fallback_polish("please review the file", "friendly")
        self.assertTrue(friendly.startswith("Hi!"))
        # 5. Action
        action = offline_fallback_polish("here is the update", "action")
        self.assertIn("Please let me know your thoughts when convenient.", action)


if __name__ == "__main__":
    unittest.main()
