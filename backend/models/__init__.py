"""
Database models package
"""
import re
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
import os

# Get database path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATABASE_PATH = os.path.join(BASE_DIR, 'database', 'pass_network.db')
DATABASE_URL = f'sqlite:///{DATABASE_PATH}'

# Create engine and session with connection pool limits
engine = create_engine(
    DATABASE_URL,
    echo=False,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
)
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

INDEX_UPGRADES = {
    'ix_events_match_team_type': 'CREATE INDEX IF NOT EXISTS ix_events_match_team_type ON events (match_id, team_id, event_type)',
    'ix_events_match_team_period': 'CREATE INDEX IF NOT EXISTS ix_events_match_team_period ON events (match_id, team_id, period)',
    'ix_passes_event_id': 'CREATE INDEX IF NOT EXISTS ix_passes_event_id ON passes (event_id)',
    'ix_passes_passer_id': 'CREATE INDEX IF NOT EXISTS ix_passes_passer_id ON passes (passer_id)',
    'ix_passes_recipient_id': 'CREATE INDEX IF NOT EXISTS ix_passes_recipient_id ON passes (recipient_id)',
    'ix_network_metrics_match_team': 'CREATE INDEX IF NOT EXISTS ix_network_metrics_match_team ON network_metrics (match_id, team_id)',
    'ix_network_metrics_player_id': 'CREATE INDEX IF NOT EXISTS ix_network_metrics_player_id ON network_metrics (player_id)',
}

SAFE_IDENTIFIER_RE = re.compile(r'^[a-zA-Z0-9_]+$')


def get_db():
    """Get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _is_safe_identifier(value: str) -> bool:
    """Validate that a string is a safe SQL identifier."""
    return bool(SAFE_IDENTIFIER_RE.match(value))


def _table_columns(conn, table_name: str) -> set:
    # Validate table_name before using in SQL
    if not _is_safe_identifier(table_name):
        return set()
    rows = conn.exec_driver_sql(f"PRAGMA table_info({table_name})").fetchall()
    return {row[1] for row in rows}


def ensure_schema_upgrades():
    """Apply lightweight additive SQLite schema upgrades in-place."""
    with engine.begin() as conn:
        # Fetch existing table names
        existing_tables = {
            row[0]
            for row in conn.exec_driver_sql(
                "SELECT name FROM sqlite_master WHERE type='table'"
            ).fetchall()
        }

        for table_name, columns in SCHEMA_UPGRADES.items():
            if table_name not in existing_tables:
                continue

            # Validate table_name before use
            if not _is_safe_identifier(table_name):
                continue

            # Add any missing columns
            current_columns = _table_columns(conn, table_name)
            for column_name, column_type in columns.items():
                if column_name in current_columns:
                    continue
                # Validate identifiers before using in f-string SQL
                if not _is_safe_identifier(column_name):
                    continue
                if not _is_safe_identifier(column_type):
                    continue
                conn.exec_driver_sql(
                    f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_type}"
                )
                current_columns.add(column_name)

        # INDEX_UPGRADES contains hardcoded, fully-qualified SQL statements
        # with no user input — safe to execute directly.
        for statement in INDEX_UPGRADES.values():
            conn.exec_driver_sql(statement)


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
