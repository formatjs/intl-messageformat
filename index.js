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

    var DEFAULT_LOCALE = (typeof Intl === 'object') && (typeof Intl.DefaultLocale === 'function') ? Intl.DefaultLocale() : 'en',
        // Cached pluralization logic.
        // Use `npm run replural` to rebuild this data (at end of this file).
        _pluralizeFunctions = [],
        _pluralizeLocales = {};

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

     @param {LocaleList|String} locale Locale for string formatting
     @param {Array|String} pattern Array or string that serves as formatting pattern.
         Use array for plural and select messages, otherwise use string form.
     @param {Object} optFieldFormatters Holds user defined formatters for each field (Dojo like).
     */
    function MessageFormat (locale, pattern, optFieldFormatters) {
        var chunks,
            len,
            i,
            p;


        // store locale
        this.locale = locale;

        // We calculate the pluralization function used for the specific locale.
        // Since this is a bit expensive (if repeated too much) and since the
        // locale can change on us without notice, we need to keep track of
        // which locale was used in choosing the pluralization function.
        // (It's expected that the locale will change very infrequently for
        // each MessageFormat object.)
        this._pluralLocale = undefined;
        this._pluralFunc = undefined;

        // store munged locale used by the pluralization data (used by _normalizeCount).
        // This is necessary because of implementation details of the `cldr` NPM package.
        this.pluralizeLocale = locale ? locale.toLowerCase().replace(/-/g, '_') : locale;


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
        var locale = this.locale || DEFAULT_LOCALE,
            fn,
            parts;
        // cache the choice of pluralization function
        if (this._pluralLocale !== locale) {
            if (locale !== DEFAULT_LOCALE) {
                parts = this.locale.toLowerCase().split('-');
                while (parts.length) {
                    fn = _pluralizeLocales[parts.join('_')];
                    if (fn) {
                        break;
                    }
                    parts.pop();
                }
            }
            if (!fn) {
                // While this seems excessive, it's possible the user has a
                // complex default locale (such as "zh-hans-CN") since the
                // default locale can come from a browser setting.
                parts = DEFAULT_LOCALE.toLowerCase().split('-');
                while (parts.length) {
                    fn = _pluralizeLocales[parts.join('_')];
                    if (fn) {
                        break;
                    }
                    parts.pop();
                }
            }
            if (!fn) {
                fn = _pluralizeLocales.en;
            }
            this._pluralLocal = locale;
            this._pluralFunc = fn;
        }
        return this._pluralFunc(count) || 'other';
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
            formatterFn;

        // our look up object isn't in the provided lookUp object
        if (!val) {
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

        // if we have a string to return, we need to sandwich it with (pre|post)fix
        if (typeof val === 'string') {
            // We need to make sure we aren't doing a context look up `${#}`
            val = val.replace('${#}', valName);

            // process with a formatter if one exists
            if (obj.formatter) {
                formatterFn = {}.toString.call(obj.formatter) === '[object Function]' ? obj.formatter : this.formatters[obj.formatter];

                if (formatterFn) {
                    val = formatterFn.call(this, this.locale, val);
                }
            }

            // sandwich
            val = (obj.prefix || '') + val + (obj.postfix || '');
        }

        return val;
    };

    ///-------GENERATED PLURALIZATION BEGIN (prefix=_pluralize&indent=4)
    _pluralizeFunctions = [
        function (n) {},
        function (n) { if(typeof n==="string")n=parseInt(n,10);if(n===1)return"one";return"other"; },
        function (n) { if(typeof n==="string")n=parseInt(n,10);if(n>=0&&n<=1)return"one";return"other"; },
        function (n) { var i=Math.floor(Math.abs(n));if(typeof n==="string")n=parseInt(n,10);if(i===0||n===1)return"one";return"other"; },
        function (n) { if(typeof n==="string")n=parseInt(n,10);if(n===0)return"zero";if(n===1)return"one";if(n===2)return"two";if(n%100>=3&&n%100<=10)return"few";if(n%100>=11&&n%100<=99)return"many";return"other"; },
        function (n) { if(typeof n==="string")n=parseInt(n,10);if(n%10===1&&(n%100!==11))return"one";if(n%10>=2&&n%10<=4&&!(n%100>=12&&n%100<=14))return"few";if(n%10===0||n%10>=5&&n%10<=9||n%100>=11&&n%100<=14)return"many";return"other"; },
        function (n) { return"other"; },
        function (n) { if(typeof n==="string")n=parseInt(n,10);if(n%10===1&&!(n%100===11||n%100===71||n%100===91))return"one";if(n%10===2&&!(n%100===12||n%100===72||n%100===92))return"two";if((n%10>=3&&n%10<=4||n%10===9)&&!(n%100>=10&&n%100<=19||n%100>=70&&n%100<=79||n%100>=90&&n%100<=99))return"few";if((n!==0)&&n%1e6===0)return"many";return"other"; },
        function (n) { var i=Math.floor(Math.abs(n)),v=n.toString().replace(/^[^.]*\.?/,"").length,f=parseInt(n.toString().replace(/^[^.]*\.?/,""),10);if(typeof n==="string")n=parseInt(n,10);if(v===0&&i%10===1&&((i%100!==11)||f%10===1&&(f%100!==11)))return"one";if(v===0&&i%10>=2&&i%10<=4&&(!(i%100>=12&&i%100<=14)||f%10>=2&&f%10<=4&&!(f%100>=12&&f%100<=14)))return"few";return"other"; },
        function (n) { var i=Math.floor(Math.abs(n)),v=n.toString().replace(/^[^.]*\.?/,"").length;if(typeof n==="string")n=parseInt(n,10);if(i===1&&v===0)return"one";return"other"; },
        function (n) { var i=Math.floor(Math.abs(n)),v=n.toString().replace(/^[^.]*\.?/,"").length;if(typeof n==="string")n=parseInt(n,10);if(i===1&&v===0)return"one";if(i>=2&&i<=4&&v===0)return"few";if((v!==0))return"many";return"other"; },
        function (n) { if(typeof n==="string")n=parseInt(n,10);if(n===0)return"zero";if(n===1)return"one";if(n===2)return"two";if(n===3)return"few";if(n===6)return"many";return"other"; },
        function (n) { var i=Math.floor(Math.abs(n)),t=parseInt(n.toString().replace(/^[^.]*\.?|0+$/g,""),10);if(typeof n==="string")n=parseInt(n,10);if(n===1||(t!==0)&&(i===0||i===1))return"one";return"other"; },
        function (n) { var i=Math.floor(Math.abs(n));if(typeof n==="string")n=parseInt(n,10);if(i===0||i===1)return"one";return"other"; },
        function (n) { var i=Math.floor(Math.abs(n)),v=n.toString().replace(/^[^.]*\.?/,"").length;if(typeof n==="string")n=parseInt(n,10);if(i>=0&&i<=1&&v===0)return"one";return"other"; },
        function (n) { if(typeof n==="string")n=parseInt(n,10);if(n===1)return"one";if(n===2)return"two";if(n>=3&&n<=6)return"few";if(n>=7&&n<=10)return"many";return"other"; },
        function (n) { if(typeof n==="string")n=parseInt(n,10);if(n===1||n===11)return"one";if(n===2||n===12)return"two";if(n>=3&&n<=10||n>=13&&n<=19)return"few";return"other"; },
        function (n) { if(typeof n==="string")n=parseInt(n,10);if(n%10===1)return"one";if(n%10===2)return"two";if(n%100===0||n%100===20||n%100===40||n%100===60)return"few";return"other"; },
        function (n) { var i=Math.floor(Math.abs(n)),v=n.toString().replace(/^[^.]*\.?/,"").length;if(typeof n==="string")n=parseInt(n,10);if(i===1&&v===0)return"one";if(i===2&&v===0)return"two";if(v===0&&!(n>=0&&n<=10)&&n%10===0)return"many";return"other"; },
        function (n) { var i=Math.floor(Math.abs(n)),t=parseInt(n.toString().replace(/^[^.]*\.?|0+$/g,""),10);if(typeof n==="string")n=parseInt(n,10);if(t===0&&i%10===1&&((i%100!==11)||(t!==0)))return"one";return"other"; },
        function (n) { if(typeof n==="string")n=parseInt(n,10);if(n===0)return"zero";if(n===1)return"one";return"other"; },
        function (n) { if(typeof n==="string")n=parseInt(n,10);if(n===1)return"one";if(n===2)return"two";return"other"; },
        function (n) { var i=Math.floor(Math.abs(n));if(typeof n==="string")n=parseInt(n,10);if(n===0)return"zero";if((i===0||i===1)&&(n!==0))return"one";return"other"; },
        function (n) { var f=parseInt(n.toString().replace(/^[^.]*\.?/,""),10);if(typeof n==="string")n=parseInt(n,10);if(n%10===1&&!(n%100>=11&&n%100<=19))return"one";if(n%10>=2&&n%10<=9&&!(n%100>=11&&n%100<=19))return"few";if((f!==0))return"many";return"other"; },
        function (n) { var v=n.toString().replace(/^[^.]*\.?/,"").length,f=parseInt(n.toString().replace(/^[^.]*\.?/,""),10);if(typeof n==="string")n=parseInt(n,10);if(n%10===0||n%100>=11&&n%100<=19||v===2&&f%100>=11&&f%100<=19)return"zero";if(n%10===1&&((n%100!==11)||v===2&&f%10===1&&((f%100!==11)||(v!==2)&&f%10===1)))return"one";return"other"; },
        function (n) { var i=Math.floor(Math.abs(n)),v=n.toString().replace(/^[^.]*\.?/,"").length,f=parseInt(n.toString().replace(/^[^.]*\.?/,""),10);if(typeof n==="string")n=parseInt(n,10);if(v===0&&(i%10===1||f%10===1))return"one";return"other"; },
        function (n) { if(typeof n==="string")n=parseInt(n,10);if(n===1)return"one";if(n===0||n%100>=2&&n%100<=10)return"few";if(n%100>=11&&n%100<=19)return"many";return"other"; },
        function (n) { var i=Math.floor(Math.abs(n)),v=n.toString().replace(/^[^.]*\.?/,"").length;if(typeof n==="string")n=parseInt(n,10);if(i===1&&v===0)return"one";if(v===0&&i%10>=2&&i%10<=4&&!(i%100>=12&&i%100<=14))return"few";if(v===0&&(i!==1)&&(i%10>=0&&i%10<=1||v===0&&(i%10>=5&&i%10<=9||v===0&&i%100>=12&&i%100<=14)))return"many";return"other"; },
        function (n) { var i=Math.floor(Math.abs(n)),v=n.toString().replace(/^[^.]*\.?/,"").length,t=parseInt(n.toString().replace(/^[^.]*\.?|0+$/g,""),10);if(typeof n==="string")n=parseInt(n,10);if(i===1&&(v===0||i===0&&t===1))return"one";return"other"; },
        function (n) { var i=Math.floor(Math.abs(n)),v=n.toString().replace(/^[^.]*\.?/,"").length;if(typeof n==="string")n=parseInt(n,10);if(i===1&&v===0)return"one";if((v!==0)||n===0||(n!==1)&&n%100>=1&&n%100<=19)return"few";return"other"; },
        function (n) { var i=Math.floor(Math.abs(n)),v=n.toString().replace(/^[^.]*\.?/,"").length;if(typeof n==="string")n=parseInt(n,10);if(v===0&&i%10===1&&(i%100!==11))return"one";if(v===0&&(i%10===0||v===0&&(i%10>=5&&i%10<=9||v===0&&i%100>=11&&i%100<=14)))return"many";return"other"; },
        function (n) { var i=Math.floor(Math.abs(n));if(typeof n==="string")n=parseInt(n,10);if(i===0||n===1)return"one";if(n>=2&&n<=10)return"few";return"other"; },
        function (n) { var i=Math.floor(Math.abs(n)),f=parseInt(n.toString().replace(/^[^.]*\.?/,""),10);if(typeof n==="string")n=parseInt(n,10);if(n===0||n===1||i===0&&f===1)return"one";return"other"; },
        function (n) { var i=Math.floor(Math.abs(n)),v=n.toString().replace(/^[^.]*\.?/,"").length;if(typeof n==="string")n=parseInt(n,10);if(v===0&&i%100===1)return"one";if(v===0&&i%100===2)return"two";if(v===0&&(i%100>=3&&i%100<=4||(v!==0)))return"few";return"other"; },
        function (n) { if(typeof n==="string")n=parseInt(n,10);if(n>=0&&n<=1||n>=11&&n<=99)return"one";return"other"; },
        function (n) { var i=Math.floor(Math.abs(n)),v=n.toString().replace(/^[^.]*\.?/,"").length;if(typeof n==="string")n=parseInt(n,10);if(v===0&&i%10===1&&(i%100!==11))return"one";if(v===0&&i%10>=2&&i%10<=4&&!(i%100>=12&&i%100<=14))return"few";if(v===0&&(i%10===0||v===0&&(i%10>=5&&i%10<=9||v===0&&i%100>=11&&i%100<=14)))return"many";return"other"; }
    ];
    _pluralizeLocales = {
        "aa": _pluralizeFunctions[0],
        "aa_dj": _pluralizeFunctions[0],
        "aa_er": _pluralizeFunctions[0],
        "aa_et": _pluralizeFunctions[0],
        "af": _pluralizeFunctions[1],
        "af_na": _pluralizeFunctions[1],
        "af_za": _pluralizeFunctions[1],
        "agq": _pluralizeFunctions[0],
        "agq_cm": _pluralizeFunctions[0],
        "ak": _pluralizeFunctions[2],
        "ak_gh": _pluralizeFunctions[2],
        "am": _pluralizeFunctions[3],
        "am_et": _pluralizeFunctions[3],
        "ar": _pluralizeFunctions[4],
        "ar_001": _pluralizeFunctions[4],
        "ar_ae": _pluralizeFunctions[4],
        "ar_bh": _pluralizeFunctions[4],
        "ar_dj": _pluralizeFunctions[4],
        "ar_dz": _pluralizeFunctions[4],
        "ar_eg": _pluralizeFunctions[4],
        "ar_eh": _pluralizeFunctions[4],
        "ar_er": _pluralizeFunctions[4],
        "ar_il": _pluralizeFunctions[4],
        "ar_iq": _pluralizeFunctions[4],
        "ar_jo": _pluralizeFunctions[4],
        "ar_km": _pluralizeFunctions[4],
        "ar_kw": _pluralizeFunctions[4],
        "ar_lb": _pluralizeFunctions[4],
        "ar_ly": _pluralizeFunctions[4],
        "ar_ma": _pluralizeFunctions[4],
        "ar_mr": _pluralizeFunctions[4],
        "ar_om": _pluralizeFunctions[4],
        "ar_ps": _pluralizeFunctions[4],
        "ar_qa": _pluralizeFunctions[4],
        "ar_sa": _pluralizeFunctions[4],
        "ar_sd": _pluralizeFunctions[4],
        "ar_so": _pluralizeFunctions[4],
        "ar_ss": _pluralizeFunctions[4],
        "ar_sy": _pluralizeFunctions[4],
        "ar_td": _pluralizeFunctions[4],
        "ar_tn": _pluralizeFunctions[4],
        "ar_ye": _pluralizeFunctions[4],
        "as": _pluralizeFunctions[0],
        "as_in": _pluralizeFunctions[0],
        "asa": _pluralizeFunctions[1],
        "asa_tz": _pluralizeFunctions[1],
        "ast": _pluralizeFunctions[1],
        "ast_es": _pluralizeFunctions[1],
        "az": _pluralizeFunctions[1],
        "az_cyrl": _pluralizeFunctions[1],
        "az_cyrl_az": _pluralizeFunctions[1],
        "az_latn": _pluralizeFunctions[1],
        "az_latn_az": _pluralizeFunctions[1],
        "bas": _pluralizeFunctions[0],
        "bas_cm": _pluralizeFunctions[0],
        "be": _pluralizeFunctions[5],
        "be_by": _pluralizeFunctions[5],
        "bem": _pluralizeFunctions[1],
        "bem_zm": _pluralizeFunctions[1],
        "bez": _pluralizeFunctions[1],
        "bez_tz": _pluralizeFunctions[1],
        "bg": _pluralizeFunctions[1],
        "bg_bg": _pluralizeFunctions[1],
        "bm": _pluralizeFunctions[6],
        "bm_ml": _pluralizeFunctions[6],
        "bn": _pluralizeFunctions[3],
        "bn_bd": _pluralizeFunctions[3],
        "bn_in": _pluralizeFunctions[3],
        "bo": _pluralizeFunctions[6],
        "bo_cn": _pluralizeFunctions[6],
        "bo_in": _pluralizeFunctions[6],
        "br": _pluralizeFunctions[7],
        "br_fr": _pluralizeFunctions[7],
        "brx": _pluralizeFunctions[1],
        "brx_in": _pluralizeFunctions[1],
        "bs": _pluralizeFunctions[8],
        "bs_cyrl": _pluralizeFunctions[8],
        "bs_cyrl_ba": _pluralizeFunctions[8],
        "bs_latn": _pluralizeFunctions[8],
        "bs_latn_ba": _pluralizeFunctions[8],
        "byn": _pluralizeFunctions[0],
        "byn_er": _pluralizeFunctions[0],
        "ca": _pluralizeFunctions[9],
        "ca_ad": _pluralizeFunctions[9],
        "ca_es": _pluralizeFunctions[9],
        "ca_fr": _pluralizeFunctions[9],
        "ca_it": _pluralizeFunctions[9],
        "cgg": _pluralizeFunctions[1],
        "cgg_ug": _pluralizeFunctions[1],
        "chr": _pluralizeFunctions[1],
        "chr_us": _pluralizeFunctions[1],
        "cs": _pluralizeFunctions[10],
        "cs_cz": _pluralizeFunctions[10],
        "cy": _pluralizeFunctions[11],
        "cy_gb": _pluralizeFunctions[11],
        "da": _pluralizeFunctions[12],
        "da_dk": _pluralizeFunctions[12],
        "da_gl": _pluralizeFunctions[12],
        "dav": _pluralizeFunctions[0],
        "dav_ke": _pluralizeFunctions[0],
        "de": _pluralizeFunctions[9],
        "de_at": _pluralizeFunctions[9],
        "de_be": _pluralizeFunctions[9],
        "de_ch": _pluralizeFunctions[9],
        "de_de": _pluralizeFunctions[9],
        "de_li": _pluralizeFunctions[9],
        "de_lu": _pluralizeFunctions[9],
        "dje": _pluralizeFunctions[0],
        "dje_ne": _pluralizeFunctions[0],
        "dua": _pluralizeFunctions[0],
        "dua_cm": _pluralizeFunctions[0],
        "dyo": _pluralizeFunctions[0],
        "dyo_sn": _pluralizeFunctions[0],
        "dz": _pluralizeFunctions[6],
        "dz_bt": _pluralizeFunctions[6],
        "ebu": _pluralizeFunctions[0],
        "ebu_ke": _pluralizeFunctions[0],
        "ee": _pluralizeFunctions[1],
        "ee_gh": _pluralizeFunctions[1],
        "ee_tg": _pluralizeFunctions[1],
        "el": _pluralizeFunctions[1],
        "el_cy": _pluralizeFunctions[1],
        "el_gr": _pluralizeFunctions[1],
        "en": _pluralizeFunctions[9],
        "en_001": _pluralizeFunctions[9],
        "en_150": _pluralizeFunctions[9],
        "en_ag": _pluralizeFunctions[9],
        "en_ai": _pluralizeFunctions[9],
        "en_as": _pluralizeFunctions[9],
        "en_au": _pluralizeFunctions[9],
        "en_bb": _pluralizeFunctions[9],
        "en_be": _pluralizeFunctions[9],
        "en_bm": _pluralizeFunctions[9],
        "en_bs": _pluralizeFunctions[9],
        "en_bw": _pluralizeFunctions[9],
        "en_bz": _pluralizeFunctions[9],
        "en_ca": _pluralizeFunctions[9],
        "en_cc": _pluralizeFunctions[9],
        "en_ck": _pluralizeFunctions[9],
        "en_cm": _pluralizeFunctions[9],
        "en_cx": _pluralizeFunctions[9],
        "en_dg": _pluralizeFunctions[9],
        "en_dm": _pluralizeFunctions[9],
        "en_dsrt": _pluralizeFunctions[9],
        "en_dsrt_us": _pluralizeFunctions[9],
        "en_er": _pluralizeFunctions[9],
        "en_fj": _pluralizeFunctions[9],
        "en_fk": _pluralizeFunctions[9],
        "en_fm": _pluralizeFunctions[9],
        "en_gb": _pluralizeFunctions[9],
        "en_gd": _pluralizeFunctions[9],
        "en_gg": _pluralizeFunctions[9],
        "en_gh": _pluralizeFunctions[9],
        "en_gi": _pluralizeFunctions[9],
        "en_gm": _pluralizeFunctions[9],
        "en_gu": _pluralizeFunctions[9],
        "en_gy": _pluralizeFunctions[9],
        "en_hk": _pluralizeFunctions[9],
        "en_ie": _pluralizeFunctions[9],
        "en_im": _pluralizeFunctions[9],
        "en_in": _pluralizeFunctions[9],
        "en_io": _pluralizeFunctions[9],
        "en_je": _pluralizeFunctions[9],
        "en_jm": _pluralizeFunctions[9],
        "en_ke": _pluralizeFunctions[9],
        "en_ki": _pluralizeFunctions[9],
        "en_kn": _pluralizeFunctions[9],
        "en_ky": _pluralizeFunctions[9],
        "en_lc": _pluralizeFunctions[9],
        "en_lr": _pluralizeFunctions[9],
        "en_ls": _pluralizeFunctions[9],
        "en_mg": _pluralizeFunctions[9],
        "en_mh": _pluralizeFunctions[9],
        "en_mo": _pluralizeFunctions[9],
        "en_mp": _pluralizeFunctions[9],
        "en_ms": _pluralizeFunctions[9],
        "en_mt": _pluralizeFunctions[9],
        "en_mu": _pluralizeFunctions[9],
        "en_mw": _pluralizeFunctions[9],
        "en_na": _pluralizeFunctions[9],
        "en_nf": _pluralizeFunctions[9],
        "en_ng": _pluralizeFunctions[9],
        "en_nr": _pluralizeFunctions[9],
        "en_nu": _pluralizeFunctions[9],
        "en_nz": _pluralizeFunctions[9],
        "en_pg": _pluralizeFunctions[9],
        "en_ph": _pluralizeFunctions[9],
        "en_pk": _pluralizeFunctions[9],
        "en_pn": _pluralizeFunctions[9],
        "en_pr": _pluralizeFunctions[9],
        "en_pw": _pluralizeFunctions[9],
        "en_rw": _pluralizeFunctions[9],
        "en_sb": _pluralizeFunctions[9],
        "en_sc": _pluralizeFunctions[9],
        "en_sd": _pluralizeFunctions[9],
        "en_sg": _pluralizeFunctions[9],
        "en_sh": _pluralizeFunctions[9],
        "en_sl": _pluralizeFunctions[9],
        "en_ss": _pluralizeFunctions[9],
        "en_sx": _pluralizeFunctions[9],
        "en_sz": _pluralizeFunctions[9],
        "en_tc": _pluralizeFunctions[9],
        "en_tk": _pluralizeFunctions[9],
        "en_to": _pluralizeFunctions[9],
        "en_tt": _pluralizeFunctions[9],
        "en_tv": _pluralizeFunctions[9],
        "en_tz": _pluralizeFunctions[9],
        "en_ug": _pluralizeFunctions[9],
        "en_um": _pluralizeFunctions[9],
        "en_us": _pluralizeFunctions[9],
        "en_us_posix": _pluralizeFunctions[9],
        "en_vc": _pluralizeFunctions[9],
        "en_vg": _pluralizeFunctions[9],
        "en_vi": _pluralizeFunctions[9],
        "en_vu": _pluralizeFunctions[9],
        "en_ws": _pluralizeFunctions[9],
        "en_za": _pluralizeFunctions[9],
        "en_zm": _pluralizeFunctions[9],
        "en_zw": _pluralizeFunctions[9],
        "eo": _pluralizeFunctions[1],
        "eo_001": _pluralizeFunctions[1],
        "es": _pluralizeFunctions[1],
        "es_419": _pluralizeFunctions[1],
        "es_ar": _pluralizeFunctions[1],
        "es_bo": _pluralizeFunctions[1],
        "es_cl": _pluralizeFunctions[1],
        "es_co": _pluralizeFunctions[1],
        "es_cr": _pluralizeFunctions[1],
        "es_cu": _pluralizeFunctions[1],
        "es_do": _pluralizeFunctions[1],
        "es_ea": _pluralizeFunctions[1],
        "es_ec": _pluralizeFunctions[1],
        "es_es": _pluralizeFunctions[1],
        "es_gq": _pluralizeFunctions[1],
        "es_gt": _pluralizeFunctions[1],
        "es_hn": _pluralizeFunctions[1],
        "es_ic": _pluralizeFunctions[1],
        "es_mx": _pluralizeFunctions[1],
        "es_ni": _pluralizeFunctions[1],
        "es_pa": _pluralizeFunctions[1],
        "es_pe": _pluralizeFunctions[1],
        "es_ph": _pluralizeFunctions[1],
        "es_pr": _pluralizeFunctions[1],
        "es_py": _pluralizeFunctions[1],
        "es_sv": _pluralizeFunctions[1],
        "es_us": _pluralizeFunctions[1],
        "es_uy": _pluralizeFunctions[1],
        "es_ve": _pluralizeFunctions[1],
        "et": _pluralizeFunctions[9],
        "et_ee": _pluralizeFunctions[9],
        "eu": _pluralizeFunctions[1],
        "eu_es": _pluralizeFunctions[1],
        "ewo": _pluralizeFunctions[0],
        "ewo_cm": _pluralizeFunctions[0],
        "fa": _pluralizeFunctions[3],
        "fa_af": _pluralizeFunctions[3],
        "fa_ir": _pluralizeFunctions[3],
        "ff": _pluralizeFunctions[13],
        "ff_sn": _pluralizeFunctions[13],
        "fi": _pluralizeFunctions[14],
        "fi_fi": _pluralizeFunctions[14],
        "fil": _pluralizeFunctions[14],
        "fil_ph": _pluralizeFunctions[14],
        "fo": _pluralizeFunctions[1],
        "fo_fo": _pluralizeFunctions[1],
        "fr": _pluralizeFunctions[13],
        "fr_be": _pluralizeFunctions[13],
        "fr_bf": _pluralizeFunctions[13],
        "fr_bi": _pluralizeFunctions[13],
        "fr_bj": _pluralizeFunctions[13],
        "fr_bl": _pluralizeFunctions[13],
        "fr_ca": _pluralizeFunctions[13],
        "fr_cd": _pluralizeFunctions[13],
        "fr_cf": _pluralizeFunctions[13],
        "fr_cg": _pluralizeFunctions[13],
        "fr_ch": _pluralizeFunctions[13],
        "fr_ci": _pluralizeFunctions[13],
        "fr_cm": _pluralizeFunctions[13],
        "fr_dj": _pluralizeFunctions[13],
        "fr_dz": _pluralizeFunctions[13],
        "fr_fr": _pluralizeFunctions[13],
        "fr_ga": _pluralizeFunctions[13],
        "fr_gf": _pluralizeFunctions[13],
        "fr_gn": _pluralizeFunctions[13],
        "fr_gp": _pluralizeFunctions[13],
        "fr_gq": _pluralizeFunctions[13],
        "fr_ht": _pluralizeFunctions[13],
        "fr_km": _pluralizeFunctions[13],
        "fr_lu": _pluralizeFunctions[13],
        "fr_ma": _pluralizeFunctions[13],
        "fr_mc": _pluralizeFunctions[13],
        "fr_mf": _pluralizeFunctions[13],
        "fr_mg": _pluralizeFunctions[13],
        "fr_ml": _pluralizeFunctions[13],
        "fr_mq": _pluralizeFunctions[13],
        "fr_mr": _pluralizeFunctions[13],
        "fr_mu": _pluralizeFunctions[13],
        "fr_nc": _pluralizeFunctions[13],
        "fr_ne": _pluralizeFunctions[13],
        "fr_pf": _pluralizeFunctions[13],
        "fr_pm": _pluralizeFunctions[13],
        "fr_re": _pluralizeFunctions[13],
        "fr_rw": _pluralizeFunctions[13],
        "fr_sc": _pluralizeFunctions[13],
        "fr_sn": _pluralizeFunctions[13],
        "fr_sy": _pluralizeFunctions[13],
        "fr_td": _pluralizeFunctions[13],
        "fr_tg": _pluralizeFunctions[13],
        "fr_tn": _pluralizeFunctions[13],
        "fr_vu": _pluralizeFunctions[13],
        "fr_wf": _pluralizeFunctions[13],
        "fr_yt": _pluralizeFunctions[13],
        "fur": _pluralizeFunctions[1],
        "fur_it": _pluralizeFunctions[1],
        "ga": _pluralizeFunctions[15],
        "ga_ie": _pluralizeFunctions[15],
        "gd": _pluralizeFunctions[16],
        "gd_gb": _pluralizeFunctions[16],
        "gl": _pluralizeFunctions[9],
        "gl_es": _pluralizeFunctions[9],
        "gsw": _pluralizeFunctions[1],
        "gsw_ch": _pluralizeFunctions[1],
        "gsw_li": _pluralizeFunctions[1],
        "gu": _pluralizeFunctions[3],
        "gu_in": _pluralizeFunctions[3],
        "guz": _pluralizeFunctions[0],
        "guz_ke": _pluralizeFunctions[0],
        "gv": _pluralizeFunctions[17],
        "gv_im": _pluralizeFunctions[17],
        "ha": _pluralizeFunctions[1],
        "ha_latn": _pluralizeFunctions[1],
        "ha_latn_gh": _pluralizeFunctions[1],
        "ha_latn_ne": _pluralizeFunctions[1],
        "ha_latn_ng": _pluralizeFunctions[1],
        "haw": _pluralizeFunctions[1],
        "haw_us": _pluralizeFunctions[1],
        "he": _pluralizeFunctions[18],
        "he_il": _pluralizeFunctions[18],
        "hi": _pluralizeFunctions[3],
        "hi_in": _pluralizeFunctions[3],
        "hr": _pluralizeFunctions[8],
        "hr_ba": _pluralizeFunctions[8],
        "hr_hr": _pluralizeFunctions[8],
        "hu": _pluralizeFunctions[1],
        "hu_hu": _pluralizeFunctions[1],
        "hy": _pluralizeFunctions[13],
        "hy_am": _pluralizeFunctions[13],
        "ia": _pluralizeFunctions[0],
        "ia_fr": _pluralizeFunctions[0],
        "id": _pluralizeFunctions[6],
        "id_id": _pluralizeFunctions[6],
        "ig": _pluralizeFunctions[6],
        "ig_ng": _pluralizeFunctions[6],
        "ii": _pluralizeFunctions[6],
        "ii_cn": _pluralizeFunctions[6],
        "is": _pluralizeFunctions[19],
        "is_is": _pluralizeFunctions[19],
        "it": _pluralizeFunctions[9],
        "it_ch": _pluralizeFunctions[9],
        "it_it": _pluralizeFunctions[9],
        "it_sm": _pluralizeFunctions[9],
        "ja": _pluralizeFunctions[6],
        "ja_jp": _pluralizeFunctions[6],
        "jgo": _pluralizeFunctions[1],
        "jgo_cm": _pluralizeFunctions[1],
        "jmc": _pluralizeFunctions[1],
        "jmc_tz": _pluralizeFunctions[1],
        "ka": _pluralizeFunctions[1],
        "ka_ge": _pluralizeFunctions[1],
        "kab": _pluralizeFunctions[13],
        "kab_dz": _pluralizeFunctions[13],
        "kam": _pluralizeFunctions[0],
        "kam_ke": _pluralizeFunctions[0],
        "kde": _pluralizeFunctions[6],
        "kde_tz": _pluralizeFunctions[6],
        "kea": _pluralizeFunctions[6],
        "kea_cv": _pluralizeFunctions[6],
        "khq": _pluralizeFunctions[0],
        "khq_ml": _pluralizeFunctions[0],
        "ki": _pluralizeFunctions[0],
        "ki_ke": _pluralizeFunctions[0],
        "kk": _pluralizeFunctions[1],
        "kk_cyrl": _pluralizeFunctions[1],
        "kk_cyrl_kz": _pluralizeFunctions[1],
        "kkj": _pluralizeFunctions[1],
        "kkj_cm": _pluralizeFunctions[1],
        "kl": _pluralizeFunctions[1],
        "kl_gl": _pluralizeFunctions[1],
        "kln": _pluralizeFunctions[0],
        "kln_ke": _pluralizeFunctions[0],
        "km": _pluralizeFunctions[6],
        "km_kh": _pluralizeFunctions[6],
        "kn": _pluralizeFunctions[3],
        "kn_in": _pluralizeFunctions[3],
        "ko": _pluralizeFunctions[6],
        "ko_kp": _pluralizeFunctions[6],
        "ko_kr": _pluralizeFunctions[6],
        "kok": _pluralizeFunctions[0],
        "kok_in": _pluralizeFunctions[0],
        "ks": _pluralizeFunctions[1],
        "ks_arab": _pluralizeFunctions[1],
        "ks_arab_in": _pluralizeFunctions[1],
        "ksb": _pluralizeFunctions[1],
        "ksb_tz": _pluralizeFunctions[1],
        "ksf": _pluralizeFunctions[0],
        "ksf_cm": _pluralizeFunctions[0],
        "ksh": _pluralizeFunctions[20],
        "ksh_de": _pluralizeFunctions[20],
        "kw": _pluralizeFunctions[21],
        "kw_gb": _pluralizeFunctions[21],
        "ky": _pluralizeFunctions[1],
        "ky_cyrl": _pluralizeFunctions[1],
        "ky_cyrl_kg": _pluralizeFunctions[1],
        "lag": _pluralizeFunctions[22],
        "lag_tz": _pluralizeFunctions[22],
        "lg": _pluralizeFunctions[1],
        "lg_ug": _pluralizeFunctions[1],
        "lkt": _pluralizeFunctions[6],
        "lkt_us": _pluralizeFunctions[6],
        "ln": _pluralizeFunctions[2],
        "ln_ao": _pluralizeFunctions[2],
        "ln_cd": _pluralizeFunctions[2],
        "ln_cf": _pluralizeFunctions[2],
        "ln_cg": _pluralizeFunctions[2],
        "lo": _pluralizeFunctions[6],
        "lo_la": _pluralizeFunctions[6],
        "lt": _pluralizeFunctions[23],
        "lt_lt": _pluralizeFunctions[23],
        "lu": _pluralizeFunctions[0],
        "lu_cd": _pluralizeFunctions[0],
        "luo": _pluralizeFunctions[0],
        "luo_ke": _pluralizeFunctions[0],
        "luy": _pluralizeFunctions[0],
        "luy_ke": _pluralizeFunctions[0],
        "lv": _pluralizeFunctions[24],
        "lv_lv": _pluralizeFunctions[24],
        "mas": _pluralizeFunctions[1],
        "mas_ke": _pluralizeFunctions[1],
        "mas_tz": _pluralizeFunctions[1],
        "mer": _pluralizeFunctions[0],
        "mer_ke": _pluralizeFunctions[0],
        "mfe": _pluralizeFunctions[0],
        "mfe_mu": _pluralizeFunctions[0],
        "mg": _pluralizeFunctions[2],
        "mg_mg": _pluralizeFunctions[2],
        "mgh": _pluralizeFunctions[0],
        "mgh_mz": _pluralizeFunctions[0],
        "mgo": _pluralizeFunctions[1],
        "mgo_cm": _pluralizeFunctions[1],
        "mk": _pluralizeFunctions[25],
        "mk_mk": _pluralizeFunctions[25],
        "ml": _pluralizeFunctions[1],
        "ml_in": _pluralizeFunctions[1],
        "mn": _pluralizeFunctions[1],
        "mn_cyrl": _pluralizeFunctions[1],
        "mn_cyrl_mn": _pluralizeFunctions[1],
        "mr": _pluralizeFunctions[3],
        "mr_in": _pluralizeFunctions[3],
        "ms": _pluralizeFunctions[6],
        "ms_latn": _pluralizeFunctions[6],
        "ms_latn_bn": _pluralizeFunctions[6],
        "ms_latn_my": _pluralizeFunctions[6],
        "ms_latn_sg": _pluralizeFunctions[6],
        "mt": _pluralizeFunctions[26],
        "mt_mt": _pluralizeFunctions[26],
        "mua": _pluralizeFunctions[0],
        "mua_cm": _pluralizeFunctions[0],
        "my": _pluralizeFunctions[6],
        "my_mm": _pluralizeFunctions[6],
        "naq": _pluralizeFunctions[21],
        "naq_na": _pluralizeFunctions[21],
        "nb": _pluralizeFunctions[1],
        "nb_no": _pluralizeFunctions[1],
        "nb_sj": _pluralizeFunctions[1],
        "nd": _pluralizeFunctions[1],
        "nd_zw": _pluralizeFunctions[1],
        "ne": _pluralizeFunctions[1],
        "ne_in": _pluralizeFunctions[1],
        "ne_np": _pluralizeFunctions[1],
        "nl": _pluralizeFunctions[9],
        "nl_aw": _pluralizeFunctions[9],
        "nl_be": _pluralizeFunctions[9],
        "nl_bq": _pluralizeFunctions[9],
        "nl_cw": _pluralizeFunctions[9],
        "nl_nl": _pluralizeFunctions[9],
        "nl_sr": _pluralizeFunctions[9],
        "nl_sx": _pluralizeFunctions[9],
        "nmg": _pluralizeFunctions[0],
        "nmg_cm": _pluralizeFunctions[0],
        "nn": _pluralizeFunctions[1],
        "nn_no": _pluralizeFunctions[1],
        "nnh": _pluralizeFunctions[1],
        "nnh_cm": _pluralizeFunctions[1],
        "nr": _pluralizeFunctions[1],
        "nr_za": _pluralizeFunctions[1],
        "nso": _pluralizeFunctions[2],
        "nso_za": _pluralizeFunctions[2],
        "nus": _pluralizeFunctions[0],
        "nus_sd": _pluralizeFunctions[0],
        "nyn": _pluralizeFunctions[1],
        "nyn_ug": _pluralizeFunctions[1],
        "om": _pluralizeFunctions[1],
        "om_et": _pluralizeFunctions[1],
        "om_ke": _pluralizeFunctions[1],
        "or": _pluralizeFunctions[1],
        "or_in": _pluralizeFunctions[1],
        "os": _pluralizeFunctions[1],
        "os_ge": _pluralizeFunctions[1],
        "os_ru": _pluralizeFunctions[1],
        "pa": _pluralizeFunctions[2],
        "pa_arab": _pluralizeFunctions[2],
        "pa_arab_pk": _pluralizeFunctions[2],
        "pa_guru": _pluralizeFunctions[2],
        "pa_guru_in": _pluralizeFunctions[2],
        "pl": _pluralizeFunctions[27],
        "pl_pl": _pluralizeFunctions[27],
        "ps": _pluralizeFunctions[1],
        "ps_af": _pluralizeFunctions[1],
        "pt": _pluralizeFunctions[28],
        "pt_ao": _pluralizeFunctions[28],
        "pt_br": _pluralizeFunctions[28],
        "pt_cv": _pluralizeFunctions[28],
        "pt_gw": _pluralizeFunctions[28],
        "pt_mo": _pluralizeFunctions[28],
        "pt_mz": _pluralizeFunctions[28],
        "pt_pt": _pluralizeFunctions[28],
        "pt_st": _pluralizeFunctions[28],
        "pt_tl": _pluralizeFunctions[28],
        "rm": _pluralizeFunctions[1],
        "rm_ch": _pluralizeFunctions[1],
        "rn": _pluralizeFunctions[0],
        "rn_bi": _pluralizeFunctions[0],
        "ro": _pluralizeFunctions[29],
        "ro_md": _pluralizeFunctions[29],
        "ro_ro": _pluralizeFunctions[29],
        "rof": _pluralizeFunctions[1],
        "rof_tz": _pluralizeFunctions[1],
        "root": _pluralizeFunctions[0],
        "ru": _pluralizeFunctions[30],
        "ru_by": _pluralizeFunctions[30],
        "ru_kg": _pluralizeFunctions[30],
        "ru_kz": _pluralizeFunctions[30],
        "ru_md": _pluralizeFunctions[30],
        "ru_ru": _pluralizeFunctions[30],
        "ru_ua": _pluralizeFunctions[30],
        "rw": _pluralizeFunctions[0],
        "rw_rw": _pluralizeFunctions[0],
        "rwk": _pluralizeFunctions[1],
        "rwk_tz": _pluralizeFunctions[1],
        "sah": _pluralizeFunctions[6],
        "sah_ru": _pluralizeFunctions[6],
        "saq": _pluralizeFunctions[1],
        "saq_ke": _pluralizeFunctions[1],
        "sbp": _pluralizeFunctions[0],
        "sbp_tz": _pluralizeFunctions[0],
        "se": _pluralizeFunctions[21],
        "se_fi": _pluralizeFunctions[21],
        "se_no": _pluralizeFunctions[21],
        "seh": _pluralizeFunctions[1],
        "seh_mz": _pluralizeFunctions[1],
        "ses": _pluralizeFunctions[6],
        "ses_ml": _pluralizeFunctions[6],
        "sg": _pluralizeFunctions[6],
        "sg_cf": _pluralizeFunctions[6],
        "shi": _pluralizeFunctions[31],
        "shi_latn": _pluralizeFunctions[31],
        "shi_latn_ma": _pluralizeFunctions[31],
        "shi_tfng": _pluralizeFunctions[31],
        "shi_tfng_ma": _pluralizeFunctions[31],
        "si": _pluralizeFunctions[32],
        "si_lk": _pluralizeFunctions[32],
        "sk": _pluralizeFunctions[10],
        "sk_sk": _pluralizeFunctions[10],
        "sl": _pluralizeFunctions[33],
        "sl_si": _pluralizeFunctions[33],
        "sn": _pluralizeFunctions[1],
        "sn_zw": _pluralizeFunctions[1],
        "so": _pluralizeFunctions[1],
        "so_dj": _pluralizeFunctions[1],
        "so_et": _pluralizeFunctions[1],
        "so_ke": _pluralizeFunctions[1],
        "so_so": _pluralizeFunctions[1],
        "sq": _pluralizeFunctions[1],
        "sq_al": _pluralizeFunctions[1],
        "sq_mk": _pluralizeFunctions[1],
        "sq_xk": _pluralizeFunctions[1],
        "sr": _pluralizeFunctions[8],
        "sr_cyrl": _pluralizeFunctions[8],
        "sr_cyrl_ba": _pluralizeFunctions[8],
        "sr_cyrl_me": _pluralizeFunctions[8],
        "sr_cyrl_rs": _pluralizeFunctions[8],
        "sr_cyrl_xk": _pluralizeFunctions[8],
        "sr_latn": _pluralizeFunctions[8],
        "sr_latn_ba": _pluralizeFunctions[8],
        "sr_latn_me": _pluralizeFunctions[8],
        "sr_latn_rs": _pluralizeFunctions[8],
        "sr_latn_xk": _pluralizeFunctions[8],
        "ss": _pluralizeFunctions[1],
        "ss_sz": _pluralizeFunctions[1],
        "ss_za": _pluralizeFunctions[1],
        "ssy": _pluralizeFunctions[1],
        "ssy_er": _pluralizeFunctions[1],
        "st": _pluralizeFunctions[1],
        "st_ls": _pluralizeFunctions[1],
        "st_za": _pluralizeFunctions[1],
        "sv": _pluralizeFunctions[9],
        "sv_ax": _pluralizeFunctions[9],
        "sv_fi": _pluralizeFunctions[9],
        "sv_se": _pluralizeFunctions[9],
        "sw": _pluralizeFunctions[9],
        "sw_ke": _pluralizeFunctions[9],
        "sw_tz": _pluralizeFunctions[9],
        "sw_ug": _pluralizeFunctions[9],
        "swc": _pluralizeFunctions[0],
        "swc_cd": _pluralizeFunctions[0],
        "ta": _pluralizeFunctions[1],
        "ta_in": _pluralizeFunctions[1],
        "ta_lk": _pluralizeFunctions[1],
        "ta_my": _pluralizeFunctions[1],
        "ta_sg": _pluralizeFunctions[1],
        "te": _pluralizeFunctions[1],
        "te_in": _pluralizeFunctions[1],
        "teo": _pluralizeFunctions[1],
        "teo_ke": _pluralizeFunctions[1],
        "teo_ug": _pluralizeFunctions[1],
        "tg": _pluralizeFunctions[0],
        "tg_cyrl": _pluralizeFunctions[0],
        "tg_cyrl_tj": _pluralizeFunctions[0],
        "th": _pluralizeFunctions[6],
        "th_th": _pluralizeFunctions[6],
        "ti": _pluralizeFunctions[2],
        "ti_er": _pluralizeFunctions[2],
        "ti_et": _pluralizeFunctions[2],
        "tig": _pluralizeFunctions[1],
        "tig_er": _pluralizeFunctions[1],
        "tn": _pluralizeFunctions[1],
        "tn_bw": _pluralizeFunctions[1],
        "tn_za": _pluralizeFunctions[1],
        "to": _pluralizeFunctions[6],
        "to_to": _pluralizeFunctions[6],
        "tr": _pluralizeFunctions[1],
        "tr_cy": _pluralizeFunctions[1],
        "tr_tr": _pluralizeFunctions[1],
        "ts": _pluralizeFunctions[1],
        "ts_za": _pluralizeFunctions[1],
        "twq": _pluralizeFunctions[0],
        "twq_ne": _pluralizeFunctions[0],
        "tzm": _pluralizeFunctions[34],
        "tzm_latn": _pluralizeFunctions[34],
        "tzm_latn_ma": _pluralizeFunctions[34],
        "uk": _pluralizeFunctions[35],
        "uk_ua": _pluralizeFunctions[35],
        "ur": _pluralizeFunctions[9],
        "ur_in": _pluralizeFunctions[9],
        "ur_pk": _pluralizeFunctions[9],
        "uz": _pluralizeFunctions[1],
        "uz_arab": _pluralizeFunctions[1],
        "uz_arab_af": _pluralizeFunctions[1],
        "uz_cyrl": _pluralizeFunctions[1],
        "uz_cyrl_uz": _pluralizeFunctions[1],
        "uz_latn": _pluralizeFunctions[1],
        "uz_latn_uz": _pluralizeFunctions[1],
        "vai": _pluralizeFunctions[0],
        "vai_latn": _pluralizeFunctions[0],
        "vai_latn_lr": _pluralizeFunctions[0],
        "vai_vaii": _pluralizeFunctions[0],
        "vai_vaii_lr": _pluralizeFunctions[0],
        "ve": _pluralizeFunctions[1],
        "ve_za": _pluralizeFunctions[1],
        "vi": _pluralizeFunctions[6],
        "vi_vn": _pluralizeFunctions[6],
        "vo": _pluralizeFunctions[1],
        "vo_001": _pluralizeFunctions[1],
        "vun": _pluralizeFunctions[1],
        "vun_tz": _pluralizeFunctions[1],
        "wae": _pluralizeFunctions[1],
        "wae_ch": _pluralizeFunctions[1],
        "wal": _pluralizeFunctions[0],
        "wal_et": _pluralizeFunctions[0],
        "xh": _pluralizeFunctions[1],
        "xh_za": _pluralizeFunctions[1],
        "xog": _pluralizeFunctions[1],
        "xog_ug": _pluralizeFunctions[1],
        "yav": _pluralizeFunctions[0],
        "yav_cm": _pluralizeFunctions[0],
        "yo": _pluralizeFunctions[6],
        "yo_bj": _pluralizeFunctions[6],
        "yo_ng": _pluralizeFunctions[6],
        "zgh": _pluralizeFunctions[0],
        "zgh_ma": _pluralizeFunctions[0],
        "zh": _pluralizeFunctions[6],
        "zh_hans": _pluralizeFunctions[6],
        "zh_hans_cn": _pluralizeFunctions[6],
        "zh_hans_hk": _pluralizeFunctions[6],
        "zh_hans_mo": _pluralizeFunctions[6],
        "zh_hans_sg": _pluralizeFunctions[6],
        "zh_hant": _pluralizeFunctions[6],
        "zh_hant_hk": _pluralizeFunctions[6],
        "zh_hant_mo": _pluralizeFunctions[6],
        "zh_hant_tw": _pluralizeFunctions[6],
        "zu": _pluralizeFunctions[3],
        "zu_za": _pluralizeFunctions[3]
    };

    ///-------GENERATED PLURALIZATION END

    return MessageFormat;
});

