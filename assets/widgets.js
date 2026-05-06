/*
 * widgets.js — interactive widgets for "AWS Basics" deck.
 *
 * Why this file
 * ─────────────
 * Reveal fragments are loaded via fetch + insertAdjacentHTML, which strips
 * <script> behaviour. The deck pattern: register a factory here, mark a
 * slide with <div data-widget="name" data-widget-options='{...}'>, and
 * deckWidgetsInit() instantiates it when slides are in the DOM.
 *
 * Conventions used by every factory in this file:
 *   • Colours come from semantic CSS vars (--ink, --paper, --accent,
 *     --good, --warn). No hex literals.
 *   • Every stateful widget is reversible — a "↺ reset" button (class
 *     dc-reset, top-right of the widget or absolute on the slide) returns
 *     the demo to its initial state.
 *   • Speaker keyboard verb: widgets that have a "next step" verb expose
 *     it by setting `marker.dataset.dcStepKey = "1"` and listening for
 *     the "dc:step" custom event. The shell dispatches that event to all
 *     such markers on the current slide when the speaker presses "."
 *   • Reduced-motion is handled globally in deck.css via
 *     @media (prefers-reduced-motion: reduce) — every animation in this
 *     file uses CSS transitions so it inherits that rule for free.
 *   • Dual-widget slides (§42, §50, §52) use distinct data-widget markers;
 *     the SVG-step-reveal owns one marker and toggles SVG group visibility,
 *     while the operational widget (azFailover etc.) lives in another
 *     marker that drives the same SVG via id lookup. They never share a
 *     click handler.
 */

