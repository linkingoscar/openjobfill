"""Rebuild the local 2026 MOE major catalog from its official PDF (pdfplumber required).
Usage: python scripts/extract-major-catalog.py [local-pdf]
"""
import json
import re
import sys
from pathlib import Path
import urllib.request
import pdfplumber

SOURCE = 'https://www.moe.gov.cn/srcsite/A08/moe_1034/s3882/202604/W020260427440749576927.pdf'
MIRROR = 'https://upload-file-sjtu.edu-sjtu.cn/PDF/20260428/18585282273714.pdf'
path = Path(sys.argv[1] if len(sys.argv) > 1 else 'tmp/pdfs/undergraduate-majors-2026.pdf')
if not path.exists() or path.stat().st_size < 1000:
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        urllib.request.urlretrieve(SOURCE, path)
    except OSError:
        urllib.request.urlretrieve(MIRROR, path)
with pdfplumber.open(path) as pdf:
    entries = []
    categories = {}
    classes = {}
    category = subcategory = ''
    for page in pdf.pages[2:]:
        for line in page.extract_text().splitlines():
            heading = re.match(r'^(\d{2})\s+学科门类[：:]\s*(.+)$', line)
            group = re.match(r'^(\d{4})\s+(.+)$', line)
            major = re.match(r'^(\d{6,7}[TK]*)\s+(.+)$', line)
            if heading:
                category = heading[2].strip()
                categories[heading[1]] = category
                subcategory = ''
            elif group:
                subcategory = group[2].strip()
                classes[group[1]] = subcategory
            elif major:
                name = re.split(r'[（(]', major[2])[0].strip().replace(' ', '')
                entries.append({'code': major[1], 'name': name, 'category': category, 'subCategory': subcategory})
            elif re.match(r'^\d', line):
                print('Unparsed:', line)
    print({'categories': len(categories), 'classes': len(classes), 'majors': len(entries)})
    assert len(categories) == 13 and len(classes) == 92 and len(entries) == 883, 'Unexpected source coverage'
    assert len({entry['code'] for entry in entries}) == 883
    assert all(entry['category'] and entry['name'] for entry in entries)
    output = Path('src/core/data/undergraduate-majors-2026.json')
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps({'version': 'MOE-2026', 'source': SOURCE, 'downloadMirror': MIRROR,
                                  'categories': categories, 'classes': classes, 'majors': entries},
                                 ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
