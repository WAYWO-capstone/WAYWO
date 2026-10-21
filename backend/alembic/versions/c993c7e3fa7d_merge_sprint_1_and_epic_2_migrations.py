"""merge sprint-1 and epic-2 migrations

Revision ID: c993c7e3fa7d
Revises: 0359a3be4a26, 288ab4e7f908
Create Date: 2026-10-20 21:19:06.923789

"""
from typing import Sequence, Union

# revision identifiers, used by Alembic.
revision: str = 'c993c7e3fa7d'
down_revision: Union[str, Sequence[str], None] = ('0359a3be4a26', '288ab4e7f908')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
