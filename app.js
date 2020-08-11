var express = require('express');
var path = require('path');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var mongoose = require('mongoose');
var compression = require('compression');
var timeout = require('connect-timeout');
var fs = require('fs');

var app = express();

if (process.env.NOW) {
  app.use(compression());
}

app.use(timeout(600000));
app.use(haltOnTimedout);

function haltOnTimedout(req, res, next){
  if (!req.timedout) next();
}

var options = { useMongoClient : true };

var dbhost = process.env.HOST || 'localhost:27017/tableau-mapping2';
var dbuser = process.env.DBUSER || null;
var dbpass = process.env.DBPASS || null;
var dburi = 'mongodb://';

if (dbuser && dbpass) {
  dburi = dburi + dbuser + ":" + dbpass + '@' + dbhost;
} else {
  dburi = dburi + dbhost;
}
mongoose.set('debug', false);
mongoose.connect(dburi, options);

var appRoutes = require('./routes/app');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use(function (req, res, next) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, PATCH, DELETE, OPTIONS');
    next();
});
//
// const encodeResToGzip = contentType => (req, res, next) => {
//     req.url = req.url + '.gz';
//     res.set('Content-Encoding', 'gzip');
//     res.set('Content-Type', contentType);
//
//     next();
// };
//
// app.get("*.js", encodeResToGzip('text/javascript'));

if(!fs.existsSync('/tmp/data')) {
    fs.mkdirSync('/tmp/data');
  }

if(!fs.existsSync('/tmp/index')) {
    fs.mkdirSync('/tmp/index');
  }

app.use('/index', appRoutes);

module.exports = app;
