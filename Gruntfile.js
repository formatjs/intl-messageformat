module.exports = function (grunt) {

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        jshint: {
            all: ['index.js', 'tests/*.js']
        },
        'build-data': {
            dest: 'locale-data'
        },
        localize: {
            src: 'locale-data',
            dest: 'build'
        }
    });

    grunt.loadTasks('./tasks');

    grunt.loadNpmTasks('grunt-contrib-jshint');

    grunt.registerTask('build', ['localize']);
    grunt.registerTask('default', ['jshint']);
};
