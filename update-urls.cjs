const fs = require('fs');
const files = [
  'src/components/karaoke/CreateKaraokeModal.tsx',
  'src/components/karaoke/KaraokePlayer.tsx',
  'src/components/karaoke/player/LocalAudioPlayer.tsx',
  'src/components/karaoke/editor/KaraokeLyricsEditor.tsx',
  'src/store/authStore.ts',
  'src/services/syncService.ts'
];

files.forEach(file => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(/http:\/\/localhost:3001/g, 'http://146.181.34.184:3001');
    fs.writeFileSync(file, content);
    console.log(`Updated ${file}`);
  }
});
