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

function packRandomly(stories: BubbleStory[], sizes: number[], metric: MetricKey): PackedPosition[] {
  const width = 1400;
  const height = 610;
  const gap = 10;
  const orbitPadding = 42;

  const entries = stories.map((story, index) => ({
    story,
    index,
    radius: sizes[index] / 2 + orbitPadding,
  }));

  const ordered = [...entries].sort((a, b) => b.radius - a.radius);
  const placed: Array<{ index: number; x: number; y: number; radius: number }> = [];
  const seed = hashString(`${metric}:${stories.map((story) => story.id).join("|")}`);
  const random = seededRandom(seed);

  for (const entry of ordered) {
    let best: { x: number; y: number; score: number } | null = null;

    for (let attempt = 0; attempt < 5000; attempt += 1) {
      const minX = entry.radius + gap;
      const maxX = width - entry.radius - gap;
      const minY = entry.radius + gap;
      const maxY = height - entry.radius - gap;

      if (maxX <= minX || maxY <= minY) continue;

      const x = minX + random() * (maxX - minX);
      const y = minY + random() * (maxY - minY);

      let valid = true;
      let nearest = Number.POSITIVE_INFINITY;

      for (const existing of placed) {
        const distance = Math.hypot(x - existing.x, y - existing.y);
        const required = entry.radius + existing.radius + gap;
        if (distance < required) {
          valid = false;
          break;
        }
        nearest = Math.min(nearest, distance - required);
      }

      if (!valid) continue;

      const edgeClearance = Math.min(
        x - entry.radius,
        width - x - entry.radius,
        y - entry.radius,
        height - y - entry.radius
      );

      const centerDistance = Math.hypot(x - width / 2, y - height / 2);
      const score = (Number.isFinite(nearest) ? nearest : 200) + edgeClearance * 0.22 - centerDistance * 0.03;

      if (!best || score > best.score) best = { x, y, score };
    }

    if (!best) {
      const columns = 5;
      const slot = placed.length;
      best = {
        x: ((slot % columns) + 0.5) * (width / columns),
        y: (Math.floor(slot / columns) + 0.5) * (height / 2),
        score: 0,
      };
    }

    placed.push({ index: entry.index, x: best.x, y: best.y, radius: entry.radius });
  }

  const positions: PackedPosition[] = stories.map(() => ({ left: 50, top: 50 }));
  for (const item of placed) {
    positions[item.index] = {
      left: (item.x / width) * 100,
      top: (item.y / height) * 100,
    };
  }

  return positions;
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

  function sizeFor(value: number) {
    // Bubble AREA is proportional to the selected metric.
    // Since area = pi * r^2, diameter must scale with sqrt(score).
    const maxDiameter = 188;
    const minDiameter = 82;
    const proportionalDiameter = maxDiameter * Math.sqrt(Math.max(value, 0) / maxValue);
    return Math.round(Math.max(minDiameter, proportionalDiameter));
  }

  const sizes = displayed.map((story) => sizeFor(metricValue(story, metric)));
  const positions = useMemo(
    () => packRandomly(displayed, sizes, metric),
    [displayed, metric, sizes.join(",")]
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
            const size = sizes[storyIndex];
            const position = positions[storyIndex];
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
                    const orbit = size / 2 + 22;
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
