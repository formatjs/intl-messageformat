Intl Message Format Polyfill
============================

[![Build Status](https://travis-ci.org/yahoo/intl-messageformat.png?branch=master)](https://travis-ci.org/yahoo/intl-messageformat)

Format a string with placeholders, including plural and gender support to
create localized messages.


Overview
--------

### Goals

To provide a standardized way to concatenate strings with localization support
in JavaScript on both the server and client.

This implementation is based on the
[http://wiki.ecmascript.org/doku.php?id=globalization:messageformatting][MessageFormat Strawman].
There are a few places this diverges from the strawman. One such place is the
object passed to the `format` method. The strawman indicates that the objects
should be "flat" where grouping options are at the same level as the `type`
and `valueName`. This, as an example, would look like:
```
{
    type: "plural",
    valueName: "TRAVELER_COUNT",
    zero: "No travelers",
    one: "One traveler",
    two: "Two travelers",
    few: "There are a few travelers",
    many: "There are many travelers",
    other: "There are a lot of travelers"
}
```
This implementation takes a readability approach and places grouping options
in an `options` key. This looks like:
```
{
    type: "plural",
    valueName: "TRAVELER_COUNT",
    options: {
        zero: "No travelers",
        one: "One traveler",
        two: "Two travelers",
        few: "There are a few travelers",
        many: "There are many travelers",
        other: "There are a lot of travelers"
    }
}
```

The strawman also makes mention of built-in formatters for integers, floating
point numbers and strings. These built in formatters are not in this
implementation, but you may provide formatters as user defined methods as a
third parameter when you instantiate the IntlMessageFormatter.

### How It Works

Messages are provided into the constructor as Arrays or simple String
messages. Strings are then broken up and processed into a workable Array. The
Array is stored internally until the format method is called with an Object
containing parameters for generating the message. The Array is then processed
by converting Objects into strings based on the paramters provided and
concatenating the values together.

### Features
Custom formatters can be used to format the value __after__ it is gathered from
the original process. Custom formatters are applied to the message during
construction.


Installation
------------

Install using npm:

```shell
$ npm install intl-messageformat
```


Usage
-----


### Creating a Message in Node.js

Message creating is done using the IntlMessageFormat contstructor as:

```javascript
var IntlMessageFormat = require('intl-messageformat');
// load some locales that you care about
require('intl-messageformat/locale-data/en.js');
require('intl-messageformat/locale-data/ar.js');
require('intl-messageformat/locale-data/pl.js');

var msg = new IntlMessageFormat("My name is ${name}.", "en-US");
```

### Creating a Message in a Browser

Message creation is done using the IntlMessageFormat constructor as:

```javascript
var msg = new IntlMessageFormat("My name is ${name}.", "en-US");
```



### Formatting a Message

Once the message is created, formatting the message is done by calling the
`format` method of the instantiated object:

```javascript
var myNameIs = msg.format({ name: "Ferris Wheeler"});

// myNameIs === "My name is Ferris Wheeler."
```


Locale Data
-----------

This package ships with locale data for the top-level locales (e.g. `en` but not `en-US`).
You can load the library and locale(s) using any of the following subpaths in the package:

* Load the base and then just the locale(s) that you need: `intl-messageformat/index.js` and `intl-messageformat/locale-data/{locale}.js`.
* Load the base with a single locale builtin: `intl-messageformat/build/index.{locale}.js')`. You can then optionally add more locale(s) as above.
* Load all locales: `intl-messageformat/build/index.complete.js`.


### Loading Locale Data in Node.js

**Please note** that if you are loading from the `locale-data/` directory that those files are expecting the library to be available in the `IntlMessageFormat` variable.


### Loading Locale Data in a Browser

Every `intl-messageformat/build/*.js` file also has an `intl-messageformat/build/*.min.js` equivalent which has already been minified.


Examples
--------


#### Simple String
```javascript
var msg = new IntlMessageFormat("My name is ${name}.", "en-US");

var myNameIs = msg.format({ name: "Ferris Wheeler"});

// myNameIs === "My name is Ferris Wheeler."
```


#### Complex Formatting
```javascript
var msg = new IntlMessageFormat(['Some text before ', {
    type: 'plural',
    valueName: 'numPeople',
    offset: 1,
    options: {
        one: 'Some message ${ph} with ${#} value',

        few: ['Optional prefix text for |few| ', {
            type: 'select',
            valueName: 'gender',
            options: {
                male: 'Text for male option with \' single quotes',
                female: 'Text for female option with {}',
                other: 'Text for default'
            }
        }, ' optional postfix text'],

        other: 'Some messages for the default'
    }
}, ' and text after'], "en-US");

var complex = msg.format({
    numPeople: 4,
    ph: 'whatever',
    gender: 'male'
});

// complex === "Some text before Optional prefix text for |few| Text for male option with ' single quotes optional postfix text and text after"
```

#### User Defined Formatters
User defined formatters are provided to the IntlMessageFormat as the third
parameter. To denote a key should be process through a formatter, you need
only provide the formatter name after the token key. Such as, `${key}` would
then become `${key:formatter}`. This is an example of using the
Intl.NumberFormat to create a currency formatter.

```
var msg = new IntlMessageFormatter("I just made ${TOTAL:currency}!!", "en-US", {
    currency: function (val, locale) {
        return new Intl.NumberFormat(val, {
            style: 'currency',
            currency: 'USD',
            currencyDisplay: 'code'
        });
    }
});
```


API
---

### Constructor

Creates IntlMessageFormat object from a pattern, locale and field formatters.
String patterns are broken down Arrays. Objects should match the
following pattern:

```javascript
{
    type: 'plural|gender|select',
    valueName: 'string',
    offset: 1, // consistent offsets for plurals
    options: {}, // keys match options for plurals, gender and selects
    formatter: 'string|function' // strings are matched to internal formatters
}
```

**Parameters**

* `locale`: __{LocaleList|String}__ Locale for string formatting and when Date
and Number

* `pattern`: __{Array|String}__ Array or string that serves as formatting
pattern

* `optFieldFormatters`: __{Object}__ Holds user defined formatters for each
field



### Instace Methods

#### `format`
Formats pattern with supplied parameters.
Dates, times and numbers are formatted in locale sensitive way.

**Parameters**

* `params`: __{Array|Object}__ Object used to choose options when formatting
the message


#### `resolvedOptions`
Returns resolved options, in this case supported locale.


License
-------

This software is free to use under the Yahoo! Inc. BSD license.
See the [LICENSE file][] for license text and copyright information.


[LICENSE file]: https://github.com/yahoo/intl-messageformat/blob/master/LICENSE
