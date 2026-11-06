const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
async function png(input, output, width, bg) {
  let image = sharp(input, {density: 300}).resize({width});
  if (bg) image = image.flatten({background: bg});
  await image.png().toFile(output);
}
(async () => {
  for (const file of fs.readdirSync(path.join(root, 'vector')).filter(f => f.endsWith('.svg'))) {
    for (const width of [512, 1024, 2048]) await png(path.join(root, 'vector', file), path.join(root, 'digital', file.replace('.svg', `-${width}.png`)), width);
  }
  for (const name of ['horizontal', 'stacked', 'symbol', 'wordmark']) {
    await sharp(path.join(root, 'vector', `hafsdaangn-${name}-color.svg`), {density: 300}).resize({width: 2048}).flatten({background: '#FFFFFF'}).jpeg({quality: 95}).toFile(path.join(root, 'digital', `hafsdaangn-${name}-white-bg.jpg`));
  }
  for (const size of [16, 32, 48, 64]) await png(path.join(root, 'web/favicon.svg'), path.join(root, `web/favicon-${size}.png`), size);
  for (const [file, size] of [['apple-touch-icon',180], ['icon-192',192], ['icon-512',512], ['app-icon-1024',1024]]) await png(path.join(root,'web/app-icon.svg'), path.join(root,`web/${file}.png`),size);
  await png(path.join(root,'web/maskable.svg'),path.join(root,'web/maskable-512.png'),512);
  await png(path.join(root,'social/hafsdaangn-avatar.svg'),path.join(root,'social/hafsdaangn-avatar-1024.png'),1024);
  const executablePath = process.env.LOGO_BROWSER || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const browser = await chromium.launch({headless:true, executablePath});
  const page = await browser.newPage({viewport: {width: 1400, height: 1000}, deviceScaleFactor:1});
  await page.goto('file:///' + path.join(root,'presentation/brand-board.html').replaceAll('\\','/'));
  await page.evaluate(() => document.fonts.ready);
  const slides = await page.locator('.slide').all();
  for (let i=0;i<slides.length;i++) await slides[i].screenshot({path:path.join(root,`presentation/slide-${String(i+1).padStart(2,'0')}.png`)});
  console.log(`Rendered ${slides.length} presentation slides and all PNG exports`);
  await browser.close();
})();
