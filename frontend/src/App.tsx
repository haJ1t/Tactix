import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './styles/index.css';

// Pages
import DashboardPage from './pages/DashboardPage';
import MatchesPage from './pages/MatchesPage';
import MatchDetailsPage from './pages/MatchDetailsPage';
import AnalysisSummaryPage from './pages/AnalysisSummaryPage';
import MetricsPage from './pages/MetricsPage';
import ReportsPage from './pages/ReportsPage';

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/matches" element={<MatchesPage />} />
                <Route path="/match/:matchId" element={<MatchDetailsPage />} />
                <Route path="/analysis/:matchId" element={<AnalysisSummaryPage />} />
                <Route path="/metrics" element={<MetricsPage />} />
                <Route path="/reports" element={<ReportsPage />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;
