import mysql.connector
import json, os
from os import environ as env
from urllib.parse import quote_plus, urlencode

from authlib.integrations.flask_client import OAuth
from flask import Flask, request, jsonify, redirect, render_template, session, url_for
from flask_cors import CORS

from dotenv import load_dotenv
load_dotenv(dotenv_path="../.env")

# create flask app and register with the Auth0 service
app = Flask(__name__)
app.secret_key = env.get("APP_SECRET_KEY")
CORS(app)

oauth = OAuth(app)
oauth.register(
  "auth0",
  client_id = env.get("AUTH0_CLIENT_ID"),
  client_secret = env.get("AUTH0_CLIENT_SECRET"),
  client_kwards = {
    "scope": "openid profile email",
  },
  server_metadata_url = f'https://{env.get("AUTH0_DOMAIN")}/.well-known/openid-configuration'
)

#context manager for opening/closing connection and cursor easily
class AccessDatabase:
  def __init__(self):
    self.conn = None
    self.cursor = None
  def __enter__(self):
    self.conn = mysql.connector.connect(
      host= "localhost", #localhost cuz we started it on our computer
      user="root",  #the user can be root (the admin) or a user we added
      passwd= f"{os.getenv('DB_PASSWORD')}", #whatever pass
      database= "projectplace" #the database u work with
    )
    self.cursor = self.conn.cursor()
    return self.cursor
  def __exit__(self, exc_type, exc_value, exc_tb):
    self.conn.commit()
    self.cursor.close()
    self.conn.close()


with AccessDatabase() as cursor:
  cursor.execute(
    '''
    CREATE TABLE IF NOT EXISTS messages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      roomID VARCHAR(10),
      username VARCHAR(70),
      message TEXT
    )
    '''
  )
  cursor.execute(
    '''
    CREATE TABLE IF NOT EXISTS rooms (
      id INT AUTO_INCREMENT PRIMARY KEY,
      roomID VARCHAR(10),
      roomName VARCHAR(70)
    )
    '''
  )

# Adds message from any room to messages table
@app.route("/storeMessage", methods=["POST"])
def storeMessage():
  try:
    data = request.get_json()
    with AccessDatabase() as cursor:
      cursor.execute("INSERT INTO messages (username, roomID, message) VALUES (%s, %s, %s)", (data["username"], data["roomID"], data["message"]))
      
    return jsonify({"success":True,"code": 200})
  except Exception as e:
    print(e)
    return jsonify({"success":False,"code": 500,"message": "Failed to upadte messages."})


#Returns all chats from a room provided its roomID
@app.route("/getRoomMessages", methods=["POST"])
def getRoomMessages():
  try:
    data = request.get_json()
    with AccessDatabase() as cursor:
      cursor.execute("SELECT username, message FROM messages WHERE roomID = %s", (data["roomID"],))
      messages = cursor.fetchall()
    return jsonify({"success": True, "data": messages, "code": 200, })
  except Exception as e:
    print(e)
    return jsonify({"success": False, "code": 500, "message": "Failed to get room messages"})

# Creates room with name and unique 6 char code
@app.route("/createRoom", methods=["POST"])
def createRoom():
  try:
    data = request.get_json()
    with AccessDatabase() as cursor:
      exists = True
      while (exists):
        roomID = generateRoomCode()
        cursor.execute("SELECT * from rooms WHERE roomID=%s",(roomID,))
        exists = cursor.fetchone() is not None
      cursor.execute("INSERT INTO rooms (roomID, roomName) VALUES (%s, %s)",(roomID, data["roomName"]))

    return jsonify({"success": True, "data": roomID, "code": 200})
  except Exception as e:
    print(e)
    return jsonify({"success": False, "code": 500,"message": "failed to create room"})

# checks if roomID exists
@app.route("/validateRoom", methods=["POST"])
def validateRoom():
  try:
    data = request.get_json()
    with AccessDatabase() as cursor:
      cursor.execute("SELECT * FROM rooms where roomID=%s",(data["roomID"],))
      exists = cursor.fetchone() is not None

    return jsonify({"success":True,"data": exists ,"code":200})
  except Exception as e:
    print(e)
    return jsonify({"success":False, "code": 500, "message": "failed to valdiate room"})

#-----------------AUTH0 STUFF------------------

# Redirects user to auth0 login page
@app.route("/login")
def login():
  return oauth.auth0.authorize_redirect(
    redirect_uri = url_for("callback",_external=True)
  )

# Redirects user to home page (or page after authentication)
@app.route("/callback", methods=["GET", "POST"])
def callback():
  token = oauth.auth0.authorize_access_token()
  session["user"] = token
  return redirect("http://localhost:3000/platform")

# Ends the user's session, and redirects them to home page.
@app.route("/logout")
def logout():
  session.clear()
  return redirect(
    "https://"
    + env.get("AUTH0_DOMAIN")
    + "/v2/logout?"
    + urlencode(
        {
          "returnTo": "http://localhost:3000",
          "client_id": env.get("AUTH0_CLIENT_ID"),
        },
        quote_via=quote_plus,
    )
  )

# returns random 6 digit string. [A-Z]or [0-9]. Letters more likely
def generateRoomCode():
  from random import randint, choice
  code = []
  for _ in range(6):
    value = choice([randint(65,90),randint(65,90), randint(65,90),randint(48,57)])
    code.append(chr(value))
  
  return "".join(code)



if __name__ == "__main__":
  app.run(port=env.get("port", 5000),debug=True)