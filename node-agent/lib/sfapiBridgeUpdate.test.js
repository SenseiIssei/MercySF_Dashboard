const test = require('node:test');
const assert = require('node:assert/strict');
const { downloadUrlForArch } = require('./sfapiBridgeUpdate');

test('downloadUrlForArch picks the arm64 asset for arm64', () => {
  assert.equal(
    downloadUrlForArch('arm64'),
    'https://github.com/dandulox/MercySF_Dashboard/releases/latest/download/mercy-sfapi-bridge-linux-arm64',
  );
});

test('downloadUrlForArch picks the x64 asset for x64 and anything else', () => {
  assert.equal(
    downloadUrlForArch('x64'),
    'https://github.com/dandulox/MercySF_Dashboard/releases/latest/download/mercy-sfapi-bridge-linux-x64',
  );
  assert.equal(
    downloadUrlForArch('ia32'),
    'https://github.com/dandulox/MercySF_Dashboard/releases/latest/download/mercy-sfapi-bridge-linux-x64',
  );
});
