/* Penyimpanan catatan perkembangan dan foto unggahan.
   - Jika SUPABASE_URL dan SUPABASE_KEY diisi (config.js): tersimpan terpusat,
     semua pengguna melihat isi yang sama. Isi dienkripsi di browser dengan
     password halaman, jadi yang tersimpan di server hanya teks acak.
   - Jika belum diisi: tersimpan di perangkat masing-masing (localStorage). */
(function () {
  'use strict';
  var URL_ = (window.SUPABASE_URL || '').replace(/\/+$/, '');
  var KEY_ = window.SUPABASE_KEY || '';
  var PUSAT = !!(URL_ && KEY_);

  function head(extra) {
    var h = { apikey: KEY_, Authorization: 'Bearer ' + KEY_, 'Content-Type': 'application/json' };
    for (var k in (extra || {})) h[k] = extra[k];
    return h;
  }
  function api(path, opt) {
    opt = opt || {};
    if (!opt.headers) opt.headers = head();
    return fetch(URL_ + '/rest/v1/' + path, opt).then(function (r) {
      return r.text().then(function (t) {
        if (!r.ok) throw new Error('Server menolak (' + r.status + '). ' + t.slice(0, 160));
        if (!t) return null;
        try { return JSON.parse(t); } catch (e) { return null; }
      });
    });
  }
  /* enkripsi isi memakai kunci halaman (gate.js) */
  function enc(obj) {
    var teks = JSON.stringify(obj);
    return (window.SECURE_TEXT && window.SECURE_TEXT.enc) ? window.SECURE_TEXT.enc(teks) : Promise.resolve(teks);
  }
  function dec(s) {
    if (window.SECURE_TEXT && window.SECURE_TEXT.dec && /^[A-Za-z0-9+/=]+$/.test(s) && s.length > 24) {
      return window.SECURE_TEXT.dec(s).then(function (t) { return JSON.parse(t); })
        .catch(function () { return { k: 'add', t: '(isi tidak dapat dibuka)', p: '' }; });
    }
    try { return Promise.resolve(JSON.parse(s)); } catch (e) { return Promise.resolve({ k: 'add', t: s, p: '' }); }
  }
  function lsBaca(k) { try { return JSON.parse(localStorage.getItem(k) || '{}'); } catch (e) { return {}; } }
  function lsTulis(k, o) {
    try { localStorage.setItem(k, JSON.stringify(o)); return null; }
    catch (e) { return new Error('Penyimpanan browser penuh. Hubungkan ke penyimpanan terpusat (lihat PANDUAN-SUPABASE.txt) agar data bisa disimpan.'); }
  }

  function buat(tabel, lsKey) {
    return {
      pusat: PUSAT,
      /* daftar baris satu aset: [{id, created_at, data}] */
      list: function (asetId) {
        if (!PUSAT) {
          var rows = (lsBaca(lsKey)[asetId] || []).slice();
          return Promise.resolve(rows.map(function (r) {
            return { id: r.id, created_at: r.created_at, data: r.data || { k: 'add', t: r.teks, p: r.penulis } };
          }));
        }
        return api(tabel + '?select=id,isi,created_at&aset_id=eq.' + encodeURIComponent(asetId) + '&order=id.asc')
          .then(function (rows) {
            return Promise.all((rows || []).map(function (r) {
              return dec(r.isi).then(function (d) { return { id: r.id, created_at: r.created_at, data: d }; });
            }));
          });
      },
      /* tambah satu baris; data = objek bebas */
      add: function (asetId, data) {
        if (!PUSAT) {
          var all = lsBaca(lsKey);
          all[asetId] = all[asetId] || [];
          all[asetId].push({ id: 'l' + Date.now() + Math.floor(Math.random() * 1000), created_at: new Date().toISOString(), data: data });
          var err = lsTulis(lsKey, all);
          return err ? Promise.reject(err) : Promise.resolve();
        }
        return enc(data).then(function (isi) {
          return api(tabel, { method: 'POST', headers: head({ Prefer: 'return=minimal' }), body: JSON.stringify([{ aset_id: asetId, isi: isi }]) });
        });
      },
      /* hapus satu baris berdasarkan id */
      del: function (asetId, id) {
        if (!PUSAT) {
          var all = lsBaca(lsKey);
          all[asetId] = (all[asetId] || []).filter(function (r) { return String(r.id) !== String(id); });
          lsTulis(lsKey, all);
          return Promise.resolve();
        }
        return api(tabel + '?id=eq.' + encodeURIComponent(id), { method: 'DELETE', headers: head() });
      },
      /* hapus beberapa baris sekaligus */
      delBanyak: function (asetId, ids) {
        var self = this;
        return ids.reduce(function (p, id) { return p.then(function () { return self.del(asetId, id); }); }, Promise.resolve());
      }
    };
  }

  window.ASET_UPDATES = buat('updates', 'aset-update-lokal');
  window.ASET_FOTO = buat('foto', 'aset-foto-lokal');
})();
