from fastapi import FastAPI, WebSocket, HTTPException, status
import httpx
from typing import Dict, List

app = FastAPI()
API_BASE_URL = "https://dapi.ayozat.co.uk/api"

# Dict to manage rooms and their members
rooms: Dict[str, List[WebSocket]] = {}

async def get_messages(payperviewId: str, token: str):
    headers = {"Authorization": f"Bearer {token}"}
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{API_BASE_URL}/ppv/{payperviewId}/messages", headers=headers)
        if response.status_code == 200:
            return response.json()
        else:
            return []

async def send_message(payperviewId: str, data: dict, token: str):
    headers = {"Authorization": f"Bearer {token}"}
    print(f"data : {str(data)}")
    async with httpx.AsyncClient() as client:
        response = await client.post(f"{API_BASE_URL}/ppv/{payperviewId}/message", json=data, headers=headers)
        print(f"Sending message to API, status: {response.status_code}, response: {response.text}")
        return response.status_code == 201

@app.websocket("/ws/{payperviewId}/{token}")
async def websocket_endpoint(websocket: WebSocket, payperviewId: str, token: str):
    await websocket.accept()
    if payperviewId not in rooms:
        rooms[payperviewId] = []
    rooms[payperviewId].append(websocket)

    try:
        messages = await get_messages(payperviewId, token)
        for message in messages:
            await websocket.send_json(message)

        while True:
            data = await websocket.receive_text()
            message_sent = await send_message(payperviewId, {"message": data}, token)
            if message_sent:
                for client in rooms[payperviewId]:
                    await client.send_text(f"Message from {payperviewId}: {data}")
            else:
                await websocket.send_text("Failed to send message")
    except Exception as e:
        rooms[payperviewId].remove(websocket)
        await websocket.close()
        print(f"WebSocket Error: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
