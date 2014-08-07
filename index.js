var m = require('./lib/src/full.js');

// providing an idiomatic api for the nodejs version of this module
module.exports = exports = m.default;
// preserving the original api in case another module is relying on that
exports.default = m.default;
