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
var users = ref.child("users");

function getUser(id, username, tags, image) {
	// this is a dud function right now, should be replaced when possible
	return {
		name: username,
		tags: tags,
		image: image
	}
}

function escapeHTML(string) {
	return string.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

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
		ref.authWithCustomToken(token, function(error, data){
			if (error) {
				console.log(error)
			}
		});
	});

	socket.on("user leave", function(token){

	});

	socket.on('chat message', function(msg, user, imageLink, fn){
		if(msg == '' || msg == undefined || msg == null) {
			fn({
				status: "failed",
				message: "There was no message"
			})
		}

		var userObj = getUser(0, user, "", imageLink);
		if (/B/.test(userObj.tags)){
			fn({
				status: "failed",
				message: "You have been banned from posting messages."
			});
			return;
		}

		var allowed = true;
		var bannedWord;
		var m = msg.split(' ');
		m.forEach(function(msg) {
			banned.forEach(function(word) {
				if(wordInString(msg, word)) {
					allowed = false;
					bannedWord = word
				}
			});
		});

		if(!allowed) {
			fn({
				status: "failed",
				message: "Your message contained the banned word '" + bannedWord + "'."
			});
			return 0;
		}

		msg = escapeHTML(msg);
		user = escapeHTML(user);
		imageLink = escapeHTML(imageLink);

		userObj = {
			name: user,
			tags: "",
			image: imageLink
		};

		io.emit('chat message', msg, userObj);

		fn({
			status: "success"
		});
	});
});

function wordInString(s, word){
	return new RegExp( '\\b' + word + '\\b', 'i').test(s);
}

http.listen(config.port, function(){
    console.log('listening on Port ' + config.port);
});
