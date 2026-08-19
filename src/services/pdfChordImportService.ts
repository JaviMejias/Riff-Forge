const CHORD_PATTERN = /^[A-G](?:#|b)?(?:m|maj|min|dim|aug|sus|add|M|\d|[#()+/,-])*$/;
const SECTION_PATTERN = /^\[(.+)]$/;
const Y_TOLERANCE = 2;
const CHORD_TO_LYRIC_DISTANCE = 20;

export interface PdfTextItem {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PdfTextPage {
  pageNumber: number;
  items: PdfTextItem[];
}

export interface PdfChordMetadata {
  title?: string;
  artist?: string;
  composer?: string;
  key?: string;
  tuning?: string;
}

export interface PdfChordImportResult {
  content: string;
  metadata: PdfChordMetadata;
  importedPages: number;
  skippedPages: number;
}

interface TextRow {
  y: number;
  items: PdfTextItem[];
}

const safeDirectiveValue = (value: string) => value.replace(/[{}\r\n]+/g, ' ').trim();

const normalizeText = (value: string) => value.replace(/\s+/g, ' ').trim();

const groupRows = (items: PdfTextItem[]) => {
  const rows: TextRow[] = [];
  const sortedItems = [...items]
    .filter((item) => item.text.trim())
    .sort((left, right) => right.y - left.y || left.x - right.x);

  sortedItems.forEach((item) => {
    const row = rows.find((candidate) => Math.abs(candidate.y - item.y) <= Y_TOLERANCE);
    if (row) {
      row.items.push(item);
      row.items.sort((left, right) => left.x - right.x);
    } else {
      rows.push({ y: item.y, items: [item] });
    }
  });

  return rows.sort((left, right) => right.y - left.y);
};

const rowText = (row: TextRow) => normalizeText(row.items.map((item) => item.text).join(' '));

const isChord = (value: string) => CHORD_PATTERN.test(value.trim());

const isSectionItem = (value: string) => SECTION_PATTERN.test(value.trim());

const isChordRow = (row: TextRow) => {
  const musicalItems = row.items.filter((item) => !isSectionItem(item.text));
  return musicalItems.length > 0 && musicalItems.every((item) => isChord(item.text));
};

const hasSection = (row: TextRow) => row.items.some((item) => isSectionItem(item.text));

const sectionName = (value: string) => {
  const label = value.match(SECTION_PATTERN)?.[1].trim() || 'Parte';
  const normalized = label.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const knownSections: Record<string, string> = {
    intro: 'intro',
    estrofa: 'verse',
    verso: 'verse',
    'pre-coro': 'pre_chorus',
    precoro: 'pre_chorus',
    coro: 'chorus',
    estribillo: 'chorus',
    puente: 'bridge',
    solo: 'solo',
    outro: 'outro',
    final: 'outro'
  };
  return { label, name: knownSections[normalized] || 'part' };
};

const averageCharacterWidth = (rows: TextRow[]) => {
  const samples = rows.flatMap((row) => row.items)
    .filter((item) => item.text.length > 0 && item.width > 0)
    .map((item) => item.width / item.text.length)
    .filter((width) => Number.isFinite(width) && width > 1);
  if (samples.length === 0) return 6;
  samples.sort((left, right) => left - right);
  return samples[Math.floor(samples.length / 2)];
};

const composeLyric = (row: TextRow, leftEdge: number, characterWidth: number) => {
  let result = '';
  row.items.forEach((item) => {
    const targetColumn = Math.max(0, Math.round((item.x - leftEdge) / characterWidth));
    if (result.length < targetColumn) result += ' '.repeat(targetColumn - result.length);
    if (result && result.length >= targetColumn && !result.endsWith(' ')) result += ' ';
    result += item.text;
  });
  return result.trimEnd();
};

const mergeChordsWithLyrics = (chordRow: TextRow, lyricRow: TextRow, leftEdge: number, characterWidth: number) => {
  let lyric = composeLyric(lyricRow, leftEdge, characterWidth);
  const chords = chordRow.items.filter((item) => isChord(item.text)).sort((left, right) => right.x - left.x);
  chords.forEach((item) => {
    const position = Math.min(lyric.length, Math.max(0, Math.round((item.x - leftEdge) / characterWidth)));
    lyric = `${lyric.slice(0, position)}[${item.text.trim()}]${lyric.slice(position)}`;
  });
  return lyric.trimEnd();
};

const chordOnlyLine = (row: TextRow) => row.items
  .filter((item) => isChord(item.text))
  .map((item) => `[${item.text.trim()}]`)
  .join(' ');

const metadataFromRows = (rows: TextRow[]) => {
  const metadata: PdfChordMetadata = {};
  const titleCandidate = rows.find((row) => row.items.some((item) => item.height >= 13));
  if (titleCandidate) {
    metadata.title = rowText(titleCandidate);
    const artistCandidate = rows.find((row) => row.y < titleCandidate.y && row.items.some((item) => item.height >= 13));
    if (artistCandidate) metadata.artist = rowText(artistCandidate);
  }

  rows.forEach((row) => {
    const text = rowText(row);
    const composerMatch = text.match(/^Composici[oó]n de:\s*(.+)$/i);
    if (composerMatch) metadata.composer = composerMatch[1].trim();
    if (/^Tono:/i.test(text)) metadata.key = normalizeText(text.replace(/^Tono:/i, ''));
    if (/^Afinaci[oó]n:/i.test(text)) metadata.tuning = normalizeText(text.replace(/^Afinaci[oó]n:/i, ''));
  });
  return metadata;
};

const isMetadataRow = (row: TextRow, metadata: PdfChordMetadata) => {
  const text = rowText(row);
  return text === metadata.title || text === metadata.artist || /^Composici[oó]n de:|^Tono:|^Afinaci[oó]n:/i.test(text);
};

export const convertPdfTextToChordPro = (pages: PdfTextPage[]): PdfChordImportResult => {
  const pageRows = pages.map((page) => ({ pageNumber: page.pageNumber, rows: groupRows(page.items) }));
  const metadata = metadataFromRows(pageRows.flatMap((page) => page.rows));
  const contentPages = pageRows.filter(({ rows }) => rows.some((row) => (
    hasSection(row) || !isChordRow(row) && !isMetadataRow(row, metadata)
  )));
  const lines: string[] = [];
  let openSection: string | null = null;

  contentPages.forEach(({ rows }) => {
    const musicalRows = rows.filter((row) => !isMetadataRow(row, metadata));
    const characterWidth = averageCharacterWidth(musicalRows);
    const leftEdge = Math.min(...musicalRows.flatMap((row) => row.items.map((item) => item.x)));

    for (let index = 0; index < musicalRows.length; index += 1) {
      const row = musicalRows[index];
      const sectionItem = row.items.find((item) => isSectionItem(item.text));
      if (sectionItem) {
        if (openSection) lines.push(`{end_of_${openSection}}`, '');
        const section = sectionName(sectionItem.text);
        openSection = section.name;
        lines.push(`{start_of_${section.name}: ${section.label}}`);
        const chords = chordOnlyLine(row);
        if (chords) lines.push(chords);
        continue;
      }

      if (isChordRow(row)) {
        const nextRow = musicalRows[index + 1];
        if (nextRow && !isChordRow(nextRow) && !hasSection(nextRow) && row.y - nextRow.y <= CHORD_TO_LYRIC_DISTANCE) {
          if (openSection === 'intro') {
            lines.push(`{end_of_${openSection}}`, '');
            openSection = null;
          }
          lines.push(mergeChordsWithLyrics(row, nextRow, leftEdge, characterWidth));
          index += 1;
        } else {
          lines.push(chordOnlyLine(row));
        }
        continue;
      }

      if (openSection === 'intro') {
        lines.push(`{end_of_${openSection}}`, '');
        openSection = null;
      }
      lines.push(composeLyric(row, leftEdge, characterWidth));
    }
  });

  if (openSection) lines.push(`{end_of_${openSection}}`);
  const directives = [
    metadata.title && `{title: ${safeDirectiveValue(metadata.title)}}`,
    metadata.artist && `{artist: ${safeDirectiveValue(metadata.artist)}}`,
    metadata.composer && `{composer: ${safeDirectiveValue(metadata.composer)}}`,
    metadata.key && `{key: ${safeDirectiveValue(metadata.key)}}`,
    metadata.tuning && `{tuning: ${safeDirectiveValue(metadata.tuning)}}`
  ].filter(Boolean);
  const content = [...directives, '', ...lines]
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!contentPages.length || !lines.some((line) => /\[[A-G]/.test(line))) throw new Error('NO_CHORD_CONTENT');
  return {
    content,
    metadata,
    importedPages: contentPages.length,
    skippedPages: pages.length - contentPages.length
  };
};

export const importCifraClubPdf = async (file: File) => {
  const [{ GlobalWorkerOptions, getDocument }, { default: pdfWorkerUrl }] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  ]);
  GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  const document = await getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: PdfTextPage[] = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const items = textContent.items.flatMap((item) => {
      if (!('str' in item) || !item.str.trim()) return [];
      return [{
        text: item.str,
        x: item.transform[4],
        y: item.transform[5],
        width: item.width,
        height: item.height
      }];
    });
    pages.push({ pageNumber, items });
  }

  if (!pages.some((page) => page.items.length > 0)) throw new Error('PDF_WITHOUT_TEXT');
  return convertPdfTextToChordPro(pages);
};
