"""add reasons to update references

Revision ID: 745e6a10cb82
Revises: 6f3a5b7c9d10
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "745e6a10cb82"
down_revision: str | Sequence[str] | None = "6f3a5b7c9d10"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    connection = op.get_bind()
    op.create_table(
        "update_references_new",
        sa.Column("update_id", sa.Uuid(), nullable=False),
        sa.Column("referenced_update_id", sa.Uuid(), nullable=False),
        sa.Column(
            "reason",
            sa.String(length=30),
            server_default=sa.text("'RELATED_TO'"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "reason IN ('SOLVES', 'PARTIALLY_SOLVES', 'RELATED_TO')",
            name="ck_update_references_reason",
        ),
        sa.CheckConstraint(
            "update_id != referenced_update_id",
            name="ck_update_references_not_self",
        ),
        sa.ForeignKeyConstraint(
            ["update_id"], ["updates.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["referenced_update_id"], ["updates.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("update_id", "referenced_update_id"),
    )
    connection.execute(
        sa.text(
            "INSERT INTO update_references_new "
            "(update_id, referenced_update_id, reason) "
            "SELECT update_id, referenced_update_id, 'RELATED_TO' "
            "FROM update_references"
        )
    )
    op.drop_table("update_references")
    op.rename_table("update_references_new", "update_references")
    op.create_index(
        "ix_update_references_referenced_update_id",
        "update_references",
        ["referenced_update_id"],
    )


def downgrade() -> None:
    connection = op.get_bind()
    op.create_table(
        "update_references_old",
        sa.Column("update_id", sa.Uuid(), nullable=False),
        sa.Column("referenced_update_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(
            ["update_id"], ["updates.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["referenced_update_id"], ["updates.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("update_id", "referenced_update_id"),
    )
    connection.execute(
        sa.text(
            "INSERT INTO update_references_old "
            "(update_id, referenced_update_id) "
            "SELECT update_id, referenced_update_id FROM update_references"
        )
    )
    op.drop_table("update_references")
    op.rename_table("update_references_old", "update_references")
