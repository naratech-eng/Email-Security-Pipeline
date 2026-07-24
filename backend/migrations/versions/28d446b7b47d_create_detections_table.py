"""create detections table

M7-T15 — one shared table for both the dashboard upload/paste flow and the
mail server's real-time content_filter, distinguished by `source`. Stores
the structured analysis result (verdict, scores, features, remediation) and
enough metadata to review a detection later; deliberately does not store the
raw email body/content (privacy/storage decision, see docs/m7-t4-t6-mail-filter-testing.md).

Revision ID: 28d446b7b47d
Revises:
Create Date: 2026-07-24 13:42:32.077289

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '28d446b7b47d'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'detections',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),

        # Which path produced this detection, and (for uploads only) who.
        sa.Column('source', sa.Text(), nullable=False),
        sa.Column('submitted_by', sa.Text(), nullable=True),

        # Overall result
        sa.Column('verdict', sa.Text(), nullable=False),
        sa.Column('likelihood', sa.Numeric(), nullable=False),
        sa.Column('summary', sa.Text(), nullable=False),
        sa.Column('remediation', sa.Text(), nullable=False),

        # Email metadata — no raw body/content stored
        sa.Column('from_addr', sa.Text(), nullable=True),
        sa.Column('to_addr', sa.Text(), nullable=True),
        sa.Column('subject', sa.Text(), nullable=True),
        sa.Column('email_date', sa.Text(), nullable=True),
        sa.Column('num_urls', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('attachment_count', sa.Integer(), nullable=False, server_default='0'),

        # Email-track detail
        sa.Column('email_score', sa.Float(), nullable=True),
        sa.Column('email_model', sa.Text(), nullable=True),
        sa.Column('email_reason', sa.Text(), nullable=True),
        sa.Column('email_features', postgresql.JSONB(), nullable=True),

        # Per-URL detail (verdict/score/reason/features for each extracted URL)
        sa.Column('urls', postgresql.JSONB(), nullable=False, server_default='[]'),

        sa.CheckConstraint("source IN ('upload', 'server')", name='ck_detections_source'),
        sa.CheckConstraint("verdict IN ('clean', 'flag', 'quarantine')", name='ck_detections_verdict'),
    )
    op.create_index('ix_detections_created_at', 'detections', ['created_at'])
    op.create_index('ix_detections_source', 'detections', ['source'])
    op.create_index('ix_detections_verdict', 'detections', ['verdict'])


def downgrade() -> None:
    op.drop_index('ix_detections_verdict', table_name='detections')
    op.drop_index('ix_detections_source', table_name='detections')
    op.drop_index('ix_detections_created_at', table_name='detections')
    op.drop_table('detections')
