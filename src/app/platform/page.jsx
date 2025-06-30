"use client"
import { useEffect, useRef, useState } from "react"
import useWebSocket from "react-use-websocket"
import styles from "../../../styles/pages/Platform.module.css"

function Platform(){
  const [username, setUsername] = useState("")
  const [submitted, setSubmitted] = useState(false)
  return(
    <>
    {
      submitted
      ?
      <Chat username={username}/>
      :
      <div>what's username<input type="text" value={username} onChange={(e)=>setUsername(e.target.value)} />
      <button onClick={()=>setSubmitted(true)}>submit</button>
      </div>
    }
    </>
  )
}

function Chat({ username }){
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState("")
  const canvasRef = useRef()
  const coordinatesRef = useRef([])
  const [coordinates, setCoordinates] = useState([])
  
  const { sendMessage, lastJsonMessage} = useWebSocket("ws://localhost:8000",{
    queryParams: {
      username: username
    },
    onMessage: (event)=>{

      if (event.data){
        const msg = JSON.parse(event.data)
        switch (msg.type){
          case "chat":
            setMessages(msg.data)
            break
          case "coordinate":
            setCoordinates(prev=>[...prev, msg.data])
            coordinatesRef.current.push(msg.data)
            break
          case "allCoordinates":
            setCoordinates(msg.data)
            coordinatesRef.current = msg.data
            break
          default:
            break
        }
      }
    }
  })
useEffect(()=>{
  const realCanvas = canvasRef.current.getContext("2d")
  realCanvas.fillStyle = "blue"
  console.log(coordinates)
  for (let i =0; i < coordinates.length; i++){
    realCanvas.fillRect(...coordinates[i])
  }
},[coordinates])


  useEffect(()=>{
    const realCanvas = canvasRef.current.getContext("2d")
    realCanvas.fillStyle = "blue"

    const onDown = ()=>{
      document.addEventListener("mousemove", onMove)
      document.addEventListener("mouseup",onUp)
    }
    const onMove = (event)=>{
        const elemRect = canvasRef.current.getBoundingClientRect()
        
        const isInside = event.clientX > elemRect.left && event.clientX < elemRect.right && event.clientY > elemRect.top && event.clientY < elemRect.bottom
        if (isInside){
          coordinatesRef.current.push([event.clientX - elemRect.left, event.clientY - elemRect.top,5,5])          
          setCoordinates(coordinatesRef.current)
          realCanvas.fillRect(event.clientX - elemRect.left, event.clientY - elemRect.top,5,5)
          sendMessage(JSON.stringify({
            "type": "coordinate",
            "data": coordinatesRef.current[coordinatesRef.current.length-1]
          }))
        }
    } 
    const onUp = ()=>{
      document.removeEventListener("mousemove", onMove)
      document.removeEventListener("mouseup",onUp)
    }
    document.addEventListener("mousedown",onDown)
    
  },[])

  useEffect(()=>{
  },[lastJsonMessage])

  function handleSend(){
    sendMessage(JSON.stringify({
      "type": "chat",
      "data": newMessage
    }))
    setNewMessage("")
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
          <div>Account is: sm1</div>

        </section>
      </div>
      <div className={styles.mainContent}>
        <section className={styles.chat}>
          {username}
          {
            messages.map((chat, i)=>{
              return(
                <div key={i}>{chat[0]}: {chat[1]}</div>
              )
            })
          }
          <br/>
          <canvas ref={canvasRef} width={200} height={200} style={{border:'1px solid'}}></canvas>

        </section>
        <section className={styles.newChat}>
          type bro
          <input type="text" value={newMessage} onChange={(e)=>setNewMessage(e.target.value)}/>
          <button onClick={handleSend}>send</button>
        </section>
        
      </div>
    </div>
  )
}

export default Platform