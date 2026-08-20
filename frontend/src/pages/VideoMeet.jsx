import React from 'react';
import io from "socket.io-client";
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, IconButton, TextField } from '@mui/material';
import { Button } from '@mui/material';
import VideocamIcon from "@mui/icons-material/Videocam";
import VideocamOffIcon from "@mui/icons-material/VideocamOff";
import CallEnd from "@mui/icons-material/CallEnd";
import MicIcon from "@mui/icons-material/Mic";
import MicOffIcon from "@mui/icons-material/MicOff";
import ScreenShareIcon from "@mui/icons-material/ScreenShare";
import StopScreenShareIcon from "@mui/icons-material/StopScreenShare";
import ChatIcon from "@mui/icons-material/Chat";

import styles from "../styles/VideoComponent.module.css";
import server from '../environment';

const server_url = server;

var connections = {};

const peerConfigConnections = {
    "iceServers": [
        { "urls": "stun:stun.l.google.com:19302"}   //stun server 
    ]
} 



export default function VideoMeet() {

    var socketRef = useRef();
    let socketIdRef = useRef();

    let localVideoRef = useRef();

    let [videoAvailable, setVideoAvailable] = useState(true);

    let [audioAvailable, setAudioAvailable] = useState(true);

    let [video, setVideo] = useState([]);

    let [audio, setAudio] = useState();

    let [screen, setScreen] = useState();

    let [showModal, setModal] = useState(true);

    let [screenShare, setScreenShare] = useState(false);

    let [screenAvailable, setScreenAvailable] = useState();

    let [messages, setMessages] = useState([])

    let [message, setMessage] = useState("");

    let [newMessages, setNewMessages] = useState(3);

    let [askForUsername, setAskForUsername] = useState(true);

    let [username, setUsername] = useState("");

    const videoRef = useRef([]);
    const pendingIceCandidates = useRef({});

    let [videos, setVideos] = useState([]);

    // if(isChrome() === false) {

    // }

    const getPermissions = async () => {
        try {
        const videoPermissions = await navigator.mediaDevices.getUserMedia({ video: true});

        if(videoPermissions) {
            setVideoAvailable(true);
        } else {
            setVideoAvailable(false);
        }

        const audioPermissions = await navigator.mediaDevices.getUserMedia({ audio : true });

        if(audioPermissions) {
            setAudioAvailable(true);
        } else {
            setAudioAvailable(false);
        }

        if(navigator.mediaDevices.getDisplayMedia) {
            setScreenAvailable(true);
        } else {
            setScreenAvailable(false);
        }

        if(videoAvailable || audioAvailable) {
            const userMediaStream = await navigator.mediaDevices.getUserMedia({video: videoAvailable, audio: audioAvailable});

            if(userMediaStream) {
                window.localStream = userMediaStream;
                if(localVideoRef.current) {
                    localVideoRef.current.srcObject = userMediaStream;
                }
            }
        }


        } catch(error) {
           console.log(error);
        }
    }

    useEffect(() => {
        getPermissions();
    }, [])

    useEffect(() => {
        const handlePageHide = () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
            }

            if (localVideoRef.current && localVideoRef.current.srcObject) {
                localVideoRef.current.srcObject.getTracks().forEach(track => track.stop());
                localVideoRef.current.srcObject = null;
            }

            if (window.localStream) {
                window.localStream.getTracks().forEach(track => track.stop());
                window.localStream = null;
            }
        };

        window.addEventListener("pagehide", handlePageHide);
        window.addEventListener("beforeunload", handlePageHide);

        return () => {
            window.removeEventListener("pagehide", handlePageHide);
            window.removeEventListener("beforeunload", handlePageHide);
            handlePageHide();
        };
    }, []);

    const addLocalStreamToConnection = (peerConnection) => {
        const stream = window.localStream;
        if (!stream || !(stream instanceof MediaStream)) return;

        stream.getTracks().forEach((track) => {
            const senderExists = peerConnection.getSenders().some((sender) => sender.track === track);
            if (!senderExists) {
                peerConnection.addTrack(track, stream);
            }
        });
    };

    const upsertVideo = (socketId, stream) => {
        setVideos((prevVideos) => {
            const existingIndex = prevVideos.findIndex((video) => video.socketId === socketId);
            const nextVideos = [...prevVideos];

            if (existingIndex >= 0) {
                nextVideos[existingIndex] = { ...nextVideos[existingIndex], stream };
            } else {
                nextVideos.push({ socketId, stream, autoPlay: true, playsInline: true });
            }

            videoRef.current = nextVideos;
            return nextVideos;
        });
    };

    let getUserMediaSuccess = (stream) => {

        if (!stream || !(stream instanceof MediaStream)) {
            return;
        }

        try {
            if (window.localStream && window.localStream !== stream) {
                window.localStream.getTracks().forEach(track => track.stop())
            }
        } catch (e) {
            console.log(e)
        }

        window.localStream = stream;
        if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
        }

        for ( let id in connections) {
            if(id === socketIdRef.current) continue;

            addLocalStreamToConnection(connections[id]);

            if (connections[id].signalingState !== "closed") {
                connections[id].createOffer().then((description)=> {
                    connections[id].setLocalDescription(description)
                    .then(()=>{
                        socketRef.current.emit("signal", id, JSON.stringify({"sdp": connections[id].localDescription}))
                    })
                    .catch(e => console.log(e))
                })
            }
        }

        stream.getTracks().forEach(track => track.onended = () => {
            setVideo(false);
            setAudio(false);

            try {
                if (localVideoRef.current && localVideoRef.current.srcObject) {
                    let tracks = localVideoRef.current.srcObject.getTracks();
                    tracks.forEach(track => track.stop())
                }
            } catch(e) {
              console.log(e);
            }

            let blackSilence = (...args) => new MediaStream([black(...args), silence()]);
            window.localStream = blackSilence();
            localVideoRef.current.srcObject = window.localStream;

            for( let id in connections) {
                addLocalStreamToConnection(connections[id]);
                connections[id].createOffer().then((description)=> {
                    connections[id].setLocalDescription(description)
                    .then(() => {
                        socketRef.current.emit("signal", id, JSON.stringify({"sdp": connections[id].localDescription}))
                    }).catch(e => console.log(e));
                })
            }
        })
         
    }

    let silence = () => {
        let ctx = new AudioContext();
        let oscillator = ctx.createOscillator();

        let dst = oscillator.connect(ctx.createMediaStreamDestination());

        oscillator.start();
        ctx.resume()
        return Object.assign(dst.stream.getAudioTracks()[0], {enabled: false });
    }

    let black = ({width = 640, height = 400} = {}) => {
        let canvas = Object.assign(document.createElement("canvas"), {width, height});
        const ctx = canvas.getContext('2d');

        if (ctx) {
            ctx.fillStyle = 'black';
            ctx.fillRect(0, 0, width, height);
        }

        let stream = canvas.captureStream();
        return Object.assign(stream.getVideoTracks()[0], { enabled: false })
    }

    let getUserMedia = () => {
        if((video && videoAvailable) || (audio && audioAvailable)) {
            navigator.mediaDevices.getUserMedia({video: video, audio: audio})
            .then(getUserMediaSuccess)
            .then((stream)=> {})
            .catch((e) => console.log(e))
        } else {
            try {

                let tracks = localVideoRef.current.srcObject.getTracks();
                tracks.forEach(track => track.stop())

            } catch {

            }
        }
    }

    useEffect(()=> {
        if(video !== undefined && audio !== undefined) {
            getUserMedia();
        }
    }, [audio, video]);

    // Todo
    let gotMessageFromServer = (fromId, message) => {
            var signal = JSON.parse(message)

            if(fromId !== socketIdRef.current) {
                if(signal.sdp) {
                    const peerConnection = connections[fromId];
                    if (!peerConnection) return;

                    peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp)).then(()=> {
                        const queuedCandidates = pendingIceCandidates.current[fromId] || [];
                        queuedCandidates.forEach((candidate) => {
                            peerConnection.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => console.log(e));
                        });
                        pendingIceCandidates.current[fromId] = [];

                        if(signal.sdp.type === "offer") {
                            peerConnection.createAnswer().then((description)=> {
                                peerConnection.setLocalDescription(description).then(()=>{
                                    socketRef.current.emit("signal", fromId, JSON.stringify({"sdp": peerConnection.localDescription}))
                                }).catch(e => console.log(e))
                            }).catch(e => console.log(e))
                        }
                    }).catch(e => console.log(e))
                }

                if(signal.ice) {
                    const peerConnection = connections[fromId];
                    if (!peerConnection) return;

                    if (peerConnection.remoteDescription) {
                        peerConnection.addIceCandidate(new RTCIceCandidate(signal.ice)).catch(e=>console.log(e));
                    } else {
                        pendingIceCandidates.current[fromId] = pendingIceCandidates.current[fromId] || [];
                        pendingIceCandidates.current[fromId].push(signal.ice);
                    }
                }
            }
    }

    // Todo
        const addMessage = (data, sender, socketIdSender) => {
                    // Normalize incoming args: server may send different shapes
                    let payload = data;
                    let from = sender;
                    let fromSocketId = socketIdSender;

                    if (payload && typeof payload === 'object' && payload.socketId) {
                            fromSocketId = fromSocketId || payload.socketId;
                    }

                    // Debug log to help verify message arrival
                    console.log('Received chat message', { payload, from, fromSocketId, localId: socketIdRef.current });

                    setMessages((prevMessages) => [
                        ...prevMessages,
                        {sender: from, data: payload}
                    ]);

                    if(fromSocketId && fromSocketId !== socketIdRef.current) {
                        setNewMessages((prevNewMessages) => prevNewMessages + 1);
                    }
        }

    let connectToSocketServer = () => {
        socketRef.current = io.connect(server_url, {secure: false});

        socketRef.current.on('signal', gotMessageFromServer);

        socketRef.current.on("connect", () => {
            socketRef.current.emit("join-call", window.location.href)

            socketIdRef.current = socketRef.current.id 

            socketRef.current.on("chat-message", addMessage);
            socketRef.current.on("chat-messages", addMessage);

            socketRef.current.on("user-left", (id) => {
                setVideos((videos)=>videos.filter((video)=>video.socketId !== id))
            })

            socketRef.current.on("user-joined", (id, clients) => {
                clients.forEach((socketListId)=>{

                    connections[socketListId] = new RTCPeerConnection(peerConfigConnections)

                    connections[socketListId].onicecandidate = (event) => {
                        if(event.candidate !== null) {
                            socketRef.current.emit("signal", socketListId, JSON.stringify({'ice': event.candidate}))
                        }
                    }

                    connections[socketListId].onaddstream = (event) => {
                        upsertVideo(socketListId, event.stream);
                    }

                    if(window.localStream instanceof MediaStream) {
                        addLocalStreamToConnection(connections[socketListId]);
                    } else {
                        let blackSilence = (...args) => new MediaStream([black(...args), silence()]);
                        window.localStream = blackSilence();
                        addLocalStreamToConnection(connections[socketListId]);
                    }

                })

                if(id === socketIdRef.current) {
                    for(let id2 in connections) {
                        if(id2 === socketIdRef.current) continue

                        try {
                           addLocalStreamToConnection(connections[id2]);
                        } catch(e) {      }

                            connections[id2].createOffer().then((description)=>{
                            connections[id2].setLocalDescription(description)
                            .then(()=>{
                                socketRef.current.emit("signal", id2, JSON.stringify({"sdp": connections[id2].localDescription}))
                            })
                            .catch(e => console.log(e))
                           })
                    }
                }
            })
        })

    }

    let getMedia = () => {
        setVideo(videoAvailable);
        setAudio(audioAvailable);
        connectToSocketServer();
    }

    const routeTo = useNavigate();

    let connect = () => {
        setAskForUsername(false);
        getMedia();
    }

    let handleVideo = () => {
        setVideo(!video);
    }

    let handleAudio = () => {
        setAudio(!audio);
    }

    let getDisplayMediaSuccess = (stream) => {
        try {
           window.localStream.getTracks().forEach(track => track.stop());
        } catch (err) {
            console.log(err);
        }

        window.localStream = stream;
        localVideoRef.current.srcObject = stream;


        for(let id in connections) {
            if(id === socketIdRef.current) continue;

            connections[id].addStream(window.localStream)
            connections[id].createOffer().then((description)=>{
                connections[id].setLocalDescription(description)
                .then(() => {
                    socketRef.current.emit("signal", id, JSON.stringify({"sdp": connections[id].localDescription}))
                })
                .catch((e) => console.log(e))
            })
        }

         stream.getTracks().forEach(track => track.onended = () => {
            setScreenShare(false);

            try {
                if (localVideoRef.current && localVideoRef.current.srcObject) {
                    let tracks = localVideoRef.current.srcObject.getTracks();
                    tracks.forEach(track => track.stop())
                }
            } catch(e) {
              console.log(e);
            }

            let blackSilence = (...args) => new MediaStream([black(...args), silence()]);
            window.localStream = blackSilence();
            localVideoRef.current.srcObject = window.localStream;

            getUserMedia();
        })
    }

    let getDisplayMedia = () => {
        if(screenShare) {
            if(navigator.mediaDevices.getDisplayMedia) {
                navigator.mediaDevices.getDisplayMedia({video: true, audio: true})
                .then(getDisplayMediaSuccess)
                .then((stream) => { })
                .catch((e) => console.log(e));
            }
        }
    }

    useEffect(() => {
        if (screenShare) {
            getDisplayMedia();
        }
    }, [screenShare]);

    let handleScreen = () => {
        setScreenShare(!screenShare);
    }

    let sendMessage = () => {
        if (!socketRef.current || !message.trim()) return;

        socketRef.current.emit("chat-message", message.trim(), username || "Guest");
        setMessage("");
    }

    let handleEndCall = () => {
       try {

        let tracks = localVideoRef.current.srcObject.getTracks();
        tracks.forEach(track => track.stop())

       } catch(e) {
        console.log(e);
       } 

       routeTo("/home");
    }
 
     return (
        <div>
          
          {askForUsername === true ? 
            <div>
                 
              <h2>Enter into Lobby</h2>
              <TextField id="outlined-basic" label="Username" value={username} onChange={e => setUsername(e.target.value)} variant="outlined" />
              <Button variant="contained" onClick={connect}>Connect</Button>

              <div>
                <video ref={localVideoRef} autoPlay playsInline muted></video>
              </div>

            </div> :
            
            
            <div className={styles.meetVideoContainer}>

                {showModal ? <div className={styles.chatRoom}>
                    <div className={styles.chatContainer}>
                       <h1>Chat</h1>

                       <div className={styles.chattingDisplay}>
 
                           {messages.length > 0 ? messages.map((item, index)=>{
                             return (
                                <div key={index} style={{ marginBottom: "20px"}}>
                                    <p style={{ fontWeight: "bold" }}>{item.sender}</p>
                                    <p>{item.data}</p>
                                </div>    
                             )
                           }): <>No messages yet</>}

                       </div>

                       <div className={styles.chattingArea}>
                             <TextField value={message} onChange={(e) => setMessage(e.target.value)} id="outlined-basic" label="Enter Your Chat" variant="outlined" />
                             <Button variant='contained' onClick={sendMessage}>Send</Button>
                       </div>
                    </div>
                </div> : <></>}

                <div className={styles.buttonContainer}>
                    <IconButton onClick={handleVideo} style={{color: "white"}}>
                        {(video === true) ? <VideocamIcon /> : <VideocamOffIcon />}
                    </IconButton>

                    <IconButton onClick={handleEndCall} style={{color: "red"}}>
                        <CallEnd />
                    </IconButton>

                    <IconButton onClick={handleAudio} style={{color: "white"}}>
                        {audio === true ? <MicIcon /> : <MicOffIcon/>}
                    </IconButton>

                    {screenAvailable === true  ?
                    <IconButton onClick={handleScreen} style={{color: "white"}}>
                        {screenShare === true ? <ScreenShareIcon /> : <StopScreenShareIcon/>}
                    </IconButton> : null
                    }

                    <Badge badgeContent={newMessages} max={999} color='secondary'>
                        <IconButton onClick={() => setModal(!showModal)} style={{color: "white"}}>
                          <ChatIcon />
                        </IconButton>
                    </Badge>
                </div>
          
               <video className={styles.meetUserVideo} ref={localVideoRef} autoPlay muted></video>

              <div className={styles.conferenceView}>
               {videos.map((video, index)=> (
                <div key={video.socketId || `remote-video-${index}`}>
                       <h2>{video.socketId}</h2>

                       <video 
                       data-socket={video.socketId}
                       ref={ref => {
                        if(ref && video.stream) {
                            ref.srcObject = video.stream;
                        }
                       }}
                       autoPlay
                       >
                       </video>
                </div>
               ))}
              </div>
               
            </div>
          }


        </div>
     )
}