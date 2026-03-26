# Tactix - Advanced Football Analysis Platform

Tactix is a comprehensive football analysis system that leverages StatsBomb event data to provide deep insights into team performance, pass networks, and tactical patterns. It combines a robust Python backend with a modern React frontend to visualize complex metrics in an intuitive dashboard.

## 🚀 Features

- **Pass Network Analysis:** Visualize player connectivity, passing clusters, and key playmakers.
- **Centrality Metrics:** Calculate Degree, Betweenness, Closeness, and PageRank centralities to identify influential players.
- **Tactical Pattern Recognition:** Automatically detect formations and recurring tactical setups.
- **Counter-Tactic Recommendations:** AI-driven suggestions for countering specific opponent tactics.
- **Interactive Dashboard:** Data-rich visualization using React and Recharts.

## 🛠️ Tech Stack

- **Backend:** Python, Flask, SQLAlchemy, NetworkX, Pandas
- **Frontend:** React, Vite, TypeScript, TailwindCSS
- **Database:** SQLite (SQLAlchemy ORM)
- **Data Source:** StatsBomb Open Data

## 📋 Prerequisites

- Python 3.9+
- Node.js 18+

## ⚡ Quick Start

### 1. Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r ../requirements.txt
```

### 2. Frontend Setup

```bash
cd frontend
npm install
```

### 3. Data Setup

Download the StatsBomb open dataset and load sample data:

```bash
# Download raw data
python scripts/download_statsbomb_data.py

# Load sample match (La Liga 2020/21)
python scripts/load_sample_data.py
```

### 4. Running the Application

**Start Backend (Port 5001):**
```bash
cd backend
python app.py
```

**Start Frontend (Port 3000):**
```bash
cd frontend
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## 📊 Data Management Tools

The project includes several utility scripts to manage data:

- **Check Data Status:** View how many seasons/matches/events are currently loaded vs available.
  ```bash
  python scripts/check_data_status.py
  ```

- **Load Specific Season:** Batch load all matches for a competition/season (e.g., Euro 2024).
  ```bash
  # Syntax: python scripts/load_season.py --competition <ID> --season <ID>
  python scripts/load_season.py --competition 55 --season 282
  ```

- **List Available Data:**
  ```bash
  python scripts/load_sample_data.py --list
  ```

## 📂 Project Structure

```
├── backend/            # Flask application & Analysis Logic
│   ├── models/         # Database models (Match, Event, Player, etc.)
│   ├── services/       # Core logic (Data Parser, Network Analysis, etc.)
│   └── app.py          # API Entry point
├── frontend/           # React Application
│   ├── src/components  # UI Components
│   └── src/pages       # Dashboard Pages
├── data/               # Raw StatsBomb JSON data
├── database/           # SQLite database file
└── scripts/            # Data loading and utility scripts
```

## 📝 License

This project processes data provided by StatsBomb. 
*StatsBomb Open Data* is licensed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
