/*
 * grunt-handbook
 * https://github.com/boycook/grunt-handbook
 *
 * Copyright (c) 2015 Craig COok
 * Licensed under the MIT license.
 */

'use strict';

module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    jshint: {
      all: [
        'Gruntfile.js',
        'tasks/*.js',
        '<%= nodeunit.tests %>'
      ],
      options: {
        jshintrc: '.jshintrc'
      }
    },

    // Before generating any new files, remove any previously-created files.
    clean: {
      tests: ['tmp']
    },

    // Configuration to be run (and then tested).
    sac2mHandbook: {
      options: {
        url: 'http://sac2m.tiddlyspace.com/bags/sac2m_public/tiddlers?select=tag:handbook&render=1&sort=title',
        target: 'tmp',
        configFile: 'tmp/config.json',
        jsonFile: 'tmp/index.json',
        ignoreTags: ['quote'],
        stripTags: ['handbook'],
        siteMap: {
          url: 'https://code/red/handbook/',
          file: 'tmp/sitemap.xml'
        },
        templates: {
          "default": 'test/template.html',
          home: 'test/template2.html'
        }
      },      
      default_options: {},
      custom_options: {}
    },

    // Unit tests.
    nodeunit: {
      tests: ['test/*_test.js']
    }
  });

  // Actually load this plugin's task(s).
  grunt.loadTasks('tasks');

  // These plugins provide necessary tasks.
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-nodeunit');

  // Whenever the "test" task is run, first clean the "tmp" dir, then run this
  // plugin's task(s), then test the result.
  grunt.registerTask('test', ['clean', 'sac2mHandbook', 'nodeunit']);

  // By default, lint and run all tests.
  grunt.registerTask('default', ['jshint', 'test']);

};
