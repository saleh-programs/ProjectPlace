"use client"

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import styles from "../../styles/pages/Home.module.css"

function Home(){
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const router = useRouter()

  useEffect(()=>{
    router.push("/platform")
  },[])

  return(
  <div className={styles.homepage}>
    <div className={styles.signin}>
      <section className={styles.title}>
        Sign In
      </section>
      <section className={styles.body}>
        <article className={styles.prompt}>
          <span>What is yout username?</span>
          <input type="text" value={username} onChange={(e)=>setUsername(e.target.value)}/>
        </article>
        <article className={styles.prompt}>
          <span>What is yout password?</span>
          <input type="text" value={password} onChange={(e)=>setPassword(e.target.value)}/>
        </article>
      </section>
      <section className={styles.submit}>
        <button onClick={()=>{window.location.href="http://localhost:5000/login"}}>nothing matters but this</button>
        <button onClick={()=>{window.location.href="http://localhost:5000/logout"}}>and this</button>
        <button onClick={()=>{}}> Submit</button>
      </section>
    </div>
  </div>
  )
}


export default Home;