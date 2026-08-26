from pathlib import Path
import re

root = Path(r'c:\Users\eminence\Documents\programmation\afima')
html_files = sorted(root.glob('*.html')) + sorted((root / 'front-end').glob('*.html'))
issues = []
for file in html_files:
    text = file.read_text(encoding='utf-8')
    rel = 'root' if file.parent == root else 'front-end'
    for m in re.finditer(r'href="([^"]+\.html)"', text):
        href = m.group(1)
        if rel == 'root' and href.startswith('front-end/'):
            pass
        elif rel == 'root' and href.startswith('../'):
            issues.append((file.name, href, 'root cannot use ../ for html links'))
        elif rel == 'root' and not href.startswith('front-end/') and href != 'index.html':
            issues.append((file.name, href, 'root should use front-end/ for page links'))
        elif rel == 'front-end' and href.startswith('front-end/'):
            issues.append((file.name, href, 'front-end page should use relative links inside front-end/'))
        elif rel == 'front-end' and href == 'index.html':
            issues.append((file.name, href, 'front-end page should use ../index.html to go home'))
        elif rel == 'front-end' and href.startswith('../') and href.endswith('.html') and href != '../index.html':
            issues.append((file.name, href, 'front-end page should only use ../index.html to go home'))
    for m in re.finditer(r'src="([^"]+\.js)"', text):
        src = m.group(1)
        if rel == 'root' and src.startswith('../'):
            issues.append((file.name, src, 'root page should not use ../ for js sources'))
        if rel == 'front-end' and not (src.startswith('../') or src.startswith('http://') or src.startswith('https://')):
            issues.append((file.name, src, 'front-end page js src should use ../js/'))
    for m in re.finditer(r'href="([^"]+\.(?:css|png|jpg|jpeg|svg))"', text):
        href = m.group(1)
        if rel == 'root' and href.startswith('../'):
            issues.append((file.name, href, 'root page asset href should not use ../'))
        if rel == 'front-end' and not href.startswith('../'):
            issues.append((file.name, href, 'front-end page asset href should use ../'))
print('ISSUES:')
for i in issues:
    print(i)
print('done', len(issues), 'issues')
