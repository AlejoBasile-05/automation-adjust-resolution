async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function errorMessage(status, body) {
  return body && typeof body.error === 'string'
    ? body.error
    : `Request failed with status ${status}`;
}

async function request(path, { method = 'GET', body } = {}) {
  const options = { method, headers: {} };
  if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  const response = await fetch(path, options);
  const payload = await readJson(response);

  if (!response.ok) {
    const error = new Error(errorMessage(response.status, payload));
    error.status = response.status;
    throw error;
  }

  return payload;
}

export function getConfig() {
  return request('/api/config');
}

export function saveConfig(patch) {
  return request('/api/config', { method: 'PUT', body: patch });
}

export function processBatch(payload) {
  return request('/api/process', { method: 'POST', body: payload });
}

export async function getErrors(runId) {
  try {
    const payload = await request(`/api/errors/${encodeURIComponent(runId)}`);
    return Array.isArray(payload?.errors) ? payload.errors : [];
  } catch (error) {
    // An unknown run simply has no recorded errors yet.
    if (error.status === 404) return [];
    throw error;
  }
}
