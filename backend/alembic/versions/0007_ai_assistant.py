"""Add AI conversations and messages tables for Syora AI assistant.

Revision ID: 0007_ai_assistant
Revises: 0006_admin_notifications
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0007_ai_assistant"
down_revision = "0006_admin_notifications"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ai_conversations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(length=120), nullable=False, server_default="New Assistant Chat"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_ai_conversations_user_id", "ai_conversations", ["user_id"])
    op.create_index("ix_ai_conversations_updated_at", "ai_conversations", ["updated_at"])

    op.create_table(
        "ai_messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("conversation_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("ai_conversations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("draft_message", sa.Text(), nullable=True),
        sa.Column("recipient_name", sa.String(length=120), nullable=True),
        sa.Column("recipient_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("channel", sa.String(length=30), nullable=True),
        sa.Column("send_status", sa.String(length=30), nullable=True),
        sa.Column("metadata_json", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_ai_messages_conversation_id", "ai_messages", ["conversation_id"])
    op.create_index("ix_ai_messages_created_at", "ai_messages", ["created_at"])


def downgrade() -> None:
    op.drop_table("ai_messages")
    op.drop_table("ai_conversations")
