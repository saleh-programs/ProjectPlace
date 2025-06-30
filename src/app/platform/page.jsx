"use client"
import { useEffect, useRef, useState } from "react"
import useWebSocket from "react-use-websocket"

import { createRoom } from "../../../backend/requests"
import styles from "../../../styles/pages/Platform.module.css"

function Platform(){
  const [isCreatingRoom, setIsCreatingRoom] = useState(false)
  const [isLoadingRoom, setIsLoadingRoom] = useState(false)
  const [newRoomName, setNewRoomName] = useState("")

  async function handleRoomCreation(){
    const res = await createRoom(newRoomName)
    if (res){
      console.log("success")
      setNewRoomName("")
    }
  }
  function handleRoomLoad(){

  }

  return(
    <div className={styles.platformpage}>
      <div className={styles.sidePanel}>
        <section className={styles.features}>
          <button>Chat</button>
          <button>Documents</button>
          <button>Whiteboard</button>
          <button>Video Chat</button>
        </section>
        <section className={styles.accountHub}>
          <div>Account is: </div>
          <section>
            Would you like to create a room or join a room?
            <button onClick={()=>{setIsCreatingRoom(true);setIsLoadingRoom(false)}}>Create</button>
            {isCreatingRoom &&
              <span>
                <input 
                type="text" 
                placeholder="New Room Name"
                onChange={(e)=>setNewRoomName(e.target.value)} />
                <button onClick={handleRoomCreation}>Submit</button>
              </span>
            }
            <br />
            <button onClick={()=>{setIsCreatingRoom(false);setIsLoadingRoom(true)}}>Join</button>
            {isLoadingRoom &&
              <span>
                <input type="text" placeholder="Room ID" />
                <button onClick={handleRoomLoad}>Submit</button>
              </span>
              }
          </section>

        </section>
      </div>
      <div className={styles.mainContent}>
        <section>
          Chat
        </section>
        <section className={styles.chat}>
          
        </section>
        <section className={styles.newChat}>
          hey
        </section>
      </div>
    </div>
  )
}

export default Platform