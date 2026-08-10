"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./StoryBubbles.module.css";

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
type StoryItem = { relevance_score?: number | null; items: Item | Item[] | null };
type CustomTopic = { name: string; items: Item[] };

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

type FocusPlacement = { x: number; y: number; ring: number };
type FocusLayout = {
  placements: FocusPlacement[];
  ringRadii: number[];
  bubbleSize: number;
  centerSize: number;
};

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

// Preserved prototype data for the saved "custom sidebar" feature.
function customItem(id: string, title: string, seed: string, content: string): Item {
  return {
    id,
    title,
    url: "#",
    content,
    author: "Butter News Demo",
    published_at: null,
    image_url: `https://picsum.photos/seed/${seed}/500/300`,
    sources: { name: "Custom Feed" },
  };
}

const customTopics: CustomTopic[] = [
  {
    name: "Australian Rugby",
    items: [
      customItem("custom-rugby-1", "Wallabies reshape squad ahead of next test window", "australia-rugby-1", "Prototype custom-topic article for the future user-selected niche news system."),
      customItem("custom-rugby-2", "Super Rugby clubs prepare for late-season push", "australia-rugby-2", "Prototype custom-topic article for the future user-selected niche news system."),
      customItem("custom-rugby-3", "Rugby Australia reviews development pipeline", "australia-rugby-3", "Prototype custom-topic article for the future user-selected niche news system."),
      customItem("custom-rugby-4", "Australian clubs track emerging academy talent", "australia-rugby-4", "Prototype custom-topic article for the future user-selected niche news system."),
    ],
  },
  {
    name: "Aerospace Startups",
    items: [
      customItem("custom-aero-1", "Small aerospace firms compete for new funding rounds", "aerospace-startup-1", "Prototype niche-feed article that will later come from Supabase."),
      customItem("custom-aero-2", "Advanced propulsion startups expand testing programs", "aerospace-startup-2", "Prototype niche-feed article that will later come from Supabase."),
      customItem("custom-aero-3", "New launch suppliers target commercial contracts", "aerospace-startup-3", "Prototype niche-feed article that will later come from Supabase."),
      customItem("custom-aero-4", "Space manufacturing founders pursue fresh capital", "aerospace-startup-4", "Prototype niche-feed article that will later come from Supabase."),
    ],
  },
  {
    name: "Sacramento Growth",
    items: [
      customItem("custom-sac-1", "Regional development projects move into new phases", "sacramento-growth-1", "Prototype local custom-topic article for Butter News."),
      customItem("custom-sac-2", "New investment targets transportation and housing", "sacramento-growth-2", "Prototype local custom-topic article for Butter News."),
      customItem("custom-sac-3", "Downtown projects bring new commercial activity", "sacramento-growth-3", "Prototype local custom-topic article for Butter News."),
      customItem("custom-sac-4", "Regional employers expand across the capital area", "sacramento-growth-4", "Prototype local custom-topic article for Butter News."),
    ],
  },
];
void customTopics;

function metricValue(story: BubbleStory, metric: MetricKey) {
  if (metric === "importance_score") return Number(story.importance_score ?? 0);
  return Number(story.story_metrics?.find((m) => m.metric_type === metric)?.metric_value ?? 0);
}

