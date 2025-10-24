import http from "http"
import {WebSocketServer} from "ws"
import mediasoup from "mediasoup"
import url from "url"
import {v4 as uuidv4} from "uuid"

import {createCanvas, loadImage} from "canvas"
import { storeMessageReq, getMessagesReq,getRoomUsersReq, updateCanvasSnapshotReq, updateCanvasInstructionsReq, getCanvasSnapshotReq, getCanvasInstructionsReq } from "../requests.js"
import { draw, fill, clear } from "../../utils/canvasArt.js"

const httpServer = http.createServer()
const wsServer = new WebSocketServer({server: httpServer})

const connections = {}
const users = {}
const rooms = {}

const mediaCodecs = [
  {
    kind: 'audio',
    mimeType: 'audio/opus',
    clockRate: 48000,
    channels: 2,
  },
  {
    kind: 'video',
    mimeType: 'video/VP8',
    clockRate: 90000,
    parameters: {
      'x-google-start-bitrate': 1000,
    },
  },
]

let worker;
mediasoup.createWorker()
.then(w => {
  worker = w;
})
let token;
getToken()
.then(t =>{
  token = t;
})



// any message layout:
/*
{
  "origin" : chat/whiteboard/documents, ---all have this---
  "type" :  erase/newMessage/fill (specific type)
  "user": username,  ---all have this---
  "data": draw commands/fill instructions/newest chat, ---all have this---
  "metadata": user's color/ stroke size/ draw status(isDraw/doneDraw)
}
 */

wsServer.on("connection", (connection, request)=>{
  console.log("made connection")
  const username = url.parse(request.url, true).query.username
  const roomID = url.parse(request.url, true).query.roomID
  const uuid = uuidv4()

  connections[uuid] = connection
  users[uuid] = {
    "username": username,
    "roomID": roomID,
    "groupcall": {
      "connected": false,
      "sendTransport": null,
      "recvTransport": null,
      "producers": [],
      "consumers": [],
      "rtpCapabilities": null
    }
  }

  sendServerInfo(uuid);
  
  connection.on("message",(data)=>handleMessage(data, uuid));
  connection.on("close",()=>handleClose(uuid));
})

// Handle new messages / close
function handleClose(uuid){
  const roomID = users[uuid]["roomID"]

  delete rooms[roomID]["users"][uuid]
  delete connections[uuid]
  delete users[uuid]

  if (rooms[roomID]["users"].length === 0){
    rooms[roomID]["whiteboard"]["canvas"].getContext("2d").putImageData(rooms[roomID]["whiteboard"]["snapshot"],0,0)
    const savedCanvasBuffer = rooms[roomID]["whiteboard"]["canvas"].toBuffer("image/png")
    updateCanvasSnapshotReq(savedCanvasBuffer, roomID, token)
    updateCanvasInstructionsReq(rooms[roomID]["operations"], roomID, token)

    rooms[roomID]["groupcall"]["router"].close()
    delete rooms[roomID]
  }
}

function handleMessage(data, uuid){
  const parsedData = JSON.parse(data.toString())

  switch (parsedData.origin){
    case "chat":
      processChat(parsedData, uuid)
      break
    case "whiteboard":
      processWhiteboard(parsedData, uuid)
      break
    case "groupcall":
      processGroupcall(parsedData, uuid)
      break
    case "peercall":
      processPeercall(parsedData, uuid)
      break
    case "user":
      processUser(parsedData, uuid)
      break
  }
}

