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

async function waitForStoredFill(page, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const found = await page.evaluate(async () => {
      const stored = await chrome.storage.local.get('openjobfill_replay_snapshots');
      return stored.openjobfill_replay_snapshots?.some((session) =>
        session.records?.some((record) => record.stage === 'fill')) === true;
    });
    if (found) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('等待填表执行快照超时');
}

async function waitForStoredResume(page, matches, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const resume = await page.evaluate(async () =>
      (await chrome.storage.local.get('openjobfill_resume_resume-default'))['openjobfill_resume_resume-default']);
    if (matches(resume)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('等待简历实际保存状态超时');
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
      headless: true,
      channel: 'chromium',
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
    await options.getByRole('button', { name: /智能解析导入/ }).click();
    await options.getByLabel('使用已配置模型补强 PDF / Word 解析').check();
    await options.getByText(/提取文本（最多 60,000 字符）及 PDF 前 4 页图片/).waitFor({ state: 'visible' });
    assert.equal(await options.locator('#resume-file-input').isDisabled(), true, '未确认数据发送时文件入口必须禁用');
    await options.getByLabel(/我确认本次会把提取文本/).check();
    assert.equal(await options.locator('#resume-file-input').isEnabled(), true, '确认后才允许选择待补强文档');
    await options.getByRole('tab', { name: 'AI 图片识别' }).click();
    await options.getByText('视觉模型配置：AI 尚未启用').waitFor({ state: 'visible' });
    assert.equal(
      await options.getByRole('button', { name: '开始 AI 视觉识别' }).isDisabled(),
      true,
      '未选择图片和确认处理方式时不得发起视觉 API 请求',
    );
    await options.getByRole('button', { name: '关闭导入窗口' }).click();

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
    await options.waitForFunction(
      (expected) => document.querySelector('#basics-name')?.value === expected,
      'Smoke Persistence Candidate',
      { timeout: 10000 },
    );
    assert.equal(await options.locator('#basics-name').inputValue(), 'Smoke Persistence Candidate');
    await options.close();
    // chrome.storage.local 的回调已完成，但 Chromium 将扩展存储刷到持久化
    // profile 文件存在短暂异步窗口；给磁盘落盘留出时间再模拟浏览器退出。
    await new Promise((resolve) => setTimeout(resolve, 300));

    // 关闭并重新打开浏览器上下文，验证数据不依赖当前页面内存。
    await context.close();
    context = await chromium.launchPersistentContext(profilePath, {
      headless: true,
      channel: 'chromium',
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
    await reopenedOptions.waitForFunction(
      (expected) => document.querySelector('#basics-name')?.value === expected,
      'Smoke Persistence Candidate',
      { timeout: 10000 },
    );
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
    await waitForStoredFill(reopenedOptions);
    const fillFields = await reopenedOptions.evaluate(async () => {
      const stored = await chrome.storage.local.get('openjobfill_replay_snapshots');
      return (stored.openjobfill_replay_snapshots || []).flatMap((session) =>
        (session.records || []).filter((record) => record.stage === 'fill').flatMap((record) =>
          record.payload?.fields || []));
    });
    const adapterAttempts = fillFields.flatMap((field) => field.attempts || []);
    assert.ok(
      adapterAttempts.some((attempt) =>
        attempt.adapterId === 'PhoenixInput'
        && attempt.executionWorld === 'MAIN'
        && attempt.outcome === 'success'),
      'PhoenixInput 应通过受限 MAIN-world Adapter 完成，而不是静默降级',
    );

    await reopenedHost.getByRole('button', { name: '离线回放最近运行（不写网页）' }).click();
    await reopenedHost.getByText(/确定性回放通过/).waitFor({ state: 'visible', timeout: 10000 });
    assert.equal(await reopenedPage.locator('input[name="candidateName"]').inputValue(), 'Smoke Persistence Candidate', '回放不得修改真实页面');

    // Real Chromium focus crosses the extension Shadow DOM, including its search box.
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: url });
    await reopenedPage.locator('input[name="candidateName"]').fill('before clipboard fill');
    await reopenedPage.locator('input[name="candidateName"]').focus();
    await reopenedHost.locator('#drawer-tab-clipboard').click();
    await reopenedHost.getByRole('textbox', { name: '搜索简历字段' }).fill('姓名');
    await reopenedHost.getByRole('button', { name: '复制 基本信息 姓名: Smoke Persistence Candidate', exact: true }).click();
    await reopenedPage.waitForFunction(() => document.querySelector('input[name="candidateName"]')?.value === 'Smoke Persistence Candidate');
    assert.equal(await reopenedHost.getByRole('textbox', { name: '搜索简历字段' }).inputValue(), '姓名', '点填不能覆盖扩展自己的搜索框');

    // 真实编辑/消息序列化/保存路径：未知不能变成0，清空已有0也必须真正删除。
    await reopenedOptions.setViewportSize({ width: 1366, height: 900 });
    assert.equal(await reopenedOptions.getByLabel('国家 / 地区', { exact: true }).inputValue(), '');
    const yearsInput = reopenedOptions.getByLabel('工作年限', { exact: true });
    assert.equal(await yearsInput.inputValue(), '');
    await yearsInput.fill('0');
    await waitForStoredResume(reopenedOptions, (resume) => resume?.basics.workingYears === 0);
    await yearsInput.fill('');
    await waitForStoredResume(reopenedOptions, (resume) => resume && resume.basics.workingYears === undefined);
    await reopenedOptions.getByRole('tab', { name: '网申常用信息', exact: true }).click();
    await reopenedOptions.getByRole('button', { name: '添加技能', exact: true }).click();
    await reopenedOptions.getByLabel('技能名称 1', { exact: true }).fill('Rust');
    await reopenedOptions.getByLabel('熟练度 1', { exact: true }).selectOption('熟练');
    await waitForStoredResume(reopenedOptions, (resume) => resume?.skills[0]?.name === 'Rust' && resume.skills[0].level === '熟练');
    await reopenedOptions.reload();
    await reopenedOptions.getByRole('tab', { name: '网申常用信息', exact: true }).click();
    assert.equal(await reopenedOptions.getByLabel('技能名称 1', { exact: true }).inputValue(), 'Rust');
    const artifactDir = path.join(repoRoot, 'output', 'playwright');
    fs.mkdirSync(artifactDir, { recursive: true });
    await reopenedOptions.screenshot({ path: path.join(artifactDir, 'skills-editor.png') });
    await reopenedOptions.getByRole('button', { name: '删除技能 1：Rust', exact: true }).click();
    await waitForStoredResume(reopenedOptions, (resume) => resume?.skills.length === 0);

    await reopenedOptions.getByRole('tab', { name: '投递看板', exact: true }).click();
    await reopenedOptions.getByRole('button', { name: '手动添加投递', exact: true }).click();
    await reopenedOptions.getByPlaceholder('例如：字节跳动 (ByteDance)', { exact: true }).fill('Smoke Company');
    await reopenedOptions.getByPlaceholder('例如：前端开发工程师 - 抖音架构', { exact: true }).fill('Offline Role');
    await reopenedOptions.getByRole('button', { name: '保存记录', exact: true }).click();
    await reopenedOptions.getByRole('tab', { name: '偏好设置', exact: true }).click();
    const downloaded = reopenedOptions.waitForEvent('download');
    await reopenedOptions.getByRole('button', { name: '导出全部本地数据', exact: true }).click();
    const download = await downloaded;
    const backup = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
    assert.equal(backup.data.jobApplications[0].jobUrl, '', '正常导出允许无网址投递');
    backup.data.resumes[0].basics.name = 'Replacement Candidate';
    const upload = () => reopenedOptions.getByLabel('选择本地备份文件', { exact: true }).setInputFiles({
      name: 'synthetic-old-backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)),
    });
    await reopenedOptions.getByRole('button', { name: '完全覆盖恢复', exact: true }).click();
    await upload();
    await reopenedOptions.getByRole('heading', { name: '恢复前预览：覆盖' }).waitFor();
    await reopenedOptions.screenshot({ path: path.join(artifactDir, 'backup-preview.png') });
    const storedName = () => reopenedOptions.evaluate(async () => (await chrome.storage.local.get('openjobfill_resume_resume-default'))['openjobfill_resume_resume-default']?.basics.name);
    assert.equal(await storedName(), 'Smoke Persistence Candidate', '仅预览不得恢复');
    await reopenedOptions.getByRole('button', { name: '取消恢复', exact: true }).click();
    assert.equal(await storedName(), 'Smoke Persistence Candidate', '取消不得写入备份');
    await reopenedOptions.getByRole('button', { name: '完全覆盖恢复', exact: true }).click();
    await upload();
    await reopenedOptions.getByRole('button', { name: '确认覆盖并保留恢复点', exact: true }).click();
    await waitForStoredResume(reopenedOptions, (resume) => resume?.basics.name === 'Replacement Candidate');
    await reopenedOptions.getByRole('button', { name: '恢复覆盖前的数据', exact: true }).click();
    await reopenedOptions.getByRole('button', { name: '确认恢复', exact: true }).click();
    await waitForStoredResume(reopenedOptions, (resume) => resume?.basics.name === 'Smoke Persistence Candidate');
    await reopenedOptions.screenshot({ path: path.join(artifactDir, 'backup-recovered.png') });

    await reopenedPage.reload();
    await reopenedPage.locator('#openjobfill-extension-host').getByRole('button', { name: '面板', exact: true }).click();
    await reopenedPage.locator('#openjobfill-extension-host').getByRole('tab', { name: '岗位匹配', exact: true }).click();
    await reopenedPage.locator('#openjobfill-extension-host').getByText('无法评估', { exact: true }).waitFor();

    console.log('extension smoke passed: shadow UI + persistence + MAIN-world + preview fill + replay + clipboard + unknown values + skills + backup preview/recovery + keyword feedback');
  } catch (error) {
    const optionsPage = context?.pages().find((page) => page.url().includes('/options.html'));
    if (optionsPage && !optionsPage.isClosed()) {
      const artifactDir = path.join(repoRoot, 'output', 'playwright');
      fs.mkdirSync(artifactDir, { recursive: true });
      await optionsPage.screenshot({ path: path.join(artifactDir, 'smoke-failure.png') }).catch(() => {});
      console.error('Synthetic options state:', await optionsPage.evaluate(async () => ({
        selectedTab: document.querySelector('[role="tab"][aria-selected="true"]')?.textContent,
        text: document.querySelector('main')?.textContent?.slice(0, 1500),
        storedSkills: (await chrome.storage.local.get('openjobfill_resume_resume-default'))['openjobfill_resume_resume-default']?.skills,
      })).catch(() => null));
    }
    throw error;
  } finally {
    await context?.close().catch(() => {});
    await new Promise((resolve) => server.close(resolve));
    const resolvedProfile = path.resolve(profilePath);
    const relativeProfile = path.relative(path.resolve(os.tmpdir()), resolvedProfile);
    if (!relativeProfile.startsWith('..') && !path.isAbsolute(relativeProfile) && path.basename(resolvedProfile).startsWith('openjobfill-smoke-')) {
      fs.rmSync(resolvedProfile, { recursive: true, force: true });
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
