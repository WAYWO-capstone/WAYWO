"""add archived project status

Revision ID: d4e7a1c93b52
Revises: a2b71c8e9d14
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d4e7a1c93b52"
down_revision: Union[str, Sequence[str], None] = "a2b71c8e9d14"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# The status column is a VARCHAR whose allowed values are enforced by this
# CHECK constraint (SQLAlchemy names it after the enum).
CONSTRAINT = "project_status"


def upgrade() -> None:
    op.add_column(
        "projects",
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.drop_constraint(CONSTRAINT, "projects", type_="check")
    op.create_check_constraint(
        CONSTRAINT,
        "projects",
        "status IN ('DRAFT', 'ACTIVE', 'COMPLETED', 'ARCHIVED')",
    )


def downgrade() -> None:
    # Archived projects go back to what they were before being archived.
    op.execute(
        "UPDATE projects SET status = CASE WHEN completed_at IS NULL "
        "THEN 'ACTIVE' ELSE 'COMPLETED' END WHERE status = 'ARCHIVED'"
    )
    op.execute(
        "UPDATE feed_items SET public = true WHERE id IN "
        "(SELECT id FROM projects WHERE archived_at IS NOT NULL)"
    )
    op.drop_constraint(CONSTRAINT, "projects", type_="check")
    op.create_check_constraint(
        CONSTRAINT,
        "projects",
        "status IN ('DRAFT', 'ACTIVE', 'COMPLETED')",
    )
    op.drop_column("projects", "archived_at")
