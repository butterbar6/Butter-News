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
type RadialLayout = { positions: PackedPosition[]; sizes: number[]; satelliteAngles: number[][] };
type FocusPlacement = { x: number; y: number; ring: number };
type FocusLayout = { placements: FocusPlacement[]; ringRadii: number[]; bubbleSize: number; centerSize: number };

const metricLabels: Record<MetricKey, string> = {
  exposure_score: "Exposure",
  momentum: "Momentum",
  article_count: "Article count",
  source_count: "Source count",
  importance_score: "Importance",
};

function customItem(id: string, title: string, seed: string, content: string): Item {
  return { id, title, url: "#", content, author: "Butter News Demo", published_at: null, image_url: `https://picsum.photos/seed/${seed}/500/300`, sources: { name: "Custom Feed" } };
}

const customTopics: CustomTopic[] = [
  { name: "Australian Rugby", items: [
    customItem("custom-rugby-1", "Wallabies reshape squad ahead of next test window", "australia-rugby-1", "Prototype custom-topic article for the future user-selected niche news system."),
    customItem("custom-rugby-2", "Super Rugby clubs prepare for late-season push", "australia-rugby-2", "Prototype custom-topic article for the future user-selected niche news system."),
    customItem("custom-rugby-3", "Rugby Australia reviews development pipeline", "australia-rugby-3", "Prototype custom-topic article for the future user-selected niche news system."),
    customItem("custom-rugby-4", "Australian clubs track emerging academy talent", "australia-rugby-4", "Prototype custom-topic article for the future user-selected niche news system."),
  ]},
  { name: "Aerospace Startups", items: [
    customItem("custom-aero-1", "Small aerospace firms compete for new funding rounds", "aerospace-startup-1", "Prototype niche-feed article that will later come from Supabase."),
    customItem("custom-aero-2", "Advanced propulsion startups expand testing programs", "aerospace-startup-2", "Prototype niche-feed article that will later come from Supabase."),
    customItem("custom-aero-3", "New launch suppliers target commercial contracts", "aerospace-startup-3", "Prototype niche-feed article that will later come from Supabase."),
    customItem("custom-aero-4", "Space manufacturing founders pursue fresh capital", "aerospace-startup-4", "Prototype niche-feed article that will later come from Supabase."),
  ]},
  { name: "Sacramento Growth", items: [
    customItem("custom-sac-1", "Regional development projects move into new phases", "sacramento-growth-1", "Prototype local custom-topic article for Butter News."),
    customItem("custom-sac-2", "New investment targets transportation and housing", "sacramento-growth-2", "Prototype local custom-topic article for Butter News."),
    customItem("custom-sac-3", "Downtown projects bring new commercial activity", "sacramento-growth-3", "Prototype local custom-topic article for Butter News."),
    customItem("custom-sac-4", "Regional employers expand across the capital area", "sacramento-growth-4", "Prototype local custom-topic article for Butter News."),
  ]},
];
void customTopics;

function metricValue(story: BubbleStory, metric: MetricKey) {
  if (metric === "importance_score") return Number(story.importance_score ?? 0);
  return Number(story.story_metrics?.find((m) => m.metric_type === metric)?.metric_value ?? 0);
}

function flattenItems(story: BubbleStory) {
  return [...(story.story_items ?? [])]
    .sort((a, b) => Number(b.relevance_score ?? 0) - Number(a.relevance_score ?? 0))
    .flatMap((row) => !row.items ? [] : Array.isArray(row.items) ? row.items : [row.items]);
}

function fallbackImage(seed: string) { return `https://picsum.photos/seed/${encodeURIComponent(seed)}/800/800`; }
function storyImage(story: BubbleStory) { const first = flattenItems(story)[0]; return first?.image_url ?? fallbackImage(`story-${story.id}`); }
function sourceName(source: Source) { if (!source) return "Source"; if (Array.isArray(source)) return source[0]?.name ?? "Source"; return source.name; }

function shortTopic(title: string) {
  const cleaned = title
    .replace(/Major /gi, "").replace(/New /gi, "").replace(/Across the /gi, "").replace(/Across /gi, "")
    .replace(/Following /gi, "").replace(/Continues? to /gi, "").replace(/Industry /gi, "").replace(/Sector /gi, "")
    .replace(/Development /gi, "").replace(/Program /gi, "").replace(/Announces? /gi, "").replace(/Expands? /gi, "")
    .replace(/Accelerates? /gi, "").replace(/React(s|ing)? to /gi, "").trim();
  return cleaned.split(/\s+/).filter(Boolean).slice(0, 3).join(" ");
}