//Process messages respective of origins
async function processChat(data, uuid){
  switch(data.type){
    case "newMessage":
      await storeMessageReq(data.data, users[uuid]["roomID"], token)
      break
    case "edit":
      await editMessageReq(data.data, users[uuid]["roomID"], token)
      break
    case "delete":
      await deleteMessageReq(data.data, users[uuid]["roomID"], token)
      break
  } 
  
  broadcastAll(uuid, data, true);
}
function processWhiteboard(data, uuid){
  broadcastAll(uuid, data, false)
  handleCanvasAction(data, users[uuid]["roomID"] )
}
async function processGroupcall(data, uuid){
  const roomID = users[uuid]["roomID"]
  const roomCallInfo = rooms[roomID]["groupcall"]
  const userCallInfo = users[uuid]["groupcall"]

  switch(data.type){
    case "userJoined":
      userCallInfo["connected"] = true
      roomCallInfo["callParticipants"].push(uuid)
      userCallInfo["rtpCapabilities"] = data.data["rtpCapabilities"]

      broadcastAll(uuid,{
        ...data,
        "data": {uuid}
      })

      //user will have this on client side soon
      connections[uuid].send(JSON.stringify({
        "origin": "groupcall",
        "type": "getParticipants",
        "data": roomCallInfo["callParticipants"].filter(id => id !== uuid)
      }))

      break
    case "transportParams":
      const sendTransport = await makeTransport(roomID)
      const recvTransport = await makeTransport(roomID)
      userCallInfo["sendTransport"] = sendTransport
      userCallInfo["recvTransport"] = recvTransport

      connections[uuid].send(JSON.stringify({
        "origin": "groupcall",
        "type": "transportParams",
        "data": {
          "sendParams": {
            "id": sendTransport.id,
            "iceParameters": sendTransport.iceParameters,
            "iceCandidates": sendTransport.iceCandidates,
            "dtlsParameters": sendTransport.dtlsParameters
          },
          "recvParams": {
            "id": recvTransport.id,
            "iceParameters": recvTransport.iceParameters,
            "iceCandidates": recvTransport.iceCandidates,
            "dtlsParameters": recvTransport.dtlsParameters
          }
        }
      }))
      break
    case "sendConnect":
      const {dtlsParameters} = data.data
      await userCallInfo["sendTransport"].connect({dtlsParameters})

      connections[uuid].send(JSON.stringify({
        "origin": "groupcall",
        "type": "sendConnect",
      }))
      break
    case "sendProduce":
      const {kind, rtpParameters} = data.data
      const producer = await userCallInfo["sendTransport"].produce({kind, rtpParameters})
      userCallInfo["producers"].push(producer)
      roomCallInfo["producers"][producer.id] = producer

      connections[uuid].send(JSON.stringify({
        "origin": "groupcall",
        "type": "sendProduce",
        "data": producer.id
      }))
      break
    case "recvConnect":
      userCallInfo["recvTransport"].connect({dtlsParameters: data.data})
      connections[uuid].send(JSON.stringify({
        "origin": "groupcall",
        "type": "recvConnect",
      }))
      break
    case "givePeers":
      for (let i = 0; i < roomCallInfo["callParticipants"].length; i++){
        const userID = roomCallInfo["callParticipants"][i]
        const peerCallInfo = users[userID]["groupcall"]
        if (userID === uuid) {
          continue
        }
        const options = {
          producerId: data.data,
          rtpCapabilities: peerCallInfo["rtpCapabilities"]
        }

        if (!roomCallInfo["router"].canConsume(options)){
          continue
        }

        const consumer = await peerCallInfo["recvTransport"].consume({
          producerId: data.data,
          rtpCapabilities: peerCallInfo["rtpCapabilities"],
          paused: true
        })

        peerCallInfo["consumers"].push(consumer)
        roomCallInfo["consumers"][consumer.id] = consumer

        connections[userID].send(JSON.stringify({
          "origin": "groupcall",
          "type": "addConsumer",
          "data": {
            id: consumer.id,
            producerId: data.data,
            kind: consumer.kind,
            rtpParameters: consumer.rtpParameters,
            uuid: uuid
          }
        }))
      }
      break
    case "receivePeers":
      for (let i = 0; i < roomCallInfo["callParticipants"].length; i++){
        const userID = roomCallInfo["callParticipants"][i]
        if (userID == uuid) {
          continue
        }
        for (let j = 0; j < userCallInfo["producers"].length; j++){
          const producer = userCallInfo["producers"][j] 
          const options = {
            producerId: producer.id,
            rtpCapabilities: userCallInfo["rtpCapabilities"]
          }
          if (!roomCallInfo["router"].canConsume(options)){
            continue
          }

          const consumer = await userCallInfo["recvTransport"].consume({
            producerId: producer.id,
            rtpCapabilities: userCallInfo["rtpCapabilities"],
            paused: true
          })

          userCallInfo["consumers"].push(consumer)
          roomCallInfo["consumers"][consumer.id] = consumer
          
          connections[uuid].send(JSON.stringify({
            "origin": "groupcall",
            "type": "addConsumer",
            "data": {
              id: consumer.id,
              producerId: producer.id,
              kind: consumer.kind,
              rtpParameters: consumer.rtpParameters,
              uuid: userID
            }
          }))
        }
      }
      break
    case "unpauseConsumer":
      roomCallInfo["consumers"][data.data].resume()
      break
    case "disconnect": 
      broadcastAll(uuid,{
        ...data,
          "data": {uuid}
      })
      roomCallInfo["callParticipants"].filter(userid => userid !== uuid)
      userCallInfo["producers"].forEach(p => delete roomCallInfo["producers"][p.id])
      userCallInfo["consumers"].forEach(c => delete roomCallInfo["consumers"][c.id])

      userCallInfo["sendTransport"].close()
      userCallInfo["recvTransport"].close()
      users[uuid]["groupcall"] = {
        "connected": false,
        "sendTransport": null,
        "recvTransport": null,
        "producers": [],
        "consumers": [],
        "rtpCapabilities": null
      }
      break
  } 
}
async function processPeercall(data, uuid){
  broadcastOne(uuid, data, data.data["peer"])
}
function processUser(data, uuid){
  broadcastAll(uuid, data)
}


