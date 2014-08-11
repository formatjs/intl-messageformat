'use strict';

var m = require('./lib/full.js');

// Provide an idiomatic API for the Node.js version of this package.
exports = module.exports = m.default;
// Preserve the original API in case another package relies on `default`.
Object.defineProperty(exports, 'default', {value: m.default});
