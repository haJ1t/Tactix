"""
Download StatsBomb open data

Downloads the StatsBomb open-data repository for use with the analysis system.
"""
import os
import subprocess
import shutil

# Get project root
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(PROJECT_ROOT, 'data', 'raw')
STATSBOMB_URL = 'https://github.com/statsbomb/open-data.git'


def download_statsbomb_data():
    """Download StatsBomb open data using git clone."""
    print("Downloading StatsBomb open data...")

    # Prepare data directory
    os.makedirs(DATA_DIR, exist_ok=True)

    # Set clone destination
    clone_dir = os.path.join(DATA_DIR, 'open-data')

    if os.path.exists(clone_dir):
        print(f"Data already exists at {clone_dir}")
        print("To re-download, delete this directory first.")
        return

    try:
        # Shallow clone for speed
        subprocess.run([
            'git', 'clone', '--depth', '1',
            STATSBOMB_URL, clone_dir
        ], check=True)

        print(f"Successfully downloaded to: {clone_dir}")

        # Move data subfolders into place
        source_data = os.path.join(clone_dir, 'data')
        if os.path.exists(source_data):
            for folder in ['competitions', 'matches', 'events', 'lineups']:
                src = os.path.join(source_data, folder)
                dst = os.path.join(DATA_DIR, folder)
                if os.path.exists(src):
                    if os.path.exists(dst):
                        shutil.rmtree(dst)
                    shutil.copytree(src, dst)
                    print(f"Copied {folder} to {dst}")
        
        print("\nDownload complete!")
        print("Available competitions:")
        list_competitions()
        
    except subprocess.CalledProcessError as e:
        print(f"Error cloning repository: {e}")
        print("\nAlternative: Download manually from:")
        print(STATSBOMB_URL)
        print(f"And extract to: {DATA_DIR}")


def list_competitions():
    """List available competitions in the data."""
    import json
    
    competitions_file = os.path.join(DATA_DIR, 'competitions.json')
    
    if not os.path.exists(competitions_file):
        # Try from cloned repo
        competitions_file = os.path.join(DATA_DIR, 'open-data', 'data', 'competitions.json')
    
    if os.path.exists(competitions_file):
        with open(competitions_file, 'r') as f:
            competitions = json.load(f)
        
        # Group by competition
        seen = set()
        for c in competitions:
            key = (c['competition_id'], c['competition_name'])
            if key not in seen:
                seen.add(key)
                print(f"  - {c['competition_name']} ({c['country_name']})")


if __name__ == '__main__':
    download_statsbomb_data()
