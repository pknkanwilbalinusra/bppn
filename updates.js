/* Penyimpanan catatan, penilaian, dan foto unggahan.
   Tiga cara, dipilih otomatis dari config.js:
   1. GH_REPO diisi  -> disimpan di repository GitHub itu sendiri. Semua orang bisa
      membaca; yang ingin mengisi menempelkan token GitHub sekali per sesi.
   2. SUPABASE_* diisi -> disimpan di Supabase.
   3. keduanya kosong  -> disimpan di perangkat masing-masing (localStorage).
   Isi selalu dienkripsi di browser memakai password halaman. */
(function () {
  'use strict';
  var GH = String(window.GH_REPO || '').trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '').replace(/\/+$/, '');
  var BR = String(window.GH_BRANCH || 'main').trim() || 'main';
  var SB = String(window.SUPABASE_URL || '').replace(/\/+$/, '');
  var SK = String(window.SUPABASE_KEY || '');
  var API = String(window.GH_API || 'https://api.github.com');
  var RAW = String(window.GH_RAW || 'https://raw.githubusercontent.com');
  var MODE = GH ? 'github' : ((SB && SK) ? 'supabase' : 'lokal');
  var TOK = 'aset-gh-token';

  /* ---------- alat bantu ---------- */
  function encTeks(obj) {
    var teks = JSON.stringify(obj);
    return (window.SECURE_TEXT && window.SECURE_TEXT.enc) ? window.SECURE_TEXT.enc(teks) : Promise.resolve(teks);
  }
  function decTeks(s) {
    if (window.SECURE_TEXT && window.SECURE_TEXT.dec && /^[A-Za-z0-9+/=\s]+$/.test(s) && s.length > 24) {
      return window.SECURE_TEXT.dec(s.replace(/\s+/g, '')).then(function (t) { return JSON.parse(t); })
        .catch(function () { return null; });
    }
    try { return Promise.resolve(JSON.parse(s)); } catch (e) { return Promise.resolve(null); }
  }
  function idBaru() { return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function b64(teks) { return btoa(unescape(encodeURIComponent(teks))); }
  function lsBaca(k) { try { return JSON.parse(localStorage.getItem(k) || '{}'); } catch (e) { return {}; } }
  function lsTulis(k, o) {
    try { localStorage.setItem(k, JSON.stringify(o)); return null; }
    catch (e) { return new Error('Penyimpanan browser penuh. Hubungkan ke penyimpanan bersama agar data bisa disimpan.'); }
  }

  /* ---------- akun pengisi (hanya untuk mode GitHub) ---------- */
  function token() { try { return sessionStorage.getItem(TOK) || ''; } catch (e) { return ''; } }
  function ghHead(t) {
    return { Authorization: 'Bearer ' + (t || token()), Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  }
  window.ASET_AKUN = {
    mode: MODE,
    repo: GH,
    perluToken: MODE === 'github',
    bisaUbah: function () { return MODE !== 'github' || !!token(); },
    punyaToken: function () { return !!token(); },
    masuk: function (t) {
      t = String(t || '').trim();
      if (!t) return Promise.reject(new Error('Token belum diisi.'));
      return fetch(API + '/repos/' + GH, { headers: ghHead(t) }).then(function (r) {
        if (r.status === 401) throw new Error('Token tidak dikenali atau sudah kedaluwarsa.');
        if (r.status === 404) throw new Error('Token tidak punya akses ke repository ' + GH + '.');
        if (!r.ok) throw new Error('GitHub menolak (' + r.status + ').');
        return r.json();
      }).then(function (d) {
        if (d && d.permissions && d.permissions.push === false) {
          throw new Error('Token ini hanya bisa membaca. Buat token dengan izin Contents: Read and write.');
        }
        try { sessionStorage.setItem(TOK, t); } catch (e) {}
        return true;
      });
    },
    keluar: function () { try { sessionStorage.removeItem(TOK); } catch (e) {} }
  };

  /* ---------- GitHub: satu berkas indeks per aset ---------- */
  var shaIndeks = {};
  function ghBacaIndeks(path) {
    var t = token();
    if (t) {
      return fetch(API + '/repos/' + GH + '/contents/' + path + '?ref=' + encodeURIComponent(BR), { headers: ghHead(t) })
        .then(function (r) {
          if (r.status === 404) { shaIndeks[path] = null; return null; }
          if (!r.ok) throw new Error('Gagal membaca dari GitHub (' + r.status + ').');
          return r.json().then(function (d) {
            shaIndeks[path] = d.sha;
            return atob(String(d.content || '').replace(/\s+/g, ''));
          });
        });
    }
    return fetch(RAW + '/' + GH + '/' + BR + '/' + path + '?t=' + Date.now())
      .then(function (r) { return r.ok ? r.text() : null; })
      .catch(function () { return null; });
  }
  function ghTulisIndeks(path, teks, pesan) {
    var t = token();
    if (!t) return Promise.reject(new Error('Belum masuk sebagai pengisi. Klik "Mode isi" lebih dulu.'));
    var badan = { message: pesan, content: b64(teks), branch: BR };
    if (shaIndeks[path]) badan.sha = shaIndeks[path];
    return fetch(API + '/repos/' + GH + '/contents/' + path, {
      method: 'PUT', headers: ghHead(t), body: JSON.stringify(badan)
    }).then(function (r) {
      if (r.ok) return r.json().then(function (d) { if (d && d.content) shaIndeks[path] = d.content.sha; return true; });
      if (r.status === 409 || r.status === 422) { shaIndeks[path] = null; throw new Error('BENTROK'); }
      if (r.status === 401 || r.status === 403) throw new Error('Token ditolak GitHub. Periksa izin Contents: Read and write.');
      return r.text().then(function (x) { throw new Error('GitHub menolak (' + r.status + '). ' + x.slice(0, 140)); });
    });
  }
  function ghHapusBerkas(path) {
    var t = token(); if (!t) return Promise.resolve();
    return fetch(API + '/repos/' + GH + '/contents/' + path + '?ref=' + encodeURIComponent(BR), { headers: ghHead(t) })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d || !d.sha) return null;
        return fetch(API + '/repos/' + GH + '/contents/' + path, {
          method: 'DELETE', headers: ghHead(t),
          body: JSON.stringify({ message: 'Hapus ' + path, sha: d.sha, branch: BR })
        });
      }).catch(function () { return null; });
  }
  function ghBacaRows(path) {
    return ghBacaIndeks(path).then(function (isi) {
      if (!isi) return [];
      return decTeks(isi).then(function (o) { return (o && o.rows) || []; });
    });
  }
  function ghSimpanRows(path, rows, pesan) {
    return encTeks({ v: 1, rows: rows }).then(function (isi) { return ghTulisIndeks(path, isi, pesan); });
  }
  /* baca-ubah-tulis, diulang sekali bila berkasnya berubah di tengah jalan */
  function ghUbah(path, pesan, ubah) {
    function sekali() {
      return ghBacaRows(path).then(function (rows) {
        var baru = ubah(rows.slice());
        return ghSimpanRows(path, baru, pesan);
      });
    }
    return sekali().catch(function (err) {
      if (err && err.message === 'BENTROK') return sekali();
      throw err;
    });
  }

  /* ---------- Supabase ---------- */
  function sbHead(extra) {
    var h = { apikey: SK, Authorization: 'Bearer ' + SK, 'Content-Type': 'application/json' };
    for (var k in (extra || {})) h[k] = extra[k];
    return h;
  }
  function sbApi(path, opt) {
    opt = opt || {};
    if (!opt.headers) opt.headers = sbHead();
    return fetch(SB + '/rest/v1/' + path, opt).then(function (r) {
      return r.text().then(function (t) {
        if (!r.ok) throw new Error('Server menolak (' + r.status + '). ' + t.slice(0, 160));
        if (!t) return null;
        try { return JSON.parse(t); } catch (e) { return null; }
      });
    });
  }

  /* ---------- satu antarmuka untuk ketiga cara ---------- */
  function buat(nama, tabel, lsKey, folder) {
    var jalur = function (asetId) { return folder + '/' + encodeURIComponent(asetId) + '.json'; };
    return {
      pusat: MODE !== 'lokal',
      mode: MODE,
      list: function (asetId) {
        if (MODE === 'github') {
          return ghBacaRows(jalur(asetId)).then(function (rows) {
            if (nama !== 'foto') return rows;
            /* isi foto disimpan sebagai berkas terpisah supaya indeksnya tetap kecil */
            return Promise.all(rows.map(function (r) {
              var d = r.data || {};
              if (d.k !== 'add' || !d.f || d.d) return r;
              return fetch(RAW + '/' + GH + '/' + BR + '/' + d.f + '?t=' + Date.now())
                .then(function (x) { return x.ok ? x.text() : null; })
                .then(function (isi) {
                  if (!isi) return r;
                  return decTeks(isi).then(function (u) {
                    if (typeof u === 'string') r.data.d = u;
                    return r;
                  });
                }).catch(function () { return r; });
            }));
          });
        }
        if (MODE === 'supabase') {
          return sbApi(tabel + '?select=id,isi,created_at&aset_id=eq.' + encodeURIComponent(asetId) + '&order=id.asc')
            .then(function (rows) {
              return Promise.all((rows || []).map(function (r) {
                return decTeks(r.isi).then(function (d) {
                  return { id: r.id, created_at: r.created_at, data: d || { k: 'add', t: '(isi tidak dapat dibuka)', p: '' } };
                });
              }));
            });
        }
        var lokal = (lsBaca(lsKey)[asetId] || []).slice();
        return Promise.resolve(lokal.map(function (r) {
          return { id: r.id, created_at: r.created_at, data: r.data || { k: 'add', t: r.teks, p: r.penulis } };
        }));
      },
      add: function (asetId, data) {
        var waktu = new Date().toISOString();
        if (MODE === 'github') {
          var rid = idBaru();
          var siap = Promise.resolve(data);
          if (nama === 'foto' && data && data.d) {
            var berkas = folder + '/' + String(asetId).replace(/[^\w.-]/g, '_') + '/' + rid + '.txt';
            siap = encTeks(data.d).then(function (c) {
              return ghTulisIndeks(berkas, c, 'Tambah foto ' + asetId).then(function () {
                var salin = {}; for (var k in data) if (k !== 'd') salin[k] = data[k];
                salin.f = berkas;
                return salin;
              });
            });
          }
          return siap.then(function (isi) {
            return ghUbah(jalur(asetId), 'Perbarui ' + nama + ' ' + asetId, function (rows) {
              rows.push({ id: rid, created_at: waktu, data: isi });
              return rows;
            });
          });
        }
        if (MODE === 'supabase') {
          return encTeks(data).then(function (isi) {
            return sbApi(tabel, { method: 'POST', headers: sbHead({ Prefer: 'return=minimal' }), body: JSON.stringify([{ aset_id: asetId, isi: isi }]) });
          });
        }
        var all = lsBaca(lsKey);
        all[asetId] = all[asetId] || [];
        all[asetId].push({ id: idBaru(), created_at: waktu, data: data });
        var err = lsTulis(lsKey, all);
        return err ? Promise.reject(err) : Promise.resolve();
      },
      del: function (asetId, id) {
        if (MODE === 'github') {
          var buang = null;
          return ghUbah(jalur(asetId), 'Hapus ' + nama + ' ' + asetId, function (rows) {
            return rows.filter(function (r) {
              if (String(r.id) !== String(id)) return true;
              buang = r; return false;
            });
          }).then(function () {
            if (nama === 'foto' && buang && buang.data && buang.data.f && /^uf\//.test(buang.data.f)) return ghHapusBerkas(buang.data.f);
            return null;
          });
        }
        if (MODE === 'supabase') {
          return sbApi(tabel + '?id=eq.' + encodeURIComponent(id), { method: 'DELETE', headers: sbHead() });
        }
        var all = lsBaca(lsKey);
        all[asetId] = (all[asetId] || []).filter(function (r) { return String(r.id) !== String(id); });
        lsTulis(lsKey, all);
        return Promise.resolve();
      },
      delBanyak: function (asetId, ids) {
        if (MODE === 'github') {
          return ghUbah(jalur(asetId), 'Hapus beberapa ' + nama + ' ' + asetId, function (rows) {
            return rows.filter(function (r) { return ids.map(String).indexOf(String(r.id)) < 0; });
          });
        }
        var self = this;
        return ids.reduce(function (p, id) { return p.then(function () { return self.del(asetId, id); }); }, Promise.resolve());
      }
    };
  }

  window.ASET_UPDATES = buat('catatan', 'updates', 'aset-update-lokal', 'u');
  window.ASET_FOTO = buat('foto', 'foto', 'aset-foto-lokal', 'uf');
})();
