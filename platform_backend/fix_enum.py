from app.db.session import engine
from sqlalchemy import text

def fix_enum():
    values = ['beginner', 'intermediate', 'advanced', 'low', 'medium', 'high']
    with engine.connect() as conn:
        conn.execution_options(isolation_level="AUTOCOMMIT")
        for val in values:
            try:
                conn.execute(text(f"ALTER TYPE confidencelevel ADD VALUE IF NOT EXISTS '{val}';"))
                print(f"Added '{val}' to confidencelevel enum")
            except Exception as e:
                print(f"Error adding '{val}': {e}")

if __name__ == "__main__":
    fix_enum()
