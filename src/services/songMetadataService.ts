export interface SongMetadataInput {
  title?: string;
  artist?: string;
  composer?: string;
  key?: string;
  tuning?: string;
}

export type NormalizedSongMetadata = SongMetadataInput;

export type MetadataFieldStatus = 'detected' | 'missing' | 'review';

export interface MetadataFieldAssessment {
  field: 'title' | 'artist' | 'key' | 'tuning';
  label: string;
  status: MetadataFieldStatus;
}

const FIELD_PREFIXES: Record<keyof SongMetadataInput, RegExp> = {
  title: /^(?:t[ií]tulo|title)\s*:\s*/i,
  artist: /^(?:artista|artist)\s*:\s*/i,
  composer: /^(?:composici[oó]n de|compositor|composer)\s*:\s*/i,
  key: /^(?:tono|tonalidad|key)\s*:\s*/i,
  tuning: /^(?:afinaci[oó]n|tuning)\s*:\s*/i
};

const cleanValue = (value?: string) => value
  ?.normalize('NFC')
  .replace(/[\u00a0\u2007\u202f]/g, ' ')
  .replace(/[\u200b-\u200d\ufeff]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

const normalizePlainField = (value: string | undefined, field: keyof SongMetadataInput) => {
  let normalized = cleanValue(value);
  if (!normalized) return undefined;
  while (FIELD_PREFIXES[field].test(normalized)) normalized = normalized.replace(FIELD_PREFIXES[field], '').trim();
  return normalized || undefined;
};

export const normalizeMusicalKey = (value?: string) => {
  const cleaned = normalizePlainField(value, 'key')?.replace(/♯/g, '#').replace(/♭/g, 'b');
  if (!cleaned) return undefined;

  const match = cleaned.match(/^([a-gA-G])\s*([#b]?)(.*)$/);
  if (!match) return cleaned;
  const suffix = match[3].trim();
  const normalizedSuffix = /^(?:menor|min(?:or)?|minor)$/i.test(suffix)
    ? 'm'
    : /^(?:mayor|maj(?:or)?|major)$/i.test(suffix)
      ? ''
      : suffix;
  return `${match[1].toUpperCase()}${match[2]}${normalizedSuffix}`;
};

export const normalizeTuning = (value?: string) => {
  const cleaned = normalizePlainField(value, 'tuning')?.replace(/♯/g, '#').replace(/♭/g, 'b');
  if (!cleaned) return undefined;

  const compact = cleaned.replace(/[\s,;\-/]+/g, '');
  if (/^(?:standard|est[aá]ndar|eadgbe)$/i.test(compact)) return 'Estándar';
  if (/^drop\s*d$/i.test(cleaned)) return 'Drop D';

  const notes = cleaned.split(/[\s,;\-/]+/).filter(Boolean);
  if (notes.length >= 4 && notes.every((note) => /^[A-Ga-g](?:#|b)?\d?$/.test(note))) {
    return notes.map((note) => `${note[0].toUpperCase()}${note.slice(1)}`).join(' ');
  }
  return cleaned;
};

export const normalizeSongMetadata = (metadata: SongMetadataInput): NormalizedSongMetadata => ({
  title: normalizePlainField(metadata.title, 'title'),
  artist: normalizePlainField(metadata.artist, 'artist'),
  composer: normalizePlainField(metadata.composer, 'composer'),
  key: normalizeMusicalKey(metadata.key),
  tuning: normalizeTuning(metadata.tuning)
});

export const assessSongMetadata = (metadata: SongMetadataInput): MetadataFieldAssessment[] => {
  const normalized = normalizeSongMetadata(metadata);
  const keyLooksValid = !normalized.key || /^[A-G](?:#|b)?m?$/.test(normalized.key);
  const tuningLooksValid = !normalized.tuning
    || /^(?:Estándar|Drop [A-G](?:#|b)?)$/i.test(normalized.tuning)
    || /^(?:[A-G](?:#|b)?\d?)(?:\s+[A-G](?:#|b)?\d?){3,}$/.test(normalized.tuning);

  return [
    { field: 'title', label: 'Título', status: normalized.title ? 'detected' : 'missing' },
    { field: 'artist', label: 'Artista', status: normalized.artist ? 'detected' : 'missing' },
    {
      field: 'key',
      label: 'Tono',
      status: !normalized.key ? 'missing' : keyLooksValid ? 'detected' : 'review'
    },
    {
      field: 'tuning',
      label: 'Afinación',
      status: !normalized.tuning ? 'missing' : tuningLooksValid ? 'detected' : 'review'
    }
  ];
};
