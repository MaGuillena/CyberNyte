/* Fetch layer: business records are persisted by Express in MySQL. */
'use strict';
const API = {
  async request(path, method = 'GET', body = undefined) {
    const options = { method, credentials: 'same-origin', headers: {} };
    if (body instanceof FormData) options.body = body;
    else if (body !== undefined) {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }
    let response;
    try { response = await fetch(`/api${path}`, options); }
    catch { throw new Error('Cannot reach Express. Open http://localhost:3000 after starting the server.'); }
    const result = await response.json().catch(() => ({ message: 'Invalid server response.' }));
    if (!response.ok) {
      const error = new Error(result.message || 'Request failed.');
      error.status = response.status;
      error.errors = result.errors || {};
      if (response.status === 401 && typeof App !== 'undefined' && App.user) App.showLogin();
      throw error;
    }
    return result.data;
  }
};
const DB = {
  data: null,
  async load() { this.data = await API.request('/state'); return this.data; }
};
