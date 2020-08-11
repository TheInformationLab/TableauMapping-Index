var express = require('express');
var router = express.Router();
var SearchIndex = require('../models/index');
var jwt = require('jsonwebtoken');
var mongoose = require('mongoose');
var Spatial = require('../models/spatial');
var SearchIndex = require('../models/index');
var request = require("request");
var turf = require("@turf/turf");
var moment = require('moment');
var fs = require('fs');
var path = require('path');

router.use('/', function(req, res, next) {
  var secret = process.env.JWTSECRET || '+t{zTdd_WDfq *UEs15r{_FY|J 8#t&wj+FL},UUX-{Vs>+=`+SV#+nr RaJh+w}';
  jwt.verify(req.headers.authorization, secret, function(err, decoded) {
    if (err) {
      return res.status(401).json({
        message: "Not Authenticated",
        error: err
      });
    }
    next();
  });
});

router.post('/item', function(req, res, next) {
  const reqUrl = "https://www.tableaumapping.bi";
  var options = { method: 'POST',
    url: reqUrl + '/api/spatial/data',
    headers:
     { 'Content-Type': 'application/json' },
    body: { id: req.body.id },
    json: true };
  request(options, function (error, response, body) {
    console.log(options, body);
    if (error) throw new Error(error);
    var geoObj = turf.flatten(body.data);
    var spatialCentroid = turf.centroid(geoObj);
    Spatial.findById(mongoose.Types.ObjectId(req.body.id), function (err, spatial) {
      if (err) {
        //mongoose.connection.close();
        return res.status(500).json({
          message: 'Error finding spatial object ' + req.body.id,
          error: err
        });
      }
      var buildIndex = [];
      console.log("Indexing " + spatial.country + " ~ " + spatial.name);
      var centroidStr = "{\"lat\": \"\", \"lng\": \"\"}"
      if (spatialCentroid && spatialCentroid.geometry) {
        centroidStr = "{\"lat\": "+spatialCentroid.geometry.coordinates[1]+", \"lng\": "+spatialCentroid.geometry.coordinates[0]+"}"
      }
      var initial = [
                    {name: 'country', value: spatial.country, spatial: spatial._id, centroid: centroidStr},
                    {name: 'name', value: spatial.name, spatial: spatial._id, centroid: centroidStr},
                    {name: 'type', value: spatial.type, spatial: spatial._id, centroid: centroidStr}];
      buildIndex = buildIndex.concat(initial);
      turf.featureEach(geoObj, function (currentFeature, featureIndex) {
        parseFeatures(currentFeature, spatial._id, function(features) {
          buildIndex = buildIndex.concat(features);
        });
      });
      fs.writeFile('/tmp/index/' + req.body.id + ".json", JSON.stringify(buildIndex), 'utf8', function(err) {
        if (err) {
          return res.status(500).json({
            message: 'Indexing encontered error',
            code: code,
            signal: signal
          });
        }
        const { spawn } = require('child_process');
        const child = spawn('node', [path.join(__dirname, '../func/', 'indexFeature.js'), req.body.id]);
        res.status(201).json({
          message: 'Object Indexed',
          index: buildIndex
        });
      });
    });
  });
});

router.delete('/item', function(req, res, next) {
  var secret = process.env.JWTSECRET || '+t{zTdd_WDfq *UEs15r{_FY|J 8#t&wj+FL},UUX-{Vs>+=`+SV#+nr RaJh+w}';
  jwt.verify(req.headers.authorization, secret, function(err, decoded) {
    Spatial.findById(mongoose.Types.ObjectId(req.query.id))
     .exec(function(err, resp) {
       if (resp.owner == decoded.user._id) {
         SearchIndex.remove({spatial: mongoose.Types.ObjectId(req.body.id)}, function(err) {
           if (err) {
             return res.status(500).json({
               message: 'Error removing index',
               error: err
             });
           }
           res.status(201).json({
             message: 'Index removed',
             id: req.body.id
           });
         });
       } else {
         if (err) {
           return res.status(500).json({
             message: 'Invalid Permission',
             error: 'You are not the owner of the spatial attached to this index'
           });
         }
       }
     });
  });
});

router.get('/status', function(req, res, next) {
  fs.readFile('/tmp/index/'+req.query.id+'.log', 'utf8', function(err, data) {
    if (err) {
      return res.status(404).json({
        message: 'Index status not found'
      });
    }
    var log = "[" + data + "]";
    res.status(201).json({
      message: 'Status found',
      log: JSON.parse(log)
    });
  });
});

var parseFeatures = function(feature, id, callback) {
  var featureProps = [];
  var featureProperties = feature.properties;
  for (var property in featureProperties) {
    var valid = true;
    var name = property.toLowerCase();
    var value = featureProperties[property];
    //Test value isn't blank
    if (!value || value == "") {
      valid = false;
      continue;
    }
    //Test if value is a number and not a code, id or cd
    if (!isNaN(value) && name.indexOf('code') == -1 && name.indexOf('id') == -1 && name.indexOf('cd') == -1) {
      valid = false;
      continue;
    }
    //Test if property is named common numerical property name
    if (name.indexOf('centroid') > -1 || name.indexOf('x_') > -1 || name.indexOf('y_') > -1 || name.indexOf('area') > -1 || name.indexOf('land') > -1 || name.indexOf('water') > -1) {
      valid = false;
      continue;
    }
    //Test if value is a date
    if(moment(value).isValid()) {
      valid = false;
      continue;
    }
    if (valid) {
      var featureCentroid = turf.centroid(feature);
      var centroidStr = "{\"lat\": \"\", \"lng\": \"\"}"
      if (featureCentroid && featureCentroid.geometry) {
        centroidStr = "{\"lat\": "+featureCentroid.geometry.coordinates[1]+", \"lng\": "+featureCentroid.geometry.coordinates[0]+"}"
      }
      var obj = {
        name: property,
        value: featureProperties[property],
        spatial: id,
        centroid: centroidStr
      }
      featureProps.push(obj);
    }
  }
  callback(featureProps);
}

module.exports = router;
