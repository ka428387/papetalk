#!/usr/bin/env python3
"""こえだけ 公開前チェック。

  python3 tools/check.py                 … 構文と art.js の約束を確かめる
  python3 tools/check.py --codex <ブランチ> … 上に加えて、origin/main からの変更が Codex の担当（js/art.js と assets/）だけか確かめる

すべて ✓ なら終了コード 0。
"""
import re, subprocess, sys, os, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ok = True
def res(good, label, detail=''):
    global ok
    print(('✓ ' if good else '✗ ') + label + (('：' + detail) if detail and not good else ''))
    if not good: ok = False

def node_check(path):
    r = subprocess.run(['node', '--check', path], capture_output=True, text=True)
    return r.returncode == 0, (r.stderr.strip().splitlines() or [''])[0]

# 1. 構文
html = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
scripts = re.findall(r'<script>(.*?)</script>', html, re.S)
with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False, encoding='utf-8') as f:
    f.write('\n'.join(scripts)); tmp = f.name
g, d = node_check(tmp); os.unlink(tmp)
res(g, 'index.html の中のスクリプトの構文', d)
art_path = os.path.join(ROOT, 'js', 'art.js')
g, d = node_check(art_path)
res(g, 'js/art.js の構文', d)
res('<script src="js/art.js"></script>' in html, 'index.html が js/art.js を読み込んでいる')

# 2. art.js の約束（システム側の物に触らない）
art = open(art_path, encoding='utf-8').read()
code = re.sub(r'/\*.*?\*/', '', art, flags=re.S)
code = re.sub(r'(^|[^:])//.*', r'\1', code)
banned = {
    r'localStorage|sessionStorage|indexedDB|document\.cookie': '保存データ',
    r'AudioContext|webkitAudioContext|\bAudio\s*\(|MediaRecorder|captureStream': '音・録画',
    r'\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|navigator\.': '通信・端末の機能',
    r'getElementById|querySelector|(?:window|document)\.(?:addEventListener|on[a-z]+\s*=)|innerHTML|document\.body|document\.head|appendChild': '画面の部品（DOM）',
    r'\bstate\b|\bvideo\b|\bCHARAS\b|\bexportVideo\b|\bmsg\s*\(': 'システムの値',
    r'\blocation\b|\bhistory\.': 'ページの移動',
    r'\beval\s*\(|new\s+Function': 'eval',
    r'https?://': '外部のファイル（assets/ に置く）',
}
for pat, what in banned.items():
    m = re.search(pat, code)
    res(not m, f'art.js が{what}に触れていない', m.group(0) if m else '')
ids = re.findall(r"\bid\s*:\s*['\"]([^'\"]+)['\"]", code)
bad = [i for i in ids if not i.startswith('cx-')]
res(not bad, "キャラの id が 'cx-' で始まる", ', '.join(bad))

# 3. 画像の参照先がある
for ref in re.findall(r"['\"]((?:\.\./)?assets/[^'\"]+)['\"]", code):
    p = os.path.join(ROOT, ref.replace('../', ''))
    res(os.path.exists(p), f'画像がある：{ref}', 'ファイルがない')

# 4. Codex のブランチ：担当ファイル以外を変えていない
if '--codex' in sys.argv:
    br = sys.argv[sys.argv.index('--codex') + 1]
    r = subprocess.run(['git', '-C', ROOT, 'diff', '--name-only', f'origin/main...{br}'], capture_output=True, text=True)
    files = [f for f in r.stdout.split() if f]
    other = [f for f in files if not (f == 'js/art.js' or f.startswith('assets/'))]
    res(r.returncode == 0, f'{br} の変更一覧を読めた', r.stderr.strip())
    res(not other, 'Codex の変更が js/art.js と assets/ だけ', ', '.join(other))

print('\nすべて OK' if ok else '\n直すところがあります')
sys.exit(0 if ok else 1)
