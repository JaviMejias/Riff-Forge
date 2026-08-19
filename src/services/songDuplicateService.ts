import type { Song } from '../db';

export const normalizeSongIdentityPart = (value?: string) => (value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/&/g, ' and ')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()
  .replace(/\s+/g, ' ');

export const findDuplicateSong = (songs: Song[], title: string, artist?: string, excludedId?: number) => {
  const normalizedTitle = normalizeSongIdentityPart(title);
  const normalizedArtist = normalizeSongIdentityPart(artist || 'Desconocido');
  if (!normalizedTitle) return undefined;

  return songs.find((song) => song.id !== excludedId
    && normalizeSongIdentityPart(song.name) === normalizedTitle
    && normalizeSongIdentityPart(song.artist || 'Desconocido') === normalizedArtist);
};
