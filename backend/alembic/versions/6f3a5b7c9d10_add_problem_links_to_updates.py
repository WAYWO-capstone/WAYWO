"""add problem links to updates

Revision ID: 6f3a5b7c9d10
Revises: 0359a3be4a26
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "6f3a5b7c9d10"
down_revision: Union[str, Sequence[str], None] = "0359a3be4a26"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("updates", sa.Column("problem_id", sa.Uuid(), nullable=True))
    op.create_index(
        op.f("ix_updates_problem_id"), "updates", ["problem_id"], unique=False
    )
    op.create_foreign_key(
        "fk_updates_problem_id_updates",
        "updates",
        "updates",
        ["problem_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_updates_problem_id_updates", "updates", type_="foreignkey")
    op.drop_index(op.f("ix_updates_problem_id"), table_name="updates")
    op.drop_column("updates", "problem_id")
