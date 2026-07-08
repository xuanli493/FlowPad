"""
FlowPad 前端构建脚本 (Python)
将 frontend/ 下的多文件 SPA 合并为单个 HTML -> data/www/index.html
用法: python scripts/build.py
"""

import re
import os

BASE = os.path.join(os.path.dirname(__file__), '..', 'frontend')
OUT  = os.path.join(os.path.dirname(__file__), '..', 'data', 'www', 'index.html')

def read_file(rel_path):
    with open(os.path.join(BASE, rel_path), 'r', encoding='utf-8') as f:
        return f.read()

def compress_css(css):
    css = re.sub(r'/\*[\s\S]*?\*/', '', css)         # remove comments
    css = re.sub(r'\s+', ' ', css)                     # collapse whitespace
    css = re.sub(r'\s*([{}:;,>+~])\s*', r'\1', css)   # trim around selectors
    css = re.sub(r';}', '}', css)                      # remove last semicolon
    return css.strip()

def compress_js(js):
    js = re.sub(r'/\*[\s\S]*?\*/', '', js)              # block comments
    js = re.sub(r'//.*$', '', js, flags=re.MULTILINE)   # line comments
    js = re.sub(r'^\s+', '', js, flags=re.MULTILINE)    # leading whitespace
    js = re.sub(r'\n\s*\n', '\n', js)                   # blank lines
    return js.strip()

# Read main HTML
html = read_file('index.html')

# Inline CSS
def inline_css(match):
    href = match.group(1)
    try:
        css = read_file(href)
        return f'<style>\n{compress_css(css)}\n</style>'
    except FileNotFoundError:
        print(f'[WARN] CSS not found: {href}')
        return match.group(0)

html = re.sub(r'<link\s+rel="stylesheet"\s+href="([^"]+)"\s*/?>', inline_css, html)

# Inline JS
def inline_js(match):
    href = match.group(1)
    try:
        js = read_file(href)
        return f'<script>\n{compress_js(js)}\n</script>'
    except FileNotFoundError:
        print(f'[WARN] JS not found: {href}')
        return match.group(0)

html = re.sub(r'<script\s+src="([^"]+)"\s*></script>', inline_js, html)

# Remove HTML comments
html = re.sub(r'<!--[\s\S]*?-->', '', html)

# Remove blank lines
html = re.sub(r'\n\s*\n', '\n', html)

# Write output
os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, 'w', encoding='utf-8') as f:
    f.write(html)

# Report
src_size = sum(
    os.path.getsize(os.path.join(root, f))
    for root, _, files in os.walk(BASE)
    for f in files
)
out_size = len(html.encode('utf-8'))

def fmt(n):
    if n < 1024: return f'{n} B'
    if n < 1048576: return f'{n/1024:.1f} KB'
    return f'{n/1048576:.1f} MB'

print('=' * 40)
print('  FlowPad Frontend Build')
print('=' * 40)
print(f'  Source:  frontend/  ({fmt(src_size)})')
print(f'  Output:  data/www/index.html  ({fmt(out_size)})')
print(f'  Ratio:   {out_size/src_size*100:.1f}%')
print('=' * 40)
