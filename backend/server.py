import mysql.connector
import json, os
from os import environ as env
from urllib.parse import quote_plus, urlencode

from authlib.integrations.flask_client import OAuth
from flask import Flask, jsonify, redirect, render_template, session, url_for

from dotenv import load_dotenv
load_dotenv(dotenv_path="../.env")

app = Flask(__name__)
app.secret_key = env.get("APP_SECRET_KEY")
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

# @app.route("/mysample")
# def basic():
#   try:
#     return jsonify({"success":True,"code": 200})
#   except Exception as e:
#     print(e)
#     return jsonify({"success":False,"code": 500,"message": "login with Auth0 failed."})

# Redirects user to auth0 login page
@app.route("/login")
def login():
  return oauth.auth0.authorize_redirect(
    redirect_uri = url_for("callback",_external=True)
  )

@app.route("/callback", methods=["GET", "POST"])
def callback():
  token = oauth.auth0.authorize_access_token()
  session["user"] = token
  return redirect("http://localhost:3000/platform")

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

if __name__ == "__main__":
  app.run(port=env.get("port", 5000),debug=True)

# #mysql stuff
# db = mysql.connector.connect(
#   host= "localhost", #localhost cuz we started it on our computer
#   user="root",  #the user can be root, the admin, or a user we added
#   passwd= f"{os.getenv('DB-PASSWORD')}", #whatever pass
#   database= "stuff" #the database u work with
# )
# cursor = db.cursor()
# cursor.execute("CREATE DATABASE IF NOT EXISTS stuff")
# # Flask
# #no pydantic models, manual validation
# #diff syntax for responses