//utility functions
async function sendServerInfo(uuid) {
  const roomID = users[uuid]["roomID"]
  const connection = connections[uuid]

  const roomHistories = [getRoomUsersReq(roomID, token), getMessagesReq(roomID, token)]
  let initializing = false

  if (roomID in rooms){
    rooms[roomID]["users"].push(uuid)
    roomHistories.push(rooms[roomID]["whiteboard"]["canvas"])
    roomHistories.push(rooms[roomID]["whiteboard"]["operations"])
  }else{
    initializing = true
    const canvas = createCanvas(1000,1000)
    roomHistories.push(
      getCanvasSnapshotReq(roomID, token)
      .then(buffer => loadImage(buffer))
      .then(img => {
        canvas.getContext("2d").drawImage(img,0,0);
        return canvas
      }))
    roomHistories.push(getCanvasInstructionsReq(roomID, token))
  }
  const [roomUsers, chatHistory, canvasSnapshot, canvasInstructions] = await Promise.all(roomHistories)

  if (initializing){
    rooms[roomID] = {
      "users": [uuid],
      "whiteboard": {
        "snapshot": canvasSnapshot.getContext("2d").getImageData(0,0,canvasSnapshot.width, canvasSnapshot.height),
        "canvas": canvasSnapshot,
        "operations": canvasInstructions,
        "latestOp": canvasInstructions.length - 1
        },
      "groupcall": {
        "router": await worker.createRouter({mediaCodecs}),
        "callParticipants": [],
        "consumers": {},
        "producers": {}
      }
    }
  }

  connection.send(JSON.stringify({
    "origin": "user",
    "type": "getUsers",
    "data": roomUsers
  }))
  connection.send(JSON.stringify({
    "origin": "chat",
    "type": "chatHistory",
    "data": chatHistory
  }))
  connection.send(JSON.stringify({
    "origin": "groupcall",
    "type": "setup",
    "data": {
      "routerRtpCapabilities": rooms[roomID]["groupcall"]["router"].rtpCapabilities,
    }
  }))

  const opsBuffer = Buffer.from(JSON.stringify(canvasInstructions))
  const canvasBuffer = canvasSnapshot.toBuffer("image/png")
  const canvasInfo = Buffer.concat([Buffer.alloc(5), opsBuffer, canvasBuffer])
  canvasInfo.writeUInt32BE(opsBuffer.length, 0)
  canvasInfo.writeInt8(rooms[roomID]["whiteboard"]["latestOp"], 4)
  connection.send(canvasInfo)
  
  initializing && redrawCanvas(roomID)
}

