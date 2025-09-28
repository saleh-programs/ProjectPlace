"use client"
import { useContext,useRef, useState, useEffect } from "react"
import ThemeContext from "src/assets/ThemeContext"

function GroupCall(){
    const { device, externalGroupcallRef, sendJsonMessage, username } = useContext(ThemeContext)

    const [isJoined, setIsJoined] = useState(false)
    const connectionStateRef = useRef("disconnected")
    const localCam = useRef(null)

    const callInfo = useRef({
        "sendTransport":{
            "ref": null,
            "connectCallback": null,
            "produceCallback": null
        },
        "recvTransport": {
            "ref": null,
            "connectCallback": null
        },
        "consumers": {},
        "producers": [],
    })
    
    const [streams, setStreams] = useState({})
    const [videoAdded, setVideoAdded] = useState(false)
    const [audioAdded, setAudioAdded] = useState(false)

    const [showVideo, setShowVideo] = useState(true)
    const [showAudio, setShowAudio] = useState(true)

    useEffect(()=>{
        externalGroupcallRef.current = externalGroupcall
        window.addEventListener("beforeunload", disconnect)
        startWebcam()

        return ()=>{
            externalGroupcallRef.current = (param1) => {}
            window.removeEventListener("beforeunload",disconnect)
            disconnect()
        }
    },[])

    function disconnect(){
        console.log("in disconn")

        if (connectionStateRef.current !== "connected"){
            console.log("disconn")
            return
        }

        setIsJoined(false)
        connectionStateRef.current = "disconnecting"
        setStreams({})

        sendJsonMessage({
            "username": username,
            "origin": "groupcall",
            "type": "disconnect",
        })
        
        const activeUsers = Object.values(callInfo.current["consumers"])
        for (let i = 0; i < activeUsers.length; i++){
            for (let consumer of activeUsers[i]){
                consumer.close()
            }
        }
        for (let i = 0; i < callInfo.current["producers"].length; i++){
            callInfo.current["producers"][i].close()
        }
        callInfo.current["sendTransport"]["ref"]?.close()
        callInfo.current["recvTransport"]["ref"]?.close()
        callInfo.current = {
            ...callInfo.current,
            "sendTransport":{
                "ref": null,
                "connectCallback": null,
                "produceCallback": null
            },
            "recvTransport": {
                "ref": null,
                "connectCallback": null
            },
            "producers": [],
            "consumers": {}
        }
        navigator.mediaDevices.getUserMedia({video: videoAdded, audio: audioAdded})
        .then(stream => {
            localCam.current.srcObject = stream
            connectionStateRef.current = "disconnected"
        })
    }
    async function joinGroupCall() {
        console.log(device.current)
        if (!device.current || connectionStateRef.current !== "disconnected"){
            return
        }
        setIsJoined(true)
        connectionStateRef.current = "connecting"
        sendJsonMessage({
            "username": username,
            "origin": "groupcall",
            "type": "userJoined",
            "data": {rtpCapabilities: device.current.rtpCapabilities}
        })
        
        sendJsonMessage({
            "username": username,
            "origin": "groupcall",
            "type": "transportParams"
        })
    }
    async function startWebcam(){
        let stream = new MediaStream()
        try{
            stream = await navigator.mediaDevices.getUserMedia({audio: true, video: true})
            setAudioAdded(true)
            setVideoAdded(true)
        }catch(err){
            console.log("permission denied")
        }
        localCam.current.srcObject = stream
    }

    async function createTransports({sendParams, recvParams}) {
        //set up send transport
        const sendTransport = device.current.createSendTransport(sendParams)
        callInfo.current["sendTransport"]["ref"] = sendTransport
        sendTransport.on("connect", ({dtlsParameters}, callback)=>{
            sendJsonMessage({
                "username": username,
                "origin": "groupcall",
                "type": "sendConnect",
                "data": {dtlsParameters}
            })
            callInfo.current["sendTransport"]["connectCallback"] = callback
        })
        sendTransport.on("produce", ({kind, rtpParameters, appData}, callback)=>{
            sendJsonMessage({
                "username": username,
                "origin": "groupcall",
                "type": "sendProduce",
                "data": { 
                    kind,
                    rtpParameters,
                    appData
                }
            })
            callInfo.current["sendTransport"]["produceCallback"] = callback
        })

        //set up recv transport
        const recvTransport = device.current.createRecvTransport(recvParams)
        callInfo.current["recvTransport"]["ref"] = recvTransport

        recvTransport.on("connect", ({dtlsParameters}, callback) => {
            sendJsonMessage({
                "username": username,
                "origin": "groupcall",
                "type": "recvConnect",
                "data": dtlsParameters
            })
            callInfo.current["recvTransport"]["connectCallback"] = callback
        })

        sendJsonMessage({
            "username": username,
            "origin": "groupcall",
            "type": "receivePeers"
        })
        //create producers
        localCam.current.srcObject.getTracks().forEach(track => {
            addProducer(track)
        })
        connectionStateRef.current = "connected"
    }  
    async function addProducer(track) {
        let produceOptions = {track}
        if (track.kind === "video"){
            produceOptions = {
                ...produceOptions,
                encodings: [
                    {
                        rid: 'r0',
                        maxBitrate: 100000,
                        scalabilityMode: 'S1T3',
                    },
                    {
                        rid: 'r1',
                        maxBitrate: 300000,
                        scalabilityMode: 'S1T3',
                    },
                    {
                        rid: 'r2',
                        maxBitrate: 900000,
                        scalabilityMode: 'S1T3',
                    },
                ],
                codecOptions: {
                    videoGoogleStartBitrate: 1000
                }
            }
        }
        callInfo.current["producers"].push(await callInfo.current["sendTransport"]["ref"].produce(produceOptions))
    }

    async function addConsumer({id, producerId, kind, rtpParameters, uuid}){
        if (!(uuid in callInfo.current["consumers"])){
            return
        }
        const consumer = await callInfo.current["recvTransport"]["ref"].consume({
            id,
            producerId,
            kind,
            rtpParameters
        })
        console.log("consumer adding")

        callInfo.current["consumers"][uuid].push(consumer)
        setStreams(prev => {
            const newStreams = {...prev}
            const consumerExists = newStreams[uuid]?.getTracks().some(t => t === consumer.track)
            if (consumerExists) {
                return prev
            }
            newStreams[uuid].addTrack(consumer.track)
            return newStreams
        })


        sendJsonMessage({
            "username": username,
            "origin": "groupcall",
            "type": "unpauseConsumer",
            "data": id
        })
    }

    async function requestMedia(type){
        let stream
        try{
            if (type === "video"){
                stream = await navigator.mediaDevices.getUserMedia({video: true})
                const videoTrack = stream.getVideoTracks()[0]
                localCam.current.srcObject.addTrack(videoTrack)
                addProducer(videoTrack)
                setVideoAdded(true)
            }
            if (type === "audio"){
                stream = await navigator.mediaDevices.getUserMedia({audio: true})
                const audioTrack = stream.getAudioTracks()[0]
                localCam.current.srcObject.addTrack(audioTrack)
                addProducer(audioTrack)
                setAudioAdded(true)
            }
        }catch(err){
            if (err.name === "NotAllowedError"){
                //later iam going to add prompt in jsx to tell user how to turn media on
                return
            }
            console.error(err)
        }
    }

    async function toggleMedia(type){
        const stream = localCam.current.srcObject
        if (type === "video"){
            const videoTrack = stream.getVideoTracks()[0]
            videoTrack.enabled = !videoTrack.enabled
            setShowVideo(videoTrack.enabled)
        }
        if (type === "audio"){
            const audioTrack = stream.getAudioTracks()[0]
            audioTrack.enabled = !audioTrack.enabled
            setShowAudio(audioTrack.enabled)
        }
    }

    async function externalGroupcall(data){
        //disconnecting or disconnected
        if (connectionStateRef.current.includes("disconnect")){
            return
        }
        const info = callInfo.current
        switch (data.type){
            case "getParticipants":
                console.log("added participants", data.data)
                const newStreams = {}
                for (let i = 0; i < data.data.length; i++){
                    info["consumers"][data.data[i]] = []
                    newStreams[data.data[i]] =  new MediaStream()
                }
                setStreams(newStreams)
                break
            case "transportParams":
                createTransports(data.data)
                break
            case "sendConnect":
                info["sendTransport"]["connectCallback"]()
                break
            case "sendProduce":
                info["sendTransport"]["produceCallback"]({id: data.data})

                // Now we can GIVE this media.
                sendJsonMessage({
                    "origin": "groupcall",
                    "username": username,
                    "type": "givePeers",
                    "data": data.data
                })
                break
            case "recvConnect":
                info["recvTransport"]["connectCallback"]()
                break
            case "addConsumer":

                addConsumer(data.data)
                break
            case "userJoined":
                console.log("user adding")
                info["consumers"][data.data["uuid"]] = []
                setStreams(prev => {
                    const newStreams = {...prev, [data.data["uuid"]]: new MediaStream()}
                    return newStreams
                })
                break
            case "disconnect":
                info["consumers"][data.data["uuid"]].forEach(consumer=>{
                    consumer.close()
                })
                delete info["consumers"][data.data["uuid"]]
                setStreams(prev => {
                    const newStreams = {...prev}
                    delete newStreams[data.data["uuid"]]
                    return newStreams
                })
                break
        }
    }
    
    return(
        <div>
            <video ref={localCam} playsInline autoPlay muted width={200}></video>
            {
                videoAdded
                ?
                    <button onClick={()=>toggleMedia("video")}>Toggle Video</button>
                :
                    <button onClick={()=>requestMedia("video")}>Add Video</button>
            }
            {
                audioAdded
                ?
                    <button onClick={()=>toggleMedia("audio")}>Toggle Audio</button>
                :
                    <button onClick={()=>requestMedia("audio")}>Add Audio</button>
            }

            {Object.entries(streams).sort(([a],[b])=>a.localeCompare(b)).map(([peerID, stream])=>{
                const assignStream = (elem) => {if (elem && elem.srcObject !== stream){
                    elem.srcObject = stream 
                }}
                return <video key={peerID} ref={assignStream} autoPlay playsInline width={200}></video>
            })}
            {
                isJoined 
                ?
                    <button onClick={disconnect}>Exit Group Call</button>
                :
                    <button onClick={joinGroupCall}>Join Group Call</button>
                    
            }
        </div>
    )
}
export default GroupCall