/**
The MIT License (MIT)

Copyright (c) 2013 Yahoo! Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/
(function (root, factory) {

    var MessageFormat = factory();

    // register in -all- the module systems (at once)
    if (typeof define === 'function' && define.amd) {
        define(MessageFormat);
    }

    if (typeof module === 'object' && typeof module.exports === 'object') {
        module.exports = MessageFormat;
    }

    if (root) {
        root.IntlMessageFormat = MessageFormat;
    }

})(typeof global !== 'undefined' ? global : this, function() {

    "use strict";

    /**
     Creates MessageFormat object from a pattern, locale and field formatters.
     String patterns are broken down Arrays. Objects should match the
     following pattern:

     ```
     {
        type: 'plural|gender|select',
        valueName: 'string',
        offset: 1, // consistent offsets for plurals
        options: {}, // keys match options for plurals, gender and selects
        formatter: 'string|function' // strings are matched to internal formatters
     }
     ```

     @constructor

     @param {Array|String} pattern Array or string that serves as formatting pattern.
         Use array for plural and select messages, otherwise use string form.
     @param {LocaleList|String} locale Locale for string formatting
     @param {Object} optFieldFormatters Holds user defined formatters for each field (Dojo like).
     */
    function MessageFormat (pattern, locale, optFieldFormatters) {
        var chunks,
            len,
            i,
            p;


        // store locale
        this.locale = locale;



        // Assume the string passed in is a simple pattern for replacement.
        if (typeof pattern === 'string') {
            // break apart the string into chunks and tokens
            chunks = pattern.match(/((\$?\{)?[^\$\{\}]*\}?)/gi);

            // loop through each chunk and replace tokens when found
            for (i = 0, len = chunks.length; i < len; i++) {
                // create an object for the token when found
                if (/\$?\{(\w*):?(\w*)?\}/.test(chunks[i])) {

                    chunks[i] = {
                        // the valuename is the "key" for the token ... ${key}
                        valueName: chunks[i].match(/\$?\{(\w*):?(\w*)?\}/)[1],
                        formatter: chunks[i].match(/\$?\{(\w*):?(\w*)?\}/)[2],
                    };
                }
            }

            // our pattern should now be the chunked array
            pattern = chunks;
        }

        // save the pattern internally
        this.pattern = pattern;


        // store formatters
        this.formatters = {};

        if (optFieldFormatters) {
            for (p in optFieldFormatters) {
                if (optFieldFormatters.hasOwnProperty(p)) {
                    this.formatters[p] = optFieldFormatters[p];
                }
            }
        }
    }

    /**
     Formats pattern with supplied parameters.
     Dates, times and numbers are formatted in locale sensitive way.
     @param {Array|Object} params
     @return {String}
     */
    MessageFormat.prototype.format = function (obj) {

        var pattern = this.pattern,
            tokens,
            key,
            len,
            i;

        // the pattern we have is an array, we need to stitch it together
        // before moving forward
        if (Object.prototype.toString.call(pattern) === '[object Array]') {
            // let's not destroy the local pattern
            pattern = pattern.concat();

            // turn the array into a string
            pattern = this._processArray.call(this, pattern, obj);
        }

        // make sure we have a string
        pattern += '';

        // find tokens and replace with the object
        tokens = pattern.match(/\$?\{([^\} ]*)\}/g);

        // if there were any tokens found, we need to replace them with the
        if (tokens) {
            for (i = 0, len = tokens.length; i < len; i++) {
                // extract key out of ${key} or {key}
                key = tokens[i].charAt(0) === '$' ?
                        tokens[i].substr(2) :
                        tokens[i].substr(1);

                // remove trailing }
                key = key.substr(0, key.length - 1);

                // replace the token with obj[key]
                if (obj.hasOwnProperty(key)) {
                    pattern = pattern.replace(tokens[i], obj[key]);
                }
            }
        }


        return pattern;
    };

    /**
     Returns resolved options, in this case supported locale.
     @return {Object}
     */
    MessageFormat.prototype.resolvedOptions = function () {
        // TODO: Figure out what options should be returned for messages
        return {};
    };

    /**
     Normalizes the number to option values for plural identification
     @param {Number} count Number to normalize
     @return {String}
     */
    MessageFormat.prototype._normalizeCount = function (count) {
        // Prefer to use CLDR
        if (count === 0) {
            return 'zero';
        } else if (count === 1) {
            return 'one';
        } else if (count === 2) {
            return 'two';
        } else if (count < 7) {
            return 'few';
        } else if (count < 30) {
            return 'many';
        } else {
            return 'other';
        }
    };

    /**
     Processes an array to return a string back once it's located. Arrays are
     concatenated. Each item is also processed based on whether it is an
     object or an array.
     @param {Array} arr
     @param {Object} obj
     @return {String}
     */
    MessageFormat.prototype._processArray = function (arr, obj) {
        var str = '',
            valType,
            val,
            len,
            i;

        // parse through the array to get the appropriate string value for each index
        for (i = 0, len = arr.length; i < len; i++) {

            val = arr[i];

            // If we don't already have a string, let's try to make it one
            if (typeof val !== 'string') {
                while (typeof val !== 'string') {
                    // let's find out what we are working with in the loop
                    valType = {}.toString.call(val);

                    if (valType === '[object Array]') {
                        val = this._processArray.call(this, val, obj);
                    } else if (valType === '[object Object]') {
                        val = this._processObject.call(this, val, obj);
                    } else {
                        // not an array or object, let's cast it and move on
                        val += '';
                    }
                }
            }

            // concat our new value to the return string
            str += val;
        }

        return str;
    };


    /**
     Processes the Object based on the lookUp object. Each object should have
     a `valueName` property; this property is used to located the value in the
     lookUp object.

     If the lookUp object returns a string, it will be sandwiched between
     `obj.prefix` and `obj.postfix` if they exist.

     @param {Ojbect} obj
     @param {Object} lookUp
     @return {String|Array|Object}
     */
    MessageFormat.prototype._processObject = function (obj, lookUp) {
        var val = lookUp[obj.valueName],
            valName = val,
            valType,
            formatterFn;

        // our look up object isn't in the provided lookUp object
        if (typeof val === 'undefined' || val === null) {
            throw 'The valueName `' + obj.valueName + '` was not found.';
        }

        // if we are dealing with plurals and we have a number, we need to
        // normalize the number's value based on the locale
        if (obj.type === 'plural' && typeof val === 'number') {
            if (obj.offset) {
                val += obj.offset;
            }

            val = this._normalizeCount(val);
        }

        // if we have an options property, we need the value from this object
        // as it relates to our value
        if (obj.options) {
            // options should always fallback to an "other" option when not found
            val = obj.options[val] || obj.options.other;
        }

        valType = typeof val;

        // if we have a string or number to return, we need to sandwich it
        // with (pre|post)fix
        if (valType === 'string' || valType === 'number') {

            // strings should be checked for hash tokens
            if (valType === 'string') {
                // We need to make sure we aren't doing a context look up `${#}`
                val = val.replace('${#}', valName);
            }

            // process with a formatter if one exists
            if (obj.formatter) {
                formatterFn = {}.toString.call(obj.formatter) === '[object Function]' ? obj.formatter : this.formatters[obj.formatter];

                if (formatterFn) {
                    val = formatterFn.call(this, val, this.locale);
                }
            }

            // sandwich
            val = (obj.prefix || '') + val + (obj.postfix || '');
        }

        return val;
    };

    return MessageFormat;
});

