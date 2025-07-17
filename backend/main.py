from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import json
import asyncio
from typing import Dict, List, Set
import uuid
from datetime import datetime
import os
from google.cloud import storage
from google.cloud import firestore
import uvicorn

app = FastAPI(title="Collaborative Whiteboard API")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Google Cloud clients
storage_client = storage.Client()
firestore_client = firestore.Client()

# Configuration
BUCKET_NAME = os.getenv("GCS_BUCKET_NAME", "collaborative-app-files")
PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT", "your-project-id")

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.users: Dict[str, dict] = {}

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        self.active_connections[user_id] = websocket

    def disconnect(self, user_id: str):
        if user_id in self.active_connections:
            del self.active_connections[user_id]
        if user_id in self.users:
            del self.users[user_id]

    async def send_personal_message(self, message: str, user_id: str):
        if user_id in self.active_connections:
            await self.active_connections[user_id].send_text(message)

    async def broadcast(self, message: str, exclude_user: str = None):
        for user_id, connection in self.active_connections.items():
            if user_id != exclude_user:
                try:
                    await connection.send_text(message)
                except:
                    # Connection is broken, remove it
                    self.disconnect(user_id)

    def add_user(self, user_id: str, user_data: dict):
        self.users[user_id] = user_data

    def get_users(self):
        return list(self.users.values())

manager = ConnectionManager()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    user_id = str(uuid.uuid4())
    await manager.connect(websocket, user_id)
    
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            if message["type"] == "user_join":
                user_data = message["user"]
                user_data["isOnline"] = True
                manager.add_user(user_id, user_data)
                
                # Broadcast updated user list
                await manager.broadcast(json.dumps({
                    "type": "users_update",
                    "users": manager.get_users()
                }))
                
                # Store user in Firestore
                firestore_client.collection("users").document(user_id).set({
                    **user_data,
                    "lastSeen": datetime.now(),
                    "isOnline": True
                })
                
            elif message["type"] == "drawing":
                # Store drawing point in Firestore
                drawing_data = {
                    **message["point"],
                    "timestamp": datetime.now()
                }
                firestore_client.collection("drawings").add(drawing_data)
                
                # Broadcast to other users
                await manager.broadcast(json.dumps({
                    "type": "drawing_update",
                    "point": message["point"]
                }), exclude_user=user_id)
                
            elif message["type"] == "chat":
                chat_message = message["message"]
                
                # Store message in Firestore
                firestore_client.collection("messages").add({
                    **chat_message,
                    "timestamp": datetime.now()
                })
                
                # Broadcast to all users
                await manager.broadcast(json.dumps({
                    "type": "chat_message",
                    "message": chat_message
                }))
                
            elif message["type"] == "clear_canvas":
                # Clear drawings from Firestore
                drawings_ref = firestore_client.collection("drawings")
                docs = drawings_ref.stream()
                for doc in docs:
                    doc.reference.delete()
                
                # Broadcast clear command
                await manager.broadcast(json.dumps({
                    "type": "canvas_clear"
                }), exclude_user=user_id)
                
            elif message["type"] == "file_share":
                file_message = message["message"]
                
                # Store file message in Firestore
                firestore_client.collection("messages").add({
                    **file_message,
                    "timestamp": datetime.now()
                })
                
                # Broadcast to all users
                await manager.broadcast(json.dumps({
                    "type": "file_upload",
                    "message": file_message
                }))
                
    except WebSocketDisconnect:
        manager.disconnect(user_id)
        
        # Update user status in Firestore
        firestore_client.collection("users").document(user_id).update({
            "isOnline": False,
            "lastSeen": datetime.now()
        })
        
        # Broadcast updated user list
        await manager.broadcast(json.dumps({
            "type": "users_update",
            "users": manager.get_users()
        }))

@app.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    userId: str = Form(...),
    userName: str = Form(...)
):
    try:
        # Generate unique filename
        file_extension = file.filename.split('.')[-1] if '.' in file.filename else ''
        unique_filename = f"{uuid.uuid4()}.{file_extension}"
        
        # Upload to Google Cloud Storage
        bucket = storage_client.bucket(BUCKET_NAME)
        blob = bucket.blob(f"uploads/{unique_filename}")
        
        # Upload file content
        content = await file.read()
        blob.upload_from_string(content, content_type=file.content_type)
        
        # Make blob publicly readable (configure based on security requirements)
        blob.make_public()
        
        # Generate public URL
        file_url = blob.public_url
        
        # Store file metadata in Firestore
        file_metadata = {
            "originalName": file.filename,
            "storageName": unique_filename,
            "contentType": file.content_type,
            "size": len(content),
            "uploadedBy": userId,
            "uploadedAt": datetime.now(),
            "publicUrl": file_url
        }
        
        firestore_client.collection("files").add(file_metadata)
        
        return JSONResponse({
            "success": True,
            "fileUrl": file_url,
            "fileName": file.filename,
            "fileType": file.content_type
        })
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"File upload failed: {str(e)}")

@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

@app.get("/")
async def root():
    return {"message": "Collaborative Whiteboard API", "version": "1.0.0"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
