'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const TARGET_VERSION = '3.2.3';

let passCount = 0;
let failCount = 0;

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

function readJson(file) {
  return JSON.parse(read(file));
}

function assert(condition, label, detail) {
  if (condition) {
    passCount++;
    console.log(`PASS ${label}`);
  } else {
    failCount++;
    const suffix = detail ? ` -- ${detail}` : '';
    console.log(`FAIL ${label}${suffix}`);
  }
}

function containsNoInternalPaths(versionJson) {
  const files = versionJson && versionJson.files ? Object.keys(versionJson.files) : [];
  return files.every(file => !file.startsWith('p1b/') && !file.startsWith('p1c/'));
}

function directoryAbsent(name) {
  return !fs.existsSync(path.join(ROOT, name));
}

function runInstallerBomSmoke() {
  const tmpRoot = path.join(ROOT, 'tests', '.tmp-public-release-smoke');
  const installLogPath = path.join(ROOT, 'install_log.txt');
  const hadInstallLog = fs.existsSync(installLogPath);
  const previousInstallLog = hadInstallLog ? fs.readFileSync(installLogPath) : null;
  fs.rmSync(tmpRoot, { recursive: true, force: true });

  const openclaw = path.join(tmpRoot, '.openclaw');
  const workspace = path.join(openclaw, 'workspace');
  fs.mkdirSync(workspace, { recursive: true });
  fs.writeFileSync(path.join(workspace, 'SOUL.md'), 'original soul\n', 'utf8');
  fs.writeFileSync(path.join(workspace, 'IDENTITY.md'), 'original identity\n', 'utf8');
  fs.writeFileSync(path.join(openclaw, 'openclaw.json'), '\uFEFF{"existing":true}\n', 'utf8');

  const result = spawnSync(process.execPath, ['installer.js'], {
    cwd: ROOT,
    env: Object.assign({}, process.env, {
      USERPROFILE: tmpRoot,
      HOME: tmpRoot
    }),
    encoding: 'utf8'
  });

  let hooksEnabled = false;
  try {
    const updated = fs.readFileSync(path.join(openclaw, 'openclaw.json'), 'utf8').replace(/^\uFEFF/u, '');
    hooksEnabled = JSON.parse(updated).hooks.internal.enabled === true;
  } catch {
    hooksEnabled = false;
  }

  const requiredFiles = [
    path.join(openclaw, 'skills', 'soul-forge', 'SKILL.md'),
    path.join(openclaw, 'hooks', 'soul-forge-bootstrap', 'HOOK.md'),
    path.join(openclaw, 'hooks', 'soul-forge-bootstrap', 'handler.js'),
    path.join(workspace, '.soul_forge', 'config.json'),
    path.join(workspace, '.soul_forge', 'memory.md'),
    path.join(workspace, '.soul_forge', 'insights.md'),
    path.join(workspace, '.soul_history', 'SOUL_INIT.md'),
    path.join(workspace, '.soul_history', 'IDENTITY_INIT.md')
  ];
  const requiredFilesPresent = requiredFiles.every(file => fs.existsSync(file));

  fs.rmSync(tmpRoot, { recursive: true, force: true });
  if (hadInstallLog) {
    fs.writeFileSync(installLogPath, previousInstallLog);
  } else {
    fs.rmSync(installLogPath, { force: true });
  }

  return {
    ok: result.status === 0 && hooksEnabled && requiredFilesPresent,
    status: result.status,
    hooksEnabled,
    requiredFilesPresent,
    output: `${result.stdout || ''}${result.stderr || ''}`
  };
}

const versionJson = readJson('version.json');
const packageJson = readJson('package.json');
const handler = read('hooks/soul-forge-bootstrap/handler.js');
const readme = read('README.md');
const changelog = read('CHANGELOG.md');
const installerSmoke = runInstallerBomSmoke();

assert(versionJson.version === TARGET_VERSION, 'version.json uses v3.2.3', versionJson.version);
assert(packageJson.version === TARGET_VERSION, 'package.json uses v3.2.3', packageJson.version);
assert(
  handler.includes(`const SOUL_FORGE_VERSION = '${TARGET_VERSION}';`),
  'handler SOUL_FORGE_VERSION uses v3.2.3'
);
assert(readme.includes('version-3.2.3'), 'README badge uses v3.2.3');
assert(readme.toLowerCase().includes('public stable test build'), 'README documents public stable test build');
assert(readme.toLowerCase().includes('preinstalled'), 'README mentions preinstalled agent test context');
assert(changelog.includes('## v3.2.3'), 'CHANGELOG has v3.2.3 entry');
assert(containsNoInternalPaths(versionJson), 'version.json excludes internal p1b/p1c files');
assert(directoryAbsent('p1b'), 'repo root does not include p1b directory');
assert(directoryAbsent('p1c'), 'repo root does not include p1c directory');
assert(
  installerSmoke.ok,
  'installer enables hooks and installs files when openclaw.json has UTF-8 BOM',
  `status=${installerSmoke.status} hooks=${installerSmoke.hooksEnabled} files=${installerSmoke.requiredFilesPresent}`
);

console.log('');
console.log(`Public release smoke: ${passCount} PASS, ${failCount} FAIL`);

if (failCount > 0) {
  process.exit(1);
}
