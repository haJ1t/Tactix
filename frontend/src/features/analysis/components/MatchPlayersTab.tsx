import { motion } from 'framer-motion';
import { Crown, Medal, Award } from 'lucide-react';
import { getTopPlayers } from '@/entities/analysis';
import { useMatchWorkspaceContext } from '@/features/matches/pages/MatchWorkspacePage';
import { EmptyState } from '@/shared/ui/EmptyState';
import { GlassCard, FadeInUp, AnimatedBar, StaggerContainer, ShimmerButton } from '@/shared/ui/motion';

const rankIcons = [Crown, Medal, Award];
const rankColors = ['text-yellow-400', 'text-gray-300', 'text-amber-600'];

export default function MatchPlayersTab() {
    const { currentAnalysis, currentTeamName, runAnalysis, isRunningAnalysis } = useMatchWorkspaceContext();

    if (!currentAnalysis || !currentTeamName) {
        return (
            <EmptyState
                title="Player rankings need analysis"
                description="Run the workspace analysis to calculate player influence and centrality rankings."
                action={
                    <ShimmerButton onClick={() => void runAnalysis()} disabled={isRunningAnalysis}>
                        {isRunningAnalysis ? 'Running analysis...' : 'Run Analysis'}
                    </ShimmerButton>
                }
            />
        );
    }

    const players = getTopPlayers(currentAnalysis, currentTeamName, 10);
    const leaders = players.slice(0, 3);
    const maxImpact = leaders[0]?.impactScore || 1;

    return (
        <div className="space-y-6">
            {/* Top 3 Podium */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {leaders.map((player, index) => {
                    const RankIcon = rankIcons[index];
                    return (
                        <FadeInUp key={player.player_id} delay={index * 0.08}>
                            <GlassCard className={`p-5 ${index === 0 ? 'border-primary-500/20 bg-primary-500/[0.03]' : ''}`}>
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <span className={`inline-flex items-center gap-1 text-xs font-bold ${rankColors[index]}`}>
                                            <RankIcon className="w-4 h-4" />
                                            #{index + 1}
                                        </span>
                                        <span className="tag-glow text-[10px]">{currentTeamName}</span>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <div className="w-11 h-11 rounded-full bg-primary-500/20 border border-primary-500/30 flex items-center justify-center text-base font-bold text-primary-400">
                                            {(player.player_name || player.name || '?')[0]}
                                        </div>
                                        <div>
                                            <div className="text-sm font-semibold text-white">{player.player_name || player.name}</div>
                                            <div className="text-[10px] text-[#94A3B8]">{currentTeamName}</div>
                                        </div>
                                    </div>

                                    <div className="space-y-2.5">
                                        <div>
                                            <div className="flex justify-between text-[10px] mb-1">
                                                <span className="text-[#94A3B8]">Impact</span>
                                                <span className="text-white font-medium">{player.impactScore.toFixed(3)}</span>
                                            </div>
                                            <AnimatedBar value={player.impactScore} max={maxImpact} color="rgb(99,102,241)" />
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="text-center py-1.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                                                <span className="text-[9px] uppercase tracking-wider text-[#94A3B8] block">Betweenness</span>
                                                <span className="text-xs font-medium text-white">{player.betweenness_centrality.toFixed(3)}</span>
                                            </div>
                                            <div className="text-center py-1.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                                                <span className="text-[9px] uppercase tracking-wider text-[#94A3B8] block">PageRank</span>
                                                <span className="text-xs font-medium text-white">{player.pagerank.toFixed(3)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </GlassCard>
                        </FadeInUp>
                    );
                })}
            </div>

            {/* Full Ranking Table */}
            <FadeInUp delay={0.2}>
                <GlassCard className="p-6" hover={false}>
                    <div className="flex items-start justify-between mb-5">
                        <div>
                            <h3 className="text-base font-semibold text-white">Full Influence Ranking</h3>
                            <p className="text-xs text-[#94A3B8] mt-0.5">A calmer ranking table for the rest of the squad signal hierarchy.</p>
                        </div>
                        <span className="tag-glow">{currentTeamName}</span>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="table-dark w-full">
                            <thead>
                                <tr>
                                    <th className="text-left py-3 px-3 text-[10px] uppercase tracking-wider text-[#94A3B8] font-medium border-b border-white/[0.04]">#</th>
                                    <th className="text-left py-3 px-3 text-[10px] uppercase tracking-wider text-[#94A3B8] font-medium border-b border-white/[0.04]">Player</th>
                                    <th className="text-left py-3 px-3 text-[10px] uppercase tracking-wider text-[#94A3B8] font-medium border-b border-white/[0.04]">Impact</th>
                                    <th className="text-left py-3 px-3 text-[10px] uppercase tracking-wider text-[#94A3B8] font-medium border-b border-white/[0.04]">Betweenness</th>
                                    <th className="text-left py-3 px-3 text-[10px] uppercase tracking-wider text-[#94A3B8] font-medium border-b border-white/[0.04]">PageRank</th>
                                    <th className="text-left py-3 px-3 text-[10px] uppercase tracking-wider text-[#94A3B8] font-medium border-b border-white/[0.04]">Degree</th>
                                </tr>
                            </thead>
                            <tbody>
                                <StaggerContainer className="contents" staggerDelay={0.04}>
                                    {players.map((player, index) => (
                                        <motion.tr
                                            key={player.player_id}
                                            className="border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors"
                                            variants={{
                                                hidden: { opacity: 0, x: -10 },
                                                visible: { opacity: 1, x: 0, transition: { duration: 0.3 } },
                                            }}
                                        >
                                            <td className="py-3 px-3 text-sm text-[#94A3B8] font-medium">{index + 1}</td>
                                            <td className="py-3 px-3 text-sm text-white font-medium">{player.player_name || player.name}</td>
                                            <td className="py-3 px-3 text-sm text-primary-400 font-medium">{player.impactScore.toFixed(3)}</td>
                                            <td className="py-3 px-3 text-sm text-[#94A3B8]">{player.betweenness_centrality.toFixed(3)}</td>
                                            <td className="py-3 px-3 text-sm text-[#94A3B8]">{player.pagerank.toFixed(3)}</td>
                                            <td className="py-3 px-3 text-sm text-[#94A3B8]">{player.degree_centrality.toFixed(3)}</td>
                                        </motion.tr>
                                    ))}
                                </StaggerContainer>
                            </tbody>
                        </table>
                    </div>
                </GlassCard>
            </FadeInUp>
        </div>
    );
}