function topicForSize(title: string, size: number) {
  const words = shortTopic(title).split(/\s+/).filter(Boolean);
  const count = size < 105 ? 1 : size < 145 ? 2 : 3;
  return words.slice(0, count).join(" ");
}

function hashString(value: string) { let hash = 2166136261; for (let i = 0; i < value.length; i += 1) { hash ^= value.charCodeAt(i); hash = Math.imul(hash, 16777619); } return hash >>> 0; }
function seededRandom(seed: number) { let state = seed || 1; return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; }; }
function normalizeAngle(angle: number) { const full = Math.PI * 2; return ((angle % full) + full) % full; }

function circleHitsRect(cx: number, cy: number, radius: number, left: number, top: number, width: number, height: number) {
  const nearestX = Math.max(left, Math.min(cx, left + width));
  const nearestY = Math.max(top, Math.min(cy, top + height));
  return Math.hypot(cx - nearestX, cy - nearestY) < radius;
}

function rectsOverlap(a: { left: number; top: number; width: number; height: number }, b: { left: number; top: number; width: number; height: number }, gap = 2) {
  return !(a.left + a.width + gap <= b.left || b.left + b.width + gap <= a.left || a.top + a.height + gap <= b.top || b.top + b.height + gap <= a.top);
}

function centerGapAngles(outerAngles: number[]) {
  if (!outerAngles.length) return [-Math.PI / 2, Math.PI / 6, (5 * Math.PI) / 6];
  const sorted = outerAngles.map(normalizeAngle).sort((a, b) => a - b);
  const gaps = sorted.map((angle, index) => {
    const next = index === sorted.length - 1 ? sorted[0] + Math.PI * 2 : sorted[index + 1];
    return { size: next - angle, mid: normalizeAngle(angle + (next - angle) / 2) };
  }).sort((a, b) => b.size - a.size);
  const chosen = gaps.slice(0, 3).map((gap) => gap.mid);
  while (chosen.length < 3) chosen.push(normalizeAngle(chosen[0] + chosen.length * (Math.PI * 2 / 3)));
  return chosen;
}

