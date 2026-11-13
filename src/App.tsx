import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Moon, PenSquare, Search, Sun, Users } from 'lucide-react';
import { AuthModal } from './components/AuthModal.tsx';
import { ComposerModal } from './components/ComposerModal.tsx';
import { DiscoveryRail } from './components/DiscoveryRail.tsx';
import { EditProfileModal } from './components/EditProfileModal.tsx';
import { MemberAvatar } from './components/Media.tsx';
import { MemberProfileModal } from './components/MemberProfileModal.tsx';
import { PostCard } from './components/PostCard.tsx';
import { PostDetailModal } from './components/PostDetailModal.tsx';
import { api, setStoredToken } from './lib/api.ts';
import type { AuthUser, Circle, FeedPost, PublicMember, WsEvent } from './types.ts';

type PrimaryNav = 'feed' | 'circles' | 'bookmarks' | 'members';
type FeedSort = 'latest' | 'top' | 'following';

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [circles, setCircles] = useState<Circle[]>([]);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [members, setMembers] = useState<PublicMember[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [activeNav, setActiveNav] = useState<PrimaryNav>('feed');
  const [selectedCircleId, setSelectedCircleId] = useState<string>('all');
  const [feedSort, setFeedSort] = useState<FeedSort>('latest');
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);

  const [detailRefreshSignal, setDetailRefreshSignal] = useState(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('commonplace_theme') === 'dark';
    } catch {
      return false;
    }
  });

  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    try {
      localStorage.setItem('commonplace_theme', darkMode ? 'dark' : 'light');
    } catch {
      // ignore storage errors
    }
  }, [darkMode]);

  const loadData = useCallback(async (quiet = false) => {
    if (!quiet) {
      setLoading(true);
      setLoadError(null);
    }
    try {
      const data = await api.bootstrap();
      setUser(data.user);
      setCircles(data.circles);
      setPosts(data.posts);
      setMembers(data.members);
    } catch (err) {
      if (!quiet) {
        setLoadError(err instanceof Error ? err.message : 'Unable to connect to local server.');
      }
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Real-time WebSocket sync across browser tabs and users on localhost
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: number | null = null;
    let closed = false;

    function connect() {
      if (closed) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      ws = new WebSocket(`${protocol}//${window.location.host}/api/ws`);

      ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(String(event.data)) as WsEvent;
          if (
            parsed.type === 'post:created' ||
            parsed.type === 'post:updated' ||
            parsed.type === 'post:deleted' ||
            parsed.type === 'comment:created' ||
            parsed.type === 'comment:deleted' ||
            parsed.type === 'member:updated'
          ) {
            loadData(true);
            setDetailRefreshSignal((n) => n + 1);
          }
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        if (!closed) {
          reconnectTimer = window.setTimeout(connect, 2500);
        }
      };
    }

    connect();

    return () => {
      closed = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      if (ws) ws.close();
    };
  }, [loadData]);

  const followingIds = useMemo(() => {
    return new Set(members.filter((m) => m.isFollowing).map((m) => m.id));
  }, [members]);

  const filteredPosts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    let list = posts.filter((post) => {
      if (activeNav === 'bookmarks' && !post.isBookmarked) return false;
      if (activeNav === 'feed' && selectedCircleId !== 'all' && post.circleId !== selectedCircleId) {
        return false;
      }
      if (activeNav === 'feed' && feedSort === 'following') {
        if (!user) return false;
        if (!followingIds.has(post.authorId) && post.authorId !== user.id) return false;
      }
      if (query) {
        const haystack = `${post.title} ${post.body} ${post.authorName} ${post.authorHandle} ${post.circleName}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });

    if (activeNav === 'feed' && feedSort === 'top') {
      list = [...list].sort(
        (a, b) => b.likesCount + b.commentsCount * 2 - (a.likesCount + a.commentsCount * 2)
      );
    }

    return list;
  }, [posts, activeNav, selectedCircleId, feedSort, searchQuery, followingIds, user]);

  const filteredMembers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return members;
    return members.filter((m) =>
      `${m.name} ${m.handle} ${m.discipline} ${m.bio}`.toLowerCase().includes(query)
    );
  }, [members, searchQuery]);

  const selectedMember = useMemo(
    () => members.find((m) => m.id === selectedMemberId) ?? null,
    [members, selectedMemberId]
  );

  async function handleToggleLike(postId: string) {
    if (!user) {
      setAuthOpen(true);
      return;
    }
    try {
      const res = await api.toggleLike(postId);
      setPosts((prev) => prev.map((p) => (p.id === postId ? res.post : p)));
      setDetailRefreshSignal((n) => n + 1);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to update like.');
    }
  }

  async function handleToggleBookmark(postId: string) {
    if (!user) {
      setAuthOpen(true);
      return;
    }
    try {
      const res = await api.toggleBookmark(postId);
      setPosts((prev) => prev.map((p) => (p.id === postId ? res.post : p)));
      setDetailRefreshSignal((n) => n + 1);
      showToast(res.post.isBookmarked ? 'Saved to Bookmarks' : 'Removed from Bookmarks');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to update bookmark.');
    }
  }

  async function handleDeletePost(postId: string) {
    try {
      await api.deletePost(postId);
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      if (selectedPostId === postId) setSelectedPostId(null);
      showToast('Post deleted');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to delete post.');
    }
  }

  async function handleToggleFollow(memberId: string) {
    if (!user) {
      setAuthOpen(true);
      return;
    }
    try {
      const res = await api.toggleFollow(memberId);
      setMembers(res.members);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to update follow status.');
    }
  }

  async function handleLogout() {
    try {
      await api.logout();
    } catch {
      // ignore network errors on logout
    }
    setStoredToken(null);
    setUser(null);
    loadData(true);
    showToast('Signed out');
  }

  function handleSharePost(post: FeedPost) {
    const shareUrl = `${window.location.origin}/?post=${encodeURIComponent(post.id)}`;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(shareUrl)
        .then(() => showToast('Link copied to clipboard'))
        .catch(() => showToast('Ready to share'));
    } else {
      showToast('Ready to share');
    }
  }

  function handleCircleSelect(circleId: string) {
    setSelectedCircleId(circleId);
    setActiveNav('feed');
  }

  const activeCircleObj = circles.find((c) => c.id === selectedCircleId);

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0B0F17] text-neutral-900 dark:text-neutral-100 transition-colors">
      {/* Top Bar Contract: Single row, 3 zones separated by gap-8 */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-neutral-950/95 backdrop-blur-sm border-b border-neutral-200 dark:border-neutral-800">
        <div className="max-w-[1380px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line wordmark */}
          <button
            type="button"
            onClick={() => {
              setActiveNav('feed');
              setSelectedCircleId('all');
            }}
            className="font-display text-xl font-semibold tracking-tight text-neutral-950 dark:text-white whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded"
          >
            Commonplace
          </button>

          {/* Zone 2: 4 clean single-line text nav links */}
          <nav className="hidden md:flex items-center gap-7" aria-label="Primary navigation">
            {(
              [
                { id: 'feed', label: 'Feed' },
                { id: 'circles', label: 'Circles' },
                { id: 'bookmarks', label: 'Bookmarks' },
                { id: 'members', label: 'Members' },
              ] as const
            ).map((item) => {
              const isActive = activeNav === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveNav(item.id)}
                  className={`py-1 text-sm font-medium whitespace-nowrap shrink-0 border-b-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                    isActive
                      ? 'border-blue-600 text-neutral-950 dark:text-white'
                      : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: 1 primary CTA */}
          <div className="shrink-0">
            <button
              type="button"
              onClick={() => {
                if (!user) {
                  setAuthOpen(true);
                } else {
                  setComposerOpen(true);
                }
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-950"
            >
              {user ? (
                <>
                  <PenSquare className="w-4 h-4" strokeWidth={2} />
                  <span>New Post</span>
                </>
              ) : (
                <span>Sign in</span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile secondary nav strip (under 15% viewport height) */}
      <div className="md:hidden border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-4 py-2 flex items-center gap-4 overflow-x-auto">
        {(
          [
            { id: 'feed', label: 'Feed' },
            { id: 'circles', label: 'Circles' },
            { id: 'bookmarks', label: 'Bookmarks' },
            { id: 'members', label: 'Members' },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setActiveNav(item.id)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap shrink-0 ${
              activeNav === item.id
                ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400'
                : 'text-neutral-600 dark:text-neutral-400'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Main 3-Column Workspace */}
      <div className="max-w-[1380px] mx-auto px-4 sm:px-6 py-8 flex items-start gap-8">
        {/* Left Navigation Sidebar */}
        <aside className="hidden lg:flex flex-col gap-6 w-[256px] shrink-0 sticky top-24">
          {/* Search input */}
          <div className="relative">
            <Search
              className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              strokeWidth={1.75}
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search notes or members..."
              aria-label="Search notes or members"
              className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg pl-9 pr-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          {/* Circles list */}
          <div className="bg-white dark:bg-neutral-900/80 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4">
            <h3 className="px-2 font-display text-xs font-semibold text-neutral-500 dark:text-neutral-400 tracking-wide">
              Circles
            </h3>
            <div className="mt-2.5 space-y-1">
              <button
                type="button"
                onClick={() => handleCircleSelect('all')}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-sm transition-colors ${
                  activeNav === 'feed' && selectedCircleId === 'all'
                    ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-medium'
                    : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800/70'
                }`}
              >
                <span className="truncate">All Circles</span>
                <span className="font-mono text-xs text-neutral-400 tabular-nums">
                  {posts.length}
                </span>
              </button>

              {circles.map((circle) => {
                const active = activeNav === 'feed' && selectedCircleId === circle.id;
                return (
                  <button
                    key={circle.id}
                    type="button"
                    onClick={() => handleCircleSelect(circle.id)}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-sm transition-colors ${
                      active
                        ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-medium'
                        : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800/70'
                    }`}
                  >
                    <span className="truncate">{circle.name}</span>
                    <span className="font-mono text-xs text-neutral-400 tabular-nums">
                      {circle.postsCount}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Theme switcher */}
          <div className="bg-white dark:bg-neutral-900/80 border border-neutral-200 dark:border-neutral-800 rounded-xl p-2 flex items-center gap-1">
            <button
              type="button"
              onClick={() => setDarkMode(false)}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                !darkMode
                  ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
              }`}
            >
              <Sun className="w-3.5 h-3.5" strokeWidth={1.75} />
              <span>Light</span>
            </button>
            <button
              type="button"
              onClick={() => setDarkMode(true)}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                darkMode
                  ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
              }`}
            >
              <Moon className="w-3.5 h-3.5" strokeWidth={1.75} />
              <span>Dark</span>
            </button>
          </div>

          {/* Account summary card */}
          <div className="bg-white dark:bg-neutral-900/80 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4">
            {user ? (
              <div>
                <button
                  type="button"
                  onClick={() => setSelectedMemberId(user.id)}
                  className="flex items-center gap-3 w-full text-left group"
                >
                  <MemberAvatar name={user.name} avatarUrl={user.avatarUrl} size="md" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-neutral-900 dark:text-white truncate group-hover:underline">
                      {user.name}
                    </p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                      @{user.handle}
                    </p>
                  </div>
                </button>
                <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setEditProfileOpen(true)}
                    className="text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:text-neutral-950 dark:hover:text-white"
                  >
                    Edit profile
                  </button>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="text-xs font-medium text-neutral-500 hover:text-red-600 dark:hover:text-red-400"
                  >
                    Sign out
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <p className="font-display text-sm font-semibold text-neutral-950 dark:text-white">
                  Join the conversation
                </p>
                <p className="mt-1 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
                  Sign in or create an account to publish notes, reply to threads, and save bookmarks.
                </p>
                <button
                  type="button"
                  onClick={() => setAuthOpen(true)}
                  className="mt-3 w-full py-2 px-3 rounded-lg text-xs font-medium bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors"
                >
                  Sign in or register
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* Center Main Stream */}
        <main className="flex-1 min-w-0 max-w-[680px] mx-auto w-full">
          {/* Mobile Search bar */}
          <div className="lg:hidden mb-5">
            <div className="relative">
              <Search
                className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                strokeWidth={1.75}
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search notes or members..."
                aria-label="Search notes or members"
                className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg pl-9 pr-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          {loadError ? (
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-8 text-center">
              <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>
              <button
                type="button"
                onClick={() => loadData()}
                className="mt-4 px-4 py-2 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-700"
              >
                Retry connection
              </button>
            </div>
          ) : loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 animate-pulse space-y-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-neutral-200 dark:bg-neutral-800" />
                    <div className="space-y-1.5">
                      <div className="h-3.5 w-32 bg-neutral-200 dark:bg-neutral-800 rounded" />
                      <div className="h-3 w-48 bg-neutral-100 dark:bg-neutral-800/70 rounded" />
                    </div>
                  </div>
                  <div className="h-5 w-3/4 bg-neutral-200 dark:bg-neutral-800 rounded" />
                  <div className="h-16 w-full bg-neutral-100 dark:bg-neutral-800/60 rounded" />
                </div>
              ))}
            </div>
          ) : activeNav === 'circles' ? (
            <section>
              <div className="mb-6">
                <h1 className="font-display text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white text-balance">
                  Community Circles
                </h1>
                <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                  Focused spaces organized by craft and inquiry. Choose a circle to explore its feed.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {circles.map((circle) => (
                  <button
                    key={circle.id}
                    type="button"
                    onClick={() => handleCircleSelect(circle.id)}
                    className="text-left bg-white dark:bg-neutral-900/80 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 hover:border-blue-600/60 dark:hover:border-blue-500/60 transition-colors group"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <h2 className="font-display text-lg font-semibold text-neutral-950 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {circle.name}
                      </h2>
                      <span className="font-mono text-xs text-neutral-500 dark:text-neutral-400 tabular-nums shrink-0">
                        {circle.postsCount} notes
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
                      {circle.description}
                    </p>
                  </button>
                ))}
              </div>
            </section>
          ) : activeNav === 'members' ? (
            <section>
              <div className="mb-6">
                <h1 className="font-display text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white text-balance">
                  Members
                </h1>
                <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                  Practitioners and writers contributing field notes across Commonplace.
                </p>
              </div>
              {filteredMembers.length === 0 ? (
                <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-10 text-center">
                  <Users className="w-6 h-6 text-neutral-400 mx-auto" strokeWidth={1.5} />
                  <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">
                    No members match "{searchQuery}".
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {filteredMembers.map((member) => {
                    const isSelf = user?.id === member.id;
                    return (
                      <div
                        key={member.id}
                        className="bg-white dark:bg-neutral-900/80 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 flex flex-col justify-between gap-4"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-3">
                            <button
                              type="button"
                              onClick={() => setSelectedMemberId(member.id)}
                              className="flex items-center gap-3 text-left group min-w-0"
                            >
                              <MemberAvatar
                                name={member.name}
                                avatarUrl={member.avatarUrl}
                                size="md"
                              />
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-neutral-950 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                  {member.name}
                                </p>
                                <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                                  @{member.handle} · {member.discipline}
                                </p>
                              </div>
                            </button>
                            {!isSelf && (
                              <button
                                type="button"
                                onClick={() => handleToggleFollow(member.id)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
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
                            <p className="mt-3 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400 line-clamp-2">
                              {member.bio}
                            </p>
                          )}
                        </div>
                        <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800/80 flex items-center gap-4 text-xs text-neutral-500 dark:text-neutral-400 font-mono tabular-nums">
                          <span>{member.postsCount} notes</span>
                          <span aria-hidden="true">·</span>
                          <span>{member.followersCount} followers</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          ) : (
            <section>
              {/* Feed or Bookmarks header */}
              <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="font-display text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white text-balance">
                    {activeNav === 'bookmarks'
                      ? 'Saved Bookmarks'
                      : activeCircleObj
                      ? activeCircleObj.name
                      : 'Community Feed'}
                  </h1>
                  {activeNav === 'feed' && activeCircleObj && (
                    <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                      {activeCircleObj.description}
                    </p>
                  )}
                </div>

                {activeNav === 'feed' && (
                  <div className="inline-flex items-center p-1 bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg">
                    {(
                      [
                        { id: 'latest', label: 'Latest' },
                        { id: 'top', label: 'Top' },
                        { id: 'following', label: 'Following' },
                      ] as const
                    ).map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setFeedSort(tab.id)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                          feedSort === tab.id
                            ? 'bg-white dark:bg-neutral-800 text-neutral-950 dark:text-white shadow-sm'
                            : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-white'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Inline quick composer bar on Feed */}
              {activeNav === 'feed' && (
                <button
                  type="button"
                  onClick={() => {
                    if (!user) {
                      setAuthOpen(true);
                    } else {
                      setComposerOpen(true);
                    }
                  }}
                  className="mb-6 w-full bg-white dark:bg-neutral-900/80 border border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 rounded-xl px-5 py-4 flex items-center justify-between gap-4 text-left transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <MemberAvatar
                      name={user?.name ?? 'Guest'}
                      avatarUrl={user?.avatarUrl}
                      size="sm"
                    />
                    <span className="text-sm text-neutral-500 dark:text-neutral-400 truncate">
                      {user
                        ? `Share a field note with ${activeCircleObj?.name ?? 'the community'}...`
                        : 'Sign in to publish a field note or join discussions...'}
                    </span>
                  </div>
                  <span className="text-xs font-medium text-blue-600 dark:text-blue-400 whitespace-nowrap shrink-0">
                    {user ? 'Write note' : 'Sign in'}
                  </span>
                </button>
              )}

              {/* Feed stream or empty state */}
              {filteredPosts.length === 0 ? (
                <div className="bg-white dark:bg-neutral-900/80 border border-neutral-200 dark:border-neutral-800 rounded-xl p-10 text-center">
                  <h2 className="font-display text-lg font-semibold text-neutral-950 dark:text-white">
                    {activeNav === 'bookmarks'
                      ? user
                        ? 'No saved bookmarks yet'
                        : 'Sign in to view your bookmarks'
                      : feedSort === 'following' && !user
                      ? 'Sign in to see your following stream'
                      : 'No matching field notes'}
                  </h2>
                  <p className="mt-1.5 text-sm text-neutral-500 dark:text-neutral-400 max-w-md mx-auto">
                    {activeNav === 'bookmarks'
                      ? user
                        ? 'Bookmark any discussion in the feed to keep it close for later reading.'
                        : 'Saved posts are tied to your personal member account.'
                      : feedSort === 'following'
                      ? 'Follow contributors across Circles to build a personalized reading stream.'
                      : 'Try clearing your search filter or publish the first note in this circle.'}
                  </p>
                  <div className="mt-5 flex items-center justify-center gap-3">
                    {activeNav === 'bookmarks' && !user ? (
                      <button
                        type="button"
                        onClick={() => setAuthOpen(true)}
                        className="px-4 py-2 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-700"
                      >
                        Sign in
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveNav('feed');
                          setSelectedCircleId('all');
                          setFeedSort('latest');
                          setSearchQuery('');
                        }}
                        className="px-4 py-2 rounded-lg text-xs font-medium bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200"
                      >
                        Explore all notes
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  {filteredPosts.map((post) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      currentUserId={user?.id ?? null}
                      onOpenPost={setSelectedPostId}
                      onSelectAuthor={setSelectedMemberId}
                      onSelectCircle={handleCircleSelect}
                      onToggleLike={handleToggleLike}
                      onToggleBookmark={handleToggleBookmark}
                      onDeletePost={handleDeletePost}
                      onSharePost={handleSharePost}
                    />
                  ))}
                </div>
              )}
            </section>
          )}
        </main>

        {/* Right Discovery Rail */}
        <DiscoveryRail
          posts={posts}
          members={members}
          currentUserId={user?.id ?? null}
          onOpenPost={setSelectedPostId}
          onSelectAuthor={setSelectedMemberId}
          onToggleFollow={handleToggleFollow}
        />
      </div>

      {/* Modals */}
      <PostDetailModal
        postId={selectedPostId}
        currentUserId={user?.id ?? null}
        members={members}
        refreshSignal={detailRefreshSignal}
        onClose={() => setSelectedPostId(null)}
        onSelectAuthor={setSelectedMemberId}
        onToggleLike={handleToggleLike}
        onToggleBookmark={handleToggleBookmark}
        onToggleFollow={handleToggleFollow}
        onRequireAuth={() => setAuthOpen(true)}
        onCommentChanged={() => loadData(true)}
      />

      <ComposerModal
        isOpen={composerOpen}
        circles={circles}
        defaultCircleId={selectedCircleId !== 'all' ? selectedCircleId : 'design-craft'}
        onClose={() => setComposerOpen(false)}
        onPublished={(created) => {
          setPosts((prev) => [created, ...prev]);
          loadData(true);
          showToast('Field note published');
        }}
      />

      <AuthModal
        isOpen={authOpen}
        onClose={() => setAuthOpen(false)}
        onAuthenticated={(loggedInUser) => {
          setUser(loggedInUser);
          loadData(true);
          showToast(`Signed in as ${loggedInUser.name}`);
        }}
      />

      <MemberProfileModal
        member={selectedMember}
        posts={posts}
        currentUserId={user?.id ?? null}
        onClose={() => setSelectedMemberId(null)}
        onToggleFollow={handleToggleFollow}
        onOpenPost={setSelectedPostId}
        onOpenEditProfile={() => setEditProfileOpen(true)}
      />

      <EditProfileModal
        key={user?.id ?? 'guest'}
        user={user}
        isOpen={editProfileOpen}
        onClose={() => setEditProfileOpen(false)}
        onUpdated={(updatedUser) => {
          setUser(updatedUser);
          loadData(true);
          showToast('Profile updated');
        }}
      />

      {/* Non-intrusive toast */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs font-medium px-4 py-2.5 rounded-lg shadow-lg border border-neutral-800 dark:border-neutral-200"
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
}
