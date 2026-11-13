import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { AuthUser, Circle, FeedPost, PostComment, PublicMember } from '../src/types.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'commonplace.db');
export const db = new DatabaseSync(DB_PATH);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    handle TEXT UNIQUE NOT NULL,
    discipline TEXT NOT NULL,
    bio TEXT NOT NULL,
    avatar_url TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS circles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS posts (
    id TEXT PRIMARY KEY,
    author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    circle_id TEXT NOT NULL REFERENCES circles(id) ON DELETE RESTRICT,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    image_url TEXT,
    read_minutes INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS likes (
    post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    PRIMARY KEY (post_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS bookmarks (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    PRIMARY KEY (user_id, post_id)
  );

  CREATE TABLE IF NOT EXISTS follows (
    follower_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    following_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    PRIMARY KEY (follower_id, following_id)
  );
`);

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  const derived = crypto.scryptSync(password, salt, 64);
  const keyBuf = Buffer.from(keyHex, 'hex');
  if (derived.length !== keyBuf.length) return false;
  return crypto.timingSafeEqual(derived, keyBuf);
}

export function computeReadMinutes(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 180));
}

function hoursAgoIso(hours: number): string {
  return new Date(Date.now() - hours * 3600 * 1000).toISOString();
}

function seedDatabaseIfEmpty(): void {
  const userCountRow = db.prepare('SELECT COUNT(*) AS count FROM users').get() as { count: number };
  if (userCountRow.count > 0) return;

  const insertCircle = db.prepare(`
    INSERT INTO circles (id, name, slug, description, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  const circles = [
    {
      id: 'design-craft',
      name: 'Design & Craft',
      slug: 'design-craft',
      description: 'Spatial systems, architectural studio practice, typography, and tactile interfaces.',
    },
    {
      id: 'engineering',
      name: 'Engineering',
      slug: 'engineering',
      description: 'Local-first software, reliable systems architecture, performance budgets, and tooling.',
    },
    {
      id: 'photography',
      name: 'Photography',
      slug: 'photography',
      description: '35mm rangefinder craft, darkroom contact sheets, documentary framing, and natural light.',
    },
    {
      id: 'culture-books',
      name: 'Culture & Books',
      slug: 'culture-books',
      description: 'Monographs, independent print journals, essays on attention, and creative longevity.',
    },
  ];

  const createdSeed = hoursAgoIso(72);
  for (const circle of circles) {
    insertCircle.run(circle.id, circle.name, circle.slug, circle.description, createdSeed);
  }

  const insertUser = db.prepare(`
    INSERT INTO users (id, email, name, handle, discipline, bio, avatar_url, password_hash, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const demoPasswordHash = hashPassword('commonplace-demo');
  const members = [
    {
      id: 'user-elena',
      email: 'elena@commonplace.local',
      name: 'Elena Vance',
      handle: 'elenavance',
      discipline: 'Architectural Designer',
      bio: 'Exploring quiet spatial tools, daylight studies, and printed studio monographs in Zurich.',
      avatarUrl: '/src/assets/images/avatar_member_elena_1794551757483.jpg',
    },
    {
      id: 'user-marcus',
      email: 'marcus@commonplace.local',
      name: 'Marcus Chen',
      handle: 'marcuschen',
      discipline: 'Systems Engineer',
      bio: 'Building local-first web software, SQLite sync engines, and low-latency collaborative editors.',
      avatarUrl: '/src/assets/images/avatar_member_marcus_1794551758388.jpg',
    },
    {
      id: 'user-sora',
      email: 'sora@commonplace.local',
      name: 'Sora Takahashi',
      handle: 'sorafilm',
      discipline: 'Documentary Photographer',
      bio: '35mm street studies, silver gelatin contact sheets, and slow urban observation.',
      avatarUrl: '',
    },
    {
      id: 'user-julian',
      email: 'julian@commonplace.local',
      name: 'Julian Mercer',
      handle: 'julianm',
      discipline: 'Editorial Typographer',
      bio: 'Collecting Swiss grotesque specimens, grid notebooks, and essay-length design criticism.',
      avatarUrl: '',
    },
  ];

  for (const m of members) {
    insertUser.run(
      m.id,
      m.email,
      m.name,
      m.handle,
      m.discipline,
      m.bio,
      m.avatarUrl,
      demoPasswordHash,
      createdSeed,
      createdSeed
    );
  }

  const insertPost = db.prepare(`
    INSERT INTO posts (id, author_id, circle_id, title, body, image_url, read_minutes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const posts = [
    {
      id: 'post-daylight-studio',
      authorId: 'user-elena',
      circleId: 'design-craft',
      title: 'Why morning shadow geometry changes how we draft spatial interfaces',
      body: `Spent three weeks tracking how direct 8:30 AM light moves across raw poured concrete in our studio before opening any digital tool. When physical surfaces rely on subtle tonal shifts rather than thick borders, your eye learns to separate hierarchy through proportion and breathing room.\n\nBack at the screen, we stripped away every nested card shadow and status badge from our project review board. Simply widening section margins from 16px to 32px and using crisp 1px hairlines cut review fatigue noticeably across the whole team.`,
      imageUrl: '/src/assets/images/post_cover_architecture_1794551756804.jpg',
      createdAt: hoursAgoIso(2),
    },
    {
      id: 'post-contact-sheets',
      authorId: 'user-sora',
      circleId: 'photography',
      title: 'Reading a 36-frame contact sheet with a brass loupe before scanning anything',
      body: `Digital culling encourages twitchy frame-by-frame perfectionism. Laying an entire roll of Tri-X onto a single contact sheet forces you to read rhythm, sequence, and juxtaposition all at once.\n\nMost of the strongest frames are never the ones you thought you nailed when releasing the shutter—they live two frames later, right after a subject turns away and drops their guard.`,
      imageUrl: '/src/assets/images/post_cover_photography_1794551757178.jpg',
      createdAt: hoursAgoIso(5),
    },
    {
      id: 'post-local-sqlite',
      authorId: 'user-marcus',
      circleId: 'engineering',
      title: 'Running real-time community feeds directly on embedded SQLite and WebSockets',
      body: `Before reaching for distributed queues or multi-region clusters, benchmark what a single Node process backed by WAL-mode SQLite handles on commodity hardware. Prepared statements return sub-millisecond reads, and pairing mutations with a lightweight WebSocket broadcast keeps every open browser tab synchronized.\n\nKeeping the persistence layer simple means you spend your engineering budget on crisp interaction latency, clean validation boundaries, and predictable backups.`,
      imageUrl: null,
      createdAt: hoursAgoIso(9),
    },
    {
      id: 'post-type-specimens',
      authorId: 'user-julian',
      circleId: 'culture-books',
      title: 'Notes from archiving mid-century grotesque type specimens on stone desks',
      body: `Comparing printed 1960s grotesque specimens side by side with modern screen rendering reminds you how much optical size matters. Headlines want tight tracking and deliberate balance so trailing words never dangle alone; body prose wants generous leading and honest paper contrast.\n\nWhenever a layout starts feeling noisy, dropping from four font weights down to two almost always restores calm.`,
      imageUrl: '/src/assets/images/post_cover_editorial_1794551757501.jpg',
      createdAt: hoursAgoIso(14),
    },
    {
      id: 'post-quiet-defaults',
      authorId: 'user-elena',
      circleId: 'engineering',
      title: 'Sub-200ms UI feedback as a measure of respect for regular contributors',
      body: `Nothing erodes the habit of writing field notes faster than sluggish composers and layout jumps when metrics update. Using tabular numerals on counters and settling hover transitions under 180ms makes a community workspace feel physically grounded, like turning a well-bound page.`,
      imageUrl: null,
      createdAt: hoursAgoIso(22),
    },
  ];

  for (const p of posts) {
    insertPost.run(
      p.id,
      p.authorId,
      p.circleId,
      p.title,
      p.body,
      p.imageUrl,
      computeReadMinutes(p.body),
      p.createdAt,
      p.createdAt
    );
  }

  const insertComment = db.prepare(`
    INSERT INTO comments (id, post_id, author_id, body, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  insertComment.run(
    'comment-1',
    'post-daylight-studio',
    'user-julian',
    'Completely agree on stripping nested cards. Letting whitespace carry the structure makes typography breathe immediately.',
    hoursAgoIso(1.5)
  );
  insertComment.run(
    'comment-2',
    'post-daylight-studio',
    'user-marcus',
    'We applied the same hairline divider pattern to our commit log viewer last week—zero regrets.',
    hoursAgoIso(1)
  );
  insertComment.run(
    'comment-3',
    'post-contact-sheets',
    'user-elena',
    'That observation about two frames after the main shot hits close to home. The unguarded transitions hold all the warmth.',
    hoursAgoIso(4)
  );
  insertComment.run(
    'comment-4',
    'post-local-sqlite',
    'user-elena',
    'Sub-millisecond reads make such a noticeable difference when switching circles back and forth.',
    hoursAgoIso(7)
  );

  const insertLike = db.prepare(`
    INSERT INTO likes (post_id, user_id, created_at)
    VALUES (?, ?, ?)
  `);

  const seedLikes: [string, string][] = [
    ['post-daylight-studio', 'user-marcus'],
    ['post-daylight-studio', 'user-sora'],
    ['post-daylight-studio', 'user-julian'],
    ['post-contact-sheets', 'user-elena'],
    ['post-contact-sheets', 'user-marcus'],
    ['post-local-sqlite', 'user-elena'],
    ['post-local-sqlite', 'user-julian'],
    ['post-type-specimens', 'user-elena'],
    ['post-type-specimens', 'user-sora'],
  ];

  for (const [postId, userId] of seedLikes) {
    insertLike.run(postId, userId, hoursAgoIso(1));
  }

  const insertFollow = db.prepare(`
    INSERT INTO follows (follower_id, following_id, created_at)
    VALUES (?, ?, ?)
  `);
  insertFollow.run('user-elena', 'user-marcus', hoursAgoIso(10));
  insertFollow.run('user-elena', 'user-sora', hoursAgoIso(10));
  insertFollow.run('user-marcus', 'user-elena', hoursAgoIso(8));
  insertFollow.run('user-julian', 'user-elena', hoursAgoIso(6));

  const insertBookmark = db.prepare(`
    INSERT INTO bookmarks (user_id, post_id, created_at)
    VALUES (?, ?, ?)
  `);
  insertBookmark.run('user-elena', 'post-contact-sheets', hoursAgoIso(3));
  insertBookmark.run('user-marcus', 'post-daylight-studio', hoursAgoIso(1));
}

seedDatabaseIfEmpty();

export function getUserByToken(token: string | null | undefined): AuthUser | null {
  if (!token) return null;
  const row = db
    .prepare(`
      SELECT u.id, u.email, u.name, u.handle, u.discipline, u.bio, u.avatar_url, u.created_at, s.expires_at
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token = ?
    `)
    .get(token) as
    | {
        id: string;
        email: string;
        name: string;
        handle: string;
        discipline: string;
        bio: string;
        avatar_url: string;
        created_at: string;
        expires_at: string;
      }
    | undefined;

  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return null;
  }

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    handle: row.handle,
    discipline: row.discipline,
    bio: row.bio,
    avatarUrl: row.avatar_url,
    createdAt: row.created_at,
  };
}

export function createSession(userId: string): string {
  const token = crypto.randomBytes(32).toString('hex');
  const now = new Date();
  const expires = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 14);
  db.prepare(`
    INSERT INTO sessions (token, user_id, expires_at, created_at)
    VALUES (?, ?, ?, ?)
  `).run(token, userId, expires.toISOString(), now.toISOString());
  return token;
}

export function listCircles(): Circle[] {
  const rows = db
    .prepare(`
      SELECT c.id, c.name, c.slug, c.description, COUNT(p.id) AS posts_count
      FROM circles c
      LEFT JOIN posts p ON p.circle_id = c.id
      GROUP BY c.id
      ORDER BY c.created_at ASC
    `)
    .all() as {
    id: string;
    name: string;
    slug: string;
    description: string;
    posts_count: number;
  }[];

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    description: r.description,
    postsCount: Number(r.posts_count),
  }));
}

export function listMembers(viewerId: string | null): PublicMember[] {
  const rows = db
    .prepare(`
      SELECT
        u.id,
        u.name,
        u.handle,
        u.discipline,
        u.bio,
        u.avatar_url,
        u.created_at,
        (SELECT COUNT(*) FROM follows f WHERE f.following_id = u.id) AS followers_count,
        (SELECT COUNT(*) FROM follows f WHERE f.follower_id = u.id) AS following_count,
        (SELECT COUNT(*) FROM posts p WHERE p.author_id = u.id) AS posts_count,
        CASE
          WHEN ? IS NOT NULL AND EXISTS(
            SELECT 1 FROM follows f WHERE f.follower_id = ? AND f.following_id = u.id
          ) THEN 1
          ELSE 0
        END AS is_following
      FROM users u
      ORDER BY posts_count DESC, followers_count DESC, u.created_at ASC
    `)
    .all(viewerId, viewerId) as {
    id: string;
    name: string;
    handle: string;
    discipline: string;
    bio: string;
    avatar_url: string;
    created_at: string;
    followers_count: number;
    following_count: number;
    posts_count: number;
    is_following: number;
  }[];

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    handle: r.handle,
    discipline: r.discipline,
    bio: r.bio,
    avatarUrl: r.avatar_url,
    followersCount: Number(r.followers_count),
    followingCount: Number(r.following_count),
    postsCount: Number(r.posts_count),
    isFollowing: Boolean(r.is_following),
    createdAt: r.created_at,
  }));
}

export function listPosts(viewerId: string | null): FeedPost[] {
  const rows = db
    .prepare(`
      SELECT
        p.id,
        p.author_id,
        u.name AS author_name,
        u.handle AS author_handle,
        u.avatar_url AS author_avatar,
        u.discipline AS author_discipline,
        p.circle_id,
        c.name AS circle_name,
        p.title,
        p.body,
        p.image_url,
        p.read_minutes,
        p.created_at,
        p.updated_at,
        (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) AS likes_count,
        (SELECT COUNT(*) FROM comments cm WHERE cm.post_id = p.id) AS comments_count,
        CASE
          WHEN ? IS NOT NULL AND EXISTS(
            SELECT 1 FROM likes l WHERE l.post_id = p.id AND l.user_id = ?
          ) THEN 1
          ELSE 0
        END AS is_liked,
        CASE
          WHEN ? IS NOT NULL AND EXISTS(
            SELECT 1 FROM bookmarks b WHERE b.post_id = p.id AND b.user_id = ?
          ) THEN 1
          ELSE 0
        END AS is_bookmarked
      FROM posts p
      JOIN users u ON u.id = p.author_id
      JOIN circles c ON c.id = p.circle_id
      ORDER BY p.created_at DESC
    `)
    .all(viewerId, viewerId, viewerId, viewerId) as {
    id: string;
    author_id: string;
    author_name: string;
    author_handle: string;
    author_avatar: string;
    author_discipline: string;
    circle_id: string;
    circle_name: string;
    title: string;
    body: string;
    image_url: string | null;
    read_minutes: number;
    created_at: string;
    updated_at: string;
    likes_count: number;
    comments_count: number;
    is_liked: number;
    is_bookmarked: number;
  }[];

  return rows.map((r) => ({
    id: r.id,
    authorId: r.author_id,
    authorName: r.author_name,
    authorHandle: r.author_handle,
    authorAvatar: r.author_avatar,
    authorDiscipline: r.author_discipline,
    circleId: r.circle_id,
    circleName: r.circle_name,
    title: r.title,
    body: r.body,
    imageUrl: r.image_url,
    readMinutes: Number(r.read_minutes),
    likesCount: Number(r.likes_count),
    commentsCount: Number(r.comments_count),
    isLiked: Boolean(r.is_liked),
    isBookmarked: Boolean(r.is_bookmarked),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export function listComments(postId: string): PostComment[] {
  const rows = db
    .prepare(`
      SELECT
        cm.id,
        cm.post_id,
        cm.author_id,
        u.name AS author_name,
        u.handle AS author_handle,
        u.avatar_url AS author_avatar,
        cm.body,
        cm.created_at
      FROM comments cm
      JOIN users u ON u.id = cm.author_id
      WHERE cm.post_id = ?
      ORDER BY cm.created_at ASC
    `)
    .all(postId) as {
    id: string;
    post_id: string;
    author_id: string;
    author_name: string;
    author_handle: string;
    author_avatar: string;
    body: string;
    created_at: string;
  }[];

  return rows.map((r) => ({
    id: r.id,
    postId: r.post_id,
    authorId: r.author_id,
    authorName: r.author_name,
    authorHandle: r.author_handle,
    authorAvatar: r.author_avatar,
    body: r.body,
    createdAt: r.created_at,
  }));
}
