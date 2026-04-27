import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as d3 from 'd3';
import type { NetworkEdge, NetworkNode } from '@/entities/analysis';

interface PassNetworkGraphProps {
    nodes: NetworkNode[];
    edges: NetworkEdge[];
    width?: number;
    height?: number;
    showLabels?: boolean;
    minPasses?: number;
}

type SimNode = d3.SimulationNodeDatum & {
    id: number;
    name: string;
    origX: number;
    origY: number;
    radius: number;
};

type EdgeTooltipData = {
    sourceName: string;
    targetName: string;
    forward: number;
    reverse: number;
};

type NodeTooltipData = {
    name: string;
    totalPasses: number;
    incoming: number;
    outgoing: number;
    degreeCentrality?: number;
    betweenness?: number;
    pagerank?: number;
};

type TooltipState =
    | { kind: 'edge'; clientX: number; clientY: number; data: EdgeTooltipData }
    | { kind: 'node'; clientX: number; clientY: number; data: NodeTooltipData }
    | null;

// Use last name only
const shortName = (full: string) => {
    const parts = full.trim().split(/\s+/);
    return parts.length > 1 ? parts[parts.length - 1] : full;
};

// D3 pass network visualisation
export default function PassNetworkGraph({
    nodes,
    edges,
    width = 1200,
    height = 820,
    showLabels = true,
    minPasses = 1,
}: PassNetworkGraphProps) {
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const edgePathsRef = useRef<d3.Selection<SVGPathElement, NetworkEdge, SVGGElement, unknown> | null>(null);
    const hitPathsRef = useRef<d3.Selection<SVGPathElement, NetworkEdge, SVGGElement, unknown> | null>(null);
    const minPassesRef = useRef(minPasses);
    const [tooltip, setTooltip] = useState<TooltipState>(null);

    useEffect(() => {
        if (!svgRef.current || nodes.length === 0) {
            return;
        }

        const svg = d3.select(svgRef.current);
        svg.selectAll('*').remove();

        // Pitch dimensions in metres
        const pitchLengthM = 120;
        const pitchWidthM = 80;
        const margin = { top: 36, right: 36, bottom: 36, left: 36 };
        const innerWidth = width - margin.left - margin.right;
        const innerHeight = height - margin.top - margin.bottom;

        const xScale = d3.scaleLinear().domain([0, pitchLengthM]).range([0, innerWidth]);
        const yScale = d3.scaleLinear().domain([0, pitchWidthM]).range([innerHeight, 0]);
        const pxPerM = innerWidth / pitchLengthM;

        const incomingMap = new Map<number, number>();
        const outgoingMap = new Map<number, number>();
        edges.forEach((e) => {
            outgoingMap.set(e.source, (outgoingMap.get(e.source) || 0) + e.weight);
            incomingMap.set(e.target, (incomingMap.get(e.target) || 0) + e.weight);
        });
        const degreeMap = new Map<number, number>();
        nodes.forEach((n) => {
            degreeMap.set(n.id, (incomingMap.get(n.id) || 0) + (outgoingMap.get(n.id) || 0));
        });
        const maxDegree = Math.max(...Array.from(degreeMap.values()), 1);
        const maxWeight = d3.max(edges, (e) => e.weight) || 1;

        const nodeRadiusScale = d3.scaleSqrt().domain([0, maxDegree]).range([14, 32]);
        const edgeWidthScale = d3.scaleLinear().domain([1, maxWeight]).range([1.4, 7]).clamp(true);
        const edgeOpacityScale = d3.scaleLinear().domain([1, maxWeight]).range([0.28, 0.9]).clamp(true);
        const nodeColor = d3
            .scaleSequential<string>()
            .domain([0, maxDegree])
            .interpolator(d3.interpolateRgb('#3b82f6', '#f59e0b'));

        const simNodes: SimNode[] = nodes.map((n) => {
            const radius = nodeRadiusScale(degreeMap.get(n.id) || 0);
            return {
                id: n.id,
                name: n.name,
                origX: xScale(n.x),
                origY: yScale(n.y),
                x: xScale(n.x),
                y: yScale(n.y),
                radius,
            };
        });

        // Force simulation for layout
        const sim = d3
            .forceSimulation<SimNode>(simNodes)
            .force('x', d3.forceX<SimNode>((d) => d.origX).strength(0.92))
            .force('y', d3.forceY<SimNode>((d) => d.origY).strength(0.92))
            .force(
                'collide',
                d3.forceCollide<SimNode>((d) => d.radius + 5).strength(1)
            )
            .alpha(1)
            .alphaDecay(0.04)
            .stop();

        for (let i = 0; i < 200; i++) {
            sim.tick();
            simNodes.forEach((n) => {
                const r = n.radius + 2;
                const x = n.x ?? n.origX;
                const y = n.y ?? n.origY;
                n.x = Math.max(r, Math.min(innerWidth - r, x));
                n.y = Math.max(r, Math.min(innerHeight - r, y));
            });
        }

        const simNodeMap = new Map(simNodes.map((n) => [n.id, n]));

        const edgeWeightMap = new Map<string, number>();
        edges.forEach((e) => edgeWeightMap.set(`${e.source}-${e.target}`, e.weight));

        const defs = svg.append('defs');

        const grass = defs
            .append('linearGradient')
            .attr('id', 'pass-net-grass')
            .attr('x1', '0%')
            .attr('y1', '0%')
            .attr('x2', '0%')
            .attr('y2', '100%');
        grass.append('stop').attr('offset', '0%').attr('stop-color', '#226e3c');
        grass.append('stop').attr('offset', '100%').attr('stop-color', '#164e29');

        defs
            .append('marker')
            .attr('id', 'pass-net-arrow')
            .attr('viewBox', '0 -5 10 10')
            .attr('refX', 9)
            .attr('refY', 0)
            .attr('markerWidth', 5)
            .attr('markerHeight', 5)
            .attr('orient', 'auto')
            .append('path')
            .attr('d', 'M0,-5L10,0L0,5')
            .attr('fill', 'rgba(255,255,255,0.85)');

        const group = svg
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        group
            .append('rect')
            .attr('width', innerWidth)
            .attr('height', innerHeight)
            .attr('fill', 'url(#pass-net-grass)')
            .attr('rx', 12);

        const stripeCount = 10;
        const stripeH = innerHeight / stripeCount;
        for (let i = 0; i < stripeCount; i += 2) {
            group
                .append('rect')
                .attr('x', 0)
                .attr('y', i * stripeH)
                .attr('width', innerWidth)
                .attr('height', stripeH)
                .attr('fill', 'rgba(255,255,255,0.035)');
        }

        const lineColor = 'rgba(255,255,255,0.32)';
        const lineWidth = 1.4;
        const pitchLines = group.append('g').attr('pointer-events', 'none');

        pitchLines
            .append('rect')
            .attr('width', innerWidth)
            .attr('height', innerHeight)
            .attr('fill', 'none')
            .attr('stroke', lineColor)
            .attr('stroke-width', lineWidth)
            .attr('rx', 12);

        pitchLines
            .append('line')
            .attr('x1', xScale(60))
            .attr('y1', 0)
            .attr('x2', xScale(60))
            .attr('y2', innerHeight)
            .attr('stroke', lineColor)
            .attr('stroke-width', lineWidth);

        pitchLines
            .append('circle')
            .attr('cx', xScale(60))
            .attr('cy', yScale(40))
            .attr('r', 9.15 * pxPerM)
            .attr('fill', 'none')
            .attr('stroke', lineColor)
            .attr('stroke-width', lineWidth);

        pitchLines
            .append('circle')
            .attr('cx', xScale(60))
            .attr('cy', yScale(40))
            .attr('r', 3)
            .attr('fill', lineColor);

        pitchLines
            .append('rect')
            .attr('x', 0)
            .attr('y', yScale(62))
            .attr('width', xScale(16.5))
            .attr('height', yScale(18) - yScale(62))
            .attr('fill', 'none')
            .attr('stroke', lineColor)
            .attr('stroke-width', lineWidth);

        pitchLines
            .append('rect')
            .attr('x', xScale(103.5))
            .attr('y', yScale(62))
            .attr('width', xScale(120) - xScale(103.5))
            .attr('height', yScale(18) - yScale(62))
            .attr('fill', 'none')
            .attr('stroke', lineColor)
            .attr('stroke-width', lineWidth);

        pitchLines
            .append('rect')
            .attr('x', 0)
            .attr('y', yScale(50))
            .attr('width', xScale(5.5))
            .attr('height', yScale(30) - yScale(50))
            .attr('fill', 'none')
            .attr('stroke', lineColor)
            .attr('stroke-width', lineWidth);

        pitchLines
            .append('rect')
            .attr('x', xScale(114.5))
            .attr('y', yScale(50))
            .attr('width', xScale(120) - xScale(114.5))
            .attr('height', yScale(30) - yScale(50))
            .attr('fill', 'none')
            .attr('stroke', lineColor)
            .attr('stroke-width', lineWidth);

        pitchLines
            .append('circle')
            .attr('cx', xScale(11))
            .attr('cy', yScale(40))
            .attr('r', 2.5)
            .attr('fill', lineColor);

        pitchLines
            .append('circle')
            .attr('cx', xScale(109))
            .attr('cy', yScale(40))
            .attr('r', 2.5)
            .attr('fill', lineColor);

        const edgeLayer = group.append('g').attr('class', 'edges');
        const nodeLayer = group.append('g').attr('class', 'nodes');

        const buildEdgePath = (edge: NetworkEdge): string => {
            const s = simNodeMap.get(edge.source);
            const t = simNodeMap.get(edge.target);
            if (!s || !t || s.x == null || s.y == null || t.x == null || t.y == null) {
                return '';
            }
            const dx = t.x - s.x;
            const dy = t.y - s.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist === 0) return '';

            const shortenTarget = t.radius + 4;
            const shortenSource = Math.max(0, s.radius - 2);
            const endRatio = Math.max(0, (dist - shortenTarget) / dist);
            const startRatio = Math.min(1, shortenSource / dist);
            const sx = s.x + dx * startRatio;
            const sy = s.y + dy * startRatio;
            const ex = s.x + dx * endRatio;
            const ey = s.y + dy * endRatio;

            const hasReverse = edgeWeightMap.has(`${edge.target}-${edge.source}`);
            if (!hasReverse) {
                return `M${sx},${sy}L${ex},${ey}`;
            }

            const perpX = -dy / dist;
            const perpY = dx / dist;
            const curvature = Math.min(dist * 0.18, 34);
            const mx = (sx + ex) / 2 + perpX * curvature;
            const my = (sy + ey) / 2 + perpY * curvature;
            return `M${sx},${sy}Q${mx},${my} ${ex},${ey}`;
        };

        const edgeKey = (d: NetworkEdge) => `${d.source}-${d.target}`;

        const edgePaths = edgeLayer
            .selectAll<SVGPathElement, NetworkEdge>('path.edge')
            .data(edges, edgeKey as any)
            .enter()
            .append('path')
            .attr('class', 'edge')
            .attr('fill', 'none')
            .attr('stroke', '#ffffff')
            .attr('stroke-width', (d) => edgeWidthScale(d.weight))
            .attr('stroke-linecap', 'round')
            .attr('stroke-opacity', (d) => edgeOpacityScale(d.weight))
            .attr('marker-end', 'url(#pass-net-arrow)')
            .attr('d', (d) => buildEdgePath(d))
            .style('pointer-events', 'none');

        const hitPaths = edgeLayer
            .selectAll<SVGPathElement, NetworkEdge>('path.edge-hit')
            .data(edges, edgeKey as any)
            .enter()
            .append('path')
            .attr('class', 'edge-hit')
            .attr('fill', 'none')
            .attr('stroke', 'transparent')
            .attr('stroke-width', (d) => Math.max(edgeWidthScale(d.weight) + 10, 14))
            .attr('stroke-linecap', 'round')
            .attr('d', (d) => buildEdgePath(d))
            .style('cursor', 'pointer');

        const nodeG = nodeLayer
            .selectAll<SVGGElement, SimNode>('g.node')
            .data(simNodes, (d: SimNode) => d.id as unknown as string)
            .enter()
            .append('g')
            .attr('class', 'node')
            .attr('data-id', (d) => d.id)
            .attr('transform', (d) => `translate(${d.x},${d.y})`)
            .style('cursor', 'pointer');

        nodeG
            .append('circle')
            .attr('class', 'halo')
            .attr('r', (d) => d.radius + 3.5)
            .attr('fill', 'none')
            .attr('stroke', (d) => nodeColor(degreeMap.get(d.id) || 0))
            .attr('stroke-width', 1.4)
            .attr('stroke-opacity', 0.45);

        nodeG
            .append('circle')
            .attr('class', 'main')
            .attr('r', (d) => d.radius)
            .attr('fill', (d) => nodeColor(degreeMap.get(d.id) || 0))
            .attr('stroke', '#ffffff')
            .attr('stroke-width', 2.25);

        if (showLabels) {
            nodeG
                .append('text')
                .attr('y', (d) => d.radius + 15)
                .attr('text-anchor', 'middle')
                .attr('fill', '#ffffff')
                .attr('font-size', 12.5)
                .attr('font-weight', 600)
                .attr('stroke', 'rgba(0,0,0,0.85)')
                .attr('stroke-width', 3.2)
                .attr('stroke-linejoin', 'round')
                .attr('stroke-linecap', 'round')
                .attr('paint-order', 'stroke')
                .style('pointer-events', 'none')
                .text((d) => shortName(d.name));
        }

        const resetHighlights = () => {
            edgePaths
                .attr('stroke', '#ffffff')
                .attr('stroke-width', (d) => edgeWidthScale(d.weight))
                .attr('stroke-opacity', (d) => edgeOpacityScale(d.weight));
            nodeG.attr('opacity', 1);
        };

        const highlightEdge = (edge: NetworkEdge) => {
            edgePaths
                .attr('stroke-opacity', (e) => (e === edge ? 1 : 0.08))
                .attr('stroke', (e) => (e === edge ? '#facc15' : '#ffffff'))
                .attr('stroke-width', (e) =>
                    e === edge ? edgeWidthScale(e.weight) + 2.2 : edgeWidthScale(e.weight)
                );
            nodeG.attr('opacity', function () {
                const id = Number(d3.select(this).attr('data-id'));
                return id === edge.source || id === edge.target ? 1 : 0.28;
            });
        };

        const highlightNode = (n: SimNode) => {
            const connected = new Set<number>([n.id]);
            edges.forEach((e) => {
                if (e.weight < minPassesRef.current) {
                    return;
                }
                if (e.source === n.id) connected.add(e.target);
                if (e.target === n.id) connected.add(e.source);
            });
            edgePaths
                .attr('stroke-opacity', (e) =>
                    e.weight >= minPassesRef.current && (e.source === n.id || e.target === n.id) ? 0.95 : 0.08
                )
                .attr('stroke', (e) =>
                    e.weight >= minPassesRef.current && (e.source === n.id || e.target === n.id) ? '#facc15' : '#ffffff'
                )
                .attr('stroke-width', (e) =>
                    e.weight >= minPassesRef.current && (e.source === n.id || e.target === n.id)
                        ? edgeWidthScale(e.weight) + 1.2
                        : edgeWidthScale(e.weight)
                );
            nodeG.attr('opacity', function () {
                const id = Number(d3.select(this).attr('data-id'));
                return connected.has(id) ? 1 : 0.28;
            });
        };

        hitPaths
            .on('pointerenter', function (event: PointerEvent, d: NetworkEdge) {
                highlightEdge(d);
                const s = simNodeMap.get(d.source);
                const t = simNodeMap.get(d.target);
                const reverse = edgeWeightMap.get(`${d.target}-${d.source}`) || 0;
                setTooltip({
                    kind: 'edge',
                    clientX: event.clientX,
                    clientY: event.clientY,
                    data: {
                        sourceName: shortName(s?.name || ''),
                        targetName: shortName(t?.name || ''),
                        forward: d.weight,
                        reverse,
                    },
                });
            })
            .on('pointermove', function (event: PointerEvent) {
                setTooltip((prev) =>
                    prev ? { ...prev, clientX: event.clientX, clientY: event.clientY } : prev
                );
            })
            .on('pointerleave', function () {
                resetHighlights();
                setTooltip(null);
            });

        nodeG
            .on('pointerenter', function (event: PointerEvent, d: SimNode) {
                highlightNode(d);
                const source = nodes.find((n) => n.id === d.id);
                setTooltip({
                    kind: 'node',
                    clientX: event.clientX,
                    clientY: event.clientY,
                    data: {
                        name: source?.name || d.name,
                        totalPasses: degreeMap.get(d.id) || 0,
                        incoming: incomingMap.get(d.id) || 0,
                        outgoing: outgoingMap.get(d.id) || 0,
                        degreeCentrality: source?.degree_centrality,
                        betweenness: source?.betweenness_centrality,
                        pagerank: source?.pagerank,
                    },
                });
            })
            .on('pointermove', function (event: PointerEvent) {
                setTooltip((prev) =>
                    prev ? { ...prev, clientX: event.clientX, clientY: event.clientY } : prev
                );
            })
            .on('pointerleave', function () {
                resetHighlights();
                setTooltip(null);
            });

        edgePathsRef.current = edgePaths;
        hitPathsRef.current = hitPaths;
        minPassesRef.current = minPasses;
    }, [nodes, edges, width, height, showLabels]);

    useEffect(() => {
        minPassesRef.current = minPasses;
        edgePathsRef.current?.style('display', (d) => (d.weight >= minPasses ? null : 'none'));
        hitPathsRef.current?.style('display', (d) => (d.weight >= minPasses ? null : 'none'));
        setTooltip(null);
    }, [minPasses]);

    if (nodes.length === 0) {
        return (
            <div className="pass-network-empty">
                <p>No network data available</p>
            </div>
        );
    }

    const tooltipNode =
        tooltip && typeof document !== 'undefined'
            ? createPortal(
                  <div
                      className="pointer-events-none fixed z-[100] rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--text-primary)] shadow-[var(--shadow-sm)]"
                      style={{
                          left: tooltip.clientX,
                          top: tooltip.clientY,
                          transform: 'translate(-50%, calc(-100% - 14px))',
                          minWidth: 200,
                          maxWidth: 260,
                      }}
                  >
                      {tooltip.kind === 'edge' ? (
                          <div className="space-y-1">
                              <div className="font-semibold text-[var(--text-primary)]">
                                  {tooltip.data.sourceName}
                                  <span className="mx-1 text-[var(--amber)]">→</span>
                                  {tooltip.data.targetName}
                              </div>
                              <div className="flex items-center justify-between text-[11px]">
                                  <span className="text-[var(--text-secondary)]">Forward passes</span>
                                  <span className="font-medium text-[var(--text-primary)]">
                                      {tooltip.data.forward}
                                  </span>
                              </div>
                              {tooltip.data.reverse > 0 && (
                                  <div className="flex items-center justify-between text-[11px]">
                                      <span className="text-[var(--text-secondary)]">Return passes</span>
                                      <span className="font-medium text-[var(--text-primary)]">
                                          {tooltip.data.reverse}
                                      </span>
                                  </div>
                              )}
                              <div className="mt-1 flex items-center justify-between border-t border-[var(--border-soft)] pt-1 text-[11px]">
                                  <span className="text-[var(--text-secondary)]">Total</span>
                                  <span className="font-semibold text-[var(--text-primary)]">
                                      {tooltip.data.forward + tooltip.data.reverse}
                                  </span>
                              </div>
                          </div>
                      ) : (
                          <div className="space-y-1.5">
                              <div className="font-semibold text-[var(--text-primary)]">{tooltip.data.name}</div>
                              <div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 text-[11px]">
                                  <span className="text-[var(--text-secondary)]">Total passes</span>
                                  <span className="text-right font-medium text-[var(--text-primary)]">
                                      {tooltip.data.totalPasses}
                                  </span>
                                  <span className="text-[var(--text-secondary)]">Incoming</span>
                                  <span className="text-right text-[var(--text-primary)]">
                                      {tooltip.data.incoming}
                                  </span>
                                  <span className="text-[var(--text-secondary)]">Outgoing</span>
                                  <span className="text-right text-[var(--text-primary)]">
                                      {tooltip.data.outgoing}
                                  </span>
                                  {tooltip.data.degreeCentrality !== undefined && (
                                      <>
                                          <span className="text-[var(--text-secondary)]">Degree centrality</span>
                                          <span className="text-right text-[var(--text-primary)]">
                                              {tooltip.data.degreeCentrality.toFixed(3)}
                                          </span>
                                      </>
                                  )}
                                  {tooltip.data.betweenness !== undefined && (
                                      <>
                                          <span className="text-[var(--text-secondary)]">Betweenness</span>
                                          <span className="text-right text-[var(--text-primary)]">
                                              {tooltip.data.betweenness.toFixed(3)}
                                          </span>
                                      </>
                                  )}
                                  {tooltip.data.pagerank !== undefined && (
                                      <>
                                          <span className="text-[var(--text-secondary)]">PageRank</span>
                                          <span className="text-right text-[var(--text-primary)]">
                                              {tooltip.data.pagerank.toFixed(3)}
                                          </span>
                                      </>
                                  )}
                              </div>
                          </div>
                      )}
                  </div>,
                  document.body
              )
            : null;

    return (
        <div
            ref={containerRef}
            className="pass-network-wrapper relative"
            data-testid="shared-pass-network-graph"
        >
            <svg
                ref={svgRef}
                viewBox={`0 0 ${width} ${height}`}
                preserveAspectRatio="xMidYMid meet"
                style={{ width: '100%', height: 'auto', display: 'block' }}
            />
            {tooltipNode}
        </div>
    );
}
