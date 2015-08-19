#!/usr/bin/env node
/**
 * DHT Daemon
 *
 * a daemon for reading temperature as recorded by a DHT
 * device periodically and exposing the information over HTTP
 * as JSON.
 *
 * Author: Dave Eddy <dave@daveeddy.com>
 * Date: August 17, 2015
 * License: MIT
 */

var execFile = require('child_process').execFile;
var fs = require('fs');
var http = require('http');
var os = require('os');
var path = require('path');
var util = require('util');

var accesslog = require('access-log');
var easyreq = require('easyreq');

var package = require('./package.json');

function log() {
  var s = util.format.apply(util, arguments);
  console.log('%s %s', (new Date().toISOString()), s);
}

var DHT_PROGRAM = path.join(__dirname, '_dht.py');

// config passed as first arg
var configfile = process.argv[2];
if (!configfile) {
  console.error('config file must be specified as the first argument');
  process.exit(1);
}
var config = JSON.parse(fs.readFileSync(configfile, 'utf8'));
if (!(config.dht && config.dht.pin && config.dht.type)) {
  console.error('dht data not found in config');
  process.exit(1);
}

// normalize config
config.web = config.web || {};
config.web.host = config.web.host || '127.0.0.1';
config.web.port = config.web.port || 10333;

config.interval = config.interval || 30;

if (isNaN(config.interval) || config.interval < 1) {
  console.error('interval must be at least 1 second');
  process.exit(1);
}

var INDEX_HTML = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
var IMAGE_DATA = fs.readFileSync(path.join(__dirname, 'thermometer.png'));
var DHT_DATA = {};
/**
 * get temperature data from the DHT sensor using the bundled
 * python script.
 *
 * this is called in an interval (actually a setTimeout loop)
 */
function gettemps(cb) {
  var options = {encoding: 'utf8'};
  var cmd = ['sudo', DHT_PROGRAM, config.dht.type, config.dht.pin];
  if (config.sudo === false)
    cmd = cmd.slice(1);

  log('calling: %s', cmd.join(' '));
  execFile(cmd[0], cmd.slice(1), options, function(err, stdout, stderr) {
    if (err) {
      log('failed to call dht.py');
      console.warn(err);
      cb(err);
      return;
    }

    var o;
    try {
      o = JSON.parse(stdout);
    } catch(e) {
      log('failed to parse stdout from DHT');
      console.warn(e);
      console.dir(stdout);
      cb(e);
      return;
    }
    o.reading = new Date().toISOString();

    // succesful reading
    log('success: %s', stdout.trim());
    DHT_DATA.json = JSON.stringify(o);
    DHT_DATA.human = [
      util.format('fahrenheit: %sF', o.fahrenheit.toFixed(2)),
      util.format('celsius: %sC', o.celsius.toFixed(2)),
      util.format('humidity: %s%%', o.humidity.toFixed(2)),
      util.format('reading: %s', o.reading)
    ].join('\n') + '\n';
    cb();
  });
}

/**
 * a simple wrapper to loop gettemps()
 */
function loopgettemps() {
  setTimeout(function() {
    gettemps(loopgettemps);
  }, config.interval * 1000);
}

// get an initial temperature reading before starting the daemon... this will crashe
// the process if the initial reading fails.
log('starting...');
gettemps(function(err) {
  if (err)
    throw err;

  // start HTTP server
  http.createServer(onrequest).listen(config.web.port, config.web.host, started);

  // start the loop
  loopgettemps();

  log('looping every %d seconds', config.interval);
});

function started() {
  log('server started: http://%s:%d', config.web.host, config.web.port);
}

function onrequest(req, res) {
  easyreq(req, res);
  accesslog(req, res, ':ip :method :url (:{delta}ms)', log);

  switch (req.urlparsed.normalizedpathname) {
    case '/': res.html(INDEX_HTML); break;
    case '/thermometer.png': res.setHeader('Content-Type', 'image/png'); res.end(IMAGE_DATA); break;
    case '/ping': res.end('pong\n'); break;
    case '/data': res.end(DHT_DATA.human); break;
    case '/data.json': res.end(DHT_DATA.json); break;
    case '/stats':
      if (config.stats === false)
        return res.error(403);
      var o = {
        dhtd_version: package.version,
        node_version: process.version,
        hostname: os.hostname(),
      };
      res.json(o);
    default: res.notfound(); break;
  }
}
