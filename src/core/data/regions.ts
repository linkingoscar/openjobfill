import catalog from './administrative-divisions.json';
export const ADMINISTRATIVE_CATALOG = catalog;
export const ADMINISTRATIVE_PROVINCES = catalog.provinces;
export function normalizeRegionName(name: string): string {
  return name.trim().replace(/(特别行政区|壮族自治区|回族自治区|维吾尔自治区|自治区|自治州|地区|省|市|盟|区|县)$/, '');
}
interface RegionPath { names: string[]; codes: string[] }
const paths: RegionPath[] = [];
for (const p of catalog.provinces) {
  paths.push({ names: [p.name], codes: [p.code] });
  for (const c of p.cities) {
    paths.push({ names: [p.name, c.name], codes: [p.code, c.code] });
    for (const d of c.districts) paths.push({ names: [p.name, c.name, d.name], codes: [p.code, c.code, d.code] });
  }
}

/** Exact/code lookup first; ambiguous district names require province/city context. */
export function findRegionPath(raw: string, province?: string): string[] | null {
  const text = raw.trim().replace(/[\s/>—,，-]/g, '');
  if (!text) return null;
  const candidates = paths.filter((entry) => !province || normalizeRegionName(entry.names[0]) === normalizeRegionName(province));
  const exact = candidates.filter((entry) => {
    const name = entry.names.at(-1)!;
    return name === text || normalizeRegionName(name) === text || (!!entry.codes.at(-1) && entry.codes.at(-1) === text);
  });
  if (exact.length) {
    const shortest = Math.min(...exact.map((entry) => entry.names.length));
    const unique = new Map(exact.filter((entry) => entry.names.length === shortest).map((entry) => [entry.names.join('/'), entry.names]));
    return unique.size === 1 ? [...unique.values()][0] : null;
  }
  const matches = candidates.filter((entry) => {
    const finalName = normalizeRegionName(entry.names.at(-1)!);
    return finalName.length >= 2 && text.includes(finalName);
  }).map((entry) => ({ entry, score: entry.names.reduce((total, name, index) => total + (text.includes(normalizeRegionName(name)) ? normalizeRegionName(name).length + index : 0), 0) }));
  matches.sort((a, b) => b.score - a.score || b.entry.names.length - a.entry.names.length);
  if (!matches.length) return null;
  const best = matches[0];
  const ties = matches.filter((candidate) => candidate.score === best.score && candidate.entry.names.length === best.entry.names.length);
  const unique = new Set(ties.map((candidate) => candidate.entry.names.join('/')));
  return unique.size === 1 ? best.entry.names : null;
}
