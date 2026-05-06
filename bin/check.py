#!/usr/bin/env python3
"""check.py — validate the modular deck. Run:  python3 <deck>/bin/check.py

Checks (FAIL = exits non-zero):
  1. Every manifest path resolves to a real file.
  2. Every content/*.html is referenced exactly once by the manifest.
  3. Each fragment contains exactly one <section> block.
  4. Folios are unique across the manifest.
  5. Folio chip in HTML matches the manifest folio (after &middot; → ·).
  6. No inline <script> tags in fragments — they don't execute (the
     shell injects via insertAdjacentHTML). Use data-widget instead.

Warnings (printed, never fail):
  7. Hex colour literals in fragment bodies — slides should reference
     var(--token) so re-themes stay 10-line edits.
  8. Left-over placeholder strings ("YOUR TALK", "Your Name", …) that
     suggest a scaffolded deck wasn't fully filled in yet.
"""
import json, pathlib, re, sys

DECK = pathlib.Path(__file__).resolve().parent.parent
problems, warnings = [], []
manifest = json.loads((DECK / 'manifest.json').read_text())['slides']

# 1. manifest entries point at real files
for slide in manifest:
    if not (DECK / slide['path']).exists():
        problems.append(f"manifest: missing file {slide['path']}")

# 2. no orphans in content/
referenced = {s['path'] for s in manifest}
for f in (DECK / 'content').rglob('*.html'):
    rel = str(f.relative_to(DECK))
    if rel not in referenced:
        problems.append(f"orphan: {rel} not in manifest")

# 3. exactly one <section> per fragment
for slide in manifest:
    p = DECK / slide['path']
    if not p.exists(): continue
    txt = re.sub(r'<!--.*?-->', '', p.read_text(), flags=re.S)
    o, c = len(re.findall(r'<section\b', txt)), txt.count('</section>')
    if (o, c) != (1, 1):
        problems.append(f"{slide['path']}: expected 1/1 section, got {o}/{c}")

# 4. folios are unique
seen = {}
for slide in manifest:
    f = slide['folio']
    if f in seen:
        problems.append(f"duplicate folio {f}: {seen[f]} and {slide['path']}")
    seen[f] = slide['path']

# Helper — folios may be written with either "·" or "&middot;" in HTML
# and either form in the manifest. Normalise both sides before comparing.
def _norm_folio(s: str) -> str:
    return s.replace('&middot;', '·').strip()

# 5. chip in HTML matches manifest folio
for slide in manifest:
    p = DECK / slide['path']
    if not p.exists(): continue
    m = re.search(r'<span class="folio">([^<]+)</span>', p.read_text())
    if not m: continue
    chip = _norm_folio(m.group(1))
    expected = _norm_folio(slide['folio'])
    if chip != expected:
        problems.append(f"{slide['path']}: chip {chip!r} != manifest folio {slide['folio']!r}")

# 6. no inline <script> tags in fragments (they silently don't execute).
SCRIPT_RE = re.compile(r'<script\b', re.I)
for slide in manifest:
    p = DECK / slide['path']
    if not p.exists(): continue
    txt = re.sub(r'<!--.*?-->', '', p.read_text(), flags=re.S)
    if SCRIPT_RE.search(txt):
        problems.append(f"{slide['path']}: inline <script> won't run in fragments — register a factory in assets/widgets.js and use data-widget instead")

# 7. (warn) hex colour literals in fragments. Steer toward var(--token).
HEX_RE = re.compile(r'#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?\b')
for slide in manifest:
    p = DECK / slide['path']
    if not p.exists(): continue
    body = re.sub(r'<!--.*?-->', '', p.read_text(), flags=re.S)
    hits = sorted(set(HEX_RE.findall(body)))
    if hits:
        warnings.append(f"{slide['path']}: hex colour(s) {hits} — prefer var(--token) so re-themes stay one edit")

# 8. (warn) leftover scaffold placeholders
PLACEHOLDERS = ('YOUR TALK', 'Your Talk Title', 'Your Name', 'Venue, 2026')
for slide in manifest:
    p = DECK / slide['path']
    if not p.exists(): continue
    txt = p.read_text()
    leftovers = [s for s in PLACEHOLDERS if s in txt]
    if leftovers:
        warnings.append(f"{slide['path']}: placeholder text still present: {leftovers}")

for w in warnings:
    print('WARN: ' + w)

if problems:
    print('\n'.join('FAIL: ' + p for p in problems))
    sys.exit(1)

suffix = f' ({len(warnings)} warning{"s" if len(warnings) != 1 else ""})' if warnings else ''
print(f'OK: {len(manifest)} slides, all checks passed' + suffix)
