(function () {
  'use strict';
  var DATA = window.ASET_DATA, ALL = DATA.aset, ASET = [];
  /* Urutkan per provinsi (Bali dulu, lalu NTB, lalu provinsi lain) tanpa mengubah urutan di dalam provinsi */
  var PROV_ORDER = ['Bali', 'Nusa Tenggara Barat', 'Nusa Tenggara Timur'];
  ALL = ALL.map(function (a, i) { a._i = i; a.kategori = a.kategori || 'PPA'; a.kode_list = a.kode_list || [a.kode]; a.dokumen = a.dokumen || []; a.catatan = a.catatan || []; a.foto = a.foto || []; return a; })
    .sort(function (x, y) {
      var px = PROV_ORDER.indexOf(x.provinsi), py = PROV_ORDER.indexOf(y.provinsi);
      px = px < 0 ? 99 : px; py = py < 0 ? 99 : py;
      return px - py || x._i - y._i;
    });
  var STATUS = {
    'Usul Lelang': '#c2410c',
    'PSP': '#2563eb',
    'Pinjam Pakai': '#0f766e',
    'Disewakan': '#6d28d9',
    'Usul Hibah': '#b7791f',
    'Serah Kelola LMAN': '#57606a',
    'Dalam Penyelesaian': '#be123c',
    'Dalam Penelusuran': '#0369a1',
    'BJDA': '#1d4ed8',
    'BJDA/AYDA': '#7c3aed',
    'AYDA': '#7c3aed',
    'Eks BHS': '#0f766e',
    'Perjanjian No. 131/2004': '#b45309',
    'Tanpa Keterangan': '#5b6472'
  };
  var STATUS_FULL = { 'PSP': 'PSP (Penetapan Status Penggunaan)', 'Serah Kelola LMAN': 'Serah Kelola LMAN' };
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var norm = function (s) { return String(s || '').toLowerCase(); };
  var status = function (a) { var c = STATUS[a.status] || '#57606a'; return '<span class="status" style="color:' + c + ';background:' + c + '14;border-color:' + c + '33"><i style="background:' + c + '"></i>' + esc(a.status) + '</span>'; };
  var clean = function (v) { return (!v || v === '-' || /^tidak ada/i.test(v)) ? '–' : v; };

  /* Kategori (Eks PPA / Eks BPPN) */
  var KAT = (DATA.meta && DATA.meta.kategori) || { PPA: { label: 'Eks Kelolaan PT PPA', judul: DATA.meta.judul } };
  var KAT_KEYS = Object.keys(KAT);
  var kat = KAT_KEYS[0];
  $('#instansi').textContent = DATA.meta.instansi;
  $('#periode').textContent = 'Periode ' + DATA.meta.periode;
  $('#kat-tabs').innerHTML = KAT_KEYS.map(function (k) {
    var n = ALL.filter(function (a) { return a.kategori === k; }).length;
    return '<a href="#' + k.toLowerCase() + '" class="kat-tab" data-kat="' + k + '" role="tab">' + esc(KAT[k].label) + ' <span>' + n + '</span></a>';
  }).join('');

  function setKategori(k) {
    if (!KAT[k]) k = KAT_KEYS[0];
    var changed = k !== kat || !ASET.length;
    kat = k;
    ASET = ALL.filter(function (a) { return a.kategori === k; });
    Array.prototype.forEach.call(document.querySelectorAll('.kat-tab'), function (t) {
      var on = t.dataset.kat === k; t.classList.toggle('on', on); t.setAttribute('aria-selected', on);
    });
    $('#judul').textContent = KAT[k].judul;
    $('#foot').textContent = 'Sumber: ' + KAT[k].judul + ', ' + DATA.meta.periode + ' — ' + DATA.meta.instansi + '. Peta © OpenStreetMap.';
    if (!changed) return;
    var bidang = ASET.reduce(function (n, a) { return n + a.kode_list.length; }, 0);
    var nb = ASET.filter(function (a) { return a.provinsi === 'Bali'; }).length;
    var nn = ASET.filter(function (a) { return a.provinsi === 'Nusa Tenggara Barat'; }).length;
    $('#summary').innerHTML = [
      [ASET.length, 'Profil aset'], [bidang, 'Bidang aset'],
      [nb, 'Profil di Bali'], [nn, 'Profil di NTB']
    ].map(function (x) { return '<div class="stat"><b>' + x[0] + '</b><span>' + x[1] + '</span></div>'; }).join('');
    $('#q').value = '';
    $('#f-prov').innerHTML = '<option value="">Semua provinsi</option>' + ['Bali', 'Nusa Tenggara Barat', 'Nusa Tenggara Timur'].filter(function (p) {
      return ASET.some(function (a) { return a.provinsi === p; });
    }).map(function (p) { return '<option>' + p + '</option>'; }).join('');
    var known = Object.keys(STATUS);
    var sts = [];
    ASET.forEach(function (a) { if (a.status && sts.indexOf(a.status) < 0) sts.push(a.status); });
    sts.sort(function (x, y) {
      var ix = known.indexOf(x), iy = known.indexOf(y);
      ix = ix < 0 ? 99 : ix; iy = iy < 0 ? 99 : iy;
      return ix - iy || x.localeCompare(y);
    });
    $('#f-status').innerHTML = '<option value="">Semua status</option>' +
      sts.map(function (st) { return '<option value="' + st + '">' + (STATUS_FULL[st] || st) + '</option>'; }).join('');
    renderList();
  }

  ['#q', '#f-prov', '#f-status'].forEach(function (s) { $(s).addEventListener('input', renderList); });

  function filtered() {
    var q = norm($('#q').value).trim(), p = $('#f-prov').value, st = $('#f-status').value;
    return ASET.filter(function (a) {
      if (p && a.provinsi !== p) return false;
      if (st && a.status !== st) return false;
      if (!q) return true;
      var hay = norm([a.kode, a.kode_list.join(' '), a.nama, a.alamat, a.kabupaten, a.provinsi, a.jenis, a.status, a.dokumen.join(' ')].join(' '));
      return q.split(/\s+/).every(function (w) { return hay.indexOf(w) > -1; });
    });
  }

  function renderList() {
    var list = filtered();
    $('#count').textContent = list.length === ASET.length ? 'Menampilkan semua ' + ASET.length + ' profil aset. Klik baris untuk melihat detail.' : list.length + ' dari ' + ASET.length + ' profil aset';
    if (!list.length) { $('#rows').innerHTML = '<tr><td colspan="7" class="empty">Tidak ada aset yang cocok.</td></tr>'; return; }
    var html = '', prov = null, no = 0;
    list.forEach(function (a) {
      if (a.provinsi !== prov) {
        prov = a.provinsi; no = 0;
        var n = list.filter(function (x) { return x.provinsi === prov; }).length;
        html += '<tr class="group"><td colspan="7">Provinsi ' + esc(prov) + ' · ' + n + ' profil</td></tr>';
      }
      no++;
      html += '<tr class="row" tabindex="0" data-id="' + a.id + '">' +
        '<td class="c-no">' + no + '</td>' +
        '<td><div class="a-code">' + esc(a.kode) + '</div><div class="a-name">' + esc(a.nama) + '</div><div class="a-addr">' + esc(a.alamat) + '</div></td>' +
        '<td class="m-kab">' + esc(a.kabupaten) + '</td>' +
        '<td class="c-num" data-label="Tanah">' + esc(shortArea(a.luas_tanah)) + '</td>' +
        '<td class="c-num" data-label="Bangunan">' + esc(shortArea(a.luas_bangunan)) + '</td>' +
        '<td class="m-st">' + status(a) + '</td>' +
        '<td class="c-go">›</td></tr>';
    });
    $('#rows').innerHTML = html;
  }
  function shortArea(v) {
    v = clean(v);
    var m = String(v).match(/^[\d.,]+\s*m²/);
    return m ? m[0] : (v.length > 18 ? '–' : v);
  }
  $('#rows').addEventListener('click', function (e) { var r = e.target.closest('tr.row'); if (r) go(r.dataset.id); });
  $('#rows').addEventListener('keydown', function (e) { var r = e.target.closest('tr.row'); if (r && e.key === 'Enter') go(r.dataset.id); });

  /* Routing: #ppa / #bppn = daftar per kategori, #<id aset> = detail */
  var listScroll = 0;
  function go(id) { listScroll = window.scrollY; location.hash = id; }
  $('#back').addEventListener('click', function (e) { e.preventDefault(); location.hash = kat.toLowerCase(); });
  window.addEventListener('hashchange', route);

  function route() {
    var h = decodeURIComponent(location.hash.slice(1));
    var a = ALL.find(function (x) { return x.id === h; });
    if (a) {
      setKategori(a.kategori);
      $('#view-list').hidden = true; $('#view-detail').hidden = false;
      renderDetail(a); window.scrollTo(0, 0);
      document.title = a.nama + ' · Profil Aset';
    } else {
      var k = KAT_KEYS.filter(function (x) { return x.toLowerCase() === h.toLowerCase(); })[0] || kat;
      var wasDetail = !$('#view-detail').hidden;
      setKategori(k);
      $('#view-detail').hidden = true; $('#view-list').hidden = false;
      destroyMap(); window.scrollTo(0, wasDetail ? listScroll : 0);
      document.title = KAT[k].judul;
    }
  }

  /* Detail */
  var cur = null, curPhoto = 0, miniMap = null;
  function renderDetail(a) {
    cur = a;
    var li = function (arr) { return arr.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join(''); };
    var main =
      '<div class="sec"><h3>Status</h3><p class="note">' + esc(a.ringkasan) + '</p></div>' +
      '<div class="sec"><h3>Data aset</h3><dl class="kv">' +
      '<dt>Kategori</dt><dd>' + esc(KAT[a.kategori] ? KAT[a.kategori].label : a.kategori) + '</dd>' +
      '<dt>Kode / dokumen</dt><dd>' + (a.kode_list.length > 1 ? '<div class="codes">' + a.kode_list.map(function (k) { return '<span>' + k + '</span>'; }).join('') + '</div>' : esc(a.kode)) + '</dd>' +
      '<dt>Jenis aset</dt><dd>' + esc(a.jenis) + '</dd>' +
      '<dt>Status</dt><dd>' + status(a) + '</dd>' +
      '<dt>Alamat</dt><dd>' + esc(a.alamat) + '</dd>' +
      '<dt>Kabupaten/Kota</dt><dd>' + esc(a.kabupaten) + '</dd>' +
      '<dt>Provinsi</dt><dd>' + esc(a.provinsi) + '</dd>' +
      '<dt>Luas tanah</dt><dd>' + esc(clean(a.luas_tanah)) + '</dd>' +
      '<dt>Luas bangunan</dt><dd>' + esc(clean(a.luas_bangunan)) + '</dd>' +
      '<dt>NOP</dt><dd>' + esc(clean(a.nop)) + '</dd>' +
      '<dt>Waker</dt><dd>' + esc(clean(a.waker)) + '</dd>' +
      (a.tambahan || []).map(function (t) { return '<dt>' + esc(t[0]) + '</dt><dd>' + esc(t[1]) + '</dd>'; }).join('') +
      '<dt>Koordinat</dt><dd>' + ((a.perkiraan || a.lat == null) ? '<span class="tag-warn">Belum tersedia</span>' : (+a.lat).toFixed(6) + ', ' + (+a.lng).toFixed(6)) + '</dd>' +
      '</dl></div>' +
      (a.dokumen.length ? '<div class="sec"><h3>Dokumen kepemilikan</h3><ul>' + li(a.dokumen) + '</ul></div>' : '') +
      (a.catatan.length ? '<div class="sec"><h3>Permasalahan dan perkembangan</h3><ol>' + li(a.catatan) + '</ol></div>' : '');

    var photos = a.foto.map(function (f, i) {
      return '<button data-i="' + i + '" aria-label="Perbesar foto: ' + esc(f.caption) + '"><img data-sec="' + (f.thumb || f.file) + '" alt="' + esc(f.caption) + '"></button>';
    }).join('');
    var gmaps = 'https://www.google.com/maps?q=' + a.lat + ',' + a.lng;
    var aside =
      (a.foto.length ? '<div class="sec"><h3>Foto (' + a.foto.length + ')</h3><div class="photos" id="photos">' + photos + '</div><p class="cap">Klik foto untuk memperbesar.</p></div>' : '<div class="sec"><h3>Foto</h3><p class="cap">Belum ada foto untuk aset ini.</p></div>') +
      (a.lat == null ? '<div class="sec"><h3>Lokasi</h3><p class="cap">Titik koordinat belum tersedia.</p></div>' : '<div class="sec"><h3>Lokasi</h3><div id="mini-map"></div><div class="map-links">' +
      (a.perkiraan ? '<span>Perkiraan lokasi dari alamat, belum titik GPS.</span>' : '<span>Titik GPS dari dokumen.</span>') +
      '<a href="' + gmaps + '" target="_blank" rel="noopener">Buka di Google Maps ↗</a></div></div>');

    $('#detail').innerHTML =
      '<div class="d-top"><div class="a-code">' + esc(a.kode) + '</div><h2>' + esc(a.nama) + '</h2>' +
      '<p>' + esc(a.alamat) + ', ' + esc(a.kabupaten) + ', ' + esc(a.provinsi) + '</p>' + status(a) + '</div>' +
      '<div class="d-grid"><div class="panel">' + main + '</div><aside class="aside panel">' + aside + '</aside></div>';
    hydrateImages($('#detail'));
    buildMap(a);
  }
  /* Foto terenkripsi dibuka lewat SECURE_IMG (gate.js); tanpa gate, pakai alamat biasa */
  function imgUrl(path) { return window.SECURE_IMG ? window.SECURE_IMG(path) : Promise.resolve(path); }
  function hydrateImages(root) {
    Array.prototype.forEach.call(root.querySelectorAll('img[data-sec]'), function (im) {
      imgUrl(im.getAttribute('data-sec')).then(function (u) { im.src = u; }).catch(function () { im.alt = 'Foto gagal dimuat'; });
    });
  }
  $('#detail').addEventListener('click', function (e) {
    var b = e.target.closest('#photos button'); if (b) openLb(+b.dataset.i);
  });

  function destroyMap() { if (miniMap) { miniMap.remove(); miniMap = null; } }
  function buildMap(a) {
    destroyMap();
    if (!window.L || a.lat == null) return;
    miniMap = L.map('mini-map', { scrollWheelZoom: false, attributionControl: true }).setView([a.lat, a.lng], a.perkiraan ? 14 : 16);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(miniMap);
    L.marker([a.lat, a.lng], { icon: L.divIcon({ className: '', html: '<div class="pin' + (a.perkiraan ? ' approx' : '') + '"></div>', iconSize: [18, 18], iconAnchor: [9, 18] }) }).addTo(miniMap);
    if (a.perkiraan) L.circle([a.lat, a.lng], { radius: 400, color: '#29166F', weight: 1, dashArray: '4 4', fillOpacity: .06 }).addTo(miniMap);
    setTimeout(function () { if (miniMap) miniMap.invalidateSize(); }, 60);
  }

  /* Lightbox */
  function openLb(i) { curPhoto = i; $('#lightbox').hidden = false; showLb(); }
  function showLb() {
    var n = cur.foto.length; curPhoto = (curPhoto + n) % n;
    var f = cur.foto[curPhoto];
    var want = curPhoto; $('#lb-img').removeAttribute('src'); $('#lb-img').alt = f.caption;
    imgUrl(f.file).then(function (u) { if (curPhoto === want) $('#lb-img').src = u; });
    $('#lb-cap').textContent = f.caption + ' (' + (curPhoto + 1) + '/' + n + ')';
  }
  function closeLb() { $('#lightbox').hidden = true; }
  $('.lb-close').onclick = closeLb;
  $('.lb-prev').onclick = function () { curPhoto--; showLb(); };
  $('.lb-next').onclick = function () { curPhoto++; showLb(); };
  $('#lightbox').addEventListener('click', function (e) { if (e.target.id === 'lightbox') closeLb(); });
  document.addEventListener('keydown', function (e) {
    if ($('#lightbox').hidden) return;
    if (e.key === 'Escape') closeLb();
    if (e.key === 'ArrowLeft') { curPhoto--; showLb(); }
    if (e.key === 'ArrowRight') { curPhoto++; showLb(); }
  });

  /* koordinat.csv (opsional, menimpa koordinat di data.js) */
  function applyCsv(text) {
    var lines = text.replace(/\r/g, '').split('\n').filter(function (l) { return l.trim(); });
    if (lines.length < 2) return;
    var d = lines[0].indexOf(';') > -1 ? ';' : ',';
    var h = lines[0].split(d).map(function (x) { return norm(x).trim(); });
    var ik = h.indexOf('kode'), ila = h.findIndex(function (x) { return /^lat/.test(x); }), iln = h.findIndex(function (x) { return /^(lon|lng)/.test(x); });
    if (ik < 0 || ila < 0 || iln < 0) return;
    lines.slice(1).forEach(function (l) {
      var c = l.split(d), k = norm(c[ik]).trim();
      var num = function (v) { v = String(v || '').trim(); if (d === ';') v = v.replace(',', '.'); return v ? parseFloat(v) : NaN; };
      var la = num(c[ila]), ln = num(c[iln]);
      if (!k || isNaN(la) || isNaN(ln)) return;
      var a = ALL.find(function (x) { return x.id === k || x.kode_list.some(function (y) { return norm(y) === k; }); });
      if (a) { a.lat = la; a.lng = ln; a.perkiraan = false; }
    });
  }

  function boot() { route(); }
  boot();
})();
