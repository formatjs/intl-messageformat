module.exports = function (grunt) {

    var libpath = require('path');

    grunt.initConfig({
        "pkg": grunt.file.readJSON('package.json'),
        "jshint": {
            "all": ['index.js', 'src/core.js', 'tests/*.js']
        },
        "build-data": {
            "dest": 'src/locale-data.js'
        },
        "compile-modules": {
            "cwd": './',
            "src": 'src/umd.js',
            "dest": 'build/intl-messageformat.js'
        },
        "uglify": {
            "options": {
                "preserveComments": 'some'
            },
            "all": {
                "expand": true,
                "flatten": true,
                "src": ['build/*.js', '!build/*.min.js'],
                "dest": 'build',
                "rename": function(dest, src) {
                    var ext = libpath.extname(src),
                        base = libpath.basename(src, ext);
                    return libpath.resolve(dest, base + '.min' + ext);
                }
            }
        }
    });

    grunt.loadTasks('./tasks');

    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-uglify');

    grunt.registerTask('cldr', ['build-data']);
    grunt.registerTask('build', ['compile-modules', 'uglify:all']);
    grunt.registerTask('default', ['jshint']);
};
