/*
 * grunt-handbook
 * https://github.com/boycook/grunt-handbook
 *
 * Copyright (c) 2015 Craig COok
 * Licensed under the MIT license.
 */

'use strict';

var fs = require('fs');
var http = require('http');
var request = require('request');
var url = 'http://sac2m.tiddlyspace.com/bags/sac2m_public/tiddlers?select=tag:handbook&render=1';

var handlebarsTemplate = "{{> html_tag }} {{> head }}  <body> {{> google_analytics }}  {{> menu }}  {{> poster this.poster }}  {{> handbook_content }}  {{> footer }}  </body>  {{> scripts }}  </html>";

module.exports = function(grunt) {

  // Please see the Grunt documentation for more information regarding task
  // creation: http://gruntjs.com/creating-tasks

  function writeTiddler(path, data) {
    fs.writeFileSync(path, data);
  }

  function getTiddlers(next) {
    var tiddlers;
    var options = {
      url: url,
      headers: {
        'Accept': 'application/json'
      }
    };
     
    function callback(error, response, body) {
      if (!error && response.statusCode === 200) {
        var tiddlers = JSON.parse(body);
        for (var i = 0, len = tiddlers.length; i < len; i++) {
            var tiddler = tiddlers[i];
            var json = {
              "description": "SAC2M Handbook - " + tiddler.title,
              "extends": ["base.json"],
              "targetPath" : "index.html",
              "partials%add": [],
              "depth": "../",
              "title": tiddler.title,
              "content": tiddler.render
            };

            var text = JSON.stringify(json);
            var path = 'tmp/' + tiddler.title;
            fs.mkdirSync(path);
            fs.writeFileSync(path + '/index.json', text);
            fs.writeFileSync(path + '/index.html', handlebarsTemplate);
        }        
      } else {
        console.log(error);
      }
    }

    request(options, callback);
  }


  grunt.registerMultiTask('handbook', 'Generating the Scaling Agile Handbook.', function() {
    // Merge task-specific and/or target-specific options with these defaults.
    var done = this.async();
  
    var options = this.options({
      punctuation: '.',
      separator: ', '
    });

    getTiddlers(done);

    // Iterate over all specified file groups.
    this.files.forEach(function(f) {
      // Concat specified files.
      var src = f.src.filter(function(filepath) {
        // Warn on and remove invalid source files (if nonull was set).
        if (!grunt.file.exists(filepath)) {
          grunt.log.warn('Source file "' + filepath + '" not found.');
          return false;
        } else {
          return true;
        }
      }).map(function(filepath) {
        // Read file source.
        return grunt.file.read(filepath);
      }).join(grunt.util.normalizelf(options.separator));

      // Handle options.
      src += options.punctuation;

      // Write the destination file.
      grunt.file.write(f.dest, src);

      // Print a success message.
      grunt.log.writeln('File "' + f.dest + '" created.');
    });
  });
};
