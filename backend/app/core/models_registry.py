from importlib import import_module

from app.core.database import Base

MODEL_MODULES = (
    "app.accounts.auth.models",
    "app.accounts.users.models",
    "app.discovery.explore.models",
    "app.discovery.feed.models",
    "app.feed_items.comments.models",
    "app.feed_items.feed_item.models",
    "app.knowledge.models",
    "app.media.models",
    "app.moderation.models",
    "app.notifications.models",
    "app.projects.project.models",
    "app.projects.tutorials.models",
    "app.projects.updates.models",
    "app.social.models",
)

for model_module in MODEL_MODULES:
    import_module(model_module)

__all__ = ["Base"]
