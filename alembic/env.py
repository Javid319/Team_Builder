import os
from logging.config import fileConfig
from pathlib import Path

from sqlalchemy import engine_from_config, pool
from alembic import context

# Load .env file so DATABASE_URL is available
from dotenv import load_dotenv
env_path = Path(__file__).parents[1] / ".env"
load_dotenv(dotenv_path=env_path)

# ── Alembic Config ────────────────────────────────────────────
config = context.config

# Override sqlalchemy.url from the DATABASE_URL environment variable.
# Use direct assignment to avoid .ini interpolation issues with % in passwords.
database_url = os.environ.get("DATABASE_URL")
if not database_url:
    raise ValueError(
        "DATABASE_URL environment variable is not set. "
        "Please check your .env file."
    )

# Set up loggers from alembic.ini
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# ── Target metadata ───────────────────────────────────────────
# Import Base (which triggers all model imports) so autogenerate
# can detect every table.
from app.db.base import Base  # noqa: E402
target_metadata = Base.metadata


# ── Migration runners ─────────────────────────────────────────
def run_migrations_offline() -> None:
    """Emit SQL to stdout without a live DB connection."""
    context.configure(
        url=database_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations against a live DB connection."""
    from sqlalchemy import create_engine
    connectable = create_engine(database_url, poolclass=pool.NullPool)

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_server_default=True,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
