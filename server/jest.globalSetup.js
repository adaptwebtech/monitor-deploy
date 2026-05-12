/**
 * Global setup that patches Node.js vm.SyntheticModule to allow
 * jest.spyOn to work with dynamic imports in Node.js 22+.
 *
 * The problem: Node.js 22's vm.SyntheticModule sets export properties
 * as non-configurable, preventing jest.spyOn from wrapping them.
 *
 * This patch cannot easily fix SyntheticModule since it's in native code.
 * Alternative: Use a jest resolver approach.
 */

module.exports = async function() {
  // nothing - the actual patch must happen in setupFilesAfterFramework (setupFilesAfterEach in Jest 30)
};
