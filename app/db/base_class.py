from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """
    Thin base class with no model imports.
    All SQLAlchemy models import Base from here.
    """
    pass
