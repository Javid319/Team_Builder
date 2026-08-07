"""
Run this once to create all tables in Supabase.

Usage:
    python -m app.db.init_db
"""
from app.db.session import engine
from app.db.base import Base  # triggers all model imports


def init_db() -> None:
    print("Creating all tables...")
    Base.metadata.create_all(bind=engine)
    print("Done.")


if __name__ == "__main__":
    init_db()
