const baseurl = "http://localhost:5000/"

async function createRoom(roomName) {
  try{
    const response = await fetch(baseurl + "/createRoom",{
      "method": "POST",
      "headers" : {"Content-Type": "application/json"},
      "body": JSON.stringify({roomName: roomName})
    })
    const data = await response.json()
    if (!data.success){
      throw new Error(data.message || "req failed")
    }
    return data
  }catch(err){
    console.error(err)
    return null
  }
}

export {createRoom}