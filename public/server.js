var express = require('express');
var app = express();

var http = require('http').Server(app);
var io = require('socket.io')(http);
var fs = require('fs');
var list = require('badwords-list');
var Firebase = require("firebase");
var mongojs = require('mongojs');
var Twitter = require('mtwitter');
var exec = require('child_process').execFile;

var createHandler = require("github-webhook-handler");

var configdata = fs.readFileSync("../configs/config.json", "utf8", function(err, data) {
	if (err) throw err;
});
var config = JSON.parse(configdata);

var colourdata = fs.readFileSync("../configs/colours.json", "utf8", function(err, data) {
	if (err) throw err;
});
var colours = JSON.parse(colourdata);

var twitter = new Twitter({
	consumer_key: config.twitter_consumer_key,
	consumer_secret: config.twitter_consumer_secret,
	access_token_key: config.twitter_access_key,
	access_token_secret: config.twitter_access_secret
});

banned = list.array;

app.use(express.static(__dirname));
var db = mongojs('mongodb://localhost:27017/yrs', ['admins', 'ranks', 'bans', 'messages']);

var handler = createHandler({
  path: config.github.url,
  secret: config.github.secret
});

var ref = new Firebase(config.firebase_url);

var adminTags = ["Developer", "Ambassador", "Staff"];
var validTags = ["Developer", "Ambassador", "Staff", "Community"];
var tagConv = {
	developer: "Developer",
	ambassador: "Ambassador",
	staff: "Staff",
	community: "Community"
};

var tokenToName = {};

var usersByName = {};
var lastMessageId = 0;

function Message(text) {
	var escText = escapeHTML(text);

	return {
		text: escText,
		timestamp: Date.now()
	}
}

function User(token, username, imageLink) {
		return {
			token: token,
			name: username,
			nameLower: username.toLowerCase(),
			image: imageLink,
			tags: '',
			lastPing: time(),
			online: true,
			banned: false,
			colour: colours[Math.floor(Math.random()*colours.length)],
			lastMessage: 0
		}
}

function newUser(token, username, imageLink) {
	if (getUserByName(username)) {
		tokenToName[token] = username.toLowerCase();
		return usersByName[username.toLowerCase()];
	}
	var userObj = User(token, username, imageLink);
	usersByName[username.toLowerCase()] = userObj;
	tokenToName[token] = username.toLowerCase();
	return userObj
}

// set server user...
var ServerUser = User("", "Server", "");
ServerUser.tags = "Server";
function say(message){
	io.emit("chat message", Message(message), ServerUser)
}


function getUser(token) {
	//return usersByToken[token];
	return getUserByName(tokenToName[token]);
}

function getUserByName(name) {
	if (!name) return;
	return usersByName[name.toLowerCase()]
}

function getSafeUser(token) {
	var user = getUser(token);
	if (user){
		return {name: user.name, image: user.image, tags: user.tags, colour: user.colour}
	}
}

function getSafeUserByName(name){
	var user = getUserByName(name);
	if (!user) return;
	return {name: user.name, image: user.image, tags: user.tags, colour: user.colour}
}

function time() {
	var d = new Date();
	return d.getTime() / 1000;
}

function escapeHTML(string) {
	return string.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

app.post("/webhook/github", function(req, res){
  handler(req, res, function (err) {
    res.statusCode = 404;
    res.end('no such location')
  });
});


// this isn't actually required AFAIK.
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
			});
		} else {
			callback({
				status: "success",
				message: name + " has been unbanned."
			});
			say(name + " has been unbanned.");
		}
	})
}

function setRank(user, rank, by, callback) {
	if (!user || !rank){
		callback({
			status: "failed",
			message: escapeHTML("Syntax: `/setrank <user> <rank>` or `/setrank list ranks")
		});
		return;
	}
	rank = tagConv[rank.toLowerCase()];


	if (user == "list" && rank == "ranks") { // bit hacky but w/e
		callback({
			status: "failed",
			message: escapeHTML("The valid ranks are: '" + validTags.join("', '"))
		});
		return;
	}


	var userObj = getUserByName(user);
	if (!userObj){
		callback({
			status: "failed",
			message: escapeHTML("'" + user + "' is not a valid user")
		});
		return;
	}

	if (validTags.indexOf(rank) == -1){
		callback({
			status: "failed",
			message: escapeHTML("'" + rank + "' is not a valid rank. Use `/setrank list ranks` to see all valid ranks")
		});
		return;
	}

	// everything is probably valid at this point
	db.ranks.update(
		{people: userObj.nameLower},
		{$pop: {
			people: userObj.nameLower
		}}
	);

	db.ranks.update(
		{rank: rank},
		{
			$push: {
				people: userObj.nameLower
			}
		},
		function(err, data){
			if (err){
			console.log(err);
			callback({
				status: "failed",
				message: "An unknown error occurred."
			});
			} else {
				userObj.tags = rank;
				callback({
					status: "success",
					message: "'" + userObj.name + "'`t is now a " + rank + "."
				});
				say("'" + userObj.name + "' is now a " + rank + ".")
			}
		}
	)
}

