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
