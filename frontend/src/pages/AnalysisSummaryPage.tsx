import { Navigate, useParams } from 'react-router-dom';

export default function AnalysisSummaryPage() {
    const { matchId } = useParams<{ matchId: string }>();
    return <Navigate to={`/matches/${matchId}/overview`} replace />;
}
