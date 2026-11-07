import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/home")({
  component: HomePage,
});

// Placeholder until the home page is designed.
function HomePage() {
  return (
    <section className="mx-auto w-full max-w-6xl flex-1 px-5 py-10 sm:px-8">
      <h1 className="text-3xl font-bold tracking-tight">Home</h1>
      <p className="mt-4 text-muted-foreground">
        Placeholder home page. Content coming soon.
      </p>
    </section>
  );
}
