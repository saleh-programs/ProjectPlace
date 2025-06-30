const http = require("http")
const { WebSocketServer } = require("ws")
const url = require("url")
const { json } = require("stream/consumers")
const uuidv4 = require("uuid").v4

const { storeMessage } = require("../requests.js")

const httpServer = http.createServer()
const wsServer = new WebSocketServer({server: httpServer})

const connections = {}
const users = {}
const rooms = {}

async function handleMessage(data, uuid){
  const parsedData = JSON.parse(data.toString())
  switch (parsedData.type){
    case "chat":
      await storeMessage({
        "username": users[uuid].username,
        "roomID": users[uuid].roomID,
        "message": parsedData.data 
      })
      broadcastMessage(parsedData.data, uuid)
      break
  }
}
function handleClose(uuid){
  rooms[users[uuid].roomID] = rooms[users[uuid].roomID].filter(item => item !== connections[uuid])
  delete connections[uuid]
}

function broadcastMessage(message, uuid){
  rooms[users[uuid].roomID].forEach(conn=>{
    if (conn !== connections[uuid]){
      conn.send(JSON.stringify({
        "type": "chat",
        "user": users[uuid].username,
        "data": message
      }))
     }
  })
}


wsServer.on("connection", (connection, request)=>{
  const username = url.parse(request.url, true).query.username
  const roomID = url.parse(request.url, true).query.roomID
  const uuid = uuidv4()
  
  connections[uuid] = connection
  users[uuid] = {
    username: username,
    roomID: roomID
  }
  if (roomID in rooms){
    rooms[roomID].push(connection)
  }else{
    rooms[roomID] = [connection]
  }

  connection.on("message",(data)=>handleMessage(data, uuid))
  connection.on("close",()=>handleClose(uuid))
})


httpServer.listen(8000,()=>{
  console.log("started main server")
})