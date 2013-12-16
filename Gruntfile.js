module.exports = function (grunt) {

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        jshint: {
            all: ['index.js', 'tests/*.js']
        },
        'build-data': {
            dest: 'locale-data'
        }
    });

    grunt.loadTasks('./tasks');

    grunt.loadNpmTasks('grunt-contrib-jshint');

    grunt.registerTask('default', ['jshint']);
};
