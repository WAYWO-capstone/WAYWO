import { ChevronRight, Heart, MessageCircle } from "lucide-react";
import type { ProjectUpdate } from "@/lib/api";
import { updateTypeStyles } from "@/components/projects/update-types";

function formatUpdateDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function UpdateItem({ update }: { update: ProjectUpdate }) {
  const type = updateTypeStyles[update.type];

  return (
    <li className="relative pb-8 pl-8 last:pb-2">
      <span
        aria-hidden="true"
        className={`absolute top-1 left-[11px] size-4 -translate-x-1/2 rounded-full border border-brand-mahogany ${type.className}`}
      />

      <article aria-labelledby={`update-${update.id}-title`}>
        <h3 id={`update-${update.id}-title`} className="text-xl font-semibold text-brand-garnet">
          {update.title}
        </h3>

        <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span className={`rounded-[7px] px-2.5 py-0.5 font-semibold text-brand-mahogany ${type.className}`}>
            {type.label}
          </span>
          <span className="text-brand-rust">
            {update.author.username} · <time dateTime={update.created_at}>{formatUpdateDate(update.created_at)}</time>
          </span>
          {!update.public && (
            <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">Private</span>
          )}
        </div>

        {update.body && (
          <p className="mt-1.5 text-sm leading-6 whitespace-pre-wrap text-foreground">
            {update.body}
          </p>
        )}

        {/* Placeholders until updates support images, likes and comments. */}
        <div aria-hidden="true" className="mt-2 flex flex-wrap gap-[19px]">
          {[0, 1, 2, 3].map((slot) => (
            <div key={slot} className="h-[86px] w-[90px] rounded-[20px] border border-brand-garnet bg-border" />
          ))}
        </div>

        <div className="mt-3.5 flex items-center gap-7 text-sm font-semibold text-brand-mahogany">
          <span className="flex items-center gap-1.5">
            <Heart className="size-[22px] text-brand-garnet" strokeWidth={2.5} aria-hidden="true" />
            Likes
          </span>
          <span className="flex items-center gap-1.5">
            <MessageCircle className="size-[22px]" aria-hidden="true" />
            <span className="underline decoration-1 underline-offset-[3px]">Comments</span>
            <ChevronRight className="-ml-1 size-4" aria-hidden="true" />
          </span>
        </div>
      </article>
    </li>
  );
}

export function UpdateTimeline({ updates }: { updates: ProjectUpdate[] }) {
  return (
    <div className="relative">
      <span aria-hidden="true" className="absolute top-3 bottom-0 left-[11px] w-px -translate-x-1/2 bg-brand-rust" />
      <ol className="relative">
        {updates.map((update) => (
          <UpdateItem key={update.id} update={update} />
        ))}
      </ol>
    </div>
  );
}
