import { Button } from "@/components/ui/button";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/")({
  component: RouteComponent,
});

function RouteComponent() {
  const [count, setCount] = useState<number>(0);

  return (
    <div>
      Hello index route!
      <Button onClick={() => setCount((prev) => prev + 1)}>
        Test button - increment
      </Button>
      <span>{count}</span>
    </div>
  );
}
