const baseurl = "https:localhost:5000/"

async function createRoom(roomID) {
  try{
    const response = await fetch(baseurl + "/createRoom",{
      "method": "POST",
      "headers" : {"Content-Type": "application/json"},
      "body": JSON.stringify({roomID: roomID})
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