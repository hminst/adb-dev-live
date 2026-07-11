/**
 * Browser-side Admin API client (preview/publish). Called directly from the
 * page - see INSTRUCTIONS.md "Browser-side token resolution".
 */

import { DaAuthError } from './da-source.js';

const ADMIN_API_ORIGIN = 'https://admin.hlx.page';

function stripHtmlExtension(pagePath) {
  return pagePath.endsWith('.html') ? pagePath.slice(0, -'.html'.length) : pagePath;
}

async function callAdminApi(action, { daOrg, daRepo, daRef, path, token }) {
  const url = `${ADMIN_API_ORIGIN}/${action}/${daOrg}/${daRepo}/${daRef}${stripHtmlExtension(path)}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (response.status === 401) {
    const body = await response.text().catch(() => '');
    if (body.trim() === '') {
      throw new DaAuthError('Admin API rejected the request with 401 - the token is missing, invalid, or expired.');
    }
    throw new Error(`Admin API authentication error (401): ${body}`);
  }
  if (!response.ok) {
    throw new Error(`Admin API ${action} failed (${response.status}): ${await response.text().catch(() => '')}`);
  }
  return response;
}

/** Regenerate the aem.page preview for a document after a source save. */
export function triggerPreview(args) {
  return callAdminApi('preview', args);
}

/** Publish a document to aem.live. Not used by the default save flow. */
export function triggerPublish(args) {
  return callAdminApi('live', args);
}
