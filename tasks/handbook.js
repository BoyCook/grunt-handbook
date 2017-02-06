/*
 * grunt-handbook
 * https://github.com/boycook/grunt-handbook
 *
 * Copyright (c) 2015 Craig COok
 * Licensed under the MIT license.
 */

'use strict';

var fs = require('fs-extra');
var request = require('request');
var Set2 = require('collections/set');
var xml2js = require('xml2js');
var tiddlerFields;

module.exports = function(grunt) {
  var config = {};

  function generateSiteMap(url, titles) {
    var items = "";

    for (var i = 0, len = titles.length; i < len; i++) {
      items += '<url><loc>' + url +  titles[i].href + '</loc>' +
               '<changefreq>daily</changefreq>' +
               '<priority>0.8</priority></url>';
    }

    return "<?xml version=\"1.0\" encoding=\"UTF-8\"?>" +
              "<urlset xmlns=\"http://www.google.com/schemas/sitemap/0.9\">" +
              items +
              "</urlset>";
  }

  function anchorReplacer(match, p1, offset, string) {
    if (match.indexOf('tiddlyLinkNonExisting') === -1) {
      return match;
    } else {
      var patt = /href="(.*?)"/g;
      return patt.exec(match)[1].replace('%20', ' ');
    }
  }

  function findNode(data, match, callback){
    for (var key in data) {
      if (data.hasOwnProperty(key)) {
        var obj = data[key];
        if (key === match) {
          for (var i = 0, len = obj.length; i < len; i++) {
            var href = obj[i]['$'].href;
            if (tiddlerFields.tiddlerTitles.indexOf(href) === -1) {
              data[key] = {"span": [href]};
            }
          }
          if (callback) {
            callback(obj);
          }
        } else if (typeof obj === "object") {
           findNode(obj, match);
        }
      }
    }
  }

  function getURLSafeTitle(title) {
    return title.toLowerCase().replace(/\s+/g, '-');
  }

  function compare(set1, set2, match, success) {
    for (var i = 0, len1 = set1.length; i < len1; i++) {
      for (var x = 0, len2 = set2.length; x < len2; x++) {
        if (match(set1[i], set2[x])) {
          success(i, x);
        }
      }
    }    
  }

  function stripTags(tiddler) {
    compare(tiddler.tags, config.tags.strip, function(i, x) {
      return (i === x);
    }, function(i, x) {
      tiddler.tags.splice(i, 1);
    });
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

    compare(groups, data, function(i, x) {
      return (i.toLowerCase() === x.substring(0,1).toLowerCase());
    }, function(i, x) {
      var group = groups[i];
      var item = data[x];
      if (!indexed.hasOwnProperty(group)) {
        indexed[group] = [];
      }
      indexed[group].push({title: item, href: getURLSafeTitle(item)});
    });
    return indexed;
  }

  function extractFields(tiddlers) {
    var tmpTitles = [];
    var json = {
      index: {},
      titles: [],
      tiddlerTitles: [],
      tags: new Set2(),
      tagIndex: {}
    };

    for (var i = 0, len = tiddlers.length; i < len; i++) {
      var tiddler = tiddlers[i];
      stripTags(tiddler);
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

    tmpTitles.sort();
    json.tiddlerTitles = tmpTitles;
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

  function generateDirectories(tiddlers, done) {
      var fields = extractFields(tiddlers);
      tiddlerFields = fields;
      var buildFiles = [{'gen/*.html': 'templates/html/*.html'}]; //Hack to give base.json context

      for (var i = 0, len = tiddlers.length; i < len; i++) {
        var tiddler = tiddlers[i];
        var json = {
          "description": "Agile and DevOps Handbook - " + tiddler.title,
          "title": "Agile and DevOps Handbook - " + tiddler.title,
          "extends": ["base.json"],
          "targetPath" : "index.html",
          "js_files%add": [
            "js/handbook.js"
          ],
          "depth": "../../",
          "navOptions": true,
          "share": true,
          "handbook": {
             "title": tiddler.title,
             "back": '#',
             "next": '#',
             "content": tiddler.render,
             "tags": tiddler.tags,
             "titles": fields.titles,
             "index": fields.index
          }
        };

        var match = /<a[\s]+([^>]+)>((?:.(?!\<\/a\>))*.)<\/a>/g;
        json.handbook.content = tiddler.render.replace(match, anchorReplacer);

        // xml2js.parseString(tiddler.render, function(err, data) {
        //   // console.log(JSON.stringify(data) + '\n\n');
        //   findNode(data, 'a');
        //   render = data;
        // });          
        // var builder = new xml2js.Builder();
        // json.handbook.content = builder.buildObject(render);

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

      fs.writeFileSync(config.configFile, JSON.stringify(buildFiles));
      fs.writeFileSync(config.siteMap.file, generateSiteMap(config.siteMap.url, fields.titles));
      fs.writeFileSync(config.jsonFile, JSON.stringify({
        "titles": fields.titles,
        "index": fields.index,
        "tags": fields.tagIndex
      }));
      done();
  }

  function readTiddlers(file, done) {
    fs.readFile(file, 'utf8', function (err,data) {
      if (err) {
        done(false)
      }
      // console.log(data);
      generateDirectories(JSON.parse(data), done);
    });
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
        generateDirectories(JSON.parse(body), done);
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

    if (!fs.existsSync(config.target)) {
      fs.mkdirSync(config.target);
    }

    var removeParams = '';
    for (var i = 0, len = options.tags.remove.length; i < len; i++) {
      removeParams += '&select=tag:!' + options.tags.remove[i];
    }    

    console.log('Using HTML tempates: ' + JSON.stringify(config.templates));
    console.log('Setting target: ' + config.target);
    console.log('Setting config file: ' + config.configFile);
    console.log('Setting JSON file: ' + config.jsonFile);

    if (options.file) {
      console.log('Using source file: ' + options.file);
      readTiddlers(options.file, done);
    } else {
      console.log('Using source URL: ' + options.url);
      getTiddlers(options.url + removeParams, done);
    }
  });
};
