'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/forms';
import { adminUi } from '@/components/admin/admin-kit';
import { QueryGate, useAdminQuery } from '@/components/admin/use-admin-query';
import { useToast } from '@/components/providers/toast-provider';
import { adminApi } from '@/lib/admin/api';
import type { AdminAgreementView } from '@/lib/admin/types';
import { ApiError } from '@/lib/api/errors';
import { parseAgreementText } from '@/lib/legal/agreement-text';
import { formatDateTime } from '@/lib/admin/format';

/**
 * The one place the host agreement can be written.
 *
 * Saving publishes a new version and makes it the one every host signs from
 * then on; earlier versions stay on record because hosts signed them. There is
 * no draft state — what is on this page is either the live text or unsaved
 * edits — so the preview shows exactly what a host will see.
 */
export default function AdminAgreementPage() {
  const { notify } = useToast();
  const { data, error, loading, reload } = useAdminQuery<AdminAgreementView>(
    () => adminApi.agreement(),
    [],
  );
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    if (!data?.active) return;
    setTitle(data.active.title);
    setBody(data.active.body);
  }, [data]);

  const dirty = data?.active ? title !== data.active.title || body !== data.active.body : true;

  async function publish() {
    setBusy(true);
    setFormError(null);
    try {
      const next = await adminApi.publishAgreement({ title: title.trim(), body });
      notify(`Version ${next.version} published. Hosts will sign it from now on.`);
      reload();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Could not publish the agreement.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="t-label">Legal</p>
      <h1 className="t-h2">Host agreement</h1>
      <p className="t-body-small" style={{ marginTop: 'var(--space-2)', maxWidth: '46rem' }}>
        Every host reads and signs this before a listing can be submitted for approval. Saving
        publishes a new version: listings already submitted keep the version they signed, and
        any host submitting a listing after this is asked to sign the new text. Only
        administrators can change it.
      </p>

      <QueryGate loading={loading} error={error} onRetry={reload} label="Loading the agreement">
        {data ? (
          <>
            <section className={adminUi.panel} style={{ marginTop: 'var(--space-6)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'baseline' }}>
                <h2 className="t-h4">
                  {data.active ? `Version ${data.active.version} is live` : 'No version published'}
                </h2>
                {data.active ? (
                  <p className="t-caption">
                    Published {formatDateTime(data.active.createdAt)}
                    {data.active.createdBy ? ` by ${data.active.createdBy.name}` : ''} ·{' '}
                    {data.active._count?.acceptances ?? 0} signatures
                  </p>
                ) : null}
              </div>

              <div style={{ marginTop: 'var(--space-4)' }}>
                <Input id="agreement-title" label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div style={{ marginTop: 'var(--space-4)' }}>
                <Textarea
                  id="agreement-body"
                  label="Agreement text"
                  value={body}
                  rows={22}
                  onChange={(e) => setBody(e.target.value)}
                  hint={'Plain text. Start a line with "## " for a section heading and "- " for a bullet; leave a blank line between paragraphs.'}
                />
              </div>

              {formError ? (
                <p className="t-body-small" role="alert" style={{ color: 'var(--color-error)', marginTop: 'var(--space-3)' }}>
                  {formError}
                </p>
              ) : null}

              <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', marginTop: 'var(--space-5)' }}>
                <Button onClick={() => void publish()} disabled={busy || !dirty || body.trim().length < 50}>
                  {busy ? 'Publishing…' : `Publish as version ${(data.active?.version ?? 0) + 1}`}
                </Button>
                <Button variant="secondary" onClick={() => setPreview((v) => !v)}>
                  {preview ? 'Hide preview' : 'Preview as a host sees it'}
                </Button>
                {!dirty ? <p className="t-caption" style={{ alignSelf: 'center' }}>No changes since the live version.</p> : null}
              </div>
            </section>

            {preview ? (
              <section className={adminUi.panel} style={{ marginTop: 'var(--space-4)' }}>
                <h2 className="t-h4">{title || 'Untitled'}</h2>
                {parseAgreementText(body).map((block, i) =>
                  block.kind === 'heading' ? (
                    <h3 key={i} className="t-h4" style={{ marginTop: 'var(--space-4)' }}>{block.text}</h3>
                  ) : block.kind === 'list' ? (
                    <ul key={i} style={{ paddingLeft: '1.25rem' }}>
                      {block.items.map((item, j) => (
                        <li key={j} className="t-body-small">{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p key={i} className="t-body-small">{block.text}</p>
                  ),
                )}
              </section>
            ) : null}

            <section className={adminUi.panel} style={{ marginTop: 'var(--space-4)' }}>
              <h2 className="t-h4">History</h2>
              <p className="t-caption" style={{ marginBottom: 'var(--space-3)' }}>
                Kept for the record: each host&apos;s signature points at the version they read.
              </p>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 'var(--space-2)' }}>
                {data.versions.map((v) => (
                  <li key={v.id} className="t-body-small">
                    <strong>v{v.version}</strong>
                    {v.isActive ? ' · live' : ''} · {v.title} · {formatDateTime(v.createdAt)}
                    {v.createdBy ? ` · ${v.createdBy.name}` : ''} · {v._count?.acceptances ?? 0} signatures
                  </li>
                ))}
              </ul>
            </section>
          </>
        ) : null}
      </QueryGate>
    </div>
  );
}
