module.exports = function(grunt) {

    var querystring = require('querystring');


    function generatePluralizationCode(cldr, config) {
        var indent = (config.indent ? new Array(parseInt(config.indent, 10) + 1).join(' ') : ''),
            unique  = {},   // key is stringified function, value is index in `bodies`
            bodies  = [],   // key is function unique ID, value is the function bodies
            locales = {},   // key is locale, value is index of func to use
            i,
            last,
            lines = [];

        cldr.localeIds.forEach(function(locale) {
            var func,
                key;
            func = cldr.extractPluralRuleFunction(locale);
            key = func.toString();
            if (!unique.hasOwnProperty(key)) {
                i = Object.keys(unique).length;
                unique[key] = i;
                bodies[i] = func;
            }
            locales[locale] = unique[key];
        });

        i = 0;
        last = bodies.length - 1;
        lines.push(config.prefix + 'Functions = [');
        bodies.forEach(function (body) {
            var str = body.toString();

            // not sure if repeated function name will cause trouble
            str = str.replace('function anonymous(', 'function (');

            // js-hint cleanup
            str = str.replace('"\n}', '";\n}');
            // TODO:  fix W018 "Confusing use of '!'"

            lines.push(indent + str + (i === last ? '' : ','));
            i++;
        });
        lines.push('];');

        i = 0;
        last = Object.keys(locales).length - 1;
        lines.push(config.prefix + 'Locales = {');
        Object.keys(locales).forEach(function (locale) {
            var idx = locales[locale],
                root;
            root = locale.split('_')[0];
            if (locale !== root) {
                if (idx === locales[root]) {
                    return;
                }
            }
            lines.push(indent + JSON.stringify(locale) + ': ' + config.prefix + 'Functions[' + idx + ']' + (i === last ? '' : ','));
            i++;
        });
        lines.push('};');

        return indent + lines.join('\n' + indent) + '\n';
    }

    grunt.registerTask('replural', 'update index.js with latest pluralization rules (requires `cldr` NPM package)', function () {
        var cldr,
            body;

        try {
            cldr = require('cldr');
        } catch (err) {
            grunt.fatal("`cldr` NPM package not available. please `npm i cldr` and try again");
        }

        body = grunt.file.read('index.js');

        ///-------GENERATED PLURALIZATION BEGIN (config)
        ///-------GENERATED PLURALIZATION END
        body = body.replace(/(\/\/\/-------GENERATED PLURALIZATION BEGIN \(([^)]*)\)\n)[\s\S]*?(\s*\/\/\/-------GENERATED PLURALIZATION END)/, function($0, prefix, config, suffix) {
            var code;
            config = querystring.parse(config);
            code = generatePluralizationCode(cldr, config) || '';
            return prefix + code + suffix;
        });

        grunt.file.write('index.js', body, {encoding: 'utf8'});

        grunt.log.ok('File `index.js` updated.');
        grunt.log.warn("WARNING:  the generated code is UGLY and WON'T PASS LINT");
        grunt.log.warn("It really should be cleaned up by hand (I've done all I could).");
    });

};