function deleteMessage(timestamp){
	if(!timestamp) return;
	io.emit("delete message", timestamp)
}

function saveMessage(message, user){
	db.messages.insert({
		user: user["nameLower"],
		message: message["text"],
		ts: message["timestamp"]
	})
}


io.on('connection', function(socket){
	socket.on("user join", function(token){
		if (!token) return;

		if (token == config.rubytoken){
			if (!getUser(token)){
				var userObj = newUser(token, "RubyBot", "https://pbs.twimg.com/profile_images/625286756573782016/lcKdKSnQ.png");
			}
			io.emit("user join", getUser(token));
			return;
		}

		ref.authWithCustomToken(token, function(error, data){
			if (error) {
				console.log(error)
			} else {
				if (!getUser(token)) {
					// get user details from twitter
					twitter.get("/users/show",{
						user_id: parseInt(data.uid.split(":")[1])
					},
					function(error, data, reponse) {
						if (error) {
							console.log(error);
							return;
						}

            var username = data.screen_name;
            var imageLink = data.profile_image_url;
            var joined = new Date(data.created_at);
            // create userObj
            var userObj = newUser(token, username, imageLink);


            // set ban flag
            db.bans.find({
              'user': userObj.nameLower
            }, function (err, docs) {
              if (docs[0]) userObj.banned = true;
            });

            // set tag
            db.ranks.find({
              'people': userObj.nameLower
            }, function (err, docs) {
              if (docs[0]) {
                userObj.tags = docs[0].rank;
              } else {
                userObj.tags = 'Community';
              }
            });
            //getUser(token) = userObj;
            if(Date.now()-3600000 < joined){
              banUser(getUser(token).name, "Server (recent create ban)", function(){})
            }
            //notify others that someone has joined
            getUser(token).lastPing = time();
            io.emit("user join", getUser(token));
          });
        } else {
          getUser(token).online = true;
          //notify others that someone has joined
          getUser(token).lastPing = time();
          io.emit("user join", getUser(token));
        }
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
			args[0] = args[0].toLowerCase();
			if(args[0] == '/ban') {
				banUser(args[1], userObj.nameLower, fn);
				return;
			} else if (args[0] == '/unban') {
				unbanUser(args[1], fn);
				return;
			} else if (args[0] == "/setrank") {
				setRank(args[1], args[2], userObj, fn);
				return;
			} else if (args[0] == "/delete") {
				deleteMessage(args[1]);
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

		if (Date.now()-1000 < userObj.lastMessage ){
			fn({
				status: "failed",
				message: "Please don't spam."
			});
			return 0;
		}


		var message = Message(msg);

		//msg = marked(msg);

		// if user is banned, tell them
		if (userObj.banned){
			fn({
				status: "failed",
				message: "You have been banned from posting messages."
			});
			return;
		}

		io.emit('chat message', message, getSafeUser(token));
		saveMessage(message, userObj);
		userObj.lastMessage = Date.now()
		fn({
			status: "success"
		});
	});

	socket.on("get users", function(token, callback) {
		if (!getUser(token)) return;

		var retUsers = [];

		for (var name in usersByName){
			var user = getUserByName(name);
			if (user.online){
				retUsers.push(getSafeUserByName(name));
			}
		}

		callback({
			status: "success",
			data: retUsers
		})
	})
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
	setInterval(checkPings, 5000);
});

handler.on("push", function(event){
	console.log(
		'Received a push event for %s to %s',
		event.payload.repository.name,
		event.payload.ref
	);
	exec("/usr/bin/git pull");
  exec("npm install");
});
