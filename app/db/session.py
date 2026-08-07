from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from typing import Generator

from app.core.config import settings

# Supabase uses PostgreSQL — SQLAlchemy connects via the DATABASE_URL directly.
# psycopg2 is used as the driver (included in requirements.txt).
engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,       # drops stale connections before use
    pool_size=10,
    max_overflow=20,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency — yields a DB session and closes it when done."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
