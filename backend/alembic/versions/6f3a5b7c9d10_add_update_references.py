"""add general update references

Revision ID: 6f3a5b7c9d10
Revises: b3ea848880d4
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "6f3a5b7c9d10"
down_revision: Union[str, Sequence[str], None] = "b3ea848880d4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "update_references",
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


def downgrade() -> None:
    op.drop_table("update_references")
