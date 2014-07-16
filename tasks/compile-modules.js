module.exports = function(grunt) {

    var libpath = require('path');
    var recast = require('recast');
    var formatters = require('es6-module-transpiler/lib/formatters');
    var FileResolver = require('es6-module-transpiler/lib/file_resolver');
    var Container = require('es6-module-transpiler/lib/container');
    var FileResolver = require('es6-module-transpiler/lib/file_resolver');
    var formatter = formatters[formatters.DEFAULT];
    var resolverClasses = [FileResolver];

    grunt.registerTask('compile-modules', 'transpile ES6 modules into ES5 bundles', function () {
        var config = grunt.config.data['compile-modules'] || {};

        if (typeof formatter === 'function') {
          formatter = new formatter();
        }

        var resolvers = resolverClasses.map(function(resolverClass) {
          return new resolverClass([libpath.resolve(config.cwd)]);
        });

        var container = new Container({
          formatter: formatter,
          resolvers: resolvers
        });

        try {
            container.getModule(config.src);
            var outputs = container.convert();
        } catch (err) {
            grunt.fatal('Error converting ES6 modules: ' + err);
        }

        try {
            var code = recast.print(outputs[0]).code;
        } catch (err) {
            grunt.fatal('Error printing AST: ' + err);
        }

        grunt.file.mkdir(libpath.dirname(config.dest));
        grunt.file.write(config.dest, code, {encoding: 'utf8'});

        grunt.log.ok('Transpiled module in ' + config.dest);
    });

};
