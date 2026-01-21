import { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import type { NetworkNode, NetworkEdge } from '../../types';

interface PassNetworkGraphProps {
    nodes: NetworkNode[];
    edges: NetworkEdge[];
    width?: number;
    height?: number;
    showLabels?: boolean;
}

export default function PassNetworkGraph({
    nodes,
    edges,
    width = 800,
    height = 500,
    showLabels = true,
}: PassNetworkGraphProps) {
    const svgRef = useRef<SVGSVGElement>(null);

    useEffect(() => {
        if (!svgRef.current || nodes.length === 0) return;

        const svg = d3.select(svgRef.current);
        svg.selectAll('*').remove();

        // Pitch dimensions (StatsBomb: 120 x 80)
        const pitchLength = 120;
        const pitchWidth = 80;
        const margin = { top: 20, right: 20, bottom: 20, left: 20 };
        const innerWidth = width - margin.left - margin.right;
        const innerHeight = height - margin.top - margin.bottom;

        // Scales
        const xScale = d3.scaleLinear()
            .domain([0, pitchLength])
            .range([0, innerWidth]);

        const yScale = d3.scaleLinear()
            .domain([0, pitchWidth])
            .range([innerHeight, 0]); // Flip Y axis

        // Calculate max edge weight for scaling
        const maxWeight = d3.max(edges, d => d.weight) || 1;

        // Edge width scale
        const edgeScale = d3.scaleLinear()
            .domain([1, maxWeight])
            .range([1, 6]);

        // Node size scale (based on degree)
        const nodeDegrees = new Map<number, number>();
        edges.forEach(e => {
            nodeDegrees.set(e.source, (nodeDegrees.get(e.source) || 0) + e.weight);
            nodeDegrees.set(e.target, (nodeDegrees.get(e.target) || 0) + e.weight);
        });
        const maxDegree = Math.max(...nodeDegrees.values()) || 1;
        const nodeScale = d3.scaleLinear()
            .domain([0, maxDegree])
            .range([8, 25]);

        // Create main group
        const g = svg.append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // Draw pitch background
        g.append('rect')
            .attr('width', innerWidth)
            .attr('height', innerHeight)
            .attr('fill', '#2d8a4e')
            .attr('rx', 4);

        // Draw pitch lines
        const pitchLines = g.append('g').attr('class', 'pitch-lines');

        // Center circle
        pitchLines.append('circle')
            .attr('cx', xScale(60))
            .attr('cy', yScale(40))
            .attr('r', xScale(9.15) - xScale(0))
            .attr('fill', 'none')
            .attr('stroke', 'rgba(255,255,255,0.3)')
            .attr('stroke-width', 1);

        // Center line
        pitchLines.append('line')
            .attr('x1', xScale(60))
            .attr('y1', yScale(0))
            .attr('x2', xScale(60))
            .attr('y2', yScale(80))
            .attr('stroke', 'rgba(255,255,255,0.3)')
            .attr('stroke-width', 1);

        // Penalty areas
        // Left penalty area
        pitchLines.append('rect')
            .attr('x', xScale(0))
            .attr('y', yScale(62))
            .attr('width', xScale(16.5) - xScale(0))
            .attr('height', yScale(18) - yScale(62))
            .attr('fill', 'none')
            .attr('stroke', 'rgba(255,255,255,0.3)')
            .attr('stroke-width', 1);

        // Right penalty area
        pitchLines.append('rect')
            .attr('x', xScale(103.5))
            .attr('y', yScale(62))
            .attr('width', xScale(120) - xScale(103.5))
            .attr('height', yScale(18) - yScale(62))
            .attr('fill', 'none')
            .attr('stroke', 'rgba(255,255,255,0.3)')
            .attr('stroke-width', 1);

        // Create arrow marker
        svg.append('defs')
            .append('marker')
            .attr('id', 'arrowhead')
            .attr('viewBox', '0 -5 10 10')
            .attr('refX', 20)
            .attr('refY', 0)
            .attr('markerWidth', 6)
            .attr('markerHeight', 6)
            .attr('orient', 'auto')
            .append('path')
            .attr('d', 'M0,-5L10,0L0,5')
            .attr('fill', 'rgba(255,255,255,0.6)');

        // Create node map for quick lookup
        const nodeMap = new Map(nodes.map(n => [n.id, n]));

        // Draw edges
        const edgeGroup = g.append('g').attr('class', 'edges');

        edges.forEach(edge => {
            const source = nodeMap.get(edge.source);
            const target = nodeMap.get(edge.target);

            if (!source || !target) return;

            edgeGroup.append('line')
                .attr('x1', xScale(source.x))
                .attr('y1', yScale(source.y))
                .attr('x2', xScale(target.x))
                .attr('y2', yScale(target.y))
                .attr('stroke', 'rgba(255,255,255,0.5)')
                .attr('stroke-width', edgeScale(edge.weight))
                .attr('stroke-linecap', 'round')
                .attr('marker-end', 'url(#arrowhead)')
                .style('opacity', 0.7);
        });

        // Draw nodes
        const nodeGroup = g.append('g').attr('class', 'nodes');

        nodes.forEach(node => {
            const degree = nodeDegrees.get(node.id) || 0;
            const radius = nodeScale(degree);

            // Node circle
            nodeGroup.append('circle')
                .attr('cx', xScale(node.x))
                .attr('cy', yScale(node.y))
                .attr('r', radius)
                .attr('fill', '#3b82f6')
                .attr('stroke', '#fff')
                .attr('stroke-width', 2)
                .style('cursor', 'pointer')
                .on('mouseover', function () {
                    d3.select(this).attr('fill', '#60a5fa');
                })
                .on('mouseout', function () {
                    d3.select(this).attr('fill', '#3b82f6');
                });

            // Node label
            if (showLabels) {
                const shortName = node.name.split(' ').pop() || node.name;
                nodeGroup.append('text')
                    .attr('x', xScale(node.x))
                    .attr('y', yScale(node.y) + radius + 14)
                    .attr('text-anchor', 'middle')
                    .attr('fill', '#fff')
                    .attr('font-size', '10px')
                    .attr('font-weight', '500')
                    .text(shortName);
            }
        });

    }, [nodes, edges, width, height, showLabels]);

    if (nodes.length === 0) {
        return (
            <div className="flex items-center justify-center h-64 bg-gray-800 rounded-lg border border-gray-700">
                <p className="text-gray-400">No network data available</p>
            </div>
        );
    }

    return (
        <div className="overflow-hidden rounded-lg border border-gray-700">
            <svg
                ref={svgRef}
                width={width}
                height={height}
                className="bg-gray-800"
            />
        </div>
    );
}
