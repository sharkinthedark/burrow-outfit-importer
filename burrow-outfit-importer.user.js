// ==UserScript==
// @name         Burrow outfit importer
// @match        https://burrow.moe/account/items*
// @grant        none
// ==/UserScript==

(function () {
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // Four bytes -> one number, as a string (matches what the site sends)
  const pack = ([a, b, c, d]) =>
    String(a * 16777216 + b * 65536 + c * 256 + d);

  function decode(code) {
    // handle URL-safe base64 and stray whitespace
    let b64 = code.trim().replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const data = JSON.parse(atob(b64));
    if (!Array.isArray(data.w)) throw new Error('No worn items found in code');
    return data.w.map(([id, colours]) => ({
      id: Number(id),
      color: pack(colours),
    }));
  }

  async function give({ id, color }) {
    const res = await fetch('/account/api/give', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'clothing', id, color }),
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text };
  }

  // --- UI ---
  const box = document.createElement('div');
  box.style.cssText =
    'position:fixed;bottom:16px;right:16px;z-index:99999;background:#222;color:#fff;' +
    'padding:10px;border-radius:8px;font:13px sans-serif;width:260px;box-shadow:0 2px 10px #0008';
  box.innerHTML = `
    <div style="margin-bottom:6px;font-weight:bold">Outfit importer</div>
    <input id="oc" placeholder="paste outfit code" style="width:100%;box-sizing:border-box;margin-bottom:6px">
    <label style="display:block;margin-bottom:6px">
      <input type="checkbox" id="dry" checked> Dry run (don't give anything)
    </label>
    <button id="ob" style="width:100%">Import</button>
    <div id="os" style="margin-top:6px;max-height:140px;overflow:auto;white-space:pre-wrap"></div>`;
  document.body.append(box);

  const status = document.getElementById('os');
  const log = msg => { status.textContent += msg + '\n'; status.scrollTop = status.scrollHeight; };

  document.getElementById('ob').onclick = async () => {
    status.textContent = '';
    const dry = document.getElementById('dry').checked;
    let items;
    try {
      items = decode(document.getElementById('oc').value);
    } catch (e) {
      return log('Bad code: ' + e.message);
    }
    log(`Found ${items.length} items${dry ? ' (dry run)' : ''}`);

    for (const [i, item] of items.entries()) {
      const label = `${i + 1}/${items.length} id ${item.id} colour ${item.color}`;
      if (dry) { log('Would give ' + label); continue; }
      try {
        const r = await give(item);
        log(`${r.ok ? '✓' : '✗'} ${label} (${r.status})`);
        if (!r.ok) { log(r.text.slice(0, 200)); log('Stopped.'); break; }
      } catch (e) {
        log('✗ ' + label + ': ' + e.message);
        break;
      }
      await sleep(800);
    }
    log('Done.');
  };
})();