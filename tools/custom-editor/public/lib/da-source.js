/**
 * Browser-side DA Source API client. Called directly from the page (never
 * through the Node proxy) - see INSTRUCTIONS.md "Browser-side token
 * resolution". The bearer token is passed in by the caller on every call; it
 * is never cached in this module.
 */

const DA_SOURCE_ORIGIN = 'https://admin.da.live';

/** Raised for a 401 with an empty body - the documented silent-expiry signature. */
export class DaAuthError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DaAuthError';
  }
}

/**
 * DA maps a directory-style path (including the site root "/") to an
 * `index` document, same as most static site conventions - "/" -> "/index",
 * "/blog/" -> "/blog/index". Without this, root-level pages resolve to a
 * bare ".html" with no filename.
 */
function normalizePagePath(pagePath) {
  const withoutTrailingSlash = pagePath.endsWith('/') ? `${pagePath}index` : pagePath;
  return withoutTrailingSlash.endsWith('.html') ? withoutTrailingSlash : `${withoutTrailingSlash}.html`;
}

function sourcePath(daOrg, daRepo, pagePath) {
  return `${DA_SOURCE_ORIGIN}/source/${daOrg}/${daRepo}${normalizePagePath(pagePath)}`;
}

async function assertNotAuthError(response) {
  if (response.status === 401) {
    const body = await response.text().catch(() => '');
    if (body.trim() === '') {
      throw new DaAuthError('DA rejected the request with 401 - the token is missing, invalid, or expired.');
    }
    throw new Error(`DA authentication error (401): ${body}`);
  }
}

/** Fetch the current DA source HTML fragment for a page. */
export async function getSource({ daOrg, daRepo, path, token }) {
  const response = await fetch(sourcePath(daOrg, daRepo, path), {
    headers: { Authorization: `Bearer ${token}` },
  });
  await assertNotAuthError(response);
  if (response.status === 404) {
    throw new Error(`DA source not found at ${sourcePath(daOrg, daRepo, path)}`);
  }
  if (!response.ok) {
    throw new Error(`DA source fetch failed (${response.status}): ${await response.text().catch(() => '')}`);
  }
  return response.text();
}

/**
 * Upload a modified DA source HTML fragment. Field name MUST be exactly
 * "data" - the DA Source API silently accepts (200 OK) any other field name
 * without writing the file. Do not "fix" this to a more descriptive name.
 */
export async function putSource({ daOrg, daRepo, path, html, token }) {
  const formData = new FormData();
  const filename = normalizePagePath(path).split('/').pop();
  formData.set('data', new Blob([html], { type: 'text/html' }), filename);

  const response = await fetch(sourcePath(daOrg, daRepo, path), {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  await assertNotAuthError(response);
  if (!response.ok) {
    throw new Error(`DA source save failed (${response.status}): ${await response.text().catch(() => '')}`);
  }
  return response;
}
