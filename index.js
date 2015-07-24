var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var sanitizeHtml = require('sanitize-html');
app.use(express.static(__dirname));
var list = require('badwords-list');
banned = list.array;

app.get('/', function(req, res){
  res.sendFile('/index.html');
});

io.on('connection', function(socket){
  socket.on('chat message', function(msg, user){
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

		var clean = sanitizeHtml(msg, {
		  allowedTags: [ 'b', 'i', 'em', 'strong', 'a' ],
		  allowedAttributes: {
		    'a': [ 'href' ]
		  }
		});
		var cleanUser = sanitizeHtml(user, {
		  allowedTags: [ 'b', 'i', 'em', 'strong', 'a' ],
		  allowedAttributes: {
		    'a': [ 'href' ]
		  }
		});
    io.emit('chat message', clean, cleanUser);
  });
});

function wordInString(s, word){
  return new RegExp( '\\b' + word + '\\b', 'i').test(s);
}

http.listen(3000, function(){
	banned.push('SPAM')
  	console.log('listening on Port 3000');
});
