import { useTeamDetailsContext } from '@/features/teams/pages/TeamDetailsPage';
import { FadeInUp, GlassCard, StaggerContainer, StaggerItem } from '@/shared/ui/motion';
import { motion } from 'framer-motion';
import { Users, Hash, User, GitBranch, Eye } from 'lucide-react';

export default function TeamPlayersTab() {
    const { aggregateAnalysis, season } = useTeamDetailsContext();

    return (
        <FadeInUp>
            <GlassCard hover={false} className="p-6">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-500/15">
                            <Users className="h-4.5 w-4.5 text-primary-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-white">Top Aggregate Players</h3>
                    </div>
                    <span className="text-sm text-[#94A3B8]">{season}</span>
                </div>

                <div className="overflow-x-auto">
                    <table className="table-dark w-full">
                        <thead>
                            <tr>
                                <th className="text-left py-3 px-4 text-xs font-medium text-[#94A3B8] uppercase tracking-wider">
                                    <span className="inline-flex items-center gap-1.5"><Hash className="h-3.5 w-3.5" /> #</span>
                                </th>
                                <th className="text-left py-3 px-4 text-xs font-medium text-[#94A3B8] uppercase tracking-wider">
                                    <span className="inline-flex items-center gap-1.5"><User className="h-3.5 w-3.5" /> Player</span>
                                </th>
                                <th className="text-left py-3 px-4 text-xs font-medium text-[#94A3B8] uppercase tracking-wider">
                                    <span className="inline-flex items-center gap-1.5"><GitBranch className="h-3.5 w-3.5" /> Avg Betweenness</span>
                                </th>
                                <th className="text-left py-3 px-4 text-xs font-medium text-[#94A3B8] uppercase tracking-wider">
                                    <span className="inline-flex items-center gap-1.5"><Eye className="h-3.5 w-3.5" /> Appearances</span>
                                </th>
                            </tr>
                        </thead>
                        <StaggerContainer className="contents" staggerDelay={0.04}>
                            <tbody>
                                {aggregateAnalysis.topPlayers.map((player, index) => (
                                    <StaggerItem key={player.player_id} className="contents">
                                        <motion.tr
                                            className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors"
                                            whileHover={{ backgroundColor: 'rgba(255,255,255,0.03)' }}
                                        >
                                            <td className="py-3 px-4">
                                                <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                                                    index < 3 ? 'bg-primary-500/20 text-primary-400' : 'bg-white/[0.05] text-[#94A3B8]'
                                                }`}>
                                                    {index + 1}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-sm text-white font-medium">{player.player_name}</td>
                                            <td className="py-3 px-4 text-sm text-[#94A3B8] font-mono">{player.avgBetweenness.toFixed(3)}</td>
                                            <td className="py-3 px-4">
                                                <span className="tag-glow">{player.appearances}</span>
                                            </td>
                                        </motion.tr>
                                    </StaggerItem>
                                ))}
                            </tbody>
                        </StaggerContainer>
                    </table>
                </div>
            </GlassCard>
        </FadeInUp>
    );
}
