import { Link } from 'react-router-dom';
import { getMatchResult, getOpponentName } from '@/entities/analysis';
import { useTeamDetailsContext } from '@/features/teams/pages/TeamDetailsPage';
import { formatMatchDate } from '@/shared/lib/format';
import { FadeInUp, GlassCard } from '@/shared/ui/motion';
import { motion } from 'framer-motion';
import { Calendar, Swords, Trophy, ExternalLink } from 'lucide-react';

export default function TeamMatchesTab() {
    // Pull team data from context
    const { matches, team, season } = useTeamDetailsContext();

    return (
        <FadeInUp>
            <GlassCard hover={false} className="p-6">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-white">Team Matches</h3>
                    <span className="text-sm text-[#94A3B8]">{season} · {matches.length} matches</span>
                </div>

                <div className="overflow-x-auto">
                    <table className="table-dark w-full">
                        <thead>
                            <tr>
                                <th className="text-left py-3 px-4 text-xs font-medium text-[#94A3B8] uppercase tracking-wider">
                                    <span className="inline-flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> Date</span>
                                </th>
                                <th className="text-left py-3 px-4 text-xs font-medium text-[#94A3B8] uppercase tracking-wider">
                                    <span className="inline-flex items-center gap-1.5"><Swords className="h-3.5 w-3.5" /> Opponent</span>
                                </th>
                                <th className="text-left py-3 px-4 text-xs font-medium text-[#94A3B8] uppercase tracking-wider">
                                    <span className="inline-flex items-center gap-1.5"><Trophy className="h-3.5 w-3.5" /> Competition</span>
                                </th>
                                <th className="text-left py-3 px-4 text-xs font-medium text-[#94A3B8] uppercase tracking-wider">Result</th>
                                <th className="text-right py-3 px-4 text-xs font-medium text-[#94A3B8] uppercase tracking-wider">Workspace</th>
                            </tr>
                        </thead>
                        <tbody>
                            {matches.map((match) => (
                                <motion.tr
                                    key={match.match_id}
                                    className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors"
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.2 }}
                                    whileHover={{ backgroundColor: 'rgba(255,255,255,0.03)' }}
                                >
                                    <td className="py-3 px-4 text-sm text-[#94A3B8]">{formatMatchDate(match.match_date)}</td>
                                    <td className="py-3 px-4 text-sm text-white font-medium">{getOpponentName(match, team.team_id)}</td>
                                    <td className="py-3 px-4 text-sm text-[#94A3B8]">{match.competition}</td>
                                    <td className="py-3 px-4">
                                        <span className="tag-glow">{getMatchResult(match, team.team_id)}</span>
                                    </td>
                                    <td className="py-3 px-4 text-right">
                                        <Link
                                            className="btn-ghost inline-flex items-center gap-1.5 text-sm"
                                            to={`/matches/${match.match_id}/overview`}
                                        >
                                            Open <ExternalLink className="h-3.5 w-3.5" />
                                        </Link>
                                    </td>
                                </motion.tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </GlassCard>
        </FadeInUp>
    );
}
