baseurl = "https:localhost:8000/"

async function validateLogin(user, pass) {
  try{
    const response = fetch(baseurl + "validateLogin", {
      method: "POST",
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({"user":user, "pass": pass})
    })
    const data = response.json()
    if (!data.success){
      throw new Error(data.message || "Request failed")
    }
    return data
  }catch(e){
    console.error(e)
    return null
  }
}


export {validateLogin}