from fastapi import FastAPI
from sqlalchemy import text

from app.accounts.auth.router import router as auth_router
from app.accounts.users.router import router as users_router
from app.core.database import engine
from app.discovery.explore.router import router as explore_router
from app.discovery.feed.router import router as discovery_feed_router
from app.feed_items.comments.router import router as comments_router
from app.knowledge.router import router as knowledge_router
from app.media.router import router as media_router
from app.moderation.router import router as moderation_router
from app.notifications.router import router as notifications_router
from app.projects.project.router import router as project_router
from app.projects.tutorials.router import router as tutorials_router
from app.projects.updates.router import router as updates_router
from app.social.router import router as social_router

app = FastAPI(
    title="WAYWO API",
    description="Backend API for WAYWO",
    version="0.1.0",
)

app.include_router(users_router)
app.include_router(auth_router)
app.include_router(media_router)
app.include_router(comments_router)
app.include_router(project_router, prefix="/projects")
app.include_router(updates_router, prefix="/projects")
app.include_router(tutorials_router, prefix="/projects")
app.include_router(social_router)
app.include_router(knowledge_router)
app.include_router(moderation_router)
app.include_router(explore_router, tags=["discovery"])
app.include_router(discovery_feed_router, tags=["discovery"])
app.include_router(notifications_router)


@app.get("/")
def root():
    return {"message": "WAYWO backend is running!"}


@app.get("/database-test")
def database_test():
    with engine.connect() as connection:
        result = connection.execute(text("SELECT 1"))
        return {"database": result.scalar()}