function flattenItems(story: BubbleStory) {
  return [...(story.story_items ?? [])]
    .sort((a, b) => Number(b.relevance_score ?? 0) - Number(a.relevance_score ?? 0))
    .flatMap((row) => {
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

function makeRadialLayout(
  stories: BubbleStory[],
  baseSizes: number[],
  metric: MetricKey,
  width: number,
  height: number
): RadialLayout {
  const safeWidth = Math.max(700, width - 18);
  const safeHeight = Math.max(420, height - 18);
  const centerX = safeWidth / 2;
  const centerY = safeHeight / 2;
  const edgeGap = 8;
  const bubbleGap = 3;

  if (stories.length === 0) return { positions: [], sizes: [] };
  if (stories.length === 1) {
    const size = Math.min(safeWidth * 0.44, safeHeight * 0.74, 560);
    return { positions: [{ left: 50, top: 50 }], sizes: [size] };
  }

  const outerIndices = Array.from({ length: stories.length - 1 }, (_, i) => i + 1);
  const random = seededRandom(hashString(`${metric}:${stories.map((story) => story.id).join("|")}`));
  for (let i = outerIndices.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [outerIndices[i], outerIndices[j]] = [outerIndices[j], outerIndices[i]];
  }

  const rotation = random() * Math.PI * 2;
  const angles = outerIndices.map((_, slot) => rotation + (slot / outerIndices.length) * Math.PI * 2);

  function buildAtScale(scale: number) {
    const sizes = baseSizes.map((size) => size * scale);
    const radii = sizes.map((size) => size / 2);
    const centerRadius = radii[0];
    const distances = outerIndices.map((storyIndex) => centerRadius + radii[storyIndex] + bubbleGap);

    for (let iteration = 0; iteration < 300; iteration += 1) {
      let changed = false;
      for (let a = 0; a < outerIndices.length; a += 1) {
        for (let b = a + 1; b < outerIndices.length; b += 1) {
          const indexA = outerIndices[a];
          const indexB = outerIndices[b];
          const ax = Math.cos(angles[a]) * distances[a];
          const ay = Math.sin(angles[a]) * distances[a];
          const bx = Math.cos(angles[b]) * distances[b];
          const by = Math.sin(angles[b]) * distances[b];
          const actual = Math.hypot(ax - bx, ay - by);
          const required = radii[indexA] + radii[indexB] + bubbleGap;
          if (actual < required - 0.05) {
            const push = (required - actual) * 0.58 + 0.15;
            distances[a] += push;
            distances[b] += push;
            changed = true;
          }
        }
      }
      if (!changed) break;
    }

    const positionsPx = stories.map(() => ({ x: centerX, y: centerY }));
    outerIndices.forEach((storyIndex, slot) => {
      positionsPx[storyIndex] = {
        x: centerX + Math.cos(angles[slot]) * distances[slot],
        y: centerY + Math.sin(angles[slot]) * distances[slot],
      };
    });

    let fits = true;
    for (let a = 0; a < positionsPx.length && fits; a += 1) {
      const pa = positionsPx[a];
      const ra = radii[a];
      if (pa.x - ra < edgeGap || pa.x + ra > safeWidth - edgeGap || pa.y - ra < edgeGap || pa.y + ra > safeHeight - edgeGap) {
        fits = false;
        break;
      }
      for (let b = a + 1; b < positionsPx.length; b += 1) {
        const pb = positionsPx[b];
        if (Math.hypot(pa.x - pb.x, pa.y - pb.y) < ra + radii[b] + bubbleGap - 0.05) {
          fits = false;
          break;
        }
      }
    }
    return { sizes, positionsPx, fits };
  }

  let low = 0.12;
  let best = buildAtScale(low);
  let high = 7;
  for (let iteration = 0; iteration < 46; iteration += 1) {
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
      left: (position.x / safeWidth) * 100,
      top: (position.y / safeHeight) * 100,
    })),
  };
}

function makeFocusLayout(total: number, availableWidth: number, availableHeight: number): FocusLayout {
  const count = Math.max(1, Math.min(total, 100));
  const minDimension = Math.max(360, Math.min(availableWidth, availableHeight));
  const maxRadius = Math.max(135, minDimension / 2 - 34);

  const ringCaps = [10, 16, 22, 26, 26];
  let ringCount = 1;
  let capacity = ringCaps[0];
  while (capacity < count && ringCount < ringCaps.length) {
    capacity += ringCaps[ringCount];
    ringCount += 1;
  }

  const bubbleSize = Math.max(34, Math.min(126,
    ringCount === 1 ? 126 :
    ringCount === 2 ? 94 :
    ringCount === 3 ? 68 :
    ringCount === 4 ? 52 : 40
  ));

  const centerSize = Math.max(145,
    ringCount === 1 ? 320 :
    ringCount === 2 ? 270 :
    ringCount === 3 ? 225 :
    ringCount === 4 ? 185 : 150
  );

  const firstRadius = Math.min(maxRadius, centerSize / 2 + bubbleSize / 2 + 12);
  const ringRadii = Array.from({ length: ringCount }, (_, ringIndex) => {
    if (ringCount === 1) return Math.min(maxRadius, Math.max(firstRadius, maxRadius * 0.72));
    return firstRadius + ((maxRadius - firstRadius) * ringIndex) / Math.max(ringCount - 1, 1);
  });

  const placements: FocusPlacement[] = [];
  let itemIndex = 0;
  for (let ring = 0; ring < ringCount && itemIndex < count; ring += 1) {
    const ringItems = Math.min(ringCaps[ring], count - itemIndex);
    const rotation = -Math.PI / 2 + (ring % 2) * (Math.PI / Math.max(ringItems, 1));
    for (let slot = 0; slot < ringItems; slot += 1) {
      const angle = rotation + (slot / Math.max(ringItems, 1)) * Math.PI * 2;
      placements.push({
        x: Math.cos(angle) * ringRadii[ring],
        y: Math.sin(angle) * ringRadii[ring],
        ring,
      });
      itemIndex += 1;
    }
  }

  return { placements, ringRadii, bubbleSize, centerSize };
}

