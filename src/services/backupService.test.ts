import { describe, expect, it } from 'vitest';
import { BackupAccountMismatchError, base64ToUint8, parseLibraryBackup, uint8ToBase64 } from './backupService';

const backupJson = (overrides: Record<string, unknown> = {}) => JSON.stringify({
  version: 3,
  ownerId: 'user-1',
  data: {
    songs: [],
    playlists: [],
    customChords: [],
    karaokes: [],
    karaokePlaylists: [],
    karaokeFiles: [],
    settings: {}
  },
  ...overrides
});

describe('backup format', () => {
  it('preserves binary data through Base64 conversion', () => {
    const original = new Uint8Array([0, 1, 127, 128, 254, 255]);
    expect(base64ToUint8(uint8ToBase64(original))).toEqual(original);
  });

  it('restores only explicitly allowed settings', () => {
    const parsed = parseLibraryBackup(backupJson({
      data: {
        songs: [],
        playlists: [],
        customChords: [],
        karaokes: [],
        karaokePlaylists: [],
        karaokeFiles: [],
        settings: {
          'ui-storage': '{"state":{"theme":"cyan"}}',
          'riff-forge-player-storage': '{"state":{"masterVolume":0.5}}',
          riff_token: 'must-not-be-restored',
          sync_v2_cursor: 'must-not-be-restored'
        }
      }
    }), 'user-1');

    expect(parsed.settings).toEqual({
      'ui-storage': '{"state":{"theme":"cyan"}}',
      'riff-forge-player-storage': '{"state":{"masterVolume":0.5}}'
    });
  });

  it('rejects a v3 backup owned by another account', () => {
    expect(() => parseLibraryBackup(backupJson(), 'user-2')).toThrow(BackupAccountMismatchError);
  });

  it('rejects unsupported or malformed backups', () => {
    expect(() => parseLibraryBackup(JSON.stringify({ version: 99, data: {} }), 'user-1')).toThrow('invalid_backup');
    expect(() => parseLibraryBackup(JSON.stringify({ version: 3, data: { songs: 'invalid' } }), 'user-1')).toThrow('invalid_backup');
  });
});
