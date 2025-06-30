const http = require("http")
const { WebSocketServer } = require("ws")
const url = require("url")
const { json } = require("stream/consumers")
const uuidv4 = require("uuid").v4

const httpServer = http.createServer()
const wsServer = new WebSocketServer({server: httpServer})

const connections = {}
const users = {}

function broadcast(){
}

wsServer.on("connection", (connection, request)=>{
  const username = url.parse(request.url, true).query.username
  const uuid = uuidv4()
  
  connections[uuid] = connection
  users[uuid] = {
    username: username
  }

  connection.on("message",(message)=>{})
  connection.on("close",()=>{})
})

httpServer.listen(8000,()=>{
  console.log("started main server")
})