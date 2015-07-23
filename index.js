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
    io.emit('chat message', msg.toString(), user);
  });
});

http.listen(80, function(){
  console.log('listening on Port 80');
});
