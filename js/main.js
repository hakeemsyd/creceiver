'use strict';

var peerConnection = null;
var answerSent = false;
var offerAnswerOptions = {
  offerToReceiveAudio: 1,
  offerToReceiveVideo: 1
};

var startTime;
var remoteVideo = document.getElementById('remoteVideo');

var socket = io.connect('http://192.168.1.4:8889');
socket.on('connect', function(data) {
  socket.emit('onwebpeerconnected', {msg: 'Chromecast Client'});
});

socket.on('offer', function(data) {
  reset();
  console.log(data);
  hanleOfferFromRemote({sdp: data.sdp, type: 'offer'});
});

socket.on('setice', function(data) {
  if (peerConnection == null) {
    return;
  }

  var ice = JSON.parse(data)
  console.log('Remote Peer Ice Candidates: ' + ice.candidate);
  peerConnection.addIceCandidate(ice)
    .then(
      function() {
        onAddIceCandidateSuccess(peerConnection);
      },
      function(err) {
        onAddIceCandidateError(peerConnection, err);
      }
    );
});

function onIceCandidate(pc, event) {
  //var str = JSON.stringify(event.candidate);
  if (/*str.includes('192.168.1.3') &&*/ peerConnection != undefined && event.candidate) {
    console.log("peerConnection has iceservers" + JSON.stringify(event.candidate));
    var res = peerConnection.localDescription
    if (!answerSent) {
      console.log('Answer from peerConnection:\n' + res.sdp);
      socket.emit('answer', {sdp: res.sdp});
      answerSent = true;
    }

    return;
  }

  console.log(getName(pc) + ' ICE candidate: \n' + (event.candidate ?
      event.candidate.candidate : '(null)'));
}

socket.on('disconnect', function() {
  if(peerConnection != null) {
    peerConnection.close();
    reset();
  }
});

remoteVideo.addEventListener('loadedmetadata', function() {
  console.log('Remote video videoWidth: ' + this.videoWidth +
    'px,  videoHeight: ' + this.videoHeight + 'px');
});

remoteVideo.onresize = function() {
  console.log('Remote video size changed to ' +
    remoteVideo.videoWidth + 'x' + remoteVideo.videoHeight);
  // We'll use the first onsize callback as an indication that video has started
  // playing out.
  if (startTime) {
    var elapsedTime = window.performance.now() - startTime;
    console.log('Setup time: ' + elapsedTime.toFixed(3) + 'ms');
    startTime = null;
  }
};

function getName(pc) {
  return (pc == peerConnection) ? 'LocalPeer' : 'RemotePeer';
}

function gotStream(stream) {
  console.log('Received local stream');
  remoteVideo.srcObject = stream;
  remoteStream = stream;
  callButton.disabled = false;
}

function onCreateSessionDescriptionError(error) {
  console.log('Failed to create session description: ' + error.toString());
}

function hanleOfferFromRemote(desc) {
  console.log('LS offer\n' + desc.sdp);
  var servers = null;
  peerConnection = new RTCPeerConnection(servers);
  console.log('Created remote peer connection object peerConnection');
  peerConnection.onicecandidate = function(e) {
    onIceCandidate(peerConnection, e);
  };
  peerConnection.oniceconnectionstatechange = function(e) {
    onIceStateChange(peerConnection, e);
  };
  peerConnection.ontrack = gotRemoteStream;

  peerConnection.setRemoteDescription(desc).then(
    function() {
      onSetRemoteSuccess(peerConnection);
    },
    onSetSessionDescriptionError
  );
  console.log('Static answer set');
  peerConnection.createAnswer().then(
    onCreateAnswerSuccess,
    onCreateSessionDescriptionError
  );
}

function onSetLocalSuccess(pc) {
  console.log(getName(pc) + ' setLocalDescription complete');
}

function onSetRemoteSuccess(pc) {
  console.log(getName(pc) + ' setRemoteDescription complete');
}

function onSetSessionDescriptionError(error) {
  console.log('Failed to set session description: ' + error.toString());
}

function gotRemoteStream(e) {
  console.log('gotstream');
  if (remoteVideo.srcObject !== e.streams[0]) {
    remoteVideo.srcObject = e.streams[0];
    console.log('peerConnection received remote stream');
  }
}

function onCreateAnswerSuccess(desc) {
  console.log('peerConnection setLocalDescription start');
  peerConnection.setLocalDescription(desc).then(
    function() {
      onSetLocalSuccess(peerConnection);
    },
    onSetSessionDescriptionError
  );
}

function onAddIceCandidateSuccess(pc) {
  console.log(getName(pc) + ' addIceCandidate success');
}

function onAddIceCandidateError(pc, error) {
  console.log(getName(pc) + ' failed to add ICE Candidate: ' + error.toString());
}

function onIceStateChange(pc, event) {
    console.log(getName(pc) + ' ICE state: ' + pc.iceConnectionState);
}

function reset() {
  console.log('Ending call');
  if (peerConnection != null) {
    peerConnection.close();
  }
  peerConnection = null;
  answerSent = false;
}
