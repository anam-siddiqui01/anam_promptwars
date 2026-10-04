import React, { useState } from 'react';
import { Check } from 'lucide-react';
import {
  BlindSpotCategory,
  BlindSpotItemProgress,
  MirrorAnalysis,
} from '../types/decision';

export interface BlindSpotMapProps {
  mirror: MirrorAnalysis;
  progress: Record<string, BlindSpotItemProgress>;
  selectedNodeId: string | null;
  activeCategoryFilter: BlindSpotCategory | 'ALL';
  onSelectNode: (id: string, category: BlindSpotCategory) => void;
  onSelectCategoryFilter: (category: BlindSpotCategory | 'ALL') => void;
}

interface CategoryClusterConfig {
  key: BlindSpotCategory;
  label: string;
  code: string;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

const CATEGORY_CLUSTERS: CategoryClusterConfig[] = [
  {
    key: 'assumptions',
    label: 'Assumptions',
    code: '01',
    position: 'top-left',
  },
  {
    key: 'missingFactors',
    label: 'Missing Factors',
    code: '02',
    position: 'top-right',
  },
  {
    key: 'evidenceGaps',
    label: 'Evidence',
    code: '03',
    position: 'bottom-left',
  },
  {
    key: 'perspectives',
    label: 'Perspectives',
    code: '04',
    position: 'bottom-right',
  },
];

export const BlindSpotMap: React.FC<BlindSpotMapProps> = ({
  mirror,
  progress,
  selectedNodeId,
  activeCategoryFilter,
  onSelectNode,
  onSelectCategoryFilter,
}) => {
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  const getCategoryItems = (
    category: BlindSpotCategory
  ): Array<{ id: string; index: number; title: string }> => {
    switch (category) {
      case 'assumptions':
        return mirror.assumptions.map((item, idx) => ({
          id: `assumptions-${idx}`,
          index: idx,
          title: item.title,
        }));
      case 'missingFactors':
        return mirror.missingFactors.map((item, idx) => ({
          id: `missingFactors-${idx}`,
          index: idx,
          title: item.title,
        }));
      case 'evidenceGaps':
        return mirror.evidenceGaps.map((item, idx) => ({
          id: `evidenceGaps-${idx}`,
          index: idx,
          title: item.claim,
        }));
      case 'perspectives':
        return mirror.perspectives.map((item, idx) => ({
          id: `perspectives-${idx}`,
          index: idx,
          title: item.perspective,
        }));
    }
  };

  const allNodes = CATEGORY_CLUSTERS.flatMap((cluster) =>
    getCategoryItems(cluster.key).map((item) => ({
      ...item,
      category: cluster.key,
      categoryLabel: cluster.label,
    }))
  );

  const totalNodes = allNodes.length;
  const exploredCount = allNodes.filter((n) => progress[n.id]?.explored).length;
  const addressedCount = allNodes.filter(
    (n) => progress[n.id]?.state === 'ADDRESSED'
  ).length;
  const unresolvedCount = allNodes.filter(
    (n) =>
      progress[n.id]?.needsMoreInfo ||
      progress[n.id]?.state === 'NEEDS_INFO' ||
      progress[n.id]?.state === 'THINKING'
  ).length;

  const activeNode = allNodes.find(
    (n) => n.id === (hoveredNodeId ?? selectedNodeId)
  );
  const activeNodeProgress = activeNode ? progress[activeNode.id] : undefined;

  const isClusterActiveConnection = (category: BlindSpotCategory) =>
    activeCategoryFilter === category || activeNode?.category === category;

  const renderCategoryCluster = (cluster: CategoryClusterConfig) => {
    const items = getCategoryItems(cluster.key);
    const isFilteredToThis = activeCategoryFilter === cluster.key;
    const isDimmed =
      activeCategoryFilter !== 'ALL' && activeCategoryFilter !== cluster.key;

    return (
      <div
        key={cluster.key}
        className={`relative rounded-xs border p-4 sm:p-5 transition-all duration-200 ${
          isFilteredToThis
            ? 'border-[#6F8F86] bg-[#E3ECE8]/35 shadow-2xs'
            : 'border-[#D9DDD8] bg-white hover:border-[#6F8F86]'
        } ${isDimmed ? 'opacity-45' : 'opacity-100'}`}
      >
        <div className="flex items-center justify-between gap-2 border-b border-[#D9DDD8] pb-2.5">
          <button
            type="button"
            onClick={() =>
              onSelectCategoryFilter(isFilteredToThis ? 'ALL' : cluster.key)
            }
            className="group flex items-center gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6F8F86] rounded-2xs cursor-pointer"
          >
            <span className="font-mono-tabular text-[11px] font-semibold text-[#6F8F86]">
              {cluster.code}
            </span>
            <span className="text-xs font-semibold tracking-[0.02em] text-[#172A2A] group-hover:text-[#6F8F86] transition-colors">
              {cluster.label}
            </span>
          </button>
          <span className="font-mono-tabular text-[11px] text-[#687572]">
            {items.length}
          </span>
        </div>

        {/* Numbered Nodes + Short Labels */}
        <div className="mt-3.5 space-y-2">
          {items.map((node) => {
            const nodeProg = progress[node.id];
            const state = nodeProg?.state ?? 'OPEN';
            const isSelected =
              selectedNodeId === node.id || hoveredNodeId === node.id;

            const isAddressed = state === 'ADDRESSED';
            const isUnresolved =
              Boolean(nodeProg?.needsMoreInfo) ||
              state === 'NEEDS_INFO' ||
              state === 'THINKING';
            const isExamining = Boolean(nodeProg?.explored) && !isAddressed;

            return (
              <button
                key={node.id}
                type="button"
                onClick={() => onSelectNode(node.id, cluster.key)}
                onMouseEnter={() => setHoveredNodeId(node.id)}
                onMouseLeave={() => setHoveredNodeId(null)}
                onFocus={() => setHoveredNodeId(node.id)}
                onBlur={() => setHoveredNodeId(null)}
                aria-label={`${cluster.label} node ${node.index + 1}: ${
                  node.title
                } (${state})`}
                className={`group w-full flex items-center gap-3 rounded-xs border px-3 py-2 text-left transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6F8F86] ${
                  isSelected
                    ? 'border-[#6F8F86] bg-[#E3ECE8]/65 text-[#172A2A]'
                    : isAddressed
                    ? 'border-[#D9DDD8] bg-[#F7F5F0] text-[#687572]'
                    : isExamining
                    ? 'border-[#6F8F86]/60 bg-[#E3ECE8]/30 text-[#172A2A]'
                    : 'border-transparent bg-[#F7F5F0]/75 hover:border-[#6F8F86]/60 hover:bg-[#E3ECE8]/30 text-[#172A2A]'
                }`}
              >
                {/* Small Numbered Node */}
                <span
                  className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono-tabular text-[11px] font-semibold transition-all duration-150 ${
                    isAddressed
                      ? 'border border-[#D9DDD8] bg-[#F7F5F0] text-[#687572]'
                      : isSelected || isExamining
                      ? 'border border-[#6F8F86] bg-[#6F8F86] text-white'
                      : 'border border-[#D9DDD8] bg-white text-[#172A2A] group-hover:border-[#6F8F86]'
                  }`}
                >
                  {isAddressed ? (
                    <Check className="h-3 w-3 stroke-[2.5]" aria-hidden="true" />
                  ) : (
                    node.index + 1
                  )}
                </span>

                <span
                  className={`text-xs leading-snug line-clamp-1 flex-1 ${
                    isAddressed
                      ? 'text-[#687572] line-through decoration-[#D9DDD8]'
                      : 'font-medium text-[#172A2A]'
                  }`}
                >
                  {node.title}
                </span>

                <span className="font-mono-tabular text-[11px] text-[#687572] shrink-0 inline-flex items-center gap-1.5">
                  {isAddressed ? (
                    'Addressed ✓'
                  ) : isUnresolved ? (
                    <>
                      <span
                        className="h-1.5 w-1.5 rounded-full bg-[#C58B68]"
                        aria-hidden="true"
                      />
                      <span className="text-[#172A2A] font-medium">
                        Examining
                      </span>
                    </>
                  ) : isExamining ? (
                    <span className="text-[#172A2A] font-semibold">
                      Examining
                    </span>
                  ) : (
                    <span className="text-[#687572] opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                      Open →
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <section
      aria-label="Your Blind Spot Map"
      className="border border-[#D9DDD8] bg-[#F7F5F0] rounded-xs p-6 sm:p-8"
    >
      {/* Header & Subtle State Key */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#D9DDD8] pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold tracking-[0.02em] text-[#6F8F86]">
              Blind Spot Map
            </span>
            <span className="text-[#D9DDD8]" aria-hidden="true">
              ·
            </span>
            <span className="font-mono-tabular text-[#687572]">
              {exploredCount} of {totalNodes} areas examined
            </span>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-[#687572]">
            Your reasoning sits at the center of four structural angles. Select any numbered node to jump to its card.
          </p>
        </div>

        {/* Minimal State Key */}
        <div className="flex flex-wrap items-center gap-4 text-xs font-mono-tabular text-[#687572]">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full border border-[#D9DDD8] bg-white" />
            <span>Open ({totalNodes - exploredCount})</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#6F8F86]" />
            <span>Examining ({exploredCount - addressedCount})</span>
          </span>
          {unresolvedCount > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#C58B68]" />
              <span>Needs attention ({unresolvedCount})</span>
            </span>
          )}
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full border border-[#D9DDD8] bg-[#F7F5F0]" />
            <span>Addressed ✓ ({addressedCount})</span>
          </span>
          {activeCategoryFilter !== 'ALL' && (
            <button
              type="button"
              onClick={() => onSelectCategoryFilter('ALL')}
              className="text-[#172A2A] underline decoration-[#6F8F86] underline-offset-4 font-semibold cursor-pointer"
            >
              Show all angles
            </button>
          )}
        </div>
      </div>

      {/* Connected Spatial Map: 4 Quadrants Surrounding Central "Your reasoning" */}
      <div className="mt-6 relative">
        {/* Desktop SVG Connector Lines behind the grid */}
        <svg
          aria-hidden="true"
          viewBox="0 0 800 320"
          preserveAspectRatio="none"
          className="hidden lg:block pointer-events-none absolute inset-0 h-full w-full"
        >
          {/* Top-Left: Assumptions */}
          <line
            x1="400"
            y1="160"
            x2="210"
            y2="80"
            stroke={
              isClusterActiveConnection('assumptions') ? '#6F8F86' : '#D9DDD8'
            }
            strokeWidth={isClusterActiveConnection('assumptions') ? '2' : '1.5'}
            strokeDasharray={
              isClusterActiveConnection('assumptions') ? 'none' : '4 4'
            }
          />
          {/* Top-Right: Missing Factors */}
          <line
            x1="400"
            y1="160"
            x2="590"
            y2="80"
            stroke={
              isClusterActiveConnection('missingFactors')
                ? '#6F8F86'
                : '#D9DDD8'
            }
            strokeWidth={
              isClusterActiveConnection('missingFactors') ? '2' : '1.5'
            }
            strokeDasharray={
              isClusterActiveConnection('missingFactors') ? 'none' : '4 4'
            }
          />
          {/* Bottom-Left: Evidence */}
          <line
            x1="400"
            y1="160"
            x2="210"
            y2="240"
            stroke={
              isClusterActiveConnection('evidenceGaps') ? '#6F8F86' : '#D9DDD8'
            }
            strokeWidth={
              isClusterActiveConnection('evidenceGaps') ? '2' : '1.5'
            }
            strokeDasharray={
              isClusterActiveConnection('evidenceGaps') ? 'none' : '4 4'
            }
          />
          {/* Bottom-Right: Perspectives */}
          <line
            x1="400"
            y1="160"
            x2="590"
            y2="240"
            stroke={
              isClusterActiveConnection('perspectives') ? '#6F8F86' : '#D9DDD8'
            }
            strokeWidth={
              isClusterActiveConnection('perspectives') ? '2' : '1.5'
            }
            strokeDasharray={
              isClusterActiveConnection('perspectives') ? 'none' : '4 4'
            }
          />
        </svg>

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 items-center">
          {/* Left Column: Assumptions & Evidence */}
          <div className="lg:col-span-5 space-y-4">
            {renderCategoryCluster(CATEGORY_CLUSTERS[0])}
            {renderCategoryCluster(CATEGORY_CLUSTERS[2])}
          </div>

          {/* Center Core: YOUR REASONING in white with deep ink typography */}
          <div className="lg:col-span-2 flex flex-col items-center justify-center py-2">
            <div className="w-full lg:w-auto rounded-xs border-[1.5px] border-[#172A2A] bg-white px-4 py-4 text-center text-[#172A2A] shadow-2xs">
              <div className="flex items-center justify-center gap-1.5">
                <span
                  className="h-1.5 w-1.5 rounded-full bg-[#6F8F86]"
                  aria-hidden="true"
                />
                <span className="text-[11px] font-medium tracking-[0.03em] text-[#687572]">
                  Central premise
                </span>
              </div>
              <span className="mt-1 block font-editorial text-xl text-[#172A2A]">
                Your reasoning
              </span>
              <div className="mt-2 pt-2 border-t border-[#D9DDD8] flex items-center justify-center gap-1.5 font-mono-tabular text-[11px] text-[#687572]">
                <span>{totalNodes} nodes</span>
                <span aria-hidden="true">·</span>
                <span>4 angles</span>
              </div>
            </div>
          </div>

          {/* Right Column: Missing Factors & Perspectives */}
          <div className="lg:col-span-5 space-y-4">
            {renderCategoryCluster(CATEGORY_CLUSTERS[1])}
            {renderCategoryCluster(CATEGORY_CLUSTERS[3])}
          </div>
        </div>
      </div>

      {/* Active Node Readout Bar */}
      <div className="mt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-[#D9DDD8] pt-3.5 text-xs">
        {activeNode ? (
          <>
            <div className="flex items-center gap-2 text-[#172A2A]">
              <span className="font-mono-tabular font-semibold text-[#6F8F86]">
                {activeNode.categoryLabel} #{activeNode.index + 1}
              </span>
              <span className="text-[#D9DDD8]" aria-hidden="true">
                ·
              </span>
              <span className="font-medium line-clamp-1">{activeNode.title}</span>
            </div>
            <span className="font-mono-tabular text-[11px] text-[#687572] shrink-0">
              {activeNodeProgress?.state === 'ADDRESSED'
                ? 'Addressed ✓'
                : activeNodeProgress?.explored
                ? 'Examining'
                : 'Open →'}
            </span>
          </>
        ) : (
          <span className="text-[#687572]">
            Select any node above to focus and expand its blind spot card below.
          </span>
        )}
      </div>
    </section>
  );
};
