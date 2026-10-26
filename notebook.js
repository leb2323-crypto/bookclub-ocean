// Тетрадь участника.
(function () {
  var B = window.BC, esc = B.esc, getPath = B.getPath, setPath = B.setPath;
  var CLUB = B.club();
  var $ = function (id) { return document.getElementById(id); };

  var ME = null;      // { id, name, company }
  var D = {};         // ответы участника
  var S = {};         // состояние встречи от ведущей
  var ROSTER = [];    // участники клуба
  var HELPS = [];     // помощь, которую предложили мне
  var cur = 'intro';  // открытый раздел
  var lastSig = '';

  if (!CLUB) { $('badClub').classList.remove('hidden'); return; }
  $('clubName').textContent = B.CFG.CLUBS[CLUB];
  var LS = 'bc-club' + CLUB;

  // ───── Сохранение ─────

  var saveTimer = null, inflight = false, again = false;
  function status(t, err) { var el = $('saveStatus'); el.textContent = t; el.classList.toggle('err', !!err); }

  function save() {
    D._ts = Date.now();
    D._epoch = S.epoch || 0;
    try { localStorage.setItem(LS + '-draft-' + ME.id, JSON.stringify(D)); } catch (e) {}
    status('Сохраняем…');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flush, 700);
  }

  function flush() {
    if (inflight) { again = true; return; }
    inflight = true;
    B.api('save', { club: CLUB, id: ME.id, name: ME.name, company: ME.company, data: D })
      .then(function () { status('Сохранено'); })
      .catch(function () { status('Нет связи, повторим', true); setTimeout(flush, 4000); })
      .then(function () { inflight = false; if (again) { again = false; flush(); } });
  }

  // ───── Поля ввода ─────

  function val(path) { var v = getPath(D, path); return v == null ? '' : v; }

  function inp(path, ph, type) {
    var extra = type === 'number' ? ' inputmode="decimal" min="0" max="100"' : '';
    return '<input type="' + (type || 'text') + '" data-p="' + path + '" value="' + esc(val(path)) + '" placeholder="' + esc(ph || '') + '"' + extra + '>';
  }
  function ta(path, ph, rows) {
    return '<textarea data-p="' + path + '" rows="' + (rows || 3) + '" placeholder="' + esc(ph || '') + '">' + esc(val(path)) + '</textarea>';
  }
  function sel(path, opts, ph) {
    var v = val(path);
    return '<select data-p="' + path + '"><option value="">' + esc(ph || 'Выберите') + '</option>' +
      opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(v) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>';
  }
  function seg(path, opts, cls) {
    var v = val(path);
    return '<div class="seg ' + (cls || '') + '">' + opts.map(function (o) {
      return '<button type="button" data-seg="' + path + '" data-v="' + esc(o[0]) + '" class="' + (String(o[0]) === String(v) ? 'on' : '') + '">' + esc(o[1]) + '</button>';
    }).join('') + '</div>';
  }
  function field(label, html, hint) {
    return '<label class="f">' + esc(label) + (hint ? '<span class="hint">' + esc(hint) + '</span>' : '') + '</label>' + html;
  }
  function act(name, text, data, cls) {
    return '<button type="button" class="' + (cls || 'btn ghost small') + '" data-act="' + name + '"' + (data != null ? ' data-i="' + esc(data) + '"' : '') + '>' + text + '</button>';
  }

  var RATE = [[1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5']];
  var CAT_OPTS = B.CATEGORIES.map(function (c) { return [c.id, c.name]; });
  var ACT_OPTS = B.ACTIONS.map(function (a) { return [a.id, a.name]; });

  function products() { return (getPath(D, 'prep.products') || []).filter(function (p) { return p && p.name; }); }
  function factors() { return S.factors || []; }

  // ───── Разделы ─────

  var SCREENS = {};

  SCREENS.intro = {
    nav: '0 · Как работать',
    render: function () {
      return '<span class="label">Как работать</span><h2>Ваша тетрадь встречи</h2><div class="card">' +
        '<p>Тетрадь заполняется по ходу встречи. Ответы сохраняются сами, к ним можно вернуться по этой же ссылке.</p>' +
        '<p>Раздел «Карта продуктов» заполните до встречи.</p>' +
        '<p>В начале встречи группа выберет один из двух маршрутов. Его разделы откроются здесь после выбора.</p>' +
        '<p style="margin:0">Внизу страницы есть справка с ключевыми идеями книги.</p></div>';
    }
  };

  SCREENS.prep = {
    nav: '1 · Карта продуктов',
    render: function () {
      var list = getPath(D, 'prep.products');
      if (!list || !list.length) { setPath(D, 'prep.products', [{ id: B.uid() }]); list = D.prep.products; }
      var h = '<span class="label">Заполните до встречи</span><h2>Карта продуктов</h2>' +
        '<p>Разложите свои продукты и услуги по трём категориям. Критерий: насколько ценность продукта для клиента отличается от того, что предлагает отрасль.</p>' +
        '<div class="grid3">' + B.CATEGORIES.map(function (c, i) {
          return '<div class="card"><div class="row"><span class="num">' + (i + 1) + '</span><div class="grow"><h3>' + esc(c.name) + '</h3></div></div>' +
            '<p style="margin-top:10px">' + esc(c.text) + '</p><p class="muted small" style="margin:0"><b>Тест:</b> ' + esc(c.test) + '</p></div>';
        }).join('') + '</div>';
      h += '<h3 style="margin-top:12px">Мои продукты и услуги</h3>';
      list.forEach(function (p, i) {
        var base = 'prep.products.' + i;
        h += '<div class="product"><div class="row"><div class="grow">' + field('Продукт или услуга', inp(base + '.name', 'Например, выездное обслуживание')) + '</div>' +
          (list.length > 1 ? '<button type="button" class="xbtn" data-act="delProduct" data-i="' + i + '" title="Удалить продукт" aria-label="Удалить продукт">×</button>' : '') + '</div>' +
          '<div class="grid2">' + '<div>' + field('Категория сегодня', sel(base + '.today', CAT_OPTS)) + '</div>' +
          '<div>' + field('Категория через 2 года', sel(base + '.future', CAT_OPTS)) + '</div></div>' +
          field('Что нужно, чтобы продукт поднялся на уровень выше', ta(base + '.need', '', 2)) + '</div>';
      });
      h += '<div class="btns">' + act('addProduct', '+ Добавить продукт') + '</div>';
      var named = products();
      h += '<div class="card" style="margin-top:18px"><h3>Отметьте один продукт, который больше всего хотите вывести вверх</h3>' +
        (named.length ? seg('prep.focus', named.map(function (p) { return [p.id, p.name]; }), 'small') : '<p class="muted" style="margin:0">Сначала впишите название продукта выше.</p>') + '</div>';
      return h;
    },
    // после ввода названия продукта обновляем блок выбора
    rerenderOn: /^prep\.products\.\d+\.name$/
  };

  SCREENS.idea = {
    nav: '2 · Ключевая мысль',
    render: function () {
      return '<span class="label">Ключевая мысль</span><h2>Сверяем ключевую мысль</h2>' +
        '<div class="card accent"><h3>Разминка</h3><p>Авторы изучили более 150 стратегических шагов. 86% были улучшениями на существующем рынке, 14% создавали голубые океаны.</p>' +
        '<p><b>Какую долю прибыли принесли эти 14%?</b></p><div class="pct">' + inp('warmup', '0', 'number') + '<span>%</span></div></div>' +
        '<div class="card">' + field('Для меня стратегия голубого океана – это про…', ta('thought', '', 3)) +
        field('Что в книге зацепило сильнее всего', ta('hook', '', 3)) + '</div>';
    }
  };

  var ROUTES = {
    A: { name: 'А. «Океан на стыке»', short: 'А «Океан на стыке»', text: 'Ищем клиентов, которые сегодня не покупают ни у кого из нас, и собираем для них совместное предложение. Уходим с идеей совместного пилота.' },
    B: { name: 'Б. «От колонистов к первопроходцам»', short: 'Б «От колонистов к первопроходцам»', text: 'Смотрим, за что конкурирует наша отрасль, и каждый выводит свой продукт из общей гонки. Уходим с планом по своему продукту и помощью от других партнёров.' }
  };

  SCREENS.choice = {
    nav: '3 · Выбор сценария',
    sig: function () { return JSON.stringify([S.vote, S.route]); },
    render: function () {
      var v = S.vote || {}, open = v.status === 'open', closed = v.status === 'closed';
      var h = '<span class="label">Выбор сценария</span><h2>Какой маршрут выберем?</h2>';
      if (S.route) {
        h += '<div class="card accent"><h3>Группа выбрала маршрут ' + esc(ROUTES[S.route].short) + '</h3><div class="btns">' +
          '<button type="button" class="btn" style="background:#2C2C2C;color:#FADD59" data-act="go" data-i="' + (S.route === 'A' ? 'a1' : 'b1') + '">Перейти к маршруту</button></div></div>';
      } else if (open) {
        h += '<p>Голосование открыто. Выберите один вариант. До закрытия голос можно поменять.</p>';
      } else if (closed) {
        h += '<p>Голосование закрыто. Ведущая подтвердит итоговый выбор.</p>';
      } else {
        h += '<p>Голосование откроет ведущая. Пока познакомьтесь с вариантами.</p>';
      }
      var res = v.results || {}, total = (res.A || 0) + (res.B || 0);
      h += '<div class="grid2">' + ['A', 'B'].map(function (k) {
        var on = D.scenario === k;
        var r = closed || S.route ? '<div class="small muted" style="margin-top:12px">Голосов: <b style="color:#fff">' + (res[k] || 0) + '</b></div><div class="bar"><i style="width:' + (total ? Math.round(100 * (res[k] || 0) / total) : 0) + '%"></i></div>' : '';
        return '<button type="button" class="option' + (on ? ' on' : '') + '" data-act="scenario" data-i="' + k + '"' + (open ? '' : ' disabled') + '>' +
          '<h3>' + esc(ROUTES[k].name) + '</h3><p style="margin:0">' + esc(ROUTES[k].text) + '</p>' +
          (on ? '<p class="small" style="margin:10px 0 0;color:#FADD59"><b>Ваш голос</b></p>' : '') + r + '</button>';
      }).join('') + '</div>';
      return h;
    }
  };

  SCREENS.route = {
    nav: '4 · Маршрут',
    locked: true,
    render: function () {
      return '<div class="card locked-box"><div class="big">Маршрут откроется после выбора</div><p style="margin:0">Когда ведущая подтвердит выбор группы, здесь появятся разделы маршрута.</p></div>';
    }
  };

  // ── Маршрут А ──

  SCREENS.a1 = {
    nav: '4А.1 · Неклиенты',
    sig: function () { return S.anchor || ''; },
    render: function () {
      var h = '<span class="label">Маршрут А · Океан на стыке</span><h2>Три яруса неклиентов</h2>' +
        '<p>Смотрим не на клиентов, а на тех, кто у нас не покупает. Ищем сходства между ними, а не различия.</p>' +
        '<div class="card dark"><b>Мы ищем неклиентов:</b> ' + (S.anchor ? esc(S.anchor) : '<span class="muted">ведущая заполнит после обсуждения</span>') + '</div>';
      B.TIERS.forEach(function (t, ti) {
        var list = getPath(D, 'nc.' + t.id);
        if (!list || !list.length) { setPath(D, 'nc.' + t.id, [{}]); list = D.nc[t.id]; }
        h += '<div class="card"><div class="row"><span class="num">' + (ti + 1) + '</span><div class="grow"><h3>' + esc(t.name) + '</h3><p style="margin:0">' + esc(t.text) + '</p>' +
          (t.ex ? '<p class="muted small" style="margin:6px 0 0">' + esc(t.ex) + '</p>' : '') + '</div></div>';
        list.forEach(function (r, i) {
          var base = 'nc.' + t.id + '.' + i;
          h += '<div class="grid2" style="margin-top:12px"><div>' + field('Кто они', inp(base + '.who', '')) + '</div><div>' + field('Почему не покупают', inp(base + '.why', '')) + '</div></div>';
        });
        if (list.length < 2) h += '<div class="btns">' + act('addTier', '+ Ещё строка', t.id) + '</div>';
        h += '</div>';
      });
      return h;
    }
  };

  SCREENS.a2 = {
    nav: '4А.2 · Голосование',
    sig: function () { return JSON.stringify(S.nc || {}); },
    render: function () {
      var nc = S.nc || {}, opts = nc.options || [];
      var h = '<span class="label">Маршрут А · Голосование</span><h2>Какого неклиента берём?</h2>';
      if (!opts.length) return h + '<div class="card locked-box"><div class="big">Варианты появятся, когда ведущая их опубликует</div></div>';
      var closed = nc.status === 'closed';
      h += '<p>' + (closed ? 'Голосование закрыто.' : 'Выберите один вариант: неклиент и главная причина, почему он не покупает.') + '</p>';
      var res = nc.results || [], total = res.reduce(function (a, b) { return a + (b || 0); }, 0);
      opts.forEach(function (o, i) {
        var on = D.ncVote === o;
        h += '<button type="button" class="option' + (on ? ' on' : '') + '" data-act="ncVote" data-i="' + i + '"' + (closed ? ' disabled' : '') + '>' +
          '<h3><span class="num">' + (i + 1) + '</span>' + esc(o) + '</h3>' + (on ? '<p class="small" style="margin:6px 0 0;color:#FADD59"><b>Ваш голос</b></p>' : '') +
          (closed ? '<div class="small muted" style="margin-top:8px">Голосов: <b style="color:#fff">' + (res[i] || 0) + '</b></div><div class="bar"><i style="width:' + (total ? Math.round(100 * (res[i] || 0) / total) : 0) + '%"></i></div>' : '') + '</button>';
      });
      if (nc.winner) h += '<div class="card accent"><b>Выбор группы:</b> ' + esc(nc.winner) + '</div>';
      return h;
    }
  };

  SCREENS.a3 = {
    nav: '4А.3 · Решётка',
    sig: function () { return (S.nc && S.nc.winner) || ''; },
    render: function () {
      var w = S.nc && S.nc.winner;
      var h = '<span class="label">Маршрут А · Решётка</span><h2>Решётка совместного предложения</h2>' +
        (w ? '<div class="card accent"><b>Наш неклиент:</b> ' + esc(w) + '</div>' : '') +
        '<p>Собираем то, что партнёры могут сделать для этого неклиента только вместе.</p>' +
        '<div class="card dark small"><b>Образец, [yellow tail]:</b> упразднили винную терминологию и долгую выдержку, снизили число наименований, создали простоту выбора и ощущение веселья.</div>' +
        '<div class="grid2">';
      B.ACTIONS.forEach(function (a) {
        h += '<div class="card"><span class="chip">' + esc(a.name) + '</span>' + field('', '', a.q).replace('<label class="f">', '<label class="f" style="margin-top:8px">') +
          ta('grid.' + a.id, 'Одна идея на строку', 4) + (a.id === 'create' ? B.sixPathsHtml() : '') + '</div>';
      });
      return h + '</div>';
    }
  };

  SCREENS.a4 = {
    nav: '4А.4 · Слоган',
    render: function () {
      return '<span class="label">Маршрут А · Слоган</span><h2>Слоган совместного предложения</h2>' +
        '<div class="card dark small"><b>Образец, Southwest Airlines:</b> скорость самолёта по цене поездки на автомобиле.</div>' +
        '<div class="card">' + field('Наш слоган в одну фразу', ta('slogan', '', 2)) +
        field('Какие партнёры нужны и что даёт каждый', ta('partners', '', 4)) + '</div>';
    }
  };

  SCREENS.a5 = {
    nav: '4А.5 · Общая решётка',
    sig: function () { return JSON.stringify(S.shared || {}); },
    render: function () {
      var sh = S.shared || {};
      var h = '<span class="label">Маршрут А · Итог группы</span><h2>Общая решётка и канва</h2>';
      if (!sh.shown) return h + '<div class="card locked-box"><div class="big">Появится, когда ведущая покажет общий результат</div></div>';
      if (sh.slogan) h += '<div class="card accent"><b>Слоган:</b> ' + esc(sh.slogan) + '</div>';
      var g = sh.grid || {};
      h += '<div class="grid2">' + B.ACTIONS.map(function (a) {
        var items = B.lines(g[a.id]);
        return '<div class="card"><span class="chip">' + esc(a.name) + '</span><ul class="list" style="margin-top:8px">' +
          (items.length ? items.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') : '<li class="muted">Пока пусто</li>') + '</ul></div>';
      }).join('') + '</div>';
      var cv = (sh.canvas || []).filter(function (r) { return r.f; });
      if (cv.length) {
        h += '<div class="card"><h3>Общая канва</h3>' + B.lineChart({
          labels: cv.map(function (r) { return r.f; }),
          series: [
            { name: 'Сегодня у рынка', values: cv.map(function (r) { return r.today; }), color: '#9A9A9A', width: 3 },
            { name: 'Наше совместное предложение', values: cv.map(function (r) { return r.ours; }), color: '#FADD59', width: 4 }
          ]
        }) + '</div>';
      }
      return h;
    }
  };

  // ── Маршрут Б ──

  SCREENS.b1 = {
    nav: '4Б.1 · Как читать канву',
    render: function () {
      var Q = B.QB;
      return '<span class="label">Маршрут Б · Канва</span><h2>Как читать канву стратегии</h2>' +
        '<p>Японская сеть парикмахерских QB House убрала запись, дополнительные услуги и уход за волосами. Зато сделала стрижку за 10 минут, дешевле рынка, с высокой гигиеной и системой «сухого мытья».</p>' +
        '<div class="card">' + B.lineChart({
          labels: Q.factors, title: 'Канва QB House',
          series: [
            { name: 'Обычная парикмахерская', values: Q.usual, color: '#9A9A9A', width: 3 },
            { name: 'QB House', values: Q.qb, color: '#FADD59', width: 4 }
          ]
        }) + '</div>' +
        '<h3>Три правила чтения</h3><div class="card">' +
        [['Кривые расходятся', 'Там появилась новая ценность.'], ['Оценка упала', 'Компания упразднила или снизила лишнее.'], ['Появился новый фактор', 'Компания создала то, чего отрасль не предлагала.']].map(function (r, i) {
          return '<div class="row" style="margin-bottom:' + (i < 2 ? '12px' : '0') + '"><span class="num">' + (i + 1) + '</span><div class="grow"><b>' + r[0] + '.</b> ' + r[1] + '</div></div>';
        }).join('') + '</div>';
    }
  };

  function industryAvg() {
    var ind = S.industry || {};
    return ind.shown ? (ind.avg || {}) : null;
  }

  SCREENS.b2 = {
    nav: '4Б.2 · Канва отрасли',
    sig: function () { return JSON.stringify([S.factors, S.industry]); },
    render: function () {
      var f = factors();
      var h = '<span class="label">Маршрут Б · Канва отрасли</span><h2>За что конкурирует отрасль</h2>';
      if (!f.length) return h + '<div class="card locked-box"><div class="big">Факторы появятся после обсуждения</div></div>';
      h += '<p>Оцените каждый фактор от 1 до 5: как это предлагает отрасль сегодня.</p><div class="card">';
      f.forEach(function (name, i) {
        h += '<div style="margin-bottom:' + (i < f.length - 1 ? '16px' : '0') + '"><b>' + esc(name) + '</b><div style="margin-top:6px">' + seg('industry.' + B.fkey(name), RATE) + '</div></div>';
      });
      h += '</div>';
      var avg = industryAvg();
      if (avg) {
        h += '<div class="card"><h3>Общая кривая отрасли</h3>' + B.lineChart({
          labels: f, series: [{ name: 'Отрасль сегодня, среднее по группе', values: f.map(function (n) { return avg[B.fkey(n)]; }), color: '#9A9A9A', width: 4 }]
        }) + '</div>';
      }
      return h;
    }
  };

  function curveData() {
    var f = factors(), avg = industryAvg();
    var custom = (getPath(D, 'newCurve.custom') || []).filter(function (c) { return c && c.name; });
    var labels = f.concat(custom.map(function (c) { return c.name; }));
    var ind = f.map(function (n) { var k = B.fkey(n); return avg ? avg[k] : getPath(D, 'industry.' + k); }).concat(custom.map(function () { return 0; }));
    var mine = f.map(function (n) { return getPath(D, 'newCurve.r.' + B.fkey(n)); }).concat(custom.map(function (c) { return c.r; }));
    return { labels: labels, ind: ind, mine: mine, custom: custom.length, avgShown: !!avg };
  }

  function curveChartHtml() {
    var c = curveData();
    var h = B.lineChart({
      labels: c.labels, title: 'Новая кривая моего продукта',
      series: [
        { name: c.avgShown ? 'Отрасль, среднее по группе' : 'Отрасль, моя оценка', values: c.ind, color: '#9A9A9A', width: 3 },
        { name: 'Мой продукт в новой версии', values: c.mine, color: '#FADD59', width: 4 }
      ]
    });
    var pairs = 0, diff = 0;
    c.ind.forEach(function (v, i) {
      var m = c.mine[i];
      if (v != null && v !== '' && m != null && m !== '') { pairs++; diff += Math.abs(+v - +m); }
    });
    if (pairs >= Math.max(3, c.labels.length - 1) && !c.custom && diff / pairs < 0.75) {
      h += '<div class="warn">Похоже на улучшение, а не на голубой океан. Что можно упразднить или создать?</div>';
    }
    return h;
  }

  SCREENS.b3 = {
    nav: '4Б.3 · Новая кривая',
    sig: function () { return JSON.stringify([S.factors, S.industry]); },
    render: function () {
      var f = factors();
      var h = '<span class="label">Маршрут Б · Мой продукт</span><h2>Новая кривая моего продукта</h2>';
      if (!f.length) return h + '<div class="card locked-box"><div class="big">Факторы появятся после обсуждения</div></div>';
      var named = products();
      if (!getPath(D, 'newCurve.product') && D.prep && D.prep.focus) setPath(D, 'newCurve.product', D.prep.focus);
      h += '<div class="card">' + (named.length
        ? field('Мой продукт', sel('newCurve.product', named.map(function (p) { return [p.id, p.name]; }), 'Выберите продукт'), 'Подставлен из карты продуктов. Можно сменить.')
        : field('Мой продукт', inp('newCurve.productName', 'Название продукта'))) + '</div>';
      h += '<p>По каждому фактору поставьте оценку «Мой продукт в новой версии» и выберите действие.</p><div class="card">';
      f.forEach(function (name, i) {
        var k = B.fkey(name);
        h += '<div style="margin-bottom:' + (i < f.length - 1 ? '18px' : '0') + '"><b>' + esc(name) + '</b><div style="margin-top:6px">' + seg('newCurve.r.' + k, RATE) + '</div>' +
          '<div style="margin-top:6px">' + seg('newCurve.a.' + k, ACT_OPTS, 'small') + '</div></div>';
      });
      h += '</div>';
      var custom = getPath(D, 'newCurve.custom') || [];
      h += '<h3>Новые факторы</h3><p class="muted small">То, чего отрасль не предлагает. Можно добавить до двух.</p>';
      custom.forEach(function (c, i) {
        var base = 'newCurve.custom.' + i;
        h += '<div class="product"><div class="row"><div class="grow">' + field('Новый фактор', inp(base + '.name', '')) + '</div>' +
          '<button type="button" class="xbtn" data-act="delCustom" data-i="' + i + '" aria-label="Удалить фактор">×</button></div>' +
          '<div style="margin-top:8px">' + seg(base + '.r', RATE) + '</div></div>';
      });
      if (custom.length < 2) h += '<div class="btns" style="margin-bottom:14px">' + act('addCustom', '+ Добавить свой фактор') + '</div>';
      h += '<div class="card"><h3>Живой график</h3><div id="curveChart">' + curveChartHtml() + '</div></div>';
      h += B.sixPathsHtml();
      h += '<div class="card">' + field('Слоган моего продукта в одну фразу', ta('mySlogan', '', 2)) + '</div>';
      return h;
    },
    refresh: function () { var el = $('curveChart'); if (el) el.innerHTML = curveChartHtml(); }
  };

  SCREENS.b4 = {
    nav: '4Б.4 · Помощь партнёров',
    sig: function () { return JSON.stringify([ROSTER, HELPS]); },
    render: function () {
      var others = ROSTER.filter(function (r) { return r.id !== ME.id; });
      var list = D.helps || [];
      if (!list.length) { D.helps = [{}]; list = D.helps; }
      var h = '<span class="label">Маршрут Б · Помощь</span><h2>Чем я могу помочь другим участникам</h2>' +
        '<p>Выберите участника и напишите, чем поможете: контакт, ресурс, совместный шаг.</p>';
      list.forEach(function (x, i) {
        var base = 'helps.' + i;
        h += '<div class="product"><div class="row"><div class="grow">' +
          field('Кому', sel(base + '.to', others.map(function (r) { return [r.id, r.name + (r.company ? ', ' + r.company : '')]; }), others.length ? 'Выберите участника' : 'Участники пока не вошли')) + '</div>' +
          (list.length > 1 ? '<button type="button" class="xbtn" data-act="delHelp" data-i="' + i + '" aria-label="Удалить">×</button>' : '') + '</div>' +
          field('Чем помогу', ta(base + '.text', '', 2)) + '</div>';
      });
      h += '<div class="btns">' + act('addHelp', '+ Ещё помощь') + '</div>';
      h += '<div class="card" style="margin-top:20px"><h3>Мне предложили помощь</h3>' + (HELPS.length
        ? '<ul class="list">' + HELPS.map(function (x) { return '<li><b>' + esc(x.fromName) + '</b>' + (x.fromCompany ? ', ' + esc(x.fromCompany) : '') + '<br>' + esc(x.text) + '</li>'; }).join('') + '</ul>'
        : '<p class="muted" style="margin:0">Пока никто не написал. Предложения появятся здесь сами.</p>') + '</div>';
      return h;
    }
  };

  // ── Общий финал ──

  SCREENS.final = {
    nav: '5 · Финал',
    sig: function () { return JSON.stringify(ROSTER); },
    render: function () {
      return '<span class="label">Финал</span><h2>1 фокус – 1 действие</h2><div class="card">' +
        field('Мой фокус', ta('final.focus', '', 2)) +
        field('Моё действие до следующей встречи', ta('final.action', '', 2)) +
        field('Делаю вместе с / чья помощь нужна', '<input type="text" list="rosterList" data-p="final.with" value="' + esc(val('final.with')) + '" placeholder="Партнёр">') +
        '<datalist id="rosterList">' + ROSTER.filter(function (r) { return r.id !== ME.id; }).map(function (r) { return '<option value="' + esc(r.name + (r.company ? ', ' + r.company : '')) + '">'; }).join('') + '</datalist>' +
        '<div class="grid2"><div>' + field('Срок', inp('final.deadline', '', 'date')) + '</div><div>' + field('Как пойму, что получилось', inp('final.how', '')) + '</div></div></div>' +
        '<div class="card accent"><h3>Где, по-вашему, рождается голубой океан для нас?</h3>' + ta('final.answer', '', 3) + '</div>';
    }
  };

  SCREENS.gates = {
    nav: '6 · Четыре ворот',
    sig: function () { return S.route || ''; },
    render: function () {
      var idea = S.route === 'A' ? 'совместного предложения' : S.route === 'B' ? 'своего продукта' : 'своей идеи';
      var h = '<span class="label">К следующей встрече</span><h2>Четыре ворот</h2>' +
        '<p>Проверьте идею ' + idea + ' по четырём вопросам подряд. Каждое «нет» значит «доработать».</p><div class="card">';
      B.GATES.forEach(function (g, i) {
        var base = 'gates.g' + i, ans = val(base + '.ans');
        h += '<div class="gate"><span class="num">' + (i + 1) + '</span><h3>' + esc(g.t) +
          (ans === 'no' ? '<span class="badge no">доработать</span>' : ans === 'yes' ? '<span class="badge yes">пройдено</span>' : '') + '</h3>' +
          '<p>' + esc(g.q) + '</p>' + seg(base + '.ans', [['yes', 'Да'], ['no', 'Нет']], 'small') +
          '<div style="margin-top:10px">' + ta(base + '.text', 'Ваш ответ', 2) + '</div></div>';
      });
      return h + '</div>';
    },
    rerenderSeg: true
  };

  function screenList() {
    var l = ['intro', 'prep', 'idea', 'choice'];
    if (S.route === 'A') l = l.concat(['a1', 'a2', 'a3', 'a4', 'a5']);
    else if (S.route === 'B') l = l.concat(['b1', 'b2', 'b3', 'b4']);
    else l.push('route');
    return l.concat(['final', 'gates']);
  }

  // ───── Отрисовка ─────

  function renderNav() {
    var l = screenList();
    $('steps').innerHTML = l.map(function (id) {
      return '<button type="button" class="step-btn' + (id === cur ? ' active' : '') + (SCREENS[id].locked ? ' locked' : '') + '" data-go="' + id + '">' + esc(SCREENS[id].nav) + '</button>';
    }).join('');
    var a = $('steps').querySelector('.active');
    if (a && a.scrollIntoView) a.scrollIntoView({ block: 'nearest', inline: 'center' });
    var i = l.indexOf(cur);
    $('prev').style.visibility = i > 0 ? 'visible' : 'hidden';
    $('next').style.visibility = i < l.length - 1 ? 'visible' : 'hidden';
  }

  function renderScreen(keepFocus) {
    var focus = null, ae = document.activeElement;
    if (keepFocus && ae && ae.dataset && ae.dataset.p) {
      focus = { p: ae.dataset.p, s: ae.selectionStart, e: ae.selectionEnd };
    }
    $('screen').innerHTML = SCREENS[cur].render();
    if (focus) {
      var el = $('screen').querySelector('[data-p="' + focus.p + '"]');
      if (el) { el.focus(); try { el.setSelectionRange(focus.s, focus.e); } catch (e) {} }
    }
    lastSig = sigNow();
  }

  function sigNow() { return (S.route || '') + '|' + (SCREENS[cur].sig ? SCREENS[cur].sig() : ''); }

  function go(id) {
    if (screenList().indexOf(id) < 0) return;
    cur = id;
    try { localStorage.setItem(LS + '-screen', id); } catch (e) {}
    renderNav();
    renderScreen();
    window.scrollTo(0, 0);
  }

  // ───── События ─────

  $('steps').addEventListener('click', function (e) { var b = e.target.closest('[data-go]'); if (b) go(b.dataset.go); });
  $('prev').addEventListener('click', function () { var l = screenList(); go(l[l.indexOf(cur) - 1]); });
  $('next').addEventListener('click', function () { var l = screenList(); go(l[l.indexOf(cur) + 1]); });

  $('screen').addEventListener('input', function (e) {
    var p = e.target.dataset.p;
    if (!p) return;
    setPath(D, p, e.target.value);
    save();
    var sc = SCREENS[cur];
    if (sc.rerenderOn && sc.rerenderOn.test(p)) refreshFocusBlock();
    if (sc.refresh) sc.refresh();
  });
  $('screen').addEventListener('change', function (e) {
    var p = e.target.dataset.p;
    if (p && e.target.tagName === 'SELECT') { setPath(D, p, e.target.value); save(); if (SCREENS[cur].refresh) SCREENS[cur].refresh(); }
  });

  // Блок «Отметьте один продукт» обновляется без перерисовки полей
  function refreshFocusBlock() {
    var cards = $('screen').querySelectorAll('.card');
    var last = cards[cards.length - 1];
    var named = products();
    if (last) last.innerHTML = '<h3>Отметьте один продукт, который больше всего хотите вывести вверх</h3>' +
      (named.length ? seg('prep.focus', named.map(function (p) { return [p.id, p.name]; }), 'small') : '<p class="muted" style="margin:0">Сначала впишите название продукта выше.</p>');
  }

  $('screen').addEventListener('click', function (e) {
    var sg = e.target.closest('[data-seg]');
    if (sg) {
      setPath(D, sg.dataset.seg, sg.dataset.v);
      sg.parentNode.querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', b === sg); });
      save();
      if (SCREENS[cur].rerenderSeg) renderScreen();
      if (SCREENS[cur].refresh) SCREENS[cur].refresh();
      return;
    }
    var b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    var i = b.dataset.i;
    switch (b.dataset.act) {
      case 'go': go(i); return;
      case 'addProduct': D.prep.products.push({ id: B.uid() }); break;
      case 'delProduct':
        var gone = D.prep.products.splice(+i, 1)[0];
        if (gone && D.prep.focus === gone.id) D.prep.focus = '';
        break;
      case 'addTier': D.nc[i].push({}); break;
      case 'addHelp': D.helps.push({}); break;
      case 'delHelp': D.helps.splice(+i, 1); break;
      case 'addCustom':
        if (!getPath(D, 'newCurve.custom')) setPath(D, 'newCurve.custom', []);
        D.newCurve.custom.push({ a: 'create' });
        break;
      case 'delCustom': D.newCurve.custom.splice(+i, 1); break;
      case 'scenario': D.scenario = i; break;
      case 'ncVote': D.ncVote = (S.nc.options || [])[+i]; break;
      default: return;
    }
    save();
    renderScreen();
  });

  // ───── Состояние встречи ─────

  function poll() {
    B.api('pub', { club: CLUB, id: ME.id }).then(function (res) {
      var routeBefore = S.route, epochBefore = S.epoch || 0;
      S = res.state || {};
      // Ведущая очистила ответы клуба: начинаем тетрадь заново
      if ((S.epoch || 0) !== epochBefore) { D = {}; cur = 'intro'; renderNav(); renderScreen(); save(); }
      ROSTER = res.roster || [];
      HELPS = res.helps || [];
      if (S.route !== routeBefore) {
        if (screenList().indexOf(cur) < 0) cur = 'choice';
        renderNav();
      }
      if (sigNow() !== lastSig) renderScreen(true);
    }).catch(function () {}).then(function () {
      setTimeout(poll, document.hidden ? 15000 : 5000);
    });
  }

  // ───── Вход ─────

  function start(me) {
    ME = me;
    try { localStorage.setItem(LS + '-me', JSON.stringify(me)); } catch (e) {}
    $('login').classList.add('hidden');
    $('who').classList.remove('hidden');
    $('whoName').textContent = me.name + ', ' + me.company;
    var draft = null;
    try { draft = JSON.parse(localStorage.getItem(LS + '-draft-' + me.id) || 'null'); } catch (e) {}
    $('loginMsg').textContent = 'Открываем тетрадь…';
    return Promise.all([
      B.api('get', { club: CLUB, id: me.id }).catch(function () { return { data: null }; }),
      B.api('pub', { club: CLUB, id: me.id }).catch(function () { return {}; })
    ]).then(function (r) {
      var server = r[0].data;
      S = r[1].state || {};
      if (draft && (draft._epoch || 0) !== (S.epoch || 0)) draft = null;
      D = server && (!draft || (server._ts || 0) >= (draft._ts || 0)) ? server : (draft || {});
      ROSTER = r[1].roster || [];
      HELPS = r[1].helps || [];
      var saved = null;
      try { saved = localStorage.getItem(LS + '-screen'); } catch (e) {}
      cur = saved && screenList().indexOf(saved) >= 0 ? saved : 'intro';
      $('app').classList.remove('hidden');
      $('ref').innerHTML = B.referenceHtml();
      renderNav();
      renderScreen();
      status(server ? 'Ответы загружены' : '');
      // Новый участник сразу появляется в списке клуба
      if (!server) save();
      setTimeout(poll, 5000);
    });
  }

  $('loginForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var name = $('lName').value.trim(), company = $('lCompany').value.trim();
    if (!name || !company) return;
    start({ id: B.norm(name) + '|' + B.norm(company), name: name, company: company });
  });

  $('logout').addEventListener('click', function () {
    try { localStorage.removeItem(LS + '-me'); localStorage.removeItem(LS + '-screen'); } catch (e) {}
    location.reload();
  });

  var saved = null;
  try { saved = JSON.parse(localStorage.getItem(LS + '-me') || 'null'); } catch (e) {}
  if (saved && saved.id) start(saved);
  else $('login').classList.remove('hidden');
})();
