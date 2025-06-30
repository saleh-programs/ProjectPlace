"use client"
import { useEffect, useRef, useState } from "react"
import useWebSocket from "react-use-websocket"
import styles from "../../../styles/pages/Platform.module.css"

function Platform(){
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