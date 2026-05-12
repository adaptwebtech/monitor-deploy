// Patch the underlying jest-mock module to handle Module Namespace Objects
try {
  const jestMock = require('jest-mock');
  const originalSpyOn = jestMock.ModuleMocker.prototype.spyOn;

  jestMock.ModuleMocker.prototype.spyOn = function patchedSpyOn(
    object: any,
    methodName: any,
    ...args: any[]
  ) {
    const isNamespace =
      object != null &&
      typeof object === 'object' &&
      object[Symbol.toStringTag] === 'Module';

    if (isNamespace) {
      const originalFn = object[methodName];
      if (typeof originalFn === 'function') {
        const moduleCache = (require as any).cache || {};
        for (const modulePath of Object.keys(moduleCache)) {
          const cached = moduleCache[modulePath];
          if (!cached?.exports) continue;
          const exports = cached.exports;
          if (
            typeof exports === 'object' &&
            exports !== null &&
            exports[methodName] === originalFn
          ) {
            return originalSpyOn.call(this, exports, methodName, ...args);
          }
        }
      }
    }

    return originalSpyOn.call(this, object, methodName, ...args);
  };

  console.log('jest-mock patched successfully');
} catch (e) {
  console.error('Failed to patch jest-mock:', e);
}