function makeRadialLayout(stories: BubbleStory[], baseSizes: number[], metric: MetricKey, width: number, height: number): RadialLayout {
  const safeWidth = Math.max(520, width - 12);
  const safeHeight = Math.max(380, height - 12);
  const centerX = safeWidth / 2;
  const centerY = safeHeight / 2;
  const edgeGap = 8;
  const bubbleGap = 3;
  const satelliteRadius = 22;
  const labelWidth = 82;
  const labelHeight = 22;
  const labelGap = 4;

  if (stories.length === 0) return { positions: [], sizes: [], satelliteAngles: [] };
  if (stories.length === 1) {
    const size = Math.min(safeWidth * 0.48, safeHeight * 0.68, 520);
    return { positions: [{ left: 50, top: 50 }], sizes: [size], satelliteAngles: [[-Math.PI / 2, Math.PI / 6, (5 * Math.PI) / 6]] };
  }

  const outerIndices = Array.from({ length: stories.length - 1 }, (_, i) => i + 1);
  const random = seededRandom(hashString(`${metric}:${stories.map((story) => story.id).join("|")}`));
  for (let i = outerIndices.length - 1; i > 0; i -= 1) { const j = Math.floor(random() * (i + 1)); [outerIndices[i], outerIndices[j]] = [outerIndices[j], outerIndices[i]]; }
  const rotation = random() * Math.PI * 2;
  const outerAngles = outerIndices.map((_, slot) => rotation + (slot / outerIndices.length) * Math.PI * 2);
  const centerAngles = centerGapAngles(outerAngles);

  function buildAtScale(scale: number) {
    const sizes = baseSizes.map((size) => size * scale);
    const radii = sizes.map((size) => size / 2);
    const distances = outerIndices.map((storyIndex) => radii[0] + radii[storyIndex] + bubbleGap);

    for (let iteration = 0; iteration < 260; iteration += 1) {
      let changed = false;
      for (let a = 0; a < outerIndices.length; a += 1) {
        for (let b = a + 1; b < outerIndices.length; b += 1) {
          const indexA = outerIndices[a], indexB = outerIndices[b];
          const ax = Math.cos(outerAngles[a]) * distances[a], ay = Math.sin(outerAngles[a]) * distances[a];
          const bx = Math.cos(outerAngles[b]) * distances[b], by = Math.sin(outerAngles[b]) * distances[b];
          const actual = Math.hypot(ax - bx, ay - by);
          const required = radii[indexA] + radii[indexB] + bubbleGap;
          if (actual < required - 0.05) {
            const push = (required - actual) * 0.58 + 0.1;
            distances[a] += push;
            distances[b] += push;
            changed = true;
          }
        }
      }
      if (!changed) break;
    }

    const positionsPx = stories.map(() => ({ x: centerX, y: centerY }));
    outerIndices.forEach((storyIndex, slot) => { positionsPx[storyIndex] = { x: centerX + Math.cos(outerAngles[slot]) * distances[slot], y: centerY + Math.sin(outerAngles[slot]) * distances[slot] }; });

    const satelliteAngles = stories.map((_, storyIndex) => {
      if (storyIndex === 0) return centerAngles;
      const slot = outerIndices.indexOf(storyIndex);
      const base = outerAngles[Math.max(0, slot)];
      return [base - 0.58, base, base + 0.58];
    });

    let fits = true;
    for (let i = 0; i < positionsPx.length && fits; i += 1) {
      const p = positionsPx[i], r = radii[i];
      if (p.x - r < edgeGap || p.x + r > safeWidth - edgeGap || p.y - r < edgeGap || p.y + r > safeHeight - edgeGap) fits = false;
      for (let j = i + 1; j < positionsPx.length && fits; j += 1) {
        if (Math.hypot(p.x - positionsPx[j].x, p.y - positionsPx[j].y) < r + radii[j] + bubbleGap - 0.05) fits = false;
      }
    }

    const satelliteVisuals: { cx: number; cy: number; label: { left: number; top: number; width: number; height: number }; parent: number }[] = [];
    for (let storyIndex = 0; storyIndex < stories.length && fits; storyIndex += 1) {
      const parent = positionsPx[storyIndex];
      const orbit = radii[storyIndex] + 27;
      for (const angle of satelliteAngles[storyIndex]) {
        const cx = parent.x + Math.cos(angle) * orbit;
        const cy = parent.y + Math.sin(angle) * orbit;
        const label = { left: cx - labelWidth / 2, top: cy + satelliteRadius + labelGap, width: labelWidth, height: labelHeight };
        if (cx - satelliteRadius < edgeGap || cx + satelliteRadius > safeWidth - edgeGap || cy - satelliteRadius < edgeGap || label.left < edgeGap || label.left + label.width > safeWidth - edgeGap || label.top + label.height > safeHeight - edgeGap) { fits = false; break; }
        for (let other = 0; other < stories.length && fits; other += 1) {
          if (other === storyIndex) continue;
          const op = positionsPx[other];
          if (Math.hypot(cx - op.x, cy - op.y) < satelliteRadius + radii[other] + 2) fits = false;
          if (circleHitsRect(op.x, op.y, radii[other] + 2, label.left, label.top, label.width, label.height)) fits = false;
        }
        for (const prior of satelliteVisuals) {
          if (!fits) break;
          if (Math.hypot(cx - prior.cx, cy - prior.cy) < satelliteRadius * 2 + 2) fits = false;
          if (rectsOverlap(label, prior.label, 2)) fits = false;
          if (circleHitsRect(cx, cy, satelliteRadius + 1, prior.label.left, prior.label.top, prior.label.width, prior.label.height)) fits = false;
          if (circleHitsRect(prior.cx, prior.cy, satelliteRadius + 1, label.left, label.top, label.width, label.height)) fits = false;
        }
        satelliteVisuals.push({ cx, cy, label, parent: storyIndex });
      }
    }

    return { sizes, positionsPx, satelliteAngles, fits };
  }

  let low = 0.08;
  let best = buildAtScale(low);
  let high = 7;
  for (let iteration = 0; iteration < 46; iteration += 1) {
    const mid = (low + high) / 2;
    const candidate = buildAtScale(mid);
    if (candidate.fits) { best = candidate; low = mid; } else high = mid;
  }

  return {
    sizes: best.sizes.map((size) => Math.round(size)),
    positions: best.positionsPx.map((position) => ({ left: (position.x / safeWidth) * 100, top: (position.y / safeHeight) * 100 })),
    satelliteAngles: best.satelliteAngles,
  };
}

