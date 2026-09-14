"""Add admin notification preferences and device push subscriptions.

Revision ID: 0004_admin_push_notifications
Revises: 0003_roles_and_session_activity
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0004_admin_push_notifications"
down_revision = "0003_roles_and_session_activity"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("user_preferences", sa.Column("admin_login_notifications", sa.Boolean(), nullable=False, server_default=sa.true()))
    op.add_column("user_preferences", sa.Column("admin_message_notifications", sa.Boolean(), nullable=False, server_default=sa.true()))
    op.add_column("user_preferences", sa.Column("admin_message_preview", sa.Boolean(), nullable=False, server_default=sa.true()))
    op.add_column("user_preferences", sa.Column("admin_push_enabled", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.create_table(
        "push_subscriptions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("session_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("refresh_sessions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("endpoint", sa.Text(), nullable=False, unique=True),
        sa.Column("p256dh", sa.Text(), nullable=False),
        sa.Column("auth", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_push_subscriptions_user_id", "push_subscriptions", ["user_id"])
    op.create_index("ix_push_subscriptions_session_id", "push_subscriptions", ["session_id"])


def downgrade() -> None:
    op.drop_table("push_subscriptions")
    op.drop_column("user_preferences", "admin_push_enabled")
    op.drop_column("user_preferences", "admin_message_preview")
    op.drop_column("user_preferences", "admin_message_notifications")
    op.drop_column("user_preferences", "admin_login_notifications")
