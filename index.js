/*
Copyright (c) 2014, Yahoo! Inc. All rights reserved.
Copyrights licensed under the New BSD License.
See the accompanying LICENSE file for terms.
*/
try {
    module.exports = require('./build/intl-messageformat');
} catch (e) {
    throw new Error('Run `grunt build` to build `intl-message-format`.');
}
