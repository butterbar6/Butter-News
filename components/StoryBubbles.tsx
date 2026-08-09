"use client";

import { useMemo, useState } from "react";

type Metric = { metric_type: string; metric_value: number };
type Source = { name: string } | { name: string }[] | null;
type Item = {
  id: string;
  title: string;
  url: string;
  content: string | null;
  author: string | null;
  published_at: string | null;
  image_url: string | null;
  sources: Source;
};
type StoryItem = { items: Item | Item[] | null };

export type BubbleStory = {
  id: string;
  title: string;
  summary: string | null;
  importance_score: number;
  story_metrics: Metric[];
  story_items: StoryItem[];
};

type MetricKey = "exposure_score" | "momentum" | "article_count" | "source_count" | "importance_score";
type PackedPosition = { left: number; top: number };
type RadialLayout = { positions: PackedPosition[]; sizes: number[] };

const metricLabels: Record<MetricKey, string> = {
  exposure_score: "Exposure",
  momentum: "Momentum",
  article_count: "Article count",
  source_count: "Source count",
  importance_score: "Importance",
};

const bubbleColors = [
  "#ff725e",
  "#5b8fe8",
  "#82cf77",
  "#a896df",
  "#ffad3d",
  "#62c9c5",
  "#ffd54f",
  "#ee7aa8",
  "#67b7d8",
  "#8e83d8",
];

function metricValue(story: BubbleStory, metric: MetricKey) {
  if (metric === "importance_score") return Number(story.importance_score ?? 0);
  return Number(story.story_metrics?.find((m) => m.metric_type === metric)?.metric_value ?? 0);
}

function flattenItems(story: BubbleStory) {
  return (story.story_items ?? []).flatMap((row) => {
    if (!row.items) return [];
    return Array.isArray(row.items) ? row.items : [row.items];
  });
}

