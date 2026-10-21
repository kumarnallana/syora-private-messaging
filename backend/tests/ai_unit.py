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


if __name__ == "__main__":
    unittest.main()
