"use client";

import { useMemo, useState } from "react";

type Metric = { metric_type: string; metric_value: number };
type Source = { name: string } | { name: string }[] | null;
type Item = { id: string; title: string; url: string; published_at: string | null; sources: Source };
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

function sourceName(source: Source) {
  if (!source) return "Source";
  if (Array.isArray(source)) return source[0]?.name ?? "Source";
  return source.name;
}

function flattenItems(story: BubbleStory) {
  return (story.story_items ?? []).flatMap((row) => {
    if (!row.items) return [];
    return Array.isArray(row.items) ? row.items : [row.items];
  });
}

export default function StoryBubbles({ stories }: { stories: BubbleStory[] }) {
  const [metric, setMetric] = useState<MetricKey>("exposure_score");
  const [limit, setLimit] = useState(Math.min(10, Math.max(1, stories.length)));
  const [selectedId, setSelectedId] = useState<string | null>(stories[0]?.id ?? null);

  const displayed = useMemo(
    () => [...stories].sort((a, b) => metricValue(b, metric) - metricValue(a, metric)).slice(0, limit),
    [stories, metric, limit]
  );

  const values = displayed.map((story) => metricValue(story, metric));
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  const selected = stories.find((story) => story.id === selectedId) ?? displayed[0] ?? null;
  const selectedItems = selected ? flattenItems(selected) : [];

  function sizeFor(value: number) {
    const normalized = max === min ? 0.65 : (value - min) / (max - min);
    return Math.round(118 + Math.sqrt(Math.max(0, normalized)) * 145);
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

        <div className="controlReadout">
          <span>Visualization</span>
          <strong>Bubble graph</strong>
        </div>
      </div>

      <div className="visualizerGrid">
        <section className="bubbleStage" aria-label="Story bubble visualization">
          {displayed.map((story, index) => {
            const value = metricValue(story, metric);
            const size = sizeFor(value);
            return (
              <button
                key={story.id}
                className={`storyBubble bubble-${index % 5} ${selected?.id === story.id ? "selected" : ""}`}
                style={{ width: size, height: size }}
                onClick={() => setSelectedId(story.id)}
                aria-label={`Open ${story.title}`}
              >
                <span className="bubbleMetric">{metricLabels[metric]} {value}</span>
                <strong>{story.title}</strong>
              </button>
            );
          })}
        </section>

        <aside className="storyDrawer">
          {selected ? (
            <>
              <p className="drawerEyebrow">SELECTED STORY</p>
              <h2>{selected.title}</h2>
              {selected.summary && <p className="drawerSummary">{selected.summary}</p>}

              <div className="metricStrip">
                <div><strong>{metricValue(selected, "exposure_score")}</strong><span>Exposure</span></div>
                <div><strong>{metricValue(selected, "momentum")}</strong><span>Momentum</span></div>
                <div><strong>{metricValue(selected, "article_count")}</strong><span>Coverage</span></div>
              </div>

              <div className="articleHeading">
                <h3>Associated articles</h3>
                <span>{selectedItems.length}</span>
              </div>

              <div className="articleList">
                {selectedItems.length ? selectedItems.map((item) => (
                  <a key={item.id} href={item.url} target="_blank" rel="noreferrer" className="articleLink">
                    <span>{sourceName(item.sources)}</span>
                    <strong>{item.title}</strong>
                    <small>{item.published_at ? new Date(item.published_at).toLocaleString() : "Test article"}</small>
                  </a>
                )) : <p className="noArticles">No associated articles found.</p>}
              </div>
            </>
          ) : <p>Select a story bubble.</p>}
        </aside>
      </div>
    </div>
  );
}
