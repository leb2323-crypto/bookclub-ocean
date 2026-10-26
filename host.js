// Дашборд ведущей.
(function () {
  var B = window.BC, esc = B.esc, getPath = B.getPath, setPath = B.setPath;
  var CLUB = B.club();
  var $ = function (id) { return document.getElementById(id); };

  var PASS = null;
  var R = [];      // записи участников: { id, name, company, updated, data }
  var S = {};      // состояние встречи
  var L = { reveal: false, fUser: '', fCat: '', nc: ['', '', '', ''], factorsDraft: null };
  var dirty = {};  // ключи состояния, которые ведущая сейчас меняет
  var lastHtml = {};

  if (!CLUB || B.param('club') == null) { $('badClub').classList.remove('hidden'); return; }
  $('clubName').textContent = B.CFG.CLUBS[CLUB];
  var SS = 'bc-host' + CLUB;

  // ───── Сервер ─────

  var sendTimers = {}, changedAt = {};
  function sendKey(key) {
    var p = {}; p[key] = S[key] == null ? null : S[key];
    return B.api('setState', { club: CLUB, pass: PASS, patch: p })
      .catch(function () { live(false); })
      .then(function () { dirty[key]--; });
  }
  // Немедленное изменение (кнопки)
  function patch(p) {
    Object.keys(p).forEach(function (k) {
      S[k] = p[k];
      changedAt[k] = Date.now();
      if (sendTimers[k]) { clearTimeout(sendTimers[k]); sendTimers[k] = null; } else dirty[k] = (dirty[k] || 0) + 1;
      sendKey(k);
    });
    renderAll();
  }
  // Изменение при вводе текста: отправка с задержкой
  function patchLater(key) {
    changedAt[key] = Date.now();
    if (sendTimers[key]) clearTimeout(sendTimers[key]);
    else dirty[key] = (dirty[key] || 0) + 1;
    sendTimers[key] = setTimeout(function () { sendTimers[key] = null; sendKey(key); }, 600);
  }

  function live(ok) {
    $('liveDot').classList.toggle('off', !ok);
    $('liveText').textContent = ok ? 'Обновлено ' + new Date().toLocaleTimeString('ru-RU') : 'Нет связи, пробуем снова';
  }

  function poll() {
    var startedAt = Date.now();
    B.api('all', { club: CLUB, pass: PASS }).then(function (res) {
      R = (res.records || []).sort(function (a, b) { return a.name.localeCompare(b.name, 'ru'); });
      var ns = res.state || {};
      // Свежие правки ведущей важнее ответа, который ушёл до них
      Object.keys(changedAt).forEach(function (k) { if (dirty[k] > 0 || changedAt[k] >= startedAt - 1500) ns[k] = S[k]; });
      S = ns;
      live(true);
      renderAll();
    }).catch(function (e) {
      if (e.code === 'auth') { logout('Пароль больше не подходит.'); return; }
      live(false);
    }).then(function () { if (PASS) setTimeout(poll, document.hidden ? 10000 : 3000); });
  }

  // ───── Помощники ─────

  function D(r, path) { var v = getPath(r.data, path); return v == null ? '' : v; }
  function has(v) { return v != null && String(v).trim() !== ''; }
  function catName(id) { var c = B.CATEGORIES.filter(function (x) { return x.id === id; })[0]; return c ? c.name : ''; }
  function personName(id) { var r = R.filter(function (x) { return x.id === id; })[0]; return r ? r.name : id; }
  function who(r) { return '<b>' + esc(r.name) + '</b>' + (r.company ? ' <span class="muted">' + esc(r.company) + '</span>' : ''); }
  function empty(t) { return '<p class="muted">' + esc(t || 'Пока нет ответов.') + '</p>'; }
  function productName(r) {
    var id = D(r, 'newCurve.product');
    var p = (getPath(r.data, 'prep.products') || []).filter(function (x) { return x && x.id === id; })[0];
    return p ? p.name : D(r, 'newCurve.productName');
  }
  function kInput(path, ph, type, w) {
    var v = path.indexOf('local:') === 0 ? L[path.slice(6)] : getPath(S, path);
    return '<input type="' + (type || 'text') + '" data-k="' + path + '" value="' + esc(v == null ? '' : v) + '" placeholder="' + esc(ph || '') + '"' + (w ? ' style="width:' + w + '"' : '') + '>';
  }
  function kText(path, ph, rows) {
    var v = path.indexOf('local:') === 0 ? L[path.slice(6)] : getPath(S, path);
    return '<textarea data-k="' + path + '" rows="' + (rows || 4) + '" placeholder="' + esc(ph || '') + '">' + esc(v == null ? '' : v) + '</textarea>';
  }
  function btn(act, text, cls, i) {
    return '<button type="button" class="btn ' + (cls || '') + '" data-act="' + act + '"' + (i != null ? ' data-i="' + esc(i) + '"' : '') + '>' + text + '</button>';
  }

  // Тёмная кнопка на жёлтой карточке
  function darkBtn(act, text, i, on) {
    return '<button type="button" class="btn" style="background:#2C2C2C;color:#FADD59' + (on ? ';box-shadow:0 0 0 3px #2C2C2C inset,0 0 0 5px #FADD59 inset' : '') + '" data-act="' + act + '" data-i="' + i + '">' + (on ? '✓ ' : '') + text + '</button>';
  }

  // Доля заполнения тетради участником
  function progress(r) {
    var checks = [
      (getPath(r.data, 'prep.products') || []).some(function (p) { return p && p.name; }),
      has(D(r, 'prep.focus')), has(D(r, 'warmup')), has(D(r, 'thought')), has(D(r, 'hook')), has(D(r, 'scenario')),
      has(D(r, 'final.focus')), has(D(r, 'final.action')), has(D(r, 'final.answer')),
      [0, 1, 2, 3].some(function (i) { return has(D(r, 'gates.g' + i + '.ans')); })
    ];
    if (S.route === 'A') {
      checks.push(['t1', 't2', 't3'].some(function (t) { return (getPath(r.data, 'nc.' + t) || []).some(function (x) { return x && (x.who || x.why); }); }));
      checks.push(has(D(r, 'ncVote')));
      checks.push(B.ACTIONS.some(function (a) { return has(D(r, 'grid.' + a.id)); }));
      checks.push(has(D(r, 'slogan')));
    } else if (S.route === 'B') {
      checks.push(Object.keys(getPath(r.data, 'industry') || {}).length > 0);
      checks.push(Object.keys(getPath(r.data, 'newCurve.r') || {}).length > 0);
      checks.push(has(D(r, 'mySlogan')));
      checks.push((getPath(r.data, 'helps') || []).some(function (h) { return h && h.to && h.text; }));
    }
    return Math.round(100 * checks.filter(Boolean).length / checks.length);
  }

  // ───── Блоки ─────

  var BLOCKS = {};

  BLOCKS.people = function () {
    if (!R.length) return empty('Пока никто не вошёл в тетрадь.');
    return '<p><span class="big-num">' + R.length + '</span> <span class="muted">в тетради</span></p><div class="tbl-wrap"><table><thead><tr><th>Участник</th><th>Компания</th><th>Последнее сохранение</th><th>Заполнено</th></tr></thead><tbody>' +
      R.map(function (r) {
        var p = progress(r);
        return '<tr><td><b>' + esc(r.name) + '</b></td><td>' + esc(r.company) + '</td><td>' + (r.updated ? new Date(r.updated).toLocaleTimeString('ru-RU') : '') + '</td>' +
          '<td style="min-width:160px"><div class="row" style="align-items:center"><div class="progress grow"><i style="width:' + p + '%"></i></div><span class="small">' + p + '%</span></div></td></tr>';
      }).join('') + '</tbody></table></div>';
  };

  BLOCKS.warmup = function () {
    var ans = R.filter(function (r) { return has(D(r, 'warmup')); });
    var nums = ans.map(function (r) { return parseFloat(String(D(r, 'warmup')).replace(',', '.')); }).filter(function (n) { return !isNaN(n); });
    var avg = nums.length ? Math.round(nums.reduce(function (a, b) { return a + b; }, 0) / nums.length) : null;
    var h = '<p class="muted">Какую долю прибыли принесли 14% шагов, создавших голубые океаны?</p><div class="grid2"><div class="card">' +
      (ans.length ? '<ul class="list">' + ans.map(function (r) { return '<li class="row"><span class="grow">' + who(r) + '</span><b>' + esc(D(r, 'warmup')) + '%</b></li>'; }).join('') + '</ul>' : empty()) +
      '</div><div class="card dark"><div class="muted small">Среднее по группе</div><div class="big-num">' + (avg == null ? '–' : avg + '%') + '</div>' +
      '<div class="btns">' + btn('reveal', L.reveal ? 'Скрыть ответ' : 'Открыть ответ', L.reveal ? 'ghost' : '') + '</div>' +
      (L.reveal ? '<div class="reveal">61% прибыли при 38% дохода</div>' : '') + '</div></div>';
    return h;
  };

  BLOCKS.ideas = function () {
    var a = R.filter(function (r) { return has(D(r, 'thought')); });
    var b = R.filter(function (r) { return has(D(r, 'hook')); });
    return '<div class="grid2"><div class="card"><h3>Для меня стратегия голубого океана – это про…</h3>' +
      (a.length ? '<ul class="list">' + a.map(function (r) { return '<li style="font-size:19px">' + esc(D(r, 'thought')) + '<div class="small muted">' + esc(r.name) + '</div></li>'; }).join('') + '</ul>' : empty()) +
      '</div><div class="card"><h3>Что зацепило сильнее всего</h3>' +
      (b.length ? '<ul class="list">' + b.map(function (r) { return '<li style="font-size:19px">' + esc(D(r, 'hook')) + '<div class="small muted">' + esc(r.name) + '</div></li>'; }).join('') + '</ul>' : empty()) + '</div></div>';
  };

  BLOCKS.map = function () {
    var rows = [];
    R.forEach(function (r) {
      (getPath(r.data, 'prep.products') || []).forEach(function (p) {
        if (p && p.name) rows.push({ r: r, p: p, focus: D(r, 'prep.focus') === p.id });
      });
    });
    if (!rows.length) return empty('Карты продуктов пока не заполнены.');
    var today = B.CATEGORIES.map(function (c) { return rows.filter(function (x) { return x.p.today === c.id; }).length; });
    var future = B.CATEGORIES.map(function (c) { return rows.filter(function (x) { return x.p.future === c.id; }).length; });
    var h = '<div class="card">' + B.barChart({
      groups: B.CATEGORIES.map(function (c) { return c.name; }),
      series: [{ name: 'Сегодня', values: today, color: '#9A9A9A' }, { name: 'Через 2 года', values: future, color: '#FADD59' }]
    }) + '</div>';
    h += '<div class="filters"><select data-k="local:fUser"><option value="">Все участники</option>' +
      R.map(function (r) { return '<option value="' + esc(r.id) + '"' + (L.fUser === r.id ? ' selected' : '') + '>' + esc(r.name) + '</option>'; }).join('') +
      '</select><select data-k="local:fCat"><option value="">Все категории</option>' +
      B.CATEGORIES.map(function (c) { return '<option value="' + c.id + '"' + (L.fCat === c.id ? ' selected' : '') + '>' + c.name + '</option>'; }).join('') + '</select></div>';
    var shown = rows.filter(function (x) {
      return (!L.fUser || x.r.id === L.fUser) && (!L.fCat || x.p.today === L.fCat || x.p.future === L.fCat);
    });
    h += '<div class="tbl-wrap"><table><thead><tr><th>Участник</th><th>Продукт</th><th>Сегодня</th><th>Через 2 года</th><th>Что нужно</th><th>Вывести вверх</th></tr></thead><tbody>' +
      shown.map(function (x) {
        return '<tr><td>' + esc(x.r.name) + '</td><td><b>' + esc(x.p.name) + '</b></td><td>' + esc(catName(x.p.today)) + '</td><td>' + esc(catName(x.p.future)) + '</td><td>' + esc(x.p.need || '') + '</td><td>' + (x.focus ? '<span class="chip">Да</span>' : '') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
    return h;
  };

  var ROUTE_NAMES = { A: 'А «Океан на стыке»', B: 'Б «От колонистов к первопроходцам»' };

  BLOCKS.vote = function () {
    var v = S.vote || {}, st = v.status || 'idle';
    var voted = R.filter(function (r) { return has(D(r, 'scenario')); }).length;
    var h = '<div class="card">';
    if (st === 'idle') h += '<p>Голосование ещё не открыто.</p><div class="btns">' + btn('voteOpen', 'Открыть голосование') + '</div>';
    if (st === 'open') h += '<p>Голосование открыто. Проголосовали <b>' + voted + '</b> из ' + R.length + '.</p><div class="btns">' + btn('voteClose', 'Закрыть голосование и показать результаты') + '</div>';
    if (st === 'closed') {
      var res = v.results || {};
      h += '<p>Голосование закрыто. Участники видят результаты.</p><div class="grid2">' + ['A', 'B'].map(function (k) {
        return '<div class="card dark"><div class="muted small">Маршрут ' + esc(ROUTE_NAMES[k]) + '</div><div class="big-num">' + (res[k] || 0) + '</div></div>';
      }).join('') + '</div><div class="btns">' + btn('voteOpen', 'Открыть заново', 'ghost small') + '</div>';
    }
    h += '</div><div class="card accent"><h3>Итоговый маршрут</h3>' +
      (S.route ? '<p>Подтверждён маршрут ' + esc(ROUTE_NAMES[S.route]) + '. У участников открыт только он.</p>' : '<p>Пока не подтверждён. Разделы маршрутов у участников скрыты.</p>') +
      '<div class="btns">' + darkBtn('route', 'Подтвердить маршрут А', 'A', S.route === 'A') + darkBtn('route', 'Подтвердить маршрут Б', 'B', S.route === 'B') +
      (S.route ? btn('route', 'Отменить выбор', 'ghost small', '') : '') + '</div></div>';
    return h;
  };

  // ── Маршрут А ──

  function allTier(t) {
    var out = [];
    R.forEach(function (r) {
      (getPath(r.data, 'nc.' + t) || []).forEach(function (x) { if (x && (x.who || x.why)) out.push({ r: r, who: x.who || '', why: x.why || '' }); });
    });
    return out;
  }

  // Идеи из решёток: одна строка = одна идея, одинаковые рядом
  function gridIdeas(field) {
    var out = [];
    R.forEach(function (r) { B.lines(D(r, 'grid.' + field)).forEach(function (t) { out.push({ r: r, t: t, k: B.norm(t) }); }); });
    var count = {};
    out.forEach(function (x) { count[x.k] = (count[x.k] || 0) + 1; });
    out.sort(function (a, b) { return count[b.k] - count[a.k] || a.k.localeCompare(b.k, 'ru'); });
    return out.map(function (x) { x.n = count[x.k]; return x; });
  }

  BLOCKS.routeA = function () {
    var nc = S.nc || {}, sh = S.shared || {};
    var h = '<h3 style="margin-top:18px">Якорь для участников</h3><div class="card"><label class="f">Мы ищем неклиентов: …</label>' +
      kInput('anchor', 'Например, компании, которые проводят мероприятия своими силами') + '<p class="small muted" style="margin:8px 0 0">Участники видят текст сразу после ввода.</p></div>';

    h += '<h3>Неклиенты по ярусам</h3><div class="grid3">' + B.TIERS.map(function (t) {
      var list = allTier(t.id);
      return '<div class="card"><span class="chip">' + esc(t.name.split(':')[0]) + '</span><p class="small muted" style="margin:8px 0">' + esc(t.name.split(': ')[1] || '') + '</p>' +
        (list.length ? '<ul class="list">' + list.map(function (x) { return '<li><b>' + esc(x.who) + '</b>' + (x.why ? ' – ' + esc(x.why) : '') + '<div class="small muted">' + esc(x.r.name) + '</div></li>'; }).join('') + '</ul>' : empty()) + '</div>';
    }).join('') + '</div>';

    h += '<h3>Голосование за неклиента</h3><div class="card">';
    if (!nc.options || !nc.options.length || nc.status === 'draft') {
      h += '<p class="small muted">Впишите 3–4 варианта «неклиент + главная причина».</p>' +
        [0, 1, 2, 3].map(function (i) { return '<div style="margin-bottom:8px">' + kInput('local:nc' + i, 'Вариант ' + (i + 1)) + '</div>'; }).join('') +
        '<div class="btns">' + btn('ncPublish', 'Опубликовать и открыть голосование') + '</div>';
    } else {
      var counts = nc.options.map(function (o) { return R.filter(function (r) { return D(r, 'ncVote') === o; }).length; });
      var voted = counts.reduce(function (a, b) { return a + b; }, 0);
      h += '<p>' + (nc.status === 'closed' ? 'Голосование закрыто.' : 'Идёт голосование. Проголосовали <b>' + voted + '</b> из ' + R.length + '.') + '</p><ul class="list">' +
        nc.options.map(function (o, i) {
          var win = nc.winner === o;
          return '<li class="row" style="align-items:center"><span class="num">' + (i + 1) + '</span><span class="grow">' + esc(o) + (win ? ' <span class="chip">Выбор группы</span>' : '') + '</span>' +
            (nc.status === 'closed' ? '<b class="big-num" style="font-size:28px">' + counts[i] + '</b>' : '') +
            (nc.status === 'closed' && !win ? btn('ncWinner', 'Сделать выбором', 'ghost small', i) : '') + '</li>';
        }).join('') + '</ul><div class="btns">' +
        (nc.status === 'open' ? btn('ncClose', 'Закрыть голосование') : '') + btn('ncEdit', 'Изменить варианты', 'ghost small') + '</div>';
    }
    h += '</div>';

    h += '<h3>Решётки участников</h3><p class="small muted">Каждая строка участника считается отдельной идеей. Повторяющиеся идеи стоят рядом, число показывает, сколько раз она встретилась.</p><div class="grid2">' +
      B.ACTIONS.map(function (a) {
        var ideas = gridIdeas(a.id), seen = {};
        return '<div class="card"><span class="chip">' + esc(a.name) + '</span>' + (ideas.length ? '<ul class="list" style="margin-top:6px">' + ideas.map(function (x) {
          var first = !seen[x.k]; seen[x.k] = 1;
          return '<li>' + (x.n > 1 && first ? '<span class="dup">×' + x.n + '</span> ' : '') + esc(x.t) + ' <span class="small muted">' + esc(x.r.name) + '</span></li>';
        }).join('') + '</ul>' : empty()) + '</div>';
      }).join('') + '</div>';

    h += '<h3>Общая решётка</h3><p class="small muted">Собирайте вживую: одна идея на строку.</p><div class="grid2">' + B.ACTIONS.map(function (a) {
      return '<div class="card"><span class="chip">' + esc(a.name) + '</span><div style="margin-top:10px">' + kText('shared.grid.' + a.id, '', 5) + '</div></div>';
    }).join('') + '</div>';

    var cv = sh.canvas || [];
    var opts = function (path) {
      var v = getPath(S, path);
      return '<select data-k="' + path + '" style="min-width:76px">' + ['', 0, 1, 2, 3, 4, 5].map(function (n) {
        return '<option value="' + n + '"' + (String(v == null ? '' : v) === String(n) ? ' selected' : '') + '>' + (n === '' ? '–' : n) + '</option>';
      }).join('') + '</select>';
    };
    h += '<h3>Общая канва</h3><div class="card"><div class="tbl-wrap"><table><thead><tr><th>Фактор</th><th>Сегодня у рынка</th><th>Наше совместное предложение</th><th></th></tr></thead><tbody>' +
      cv.map(function (r, i) {
        return '<tr><td>' + kInput('shared.canvas.' + i + '.f', 'Фактор') + '</td><td>' + opts('shared.canvas.' + i + '.today') + '</td><td>' + opts('shared.canvas.' + i + '.ours') + '</td>' +
          '<td><button type="button" class="xbtn" data-act="cvDel" data-i="' + i + '" aria-label="Удалить строку">×</button></td></tr>';
      }).join('') + '</tbody></table></div><div class="btns">' + btn('cvAdd', '+ Фактор', 'ghost small') + btn('cvFromGrid', 'Взять факторы из общей решётки', 'ghost small') + '</div>';
    var rows = cv.filter(function (r) { return r.f; });
    if (rows.length) {
      h += '<div style="margin-top:14px">' + B.lineChart({
        labels: rows.map(function (r) { return r.f; }),
        series: [
          { name: 'Сегодня у рынка', values: rows.map(function (r) { return r.today; }), color: '#9A9A9A', width: 3 },
          { name: 'Наше совместное предложение', values: rows.map(function (r) { return r.ours; }), color: '#FADD59', width: 5 }
        ]
      }) + '</div>';
    }
    h += '</div>';

    var slogans = R.filter(function (r) { return has(D(r, 'slogan')); });
    h += '<h3>Слоганы</h3><div class="card">' + (slogans.length ? '<ul class="list">' + slogans.map(function (r, i) {
      var s = D(r, 'slogan'), on = sh.slogan === s;
      return '<li class="row" style="align-items:center"><span class="grow" style="font-size:19px">' + esc(s) + '<div class="small muted">' + esc(r.name) + (has(D(r, 'partners')) ? ' · партнёры: ' + esc(D(r, 'partners')) : '') + '</div></span>' +
        (on ? '<span class="chip">Лучший</span>' : btn('pickSlogan', 'Выбрать', 'ghost small', i)) + '</li>';
    }).join('') + '</ul>' : empty()) +
      '<label class="f" style="margin-top:14px">Итоговый слоган (можно поправить)</label>' + kInput('shared.slogan', '') + '</div>';

    h += '<div class="card accent"><h3>Общая решётка, канва и слоган</h3><p>' + (sh.shown ? 'Участники видят общий результат в разделе 4А.5.' : 'Участники пока не видят общий результат.') + '</p><div class="btns">' +
      darkBtn('sharedShow', sh.shown ? 'Скрыть от участников' : 'Показать участникам', '', false) + '</div></div>';
    return h;
  };

  // ── Маршрут Б ──

  function industryCalc() {
    var f = S.factors || [], adj = (S.industry && S.industry.adj) || {};
    return f.map(function (name) {
      var k = B.fkey(name);
      var vals = R.map(function (r) { return parseFloat(getPath(r.data, 'industry.' + k)); }).filter(function (n) { return !isNaN(n); });
      var avg = vals.length ? vals.reduce(function (a, b) { return a + b; }, 0) / vals.length : null;
      var a = adj[k];
      var fin = has(a) && !isNaN(parseFloat(a)) ? parseFloat(a) : avg;
      return { name: name, k: k, n: vals.length, avg: avg, final: fin == null ? null : Math.round(fin * 10) / 10 };
    });
  }

  function curveOf(r, calc) {
    var custom = (getPath(r.data, 'newCurve.custom') || []).filter(function (c) { return c && c.name; });
    return {
      labels: calc.map(function (c) { return c.name; }).concat(custom.map(function (c) { return c.name; })),
      ind: calc.map(function (c) { return c.final; }).concat(custom.map(function () { return 0; })),
      mine: calc.map(function (c) { return getPath(r.data, 'newCurve.r.' + c.k); }).concat(custom.map(function (c) { return c.r; })),
      acts: calc.map(function (c) { return { f: c.name, a: getPath(r.data, 'newCurve.a.' + c.k) }; }).concat(custom.map(function (c) { return { f: c.name, a: 'create' }; }))
    };
  }

  BLOCKS.routeB = function () {
    var f = S.factors || [];
    if (L.factorsDraft == null) L.factorsDraft = f.join('\n');
    var h = '<h3 style="margin-top:18px">Факторы отрасли</h3><div class="card"><label class="f">6–8 факторов, за которые конкурирует отрасль<span class="hint">Один фактор на строку</span></label>' +
      kText('local:factorsDraft', 'Цена\nСкорость\n…', 8) + '<div class="btns">' + btn('factorsPublish', f.length ? 'Опубликовать изменения' : 'Опубликовать') + '</div>' +
      (f.length ? '<p class="small muted" style="margin:10px 0 0">Опубликовано: ' + esc(f.join(' · ')) + '</p>' : '') + '</div>';
    if (!f.length) return h;

    var calc = industryCalc(), ind = S.industry || {};
    h += '<h3>Общая кривая отрасли</h3><div class="card"><div class="tbl-wrap"><table><thead><tr><th>Фактор</th><th>Оценок</th><th>Среднее</th><th>Поправка</th><th>Итог</th></tr></thead><tbody>' +
      calc.map(function (c) {
        return '<tr><td><b>' + esc(c.name) + '</b></td><td class="n">' + c.n + '</td><td class="n">' + (c.avg == null ? '–' : c.avg.toFixed(1)) + '</td>' +
          '<td>' + kInput('industry.adj.' + c.k, '–', 'number', '90px') + '</td><td class="n"><b>' + (c.final == null ? '–' : c.final) + '</b></td></tr>';
      }).join('') + '</tbody></table></div>' +
      B.lineChart({ labels: f, series: [{ name: 'Отрасль, среднее по группе', values: calc.map(function (c) { return c.final; }), color: '#9A9A9A', width: 4 }] }) +
      '<div class="btns"><button type="button" class="btn" data-act="industryShow">' + (ind.shown ? 'Скрыть общую кривую' : 'Показать общую кривую') + '</button></div>' +
      '<p class="small muted" style="margin:8px 0 0">' + (ind.shown ? 'Участники видят общую кривую.' : 'Участники пока не видят общую кривую.') + '</p></div>';

    var withCurve = R.filter(function (r) { return Object.keys(getPath(r.data, 'newCurve.r') || {}).length; });
    h += '<h3>Канвы участников</h3>' + (withCurve.length ? '<div class="cards">' + withCurve.map(function (r) {
      var c = curveOf(r, calc);
      var byAct = B.ACTIONS.map(function (a) {
        var fs = c.acts.filter(function (x) { return x.a === a.id; }).map(function (x) { return x.f; });
        return fs.length ? '<div class="small"><span class="chip">' + a.name + '</span> ' + esc(fs.join(', ')) + '</div>' : '';
      }).join('');
      return '<div class="card"><h3>' + esc(r.name) + '</h3><p class="muted small">' + esc(r.company) + (productName(r) ? ' · <b style="color:#fff">' + esc(productName(r)) + '</b>' : '') + '</p>' +
        B.lineChart({ labels: c.labels, step: 100, height: 250, series: [
          { name: 'Отрасль', values: c.ind, color: '#9A9A9A', width: 3 },
          { name: 'Новая кривая', values: c.mine, color: '#FADD59', width: 4 }] }) +
        '<div style="display:grid;gap:6px;margin-top:8px">' + byAct + '</div>' +
        (has(D(r, 'mySlogan')) ? '<p style="margin:12px 0 0"><b>Слоган:</b> ' + esc(D(r, 'mySlogan')) + '</p>' : '') + '</div>';
    }).join('') + '</div>' : empty('Новые кривые пока не заполнены.'));

    if (withCurve.length) {
      var series = [{ name: 'Общая кривая отрасли', values: calc.map(function (c) { return c.final; }), color: '#FADD59', width: 6 }].concat(
        withCurve.map(function (r, i) {
          return { name: r.name + (productName(r) ? ': ' + productName(r) : ''), values: calc.map(function (c) { return getPath(r.data, 'newCurve.r.' + c.k); }), color: B.PALETTE[i % B.PALETTE.length], width: 2 };
        }));
      h += '<h3>Все новые кривые</h3><div class="card">' + B.lineChart({ labels: f, series: series, height: 300 }) + '</div>';
    }

    var helps = [];
    R.forEach(function (r) { (getPath(r.data, 'helps') || []).forEach(function (x) { if (x && x.to && x.text) helps.push({ from: r.name, to: x.to, text: x.text }); }); });
    var got = {};
    helps.forEach(function (x) { got[x.to] = 1; });
    h += '<h3>Помощь партнёров</h3><div class="card"><p><span class="big-num">' + Object.keys(got).length + '</span> <span class="muted">из ' + R.length + ' участников получили хотя бы одно предложение помощи</span></p>' +
      (helps.length ? '<div class="tbl-wrap"><table><thead><tr><th>Кто помогает</th><th>Кому</th><th>Чем</th></tr></thead><tbody>' +
        helps.map(function (x) { return '<tr><td><b>' + esc(x.from) + '</b></td><td>' + esc(personName(x.to)) + '</td><td>' + esc(x.text) + '</td></tr>'; }).join('') + '</tbody></table></div>' : empty()) + '</div>';
    return h;
  };

  BLOCKS.final = function () {
    var rows = R.filter(function (r) { return has(D(r, 'final.focus')) || has(D(r, 'final.action')); });
    var joint = rows.filter(function (r) { return has(D(r, 'final.with')); }).length;
    var withAction = rows.filter(function (r) { return has(D(r, 'final.action')); }).length;
    var h = '<p><span class="big-num">' + joint + '</span> <span class="muted">из ' + withAction + ' действий совместные или с помощью партнёра</span></p>';
    h += rows.length ? '<div class="tbl-wrap"><table><thead><tr><th>Участник</th><th>Фокус</th><th>Действие</th><th>С кем</th><th>Срок</th><th>Как пойму</th></tr></thead><tbody>' +
      rows.map(function (r) {
        var dl = D(r, 'final.deadline');
        if (/^\d{4}-\d{2}-\d{2}$/.test(dl)) dl = dl.split('-').reverse().join('.');
        return '<tr><td><b>' + esc(r.name) + '</b></td><td>' + esc(D(r, 'final.focus')) + '</td><td>' + esc(D(r, 'final.action')) + '</td><td>' + esc(D(r, 'final.with')) + '</td><td>' + esc(dl) + '</td><td>' + esc(D(r, 'final.how')) + '</td></tr>';
      }).join('') + '</tbody></table></div>' : empty();
    var ans = R.filter(function (r) { return has(D(r, 'final.answer')); });
    h += '<div class="card accent" style="margin-top:16px"><h3>Где рождается голубой океан для нас?</h3>' +
      (ans.length ? '<ul class="list">' + ans.map(function (r) { return '<li style="border-color:#c9b14a;font-size:19px">' + esc(D(r, 'final.answer')) + '<div class="small" style="opacity:.75">' + esc(r.name) + '</div></li>'; }).join('') + '</ul>' : '<p style="margin:0">Пока нет ответов.</p>') + '</div>';
    return h;
  };

  // ───── Отрисовка ─────

  var lastRoute;
  function renderAll() {
    // Средняя кривая уходит участникам, пока она показана
    if (S.industry && S.industry.shown) {
      var avg = {};
      industryCalc().forEach(function (c) { avg[c.k] = c.final; });
      if (JSON.stringify(avg) !== JSON.stringify(S.industry.avg || {})) {
        S.industry = Object.assign({}, S.industry, { avg: avg });
        patchLater('industry');
      }
    }
    if (S.route !== lastRoute) {
      lastRoute = S.route;
      $('detA').open = S.route !== 'B';
      $('detB').open = S.route !== 'A';
    }
    document.querySelectorAll('[data-block]').forEach(function (el) {
      var name = el.dataset.block;
      var html = BLOCKS[name]();
      if (lastHtml[name] === html) return;
      lastHtml[name] = html;
      var ae = document.activeElement, focus = null;
      if (ae && ae.dataset && ae.dataset.k && el.contains(ae)) focus = { k: ae.dataset.k, s: ae.selectionStart, e: ae.selectionEnd };
      el.innerHTML = html;
      if (focus) {
        var n = el.querySelector('[data-k="' + focus.k + '"]');
        if (n) { n.focus(); try { n.setSelectionRange(focus.s, focus.e); } catch (err) {} }
      }
    });
  }

  // ───── События ─────

  function onEdit(e) {
    var k = e.target.dataset && e.target.dataset.k;
    if (!k) return;
    if (k.indexOf('local:') === 0) {
      L[k.slice(6)] = e.target.value;
      if (e.target.tagName === 'SELECT') renderAll();
      return;
    }
    setPath(S, k, e.target.value);
    patchLater(k.split('.')[0]);
    renderAll();
  }
  $('dash').addEventListener('input', onEdit);
  $('dash').addEventListener('change', function (e) { if (e.target.tagName === 'SELECT') onEdit(e); });

  $('dash').addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]');
    if (!b) return;
    var i = b.dataset.i, sh = S.shared || {}, nc = S.nc || {};
    switch (b.dataset.act) {
      case 'reveal': L.reveal = !L.reveal; renderAll(); break;
      case 'voteOpen': patch({ vote: { status: 'open' } }); break;
      case 'voteClose': {
        var res = { A: 0, B: 0 };
        R.forEach(function (r) { var v = D(r, 'scenario'); if (res[v] != null) res[v]++; });
        patch({ vote: { status: 'closed', results: res } });
        break;
      }
      case 'route':
        if (i && S.route && S.route !== i && !confirm('Сменить маршрут? У участников откроется другой маршрут.')) return;
        patch({ route: i || null });
        break;
      case 'ncPublish': {
        var opts = [0, 1, 2, 3].map(function (n) { return String(L['nc' + n] || '').trim(); }).filter(Boolean);
        if (opts.length < 2) { alert('Нужно хотя бы два варианта.'); return; }
        patch({ nc: { options: opts, status: 'open', results: [], winner: '' } });
        break;
      }
      case 'ncClose': {
        var counts = nc.options.map(function (o) { return R.filter(function (r) { return D(r, 'ncVote') === o; }).length; });
        var best = counts.indexOf(Math.max.apply(null, counts));
        patch({ nc: Object.assign({}, nc, { status: 'closed', results: counts, winner: nc.options[best] }) });
        break;
      }
      case 'ncWinner': patch({ nc: Object.assign({}, nc, { winner: nc.options[+i] }) }); break;
      case 'ncEdit':
        (nc.options || []).forEach(function (o, n) { L['nc' + n] = o; });
        patch({ nc: Object.assign({}, nc, { status: 'draft' }) });
        break;
      case 'cvAdd': patch({ shared: Object.assign({}, sh, { canvas: (sh.canvas || []).concat([{ f: '', today: '', ours: '' }]) }) }); break;
      case 'cvDel': { var cv = (sh.canvas || []).slice(); cv.splice(+i, 1); patch({ shared: Object.assign({}, sh, { canvas: cv }) }); break; }
      case 'cvFromGrid': {
        var cur = (sh.canvas || []).slice(), have = {};
        cur.forEach(function (r) { have[B.norm(r.f)] = 1; });
        B.ACTIONS.forEach(function (a) {
          B.lines(getPath(sh, 'grid.' + a.id)).forEach(function (t) {
            if (have[B.norm(t)]) return;
            have[B.norm(t)] = 1;
            cur.push({ f: t, today: a.id === 'create' ? 0 : '', ours: a.id === 'elim' ? 0 : '' });
          });
        });
        patch({ shared: Object.assign({}, sh, { canvas: cur }) });
        break;
      }
      case 'pickSlogan': {
        var withS = R.filter(function (r) { return has(D(r, 'slogan')); });
        patch({ shared: Object.assign({}, sh, { slogan: D(withS[+i], 'slogan') }) });
        break;
      }
      case 'sharedShow': patch({ shared: Object.assign({}, sh, { shown: !sh.shown }) }); break;
      case 'factorsPublish': {
        var f = B.lines(L.factorsDraft);
        if (!f.length) { alert('Впишите хотя бы один фактор.'); return; }
        if ((f.length < 6 || f.length > 8) && !confirm('Факторов ' + f.length + ', рекомендуем 6–8. Опубликовать всё равно?')) return;
        patch({ factors: f });
        break;
      }
      case 'industryShow': {
        var ind = Object.assign({}, S.industry || {});
        ind.shown = !ind.shown;
        if (ind.shown) { ind.avg = {}; industryCalc().forEach(function (c) { ind.avg[c.k] = c.final; }); }
        patch({ industry: ind });
        break;
      }
    }
  });

  // ───── Экспорт и сброс ─────

  function flatten(obj, prefix, out) {
    Object.keys(obj || {}).forEach(function (k) {
      if (k.charAt(0) === '_') return;
      var v = obj[k], p = prefix ? prefix + '.' + k : k;
      if (v && typeof v === 'object') flatten(v, p, out);
      else out[p] = v;
    });
    return out;
  }

  function download(name, text, type) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: type }));
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  function stamp() { return new Date().toISOString().slice(0, 10); }

  $('csvBtn').addEventListener('click', function () {
    var rows = R.map(function (r) { return Object.assign({ 'Имя': r.name, 'Компания': r.company, 'Обновлено': r.updated }, flatten(r.data, '', {})); });
    var cols = [];
    rows.forEach(function (r) { Object.keys(r).forEach(function (k) { if (cols.indexOf(k) < 0) cols.push(k); }); });
    var q = function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; };
    var csv = '﻿' + [cols.map(q).join(';')].concat(rows.map(function (r) { return cols.map(function (c) { return q(r[c]); }).join(';'); })).join('\r\n');
    download('club' + CLUB + '-otvety-' + stamp() + '.csv', csv, 'text/csv;charset=utf-8');
  });

  $('jsonBtn').addEventListener('click', function () {
    download('club' + CLUB + '-otvety-' + stamp() + '.json', JSON.stringify({ club: B.CFG.CLUBS[CLUB], exported: new Date().toISOString(), state: S, participants: R }, null, 2), 'application/json');
  });

  $('resetBtn').addEventListener('click', function () {
    if (!confirm('Удалить все ответы клуба «' + B.CFG.CLUBS[CLUB] + '»? Отменить это нельзя.')) return;
    if (!confirm('Точно очистить? Скачали ли вы ответы?')) return;
    $('resetMsg').textContent = 'Очищаем…';
    B.api('reset', { club: CLUB, pass: PASS }).then(function () {
      R = []; S = {}; L.factorsDraft = null; L.nc = ['', '', '', '']; L.reveal = false;
      [0, 1, 2, 3].forEach(function (n) { L['nc' + n] = ''; });
      lastHtml = {};
      renderAll();
      $('resetMsg').textContent = 'Готово. Ответы клуба очищены.';
    }).catch(function () { $('resetMsg').textContent = 'Не получилось. Проверьте связь и попробуйте ещё раз.'; });
  });

  // ───── Вход ─────

  function logout(msg) {
    PASS = null;
    try { sessionStorage.removeItem(SS); } catch (e) {}
    $('dash').classList.add('hidden');
    $('dashNav').classList.add('hidden');
    $('login').classList.remove('hidden');
    $('loginMsg').textContent = msg || '';
  }

  function enter(pass) {
    $('loginMsg').textContent = 'Проверяем…';
    return B.api('auth', { club: CLUB, pass: pass }).then(function () {
      PASS = pass;
      try { sessionStorage.setItem(SS, pass); } catch (e) {}
      $('login').classList.add('hidden');
      $('dash').classList.remove('hidden');
      $('dashNav').classList.remove('hidden');
      renderAll();
      poll();
    }).catch(function (e) {
      logout(e.code === 'auth' ? 'Пароль не подошёл.' : 'Нет связи с сервером. Попробуйте ещё раз.');
    });
  }

  $('loginForm').addEventListener('submit', function (e) { e.preventDefault(); enter($('pass').value); });

  // Секретная ссылка: host.html?club=1#key=пароль
  var key = (location.hash.match(/key=([^&]+)/) || [])[1];
  var stored = null;
  try { stored = sessionStorage.getItem(SS); } catch (e) {}
  if (key) enter(decodeURIComponent(key));
  else if (stored) enter(stored);
  else $('login').classList.remove('hidden');
})();
