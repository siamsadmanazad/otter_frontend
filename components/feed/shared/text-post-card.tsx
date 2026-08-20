"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowBigUp, MapPin, MessageCircle } from "lucide-react";

import { Card } from "@/components/ui/card";
import { IPostProps } from "@/types/post";

/**
 * feed_genres.md Phase 9.1 — "do no harm" on web.
 *
 * A POST-genre row is title-led and may carry NO image at all (§1.2/§1.4),
 * so the photo-first card every web surface ships today would render it as a
 * blank/misleading Moment. Until Phase 9.2+ brings voting, polls, claims and
 * the composer to web, every renderer switches on the genre and falls back to
 * this: an honest, minimal, READ-ONLY card.
 *
 * §1.5 Mechanism 1 (full-bleed Moment vs. inset Post) is respected in the one
 * way that costs nothing here: the Post never gets a hero image — no media
 * section is rendered at all — and the title, not a photo, is the loudest
 * thing on the card.
 *
 * Deliberately NOT here (later phases): vote buttons (9.2), poll/claim strips
 * (9.3), any write path (9.4). Score and comment count are plain text.
 */

/** True only for the new text genre. Legacy rows whose post_type was the old
 *  'POST' vocabulary were backfilled to 'MOMENT' server-side
 *  (20260820150000_post_genre_backfill.sql), so this can't catch a photo post. */
export function isTextPost(post: { postType?: string | null } | null | undefined) {
  return post?.postType === "POST";
}

const EXCERPT_LIMIT = 420;

export function TextPostCard({
  post,
  header,
  className,
}: {
  post: IPostProps;
  /** Owner block, supplied by the host so each surface keeps its own pattern. */
  header?: ReactNode;
  /** The host card's own shell classes, so this doesn't invent a new look. */
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);

  const body = post.caption ?? "";
  const isLong = body.length > EXCERPT_LIMIT;
  const excerpt =
    isLong && !expanded ? `${body.slice(0, EXCERPT_LIMIT).trimEnd()}…` : body;

  const score =
    typeof post.score === "number"
      ? post.score
      : (post.upvoteCount ?? 0) - (post.downvoteCount ?? 0);
  const commentCount =
    typeof post.commentCount === "number"
      ? post.commentCount
      : post.comments?.length ?? 0;

  const title = post.title?.trim();

  return (
    <Card key={post.id} className={className}>
      <div className="p-3 md:p-4">
        <div className="flex items-center justify-between gap-3">
          {header}
          <span className="shrink-0 rounded-full border border-gray-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:text-gray-400">
            Post
          </span>
        </div>

        <Link href={`/post/${post.id}`} className="mt-3 block">
          <h3 className="text-base md:text-lg font-semibold leading-snug text-gray-900 hover:underline dark:text-gray-100">
            {title || "Untitled post"}
          </h3>
        </Link>

        {body && (
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-700 dark:text-gray-300">
            {excerpt}
          </p>
        )}

        {isLong && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-1 text-xs font-medium text-gray-500 hover:underline dark:text-gray-400"
          >
            {expanded ? "Show less" : "Show more"}
          </button>
        )}

        {post.location && (
          <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300">
            <MapPin className="h-3 w-3" />
            {post.location}
          </div>
        )}

        {/* Read-only stats. Voting arrives in Phase 9.2 — these are not buttons. */}
        <div className="mt-3 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
          <span className="inline-flex items-center gap-1">
            <ArrowBigUp className="h-4 w-4" />
            {score.toLocaleString()}
          </span>
          <span className="inline-flex items-center gap-1">
            <MessageCircle className="h-4 w-4" />
            {commentCount.toLocaleString()}
          </span>
          <Link
            href={`/post/${post.id}`}
            className="ml-auto font-medium hover:underline"
          >
            Open discussion
          </Link>
        </div>
      </div>
    </Card>
  );
}
