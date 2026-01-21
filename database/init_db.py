"""
Database initialization script
"""
import os
import sys

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.models import init_db, engine, Base


def initialize_database():
    """Create all database tables."""
    print("Initializing database...")
    
    # Ensure database directory exists
    db_dir = os.path.dirname(os.path.abspath(__file__))
    os.makedirs(db_dir, exist_ok=True)
    
    # Create all tables
    init_db()
    
    print(f"Database initialized at: {engine.url}")
    print("Tables created:")
    for table in Base.metadata.tables.keys():
        print(f"  - {table}")


if __name__ == '__main__':
    initialize_database()
