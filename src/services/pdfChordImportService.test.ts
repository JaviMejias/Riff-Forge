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
      tuning: 'E A D G B E'
    });
    expect(result.content).toContain('{start_of_intro: Intro}');
    expect(result.content).toContain('[D] [Bm]');
    expect(result.content).toContain('[D] [Bm]\n{end_of_intro}\n\nIf you');
    expect(result.content).toContain('If you [D]miss the train[Bm]');
    expect(result.importedPages).toBe(1);
    expect(result.skippedPages).toBe(2);
  });
});
