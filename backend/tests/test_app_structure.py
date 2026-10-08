from app.core.models_registry import Base
from app.main import app


def test_app_keeps_existing_health_routes() -> None:
    route_paths = set(app.openapi()["paths"])

    assert "/" in route_paths
    assert "/database-test" in route_paths


def test_model_registry_exposes_shared_metadata() -> None:
    assert Base.metadata is not None