function buildFocusCandidate(count: number, availableWidth: number, availableHeight: number, bubbleSize: number) {
  const titleWidth = Math.max(44, Math.min(122, bubbleSize * 1.55));
  const titleHeight = bubbleSize < 36 ? 16 : bubbleSize < 54 ? 20 : 24;
  const footprintWidth = Math.max(bubbleSize, titleWidth) + 6;
  const footprintHeight = bubbleSize + titleHeight + 9;
  const centerSize = Math.max(100, Math.min(300, bubbleSize * (count <= 10 ? 2.55 : count <= 30 ? 2.35 : count <= 60 ? 2.1 : 1.9)));
  const maxRadius = Math.min(availableWidth / 2 - footprintWidth / 2 - 12, availableHeight / 2 - footprintHeight / 2 - 12);
  const firstRadius = centerSize / 2 + footprintHeight / 2 + 8;
  const step = footprintHeight + 5;
  if (maxRadius < firstRadius) return null;

  const ringRadii: number[] = [];
  const ringCaps: number[] = [];
  for (let radius = firstRadius; radius <= maxRadius + 0.5; radius += step) {
    const circumferenceCapacity = Math.floor((Math.PI * 2 * radius) / footprintWidth * 0.9);
    const cap = Math.max(6, circumferenceCapacity);
    ringRadii.push(radius);
    ringCaps.push(cap);
  }
  const totalCapacity = ringCaps.reduce((sum, value) => sum + value, 0);
  if (totalCapacity < count) return null;
  return { ringRadii, ringCaps, centerSize };
}

function makeFocusLayout(total: number, availableWidth: number, availableHeight: number): FocusLayout {
  const count = Math.max(1, Math.min(total, 100));
  let low = 20;
  let high = 124;
  let bestSize = low;
  let best = buildFocusCandidate(count, availableWidth, availableHeight, low);

  for (let iteration = 0; iteration < 34; iteration += 1) {
    const mid = (low + high) / 2;
    const candidate = buildFocusCandidate(count, availableWidth, availableHeight, mid);
    if (candidate) { best = candidate; bestSize = mid; low = mid; } else high = mid;
  }

  if (!best) {
    bestSize = 18;
    best = buildFocusCandidate(count, availableWidth, availableHeight, bestSize) ?? { ringRadii: [Math.min(availableWidth, availableHeight) * 0.32], ringCaps: [count], centerSize: 92 };
  }

  const placements: FocusPlacement[] = [];
  let itemIndex = 0;
  for (let ring = 0; ring < best.ringRadii.length && itemIndex < count; ring += 1) {
    const remaining = count - itemIndex;
    const ringItems = Math.min(best.ringCaps[ring], remaining);
    const rotation = -Math.PI / 2 + (ring % 2) * (Math.PI / Math.max(ringItems, 1));
    for (let slot = 0; slot < ringItems; slot += 1) {
      const angle = rotation + (slot / ringItems) * Math.PI * 2;
      placements.push({ x: Math.cos(angle) * best.ringRadii[ring], y: Math.sin(angle) * best.ringRadii[ring], ring });
      itemIndex += 1;
    }
  }

  return { placements, ringRadii: best.ringRadii.slice(0, Math.max(1, placements.length ? placements[placements.length - 1].ring + 1 : 1)), bubbleSize: Math.floor(bestSize), centerSize: Math.floor(best.centerSize) };
}

