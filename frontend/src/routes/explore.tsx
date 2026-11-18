import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/explore")({
  component: ExplorePage,
});

// Placeholder until the explore page is designed.
function ExplorePage() {
  return (
    <section className="mx-auto w-full max-w-6xl flex-1 px-5 py-10 sm:px-8">
      <h1 className="text-3xl font-bold tracking-tight">Explore</h1>
      <p className="mt-4 text-muted-foreground">
        Placeholder explore page. Content coming soon.
      </p>
    </section>
  );
}