async function makeTransport(roomID) {
  const transport = await rooms[roomID]["groupcall"]["router"].createWebRtcTransport({
    listenIps: [
      {
        ip: '0.0.0.0', 
        announcedIp: '127.0.0.1',
      }
    ],
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
  })
  return transport
}

function broadcastAll(uuid, data, toSender=false){
  rooms[users[uuid]["roomID"]]["users"].forEach(id =>{
    (id !== uuid || toSender) && connections[id].send(JSON.stringify(data))
  })
}

function broadcastOne(uuid, data, peerUsername){
  const userList = rooms[users[uuid]["roomID"]]["users"]
  for (let i = 0; i < userList.length; i++){
    if (peerUsername === users[userList[i]]["username"]){
      conn.send(JSON.stringify(data))
      return
    }
  }
}
async function getToken() {
  try {
      const response = await fetch('https://dev-projectplace.us.auth0.com/oauth/token', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          "client_id":"SSFgwe9fepsAecFde32FpkMumdQfq9uU",
          "client_secret":"kYYPqNp-MUKJnfbTlv-6knpaCxcXxANWj2hq0MCg_LwnYb3d1i249XofPMfEOKJ8",
          "audience":"http://projectplace/backend",
          "grant_type":"client_credentials"
        }),
      });

      if (!response.ok) {
          throw new Error('Network response was not ok');
      }

      const data = await response.json();
      console.log("received token", data);
      return data["access_token"]
  } catch (error) {
      console.error('Error fetching token:', error);
  }
};

// Canvas/Drawing
function handleCanvasAction(data, roomID){
  const exclude = ["isDrawing", "isErasing"]
  if (exclude.includes(data.type)){
    return
  }
  const wbInfo = rooms[roomID]["whiteboard"]

  switch (data.type){
    case "undo":
      wbInfo["latestOp"] -= 1
      wbInfo["canvas"].getContext("2d").putImageData(wbInfo["snapshot"], 0, 0)
      redrawCanvas(roomID)
      break
    case "redo":
      wbInfo["latestOp"] += 1
      updateServerCanvas(wbInfo["operations"][wbInfo["latestOp"]], roomID)
      break
    default:
      wbInfo["latestOp"] += 1
      wbInfo["operations"] = wbInfo["operations"].slice(0, wbInfo["latestOp"])
      wbInfo["operations"].push(data)

      if (wbInfo["operations"].length > 10){
        wbInfo["canvas"].getContext("2d").putImageData(wbInfo["snapshot"], 0, 0)
        for (let i = 0; i <= wbInfo["latestOp"]; i++){
          updateServerCanvas(wbInfo["operations"][i], roomID)
          if (i == 4){
            wbInfo["snapshot"] = wbInfo["canvas"].getContext("2d").getImageData(0,0,wbInfo["canvas"].width, wbInfo["canvas"].height)
          }
        }
        wbInfo["operations"] = wbInfo["operations"].slice(5)
        wbInfo["latestOp"] = 5
      }else{
          updateServerCanvas(data, roomID)
      }
  }
}

function redrawCanvas(roomID){
  const wbInfo = rooms[roomID]["whiteboard"]

  wbInfo["canvas"].getContext("2d").putImageData(wbInfo["snapshot"],0,0)
  for (let i = 0; i <= wbInfo["latestOp"]; i++){
    updateServerCanvas(wbInfo["operations"][i], roomID)
  }
}
function updateServerCanvas(data, roomID){
  const mainCanvas = rooms[roomID]["whiteboard"]["canvas"]
    
  switch (data.type){
    case "doneDrawing":
      draw(data["data"], mainCanvas, false, data["metadata"])
      break
    case "doneErasing":
      draw(data["data"], mainCanvas, true, data["metadata"])
      break
    case "fill":
      fill(data["data"], mainCanvas, data["metadata"])
      break
    case "clear":
      clear(mainCanvas)
      break
  }
}



httpServer.listen(8000,()=>{
  console.log("started main server")
})