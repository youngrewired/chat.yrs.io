var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var fs = require('fs');
app.use(express.static(__dirname));
var list = require('badwords-list');
var Firebase = require("firebase");
banned = list.array;

var data = fs.readFileSync("config.json", "utf8", function(err, data) {
	if (err) throw err;
});
var config = JSON.parse(data);

var ref = new Firebase(config.firebase_url);

app.get('/', function(req, res) {
	res.sendFile("./index.html");
});

app.get("/chat.js", function(req, res) {
	var page = fs.readFileSync("./templates/chat.js", "utf8", function(err, data) {
		if (err) throw err;
	});
	page = page.replace("***firebase-url***", config.firebase_url);
	res.send(page)
});


io.on('connection', function(socket){
	socket.on("user join", function(token){
		var auth = ref.authWithCustomToken(token, function(error, data){
			if (error){
				return
			}
		});

	});

	socket.on("user leave", function(token){

	});

	socket.on('chat message', function(msg, user, imageLink){
		if(msg == '' || msg == undefined || msg == null) {
			return;
		}

		var allowed = true;
		var m = msg.split(' ');
		m.forEach(function(msg) {
			banned.forEach(function(word) {
				if(wordInString(msg, word)) {
					allowed = false;
				}
			});
		});

		if(allowed == false) {
			return;
		}

		msg = msg.replace(/</g, "&lt;");
		msg = msg.replace(/>/g, "&gt;");

		user = user.replace(/</g, "&lt;");
		user = user.replace(/>/g, "&gt;");

		io.emit('chat message', msg, user, imageLink);
	});
});

function wordInString(s, word){
	return new RegExp( '\\b' + word + '\\b', 'i').test(s);
}

http.listen(config.port, function(){
    console.log('listening on Port ' + config.port);
});
