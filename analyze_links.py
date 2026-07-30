from pathlib import Path
import re

root = Path(r'c:\Users\eminence\Documents\programmation\afima')
html_files = sorted(root.glob('*.html')) + sorted((root / 'html').glob('*.html'))
issues = []
for file in html_files:
    text = file.read_text(encoding='utf-8')
    rel = 'root' if file.parent == root else 'html'
    for m in re.finditer(r'href="([^"]+\.html)"', text):
        href = m.group(1)
        if rel == 'root' and href.startswith('html/'):
            pass
        elif rel == 'root' and href.startswith('../'):
            issues.append((file.name, href, 'root cannot use ../ for html links'))
        elif rel == 'root' and not href.startswith('html/') and href != 'index.html':
            issues.append((file.name, href, 'root should use html/ for page links'))
        elif rel == 'html' and href.startswith('html/'):
            issues.append((file.name, href, 'html page should use relative links inside html folder'))
        elif rel == 'html' and href == 'index.html':
            issues.append((file.name, href, 'html page should use ../index.html to go home'))
        elif rel == 'html' and href.startswith('../') and href.endswith('.html') and href != '../index.html':
            issues.append((file.name, href, 'html page should only use ../index.html to go home'))
    for m in re.finditer(r'src="([^"]+\.js)"', text):
        src = m.group(1)
        if rel == 'root' and src.startswith('../'):
            issues.append((file.name, src, 'root page should not use ../ for js sources'))
        if rel == 'html' and not src.startswith('../'):
            issues.append((file.name, src, 'html page js src should use ../js/'))
    for m in re.finditer(r'href="([^"]+\.(?:css|png|jpg|jpeg|svg))"', text):
        href = m.group(1)
        if rel == 'root' and href.startswith('../'):
            issues.append((file.name, href, 'root page asset href should not use ../'))
        if rel == 'html' and not href.startswith('../'):
            issues.append((file.name, href, 'html page asset href should use ../'))
print('ISSUES:')
for i in issues:
    print(i)
print('done', len(issues), 'issues')
