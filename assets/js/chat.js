$(document).ready(function() {
// static stuff
var ref = new Firebase("***firebase-url***");
var socket = io();
var canPost = true;
var authData;
var lastUser;
var unreadMessages =  false;
var soundEnabledText = "Sound enabled";
var soundDisabledText = "Mentions Only";
var lostConnection = false;

var msgbox = $("#message");

$('.helpButton').click(function() {
  $('.about-box').fadeIn(function() {
    $('.close-button').click(function() {
      $('.about-box').fadeOut()
    });
  })
});

function updateSoundPrefButton(){
  // Check localstorage
  if (localStorage.getItem("soundPref") === null){
    localStorage.setItem("soundPref", 1)
  }else if (localStorage.getItem("soundPref") == 1){
    document.getElementById("soundPref").innerHTML = soundEnabledText;
  }else{
    document.getElementById("soundPref").innerHTML = soundDisabledText;
  }
}
updateSoundPrefButton();

$("#soundPref").click(toggleSoundPref);

function toggleSoundPref(){
  if (localStorage.getItem("soundPref") == "1"){
    localStorage.setItem("soundPref", 0);
  } else {
    localStorage.setItem("soundPref", 1);
  }

  updateSoundPrefButton()
}


function updateTitle() {
  var title= $(document).find("title");
  console.log(title);
  if (unreadMessages){
    if (title.text().charAt(0) != "*" ){
      title.text("* " + title.text())
    }
  }else{
    if (title.text().charAt(0) == "*"){
      title.text(title.text().substring(2));
    }
  }
}

window.onfocus = function() {
  unreadMessages = false;
  updateTitle();
};

function showMessage(msg, user, tags, imageLink, colour) {
  msg = emojione.toImage(msg);
  var doAppend = true;

  var messageElement;
  if (user == 'RubyBot' && lastUser != 'RubyBot') {
    messageElement = $('<li>').html(
      '<a href="https://twitter.com/YRSChat" target="_blank"><img class="profileImage" src="' + imageLink + '"/></a>' +
      '<div class="message">' +
      '<a style="color: ruby;" class="twitter-link" href="https://twitter.com/'+ user +'" target="_blank">@' + user + '</a><span class="label label-' + tags + '">' + tags + '</span>' +
      '<p class="bot-msg">' + msg + '</p></div>'
    );

  } else if (user == 'Server') {
    messageElement = $('<li class="server-msg">').html('<a href="http://yrs.io" target="_blank">' + user + '</a>' + ': ' + msg);

  } else {
    if (user == lastUser) {
      messageElement = $('#messages li').last();
      messageElement.find(".message").append("<p class='msg'>" + msg + "</p>");
    } else if (!imageLink || imageLink == ''){
      messageElement = $('<li>').html(
        '<a href="https://twitter.com/'+ user +'" target="_blank"></a>' +
        '<div class="message">' +
        '<a style="color: ' + colour + ';" class="twitter-link" href="https://twitter.com/'+ user +'" target="_blank">@' + user + '</a><span class="label label-' + tags + '">' + tags + '</span>' +
        '<p class="msg">' + msg + '</p></div>'
      );
    } else {
      messageElement = $('<li>').html(
        '<a href="https://twitter.com/'+ user +'" target="_blank"><img class="profileImage" src="' + imageLink + '"/></a>' +
        '<div class="message">' +
        '<a style="color: ' + colour + ';" class="twitter-link" href="https://twitter.com/'+ user +'" target="_blank">@' + user + '</a><span class="label label-' + tags + '">' + tags + '</span>' +
        '<p class="msg">' + msg + '</p></div>'
      );
    }


  }
  lastUser = user;
  messageElement.linkify({
    target: "_blank"
  });

  $('#messages').append(messageElement).animate({scrollTop: 1000000}, "slow");

  if (document.hasFocus() == false){
    unreadMessages = true;
    updateTitle();
    var nameFormatted = authData.twitter.username;
    if (msg.toLowerCase().indexOf(nameFormatted.toLowerCase()) !== -1){
        var audio = new Audio('/assets/sound/Ding.mp3');
        audio.play();
    }else{
      if (localStorage.getItem("soundPref") == "1"){
        var audio = new Audio('/assets/sound/pop.ogg');
        audio.play();
      }
    }
  }
}


// firebase stuff
ref.onAuth(function(data) {
  authData = data;
  if (!data){
    $('.twitter').css("display", "block")
  } else {
    socket.emit("user join", data.token, data.twitter.username, data.twitter.profileImageURL);
  }
});

$('#twitter-button').click(function() {
  ref.authWithOAuthPopup("twitter", function(error, data) {
    if (error) {
      console.log("Login Failed!", error);
    } else {
      $('.twitter').fadeOut()
    }
  });
  return false;
});

ref.getAuth();

$('form').submit(function(){
  if(canPost == false){
    showMessage('Please do not spam!', 'Server', '');
  } else {
    socket.emit('chat message',
      msgbox.val(),
      authData.token,
      function(response) {
        if (response.status == "failed"){
          showMessage(response.message, "Server", "", "");
        }
      }
    );
    canPost=false;
    setTimeout(function(){canPost=true},500);
  }
  msgbox.val('');
  return false;
});

socket.on("connect", function(){
  if (!authData) return;
  if (!lostConnection) return;
  showMessage("You have reconnected to the server.", "Server");
  socket.emit("user join", authData.token, authData.twitter.username, authData.twitter.profileImageURL);
  lostConnection = false;
});

socket.on("disconnect", function(){
  showMessage("You have been temporarlly disconnected from the server.", "Server");
  lostConnection = true;
});

socket.on('chat message', function(message, user) {
  showMessage(message, user.name, user.tags, user.image, user.colour);
});


socket.on("user join", function(user) {
  showMessage(user.name + " has joined!", "Server")
});


socket.on("user leave", function(user) {
  showMessage(user.name + " has left.", "Server")
});

// socket.emit("get users", token, function(users){
//   users.forEach(function(user){
//     console.log(user);
//   });
// });

window.setInterval(function() {
  socket.emit("user ping", authData.token)
}, 5000);


$(window).unload(function() {
  socket.emit("user leave", authData.token);
})
});

window.onbeforeunload = function(){
    return "Closing the window will disconnect your from YRS Chat";
};
