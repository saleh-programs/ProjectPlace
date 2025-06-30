const http = require("http")
const { WebSocketServer } = require("ws")
const url = require("url")
const { json } = require("stream/consumers")
const uuidv4 = require("uuid").v4

const httpServer = http.createServer()
const wsServer = new WebSocketServer({server: httpServer})

const connections = {}
const users = {}

const messages = []
const coordinates = []

function broadcast(type){
  const connList = Object.values(connections)
  switch(type){
    case "chat":
      for (let i = 0; i < connList.length; i++){
        connList[i].send(JSON.stringify({
          "type": "chat",
          "data": messages
        }))
      }
      break
    case "coordinate":
      for (let i = 0; i < connList.length; i++){
        connList[i].send(JSON.stringify({
          "type": "coordinate",
          "data": coordinates[coordinates.length-1]
        }))
      }
      break
    default:
      break
  }
}

wsServer.on("connection", (connection, request)=>{
  const username = url.parse(request.url, true).query.username
  const uuid = uuidv4()
  connections[uuid] = connection
  users[uuid] = {
    username: username
  }
  connection.on("message",(message)=>{
    const msg = JSON.parse(message.toString())
    switch(msg.type){
      case "chat":
        messages.push([username, msg.data])
        break
      case "coordinate":
        console.log("het")
        coordinates.push(msg.data)
        break
      default:
        break
    }
    broadcast(msg.type)
  })
  connection.on("close",()=>{
    delete connections[uuid]
  })
  
  connection.send(JSON.stringify({
    "type":"chat",
    "data": messages
  }))
  connection.send(JSON.stringify({
    "type": "allCoordinates",
    "data":coordinates
  }))
})

httpServer.listen(8000,()=>{
  console.log("started main server")
})