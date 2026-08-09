"use client";

import { useMemo, useState } from "react";

type Metric = { metric_type: string; metric_value: number };
type Source = { name: string } | { name: string }[] | null;
type Item = {
  id: string;
  title: string;
  url: string;
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

const metricLabels: Record<MetricKey, string> = {
  exposure_score: "Exposure",
  momentum: "Momentum",
  article_count: "Article count",
  source_count: "Source count",
  importance_score: "Importance",
};

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

function storyImage(story: BubbleStory) {
  return flattenItems(story).find((item) => item.image_url)?.image_url ?? fallbackImage(story.id);
}

export default function StoryBubbles({ stories }: { stories: BubbleStory[] }) {
  const [metric, setMetric] = useState<MetricKey>("exposure_score");
  const [limit, setLimit] = useState(Math.min(10, Math.max(1, stories.length)));
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const displayed = useMemo(
    () => [...stories].sort((a, b) => metricValue(b, metric) - metricValue(a, metric)).slice(0, limit),
    [stories, metric, limit]
  );

  const values = displayed.map((story) => metricValue(story, metric));
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  const selected = selectedId ? stories.find((story) => story.id === selectedId) ?? null : null;
  const selectedItems = selected ? flattenItems(selected) : [];

  function sizeFor(value: number) {
    const normalized = max === min ? 0.65 : (value - min) / (max - min);
    return Math.round(130 + Math.sqrt(Math.max(0, normalized)) * 155);
  }

  return (
    <div className="visualizerShell">
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
            {Array.from({ length: stories.length }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>

        <label>
          <span>Visualization</span>
          <select value="bubble_graph" onChange={() => {}}>
            <option value="bubble_graph">Bubble graph</option>
          </select>
        </label>
      </div>

      {!selected ? (
        <section className="bubbleStage overviewStage" aria-label="Story bubble visualization">
          {displayed.map((story) => {
            const value = metricValue(story, metric);
            const size = sizeFor(value);
            const image = storyImage(story);

            return (
              <button
                key={story.id}
                className="storyBubble imageBubble"
                style={{
                  width: size,
                  height: size,
                  backgroundImage: `linear-gradient(rgba(0,0,0,.48), rgba(0,0,0,.68)), url(${image})`,
                }}
                onClick={() => setSelectedId(story.id)}
                aria-label={`Open ${story.title}`}
              >
                <span className="bubbleMetric">{metricLabels[metric]} {value}</span>
                <strong>{story.title}</strong>
                {story.summary && <small>{story.summary}</small>}
              </button>
            );
          })}
        </section>
      ) : (
        <section className="focusStage" aria-label="Selected story and associated articles">
          <button className="backButton" onClick={() => setSelectedId(null)}>← All stories</button>

          <div className="focusCluster">
            <div
              className="storyBubble focusMainBubble"
              style={{
                backgroundImage: `linear-gradient(rgba(0,0,0,.48), rgba(0,0,0,.7)), url(${storyImage(selected)})`,
              }}
            >
              <span className="bubbleMetric">{metricLabels[metric]} {metricValue(selected, metric)}</span>
              <strong>{selected.title}</strong>
              {selected.summary && <small>{selected.summary}</small>}
            </div>

            <div className="subBubbleOrbit">
              {selectedItems.map((item, index) => {
                const image = item.image_url ?? fallbackImage(item.id);
                return (
                  <a
                    key={item.id}
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className={`subBubble subBubble-${index % 8}`}
                    title={item.title}
                    aria-label={`Open article: ${item.title}`}
                    style={{ backgroundImage: `linear-gradient(rgba(0,0,0,.12), rgba(0,0,0,.2)), url(${image})` }}
                  />
                );
              })}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
