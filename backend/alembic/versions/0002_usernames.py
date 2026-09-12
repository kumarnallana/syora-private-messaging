"""Add unique usernames for people discovery.

Revision ID: 0002_usernames
Revises: 0001_initial
"""
from alembic import op
import sqlalchemy as sa

revision = "0002_usernames"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("username", sa.String(32), nullable=True))
    op.execute("UPDATE users SET username = 'user_' || substr(replace(id::text, '-', ''), 1, 12)")
    op.alter_column("users", "username", nullable=False)
    op.create_index("ix_users_username", "users", ["username"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_users_username", table_name="users")
    op.drop_column("users", "username")
