(function () {
  'use strict';

  var site = window.SITE || { tools: [], categories: {}, contact: {} };
  var tools = (site.tools || []).filter(function (t) { return !t.hidden; });
  var releases = {}; // id -> { version, size, url, date } | null

  var $ = function (s) { return document.querySelector(s); };
  var grid = $('#grid'), filters = $('#filters'), q = $('#q'), empty = $('#empty');
  var dlg = $('#detail'), dBody = $('#d-body');
  var state = { cat: 'all', q: '' };

  var PRICE = { free: 'Miễn phí', paid: 'Có phí', trial: 'Dùng thử' };
  var PLAT_NAME = { windows: 'Windows', mac: 'macOS', web: 'Trình duyệt', iphone: 'iPhone', android: 'Android' };
  var PLAT_ICON = {
    windows: '<path d="M3 5.5 10.5 4.4v7.1H3zM11.5 4.3 21 3v8.5h-9.5zM3 12.5h7.5v7.1L3 18.5zM11.5 12.5H21V21l-9.5-1.3z"/>',
    mac: '<path d="M16.4 12.6c0-2.4 2-3.5 2-3.6-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.2-2.8.8-3.5.8s-1.8-.8-3-.8C7 7.3 5.6 8.2 4.8 9.6c-1.6 2.8-.4 7 1.2 9.2.8 1.1 1.7 2.3 2.8 2.3 1.1 0 1.6-.7 3-.7s1.8.7 3 .7 2-1.1 2.7-2.2c.9-1.3 1.2-2.5 1.2-2.6 0 0-2.3-.9-2.3-3.7zM14.2 5.6c.6-.8 1-1.8.9-2.9-.9 0-2 .6-2.7 1.4-.6.7-1.1 1.7-1 2.8 1 .1 2.1-.5 2.8-1.3z"/>',
    web: '<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm6.9 6h-3a15.7 15.7 0 0 0-1.4-3.6A8 8 0 0 1 18.9 8zM12 4c.8 1.2 1.5 2.5 1.9 4h-3.8c.4-1.5 1.1-2.8 1.9-4zM4.3 14a8.3 8.3 0 0 1 0-4h3.4a16.5 16.5 0 0 0 0 4zm.8 2h3a15.7 15.7 0 0 0 1.4 3.6A8 8 0 0 1 5.1 16zm3-8h-3a8 8 0 0 1 4.4-3.6C8.9 5.5 8.4 6.7 8.1 8zM12 20c-.8-1.2-1.5-2.5-1.9-4h3.8c-.4 1.5-1.1 2.8-1.9 4zm2.3-6H9.7a14.7 14.7 0 0 1 0-4h4.6a14.7 14.7 0 0 1 0 4zm.2 5.6c.6-1.1 1.1-2.3 1.4-3.6h3a8 8 0 0 1-4.4 3.6zm1.8-5.6a16.5 16.5 0 0 0 0-4h3.4a8.3 8.3 0 0 1 0 4z"/>',
    iphone: '<path d="M16 1H8a3 3 0 0 0-3 3v16a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3V4a3 3 0 0 0-3-3zm1 19a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h1.5l.5 1h4l.5-1H16a1 1 0 0 1 1 1z"/>',
    android: '<path d="M6 18a1 1 0 0 0 1 1h1v3a1.5 1.5 0 0 0 3 0v-3h2v3a1.5 1.5 0 0 0 3 0v-3h1a1 1 0 0 0 1-1V8H6zM3.5 8A1.5 1.5 0 0 0 2 9.5v7a1.5 1.5 0 0 0 3 0v-7A1.5 1.5 0 0 0 3.5 8zm17 0A1.5 1.5 0 0 0 19 9.5v7a1.5 1.5 0 0 0 3 0v-7A1.5 1.5 0 0 0 20.5 8zm-5-5.8.9-1.3a.3.3 0 0 0-.5-.3l-1 1.4a6.4 6.4 0 0 0-5.8 0l-1-1.4a.3.3 0 0 0-.5.3l.9 1.3A5.3 5.3 0 0 0 6 7h12a5.3 5.3 0 0 0-2.5-4.8zM9.5 5.2a.7.7 0 1 1 0-1.4.7.7 0 0 1 0 1.4zm5 0a.7.7 0 1 1 0-1.4.7.7 0 0 1 0 1.4z"/>',
  };
  var I_DOWN = '<svg viewBox="0 0 24 24"><path d="M12 3v12m0 0-5-5m5 5 5-5M4 19h16"/></svg>';
  var I_OPEN = '<svg viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fold(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase();
  }
  function fmtSize(b) {
    if (!b) return '';
    return b >= 1048576 ? (b / 1048576).toFixed(b >= 104857600 ? 0 : 1) + ' MB' : Math.round(b / 1024) + ' KB';
  }
  function fmtDate(d) {
    var x = new Date(d);
    return isNaN(x) ? '' : x.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  function isNew(t) {
    var d = Date.parse(t.added || '');
    return d && Date.now() - d < 30 * 864e5;
  }
  function isFile(url) { return /\.(zip|exe|msi|dmg|7z|apk|pkg)(\?|#|$)/i.test(url); }

  // ---- Bản phát hành mới nhất trên GitHub (cache 1 giờ để không chạm giới hạn API) ----
  function cacheGet(k) {
    try {
      var v = JSON.parse(localStorage.getItem(k));
      return v && Date.now() - v.at < 36e5 ? v : null;
    } catch (e) { return null; }
  }
  function cacheSet(k, data) {
    try { localStorage.setItem(k, JSON.stringify({ at: Date.now(), data: data })); } catch (e) { /* bỏ qua */ }
  }
  function fetchRelease(t) {
    var key = 'rel:' + t.github.repo + ':' + t.github.asset;
    var hit = cacheGet(key);
    if (hit) return Promise.resolve(hit.data);
    return fetch('https://api.github.com/repos/' + t.github.repo + '/releases/latest', {
      headers: { Accept: 'application/vnd.github+json' },
    })
      .then(function (r) {
        if (r.status === 404) return null;
        if (!r.ok) throw new Error(r.status);
        return r.json();
      })
      .then(function (j) {
        var out = null;
        if (j) {
          var a = (j.assets || []).filter(function (x) { return x.name === t.github.asset; })[0] || (j.assets || [])[0];
          out = {
            version: String(j.tag_name || '').replace(/^[a-z-]*v/i, ''),
            date: j.published_at,
            url: a ? a.browser_download_url : j.html_url,
            size: a ? a.size : 0,
          };
        }
        cacheSet(key, out);
        return out;
      });
  }

  function info(t) {
    var r = releases[t.id];
    return {
      url: (r && r.url) || t.download || (t.github ? 'https://github.com/' + t.github.repo + '/releases' : '#'),
      version: (r && r.version) || t.version || '',
      size: (r && r.size && fmtSize(r.size)) || t.size || '',
      date: r && r.date,
      pending: t.github && !(t.id in releases),
      none: t.github && t.id in releases && !releases[t.id],
    };
  }

  function verText(t, i) {
    if (i.none) return 'Sắp phát hành';
    return [i.version && 'v' + i.version, i.size].filter(Boolean).join(' · ');
  }

  function iconHTML(t) {
    return '<span class="icon" style="background:' + esc((t.icon && t.icon.bg) || '#3b6cf6') + '"><svg viewBox="0 0 24 24" aria-hidden="true">' +
      ((t.icon && t.icon.svg) || '') + '</svg></span>';
  }
  function platsHTML(t) {
    return '<span class="plats">' + (t.platforms || []).map(function (p) {
      return '<svg viewBox="0 0 24 24" role="img" aria-label="' + esc(PLAT_NAME[p] || p) + '"><title>' + esc(PLAT_NAME[p] || p) + '</title>' + (PLAT_ICON[p] || '') + '</svg>';
    }).join('') + '</span>';
  }
  function badgesHTML(t) {
    return (isNew(t) ? '<span class="badge new">Mới</span>' : '') +
      '<span class="badge ' + esc(t.price) + '">' + esc(PRICE[t.price] || t.price) + '</span>';
  }
  function mainBtn(t, i, cls) {
    var file = isFile(i.url);
    var label = i.none ? 'Xem trên GitHub' : t.action || 'Tải về';
    return '<a class="btn primary ' + (cls || '') + '" href="' + esc(i.url) + '"' + (file ? '' : ' target="_blank" rel="noopener"') + '>' +
      (file ? I_DOWN : I_OPEN) + esc(label) + '</a>';
  }

  // ---- Danh sách ----
  function renderFilters() {
    var counts = { all: tools.length };
    tools.forEach(function (t) { counts[t.category] = (counts[t.category] || 0) + 1; });
    var cats = [['all', 'Tất cả']].concat(Object.keys(site.categories || {}).filter(function (k) { return counts[k]; }).map(function (k) { return [k, site.categories[k]]; }));
    filters.innerHTML = cats.map(function (c) {
      return '<button class="chip" role="tab" data-cat="' + esc(c[0]) + '" aria-selected="' + (state.cat === c[0]) + '">' + esc(c[1]) + '<small>' + counts[c[0]] + '</small></button>';
    }).join('');
  }

  function matches(t) {
    if (state.cat !== 'all' && t.category !== state.cat) return false;
    if (!state.q) return true;
    var hay = fold([t.name, t.tagline, (t.features || []).join(' '), (t.platforms || []).map(function (p) { return PLAT_NAME[p]; }).join(' '), site.categories[t.category]].join(' '));
    return fold(state.q).split(/\s+/).every(function (w) { return hay.indexOf(w) >= 0; });
  }

  function renderGrid() {
    var list = tools.filter(matches);
    grid.innerHTML = list.map(function (t, n) {
      var i = info(t);
      return '<article class="card" style="animation-delay:' + n * 40 + 'ms">' +
        '<div class="card-head">' + iconHTML(t) + '<div><h3><a href="#' + esc(t.id) + '">' + esc(t.name) + '</a></h3>' +
        '<div class="meta">' + badgesHTML(t) + platsHTML(t) + '</div></div></div>' +
        '<p class="tagline">' + esc(t.tagline) + '</p>' +
        '<div class="card-foot"><span class="ver' + (i.pending ? ' skel' : '') + '">' + (i.pending ? '' : esc(verText(t, i))) + '</span>' + mainBtn(t, i) + '</div>' +
        '</article>';
    }).join('');
    empty.hidden = list.length > 0;
  }

  // ---- Chi tiết ----
  function openDetail(id) {
    var t = tools.filter(function (x) { return x.id === id; })[0];
    if (!t) return;
    var i = info(t);
    var rows = [
      ['Nền tảng', (t.platforms || []).map(function (p) { return PLAT_NAME[p] || p; }).join(', ')],
      ['Phiên bản', i.none ? 'Sắp có' : i.version && i.version + (i.date ? ' · ' + fmtDate(i.date) : '')],
      ['Dung lượng', i.size],
      ['Yêu cầu', t.requires],
    ].filter(function (r) { return r[1]; });
    dBody.innerHTML =
      '<div class="d-head">' + iconHTML(t) + '<div><h2 id="d-name">' + esc(t.name) + '</h2><div class="meta">' + badgesHTML(t) + platsHTML(t) + '</div></div></div>' +
      '<p class="d-tag">' + esc(t.tagline) + '</p>' +
      (t.features && t.features.length ? '<ul class="d-feat">' + t.features.map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('') + '</ul>' : '') +
      (rows.length ? '<dl class="d-info">' + rows.map(function (r) { return '<dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd>'; }).join('') + '</dl>' : '') +
      '<div class="d-actions">' + mainBtn(t, i, 'lg') + (t.links || []).map(function (l) {
        return '<a class="btn ghost lg" href="' + esc(l.url) + '" target="_blank" rel="noopener">' + esc(l.label) + '</a>';
      }).join('') + '</div>' +
      (t.note ? '<p class="d-note">' + esc(t.note) + '</p>' : '');
    if (!dlg.open) dlg.showModal();
  }

  function onHash() {
    var id = decodeURIComponent(location.hash.slice(1));
    if (tools.some(function (t) { return t.id === id; })) openDetail(id);
    else if (dlg.open) dlg.close();
  }

  // ---- Liên hệ ----
  function renderContact() {
    var c = site.contact || {}, out = [];
    if (c.zalo) out.push('<a class="btn primary lg" href="https://zalo.me/' + esc(c.zalo.replace(/\D/g, '')) + '" target="_blank" rel="noopener">Nhắn Zalo ' + esc(c.zalo) + '</a>');
    if (c.facebook) out.push('<a class="btn ghost lg" href="' + esc(c.facebook) + '" target="_blank" rel="noopener">Facebook</a>');
    if (c.email) out.push('<a class="btn ghost lg" href="mailto:' + esc(c.email) + '">Email</a>');
    if (c.github) out.push('<a class="btn ghost lg" href="' + esc(c.github) + '" target="_blank" rel="noopener">GitHub</a>');
    $('#contact').innerHTML = out.join('');
    if (!out.length) $('#lien-he').hidden = true;
  }

  // ---- Khởi động ----
  $('#year').textContent = new Date().getFullYear();
  $('#count').textContent = tools.length + ' phần mềm · cập nhật liên tục';
  renderFilters();
  renderGrid();
  renderContact();

  filters.addEventListener('click', function (e) {
    var b = e.target.closest('.chip');
    if (!b) return;
    state.cat = b.dataset.cat;
    renderFilters();
    renderGrid();
  });
  q.addEventListener('input', function () { state.q = q.value.trim(); renderGrid(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === '/' && document.activeElement !== q && !dlg.open) { e.preventDefault(); q.focus(); }
  });
  dlg.addEventListener('close', function () {
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  });
  dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
  window.addEventListener('hashchange', onHash);
  onHash();

  tools.filter(function (t) { return t.github; }).forEach(function (t) {
    fetchRelease(t)
      .then(function (r) { releases[t.id] = r; })
      .catch(function () { t.github = null; }) // lỗi mạng / hết lượt API: dùng link dự phòng
      .then(function () {
        renderGrid();
        if (dlg.open && location.hash.slice(1) === t.id) openDetail(t.id);
      });
  });
})();
