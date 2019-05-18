var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
/*
Copyright (c) 2014, Yahoo! Inc. All rights reserved.
Copyrights licensed under the New BSD License.
See the accompanying LICENSE file for terms.
*/
define("compiler", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var Compiler = /** @class */ (function () {
        function Compiler(locales, formats) {
            this.locales = [];
            this.formats = {
                number: {},
                date: {},
                time: {}
            };
            this.pluralNumberFormat = null;
            this.currentPlural = null;
            this.pluralStack = [];
            this.locales = locales;
            this.formats = formats;
        }
        Compiler.prototype.compile = function (ast) {
            this.pluralStack = [];
            this.currentPlural = null;
            this.pluralNumberFormat = null;
            return this.compileMessage(ast);
        };
        Compiler.prototype.compileMessage = function (ast) {
            var _this = this;
            if (!(ast && ast.type === "messageFormatPattern")) {
                throw new Error('Message AST is not of type: "messageFormatPattern"');
            }
            var elements = ast.elements;
            var pattern = elements
                .filter(function (el) {
                return el.type === "messageTextElement" || el.type === "argumentElement";
            })
                .map(function (el) {
                return el.type === "messageTextElement"
                    ? _this.compileMessageText(el)
                    : _this.compileArgument(el);
            });
            if (pattern.length !== elements.length) {
                throw new Error("Message element does not have a valid type");
            }
            return pattern;
        };
        Compiler.prototype.compileMessageText = function (element) {
            // When this `element` is part of plural sub-pattern and its value contains
            // an unescaped '#', use a `PluralOffsetString` helper to properly output
            // the number with the correct offset in the string.
            if (this.currentPlural && /(^|[^\\])#/g.test(element.value)) {
                // Create a cache a NumberFormat instance that can be reused for any
                // PluralOffsetString instance in this message.
                if (!this.pluralNumberFormat) {
                    this.pluralNumberFormat = new Intl.NumberFormat(this.locales);
                }
                return new PluralOffsetString(this.currentPlural.id, this.currentPlural.format.offset, this.pluralNumberFormat, element.value);
            }
            // Unescape the escaped '#'s in the message text.
            return element.value.replace(/\\#/g, "#");
        };
        Compiler.prototype.compileArgument = function (element) {
            var format = element.format, id = element.id;
            if (!format) {
                return new StringFormat(id);
            }
            var _a = this, formats = _a.formats, locales = _a.locales;
            switch (format.type) {
                case "numberFormat":
                    return {
                        id: id,
                        format: new Intl.NumberFormat(locales, formats.number[format.style])
                            .format
                    };
                case "dateFormat":
                    return {
                        id: id,
                        format: new Intl.DateTimeFormat(locales, formats.date[format.style])
                            .format
                    };
                case "timeFormat":
                    return {
                        id: id,
                        format: new Intl.DateTimeFormat(locales, formats.time[format.style])
                            .format
                    };
                case "pluralFormat":
                    return new PluralFormat(id, format.ordinal, format.offset, this.compileOptions(element), locales);
                case "selectFormat":
                    return new SelectFormat(id, this.compileOptions(element));
                default:
                    throw new Error("Message element does not have a valid format type");
            }
        };
        Compiler.prototype.compileOptions = function (element) {
            var format = element.format;
            var options = format.options;
            var optionsHash = {};
            // Save the current plural element, if any, then set it to a new value when
            // compiling the options sub-patterns. This conforms the spec's algorithm
            // for handling `"#"` syntax in message text.
            this.pluralStack.push(this.currentPlural);
            this.currentPlural = format.type === "pluralFormat" ? element : null;
            var i, len, option;
            for (i = 0, len = options.length; i < len; i += 1) {
                option = options[i];
                // Compile the sub-pattern and save it under the options's selector.
                optionsHash[option.selector] = this.compileMessage(option.value);
            }
            // Pop the plural stack to put back the original current plural value.
            this.currentPlural = this.pluralStack.pop();
            return optionsHash;
        };
        return Compiler;
    }());
    exports.default = Compiler;
    // -- Compiler Helper Classes --------------------------------------------------
    var Formatter = /** @class */ (function () {
        function Formatter(id) {
            this.id = id;
        }
        return Formatter;
    }());
    var StringFormat = /** @class */ (function (_super) {
        __extends(StringFormat, _super);
        function StringFormat() {
            return _super !== null && _super.apply(this, arguments) || this;
        }
        StringFormat.prototype.format = function (value) {
            if (!value && typeof value !== "number") {
                return "";
            }
            return typeof value === "string" ? value : String(value);
        };
        return StringFormat;
    }(Formatter));
    exports.StringFormat = StringFormat;
    var PluralFormat = /** @class */ (function () {
        function PluralFormat(id, useOrdinal, offset, options, locales) {
            this.id = id;
            this.offset = offset;
            this.options = options;
            this.pluralRules = new Intl.PluralRules(locales, {
                type: useOrdinal ? "ordinal" : "cardinal"
            });
        }
        PluralFormat.prototype.getOption = function (value) {
            var options = this.options;
            var option = options["=" + value] ||
                options[this.pluralRules.select(value - this.offset)];
            return option || options.other;
        };
        return PluralFormat;
    }());
    exports.PluralFormat = PluralFormat;
    var PluralOffsetString = /** @class */ (function (_super) {
        __extends(PluralOffsetString, _super);
        function PluralOffsetString(id, offset, numberFormat, string) {
            var _this = _super.call(this, id) || this;
            _this.offset = offset;
            _this.numberFormat = numberFormat;
            _this.string = string;
            return _this;
        }
        PluralOffsetString.prototype.format = function (value) {
            var number = this.numberFormat.format(value - this.offset);
            return this.string
                .replace(/(^|[^\\])#/g, "$1" + number)
                .replace(/\\#/g, "#");
        };
        return PluralOffsetString;
    }(Formatter));
    exports.PluralOffsetString = PluralOffsetString;
    var SelectFormat = /** @class */ (function () {
        function SelectFormat(id, options) {
            this.id = id;
            this.options = options;
        }
        SelectFormat.prototype.getOption = function (value) {
            var options = this.options;
            return options[value] || options.other;
        };
        return SelectFormat;
    }());
    exports.SelectFormat = SelectFormat;
    function isSelectOrPluralFormat(f) {
        return !!f.options;
    }
    exports.isSelectOrPluralFormat = isSelectOrPluralFormat;
});
/*
Copyright (c) 2014, Yahoo! Inc. All rights reserved.
Copyrights licensed under the New BSD License.
See the accompanying LICENSE file for terms.
*/
define("core", ["require", "exports", "compiler", "intl-messageformat-parser"], function (require, exports, compiler_1, intl_messageformat_parser_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    // -- MessageFormat --------------------------------------------------------
    var MessageFormat = /** @class */ (function () {
        function MessageFormat(message, locales, overrideFormats) {
            var _this = this;
            // "Bind" `format()` method to `this` so it can be passed by reference like
            // the other `Intl` APIs.
            this.format = function (values) {
                try {
                    return _this._format(_this.pattern, values);
                }
                catch (e) {
                    if (e.variableId) {
                        throw new Error("The intl string context variable '" +
                            e.variableId +
                            "'" +
                            " was not provided to the string '" +
                            _this.message +
                            "'");
                    }
                    else {
                        throw e;
                    }
                }
            };
            // Parse string messages into an AST.
            var ast = typeof message === "string" ? MessageFormat.__parse(message) : message;
            if (!(ast && ast.type === "messageFormatPattern")) {
                throw new TypeError("A message must be provided as a String or AST.");
            }
            // Creates a new object with the specified `formats` merged with the default
            // formats.
            var formats = mergeConfigs(MessageFormat.formats, overrideFormats);
            // Defined first because it's used to build the format pattern.
            this._locale = this._resolveLocale(locales || []);
            // Compile the `ast` to a pattern that is highly optimized for repeated
            // `format()` invocations. **Note:** This passes the `locales` set provided
            // to the constructor instead of just the resolved locale.
            this.pattern = this._compilePattern(ast, locales || [], formats);
            this.message = message;
        }
        MessageFormat.__addLocaleData = function (data) {
            if (!(data && data.locale)) {
                throw new Error("Locale data provided to IntlMessageFormat is missing a " +
                    "`locale` property");
            }
            MessageFormat.__localeData__[data.locale.toLowerCase()] = data;
        };
        MessageFormat.prototype.resolvedOptions = function () {
            return { locale: this._locale };
        };
        MessageFormat.prototype._resolveLocale = function (locales) {
            if (typeof locales === "string") {
                locales = [locales];
            }
            // Create a copy of the array so we can push on the default locale.
            locales = (locales || []).concat(MessageFormat.defaultLocale);
            var localeData = MessageFormat.__localeData__;
            var i, len, localeParts, data;
            // Using the set of locales + the default locale, we look for the first one
            // which that has been registered. When data does not exist for a locale, we
            // traverse its ancestors to find something that's been registered within
            // its hierarchy of locales. Since we lack the proper `parentLocale` data
            // here, we must take a naive approach to traversal.
            for (i = 0, len = locales.length; i < len; i += 1) {
                localeParts = locales[i].toLowerCase().split("-");
                while (localeParts.length) {
                    data = localeData[localeParts.join("-")];
                    if (data) {
                        // Return the normalized locale string; e.g., we return "en-US",
                        // instead of "en-us".
                        return data.locale;
                    }
                    localeParts.pop();
                }
            }
            var defaultLocale = locales.pop();
            throw new Error("No locale data has been added to IntlMessageFormat for: " +
                locales.join(", ") +
                ", or the default locale: " +
                defaultLocale);
        };
        MessageFormat.prototype._compilePattern = function (ast, locales, formats) {
            var compiler = new compiler_1.default(locales, formats);
            return compiler.compile(ast);
        };
        MessageFormat.prototype._format = function (pattern, values) {
            var result = "", i, len, part, id, value, err;
            for (i = 0, len = pattern.length; i < len; i += 1) {
                part = pattern[i];
                // Exist early for string parts.
                if (typeof part === "string") {
                    result += part;
                    continue;
                }
                id = part.id;
                // Enforce that all required values are provided by the caller.
                if (!(values && id in values)) {
                    throw new FormatError("A value must be provided for: " + id, id);
                }
                value = values[id];
                // Recursively format plural and select parts' option — which can be a
                // nested pattern structure. The choosing of the option to use is
                // abstracted-by and delegated-to the part helper object.
                if (compiler_1.isSelectOrPluralFormat(part)) {
                    result += this._format(part.getOption(value), values);
                }
                else {
                    result += part.format(value);
                }
            }
            return result;
        };
        // Default format options used as the prototype of the `formats` provided to the
        // constructor. These are used when constructing the internal Intl.NumberFormat
        // and Intl.DateTimeFormat instances.
        MessageFormat.formats = {
            number: {
                currency: {
                    style: "currency"
                },
                percent: {
                    style: "percent"
                }
            },
            date: {
                short: {
                    month: "numeric",
                    day: "numeric",
                    year: "2-digit"
                },
                medium: {
                    month: "short",
                    day: "numeric",
                    year: "numeric"
                },
                long: {
                    month: "long",
                    day: "numeric",
                    year: "numeric"
                },
                full: {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric"
                }
            },
            time: {
                short: {
                    hour: "numeric",
                    minute: "numeric"
                },
                medium: {
                    hour: "numeric",
                    minute: "numeric",
                    second: "numeric"
                },
                long: {
                    hour: "numeric",
                    minute: "numeric",
                    second: "numeric",
                    timeZoneName: "short"
                },
                full: {
                    hour: "numeric",
                    minute: "numeric",
                    second: "numeric",
                    timeZoneName: "short"
                }
            }
        };
        MessageFormat.__parse = intl_messageformat_parser_1.default.parse;
        return MessageFormat;
    }());
    exports.default = MessageFormat;
    function mergeConfig(c1, c2) {
        if (!c2) {
            return c1;
        }
        return __assign({}, (c1 || {}), (c2 || {}), Object.keys(c1).reduce(function (all, k) {
            all[k] = __assign({}, c1[k], (c2[k] || {}));
            return all;
        }, {}));
    }
    function mergeConfigs(defaultConfig, configs) {
        if (!configs) {
            return defaultConfig;
        }
        return __assign({}, defaultConfig, { date: mergeConfig(defaultConfig.date, configs.date) });
    }
    var FormatError = /** @class */ (function (_super) {
        __extends(FormatError, _super);
        function FormatError(msg, variableId) {
            var _this = _super.call(this, msg) || this;
            _this.variableId = variableId;
            return _this;
        }
        return FormatError;
    }(Error));
});
define("en", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    /* @generated */
    exports.default = { "locale": "en" };
});
/* jslint esnext: true */
define("index", ["require", "exports", "core", "en"], function (require, exports, core_1, en_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    core_1.default.__addLocaleData(en_1.default);
    core_1.default.defaultLocale = "en";
    exports.default = core_1.default;
});
define("locales", ["require", "exports", "core"], function (require, exports, core_2) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    core_2.default.__addLocaleData({ "locale": "af" });
    core_2.default.__addLocaleData({ "locale": "af-NA", "parentLocale": "af" });
    core_2.default.__addLocaleData({ "locale": "agq" });
    core_2.default.__addLocaleData({ "locale": "ak" });
    core_2.default.__addLocaleData({ "locale": "am" });
    core_2.default.__addLocaleData({ "locale": "ar" });
    core_2.default.__addLocaleData({ "locale": "ar-AE", "parentLocale": "ar" });
    core_2.default.__addLocaleData({ "locale": "ar-BH", "parentLocale": "ar" });
    core_2.default.__addLocaleData({ "locale": "ar-DJ", "parentLocale": "ar" });
    core_2.default.__addLocaleData({ "locale": "ar-DZ", "parentLocale": "ar" });
    core_2.default.__addLocaleData({ "locale": "ar-EG", "parentLocale": "ar" });
    core_2.default.__addLocaleData({ "locale": "ar-EH", "parentLocale": "ar" });
    core_2.default.__addLocaleData({ "locale": "ar-ER", "parentLocale": "ar" });
    core_2.default.__addLocaleData({ "locale": "ar-IL", "parentLocale": "ar" });
    core_2.default.__addLocaleData({ "locale": "ar-IQ", "parentLocale": "ar" });
    core_2.default.__addLocaleData({ "locale": "ar-JO", "parentLocale": "ar" });
    core_2.default.__addLocaleData({ "locale": "ar-KM", "parentLocale": "ar" });
    core_2.default.__addLocaleData({ "locale": "ar-KW", "parentLocale": "ar" });
    core_2.default.__addLocaleData({ "locale": "ar-LB", "parentLocale": "ar" });
    core_2.default.__addLocaleData({ "locale": "ar-LY", "parentLocale": "ar" });
    core_2.default.__addLocaleData({ "locale": "ar-MA", "parentLocale": "ar" });
    core_2.default.__addLocaleData({ "locale": "ar-MR", "parentLocale": "ar" });
    core_2.default.__addLocaleData({ "locale": "ar-OM", "parentLocale": "ar" });
    core_2.default.__addLocaleData({ "locale": "ar-PS", "parentLocale": "ar" });
    core_2.default.__addLocaleData({ "locale": "ar-QA", "parentLocale": "ar" });
    core_2.default.__addLocaleData({ "locale": "ar-SA", "parentLocale": "ar" });
    core_2.default.__addLocaleData({ "locale": "ar-SD", "parentLocale": "ar" });
    core_2.default.__addLocaleData({ "locale": "ar-SO", "parentLocale": "ar" });
    core_2.default.__addLocaleData({ "locale": "ar-SS", "parentLocale": "ar" });
    core_2.default.__addLocaleData({ "locale": "ar-SY", "parentLocale": "ar" });
    core_2.default.__addLocaleData({ "locale": "ar-TD", "parentLocale": "ar" });
    core_2.default.__addLocaleData({ "locale": "ar-TN", "parentLocale": "ar" });
    core_2.default.__addLocaleData({ "locale": "ar-YE", "parentLocale": "ar" });
    core_2.default.__addLocaleData({ "locale": "ars" });
    core_2.default.__addLocaleData({ "locale": "as" });
    core_2.default.__addLocaleData({ "locale": "asa" });
    core_2.default.__addLocaleData({ "locale": "ast" });
    core_2.default.__addLocaleData({ "locale": "az" });
    core_2.default.__addLocaleData({ "locale": "az-Arab" });
    core_2.default.__addLocaleData({ "locale": "az-Cyrl" });
    core_2.default.__addLocaleData({ "locale": "az-Latn", "parentLocale": "az" });
    core_2.default.__addLocaleData({ "locale": "bas" });
    core_2.default.__addLocaleData({ "locale": "be" });
    core_2.default.__addLocaleData({ "locale": "bem" });
    core_2.default.__addLocaleData({ "locale": "bez" });
    core_2.default.__addLocaleData({ "locale": "bg" });
    core_2.default.__addLocaleData({ "locale": "bh" });
    core_2.default.__addLocaleData({ "locale": "bm" });
    core_2.default.__addLocaleData({ "locale": "bm-Nkoo" });
    core_2.default.__addLocaleData({ "locale": "bn" });
    core_2.default.__addLocaleData({ "locale": "bn-IN", "parentLocale": "bn" });
    core_2.default.__addLocaleData({ "locale": "bo" });
    core_2.default.__addLocaleData({ "locale": "bo-IN", "parentLocale": "bo" });
    core_2.default.__addLocaleData({ "locale": "br" });
    core_2.default.__addLocaleData({ "locale": "brx" });
    core_2.default.__addLocaleData({ "locale": "bs" });
    core_2.default.__addLocaleData({ "locale": "bs-Cyrl" });
    core_2.default.__addLocaleData({ "locale": "bs-Latn", "parentLocale": "bs" });
    core_2.default.__addLocaleData({ "locale": "ca" });
    core_2.default.__addLocaleData({ "locale": "ca-AD", "parentLocale": "ca" });
    core_2.default.__addLocaleData({ "locale": "ca-ES-VALENCIA", "parentLocale": "ca-ES" });
    core_2.default.__addLocaleData({ "locale": "ca-ES", "parentLocale": "ca" });
    core_2.default.__addLocaleData({ "locale": "ca-FR", "parentLocale": "ca" });
    core_2.default.__addLocaleData({ "locale": "ca-IT", "parentLocale": "ca" });
    core_2.default.__addLocaleData({ "locale": "ccp" });
    core_2.default.__addLocaleData({ "locale": "ccp-IN", "parentLocale": "ccp" });
    core_2.default.__addLocaleData({ "locale": "ce" });
    core_2.default.__addLocaleData({ "locale": "cgg" });
    core_2.default.__addLocaleData({ "locale": "chr" });
    core_2.default.__addLocaleData({ "locale": "ckb" });
    core_2.default.__addLocaleData({ "locale": "ckb-IR", "parentLocale": "ckb" });
    core_2.default.__addLocaleData({ "locale": "cs" });
    core_2.default.__addLocaleData({ "locale": "cu" });
    core_2.default.__addLocaleData({ "locale": "cy" });
    core_2.default.__addLocaleData({ "locale": "da" });
    core_2.default.__addLocaleData({ "locale": "da-GL", "parentLocale": "da" });
    core_2.default.__addLocaleData({ "locale": "dav" });
    core_2.default.__addLocaleData({ "locale": "de" });
    core_2.default.__addLocaleData({ "locale": "de-AT", "parentLocale": "de" });
    core_2.default.__addLocaleData({ "locale": "de-BE", "parentLocale": "de" });
    core_2.default.__addLocaleData({ "locale": "de-CH", "parentLocale": "de" });
    core_2.default.__addLocaleData({ "locale": "de-IT", "parentLocale": "de" });
    core_2.default.__addLocaleData({ "locale": "de-LI", "parentLocale": "de" });
    core_2.default.__addLocaleData({ "locale": "de-LU", "parentLocale": "de" });
    core_2.default.__addLocaleData({ "locale": "dje" });
    core_2.default.__addLocaleData({ "locale": "dsb" });
    core_2.default.__addLocaleData({ "locale": "dua" });
    core_2.default.__addLocaleData({ "locale": "dv" });
    core_2.default.__addLocaleData({ "locale": "dyo" });
    core_2.default.__addLocaleData({ "locale": "dz" });
    core_2.default.__addLocaleData({ "locale": "ebu" });
    core_2.default.__addLocaleData({ "locale": "ee" });
    core_2.default.__addLocaleData({ "locale": "ee-TG", "parentLocale": "ee" });
    core_2.default.__addLocaleData({ "locale": "el" });
    core_2.default.__addLocaleData({ "locale": "el-CY", "parentLocale": "el" });
    core_2.default.__addLocaleData({ "locale": "en" });
    core_2.default.__addLocaleData({ "locale": "en-001", "parentLocale": "en" });
    core_2.default.__addLocaleData({ "locale": "en-150", "parentLocale": "en-001" });
    core_2.default.__addLocaleData({ "locale": "en-AG", "parentLocale": "en-001" });
    core_2.default.__addLocaleData({ "locale": "en-AI", "parentLocale": "en-001" });
    core_2.default.__addLocaleData({ "locale": "en-AS", "parentLocale": "en" });
    core_2.default.__addLocaleData({ "locale": "en-AT", "parentLocale": "en-150" });
    core_2.default.__addLocaleData({ "locale": "en-AU", "parentLocale": "en-001" });
    core_2.default.__addLocaleData({ "locale": "en-BB", "parentLocale": "en-001" });
    core_2.default.__addLocaleData({ "locale": "en-BE", "parentLocale": "en-001" });
    core_2.default.__addLocaleData({ "locale": "en-BI", "parentLocale": "en" });
    core_2.default.__addLocaleData({ "locale": "en-BM", "parentLocale": "en-001" });
    core_2.default.__addLocaleData({ "locale": "en-BS", "parentLocale": "en-001" });
    core_2.default.__addLocaleData({ "locale": "en-BW", "parentLocale": "en-001" });
    core_2.default.__addLocaleData({ "locale": "en-BZ", "parentLocale": "en-001" });
    core_2.default.__addLocaleData({ "locale": "en-CA", "parentLocale": "en-001" });
    core_2.default.__addLocaleData({ "locale": "en-CC", "parentLocale": "en-001" });
    core_2.default.__addLocaleData({ "locale": "en-CH", "parentLocale": "en-150" });
    core_2.default.__addLocaleData({ "locale": "en-CK", "parentLocale": "en-001" });
    core_2.default.__addLocaleData({ "locale": "en-CM", "parentLocale": "en-001" });
    core_2.default.__addLocaleData({ "locale": "en-CX", "parentLocale": "en-001" });
    core_2.default.__addLocaleData({ "locale": "en-CY", "parentLocale": "en-001" });
    core_2.default.__addLocaleData({ "locale": "en-DE", "parentLocale": "en-150" });
    core_2.default.__addLocaleData({ "locale": "en-DG", "parentLocale": "en-001" });
    core_2.default.__addLocaleData({ "locale": "en-DK", "parentLocale": "en-150" });
    core_2.default.__addLocaleData({ "locale": "en-DM", "parentLocale": "en-001" });
    core_2.default.__addLocaleData({ "locale": "en-Dsrt" });
    core_2.default.__addLocaleData({ "locale": "en-ER", "parentLocale": "en-001" });
    core_2.default.__addLocaleData({ "locale": "en-FI", "parentLocale": "en-150" });
    core_2.default.__addLocaleData({ "locale": "en-FJ", "parentLocale": "en-001" });
    core_2.default.__addLocaleData({ "locale": "en-FK", "parentLocale": "en-001" });
    core_2.default.__addLocaleData({ "locale": "en-FM", "parentLocale": "en-001" });
    core_2.default.__addLocaleData({ "locale": "en-GB", "parentLocale": "en-001" });
    core_2.default.__addLocaleData({ "locale": "en-GD", "parentLocale": "en-001" });
    core_2.default.__addLocaleData({ "locale": "en-GG", "parentLocale": "en-001" });
    core_2.default.__addLocaleData({ "locale": "en-GH", "parentLocale": "en-001" });
    core_2.default.__addLocaleData({ "locale": "en-GI", "parentLocale": "en-001" });
    core_2.default.__addLocaleData({ "locale": "en-GM", "parentLocale": "en-001" });
    core_2.default.__addLocaleData({ "locale": "en-GU", "parentLocale": "en" });
    core_2.default.__addLocaleData({ "locale": "en-GY", "parentLocale": "en-001" });
    core_2.default.__addLocaleData({ "locale": "en-HK", "parentLocale": "en-001" });
    core_2.default.__addLocaleData({ "locale": "en-IE", "parentLocale": "en-001" });
    core_2.default.__addLocaleData({ "locale": "en-IL", "parentLocale": "en-001" });
    core_2.default.__addLocaleData({ "locale": "en-IM", "parentLocale": "en-001" });
    core_2.default.__addLocaleData({ "locale": "en-IN", "parentLocale": "en-001" });
    core_2.default.__addLocaleData({ "locale": "en-IO", "parentLocale": "en-001" });
    core_2.default.__addLocaleData({ "locale": "en-JE", "parentLocale": "en-001" });
    core_2.default.__addLocaleData({ "locale": "en-JM", "parentLocale": "en-001" });
    core_2.default.__addLocaleData({ "locale": "en-KE", "parentLocale": "en-001" });
    core_2.default.__addLocaleData({ "locale": "en-KI", "parentLocale": "en-001" });
    core_2.default.__addLocaleData({ "locale": "en-KN", "parentLocale": "en-001" });
    core_2.default.__addLocaleData({ "locale": "en-KY", "parentLocale": "en-001" });
    core_2.default.__addLocaleData({ "locale": "en-LC", "parentLocale": "en-001" });
    core_2.default.__addLocaleData({ "locale": "en-LR", "parentLocale": "en-001" });
    core_2.default.__addLocaleData({ "locale": "en-LS", "parentLocale": "en-001" });
    core_2.default.__addLocaleData({ "locale": "en-MG", "parentLocale": "en-001" });
    core_2.default.__addLocaleData({ "locale": "en-MH", "parentLocale": "en" });
    core_2.default.__addLocaleData({ "locale": "en-MO", "parentLocale": "en-001" });
    core_2.default.__addLocaleData({ "locale": "en-MP", "parentLocale": "en" });
    core_2.default.__addLocaleData({ "locale": "en-MS", "parentLocale": "en-001" });
    core_2.default.__addLocaleData({ "locale": "en-MT", "parentLocale": "en-001" });
    core_2.default.__addLocaleData({ "locale": "en-MU", "parentLocale": "en-001" });
    core_2.default.__addLocaleData({ "locale": "en-MW", "parentLocale": "en-001" });
    core_2.default.__addLocaleData({ "locale": "en-MY", "parentLocale": "en-001" });
    core_2.default.__addLocaleData({ "locale": "en-NA", "parentLocale": "en-001" });
    core_2.default.__addLocaleData({ "locale": "en-NF", "parentLocale": "en-001" });
    core_2.default.__addLocaleData({ "locale": "en-NG", "parentLocale": "en-001" });
    core_2.default.__addLocaleData({ "locale": "en-NL", "parentLocale": "en-150" });
    core_2.default.__addLocaleData({ "locale": "en-NR", "parentLocale": "en-001" });
    core_2.default.__addLocaleData({ "locale": "en-NU", "parentLocale": "en-001" });
    core_2.default.__addLocaleData({ "locale": "en-NZ", "parentLocale": "en-001" });
    core_2.default.__addLocaleData({ "locale": "en-PG", "parentLocale": "en-001" });
    core_2.default.__addLocaleData({ "locale": "en-PH", "parentLocale": "en-001" });
    core_2.default.__addLocaleData({ "locale": "en-PK", "parentLocale": "en-001" });
    core_2.default.__addLocaleData({ "locale": "en-PN", "parentLocale": "en-001" });
    core_2.default.__addLocaleData({ "locale": "en-PR", "parentLocale": "en" });
    core_2.default.__addLocaleData({ "locale": "en-PW", "parentLocale": "en-001" });
    core_2.default.__addLocaleData({ "locale": "en-RW", "parentLocale": "en-001" });
    core_2.default.__addLocaleData({ "locale": "en-SB", "parentLocale": "en-001" });
    core_2.default.__addLocaleData({ "locale": "en-SC", "parentLocale": "en-001" });
    core_2.default.__addLocaleData({ "locale": "en-SD", "parentLocale": "en-001" });
    core_2.default.__addLocaleData({ "locale": "en-SE", "parentLocale": "en-150" });
    core_2.default.__addLocaleData({ "locale": "en-SG", "parentLocale": "en-001" });
    core_2.default.__addLocaleData({ "locale": "en-SH", "parentLocale": "en-001" });
    core_2.default.__addLocaleData({ "locale": "en-SI", "parentLocale": "en-150" });
    core_2.default.__addLocaleData({ "locale": "en-SL", "parentLocale": "en-001" });
    core_2.default.__addLocaleData({ "locale": "en-SS", "parentLocale": "en-001" });
    core_2.default.__addLocaleData({ "locale": "en-SX", "parentLocale": "en-001" });
    core_2.default.__addLocaleData({ "locale": "en-SZ", "parentLocale": "en-001" });
    core_2.default.__addLocaleData({ "locale": "en-Shaw" });
    core_2.default.__addLocaleData({ "locale": "en-TC", "parentLocale": "en-001" });
    core_2.default.__addLocaleData({ "locale": "en-TK", "parentLocale": "en-001" });
    core_2.default.__addLocaleData({ "locale": "en-TO", "parentLocale": "en-001" });
    core_2.default.__addLocaleData({ "locale": "en-TT", "parentLocale": "en-001" });
    core_2.default.__addLocaleData({ "locale": "en-TV", "parentLocale": "en-001" });
    core_2.default.__addLocaleData({ "locale": "en-TZ", "parentLocale": "en-001" });
    core_2.default.__addLocaleData({ "locale": "en-UG", "parentLocale": "en-001" });
    core_2.default.__addLocaleData({ "locale": "en-UM", "parentLocale": "en" });
    core_2.default.__addLocaleData({ "locale": "en-US", "parentLocale": "en" });
    core_2.default.__addLocaleData({ "locale": "en-VC", "parentLocale": "en-001" });
    core_2.default.__addLocaleData({ "locale": "en-VG", "parentLocale": "en-001" });
    core_2.default.__addLocaleData({ "locale": "en-VI", "parentLocale": "en" });
    core_2.default.__addLocaleData({ "locale": "en-VU", "parentLocale": "en-001" });
    core_2.default.__addLocaleData({ "locale": "en-WS", "parentLocale": "en-001" });
    core_2.default.__addLocaleData({ "locale": "en-ZA", "parentLocale": "en-001" });
    core_2.default.__addLocaleData({ "locale": "en-ZM", "parentLocale": "en-001" });
    core_2.default.__addLocaleData({ "locale": "en-ZW", "parentLocale": "en-001" });
    core_2.default.__addLocaleData({ "locale": "eo" });
    core_2.default.__addLocaleData({ "locale": "es" });
    core_2.default.__addLocaleData({ "locale": "es-419", "parentLocale": "es" });
    core_2.default.__addLocaleData({ "locale": "es-AR", "parentLocale": "es-419" });
    core_2.default.__addLocaleData({ "locale": "es-BO", "parentLocale": "es-419" });
    core_2.default.__addLocaleData({ "locale": "es-BR", "parentLocale": "es-419" });
    core_2.default.__addLocaleData({ "locale": "es-BZ", "parentLocale": "es-419" });
    core_2.default.__addLocaleData({ "locale": "es-CL", "parentLocale": "es-419" });
    core_2.default.__addLocaleData({ "locale": "es-CO", "parentLocale": "es-419" });
    core_2.default.__addLocaleData({ "locale": "es-CR", "parentLocale": "es-419" });
    core_2.default.__addLocaleData({ "locale": "es-CU", "parentLocale": "es-419" });
    core_2.default.__addLocaleData({ "locale": "es-DO", "parentLocale": "es-419" });
    core_2.default.__addLocaleData({ "locale": "es-EA", "parentLocale": "es" });
    core_2.default.__addLocaleData({ "locale": "es-EC", "parentLocale": "es-419" });
    core_2.default.__addLocaleData({ "locale": "es-GQ", "parentLocale": "es" });
    core_2.default.__addLocaleData({ "locale": "es-GT", "parentLocale": "es-419" });
    core_2.default.__addLocaleData({ "locale": "es-HN", "parentLocale": "es-419" });
    core_2.default.__addLocaleData({ "locale": "es-IC", "parentLocale": "es" });
    core_2.default.__addLocaleData({ "locale": "es-MX", "parentLocale": "es-419" });
    core_2.default.__addLocaleData({ "locale": "es-NI", "parentLocale": "es-419" });
    core_2.default.__addLocaleData({ "locale": "es-PA", "parentLocale": "es-419" });
    core_2.default.__addLocaleData({ "locale": "es-PE", "parentLocale": "es-419" });
    core_2.default.__addLocaleData({ "locale": "es-PH", "parentLocale": "es" });
    core_2.default.__addLocaleData({ "locale": "es-PR", "parentLocale": "es-419" });
    core_2.default.__addLocaleData({ "locale": "es-PY", "parentLocale": "es-419" });
    core_2.default.__addLocaleData({ "locale": "es-SV", "parentLocale": "es-419" });
    core_2.default.__addLocaleData({ "locale": "es-US", "parentLocale": "es-419" });
    core_2.default.__addLocaleData({ "locale": "es-UY", "parentLocale": "es-419" });
    core_2.default.__addLocaleData({ "locale": "es-VE", "parentLocale": "es-419" });
    core_2.default.__addLocaleData({ "locale": "et" });
    core_2.default.__addLocaleData({ "locale": "eu" });
    core_2.default.__addLocaleData({ "locale": "ewo" });
    core_2.default.__addLocaleData({ "locale": "fa" });
    core_2.default.__addLocaleData({ "locale": "fa-AF", "parentLocale": "fa" });
    core_2.default.__addLocaleData({ "locale": "ff" });
    core_2.default.__addLocaleData({ "locale": "ff-Adlm" });
    core_2.default.__addLocaleData({ "locale": "ff-Latn", "parentLocale": "ff" });
    core_2.default.__addLocaleData({ "locale": "ff-Latn-BF", "parentLocale": "ff-Latn" });
    core_2.default.__addLocaleData({ "locale": "ff-Latn-CM", "parentLocale": "ff-Latn" });
    core_2.default.__addLocaleData({ "locale": "ff-Latn-GH", "parentLocale": "ff-Latn" });
    core_2.default.__addLocaleData({ "locale": "ff-Latn-GM", "parentLocale": "ff-Latn" });
    core_2.default.__addLocaleData({ "locale": "ff-Latn-GN", "parentLocale": "ff-Latn" });
    core_2.default.__addLocaleData({ "locale": "ff-Latn-GW", "parentLocale": "ff-Latn" });
    core_2.default.__addLocaleData({ "locale": "ff-Latn-LR", "parentLocale": "ff-Latn" });
    core_2.default.__addLocaleData({ "locale": "ff-Latn-MR", "parentLocale": "ff-Latn" });
    core_2.default.__addLocaleData({ "locale": "ff-Latn-NE", "parentLocale": "ff-Latn" });
    core_2.default.__addLocaleData({ "locale": "ff-Latn-NG", "parentLocale": "ff-Latn" });
    core_2.default.__addLocaleData({ "locale": "ff-Latn-SL", "parentLocale": "ff-Latn" });
    core_2.default.__addLocaleData({ "locale": "fi" });
    core_2.default.__addLocaleData({ "locale": "fil" });
    core_2.default.__addLocaleData({ "locale": "fo" });
    core_2.default.__addLocaleData({ "locale": "fo-DK", "parentLocale": "fo" });
    core_2.default.__addLocaleData({ "locale": "fr" });
    core_2.default.__addLocaleData({ "locale": "fr-BE", "parentLocale": "fr" });
    core_2.default.__addLocaleData({ "locale": "fr-BF", "parentLocale": "fr" });
    core_2.default.__addLocaleData({ "locale": "fr-BI", "parentLocale": "fr" });
    core_2.default.__addLocaleData({ "locale": "fr-BJ", "parentLocale": "fr" });
    core_2.default.__addLocaleData({ "locale": "fr-BL", "parentLocale": "fr" });
    core_2.default.__addLocaleData({ "locale": "fr-CA", "parentLocale": "fr" });
    core_2.default.__addLocaleData({ "locale": "fr-CD", "parentLocale": "fr" });
    core_2.default.__addLocaleData({ "locale": "fr-CF", "parentLocale": "fr" });
    core_2.default.__addLocaleData({ "locale": "fr-CG", "parentLocale": "fr" });
    core_2.default.__addLocaleData({ "locale": "fr-CH", "parentLocale": "fr" });
    core_2.default.__addLocaleData({ "locale": "fr-CI", "parentLocale": "fr" });
    core_2.default.__addLocaleData({ "locale": "fr-CM", "parentLocale": "fr" });
    core_2.default.__addLocaleData({ "locale": "fr-DJ", "parentLocale": "fr" });
    core_2.default.__addLocaleData({ "locale": "fr-DZ", "parentLocale": "fr" });
    core_2.default.__addLocaleData({ "locale": "fr-GA", "parentLocale": "fr" });
    core_2.default.__addLocaleData({ "locale": "fr-GF", "parentLocale": "fr" });
    core_2.default.__addLocaleData({ "locale": "fr-GN", "parentLocale": "fr" });
    core_2.default.__addLocaleData({ "locale": "fr-GP", "parentLocale": "fr" });
    core_2.default.__addLocaleData({ "locale": "fr-GQ", "parentLocale": "fr" });
    core_2.default.__addLocaleData({ "locale": "fr-HT", "parentLocale": "fr" });
    core_2.default.__addLocaleData({ "locale": "fr-KM", "parentLocale": "fr" });
    core_2.default.__addLocaleData({ "locale": "fr-LU", "parentLocale": "fr" });
    core_2.default.__addLocaleData({ "locale": "fr-MA", "parentLocale": "fr" });
    core_2.default.__addLocaleData({ "locale": "fr-MC", "parentLocale": "fr" });
    core_2.default.__addLocaleData({ "locale": "fr-MF", "parentLocale": "fr" });
    core_2.default.__addLocaleData({ "locale": "fr-MG", "parentLocale": "fr" });
    core_2.default.__addLocaleData({ "locale": "fr-ML", "parentLocale": "fr" });
    core_2.default.__addLocaleData({ "locale": "fr-MQ", "parentLocale": "fr" });
    core_2.default.__addLocaleData({ "locale": "fr-MR", "parentLocale": "fr" });
    core_2.default.__addLocaleData({ "locale": "fr-MU", "parentLocale": "fr" });
    core_2.default.__addLocaleData({ "locale": "fr-NC", "parentLocale": "fr" });
    core_2.default.__addLocaleData({ "locale": "fr-NE", "parentLocale": "fr" });
    core_2.default.__addLocaleData({ "locale": "fr-PF", "parentLocale": "fr" });
    core_2.default.__addLocaleData({ "locale": "fr-PM", "parentLocale": "fr" });
    core_2.default.__addLocaleData({ "locale": "fr-RE", "parentLocale": "fr" });
    core_2.default.__addLocaleData({ "locale": "fr-RW", "parentLocale": "fr" });
    core_2.default.__addLocaleData({ "locale": "fr-SC", "parentLocale": "fr" });
    core_2.default.__addLocaleData({ "locale": "fr-SN", "parentLocale": "fr" });
    core_2.default.__addLocaleData({ "locale": "fr-SY", "parentLocale": "fr" });
    core_2.default.__addLocaleData({ "locale": "fr-TD", "parentLocale": "fr" });
    core_2.default.__addLocaleData({ "locale": "fr-TG", "parentLocale": "fr" });
    core_2.default.__addLocaleData({ "locale": "fr-TN", "parentLocale": "fr" });
    core_2.default.__addLocaleData({ "locale": "fr-VU", "parentLocale": "fr" });
    core_2.default.__addLocaleData({ "locale": "fr-WF", "parentLocale": "fr" });
    core_2.default.__addLocaleData({ "locale": "fr-YT", "parentLocale": "fr" });
    core_2.default.__addLocaleData({ "locale": "fur" });
    core_2.default.__addLocaleData({ "locale": "fy" });
    core_2.default.__addLocaleData({ "locale": "ga" });
    core_2.default.__addLocaleData({ "locale": "gd" });
    core_2.default.__addLocaleData({ "locale": "gl" });
    core_2.default.__addLocaleData({ "locale": "gsw" });
    core_2.default.__addLocaleData({ "locale": "gsw-FR", "parentLocale": "gsw" });
    core_2.default.__addLocaleData({ "locale": "gsw-LI", "parentLocale": "gsw" });
    core_2.default.__addLocaleData({ "locale": "gu" });
    core_2.default.__addLocaleData({ "locale": "guw" });
    core_2.default.__addLocaleData({ "locale": "guz" });
    core_2.default.__addLocaleData({ "locale": "gv" });
    core_2.default.__addLocaleData({ "locale": "ha" });
    core_2.default.__addLocaleData({ "locale": "ha-Arab" });
    core_2.default.__addLocaleData({ "locale": "ha-GH", "parentLocale": "ha" });
    core_2.default.__addLocaleData({ "locale": "ha-NE", "parentLocale": "ha" });
    core_2.default.__addLocaleData({ "locale": "haw" });
    core_2.default.__addLocaleData({ "locale": "he" });
    core_2.default.__addLocaleData({ "locale": "hi" });
    core_2.default.__addLocaleData({ "locale": "hr" });
    core_2.default.__addLocaleData({ "locale": "hr-BA", "parentLocale": "hr" });
    core_2.default.__addLocaleData({ "locale": "hsb" });
    core_2.default.__addLocaleData({ "locale": "hu" });
    core_2.default.__addLocaleData({ "locale": "hy" });
    core_2.default.__addLocaleData({ "locale": "ia" });
    core_2.default.__addLocaleData({ "locale": "id" });
    core_2.default.__addLocaleData({ "locale": "ig" });
    core_2.default.__addLocaleData({ "locale": "ii" });
    core_2.default.__addLocaleData({ "locale": "in" });
    core_2.default.__addLocaleData({ "locale": "io" });
    core_2.default.__addLocaleData({ "locale": "is" });
    core_2.default.__addLocaleData({ "locale": "it" });
    core_2.default.__addLocaleData({ "locale": "it-CH", "parentLocale": "it" });
    core_2.default.__addLocaleData({ "locale": "it-SM", "parentLocale": "it" });
    core_2.default.__addLocaleData({ "locale": "it-VA", "parentLocale": "it" });
    core_2.default.__addLocaleData({ "locale": "iu" });
    core_2.default.__addLocaleData({ "locale": "iu-Latn" });
    core_2.default.__addLocaleData({ "locale": "iw" });
    core_2.default.__addLocaleData({ "locale": "ja" });
    core_2.default.__addLocaleData({ "locale": "jbo" });
    core_2.default.__addLocaleData({ "locale": "jgo" });
    core_2.default.__addLocaleData({ "locale": "ji" });
    core_2.default.__addLocaleData({ "locale": "jmc" });
    core_2.default.__addLocaleData({ "locale": "jv" });
    core_2.default.__addLocaleData({ "locale": "jw" });
    core_2.default.__addLocaleData({ "locale": "ka" });
    core_2.default.__addLocaleData({ "locale": "kab" });
    core_2.default.__addLocaleData({ "locale": "kaj" });
    core_2.default.__addLocaleData({ "locale": "kam" });
    core_2.default.__addLocaleData({ "locale": "kcg" });
    core_2.default.__addLocaleData({ "locale": "kde" });
    core_2.default.__addLocaleData({ "locale": "kea" });
    core_2.default.__addLocaleData({ "locale": "khq" });
    core_2.default.__addLocaleData({ "locale": "ki" });
    core_2.default.__addLocaleData({ "locale": "kk" });
    core_2.default.__addLocaleData({ "locale": "kkj" });
    core_2.default.__addLocaleData({ "locale": "kl" });
    core_2.default.__addLocaleData({ "locale": "kln" });
    core_2.default.__addLocaleData({ "locale": "km" });
    core_2.default.__addLocaleData({ "locale": "kn" });
    core_2.default.__addLocaleData({ "locale": "ko" });
    core_2.default.__addLocaleData({ "locale": "ko-KP", "parentLocale": "ko" });
    core_2.default.__addLocaleData({ "locale": "kok" });
    core_2.default.__addLocaleData({ "locale": "ks" });
    core_2.default.__addLocaleData({ "locale": "ksb" });
    core_2.default.__addLocaleData({ "locale": "ksf" });
    core_2.default.__addLocaleData({ "locale": "ksh" });
    core_2.default.__addLocaleData({ "locale": "ku" });
    core_2.default.__addLocaleData({ "locale": "kw" });
    core_2.default.__addLocaleData({ "locale": "ky" });
    core_2.default.__addLocaleData({ "locale": "lag" });
    core_2.default.__addLocaleData({ "locale": "lb" });
    core_2.default.__addLocaleData({ "locale": "lg" });
    core_2.default.__addLocaleData({ "locale": "lkt" });
    core_2.default.__addLocaleData({ "locale": "ln" });
    core_2.default.__addLocaleData({ "locale": "ln-AO", "parentLocale": "ln" });
    core_2.default.__addLocaleData({ "locale": "ln-CF", "parentLocale": "ln" });
    core_2.default.__addLocaleData({ "locale": "ln-CG", "parentLocale": "ln" });
    core_2.default.__addLocaleData({ "locale": "lo" });
    core_2.default.__addLocaleData({ "locale": "lrc" });
    core_2.default.__addLocaleData({ "locale": "lrc-IQ", "parentLocale": "lrc" });
    core_2.default.__addLocaleData({ "locale": "lt" });
    core_2.default.__addLocaleData({ "locale": "lu" });
    core_2.default.__addLocaleData({ "locale": "luo" });
    core_2.default.__addLocaleData({ "locale": "luy" });
    core_2.default.__addLocaleData({ "locale": "lv" });
    core_2.default.__addLocaleData({ "locale": "mas" });
    core_2.default.__addLocaleData({ "locale": "mas-TZ", "parentLocale": "mas" });
    core_2.default.__addLocaleData({ "locale": "mer" });
    core_2.default.__addLocaleData({ "locale": "mfe" });
    core_2.default.__addLocaleData({ "locale": "mg" });
    core_2.default.__addLocaleData({ "locale": "mgh" });
    core_2.default.__addLocaleData({ "locale": "mgo" });
    core_2.default.__addLocaleData({ "locale": "mi" });
    core_2.default.__addLocaleData({ "locale": "mk" });
    core_2.default.__addLocaleData({ "locale": "ml" });
    core_2.default.__addLocaleData({ "locale": "mn" });
    core_2.default.__addLocaleData({ "locale": "mn-Mong" });
    core_2.default.__addLocaleData({ "locale": "mo" });
    core_2.default.__addLocaleData({ "locale": "mr" });
    core_2.default.__addLocaleData({ "locale": "ms" });
    core_2.default.__addLocaleData({ "locale": "ms-Arab" });
    core_2.default.__addLocaleData({ "locale": "ms-BN", "parentLocale": "ms" });
    core_2.default.__addLocaleData({ "locale": "ms-SG", "parentLocale": "ms" });
    core_2.default.__addLocaleData({ "locale": "mt" });
    core_2.default.__addLocaleData({ "locale": "mua" });
    core_2.default.__addLocaleData({ "locale": "my" });
    core_2.default.__addLocaleData({ "locale": "mzn" });
    core_2.default.__addLocaleData({ "locale": "nah" });
    core_2.default.__addLocaleData({ "locale": "naq" });
    core_2.default.__addLocaleData({ "locale": "nb" });
    core_2.default.__addLocaleData({ "locale": "nb-SJ", "parentLocale": "nb" });
    core_2.default.__addLocaleData({ "locale": "nd" });
    core_2.default.__addLocaleData({ "locale": "nds" });
    core_2.default.__addLocaleData({ "locale": "nds-NL", "parentLocale": "nds" });
    core_2.default.__addLocaleData({ "locale": "ne" });
    core_2.default.__addLocaleData({ "locale": "ne-IN", "parentLocale": "ne" });
    core_2.default.__addLocaleData({ "locale": "nl" });
    core_2.default.__addLocaleData({ "locale": "nl-AW", "parentLocale": "nl" });
    core_2.default.__addLocaleData({ "locale": "nl-BE", "parentLocale": "nl" });
    core_2.default.__addLocaleData({ "locale": "nl-BQ", "parentLocale": "nl" });
    core_2.default.__addLocaleData({ "locale": "nl-CW", "parentLocale": "nl" });
    core_2.default.__addLocaleData({ "locale": "nl-SR", "parentLocale": "nl" });
    core_2.default.__addLocaleData({ "locale": "nl-SX", "parentLocale": "nl" });
    core_2.default.__addLocaleData({ "locale": "nmg" });
    core_2.default.__addLocaleData({ "locale": "nn" });
    core_2.default.__addLocaleData({ "locale": "nnh" });
    core_2.default.__addLocaleData({ "locale": "no" });
    core_2.default.__addLocaleData({ "locale": "nqo" });
    core_2.default.__addLocaleData({ "locale": "nr" });
    core_2.default.__addLocaleData({ "locale": "nso" });
    core_2.default.__addLocaleData({ "locale": "nus" });
    core_2.default.__addLocaleData({ "locale": "ny" });
    core_2.default.__addLocaleData({ "locale": "nyn" });
    core_2.default.__addLocaleData({ "locale": "om" });
    core_2.default.__addLocaleData({ "locale": "om-KE", "parentLocale": "om" });
    core_2.default.__addLocaleData({ "locale": "or" });
    core_2.default.__addLocaleData({ "locale": "os" });
    core_2.default.__addLocaleData({ "locale": "os-RU", "parentLocale": "os" });
    core_2.default.__addLocaleData({ "locale": "pa" });
    core_2.default.__addLocaleData({ "locale": "pa-Arab" });
    core_2.default.__addLocaleData({ "locale": "pa-Guru", "parentLocale": "pa" });
    core_2.default.__addLocaleData({ "locale": "pap" });
    core_2.default.__addLocaleData({ "locale": "pl" });
    core_2.default.__addLocaleData({ "locale": "prg" });
    core_2.default.__addLocaleData({ "locale": "ps" });
    core_2.default.__addLocaleData({ "locale": "pt" });
    core_2.default.__addLocaleData({ "locale": "pt-AO", "parentLocale": "pt-PT" });
    core_2.default.__addLocaleData({ "locale": "pt-PT", "parentLocale": "pt" });
    core_2.default.__addLocaleData({ "locale": "pt-CH", "parentLocale": "pt-PT" });
    core_2.default.__addLocaleData({ "locale": "pt-CV", "parentLocale": "pt-PT" });
    core_2.default.__addLocaleData({ "locale": "pt-GQ", "parentLocale": "pt-PT" });
    core_2.default.__addLocaleData({ "locale": "pt-GW", "parentLocale": "pt-PT" });
    core_2.default.__addLocaleData({ "locale": "pt-LU", "parentLocale": "pt-PT" });
    core_2.default.__addLocaleData({ "locale": "pt-MO", "parentLocale": "pt-PT" });
    core_2.default.__addLocaleData({ "locale": "pt-MZ", "parentLocale": "pt-PT" });
    core_2.default.__addLocaleData({ "locale": "pt-ST", "parentLocale": "pt-PT" });
    core_2.default.__addLocaleData({ "locale": "pt-TL", "parentLocale": "pt-PT" });
    core_2.default.__addLocaleData({ "locale": "qu" });
    core_2.default.__addLocaleData({ "locale": "qu-BO", "parentLocale": "qu" });
    core_2.default.__addLocaleData({ "locale": "qu-EC", "parentLocale": "qu" });
    core_2.default.__addLocaleData({ "locale": "rm" });
    core_2.default.__addLocaleData({ "locale": "rn" });
    core_2.default.__addLocaleData({ "locale": "ro" });
    core_2.default.__addLocaleData({ "locale": "ro-MD", "parentLocale": "ro" });
    core_2.default.__addLocaleData({ "locale": "rof" });
    core_2.default.__addLocaleData({ "locale": "ru" });
    core_2.default.__addLocaleData({ "locale": "ru-BY", "parentLocale": "ru" });
    core_2.default.__addLocaleData({ "locale": "ru-KG", "parentLocale": "ru" });
    core_2.default.__addLocaleData({ "locale": "ru-KZ", "parentLocale": "ru" });
    core_2.default.__addLocaleData({ "locale": "ru-MD", "parentLocale": "ru" });
    core_2.default.__addLocaleData({ "locale": "ru-UA", "parentLocale": "ru" });
    core_2.default.__addLocaleData({ "locale": "rw" });
    core_2.default.__addLocaleData({ "locale": "rwk" });
    core_2.default.__addLocaleData({ "locale": "sah" });
    core_2.default.__addLocaleData({ "locale": "saq" });
    core_2.default.__addLocaleData({ "locale": "sbp" });
    core_2.default.__addLocaleData({ "locale": "sc" });
    core_2.default.__addLocaleData({ "locale": "scn" });
    core_2.default.__addLocaleData({ "locale": "sd" });
    core_2.default.__addLocaleData({ "locale": "sdh" });
    core_2.default.__addLocaleData({ "locale": "se" });
    core_2.default.__addLocaleData({ "locale": "se-FI", "parentLocale": "se" });
    core_2.default.__addLocaleData({ "locale": "se-SE", "parentLocale": "se" });
    core_2.default.__addLocaleData({ "locale": "seh" });
    core_2.default.__addLocaleData({ "locale": "ses" });
    core_2.default.__addLocaleData({ "locale": "sg" });
    core_2.default.__addLocaleData({ "locale": "sh" });
    core_2.default.__addLocaleData({ "locale": "shi" });
    core_2.default.__addLocaleData({ "locale": "shi-Latn" });
    core_2.default.__addLocaleData({ "locale": "shi-Tfng", "parentLocale": "shi" });
    core_2.default.__addLocaleData({ "locale": "si" });
    core_2.default.__addLocaleData({ "locale": "sk" });
    core_2.default.__addLocaleData({ "locale": "sl" });
    core_2.default.__addLocaleData({ "locale": "sma" });
    core_2.default.__addLocaleData({ "locale": "smi" });
    core_2.default.__addLocaleData({ "locale": "smj" });
    core_2.default.__addLocaleData({ "locale": "smn" });
    core_2.default.__addLocaleData({ "locale": "sms" });
    core_2.default.__addLocaleData({ "locale": "sn" });
    core_2.default.__addLocaleData({ "locale": "so" });
    core_2.default.__addLocaleData({ "locale": "so-DJ", "parentLocale": "so" });
    core_2.default.__addLocaleData({ "locale": "so-ET", "parentLocale": "so" });
    core_2.default.__addLocaleData({ "locale": "so-KE", "parentLocale": "so" });
    core_2.default.__addLocaleData({ "locale": "sq" });
    core_2.default.__addLocaleData({ "locale": "sq-MK", "parentLocale": "sq" });
    core_2.default.__addLocaleData({ "locale": "sq-XK", "parentLocale": "sq" });
    core_2.default.__addLocaleData({ "locale": "sr" });
    core_2.default.__addLocaleData({ "locale": "sr-Cyrl", "parentLocale": "sr" });
    core_2.default.__addLocaleData({ "locale": "sr-Cyrl-BA", "parentLocale": "sr-Cyrl" });
    core_2.default.__addLocaleData({ "locale": "sr-Cyrl-ME", "parentLocale": "sr-Cyrl" });
    core_2.default.__addLocaleData({ "locale": "sr-Cyrl-XK", "parentLocale": "sr-Cyrl" });
    core_2.default.__addLocaleData({ "locale": "sr-Latn" });
    core_2.default.__addLocaleData({ "locale": "sr-Latn-BA", "parentLocale": "sr-Latn" });
    core_2.default.__addLocaleData({ "locale": "sr-Latn-ME", "parentLocale": "sr-Latn" });
    core_2.default.__addLocaleData({ "locale": "sr-Latn-XK", "parentLocale": "sr-Latn" });
    core_2.default.__addLocaleData({ "locale": "ss" });
    core_2.default.__addLocaleData({ "locale": "ssy" });
    core_2.default.__addLocaleData({ "locale": "st" });
    core_2.default.__addLocaleData({ "locale": "sv" });
    core_2.default.__addLocaleData({ "locale": "sv-AX", "parentLocale": "sv" });
    core_2.default.__addLocaleData({ "locale": "sv-FI", "parentLocale": "sv" });
    core_2.default.__addLocaleData({ "locale": "sw" });
    core_2.default.__addLocaleData({ "locale": "sw-CD", "parentLocale": "sw" });
    core_2.default.__addLocaleData({ "locale": "sw-KE", "parentLocale": "sw" });
    core_2.default.__addLocaleData({ "locale": "sw-UG", "parentLocale": "sw" });
    core_2.default.__addLocaleData({ "locale": "syr" });
    core_2.default.__addLocaleData({ "locale": "ta" });
    core_2.default.__addLocaleData({ "locale": "ta-LK", "parentLocale": "ta" });
    core_2.default.__addLocaleData({ "locale": "ta-MY", "parentLocale": "ta" });
    core_2.default.__addLocaleData({ "locale": "ta-SG", "parentLocale": "ta" });
    core_2.default.__addLocaleData({ "locale": "te" });
    core_2.default.__addLocaleData({ "locale": "teo" });
    core_2.default.__addLocaleData({ "locale": "teo-KE", "parentLocale": "teo" });
    core_2.default.__addLocaleData({ "locale": "tg" });
    core_2.default.__addLocaleData({ "locale": "th" });
    core_2.default.__addLocaleData({ "locale": "ti" });
    core_2.default.__addLocaleData({ "locale": "ti-ER", "parentLocale": "ti" });
    core_2.default.__addLocaleData({ "locale": "tig" });
    core_2.default.__addLocaleData({ "locale": "tk" });
    core_2.default.__addLocaleData({ "locale": "tl" });
    core_2.default.__addLocaleData({ "locale": "tn" });
    core_2.default.__addLocaleData({ "locale": "to" });
    core_2.default.__addLocaleData({ "locale": "tr" });
    core_2.default.__addLocaleData({ "locale": "tr-CY", "parentLocale": "tr" });
    core_2.default.__addLocaleData({ "locale": "ts" });
    core_2.default.__addLocaleData({ "locale": "tt" });
    core_2.default.__addLocaleData({ "locale": "twq" });
    core_2.default.__addLocaleData({ "locale": "tzm" });
    core_2.default.__addLocaleData({ "locale": "ug" });
    core_2.default.__addLocaleData({ "locale": "uk" });
    core_2.default.__addLocaleData({ "locale": "ur" });
    core_2.default.__addLocaleData({ "locale": "ur-IN", "parentLocale": "ur" });
    core_2.default.__addLocaleData({ "locale": "uz" });
    core_2.default.__addLocaleData({ "locale": "uz-Arab" });
    core_2.default.__addLocaleData({ "locale": "uz-Cyrl" });
    core_2.default.__addLocaleData({ "locale": "uz-Latn", "parentLocale": "uz" });
    core_2.default.__addLocaleData({ "locale": "vai" });
    core_2.default.__addLocaleData({ "locale": "vai-Latn" });
    core_2.default.__addLocaleData({ "locale": "vai-Vaii", "parentLocale": "vai" });
    core_2.default.__addLocaleData({ "locale": "ve" });
    core_2.default.__addLocaleData({ "locale": "vi" });
    core_2.default.__addLocaleData({ "locale": "vo" });
    core_2.default.__addLocaleData({ "locale": "vun" });
    core_2.default.__addLocaleData({ "locale": "wa" });
    core_2.default.__addLocaleData({ "locale": "wae" });
    core_2.default.__addLocaleData({ "locale": "wo" });
    core_2.default.__addLocaleData({ "locale": "xh" });
    core_2.default.__addLocaleData({ "locale": "xog" });
    core_2.default.__addLocaleData({ "locale": "yav" });
    core_2.default.__addLocaleData({ "locale": "yi" });
    core_2.default.__addLocaleData({ "locale": "yo" });
    core_2.default.__addLocaleData({ "locale": "yo-BJ", "parentLocale": "yo" });
    core_2.default.__addLocaleData({ "locale": "yue" });
    core_2.default.__addLocaleData({ "locale": "yue-Hans" });
    core_2.default.__addLocaleData({ "locale": "yue-Hant", "parentLocale": "yue" });
    core_2.default.__addLocaleData({ "locale": "zgh" });
    core_2.default.__addLocaleData({ "locale": "zh" });
    core_2.default.__addLocaleData({ "locale": "zh-Hans", "parentLocale": "zh" });
    core_2.default.__addLocaleData({ "locale": "zh-Hans-HK", "parentLocale": "zh-Hans" });
    core_2.default.__addLocaleData({ "locale": "zh-Hans-MO", "parentLocale": "zh-Hans" });
    core_2.default.__addLocaleData({ "locale": "zh-Hans-SG", "parentLocale": "zh-Hans" });
    core_2.default.__addLocaleData({ "locale": "zh-Hant" });
    core_2.default.__addLocaleData({ "locale": "zh-Hant-HK", "parentLocale": "zh-Hant" });
    core_2.default.__addLocaleData({ "locale": "zh-Hant-MO", "parentLocale": "zh-Hant-HK" });
    core_2.default.__addLocaleData({ "locale": "zu" });
    exports.default = core_2.default;
});
