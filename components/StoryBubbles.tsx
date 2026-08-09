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
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null);
  const [openItem, setOpenItem] = useState<Item | null>(null);

  const displayed = useMemo(
    () => [...stories].sort((a, b) => metricValue(b, metric) - metricValue(a, metric)).slice(0, limit),
    [stories, metric, limit]
  );

  const selectedStory = selectedStoryId
    ? stories.find((story) => story.id === selectedStoryId) ?? null
    : null;

  const values = displayed.map((story) => metricValue(story, metric));
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;

  function sizeFor(value: number) {
    if (max === min) return 220;
    const normalized = Math.max(0, Math.min(1, (value - min) / (max - min)));
    return Math.round(150 + Math.sqrt(normalized) * 170);
  }

  function clusterPosition(index: number, count: number) {
    if (count === 1) return { left: 50, top: 50 };
    const angle = -Math.PI / 2 + (index / count) * Math.PI * 2;
    const radiusX = count <= 4 ? 26 : 33;
    const radiusY = count <= 4 ? 25 : 32;
    return {
      left: 50 + Math.cos(angle) * radiusX,
      top: 50 + Math.sin(angle) * radiusY,
    };
  }

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
  );

  return (
    <div className="visualizerShell">
      {controls}

      {!selectedStory ? (
        <section className="bubbleStage circularStage overviewView" aria-label="Story bubble visualization">
          {displayed.map((story, storyIndex) => {
            const value = metricValue(story, metric);
            const size = sizeFor(value);
            const image = storyImage(story);
            const position = clusterPosition(storyIndex, displayed.length);
            const items = flattenItems(story).slice(0, 8);

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
                  className="storyBubble imageBubble mainBubbleButton"
                  onClick={() => setSelectedStoryId(story.id)}
                  aria-label={`Open story: ${story.title}`}
                  style={{
                    width: size,
                    height: size,
                    backgroundImage: `linear-gradient(rgba(0,0,0,.46), rgba(0,0,0,.68)), url(${image})`,
                  }}
                >
                  <span className="bubbleMetric">{metricLabels[metric]} {value}</span>
                  <strong>{story.title}</strong>
                  {story.summary && <small>{story.summary}</small>}
                </button>

                <div className="decorativeOrbit" aria-hidden="true">
                  {items.map((item, itemIndex) => {
                    const angle = -Math.PI / 2 + (itemIndex / Math.max(items.length, 1)) * Math.PI * 2;
                    const orbit = size / 2 + 42;
                    const left = size / 2 + Math.cos(angle) * orbit;
                    const top = size / 2 + Math.sin(angle) * orbit;
                    const itemImage = item.image_url ?? fallbackImage(item.id);
                    return (
                      <span
                        key={item.id}
                        className="subBubble subBubbleDecorative"
                        style={{
                          left,
                          top,
                          backgroundImage: `linear-gradient(rgba(0,0,0,.08), rgba(0,0,0,.18)), url(${itemImage})`,
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
              className="storyBubble focusMainBubble"
              style={{
                backgroundImage: `linear-gradient(rgba(0,0,0,.46), rgba(0,0,0,.7)), url(${storyImage(selectedStory)})`,
              }}
            >
              <span className="bubbleMetric">{metricLabels[metric]} {metricValue(selectedStory, metric)}</span>
              <strong>{selectedStory.title}</strong>
              {selectedStory.summary && <small>{selectedStory.summary}</small>}
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
