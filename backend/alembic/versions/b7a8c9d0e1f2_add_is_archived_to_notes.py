"""Add is_archived to notes

Revision ID: b7a8c9d0e1f2
Revises: 347749b5eec3
Create Date: 2026-01-06 14:35:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'b7a8c9d0e1f2'
down_revision: Union[str, Sequence[str], None] = '347749b5eec3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Handle the fact that the column might already exist if they ran a partial manual migration
    # but based on the user logs, it doesn't exist.
    op.add_column('notes', sa.Column('is_archived', sa.Boolean(), nullable=False, server_default=sa.text('false')))


def downgrade() -> None:
    op.drop_column('notes', 'is_archived')
