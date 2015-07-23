var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var sanitizeHtml = require('sanitize-html');

app.use(express.static(__dirname));

app.get('/', function(req, res){
  res.sendFile('/index.html');
});

io.on('connection', function(socket){
  socket.on('chat message', function(msg, user){
  	if(msg == '' || msg == undefined || msg == null) {
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

http.listen(80, function(){
  console.log('listening on Port 80');
});
