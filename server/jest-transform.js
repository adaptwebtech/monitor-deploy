/**
 * Custom Jest transform that wraps ts-jest and additionally converts
 * dynamic import() calls to require() in the compiled CJS output.
 *
 * This is needed because Node.js 22+ makes dynamic import() of CJS modules
 * return non-configurable ESM namespace objects, which breaks jest.spyOn.
 *
 * By converting await import() to require(), we get the same configurable
 * CJS module that jest.spyOn can wrap.
 */

const { createTransformer } = require('ts-jest');

const tsJestTransformer = createTransformer({
  tsconfig: {
    module: 'CommonJS',
    moduleResolution: 'node',
    resolvePackageJsonExports: false,
  },
});

module.exports = {
  ...tsJestTransformer,
  process(sourceText, sourcePath, options) {
    const result = tsJestTransformer.process(sourceText, sourcePath, options);

    // After ts-jest compiles, ts already converts await import() to
    // Promise.resolve().then(() => require()) in CommonJS mode.
    // No additional transformation needed.

    return result;
  },
};
