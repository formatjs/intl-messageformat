/*
Copyright (c) 2014, Yahoo! Inc. All rights reserved.
Copyrights licensed under the New BSD License.
See the accompanying LICENSE file for terms.
*/

import IntlMessageFormatCore from './core';
import IntlMessageFormatData from './locale-data';

/* global define:true module:true window: true */
if (typeof define === 'function' && define.amd) {
  define(function() { return IntlMessageFormatCore; });
} else if (typeof module !== 'undefined' && module.exports) {
  module.exports = IntlMessageFormatCore;
} else if (typeof this !== 'undefined') {
  this['IntlMessageFormat'] = IntlMessageFormatCore;
}
