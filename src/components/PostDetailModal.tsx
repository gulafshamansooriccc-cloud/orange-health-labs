import { useEffect, useState } from 'react';
import { Bookmark, Heart, Send, Trash2, X } from 'lucide-react';
import { api, formatRelativeTime } from '../lib/api.ts';
import type { FeedPost, PostComment, PublicMember } from '../types.ts';
import { MemberAvatar, ResilientImage } from './Media.tsx';

interface PostDetailModalProps {
  postId: string | null;
  currentUserId: string | null;
  members: PublicMember[];
  refreshSignal: number;
  onClose: () => void;
  onSelectAuthor: (authorId: string) => void;
  onToggleLike: (postId: string) => void;
  onToggleBookmark: (postId: string) => void;
  onToggleFollow: (memberId: string) => void;
  onRequireAuth: () => void;
  onCommentChanged: () => void;
}

export function PostDetailModal({
  postId,
  currentUserId,
  members,
  refreshSignal,
  onClose,
  onSelectAuthor,
  onToggleLike,
  onToggleBookmark,
  onToggleFollow,
  onRequireAuth,
  onCommentChanged,
}: PostDetailModalProps) {
  const [post, setPost] = useState<FeedPost | null>(null);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!postId) {
      setPost(null);
      setComments([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    api
      .getPostDetail(postId)
      .then((res) => {
        if (!cancelled) {
          setPost(res.post);
          setComments(res.comments);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load discussion.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [postId, refreshSignal]);

  useEffect(() => {
    if (!postId) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [postId, onClose]);

  if (!postId) return null;

  const authorMember = post ? members.find((m) => m.id === post.authorId) : null;
  const isSelf = post && currentUserId === post.authorId;

  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUserId) {
      onRequireAuth();
      return;
    }
    const clean = replyText.trim();
    if (!clean || !post) return;

    setSubmitting(true);
    setError(null);
    try {
      const res = await api.addComment(post.id, clean);
      setComments(res.comments);
      setPost((prev) => (prev ? { ...prev, commentsCount: res.comments.length } : prev));
      setReplyText('');
      onCommentChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post reply.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteComment(commentId: string) {
    if (!post) return;
    try {
      await api.deleteComment(post.id, commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      setPost((prev) =>
        prev ? { ...prev, commentsCount: Math.max(0, prev.commentsCount - 1) } : prev
      );
      onCommentChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete comment.');
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Discussion Thread"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 shrink-0">
          <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
            {post ? `${post.circleName} · Discussion` : 'Loading thread'}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close discussion"
            className="p-2 -mr-2 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {loading && !post ? (
            <div className="space-y-4 animate-pulse">
              <div className="h-4 w-48 bg-neutral-200 dark:bg-neutral-800 rounded" />
              <div className="h-7 w-full bg-neutral-200 dark:bg-neutral-800 rounded" />
              <div className="h-32 w-full bg-neutral-100 dark:bg-neutral-800/60 rounded" />
            </div>
          ) : error && !post ? (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          ) : post ? (
            <div>
              {/* Author bar */}
              <div className="flex items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onSelectAuthor(post.authorId);
                  }}
                  className="flex items-center gap-3 text-left group"
                >
                  <MemberAvatar name={post.authorName} avatarUrl={post.authorAvatar} size="md" />
                  <div>
                    <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 group-hover:underline">
                      {post.authorName}
                    </p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      @{post.authorHandle} · {post.authorDiscipline} ·{' '}
                      <span className="font-mono tabular-nums">
                        {formatRelativeTime(post.createdAt)}
                      </span>
                    </p>
                  </div>
                </button>

                {!isSelf && authorMember && (
                  <button
                    type="button"
                    onClick={() => onToggleFollow(post.authorId)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      authorMember.isFollowing
                        ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {authorMember.isFollowing ? 'Following' : 'Follow'}
                  </button>
                )}
              </div>

              <h2 className="mt-5 font-display text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white leading-snug text-balance">
                {post.title}
              </h2>

              {post.imageUrl && (
                <div className="mt-5 overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800">
                  <ResilientImage
                    src={post.imageUrl}
                    alt={post.title}
                    className="w-full aspect-video object-cover"
                  />
                </div>
              )}

              <div className="mt-5 space-y-4 text-[15px] leading-relaxed text-neutral-700 dark:text-neutral-300 max-w-[65ch] whitespace-pre-line">
                {post.body}
              </div>

              {/* Actions */}
              <div className="mt-6 pt-4 border-t border-neutral-200 dark:border-neutral-800 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => onToggleLike(post.id)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                    post.isLiked
                      ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50'
                      : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                  }`}
                >
                  <Heart
                    className="w-4 h-4"
                    strokeWidth={1.75}
                    fill={post.isLiked ? 'currentColor' : 'none'}
                  />
                  <span className="font-mono tabular-nums">{post.likesCount}</span>
                  <span>Likes</span>
                </button>

                <button
                  type="button"
                  onClick={() => onToggleBookmark(post.id)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                    post.isBookmarked
                      ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50'
                      : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                  }`}
                >
                  <Bookmark
                    className="w-4 h-4"
                    strokeWidth={1.75}
                    fill={post.isBookmarked ? 'currentColor' : 'none'}
                  />
                  <span>{post.isBookmarked ? 'Saved' : 'Save'}</span>
                </button>
              </div>

              {/* Comments thread */}
              <div className="mt-8 pt-6 border-t border-neutral-200 dark:border-neutral-800">
                <h3 className="font-display text-sm font-semibold text-neutral-950 dark:text-white">
                  Replies (<span className="font-mono tabular-nums">{comments.length}</span>)
                </h3>

                <div className="mt-4 space-y-5">
                  {comments.length === 0 ? (
                    <p className="text-sm text-neutral-500 dark:text-neutral-400 py-2">
                      No replies yet. Start the conversation below.
                    </p>
                  ) : (
                    comments.map((comment) => (
                      <div key={comment.id} className="flex items-start gap-3">
                        <MemberAvatar
                          name={comment.authorName}
                          avatarUrl={comment.authorAvatar}
                          size="sm"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-xs">
                              <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                                {comment.authorName}
                              </span>
                              <span className="text-neutral-500 dark:text-neutral-400">
                                @{comment.authorHandle}
                              </span>
                              <span className="text-neutral-400" aria-hidden="true">
                                ·
                              </span>
                              <span className="font-mono tabular-nums text-neutral-500 dark:text-neutral-400">
                                {formatRelativeTime(comment.createdAt)}
                              </span>
                            </div>
                            {currentUserId === comment.authorId && (
                              <button
                                type="button"
                                onClick={() => handleDeleteComment(comment.id)}
                                aria-label="Delete reply"
                                className="p-1 text-neutral-400 hover:text-red-600 dark:hover:text-red-400 rounded"
                              >
                                <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                              </button>
                            )}
                          </div>
                          <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed whitespace-pre-line">
                            {comment.body}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Sticky reply form */}
        {post && (
          <form
            onSubmit={handleAddComment}
            className="px-6 py-4 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/60 shrink-0"
          >
            {error && (
              <p className="text-xs text-red-600 dark:text-red-400 mb-2">{error}</p>
            )}
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                maxLength={1200}
                placeholder={
                  currentUserId ? 'Write a thoughtful reply...' : 'Sign in to join the discussion'
                }
                className="flex-1 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3.5 py-2.5 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              <button
                type="submit"
                disabled={submitting || (Boolean(currentUserId) && replyText.trim().length === 0)}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
              >
                <Send className="w-3.5 h-3.5" strokeWidth={2} />
                <span>{currentUserId ? (submitting ? 'Sending' : 'Reply') : 'Sign in'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
