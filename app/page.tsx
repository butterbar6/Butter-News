import { supabase } from "../lib/supabase";
import StoryBubbles, { type BubbleStory } from "../components/StoryBubbles";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { data, error } = await supabase
    .from("stories")
    .select(`
      id,
      title,
      summary,
      importance_score,
      story_metrics(metric_type, metric_value),
      story_items(
        items(
          id,
          title,
          url,
          published_at,
          sources(name)
        )
      )
    `)
    .order("importance_score", { ascending: false })
    .limit(50);

  const stories = (data ?? []) as unknown as BubbleStory[];

  return (
    <main>
      <header className="hero heroCompact">
        <div>
          <p className="eyebrow">BUTTER NEWS · VISUALIZATION V1</p>
          <h1>See the shape of the news.</h1>
          <p className="tagline">Each bubble is a story. Size it by exposure, momentum, coverage, or importance.</p>
        </div>
        <span className="status">{error ? "Connection issue" : "Live from Supabase"}</span>
      </header>

      {error ? (
        <section className="panel errorBox">
          <strong>Supabase query failed.</strong>
          <p>{error.message}</p>
        </section>
      ) : stories.length === 0 ? (
        <section className="panel emptyBox">Connected, but no stories were returned.</section>
      ) : (
        <StoryBubbles stories={stories} />
      )}

      <footer>Butter News · Bubble visualization prototype</footer>
    </main>
  );
}
