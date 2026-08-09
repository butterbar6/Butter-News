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

function sourceName(source: Source) {
  if (!source) return "Source";
  if (Array.isArray(source)) return source[0]?.name ?? "Source";
  return source.name;
}

export default function StoryBubbles({ stories }: { stories: BubbleStory[] }) {
  const [metric, setMetric] = useState<MetricKey>("exposure_score");
  const [limit, setLimit] = useState(Math.min(10, Math.max(1, stories.length)));
  const [openItem, setOpenItem] = useState<Item | null>(null);

  const displayed = useMemo(
    () => [...stories].sort((a, b) => metricValue(b, metric) - metricValue(a, metric)).slice(0, limit),
    [stories, metric, limit]
  );

  const values = displayed.map((story) => metricValue(story, metric));
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;

  function sizeFor(value: number) {
    if (max === min) return 220;
    const normalized = Math.max(0, Math.min(1, (value - min) / (max - min)));
    return Math.round(145 + Math.sqrt(normalized) * 155);
  }

  function clusterPosition(index: number, count: number) {
    if (count === 1) return { left: 50, top: 50 };
    const angle = -Math.PI / 2 + (index / count) * Math.PI * 2;
    const radiusX = count <= 4 ? 27 : 32;
    const radiusY = count <= 4 ? 26 : 31;
    return {
      left: 50 + Math.cos(angle) * radiusX,
      top: 50 + Math.sin(angle) * radiusY,
    };
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

      <section className="bubbleStage circularStage" aria-label="Story bubble visualization">
        {displayed.map((story, storyIndex) => {
          const value = metricValue(story, metric);
          const size = sizeFor(value);
          const image = storyImage(story);
          const position = clusterPosition(storyIndex, displayed.length);
          const items = flattenItems(story).slice(0, 8);

          return (
            <div
              key={story.id}
              className="storyCluster"
              style={{
                left: `${position.left}%`,
                top: `${position.top}%`,
                width: size,
                height: size,
              }}
            >
              <div
                className="storyBubble imageBubble"
                style={{
                  width: size,
                  height: size,
                  backgroundImage: `linear-gradient(rgba(0,0,0,.48), rgba(0,0,0,.68)), url(${image})`,
                }}
              >
                <span className="bubbleMetric">{metricLabels[metric]} {value}</span>
                <strong>{story.title}</strong>
                {story.summary && <small>{story.summary}</small>}
              </div>

              {items.map((item, itemIndex) => {
                const angle = -Math.PI / 2 + (itemIndex / Math.max(items.length, 1)) * Math.PI * 2;
                const orbit = size / 2 + 40;
                const left = size / 2 + Math.cos(angle) * orbit;
                const top = size / 2 + Math.sin(angle) * orbit;
                const itemImage = item.image_url ?? fallbackImage(item.id);

                return (
                  <button
                    key={item.id}
                    type="button"
                    className="subBubble"
                    title={item.title}
                    aria-label={`Read article: ${item.title}`}
                    onClick={() => setOpenItem(item)}
                    style={{
                      left,
                      top,
                      backgroundImage: `linear-gradient(rgba(0,0,0,.12), rgba(0,0,0,.22)), url(${itemImage})`,
                    }}
                  />
                );
              })}
            </div>
          );
        })}
      </section>

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
                  <p>This test article does not yet contain a full article body. When real article content is ingested into Supabase, it will appear here without redirecting away from Butter News.</p>
                )}
              </div>
            </div>
          </article>
        </div>
      )}
    </div>
  );
}
