import sys
import os

# Add backend directory to Python path for imports
backend_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'backend')
sys.path.insert(0, backend_dir)

from app import create_app

app = create_app('production')
