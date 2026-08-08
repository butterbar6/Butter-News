import { supabase } from "../lib/supabase";

export const dynamic = "force-dynamic";

type Story = {
  id: string;
  title: string;
  summary: string | null;
  importance_score: number;
};

export default async function Home() {
  const { data, error } = await supabase
    .from("stories")
    .select("id,title,summary,importance_score")
    .order("importance_score", { ascending: false })
    .limit(10);

  const stories = (data ?? []) as Story[];

  return (
    <main>
      <header className="hero">
        <p className="eyebrow">INITIAL CONNECTION TEST</p>
        <h1>Butter News</h1>
        <p className="tagline">Visualize the news.</p>
      </header>

      <section className="panel">
        <div className="panelHeading">
          <div>
            <h2>Top stories</h2>
            <p>Live test data from your Supabase database.</p>
          </div>
          <span className="status">{error ? "Connection issue" : "Supabase connected"}</span>
        </div>

        {error ? (
          <div className="errorBox">
            <strong>Supabase query failed.</strong>
            <p>{error.message}</p>
          </div>
        ) : stories.length === 0 ? (
          <div className="emptyBox">Connected, but no stories were returned.</div>
        ) : (
          <div className="storyGrid">
            {stories.map((story, index) => (
              <article className="storyCard" key={story.id}>
                <div className="rank">{String(index + 1).padStart(2, "0")}</div>
                <div className="storyContent">
                  <h3>{story.title}</h3>
                  {story.summary && <p>{story.summary}</p>}
                </div>
                <div className="score">
                  <span>{story.importance_score}</span>
                  <small>importance</small>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <footer>
        First milestone: GitHub → Vercel → Supabase
      </footer>
    </main>
  );
}
