var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

app.use(express.static(__dirname));

app.get('/', function(req, res){
  res.sendFile(__dirname + '/index.html');
});

io.on('connection', function(socket){
  socket.on('chat message', function(msg, user){
    io.emit('chat message', msg, user);
  });
});

http.listen(80, function(){
  console.log('listening on Port 80');
});
