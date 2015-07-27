$(document).ready(function() {
// static stuff
var ref = new Firebase("***firebase-url***");
var socket = io();
var canPost = true;
var authData;
var lastUser;
var lastNotification;
var unreadMessages =  false;
var soundEnabledText = "Sound enabled";
var soundDisabledText = "Mentions Only";
var lostConnection = false;
var ServerUser = {name: "Server", tags: "Server", image: "", colour: "inherit"};


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

function formatTimestamp(timestamp) {
  var date = new Date(timestamp);
  var hours = date.getHours().toString();
  var minutes = date.getMinutes().toString();
  if (hours.length == 1){
    hours = "0" + hours
  }
  if (minutes.length == 1){
    minutes = "0" + minutes
  }
  return hours + ":" + minutes
}

function SayAsServer(message){
  showMessage({text: message, timestamp: Date.now()}, ServerUser)
}

function getUsers(socket){
  socket.emit("get users", authData.token, function(users){
    $('#userlist').empty();
    users.data.forEach(function(user){
      $('#userlist').append("<li style='color:" + user.colour +"'>@"+user.name+"</li>");
    });
  });
}

function makeTweetButton(text){
  text = text.replace(/<[^(img)][^>]*>|<img.+?alt="|"[^>]*>/g, "");
  return '<a href="https://twitter.com/share" ' +
    'class="twitter-share-button"' +
    'data-url="http://chat.yrs.io" ' +
    'data-text="' + text + ' // Join the conversation at" ' +
    'data-hashtags="FoC2015" ' +
    'data-count="none">' +
    'Tweet</a>' + '</div>';
}

function showMessage(message, user){
  message.text = emojione.toImage(message.text);

  var msgClass = "msg";
  var hasImage = Boolean(user.image);
  var wasLastUser = lastUser == user.name;
  var canTweet = true;

  var twitterUser = user.name;
  var href = "https://twitter.com/"+ user.image + "/";
  var html = "<li>";

  if (user.name == "Server"){
    msgClass = "server-msg";
    hasImage = false;
    wasLastUser = false;
    canTweet = false;
    href = "http://yrs.io";
  } else if (user.name == "RubyBot") {
    msgClass = "bot-msg";
    canTweet = false;
    href = "http://twitter.com/YRSChat"
  }


  if (!wasLastUser) {
    if (hasImage) {
      html += '<a href="' + href + '" target="_blank"><img class="profileImage" src="' + user.image + '"/></a>';
    }

    html += '<div class="message">' +
      '<a style="color: ' + user.colour + ';" class="twitter-link" href="https://twitter.com/'+ twitterUser +'" target="_blank">' + '@' + user.name + '</a>' +
      '<span class="label label-' + user.tags + '">' + user.tags + '</span><span class="label">' + formatTimestamp(message.timestamp) + '</span><br />' +
      '<p data-timestamp="' + message.timestamp + '"class="' + msgClass + '">' + message.text + '</p>';

    if(canTweet){
      html += makeTweetButton(message.text)
    } else {
      html += '</div>';
    }

  } else {
    messageElement = $('#messages li').last();
    messageElement.find(".message").append("<br /><p data-timestamp='" + message.timestamp + "'class='msg'>" + message.text + "</p>");

    if (canTweet){
      messageElement.find(".message").append(makeTweetButton(message.text));
    }
  }

  html += "</li>";
  var messageElement = $(html);


  messageElement.linkify({
    target: "_blank"
  });

  if (!wasLastUser){
    $('#messages').append(messageElement).animate({scrollTop: 1000000}, "slow");
  }

  lastUser = user.name;

  if(canTweet){
    twttr.widgets.load()
  }

  if (!document.hasFocus()){
    unreadMessages = true;
    updateTitle();
    var nameFormatted = authData.twitter.username;
    if (message.text.toLowerCase().indexOf(nameFormatted.toLowerCase()) !== -1){
        var audio = new Audio('/assets/sound/Ding.mp3');
        audio.play();
    }else{
      if (localStorage.getItem("soundPref") == "1"){
        var audio = new Audio('/assets/sound/pop.ogg');
        audio.play();
      }
    }
    if(notify.permissionLevel() == notify.PERMISSION_GRANTED){
      if(lastNotification){
        lastNotification.close();
	  }
	  if(message.text.length > 300){
	    notificationtext = message.text.substring(0, 300) + "...";
      }
	  else
	  {
        notificationtext = message.text;
	  }
      lastNotification = notify.createNotification("YRS Chat: @" + user.name, {body: notificationtext, icon: "/assets/images/notification.png"})
    }
  }
}

function deleteMessage(timestamp){
  var messageP = $('.msg[data-timestamp=' + timestamp + ']');
  if (messageP.parent().find("p.msg").length == 1){
    messageP.parent().parent().remove();
    lastUser=null;
  } else{
    messageP.next().remove();
    messageP.remove();
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
    SayAsServer("Please do not spam!")
  } else {
    socket.emit('chat message',
      msgbox.val(),
      authData.token,
      function(response) {
        if (response.status == "failed"){
          SayAsServer(response.message)
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
  SayAsServer("You have reconnected to the server.");
  socket.emit("user join", authData.token, authData.twitter.username, authData.twitter.profileImageURL);
  lostConnection = false;
});

socket.on("disconnect", function(){
  SayAsServer("You have been temporarlly disconnected from the server.");
  lostConnection = true;
});

socket.on('chat message', function(message, user) {
  showMessage(message, user);
});


socket.on("user join", function(user) {
  // SayAsServer(user.name + " has joined!");
  getUsers(socket);
});


socket.on("user leave", function(user) {
  // SayAsServer(user.name + " has left.");
  getUsers(socket);
});

socket.on("delete message", deleteMessage);

getUsers(socket);

window.setInterval(function() {
  socket.emit("user ping", authData.token);
  getUsers(socket);
}, 5000);


$(window).unload(function() {
  socket.emit("user leave", authData.token);
})

//check whether notifications are enabled, if so set up options, if not request permission
if(notify.permissionLevel() == notify.PERMISSION_DEFAULT){
  notify.requestPermission();
}
else if(notify.permissionLevel() == notify.PERMISSION_GRANTED){
  notify.config({pageVisibility: true, autoClose: 1200});
}
});

window.onbeforeunload = function(){
    return "Closing the window will disconnect your from YRS Chat";
};
