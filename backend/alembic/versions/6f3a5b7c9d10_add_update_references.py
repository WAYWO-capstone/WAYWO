"""replace problem links with general update references

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
    op.execute(
        sa.text(
            """
            INSERT INTO update_references (update_id, referenced_update_id)
            SELECT id, problem_id
            FROM updates
            WHERE problem_id IS NOT NULL
            """
        )
    )
    op.drop_index(op.f("ix_updates_problem_id"), table_name="updates")
    with op.batch_alter_table("updates") as batch_op:
        batch_op.drop_constraint(
            "fk_updates_problem_id_updates", type_="foreignkey"
        )
        batch_op.drop_column("problem_id")


def downgrade() -> None:
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
    op.execute(
        sa.text(
            """
            UPDATE updates
            SET problem_id = (
                SELECT referenced_update_id
                FROM update_references
                WHERE update_id = updates.id
                LIMIT 1
            )
            """
        )
    )
    op.drop_table("update_references")
