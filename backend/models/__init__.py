"""
Database models package
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
import os

# Get database path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATABASE_PATH = os.path.join(BASE_DIR, 'database', 'pass_network.db')
DATABASE_URL = f'sqlite:///{DATABASE_PATH}'

# Create engine and session
engine = create_engine(DATABASE_URL, echo=False)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
Base = declarative_base()


SCHEMA_UPGRADES = {
    'events': {
        'event_index': 'INTEGER',
        'duration': 'FLOAT',
        'possession_id': 'INTEGER',
        'play_pattern': 'VARCHAR(100)',
        'position_name': 'VARCHAR(100)',
        'possession_team_id': 'INTEGER',
        'under_pressure': 'BOOLEAN',
        'outcome_name': 'VARCHAR(100)',
        'shot_outcome': 'VARCHAR(100)',
        'is_goal': 'BOOLEAN',
    },
    'passes': {
        'technique': 'VARCHAR(50)',
        'is_cross': 'BOOLEAN',
        'is_switch': 'BOOLEAN',
        'is_through_ball': 'BOOLEAN',
        'is_cut_back': 'BOOLEAN',
    },
}

def get_db():
    """Get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _table_columns(conn, table_name: str) -> set:
    rows = conn.exec_driver_sql(f"PRAGMA table_info({table_name})").fetchall()
    return {row[1] for row in rows}


def ensure_schema_upgrades():
    """Apply lightweight additive SQLite schema upgrades in-place."""
    with engine.begin() as conn:
        existing_tables = {
            row[0]
            for row in conn.exec_driver_sql(
                "SELECT name FROM sqlite_master WHERE type='table'"
            ).fetchall()
        }

        for table_name, columns in SCHEMA_UPGRADES.items():
            if table_name not in existing_tables:
                continue

            current_columns = _table_columns(conn, table_name)
            for column_name, column_type in columns.items():
                if column_name in current_columns:
                    continue
                conn.exec_driver_sql(
                    f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_type}"
                )
                current_columns.add(column_name)

def init_db():
    """Initialize database tables"""
    from . import (
        match,
        team,
        player,
        event,
        pass_event,
        network_metrics,
        tactical_pattern,
        counter_tactic,
        report_artifact,
    )
    Base.metadata.create_all(bind=engine)
    ensure_schema_upgrades()
