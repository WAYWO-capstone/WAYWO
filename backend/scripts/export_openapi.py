"""Write the FastAPI OpenAPI schema to a JSON file for the frontend.

Run from the backend directory:

    python -m scripts.export_openapi [output_path]
"""

import json
import sys
from pathlib import Path

from app.main import app

DEFAULT_OUTPUT = Path(__file__).resolve().parents[2] / "frontend" / "openapi.json"


def main() -> None:
    output = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_OUTPUT
    schema = json.dumps(app.openapi(), indent=2, sort_keys=True, ensure_ascii=False)
    output.write_text(schema + "\n", encoding="utf-8", newline="\n")
    print(f"Wrote OpenAPI schema to {output}")


if __name__ == "__main__":
    main()
