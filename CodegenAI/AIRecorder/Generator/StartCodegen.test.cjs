const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

test('two-column CSV plans names and IDs using commented app settings, without recording',
  { skip: process.platform !== 'win32' }, () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'two-column-codegen-'));
    try {
      const recorder = path.join(root, 'CodegenAI');
      fs.mkdirSync(recorder);
      const script = path.join(recorder, 'StartCodegen.ps1');
      fs.copyFileSync(path.resolve(__dirname, '../../StartCodegen.ps1'), script);
      const settings = path.join(root, 'appsettings.json');
      fs.writeFileSync(settings, '{\n// settings comment\n"Urls": {"IReport": "https://example.test/default.aspx"}, /* block */ "Note": "quoted // and /* text */"\n}');
      const csv = path.join(root, 'cases.csv');
      const manifestFile = path.join(recorder, 'Recordings', 'Checks', 'manifest.json');
      const run = (expected = 0) => {
        const result = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script,
          '-BatchFile', csv, '-BatchName', 'Checks', '-DryRun'], { encoding: 'utf8', timeout: 60000 });
        assert.equal(result.status, expected, result.stdout + result.stderr);
        return result.stdout + result.stderr;
      };
      fs.writeFileSync(csv, 'TestCaseId,Title\r\n95040,Verify Financial IRP Deal Report Details Page\r\nTC-02,"Verify report, calculation and workflow"\r\n');
      assert.match(run(), /Tag: @95040/);
      const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
      assert.deepEqual(manifest.testCases.map(({ id, title }) => ({ id, title })), [
        { id: '95040', title: 'Verify Financial IRP Deal Report Details Page' },
        { id: 'TC-02', title: 'Verify report, calculation and workflow' }
      ]);
      assert.ok(manifest.testCases.every(entry => entry.startUrl === 'https://example.test/default.aspx'));
      assert.deepEqual(fs.readdirSync(path.dirname(manifestFile)), ['manifest.json']);
      assert.ok(!fs.existsSync(path.join(recorder, 'AIRecorder', 'auth')));
      const originalManifest = fs.readFileSync(manifestFile, 'utf8');
      for (const [contents, message] of [
        ['TestCaseId\nTC01\n', /Missing CSV column: Title/],
        ['TestCaseId,Title\nTC01,\n', /Title is required/],
        ['TestCaseId,Title\nTC01,One\ntc01,Two\n', /Duplicate TestCaseId/],
        ['TestCaseId,Title\nTC01,"One\nTwo"\n', /single-line Scenario name/]
      ]) {
        fs.writeFileSync(csv, contents);
        assert.match(run(1), message);
        assert.equal(fs.readFileSync(manifestFile, 'utf8'), originalManifest);
      }
      // Validate the user's complete CSV too, including quoted commas and unique IDs.
      fs.copyFileSync(path.resolve(__dirname, '../../testcases.csv'), csv);
      run();
      const cases = JSON.parse(fs.readFileSync(manifestFile, 'utf8')).testCases;
      assert.ok(cases.length > 0);
      assert.equal(new Set(cases.map(entry => entry.id.toLowerCase())).size, cases.length);
      fs.writeFileSync(settings, '{"Urls": {}}');
      assert.match(run(1), /Configure Urls.IReport/);
      fs.writeFileSync(settings, '{ broken SECRET_VALUE');
      const invalidOutput = run(1);
      assert.match(invalidOutput, /Cannot read appsettings.json/);
      assert.ok(!invalidOutput.includes('SECRET_VALUE'));
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });