const http = require("http")
const { WebSocketServer } = require("ws")
const url = require("url")
const { json } = require("stream/consumers")
const uuidv4 = require("uuid").v4

const httpServer = http.createServer()
const wsServer = new WebSocketServer({server: httpServer})

const connections = {}
const users = {}

function handleMessage(data, uuid){
  const parsedData = JSON.parse(data.toString())
  switch (parsedData.type){
    case "chat":
      broadcastMessage(parsedData.data, uuid)
      break
  }
}
function handleClose(uuid){
  delete connections[uuid]
}

function broadcastMessage(message, uuid){
  Object.values(connections).forEach(conn=>{
    if (conn !== connections[uuid]){
      conn.send(JSON.stringify({
        "type": "chat",
        "data": message
      }))
     }
  })
}


wsServer.on("connection", (connection, request)=>{
  const username = url.parse(request.url, true).query.username
  const uuid = uuidv4()
  
  connections[uuid] = connection
  users[uuid] = {
    username: username
  }

  connection.on("message",(data)=>handleMessage(data, uuid))
  connection.on("close",()=>handleClose(uuid))
})


httpServer.listen(8000,()=>{
  console.log("started main server")
})