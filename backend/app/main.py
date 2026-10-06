from fastapi import FastAPI
from sqlalchemy import text

from app.core.database import engine

app = FastAPI(
    title="WAYWO API",
    description="Backend API for WAYWO",
    version="0.1.0",
)


@app.get("/")
def root():
    return {"message": "WAYWO backend is running!"}


@app.get("/database-test")
def database_test():
    with engine.connect() as connection:
        result = connection.execute(text("SELECT 1"))
        return {"database": result.scalar()}