"""Initial production schema.

Revision ID: 0001_initial
"""
from alembic import op
from app.db.base import Base
from app import models
revision="0001_initial"
down_revision=None
branch_labels=None
depends_on=None

def upgrade(): Base.metadata.create_all(bind=op.get_bind())
def downgrade(): Base.metadata.drop_all(bind=op.get_bind())
