# Pass Network Analysis System

## Requirements
- Python 3.10+
- Node.js 18+

## Quick Start

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Load Sample Data
```bash
python scripts/download_statsbomb_data.py
python scripts/load_sample_data.py
```

## Features
- Pass network construction from StatsBomb data
- Centrality metrics calculation
- Tactical pattern detection
- Counter-tactic recommendations
- Interactive visualization dashboard
