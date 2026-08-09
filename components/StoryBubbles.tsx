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
  "#ff725e", "#5b8fe8", "#82cf77", "#a896df", "#ffad3d",
  "#62c9c5", "#ffd54f", "#ee7aa8", "#67b7d8", "#8e83d8",
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
  return cleaned.split(/\s+/).filter(Boolean).slice(0, 3).join(" ");
}

function topicForSize(title: string, size: number) {
  const words = shortTopic(title).split(/\s+/).filter(Boolean);
  const count = size < 105 ? 1 : size < 145 ? 2 : 3;
  return words.slice(0, count).join(" ");
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

function makeRadialLayout(stories: BubbleStory[], baseSizes: number[], metric: MetricKey): RadialLayout {
  const width = 1480;
  const height = 635;
  const centerX = width / 2;
  const centerY = height / 2;
  const edgeGap = 4;
  const bubbleGap = 3;

  if (stories.length === 0) return { positions: [], sizes: [] };
  if (stories.length === 1) return { positions: [{ left: 50, top: 50 }], sizes: [Math.min(560, baseSizes[0] * 2.8)] };

  const outerIndices = Array.from({ length: stories.length - 1 }, (_, i) => i + 1);
  const seed = hashString(`${metric}:${stories.map((story) => story.id).join("|")}`);
  const random = seededRandom(seed);

  for (let i = outerIndices.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [outerIndices[i], outerIndices[j]] = [outerIndices[j], outerIndices[i]];
  }

  function buildAtScale(scale: number) {
    const sizes = baseSizes.map((size) => size * scale);
    const mainRadii = sizes.map((size) => size / 2);
    const centerRadius = mainRadii[0];
    const positionsPx: Array<{ x: number; y: number }> = stories.map(() => ({ x: centerX, y: centerY }));

    // Place every surrounding MAIN bubble tangent to the center MAIN bubble.
    // We search angular positions rather than reserving a large cluster radius, which removes the visual gap.
    const used: Array<{ index: number; x: number; y: number; r: number }> = [
      { index: 0, x: centerX, y: centerY, r: centerRadius },
    ];

    const startAngle = random() * Math.PI * 2;

    for (let slot = 0; slot < outerIndices.length; slot += 1) {
      const storyIndex = outerIndices[slot];
      const radius = mainRadii[storyIndex];
      const distanceFromCenter = centerRadius + radius + bubbleGap;
      let chosen: { x: number; y: number } | null = null;

      // Dense angular scan; prefer evenly distributed candidate angles but only accept zero-overlap positions.
      for (let step = 0; step < 1440; step += 1) {
        const target = startAngle + ((slot / outerIndices.length) * Math.PI * 2);
        const offsetStep = Math.ceil(step / 2) * (Math.PI / 720);
        const direction = step % 2 === 0 ? 1 : -1;
        const angle = target + direction * offsetStep;
        const x = centerX + Math.cos(angle) * distanceFromCenter;
        const y = centerY + Math.sin(angle) * distanceFromCenter;

        if (x - radius < edgeGap || x + radius > width - edgeGap || y - radius < edgeGap || y + radius > height - edgeGap) continue;

        let overlaps = false;
        for (const existing of used) {
          const required = radius + existing.r + bubbleGap;
          if (Math.hypot(x - existing.x, y - existing.y) < required) {
            overlaps = true;
            break;
          }
        }
        if (!overlaps) {
          chosen = { x, y };
          break;
        }
      }

      if (!chosen) return { sizes, positionsPx, fits: false };
      positionsPx[storyIndex] = chosen;
      used.push({ index: storyIndex, x: chosen.x, y: chosen.y, r: radius });
    }

    return { sizes, positionsPx, fits: true };
  }

  // Maximize the common scale while preserving area ratios and strict MAIN-bubble non-overlap.
  let low = 0.05;
  let high = 5;
  let best = buildAtScale(low);
  for (let iteration = 0; iteration < 38; iteration += 1) {
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

  const selectedStory = selectedStoryId ? stories.find((story) => story.id === selectedStoryId) ?? null : null;
  const maxValue = Math.max(...displayed.map((story) => metricValue(story, metric)), 1);

  function baseSizeFor(value: number) {
    const referenceDiameter = 210;
    const ratio = Math.max(value, 1) / maxValue;
    return referenceDiameter * Math.sqrt(ratio);
  }

  const baseSizes = displayed.map((story) => baseSizeFor(metricValue(story, metric)));
  const layout = useMemo(() => makeRadialLayout(displayed, baseSizes, metric), [displayed, metric, baseSizes.join(",")]);

  const controls = (
    <div className="controlBar">
      <label>
        <span>Size bubbles by</span>
        <select value={metric} onChange={(e) => setMetric(e.target.value as MetricKey)}>
          {Object.entries(metricLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </label>
      <label>
        <span>Stories shown</span>
        <select value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
          {Array.from({ length: Math.min(10, stories.length) }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
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
            const topicFont = Math.max(10, Math.min(24, size * 0.1));
            const metricFont = Math.max(7, Math.min(12, size * 0.047));

            const dx = (position.left - 50) * 14.8;
            const dy = (position.top - 50) * 6.35;
            const outwardAngle = Math.atan2(dy, dx);

            return (
              <div key={story.id} className="storyCluster overviewCluster" style={{ left: `${position.left}%`, top: `${position.top}%`, width: size, height: size }}>
                <button type="button" className="storyBubble mainBubbleButton solidBubble" onClick={() => setSelectedStoryId(story.id)} aria-label={`Open story: ${story.title}`} style={{ width: size, height: size, backgroundColor: bubbleColor, padding: Math.max(8, size * 0.085) }}>
                  <strong style={{ fontSize: topicFont }}>{topicForSize(story.title, size)}</strong>
                  <span className="bubbleMetric" style={{ fontSize: metricFont }}>{metricLabels[metric]} {value}</span>
                </button>

                <div className="decorativeOrbit" aria-hidden="true">
                  {items.map((item, itemIndex) => {
                    const count = Math.max(items.length, 1);
                    const angle = storyIndex === 0
                      ? -Math.PI / 2 + (itemIndex / count) * Math.PI * 2
                      : outwardAngle - Math.PI / 2 + ((itemIndex + 0.5) / count) * Math.PI;
                    const orbit = size / 2 + 14;
                    const left = size / 2 + Math.cos(angle) * orbit;
                    const top = size / 2 + Math.sin(angle) * orbit;
                    return <span key={item.id} className="subBubble subBubbleDecorative" style={{ left, top, backgroundColor: bubbleColor }} />;
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
            <div className="storyBubble focusMainBubble solidBubble" style={{ backgroundColor: bubbleColors[Math.max(0, stories.findIndex((s) => s.id === selectedStory.id)) % bubbleColors.length] }}>
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
                <button key={item.id} type="button" className="subBubble focusSubBubble" onClick={() => setOpenItem(item)} style={{ left: `calc(50% + ${x}px)`, top: `calc(50% + ${y}px)`, backgroundImage: `linear-gradient(rgba(0,0,0,.34), rgba(0,0,0,.62)), url(${itemImage})` }} aria-label={`Read article: ${item.title}`}>
                  <span>{item.title}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {openItem && (
        <div className="articleModalBackdrop" role="presentation" onClick={() => setOpenItem(null)}>
          <article className="articleModal" role="dialog" aria-modal="true" aria-label={openItem.title} onClick={(e) => e.stopPropagation()}>
            <button className="modalClose" onClick={() => setOpenItem(null)} aria-label="Close article">×</button>
            <div className="articleHero" style={{ backgroundImage: `linear-gradient(rgba(0,0,0,.18), rgba(0,0,0,.55)), url(${openItem.image_url ?? fallbackImage(openItem.id)})` }} />
            <div className="articleModalBody">
              <p className="articleMeta">{sourceName(openItem.sources)}{openItem.author ? ` · ${openItem.author}` : ""}{openItem.published_at ? ` · ${new Date(openItem.published_at).toLocaleString()}` : ""}</p>
              <h2>{openItem.title}</h2>
              <div className="articleText">
                {openItem.content ? openItem.content.split("\n").filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>) : <p>This test article does not yet contain a full article body. When real article content is ingested into Supabase, it will appear here without redirecting away from Quantum America.</p>}
              </div>
            </div>
          </article>
        </div>
      )}
    </div>
  );
}
