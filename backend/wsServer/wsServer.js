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

function broadcast(){
  const connList = Object.values(connections)
  for (let i = 0; i < connList.length; i++){
    console.log("hi")
    connList[i].send(JSON.stringify(messages))
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
    const msg = message.toString()
    messages.push([username, msg])
    console.log(messages)
    broadcast()
  })
  connection.on("close",()=>{
    delete connections[uuid]
  })
  connection.send(JSON.stringify(messages))

})

httpServer.listen(8000,()=>{
  console.log("started main server")
})