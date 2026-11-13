import 'dotenv/config';
import crypto from 'node:crypto';
import http from 'node:http';
import path from 'node:path';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { WebSocket, WebSocketServer } from 'ws';
import type { AuthUser, WsEvent } from './src/types.ts';
import {
  computeReadMinutes,
  createSession,
  db,
  getUserByToken,
  hashPassword,
  listCircles,
  listComments,
  listMembers,
  listPosts,
  verifyPassword,
} from './server/db.ts';

const PORT = 3000;
const isProduction = process.env.NODE_ENV === 'production';

const app = express();
app.use(express.json({ limit: '1mb' }));

// Serve generated editorial assets consistently in both dev and production builds
app.use('/src/assets/images', express.static(path.resolve(process.cwd(), 'src/assets/images')));

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/api/ws' });

function broadcast(event: WsEvent): void {
  const payload = JSON.stringify(event);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

function extractBearerToken(req: express.Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.slice(7).trim();
}

function getRequestUser(req: express.Request): AuthUser | null {
  return getUserByToken(extractBearerToken(req));
}

function requireAuth(
  req: express.Request,
  res: express.Response
): AuthUser | null {
  const user = getRequestUser(req);
  if (!user) {
    res.status(401).json({ error: 'Please sign in to perform this action.' });
    return null;
  }
  return user;
}

function sanitizeImageUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('/src/assets/images/') && !trimmed.includes('..')) {
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
  } catch {
    return null;
  }
  return null;
}

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', port: PORT });
});

// Bootstrap feed, circles, members, and optional authenticated user
app.get('/api/bootstrap', (req, res) => {
  const user = getRequestUser(req);
  const viewerId = user?.id ?? null;
  res.json({
    user,
    circles: listCircles(),
    posts: listPosts(viewerId),
    members: listMembers(viewerId),
  });
});

// Register new account
app.post('/api/auth/register', (req, res) => {
  const { name, handle, email, password, discipline, bio } = req.body ?? {};
  const cleanName = typeof name === 'string' ? name.trim() : '';
  const cleanHandle = typeof handle === 'string' ? handle.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '') : '';
  const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const cleanPassword = typeof password === 'string' ? password : '';
  const cleanDiscipline = typeof discipline === 'string' && discipline.trim() ? discipline.trim() : 'Community Member';
  const cleanBio = typeof bio === 'string' ? bio.trim() : '';

  if (cleanName.length < 2 || cleanName.length > 60) {
    res.status(400).json({ error: 'Name must be between 2 and 60 characters.' });
    return;
  }
  if (cleanHandle.length < 2 || cleanHandle.length > 30) {
    res.status(400).json({ error: 'Handle must be 2–30 lowercase letters, numbers, hyphens, or underscores.' });
    return;
  }
  if (!cleanEmail.includes('@') || cleanEmail.length > 120) {
    res.status(400).json({ error: 'Please enter a valid email address.' });
    return;
  }
  if (cleanPassword.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters.' });
    return;
  }

  const existing = db
    .prepare('SELECT id FROM users WHERE email = ? OR handle = ?')
    .get(cleanEmail, cleanHandle) as { id: string } | undefined;

  if (existing) {
    res.status(409).json({ error: 'An account with that email or handle already exists.' });
    return;
  }

  const id = `user-${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const passwordHash = hashPassword(cleanPassword);

  db.prepare(`
    INSERT INTO users (id, email, name, handle, discipline, bio, avatar_url, password_hash, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, cleanEmail, cleanName, cleanHandle, cleanDiscipline.slice(0, 60), cleanBio.slice(0, 280), '', passwordHash, now, now);

  const token = createSession(id);
  const user = getUserByToken(token);
  broadcast({ type: 'member:updated', memberId: id });
  res.status(201).json({ token, user });
});

// Login with email + password
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body ?? {};
  const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const cleanPassword = typeof password === 'string' ? password : '';

  const row = db
    .prepare('SELECT id, password_hash FROM users WHERE email = ?')
    .get(cleanEmail) as { id: string; password_hash: string } | undefined;

  if (!row || !verifyPassword(cleanPassword, row.password_hash)) {
    res.status(401).json({ error: 'Invalid email or password.' });
    return;
  }

  const token = createSession(row.id);
  const user = getUserByToken(token);
  res.json({ token, user });
});

