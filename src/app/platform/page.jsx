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
          <div>Account is: sm1</div>
        </section>
      </div>
      <div className={styles.mainContent}>
        <section className={styles.chat}>
          hey
        </section>
        <section className={styles.newChat}>
          type bro
          <input type="text" name="" id="" />
        </section>
      </div>
    </div>
  )
}

export default Platform