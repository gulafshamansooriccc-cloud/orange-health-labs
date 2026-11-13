import { Bookmark, Heart, MessageSquare, Share2, Trash2 } from 'lucide-react';
import { formatRelativeTime } from '../lib/api.ts';
import type { FeedPost } from '../types.ts';
import { MemberAvatar, ResilientImage } from './Media.tsx';

interface PostCardProps {
  post: FeedPost;
  currentUserId: string | null;
  onOpenPost: (postId: string) => void;
  onSelectAuthor: (authorId: string) => void;
  onSelectCircle: (circleId: string) => void;
  onToggleLike: (postId: string) => void;
  onToggleBookmark: (postId: string) => void;
  onDeletePost: (postId: string) => void;
  onSharePost: (post: FeedPost) => void;
}

export function PostCard({
  post,
  currentUserId,
  onOpenPost,
  onSelectAuthor,
  onSelectCircle,
  onToggleLike,
  onToggleBookmark,
  onDeletePost,
  onSharePost,
}: PostCardProps) {
  const isOwner = currentUserId === post.authorId;
  const paragraphs = post.body.split('\n\n').filter(Boolean);
  const previewText = paragraphs[0] ?? post.body;
  const hasMore = paragraphs.length > 1 || post.body.length > 280;

  return (
    <article className="bg-white dark:bg-neutral-900/80 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 transition-colors duration-150 hover:border-neutral-300 dark:hover:border-neutral-700">
      {/* Author header + unboxed inline metadata */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => onSelectAuthor(post.authorId)}
            className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            aria-label={`View profile of ${post.authorName}`}
          >
            <MemberAvatar name={post.authorName} avatarUrl={post.authorAvatar} size="md" />
          </button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <button
                type="button"
                onClick={() => onSelectAuthor(post.authorId)}
                className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded"
              >
                {post.authorName}
              </button>
              <span className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                @{post.authorHandle}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              <button
                type="button"
                onClick={() => onSelectCircle(post.circleId)}
                className="font-medium text-neutral-700 dark:text-neutral-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                {post.circleName}
              </button>
              <span aria-hidden="true">·</span>
              <time dateTime={post.createdAt} className="font-mono tabular-nums">
                {formatRelativeTime(post.createdAt)}
              </time>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">{post.readMinutes} min read</span>
            </div>
          </div>
        </div>

        {isOwner && (
          <button
            type="button"
            onClick={() => onDeletePost(post.id)}
            title="Delete post"
            aria-label="Delete post"
            className="p-2 text-neutral-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            <Trash2 className="w-4 h-4" strokeWidth={1.75} />
          </button>
        )}
      </div>

      {/* Main post content */}
      <div className="mt-4">
        <button
          type="button"
          onClick={() => onOpenPost(post.id)}
          className="text-left w-full group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded-lg"
        >
          <h2 className="font-display text-xl font-semibold tracking-tight text-neutral-950 dark:text-white leading-snug text-balance group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            {post.title}
          </h2>
          <p className="mt-2.5 text-[15px] leading-relaxed text-neutral-600 dark:text-neutral-300 max-w-[65ch] line-clamp-4">
            {previewText}
          </p>
          {hasMore && (
            <span className="inline-block mt-2 text-xs font-medium text-blue-600 dark:text-blue-400">
              Read full note
            </span>
          )}
        </button>

        {post.imageUrl && (
          <button
            type="button"
            onClick={() => onOpenPost(post.id)}
            className="mt-4 block w-full overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            <ResilientImage
              src={post.imageUrl}
              alt={post.title}
              className="w-full aspect-video object-cover transition-transform duration-200 hover:scale-[1.01]"
            />
          </button>
        )}
      </div>

      {/* Action bar */}
      <div className="mt-5 pt-3.5 border-t border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onToggleLike(post.id)}
            aria-pressed={post.isLiked}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
              post.isLiked
                ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50'
                : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800/70'
            }`}
          >
            <Heart
              className="w-4 h-4"
              strokeWidth={1.75}
              fill={post.isLiked ? 'currentColor' : 'none'}
            />
            <span className="font-mono tabular-nums">{post.likesCount}</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenPost(post.id)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800/70 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            <MessageSquare className="w-4 h-4" strokeWidth={1.75} />
            <span className="font-mono tabular-nums">{post.commentsCount}</span>
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onToggleBookmark(post.id)}
            aria-pressed={post.isBookmarked}
            aria-label={post.isBookmarked ? 'Remove bookmark' : 'Bookmark post'}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
              post.isBookmarked
                ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50'
                : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800/70'
            }`}
          >
            <Bookmark
              className="w-4 h-4"
              strokeWidth={1.75}
              fill={post.isBookmarked ? 'currentColor' : 'none'}
            />
            <span className="hidden sm:inline">{post.isBookmarked ? 'Saved' : 'Save'}</span>
          </button>

          <button
            type="button"
            onClick={() => onSharePost(post)}
            aria-label="Copy post link"
            className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800/70 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            <Share2 className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>
      </div>
    </article>
  );
}
