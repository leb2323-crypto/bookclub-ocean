// Общие функции и тексты тетради и дашборда.
(function () {
  var CFG = window.BC_CONFIG;

  function apiUrl() {
    var h = location.hostname;
    if (h === 'localhost' || h === '127.0.0.1') return '/api';
    return CFG.API_URL;
  }

  // Запрос к веб-приложению. Тип text/plain, чтобы браузер не делал предварительный CORS-запрос.
  function api(op, payload) {
    var body = Object.assign({ op: op }, payload || {});
    return fetch(apiUrl(), { method: 'POST', body: JSON.stringify(body), redirect: 'follow' })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (!res.ok) { var e = new Error(res.error || 'error'); e.code = res.error; throw e; }
        return res;
      });
  }

  function param(name) {
    return new URLSearchParams(location.search).get(name);
  }

  function club() {
    var c = param('club') || '1';
    return CFG.CLUBS[c] ? c : null;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function uid() { return Math.random().toString(36).slice(2, 10); }

  function getPath(obj, path) {
    return path.split('.').reduce(function (o, k) { return o == null ? undefined : o[k]; }, obj);
  }

  function setPath(obj, path, val) {
    var keys = path.split('.');
    var o = obj;
    for (var i = 0; i < keys.length - 1; i++) {
      var k = keys[i];
      if (o[k] == null || typeof o[k] !== 'object') o[k] = /^\d+$/.test(keys[i + 1]) ? [] : {};
      o = o[k];
    }
    o[keys[keys.length - 1]] = val;
  }

  function norm(s) { return String(s || '').trim().toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' '); }

  // Ключ фактора канвы: без точек, чтобы не ломать пути вида industry.<ключ>
  function fkey(name) { return norm(name).replace(/\./g, '·'); }

  function lines(s) {
    return String(s || '').split(/\n+/).map(function (x) { return x.replace(/^\s*(?:[-–•*]|\d+[.)])\s*/, '').trim(); }).filter(Boolean);
  }

  function debounce(fn, ms) {
    var t;
    return function () { var a = arguments; clearTimeout(t); t = setTimeout(function () { fn.apply(null, a); }, ms); };
  }

  // Подпись оси: перенос по словам в строки до ~14 символов
  function wrapLabel(s, max) {
    var words = String(s).split(/\s+/), out = [], cur = '';
    words.forEach(function (w) {
      if ((cur + ' ' + w).trim().length > max && cur) { out.push(cur); cur = w; }
      else cur = (cur + ' ' + w).trim();
    });
    if (cur) out.push(cur);
    return out.slice(0, 3);
  }

  // Линейный график канвы. series: [{name, values, color, width, dash}]
  function lineChart(o) {
    var labels = o.labels || [];
    var n = labels.length;
    if (!n) return '<p class="muted">Нет факторов для графика.</p>';
    var min = o.min == null ? 0 : o.min, max = o.max == null ? 5 : o.max;
    var step = o.step || 104;
    var padL = 34, padR = 20, padT = 16, labH = 70;
    var W = Math.max(o.minWidth || 560, padL + padR + step * n);
    var H = (o.height || 260);
    var plotH = H - padT - labH;
    var gx = (W - padL - padR) / n;
    function x(i) { return padL + gx * (i + 0.5); }
    function y(v) { return padT + plotH * (1 - (v - min) / (max - min)); }
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;min-width:' + Math.round(W * 0.7) + 'px;max-width:' + W + 'px;height:auto" role="img" aria-label="' + esc(o.title || 'Канва стратегии') + '" font-family="Helvetica Neue, Helvetica, Arial, sans-serif">';
    for (var v = min; v <= max; v++) {
      s += '<line x1="' + padL + '" x2="' + (W - padR) + '" y1="' + y(v) + '" y2="' + y(v) + '" stroke="#474747" stroke-width="1"/>';
      s += '<text x="' + (padL - 10) + '" y="' + (y(v) + 5) + '" fill="#BBBBBB" font-size="15" text-anchor="end">' + v + '</text>';
    }
    labels.forEach(function (lab, i) {
      wrapLabel(lab, Math.max(8, Math.floor(step / 8.2))).forEach(function (ln, j) {
        s += '<text x="' + x(i) + '" y="' + (padT + plotH + 24 + j * 18) + '" fill="#EBEBEB" font-size="15" text-anchor="middle">' + esc(ln) + '</text>';
      });
    });
    (o.series || []).forEach(function (se) {
      var d = '', pen = false;
      se.values.forEach(function (val, i) {
        if (val == null || val === '' || isNaN(val)) { pen = false; return; }
        d += (pen ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(+val).toFixed(1) + ' ';
        pen = true;
      });
      var w = se.width || 3;
      s += '<path d="' + d + '" fill="none" stroke="' + se.color + '" stroke-width="' + w + '" stroke-linejoin="round" stroke-linecap="round"' + (se.dash ? ' stroke-dasharray="' + se.dash + '"' : '') + '/>';
      se.values.forEach(function (val, i) {
        if (val == null || val === '' || isNaN(val)) return;
        s += '<circle cx="' + x(i) + '" cy="' + y(+val) + '" r="' + (w + 2) + '" fill="' + se.color + '"><title>' + esc(se.name + ': ' + labels[i] + ' = ' + (+val).toFixed(1).replace('.0', '')) + '</title></circle>';
      });
    });
    s += '</svg>';
    var legend = '<div class="legend">' + (o.series || []).map(function (se) {
      return '<span><i style="background:' + se.color + ';height:' + Math.max(3, se.width || 3) + 'px"></i>' + esc(se.name) + '</span>';
    }).join('') + '</div>';
    var scrollHint = n > 4 ? '<p class="small muted chart-hint">График можно листать вбок.</p>' : '';
    return '<div class="chart">' + s + '</div>' + scrollHint + legend;
  }

  // Сгруппированные столбцы. groups: подписи, series: [{name, values, color}]
  function barChart(o) {
    var groups = o.groups, series = o.series;
    var maxV = Math.max.apply(null, [1].concat(series.reduce(function (a, se) { return a.concat(se.values); }, [])));
    var W = Math.max(520, groups.length * 170), H = 240, padL = 30, padB = 40, padT = 20;
    var plotH = H - padT - padB, gw = (W - padL) / groups.length, bw = Math.min(56, (gw - 30) / series.length);
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;min-width:' + Math.round(W * 0.7) + 'px;max-width:' + W + 'px;height:auto" font-family="Helvetica Neue, Helvetica, Arial, sans-serif">';
    s += '<line x1="' + padL + '" x2="' + W + '" y1="' + (padT + plotH) + '" y2="' + (padT + plotH) + '" stroke="#474747"/>';
    groups.forEach(function (g, gi) {
      var x0 = padL + gi * gw + (gw - bw * series.length) / 2;
      series.forEach(function (se, si) {
        var v = se.values[gi] || 0, h = plotH * v / maxV, x = x0 + si * bw;
        s += '<rect x="' + (x + 3) + '" y="' + (padT + plotH - h) + '" width="' + (bw - 6) + '" height="' + h + '" rx="4" fill="' + se.color + '"/>';
        s += '<text x="' + (x + bw / 2) + '" y="' + (padT + plotH - h - 6) + '" fill="#FFFFFF" font-size="14" font-weight="700" text-anchor="middle">' + v + '</text>';
      });
      s += '<text x="' + (padL + gi * gw + gw / 2) + '" y="' + (H - 12) + '" fill="#EBEBEB" font-size="14" text-anchor="middle">' + esc(g) + '</text>';
    });
    s += '</svg>';
    var legend = '<div class="legend">' + series.map(function (se) { return '<span><i style="background:' + se.color + '"></i>' + esc(se.name) + '</span>'; }).join('') + '</div>';
    return '<div class="chart">' + s + '</div>' + legend;
  }

  // ───── Тексты методологии ─────

  var CATEGORIES = [
    { id: 'col', name: 'Колонисты', text: 'Повторяют то, что есть у всех на рынке. Кормят сегодня, но почти не дают роста.',
      test: 'Если убрать наш логотип, клиент заметит разницу с конкурентами? Если нет, это колонист.' },
    { id: 'mig', name: 'Переселенцы', text: 'Делают то же, что рынок, но лучше или дешевле.',
      test: 'Мы выигрываем тем, что делаем привычное лучше или дешевле? Если да, это переселенец.' },
    { id: 'pio', name: 'Первопроходцы', text: 'Предлагают ценность, которой в отрасли раньше не было.',
      test: 'Клиент получает у нас то, чего в отрасли раньше не предлагал никто? Если да, это первопроходец.' }
  ];

  var ACTIONS = [
    { id: 'elim', name: 'Упразднить', q: 'Что отрасль считает обязательным, но клиенту это не нужно?' },
    { id: 'reduce', name: 'Снизить', q: 'Что можно сделать значительно меньше, чем принято?' },
    { id: 'raise', name: 'Повысить', q: 'Что нужно сделать значительно сильнее, чем принято?' },
    { id: 'create', name: 'Создать', q: 'Чего отрасль никогда не предлагала, а вместе мы можем?' }
  ];

  var SIX_PATHS = [
    { t: 'Альтернативные отрасли', q: 'На что ещё клиент тратит деньги вместо нас?', ex: 'NetJets: доли частного самолёта.' },
    { t: 'Стратегические группы', q: 'Между какими «дорогими» и «дешёвыми» вариантами выбирает клиент?', ex: 'Curves: лучшее от домашних тренировок и фитнес-клубов.' },
    { t: 'Группы покупателей', q: 'Кто ещё влияет на покупку?', ex: 'Novo Nordisk: от врачей к пациентам.' },
    { t: 'Дополнительные продукты и услуги', q: 'Что клиенту приходится докупать и решать вокруг нас?', ex: 'NABI: стоимость автобуса за весь срок службы.' },
    { t: 'Функция и эмоция', q: 'Мы продаём функцию или эмоцию, и что будет, если поменять?', ex: 'Swatch: часы как модный аксессуар. Cemex: цемент как мечта о доме.' },
    { t: 'Тренды', q: 'Какие необратимые изменения ждут нашего клиента в ближайшие 3 года?', ex: '' }
  ];

  function sixPathsHtml() {
    return '<details class="tip"><summary>Шесть путей к новому рынку</summary><ol>' +
      SIX_PATHS.map(function (p) {
        return '<li><b>' + esc(p.t) + '.</b> ' + esc(p.q) + (p.ex ? ' <span class="muted">' + esc(p.ex) + '</span>' : '') + '</li>';
      }).join('') + '</ol></details>';
  }

  var REFERENCE = [
    ['Инновация ценности', 'Сделать конкуренцию ненужной, одновременно подняв ценность для клиента и снизив издержки.'],
    ['Четыре действия', 'Упразднить, снизить, повысить, создать.'],
    ['Признаки сильной стратегии', 'Фокус, отличие от отрасли, слоган.'],
    ['Шесть путей к новому рынку', 'Альтернативные отрасли, стратегические группы, группы покупателей, дополнительные продукты и услуги, функция и эмоция, тренды.'],
    ['Три яруса неклиентов', '«Будущие» неклиенты, «отказники», «неизученные».'],
    ['Первопроходцы, переселенцы, колонисты', 'Карта продуктов по тому, насколько их ценность отличается от предложения отрасли.'],
    ['Стратегическая последовательность', 'Полезность, цена, издержки, внедрение.'],
    ['Справедливый процесс', 'Вовлечённость, объяснение, ясность ожиданий.']
  ];

  function referenceHtml() {
    return '<details><summary>Справка и шпаргалка</summary><div class="card"><div class="tbl-wrap"><table><thead><tr><th>Идея</th><th>Суть в одной фразе</th></tr></thead><tbody>' +
      REFERENCE.map(function (r) { return '<tr><td><b>' + esc(r[0]) + '</b></td><td>' + esc(r[1]) + '</td></tr>'; }).join('') +
      '</tbody></table></div></div></details>';
  }

  var QB = {
    factors: ['Цена', 'Запись клиентов', 'Дополнительные услуги', 'Уход за волосами', 'Гигиена', 'Экономия времени ожидания', 'Экономия времени стрижки', '«Сухое мытьё»'],
    usual: [4, 5, 5, 4, 3, 2, 1, 0],
    qb: [2, 1, 2, 2, 5, 5, 5, 5]
  };

  var GATES = [
    { t: 'Полезность', q: 'Есть ли у идеи исключительная польза для клиента?' },
    { t: 'Цена', q: 'Доступна ли она основной массе покупателей?' },
    { t: 'Издержки', q: 'Можем ли мы получить прибыль при этой цене?' },
    { t: 'Внедрение', q: 'Какие препятствия есть и как мы снимаем их заранее?' }
  ];

  var TIERS = [
    { id: 't1', name: 'Первый ярус: «будущие» неклиенты', text: 'Пользуются рынком по необходимости и готовы уйти.',
      ex: 'Pret A Manger: офисные сотрудники хотели обед быстро, из свежих продуктов и за разумные деньги.' },
    { id: 't2', name: 'Второй ярус: «отказники»', text: 'Сознательно не пользуются предложениями рынка.',
      ex: 'JCDecaux: города не хотели тратиться на остановки и уличную мебель. Компания ставила её бесплатно в обмен на право размещать рекламу.' },
    { id: 't3', name: 'Третий ярус: «неизученные»', text: 'Находятся на далёких рынках. Отрасль никогда не считала их своими клиентами.', ex: '' }
  ];

  // Цвета линий участников на общем графике (жёлтый занят общей кривой)
  var PALETTE = ['#8AB4F8', '#F28B82', '#81C995', '#C58AF9', '#FCAD70', '#78D9EC', '#F48FB1', '#E6E6E6', '#B0BEC5', '#A7FFEB'];

  window.BC = {
    CFG: CFG, api: api, param: param, club: club, esc: esc, uid: uid, getPath: getPath, setPath: setPath,
    norm: norm, fkey: fkey, lines: lines, debounce: debounce, lineChart: lineChart, barChart: barChart,
    CATEGORIES: CATEGORIES, ACTIONS: ACTIONS, SIX_PATHS: SIX_PATHS, sixPathsHtml: sixPathsHtml,
    referenceHtml: referenceHtml, QB: QB, GATES: GATES, TIERS: TIERS, PALETTE: PALETTE
  };
})();
