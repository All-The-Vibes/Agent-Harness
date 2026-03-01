const puppeteer = require('puppeteer-core');
const path = require('path');

(async () => {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: path.join(
      process.env.USERPROFILE || process.env.HOME,
      '.cache/puppeteer/chrome/win64-145.0.7632.77/chrome-win64/chrome.exe'
    ),
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 2 });

  const htmlPath = path.resolve(__dirname, 'five-pillars-poster.html');
  const fileUrl = `file:///${htmlPath.replace(/\\/g, '/')}`;

  console.log(`Loading: ${fileUrl}`);
  await page.goto(fileUrl, { waitUntil: 'networkidle0', timeout: 30000 });

  await page.evaluateHandle('document.fonts.ready');
  console.log('Fonts loaded.');

  // Wait for animations to settle
  await new Promise(r => setTimeout(r, 1500));

  const outputPath = path.resolve(__dirname, 'five-pillars-poster.png');
  await page.screenshot({ path: outputPath, fullPage: false });

  console.log(`Screenshot saved: ${outputPath}`);
  await browser.close();
  console.log('Done.');
})();
