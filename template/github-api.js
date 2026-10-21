(() => {
  const GITHUB_API = 'https://api.github.com';
  const OWNER = window.Autonom.REPO_OWNER;
  const REPO  = `${OWNER}.github.io`;

  async function ghGet(path) {
    const res = await fetch(`${GITHUB_API}${path}`, {
      headers: {
        Authorization: `token ${Autonom.getToken()}`,
        Accept: 'application/vnd.github+json',
      },
    });
    if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
    return res.json();
  }

  async function ghPut(path, body) {
    const res = await fetch(`${GITHUB_API}${path}`, {
      method: 'PUT',
      headers: {
        Authorization: `token ${Autonom.getToken()}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `PUT ${path} failed: ${res.status}`);
    }
    return res.json();
  }

  async function ghDelete(path, sha) {
    const res = await fetch(`${GITHUB_API}${path}`, {
      method: 'DELETE',
      headers: {
        Authorization: `token ${Autonom.getToken()}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: 'Delete file', sha }),
    });
    if (!res.ok) throw new Error(`DELETE ${path} failed: ${res.status}`);
    return res.json();
  }

  async function getFileSHA(filePath) {
    try {
      const data = await ghGet(`/repos/${OWNER}/${REPO}/contents/${filePath}`);
      return data.sha;
    } catch { return null; }
  }

  function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    bytes.forEach(b => binary += String.fromCharCode(b));
    return btoa(binary);
  }

  async function commitFile(filePath, content, message, isBinary = false) {
    const sha = await getFileSHA(filePath);
    const encoded = isBinary
      ? arrayBufferToBase64(content)
      : btoa(unescape(encodeURIComponent(content)));
    await ghPut(`/repos/${OWNER}/${REPO}/contents/${filePath}`, {
      message,
      content: encoded,
      ...(sha ? { sha } : {}),
    });
  }

  async function saveConfig(configRef, updates, commitMsg) {
    Object.assign(configRef, updates);
    configRef.lastUpdated   = new Date().toISOString();
    configRef.configVersion = (configRef.configVersion || 1) + 1;
    try {
      await commitFile('site-config.json', JSON.stringify(configRef, null, 2), commitMsg);
      Autonom.toast('Settings saved', 'success');
    } catch (e) {
      Autonom.toast(`Save failed — ${e.message}`, 'error', () => saveConfig(configRef, updates, commitMsg));
    }
  }

  // ─── Public API ───────────────────────────────────────────────────────────────
  Object.assign(window.Autonom, {
    REPO,
    OWNER,
    ghGet,
    ghPut,
    ghDelete,
    getFileSHA,
    commitFile,
    saveConfig,
  });
})();
