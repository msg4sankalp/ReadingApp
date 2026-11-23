import { bookFeatures, subjectFeatures } from '../features';

describe('subjectFeatures', () => {
  it('splits compound subjects and drops filler', () => {
    expect(subjectFeatures(['Fiction, science fiction, general'])).toEqual(['science fiction']);
    expect(subjectFeatures(['Fiction, thrillers, suspense'])).toEqual(['thrillers', 'suspense']);
  });

  it('drops shelving noise, years and non-English duplicates', () => {
    expect(
      subjectFeatures([
        'nyt:hardcover-fiction=2021-05-23',
        'New York Times bestseller',
        'Accessible book',
        'Protected DAISY',
        '2021',
        'Fantasía',
        'Romans, nouvelles',
        'open_syllabus_project',
      ]),
    ).toEqual([]);
  });

  it('removes parenthetical notes and standardizes spellings', () => {
    expect(subjectFeatures(['Dune (Imaginary place)', 'Horror fiction', 'Science-fiction', 'Sci-Fi', 'Coming-of-age'])).toEqual([
      'dune',
      'horror fiction',
      'science fiction',
      'coming of age',
    ]);
  });

  it('keeps real subjects from a real record (Project Hail Mary)', () => {
    const features = subjectFeatures([
      'hard science-fiction',
      'science-fiction',
      'sci-fi',
      'hard sci-fi',
      'nyt:hardcover-fiction=2021-05-23',
      'New York Times reviewed',
      'Space flight',
      'Astronauts',
      'Fiction, science fiction, action & adventure',
    ]);
    expect(features).toEqual(
      expect.arrayContaining(['hard science fiction', 'space flight', 'astronauts', 'science fiction', 'action & adventure']),
    );
    expect(features.some((f) => f.startsWith('nyt'))).toBe(false);
  });
});

describe('bookFeatures', () => {
  it('adds up to two authors as features', () => {
    expect(bookFeatures({ subjects: ['Ghosts'], authors: ['Shirley Jackson', 'A. N. Other', 'Third'] })).toEqual([
      'ghosts',
      'author:shirley jackson',
      'author:a. n. other',
    ]);
  });
});
