"""Add user roles and refresh-session activity tracking.

Revision ID: 0003_roles_and_session_activity
Revises: 0002_usernames
"""
from alembic import op
import sqlalchemy as sa

revision = "0003_roles_and_session_activity"
down_revision = "0002_usernames"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("role", sa.String(16), nullable=False, server_default="user"))
    op.create_check_constraint("ck_users_role", "users", "role IN ('admin', 'user')")
    op.add_column(
        "refresh_sessions",
        sa.Column("last_activity_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )


def downgrade() -> None:
    op.drop_column("refresh_sessions", "last_activity_at")
    op.drop_constraint("ck_users_role", "users", type_="check")
    op.drop_column("users", "role")
