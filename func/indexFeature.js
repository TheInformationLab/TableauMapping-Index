var mongoose = require('mongoose');
var Spatial = require('../models/spatial');
var SearchIndex = require('../models/index');
var fs = require('fs');

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

var spatialID = process.argv.slice(2);
console.log("Indexing " + spatialID)

var myID = "" + spatialID;

var d = new Date();
var firstLog = {};
firstLog.date = d.toISOString();
firstLog.msg = "Index started";

fs.writeFileSync('/tmp/index/'+myID.trim()+'.log',JSON.stringify(firstLog));
var logger = fs.createWriteStream('/tmp/index/'+myID.trim()+'.log', {
  flags: 'a' // 'a' means appending (old data will be preserved)
})

var writeLog = function(message) {
  var d = new Date();
  var log = {};
  log.date = d.toISOString();
  log.msg = message;
  logger.write(","+JSON.stringify(log));
}

SearchIndex.remove({spatial: mongoose.Types.ObjectId(myID.trim())}, function(err) {
  if (err) {
    mongoose.connection.close();
    return writeLog(err);
  }
  writeLog("Index Cleared for " + myID.trim());
  Spatial.findById(mongoose.Types.ObjectId(myID.trim()), function (err, spatial) {
    if (err) {
      mongoose.connection.close();
      return writeLog(err);
    }
    var buildIndex = [];
    writeLog("Indexing " + spatial.country + " ~ " + spatial.name);
    fs.readFile('/tmp/index/'+myID.trim()+'.json', 'utf8', function(err, data) {
      writeLog("Adding features to array");
      var features = JSON.parse(data.trim());
      buildIndex = buildIndex.concat(features);
      writeLog("Index size = " + buildIndex.length);
      writeLog("Saving Index");
      var i,j,chunk = 20000;
      var temparray = [];
      var savedCount = 0;
      for (i=0,j=buildIndex.length; i<j; i+=chunk) {
        temparray = buildIndex.slice(i,i+chunk);
        writeLog("Saving " + temparray.length + " records");
        SearchIndex.insertMany(temparray, function(err, docs) {
          if (err) {
            //mongoose.connection.close();
            writeLog(err);
          }
          savedCount = savedCount + docs.length;
          writeLog("Saved " + savedCount + " of " + j);
          if(savedCount == buildIndex.length) {
            mongoose.connection.close();
            writeLog("Index Complete");
          }
        });
      }
    });
  });
});