export default function StoryBubbles({ stories }: { stories: BubbleStory[] }) {
  const [metric, setMetric] = useState<MetricKey>("exposure_score");
  const [limit, setLimit] = useState(Math.min(10, Math.max(1, stories.length)));
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null);
  const [openItem, setOpenItem] = useState<Item | null>(null);
  const [viewedArticleIds, setViewedArticleIds] = useState<Set<string>>(() => new Set());
  const [focusLevel, setFocusLevel] = useState(1);
  const [viewport, setViewport] = useState({ width: 1480, height: 640 });

  useEffect(() => { const measure = () => setViewport({ width: window.innerWidth, height: Math.max(380, window.innerHeight - 112) }); measure(); window.addEventListener("resize", measure); return () => window.removeEventListener("resize", measure); }, []);

  function openArticle(item: Item) { setViewedArticleIds((current) => { const next = new Set(current); next.add(item.id); return next; }); setOpenItem(item); }

  const articlePanelWidth = openItem ? Math.round(Math.min(460, Math.max(320, viewport.width * 0.30))) : 0;
  const stageWidth = Math.max(520, viewport.width - articlePanelWidth);
  const displayed = useMemo(() => [...stories].sort((a, b) => metricValue(b, metric) - metricValue(a, metric)).slice(0, Math.min(limit, 10)), [stories, metric, limit]);
  const selectedStory = selectedStoryId ? stories.find((story) => story.id === selectedStoryId) ?? null : null;
  const maxValue = Math.max(...displayed.map((story) => metricValue(story, metric)), 1);
  const baseSizes = displayed.map((story) => 210 * Math.sqrt(Math.max(metricValue(story, metric), 1) / maxValue));
  const layout = useMemo(() => makeRadialLayout(displayed, baseSizes, metric, stageWidth, viewport.height), [displayed, metric, stageWidth, viewport.height, baseSizes.join(",")]);

  const controls = <div className="controlBar"><label><span>Size bubbles by</span><select value={metric} onChange={(e) => setMetric(e.target.value as MetricKey)}>{Object.entries(metricLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label><span>Stories shown</span><select value={limit} onChange={(e) => setLimit(Number(e.target.value))}>{Array.from({ length: Math.min(10, stories.length) }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}</select></label></div>;

  const allFocusItems = selectedStory ? flattenItems(selectedStory).slice(0, 100) : [];
  const visibleFocusCount = Math.min(allFocusItems.length, 10 + (focusLevel - 1) * 10);
  const focusItems = allFocusItems.slice(0, visibleFocusCount);
  const focusTitle = selectedStory ? shortTopic(selectedStory.title) : "";
  const focusLayout = makeFocusLayout(focusItems.length, stageWidth * 0.97, viewport.height * 0.97);
  const stageStyle = articlePanelWidth ? { marginLeft: articlePanelWidth, width: `calc(100% - ${articlePanelWidth}px)` } : undefined;

  return (
    <div className="visualizerShell">
      <header className="brandBanner"><div className="bannerSilhouette bannerSilhouetteLeft" aria-hidden="true" /><div className="brandCopy"><h1>BUTTER NEWS</h1><p>Sacramento - San Jose - San Francisco</p></div><div className="bannerSilhouette bannerSilhouetteRight" aria-hidden="true" /></header>
      {controls}

      {!selectedStory ? (
        <div className={styles.overviewSplit}>
          <section className="bubbleStage circularStage overviewView" aria-label="Story bubble visualization" style={stageStyle}>
            {displayed.map((story, storyIndex) => {
              const value = metricValue(story, metric), size = layout.sizes[storyIndex], position = layout.positions[storyIndex];
              const items = flattenItems(story).slice(0, 3);
              const topicFont = Math.max(16, Math.min(40, size * 0.17));
              const metricFont = Math.max(8, Math.min(13, size * 0.052));
              const mainImage = storyImage(story);

              return (
                <div key={story.id} className="storyCluster overviewCluster" style={{ left: `${position.left}%`, top: `${position.top}%`, width: size, height: size }}>
                  <button type="button" className={`storyBubble mainBubbleButton ${styles.photoMainBubble}`} onClick={() => { setSelectedStoryId(story.id); setFocusLevel(1); }} aria-label={`Open story: ${story.title}`} style={{ width: size, height: size, backgroundImage: `url(${mainImage})`, padding: Math.max(6, size * 0.055) }}>
                    <strong className={styles.mainTopicText} style={{ fontSize: topicFont }}>{topicForSize(story.title, size)}</strong>
                    <span className={`bubbleMetric ${styles.mainMetricText}`} style={{ fontSize: metricFont }}>{metricLabels[metric]} {value}</span>
                  </button>
                  <div className="decorativeOrbit">
                    {items.map((item, itemIndex) => {
                      const angle = layout.satelliteAngles[storyIndex]?.[itemIndex] ?? (-Math.PI / 2 + itemIndex * Math.PI * 2 / 3);
                      const orbit = size / 2 + 27, left = size / 2 + Math.cos(angle) * orbit, top = size / 2 + Math.sin(angle) * orbit;
                      const itemImage = item.image_url ?? fallbackImage(item.id), viewed = viewedArticleIds.has(item.id);
                      return <button key={item.id} type="button" className={`subBubble subBubbleDecorative ${styles.overviewSatellite} ${styles.clickableOverviewSatellite}`} style={{ left, top, backgroundImage: `url(${itemImage})`, opacity: 1, filter: "none" }} onClick={(event) => { event.stopPropagation(); openArticle(item); }} aria-label={`Read article: ${item.title}`}><span className={`${styles.satelliteLabel} ${viewed ? styles.viewedLabel : styles.unreadLabel}`}>{item.title}</span></button>;
                    })}
                  </div>
                </div>
              );
            })}
          </section>
        </div>
      ) : (
        <section className="bubbleStage focusView" aria-label="Selected topic with related articles" style={stageStyle}>
          <button className="backButton" onClick={() => { setSelectedStoryId(null); setOpenItem(null); setFocusLevel(1); }}>← All stories</button>
          <div className="focusScene" style={{ width: Math.max(500, stageWidth * 0.97), height: "calc(100svh - 116px)", minHeight: 0 }}>
            {focusLayout.ringRadii.map((radius, ringIndex) => <div key={ringIndex} className="focusOrbitRing" style={{ width: radius * 2, height: radius * 2 }} />)}
            <button type="button" className={`storyBubble focusMainBubble ${styles.photoMainBubble}`} style={{ backgroundImage: `url(${storyImage(selectedStory)})`, width: focusLayout.centerSize, height: focusLayout.centerSize }} onClick={() => setFocusLevel((level) => Math.min(level + 1, 10))} aria-label="Show more related articles">
              <strong className={styles.focusMainTitle} style={{ fontSize: Math.max(24, Math.min(50, focusLayout.centerSize * 0.17)) }}>{focusTitle}</strong>
              <span className={`bubbleMetric ${styles.mainMetricText}`}>{metricLabels[metric]} {metricValue(selectedStory, metric)}</span>
              <span className={styles.moreHint}>{visibleFocusCount < allFocusItems.length ? `Click for more · ${visibleFocusCount}/${allFocusItems.length}` : `${allFocusItems.length} articles shown`}</span>
            </button>
            {focusItems.map((item, index) => {
              const placement = focusLayout.placements[index]; if (!placement) return null;
              const itemImage = item.image_url ?? fallbackImage(item.id), titleWidth = Math.max(44, Math.min(122, focusLayout.bubbleSize * 1.55)), titleFont = focusLayout.bubbleSize < 36 ? 5.5 : focusLayout.bubbleSize < 54 ? 6.5 : focusLayout.bubbleSize < 72 ? 7.5 : 9, viewed = viewedArticleIds.has(item.id);
              return <button key={item.id} type="button" className="subBubble focusSubBubble" onClick={() => openArticle(item)} style={{ width: focusLayout.bubbleSize, height: focusLayout.bubbleSize, marginLeft: -focusLayout.bubbleSize / 2, marginTop: -focusLayout.bubbleSize / 2, left: `calc(50% + ${placement.x}px)`, top: `calc(50% + ${placement.y}px)`, padding: 3, backgroundImage: `url(${itemImage})`, opacity: 1, filter: "none" }} aria-label={`Read article ${index + 1}: ${item.title}`}><span className={styles.focusArticleNumber}>{index + 1}</span><span className={`${styles.focusArticleTitle} ${viewed ? styles.viewedLabel : styles.unreadLabel}`} style={{ width: titleWidth, fontSize: titleFont }}>{item.title}</span></button>;
            })}
          </div>
        </section>
      )}

      {openItem && <div className="articleModalBackdrop articleReaderDock" role="presentation" style={{ width: articlePanelWidth }}><article className="articleModal" role="dialog" aria-modal="false" aria-label={openItem.title} onClick={(e) => e.stopPropagation()}><button className="modalClose" onClick={() => setOpenItem(null)} aria-label="Close article">×</button><div className="articleHero" style={{ backgroundImage: `url(${openItem.image_url ?? fallbackImage(openItem.id)})` }} /><div className="articleModalBody"><p className="articleMeta">{sourceName(openItem.sources)}{openItem.author ? ` · ${openItem.author}` : ""}{openItem.published_at ? ` · ${new Date(openItem.published_at).toLocaleString()}` : ""}</p><h2>{openItem.title}</h2><div className="articleText">{openItem.content ? openItem.content.split("\n").filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>) : <p>This test article does not yet contain a full article body. When real article content is ingested into Supabase, it will appear here without redirecting away from Butter News.</p>}</div></div></article></div>}
    </div>
  );
}
