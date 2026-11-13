import type {
  AuthUser,
  BootstrapPayload,
  FeedPost,
  PostComment,
  PublicMember,
} from '../types.ts';

const TOKEN_KEY = 'commonplace_session_token';

export const COVER_PRESETS = [
  {
    label: 'Architectural Daylight Studio',
    url: '/src/assets/images/post_cover_architecture_1794551756804.jpg',
  },
  {
    label: '35mm Rangefinder & Contact Sheets',
    url: '/src/assets/images/post_cover_photography_1794551757178.jpg',
  },
  {
    label: 'Typographic Specimen Desk',
    url: '/src/assets/images/post_cover_editorial_1794551757501.jpg',
  },
];

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers);
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data?.error === 'string' ? data.error : `Request failed (${res.status})`);
  }
  return data as T;
}

export const api = {
  bootstrap: () => apiFetch<BootstrapPayload>('/api/bootstrap'),

  register: (payload: {
    name: string;
    handle: string;
    email: string;
    password: string;
    discipline: string;
    bio: string;
  }) =>
    apiFetch<{ token: string; user: AuthUser }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  login: (payload: { email: string; password: string }) =>
    apiFetch<{ token: string; user: AuthUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  demoLogin: (memberId: 'user-elena' | 'user-marcus') =>
    apiFetch<{ token: string; user: AuthUser }>('/api/auth/demo', {
      method: 'POST',
      body: JSON.stringify({ memberId }),
    }),

  logout: () =>
    apiFetch<{ ok: boolean }>('/api/auth/logout', {
      method: 'POST',
    }),

  updateProfile: (payload: {
    name: string;
    handle: string;
    discipline: string;
    bio: string;
  }) =>
    apiFetch<{ user: AuthUser }>('/api/profile', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  getPostDetail: (postId: string) =>
    apiFetch<{ post: FeedPost; comments: PostComment[] }>(`/api/posts/${postId}`),

  createPost: (payload: {
    title: string;
    body: string;
    circleId: string;
    imageUrl: string | null;
  }) =>
    apiFetch<{ post: FeedPost }>('/api/posts', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  deletePost: (postId: string) =>
    apiFetch<{ ok: boolean }>(`/api/posts/${postId}`, {
      method: 'DELETE',
    }),

  toggleLike: (postId: string) =>
    apiFetch<{ post: FeedPost }>(`/api/posts/${postId}/like`, {
      method: 'POST',
    }),

  toggleBookmark: (postId: string) =>
    apiFetch<{ post: FeedPost }>(`/api/posts/${postId}/bookmark`, {
      method: 'POST',
    }),

  addComment: (postId: string, body: string) =>
    apiFetch<{ comment: PostComment; comments: PostComment[] }>(`/api/posts/${postId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    }),

  deleteComment: (postId: string, commentId: string) =>
    apiFetch<{ ok: boolean }>(`/api/posts/${postId}/comments/${commentId}`, {
      method: 'DELETE',
    }),

  toggleFollow: (memberId: string) =>
    apiFetch<{ members: PublicMember[] }>(`/api/members/${memberId}/follow`, {
      method: 'POST',
    }),
};

export function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.max(0, Math.floor(diffMs / 60000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}
