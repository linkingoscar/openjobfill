const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');

const repoRoot = path.resolve(__dirname, '..', '..');
const extensionPath = path.join(repoRoot, '.output', 'chrome-mv3');

function startStaticServer() {
  const server = http.createServer((request, response) => {
    const requestPath = decodeURIComponent((request.url || '/').split('?')[0]);
    const candidate = path.resolve(repoRoot, `.${requestPath}`);
    if (candidate !== repoRoot && !candidate.startsWith(`${repoRoot}${path.sep}`)) {
      response.writeHead(403);
      response.end('Forbidden');
      return;
    }
    const filePath = candidate === repoRoot ? path.join(repoRoot, 'test', 'sandbox.html') : candidate;
    fs.readFile(filePath, (error, data) => {
      if (error) {
        response.writeHead(error.code === 'ENOENT' ? 404 : 500);
        response.end(error.message);
        return;
      }
      response.writeHead(200, { 'content-type': filePath.endsWith('.html') ? 'text/html; charset=utf-8' : 'text/plain' });
      response.end(data);
    });
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, 'localhost', () => {
      const address = server.address();
      resolve({ server, url: `http://localhost:${address.port}` });
    });
  });
}

async function waitForExtensionId(context) {
  const existing = context.serviceWorkers()[0];
  if (existing) return new URL(existing.url()).hostname;
  const worker = await context.waitForEvent('serviceworker');
  return new URL(worker.url()).hostname;
}

async function openOptions(context, extensionId) {
  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/options.html`);
  await options.locator('#basics-name').waitFor();
  return options;
}

async function main() {
  if (!fs.existsSync(path.join(extensionPath, 'manifest.json'))) {
    throw new Error('缺少 .output/chrome-mv3，请先运行 pnpm build');
  }

  const { server, url } = await startStaticServer();
  const profilePath = fs.mkdtempSync(path.join(os.tmpdir(), 'openjobfill-smoke-'));
  let context;
  try {
    context = await chromium.launchPersistentContext(profilePath, {
      headless: false,
      args: [
        '--disable-extensions-except=' + extensionPath,
        '--load-extension=' + extensionPath,
      ],
    });
    const page = await context.newPage();
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(`${url}/test/sandbox.html`, { waitUntil: 'domcontentloaded' });
    const extensionId = await waitForExtensionId(context);
    await page.evaluate(() => { document.documentElement.style.fontSize = '64px'; });

    const host = page.locator('#openjobfill-extension-host');
    await host.waitFor({ state: 'attached', timeout: 15000 });
    const bubble = host.locator('button[aria-label^="一键自动填写当前页面"]');
    await bubble.waitFor({ state: 'visible' });
    const dimensions = await bubble.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    });
    const hostStyles = await page.locator('#openjobfill-extension-host').evaluate((element) => {
      const style = getComputedStyle(element);
      return { fontSize: style.fontSize, display: style.display };
    });
    assert.equal(dimensions.width, 48, '宿主页面根字号不应放大悬浮球宽度');
    assert.equal(dimensions.height, 48, '宿主页面根字号不应放大悬浮球高度');
    assert.equal(hostStyles.fontSize, '16px', '宿主节点应固定扩展基准字号');
    assert.equal(hostStyles.display, 'block', '宿主节点应保持块级布局，避免被页面样式压缩');

    const options = await openOptions(context, extensionId);
    const nameInput = options.locator('#basics-name');
    const saveStatus = options.locator('[aria-live="polite"]');
    const initialSaveStatus = await saveStatus.textContent();
    await nameInput.fill('Smoke Persistence Candidate');
    // 等待本次编辑真正触发一次“待保存/保存中”状态，避免命中加载时的“已自动保存”。
    await options.waitForFunction(
      (previous) => document.querySelector('[aria-live="polite"]')?.textContent !== previous,
      initialSaveStatus,
      { timeout: 5000 },
    );
    await options.getByText('已自动保存').waitFor({ timeout: 10000 });
    await options.reload();
    assert.equal(await options.locator('#basics-name').inputValue(), 'Smoke Persistence Candidate');
    await options.close();

    // 关闭并重新打开浏览器上下文，验证数据不依赖当前页面内存。
    await context.close();
    context = await chromium.launchPersistentContext(profilePath, {
      headless: false,
      args: [
        '--disable-extensions-except=' + extensionPath,
        '--load-extension=' + extensionPath,
      ],
    });
    const reopenedPage = await context.newPage();
    await reopenedPage.setViewportSize({ width: 360, height: 800 });
    await reopenedPage.goto(`${url}/test/sandbox.html`, { waitUntil: 'domcontentloaded' });
    const reopenedExtensionId = await waitForExtensionId(context);
    const reopenedOptions = await openOptions(context, reopenedExtensionId);
    assert.equal(await reopenedOptions.locator('#basics-name').inputValue(), 'Smoke Persistence Candidate');

    // 生产扩展真实链路：探测招聘表单 → 打开预览 → 确认填写 → 读回页面控件。
    const reopenedHost = reopenedPage.locator('#openjobfill-extension-host');
    await reopenedHost.waitFor({ state: 'attached', timeout: 15000 });
    const reopenedBubble = reopenedHost.locator('button[aria-label^="一键自动填写当前页面"]');
    await reopenedBubble.waitFor({ state: 'visible' });
    await reopenedPage.evaluate(() => { location.hash = '#next-step'; });
    const stepNotice = reopenedHost.getByRole('button', { name: /检测到网申新步骤/ });
    await stepNotice.waitFor({ state: 'visible', timeout: 5000 });
    const stepNoticeWidth = await stepNotice.evaluate((element) => element.getBoundingClientRect().width);
    assert.equal(stepNoticeWidth, 248, '步骤提示条宽度不应被宿主页面样式压缩');
    await reopenedBubble.click();
    const confirmFill = reopenedHost.getByRole('button', { name: /^确认填写/ });
    await confirmFill.waitFor({ state: 'visible', timeout: 15000 });
    const drawer = reopenedHost.locator('#openjobfill-drawer-panel');
    const drawerWidth = await drawer.evaluate((element) => element.getBoundingClientRect().width);
    assert.ok(drawerWidth <= 258, `窄视口抽屉应收缩到可视区域内（实际 ${drawerWidth}px）`);
    await confirmFill.click();
    await reopenedPage.waitForFunction(
      () => document.querySelector('input[name="candidateName"]')?.value === 'Smoke Persistence Candidate',
      undefined,
      { timeout: 15000 },
    );
    assert.equal(
      await reopenedPage.locator('input[name="candidateName"]').inputValue(),
      'Smoke Persistence Candidate',
    );

    console.log('extension smoke passed: shadow UI sizing + reload + browser restart persistence + preview fill');
  } finally {
    await context?.close().catch(() => {});
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(profilePath, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