// Quick local member switch for immediate multi-user testing on localhost
app.post('/api/auth/demo', (req, res) => {
  const { memberId } = req.body ?? {};
  const allowedIds = new Set(['user-elena', 'user-marcus']);
  const targetId = typeof memberId === 'string' && allowedIds.has(memberId) ? memberId : 'user-elena';

  const row = db.prepare('SELECT id FROM users WHERE id = ?').get(targetId) as { id: string } | undefined;
  if (!row) {
    res.status(404).json({ error: 'Member profile not found.' });
    return;
  }

  const token = createSession(row.id);
  const user = getUserByToken(token);
  res.json({ token, user });
});

app.post('/api/auth/logout', (req, res) => {
  const token = extractBearerToken(req);
  if (token) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  }
  res.json({ ok: true });
});

app.get('/api/auth/me', (req, res) => {
  const user = getRequestUser(req);
  res.json({ user });
});

// Update current user's profile
app.patch('/api/profile', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const { name, handle, discipline, bio } = req.body ?? {};
  const cleanName = typeof name === 'string' ? name.trim() : user.name;
  const cleanHandle =
    typeof handle === 'string'
      ? handle.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '')
      : user.handle;
  const cleanDiscipline =
    typeof discipline === 'string' && discipline.trim()
      ? discipline.trim().slice(0, 60)
      : user.discipline;
  const cleanBio = typeof bio === 'string' ? bio.trim().slice(0, 280) : user.bio;

  if (cleanName.length < 2 || cleanName.length > 60) {
    res.status(400).json({ error: 'Name must be between 2 and 60 characters.' });
    return;
  }
  if (cleanHandle.length < 2 || cleanHandle.length > 30) {
    res.status(400).json({ error: 'Handle must be 2–30 valid characters.' });
    return;
  }

  const clash = db
    .prepare('SELECT id FROM users WHERE handle = ? AND id != ?')
    .get(cleanHandle, user.id) as { id: string } | undefined;
  if (clash) {
    res.status(409).json({ error: 'That @handle is already taken.' });
    return;
  }

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE users
    SET name = ?, handle = ?, discipline = ?, bio = ?, updated_at = ?
    WHERE id = ?
  `).run(cleanName, cleanHandle, cleanDiscipline, cleanBio, now, user.id);

  const updated = getUserByToken(extractBearerToken(req));
  broadcast({ type: 'member:updated', memberId: user.id });
  res.json({ user: updated });
});

// Post detail + comments
app.get('/api/posts/:id', (req, res) => {
  const user = getRequestUser(req);
  const viewerId = user?.id ?? null;
  const post = listPosts(viewerId).find((p) => p.id === req.params.id);
  if (!post) {
    res.status(404).json({ error: 'Post not found.' });
    return;
  }
  const comments = listComments(post.id);
  res.json({ post, comments });
});

// Create post
app.post('/api/posts', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const { title, body, circleId, imageUrl } = req.body ?? {};
  const cleanTitle = typeof title === 'string' ? title.trim() : '';
  const cleanBody = typeof body === 'string' ? body.trim() : '';
  const cleanCircleId = typeof circleId === 'string' ? circleId.trim() : '';
  const cleanImage = sanitizeImageUrl(imageUrl);

  if (cleanTitle.length < 3 || cleanTitle.length > 140) {
    res.status(400).json({ error: 'Headline must be between 3 and 140 characters.' });
    return;
  }
  if (cleanBody.length < 10 || cleanBody.length > 4000) {
    res.status(400).json({ error: 'Post body must be between 10 and 4000 characters.' });
    return;
  }

  const circle = db.prepare('SELECT id FROM circles WHERE id = ?').get(cleanCircleId) as { id: string } | undefined;
  if (!circle) {
    res.status(400).json({ error: 'Please select a valid Circle.' });
    return;
  }

  const id = `post-${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const readMinutes = computeReadMinutes(cleanBody);

  db.prepare(`
    INSERT INTO posts (id, author_id, circle_id, title, body, image_url, read_minutes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, user.id, cleanCircleId, cleanTitle, cleanBody, cleanImage, readMinutes, now, now);

  const created = listPosts(user.id).find((p) => p.id === id);
  broadcast({ type: 'post:created', postId: id });
  res.status(201).json({ post: created });
});

// Delete own post
app.delete('/api/posts/:id', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const postId = String(req.params.id);
  const existing = db.prepare('SELECT author_id FROM posts WHERE id = ?').get(postId) as
    | { author_id: string }
    | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Post not found.' });
    return;
  }
  if (existing.author_id !== user.id) {
    res.status(403).json({ error: 'You can only delete your own posts.' });
    return;
  }

  db.prepare('DELETE FROM posts WHERE id = ?').run(postId);
  broadcast({ type: 'post:deleted', postId });
  res.json({ ok: true });
});

// Toggle like
app.post('/api/posts/:id/like', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const postId = String(req.params.id);
  const postExists = db.prepare('SELECT id FROM posts WHERE id = ?').get(postId) as { id: string } | undefined;
  if (!postExists) {
    res.status(404).json({ error: 'Post not found.' });
    return;
  }

  const liked = db
    .prepare('SELECT 1 FROM likes WHERE post_id = ? AND user_id = ?')
    .get(postId, user.id);

  if (liked) {
    db.prepare('DELETE FROM likes WHERE post_id = ? AND user_id = ?').run(postId, user.id);
  } else {
    db.prepare('INSERT INTO likes (post_id, user_id, created_at) VALUES (?, ?, ?)').run(
      postId,
      user.id,
      new Date().toISOString()
    );
  }

  const updated = listPosts(user.id).find((p) => p.id === postId);
  broadcast({ type: 'post:updated', postId });
  res.json({ post: updated });
});

// Toggle bookmark
app.post('/api/posts/:id/bookmark', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const postId = String(req.params.id);
  const postExists = db.prepare('SELECT id FROM posts WHERE id = ?').get(postId) as { id: string } | undefined;
  if (!postExists) {
    res.status(404).json({ error: 'Post not found.' });
    return;
  }

  const saved = db
    .prepare('SELECT 1 FROM bookmarks WHERE user_id = ? AND post_id = ?')
    .get(user.id, postId);

  if (saved) {
    db.prepare('DELETE FROM bookmarks WHERE user_id = ? AND post_id = ?').run(user.id, postId);
  } else {
    db.prepare('INSERT INTO bookmarks (user_id, post_id, created_at) VALUES (?, ?, ?)').run(
      user.id,
      postId,
      new Date().toISOString()
    );
  }

  const updated = listPosts(user.id).find((p) => p.id === postId);
  res.json({ post: updated });
});

// Add comment
app.post('/api/posts/:id/comments', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const postId = String(req.params.id);
  const postExists = db.prepare('SELECT id FROM posts WHERE id = ?').get(postId) as { id: string } | undefined;
  if (!postExists) {
    res.status(404).json({ error: 'Post not found.' });
    return;
  }

  const body = typeof req.body?.body === 'string' ? req.body.body.trim() : '';
  if (body.length < 1 || body.length > 1200) {
    res.status(400).json({ error: 'Comment must be between 1 and 1200 characters.' });
    return;
  }

  const id = `comment-${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO comments (id, post_id, author_id, body, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, postId, user.id, body, now);

  const comments = listComments(postId);
  const created = comments.find((c) => c.id === id);
  broadcast({ type: 'comment:created', postId, commentId: id });
  res.status(201).json({ comment: created, comments });
});

// Delete own comment
app.delete('/api/posts/:postId/comments/:commentId', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const postId = String(req.params.postId);
  const commentId = String(req.params.commentId);

  const existing = db
    .prepare('SELECT author_id FROM comments WHERE id = ? AND post_id = ?')
    .get(commentId, postId) as { author_id: string } | undefined;

  if (!existing) {
    res.status(404).json({ error: 'Comment not found.' });
    return;
  }
  if (existing.author_id !== user.id) {
    res.status(403).json({ error: 'You can only delete your own comments.' });
    return;
  }

  db.prepare('DELETE FROM comments WHERE id = ?').run(commentId);
  broadcast({ type: 'comment:deleted', postId, commentId });
  res.json({ ok: true });
});

// Toggle follow member
app.post('/api/members/:id/follow', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const targetId = String(req.params.id);
  if (targetId === user.id) {
    res.status(400).json({ error: 'You cannot follow yourself.' });
    return;
  }

  const targetExists = db.prepare('SELECT id FROM users WHERE id = ?').get(targetId) as { id: string } | undefined;
  if (!targetExists) {
    res.status(404).json({ error: 'Member not found.' });
    return;
  }

  const following = db
    .prepare('SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?')
    .get(user.id, targetId);

  if (following) {
    db.prepare('DELETE FROM follows WHERE follower_id = ? AND following_id = ?').run(user.id, targetId);
  } else {
    db.prepare('INSERT INTO follows (follower_id, following_id, created_at) VALUES (?, ?, ?)').run(
      user.id,
      targetId,
      new Date().toISOString()
    );
  }

  const members = listMembers(user.id);
  broadcast({ type: 'member:updated', memberId: targetId });
  res.json({ members });
});

async function startServer() {
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Commonplace running at http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Commonplace server:', err);
  process.exit(1);
});
