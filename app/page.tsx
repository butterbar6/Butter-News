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
          image_url,
          sources(name)
        )
      )
    `)
    .order("importance_score", { ascending: false })
    .limit(50);

  const stories = (data ?? []) as unknown as BubbleStory[];

  return (
    <main>
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
    </main>
  );
}
