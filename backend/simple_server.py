#!/usr/bin/env python3
"""
Simple WebSocket server for local development
Run with: python simple_server.py
"""

import asyncio
import json
import websockets
import logging
from datetime import datetime
import uuid
from typing import Dict, Set
import os
from pathlib import Path

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Store connected clients and their data
connected_clients: Dict[websockets.WebSocketServerProtocol, dict] = {}
users: Dict[str, dict] = {}
messages: list = []
drawings: list = []

async def handle_client(websocket, path):
    """Handle WebSocket client connections"""
    user_id = str(uuid.uuid4())
    logger.info(f"New client connected: {user_id}")
    
    try:
        async for message in websocket:
            try:
                data = json.loads(message)
                await handle_message(websocket, user_id, data)
            except json.JSONDecodeError:
                logger.error(f"Invalid JSON received from {user_id}")
            except Exception as e:
                logger.error(f"Error handling message from {user_id}: {e}")
                
    except websockets.exceptions.ConnectionClosed:
        logger.info(f"Client {user_id} disconnected")
    finally:
        # Clean up user data
        if user_id in users:
            del users[user_id]
        if websocket in connected_clients:
            del connected_clients[websocket]
        
        # Broadcast updated user list
        await broadcast_users()

async def handle_message(websocket, user_id, data):
    """Handle different types of messages"""
    message_type = data.get("type")
    
    if message_type == "user_join":
        user_data = data["user"]
        user_data["id"] = user_id
        users[user_id] = user_data
        connected_clients[websocket] = user_data
        logger.info(f"User joined: {user_data['name']}")
        await broadcast_users()
        
    elif message_type == "drawing":
        point = data["point"]
        drawings.append(point)
        # Broadcast to all other clients
        await broadcast_to_others(websocket, {
            "type": "drawing_update",
            "point": point
        })
        
    elif message_type == "chat":
        message = data["message"]
        messages.append(message)
        logger.info(f"Chat message from {message['userName']}: {message.get('message', 'file')}")
        # Broadcast to all clients
        await broadcast_to_all({
            "type": "chat_message",
            "message": message
        })
        
    elif message_type == "clear_canvas":
        drawings.clear()
        logger.info("Canvas cleared")
        # Broadcast to all other clients
        await broadcast_to_others(websocket, {
            "type": "canvas_clear"
        })
        
    elif message_type == "file_share":
        file_message = data["message"]
        messages.append(file_message)
        logger.info(f"File shared: {file_message['fileName']}")
        # Broadcast to all clients
        await broadcast_to_all({
            "type": "file_upload",
            "message": file_message
        })

async def broadcast_users():
    """Broadcast current user list to all clients"""
    user_list = list(users.values())
    message = {
        "type": "users_update",
        "users": user_list
    }
    await broadcast_to_all(message)

async def broadcast_to_all(message):
    """Broadcast message to all connected clients"""
    if connected_clients:
        message_str = json.dumps(message)
        await asyncio.gather(
            *[client.send(message_str) for client in connected_clients.keys()],
            return_exceptions=True
        )

async def broadcast_to_others(sender_websocket, message):
    """Broadcast message to all clients except sender"""
    other_clients = [client for client in connected_clients.keys() if client != sender_websocket]
    if other_clients:
        message_str = json.dumps(message)
        await asyncio.gather(
            *[client.send(message_str) for client in other_clients],
            return_exceptions=True
        )

def main():
    """Start the WebSocket server"""
    host = "localhost"
    port = 8000
    
    logger.info(f"Starting WebSocket server on {host}:{port}")
    logger.info("Connect your frontend to: ws://localhost:8000/ws")
    
    start_server = websockets.serve(handle_client, host, port)
    
    try:
        asyncio.get_event_loop().run_until_complete(start_server)
        asyncio.get_event_loop().run_forever()
    except KeyboardInterrupt:
        logger.info("Server stopped by user")

if __name__ == "__main__":
    main()
