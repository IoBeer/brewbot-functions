'use strict';
const PubSub = require('@google-cloud/pubsub');
var functions = require('firebase-functions');
var admin = require('firebase-admin');
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
  	var ref = admin.database().ref('/'+req.query.serial).once('value').then(function(snapshot) {
  		res.set('Content-Type', 'application/json');
  		res.status(200).send(snapshot);
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