import { useState } from 'react';
import { X } from 'lucide-react';
import { api, COVER_PRESETS } from '../lib/api.ts';
import type { Circle, FeedPost } from '../types.ts';
import { ResilientImage } from './Media.tsx';

interface ComposerModalProps {
  isOpen: boolean;
  circles: Circle[];
  defaultCircleId: string;
  onClose: () => void;
  onPublished: (post: FeedPost) => void;
}

export function ComposerModal({
  isOpen,
  circles,
  defaultCircleId,
  onClose,
  onPublished,
}: ComposerModalProps) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [circleId, setCircleId] = useState(defaultCircleId || circles[0]?.id || 'design-craft');
  const [imageUrl, setImageUrl] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await api.createPost({
        title: title.trim(),
        body: body.trim(),
        circleId,
        imageUrl: imageUrl.trim() || null,
      });
      setTitle('');
      setBody('');
      setImageUrl('');
      onPublished(res.post);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to publish post.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="New Community Post"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">
          <h2 className="font-display text-lg font-semibold text-neutral-950 dark:text-white tracking-tight">
            Publish Field Note
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close composer"
            className="p-2 -mr-2 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="post-circle"
              className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1.5"
            >
              Circle
            </label>
            <select
              id="post-circle"
              value={circleId}
              onChange={(e) => setCircleId(e.target.value)}
              className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3.5 py-2.5 text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              {circles.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="post-title"
                className="block text-xs font-medium text-neutral-700 dark:text-neutral-300"
              >
                Headline
              </label>
              <span className="font-mono text-xs text-neutral-400 tabular-nums">
                {title.length}/140
              </span>
            </div>
            <input
              id="post-title"
              type="text"
              required
              minLength={3}
              maxLength={140}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="A clear observation, question, or essay title"
              className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3.5 py-2.5 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="post-body"
                className="block text-xs font-medium text-neutral-700 dark:text-neutral-300"
              >
                Note
              </label>
              <span className="font-mono text-xs text-neutral-400 tabular-nums">
                {body.length}/4000
              </span>
            </div>
            <textarea
              id="post-body"
              required
              minLength={10}
              maxLength={4000}
              rows={6}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Share what you noticed, built, or read. Separate paragraphs with blank lines."
              className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3.5 py-2.5 text-sm leading-relaxed text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-600 resize-y"
            />
          </div>

          <div>
            <span className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              Optional Cover Image
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setImageUrl('')}
                className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                  imageUrl === ''
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                    : 'border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                }`}
              >
                Text Only
              </button>
              {COVER_PRESETS.map((preset) => (
                <button
                  key={preset.url}
                  type="button"
                  onClick={() => setImageUrl(preset.url)}
                  className={`px-2.5 py-2 rounded-lg text-xs font-medium border truncate transition-colors ${
                    imageUrl === preset.url
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                      : 'border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                  }`}
                >
                  {preset.label.split(' ')[0]}
                </button>
              ))}
            </div>

            {imageUrl && (
              <div className="mt-3 overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800">
                <ResilientImage
                  src={imageUrl}
                  alt="Selected cover preview"
                  className="w-full aspect-video object-cover"
                />
              </div>
            )}
          </div>

          <div className="pt-2 flex items-center justify-end gap-3 border-t border-neutral-100 dark:border-neutral-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Publishing...' : 'Publish'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
