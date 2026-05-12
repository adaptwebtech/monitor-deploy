// Proxy for bcrypt that ensures all exports are configurable/writable
// This allows jest.spyOn to work when tests use await import('bcrypt')
import * as realBcrypt from 'bcrypt';

// Re-export all bcrypt functions as plain object properties
// so they remain configurable (not frozen like ESM namespace objects)
export const genSaltSync = realBcrypt.genSaltSync;
export const genSalt = realBcrypt.genSalt;
export const hashSync = realBcrypt.hashSync;
export const hash = realBcrypt.hash;
export const compareSync = realBcrypt.compareSync;
export const compare = realBcrypt.compare;
export const getRounds = realBcrypt.getRounds;
