"use client"
import { useEffect, useState } from "react"
import useWebSocket from "react-use-websocket"
import styles from "../../../styles/pages/Platform.module.css"

function Platform(){
  const [username, setUsername] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState("")

  const { sendMessage, lastJsonMessage} = useWebSocket("ws://localhost:8000",{
    queryParams: {
      username: username
    }
  })

  useEffect(()=>{
    if (lastJsonMessage){
      setMessages(lastJsonMessage)
    }
  },[lastJsonMessage])

  function handleSend(){
    sendMessage(newMessage)
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
          {
            !submitted && 
            <div>
              what is ur user dawg
              <input type="text" value={username} onChange={(e)=>setUsername(e.target.value)} />
              <button onClick={()=>{setSubmitted(true)}}>submit</button>
            </div>
          }
        </section>
      </div>
      <div className={styles.mainContent}>
        <section className={styles.chat}>
          {submitted && username}
          {
            messages.map((chat, i)=>{
              return(
                <div key={i}>{chat[0]}: {chat[1]}</div>
              )
            })
          }
        </section>
        {submitted && 
        <section className={styles.newChat}>
          type bro
          <input type="text" value={newMessage} onChange={(e)=>setNewMessage(e.target.value)}/>
          <button onClick={handleSend}>send</button>
        </section>
        }
      </div>
    </div>
  )
}

export default Platform