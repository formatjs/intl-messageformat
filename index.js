/*
 * Copyright (c) 2011-2013, Yahoo! Inc.  All rights reserved.
 * Copyrights licensed under the New BSD License.
 * See the accompanying LICENSE file for terms.
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

    var DEFAULT_LOCALE = null,

        REGEX_WHITE_SPACE         = /\s/g,
        REGEX_STRING_TO_PATTERN   = /\$?\{([^\} ]*)\}/g,

        // localeData registered by __addLocaleData()
        localeData = {};

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
     @param {LocaleList|String} locale Locale for string formatting.
     @param {Object} optFieldFormatters Holds user defined formatters for each field (Dojo like).
     */
    function MessageFormat (pattern, locale, optFieldFormatters) {
        var chunks,
            matches,
            len,
            i,
            p;

        // default locale to null
        /*jshint expr:true */
        locale || (locale = null);

        if (locale) {
            // strict value checking for locale when provided
            if (
                typeof locale !== 'string' || // make sure we have a string
                locale.replace(REGEX_WHITE_SPACE,'').length < 2 // it's at least two characters
            ) {
                throw new RangeError('Invalid language tag.');
            }
        }

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

        // Assume the string passed in is a simple pattern for replacement.
        if (typeof pattern === 'string') {
            pattern = MessageFormat.parse(pattern);
        }

        // save the pattern internally
        this.pattern = pattern;

        // store formatters
        this.formatters = {};

        if (optFieldFormatters) {
            for (p in optFieldFormatters) {
                if (optFieldFormatters.hasOwnProperty(p) && typeof optFieldFormatters[p] === 'function') {
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

        // default value for `obj`? should this just throw
        /* jshint expr:true */
        obj || (obj = {});

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
        tokens = pattern.match(REGEX_STRING_TO_PATTERN);

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
            data,
            fn,
            parts;

        // if the locale isn't set, and there is no default locale set, throw
        if (
            typeof locale !== 'string' || // make sure we have a string
            locale.replace(/\s/g,'').length < 2 // it's at least two characters
        ) {
            throw new ReferenceError('No locale data has been provided for this object yet.');
        }

        // cache the choice of pluralization function
        if (this._pluralLocale !== locale) {
            if (locale !== DEFAULT_LOCALE) {
                parts = this.locale.toLowerCase().split('-');
                while (parts.length) {
                    data = localeData[parts.join('_')];
                    if (data && data.pluralFunction) {
                        fn = data.pluralFunction;
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
                    data = localeData[parts.join('_')];
                    if (data && data.pluralFunction) {
                        fn = data.pluralFunction;
                        break;
                    }
                    parts.pop();
                }
            }
            if (!fn) {
                data = localeData[DEFAULT_LOCALE];
                fn = (data && data.pluralFunction) || function() {
                    return 'other';
                };
            }
            this._pluralLocale = locale;
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
                    valType = Object.prototype.toString.call(val);

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
            throw new ReferenceError('The valueName `' + obj.valueName + '` was not found.');
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
            if (obj.format) {
                formatterFn = (typeof obj.format === 'function') ? obj.format : this.formatters[obj.format];

                if (formatterFn) {
                    val = formatterFn.call(this, val, this.locale, obj);
                }
            }

            // sandwich
            val = (obj.prefix || '') + val + (obj.postfix || '');
        }

        return val;
    };

    /**
     Registers localization data for a particular locale.
     The format is:

     ```
     {
        locale: 'the locale',
        messageformat: {
            // This function takes a number (count) and turns it into a
            // pluralization group (e.g. 'one', 'few', 'many', 'other').
            pluralFunction: function(count) { return 'plural group' }
        }
     }
     ```

     @method __addLocaleData
     @param {Object} The locale data as described above.
     @return {nothing}
     */
    MessageFormat.__addLocaleData = function(data) {

        // if there isn't a default locale set, set it out of the data.locale
        if (DEFAULT_LOCALE === null) {
            DEFAULT_LOCALE = data.locale;
        }

        localeData[data.locale] = data.messageformat;
    };






    // ---------------------------------------------------------
    // -- PARSE ------------------------------------------------
    // ---------------------------------------------------------

    /**
     Parses a pattern that may contain nested format elements.
     @method parse
     @param {String} pattern A pattern
     @param {Function} outputFormatter An optional formatter for the string output
     @return {Object|Array} Parsed output
     **/
    MessageFormat.parse = function (pattern, outputFormatter) {


        /**
         Tokenizes a MessageFormat pattern.
         @method tokenize
         @param {String} pattern A pattern
         @param {Boolean} trim Whether or not the tokens should be trimmed of whitespace
         @return {Array} Tokens
         **/
        function tokenize (pattern, trim) {
            var bracketRE   = /[{}]/g,
                tokens      = [],
                balance     = 0,
                startIndex  = 0,
                endIndex,
                substr,
                match;


            match = bracketRE.exec(pattern);

            while (match) {
                // Keep track of balanced brackets
                balance += match[0] === '{' ? 1 : -1;

                // Imbalanced brackets detected (e.g. "}hello{", "{hello}}")
                if (balance < 0) {
                    throw new Error('Imbalanced bracket detected at index ' +
                        match.index + ' for message "' + pattern + '"');
                }

                // Tokenize a pair of balanced brackets
                if (balance === 0) {
                    endIndex = match.index + 1;

                    tokens.push(
                        pattern.slice(startIndex, endIndex)
                    );

                    startIndex = endIndex;
                }

                // Tokenize any text that comes before the first opening bracket
                if (balance === 1 && startIndex !== match.index) {
                    substr = pattern.slice(startIndex, match.index);
                    if (substr.indexOf('{') === -1) {
                        tokens.push(substr);
                        startIndex = match.index;
                    }
                }

                match = bracketRE.exec(pattern);
            }

            // Imbalanced brackets detected (e.g. "{{hello}")
            if (balance !== 0) {
                throw new Error('Brackets were not properly closed: ' + pattern);
            }

            // Tokenize any remaining non-empty string
            if (startIndex !== pattern.length) {
                tokens.push(
                    pattern.slice(startIndex)
                );
            }

            if (trim) {
                tokens = tokens.map(function (token) {
                    return token.replace(/^\s*/, '').replace(/\s*$/, '');
                });
            }

            return tokens;
        }



        /**
         Gets the content of the format element by peeling off the outermost pair of
         brackets.
         @method getFormatElementContent
         @param {String} formatElement Format element
         @return {String} Contents of format element
         **/
        function getFormatElementContent (formatElement) {
            return formatElement.replace(/^{\s*/, '').replace(/\s*}$/, '');
        }

        /**
         Checks if the pattern contains a format element.
         @method containsFormatElement
         @param {String} pattern Pattern
         @return {Boolean} Whether or not the pattern contains a format element
         **/
        function containsFormatElement (pattern) {
            return pattern.indexOf('{') >= 0;
        }

        /**
         Parses a list of tokens into paired options where the key is the option name
         and the value is the pattern.
         @method pairedOptionsParser
         @param {Object} parsed Parsed object
         @param {Array} tokens Remaining tokens that come after the value name and the
             format id
         @return {Object} Parsed object with added options
         **/
        function pairedOptionsParser (parsed, tokens) {
            var hasDefault,
                value,
                name,
                l,
                i;

            parsed.options  = {};

            if (tokens.length % 2) {
                throw new Error('Options must come in pairs: ' + JSON.stringify(tokens));
            }

            for (i = 0, l = tokens.length; i < l; i += 2) {
                name  = tokens[i];
                value = tokens[i + 1];

                parsed.options[name] = value;

                hasDefault = hasDefault || name === 'other';
            }

            if (!hasDefault) {
                throw new Error('Options must include default "other" option: ' + JSON.stringify(tokens));
            }

            return parsed;
        }

        function formatOptionParser (parsed, tokens) {
            parsed.format = tokens[0];
            return parsed;
        }

        /**
         Parses a format element. Format elements are surrounded by curly braces, and
         contain at least a value name.
         @method formatElementParser
         @param {String} formatElement A format element
         @param {Object} match The result of a String.match() that has at least the
             value name at index 1 and a subformat at index 2
         @return {Object} Parsed object
         **/
        function formatElementParser (formatElement, match, formatter) {
            var parsed = {
                    type: formatter.type,
                    valueName: match[1]
                },
                tokens = match[2] && tokenize(match[2], true);

            // If there are any additional tokens to parse, it should be done here
            if (formatter.tokenParser && tokens) {
                parsed = formatter.tokenParser(parsed, tokens);
            }

            // Any final modifications to the parsed output should be done here
            if (formatter.postParser) {
                parsed = formatter.postParser(parsed);
            }

            return parsed;
        }

        // `type` (required): The name of the message format type.
        // `regex` (required): The regex used to check if this formatter can parse the message.
        // `parse` (required): The main parse method which is given the full message.
        // `tokenParser` (optional): Used to parse the remaining tokens of a message (what remains after the variable and the format type).
        // `postParser` (optional): Used to format the output before returning from the main `parse` method.
        // `outputFormatter` (optional): Used to format the fully parsed string returned from the base case of the recursive parser.
        var FORMATTERS = [
            {
                type: 'string',
                regex: /^{\s*([-\w]+)\s*}$/,
                parse: formatElementParser,
                postParser: function (parsed) {
                    return '${' + parsed.valueName + '}';
                }
            },
            {
                type: 'select',
                regex: /^{\s*([-\w]+)\s*,\s*select\s*,\s*(.*)\s*}$/,
                parse: formatElementParser,
                tokenParser: pairedOptionsParser
            },
            {
                type: 'plural',
                regex: /^{\s*([-\w]+)\s*,\s*plural\s*,\s*(.*)\s*}$/,
                parse: formatElementParser,
                tokenParser: pairedOptionsParser,
                outputFormatter: function (str) {
                    return str.replace(/#/g, '${#}');
                }
            },
            {
                type: 'time',
                regex: /^{\s*([-\w]+)\s*,\s*time(?:,(.*))?\s*}$/,
                parse: formatElementParser,
                tokenParser: formatOptionParser,
                postParser: function (parsed) {
                    parsed.format = parsed.format || 'medium';
                    return parsed;
                }
            },
            {
                type: 'date',
                regex: /^{\s*([-\w]+)\s*,\s*date(?:,(.*))?\s*}$/,
                parse: formatElementParser,
                tokenParser: formatOptionParser,
                postParser: function (parsed) {
                    parsed.format = parsed.format || 'medium';
                    return parsed;
                }
            },
            {
                type: 'number',
                regex: /^{\s*([-\w]+)\s*,\s*number(?:,(.*))?\s*}$/,
                parse: formatElementParser,
                tokenParser: formatOptionParser
            },
            {
                type: 'custom',
                regex: /^{\s*([-\w]+)\s*,\s*([a-zA-Z]*)(?:,(.*))?\s*}$/,
                parse: formatElementParser,
                tokenParser:formatOptionParser
            }
        ];

        /**
         For each formatter, test it on the token in order
         @method parseToken
         @param {String} token
         @param {Number} index
         @param {Array} tokens
         */
        function parseToken (token, index, tokens) {
            var i, len;

            for (i = 0, len = FORMATTERS.length; i < len; i++) {
                if (parseFormatTokens(FORMATTERS[i], i, tokens, index)) {
                    return true;
                }
            }
        }

        /**
         @method parseFormatTokens
         @param {Object} messageFormat
         @param {Number} index
         @param {Array} tokens
         @param {Number} tokenIndex
         @return {Boolean}
         */
        function parseFormatTokens (messageFormat, index, tokens, tokenIndex) {
            var token = tokens[tokenIndex],
                match = token.match(messageFormat.regex),
                parsed,
                parsedKeys = [],
                key,
                i, len;

            if (match) {
                parsed = messageFormat.parse(token, match, messageFormat);
                tokens[tokenIndex] = parsed;

                for (key in parsed) {
                    if (parsed.hasOwnProperty(key)) {
                        parsedKeys[key];
                    }
                }

                for (i = 0, len = parsedKeys.length; i < len; i++) {
                    parseFormatOptions(parsedToken, parsedKeys[i], messageFormat);
                }

            }

            return !!match;
        }

        /**
         @method parseFormatOptions
         @param {Object}
         */
        function parseFormatOptions (parsedToken, key, messageFormat) {
            var value = parsedToken.options[key];
            value = getFormatElementContent(value);
            parsedToken.options[key] = parse(value, messageFormat.outputFormatter);
        }

        // ---------------------------------------------
        // -- FUNCTION BASE-----------------------------
        // ---------------------------------------------

        var tokens,
            i, len;

        // base case (plain string)
        if (!containsFormatElement(pattern)) {
            // Final chance to format the string before the parser spits it out
            return outputFormatter ? outputFormatter(pattern) : pattern;
        }

        tokens = tokenize(pattern);

        for (i = 0, len = tokens.length; i < len; i++) {
            if (tokens[i].charAt(0) === '{') { // tokens must start with a {
                parseToken(tokens[i], i, tokens);
            }
        }

        return tokens;
    };



    return MessageFormat;
});