(function () {

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const SVG_TAGS = new Set(['svg','g','rect','line','circle','text','path','use','polyline','polygon','defs','marker']);

  function el(tag, attrs, html) {
    const ns = SVG_TAGS.has(tag) ? SVG_NS : 'http://www.w3.org/1999/xhtml';
    const n = document.createElementNS(ns, tag);
    if (attrs) for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (html != null) n.innerHTML = html;
    return n;
  }

  function findTarget(root, selector) {
    if (!selector) return null;
    const sect = root.closest('section');
    return sect ? sect.querySelector(selector) : document.querySelector(selector);
  }

  function makeReset(onClick) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dc-reset';
    btn.textContent = '↺ reset';
    btn.addEventListener('click', onClick);
    return btn;
  }

  function controlBtn(label, color) {
    const c = color || 'var(--ink)';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.style.cssText = `
      display:inline-flex;align-items:center;gap:8px;
      padding:10px 16px;border-radius:8px;
      border:1px solid var(--rule);background:var(--paper-3);
      color:${c};font-family:'JetBrains Mono',ui-monospace,monospace;
      font-size:13px;letter-spacing:.06em;font-weight:500;
      cursor:pointer;transition:transform .12s ease,box-shadow .2s ease,border-color .2s ease;
    `;
    btn.innerHTML = label;
    btn.addEventListener('pointerdown', () => btn.style.transform = 'scale(.97)');
    btn.addEventListener('pointerup',   () => btn.style.transform = '');
    btn.addEventListener('mouseenter',  () => btn.style.borderColor = 'var(--accent)');
    btn.addEventListener('mouseleave',  () => { btn.style.transform = ''; btn.style.borderColor = 'var(--rule)'; });
    return btn;
  }

  // ════════════════════════════════════════════════════════════════════════
  // counter — bundled. AWS-flavoured: click increments and replaces "?"
  // in a teaching label with the running count.
  // ════════════════════════════════════════════════════════════════════════
  function createCounter(root, options) {
    const start = Number.isFinite(options.start) ? options.start : 0;
    const max   = Number.isFinite(options.max)   ? options.max   : Infinity;
    const label = options.label || 'clicks';
    let count = start;

    root.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:14px;align-items:flex-start">
        <div class="dc-counter-label"
             style="font-family:'JetBrains Mono',ui-monospace,monospace;
                    font-size:18px;color:var(--ink-2);letter-spacing:.04em">
          ${label}: <span class="dc-counter-q" style="color:var(--accent);font-weight:600">?</span>
        </div>
        <button type="button" class="dc-counter-btn"
          style="display:inline-flex;align-items:center;gap:14px;
                 padding:12px 20px;border-radius:999px;border:1px solid var(--rule);
                 background:var(--paper-3);color:var(--ink);
                 font-family:'JetBrains Mono',ui-monospace,monospace;font-size:16px;
                 cursor:pointer;transition:transform .12s ease, box-shadow .2s ease;
                 box-shadow:0 2px 8px -4px rgba(0,0,0,.18)">
          <span style="color:var(--muted);font-size:13px;letter-spacing:.18em;text-transform:uppercase">click to count</span>
          <span class="dc-counter-value" style="font-weight:600;color:var(--accent)">${count}</span>
        </button>
      </div>`;
    const btn = root.querySelector('.dc-counter-btn');
    const val = root.querySelector('.dc-counter-value');
    const q   = root.querySelector('.dc-counter-q');
    function tick() {
      if (count >= max) return;
      count += 1;
      val.textContent = count;
      q.textContent = String(count);
    }
    btn.addEventListener('pointerdown', () => btn.style.transform = 'scale(.96)');
    btn.addEventListener('pointerup',   () => btn.style.transform = '');
    btn.addEventListener('click', tick);

    root.dataset.dcStepKey = '1';
    root.addEventListener('dc:step', tick);

    root.appendChild(makeReset(() => {
      count = start; val.textContent = count; q.textContent = '?';
    }));
  }

  // ════════════════════════════════════════════════════════════════════════
  // reveal — bundled. Click-to-reveal hidden answer.
  // ════════════════════════════════════════════════════════════════════════
  function createReveal(root, options) {
    const prompt = options.prompt || 'Click to reveal';
    const answer = options.answer || '';

    function render(initial) {
      if (initial) {
        root.innerHTML = `
          <button type="button" class="dc-reveal-btn"
            style="display:inline-block;padding:14px 22px;border-radius:12px;
                   border:1px dashed var(--rule);background:transparent;
                   color:var(--muted);font-family:'JetBrains Mono',ui-monospace,monospace;
                   font-size:14px;letter-spacing:.08em;text-transform:uppercase;
                   cursor:pointer;transition:all .25s ease">
            ${prompt}
          </button>`;
        const btn = root.querySelector('.dc-reveal-btn');
        btn.addEventListener('click', () => render(false));
        btn.addEventListener('mouseenter', () => btn.style.borderColor = 'var(--accent)');
        btn.addEventListener('mouseleave', () => btn.style.borderColor = 'var(--rule)');
      } else {
        root.innerHTML = `
          <div style="display:inline-block;padding:14px 22px;border-radius:12px;
                      background:var(--paper-3);border:1px solid var(--good);
                      color:var(--ink);font-family:'Fraunces',Georgia,serif;
                      font-style:italic;font-size:24px;line-height:1.3;
                      animation:dc-fade-in .35s ease both">${answer}</div>`;
      }
    }
    render(true);
    root.dataset.dcStepKey = '1';
    root.addEventListener('dc:step', () => render(false));
    root.appendChild(makeReset(() => render(true)));
  }

  // ════════════════════════════════════════════════════════════════════════
  // svgStepReveal — reveal SVG sub-groups by id, one click at a time.
  // ════════════════════════════════════════════════════════════════════════
  function createSvgStepReveal(root, options) {
    const steps = Array.isArray(options.steps) ? options.steps : [];
    const targetSel = options.target;
    const svg = findTarget(root, targetSel);
    let idx = 0;

    function applyInitial() {
      if (!svg) return;
      steps.forEach(sel => {
        const node = svg.querySelector(sel);
        if (!node) return;
        node.style.transition = 'opacity .35s ease, transform .35s ease';
        node.style.opacity = '0';
        node.style.transform = 'translateY(6px)';
        node.style.transformOrigin = 'center';
      });
      idx = 0;
      updateLabel();
    }
    function step() {
      if (!svg || idx >= steps.length) return;
      const node = svg.querySelector(steps[idx]);
      if (node) { node.style.opacity = '1'; node.style.transform = 'none'; }
      idx += 1;
      updateLabel();
    }
    function updateLabel() {
      const lbl = root.querySelector('.dc-step-label');
      if (lbl) lbl.textContent = `step ${Math.min(idx, steps.length)} / ${steps.length}`;
    }

    root.innerHTML = `
      <div style="display:inline-flex;align-items:center;gap:14px;
                  padding:8px 14px;border-radius:999px;border:1px solid var(--rule);
                  background:var(--paper-3);
                  font-family:'JetBrains Mono',ui-monospace,monospace;font-size:13px">
        <span class="dc-step-label" style="color:var(--muted);letter-spacing:.08em">
          step 0 / ${steps.length}
        </span>
        <button type="button" class="dc-step-next"
          style="background:var(--accent);color:var(--paper);border:0;
                 padding:7px 14px;border-radius:999px;cursor:pointer;
                 font-family:inherit;font-size:12px;letter-spacing:.16em;
                 text-transform:uppercase;font-weight:500">
          next ›
        </button>
      </div>`;
    root.querySelector('.dc-step-next').addEventListener('click', step);

    root.dataset.dcStepKey = '1';
    root.addEventListener('dc:step', step);

    root.appendChild(makeReset(applyInitial));
    queueMicrotask(applyInitial);
  }

  // ════════════════════════════════════════════════════════════════════════
  // cidrSlider — drag the prefix length, bar resizes and re-subdivides.
  // Target SVG hosts:
  //   <g id="cidr-bar"></g>
  //   <text id="cidr-prefix">/16</text>
  //   <text id="cidr-count">65,536 addresses</text>
  //   <text id="cidr-subdiv">↳ 8 × /24 chunks</text>
  // ════════════════════════════════════════════════════════════════════════
  function createCidrSlider(root, options) {
    const svg = findTarget(root, options.target);
    const start = Number.isFinite(options.start) ? options.start : 16;
    let prefix = start;

    const BAR_X = 60, BAR_Y = 200, BAR_W = 1080, BAR_H = 80;

    function redraw() {
      if (!svg) return;
      const bar = svg.querySelector('#cidr-bar');
      const prefixLbl = svg.querySelector('#cidr-prefix');
      const countLbl = svg.querySelector('#cidr-count');
      const subdivLbl = svg.querySelector('#cidr-subdiv');
      if (!bar) return;
      while (bar.firstChild) bar.removeChild(bar.firstChild);

      const total = Math.pow(2, 32 - prefix);
      const slices = Math.min(8, Math.max(2, Math.pow(2, Math.min(3, Math.max(1, 32 - prefix - 1)))));
      const subPrefix = prefix + Math.round(Math.log2(slices));

      const w = BAR_W / slices;
      for (let i = 0; i < slices; i++) {
        const x = BAR_X + i * w;
        bar.appendChild(el('rect', {
          x, y: BAR_Y, width: w - 2, height: BAR_H,
          fill: i % 2 === 0
            ? 'color-mix(in srgb, var(--accent) 18%, var(--paper))'
            : 'color-mix(in srgb, var(--accent) 8%, var(--paper))',
          stroke: 'var(--ink)', 'stroke-width': '1.5'
        }));
        const t = el('text', {
          x: x + w / 2, y: BAR_Y + BAR_H / 2 + 5, 'text-anchor': 'middle',
          'font-family': 'JetBrains Mono, monospace', 'font-size': '13',
          fill: 'var(--ink)'
        });
        t.textContent = `/${subPrefix}`;
        bar.appendChild(t);
      }

      if (prefixLbl) prefixLbl.textContent = `/${prefix}`;
      if (countLbl)  countLbl.textContent = `${total.toLocaleString()} addresses`;
      if (subdivLbl) subdivLbl.textContent = `↳ ${slices} × /${subPrefix} chunks`;
    }

    root.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:10px;
                  font-family:'JetBrains Mono',ui-monospace,monospace;font-size:13px;color:var(--ink-2)">
        <div style="display:flex;align-items:center;gap:14px">
          <span style="color:var(--muted);letter-spacing:.16em;text-transform:uppercase">prefix</span>
          <input type="range" min="8" max="28" value="${prefix}" step="1"
                 class="dc-cidr-range"
                 style="accent-color:var(--accent);width:380px">
          <span class="dc-cidr-prefix" style="color:var(--accent);font-weight:600;font-size:18px">/${prefix}</span>
        </div>
        <div style="color:var(--muted);font-size:12px;letter-spacing:.12em;text-transform:uppercase">
          drag to feel the trade-off · bigger /N → smaller block
        </div>
      </div>`;
    const range = root.querySelector('.dc-cidr-range');
    const prefLbl = root.querySelector('.dc-cidr-prefix');
    range.addEventListener('input', (e) => {
      prefix = parseInt(e.target.value, 10);
      prefLbl.textContent = `/${prefix}`;
      redraw();
    });

    root.dataset.dcStepKey = '1';
    root.addEventListener('dc:step', () => {
      prefix = Math.min(28, prefix + 4);
      range.value = String(prefix);
      prefLbl.textContent = `/${prefix}`;
      redraw();
    });

    root.appendChild(makeReset(() => {
      prefix = start; range.value = String(prefix);
      prefLbl.textContent = `/${prefix}`; redraw();
    }));

    queueMicrotask(redraw);
  }

  // ════════════════════════════════════════════════════════════════════════
  // routeToggle — flip a subnet's default route between IGW and NAT.
  // ════════════════════════════════════════════════════════════════════════
  function createRouteToggle(root, options) {
    const svg = findTarget(root, options.target);
    let mode = options.start || 'igw';

    function apply() {
      if (!svg) return;
      const line  = svg.querySelector('#route-line');
      const lineNat = svg.querySelector('#route-line-nat');
      const label = svg.querySelector('#subnet-label');
      const igw   = svg.querySelector('#route-target-igw');
      const nat   = svg.querySelector('#route-target-nat');

      [line, lineNat, label, igw, nat].forEach(n => {
        if (n) n.style.transition = 'opacity .35s ease, fill .35s ease';
      });

      if (mode === 'igw') {
        if (line)    line.style.opacity = '1';
        if (lineNat) lineNat.style.opacity = '0';
        if (igw)     igw.style.opacity = '1';
        if (nat)     nat.style.opacity = '.25';
        if (label)   { label.textContent = 'public subnet'; label.setAttribute('fill', 'var(--accent)'); }
      } else {
        if (line)    line.style.opacity = '0';
        if (lineNat) lineNat.style.opacity = '1';
        if (igw)     igw.style.opacity = '.25';
        if (nat)     nat.style.opacity = '1';
        if (label)   { label.textContent = 'private subnet'; label.setAttribute('fill', 'var(--good)'); }
      }
      const expl = root.querySelector('.dc-route-explain');
      if (expl) {
        expl.textContent = mode === 'igw'
          ? 'route 0.0.0.0/0 → IGW. subnet is reachable from the internet (public).'
          : 'route 0.0.0.0/0 → NAT. outbound only; nothing initiates inbound.';
      }
      root.querySelectorAll('.dc-route-pill').forEach(p => {
        const on = p.dataset.mode === mode;
        p.style.background = on ? 'var(--accent)' : 'var(--paper-3)';
        p.style.color      = on ? 'var(--paper)'  : 'var(--ink-2)';
      });
    }

    root.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:10px">
        <div style="display:inline-flex;border:1px solid var(--rule);border-radius:999px;
                    overflow:hidden;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:13px">
          <button type="button" class="dc-route-pill" data-mode="igw"
            style="border:0;padding:8px 18px;cursor:pointer;letter-spacing:.14em;text-transform:uppercase">→ IGW</button>
          <button type="button" class="dc-route-pill" data-mode="nat"
            style="border:0;padding:8px 18px;cursor:pointer;letter-spacing:.14em;text-transform:uppercase">→ NAT</button>
        </div>
        <p class="dc-route-explain"
           style="font-family:'Fraunces',Georgia,serif;font-style:italic;font-size:18px;
                  color:var(--ink-2);max-width:520px;margin:0">
          What changed? Just the route — same subnet, same IP range.
        </p>
      </div>`;
    root.querySelectorAll('.dc-route-pill').forEach(p => {
      p.addEventListener('click', () => { mode = p.dataset.mode; apply(); });
    });
    root.dataset.dcStepKey = '1';
    root.addEventListener('dc:step', () => { mode = mode === 'igw' ? 'nat' : 'igw'; apply(); });
    root.appendChild(makeReset(() => { mode = options.start || 'igw'; apply(); }));
    queueMicrotask(apply);
  }

  // ════════════════════════════════════════════════════════════════════════
  // asgScaler — three buttons (scale out, scale in, kill one).
  // ════════════════════════════════════════════════════════════════════════
  function createAsgScaler(root, options) {
    const svg = findTarget(root, options.target);
    const min = Number.isFinite(options.min) ? options.min : 2;
    const max = Number.isFinite(options.max) ? options.max : 6;
    const startN = Number.isFinite(options.start) ? options.start : 3;
    let n = startN;
    let killTimer = null;

    function dotPos(i) {
      const cols = 3, w = 100, h = 60;
      const col = i % cols, row = Math.floor(i / cols);
      return { x: 60 + col * w, y: 40 + row * h };
    }

    function render(announce) {
      if (!svg) return;
      const fleet = svg.querySelector('#asg-fleet');
      if (!fleet) return;
      fleet.querySelectorAll('.dc-asg-dot, .dc-asg-replaced').forEach(e => e.remove());
      for (let i = 0; i < n; i++) {
        const { x, y } = dotPos(i);
        const c = el('circle', {
          cx: x, cy: y, r: 14,
          fill: 'color-mix(in srgb, var(--accent) 18%, var(--paper))',
          stroke: 'var(--accent)', 'stroke-width': '2',
          class: 'dc-asg-dot'
        });
        c.style.transition = 'opacity .35s ease, transform .35s ease';
        fleet.appendChild(c);
      }
      const lbl = root.querySelector('.dc-asg-label');
      if (lbl) lbl.textContent = `current ${n} · min ${min} · max ${max}`;
      if (announce) {
        const a = root.querySelector('.dc-asg-announce');
        if (a) {
          a.textContent = announce;
          a.style.opacity = '1';
          setTimeout(() => { if (a) a.style.opacity = '0'; }, 1800);
        }
      }
    }

    function killOne() {
      if (n <= min) { render('cannot kill below min'); return; }
      const fleet = svg && svg.querySelector('#asg-fleet');
      if (!fleet) return;
      const dots = fleet.querySelectorAll('.dc-asg-dot');
      if (!dots.length) return;
      const victim = dots[Math.floor(Math.random() * dots.length)];
      victim.style.opacity = '0';
      victim.style.transform = 'scale(.4)';
      if (killTimer) clearTimeout(killTimer);
      killTimer = setTimeout(() => {
        render('replaced — ASG self-healed');
        const a = el('text', {
          x: 200, y: 24, 'text-anchor': 'middle',
          'font-family': 'JetBrains Mono, monospace', 'font-size': '12',
          fill: 'var(--good)', class: 'dc-asg-replaced'
        });
        a.textContent = '+ replaced';
        a.style.transition = 'opacity .6s ease';
        a.style.opacity = '1';
        fleet.appendChild(a);
        setTimeout(() => { if (a.parentNode) a.style.opacity = '0'; }, 1400);
      }, 900);
    }

    root.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:10px;align-items:flex-start">
        <div class="dc-asg-ctrl" style="display:inline-flex;gap:8px"></div>
        <div style="display:flex;gap:18px;align-items:center;
                    font-family:'JetBrains Mono',ui-monospace,monospace;font-size:13px">
          <span class="dc-asg-label" style="color:var(--ink-2)">current ${n} · min ${min} · max ${max}</span>
          <span class="dc-asg-announce"
                style="color:var(--good);opacity:0;transition:opacity .25s ease;
                       font-style:italic;font-family:'Fraunces',serif"></span>
        </div>
      </div>`;
    const ctrl = root.querySelector('.dc-asg-ctrl');
    const out = controlBtn('scale out (+1)', 'var(--good)');
    const inB = controlBtn('scale in (−1)',  'var(--ink-2)');
    const kill= controlBtn('kill one',       'var(--warn)');
    out.addEventListener('click', () => { if (n < max) { n += 1; render('scaled out'); } });
    inB.addEventListener('click',  () => { if (n > min) { n -= 1; render('scaled in'); } });
    kill.addEventListener('click', killOne);
    ctrl.append(out, inB, kill);

    root.dataset.dcStepKey = '1';
    root.addEventListener('dc:step', () => { if (n < max) { n += 1; render('scaled out'); } });

    root.appendChild(makeReset(() => { n = startN; render('reset'); }));
    queueMicrotask(() => render());
  }

  // ════════════════════════════════════════════════════════════════════════
  // rpoRtoSliders — two log-scale sliders + recommendation text.
  // ════════════════════════════════════════════════════════════════════════
  function createRpoRtoSliders(root, options) {
    const svg = findTarget(root, options.target);

    function sliderToSec(v) {
      const lo = Math.log(1), hi = Math.log(86400);
      return Math.exp(lo + (hi - lo) * (v / 100));
    }
    function fmt(secs) {
      if (secs < 60)    return `${Math.round(secs)} s`;
      if (secs < 3600)  return `${Math.round(secs / 60)} min`;
      if (secs < 86400) return `${(secs / 3600).toFixed(1)} h`;
      return `${(secs / 86400).toFixed(1)} d`;
    }
    function recommendation(rpoSec, rtoSec) {
      const rpoTight = rpoSec <= 60;
      const rtoTight = rtoSec <= 60;
      const rpoLoose = rpoSec > 3600;
      const rtoLoose = rtoSec > 3600;
      if (rpoTight && rtoTight) return ['active-active',
        'Both numbers near zero. You\'re paying for two live Regions.'];
      if (rtoTight && !rpoTight) return ['warm standby',
        'Fast recovery, some data lag tolerated. Smaller live copy in the DR Region.'];
      if (rpoLoose && rtoLoose)  return ['backup and restore',
        'Cheapest. Restore from snapshots in the DR Region after the event.'];
      if (!rtoTight && !rpoLoose) return ['pilot light',
        'Minimal stack always running; scale up on disaster.'];
      return ['warm standby',
        'A reasonable middle ground for most teams.'];
    }

    function update() {
      const rpoSlider = root.querySelector('.dc-rpo');
      const rtoSlider = root.querySelector('.dc-rto');
      const rpoSec = sliderToSec(parseFloat(rpoSlider.value));
      const rtoSec = sliderToSec(parseFloat(rtoSlider.value));
      root.querySelector('.dc-rpo-val').textContent = fmt(rpoSec);
      root.querySelector('.dc-rto-val').textContent = fmt(rtoSec);
      const [strategy, why] = recommendation(rpoSec, rtoSec);
      root.querySelector('.dc-strategy').textContent = strategy;
      root.querySelector('.dc-why').textContent = why;
      if (svg) {
        const rpoBracket = svg.querySelector('#rpo-bracket');
        const rtoBracket = svg.querySelector('#rto-bracket');
        if (rpoBracket) {
          const w = 40 + (parseFloat(rpoSlider.value) / 100) * 380;
          rpoBracket.setAttribute('transform', `scale(${(w / 200).toFixed(3)} 1)`);
        }
        if (rtoBracket) {
          const w = 40 + (parseFloat(rtoSlider.value) / 100) * 380;
          rtoBracket.setAttribute('transform', `translate(640 0) scale(${(w / 200).toFixed(3)} 1)`);
        }
      }
    }

    root.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:14px;
                  font-family:'JetBrains Mono',ui-monospace,monospace;font-size:13px">
        <div style="display:flex;align-items:center;gap:14px">
          <span style="color:var(--muted);min-width:42px;letter-spacing:.16em;text-transform:uppercase">RPO</span>
          <input type="range" class="dc-rpo" min="0" max="100" value="40"
                 style="accent-color:var(--accent);width:380px">
          <span class="dc-rpo-val" style="color:var(--accent);min-width:90px;font-weight:600;font-size:16px">—</span>
        </div>
        <div style="display:flex;align-items:center;gap:14px">
          <span style="color:var(--muted);min-width:42px;letter-spacing:.16em;text-transform:uppercase">RTO</span>
          <input type="range" class="dc-rto" min="0" max="100" value="55"
                 style="accent-color:var(--accent);width:380px">
          <span class="dc-rto-val" style="color:var(--accent);min-width:90px;font-weight:600;font-size:16px">—</span>
        </div>
        <div style="margin-top:8px;padding:12px 16px;background:var(--paper-3);
                    border:1px solid var(--rule);border-radius:8px;max-width:520px">
          <div style="font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.18em;
                      text-transform:uppercase;color:var(--muted);margin-bottom:6px">recommended</div>
          <div class="dc-strategy"
               style="font-family:'Fraunces',Georgia,serif;font-style:italic;font-weight:700;
                      font-size:26px;color:var(--accent);margin-bottom:6px">—</div>
          <div class="dc-why" style="font-family:'Inter',sans-serif;font-size:14px;color:var(--ink-2);line-height:1.45">—</div>
        </div>
      </div>`;
    root.querySelectorAll('input[type=range]').forEach(s => s.addEventListener('input', update));
    root.appendChild(makeReset(() => {
      root.querySelector('.dc-rpo').value = '40';
      root.querySelector('.dc-rto').value = '55';
      update();
    }));
    queueMicrotask(update);
  }

  // ════════════════════════════════════════════════════════════════════════
  // azFailover — operate on multi-az-ha SVG.
  // ════════════════════════════════════════════════════════════════════════
  function createAzFailover(root, options) {
    const svg = findTarget(root, options.target);
    let failed = false;

    function apply() {
      if (!svg) return;
      const azA = svg.querySelector('#az-a');
      const sync = svg.querySelector('#sync-link');
      const albToA = svg.querySelector('#alb-to-a');
      const promoted = svg.querySelector('#promoted-label');
      const syncArrow = svg.querySelector('#sync-arrow');

      [azA, sync, albToA, promoted, syncArrow].forEach(n => {
        if (n) n.style.transition = 'opacity .45s ease, filter .45s ease';
      });

      if (failed) {
        if (azA)       azA.style.filter = 'grayscale(1) opacity(.45)';
        if (albToA)    albToA.style.opacity = '0';
        if (sync)      sync.style.opacity = '.3';
        if (syncArrow) syncArrow.setAttribute('transform', 'rotate(180 640 380)');
        if (promoted)  promoted.style.opacity = '1';
      } else {
        if (azA)       azA.style.filter = 'none';
        if (albToA)    albToA.style.opacity = '1';
        if (sync)      sync.style.opacity = '1';
        if (syncArrow) syncArrow.setAttribute('transform', '');
        if (promoted)  promoted.style.opacity = '0';
      }
      const status = root.querySelector('.dc-az-status');
      if (status) status.textContent = failed
        ? 'AZ-A down · ALB serves AZ-B only · RDS standby promoted'
        : 'all AZs healthy · sync replication active';
    }

    root.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:10px;align-items:flex-start">
        <div class="dc-az-ctrl" style="display:inline-flex;gap:8px"></div>
        <div class="dc-az-status"
             style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:13px;color:var(--ink-2)">
          all AZs healthy · sync replication active
        </div>
      </div>`;
    const ctrl = root.querySelector('.dc-az-ctrl');
    const fb = controlBtn('▼ Fail AZ-A', 'var(--warn)');
    const rb = controlBtn('↺ Restore', 'var(--good)');
    fb.addEventListener('click', () => { failed = true;  apply(); });
    rb.addEventListener('click', () => { failed = false; apply(); });
    ctrl.append(fb, rb);

    root.dataset.dcStepKey = '1';
    root.addEventListener('dc:step', () => { failed = !failed; apply(); });

    root.appendChild(makeReset(() => { failed = false; apply(); }));
    queueMicrotask(apply);
  }

  // ════════════════════════════════════════════════════════════════════════
  // regionFailover — operate on cross-region-dr SVG.
  // ════════════════════════════════════════════════════════════════════════
  function createRegionFailover(root, options) {
    const svg = findTarget(root, options.target);
    let failed = false;

    function apply() {
      if (!svg) return;
      const primary   = svg.querySelector('#primary');
      const secondary = svg.querySelector('#secondary');
      const asyncLink = svg.querySelector('#async-link');
      const dnsToPri  = svg.querySelector('#dns-to-primary');
      const dnsToSec  = svg.querySelector('#dns-to-secondary');
      const rpoLabel  = svg.querySelector('#rpo-failover-label');

      [primary, secondary, asyncLink, dnsToPri, dnsToSec, rpoLabel].forEach(n => {
        if (n) n.style.transition = 'opacity .45s ease, filter .45s ease';
      });

      if (failed) {
        if (primary)   primary.style.filter = 'grayscale(1) opacity(.4)';
        if (asyncLink) asyncLink.style.opacity = '.3';
        if (dnsToPri)  dnsToPri.style.opacity = '0';
        if (dnsToSec)  dnsToSec.style.opacity = '1';
        if (secondary) secondary.style.filter = 'none';
        if (rpoLabel)  rpoLabel.style.opacity = '1';
      } else {
        if (primary)   primary.style.filter = 'none';
        if (asyncLink) asyncLink.style.opacity = '1';
        if (dnsToPri)  dnsToPri.style.opacity = '1';
        if (dnsToSec)  dnsToSec.style.opacity = '0';
        if (secondary) secondary.style.filter = 'grayscale(.4) opacity(.7)';
        if (rpoLabel)  rpoLabel.style.opacity = '0';
      }
      const status = root.querySelector('.dc-region-status');
      if (status) status.textContent = failed
        ? 'us-east-1 down · Route 53 → us-west-2 · RPO ≈ replication lag at failure'
        : 'us-east-1 active · async replication → us-west-2';
    }

    root.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:10px;align-items:flex-start">
        <div class="dc-region-ctrl" style="display:inline-flex;gap:8px"></div>
        <div class="dc-region-status"
             style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:13px;color:var(--ink-2);max-width:680px">
          us-east-1 active · async replication → us-west-2
        </div>
      </div>`;
    const ctrl = root.querySelector('.dc-region-ctrl');
    const fb = controlBtn('▼ Fail us-east-1', 'var(--warn)');
    const rb = controlBtn('↺ Restore', 'var(--good)');
    fb.addEventListener('click', () => { failed = true;  apply(); });
    rb.addEventListener('click', () => { failed = false; apply(); });
    ctrl.append(fb, rb);

    root.dataset.dcStepKey = '1';
    root.addEventListener('dc:step', () => { failed = !failed; apply(); });

    root.appendChild(makeReset(() => { failed = false; apply(); }));
    queueMicrotask(apply);
  }

  // ════════════════════════════════════════════════════════════════════════
  // jsonAnnotator — click pillars in the JSON to highlight margin notes.
  // The slide carries:
  //   <span class="dc-pillar" data-pillar="effect">"Effect"</span>
  //   <div class="dc-annot" data-pillar="effect">…explanation…</div>
  // ════════════════════════════════════════════════════════════════════════
  function createJsonAnnotator(root /* , options */) {
    const sect = root.closest('section');
    if (!sect) return;
    const pillars = sect.querySelectorAll('.dc-pillar');
    const annots  = sect.querySelectorAll('.dc-annot');
    const active  = new Set();

    annots.forEach(a => {
      a.style.transition = 'opacity .3s ease, transform .3s ease';
      a.style.opacity = '.25'; a.style.transform = 'translateX(6px)';
    });
    pillars.forEach(p => {
      p.style.cursor = 'pointer';
      p.style.transition = 'background .2s ease, color .2s ease';
      p.addEventListener('click', () => toggle(p.dataset.pillar));
    });

    function toggle(name) {
      if (active.has(name)) active.delete(name); else active.add(name);
      pillars.forEach(p => {
        const on = active.has(p.dataset.pillar);
        p.style.background = on ? 'color-mix(in srgb, var(--accent) 18%, transparent)' : 'transparent';
        p.style.color = on ? 'var(--accent)' : '';
      });
      annots.forEach(a => {
        const on = active.has(a.dataset.pillar);
        a.style.opacity = on ? '1' : '.25';
        a.style.transform = on ? 'translateX(0)' : 'translateX(6px)';
      });
    }

    root.innerHTML = `
      <div style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11px;
                  letter-spacing:.16em;text-transform:uppercase;color:var(--muted)">
        click a pillar in the JSON →
      </div>`;
    root.appendChild(makeReset(() => {
      active.clear();
      pillars.forEach(p => { p.style.background = ''; p.style.color = ''; });
      annots.forEach(a => { a.style.opacity = '.25'; a.style.transform = 'translateX(6px)'; });
    }));
  }

  // ════════════════════════════════════════════════════════════════════════
  // permissionEvaluator — Allow + Deny → Final = Deny.
  // ════════════════════════════════════════════════════════════════════════
  function createPermissionEvaluator(root, options) {
    const svg = findTarget(root, options.target);
    let stage = 0;

    function apply() {
      const allow = root.querySelector('.dc-eval-allow');
      const deny  = root.querySelector('.dc-eval-deny');
      const final = root.querySelector('.dc-eval-final');
      const sub   = root.querySelector('.dc-eval-sub');
      [allow, deny, final, sub].forEach(n => {
        if (n) n.style.transition = 'opacity .35s ease';
      });
      if (allow) allow.style.opacity = stage >= 1 ? '1' : '.25';
      if (deny)  deny.style.opacity  = stage >= 2 ? '1' : '.25';
      if (final) final.style.opacity = stage >= 3 ? '1' : '0';
      if (sub)   sub.style.opacity   = stage >= 3 ? '1' : '0';

      if (svg) {
        const margin = svg.querySelector('#deny-margin');
        if (margin) {
          margin.style.transition = 'opacity .35s ease';
          margin.style.opacity = stage >= 3 ? '1' : '0';
        }
      }
    }
    function step() { if (stage < 3) { stage += 1; apply(); } }

    root.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:12px;align-items:flex-start">
        <div class="dc-eval-ctrl" style="display:inline-flex;gap:8px"></div>
        <div style="display:flex;flex-direction:column;gap:6px;
                    font-family:'JetBrains Mono',ui-monospace,monospace;font-size:14px">
          <div class="dc-eval-allow" style="opacity:.25">
            <span style="color:var(--good);font-weight:700">✓</span>
            policy A · Allow s3:GetObject on …/reports/*
          </div>
          <div class="dc-eval-deny" style="opacity:.25">
            <span style="color:var(--warn);font-weight:700">✗</span>
            policy B · Deny s3:GetObject on …/reports/*
          </div>
          <div class="dc-eval-final" style="opacity:0;margin-top:6px;
              padding:8px 14px;border:1px solid var(--warn);border-radius:8px;
              background:color-mix(in srgb, var(--warn) 12%, transparent);
              color:var(--warn-deep);font-weight:600">
            final = Deny
          </div>
          <div class="dc-eval-sub" style="opacity:0;font-family:'Fraunces',serif;font-style:italic;
              color:var(--muted);font-size:14px">
            explicit deny wins. always.
          </div>
        </div>
      </div>`;
    const ctrl = root.querySelector('.dc-eval-ctrl');
    const evalBtn = controlBtn('Evaluate request →', 'var(--ink)');
    evalBtn.addEventListener('click', step);
    ctrl.appendChild(evalBtn);

    root.dataset.dcStepKey = '1';
    root.addEventListener('dc:step', step);

    root.appendChild(makeReset(() => {
      stage = 0;
      if (svg) { const m = svg.querySelector('#deny-margin'); if (m) m.style.opacity = '0'; }
      apply();
    }));
    queueMicrotask(apply);
  }

  // ════════════════════════════════════════════════════════════════════════
  // replicationDemo — animate sync vs async sequences in parallel.
  // ════════════════════════════════════════════════════════════════════════
  function createReplicationDemo(root /* , options */) {
    let runs = 0;
    const W = 920, H = 220;

    function svgMarkup() {
      return `
        <svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}"
             role="img" aria-label="Sync vs async replication">
          <g id="sync" transform="translate(20 0)">
            <text x="0" y="20" font-family="JetBrains Mono" font-size="12"
                  fill="var(--muted)" letter-spacing=".16em">SYNC</text>
            <line x1="50"  y1="40" x2="50"  y2="200" stroke="var(--ink)" stroke-width="1.2"/>
            <line x1="200" y1="40" x2="200" y2="200" stroke="var(--ink)" stroke-width="1.2"/>
            <line x1="350" y1="40" x2="350" y2="200" stroke="var(--ink)" stroke-width="1.2"/>
            <text x="50"  y="34" text-anchor="middle" font-family="Inter" font-size="13" fill="var(--ink)">client</text>
            <text x="200" y="34" text-anchor="middle" font-family="Inter" font-size="13" fill="var(--ink)">primary</text>
            <text x="350" y="34" text-anchor="middle" font-family="Inter" font-size="13" fill="var(--ink)">replica</text>
            <line id="sync-w1"   x1="50"  y1="70"  x2="200" y2="70"  stroke="var(--accent)" stroke-width="2" marker-end="url(#dc-arr)" opacity="0"/>
            <line id="sync-w2"   x1="200" y1="100" x2="350" y2="100" stroke="var(--accent)" stroke-width="2" marker-end="url(#dc-arr)" opacity="0"/>
            <line id="sync-ack2" x1="350" y1="130" x2="200" y2="130" stroke="var(--good)"   stroke-width="2" marker-end="url(#dc-arrG)" opacity="0"/>
            <line id="sync-ack1" x1="200" y1="160" x2="50"  y2="160" stroke="var(--good)"   stroke-width="2" marker-end="url(#dc-arrG)" opacity="0"/>
          </g>
          <g id="async" transform="translate(490 0)">
            <text x="0" y="20" font-family="JetBrains Mono" font-size="12"
                  fill="var(--muted)" letter-spacing=".16em">ASYNC</text>
            <line x1="50"  y1="40" x2="50"  y2="200" stroke="var(--ink)" stroke-width="1.2"/>
            <line x1="200" y1="40" x2="200" y2="200" stroke="var(--ink)" stroke-width="1.2"/>
            <line x1="350" y1="40" x2="350" y2="200" stroke="var(--ink)" stroke-width="1.2"/>
            <text x="50"  y="34" text-anchor="middle" font-family="Inter" font-size="13" fill="var(--ink)">client</text>
            <text x="200" y="34" text-anchor="middle" font-family="Inter" font-size="13" fill="var(--ink)">primary</text>
            <text x="350" y="34" text-anchor="middle" font-family="Inter" font-size="13" fill="var(--ink)">replica</text>
            <line id="async-w1"   x1="50"  y1="70"  x2="200" y2="70"  stroke="var(--accent)" stroke-width="2" marker-end="url(#dc-arr)" opacity="0"/>
            <line id="async-ack1" x1="200" y1="95"  x2="50"  y2="95"  stroke="var(--good)"   stroke-width="2" marker-end="url(#dc-arrG)" opacity="0"/>
            <line id="async-w2"   x1="200" y1="140" x2="350" y2="140" stroke="var(--accent)" stroke-width="2" stroke-dasharray="4 4" marker-end="url(#dc-arr)" opacity="0"/>
            <text id="async-lag" x="270" y="158" font-family="Fraunces" font-style="italic"
                  font-size="13" fill="var(--muted)" opacity="0">replica catches up later…</text>
          </g>
          <defs>
            <marker id="dc-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M0,0 L10,5 L0,10 z" fill="var(--accent)"/>
            </marker>
            <marker id="dc-arrG" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M0,0 L10,5 L0,10 z" fill="var(--good)"/>
            </marker>
          </defs>
        </svg>`;
    }

    root.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:10px;align-items:flex-start;width:100%">
        <div class="dc-rep-svg" style="width:100%">${svgMarkup()}</div>
        <div style="display:flex;align-items:center;gap:14px">
          <div class="dc-rep-ctrl"></div>
          <span class="dc-rep-runs"
                style="font-family:'JetBrains Mono',monospace;font-size:13px;color:var(--muted)">runs: 0</span>
        </div>
      </div>`;
    const ctrl = root.querySelector('.dc-rep-ctrl');
    const send = controlBtn('Send write ↦', 'var(--accent)');
    ctrl.appendChild(send);

    function reset() {
      ['sync-w1','sync-w2','sync-ack2','sync-ack1',
       'async-w1','async-ack1','async-w2','async-lag'].forEach(id => {
        const n = root.querySelector('#' + id);
        if (n) { n.style.transition = 'opacity .25s ease'; n.style.opacity = '0'; }
      });
    }
    function show(id, delay) {
      setTimeout(() => {
        const n = root.querySelector('#' + id);
        if (n) n.style.opacity = '1';
      }, delay);
    }
    function play() {
      reset();
      runs += 1;
      root.querySelector('.dc-rep-runs').textContent = `runs: ${runs}`;
      show('sync-w1',    150);
      show('sync-w2',    600);
      show('sync-ack2', 1100);
      show('sync-ack1', 1500);
      show('async-w1',    150);
      show('async-ack1',  450);
      show('async-w2',   1300);
      show('async-lag',  1300);
    }
    send.addEventListener('click', play);

    root.dataset.dcStepKey = '1';
    root.addEventListener('dc:step', play);

    root.appendChild(makeReset(() => { runs = 0;
      root.querySelector('.dc-rep-runs').textContent = 'runs: 0'; reset();
    }));
  }

  // ════════════════════════════════════════════════════════════════════════
  // Registry
  // ════════════════════════════════════════════════════════════════════════
  window.deckWidgets = Object.assign(window.deckWidgets || {}, {
    counter:               createCounter,
    reveal:                createReveal,
    svgStepReveal:         createSvgStepReveal,
    cidrSlider:            createCidrSlider,
    routeToggle:           createRouteToggle,
    asgScaler:             createAsgScaler,
    rpoRtoSliders:         createRpoRtoSliders,
    azFailover:            createAzFailover,
    regionFailover:        createRegionFailover,
    jsonAnnotator:         createJsonAnnotator,
    permissionEvaluator:   createPermissionEvaluator,
    replicationDemo:       createReplicationDemo,
    // ── Reserved for future deck additions ────────────────────────────────
    // cidrCalculator: TODO — interactive subnet math (mask, hosts, ranges)
    // vpcClickable:   TODO — clickable topology with per-resource detail panel
  });

  window.deckWidgetsInit = function (scope) {
    const root = scope || document;
    root.querySelectorAll('[data-widget]').forEach(node => {
      const name = node.getAttribute('data-widget');
      const factory = window.deckWidgets[name];
      if (!factory) { console.warn(`[widgets] unknown widget: ${name}`); return; }
      let options = {};
      const raw = node.getAttribute('data-widget-options');
      if (raw) {
        try { options = JSON.parse(raw); }
        catch (err) { console.warn(`[widgets] bad options on ${name}:`, err); }
      }
      try { factory(node, options); }
      catch (err) { console.error(`[widgets] ${name} failed:`, err); }
    });
  };

  if (!document.getElementById('dc-widgets-style')) {
    const style = document.createElement('style');
    style.id = 'dc-widgets-style';
    style.textContent = `
      @keyframes dc-fade-in { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:none; } }
    `;
    document.head.appendChild(style);
  }

})();
