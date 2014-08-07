module.exports = function (grunt) {

    var libpath = require('path');

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        jshint: {
            all: ['index.js', 'src/core.js', 'tests/*.js']
        },
        build_locale_data: {
            dest: 'src/full.js'
        },
        bundle_jsnext: {
            options: {
                namespace: 'IntlMessageFormat'
            },
            dest: 'dist/intl-messageformat.js'
        },
        cjs_jsnext: {
            dest: 'lib/'
        },
        uglify: {
            options: {
                preserveComments: 'some'
            },
            dist: {
                expand: true,
                flatten: true,
                src: ['dist/*.js', '!dist/*.min.js'],
                dest: 'dist/',
                rename: function(dest, src) {
                    var ext = libpath.extname(src),
                        base = libpath.basename(src, ext);
                    return libpath.resolve(dest, base + '.min' + ext);
                }
            }
        },
        benchmark: {
            construct: {
                src: ['tests/benchmark/new*.js']
            },
            format: {
                src: ['tests/benchmark/format*.js']
            }
        }
    });

    grunt.loadTasks('./tasks');

    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-bundle-jsnext-lib');
    grunt.loadNpmTasks('grunt-benchmark');

    grunt.registerTask('cldr', ['build_locale_data']);
    grunt.registerTask('build', ['bundle_jsnext', 'cjs_jsnext', 'uglify:dist']);
    grunt.registerTask('default', ['jshint']);
};
