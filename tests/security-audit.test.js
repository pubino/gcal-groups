/**
 * Security Audit Tests for Chrome Extension
 *
 * These tests verify the extension follows Chrome extension security best practices.
 */

const fs = require('fs');
const path = require('path');
const { test, describe } = require('node:test');
const assert = require('node:assert');

const ROOT = path.join(__dirname, '..');

describe('Security Audit', () => {

  describe('Manifest Security', () => {
    let manifest;

    test('manifest.json exists and is valid JSON', () => {
      const manifestPath = path.join(ROOT, 'manifest.json');
      assert.ok(fs.existsSync(manifestPath), 'manifest.json should exist');
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      assert.ok(manifest, 'manifest.json should be valid JSON');
    });

    test('uses Manifest V3', () => {
      manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
      assert.strictEqual(manifest.manifest_version, 3, 'Should use Manifest V3 for better security');
    });

    test('has minimal permissions', () => {
      manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
      const permissions = manifest.permissions || [];

      // These are dangerous permissions that should be avoided
      const dangerousPermissions = [
        'debugger',
        'downloads',
        'history',
        'management',
        'nativeMessaging',
        'pageCapture',
        'privacy',
        'proxy',
        'system.cpu',
        'system.memory',
        'system.storage',
        'tabCapture',
        'tts',
        'ttsEngine',
        'webNavigation',
        'webRequest',
        'webRequestBlocking'
      ];

      const foundDangerous = permissions.filter(p => dangerousPermissions.includes(p));
      assert.strictEqual(foundDangerous.length, 0,
        `Extension requests dangerous permissions: ${foundDangerous.join(', ')}`);
    });

    test('content scripts only run on Google Calendar', () => {
      manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
      const contentScripts = manifest.content_scripts || [];

      contentScripts.forEach(script => {
        script.matches.forEach(match => {
          assert.ok(
            match.includes('calendar.google.com'),
            `Content script match "${match}" should only target Google Calendar`
          );
        });
      });
    });

    test('no overly broad host permissions', () => {
      manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
      const hostPermissions = manifest.host_permissions || [];

      const tooPermissive = ['<all_urls>', '*://*/*', 'http://*/*', 'https://*/*'];
      const foundBroad = hostPermissions.filter(h => tooPermissive.includes(h));

      assert.strictEqual(foundBroad.length, 0,
        `Extension has overly broad host permissions: ${foundBroad.join(', ')}`);
    });

    test('no remote code execution', () => {
      manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));

      // Check for remotely hosted scripts
      assert.ok(!manifest.content_security_policy?.includes('unsafe-eval'),
        'Should not allow unsafe-eval in CSP');
      assert.ok(!manifest.content_security_policy?.includes('unsafe-inline'),
        'Should not allow unsafe-inline in CSP');
    });
  });

  describe('Content Script Security', () => {
    let contentScript;

    test('content.js exists', () => {
      const contentPath = path.join(ROOT, 'content.js');
      assert.ok(fs.existsSync(contentPath), 'content.js should exist');
      contentScript = fs.readFileSync(contentPath, 'utf8');
    });

    test('no eval or Function constructor usage', () => {
      contentScript = fs.readFileSync(path.join(ROOT, 'content.js'), 'utf8');

      assert.ok(!contentScript.includes('eval('), 'Should not use eval()');
      assert.ok(!contentScript.includes('new Function('), 'Should not use Function constructor');
    });

    test('no innerHTML with user input', () => {
      contentScript = fs.readFileSync(path.join(ROOT, 'content.js'), 'utf8');

      // Check for innerHTML that might include unsanitized user input
      const hasRiskyInnerHTML = /innerHTML\s*=.*(?:request|message|data)\./i.test(contentScript);
      assert.ok(!hasRiskyInnerHTML, 'Should not use innerHTML with user-controlled data');
    });

    test('no document.write usage', () => {
      contentScript = fs.readFileSync(path.join(ROOT, 'content.js'), 'utf8');

      assert.ok(!contentScript.includes('document.write'), 'Should not use document.write()');
    });

    test('message handler validates actions', () => {
      contentScript = fs.readFileSync(path.join(ROOT, 'content.js'), 'utf8');

      // Should check for specific actions rather than blindly executing
      assert.ok(
        contentScript.includes('request.action ===') || contentScript.includes("request.action =="),
        'Message handler should validate action types'
      );
    });
  });

  describe('Popup Script Security', () => {
    let popupScript;

    test('popup.js exists', () => {
      const popupPath = path.join(ROOT, 'popup.js');
      assert.ok(fs.existsSync(popupPath), 'popup.js should exist');
      popupScript = fs.readFileSync(popupPath, 'utf8');
    });

    test('no eval or Function constructor usage', () => {
      popupScript = fs.readFileSync(path.join(ROOT, 'popup.js'), 'utf8');

      assert.ok(!popupScript.includes('eval('), 'Should not use eval()');
      assert.ok(!popupScript.includes('new Function('), 'Should not use Function constructor');
    });

    test('input validation for group names', () => {
      popupScript = fs.readFileSync(path.join(ROOT, 'popup.js'), 'utf8');

      // Should validate group name input
      assert.ok(
        popupScript.includes('groupName.length') || popupScript.includes('.test(groupName'),
        'Should validate group name input'
      );
    });

    test('no XSS vulnerabilities in innerHTML', () => {
      popupScript = fs.readFileSync(path.join(ROOT, 'popup.js'), 'utf8');

      // Check that innerHTML assignments use safe patterns
      // Looking for innerHTML with template literals containing only trusted data
      const innerHTMLMatches = popupScript.match(/innerHTML\s*=\s*`[^`]*`/g) || [];

      innerHTMLMatches.forEach(match => {
        // These should only contain data we control (like groupName after validation)
        assert.ok(
          !match.includes('${response') && !match.includes('${message'),
          `Potential XSS: ${match.substring(0, 50)}...`
        );
      });
    });

    test('validates URL before operations', () => {
      popupScript = fs.readFileSync(path.join(ROOT, 'popup.js'), 'utf8');

      assert.ok(
        popupScript.includes('calendar.google.com'),
        'Should validate URL includes calendar.google.com'
      );
    });
  });

  describe('Data Storage Security', () => {
    let popupScript;

    test('uses chrome.storage.sync for user data', () => {
      popupScript = fs.readFileSync(path.join(ROOT, 'popup.js'), 'utf8');

      assert.ok(
        popupScript.includes('chrome.storage.sync'),
        'Should use chrome.storage.sync for persistent user data'
      );
    });

    test('no sensitive data in localStorage', () => {
      popupScript = fs.readFileSync(path.join(ROOT, 'popup.js'), 'utf8');
      const contentScript = fs.readFileSync(path.join(ROOT, 'content.js'), 'utf8');

      assert.ok(!popupScript.includes('localStorage.'), 'popup.js should not use localStorage');
      assert.ok(!contentScript.includes('localStorage.'), 'content.js should not use localStorage');
    });
  });

  describe('External Resource Security', () => {
    test('no external script loading', () => {
      const jsFiles = ['content.js', 'popup.js'].map(f =>
        fs.readFileSync(path.join(ROOT, f), 'utf8')
      );

      jsFiles.forEach((content, i) => {
        const filename = ['content.js', 'popup.js'][i];
        assert.ok(
          !content.includes('fetch(') || content.includes("fetch('https://calendar.google.com"),
          `${filename} should not fetch external resources`
        );
        assert.ok(
          !content.includes("import('http"),
          `${filename} should not dynamically import from URLs`
        );
      });
    });

    test('no external URLs in manifest', () => {
      const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
      const manifestStr = JSON.stringify(manifest);

      // Should not reference external CDNs or services
      assert.ok(!manifestStr.includes('cdn.'), 'Manifest should not reference CDN URLs');
      assert.ok(!manifestStr.includes('googleapis.com/'), 'Manifest should not reference external Google APIs');
    });
  });

  describe('Error Handling Security', () => {
    test('handles chrome.runtime.lastError', () => {
      const popupScript = fs.readFileSync(path.join(ROOT, 'popup.js'), 'utf8');

      assert.ok(
        popupScript.includes('chrome.runtime.lastError'),
        'Should check for chrome.runtime.lastError in callbacks'
      );
    });
  });
});

// Run tests if executed directly
if (require.main === module) {
  console.log('Running security audit tests...');
}
