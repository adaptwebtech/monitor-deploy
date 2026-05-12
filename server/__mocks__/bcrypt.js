// Proxy for bcrypt that ensures all exports are configurable/writable
// This allows jest.spyOn to work when tests use await import('bcrypt')
// in Node.js 22+ where dynamic imports of CJS modules return non-configurable namespaces

const real = jest.requireActual('bcrypt');

// Export each function directly as a mutable property
// When Jest wraps this CJS module as an ESM namespace, named exports should be available
module.exports.genSaltSync = real.genSaltSync;
module.exports.genSalt = real.genSalt;
module.exports.hashSync = real.hashSync;
module.exports.hash = real.hash;
module.exports.compareSync = real.compareSync;
module.exports.compare = real.compare;
module.exports.getRounds = real.getRounds;
