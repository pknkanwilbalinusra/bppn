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
  (function () {
    var hit = {};
    ALL.forEach(function (a) { hit[a.kategori] = (hit[a.kategori] || 0) + 1; a._no = hit[a.kategori]; });
  })();
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

  function judulKategori() {
    $('#judul').textContent = KAT[kat].judul;
    $('#foot').textContent = 'Sumber: ' + KAT[kat].judul + ', ' + DATA.meta.periode + ' — ' + DATA.meta.instansi + '. Peta © OpenStreetMap.';
  }
  function ringkasKategori() {
    var bidang = ASET.reduce(function (n, a) { return n + a.kode_list.length; }, 0);
    var nb = ASET.filter(function (a) { return a.provinsi === 'Bali'; }).length;
    var nn = ASET.filter(function (a) { return a.provinsi === 'Nusa Tenggara Barat'; }).length;
    $('#summary').innerHTML = [
      [ASET.length, 'Profil aset'], [bidang, 'Bidang aset'],
      [nb, 'Profil di Bali'], [nn, 'Profil di NTB']
    ].map(function (x) { return '<div class="stat"><b>' + x[0] + '</b><span>' + x[1] + '</span></div>'; }).join('');
  }
  function setKategori(k) {
    if (!KAT[k]) k = KAT_KEYS[0];
    var changed = k !== kat || !ASET.length;
    kat = k;
    ASET = ALL.filter(function (a) { return a.kategori === k; });
    Array.prototype.forEach.call(document.querySelectorAll('.kat-tab'), function (t) {
      var on = t.dataset.kat === k; t.classList.toggle('on', on); t.setAttribute('aria-selected', on);
    });
    if (!petaAktif) judulKategori();
    if (!changed) return;
    if (!petaAktif) ringkasKategori();
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

  function filtered(base) {
    var q = norm($('#q').value).trim(), p = $('#f-prov').value, st = $('#f-status').value;
    return (base || ASET).filter(function (a) {
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
    if (petaAktif && petaSiap) { ringkasPeta(); petaMuat(); }
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
      if (petaAktif && bigMap) setTimeout(function () { bigMap.invalidateSize(); gambarTitik(); }, 50);
      document.title = KAT[k].judul;
    }
  }


  /* ---------- Peta sebaran seluruh aset (PPA, BPPN, BDL dalam satu peta) ---------- */
  var WARNA_KAT = { PPA: '#1D4ED8', BPPN: '#EAB308', BDL: '#15803D' };
  var bigMap = null, bigLayer = null, petaAktif = false, petaIsi = [], petaSiap = false;
  var petaKat = {}, pilihAset = null;
  KAT_KEYS.forEach(function (k) { petaKat[k] = true; });

  var LAPIS = {
    'Peta jalan': function () {
      return L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' });
    },
    'Satelit': function () {
      return L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 19, attribution: 'Citra © Esri, Maxar, Earthstar Geographics' });
    }
  };
  function warnaKat(k) { return WARNA_KAT[k] || '#29166F'; }
  function labelKat(k) { return KAT[k] ? KAT[k].label : k; }

  /* pin lokasi bernomor, bentuknya seperti penanda pada peta umum */
  function pinSvg(a, pilih) {
    var w = warnaKat(a.kategori), no = String(a._no || ''), ukuran = no.length > 2 ? 10.5 : 12.5;
    return '<span class="pin-bungkus' + (pilih ? ' pin-pilih' : '') + '">' +
      '<svg width="30" height="42" viewBox="0 0 30 42" aria-hidden="true">' +
      '<path d="M15 40.5C15 40.5 27.5 25 27.5 15A12.5 12.5 0 1 0 2.5 15C2.5 25 15 40.5 15 40.5Z" fill="' + w + '" stroke="#fff" stroke-width="2.4"/>' +
      (a.perkiraan ? '<circle cx="15" cy="15" r="12.5" fill="none" stroke="#fff" stroke-width="1.4" stroke-dasharray="3 3"/>' : '') +
      '<text x="15" y="19.6" text-anchor="middle" font-family="inherit" font-size="' + ukuran + '" font-weight="800" fill="#fff">' + esc(no) + '</text>' +
      '</svg></span>';
  }

  function buatPetaBesar() {
    if (bigMap || !window.L) return;
    bigMap = L.map('big-map', { scrollWheelZoom: true, zoomControl: true });
    var dasar = {};
    Object.keys(LAPIS).forEach(function (n) { dasar[n] = LAPIS[n](); });
    dasar['Peta jalan'].addTo(bigMap);
    L.control.layers(dasar, null, { position: 'topright' }).addTo(bigMap);
    bigLayer = L.layerGroup().addTo(bigMap);
    bigMap.setView([-8.55, 115.8], 9);
    /* titik dikelompokkan memakai koordinat lapisan, yang hanya berubah saat zoom */
    bigMap.on('zoomend', gambarTitik);
    bigMap.on('click', tutupPanel);
    petaSiap = true;
  }

  /* kelompokkan pin yang berdekatan di layar agar tidak bertumpuk */
  function kelompok(list) {
    var sel = {}, hasil = [];
    list.forEach(function (a) {
      var p = bigMap.latLngToLayerPoint([a.lat, a.lng]);
      var k = Math.round(p.x / 46) + '_' + Math.round(p.y / 56);
      (sel[k] = sel[k] || []).push(a);
    });
    Object.keys(sel).forEach(function (k) { hasil.push(sel[k]); });
    return hasil;
  }
  function gambarTitik() {
    if (!bigMap || !bigLayer) return;
    bigLayer.clearLayers();
    kelompok(petaIsi).forEach(function (g) {
      if (g.length === 1) {
        var a = g[0];
        L.marker([a.lat, a.lng], {
          icon: L.divIcon({ className: '', iconSize: [30, 42], iconAnchor: [15, 42], html: pinSvg(a, pilihAset === a) }),
          title: labelKat(a.kategori) + ' ' + a._no + ' — ' + a.nama,
          riseOnHover: true
        }).on('click', function (e) { if (e.originalEvent) e.originalEvent.stopPropagation(); bukaPanel(a); }).addTo(bigLayer);
      } else {
        var lat = 0, lng = 0;
        g.forEach(function (x) { lat += x.lat; lng += x.lng; });
        var n = g.length, besar = n > 24 ? 46 : n > 9 ? 40 : 34;
        L.marker([lat / n, lng / n], {
          icon: L.divIcon({
            className: '', iconSize: [besar, besar], iconAnchor: [besar / 2, besar / 2],
            html: '<span class="gugus" style="width:' + besar + 'px;height:' + besar + 'px">' + n + '</span>'
          }),
          title: n + ' aset di sekitar sini — klik untuk memperbesar'
        }).on('click', function (e) {
          if (e.originalEvent) e.originalEvent.stopPropagation();
          var b = L.latLngBounds(g.map(function (x) { return [x.lat, x.lng]; }));
          bigMap.fitBounds(b.pad(0.3), { maxZoom: Math.min(18, bigMap.getZoom() + 4) });
        }).addTo(bigLayer);
      }
    });
  }

  /* ---------- Panel samping saat pin diklik ---------- */
  var panelFoto = 0;
  function tutupPanel() {
    pilihAset = null; panelFoto = 0;
    var el = $('#map-panel'); if (el) { el.hidden = true; el.innerHTML = ''; }
    if (bigLayer) gambarTitik();
  }
  function gambarPanel() {
    var a = pilihAset; if (!a) return;
    var el = $('#map-panel'); if (!el) return;
    var foto = a.foto || [], n = foto.length;
    var w = warnaKat(a.kategori);
    el.hidden = false;
    el.innerHTML =
      '<button type="button" class="panel-tutup" id="panel-tutup" aria-label="Tutup">✕</button>' +
      (n
        ? '<div class="panel-foto"><img alt="' + esc(foto[0].caption || a.nama) + '">' +
          (n > 1 ? '<button type="button" class="panel-fnav panel-prev" aria-label="Foto sebelumnya">‹</button>' +
            '<button type="button" class="panel-fnav panel-next" aria-label="Foto berikutnya">›</button>' +
            '<span class="panel-fno"></span>' : '') + '</div>'
        : '<div class="panel-foto panel-kosong">Belum ada foto</div>') +
      '<div class="panel-isi">' +
      '<span class="panel-kat" style="background:' + w + '">' + esc(labelKat(a.kategori)) + ' · ' + esc(String(a._no)) + '</span>' +
      '<div class="panel-kode">' + esc(a.kode) + '</div>' +
      '<h3 class="panel-nama">' + esc(a.nama) + '</h3>' +
      '<p class="panel-alamat">' + esc(a.alamat) + ', ' + esc(a.kabupaten) + ', ' + esc(a.provinsi) + '</p>' +
      '<div class="panel-status">' + status(a) + '</div>' +
      '<dl class="panel-kv">' +
      '<dt>Jenis aset</dt><dd>' + esc(a.jenis) + '</dd>' +
      '<dt>Luas tanah</dt><dd>' + esc(clean(a.luas_tanah)) + '</dd>' +
      '<dt>Luas bangunan</dt><dd>' + esc(clean(a.luas_bangunan)) + '</dd>' +
      '<dt>Koordinat</dt><dd>' + (a.lat == null ? '–' : (+a.lat).toFixed(6) + ', ' + (+a.lng).toFixed(6)) + '</dd>' +
      '</dl>' +
      (a.perkiraan ? '<p class="panel-kira">Titik perkiraan dari alamat, belum titik GPS.</p>' : '') +
      '<a class="panel-btn" href="#' + esc(a.id) + '" id="panel-detail">Detail aset ›</a>' +
      '</div>';
    muatFotoPanel();
  }
  function muatFotoPanel() {
    var a = pilihAset; if (!a || !a.foto || !a.foto.length) return;
    var n = a.foto.length;
    panelFoto = (panelFoto + n) % n;
    var im = $('#map-panel .panel-foto img'); if (!im) return;
    var no = $('#map-panel .panel-fno'); if (no) no.textContent = (panelFoto + 1) + '/' + n;
    var mau = panelFoto;
    im.removeAttribute('src');
    imgUrl(a.foto[panelFoto].file).then(function (u) { if (panelFoto === mau && pilihAset === a) im.src = u; })
      .catch(function () { im.alt = 'Foto gagal dimuat'; });
  }
  function bukaPanel(a) {
    pilihAset = a; panelFoto = 0;
    gambarPanel(); gambarTitik();
    var ll = [a.lat, a.lng];
    if (!bigMap.getBounds().pad(-0.15).contains(ll)) bigMap.panTo(ll, { animate: true });
    /* di layar kecil panel muncul di bawah peta, jadi digulir agar langsung terlihat */
    if (window.matchMedia && window.matchMedia('(max-width:860px)').matches) {
      setTimeout(function () {
        var el = $('#map-panel');
        if (el && !el.hidden) el.scrollIntoView({ block: 'end', behavior: 'smooth' });
      }, 80);
    }
  }
  $('#map-panel').addEventListener('click', function (e) {
    if (e.target.closest('#panel-tutup')) { tutupPanel(); return; }
    if (e.target.closest('.panel-prev')) { panelFoto--; muatFotoPanel(); return; }
    if (e.target.closest('.panel-next')) { panelFoto++; muatFotoPanel(); return; }
    if (e.target.closest('#panel-detail')) { listScroll = window.scrollY; }
  });

  /* ---------- Isi peta, legenda, dan keterangan ---------- */
  function petaSumber() {
    return filtered(ALL).filter(function (a) { return petaKat[a.kategori] !== false; });
  }
  function petaMuat() {
    var list = petaSumber();
    petaIsi = list.filter(function (a) { return a.lat != null; });
    if (pilihAset && petaIsi.indexOf(pilihAset) < 0) tutupPanel();
    var kira = petaIsi.filter(function (a) { return a.perkiraan; }).length;
    var tanpa = list.length - petaIsi.length;
    var info = $('#map-info');
    if (info) {
      info.textContent = petaIsi.length + ' aset tampil di peta' +
        (kira ? ', ' + kira + ' di antaranya titik perkiraan dari alamat' : '') +
        (tanpa ? '. ' + tanpa + ' aset belum punya koordinat' : '') +
        '. Klik pin untuk melihat ringkasannya.';
    }
    gambarLegenda();
    gambarTitik();
  }
  function gambarLegenda() {
    var leg = $('#map-legend'); if (!leg) return;
    var dasar = filtered(ALL);
    leg.innerHTML = KAT_KEYS.map(function (k) {
      var n = dasar.filter(function (a) { return a.kategori === k && a.lat != null; }).length;
      return '<label class="kat-cek"><input type="checkbox" data-kat="' + k + '"' + (petaKat[k] !== false ? ' checked' : '') + '>' +
        '<span class="kat-pin" style="background:' + warnaKat(k) + '"></span>' +
        esc(labelKat(k)) + ' <b>' + n + '</b></label>';
    }).join('');
  }
  $('#map-legend').addEventListener('change', function (e) {
    var c = e.target.closest('input[data-kat]'); if (!c) return;
    petaKat[c.dataset.kat] = c.checked;
    petaMuat();
  });

  function petaFit() {
    if (!bigMap || !petaIsi.length) return;
    bigMap.fitBounds(L.latLngBounds(petaIsi.map(function (a) { return [a.lat, a.lng]; })).pad(0.12), { maxZoom: 15 });
  }
  function ringkasPeta() {
    var dasar = filtered(ALL);
    var kotak = [['<b>' + dasar.length + '</b><span>Total profil aset</span>', 'var(--navy)']];
    KAT_KEYS.forEach(function (k) {
      kotak.push(['<b>' + dasar.filter(function (a) { return a.kategori === k; }).length + '</b><span>' + esc(labelKat(k)) + '</span>', warnaKat(k)]);
    });
    $('#summary').innerHTML = kotak.map(function (x) {
      return '<div class="stat" style="border-top-color:' + x[1] + '">' + x[0] + '</div>';
    }).join('');
  }
  function setTampilan(mode, fit) {
    petaAktif = mode === 'peta';
    $('#table-wrap').hidden = petaAktif;
    $('#map-wrap').hidden = !petaAktif;
    $('#count').hidden = petaAktif;
    $('#kat-tabs').hidden = petaAktif;
    $('#tb-tabel').classList.toggle('on', !petaAktif);
    $('#tb-peta').classList.toggle('on', petaAktif);
    $('#tb-tabel').setAttribute('aria-pressed', !petaAktif);
    $('#tb-peta').setAttribute('aria-pressed', petaAktif);
    try { sessionStorage.setItem('aset-tampilan', mode); } catch (e) {}
    if (!petaAktif) {
      judulKategori(); ringkasKategori();
      return;
    }
    $('#judul').textContent = 'Peta Sebaran Aset Properti';
    $('#foot').textContent = 'Sumber: ' + KAT_KEYS.map(function (k) { return labelKat(k); }).join(', ') +
      ', ' + DATA.meta.periode + ' — ' + DATA.meta.instansi + '. Peta © OpenStreetMap.';
    ringkasPeta();
    buatPetaBesar();
    setTimeout(function () {
      if (!bigMap) return;
      bigMap.invalidateSize();
      petaMuat();
      if (fit !== false) petaFit();
    }, 40);
  }
  $('#tb-tabel').addEventListener('click', function () { setTampilan('tabel'); });
  $('#tb-peta').addEventListener('click', function () { setTampilan('peta'); });
  $('#map-semua').addEventListener('click', petaFit);

  /* ---------- Hak mengisi (mode isi) ---------- */
  function bisaUbah() { return !window.ASET_AKUN || window.ASET_AKUN.bisaUbah(); }
  function perluToken() { return !!(window.ASET_AKUN && window.ASET_AKUN.perluToken); }
  function catatanBaca() {
    return '<span class="tag-warn">Hanya baca</span> Klik <b>Mode isi</b> di pojok kanan atas dan tempelkan token GitHub untuk mengisi atau mengubah.';
  }
  function aturTombolMode() {
    var b = $('#mode-isi'); if (!b) return;
    if (!perluToken()) { b.hidden = true; return; }
    b.hidden = false;
    b.textContent = window.ASET_AKUN.punyaToken() ? 'Keluar mode isi' : 'Mode isi';
  }
  function bukaTokbox(buka) {
    $('#tokbox').hidden = !buka;
    $('#tok-err').hidden = true;
    if (buka) { $('#tok-in').value = ''; $('#tok-in').focus(); }
  }
  $('#mode-isi').addEventListener('click', function (e) {
    e.preventDefault();
    if (window.ASET_AKUN.punyaToken()) {
      window.ASET_AKUN.keluar(); aturTombolMode();
      if (cur) renderDetail(cur);
      return;
    }
    bukaTokbox(true);
  });
  $('#tok-batal').addEventListener('click', function () { bukaTokbox(false); });
  $('#tokbox').addEventListener('click', function (e) { if (e.target.id === 'tokbox') bukaTokbox(false); });
  $('#tok-lihat').addEventListener('click', function () {
    var i = $('#tok-in'), lihat = i.type === 'password';
    i.type = lihat ? 'text' : 'password'; this.textContent = lihat ? 'Sembunyikan' : 'Tampilkan';
  });
  $('#tok-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var b = $('#tok-btn');
    b.disabled = true; b.textContent = 'Memeriksa…'; $('#tok-err').hidden = true;
    window.ASET_AKUN.masuk($('#tok-in').value).then(function () {
      bukaTokbox(false); aturTombolMode();
      if (cur) renderDetail(cur);
    }).catch(function (err) {
      $('#tok-err').textContent = err.message || 'Token tidak dapat dipakai.';
      $('#tok-err').hidden = false;
    }).then(function () { b.disabled = false; b.textContent = 'Masuk mode isi'; });
  });

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
      '</dl>' +
      '<div class="nilai" id="nilai">' +
      '<h4>Penilaian aset</h4>' +
      '<p class="nilai-info" id="nilai-info"></p>' +
      '<div class="nilai-grid">' +
      '<label class="nilai-f"><span>Nilai Aset</span><input id="nilai-rp" maxlength="80" placeholder="Contoh: 1.250.000.000" autocomplete="off"></label>' +
      '<label class="nilai-f"><span>Nomor Dokumen Penilaian</span><input id="nilai-dok" maxlength="120" placeholder="Contoh: LP-123/KNL.17/2026" autocomplete="off"></label>' +
      '<label class="nilai-f"><span>Tanggal Penilaian</span><input id="nilai-tgl" type="date"></label>' +
      '</div>' +
      '<div class="nilai-aksi" id="nilai-aksi"><input id="nilai-nama" maxlength="60" placeholder="Nama pengisi (opsional)" autocomplete="off">' +
      '<button type="button" class="upd-simpan" id="nilai-simpan">Simpan penilaian</button>' +
      '<button type="button" class="upd-batal" id="nilai-kosong">Kosongkan</button></div>' +
      '<p class="upd-pesan" id="nilai-pesan" hidden></p>' +
      '<p class="nilai-meta" id="nilai-meta"></p>' +
      '</div></div>' +
      (a.dokumen.length ? '<div class="sec"><h3>Dokumen kepemilikan</h3><ul>' + li(a.dokumen) + '</ul></div>' : '') +
      '<div class="sec upd"><h3>Permasalahan dan perkembangan</h3>' +
      '<p class="upd-info" id="upd-info"></p>' +
      '<ol class="upd-list" id="upd-list"><li class="upd-kosong">Memuat…</li></ol>' +
      '<p class="upd-pulih" id="upd-pulih" hidden></p>' +
      '<form class="upd-form" id="upd-form" autocomplete="off">' +
      '<label class="upd-label" for="upd-teks">Tambahkan baris baru</label>' +
      '<textarea id="upd-teks" rows="3" maxlength="2000" placeholder="Contoh: 12 Oktober 2026 dilakukan pemeriksaan fisik, plang masih terpasang."></textarea>' +
      '<div class="upd-aksi"><input id="upd-nama" maxlength="60" placeholder="Nama penulis (opsional)">' +
      '<button type="submit" class="upd-simpan" id="upd-simpan">Simpan</button></div>' +
      '<p class="upd-pesan" id="upd-pesan" hidden></p></form></div>';

    var gmaps = 'https://www.google.com/maps?q=' + a.lat + ',' + a.lng;
    var aside =
      '<div class="sec fto-sec"><h3 id="fto-judul">Foto</h3>' +
      '<div class="photos" id="photos"><p class="cap">Memuat foto…</p></div>' +
      '<p class="cap" id="fto-cap"></p>' +
      '<div class="fto-form"><label class="upd-label" for="fto-file">Tambah foto</label>' +
      '<input type="file" id="fto-file" accept="image/*" multiple>' +
      '<input id="fto-ket" maxlength="120" placeholder="Keterangan foto (opsional)">' +
      '<button type="button" class="upd-simpan" id="fto-unggah">Unggah foto</button>' +
      '<p class="upd-pesan" id="fto-pesan" hidden></p></div></div>' +
      (a.lat == null ? '<div class="sec"><h3>Lokasi</h3><p class="cap">Titik koordinat belum tersedia.</p></div>' : '<div class="sec"><h3>Lokasi</h3><div id="mini-map"></div><div class="map-links">' +
      (a.perkiraan ? '<span>Perkiraan lokasi dari alamat, belum titik GPS.</span>' : '<span>Titik GPS dari dokumen.</span>') +
      '<a href="' + gmaps + '" target="_blank" rel="noopener">Buka di Google Maps ↗</a></div></div>');

    $('#detail').innerHTML =
      '<div class="d-top"><div class="a-code">' + esc(a.kode) + '</div><h2>' + esc(a.nama) + '</h2>' +
      '<p>' + esc(a.alamat) + ', ' + esc(a.kabupaten) + ', ' + esc(a.provinsi) + '</p>' + status(a) + '</div>' +
      '<div class="d-grid"><div class="panel">' + main + '</div><aside class="aside panel">' + aside + '</aside></div>';
    hydrateImages($('#detail'));
    buildMap(a);
    siapkanNilai(a);
    siapkanCatatan(a);
    siapkanFoto(a);
  }
  /* Foto terenkripsi dibuka lewat SECURE_IMG (gate.js); tanpa gate, pakai alamat biasa */
  function imgUrl(path) { return window.SECURE_IMG ? window.SECURE_IMG(path) : Promise.resolve(path); }
  function hydrateImages(root) {
    Array.prototype.forEach.call(root.querySelectorAll('img[data-sec]'), function (im) {
      imgUrl(im.getAttribute('data-sec')).then(function (u) { im.src = u; }).catch(function () { im.alt = 'Foto gagal dimuat'; });
    });
  }
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

  /* ---------- Permasalahan dan perkembangan (gabungan dokumen + tambahan pengguna) ---------- */
  var catRows = [], catEdit = null;
  function tglIndo(iso) {
    var b = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    var d = new Date(iso);
    if (isNaN(d)) return '-';
    var jam = ('0' + d.getHours()).slice(-2) + '.' + ('0' + d.getMinutes()).slice(-2);
    return d.getDate() + ' ' + b[d.getMonth()] + ' ' + d.getFullYear() + ', ' + jam;
  }
  function pesan(teks, jenis, sel) {
    var el = $(sel || '#upd-pesan'); if (!el) return;
    if (!teks) { el.hidden = true; el.textContent = ''; return; }
    el.hidden = false; el.textContent = teks;
    el.className = 'upd-pesan' + (jenis ? ' ' + jenis : '');
  }
  /* gabungkan baris dokumen dengan catatan tambahan/perubahan/penghapusan */
  function susunCatatan(a, rows) {
    var ovr = {}, del = {}, tambah = [];
    rows.forEach(function (r) {
      var d = r.data || {}, k = d.k || 'add';
      if (k === 'ovr' && typeof d.i === 'number') ovr[d.i] = r;
      else if (k === 'del' && typeof d.i === 'number') del[d.i] = r;
      else if (k === 'add') tambah.push(r);
    });
    var out = [], buang = [];
    a.catatan.forEach(function (teks, i) {
      if (del[i]) { buang.push(del[i].id); return; }
      var o = ovr[i];
      out.push(o
        ? { key: 'b' + i, idx: i, teks: String(o.data.t || ''), asal: 'ubah', rec: o.id, p: o.data.p || '', w: o.data.w || o.created_at }
        : { key: 'b' + i, idx: i, teks: teks, asal: 'dok', rec: null, p: '', w: null });
    });
    var waktu = function (r) { return String((r.data && r.data.w) || r.created_at || ''); };
    tambah.sort(function (x, y) { return waktu(x) < waktu(y) ? -1 : waktu(x) > waktu(y) ? 1 : (x.id > y.id ? 1 : -1); });
    tambah.forEach(function (r) {
      out.push({
        key: 'u' + r.id, idx: null, teks: String(r.data.t || ''), asal: 'user', rec: r.id,
        p: r.data.p || '', w: r.data.w || r.created_at, e: r.data.e || null
      });
    });
    out._buang = buang;
    return out;
  }
  function metaCatatan(it) {
    if (it.asal === 'dok') return 'Dari dokumen profil aset';
    if (it.asal === 'ubah') return 'Diubah ' + tglIndo(it.w) + (it.p ? ' · ' + it.p : '') + ' · asalnya dari dokumen';
    return tglIndo(it.w) + (it.p ? ' · ' + it.p : '') + (it.e ? ' · diubah ' + tglIndo(it.e) : '');
  }
  function gambarCatatan() {
    var ol = $('#upd-list'); if (!ol) return;
    if (!catRows.length) { ol.innerHTML = '<li class="upd-kosong">Belum ada catatan untuk aset ini.</li>'; }
    else {
      ol.innerHTML = catRows.map(function (it, i) {
        if (catEdit === it.key) {
          return '<li class="upd-item edit" data-key="' + esc(it.key) + '">' +
            '<span class="upd-no">' + (i + 1) + '.</span>' +
            '<div class="upd-isi"><textarea class="upd-edit-teks" rows="4" maxlength="2000">' + esc(it.teks) + '</textarea>' +
            '<div class="upd-aksi"><input class="upd-edit-nama" maxlength="60" placeholder="Nama pengubah (opsional)" value="' + esc(it.asal === 'user' ? it.p : '') + '">' +
            '<button type="button" class="upd-simpan upd-edit-simpan" data-key="' + esc(it.key) + '">Simpan perubahan</button>' +
            '<button type="button" class="upd-batal" data-key="' + esc(it.key) + '">Batal</button></div></div></li>';
        }
        return '<li class="upd-item" data-key="' + esc(it.key) + '">' +
          '<span class="upd-no">' + (i + 1) + '.</span>' +
          '<div class="upd-isi"><div class="upd-teks">' + esc(it.teks) + '</div>' +
          '<div class="upd-meta">' + esc(metaCatatan(it)) + '</div></div>' +
          (bisaUbah() ? '<div class="upd-tombol">' +
            '<button type="button" class="upd-ubah" data-key="' + esc(it.key) + '">Ubah</button>' +
            '<button type="button" class="upd-hapus" data-key="' + esc(it.key) + '">Hapus</button></div>' : '') + '</li>';
      }).join('');
    }
    var pul = $('#upd-pulih');
    if (pul) {
      var n = (catRows._buang || []).length;
      pul.hidden = !n;
      pul.innerHTML = n ? n + ' baris dari dokumen disembunyikan.' +
        (bisaUbah() ? ' <button type="button" class="upd-link" id="upd-pulihkan">Tampilkan kembali</button>' : '') : '';
    }
  }
  function muatCatatan(a) {
    var ol = $('#upd-list'); if (!ol) return;
    ol.innerHTML = '<li class="upd-kosong">Memuat…</li>';
    return window.ASET_UPDATES.list(a.id).then(function (rows) {
      if (cur !== a) return;
      catRows = susunCatatan(a, rows); catEdit = null; gambarCatatan();
      terapkanNilai(rows);
    }).catch(function (err) {
      ol.innerHTML = '<li class="upd-kosong">Gagal memuat catatan. ' + esc(err.message || '') + '</li>';
      pesan('Data penilaian gagal dimuat. ' + (err.message || ''), 'err', '#nilai-pesan');
    });
  }
  function siapkanCatatan(a) {
    catRows = []; catEdit = null;
    var pusat = window.ASET_UPDATES && window.ASET_UPDATES.pusat;
    $('#upd-info').innerHTML = !bisaUbah() ? catatanBaca()
      : (pusat
        ? 'Semua baris dapat diubah dan dihapus. Perubahan tersimpan bersama dan terlihat oleh semua pengguna yang punya akses.'
        : '<span class="tag-warn">Belum terhubung ke penyimpanan bersama</span> Perubahan hanya tersimpan di perangkat ini.');
    $('#upd-form').hidden = !bisaUbah();
    muatCatatan(a);
    $('#upd-form').onsubmit = function (e) {
      e.preventDefault();
      var teks = $('#upd-teks').value.trim();
      if (!teks) { pesan('Isi catatan dulu sebelum disimpan.', 'err'); return; }
      var tombol = $('#upd-simpan');
      tombol.disabled = true; tombol.textContent = 'Menyimpan…'; pesan('');
      window.ASET_UPDATES.add(a.id, { k: 'add', t: teks, p: $('#upd-nama').value.trim(), w: new Date().toISOString() })
        .then(function () { $('#upd-teks').value = ''; pesan('Catatan tersimpan.', 'ok'); return muatCatatan(a); })
        .catch(function (err) { pesan('Gagal menyimpan. ' + (err.message || ''), 'err'); })
        .then(function () { tombol.disabled = false; tombol.textContent = 'Simpan'; });
    };
  }
  function cariCat(key) { return catRows.filter(function (x) { return x.key === key; })[0]; }

  $('#detail').addEventListener('click', function (e) {
    var t = e.target, a = cur;
    if (!a) return;

    var ubah = t.closest('.upd-ubah');
    if (ubah) { catEdit = ubah.dataset.key; gambarCatatan(); var ta = $('#upd-list .upd-edit-teks'); if (ta) { ta.focus(); ta.selectionStart = ta.value.length; } return; }

    var batal = t.closest('.upd-batal');
    if (batal) { catEdit = null; gambarCatatan(); return; }

    var simpan = t.closest('.upd-edit-simpan');
    if (simpan) {
      var it = cariCat(simpan.dataset.key); if (!it) return;
      var li = simpan.closest('.upd-item');
      var teks = li.querySelector('.upd-edit-teks').value.trim();
      var nama = li.querySelector('.upd-edit-nama').value.trim();
      if (!teks) { pesan('Isi catatan tidak boleh kosong. Gunakan tombol Hapus bila ingin menghilangkan baris.', 'err'); return; }
      simpan.disabled = true; simpan.textContent = 'Menyimpan…'; pesan('');
      var hapusLama = it.rec ? window.ASET_UPDATES.del(a.id, it.rec) : Promise.resolve();
      var baru = it.idx === null
        ? { k: 'add', t: teks, p: nama || it.p, w: it.w, e: new Date().toISOString() }
        : { k: 'ovr', i: it.idx, t: teks, p: nama, w: new Date().toISOString() };
      hapusLama.then(function () { return window.ASET_UPDATES.add(a.id, baru); })
        .then(function () { pesan('Perubahan tersimpan.', 'ok'); return muatCatatan(a); })
        .catch(function (err) { simpan.disabled = false; simpan.textContent = 'Simpan perubahan'; pesan('Gagal menyimpan. ' + (err.message || ''), 'err'); });
      return;
    }

    var hapus = t.closest('.upd-hapus');
    if (hapus) {
      var h = cariCat(hapus.dataset.key); if (!h) return;
      if (!confirm('Hapus baris ini dari daftar?')) return;
      hapus.disabled = true; pesan('');
      var urut = h.rec ? window.ASET_UPDATES.del(a.id, h.rec) : Promise.resolve();
      urut.then(function () { return h.idx === null ? null : window.ASET_UPDATES.add(a.id, { k: 'del', i: h.idx, w: new Date().toISOString() }); })
        .then(function () { pesan('Baris dihapus.', 'ok'); return muatCatatan(a); })
        .catch(function (err) { hapus.disabled = false; pesan('Gagal menghapus. ' + (err.message || ''), 'err'); });
      return;
    }

    if (t.closest('#upd-pulihkan')) {
      window.ASET_UPDATES.delBanyak(a.id, catRows._buang || [])
        .then(function () { pesan('Baris dokumen ditampilkan kembali.', 'ok'); return muatCatatan(a); })
        .catch(function (err) { pesan('Gagal memulihkan. ' + (err.message || ''), 'err'); });
      return;
    }

    if (t.closest('#fto-pulihkan')) {
      window.ASET_FOTO.delBanyak(a.id, FOTO._buang || [])
        .then(function () { pesan('Foto dokumen ditampilkan kembali.', 'ok', '#fto-pesan'); return muatFoto(a); })
        .catch(function (err) { pesan('Gagal memulihkan foto. ' + (err.message || ''), 'err', '#fto-pesan'); });
      return;
    }

    var buka = t.closest('.fto-img');
    if (buka) { openLb(+buka.dataset.i); return; }

    var fdel = t.closest('.fto-del');
    if (fdel) {
      if (!confirm('Hapus foto ini?')) return;
      fdel.disabled = true; pesan('', '', '#fto-pesan');
      var ff = FOTO[+fdel.dataset.i]; if (!ff) return;
      var aksi = ff.t === 'up'
        ? window.ASET_FOTO.del(a.id, ff.id)
        : window.ASET_FOTO.add(a.id, { k: 'del', f: ff.file, w: new Date().toISOString() });
      aksi.then(function () { pesan('Foto dihapus.', 'ok', '#fto-pesan'); return muatFoto(a); })
        .catch(function (err) { fdel.disabled = false; pesan('Gagal menghapus foto. ' + (err.message || ''), 'err', '#fto-pesan'); });
    }
  });


  /* ---------- Penilaian aset: Nilai Aset, Nomor Dokumen, Tanggal ---------- */
  var nilaiRec = null;
  var BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  function tglPanjang(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
    if (!m) return iso || '';
    return (+m[3]) + ' ' + BULAN[+m[2] - 1] + ' ' + m[1];
  }
  /* angka saja dirapikan jadi format rupiah; teks lain dibiarkan apa adanya */
  function rapikanRupiah(v) {
    v = String(v || '').trim();
    if (!v) return '';
    if (!/^(rp\.?\s*)?[\d.,\s]+$/i.test(v)) return v;
    var angka = v.replace(/[^\d]/g, '');
    if (!angka) return v;
    return 'Rp ' + angka.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }
  function terapkanNilai(rows) {
    nilaiRec = null;
    (rows || []).forEach(function (r) {
      var d = r.data || {};
      if (d.k === 'nilai') nilaiRec = r;
    });
    var d = (nilaiRec && nilaiRec.data) || {};
    if ($('#nilai-rp')) $('#nilai-rp').value = d.n || '';
    if ($('#nilai-dok')) $('#nilai-dok').value = d.d || '';
    if ($('#nilai-tgl')) $('#nilai-tgl').value = d.g || '';
    var meta = $('#nilai-meta');
    if (meta) {
      meta.textContent = nilaiRec
        ? 'Diisi ' + tglIndo(d.w || nilaiRec.created_at) + (d.p ? ' oleh ' + d.p : '') +
          (d.g ? ' · tanggal penilaian ' + tglPanjang(d.g) : '')
        : 'Belum diisi.';
    }
  }
  function siapkanNilai(a) {
    nilaiRec = null;
    var pusat = window.ASET_UPDATES && window.ASET_UPDATES.pusat;
    $('#nilai-info').innerHTML = !bisaUbah() ? catatanBaca()
      : (pusat
        ? 'Ketik langsung di kotak di bawah ini, lalu klik Simpan penilaian. Isinya terlihat oleh semua pengguna yang punya akses.'
        : '<span class="tag-warn">Belum terhubung ke penyimpanan bersama</span> Isian hanya tersimpan di perangkat ini.');
    var boleh = bisaUbah();
    $('#nilai-aksi').hidden = !boleh;
    ['#nilai-rp', '#nilai-dok', '#nilai-tgl'].forEach(function (x) { $(x).disabled = !boleh; });
    $('#nilai-rp').value = ''; $('#nilai-dok').value = ''; $('#nilai-tgl').value = '';
    $('#nilai-meta').textContent = 'Memuat…';
    pesan('', '', '#nilai-pesan');

    $('#nilai-rp').onblur = function () { this.value = rapikanRupiah(this.value); };
    $('#nilai-simpan').onclick = function () { simpanNilai(a, false); };
    $('#nilai-kosong').onclick = function () {
      if (!confirm('Kosongkan ketiga isian penilaian untuk aset ini?')) return;
      simpanNilai(a, true);
    };
  }
  function simpanNilai(a, kosongkan) {
    var tombol = $('#nilai-simpan'), hapus = $('#nilai-kosong');
    var n = kosongkan ? '' : rapikanRupiah($('#nilai-rp').value);
    var d = kosongkan ? '' : $('#nilai-dok').value.trim();
    var g = kosongkan ? '' : $('#nilai-tgl').value;
    var p = $('#nilai-nama').value.trim();
    if (!kosongkan && !n && !d && !g) { pesan('Isi dulu salah satu kotak sebelum disimpan.', 'err', '#nilai-pesan'); return; }
    tombol.disabled = true; hapus.disabled = true;
    tombol.textContent = 'Menyimpan…'; pesan('', '', '#nilai-pesan');
    var lama = nilaiRec ? window.ASET_UPDATES.del(a.id, nilaiRec.id) : Promise.resolve();
    var tulis = (kosongkan && !nilaiRec)
      ? Promise.resolve()
      : lama.then(function () {
        if (kosongkan) return null;
        return window.ASET_UPDATES.add(a.id, { k: 'nilai', n: n, d: d, g: g, p: p, w: new Date().toISOString() });
      });
    tulis.then(function () {
      pesan(kosongkan ? 'Isian penilaian dikosongkan.' : 'Penilaian tersimpan.', 'ok', '#nilai-pesan');
      return muatCatatan(a);
    }).catch(function (err) {
      pesan('Gagal menyimpan. ' + (err.message || ''), 'err', '#nilai-pesan');
    }).then(function () {
      tombol.disabled = false; hapus.disabled = false; tombol.textContent = 'Simpan penilaian';
    });
  }

  /* ---------- Foto: tampilkan, hapus, unggah ---------- */
  var FOTO = [], upUrl = {};
  function susunFoto(a, rows) {
    var buang = {}, tambah = [], recBuang = [];
    rows.forEach(function (r) {
      var d = r.data || {};
      if (d.k === 'del' && d.f) { buang[d.f] = 1; recBuang.push(r.id); }
      else if (d.d) tambah.push(r);
    });
    var out = a.foto.filter(function (f) { return !buang[f.file]; })
      .map(function (f) { return { t: 'dok', file: f.file, thumb: f.thumb || f.file, caption: f.caption }; });
    var waktu = function (r) { return String((r.data && r.data.w) || r.created_at || ''); };
    tambah.sort(function (x, y) { return waktu(x) < waktu(y) ? -1 : 1; });
    tambah.forEach(function (r) {
      out.push({ t: 'up', id: r.id, caption: r.data.c || 'Foto unggahan', data: r.data.d, w: waktu(r) });
    });
    out._buang = recBuang;
    return out;
  }
  function fotoUrl(f) {
    if (f.t === 'dok') return imgUrl(f.file);
    if (!upUrl[f.id]) upUrl[f.id] = Promise.resolve(f.data);
    return upUrl[f.id];
  }
  function gambarFoto() {
    var box = $('#photos'); if (!box) return;
    $('#fto-judul').textContent = 'Foto (' + FOTO.length + ')';
    var nb = (FOTO._buang || []).length;
    $('#fto-cap').innerHTML = (FOTO.length ? 'Klik foto untuk memperbesar.' : 'Belum ada foto untuk aset ini.') +
      (nb ? ' <br>' + nb + ' foto dokumen disembunyikan. <button type="button" class="upd-link" id="fto-pulihkan">Tampilkan kembali</button>' : '');
    box.innerHTML = FOTO.map(function (f, i) {
      return '<figure class="fto">' +
        '<button type="button" class="fto-img" data-i="' + i + '" aria-label="Perbesar foto: ' + esc(f.caption) + '"><img alt="' + esc(f.caption) + '"></button>' +
        (bisaUbah() ? '<button type="button" class="fto-del" data-i="' + i + '" title="Hapus foto ini">Hapus</button>' : '') +
        (f.t === 'up' ? '<figcaption class="fto-tag">Unggahan</figcaption>' : '') +
        '</figure>';
    }).join('');
    FOTO.forEach(function (f, i) {
      var im = box.querySelectorAll('.fto-img img')[i];
      if (!im) return;
      fotoUrl(f).then(function (u) { im.src = u; }).catch(function () { im.alt = 'Foto gagal dimuat'; });
    });
  }
  function muatFoto(a) {
    var box = $('#photos'); if (!box) return;
    return window.ASET_FOTO.list(a.id).then(function (rows) {
      if (cur !== a) return;
      FOTO = susunFoto(a, rows); gambarFoto();
    }).catch(function (err) {
      FOTO = a.foto.map(function (f) { return { t: 'dok', file: f.file, thumb: f.thumb || f.file, caption: f.caption }; });
      gambarFoto();
      pesan('Daftar foto unggahan gagal dimuat. ' + (err.message || ''), 'err', '#fto-pesan');
    });
  }
  /* perkecil foto di browser supaya ringan disimpan dan dibuka */
  function kecilkan(file) {
    return new Promise(function (ok, gagal) {
      var fr = new FileReader();
      fr.onerror = function () { gagal(new Error('Berkas tidak dapat dibaca.')); };
      fr.onload = function () {
        var im = new Image();
        im.onerror = function () { gagal(new Error('Berkas ini bukan gambar yang dikenali.')); };
        im.onload = function () {
          var maxSisi = 1400;
          function render(sisi, mutu) {
            var s = Math.min(1, sisi / Math.max(im.width, im.height));
            var c = document.createElement('canvas');
            c.width = Math.max(1, Math.round(im.width * s));
            c.height = Math.max(1, Math.round(im.height * s));
            c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
            return c.toDataURL('image/jpeg', mutu);
          }
          var mutu = 0.8, out = render(maxSisi, mutu);
          while (out.length > 560000 && mutu > 0.45) { mutu -= 0.1; out = render(maxSisi, mutu); }
          if (out.length > 560000) out = render(1000, 0.7);
          if (out.length > 900000) { gagal(new Error('Foto terlalu besar untuk disimpan.')); return; }
          ok(out);
        };
        im.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }
  function siapkanFoto(a) {
    FOTO = []; upUrl = {};
    var form = document.querySelector('#detail .fto-form');
    if (form) form.hidden = !bisaUbah();
    muatFoto(a);
    var tombol = $('#fto-unggah'); if (!tombol) return;
    tombol.onclick = function () {
      var inp = $('#fto-file'), ket = $('#fto-ket');
      var files = Array.prototype.slice.call(inp.files || []);
      if (!files.length) { pesan('Pilih berkas foto dulu.', 'err', '#fto-pesan'); return; }
      if (!window.ASET_FOTO.pusat && !confirm('Penyimpanan terpusat belum aktif, foto hanya tersimpan di perangkat ini dan ruangnya terbatas. Lanjutkan?')) return;
      tombol.disabled = true; pesan('Menyiapkan foto…', '', '#fto-pesan');
      var n = 0;
      files.reduce(function (p, f, i) {
        return p.then(function () {
          pesan('Mengunggah ' + (i + 1) + ' dari ' + files.length + '…', '', '#fto-pesan');
          return kecilkan(f).then(function (dataUrl) {
            var c = ket.value.trim() || f.name.replace(/\.[^.]+$/, '');
            return window.ASET_FOTO.add(a.id, { k: 'add', c: c, d: dataUrl, w: new Date().toISOString() });
          }).then(function () { n++; });
        });
      }, Promise.resolve())
        .then(function () { inp.value = ''; ket.value = ''; pesan(n + ' foto tersimpan.', 'ok', '#fto-pesan'); return muatFoto(a); })
        .catch(function (err) { pesan('Gagal mengunggah. ' + (err.message || ''), 'err', '#fto-pesan'); })
        .then(function () { tombol.disabled = false; });
    };
  }

  /* Lightbox */
  function openLb(i) { if (!FOTO.length) return; curPhoto = i; $('#lightbox').hidden = false; showLb(); }
  function showLb() {
    var n = FOTO.length; if (!n) { closeLb(); return; }
    curPhoto = (curPhoto + n) % n;
    var f = FOTO[curPhoto];
    var want = curPhoto; $('#lb-img').removeAttribute('src'); $('#lb-img').alt = f.caption;
    fotoUrl(f).then(function (u) { if (curPhoto === want) $('#lb-img').src = u; });
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

  function boot() {
    aturTombolMode();
    route();
    var simpan = null;
    try { simpan = sessionStorage.getItem('aset-tampilan'); } catch (e) {}
    setTampilan(simpan === 'tabel' ? 'tabel' : 'peta');
  }
  boot();
})();
