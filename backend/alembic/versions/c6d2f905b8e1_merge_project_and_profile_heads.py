"""Merge the project and profile migration branches.

Revision ID: c6d2f905b8e1
Revises: 0359a3be4a26, 288ab4e7f908
Create Date: 2026-10-20

"""
from typing import Sequence, Union


# revision identifiers, used by Alembic.
revision: str = "c6d2f905b8e1"
down_revision: Union[str, Sequence[str], None] = (
    "0359a3be4a26",
    "288ab4e7f908",
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Merge migration branches; both parent revisions contain the schema changes."""


def downgrade() -> None:
    """No schema changes are made by this merge revision."""
