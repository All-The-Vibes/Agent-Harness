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

  // Load the HTML publication
  const htmlPath = path.resolve(__dirname, 'whitepaper-publication.html');
  const fileUrl = `file:///${htmlPath.replace(/\\/g, '/')}`;

  console.log(`Loading: ${fileUrl}`);
  await page.goto(fileUrl, { waitUntil: 'networkidle0', timeout: 30000 });

  // Wait for fonts to load
  await page.evaluateHandle('document.fonts.ready');
  console.log('Fonts loaded.');

  // Generate PDF
  const outputPath = path.resolve(__dirname, 'Agent-Harness-WhitePaper.pdf');
  await page.pdf({
    path: outputPath,
    format: 'A4',
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: `
      <div style="width:100%; font-family: Inter, Helvetica, Arial, sans-serif; font-size: 7px;
           color: #718096; padding: 0 20mm; display: flex; justify-content: space-between;">
        <span>THE AGENT HARNESS</span>
        <span>POINT OF VIEW WHITE PAPER</span>
      </div>
    `,
    footerTemplate: `
      <div style="width:100%; font-family: Inter, Helvetica, Arial, sans-serif; font-size: 7px;
           color: #718096; padding: 0 20mm; display: flex; justify-content: space-between;">
        <span>Shyam Sridhar &middot; March 2026</span>
        <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
      </div>
    `,
    margin: {
      top: '18mm',
      bottom: '20mm',
      left: '18mm',
      right: '18mm'
    },
    preferCSSPageSize: false
  });

  console.log(`PDF generated: ${outputPath}`);
  await browser.close();
  console.log('Done.');
})();
