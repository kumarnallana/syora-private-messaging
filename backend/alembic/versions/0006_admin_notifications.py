"""Add admin notifications table for persistent alert tracking.

Revision ID: 0006_admin_notifications
Revises: 0005_conversation_lifecycle
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0006_admin_notifications"
down_revision = "0005_conversation_lifecycle"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "admin_notifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("admin_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("type", sa.String(length=64), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("url", sa.String(length=255), nullable=True),
        sa.Column("read", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_admin_notifications_admin_id", "admin_notifications", ["admin_id"])
    op.create_index("ix_admin_notifications_created_at", "admin_notifications", ["created_at"])


def downgrade() -> None:
    op.drop_table("admin_notifications")
