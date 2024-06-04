from fastapi import FastAPI, WebSocket, HTTPException, status
import httpx

app = FastAPI()
API_BASE_URL = "https://dapi.ayozat.co.uk/api"  # Set this to your actual API base URL

# WebSocket endpoint to handle real-time chat
@app.websocket("/ws/{payperviewId}/{token}")
async def websocket_endpoint(websocket: WebSocket, payperviewId: str, token: str):
    await websocket.accept()  # Accept the WebSocket connection

    # Fetch initial messages when the user joins the chat room
    async with httpx.AsyncClient() as client:
        headers = {"Authorization": f"Bearer {token}"}
        try:
            response = await client.get(f"{API_BASE_URL}/ppv/{payperviewId}/messages", headers=headers)
            if response.status_code == 200:
                initial_messages = response.json()
                for message in initial_messages:
                    await websocket.send_json({
                        "user": message["user"]["name"],
                        "message": message["message"],
                        "time": message["created_at"]
                    })
            else:
                raise HTTPException(status_code=response.status_code, detail="Failed to fetch messages")
        except httpx.HTTPError as e:
            await websocket.close(code=status.WS_1001_GOING_AWAY)
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error fetching messages")

    # Handle incoming messages from the client and post them to the backend
    try:
        while True:
            data = await websocket.receive_text()
            message_data = {"content": data}
            response = await client.post(
                f"{API_BASE_URL}/ppv/{payperviewId}/message",
                json=message_data,
                headers=headers
            )
            if response.status_code == 201:
                await websocket.send_text("Message sent")
            else:
                await websocket.send_text("Failed to send message")
    except Exception as e:
        await websocket.close(code=status.WS_1001_GOING_AWAY)
        print(f"Error: {str(e)}")  # Print error to console

# Main function to run the server
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
