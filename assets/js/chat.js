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

$(document).ready(function(){
  var check = false;
  (function(a){if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino|android|ipad|playbook|silk/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4)))check = true})(navigator.userAgent||navigator.vendor||window.opera);
  if (check == true) {
    $('.prefsButton').css("display","none");
    $('form button').css("display", "none");
    $('form input').css("width","calc(100% - 30px)");
  }
})

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
    if (msg.indexOf(nameFormatted) !== -1){
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
