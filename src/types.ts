export interface Circle {
  id: string;
  name: string;
  slug: string;
  description: string;
  postsCount: number;
}

export interface PublicMember {
  id: string;
  name: string;
  handle: string;
  discipline: string;
  bio: string;
  avatarUrl: string;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  isFollowing: boolean;
  createdAt: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  handle: string;
  discipline: string;
  bio: string;
  avatarUrl: string;
  createdAt: string;
}

export interface FeedPost {
  id: string;
  authorId: string;
  authorName: string;
  authorHandle: string;
  authorAvatar: string;
  authorDiscipline: string;
  circleId: string;
  circleName: string;
  title: string;
  body: string;
  imageUrl: string | null;
  readMinutes: number;
  likesCount: number;
  commentsCount: number;
  isLiked: boolean;
  isBookmarked: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PostComment {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  authorHandle: string;
  authorAvatar: string;
  body: string;
  createdAt: string;
}

export interface BootstrapPayload {
  user: AuthUser | null;
  circles: Circle[];
  posts: FeedPost[];
  members: PublicMember[];
}

export type WsEvent =
  | { type: 'post:created'; postId: string }
  | { type: 'post:updated'; postId: string }
  | { type: 'post:deleted'; postId: string }
  | { type: 'comment:created'; postId: string; commentId: string }
  | { type: 'comment:deleted'; postId: string; commentId: string }
  | { type: 'member:updated'; memberId: string };
