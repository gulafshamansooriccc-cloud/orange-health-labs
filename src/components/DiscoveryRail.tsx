import type { FeedPost, PublicMember } from '../types.ts';
import { MemberAvatar } from './Media.tsx';

interface DiscoveryRailProps {
  posts: FeedPost[];
  members: PublicMember[];
  currentUserId: string | null;
  onOpenPost: (postId: string) => void;
  onSelectAuthor: (authorId: string) => void;
  onToggleFollow: (memberId: string) => void;
}

export function DiscoveryRail({
  posts,
  members,
  currentUserId,
  onOpenPost,
  onSelectAuthor,
  onToggleFollow,
}: DiscoveryRailProps) {
  const trending = [...posts]
    .sort((a, b) => b.likesCount + b.commentsCount * 2 - (a.likesCount + a.commentsCount * 2))
    .slice(0, 3);

  const contributors = members.slice(0, 4);

  return (
    <aside className="hidden xl:flex flex-col gap-6 w-[300px] shrink-0">
      {/* Trending discussions */}
      <section className="bg-white dark:bg-neutral-900/80 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5">
        <h3 className="font-display text-sm font-semibold text-neutral-950 dark:text-white tracking-tight">
          Trending Discussions
        </h3>
        <div className="mt-4 divide-y divide-neutral-100 dark:divide-neutral-800/80">
          {trending.length === 0 ? (
            <p className="text-xs text-neutral-500 dark:text-neutral-400 py-2">
              No discussions posted yet.
            </p>
          ) : (
            trending.map((post, idx) => (
              <button
                key={post.id}
                type="button"
                onClick={() => onOpenPost(post.id)}
                className="w-full text-left py-3 first:pt-0 last:pb-0 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded"
              >
                <div className="flex items-baseline gap-2.5">
                  <span className="font-mono text-xs text-neutral-400 dark:text-neutral-500 tabular-nums">
                    0{idx + 1}.
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2">
                      {post.title}
                    </p>
                    <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400 font-mono tabular-nums">
                      {post.authorName} · {post.likesCount} likes · {post.commentsCount} replies
                    </p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </section>

      {/* Active contributors */}
      <section className="bg-white dark:bg-neutral-900/80 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5">
        <h3 className="font-display text-sm font-semibold text-neutral-950 dark:text-white tracking-tight">
          Active Contributors
        </h3>
        <div className="mt-4 space-y-3.5">
          {contributors.map((member) => {
            const isSelf = currentUserId === member.id;
            return (
              <div key={member.id} className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => onSelectAuthor(member.id)}
                  className="flex items-center gap-2.5 min-w-0 text-left group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded"
                >
                  <MemberAvatar name={member.name} avatarUrl={member.avatarUrl} size="sm" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {member.name}
                    </p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                      {member.discipline}
                    </p>
                  </div>
                </button>
                {!isSelf && (
                  <button
                    type="button"
                    onClick={() => onToggleFollow(member.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                      member.isFollowing
                        ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {member.isFollowing ? 'Following' : 'Follow'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Editorial house rules */}
      <section className="px-1 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
        <p className="font-medium text-neutral-700 dark:text-neutral-300">
          Community Guidelines
        </p>
        <p className="mt-1">
          Share direct observations, cite sources when referencing external work, and keep critiques constructive.
        </p>
      </section>
    </aside>
  );
}
