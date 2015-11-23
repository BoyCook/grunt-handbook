/*
 * grunt-handbook
 * https://github.com/boycook/grunt-handbook
 *
 * Copyright (c) 2015 Craig COok
 * Licensed under the MIT license.
 */

'use strict';

// var fs = require('fs');
var fs = require('fs-extra');
var request = require('request');
var Set2 = require('collections/set');

module.exports = function(grunt) {

  // Please see the Grunt documentation for more information regarding task
  // creation: http://gruntjs.com/creating-tasks

  function extractFields(tiddlers) {
    var json = {
      titles: [],
      tags: new Set2(),
      quotes: []
    };

    for (var i = 0, len = tiddlers.length; i < len; i++) {
      var tiddler = tiddlers[i];
      if (tiddler.tags.indexOf('quote') > -1) {
        json.quotes.push(tiddler.render);
      } else {
        json.titles.push(tiddler.title);
        var tiddlerTags = tiddler.tags;
        for (var x = 0, tagLen = tiddlerTags.length; x < tagLen; x++) {
            json.tags.add(tiddlerTags[x]);
        }        
      }
    }
    return json;
  }

  function getTemplate(tags, templates) {
    var template = templates.default;
    for (var i = 0, len = tags.length; i < len; i++) {
        for (var key in templates) {
            if (tags[i] === key) {
              template = templates[key];
            }
        }
    }
    return template;
  }

  function getTiddlers(url, templates, target, configFile, done) {
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
        var fields = extractFields(tiddlers);
        var config = [{'gen/*.html': 'templates/html/*.html'}]; //Hack to give base.json context

        for (var i = 0, len = tiddlers.length; i < len; i++) {
            var tiddler = tiddlers[i];
            var json = {
              "description": "SAC2M Handbook - " + tiddler.title,
              "extends": ["base.json"],
              "targetPath" : "index.html",
              "partials%add": [],
              "depth": "../../",
              "handbook": {
                 "title": tiddler.title,
                 "content": tiddler.render,
                 "tags": tiddler.tags,
                 "quotes": fields.quotes,
                 "allTags": fields.tags.toArray(),
                 "allTitles": fields.titles
              }
            };
            
            var item = {};
            item['gen/handbook/' + tiddler.title.toLowerCase() + '/*.html'] = 'templates/html/handbook/' + tiddler.title.toLowerCase() + '/*.html';
            config.push(item);
            var text = JSON.stringify(json);
            var path = target + '/' + tiddler.title.toLowerCase();
            fs.mkdirSync(path);
            fs.writeFileSync(path + '/index.json', text);
            fs.copySync(getTemplate(tiddler.tags, templates), path + '/index.html');
            if (i === len-1) {
              fs.writeFileSync(configFile, JSON.stringify(config));
              done();
            }
        }        
      } else {
        console.log(error);
        done(false);
      }
    }

    request(options, callback);
  }

  grunt.registerTask('sac2mHandbook', 'Generating the Scaling Agile Handbook.', function() {
    // Merge task-specific and/or target-specific options with these defaults.
    var done = this.async();
  
    var options = this.options({
      punctuation: '.',
      separator: ', '
    });

    console.log('Using source URL: ' + options.url);
    console.log('Using HTML tempates: ' + JSON.stringify(options.templates));
    console.log('Using target: ' + options.target);
    console.log('Using config file: ' + options.configFile);

    if (!fs.existsSync(options.target)) {
      fs.mkdirSync(options.target);
    }

    getTiddlers(options.url, options.templates, options.target, options.configFile, done);
  });
};
