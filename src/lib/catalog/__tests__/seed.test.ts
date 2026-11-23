import { readFileSync } from 'fs';
import { join } from 'path';

import { CATEGORIES } from '../categories';

/** Guards against the app's category list and the database seed drifting apart. */
describe('supabase/seed.sql', () => {
  const seed = readFileSync(join(__dirname, '../../../../supabase/seed.sql'), 'utf8');
  const [categorySection, chipSection] = seed.split('insert into public.category_chips');

  it('contains every category in order, and nothing else', () => {
    const rows = [...categorySection.matchAll(/^\s+\('([^']+)', '((?:[^']|'')+)', '(fiction|nonfiction|other)', (\d+)\)/gm)];
    expect(rows.map((r) => [r[1], r[2].replace(/''/g, "'"), r[3], Number(r[4])])).toEqual(
      CATEGORIES.map((c, i) => [c.slug, c.name, c.group, i]),
    );
  });

  it('contains every chip, and nothing else', () => {
    const rows = [...chipSection.matchAll(/^\s+\('([^']+)', '([^']+)', '((?:[^']|'')+)', (\d+)\)/gm)];
    expect(rows.map((r) => `${r[1]}/${r[2]}/${r[3].replace(/''/g, "'")}/${r[4]}`)).toEqual(
      CATEGORIES.flatMap((c) => c.chips.map((ch, i) => `${c.slug}/${ch.slug}/${ch.label}/${i}`)),
    );
  });
});
