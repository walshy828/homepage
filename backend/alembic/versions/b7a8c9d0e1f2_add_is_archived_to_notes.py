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
    # Check if column exists first to allow for idempotent migrations
    conn = op.get_bind()
    # Check if 'is_archived' exists in 'notes' table
    inspector = sa.inspect(conn)
    columns = [c['name'] for c in inspector.get_columns('notes')]
    
    if 'is_archived' not in columns:
        print("Column 'is_archived' does not exist, adding it...")
        op.add_column('notes', sa.Column('is_archived', sa.Boolean(), nullable=False, server_default=sa.text('false')))
    else:
        print("Column 'is_archived' already exists, skipping addition.")


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [c['name'] for c in inspector.get_columns('notes')]
    
    if 'is_archived' in columns:
        op.drop_column('notes', 'is_archived')
