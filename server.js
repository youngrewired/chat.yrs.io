var express = require('express');
var app = express();

var http = require('http').Server(app);
var io = require('socket.io')(http);
var fs = require('fs');
var list = require('badwords-list');
var Firebase = require("firebase");
var mongojs = require('mongojs');


app.use(express.static(__dirname));
var db = mongojs('mongodb://46.101.35.180:27017/yrs', ['admins', 'ranks', 'bans']);
var bannedList = [];

var marked = require('marked');
marked.setOptions({
  renderer: new marked.Renderer(),
  gfm: true,
  tables: false,
  breaks: false,
  pedantic: false,
  sanitize: false,
  smartLists: false,
  smartypants: false
});

banned = list.array;

var data = fs.readFileSync("config.json", "utf8", function(err, data) {
	if (err) throw err;
});
var config = JSON.parse(data);

var ref = new Firebase(config.firebase_url);
users = {};

function User(token, username, imageLink) {
		return {
			token: token,
			name: username,
			image: imageLink,
			tags: '',
			lastPing: time(),
			online: true
		}
}

function getUser(token) {
	return users[token];
}

function getSafeUser(token) {
	var user = users[token];
	if (user){
		return {name: user.name, image: user.image, tags: user.tags}
	}
}

function time() {
	var d = new Date();
	return d.getTime() / 1000;
}

function escapeHTML(string) {
	return string.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

app.get('/', function(req, res) {
	res.sendFile("./index.html");
});

app.get("/chat.js", function(req, res) {
	var page = fs.readFileSync("./assets/js/chat.js", "utf8", function(err, data) {
		if (err) throw err;
	});
	page = page.replace("***firebase-url***", config.firebase_url);
	res.send(page)
});


io.on('connection', function(socket){
	socket.on("user join", function(token, username, imageLink){
		if (!token) return;
		if (token == config.rubytoken){
			if (!users[token]){
				users[token] = User(token, escapeHTML(username), escapeHTML(imageLink));
			}
			io.emit("user join", users[token]);
			return;
		}
		ref.authWithCustomToken(token, function(error, data){
			if (error) {
				console.log(error)
			} else {
				if (!users[token]){
					db.bans.find({
						'user': escapeHTML(username)
					}, function(err, docs) {
						if(docs[0]) {
							bannedList.push(escapeHTML(username));
						}
					});
					users[token] = User(token, escapeHTML(username), escapeHTML(imageLink));
					var tag;
					db.ranks.find({
						'people': escapeHTML(username)
					}, function(err, docs) {
						var tag;
						if(docs[0]) {
							tag = docs[0].rank
						} else {
							tag = 'YRSer'
						}
						users[token].tags = tag;
					});
				} else {
					getUser(token).online = true
				}
				io.emit("user join", users[token])
			}
		});
	});

	socket.on("user leave", function(token){
		io.emit("user leave", getSafeUser(token));
		getUser(token).online = false
	});

	socket.on("user ping", function(token) {
		try{
		getUser(token).lastPing = time();
		} catch(err) {
			console.log(err)
		}
	});

	socket.on('chat message', function(msg, token, fn){
		var userObj = getSafeUser(token);
		if (!userObj) return;
		getUser(token).lastPing = time();

		if (!fn){fn = function(){}}

		if(msg == '' || msg == undefined || msg == null) {
			fn({
				status: "failed",
				message: "There was no message"
			})
			return;
		}
		var m = msg.split(' ');
		if(m[0] == '!ban') {
			ban(msg, m, fn, userObj);
		}

		var allowed = true;
		var bannedWord;
		m.forEach(function(msg) {
			banned.forEach(function(word) {
				if(wordInString(msg, word)) {
					allowed = false;
					bannedWord = word;
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

		msg = marked(msg);

		console.log(userObj.name);
		console.log(bannedList);
		bannedList.forEach(console.log);

		if (bannedList.indexOf(userObj.name) !== -1){
			fn({
				status: "failed",
				message: "You have been banned from posting messages."
			});
			return;
		}

		//var b = false;
		//bannedList.forEach(function(data){
		//	if(data == userObj.name) {
		//		fn({
		//			status: "failed",
		//			message: "You have been banned from posting messages."
		//		});
		//		b = true;
		//		return;
		//	}
		//});



		io.emit('chat message', msg, userObj);

		fn({
			status: "success"
		});
	});
});

function ban(msg, m, fn, userObj) {
	if(m.length == 1) {
		fn({
			status: "failed",
			message: "!ban [user]"
		});
	} else if (m.length == 2) {
		db.bans.insert({
			'user': m[1],
			'time': Date.now(),
			'by': userObj
		});
		bannedList.push(m[1]);
	}
}

function wordInString(s, word){
	return new RegExp( '\\b' + word + '\\b', 'i').test(s);
}

function checkPings() {
	for (var token in users){
		var user = getUser(token);
		if (user.online && user.lastPing < time()-config.timeout) {
			io.emit("user leave", user);
			user.online = false;
		}
	}
}

http.listen(config.port, function(){
    console.log('listening on Port ' + config.port);
	  setInterval(checkPings, 5000)
});
