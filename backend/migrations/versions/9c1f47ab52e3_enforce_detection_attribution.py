"""enforce detection attribution and add immutable submitter id

M7-T12 — makes the upload/server feed split a property of the DATA, not just of
the code path that wrote it. Two changes:

1. `submitted_by_sub` — the Cognito `sub` claim. `submitted_by` holds the
   readable `username` that the detections table, drill-down, and CSV export
   render; `sub` is the immutable id that survives a username change, so
   "everything this analyst submitted" stays answerable years later. Nullable,
   because server-feed rows have no submitter and legacy rows predate it.

2. `ck_detections_attribution` — an upload row must name a submitter, and a
   server row must not. Before this, both impossible states were representable:
   an unattributable upload (which is what the Schemathesis fuzzing produced —
   see .github/workflows/dast-nightly.yml) and a server row claiming a human.
   With the constraint, a future bug that forgets to derive provenance fails
   loudly at write time instead of quietly polluting the feed.

Legacy rows are backfilled to an explicit sentinel rather than exempted, so
pre-enforcement rows are visibly legacy instead of silently special.

Revision ID: 9c1f47ab52e3
Revises: 28d446b7b47d
Create Date: 2026-07-27 11:14:08.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '9c1f47ab52e3'
down_revision: Union[str, Sequence[str], None] = '28d446b7b47d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Marks rows written before provenance was derived server-side. Kept as a
# literal here (not a shared constant) so re-reading this migration later shows
# exactly what landed, even if the application constant is renamed.
_LEGACY_SUBMITTER = 'unattributed-legacy'


def upgrade() -> None:
    op.add_column(
        'detections',
        sa.Column('submitted_by_sub', sa.Text(), nullable=True),
    )

    # The constraint below would fail on existing data, so reconcile first.
    # Uploads with no submitter are the fuzzer/pre-enforcement rows.
    op.execute(
        f"""
        UPDATE detections
           SET submitted_by = '{_LEGACY_SUBMITTER}'
         WHERE source = 'upload' AND submitted_by IS NULL
        """
    )
    # A server row naming a submitter is the mail filter having sent one; the
    # mail path has no human behind it, so clear rather than invent.
    op.execute(
        """
        UPDATE detections
           SET submitted_by = NULL
         WHERE source = 'server' AND submitted_by IS NOT NULL
        """
    )

    op.create_check_constraint(
        'ck_detections_attribution',
        'detections',
        "(source = 'upload' AND submitted_by IS NOT NULL) OR "
        "(source = 'server' AND submitted_by IS NULL)",
    )

    # Attribution lookups filter by submitter; the existing ix_detections_source
    # doesn't help those. Partial, because server rows are always NULL here.
    op.create_index(
        'ix_detections_submitted_by_sub',
        'detections',
        ['submitted_by_sub'],
        postgresql_where=sa.text('submitted_by_sub IS NOT NULL'),
    )


def downgrade() -> None:
    op.drop_index('ix_detections_submitted_by_sub', table_name='detections')
    op.drop_constraint('ck_detections_attribution', 'detections', type_='check')
    op.drop_column('detections', 'submitted_by_sub')
    # The backfilled sentinel is deliberately NOT reverted to NULL: it records
    # that those rows were never attributable, which stays true either way.
