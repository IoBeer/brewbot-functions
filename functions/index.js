'use strict';
const PubSub = require('@google-cloud/pubsub');
var functions = require('firebase-functions');
var admin = require('firebase-admin');
var dateFormat = require('dateformat');
var util = require('util');
admin.initializeApp(functions.config().firebase);

exports.temperatureUpdate = functions.pubsub.topic('temperature').onPublish(event => {
  const pubSubMessage = event.data;
  const messageBody = pubSubMessage.data ? Buffer.from(pubSubMessage.data, 'base64').toString() : '???';
  var tokens = messageBody.split("#");
  admin.database().ref('/' + tokens[0]).update({serial:tokens[0], timestamp:tokens[1], temperature: tokens[2]});
  admin.database().ref('/history/' + tokens[0]+ '/' + tokens[1]).set({temperature: tokens[2]});
  console.log('Termostato: ' + tokens[0] + ' -- leitura em: ' + tokens[1] + ' -- Temperatura: ' + messageBody + ' oC!');
});

exports.fermentationData = functions.https.onRequest((req, res) => {
  // Function to receive fermenting beer information, like style, name, start date, profile, etc
  if(req.method == "POST") {
  	admin.database().ref('/').update(req.body);
  	res.status(200).send();
  } else if (req.method == "GET") {
  	console.log("Recebido GET: " + req.query.serial);
  	var ref = admin.database().ref('/' + req.query.serial).once('value', function(data) {
  		res.set('Content-Type', 'application/json');
      console.log('Dados: ' + data.val());
  		res.status(200).send(data.val());
	});
  }
});

exports.batchTemperatureUpdate = functions.https.onRequest((req, res) => {
  // Function to receive fermenting beer information, like style, name, start date, profile, etc
  if(req.method == "POST") {
  	for(var i = 0; i < req.body.batch.length; i++) {
  		var timestamp = req.body.batch[i].timestamp;
  		admin.database().ref('/history/' + req.get('x-serial')+ '/' + timestamp).set({temperature: req.body.batch[i].temperature});
  	}  	
  	res.status(200).send();
  } else if (req.method == "GET") {
  	res.status(400).send("Method not supported.");
  }
});

exports.sendCommandThermostat = functions.https.onRequest((req, res) => {
	if(req.method == "POST") {
		var topicName = "command-" + req.body.serial;
		// Instantiates a client
 		const pubsub = PubSub();
  		const topic = pubsub.topic(topicName);

  		// Publishes the message, e.g. "Hello, world!" or { amount: 599.00, status: 'pending' }
	  	if (topic.publish(req.body)
    		.then((results) => {
      			const messageIds = results[0];
      			console.log('Message ${messageIds[0]} published.');
      			return messageIds;
    		})) {
    		res.status(200).send();
    	} else {
    		res.status(500).send("Error sending to topic " + topicName);
    	}

	} else if (req.method == "GET") {
		res.status(400).send("Method not supported.");		
	}
});

exports.fermentationDetailsAction = functions.https.onRequest((req, res) => {
  if(req.method == "POST") {
    var jsonRes = {};
    var ref = admin.database().ref('/00000000cbdacf2f').once('value', function(snapshot) {
      var data = snapshot.val();
      var action = req.body;
      if (action.result.parameters.hasOwnProperty('OG') && action.result.parameters.OG != "") {
        jsonRes.speech = "The Original Gravity is " + data.og; 
        jsonRes.displayText = "The Original Gravity is " + data.og;
      } else if (action.result.parameters.hasOwnProperty('temperature') && action.result.parameters.temperature != "") {
        jsonRes.speech = "The mash temperature is now " + data.temperature + " celsius degree"; 
        jsonRes.displayText = "The mash temperature is now " + data.temperature + " celsius degree";
      } else if (action.result.parameters.hasOwnProperty('fermentation_temperature') && action.result.parameters.fermentation_temperature != "") {
        jsonRes.speech = "The current fermentation temperature is " + data.constant_temperature + " celsius degree"; 
        jsonRes.displayText = "The current fermentation temperature is " + data.constant_temperature + " celsius degree";
      } else if (action.result.parameters.hasOwnProperty('start_date') && action.result.parameters.start_date != "") {
        var start_date_formatted = dateFormat(data.start_date, "mmmm d, yyyy");
        jsonRes.speech = "This fermentation started on " + start_date_formatted;
        jsonRes.displayText = "This fermentation started on " + start_date_formatted;
      } else {
        jsonRes.speech = "Sorry but I don't have this information. Please try again.";
        jsonRes.displayText = "Sorry but I don't have this information. Please try again.";
      }
      jsonRes.source = "Brewbot"
      res.type('application/json');
      res.json(jsonRes)
      res.status(200).end();
    });
  } else if (req.method == "GET") {
    res.status(400).send("Method not supported.");
  }
});