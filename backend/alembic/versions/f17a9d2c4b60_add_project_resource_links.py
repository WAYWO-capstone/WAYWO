"""add external links to project resources

Revision ID: f17a9d2c4b60
Revises: d4e7a1c93b52
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "f17a9d2c4b60"
down_revision: str | Sequence[str] | None = "d4e7a1c93b52"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "project_resource_links",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("url", sa.String(length=2048), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_project_resource_links_project_id"),
        "project_resource_links",
        ["project_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_project_resource_links_project_id"),
        table_name="project_resource_links",
    )
    op.drop_table("project_resource_links")
