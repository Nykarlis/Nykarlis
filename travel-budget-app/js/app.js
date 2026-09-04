/* Travel Budget Estimator
 * Vanilla JS, no dependencies, no network calls beyond the local data file.
 * All figures come from data/countries.json — edit that file to change any number.
 */
(function () {
  'use strict';

  var CONTINENT_ORDER = ['Africa', 'Asia', 'Europe', 'North America', 'South America', 'Oceania'];
  var DATA = null;
  var BY_ISO = {};

  var el = {
    controls:    document.getElementById('controls'),
    search:      document.getElementById('country-search'),
    country:     document.getElementById('country'),
    countryHint: document.getElementById('country-hint'),
    departure:   document.getElementById('departure'),
    tiers:       document.getElementById('tiers'),
    nights:      document.getElementById('nights'),
    travellers:  document.getElementById('travellers'),
    share:       document.getElementById('share-rooms'),
    shareWrap:   document.getElementById('share-wrap'),
    shareNote:   document.getElementById('share-note'),
    compare:     document.getElementById('compare'),
    results:     document.getElementById('results'),
    disclaimer:  document.getElementById('disclaimer'),
    loadError:   document.getElementById('load-error'),
    loadDetail:  document.getElementById('load-error-detail')
  };

  /* ---------- helpers ---------- */

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function flag(iso) {
    if (!/^[A-Za-z]{2}$/.test(iso)) return '';
    return String.fromCodePoint.apply(null, iso.toUpperCase().split('').map(function (ch) {
      return 0x1F1E6 + ch.charCodeAt(0) - 65;
    }));
  }

  // Deliberately coarse: these are estimates, not quotes.
  function round5(n) {
    var r = Math.round(n / 5) * 5;
    return n > 0 && r === 0 ? 5 : r;
  }
  function round10(n) { return Math.round(n / 10) * 10; }

  function roundLocal(n) {
    var step = n >= 1e6 ? 10000 : n >= 1e5 ? 1000 : n >= 1e4 ? 100 : n >= 1e3 ? 10 : 1;
    return Math.round(n / step) * step;
  }

  var usdFmt = new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0
  });
  function usd(n) { return usdFmt.format(Math.round(n)); }

  var localFmtCache = {};
  function local(n, code) {
    if (!localFmtCache[code]) {
      try {
        localFmtCache[code] = new Intl.NumberFormat('en-US', {
          style: 'currency', currency: code, currencyDisplay: 'code', maximumFractionDigits: 0
        });
      } catch (e) {
        localFmtCache[code] = { format: function (v) { return code + ' ' + v.toLocaleString('en-US'); } };
      }
    }
    return localFmtCache[code].format(roundLocal(n));
  }

  function tierMeta(id) {
    for (var i = 0; i < DATA.tiers.length; i++) if (DATA.tiers[i].id === id) return DATA.tiers[i];
    return DATA.tiers[0];
  }
  function tierIndex(id) {
    for (var i = 0; i < DATA.tiers.length; i++) if (DATA.tiers[i].id === id) return i;
    return 0;
  }
  function regionLabel(id) {
    for (var i = 0; i < DATA.departure_regions.length; i++) {
      if (DATA.departure_regions[i].id === id) return DATA.departure_regions[i].label;
    }
    return DATA.departure_regions[0].label;
  }

  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

  /* ---------- the calculation ---------- */

  function estimate(country, opts) {
    var nights = opts.nights, pax = opts.travellers;
    var daily = country.daily_costs[opts.tier];
    var sharesRooms = opts.share && pax > 1 && opts.tier !== 'backpacker';

    var lines = [];

    // Accommodation: a shared double is priced at ~1.4x a single, i.e. ~30% off each.
    var accRaw = sharesRooms
      ? Math.ceil(pax / 2) * (daily.accommodation * 1.4) * nights
      : daily.accommodation * pax * nights;

    DATA.categories.forEach(function (cat) {
      var raw = cat.id === 'accommodation' ? accRaw : daily[cat.id] * pax * nights;
      lines.push({ id: cat.id, label: cat.label, amount: round5(raw) });
    });

    var flightsRaw = country.flights_usd[opts.departure] * pax;
    lines.push({ id: 'flights', label: 'Flights (round trip)', amount: flightsRaw });

    var total = lines.reduce(function (a, l) { return a + l.amount; }, 0);
    var onGround = total - flightsRaw;

    return {
      country: country,
      opts: opts,
      lines: lines,
      total: total,
      flights: flightsRaw,
      onGround: onGround,
      perPerson: round10(total / pax),
      perPersonPerDay: round5(onGround / nights / pax),
      sharesRooms: sharesRooms
    };
  }

  /* ---------- rendering ---------- */

  function renderCard(res, o) {
    o = o || {};
    var c = res.country, opts = res.opts;
    var pct = function (v) { return res.total ? (v / res.total) * 100 : 0; };

    var bar = res.lines.map(function (l) {
      return '<div class="bar-seg" style="width:' + pct(l.amount).toFixed(2) + '%;background:var(--c-' + l.id + ')" ' +
             'title="' + esc(l.label) + '"></div>';
    }).join('');

    var rows = res.lines.map(function (l) {
      return '<li>' +
        '<span class="dot" style="background:var(--c-' + l.id + ')"></span>' +
        '<span class="bd-label">' + esc(l.label) + '</span>' +
        '<span class="bd-share">' + Math.round(pct(l.amount)) + '%</span>' +
        '<span class="bd-amount">' + usd(l.amount) + '</span>' +
        '</li>';
    }).join('');

    var notes = c.notes.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('');

    // "What if I dropped a tier?"
    var idx = tierIndex(opts.tier), hint;
    if (idx > 0) {
      var lower = DATA.tiers[idx - 1];
      var lowerRes = estimate(c, Object.assign({}, opts, { tier: lower.id }));
      var saving = res.total - lowerRes.total;
      hint = '<span class="mark">&#8595;</span><span>Travelling <b>' + esc(lower.label) + '</b> instead would cost about ' +
             '<b>' + usd(lowerRes.total) + '</b> — a saving of roughly <b>' + usd(round10(saving)) + '</b>' +
             ' (' + Math.round((saving / res.total) * 100) + '% less).</span>';
    } else {
      var up = DATA.tiers[1];
      var upRes = estimate(c, Object.assign({}, opts, { tier: up.id }));
      hint = '<span class="mark">&#8593;</span><span>This is already the cheapest tier. Stepping up to <b>' + esc(up.label) +
             '</b> would cost about <b>' + usd(upRes.total) + '</b>, roughly ' +
             '<b>' + usd(round10(upRes.total - res.total)) + '</b> more.</span>';
    }

    var context = tierMeta(opts.tier).label + ' · ' + plural(opts.nights, 'night', 'nights') + ' · ' +
      plural(opts.travellers, 'traveller', 'travellers') +
      (opts.travellers > 1 ? (res.sharesRooms ? ' sharing rooms' : ', own rooms') : '');

    var delta = '';
    if (o.compareWith) {
      var diff = res.total - o.compareWith.total;
      delta = '<p class="stat-sub" style="margin:.4rem 0 0">' +
        (Math.abs(diff) < 25
          ? 'About the same as ' + esc(o.compareWith.country.name) + '.'
          : usd(round10(Math.abs(diff))) + ' ' + (diff > 0 ? 'more' : 'less') + ' than ' + esc(o.compareWith.country.name) + '.') +
        '</p>';
    }

    var footBtn = o.primary
      ? '<button type="button" class="copylink" id="copy-link">Copy shareable link</button>'
      : '';

    return '<article class="result-card">' +
      '<div class="headline">' +
        '<div class="headline-place"><span class="headline-flag">' + flag(c.iso) + '</span>' + esc(c.name) + '</div>' +
        '<p class="headline-context">' + esc(context) + ' · flying from ' + esc(regionLabel(opts.departure)) + '</p>' +
        '<div class="total">' + usd(res.total) + '</div>' +
        '<p class="total-local"><span class="approx">approx.</span> ' + local(res.total * c.usd_to_local, c.currency) +
          ' <span class="approx">at ' + esc(String(c.usd_to_local)) + ' ' + esc(c.currency) + ' to 1 USD, rates as of ' +
          esc(DATA.meta.rates_as_of) + '</span></p>' +
        delta +
      '</div>' +

      '<div class="stats">' +
        '<div class="stat"><div class="stat-label">Per traveller</div>' +
          '<div class="stat-value">' + usd(res.perPerson) + '</div>' +
          '<div class="stat-sub">whole trip</div></div>' +
        '<div class="stat"><div class="stat-label">Per day</div>' +
          '<div class="stat-value">' + usd(res.perPersonPerDay) + '</div>' +
          '<div class="stat-sub">each, on the ground</div></div>' +
        '<div class="stat"><div class="stat-label">Flights</div>' +
          '<div class="stat-value">' + usd(res.flights) + '</div>' +
          '<div class="stat-sub">' + plural(opts.travellers, 'ticket', 'tickets') + ', included above</div></div>' +
      '</div>' +

      '<div class="section"><h3>Where the money goes</h3>' +
        '<div class="bar">' + bar + '</div>' +
        '<ul class="breakdown">' + rows + '</ul>' +
      '</div>' +

      '<div class="section"><div class="tier-hint">' + hint + '</div></div>' +

      '<div class="section"><h3>Worth knowing</h3><ul class="notes">' + notes + '</ul></div>' +

      '<div class="card-foot">' +
        '<span>Ballpark estimates, last reviewed ' + esc(DATA.meta.last_reviewed) + '</span>' +
        footBtn +
      '</div>' +
    '</article>';
  }

  /* ---------- state ---------- */

  function readState() {
    return {
      iso: el.country.value,
      tier: (el.tiers.querySelector('input:checked') || {}).value || 'budget',
      nights: clamp(parseInt(el.nights.value, 10) || 7, 1, 365),
      travellers: clamp(parseInt(el.travellers.value, 10) || 1, 1, 20),
      share: el.share.checked,
      departure: el.departure.value,
      compare: el.compare.value
    };
  }

  function clamp(n, lo, hi) { return Math.min(hi, Math.max(lo, n)); }

  function syncUrl(s) {
    var p = new URLSearchParams();
    p.set('to', s.iso);
    p.set('tier', s.tier);
    p.set('nights', s.nights);
    p.set('pax', s.travellers);
    p.set('share', s.share ? '1' : '0');
    p.set('from', s.departure);
    if (s.compare) p.set('vs', s.compare);
    try {
      history.replaceState(null, '', location.pathname + '?' + p.toString());
    } catch (e) { /* file:// blocks replaceState in some browsers; harmless */ }
  }

  function update() {
    var s = readState();
    var country = BY_ISO[s.iso];
    if (!country) return;

    Array.prototype.forEach.call(el.tiers.querySelectorAll('.tier'), function (lab) {
      lab.classList.toggle('is-selected', lab.querySelector('input').checked);
    });

    // Room sharing is meaningless for dorm beds, and for solo travellers.
    var sharingApplies = s.travellers > 1 && s.tier !== 'backpacker';
    el.shareWrap.classList.toggle('disabled', !sharingApplies);
    el.share.disabled = !sharingApplies;
    el.shareNote.textContent = s.travellers < 2
      ? 'Only applies when there is more than one traveller.'
      : s.tier === 'backpacker'
        ? 'Dorm beds are already priced per person, so sharing changes nothing at this tier.'
        : 'Two people per room, priced at about 1.4× a single — roughly 30% off each.';

    var opts = { tier: s.tier, nights: s.nights, travellers: s.travellers, share: s.share, departure: s.departure };
    var main = estimate(country, opts);

    var html = renderCard(main, { primary: true });
    if (s.compare && BY_ISO[s.compare] && s.compare !== s.iso) {
      html += renderCard(estimate(BY_ISO[s.compare], opts), { compareWith: main });
      el.results.classList.add('compare-on');
    } else {
      el.results.classList.remove('compare-on');
    }

    el.results.innerHTML = html;
    el.countryHint.textContent = country.continent + ' · ' + country.currency_name;
    syncUrl(s);

    var btn = document.getElementById('copy-link');
    if (btn) btn.addEventListener('click', copyLink);
  }

  function copyLink(e) {
    var btn = e.currentTarget;
    var url = location.href;
    var done = function () {
      var was = btn.textContent;
      btn.textContent = 'Link copied';
      setTimeout(function () { btn.textContent = was; }, 1600);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(done, function () { fallbackCopy(url, done); });
    } else {
      fallbackCopy(url, done);
    }
  }

  function fallbackCopy(text, done) {
    var t = document.createElement('textarea');
    t.value = text;
    t.setAttribute('readonly', '');
    t.style.position = 'fixed';
    t.style.opacity = '0';
    document.body.appendChild(t);
    t.select();
    try { document.execCommand('copy'); done(); } catch (err) { /* nothing else to try */ }
    document.body.removeChild(t);
  }

  /* ---------- building the controls ---------- */

  function countryOptions(select, filter, placeholder) {
    var term = (filter || '').trim().toLowerCase();
    var frag = document.createDocumentFragment();

    if (placeholder) {
      var none = document.createElement('option');
      none.value = '';
      none.textContent = placeholder;
      frag.appendChild(none);
    }

    var matches = 0;
    CONTINENT_ORDER.forEach(function (cont) {
      var list = DATA.countries.filter(function (c) {
        return c.continent === cont && (!term || c.name.toLowerCase().indexOf(term) !== -1);
      });
      if (!list.length) return;
      list.sort(function (a, b) { return a.name.localeCompare(b.name); });
      var group = document.createElement('optgroup');
      group.label = cont;
      list.forEach(function (c) {
        var opt = document.createElement('option');
        opt.value = c.iso;
        opt.textContent = flag(c.iso) + '  ' + c.name;
        group.appendChild(opt);
        matches++;
      });
      frag.appendChild(group);
    });

    select.innerHTML = '';
    select.appendChild(frag);
    return matches;
  }

  function buildTiers(selected) {
    el.tiers.innerHTML = DATA.tiers.map(function (t) {
      return '<label class="tier">' +
        '<input type="radio" name="tier" value="' + esc(t.id) + '"' + (t.id === selected ? ' checked' : '') + '>' +
        '<span class="tier-name">' + esc(t.label) + '</span>' +
        '<span class="tier-desc">' + esc(t.description) + '</span>' +
      '</label>';
    }).join('');
  }

  function buildDepartures(selected) {
    el.departure.innerHTML = DATA.departure_regions.map(function (r) {
      return '<option value="' + esc(r.id) + '"' + (r.id === selected ? ' selected' : '') + '>' + esc(r.label) + '</option>';
    }).join('');
  }

  /* ---------- init ---------- */

  function init(data) {
    DATA = data;
    data.countries.forEach(function (c) { BY_ISO[c.iso] = c; });

    var q = new URLSearchParams(location.search);
    var wantIso = (q.get('to') || '').toUpperCase();
    var wantTier = q.get('tier');
    var wantFrom = q.get('from');
    var wantVs = (q.get('vs') || '').toUpperCase();

    countryOptions(el.country, '', null);
    countryOptions(el.compare, '', 'No comparison');

    el.country.value = BY_ISO[wantIso] ? wantIso : 'PT';
    if (!el.country.value) el.country.selectedIndex = 0;
    el.compare.value = BY_ISO[wantVs] ? wantVs : '';

    buildTiers(DATA.tiers.some(function (t) { return t.id === wantTier; }) ? wantTier : 'budget');
    buildDepartures(DATA.departure_regions.some(function (r) { return r.id === wantFrom; }) ? wantFrom : 'europe');

    if (q.get('nights')) el.nights.value = clamp(parseInt(q.get('nights'), 10) || 7, 1, 365);
    if (q.get('pax')) el.travellers.value = clamp(parseInt(q.get('pax'), 10) || 1, 1, 20);
    if (q.get('share') === '0') el.share.checked = false;

    document.getElementById('last-reviewed').textContent = data.meta.last_reviewed;
    document.getElementById('rates-as-of').textContent = data.meta.rates_as_of;

    // Search filters the destination list in place.
    el.search.addEventListener('input', function () {
      var keep = el.country.value;
      var n = countryOptions(el.country, el.search.value, null);
      if (!n) {
        countryOptions(el.country, '', null);
        el.country.value = keep;
      } else if (Array.prototype.some.call(el.country.options, function (o) { return o.value === keep; })) {
        el.country.value = keep;
      } else {
        el.country.selectedIndex = 0;
      }
      update();
    });

    el.controls.addEventListener('change', update);
    el.controls.addEventListener('input', function (e) {
      if (e.target === el.nights || e.target === el.travellers) update();
    });
    el.controls.addEventListener('submit', function (e) { e.preventDefault(); });

    Array.prototype.forEach.call(document.querySelectorAll('.step'), function (btn) {
      btn.addEventListener('click', function () {
        var input = document.getElementById(btn.dataset.target);
        var next = (parseInt(input.value, 10) || 0) + parseInt(btn.dataset.step, 10);
        input.value = clamp(next, parseInt(input.min, 10), parseInt(input.max, 10));
        update();
      });
    });

    el.controls.hidden = false;
    el.results.hidden = false;
    el.disclaimer.hidden = false;
    update();
  }

  fetch('data/countries.json')
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(init)
    .catch(function (err) {
      el.loadError.hidden = false;
      el.loadDetail.textContent = 'Technical detail: ' + err.message;
    });
})();
