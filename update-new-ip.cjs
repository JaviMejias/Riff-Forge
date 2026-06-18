const fs = require('fs');
const files = [
  'src/components/karaoke/CreateKaraokeModal.tsx',
  'src/components/karaoke/KaraokePlayer.tsx',
  'src/components/karaoke/player/LocalAudioPlayer.tsx',
  'src/components/karaoke/editor/KaraokeLyricsEditor.tsx',
  'src/store/authStore.ts',
  'src/services/syncService.ts',
  'src/config.ts'
];

files.forEach(file => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(/146\.181\.34\.184/g, '146.181.32.238');
    fs.writeFileSync(file, content);
    console.log(`Updated ${file}`);
  }
});
