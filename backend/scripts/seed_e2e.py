"""Wipes the E2E test database and puts the categories back.

Run it from backend/ once the migrations are applied ("alembic upgrade head"):

    python -m scripts.seed_e2e

You can run it as many times as you want, you'll always end up with the same
data. It only works on databases whose name ends in "_test" or "_ci", so it
won't wipe our real data by accident.
"""

import runpy
import sys
import uuid
from pathlib import Path

from sqlalchemy import create_engine, insert, text
from sqlalchemy.engine import make_url

from app.core.config import settings
from app.core.models_registry import Base
from app.projects.project.models import Category

# The categories come from the migration that seeds them.
migration = runpy.run_path(
    str(Path(__file__).parents[1] / "alembic/versions/b3ea848880d4_seed_categories.py")
)


def is_test_database(database_url: str) -> bool:
    name = make_url(database_url).database or ""
    return name.endswith(("_test", "_ci"))


def main() -> None:
    if not is_test_database(settings.database_url):
        sys.exit("Refusing to run: the database name must end in _test or _ci.")

    tables = ", ".join(f'"{table.name}"' for table in Base.metadata.sorted_tables)
    categories = [
        {"id": uuid.uuid5(migration["CATEGORY_NAMESPACE"], c["name"]), **c}
        for c in migration["CATEGORIES"]
    ]

    with create_engine(settings.database_url).begin() as connection:
        connection.execute(text(f"TRUNCATE {tables} RESTART IDENTITY CASCADE"))
        connection.execute(insert(Category), categories)

    print("E2E database reset and seeded.")


if __name__ == "__main__":
    main()
