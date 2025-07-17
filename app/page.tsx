"use client";

import type React from "react";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Eraser, Trash2, Send, Paperclip, Download, Users, Circle } from "lucide-react";

interface DrawingPoint {
  x: number;
  y: number;
  color: string;
  size: number;
  tool: "pen" | "eraser";
  userId: string;
  timestamp: number;
}

interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  message?: string;
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  timestamp: number;
}

interface User {
  id: string;
  name: string;
  color: string;
  isOnline: boolean;
}

const COLORS = ["#000000", "#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899"];
const TOOLS = ["pen", "eraser"] as const;

export default function CollaborativeApp() {
  // Canvas and drawing state
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentTool, setCurrentTool] = useState<"pen" | "eraser">("pen");
  const [currentColor, setCurrentColor] = useState("#000000");
  const [brushSize, setBrushSize] = useState(3);
  const [drawingData, setDrawingData] = useState<DrawingPoint[]>([]);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // WebSocket connection
  const wsRef = useRef<WebSocket | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize user and WebSocket connection
  useEffect(() => {
    const userId = Math.random().toString(36).substr(2, 9);
    const userName = `User ${Math.floor(Math.random() * 1000)}`;
    const userColor = COLORS[Math.floor(Math.random() * COLORS.length)];

    const user: User = {
      id: userId,
      name: userName,
      color: userColor,
      isOnline: true,
    };

    setCurrentUser(user);

    // Initialize WebSocket connection
    const connectWebSocket = () => {
      const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/ws";
      console.log("Connecting to WebSocket:", wsUrl);

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("Connected to WebSocket");
        if (user) {
          ws.send(
            JSON.stringify({
              type: "user_join",
              user: user,
            })
          );
        }
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
      };

      ws.onclose = () => {
        console.log("WebSocket connection closed, attempting to reconnect...");
        setTimeout(connectWebSocket, 3000); // Reconnect after 3 seconds
      };
    };

    // Update the useEffect to use the new connection function
    connectWebSocket();

    return () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: "user_leave",
            userId: userId,
          })
        );
      }
      wsRef.current?.close();
    };
  }, []);

  const handleWebSocketMessage = (data: any) => {
    switch (data.type) {
      case "drawing_update":
        setDrawingData((prev) => [...prev, data.point]);
        drawPoint(data.point);
        break;
      case "chat_message":
        setMessages((prev) => [...prev, data.message]);
        break;
      case "users_update":
        setUsers(data.users);
        break;
      case "canvas_clear":
        clearCanvas();
        setDrawingData([]);
        break;
      case "file_upload":
        setMessages((prev) => [...prev, data.message]);
        break;
    }
  };

  // Canvas drawing functions
  const getCanvasCoordinates = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas || !currentUser) return;

    const { x, y } = getCanvasCoordinates(e);

    const point: DrawingPoint = {
      x,
      y,
      color: currentTool === "eraser" ? "#FFFFFF" : currentColor,
      size: brushSize,
      tool: currentTool,
      userId: currentUser.id,
      timestamp: Date.now(),
    };

    drawPoint(point);
    setDrawingData((prev) => [...prev, point]);

    // Send to WebSocket
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "drawing",
          point: point,
        })
      );
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !canvasRef.current || !currentUser) return;

    const { x, y } = getCanvasCoordinates(e);

    const point: DrawingPoint = {
      x,
      y,
      color: currentTool === "eraser" ? "#FFFFFF" : currentColor,
      size: brushSize,
      tool: currentTool,
      userId: currentUser.id,
      timestamp: Date.now(),
    };

    drawPoint(point);
    setDrawingData((prev) => [...prev, point]);

    // Send to WebSocket
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "drawing",
          point: point,
        })
      );
    }
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const drawPoint = (point: DrawingPoint) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.globalCompositeOperation = point.tool === "eraser" ? "destination-out" : "source-over";
    ctx.fillStyle = point.color;
    ctx.beginPath();
    ctx.arc(point.x, point.y, point.size, 0, 2 * Math.PI);
    ctx.fill();
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const handleClearCanvas = () => {
    clearCanvas();
    setDrawingData([]);

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "clear_canvas",
        })
      );
    }
  };

  // Chat functions
  const sendMessage = () => {
    if (!newMessage.trim() || !currentUser) return;

    const message: ChatMessage = {
      id: Math.random().toString(36).substr(2, 9),
      userId: currentUser.id,
      userName: currentUser.name,
      message: newMessage,
      timestamp: Date.now(),
    };

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "chat",
          message: message,
        })
      );
    }

    setNewMessage("");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;

    // For local development, create a mock file URL
    const mockFileUrl = URL.createObjectURL(file);

    const fileMessage: ChatMessage = {
      id: Math.random().toString(36).substr(2, 9),
      userId: currentUser.id,
      userName: currentUser.name,
      fileUrl: mockFileUrl,
      fileName: file.name,
      fileType: file.type,
      timestamp: Date.now(),
    };

    // Try to upload to backend, fallback to mock for local dev
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const formData = new FormData();
      formData.append("file", file);
      formData.append("userId", currentUser.id);
      formData.append("userName", currentUser.name);

      const response = await fetch(`${apiUrl}/upload`, {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        fileMessage.fileUrl = result.fileUrl;
      }
    } catch (error) {
      console.warn("Backend upload failed, using local file URL:", error);
      // Keep using mockFileUrl for local development
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "file_share",
          message: fileMessage,
        })
      );
    } else {
      // If WebSocket is not connected, add message locally
      setMessages((prev) => [...prev, fileMessage]);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const isImageFile = (fileType?: string) => {
    return fileType?.startsWith("image/");
  };

  return (
    <div className="h-screen flex bg-gray-50">
      {/* Left Panel - Whiteboard */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <Card className="m-4 mb-2">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium">Tools:</span>
                  {TOOLS.map((tool) => (
                    <Button key={tool} variant={currentTool === tool ? "default" : "outline"} size="sm" onClick={() => setCurrentTool(tool)}>
                      {tool === "pen" ? <Circle className="w-4 h-4" /> : <Eraser className="w-4 h-4" />}
                    </Button>
                  ))}
                </div>

                <Separator orientation="vertical" className="h-6" />

                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium">Colors:</span>
                  {COLORS.map((color) => (
                    <button key={color} className={`w-6 h-6 rounded border-2 ${currentColor === color ? "border-gray-800" : "border-gray-300"}`} style={{ backgroundColor: color }} onClick={() => setCurrentColor(color)} />
                  ))}
                </div>

                <Separator orientation="vertical" className="h-6" />

                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium">Size:</span>
                  <Input type="range" min="1" max="20" value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} className="w-20" />
                  <span className="text-sm w-8">{brushSize}</span>
                </div>
              </div>

              <Button variant="destructive" size="sm" onClick={handleClearCanvas}>
                <Trash2 className="w-4 h-4 mr-2" />
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Canvas */}
        <Card className="mx-4 mb-4 flex-1">
          <CardContent className="p-0 h-full">
            <canvas ref={canvasRef} width={800} height={600} className="w-full h-full cursor-crosshair border rounded" onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing} style={{ backgroundColor: "#FFFFFF" }} />
          </CardContent>
        </Card>
      </div>

      {/* Right Panel - Chat */}
      <div className="w-80 flex flex-col border-l bg-white">
        {/* Users Panel */}
        <Card className="m-4 mb-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center">
              <Users className="w-4 h-4 mr-2" />
              Online Users ({users.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {users.map((user) => (
                <div key={user.id} className="flex items-center space-x-2">
                  <Avatar className="w-6 h-6">
                    <AvatarFallback className="text-xs text-white" style={{ backgroundColor: user.color }}>
                      {user.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm">{user.name}</span>
                  {user.isOnline && <div className="w-2 h-2 bg-green-500 rounded-full" />}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Chat Messages */}
        <Card className="mx-4 mb-2 flex-1 flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Chat</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col p-0">
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-3">
                {messages.map((msg) => (
                  <div key={msg.id} className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-medium">{msg.userName}</span>
                      <span className="text-xs text-muted-foreground">{formatTime(msg.timestamp)}</span>
                    </div>

                    {msg.message && <p className="text-sm bg-gray-100 rounded p-2">{msg.message}</p>}

                    {msg.fileUrl && (
                      <div className="bg-blue-50 rounded p-2 space-y-2">
                        <div className="flex items-center space-x-2">
                          <Paperclip className="w-4 h-4" />
                          <span className="text-sm font-medium">{msg.fileName}</span>
                        </div>

                        {isImageFile(msg.fileType) && <img src={msg.fileUrl || "/placeholder.svg"} alt={msg.fileName} className="max-w-full h-32 object-cover rounded" />}

                        <Button size="sm" variant="outline" asChild>
                          <a href={msg.fileUrl} download={msg.fileName}>
                            <Download className="w-4 h-4 mr-2" />
                            Download
                          </a>
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* Message Input */}
            <div className="p-4 border-t">
              <div className="flex space-x-2">
                <Input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Type a message..." onKeyPress={(e) => e.key === "Enter" && sendMessage()} className="flex-1" />
                <input ref={fileInputRef} type="file" onChange={handleFileUpload} className="hidden" accept="image/*,.pdf,.doc,.docx,.txt" />
                <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
                  <Paperclip className="w-4 h-4" />
                </Button>
                <Button size="sm" onClick={sendMessage}>
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
