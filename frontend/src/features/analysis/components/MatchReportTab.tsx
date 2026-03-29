import { useNavigate } from 'react-router-dom';
import { FileText, Shield, Archive, Trophy, Layers } from 'lucide-react';
import { useGenerateReport } from '@/features/reports/hooks/useReports';
import { useMatchWorkspaceContext } from '@/features/matches/pages/MatchWorkspacePage';
import { EmptyState } from '@/shared/ui/EmptyState';
import { GlassCard, FadeInUp, ShimmerButton, StaggerContainer, StaggerItem } from '@/shared/ui/motion';

export default function MatchReportTab() {
    const navigate = useNavigate();
    const { match, analysis, runAnalysis, isRunningAnalysis } = useMatchWorkspaceContext();
    const generateReportMutation = useGenerateReport();

    if (!analysis) {
        return (
            <EmptyState
                title="Report preview needs analysis"
                description="Run the match analysis first so the PDF dossier can be generated from a complete backend snapshot."
                action={
                    <ShimmerButton onClick={() => void runAnalysis()} disabled={isRunningAnalysis}>
                        {isRunningAnalysis ? 'Running analysis...' : 'Run Analysis'}
                    </ShimmerButton>
                }
            />
        );
    }

    const generateReport = async () => {
        const created = await generateReportMutation.mutateAsync(match.match_id);
        navigate(`/reports/${created.id}`);
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Preview Info */}
            <FadeInUp delay={0.05}>
                <GlassCard className="p-6 h-full" hover={false}>
                    <div className="flex items-center gap-2 mb-5">
                        <FileText className="w-4 h-4 text-primary-400" />
                        <div>
                            <h3 className="text-base font-semibold text-white">Analyst Dossier Preview</h3>
                            <p className="text-xs text-[#94A3B8] mt-0.5">
                                The backend report will render both teams, tactical pattern signals, counter-plans, pass-network views, and shot-quality interpretation.
                            </p>
                        </div>
                    </div>

                    <div className="space-y-2">
                        {[
                            { label: 'Match', value: `${match.home_team?.team_name} vs ${match.away_team?.team_name}`, icon: Trophy },
                            { label: 'Score', value: `${match.home_score} - ${match.away_score}`, icon: Layers },
                            { label: 'Competition', value: match.competition, icon: Shield },
                            {
                                label: 'Coverage',
                                value: 'Executive summary, pass networks, tactics, shot quality, and final conclusion.',
                                icon: FileText,
                            },
                        ].map((item, i) => (
                            <FadeInUp key={item.label} delay={0.1 + i * 0.04}>
                                <div className="flex items-start gap-3 py-3 px-3.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                                    <item.icon className="w-4 h-4 text-primary-400 mt-0.5 shrink-0 opacity-60" />
                                    <div className="flex-1 min-w-0">
                                        <span className="text-[10px] uppercase tracking-wider text-[#94A3B8] block">{item.label}</span>
                                        <span className="text-sm text-white mt-0.5 block">{item.value}</span>
                                    </div>
                                </div>
                            </FadeInUp>
                        ))}
                    </div>
                </GlassCard>
            </FadeInUp>

            {/* Generate Action */}
            <FadeInUp delay={0.15}>
                <GlassCard className="p-6 h-full border-primary-500/10 flex flex-col" hover={false}>
                    <div className="mb-5">
                        <h3 className="text-base font-semibold text-white">Generate PDF Dossier</h3>
                        <p className="text-xs text-[#94A3B8] mt-0.5">
                            Create a backend-stored English report artifact that can be reopened later and downloaded as a PDF.
                        </p>
                    </div>

                    <StaggerContainer className="space-y-3 flex-1" staggerDelay={0.08}>
                        {[
                            {
                                icon: Shield,
                                label: 'Render',
                                desc: 'Backend PDF generation keeps layout, headings, and dossier structure consistent.',
                            },
                            {
                                icon: Archive,
                                label: 'Artifact',
                                desc: 'Saved reports remain available from the Reports library and can be downloaded later.',
                            },
                        ].map((item) => (
                            <StaggerItem key={item.label}>
                                <div className="flex items-start gap-3 p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                                    <div className="w-8 h-8 rounded-lg bg-primary-500/15 border border-primary-500/25 flex items-center justify-center shrink-0">
                                        <item.icon className="w-4 h-4 text-primary-400" />
                                    </div>
                                    <div>
                                        <span className="text-xs font-medium text-[#94A3B8] uppercase tracking-wider">{item.label}</span>
                                        <strong className="block text-sm text-white mt-0.5 font-normal leading-relaxed">{item.desc}</strong>
                                    </div>
                                </div>
                            </StaggerItem>
                        ))}
                    </StaggerContainer>

                    <div className="mt-6">
                        <ShimmerButton
                            onClick={() => void generateReport()}
                            disabled={generateReportMutation.isPending}
                            className="w-full text-sm"
                        >
                            <FileText className="w-4 h-4 mr-2 inline-block" />
                            {generateReportMutation.isPending ? 'Generating dossier...' : 'Generate Analyst Report'}
                        </ShimmerButton>
                    </div>
                </GlassCard>
            </FadeInUp>
        </div>
    );
}