export default function StoryBubbles({ stories }: { stories: BubbleStory[] }) {
  const [metric, setMetric] = useState<MetricKey>("exposure_score");
  const [limit, setLimit] = useState(Math.min(10, Math.max(1, stories.length)));
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null);
  const [openItem, setOpenItem] = useState<Item | null>(null);
  const [focusLevel, setFocusLevel] = useState(1);
  const [viewport, setViewport] = useState({ width: 1480, height: 640 });

  useEffect(() => {
    const measure = () => setViewport({
      width: window.innerWidth,
      height: Math.max(430, window.innerHeight - 112),
    });
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const displayed = useMemo(
    () => [...stories].sort((a, b) => metricValue(b, metric) - metricValue(a, metric)).slice(0, Math.min(limit, 10)),
    [stories, metric, limit]
  );

  const selectedStory = selectedStoryId ? stories.find((story) => story.id === selectedStoryId) ?? null : null;
  const maxValue = Math.max(...displayed.map((story) => metricValue(story, metric)), 1);

  const baseSizes = displayed.map((story) => 210 * Math.sqrt(Math.max(metricValue(story, metric), 1) / maxValue));
  const layout = useMemo(
    () => makeRadialLayout(displayed, baseSizes, metric, viewport.width, viewport.height),
    [displayed, metric, viewport.width, viewport.height, baseSizes.join(",")]
  );

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

  const allFocusItems = selectedStory ? flattenItems(selectedStory).slice(0, 100) : [];
  const visibleFocusCount = Math.min(allFocusItems.length, 10 + (focusLevel - 1) * 10);
  const focusItems = allFocusItems.slice(0, visibleFocusCount);
  const focusTitle = selectedStory ? shortTopic(selectedStory.title) : "";
  const focusColor = selectedStory
    ? bubbleColors[Math.max(0, stories.findIndex((s) => s.id === selectedStory.id)) % bubbleColors.length]
    : bubbleColors[0];
  const focusLayout = makeFocusLayout(focusItems.length, viewport.width * 0.96, viewport.height);

  return (
    <div className="visualizerShell">
      <header className="brandBanner">
        <div className="bannerSilhouette bannerSilhouetteLeft" aria-hidden="true" />
        <div className="brandCopy">
          <h1>BUTTER NEWS</h1>
          <p>Sacramento - San Jose - San Francisco</p>
        </div>
        <div className="bannerSilhouette bannerSilhouetteRight" aria-hidden="true" />
      </header>
      {controls}

      {!selectedStory ? (
        <div className={styles.overviewSplit}>
          <section className="bubbleStage circularStage overviewView" aria-label="Story bubble visualization">
            {displayed.map((story, storyIndex) => {
              const value = metricValue(story, metric);
              const size = layout.sizes[storyIndex];
              const position = layout.positions[storyIndex];
              const items = flattenItems(story).slice(0, 3);
              const bubbleColor = bubbleColors[storyIndex % bubbleColors.length];
              const topicFont = Math.max(10, Math.min(25, size * 0.1));
              const metricFont = Math.max(7, Math.min(12, size * 0.047));
              const dx = (position.left - 50) * viewport.width / 100;
              const dy = (position.top - 50) * viewport.height / 100;
              const outwardAngle = storyIndex === 0 ? -Math.PI / 2 : Math.atan2(dy, dx);

              return (
                <div key={story.id} className="storyCluster overviewCluster" style={{ left: `${position.left}%`, top: `${position.top}%`, width: size, height: size }}>
                  <button
                    type="button"
                    className="storyBubble mainBubbleButton solidBubble"
                    onClick={() => { setSelectedStoryId(story.id); setFocusLevel(1); }}
                    aria-label={`Open story: ${story.title}`}
                    style={{ width: size, height: size, backgroundColor: bubbleColor, padding: Math.max(8, size * 0.085) }}
                  >
                    <strong style={{ fontSize: topicFont }}>{topicForSize(story.title, size)}</strong>
                    <span className="bubbleMetric" style={{ fontSize: metricFont }}>{metricLabels[metric]} {value}</span>
                  </button>

                  <div className="decorativeOrbit">
                    {items.map((item, itemIndex) => {
                      const count = Math.max(items.length, 1);
                      const angle = storyIndex === 0
                        ? -Math.PI / 2 + (itemIndex / count) * Math.PI * 2
                        : outwardAngle - Math.PI / 2 + ((itemIndex + 0.5) / count) * Math.PI;
                      const orbit = size / 2 + 34;
                      const left = size / 2 + Math.cos(angle) * orbit;
                      const top = size / 2 + Math.sin(angle) * orbit;
                      const itemImage = item.image_url ?? fallbackImage(item.id);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          className={`subBubble subBubbleDecorative ${styles.overviewSatellite} ${styles.clickableOverviewSatellite}`}
                          style={{ left, top, backgroundImage: `url(${itemImage})` }}
                          onClick={(event) => { event.stopPropagation(); setOpenItem(item); }}
                          aria-label={`Read article: ${item.title}`}
                        >
                          <span className={styles.satelliteLabel}>{item.title}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </section>
        </div>
      ) : (
        <section className="bubbleStage focusView" aria-label="Selected topic with related articles">
          <button className="backButton" onClick={() => { setSelectedStoryId(null); setOpenItem(null); setFocusLevel(1); }}>← All stories</button>

          <div className="focusScene" style={{ width: "96vw", height: "calc(100svh - 120px)", minHeight: 0 }}>
            {focusLayout.ringRadii.map((radius, ringIndex) => (
              <div key={ringIndex} className="focusOrbitRing" style={{ width: radius * 2, height: radius * 2 }} />
            ))}

            <button
              type="button"
              className="storyBubble focusMainBubble solidBubble"
              style={{ backgroundColor: focusColor, width: focusLayout.centerSize, height: focusLayout.centerSize }}
              onClick={() => setFocusLevel((level) => Math.min(level + 1, 10))}
              aria-label="Show more related articles"
            >
              <strong>{focusTitle}</strong>
              <span className="bubbleMetric">{metricLabels[metric]} {metricValue(selectedStory, metric)}</span>
              <span className={styles.moreHint}>
                {visibleFocusCount < allFocusItems.length ? `Click for more · ${visibleFocusCount}/${allFocusItems.length}` : `${allFocusItems.length} articles shown`}
              </span>
            </button>

            {focusItems.map((item, index) => {
              const placement = focusLayout.placements[index];
              if (!placement) return null;
              const itemImage = item.image_url ?? fallbackImage(item.id);
              const compact = focusLayout.bubbleSize < 60;
              return (
                <button
                  key={item.id}
                  type="button"
                  className="subBubble focusSubBubble"
                  onClick={() => setOpenItem(item)}
                  style={{
                    width: focusLayout.bubbleSize,
                    height: focusLayout.bubbleSize,
                    marginLeft: -focusLayout.bubbleSize / 2,
                    marginTop: -focusLayout.bubbleSize / 2,
                    left: `calc(50% + ${placement.x}px)`,
                    top: `calc(50% + ${placement.y}px)`,
                    padding: compact ? 3 : 10,
                    backgroundImage: `linear-gradient(rgba(0,0,0,.24), rgba(0,0,0,.56)), url(${itemImage})`,
                  }}
                  aria-label={`Read article: ${item.title}`}
                >
                  {!compact && <span className={styles.focusArticleTitle}>{item.title}</span>}
                  <span className={styles.focusArticleLabel}>{compact ? `${index + 1}` : "ARTICLE"}</span>
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
                {openItem.content
                  ? openItem.content.split("\n").filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)
                  : <p>This test article does not yet contain a full article body. When real article content is ingested into Supabase, it will appear here without redirecting away from Butter News.</p>}
              </div>
            </div>
          </article>
        </div>
      )}
    </div>
  );
}
