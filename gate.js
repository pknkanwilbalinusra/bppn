/* Gerbang password: data & foto disimpan terenkripsi (AES-GCM, kunci dari password via PBKDF2).
   Tanpa password yang benar, isi data.bin dan folder f/ tidak dapat dibaca. */
(function () {
  'use strict';
  var VER = '10';
  var SS_KEY = 'aset-kunci';
  var $ = function (s) { return document.querySelector(s); };
  var subtle = window.crypto && window.crypto.subtle;
  var key = null, cache = {};

  function b64ToBuf(b) { var s = atob(b), u = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u.buffer; }
  function bufToB64(buf) { var u = new Uint8Array(buf), s = ''; for (var i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return btoa(s); }
  function decrypt(buf) {
    return subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(buf, 0, 12) }, key, new Uint8Array(buf, 12));
  }
  function getBin(path) {
    return fetch(path + '?v=' + VER).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); });
  }
  function deriveKey(pw) {
    return fetch('kunci.json?v=' + VER).then(function (r) { return r.json(); }).then(function (k) {
      return subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveKey']).then(function (base) {
        return subtle.deriveKey({ name: 'PBKDF2', salt: b64ToBuf(k.salt), iterations: k.iter, hash: 'SHA-256' },
          base, { name: 'AES-GCM', length: 256 }, true, ['decrypt']);
      });
    });
  }

  /* Dipakai app.js untuk menampilkan foto */
  window.SECURE_IMG = function (path) {
    if (!cache[path]) {
      cache[path] = getBin(path).then(decrypt).then(function (plain) {
        return URL.createObjectURL(new Blob([plain], { type: 'image/jpeg' }));
      });
    }
    return cache[path];
  };

  function unlock(k, remember) {
    key = k;
    return getBin('data.bin').then(decrypt).then(function (plain) {
      window.ASET_DATA = JSON.parse(new TextDecoder().decode(plain));
      if (remember) {
        subtle.exportKey('raw', key).then(function (raw) { try { sessionStorage.setItem(SS_KEY, bufToB64(raw)); } catch (e) {} });
      }
      document.body.classList.remove('locked');
      $('#gate').hidden = true;
      var s = document.createElement('script');
      s.src = 'app.js?v=' + VER;
      document.body.appendChild(s);
    });
  }

  function showError(msg) { var e = $('#gate-err'); e.textContent = msg; e.hidden = false; }

  $('#gate-form').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var pw = $('#gate-pw').value;
    if (!pw) return;
    var btn = $('#gate-btn'); btn.disabled = true; btn.textContent = 'Memeriksa…'; $('#gate-err').hidden = true;
    deriveKey(pw).then(function (k) { return unlock(k, true); }).catch(function () {
      showError('Password salah. Silakan coba lagi.');
      btn.disabled = false; btn.textContent = 'Masuk';
      $('#gate-pw').select();
    });
  });

  $('#gate-toggle').addEventListener('click', function () {
    var i = $('#gate-pw'); var show = i.type === 'password';
    i.type = show ? 'text' : 'password'; this.textContent = show ? 'Sembunyikan' : 'Tampilkan';
  });

  var out = $('#logout');
  if (out) out.addEventListener('click', function (e) {
    e.preventDefault();
    try { sessionStorage.removeItem(SS_KEY); } catch (x) {}
    location.href = location.pathname;
  });

  if (!subtle) {
    showError('Browser ini tidak mendukung enkripsi. Buka website melalui alamat https:// dengan Chrome, Edge, Firefox, atau Safari versi terbaru.');
    $('#gate-btn').disabled = true;
    return;
  }

  /* Masih dalam sesi yang sama (tab belum ditutup): masuk otomatis */
  var saved = null;
  try { saved = sessionStorage.getItem(SS_KEY); } catch (e) {}
  if (saved) {
    subtle.importKey('raw', b64ToBuf(saved), { name: 'AES-GCM' }, true, ['decrypt'])
      .then(function (k) { return unlock(k, false); })
      .catch(function () { try { sessionStorage.removeItem(SS_KEY); } catch (e) {} $('#gate-pw').focus(); });
  } else {
    $('#gate-pw').focus();
  }
})();