function fallbackImage(seed: string) {
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/800/800`;
}

function sourceName(source: Source) {
  if (!source) return "Source";
  if (Array.isArray(source)) return source[0]?.name ?? "Source";
  return source.name;
}

function shortTopic(title: string) {
  const cleaned = title
    .replace(/Major /gi, "")
    .replace(/New /gi, "")
    .replace(/Across the /gi, "")
    .replace(/Across /gi, "")
    .replace(/Following /gi, "")
    .replace(/Continues? to /gi, "")
    .replace(/Industry /gi, "")
    .replace(/Sector /gi, "")
    .replace(/Development /gi, "")
    .replace(/Program /gi, "")
    .replace(/Announces? /gi, "")
    .replace(/Expands? /gi, "")
    .replace(/Accelerates? /gi, "")
    .replace(/React(s|ing)? to /gi, "")
    .trim();

  const words = cleaned.split(/\s+/).filter(Boolean);
  return words.slice(0, 3).join(" ");
}

function hashString(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed: number) {
  let state = seed || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function makeRadialLayout(
  stories: BubbleStory[],
  baseSizes: number[],
  metric: MetricKey
): RadialLayout {
  const width = 1400;
  const height = 610;
  const centerX = width / 2;
  const centerY = height / 2;
  const edgeGap = 10;
  const clusterGap = 8;
  const orbitPadding = 42; // includes decorative satellite orbit and satellite radius

  if (stories.length === 0) return { positions: [], sizes: [] };
  if (stories.length === 1) {
    return { positions: [{ left: 50, top: 50 }], sizes: baseSizes };
  }

  // Stories are already sorted largest-to-smallest by the selected metric,
  // so index 0 is always the central/main story.
  const outerCount = stories.length - 1;
  const seed = hashString(`${metric}:${stories.map((story) => story.id).join("|")}`);
  const random = seededRandom(seed);

  // Create a stable organic-looking circular order and slight angular jitter.
  const outerIndices = Array.from({ length: outerCount }, (_, i) => i + 1);
  for (let i = outerIndices.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [outerIndices[i], outerIndices[j]] = [outerIndices[j], outerIndices[i]];
  }

  const baseStep = (Math.PI * 2) / outerCount;
  const rotation = random() * Math.PI * 2;
  const angles = outerIndices.map((_, slot) => {
    const jitter = (random() - 0.5) * baseStep * 0.18;
    return rotation + slot * baseStep + jitter;
  });

  function buildAtScale(scale: number) {
    const sizes = baseSizes.map((size) => Math.max(54, size * scale));
    const radii = sizes.map((size) => size / 2 + orbitPadding * scale);
    const centerRadius = radii[0];

    // Start with the smallest radius that clears the center cluster.
    let ringRadius = Math.max(
      ...outerIndices.map((index) => centerRadius + radii[index] + clusterGap)
    );

    // Increase ring radius until EVERY outer cluster clears every other cluster.
    for (let a = 0; a < outerCount; a += 1) {
      for (let b = a + 1; b < outerCount; b += 1) {
        let delta = Math.abs(angles[a] - angles[b]) % (Math.PI * 2);
        if (delta > Math.PI) delta = Math.PI * 2 - delta;
        const chordFactor = 2 * Math.sin(delta / 2);
        if (chordFactor <= 0.0001) continue;

        const indexA = outerIndices[a];
        const indexB = outerIndices[b];
        const required = (radii[indexA] + radii[indexB] + clusterGap) / chordFactor;
        ringRadius = Math.max(ringRadius, required);
      }
    }

    const positionsPx: Array<{ x: number; y: number }> = stories.map(() => ({ x: centerX, y: centerY }));
    outerIndices.forEach((storyIndex, slot) => {
      positionsPx[storyIndex] = {
        x: centerX + Math.cos(angles[slot]) * ringRadius,
        y: centerY + Math.sin(angles[slot]) * ringRadius,
      };
    });

    const fits = positionsPx.every((position, index) => {
      const radius = radii[index];
      return (
        position.x - radius >= edgeGap &&
        position.x + radius <= width - edgeGap &&
        position.y - radius >= edgeGap &&
        position.y + radius <= height - edgeGap
      );
    });

    return { sizes, radii, ringRadius, positionsPx, fits };
  }

  // Find the largest global scale that guarantees zero overlap and remains on-screen.
  let low = 0.22;
  let high = 1;
  let best = buildAtScale(low);

  for (let iteration = 0; iteration < 26; iteration += 1) {
    const mid = (low + high) / 2;
    const candidate = buildAtScale(mid);
    if (candidate.fits) {
      best = candidate;
      low = mid;
    } else {
      high = mid;
    }
  }

  return {
    sizes: best.sizes.map((size) => Math.round(size)),
    positions: best.positionsPx.map((position) => ({
      left: (position.x / width) * 100,
      top: (position.y / height) * 100,
    })),
  };
}

export default function StoryBubbles({ stories }: { stories: BubbleStory[] }) {
  const [metric, setMetric] = useState<MetricKey>("exposure_score");
  const [limit, setLimit] = useState(Math.min(10, Math.max(1, stories.length)));
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null);
  const [openItem, setOpenItem] = useState<Item | null>(null);

  const displayed = useMemo(
    () => [...stories].sort((a, b) => metricValue(b, metric) - metricValue(a, metric)).slice(0, Math.min(limit, 10)),
    [stories, metric, limit]
  );

  const selectedStory = selectedStoryId
    ? stories.find((story) => story.id === selectedStoryId) ?? null
    : null;

  const maxValue = Math.max(...displayed.map((story) => metricValue(story, metric)), 1);

  function baseSizeFor(value: number) {
    // Bubble AREA is proportional to the selected metric.
    // Therefore diameter scales with sqrt(metric / maxMetric).
    const maxDiameter = 210;
    const minDiameter = 82;
    const proportionalDiameter = maxDiameter * Math.sqrt(Math.max(value, 0) / maxValue);
    return Math.max(minDiameter, proportionalDiameter);
  }

  const baseSizes = displayed.map((story) => baseSizeFor(metricValue(story, metric)));
  const layout = useMemo(
    () => makeRadialLayout(displayed, baseSizes, metric),
    [displayed, metric, baseSizes.join(",")]
  );

  const controls = (
    <div className="controlBar">
      <label>
        <span>Size bubbles by</span>
        <select value={metric} onChange={(e) => setMetric(e.target.value as MetricKey)}>
          {Object.entries(metricLabels).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </label>

      <label>
        <span>Stories shown</span>
        <select value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
          {Array.from({ length: Math.min(10, stories.length) }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </label>
    </div>
  );

  return (
    <div className="visualizerShell">
      <header className="brandBanner">
        <h1>QUANTUM AMERICA</h1>
        <p>The Answer to 1984 is 1776</p>
      </header>

      {controls}

      {!selectedStory ? (
        <section className="bubbleStage circularStage overviewView" aria-label="Story bubble visualization">
          {displayed.map((story, storyIndex) => {
            const value = metricValue(story, metric);
            const size = layout.sizes[storyIndex];
            const position = layout.positions[storyIndex];
            const items = flattenItems(story).slice(0, 8);
            const bubbleColor = bubbleColors[storyIndex % bubbleColors.length];

            return (
              <div
                key={story.id}
                className="storyCluster overviewCluster"
                style={{
                  left: `${position.left}%`,
                  top: `${position.top}%`,
                  width: size,
                  height: size,
                }}
              >
                <button
                  type="button"
                  className="storyBubble mainBubbleButton solidBubble"
                  onClick={() => setSelectedStoryId(story.id)}
                  aria-label={`Open story: ${story.title}`}
                  style={{
                    width: size,
                    height: size,
                    backgroundColor: bubbleColor,
                  }}
                >
                  <strong>{shortTopic(story.title)}</strong>
                  <span className="bubbleMetric">{metricLabels[metric]} {value}</span>
                </button>

                <div className="decorativeOrbit" aria-hidden="true">
                  {items.map((item, itemIndex) => {
                    const angle = -Math.PI / 2 + (itemIndex / Math.max(items.length, 1)) * Math.PI * 2;
                    const orbit = size / 2 + Math.max(12, 22 * (size / Math.max(baseSizes[storyIndex], 1)));
                    const left = size / 2 + Math.cos(angle) * orbit;
                    const top = size / 2 + Math.sin(angle) * orbit;
                    return (
                      <span
                        key={item.id}
                        className="subBubble subBubbleDecorative"
                        style={{
                          left,
                          top,
                          backgroundColor: bubbleColor,
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </section>
      ) : (
        <section className="bubbleStage focusView" aria-label="Selected story with related articles">
          <button className="backButton" onClick={() => { setSelectedStoryId(null); setOpenItem(null); }}>← All stories</button>

          <div className="focusScene">
            <div className="focusOrbitRing" />

            <div
              className="storyBubble focusMainBubble solidBubble"
              style={{ backgroundColor: bubbleColors[Math.max(0, stories.findIndex((s) => s.id === selectedStory.id)) % bubbleColors.length] }}
            >
              <strong>{shortTopic(selectedStory.title)}</strong>
              <span className="bubbleMetric">{metricLabels[metric]} {metricValue(selectedStory, metric)}</span>
            </div>

            {flattenItems(selectedStory).slice(0, 10).map((item, index, allItems) => {
              const angle = -Math.PI / 2 + (index / Math.max(allItems.length, 1)) * Math.PI * 2;
              const orbit = 285;
              const x = Math.cos(angle) * orbit;
              const y = Math.sin(angle) * orbit;
              const itemImage = item.image_url ?? fallbackImage(item.id);

              return (
                <button
                  key={item.id}
                  type="button"
                  className="subBubble focusSubBubble"
                  onClick={() => setOpenItem(item)}
                  style={{
                    left: `calc(50% + ${x}px)`,
                    top: `calc(50% + ${y}px)`,
                    backgroundImage: `linear-gradient(rgba(0,0,0,.34), rgba(0,0,0,.62)), url(${itemImage})`,
                  }}
                  aria-label={`Read article: ${item.title}`}
                >
                  <span>{item.title}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {openItem && (
        <div className="articleModalBackdrop" role="presentation" onClick={() => setOpenItem(null)}>
          <article
            className="articleModal"
            role="dialog"
            aria-modal="true"
            aria-label={openItem.title}
            onClick={(e) => e.stopPropagation()}
          >
            <button className="modalClose" onClick={() => setOpenItem(null)} aria-label="Close article">×</button>
            <div
              className="articleHero"
              style={{ backgroundImage: `linear-gradient(rgba(0,0,0,.18), rgba(0,0,0,.55)), url(${openItem.image_url ?? fallbackImage(openItem.id)})` }}
            />
            <div className="articleModalBody">
              <p className="articleMeta">
                {sourceName(openItem.sources)}
                {openItem.author ? ` · ${openItem.author}` : ""}
                {openItem.published_at ? ` · ${new Date(openItem.published_at).toLocaleString()}` : ""}
              </p>
              <h2>{openItem.title}</h2>
              <div className="articleText">
                {openItem.content ? (
                  openItem.content.split("\n").filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)
                ) : (
                  <p>This test article does not yet contain a full article body. When real article content is ingested into Supabase, it will appear here without redirecting away from Quantum America.</p>
                )}
              </div>
            </div>
          </article>
        </div>
      )}
    </div>
  );
}
