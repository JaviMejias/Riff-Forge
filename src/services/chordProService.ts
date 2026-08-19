import ChordSheetJS from 'chordsheetjs';

const CHORD_PRO_DIRECTIVE_PATTERN = /^\s*\{[^}\n]+\}\s*$/m;
const INLINE_CHORD_PATTERN = /\[(?:[A-G](?:#|b)?(?:m|maj|min|dim|aug|sus|add|\d|[#()+/-])*)\](?=\S|\s)/;

export interface ChordProMetadata {
  key?: string;
  capo?: string;
  tuning?: string;
  strummingPattern?: string;
}

export interface ChordProImport {
  content: string;
  metadata: ChordProMetadata;
}

export interface ChordProExportOptions extends ChordProMetadata {
  title: string;
  artist?: string;
}

export interface ChordProDocumentMetadata extends ChordProMetadata {
  title?: string;
  artist?: string;
}

const firstMetadataValue = (value: string | string[] | null | undefined) => {
  if (Array.isArray(value)) return value[0];
  return value || undefined;
};

const safeDirectiveValue = (value: string) => value.replace(/[{}\r\n]+/g, ' ').trim();

export const isChordProContent = (content: string) => (
  CHORD_PRO_DIRECTIVE_PATTERN.test(content) || INLINE_CHORD_PATTERN.test(content)
);

export const parseChordContent = (content: string) => {
  const parser = isChordProContent(content)
    ? new ChordSheetJS.ChordProParser()
    : new ChordSheetJS.UltimateGuitarParser();
  return parser.parse(content);
};

export const normalizeChordPro = (content: string) => {
  if (!content.trim()) return '';
  return new ChordSheetJS.ChordProFormatter().format(parseChordContent(content)).trim();
};

export const importChordPro = (content: string): ChordProImport => {
  if (!content.trim()) throw new Error('EMPTY_CHORD_PRO');

  const parser = new ChordSheetJS.ChordProParser();
  const song = parser.parse(content);
  const formattedContent = new ChordSheetJS.ChordProFormatter().format(song).trim();
  const hasMusicalContent = song.lines.some((line) => line.items.some((item) => (
    item instanceof ChordSheetJS.ChordLyricsPair && Boolean(item.chords || item.lyrics)
  )));

  if (!formattedContent || !hasMusicalContent) throw new Error('INVALID_CHORD_PRO');

  const metadata = song.metadata;
  return {
    content: formattedContent,
    metadata: {
      key: firstMetadataValue(metadata.get('key')),
      capo: firstMetadataValue(metadata.get('capo')),
      tuning: firstMetadataValue(metadata.get('tuning')),
      strummingPattern: firstMetadataValue(metadata.get('strumming'))
    }
  };
};

export const synchronizeChordProMetadata = (content: string, metadata: ChordProDocumentMetadata) => {
  if (!content.trim()) return '';

  let synchronizedBody = normalizeChordPro(content);
  const directives: Array<[keyof ChordProDocumentMetadata, string]> = [
    ['title', 'title'],
    ['artist', 'artist'],
    ['key', 'key'],
    ['capo', 'capo'],
    ['tuning', 'tuning'],
    ['strummingPattern', 'strumming']
  ];
  const synchronizedDirectives: string[] = [];

  directives.forEach(([property, directive]) => {
    if (!(property in metadata)) return;
    const directivePattern = new RegExp(`^\\s*\\{${directive}(?:_of_song)?:[^}]*}\\s*\\n?`, 'gmi');
    synchronizedBody = synchronizedBody.replace(directivePattern, '');
    const value = metadata[property];
    if (value?.trim()) synchronizedDirectives.push(`{${directive}: ${safeDirectiveValue(value)}}`);
  });

  return [...synchronizedDirectives, synchronizedBody.trim()].filter(Boolean).join('\n');
};

export const exportChordPro = (content: string, options: ChordProExportOptions) => {
  if (!content.trim()) throw new Error('EMPTY_CHORD_PRO');
  return synchronizeChordProMetadata(content, options);
};

export const chordProFilename = (title: string, artist?: string) => {
  const baseName = [artist, title].filter(Boolean).join(' - ') || 'cifra';
  const safeName = baseName.replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim();
  return `${safeName || 'cifra'}.chopro`;
};
