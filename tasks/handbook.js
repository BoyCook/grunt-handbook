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
  var config = {};

  function getURLSafeTitle(title) {
    return title.toLowerCase().replace(/\s+/g, '-');
  }

  function ignore(tiddler) {
    for (var i = 0, len = tiddler.tags.length; i < len; i++) {
      for (var x = 0, xlen = config.ignoreTags.length; x < xlen; x++) {
        if (tiddler.tags[i] === config.ignoreTags[x]) {
          return true;
        }
      }
    }
    return false;
  }

  function stripTags(tiddler) {
    for (var i = 0, len = tiddler.tags.length; i < len; i++) {
      for (var x = 0, xlen = config.stripTags.length; x < xlen; x++) {
        var strip = config.stripTags[x];
        if (tiddler.tags[i] === strip) {
          tiddler.tags.splice(i, 1);
        }
      }
    }
  }

  function buildTitles(tmp) {
    var titles = [];
    for (var i = 0, len = tmp.length; i < len; i++) {
      var item = tmp[i];
      titles.push({title: item, href: getURLSafeTitle(item)});
    }
    return titles;
  }

  function buildIndex(data) {
    var groups = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 
                  'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];
    var indexed = {};

    for (var i = 0, len = groups.length; i < len; i++) {
      for (var x = 0, xlen = data.length; x < xlen; x++) {
        var group = groups[i];
        var item = data[x];
        // It matches the group
        if (group.toLowerCase() === item.substring(0,1).toLowerCase()) {
          //Group is not in the indexed list
          if (!indexed.hasOwnProperty(group)) {
            indexed[group] = [];
          }
          indexed[group].push({title: item, href: getURLSafeTitle(item)});
        }
      }      
    }
    return indexed;
  }

  function extractFields(tiddlers) {
    var tmpTitles = [];
    var json = {
      index: {},
      titles: [],
      tags: new Set2(),
      tagIndex: {}
    };

    for (var i = 0, len = tiddlers.length; i < len; i++) {
      var tiddler = tiddlers[i];
      stripTags(tiddler);
      if (!ignore(tiddler)) {
        tmpTitles.push(tiddler.title);
        var tiddlerTags = tiddler.tags;
        for (var x = 0, tagLen = tiddlerTags.length; x < tagLen; x++) {
          var tag = tiddlerTags[x];
          json.tags.add(tag);

          // if (!tmpIndex.hasOwnProperty[tag]) {
          if (!(tag in json.tagIndex)) {
            json.tagIndex[tag] = [];
          }
          json.tagIndex[tag].push({
            "title": tiddler.title,
            "uri": getURLSafeTitle(tiddler.title)
          });
        }        
      }
    }

    tmpTitles.sort();
    json.titles = buildTitles(tmpTitles);
    json.index = buildIndex(tmpTitles);
    return json;
  }

  function getTemplate(tags) {
    var template = config.templates.default;
    for (var i = 0, len = tags.length; i < len; i++) {
        for (var key in config.templates) {
            if (tags[i] === key) {
              template = config.templates[key];
            }
        }
    }
    return template;
  }

  function getTiddlers(url, done) {
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
        var buildFiles = [{'gen/*.html': 'templates/html/*.html'}]; //Hack to give base.json context

        for (var i = 0, len = tiddlers.length; i < len; i++) {
          var tiddler = tiddlers[i];
          if (!ignore(tiddler)) {
            var json = {
              "description": "SAC2M Handbook - " + tiddler.title,
              "title": "SAC2M Handbook - " + tiddler.title,
              "extends": ["base.json"],
              "targetPath" : "index.html",
              "js_files%add": [
                "js/handbook.js"
              ],
              "depth": "../../",
              "navOptions": true,
              "handbook": {
                 "title": tiddler.title,
                 "content": tiddler.render,
                 "tags": tiddler.tags,
                 "titles": fields.titles,
                 "index": fields.index
              }
            };
          
            if (i === 0) {
              json.handbook.back = '#';              
              json.handbook.next = getURLSafeTitle(tiddlers[i+1].title);
            } else if (i === tiddlers.length-1) {
              json.handbook.back = getURLSafeTitle(tiddlers[i-1].title);
              json.handbook.next = '#';              
            } else {
              json.handbook.back = getURLSafeTitle(tiddlers[i-1].title);
              json.handbook.next = getURLSafeTitle(tiddlers[i+1].title);
            }

            var safeTitle = getURLSafeTitle(tiddler.title.toLowerCase());
            var path = config.target + '/' + safeTitle;
            var file = safeTitle + '/*.html';
            var item = {};
            
            item['gen/handbook/' + file] = 'templates/html/handbook/' + file;
            buildFiles.push(item);
            
            fs.mkdirSync(path);
            fs.writeFileSync(path + '/index.json', JSON.stringify(json));
            fs.copySync(getTemplate(tiddler.tags), path + '/index.html');
          }
        } 

        fs.writeFileSync(config.configFile, JSON.stringify(buildFiles));
        fs.writeFileSync(config.jsonFile, JSON.stringify({
          "titles": fields.titles,
          "index": fields.index,
          "tags": fields.tagIndex
        }));
        done();
      } else {
        console.log(error);
        done(false);
      }
    }

    request(options, callback);
  }

  // Please see the Grunt documentation for more information regarding task
  // creation: http://gruntjs.com/creating-tasks
  grunt.registerTask('sac2mHandbook', 'Generating the Scaling Agile Handbook.', function() {
    // Merge task-specific and/or target-specific options with these defaults.
    var done = this.async();
  
    var options = this.options({
      punctuation: '.',
      separator: ', '
    });

    config = options;

    console.log('Using source URL: ' + options.url);
    console.log('Using HTML tempates: ' + JSON.stringify(config.templates));
    console.log('Setting target: ' + config.target);
    console.log('Setting config file: ' + config.configFile);
    console.log('Setting JSON file: ' + config.jsonFile);

    if (!fs.existsSync(config.target)) {
      fs.mkdirSync(config.target);
    }

    getTiddlers(options.url, done);
  });
};
