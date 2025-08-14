const fs = require('fs');
const path = require('path');

const files = ['constants.js', 'audio.js', 'storage.js', 'game.js', 'service-worker.js'];
const distDir = path.join(__dirname, 'dist');

for (const file of files) {
  const src = path.join(__dirname, file);
  const dest = path.join(distDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
  }
}
