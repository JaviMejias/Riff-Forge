import { describe, expect, it } from 'vitest';
import { convertPdfTextToChordPro, type PdfTextPage } from './pdfChordImportService';

const item = (text: string, x: number, y: number, height = 10.5) => ({
  text,
  x,
  y,
  width: text.length * 6.3,
  height
});

describe('convertPdfTextToChordPro', () => {
  it('converts positioned Cifra Club text and skips a chord-summary page', () => {
    const pages: PdfTextPage[] = [
      {
        pageNumber: 1,
        items: [
          item('500 Miles', 28, 739, 15),
          item('Peter, Paul & Mary', 28, 715, 15),
          item('Composición de: Hedy West', 28, 691, 9),
          item('Tono:', 28, 652), item('D', 58, 652),
          item('Afinación:', 28, 631), item('E A D G B E', 80, 631),
          item('[Intro]', 28, 598), item('D', 79, 598), item('Bm', 98, 598),
          item('D', 72, 535), item('Bm', 192, 535),
          item('If', 28, 519), item('you', 47, 519), item('miss', 72, 519), item('the train', 104, 519)
        ]
      },
      { pageNumber: 2, items: [] },
      { pageNumber: 3, items: [item('A', 58, 743), item('Bm', 131, 743), item('D', 210, 743)] }
    ];

    const result = convertPdfTextToChordPro(pages);

    expect(result.metadata).toEqual({
      title: '500 Miles',
      artist: 'Peter, Paul & Mary',
      composer: 'Hedy West',
      key: 'D',
      tuning: 'Estándar'
    });
    expect(result.content).toContain('{tuning: Estándar}');
    expect(result.content).toContain('{start_of_intro: Intro}');
    expect(result.content).toContain('[D] [Bm]');
    expect(result.content).toContain('[D] [Bm]\n{end_of_intro}\n\nIf you');
    expect(result.content).toContain('If you [D]miss the train[Bm]');
    expect(result.importedPages).toBe(1);
    expect(result.skippedPages).toBe(2);
  });

  it('preserves guitar tablature as a ChordPro tab block', () => {
    const pages: PdfTextPage[] = [{
      pageNumber: 1,
      items: [
        item('Solo Song', 28, 739, 15),
        item('Test Artist', 28, 715, 15),
        item('Tono:', 28, 652), item('Em', 58, 652),
        item('[Solo - Parte 1 de 2]', 28, 600),
        item('E|---0---3---|', 28, 570),
        item('B|---0---0---|', 28, 554),
        item('Em', 28, 520),
        item('Final lyric', 28, 504)
      ]
    }];

    const result = convertPdfTextToChordPro(pages);

    expect(result.content).toContain('{start_of_tab: Solo - Parte 1 de 2}');
    expect(result.content).toContain('E|---0---3---|\nB|---0---0---|');
    expect(result.content).toContain('{end_of_tab}');
    expect(result.content).toContain('[Em]Final lyric');
  });
});
