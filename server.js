var express = require('express');
var app = express();

var http = require('http').Server(app);
var io = require('socket.io')(http);
var fs = require('fs');
var list = require('badwords-list');
var Firebase = require("firebase");
var mongojs = require('mongojs');

banned = list.array;

app.use(express.static(__dirname));
var db = mongojs('mongodb://localhost:27017/yrs', ['admins', 'ranks', 'bans']);

//var marked = require('marked');
// marked.setOptions({
//   renderer: new marked.Renderer(),
//   gfm: true,
//   tables: false,
//   breaks: false,
//   pedantic: false,
//   sanitize: false,
//   smartLists: false,
//   smartypants: false
// });

var configdata = fs.readFileSync("config.json", "utf8", function(err, data) {
	if (err) throw err;
});
var config = JSON.parse(configdata);

var colourdata = fs.readFileSync("colours.json", "utf8", function(err, data) {
	if (err) throw err;
});
var colours = JSON.parse(colourdata);

var ref = new Firebase(config.firebase_url);

var adminTags = ["Developer", "Ambassador", "Staff"];

var tokenToName = {};
//var usersByToken = {};
var usersByName = {}

function User(token, username, imageLink) {
		return {
			token: token,
			name: username,
			image: imageLink,
			tags: '',
			lastPing: time(),
			online: true,
			banned: false,
			colour: colours[Math.floor(Math.random()*colours.length)]
		}
}

function newUser(token, username, imageLink) {
	if (usersByName[username]) {
		tokenToName[token] = username;
		return usersByName[username];
	}
	var userObj = User(token, username, imageLink);
	usersByName[username] = userObj;
	tokenToName[token] = username;
	return userObj
}

// set server user...
var ServerUser = User("", "Server", "");


function getUser(token) {
	//return usersByToken[token];
	return getUserByName(tokenToName[token]);
}

function getUserByName(name) {
	return usersByName[name]
}

function getSafeUser(token) {
	var user = getUser(token);
	if (user){
		return {name: user.name, image: user.image, tags: user.tags, colour: user.colour}
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

function banUser(name, by, callback) {
	if (!name) {
		callback({
			status: "failed",
			message: "Syntax: /ban [@]&lt;username&gt;"
		});
		return;
	}
	var userObj = getUserByName(name.replace("@", ""));
	if (!userObj){
		callback({
			status: "failed",
			message: "No user found called " + name + "."
		});
		return;
	}

	if (userObj.banned){
		callback({
			status: "failed",
			message: name + " is already banned."
		});
		return;
	}

	userObj.banned = true;
	db.bans.insert({
		user: name,
		time: Date.now(),
		by: by
	}, function(err, data){
		if (err) {
			console.log(err);

			callback({
				status: "failed",
				message: "An unknown error occurred."
			})
		}	else {
			callback({
				status: "success",
				message: name + " has been banned."
			});
			say(name + " has been banned.")
		}
	})
}

function unbanUser(name, callback) {
	if (!name) {
		callback({
			status: "failed",
			message: "Syntax: /ban [@]&lt;username&gt;"
		});
		return;
	}

	var userObj = getUserByName(name.replace("@", ""));
	if (!userObj){
		callback({
			status: "failed",
			message: "No user found called " + name + "."
		});
		return;
	}

	if (!userObj.banned){
		callback({
			status: "failed",
			message: name + " is already unbanned."
		});
		return;
	}

	userObj.banned = false;
	db.bans.remove({
		user: name
	}, function(err, data){
		if (err) {
			console.log(err);
			callback({
				status: "failed",
				message: "An unknown error occurred."
			})
		} else {
			callback({
				status: "success",
				message: name + " has been unbanned."
			})
		}
		console.log("test");
		say(name + " has been unbanned.");
	})
}

function say(message){
	io.emit("chat message", message, ServerUser)
}

io.on('connection', function(socket){
	socket.on("user join", function(token, username, imageLink){
		if (!token) return;
		if (!username) return;
		if (!imageLink) return;

		username = escapeHTML(username);
		imageLink = escapeHTML(imageLink);

		if (token == config.rubytoken){
			if (!usersByToken[token]){
				usersByToken[token] = newUser(token, username, imageLink);
			}
			io.emit("user join", usersByToken[token]);
			return;
		}

		ref.authWithCustomToken(token, function(error, data){
			if (error) {
				console.log(error)
			} else {
				if (!getUser(token)) {
					// create userObj
					var userObj = newUser(token, username, imageLink);

					// set ban flag
					db.bans.find({
						'user': username
					}, function(err, docs) {
						if (docs[0]) userObj.banned = true;
					});

					// set tag
					db.ranks.find({
						'people': username
					}, function(err, docs) {
						if(docs[0]) {
							userObj.tags = docs[0].rank;
						} else {
							userObj.tags = 'Community';
						}
					});
					//getUser(token) = userObj;

				} else {
					getUser(token).online = true;
				}

				//notify others that someone has joined
				getUser(token).lastPing = time();
				io.emit("user join", getUser(token));
			}
		});
	});

	socket.on("user leave", function(token){
		if (!getUser(token)) return;
		io.emit("user leave", getSafeUser(token));
		getUser(token).online = false
	});

	socket.on("user ping", function(token) {
		if (!getUser(token)) return;
		getUser(token).lastPing = time();

	});

	socket.on('chat message', function(msg, token, fn){
		var userObj = getUser(token);
		if (!userObj) return;
		getUser(token).lastPing = time();

		if (!fn){fn = function(){}} // fix for RubyBot which has no way of sending functions

		if(msg == '' || msg == undefined || msg == null) {
			fn({
				status: "failed",
				message: "There was no message"
			});
			return;
		}

		// commands section
		var args = msg.split(" ");
		if (adminTags.indexOf(userObj.tags) != -1){
			if(args[0] == '/ban') {
				banUser(args[1], userObj.name, fn);
				return;
			} else if (args[0] == '/unban') {
				unbanUser(args[1], fn);
				return;
			}
		}
		var allowed = true;
		var bannedWord;
		args.forEach(function(msg) {
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

		//msg = marked(msg);

		// if user is banned, tell them
		if (userObj.banned){
			fn({
				status: "failed",
				message: "You have been banned from posting messages."
			});
			return;
		}

		io.emit('chat message', msg, getSafeUser(token));

		fn({
			status: "success"
		});
	});
});

function wordInString(s, word){
	return new RegExp( '\\b' + word + '\\b', 'i').test(s);
}

function checkPings() {
	for (var name in usersByName){
		var user = getUserByName(name);
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
