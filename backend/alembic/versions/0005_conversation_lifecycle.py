"""Add per-user conversation visibility.

Revision ID: 0005_conversation_lifecycle
Revises: 0004_admin_push_notifications
"""
from alembic import op
import sqlalchemy as sa

revision = "0005_conversation_lifecycle"
down_revision = "0004_admin_push_notifications"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("conversation_participants", sa.Column("hidden_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("conversation_participants", "hidden_at")
