/** GENBA 5R MAP - Backend (Container-bound ke Spreadsheet) **/
const T = {
  Floors:   ['id','name','fileId','ratio'],
  Areas:    ['id','floorId','name','points','items','color'],
  Findings: ['id','createdAt','floorId','areaId','x','y','type','auditor','desc','photoId','status','closeNote','closePhotoId','closedAt','closedBy'],
  Users:    ['email','name','role']   // role: superadmin | auditor | operator
};

// Isi dengan OAuth Client ID (Google Cloud Console) yang sama dengan config.js
const CLIENT_ID = 'ISI_CLIENT_ID.apps.googleusercontent.com';

function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function doGet() { return out({ ok: true, app: 'Genba 5R Map API' }); }
function doPost(e) {
  try {
    const b = JSON.parse(e.postData.contents);
    return out({ ok: true, data: api(b.a, b.d, verify(b.token)) });
  } catch (err) { return out({ ok: false, error: String(err.message || err) }); }
}
/** Verifikasi Google ID token -> email */
function verify(t) {
  if (!t) throw new Error('AUTH: Belum login');
  const cache = CacheService.getScriptCache();
  const k = 't' + Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, t)).slice(0, 40);
  let em = cache.get(k); if (em) return em;
  const r = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(t), { muteHttpExceptions: true });
  if (r.getResponseCode() != 200) throw new Error('AUTH: Sesi habis, silakan login ulang');
  const j = JSON.parse(r.getContentText());
  if (j.aud !== CLIENT_ID.trim() || String(j.email_verified) !== 'true')
    throw new Error('AUTH: Token tidak valid (Client ID di Code.gs tidak sama dengan config.js)');
  em = j.email.toLowerCase();
  cache.put(k, em, Math.max(1, Math.min(300, j.exp - Math.floor(Date.now() / 1000))));
  return em;
}

/** Jalankan SEKALI dari editor untuk membuat sheet & akun superadmin (pemilik script) */
function setup() {
  Object.keys(T).forEach(sh);
  const u = sh('Users');
  if (u.getLastRow() < 2) u.appendRow([Session.getEffectiveUser().getEmail(), 'Superadmin', 'superadmin']);
}

function sh(n) {
  const ss = SpreadsheetApp.getActive();
  let s = ss.getSheetByName(n);
  if (!s) { s = ss.insertSheet(n); s.appendRow(T[n]); s.setFrozenRows(1); }
  return s;
}
function rows(n) {
  const v = sh(n).getDataRange().getValues(), h = v.shift();
  return v.map(r => { const o = {}; h.forEach((k, i) => o[k] = r[i]); return o; });
}
function put(n, o) {
  const s = sh(n), h = T[n], v = s.getDataRange().getValues();
  const i = v.findIndex((r, j) => j > 0 && String(r[0]) === String(o[h[0]]));
  const row = h.map(k => o[k] === undefined || o[k] === null ? '' : o[k]);
  if (i > 0) s.getRange(i + 1, 1, 1, h.length).setValues([row]); else s.appendRow(row);
}
function del(n, id) {
  const s = sh(n), v = s.getDataRange().getValues();
  for (let i = v.length - 1; i > 0; i--) if (String(v[i][0]) === String(id)) s.deleteRow(i + 1);
}
function who(email) {
  const x = rows('Users').find(r => String(r.email).toLowerCase() === email);
  if (!x) throw new Error('AUTH: Email ' + email + ' belum terdaftar. Hubungi superadmin.');
  return { email, name: x.name, role: x.role };
}
function up(dataUrl, prefix) {
  const m = /^data:(.*?);base64,(.*)$/.exec(dataUrl);
  if (!m) throw new Error('Format gambar tidak valid');
  const it = DriveApp.getFoldersByName('Genba5R_Files');
  const folder = it.hasNext() ? it.next() : DriveApp.createFolder('Genba5R_Files');
  const f = folder.createFile(Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], prefix + '_' + Date.now() + '.jpg'));
  f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return f.getId();
}
const uid = () => Utilities.getUuid().slice(0, 8);

/** Satu pintu API dari frontend */
function api(a, d, email) {
  d = d || {};
  const me = who(email), isS = me.role === 'superadmin';
  const need = (ok) => { if (!ok) throw new Error('Akses ditolak untuk peran: ' + me.role); };
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    switch (a) {
      case 'boot':
        return { me, floors: rows('Floors'), areas: rows('Areas'), findings: rows('Findings').reverse(),
                 users: isS ? rows('Users') : [] };
      case 'saveFloor': {
        need(isS);
        const old = rows('Floors').find(f => f.id === d.id) || {};
        put('Floors', { id: d.id || uid(), name: d.name,
          fileId: d.image ? up(d.image, 'floor') : old.fileId, ratio: d.ratio || old.ratio || 0.7 });
        return 1;
      }
      case 'delFloor': need(isS); del('Floors', d.id); return 1;
      case 'saveArea':
        need(isS);
        put('Areas', { id: d.id || uid(), floorId: d.floorId, name: d.name,
          points: JSON.stringify(d.points), items: d.items, color: d.color });
        return 1;
      case 'delArea': need(isS); del('Areas', d.id); return 1;
      case 'saveUser': need(isS); put('Users', { email: String(d.email).toLowerCase(), name: d.name, role: d.role }); return 1;
      case 'delUser': need(isS); del('Users', d.email); return 1;
      case 'saveFinding': {
        need(isS || me.role === 'auditor');
        const id = 'T' + uid().toUpperCase().slice(0, 5);
        put('Findings', { id, createdAt: new Date().toISOString(), floorId: d.floorId, areaId: d.areaId,
          x: d.x, y: d.y, type: d.type, auditor: me.name, desc: d.desc,
          photoId: up(d.photo, 'temuan'), status: 'open' });
        return id;
      }
      case 'closeFinding': {
        need(isS || me.role === 'operator');
        const f = rows('Findings').find(x => x.id === d.id);
        if (!f) throw new Error('Temuan tidak ditemukan');
        f.status = 'closed'; f.closeNote = d.note; f.closedAt = new Date().toISOString(); f.closedBy = me.name;
        if (d.photo) f.closePhotoId = up(d.photo, 'closing');
        put('Findings', f);
        return 1;
      }
    }
    throw new Error('Aksi tidak dikenal');
  } finally { lock.releaseLock(); }
}
