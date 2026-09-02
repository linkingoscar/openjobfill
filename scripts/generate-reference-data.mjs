// Usage: node scripts/generate-reference-data.mjs <unpacked china-division@2.7.0 directory>
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
const source = process.argv[2];
if (!source) throw new Error('Pass the unpacked china-division@2.7.0 directory');
const read = (name) => JSON.parse(readFileSync(join(source, name), 'utf8'));
if (read('package.json').version !== '2.7.0') throw new Error('Expected version 2.7.0');
const provinces = read('dist/pca-code.json').map((p) => ({
  code: p.code.padEnd(6, '0'), name: p.name,
  cities: p.children.flatMap((c) => {
    if (/直辖县级/.test(c.name)) return c.children.map((a) => ({ code: a.code, name: a.name, districts: [] }));
    return [{ code: c.code.padEnd(6, '0'), name: /^(市辖区|县)$/.test(c.name) ? p.name : c.name,
      districts: (c.children || []).map((a) => ({ code: a.code, name: a.name })) }];
  }),
}));
// HK/MO/TW upstream supplement contains names, not GB codes. Preserve that distinction.
const islands = read('dist/HK-MO-TW.json');
// Name-only form-address supplement; do not invent GB/T codes for these entries.
// https://roaddig.kinmen.gov.tw/KMLocApi/Dss/TownList
// https://travel.matsu.gov.tw/
islands['台湾省']['金门县'] = ['金城镇', '金沙镇', '金湖镇', '金宁乡', '烈屿乡', '乌坵乡'];
islands['台湾省']['连江县'] = ['南竿乡', '北竿乡', '莒光乡', '东引乡'];
for (const [name, code] of [['台湾省', '710000'], ['香港特别行政区', '810000'], ['澳门特别行政区', '820000']]) {
  provinces.push({ code, name, cities: Object.entries(islands[name]).map(([city, districts]) => ({
    code: '', name: city, districts: districts.map((district) => ({ code: '', name: district })),
  })) });
}
const data = { version: 'china-division@2.7.0+island-names-1', asOf: '2023-06-30',
  source: 'https://github.com/modood/Administrative-divisions-of-China/tree/v2.7.0',
  supplements: ['https://roaddig.kinmen.gov.tw/KMLocApi/Dss/TownList', 'https://travel.matsu.gov.tw/'],
  scope: 'Mainland province/prefecture/county statistical divisions (including development zones), plus upstream HK/MO/TW names. Empty codes mean upstream supplied no code. Versioned snapshot, not a live legal register.', provinces };
if (provinces.length !== 34 || provinces.some((p) => !p.cities.length)) throw new Error('Incomplete source');
mkdirSync('src/core/data', { recursive: true });
writeFileSync('src/core/data/administrative-divisions.json', JSON.stringify(data) + '\n');
console.log({ provinces: provinces.length, cities: provinces.reduce((n, p) => n + p.cities.length, 0), districts: provinces.reduce((n, p) => n + p.cities.reduce((m, c) => m + c.districts.length, 0), 0) });
