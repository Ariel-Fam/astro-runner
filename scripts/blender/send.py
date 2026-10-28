"""Send Python to the running Blender MCP add-on (local connection only)."""
import json
import socket
import sys
from pathlib import Path

code = (f'__file__ = {str(Path(sys.argv[1]).resolve())!r}\n' + Path(sys.argv[1]).read_text()) if len(sys.argv) > 1 else (
    'import bpy\nresult = {"version": bpy.app.version_string, '
    '"scene": bpy.context.scene.name, "objects": len(bpy.data.objects)}'
)
with socket.create_connection(("127.0.0.1", 9876), timeout=180) as connection:
    connection.sendall(json.dumps({
        "type": "execute", "strict_json": True, "code": code,
    }).encode() + b"\0")
    response = bytearray()
    while b"\0" not in response:
        chunk = connection.recv(65536)
        if not chunk:
            raise RuntimeError("Blender closed the connection without a response")
        response.extend(chunk)
    answer = json.loads(response.split(b"\0", 1)[0])
    print(json.dumps(answer, indent=2))
    if answer.get("status") != "ok":
        sys.exit(1)
