import { X } from 'lucide-react';
import { formatRelativeTime } from '../lib/api.ts';
import type { FeedPost, PublicMember } from '../types.ts';
import { MemberAvatar } from './Media.tsx';

interface MemberProfileModalProps {
  member: PublicMember | null;
  posts: FeedPost[];
  currentUserId: string | null;
  onClose: () => void;
  onToggleFollow: (memberId: string) => void;
  onOpenPost: (postId: string) => void;
  onOpenEditProfile: () => void;
}

export function MemberProfileModal({
  member,
  posts,
  currentUserId,
  onClose,
  onToggleFollow,
  onOpenPost,
  onOpenEditProfile,
}: MemberProfileModalProps) {
  if (!member) return null;

  const isSelf = currentUserId === member.id;
  const memberPosts = posts.filter((p) => p.authorId === member.id);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`Profile of ${member.name}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl w-full max-w-xl max-h-[88vh] flex flex-col overflow-hidden shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">
          <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
            Member Profile
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close profile"
            className="p-2 -mr-2 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <X className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <MemberAvatar name={member.name} avatarUrl={member.avatarUrl} size="lg" />
              <div>
                <h2 className="font-display text-xl font-semibold text-neutral-950 dark:text-white tracking-tight">
                  {member.name}
                </h2>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  @{member.handle} · {member.discipline}
                </p>
              </div>
            </div>

            {isSelf ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenEditProfile();
                }}
                className="px-3.5 py-2 rounded-lg text-xs font-medium border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800 whitespace-nowrap shrink-0"
              >
                Edit profile
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onToggleFollow(member.id)}
                className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  member.isFollowing
                    ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {member.isFollowing ? 'Following' : 'Follow'}
              </button>
            )}
          </div>

          {member.bio && (
            <p className="mt-4 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300 max-w-[65ch]">
              {member.bio}
            </p>
          )}

          {/* Tabular counters */}
          <div className="mt-5 py-3.5 border-y border-neutral-200 dark:border-neutral-800 flex items-center gap-6 text-xs text-neutral-600 dark:text-neutral-400">
            <div>
              <span className="font-mono font-semibold text-neutral-900 dark:text-white tabular-nums">
                {member.postsCount}
              </span>{' '}
              Notes
            </div>
            <div>
              <span className="font-mono font-semibold text-neutral-900 dark:text-white tabular-nums">
                {member.followersCount}
              </span>{' '}
              Followers
            </div>
            <div>
              <span className="font-mono font-semibold text-neutral-900 dark:text-white tabular-nums">
                {member.followingCount}
              </span>{' '}
              Following
            </div>
          </div>

          {/* Authored notes */}
          <div className="mt-6">
            <h3 className="font-display text-sm font-semibold text-neutral-950 dark:text-white">
              Published Field Notes
            </h3>
            {memberPosts.length === 0 ? (
              <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
                No notes published yet.
              </p>
            ) : (
              <div className="mt-3 divide-y divide-neutral-100 dark:divide-neutral-800">
                {memberPosts.map((post) => (
                  <button
                    key={post.id}
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenPost(post.id);
                    }}
                    className="w-full text-left py-3.5 group"
                  >
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 font-mono tabular-nums">
                      {post.circleName} · {formatRelativeTime(post.createdAt)} · {post.likesCount} likes
                    </p>
                    <p className="mt-1 font-display text-base font-medium text-neutral-900 dark:text-neutral-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {post.title}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
