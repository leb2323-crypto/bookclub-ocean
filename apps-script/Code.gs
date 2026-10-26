// ─────────────────────────────────────────────────────────────
// Книжный клуб партнёров: приём и выдача ответов тетради.
//
// Хранит всё в этой Google Таблице:
//   лист «Ответы»    – одна строка на участника (ответы в JSON);
//   лист «Состояние» – одна строка на клуб (что открыла ведущая).
// Данные клубов не смешиваются: каждая строка помечена номером клуба.
//
// Перед развёртыванием впишите пароли ведущей для каждого клуба.
// После любой правки кода переразверните веб-приложение:
// Начать развёртывание → Управление развёртываниями → карандаш →
// Версия: «Новая версия» → Развернуть. Адрес останется тем же.
// ─────────────────────────────────────────────────────────────

var HOST_PASSWORDS = {
  '1': 'ЗАДАЙТЕ_ПАРОЛЬ_КЛУБА_1',
  '2': 'ЗАДАЙТЕ_ПАРОЛЬ_КЛУБА_2'
};

var ANSWERS = 'Ответы';
var STATE = 'Состояние';
var MAX_JSON = 45000; // предел ячейки Google Таблиц 50 000 символов

function sheet_(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function answersSheet_() { return sheet_(ANSWERS, ['Клуб', 'ID', 'Имя', 'Компания', 'Обновлено', 'Ответы (JSON)']); }
function stateSheet_() { return sheet_(STATE, ['Клуб', 'Состояние (JSON)', 'Обновлено']); }

function rows_(sh) {
  if (sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
}

function parse_(s) {
  try { return JSON.parse(s || '{}'); } catch (e) { return {}; }
}

function records_(club) {
  return rows_(answersSheet_())
    .filter(function (r) { return String(r[0]) === club; })
    .map(function (r) {
      return { id: String(r[1]), name: String(r[2]), company: String(r[3]), updated: String(r[4]), data: parse_(r[5]) };
    });
}

function readState_(club) {
  var rows = rows_(stateSheet_());
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][0]) === club) return parse_(rows[i][1]);
  }
  return {};
}

function writeState_(club, state) {
  var sh = stateSheet_();
  var rows = rows_(sh);
  var now = new Date().toISOString();
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][0]) === club) {
      sh.getRange(i + 2, 1, 1, 3).setValues([[club, JSON.stringify(state), now]]);
      return;
    }
  }
  sh.appendRow([club, JSON.stringify(state), now]);
}

function checkHost_(req) {
  var pass = HOST_PASSWORDS[req.club];
  if (!pass || pass.indexOf('ЗАДАЙТЕ') === 0 || String(req.pass) !== pass) throw new Error('auth');
}

// Тексты, которые другие участники написали этому участнику в «Помощи партнёров»
function helpsFor_(records, id) {
  var out = [];
  records.forEach(function (rec) {
    (rec.data.helps || []).forEach(function (h) {
      if (h && h.to === id && h.text) out.push({ fromName: rec.name, fromCompany: rec.company, text: h.text });
    });
  });
  return out;
}

function handle_(req) {
  var club = String(req.club || '');
  if (!HOST_PASSWORDS.hasOwnProperty(club)) throw new Error('club');
  req.club = club;

  switch (req.op) {
    case 'get': {
      var mine = records_(club).filter(function (r) { return r.id === req.id; })[0];
      return { data: mine ? mine.data : null };
    }

    case 'save': {
      var json = JSON.stringify(req.data || {});
      if (json.length > MAX_JSON) throw new Error('too_big');
      var sh = answersSheet_();
      var rows = rows_(sh);
      var line = [club, String(req.id), String(req.name || ''), String(req.company || ''), new Date().toISOString(), json];
      for (var i = 0; i < rows.length; i++) {
        if (String(rows[i][0]) === club && String(rows[i][1]) === String(req.id)) {
          sh.getRange(i + 2, 1, 1, line.length).setValues([line]);
          return {};
        }
      }
      sh.appendRow(line);
      return {};
    }

    case 'pub': {
      var recs = records_(club);
      return {
        state: readState_(club),
        roster: recs.map(function (r) { return { id: r.id, name: r.name, company: r.company }; }),
        helps: helpsFor_(recs, String(req.id || ''))
      };
    }

    case 'auth':
      checkHost_(req);
      return {};

    case 'all':
      checkHost_(req);
      return { state: readState_(club), records: records_(club) };

    case 'setState': {
      checkHost_(req);
      var state = readState_(club);
      var patch = req.patch || {};
      Object.keys(patch).forEach(function (k) { state[k] = patch[k]; });
      writeState_(club, state);
      return { state: state };
    }

    case 'reset': {
      checkHost_(req);
      var ash = answersSheet_();
      var arows = rows_(ash);
      for (var j = arows.length - 1; j >= 0; j--) {
        if (String(arows[j][0]) === club) ash.deleteRow(j + 2);
      }
      writeState_(club, { epoch: Date.now() });
      return {};
    }
  }
  throw new Error('op');
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    var req = JSON.parse(e.postData.contents);
    var writes = { save: 1, setState: 1, reset: 1 };
    if (writes[req.op]) lock.waitLock(20000);
    var res = handle_(req);
    res.ok = true;
    return json_(res);
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }
}

function doGet() {
  return ContentService.createTextOutput('Приём ответов книжного клуба работает.');
}
