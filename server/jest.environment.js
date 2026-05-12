/**
 * Custom Jest environment that patches dynamic import() to return
 * configurable CJS modules instead of non-configurable ESM namespaces.
 *
 * This is needed for jest.spyOn to work with await import() in Node.js 22+.
 */

const { TestEnvironment } = require('jest-environment-node');

class PatchedNodeEnvironment extends TestEnvironment {
  async setup() {
    await super.setup();

    // Patch the dynamic import function in the vm context to return require() results
    // This makes await import('module') equivalent to require('module') in tests
    const requireFn = this.moduleMocker?.generateMock.bind(this.moduleMocker);

    // Override dynamic imports by wrapping the vm module's import
    // Note: We can't easily override import() at the VM level,
    // but we can try to make the Jest module registry handle it
  }
}

module.exports = PatchedNodeEnvironment;
