"""create update media table

Revision ID: a2b71c8e9d14
Revises: 94134310840b
Create Date: 2026-11-20
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "a2b71c8e9d14"
down_revision: str | Sequence[str] | None = "94134310840b"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "update_media",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("update_id", sa.Uuid(), nullable=False),
        sa.Column("file_asset_id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["file_asset_id"], ["file_assets.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["update_id"], ["updates.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("file_asset_id"),
    )
    op.create_index(
        op.f("ix_update_media_update_id"),
        "update_media",
        ["update_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_update_media_update_id"), table_name="update_media")
    op.drop_table("update_media")
